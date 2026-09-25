/**
 * GitLab REST API client.
 *
 * One client per GitLab instance (baseUrl + token). Project-scoped calls take
 * the project path explicitly so the same client serves both the pre-save
 * connectivity probes (raw params) and the configured service layer.
 */
import type { MergeRequest, Pipeline, PipelineJob, GitTag, PipelineStatus } from '../../types.ts'
import { requestWithTimeout } from '../http.ts'

// ─── Error ─────────────────────────────────────────────────────────────────────

export class GitLabError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'GitLabError'
  }
}

// ─── Raw API types (GitLab REST v4 response shapes) ───────────────────────────

interface RawMR {
  id: number
  iid: number
  title: string
  state: 'opened' | 'closed' | 'merged' | 'locked'
  source_branch: string
  target_branch: string
  web_url: string
  approvals_required?: number
  approvals_count?: number
  approved?: boolean
  approvals_before_merge?: number
  merge_status?: string
  work_in_progress?: boolean
  draft?: boolean
  author?: { username?: string }
  created_at?: string
  updated_at?: string
  description?: string
  [key: string]: unknown
}

interface RawPipeline {
  id: number
  status: string
  ref: string
  sha: string
  web_url: string
  created_at: string
  updated_at?: string
  duration?: number
  finished_at?: string
  [key: string]: unknown
}

interface RawJob {
  id: number
  name: string
  status: string
  stage: string
  duration?: number
  failure_reason?: string
  [key: string]: unknown
}

interface RawTag {
  name: string
  target: string
  message?: string
  commit?: { id: string; created_at?: string; [key: string]: unknown }
  release?: { message?: string }
  [key: string]: unknown
}

// ─── Mappers ───────────────────────────────────────────────────────────────────

function mapMR(raw: RawMR): MergeRequest & {
  author: string
  createdAt: string
  updatedAt: string
  mergeStatus: string
  workInProgress: boolean
  draft: boolean
  approvalsBeforeMerge: number | null
} {
  return {
    iid: raw.iid,
    title: raw.title,
    state: raw.state,
    sourceBranch: raw.source_branch,
    targetBranch: raw.target_branch,
    webUrl: raw.web_url,
    approvals: {
      approved: raw.approved === true,
      required: raw.approvals_required ?? 0,
      given: raw.approvals_count ?? 0,
    },
    author: raw.author?.username ?? 'unknown',
    createdAt: raw.created_at ?? '',
    updatedAt: raw.updated_at ?? '',
    mergeStatus: raw.merge_status ?? '',
    workInProgress: !!raw.work_in_progress,
    draft: !!raw.draft,
    approvalsBeforeMerge: raw.approvals_before_merge ?? null,
  }
}

function mapPipeline(raw: RawPipeline): Pipeline & { updatedAt: string; duration: number | null } {
  return {
    id: raw.id,
    status: raw.status as Pipeline['status'],
    ref: raw.ref,
    sha: raw.sha,
    webUrl: raw.web_url,
    createdAt: raw.created_at,
    finishedAt: raw.finished_at,
    updatedAt: raw.updated_at ?? '',
    duration: raw.duration ?? null,
  }
}

function mapJob(raw: RawJob): PipelineJob & { failureReason: string } {
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status as PipelineJob['status'],
    stage: raw.stage,
    duration: raw.duration,
    failureReason: raw.failure_reason || '',
  }
}

function mapTag(raw: RawTag): GitTag & { createdAt: string } {
  return {
    name: raw.name,
    target: raw.target,
    message: raw.message ?? raw.release?.message ?? '',
    commitId: raw.commit?.id ?? '',
    createdAt: raw.commit?.created_at ?? '',
  }
}

/** Strip ANSI escape codes and gitlab-runner control lines from a raw job trace. */
export function cleanJobLog(s: string): string {
  return s
    .replace(new RegExp(String.fromCharCode(27) + String.fromCharCode(91) + '[0-9;?]*[a-zA-Z]', 'g'), '')
    .split('\n')
    .filter((l) => !/^section_(start|end):/.test(l) && !/^get:job:/.test(l))
    .join('\n')
}

// ─── Client ────────────────────────────────────────────────────────────────────

