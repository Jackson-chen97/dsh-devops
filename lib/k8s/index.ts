/**
 * K8s service — public API and plugin registration.
 *
 * Follows the same DshContext lifecycle pattern as the GitLab module and the
 * positional-argument style the existing `tools/k8s.ts` and `monitor/rules.ts`
 * consumers rely on.
 */
import type { K8sConfig } from '../config.js'
import type { DeploymentStatus, K8sEvent, PodInfo } from '../types.js'
import { K8sRouter } from './router.js'

/**
 * Minimal context interface (provided by the DSH host at runtime).
 * Matches the GitLab and monitor modules.
 */
interface DshContext {
  effect(execute: () => any, label?: string): any
  followup?(message: string): void
  log?: { warn(...args: unknown[]): void; error(...args: unknown[]): void }
}

// ─── Public Service Interface ──────────────────────────────────────────────────

export interface K8sService {
  /** List all configured cluster ids. */
  listClusters(): string[]

  /**
   * Effective default namespace for a cluster. Precedence: per-ref override →
   * context namespace → router default → `default`.
   */
  getDefaultNamespace(cluster?: string): string

  /** Status of a single deployment. */
  getDeploymentStatus(cluster: string | undefined, namespace: string, name: string): Promise<DeploymentStatus>

  /** All deployments in a namespace. */
  getDeploymentStatusList(cluster: string | undefined, namespace: string): Promise<DeploymentStatus[]>

  /** All pods in a namespace. */
  getPodList(cluster: string | undefined, namespace: string): Promise<PodInfo[]>

  /** Recent events in a namespace. */
  getEvents(cluster: string | undefined, namespace: string, limit?: number): Promise<K8sEvent[]>

  /** Tail of a pod's logs. */
  getPodLogs(
    cluster: string | undefined,
    namespace: string,
    podName: string,
    container?: string,
    tailLines?: number,
  ): Promise<string>
}

// ─── Registration ──────────────────────────────────────────────────────────────

/**
 * Register the K8s service with the DSH context.
 *
 * Eagerly parses every configured kubeconfig so misconfiguration surfaces at
 * startup (inside the lifecycle effect) rather than on first use.
 *
 * @param ctx    — DSH host context (carries the full Cordis API at runtime)
 * @param config — parsed K8s configuration section
 * @returns the public {@link K8sService} instance
 */
export function registerK8s(ctx: DshContext, config: K8sConfig): K8sService {
  const router = new K8sRouter(config.kubeconfigs, config.defaultContext, config.defaultNamespace)

  // Register a lifecycle effect so the host can manage the service's lifetime.
  ctx.effect(() => {
    const ids = router.list()
    ctx.log?.warn?.(`[dsh-devops:k8s] ready — ${ids.length} cluster(s): ${ids.join(', ')}`)
    // The K8s client is stateless (pure HTTP), so nothing to release; the
    // cleanup hook exists so future versions with persistent connections can
    // hook into host shutdown.
    return () => {
      /* cleanup */
    }
  }, 'dsh-devops:k8s')

  const service: K8sService = {
    listClusters: () => router.list(),

    getDefaultNamespace: (cluster) => router.getDefaultNamespace(cluster),

    getDeploymentStatus: (cluster, namespace, name) =>
      router.resolve(cluster).getDeployment(namespace, name),

    getDeploymentStatusList: (cluster, namespace) => router.resolve(cluster).getDeployments(namespace),

    getPodList: (cluster, namespace) => router.resolve(cluster).getPods(namespace),

    getEvents: (cluster, namespace, limit) => router.resolve(cluster).getEvents(namespace, limit),

    getPodLogs: (cluster, namespace, podName, container, tailLines) =>
      router.resolve(cluster).getPodLogs(namespace, podName, container, tailLines),
  }

  return service
}
