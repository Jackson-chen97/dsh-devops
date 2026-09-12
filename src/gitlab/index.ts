/**
 * GitLab service — public API and plugin registration.
 */
import type { GitLabConfig } from '../config.js'
import type { MergeRequest, Pipeline, PipelineJob, GitTag } from '../types.js'
import { GitLabRouter } from './router.js'

/**
 * Minimal context interface (provided by the DSH host at runtime).
 * Typed as `any` in the public API because the full Cordis Context
 * is augmented by the host and not importable here.
 */
interface DshContext {
  effect(execute: () => any, label?: string): any
  followup?(message: string): void
  log?: { warn(...args: unknown[]): void; error(...args: unknown[]): void }
}

// ─── Public Service Interface ──────────────────────────────────────────────────

export interface GitLabService {
  /** List all configured project ids. */
  listProjects(): string[]

  /** Create a merge request. */
  createMR(
    project?: string,
    sourceBranch?: string,
    targetBranch?: string,
    title?: string,
    description?: string,
  ): Promise<MergeRequest>

  /** Approve a merge request by iid. */
  approveMR(project?: string, mrIid?: number): Promise<void>

  /** Request changes on a merge request. */
  requestChanges(project?: string, mrIid?: number, comment?: string): Promise<void>

  /** Post a comment on a merge request. */
  commentMR(project?: string, mrIid?: number, body?: string): Promise<void>

  /** List merge requests (defaults to opened state). */
  listMRs(project?: string): Promise<MergeRequest[]>

  /** Create a tag. */
  createTag(project?: string, name?: string, ref?: string, message?: string): Promise<GitTag>

  /** Get a pipeline by its numeric id. */
  getPipeline(project?: string, pipelineId?: number): Promise<Pipeline>

  /** Get the latest pipeline for a given ref (branch/tag). */
  getLatestPipelineByRef(project?: string, ref?: string): Promise<Pipeline | undefined>

  /** List all jobs in a pipeline. */
  listPipelineJobs(project?: string, pipelineId?: number): Promise<PipelineJob[]>

  /** Fetch the log output of a job. */
  getJobLog(project?: string, jobId?: number): Promise<string>
}

// ─── Registration ──────────────────────────────────────────────────────────────

/**
 * Register the GitLab service with the DSH context.
 *
 * @param ctx    — DSH host context (typed `any`; carries the full Cordis API at runtime)
 * @param config — parsed GitLab configuration section
 * @returns the public {@link GitLabService} instance
 */
export function registerGitLab(ctx: any, config: GitLabConfig): GitLabService {
  // Construct the router eagerly — throws if any required env token is missing.
  const router = new GitLabRouter(config.baseUrl, config.projects, config.defaultProject)

  // Register a lifecycle effect so the host can manage the service's lifetime.
  ctx.effect(() => {
    // The GitLab client is stateless (pure HTTP), so no active resources
    // to release here. The effect exists to hook into host shutdown if
    // future versions add persistent connections or subscriptions.
    return () => {
      /* cleanup */
    }
  }, 'gitlab')

  const service: GitLabService = {
    listProjects: () => router.list(),

    createMR: (project, sourceBranch, targetBranch, title, description) =>
      router.resolve(project).createMR(sourceBranch!, targetBranch!, title!, description),

    approveMR: (project, mrIid) => router.resolve(project).approveMR(mrIid!),

    requestChanges: (project, mrIid, comment) => router.resolve(project).requestChanges(mrIid!, comment!),

    commentMR: (project, mrIid, body) => router.resolve(project).commentMR(mrIid!, body!),

    listMRs: (project) => router.resolve(project).listMRs(),

    createTag: (project, name, ref, message) =>
      router.resolve(project).createTag(name!, ref!, message),

    getPipeline: (project, pipelineId) => router.resolve(project).getPipeline(pipelineId!),

    getLatestPipelineByRef: (project, ref) => router.resolve(project).getLatestPipelineByRef(ref!),

    listPipelineJobs: (project, pipelineId) => router.resolve(project).listPipelineJobs(pipelineId!),

    getJobLog: (project, jobId) => router.resolve(project).getJobLog(jobId!),
  }

  return service
}
