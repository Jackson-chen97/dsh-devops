/**
 * /devops/api HTTP routes — client-facing endpoints for the settings wizard.
 *
 * These routes work with RAW parameters (baseUrl, path, tokenEnv, kubeconfigPath)
 * rather than the pre-configured service instances, so the user can test
 * connectivity BEFORE saving the config.
 *
 * All methods are POST with JSON body → JSON response.
 * Security: localhost-only (same pattern as dsh-better-sidebar's fence).
 */

import { request as httpsRequest } from 'node:https'
import { parseKubeconfig, expandPath } from './k8s/kubeconfig.js'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function writeJson(res: any, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function readBody(req: any): Promise<any> {
  // If the framework has already parsed the body (common with DSH webServer),
  // return it immediately instead of trying to listen on a consumed stream.
  if (req.body && typeof req.body === 'object') {
    return Promise.resolve(req.body)
  }
  // If the stream is no longer readable (already consumed by a middleware),
  // there are no more 'data'/'end' events — resolve with whatever we have.
  if (req.readable === false || req.readable === undefined && req._readableState?.readable === false) {
    return Promise.resolve(req.body ?? {})
  }
  return new Promise((resolve, reject) => {
    let data = ''
    let settled = false
    const finish = (val: any) => { if (!settled) { settled = true; resolve(val) } }
    const fail = (err: Error) => { if (!settled) { settled = true; reject(err) } }
    req.on('data', (chunk: string) => { data += chunk })
    req.on('end', () => {
      try { finish(data ? JSON.parse(data) : {}) }
      catch { finish({}) }
    })
    req.on('error', fail)
    // Safety net: if neither 'data' nor 'end' ever fires (stream already
    // consumed upstream), this resolves after 1s instead of hanging forever.
    setTimeout(() => {
      if (!settled) {
        try { finish(data ? JSON.parse(data) : {}) }
        catch { finish({}) }
      }
    }, 1000).unref()
  })
}

/** Check if the request is from localhost. */
function isLocalhost(req: any): boolean {
  const addr = req.socket?.remoteAddress ?? ''
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1'
}

/** Mask secret header values for logging. */
function maskHeaders(headers: Record<string, string> | Headers | undefined): string {
  if (!headers) return '{}'
  try {
    const h = new Headers(headers as any)
    const out: Record<string, string> = {}
    h.forEach((v, k) => { out[k] = /token|authorization|key|cookie/i.test(k) ? v.slice(0, 6) + '***' : v })
    return JSON.stringify(out)
  } catch { return '{}' }
}

/** Fetch with timeout via AbortController. Logs URL + request + response to devops.log.
 *  When `tls` is given (a resolved kubeconfig context), the cluster CA is pinned
 *  (or verification skipped on insecureSkipTlsVerify) — native fetch cannot do per-request CAs. */
async function fetchWithTimeout(url: string, init: RequestInit, ms = 5000, tls?: { caData?: string; insecureSkipTlsVerify?: boolean }): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  const method = (init.method ?? 'GET').toUpperCase()
  const bodySnippet = init.body ? String(init.body).slice(0, 300) : ''
  writeLog('info', 'API-REQ', `${method} ${url} | headers=${maskHeaders(init.headers as any)}${bodySnippet ? ' | body=' + bodySnippet : ''}`)
  const started = Date.now()
  try {
    let res: Response
    if (tls?.caData || tls?.insecureSkipTlsVerify) {
      res = await httpsGet(url, {
        headers: init.headers as Record<string, string>,
        signal: ctrl.signal,
        ca: tls.caData ? Buffer.from(tls.caData, 'base64') : undefined,
        insecureSkipTlsVerify: tls.insecureSkipTlsVerify,
      })
    } else {
      res = await fetch(url, { ...init, signal: ctrl.signal })
    }
    const text = await res.text()
    writeLog(res.ok ? 'info' : 'warn', 'API-RES', `${res.status} ${method} ${url} | ${Date.now() - started}ms | ${text.slice(0, 800)}`)
    // Reconstruct a Response with the (now-consumed) body so callers can still .json()/.text()
    // Body-less statuses (204/304) must get a null body or Node's Response throws.
    const bodyless = res.status === 204 || res.status === 304
    return new Response(bodyless ? null : text, { status: res.status, statusText: res.statusText, headers: res.headers })
  } catch (err: any) {
    writeLog('error', 'API-ERR', `${method} ${url} | ${Date.now() - started}ms | ${err.name === 'AbortError' ? `timeout(${ms}ms)` : (err.message ?? 'unknown')}`)
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/** GET via node:https with an optional pinned CA (fetch cannot set a per-request CA). */
function httpsGet(url: string, opts: { headers?: Record<string, string>; signal?: AbortSignal; ca?: Buffer; insecureSkipTlsVerify?: boolean; method?: string; body?: string }): Promise<Response> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = httpsRequest(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: `${u.pathname}${u.search}`,
        method: opts.method ?? 'GET',
        headers: opts.body ? { ...opts.headers, 'Content-Length': Buffer.byteLength(opts.body) } : opts.headers,
        ...(opts.insecureSkipTlsVerify
          ? { rejectUnauthorized: false }
          : opts.ca
            ? { ca: opts.ca, rejectUnauthorized: true, checkServerIdentity: () => undefined }
            : {}),
      },
      (upstream) => {
        const chunks: Buffer[] = []
        upstream.on('data', (c: Buffer) => chunks.push(c))
        upstream.on('end', () => {
          resolve(new Response(Buffer.concat(chunks).toString('utf8'), {
            status: upstream.statusCode ?? 0,
            statusText: upstream.statusMessage ?? '',
          }))
        })
      },
    )
    req.on('error', reject)
    opts.signal?.addEventListener('abort', () => req.destroy(new Error('AbortError')))
    if (opts.body) req.write(opts.body)
    req.end()
  })
}

