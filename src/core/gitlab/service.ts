/**
 * GitLab service — multi-project router over {@link GitLabClient} plus the
 * service interface consumed by the AI tools and the monitor engine.
 */
import type { GitLabConfig, GitLabProjectConfig } from '../../config.ts'
import type { MergeRequest, Pipeline, PipelineJob, GitTag } from '../../types.ts'
import { GitLabClient } from './client.ts'

// ─── Router ────────────────────────────────────────────────────────────────────

interface ProjectEntry {
  client: GitLabClient
  projectPath: string
}

/**
 * Resolves a {@link GitLabClient} + project path by project id, falling back
 * to the configured default project.
 */
export class GitLabRouter {
  private readonly entries = new Map<string, ProjectEntry>()

  constructor(
    baseUrl: string,
    projects: GitLabProjectConfig[],
    private readonly defaultProject?: string,
  ) {
    for (const p of projects) {
      const token = p.token ?? (p.tokenEnv ? process.env[p.tokenEnv] : undefined)
      if (!token) {
        throw new Error(
          `[dsh-devops] GitLab project "${p.id}": no direct token and environment variable "${p.tokenEnv}" is not set`,
        )
      }
      this.entries.set(p.id, { client: new GitLabClient(baseUrl, token), projectPath: p.path })
    }
  }

  /** Resolve the entry for the given project id (or the default project). */
  resolve(id?: string): ProjectEntry {
    const key = id ?? this.defaultProject
    if (!key) {
      throw new Error('[dsh-devops] GitLab: no project id provided and no defaultProject configured')
    }
    const entry = this.entries.get(key)
    if (!entry) {
      const available = [...this.entries.keys()].join(', ')
      throw new Error(`[dsh-devops] GitLab: unknown project id "${key}". Available: ${available}`)
    }
    return entry
  }

  /** Return all configured project ids. */
  list(): string[] {
    return [...this.entries.keys()]
  }
}

// ─── Service interface ─────────────────────────────────────────────────────────

export interface GitLabService {
  /** List all configured project ids. */
  listProjects(): string[]

  /** Create a merge request. */
  createMR(
    project: string | undefined,
    sourceBranch: string,
    targetBranch: string,
    title: string,
    description?: string,
    reviewers?: string,
  ): Promise<MergeRequest>

  /** Approve a merge request by iid. */
  approveMR(project: string | undefined, mrIid: number): Promise<void>

  /** Request changes on a merge request. */
  requestChanges(project: string | undefined, mrIid: number, comment: string): Promise<void>

  /** Post a comment on a merge request. */
  commentMR(project: string | undefined, mrIid: number, body: string): Promise<void>

  /** List merge requests (defaults to opened state). */
  listMRs(project: string | undefined): Promise<MergeRequest[]>

  /** Create a tag. */
  createTag(project: string | undefined, name: string, ref?: string, message?: string): Promise<GitTag>

  /** Get a pipeline by its numeric id. */
  getPipeline(project: string | undefined, pipelineId: number): Promise<Pipeline>

  /** Get the latest pipeline for a given ref (branch/tag); omit for the default branch. */
  getLatestPipelineByRef(project: string | undefined, ref?: string): Promise<Pipeline | undefined>

  /** List all jobs in a pipeline. */
  listPipelineJobs(project: string | undefined, pipelineId: number): Promise<PipelineJob[]>

  /** Fetch the log output of a job. */
  getJobLog(project: string | undefined, jobId: number): Promise<string>
}

// ─── Factory ───────────────────────────────────────────────────────────────────

/** Build the GitLab service from a parsed config section (eager router). */
export function createGitLabService(config: GitLabConfig): GitLabService {
  const router = new GitLabRouter(config.baseUrl, config.projects, config.defaultProject)

  return {
    listProjects: () => router.list(),

    createMR: (project, sourceBranch, targetBranch, title, description, reviewers) => {
      const r = router.resolve(project)
      return r.client.createMR(r.projectPath, sourceBranch, targetBranch, title, description, reviewers)
    },

    approveMR: (project, mrIid) => {
      const r = router.resolve(project)
      return r.client.approveMR(r.projectPath, mrIid).then(() => undefined)
    },

    requestChanges: (project, mrIid, comment) => {
      const r = router.resolve(project)
      return r.client.requestChanges(r.projectPath, mrIid, comment)
    },

    commentMR: (project, mrIid, body) => {
      const r = router.resolve(project)
      return r.client.commentMR(r.projectPath, mrIid, body)
    },

    listMRs: (project) => {
      const r = router.resolve(project)
      return r.client.listMRs(r.projectPath)
    },

    createTag: (project, name, ref, message) => {
      const r = router.resolve(project)
      return r.client.createTag(r.projectPath, name, ref, message)
    },

    getPipeline: (project, pipelineId) => {
      const r = router.resolve(project)
      return r.client.getPipeline(r.projectPath, pipelineId)
    },

    getLatestPipelineByRef: (project, ref) => {
      const r = router.resolve(project)
      return r.client.getLatestPipelineByRef(r.projectPath, ref)
    },

    listPipelineJobs: (project, pipelineId) => {
      const r = router.resolve(project)
      return r.client.listPipelineJobs(r.projectPath, pipelineId)
    },

    getJobLog: (project, jobId) => {
      const r = router.resolve(project)
      return r.client.getJobLog(r.projectPath, jobId).then((r) => r.logs)
    },
  }
}
