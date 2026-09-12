/**
 * K8s tool definitions.
 *
 * Registers 4 tools into the DSH tool catalog using defineTool:
 * - k8s_deployment_status
 * - k8s_pods
 * - k8s_events
 * - k8s_logs
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { cleanTool } from './index.js'

/** Render an arbitrary value as a formatted JSON text block. */
function renderObject(value: unknown) {
  return [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }]
}

/**
 * Register K8s tools with the DSH context.
 * @param ctx - DSH context
 * @param k8s - K8sService instance
 */
export function registerK8sTools(ctx: any, k8s: any): void {
  const register = (ctx.tools?.register ?? ctx.tool?.register)?.bind(ctx.tools ?? ctx.tool)
  if (!register) {
    ctx.log?.warn?.('[dsh-devops] ctx.tools not available, skipping K8s tool registration')
    return
  }

  // ─── k8s_deployment_status ────────────────────────────────────────────────
  register(cleanTool(defineTool({
    name: 'k8s_deployment_status',
    description: 'Get deployment rolling status (replicas, conditions). Returns all deployments if no name given.',
    parameters: {
      cluster: { type: 'string', description: 'Cluster ID (optional, uses default)' },
      namespace: { type: 'string', description: 'Namespace (uses cluster default)' },
      name: { type: 'string', description: 'Specific deployment name (optional, lists all if omitted)' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => renderObject(value),
    },
    async execute(args) {
      const cluster = args.cluster || undefined
      const ns = args.namespace || k8s.getDefaultNamespace(cluster)

      if (args.name) {
        const dep = await k8s.getDeploymentStatus(cluster, ns, args.name)
        return formatDeployment(dep)
      }

      const deps = await k8s.getDeploymentStatusList(cluster, ns)
      return {
        namespace: ns,
        count: deps.length,
        deployments: deps.map(formatDeployment),
      }
    },
  })))

  // ─── k8s_pods ─────────────────────────────────────────────────────────────
  register(cleanTool(defineTool({
    name: 'k8s_pods',
    description: 'List pods in a namespace with phase and restart counts.',
    parameters: {
      cluster: { type: 'string', description: 'Cluster ID (optional, uses default)' },
      namespace: { type: 'string', description: 'Namespace (uses cluster default)' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => renderObject(value),
    },
    async execute(args) {
      const cluster = args.cluster || undefined
      const ns = args.namespace || k8s.getDefaultNamespace(cluster)
      const pods = await k8s.getPodList(cluster, ns)
      return {
        namespace: ns,
        count: pods.length,
        pods: pods.map((p: any) => ({
          name: p.name,
          phase: p.phase,
          restart_count: p.restartCount,
          node: p.nodeName,
          containers: p.containers.map((c: any) => ({
            name: c.name,
            ready: c.ready,
            restarts: c.restartCount,
          })),
        })),
      }
    },
  })))

  // ─── k8s_events ───────────────────────────────────────────────────────────
  register(cleanTool(defineTool({
    name: 'k8s_events',
    description: 'Get recent Kubernetes events in a namespace.',
    parameters: {
      cluster: { type: 'string', description: 'Cluster ID (optional, uses default)' },
      namespace: { type: 'string', description: 'Namespace (uses cluster default)' },
      limit: { type: 'number', description: 'Max events to return (default: 20)' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => renderObject(value),
    },
    async execute(args) {
      const cluster = args.cluster || undefined
      const ns = args.namespace || k8s.getDefaultNamespace(cluster)
      const limit = args.limit || 20
      const events = await k8s.getEvents(cluster, ns, limit)
      return {
        namespace: ns,
        count: events.length,
        events: events.map((e: any) => ({
          type: e.type,
          reason: e.reason,
          message: e.message,
          object: e.object,
          count: e.count,
          last_timestamp: e.lastTimestamp,
        })),
      }
    },
  })))

  // ─── k8s_logs ─────────────────────────────────────────────────────────────
  register(cleanTool(defineTool({
    name: 'k8s_logs',
    description: 'Get pod logs (tail last N lines).',
    parameters: {
      cluster: { type: 'string', description: 'Cluster ID (optional, uses default)' },
      namespace: { type: 'string', description: 'Namespace (uses cluster default)' },
      pod: { type: 'string', description: 'Pod name', required: true },
      container: { type: 'string', description: 'Container name (optional, first container if omitted)' },
      tail_lines: { type: 'number', description: 'Number of lines from the end (default: 100)' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => renderObject(value),
    },
    async execute(args) {
      const cluster = args.cluster || undefined
      const ns = args.namespace || k8s.getDefaultNamespace(cluster)
      const pod = args.pod
      const container = args.container
      const tailLines = args.tail_lines || 100

      const logs = await k8s.getPodLogs(cluster, ns, pod, container, tailLines)
      return { pod, namespace: ns, tail_lines: tailLines, logs }
    },
  })))
}

function formatDeployment(dep: any) {
  return {
    name: dep.name,
    namespace: dep.namespace,
    ready: `${dep.readyReplicas}/${dep.desiredReplicas}`,
    available: dep.availableReplicas,
    updated: dep.updatedReplicas,
    conditions: dep.conditions.map((c: any) => ({
      type: c.type,
      status: c.status,
      reason: c.reason,
      message: c.message,
    })),
  }
}