// ─── GitLab test + branches ────────────────────────────────────────────────────

async function testGitLab(params: { baseUrl: string; token: string }): Promise<any> {
  const { baseUrl, token } = params
  if (!baseUrl || !token) {
    return { ok: false, message: 'Missing required fields: baseUrl, token' }
  }
  try {
    // Hit the /api/v4/user endpoint to validate the token
    const url = `${baseUrl.replace(/\/+$/, '')}/api/v4/user`
    const res = await fetchWithTimeout(url, {
      headers: { 'PRIVATE-TOKEN': token },
    })
    if (res.status === 401) return { ok: false, message: 'Authentication failed (401) — token invalid or expired' }
    if (!res.ok) return { ok: false, message: `GitLab API error: ${res.status} ${res.statusText}` }
    const user = await res.json() as { username?: string; name?: string }
    return {
      ok: true,
      message: `Connected as ${user.username ?? user.name ?? 'user'}`,
    }
  } catch (err: any) {
    if (err.name === 'AbortError') return { ok: false, message: 'Connection timed out (5s)' }
    return { ok: false, message: `Network error: ${err.message}` }
  }
}

/** Fetch/search projects visible to the token. Optional `search` keyword for server-side filtering. */
async function gitlabProjects(params: { baseUrl: string; token: string; search?: string }): Promise<any> {
  const { baseUrl, token, search } = params
  if (!baseUrl || !token) return { ok: false, projects: [], message: 'Missing baseUrl or token' }
  try {
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : ''
    const url = `${baseUrl.replace(/\/+$/, '')}/api/v4/projects?membership=true&per_page=100&order_by=last_activity_at&sort=desc${searchParam}`
    const res = await fetchWithTimeout(url, {
      headers: { 'PRIVATE-TOKEN': token },
    }, 20000)
    if (!res.ok) return { ok: false, projects: [], message: `GitLab API error: ${res.status}` }
    const raw = (await res.json()) as { id: number; name: string; path_with_namespace: string; default_branch: string }[]
    const projects = raw.map((p) => ({
      id: String(p.id),
      name: p.name,
      path: p.path_with_namespace,
      defaultBranch: p.default_branch,
    }))
    return { ok: true, projects }
  } catch (err: any) {
    if (err.name === 'AbortError') return { ok: false, projects: [], message: 'Timed out' }
    return { ok: false, projects: [], message: err.message }
  }
}

async function gitlabBranches(params: { baseUrl: string; path: string; token: string; search?: string }): Promise<any> {
  const { baseUrl, path, token, search } = params
  if (!token) return { ok: false, branches: [], message: 'Missing token' }
  try {
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : ''
    const url = `${baseUrl.replace(/\/+$/, '')}/api/v4/projects/${encodeURIComponent(path)}/repository/branches?per_page=100${searchParam}`
    const res = await fetchWithTimeout(url, {
      headers: { 'PRIVATE-TOKEN': token },
    }, 12000)
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { ok: false, branches: [], message: `GitLab API error: ${res.status}${detail ? ' | ' + detail.slice(0, 120) : ''}` }
    }
    const raw = (await res.json()) as { name: string; default?: boolean }[]
    return { ok: true, branches: raw.map((b) => ({ name: b.name, isDefault: b.default === true })) }
  } catch (err: any) {
    if (err.name === 'AbortError') return { ok: false, branches: [], message: 'Timed out' }
    return { ok: false, branches: [], message: err.message }
  }
}

/** Latest commit on a branch (for MR description auto-fill). */
async function gitlabLastCommit(params: { baseUrl: string; path: string; token: string; branch: string }): Promise<any> {
  const { baseUrl, path, token, branch } = params
  if (!token || !branch) return { ok: false, message: 'Missing token or branch' }
  try {
    const url = `${baseUrl.replace(/\/+$/, '')}/api/v4/projects/${encodeURIComponent(path)}/repository/commits?ref_name=${encodeURIComponent(branch)}&per_page=1`
    const res = await fetchWithTimeout(url, {
      headers: { 'PRIVATE-TOKEN': token },
    }, 12000)
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { ok: false, message: `GitLab API error: ${res.status}${detail ? ' | ' + detail.slice(0, 120) : ''}` }
    }
    const raw = (await res.json()) as { short_id?: string; title?: string; message?: string; author_name?: string; committed_date?: string }[]
    const c = raw[0]
    if (!c) return { ok: false, message: '分支上没有提交' }
    return { ok: true, shortId: c.short_id ?? '', title: c.title ?? '', message: (c.message ?? '').trim(), author: c.author_name ?? '', date: c.committed_date ?? '' }
  } catch (err: any) {
    if (err.name === 'AbortError') return { ok: false, message: 'Timed out' }
    return { ok: false, message: err.message }
  }
}

/** List project members (for the MR reviewer dropdown). */
async function gitlabMembers(params: { baseUrl: string; path: string; token: string; search?: string }): Promise<any> {
  const { baseUrl, path, token, search } = params
  if (!token) return { ok: false, members: [], message: 'Missing token' }
  try {
    const searchParam = search ? `&query=${encodeURIComponent(search)}` : ''
    const url = `${baseUrl.replace(/\/+$/, '')}/api/v4/projects/${encodeURIComponent(path)}/members/all?per_page=100${searchParam}`
    const res = await fetchWithTimeout(url, {
      headers: { 'PRIVATE-TOKEN': token },
    }, 12000)
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { ok: false, members: [], message: `GitLab API error: ${res.status}${detail ? ' | ' + detail.slice(0, 120) : ''}` }
    }
    const raw = (await res.json()) as { username: string; name: string }[]
    return { ok: true, members: raw.map((m) => ({ username: m.username, name: m.name })) }
  } catch (err: any) {
    if (err.name === 'AbortError') return { ok: false, members: [], message: 'Timed out' }
    return { ok: false, members: [], message: err.message }
  }
}