export interface GitLabProjectSummary {
  id: string
  name: string
  path: string
  defaultBranch: string
}

export interface GitLabBranch {
  name: string
  isDefault: boolean
}

export interface GitLabMember {
  username: string
  name: string
}

export interface GitLabLastCommit {
  shortId: string
  title: string
  message: string
  author: string
  date: string
}

export class GitLabClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  private get apiBase(): string {
    return `${this.baseUrl.replace(/\/+$/, '')}/api/v4`
  }

  private projectApi(projectPath: string): string {
    return `${this.apiBase}/projects/${encodeURIComponent(projectPath)}`
  }

  /**
   * Send a request to the GitLab API and parse the JSON response.
   * Throws {@link GitLabError} on non-2xx status codes.
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    body?: unknown,
    timeoutMs = 10000,
  ): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.apiBase}${path}`
    const res = await requestWithTimeout(url, {
      method,
      headers: {
        'PRIVATE-TOKEN': this.token,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      timeoutMs,
    })

    if (!res.ok) {
      let code = 'unknown'
      let message = `GitLab API error ${res.status}`
      try {
        const err = (await res.json()) as { message?: string; error?: string; error_description?: string }
        code = err.message || err.error || err.error_description || 'unknown'
        message = err.message || err.error || err.error_description || message
      } catch {
        /* non-JSON error body */
      }
      throw new GitLabError(res.status, code, message)
    }

    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }

  // ─── Instance level ─────────────────────────────────────────────────────────

  /** Validate the token: GET /user. */
  async getCurrentUser(): Promise<{ username?: string; name?: string }> {
    return this.request('GET', '/user')
  }

  /** Projects visible to the token, newest activity first. */
  async listProjects(search?: string): Promise<GitLabProjectSummary[]> {
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : ''
    const raw = await this.request<
      { id: number; name: string; path_with_namespace: string; default_branch: string }[]
    >('GET', `/projects?membership=true&per_page=100&order_by=last_activity_at&sort=desc${searchParam}`, undefined, 20000)
    return raw.map((p) => ({
      id: String(p.id),
      name: p.name,
      path: p.path_with_namespace,
      defaultBranch: p.default_branch,
    }))
  }

  /** Resolve usernames to user ids (best-effort) for reviewer_ids. */
  async resolveUserIds(names: string[]): Promise<number[]> {
    const ids: number[] = []
    for (const name of names) {
      try {
        const users = await this.request<{ id: number; username: string }[]>(
          'GET',
          `/users?search=${encodeURIComponent(name)}&per_page=5`,
          undefined,
          8000,
        )
        const u = users.find((x) => x.username.toLowerCase() === name.toLowerCase()) ?? users[0]
        if (u?.id) ids.push(u.id)
      } catch {
        /* skip unresolvable reviewer */
      }
    }
    return ids
  }

  // ─── Project level ──────────────────────────────────────────────────────────

  /** List repository branches (per_page=100), optional server-side search. */
  async listBranches(projectPath: string, search?: string): Promise<GitLabBranch[]> {
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : ''
    const raw = await this.request<{ name: string; default?: boolean }[]>(
      'GET',
      `/projects/${encodeURIComponent(projectPath)}/repository/branches?per_page=100${searchParam}`,
      undefined,
      12000,
    )
    return raw.map((b) => ({ name: b.name, isDefault: b.default === true }))
  }

  /** List project members (for the MR reviewer dropdown). */
  async listMembers(projectPath: string, search?: string): Promise<GitLabMember[]> {
    const searchParam = search ? `&query=${encodeURIComponent(search)}` : ''
    const raw = await this.request<{ username: string; name: string }[]>(
      'GET',
      `/projects/${encodeURIComponent(projectPath)}/members/all?per_page=100${searchParam}`,
      undefined,
      12000,
    )
    return raw.map((m) => ({ username: m.username, name: m.name }))
  }

  /** Latest commit on a branch (for MR description auto-fill). */
  async getLastCommit(projectPath: string, branch: string): Promise<GitLabLastCommit | null> {
    const raw = await this.request<
      { short_id?: string; title?: string; message?: string; author_name?: string; committed_date?: string }[]
    >(
      'GET',
      `/projects/${encodeURIComponent(projectPath)}/repository/commits?ref_name=${encodeURIComponent(branch)}&per_page=1`,
      undefined,
      12000,
    )
    const c = raw[0]
    if (!c) return null
    return {
      shortId: c.short_id ?? '',
      title: c.title ?? '',
      message: (c.message ?? '').trim(),
      author: c.author_name ?? '',
      date: c.committed_date ?? '',
    }
  }

  // ─── Merge requests ─────────────────────────────────────────────────────────

  /** Create a merge request. */
  async createMR(
    projectPath: string,
    sourceBranch: string,
    targetBranch: string,
    title: string,
    description?: string,
    reviewers?: string,
  ): Promise<MergeRequest> {
    const body: Record<string, unknown> = {
      source_branch: sourceBranch,
      target_branch: targetBranch,
      title,
      remove_source_branch: true,
      ...(description !== undefined ? { description } : {}),
    }
    if (reviewers) {
      const names = reviewers.split(/[,\uFF0C\s]+/).map((s) => s.trim().replace(/^@/, '')).filter(Boolean)
      const ids = await this.resolveUserIds(names)
      if (ids.length) body['reviewer_ids'] = ids
    }
    const raw = await this.request<RawMR>('POST', `/projects/${encodeURIComponent(projectPath)}/merge_requests`, body)
    return mapMR(raw)
  }

  /** Approve a merge request. */
  async approveMR(projectPath: string, mrIid: number): Promise<{ approvalsBeforeMerge: number | null }> {
    const raw = await this.request<RawMR>(
      'POST',
      `/projects/${encodeURIComponent(projectPath)}/merge_requests/${mrIid}/approve`,
    )
    return { approvalsBeforeMerge: raw.approvals_before_merge ?? null }
  }

  /** Request changes on a merge request (post a review note with a negative verdict). */
  async requestChanges(projectPath: string, mrIid: number, comment: string): Promise<void> {
    await this.request('POST', `/projects/${encodeURIComponent(projectPath)}/merge_requests/${mrIid}/notes`, {
      body: ` Changes requested: ${comment}`,
    })
  }

  /** Post a comment (note) on a merge request. */
  async commentMR(projectPath: string, mrIid: number, body: string): Promise<void> {
    await this.request('POST', `/projects/${encodeURIComponent(projectPath)}/merge_requests/${mrIid}/notes`, { body })
  }

  /** List open merge requests. */
  async listMRs(projectPath: string, state = 'opened', perPage = 20): Promise<(MergeRequest & {
    author: string
    createdAt: string
    updatedAt: string
    mergeStatus: string
    workInProgress: boolean
    draft: boolean
    approvalsBeforeMerge: number | null
  })[]> {
    const raw = await this.request<RawMR[]>(
      'GET',
      `/projects/${encodeURIComponent(projectPath)}/merge_requests?per_page=${perPage}&order_by=updated_at&sort=desc&state=${encodeURIComponent(state)}`,
    )
    return raw.map(mapMR)
  }

  /** Close / reopen a merge request. */
  async setMRState(projectPath: string, mrIid: number, action: 'close' | 'reopen'): Promise<string> {
    const raw = await this.request<RawMR & { state?: string }>(
      'PUT',
      `/projects/${encodeURIComponent(projectPath)}/merge_requests/${mrIid}`,
      { state_event: action },
    )
    return raw.state ?? action
  }

  // ─── Tags ───────────────────────────────────────────────────────────────────

  /** Create a tag pointing at the given ref (branch, tag, or commit SHA). */
  async createTag(projectPath: string, name: string, ref?: string, message?: string): Promise<GitTag> {
    const raw = await this.request<RawTag>('POST', `/projects/${encodeURIComponent(projectPath)}/repository/tags`, {
      tag_name: name,
      ref,
      ...(message !== undefined ? { message } : {}),
    })
    return mapTag(raw)
  }

  /** List repository tags (newest first). */
  async listTags(projectPath: string, perPage = 20): Promise<(GitTag & { createdAt: string })[]> {
    const raw = await this.request<RawTag[]>(
      'GET',
      `/projects/${encodeURIComponent(projectPath)}/repository/tags?per_page=${perPage}&order_by=updated&sort=desc`,
    )
    return raw.map(mapTag)
  }

  // ─── Pipelines ──────────────────────────────────────────────────────────────

  /** Get a single pipeline by its numeric id. */
  async getPipeline(projectPath: string, pipelineId: number): Promise<Pipeline> {
    const raw = await this.request<RawPipeline>(
      'GET',
      `/projects/${encodeURIComponent(projectPath)}/pipelines/${pipelineId}`,
    )
    return mapPipeline(raw)
  }

  /** Get the latest pipeline for a given ref (branch/tag); omit for the default branch. */
  async getLatestPipelineByRef(projectPath: string, ref?: string): Promise<Pipeline | undefined> {
    const refParam = ref ? `&ref=${encodeURIComponent(ref)}` : ''
    const raw = await this.request<RawPipeline[]>(
      'GET',
      `/projects/${encodeURIComponent(projectPath)}/pipelines?order_by=id&sort=desc&per_page=1${refParam}`,
    )
    if (!Array.isArray(raw) || raw.length === 0) return undefined
    const mapped = mapPipeline(raw[0]!)
    return {
      id: mapped.id,
      status: mapped.status,
      ref: mapped.ref,
      sha: mapped.sha,
      webUrl: mapped.webUrl,
      createdAt: mapped.createdAt,
      finishedAt: mapped.finishedAt,
    }
  }

  /** List recent pipelines for a project (newest first). */
  async listPipelines(projectPath: string, ref?: string, perPage = 10): Promise<(Pipeline & { updatedAt: string; duration: number | null })[]> {
    const refParam = ref ? `&ref=${encodeURIComponent(ref)}` : ''
    const count = Math.min(perPage, 50)
    const raw = await this.request<RawPipeline[]>(
      'GET',
      `/projects/${encodeURIComponent(projectPath)}/pipelines?per_page=${count}&order_by=id&sort=desc${refParam}`,
    )
    return raw.map((p) => ({ ...mapPipeline(p), sha: p.sha?.slice(0, 8) ?? '' }))
  }

  /** Cancel or retry a pipeline. */
  async pipelineAction(projectPath: string, pipelineId: number, action: 'cancel' | 'retry'): Promise<void> {
    await this.request('POST', `/projects/${encodeURIComponent(projectPath)}/pipelines/${pipelineId}/${action}`)
  }

  /** List all jobs in a pipeline. */
  async listPipelineJobs(projectPath: string, pipelineId: number, perPage = 50): Promise<(PipelineJob & { failureReason: string })[]> {
    const raw = await this.request<RawJob[]>(
      'GET',
      `/projects/${encodeURIComponent(projectPath)}/pipelines/${pipelineId}/jobs?per_page=${perPage}`,
      undefined,
      15000,
    )
    return raw.map(mapJob)
  }

  /** Web UI URL of a job (for the "open in GitLab" fallback). */
  jobUrl(projectPath: string, jobId: number): string {
    return `${this.baseUrl.replace(/\/+$/, '')}/projects/${projectPath}/jobs/${jobId}`
  }

  /**
   * Fetch the log output of a job. Tries /log (GitLab ≥12), falls back to
   * /trace (GitLab 11.x); returns null with the job URL when unavailable.
   */
  async getJobLog(projectPath: string, jobId: number): Promise<{ logs: string; jobUrl: string; unavailable?: 'missing' | 'running' }> {
    const apiBase = `${this.apiBase}/projects/${encodeURIComponent(projectPath)}/jobs/${jobId}`
    const jobUrl = this.jobUrl(projectPath, jobId)
    let res = await requestWithTimeout(`${apiBase}/log`, { headers: { 'PRIVATE-TOKEN': this.token }, timeoutMs: 15000 })
    if (res.status === 404) res = await requestWithTimeout(`${apiBase}/trace`, { headers: { 'PRIVATE-TOKEN': this.token }, timeoutMs: 15000 })
    if (res.status === 404) return { logs: '', jobUrl, unavailable: 'missing' }
    if (res.status === 202) return { logs: '', jobUrl, unavailable: 'running' }
    if (!res.ok) throw new GitLabError(res.status, 'unknown', `GitLab API error: ${res.status}`)
    return { logs: cleanJobLog(await res.text()), jobUrl }
  }
}
