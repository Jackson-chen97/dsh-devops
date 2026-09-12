/**
 * GitLab REST API client.
 */
import type { MergeRequest, Pipeline, PipelineJob, GitTag } from '../types.js'

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
  finished_at?: string
  [key: string]: unknown
}

interface RawJob {
  id: number
  name: string
  status: string
  stage: string
  duration?: number
  [key: string]: unknown
}

interface RawTag {
  name: string
  target: string
  message?: string
  commit: { id: string; [key: string]: unknown }
  [key: string]: unknown
}

// ─── Mappers ───────────────────────────────────────────────────────────────────

function mapMR(raw: RawMR): MergeRequest {
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
  }
}

function mapPipeline(raw: RawPipeline): Pipeline {
  return {
    id: raw.id,
    status: raw.status as Pipeline['status'],
    ref: raw.ref,
    sha: raw.sha,
    webUrl: raw.web_url,
    createdAt: raw.created_at,
    finishedAt: raw.finished_at,
  }
}

function mapJob(raw: RawJob): PipelineJob {
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status as PipelineJob['status'],
    stage: raw.stage,
    duration: raw.duration,
  }
}

function mapTag(raw: RawTag): GitTag {
  return {
    name: raw.name,
    target: raw.target,
    message: raw.message,
    commitId: raw.commit?.id ?? '',
  }
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class GitLabClient {
  private readonly projectUrl: string

  constructor(
    private readonly baseUrl: string,
    private readonly projectPath: string,
    private readonly token: string,
  ) {
    this.projectUrl = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectPath)}`
  }

  /**
   * Send a request to the GitLab API and parse the JSON response.
   * Throws {@link GitLabError} on non-2xx status codes.
   */
  private async request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.projectUrl}${path}`

    const headers: Record<string, string> = {
      'PRIVATE-TOKEN': this.token,
      'Content-Type': 'application/json',
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      let code = 'unknown'
      let message = `GitLab API error ${res.status}`
      try {
        const err = await res.json() as { message?: string; error?: string; error_description?: string }
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

  // ─── Merge Requests ─────────────────────────────────────────────────────────

  /** Create a new merge request. */
  async createMR(
    sourceBranch: string,
    targetBranch: string,
    title: string,
    description?: string,
  ): Promise<MergeRequest> {
    const raw = await this.request<RawMR>('POST', '/merge_requests', {
      source_branch: sourceBranch,
      target_branch: targetBranch,
      title,
      ...(description !== undefined ? { description } : {}),
    })
    return mapMR(raw)
  }

  /** Approve a merge request. */
  async approveMR(mrIid: number): Promise<void> {
    await this.request<null>('POST', `/merge_requests/${mrIid}/approve`)
  }

  /** Request changes on a merge request (post a review note with a negative verdict). */
  async requestChanges(mrIid: number, comment: string): Promise<void> {
    await this.request<null>('POST', `/merge_requests/${mrIid}/notes`, { body: `🔴 Changes requested: ${comment}` })
  }

  /** Post a comment (note) on a merge request. */
  async commentMR(mrIid: number, body: string): Promise<void> {
    await this.request<null>('POST', `/merge_requests/${mrIid}/notes`, { body })
  }

  /** List open merge requests. */
  async listMRs(): Promise<MergeRequest[]> {
    const raw = await this.request<RawMR[]>('GET', '/merge_requests?state=opened')
    return raw.map(mapMR)
  }

  // ─── Tags ───────────────────────────────────────────────────────────────────

  /** Create a new tag pointing at the given ref (branch, tag, or commit SHA). */
  async createTag(name: string, ref: string, message?: string): Promise<GitTag> {
    const raw = await this.request<RawTag>('POST', '/repository/tags', {
      tag_name: name,
      ref,
      ...(message !== undefined ? { message } : {}),
    })
    return mapTag(raw)
  }

  // ─── Pipelines ──────────────────────────────────────────────────────────────

  /** Get a single pipeline by its numeric id. */
  async getPipeline(pipelineId: number): Promise<Pipeline> {
    const raw = await this.request<RawPipeline>('GET', `/pipelines/${pipelineId}`)
    return mapPipeline(raw)
  }

  /** Get the latest pipeline for a given ref (branch/tag). */
  async getLatestPipelineByRef(ref: string): Promise<Pipeline | undefined> {
    const raw = await this.request<RawPipeline[]>('GET', `/pipelines?ref=${encodeURIComponent(ref)}&order_by=id&sort=desc&per_page=1`)
    if (!Array.isArray(raw) || raw.length === 0) return undefined
    return mapPipeline(raw[0])
  }

  /** List all jobs in a pipeline. */
  async listPipelineJobs(pipelineId: number): Promise<PipelineJob[]> {
    const raw = await this.request<RawJob[]>('GET', `/pipelines/${pipelineId}/jobs`)
    return raw.map(mapJob)
  }

  /** Fetch the log output of a job. */
  async getJobLog(jobId: number): Promise<string> {
    const url = `${this.projectUrl}/jobs/${jobId}/log`
    const res = await fetch(url, {
      headers: { 'PRIVATE-TOKEN': this.token },
    })
    if (!res.ok) {
      throw new GitLabError(res.status, 'unknown', `Failed to fetch job log: ${res.status}`)
    }
    return res.text()
  }
}