// ─── K8s test + contexts + namespaces + deployments ───────────────────────────

async function testK8s(params: { kubeconfigPath: string; context?: string }): Promise<any> {
  const { kubeconfigPath, context } = params
  if (!kubeconfigPath) return { ok: false, message: 'Missing kubeconfigPath' }
  try {
    const kctx = parseKubeconfig(kubeconfigPath, context)
    // Hit the API server /version endpoint
    const res = await fetchWithTimeout(`${kctx.server}/version`, {
      headers: { Authorization: `Bearer ${kctx.token}`, Accept: 'application/json' },
    }, 5000, kctx)
    if (res.status === 401) return { ok: false, message: 'K8s API: token rejected (401) — token expired or invalid' }
    if (res.status === 403) return { ok: false, message: 'K8s API: forbidden (403) — insufficient RBAC permissions' }
    if (!res.ok) return { ok: false, message: `K8s API error: ${res.status} ${res.statusText}` }
    const info = (await res.json()) as { gitVersion?: string }
    // Also list available contexts for the dropdown. Each entry carries the
    // namespace configured for that context (may be empty) so the client can
    // prefill the namespace field when the user switches context.
    const expanded = expandPath(kubeconfigPath)
    let contexts: { name: string; namespace: string }[] = []
    try {
      const { readFileSync } = await import('node:fs')
      const { parse } = await import('yaml')
      const doc = parse(readFileSync(expanded, 'utf8')) as any
      contexts = (doc?.contexts ?? [])
        .map((c: any) => ({ name: c?.name ?? '', namespace: c?.context?.namespace ?? '' }))
        .filter((c: any) => c.name)
    } catch { /* best-effort */ }
    return {
      ok: true,
      message: `Connected to ${kctx.server} (${info.gitVersion ?? 'unknown version'})`,
      server: kctx.server,
      namespace: kctx.namespace,
      contexts,
    }
  } catch (err: any) {
    return { ok: false, message: err.message }
  }
}

async function k8sContexts(params: { kubeconfigPath: string }): Promise<any> {
  const { kubeconfigPath } = params
  if (!kubeconfigPath) return { ok: false, contexts: [], message: 'Missing kubeconfigPath' }
  try {
    const expanded = expandPath(kubeconfigPath)
    const { readFileSync } = await import('node:fs')
    const { parse } = await import('yaml')
    const doc = parse(readFileSync(expanded, 'utf8')) as any
    // Return { name, namespace } per context so the client can prefill the
    // namespace field from the kubeconfig's configured namespace (may be empty).
    const contexts = (doc?.contexts ?? [])
      .map((c: any) => ({ name: c?.name ?? '', namespace: c?.context?.namespace ?? '' }))
      .filter((c: any) => c.name)
    return { ok: true, contexts }
  } catch (err: any) {
    return { ok: false, contexts: [], message: err.message }
  }
}

async function k8sNamespaces(params: { kubeconfigPath: string; context?: string }): Promise<any> {
  const { kubeconfigPath, context } = params
  try {
    const kctx = parseKubeconfig(kubeconfigPath, context)
    const res = await fetchWithTimeout(`${kctx.server}/api/v1/namespaces`, {
      headers: { Authorization: `Bearer ${kctx.token}`, Accept: 'application/json' },
    }, 5000, kctx)
    if (!res.ok) return { ok: false, namespaces: [], message: `K8s API error: ${res.status}` }
    const data = (await res.json()) as { items: { metadata: { name: string; namespace?: string }; status?: { phase?: string } }[] }
    // Only include active namespaces
    const namespaces = data.items
      .filter((ns) => ns.status?.phase === 'Active' || !ns.status)
      .map((ns) => ns.metadata.name)
    return { ok: true, namespaces }
  } catch (err: any) {
    return { ok: false, namespaces: [], message: err.message }
  }
}

async function k8sDeployments(params: { kubeconfigPath: string; context?: string; namespace: string }): Promise<any> {
  const { kubeconfigPath, context, namespace } = params
  try {
    const kctx = parseKubeconfig(kubeconfigPath, context)
    const ns = namespace || kctx.namespace
    const res = await fetchWithTimeout(
      `${kctx.server}/apis/apps/v1/namespaces/${encodeURIComponent(ns)}/deployments`,
      { headers: { Authorization: `Bearer ${kctx.token}`, Accept: 'application/json' } },
      10000, kctx,
    )
    if (!res.ok) return { ok: false, deployments: [], message: `K8s API error: ${res.status}` }
    const data = (await res.json()) as any
    const deployments = (data.items ?? []).map((d: any) => {
      const spec = d.spec ?? {}
      const status = d.status ?? {}
      const image = spec?.template?.spec?.containers?.[0]?.image ?? ''
      return {
        name: d.metadata?.name ?? '',
        ready: status.readyReplicas ?? 0,
        replicas: status.replicas ?? spec.replicas ?? 0,
        image,
        imageTag: (image.split(':')[1] ?? '').slice(0, 24),
        updated: d.metadata?.creationTimestamp ?? '',
      }
    })
    return { ok: true, deployments }
  } catch (err: any) {
    return { ok: false, deployments: [], message: err.message }
  }
}

