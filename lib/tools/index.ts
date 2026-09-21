/**
 * Tool registration for dsh-devops.
 *
 * Registers all gitlab_* and k8s_* tools into the DSH tool catalog.
 */

import { registerGitLabTools } from './gitlab.js'
import { registerK8sTools } from './k8s.js'

/**
 * Strip `undefined` fields (and functions) from a tool result. The host
 * validates tool output as lossless JSON, which rejects `undefined` values
 * that legitimately occur when upstream API objects lack optional fields
 * (e.g. a pipeline without `finished_at`).
 */
function pruneUndefined(value: any): any {
  if (value === undefined || typeof value === 'function') return null
  if (Array.isArray(value)) return value.map(pruneUndefined)
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {}
    for (const [k, v] of Object.entries(value)) out[k] = pruneUndefined(v)
    return out
  }
  return value
}

/** Wrap a tool definition so every execute() result is JSON-lossless-safe. */
export function cleanTool<T extends { execute: (args: any) => Promise<any> }>(tool: T): T {
  const execute = tool.execute.bind(tool)
  ;(tool as any).execute = async (args: any) => pruneUndefined(await execute(args))
  return tool
}

export function registerTools(
  ctx: any,
  services: {
    gitlab?: any
    k8s?: any
  },
): void {
  if (services.gitlab) registerGitLabTools(ctx, services.gitlab)
  if (services.k8s) registerK8sTools(ctx, services.k8s)
}

export { registerGitLabTools, registerK8sTools }
