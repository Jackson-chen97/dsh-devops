/**
 * GitLab RPC endpoints.
 *
 * These work with RAW parameters (baseUrl, token, projectPath) rather than
 * configured service instances, so the dashboard can test connectivity and
 * act BEFORE saving the config. Every endpoint returns an `{ ok, ... }`
 * payload (soft failures carry a `message`) — the RPC layer wraps the value
 * into the ConnectionRpcResult envelope.
 */
import { GitLabClient } from '../core/gitlab/client.ts'

/** Build a client from raw params; null when params are missing. */
export function gitlabClientFrom(params: { baseUrl?: string; token?: string }): GitLabClient | null {
  if (!params.baseUrl || !params.token) return null
  return new GitLabClient(params.baseUrl, params.token)
}

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message }
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// ─── Read endpoints ────────────────────────────────────────────────────────────

export async function testGitLab(params: { baseUrl?: string; token?: string }) {
  if (!params.baseUrl || !params.token) return fail('Missing required fields: baseUrl, token')
  try {
    const client = new GitLabClient(params.baseUrl, params.token)
    const user = await client.getCurrentUser()
    return { ok: true, message: `Connected as ${user.username ?? user.name ?? 'user'}` }
  } catch (err) {
    if (isAbort(err)) return fail('Connection timed out (5s)')
    return fail(`Network error: ${errorMessage(err)}`)
  }
}

export async function gitlabProjects(params: { baseUrl?: string; token?: string; search?: string }) {
  const client = gitlabClientFrom(params)
  if (!client) return { ok: false, projects: [], message: 'Missing baseUrl or token' }
  try {
    return { ok: true, projects: await client.listProjects(params.search) }
  } catch (err) {
    if (isAbort(err)) return { ok: false, projects: [], message: 'Timed out' }
    return { ok: false, projects: [], message: errorMessage(err) }
  }
}

export async function gitlabBranches(params: { baseUrl?: string; token?: string; path?: string; search?: string }) {
  const client = gitlabClientFrom(params)
  if (!client || !params.path) return { ok: false, branches: [], message: 'Missing baseUrl, token or path' }
  try {
    return { ok: true, branches: await client.listBranches(params.path, params.search) }
  } catch (err) {
    if (isAbort(err)) return { ok: false, branches: [], message: 'Timed out' }
    return { ok: false, branches: [], message: errorMessage(err) }
  }
}

export async function gitlabMembers(params: { baseUrl?: string; token?: string; path?: string; search?: string }) {
  const client = gitlabClientFrom(params)
  if (!client || !params.path) return { ok: false, members: [], message: 'Missing baseUrl, token or path' }
  try {
    return { ok: true, members: await client.listMembers(params.path, params.search) }
  } catch (err) {
    if (isAbort(err)) return { ok: false, members: [], message: 'Timed out' }
    return { ok: false, members: [], message: errorMessage(err) }
  }
}

export async function gitlabLastCommit(params: { baseUrl?: string; token?: string; path?: string; branch?: string }) {
  const client = gitlabClientFrom(params)
  if (!client || !params.path || !params.branch) return fail('Missing token or branch')
  try {
    const c = await client.getLastCommit(params.path, params.branch)
    if (!c) return fail('分支上没有提交')
    return { ok: true, ...c }
  } catch (err) {
    if (isAbort(err)) return fail('Timed out')
    return fail(errorMessage(err))
  }
}

export async function gitlabMRs(params: { baseUrl?: string; token?: string; projectPath?: string; state?: string }) {
  const client = gitlabClientFrom(params)
  if (!client || !params.projectPath) {
    return { ok: false, mergeRequests: [], message: 'Missing baseUrl, token or projectPath' }
  }
  try {
    const mergeRequests = await client.listMRs(params.projectPath, params.state || 'opened')
    return { ok: true, mergeRequests }
  } catch (err) {
    if (isAbort(err)) return { ok: false, mergeRequests: [], message: 'Timed out' }
    return { ok: false, mergeRequests: [], message: errorMessage(err) }
  }
}

export async function gitlabPipelines(params: { baseUrl?: string; token?: string; projectPath?: string; ref?: string; perPage?: number }) {
  const client = gitlabClientFrom(params)
  if (!client || !params.projectPath) {
    return { ok: false, pipelines: [], message: 'Missing baseUrl, token or projectPath' }
  }
  try {
    const pipelines = await client.listPipelines(params.projectPath, params.ref, params.perPage ?? 10)
    return { ok: true, pipelines }
  } catch (err) {
    if (isAbort(err)) return { ok: false, pipelines: [], message: 'Timed out' }
    return { ok: false, pipelines: [], message: errorMessage(err) }
  }
}

export async function gitlabTags(params: { baseUrl?: string; token?: string; projectPath?: string }) {
  const client = gitlabClientFrom(params)
  if (!client || !params.projectPath) {
    return { ok: false, tags: [], message: 'Missing baseUrl, token or projectPath' }
  }
  try {
    const tags = await client.listTags(params.projectPath)
    return { ok: true, tags }
  } catch (err) {
    if (isAbort(err)) return { ok: false, tags: [], message: 'Timed out' }
    return { ok: false, tags: [], message: errorMessage(err) }
  }
}