// ─── Dashboard endpoints (for the client-side monitoring panel) ─────────────────

/** List merge requests for a project. */
async function gitlabMRs(params: { baseUrl: string; token: string; projectPath: string; state?: string }): Promise<any> {
  const { baseUrl, token, projectPath, state } = params
  if (!baseUrl || !token || !projectPath) return { ok: false, mergeRequests: [], message: 'Missing baseUrl, token or projectPath' }
  try {
    const stateParam = state ? `&state=${encodeURIComponent(state)}` : '&state=opened'
    const url = `${baseUrl.replace(/\/+$/, '')}/api/v4/projects/${encodeURIComponent(projectPath)}/merge_requests?per_page=20&order_by=updated_at&sort=desc${stateParam}`
    const res = await fetchWithTimeout(url, {
      headers: { 'PRIVATE-TOKEN': token },
    }, 10000)
    if (!res.ok) return { ok: false, mergeRequests: [], message: `GitLab API error: ${res.status}` }
    const raw = (await res.json()) as any[]
    const mergeRequests = raw.map((mr) => ({
      iid: mr.iid,
      title: mr.title,
      state: mr.state,
      author: mr.author?.username ?? 'unknown',
      sourceBranch: mr.source_branch,
      targetBranch: mr.target_branch,
      createdAt: mr.created_at,
      updatedAt: mr.updated_at,
      approvalsBeforeMerge: mr.approvals_before_merge ?? null,
      mergeStatus: mr.merge_status ?? '',
      workInProgress: !!mr.work_in_progress,
      draft: !!mr.draft,
      webUrl: mr.web_url,
    }))
    return { ok: true, mergeRequests }
  } catch (err: any) {
    if (err.name === 'AbortError') return { ok: false, mergeRequests: [], message: 'Timed out' }
    return { ok: false, mergeRequests: [], message: err.message }
  }
}

/** List recent pipelines for a project. */
async function gitlabPipelines(params: { baseUrl: string; token: string; projectPath: string; ref?: string; perPage?: number }): Promise<any> {
  const { baseUrl, token, projectPath, ref, perPage } = params
  if (!baseUrl || !token || !projectPath) return { ok: false, pipelines: [], message: 'Missing baseUrl, token or projectPath' }
  try {
    const refParam = ref ? `&ref=${encodeURIComponent(ref)}` : ''
    const count = Math.min(perPage ?? 10, 50)
    const url = `${baseUrl.replace(/\/+$/, '')}/api/v4/projects/${encodeURIComponent(projectPath)}/pipelines?per_page=${count}&order_by=id&sort=desc${refParam}`
    const res = await fetchWithTimeout(url, {
      headers: { 'PRIVATE-TOKEN': token },
    }, 10000)
    if (!res.ok) return { ok: false, pipelines: [], message: `GitLab API error: ${res.status}` }
    const raw = (await res.json()) as any[]
    const pipelines = raw.map((p) => ({
      id: p.id,
      status: p.status,
      ref: p.ref,
      sha: p.sha?.slice(0, 8),
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      duration: p.duration,
    }))
    return { ok: true, pipelines }
  } catch (err: any) {
    if (err.name === 'AbortError') return { ok: false, pipelines: [], message: 'Timed out' }
    return { ok: false, pipelines: [], message: err.message }
  }
}

/** Jobs of a pipeline (for the expandable pipeline detail view). */
async function gitlabPipelineJobs(params: { baseUrl: string; token: string; projectPath: string; pipelineId: number }): Promise<any> {
  const { baseUrl, token, projectPath, pipelineId } = params
  if (!baseUrl || !token || !projectPath) return { ok: false, jobs: [], message: 'Missing params' }
  try {
    const url = `${baseUrl.replace(/\/+$/, '')}/api/v4/projects/${encodeURIComponent(projectPath)}/pipelines/${pipelineId}/jobs?per_page=50`
    const res = await fetchWithTimeout(url, {
      headers: { 'PRIVATE-TOKEN': token },
    }, 15000)
    if (!res.ok) return { ok: false, jobs: [], message: `GitLab API error: ${res.status}` }
    const raw = (await res.json()) as any[]
    const jobs = raw.map((j) => ({
      id: j.id,
      name: j.name,
      stage: j.stage,
      status: j.status,
      duration: j.duration,
      failureReason: j.failure_reason || '',
    }))
    return { ok: true, jobs }
  } catch (err: any) {
    return { ok: false, jobs: [], message: err.message }
  }
}

/** List pods in a K8s namespace. */
async function k8sPods(params: { kubeconfigPath: string; context?: string; namespace: string }): Promise<any> {
  const { kubeconfigPath, context, namespace } = params
  if (!kubeconfigPath || !namespace) return { ok: false, pods: [], message: 'Missing kubeconfigPath or namespace' }
  try {
    const kctx = parseKubeconfig(kubeconfigPath, context)
    const res = await fetchWithTimeout(
      `${kctx.server}/api/v1/namespaces/${encodeURIComponent(namespace)}/pods`,
      { headers: { Authorization: `Bearer ${kctx.token}`, Accept: 'application/json' } },
      10000, kctx,
    )
    if (!res.ok) return { ok: false, pods: [], message: `K8s API error: ${res.status}` }
    const data = (await res.json()) as any
    const pods = (data.items ?? []).map((pod: any) => {
      const cs = pod.status?.containerStatuses ?? []
      const restarts = cs.reduce((sum: number, c: any) => sum + (c.restartCount ?? 0), 0)
      // Surface a meaningful failure reason: current waiting state wins, else
      // the last terminated reason (e.g. OOMKilled, Error) for crashlooping pods.
      let reason = ''
      for (const c of cs) {
        if (c.state?.waiting?.reason) reason = c.state.waiting.reason
        else if (!reason && c.lastState?.terminated?.reason && c.lastState.terminated.reason !== 'Completed') {
          reason = c.lastState.terminated.reason
        }
      }
      return {
        name: pod.metadata?.name,
        phase: pod.status?.phase ?? 'Unknown',
        ready: cs.filter((c: any) => c.ready).length,
        total: cs.length,
        restarts,
        node: pod.spec?.nodeName ?? '',
        reason,
        startedAt: pod.status?.startTime ?? '',
      }
    })
    return { ok: true, pods }
  } catch (err: any) {
    if (err.name === 'AbortError') return { ok: false, pods: [], message: 'Timed out' }
    return { ok: false, pods: [], message: err.message }
  }
}

