/**
 * Config discovery tool definition.
 *
 * Registers one parameterless tool into the DSH tool catalog:
 * - devops_config
 *
 * Returns every configured GitLab server/project and kubeconfig (ids,
 * human-readable labels, current active selection) so the model can map a
 * user phrase like "查看 ZTC-DEV 的 xx 服务日志" to the concrete `project` /
 * `cluster` id before calling the gitlab_* / k8s_* tools.
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { buildConfigView } from './runtime-config.ts'
import { cleanTool, type DshToolContext } from './tools.ts'

/** Render an arbitrary value as a formatted JSON text block. */
function renderObject(value: unknown) {
  return [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }]
}

export function registerConfigTool(ctx: DshToolContext): void {
  const register = (ctx.tools?.register ?? ctx.tool?.register)?.bind(ctx.tools ?? ctx.tool)
  if (!register) {
    console.warn('[dsh-devops] ctx.tools not available, skipping config tool registration')
    return
  }

  // ─── devops_config ────────────────────────────────────────────────────────
  register(cleanTool(defineTool({
    name: 'devops_config',
    description:
      'List all configured GitLab servers/projects and Kubernetes clusters with their ids, ' +
      'human-readable labels and the current active selection. ' +
      'Call it first to map a user-mentioned server/cluster name (e.g. "ZTC-DEV") to the ' +
      '`project` / `cluster` parameter of the gitlab_*/k8s_* tools.',
    parameters: {},
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => renderObject(value),
    },
    async execute() {
      return buildConfigView()
    },
  })))
}
