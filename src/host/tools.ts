/**
 * Tool registration for dsh-devops.
 *
 * Registers all gitlab_* and k8s_* tools into the DSH tool catalog.
 */

import { registerGitLabTools } from './tools-gitlab.ts'
import { registerK8sTools } from './tools-k8s.ts'

/**
 * Strip `undefined` fields (and functions) from a tool result. The host
 * validates tool output as lossless JSON, which rejects `undefined` values
 * that legitimately occur when upstream API objects lack optional fields
 * (e.g. a pipeline without `finished_at`).
 */
function pruneUndefined(value: unknown): unknown {
  if (value === undefined || typeof value === 'function') return null
  if (Array.isArray(value)) return value.map(pruneUndefined)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = pruneUndefined(v)
    return out
  }
  return value
}

/** Wrap a tool definition so every execute() result is JSON-lossless-safe. */
export function cleanTool<T extends { execute: (...args: any[]) => Promise<any> }>(tool: T): T {
  const execute = tool.execute.bind(tool)
  ;(tool as any).execute = async (...args: any[]) => pruneUndefined(await execute(...args))
  return tool
}

/** Minimal tool catalog surface used by the devops tools. */
export interface DshToolContext {
  tools?: { register(definition: unknown): unknown }
  tool?: { register(definition: unknown): unknown }
}

export interface DevopsServices {
  gitlab?: GitLabServiceLike
  k8s?: K8sServiceLike
}

/** Structural types so the tool layer does not import the service modules. */
export interface GitLabServiceLike {
  listProjects(): string[]
  createMR(project: string | undefined, source: string, target: string, title: string, description?: string, reviewers?: string): Promise<any>
  approveMR(project: string | undefined, mrIid: number): Promise<void>
  requestChanges(project: string | undefined, mrIid: number, comment: string): Promise<void>
  commentMR(project: string | undefined, mrIid: number, body: string): Promise<void>
  listMRs(project: string | undefined): Promise<any[]>
  createTag(project: string | undefined, name: string, ref?: string, message?: string): Promise<any>
  getPipeline(project: string | undefined, pipelineId: number): Promise<any>
  getLatestPipelineByRef(project: string | undefined, ref?: string): Promise<any>
  listPipelineJobs(project: string | undefined, pipelineId: number): Promise<any[]>
  getJobLog(project: string | undefined, jobId: number): Promise<string>
}

export interface K8sServiceLike {
  listClusters(): string[]
  getDefaultNamespace(cluster?: string): string
  getDeploymentStatus(cluster: string | undefined, ns: string, name: string): Promise<any>
  getDeploymentStatusList(cluster: string | undefined, ns: string): Promise<any[]>
  getPodList(cluster: string | undefined, ns: string): Promise<any[]>
  getEvents(cluster: string | undefined, ns: string, limit?: number): Promise<any[]>
  getPodLogs(cluster: string | undefined, ns: string, pod: string, container?: string, tail?: number): Promise<string>
}

/** The `ctx.followup`-shaped callback used by the pipeline watcher. */
export interface FollowupContext {
  followup?(message: string): void
  effect(execute: () => unknown, label?: string): unknown
}

export function registerTools(ctx: DshToolContext, services: DevopsServices): void {
  if (services.gitlab) registerGitLabTools(ctx, services.gitlab)
  if (services.k8s) registerK8sTools(ctx, services.k8s)
}

export { registerGitLabTools, registerK8sTools }