/** List recent events in a K8s namespace. */
async function k8sEvents(params: { kubeconfigPath: string; context?: string; namespace: string; limit?: number }): Promise<any> {
  const { kubeconfigPath, context, namespace, limit } = params
  if (!kubeconfigPath || !namespace) return { ok: false, events: [], message: 'Missing kubeconfigPath or namespace' }
  try {
    const kctx = parseKubeconfig(kubeconfigPath, context)
    const count = Math.min(limit ?? 20, 100)
    const res = await fetchWithTimeout(
      `${kctx.server}/api/v1/namespaces/${encodeURIComponent(namespace)}/events?limit=${count}&sort={by:lastTimestamp,order:descending}`,
      { headers: { Authorization: `Bearer ${kctx.token}`, Accept: 'application/json' } },
      10000, kctx,
    )
    if (!res.ok) return { ok: false, events: [], message: `K8s API error: ${res.status}` }
    const data = (await res.json()) as any
    const events = (data.items ?? []).map((ev: any) => ({
      type: ev.type ?? 'Normal',
      reason: ev.reason ?? '',
      message: ev.message ?? '',
      object: ev.involvedObject?.name ?? '',
      kind: ev.involvedObject?.kind ?? '',
      time: ev.lastTimestamp ?? ev.eventTime ?? '',
    }))
    return { ok: true, events }
  } catch (err: any) {
    if (err.name === 'AbortError') return { ok: false, events: [], message: 'Timed out' }
    return { ok: false, events: [], message: err.message }
  }
}

// ─── GitLab action endpoints (for dashboard buttons) ────────────────────────────

/** List repository tags for a project (newest first). */
async function gitlabTags(params: { baseUrl: string; token: string; projectPath: string }): Promise<any> {
  const { baseUrl, token, projectPath } = params
  if (!baseUrl || !token || !projectPath) return { ok: false, tags: [], message: 'Missing baseUrl, token or projectPath' }
  try {
    const url = `${baseUrl.replace(/\/+$/, '')}/api/v4/projects/${encodeURIComponent(projectPath)}/repository/tags?per_page=20&order_by=updated&sort=desc`
    const res = await fetchWithTimeout(url, { headers: { 'PRIVATE-TOKEN': token } }, 10000)
    if (!res.ok) return { ok: false, tags: [], message: `GitLab API error: ${res.status}` }
    const raw = (await res.json()) as any[]
    const tags = raw.map((t) => ({
      name: t.name,
      message: t.message ?? (t.release?.message ?? ''),
      createdAt: t.commit?.created_at ?? '',
    }))
    return { ok: true, tags }
  } catch (err: any) {
    if (err.name === 'AbortError') return { ok: false, tags: [], message: 'Timed out' }
    return { ok: false, tags: [], message: err.message }
  }
}

/** Resolve a list of usernames to GitLab user ids (best-effort) for reviewer_ids. */
async function resolveUserIds(baseUrl: string, token: string, names: string[]): Promise<number[]> {
  const ids: number[] = []
  for (const name of names) {
    try {
      const su = await fetchWithTimeout(
        `${baseUrl.replace(/\/+$/, '')}/api/v4/users?search=${encodeURIComponent(name)}&per_page=5`,
        { headers: { 'PRIVATE-TOKEN': token } },
        8000,
      )
      if (!su.ok) continue
      const users = (await su.json()) as { id: number; username: string }[]
      const u = users.find((x) => x.username.toLowerCase() === name.toLowerCase()) ?? users[0]
      if (u?.id) ids.push(u.id)
    } catch { /* skip unresolvable reviewer */ }
  }
  return ids
}

/** Create a merge request. `reviewers` is a comma/space separated username list. */
async function gitlabCreateMr(params: {
  baseUrl: string; token: string; projectPath: string
  sourceBranch: string; targetBranch: string; title: string; description?: string; reviewers?: string
}): Promise<any> {
  const { baseUrl, token, projectPath, sourceBranch, targetBranch, title, description, reviewers } = params
  if (!baseUrl || !token || !projectPath) return { ok: false, message: 'Missing baseUrl, token or projectPath' }
  if (!sourceBranch || !targetBranch || !title) return { ok: false, message: 'Missing source, target or title' }
  try {
    const url = `${baseUrl.replace(/\/+$/, '')}/api/v4/projects/${encodeURIComponent(projectPath)}/merge_requests`
    const body: Record<string, unknown> = {
      source_branch: sourceBranch,
      target_branch: targetBranch,
      title,
      remove_source_branch: true,
    }
    if (description) body.description = description
    if (reviewers) {
      const names = reviewers.split(/[,，\s]+/).map((s) => s.trim().replace(/^@/, '')).filter(Boolean)
      const ids = await resolveUserIds(baseUrl, token, names)
      if (ids.length) body['reviewer_ids'] = ids
    }
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, 10000)
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { ok: false, message: `GitLab API error: ${res.status}${detail ? ' | ' + detail.slice(0, 160) : ''}` }
    }
    const mr = (await res.json()) as any
    return { ok: true, mergeRequest: { iid: mr.iid, title: mr.title, webUrl: mr.web_url } }
  } catch (err: any) {
    if (err.name === 'AbortError') return { ok: false, message: 'Timed out' }
    return { ok: false, message: err.message }
  }
}