export async function gitlabPipelineJobs(params: { baseUrl?: string; token?: string; projectPath?: string; pipelineId?: number }) {
  const client = gitlabClientFrom(params)
  if (!client || !params.projectPath || !params.pipelineId) return { ok: false, jobs: [], message: 'Missing params' }
  try {
    const jobs = await client.listPipelineJobs(params.projectPath, params.pipelineId)
    return { ok: true, jobs }
  } catch (err) {
    return { ok: false, jobs: [], message: errorMessage(err) }
  }
}

export async function gitlabJobLog(params: { baseUrl?: string; token?: string; projectPath?: string; jobId?: number }) {
  const client = gitlabClientFrom(params)
  if (!client || !params.projectPath || !params.jobId) return { ok: false, logs: '', message: 'Missing params' }
  try {
    const result = await client.getJobLog(params.projectPath, params.jobId)
    if (result.unavailable === 'missing') {
      return { ok: false, logs: '', message: '未获取到日志（该 GitLab 版本无可用的日志接口），请通过 GitLab 页面查看', jobUrl: result.jobUrl }
    }
    if (result.unavailable === 'running') {
      return { ok: false, logs: '', message: 'Job 仍在运行，日志暂不可用，请稍后重试', jobUrl: result.jobUrl }
    }
    return { ok: true, logs: result.logs, jobUrl: result.jobUrl }
  } catch (err) {
    if (isAbort(err)) return { ok: false, logs: '', message: 'Timed out' }
    return { ok: false, logs: '', message: errorMessage(err) }
  }
}

// ─── Write endpoints ───────────────────────────────────────────────────────────

export async function gitlabCreateMR(params: {
  baseUrl?: string
  token?: string
  projectPath?: string
  sourceBranch?: string
  targetBranch?: string
  title?: string
  description?: string
  reviewers?: string
}) {
  const client = gitlabClientFrom(params)
  if (!client || !params.projectPath) return fail('Missing baseUrl, token or projectPath')
  if (!params.sourceBranch || !params.targetBranch || !params.title) return fail('Missing source, target or title')
  try {
    const mr = await client.createMR(
      params.projectPath,
      params.sourceBranch,
      params.targetBranch,
      params.title,
      params.description,
      params.reviewers,
    )
    return { ok: true, mergeRequest: { iid: mr.iid, title: mr.title, webUrl: mr.webUrl } }
  } catch (err) {
    if (isAbort(err)) return fail('Timed out')
    return fail(errorMessage(err))
  }
}

export async function gitlabCreateTag(params: {
  baseUrl?: string
  token?: string
  projectPath?: string
  tagName?: string
  ref?: string
  message?: string
}) {
  const client = gitlabClientFrom(params)
  if (!client || !params.projectPath) return fail('Missing baseUrl, token or projectPath')
  if (!params.tagName || !params.ref) return fail('Missing tag name or ref')
  try {
    const tag = await client.createTag(params.projectPath, params.tagName, params.ref, params.message)
    return { ok: true, tag: { name: tag.name } }
  } catch (err) {
    if (isAbort(err)) return fail('Timed out')
    return fail(errorMessage(err))
  }
}

export async function gitlabPipelineAction(params: {
  baseUrl?: string
  token?: string
  projectPath?: string
  pipelineId?: number
  action?: string
}) {
  const client = gitlabClientFrom(params)
  if (!client || !params.projectPath) return fail('Missing baseUrl, token or projectPath')
  if (params.action !== 'cancel' && params.action !== 'retry') {
    return fail("action must be 'cancel' or 'retry'")
  }
  try {
    await client.pipelineAction(params.projectPath, params.pipelineId!, params.action)
    return { ok: true }
  } catch (err) {
    if (isAbort(err)) return fail('Timed out')
    return fail(errorMessage(err))
  }
}

export async function gitlabMRApprove(params: {
  baseUrl?: string
  token?: string
  projectPath?: string
  mrIid?: number
}) {
  const client = gitlabClientFrom(params)
  if (!client || !params.projectPath) return fail('Missing baseUrl, token or projectPath')
  try {
    const result = await client.approveMR(params.projectPath, params.mrIid!)
    return { ok: true, approvalsBeforeMerge: result.approvalsBeforeMerge }
  } catch (err) {
    if (isAbort(err)) return fail('Timed out')
    return fail(errorMessage(err))
  }
}

export async function gitlabMRAction(params: {
  baseUrl?: string
  token?: string
  projectPath?: string
  mrIid?: number
  action?: 'close' | 'reopen'
}) {
  const client = gitlabClientFrom(params)
  if (!client || !params.projectPath) return fail('Missing baseUrl, token or projectPath')
  if (params.action !== 'close' && params.action !== 'reopen') return fail(`Unknown action: ${params.action}`)
  try {
    const state = await client.setMRState(params.projectPath, params.mrIid!, params.action)
    return { ok: true, state }
  } catch (err) {
    if (isAbort(err)) return fail('Timed out')
    return fail(errorMessage(err))
  }
}