/** Create a lightweight tag. */
async function gitlabCreateTag(params: {
  baseUrl: string; token: string; projectPath: string; tagName: string; ref: string; message?: string
}): Promise<any> {
  const { baseUrl, token, projectPath, tagName, ref, message } = params
  if (!baseUrl || !token || !projectPath) return { ok: false, message: 'Missing baseUrl, token or projectPath' }
  if (!tagName || !ref) return { ok: false, message: 'Missing tag name or ref' }
  try {
    const url = `${baseUrl.replace(/\/+$/, '')}/api/v4/projects/${encodeURIComponent(projectPath)}/repository/tags`
    const body: Record<string, unknown> = { tag_name: tagName, ref }
    if (message) body.message = message
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, 10000)
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { ok: false, message: `GitLab API error: ${res.status}${detail ? ' | ' + detail.slice(0, 160) : ''}` }
    }
    const tag = (await res.json()) as any
    return { ok: true, tag: { name: tag.name } }
  } catch (err: any) {
    if (err.name === 'AbortError') return { ok: false, message: 'Timed out' }
    return { ok: false, message: err.message }
  }
}

/** Cancel or retry a pipeline. `action` is 'cancel' or 'retry'. */
async function gitlabPipelineAction(params: {
  baseUrl: string; token: string; projectPath: string; pipelineId: number; action: string
}): Promise<any> {
  const { baseUrl, token, projectPath, pipelineId, action } = params
  if (!baseUrl || !token || !projectPath) return { ok: false, message: 'Missing baseUrl, token or projectPath' }
  if (!['cancel', 'retry'].includes(action)) return { ok: false, message: "action must be 'cancel' or 'retry'" }
  try {
    const url = `${baseUrl.replace(/\/+$/, '')}/api/v4/projects/${encodeURIComponent(projectPath)}/pipelines/${pipelineId}/${action}`
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'PRIVATE-TOKEN': token },
    }, 10000)
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { ok: false, message: `GitLab API error: ${res.status}${detail ? ' | ' + detail.slice(0, 160) : ''}` }
    }
    return { ok: true }
  } catch (err: any) {
    if (err.name === 'AbortError') return { ok: false, message: 'Timed out' }
    return { ok: false, message: err.message }
  }
}

/** Approve a merge request (uses the caller token's approval). */
async function gitlabMrApprove(params: { baseUrl: string; token: string; projectPath: string; mrIid: number }): Promise<any> {
  const { baseUrl, token, projectPath, mrIid } = params
  if (!baseUrl || !token || !projectPath) return { ok: false, message: 'Missing baseUrl, token or projectPath' }
  try {
    const url = `${baseUrl.replace(/\/+$/, '')}/api/v4/projects/${encodeURIComponent(projectPath)}/merge_requests/${mrIid}/approve`
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'PRIVATE-TOKEN': token },
    }, 10000)
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { ok: false, message: `GitLab API error: ${res.status}${detail ? ' | ' + detail.slice(0, 160) : ''}` }
    }
    const mr = (await res.json()) as any
    return { ok: true, approvalsBeforeMerge: mr.approvals_before_merge ?? null }
  } catch (err: any) {
    if (err.name === 'AbortError') return { ok: false, message: 'Timed out' }
    return { ok: false, message: err.message }
  }
}

/** Close / reopen a merge request. */
async function gitlabMrAction(params: { baseUrl: string; token: string; projectPath: string; mrIid: number; action: 'close' | 'reopen' }): Promise<any> {
  const { baseUrl, token, projectPath, mrIid, action } = params
  if (!baseUrl || !token || !projectPath) return { ok: false, message: 'Missing baseUrl, token or projectPath' }
  if (!['close', 'reopen'].includes(action)) return { ok: false, message: `Unknown action: ${action}` }
  try {
    const url = `${baseUrl.replace(/\/+$/, '')}/api/v4/projects/${encodeURIComponent(projectPath)}/merge_requests/${mrIid}`
    const res = await fetchWithTimeout(url, {
      method: 'PUT',
      headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ state_event: action }),
    }, 10000)
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { ok: false, message: `GitLab API error: ${res.status}${detail ? ' | ' + detail.slice(0, 160) : ''}` }
    }
    const mr = (await res.json()) as { state?: string }
    return { ok: true, state: mr.state ?? action }
  } catch (err: any) {
    if (err.name === 'AbortError') return { ok: false, message: 'Timed out' }
    return { ok: false, message: err.message }
  }
}

/** Tail the logs of a pod container (plain text). */
async function k8sPodLogs(params: {
  kubeconfigPath: string; context?: string; namespace: string; podName: string; container?: string; tailLines?: number
}): Promise<any> {
  const { kubeconfigPath, context, namespace, podName, container, tailLines } = params
  if (!kubeconfigPath || !namespace || !podName) return { ok: false, logs: '', message: 'Missing kubeconfigPath, namespace or podName' }
  try {
    const kctx = parseKubeconfig(kubeconfigPath, context)
    const n = Math.min(tailLines ?? 100, 1000)
    const containerParam = container ? `&container=${encodeURIComponent(container)}` : ''
    const res = await fetchWithTimeout(
      `${kctx.server}/api/v1/namespaces/${encodeURIComponent(namespace)}/pods/${encodeURIComponent(podName)}/log?tailLines=${n}${containerParam}`,
      { headers: { Authorization: `Bearer ${kctx.token}`, Accept: 'application/json' } },
      10000, kctx,
    )
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { ok: false, logs: '', message: `K8s API error: ${res.status}${detail ? ' | ' + detail.slice(0, 160) : ''}` }
    }
    return { ok: true, logs: await res.text() }
  } catch (err: any) {
    if (err.name === 'AbortError') return { ok: false, logs: '', message: 'Timed out' }
    return { ok: false, logs: '', message: err.message }
  }
}

/** PATCH a deployment (strategic-merge) — used for image change and restart. */
async function k8sPatchDeployment(params: { kubeconfigPath: string; context?: string; namespace: string; name: string; patch: Record<string, any> }): Promise<any> {
  const { kubeconfigPath, context, namespace, name, patch } = params
  if (!kubeconfigPath || !namespace || !name || !patch) return { ok: false, message: 'Missing params' }
  try {
    const kctx = parseKubeconfig(kubeconfigPath, context)
    const res = await httpsGet(
      `${kctx.server}/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name)}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${kctx.token}`, Accept: 'application/json', 'Content-Type': 'application/strategic-merge-patch+json' },
        body: JSON.stringify(patch),
        ca: kctx.caData ? Buffer.from(kctx.caData, 'base64') : undefined,
        insecureSkipTlsVerify: kctx.insecureSkipTlsVerify,
      },
    )
    const text = await res.text()
    if (!res.ok) return { ok: false, message: `K8s API error: ${res.status}${text ? ' | ' + text.slice(0, 160) : ''}` }
    return { ok: true }
  } catch (err: any) {
    return { ok: false, message: err.message }
  }
}

/** Change the image of a deployment's first container (or the named one). */
async function k8sSetImage(params: { kubeconfigPath: string; context?: string; namespace: string; name: string; image: string; container?: string }): Promise<any> {
  const { kubeconfigPath, context, namespace, name, image, container } = params
  if (!image) return { ok: false, message: 'Missing image' }
  try {
    const kctx = parseKubeconfig(kubeconfigPath, context)
    let containerName = container
    if (!containerName) {
      // Strategic-merge merges containers by name — fetch the first container's name first.
      const res = await fetchWithTimeout(
        `${kctx.server}/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name)}`,
        { headers: { Authorization: `Bearer ${kctx.token}`, Accept: 'application/json' } },
        10000, kctx,
      )
      if (!res.ok) return { ok: false, message: `K8s API error: ${res.status}` }
      const dep = (await res.json()) as any
      containerName = dep?.spec?.template?.spec?.containers?.[0]?.name
      if (!containerName) return { ok: false, message: 'Deployment has no containers' }
    }
    return k8sPatchDeployment({
      ...params,
      patch: { spec: { template: { spec: { containers: [{ name: containerName, image }] } } } },
    })
  } catch (err: any) {
    return { ok: false, message: err.message }
  }
}

/** Restart a deployment (annotate pod template with restartedAt, like kubectl rollout restart). */
async function k8sRestartDeployment(params: { kubeconfigPath: string; context?: string; namespace: string; name: string }): Promise<any> {
  return k8sPatchDeployment({
    ...params,
    patch: { spec: { template: { metadata: { annotations: { 'kubectl.kubernetes.io/restartedAt': new Date().toISOString() } } } } },
  })
}

// ─── File browse (native Windows dialog) ─────────────────────────────────────────

async function browseFile(_params: Record<string, unknown>): Promise<any> {
  const platform = process.platform
  if (platform === 'win32') {
    const { execFile } = await import('node:child_process')
    const script = [
      "Add-Type -AssemblyName System.Windows.Forms",
      "$d = New-Object System.Windows.Forms.OpenFileDialog",
      "$d.Title = '选择 kubeconfig 文件'",
      "$d.Filter = '配置文件 (*.yaml;*.yml;*.json;*.config)|*.yaml;*.yml;*.json;*.config|所有文件 (*.*)|*.*'",
      "$r = $d.ShowDialog()",
      "if ($r -eq [System.Windows.Forms.DialogResult]::OK) { $d.FileName }",
    ].join('; ')
    return new Promise((resolve) => {
      // Use 'powershell' (Windows PowerShell) — always in system PATH on Windows
      execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 120000 }, (err, stdout, stderr) => {
        const path = stdout?.trim()
        if (err && !path) {
          console.error('[dsh-devops] browse-file error:', err.message, stderr?.trim() || '')
          resolve({ ok: false, path: '', message: err.message })
        } else {
          resolve({ ok: true, path: path || '' })
        }
      })
    })
  }
  return { ok: false, path: '', message: 'File browse not supported on this platform' }
}

// ─── Config persistence ────────────────────────────────────────────────────────

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'

const CONFIG_DIR = join(homedir(), '.dsh-devops')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')
const LOG_FILE = join(CONFIG_DIR, 'devops.log')
const MAX_LOG_SIZE = 5 * 1024 * 1024 // 5 MB rotation threshold

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true })
}

// ─── Log utility ───────────────────────────────────────────────────────────────

import { appendFileSync, statSync, readFileSync as fsReadFileSync } from 'node:fs'

/** Write a log entry to ~/.dsh-devops/devops.log */
function writeLog(level: 'info' | 'warn' | 'error', message: string, detail?: string): void {
  try {
    ensureConfigDir()
    // Rotate: if file exceeds MAX_LOG_SIZE, keep only last 512KB
    try {
      const st = statSync(LOG_FILE)
      if (st.size > MAX_LOG_SIZE) {
        const content = fsReadFileSync(LOG_FILE, 'utf8')
        writeFileSync(LOG_FILE, content.slice(-512 * 1024), 'utf8')
      }
    } catch { /* file may not exist yet */ }

    const ts = new Date().toISOString()
    const line = `[${ts}] [${level.toUpperCase()}] ${message}${detail ? ' | ' + detail : ''}\n`
    appendFileSync(LOG_FILE, line, 'utf8')
  } catch { /* best-effort logging */ }
}

/** Read log entries for the API */
function readLogs(params: Record<string, any>): any {
  try {
    if (!existsSync(LOG_FILE)) return { ok: true, lines: [] }
    const raw = fsReadFileSync(LOG_FILE, 'utf8')
    let allLines = raw.split('\n').filter(Boolean)

    // Filter by level
    const level = (params.level ?? '').toLowerCase()
    if (level) {
      allLines = allLines.filter((l: string) => l.includes(`[${level.toUpperCase()}]`))
    }

    // Filter by search
    const search = (params.search ?? '').toLowerCase()
    if (search) {
      allLines = allLines.filter((l: string) => l.toLowerCase().includes(search))
    }

    // Return last N lines (default 200)
    const limit = Math.min(Number(params.lines) || 200, 5000)
    allLines = allLines.slice(-limit)

    return { ok: true, lines: allLines }
  } catch (err: any) {
    return { ok: false, lines: [], message: err.message }
  }
}

function saveConfig(params: Record<string, any>): any {
  try {
    ensureConfigDir()
    writeFileSync(CONFIG_FILE, JSON.stringify(params, null, 2), 'utf8')
    writeLog('info', 'save-config', 'config written')
    return { ok: true, message: '配置已保存' }
  } catch (err: any) {
    writeLog('error', 'save-config', err.message)
    return { ok: false, message: `保存失败: ${err.message}` }
  }
}

function loadConfig(_params: Record<string, any>): any {
  try {
    if (!existsSync(CONFIG_FILE)) return { ok: true, config: null }
    const raw = readFileSync(CONFIG_FILE, 'utf8')
    const config = JSON.parse(raw)
    return { ok: true, config }
  } catch (err: any) {
    return { ok: false, config: null, message: err.message }
  }
}

// ─── Route registration ────────────────────────────────────────────────────────

/**
 * Register the /devops/api HTTP prefix route.
 * Called from the plugin's `apply()` function.
 */
export function registerDevopsApi(ctx: any): void {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/devops/api',
    handler: async (req: any, res: any) => {
      // Security fence: localhost only
      if (!isLocalhost(req)) {
        writeJson(res, 403, { ok: false, message: 'Forbidden' })
        return
      }
      if (req.method !== 'POST') {
        writeJson(res, 405, { ok: false, message: 'Method not allowed' })
        return
      }

      const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
      // The prefix may or may not have been stripped by the DSH router, so
      // try both forms. Also accept a bare '/method' if the prefix was stripped.
      const method = pathname.startsWith('/devops/api/')
        ? pathname.slice('/devops/api/'.length)
        : pathname.startsWith('/')
          ? pathname.slice(1)
          : ''

      const handlers: Record<string, (p: any) => Promise<any>> = {
        'test-gitlab': testGitLab,
        'gitlab-projects': gitlabProjects,
        'gitlab-branches': gitlabBranches,
        'gitlab-mrs': gitlabMRs,
        'gitlab-pipelines': gitlabPipelines,
        'gitlab-tags': gitlabTags,
        'gitlab-members': gitlabMembers,
        'gitlab-last-commit': gitlabLastCommit,
        'gitlab-create-mr': gitlabCreateMr,
        'gitlab-create-tag': gitlabCreateTag,
        'gitlab-pipeline-action': gitlabPipelineAction,
        'gitlab-mr-approve': gitlabMrApprove,
        'gitlab-mr-action': gitlabMrAction,
        'gitlab-pipeline-jobs': gitlabPipelineJobs,
        'k8s-set-image': k8sSetImage,
        'k8s-restart': k8sRestartDeployment,
        'test-k8s': testK8s,
        'k8s-contexts': k8sContexts,
        'k8s-namespaces': k8sNamespaces,
        'k8s-deployments': k8sDeployments,
        'k8s-pods': k8sPods,
        'k8s-events': k8sEvents,
        'k8s-pod-logs': k8sPodLogs,
        'browse-file': browseFile,
        'save-config': saveConfig,
        'load-config': loadConfig,
        'logs': readLogs,
      }

      const handler = handlers[method]
      if (!handler) {
        writeJson(res, 404, { ok: false, message: `Unknown method: ${method}` })
        return
      }

      const started = Date.now()
      try {
        const body = await readBody(req)
        const inSnippet = JSON.stringify(body).slice(0, 400)
        const result = await handler(body)
        const ms = Date.now() - started
        const outSnippet = JSON.stringify(result).slice(0, 400)
        writeLog(result?.ok === false ? 'warn' : 'info', `POST /devops/api/${method}`, `${ms}ms | in=${inSnippet} | out=${outSnippet}`)
        writeJson(res, 200, result)
      } catch (err: any) {
        const ms = Date.now() - started
        writeLog('error', `POST /devops/api/${method}`, `${ms}ms | ${err.message}`)
        writeJson(res, 500, { ok: false, message: err.message ?? 'Internal error' })
      }
    },
  }), 'dsh-devops: /devops/api routes')
}
