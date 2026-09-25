/**
 * K8s service — multi-cluster router over {@link K8sClient} plus the service
 * interface consumed by the AI tools and the monitor engine.
 */
import type { K8sConfig, KubeconfigRef } from '../../config.ts'
import type { DeploymentStatus, K8sEvent, PodInfo } from '../../types.ts'
import { K8sClient } from './client.ts'
import { parseKubeconfig } from './kubeconfig.ts'

// ─── Router ────────────────────────────────────────────────────────────────────

interface ClusterEntry {
  client: K8sClient
  /** Namespace resolved from the kubeconfig context (`default` when absent). */
  contextNamespace: string
  /** Per-ref namespace override (strongest), if configured. */
  refNamespace?: string
}

/**
 * One {@link KubeconfigRef} = one configured cluster (kubeconfig file + the
 * context within it). The router parses each ref eagerly and exposes clients
 * by their `id`, with a sensible default.
 */
export class K8sRouter {
  private readonly clusters = new Map<string, ClusterEntry>()
  private readonly defaultClientId: string
  private readonly defaultNamespace?: string

  constructor(
    kubeconfigs: KubeconfigRef[],
    defaultContext?: string,
    defaultNamespace?: string,
  ) {
    if (!kubeconfigs.length) {
      throw new Error('[k8s] router requires at least one kubeconfig')
    }

    for (const ref of kubeconfigs) {
      const ctx = parseKubeconfig(ref.path, ref.context ?? defaultContext)
      this.clusters.set(ref.id, {
        client: new K8sClient(ctx),
        contextNamespace: ctx.namespace,
        refNamespace: ref.namespace,
      })
    }

    const ids = [...this.clusters.keys()]
    this.defaultClientId =
      defaultContext && this.clusters.has(defaultContext) ? defaultContext : ids[0]!
    this.defaultNamespace = defaultNamespace
  }

  /** All configured cluster ids. */
  list(): string[] {
    return [...this.clusters.keys()]
  }

  /** Resolve a cluster id (or the default) to its client. */
  resolve(id?: string): K8sClient {
    return this.entry(id).client
  }

  /**
   * Effective namespace for a cluster. Precedence:
   * ref override → context namespace (when it isn't the implicit `default`) →
   * router default → `default`.
   */
  getDefaultNamespace(id?: string): string {
    const e = this.entry(id)
    if (e.refNamespace) return e.refNamespace
    if (e.contextNamespace !== 'default') return e.contextNamespace
    return this.defaultNamespace ?? 'default'
  }

  private entry(id?: string): ClusterEntry {
    const key = id ?? this.defaultClientId
    const e = this.clusters.get(key)
    if (!e) {
      throw new Error(
        `[k8s] unknown cluster id "${key}" (configured: ${[...this.clusters.keys()].join(', ')})`,
      )
    }
    return e
  }
}

// ─── Service interface ─────────────────────────────────────────────────────────

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

// ─── Factory ───────────────────────────────────────────────────────────────────

/** Build the K8s service from a parsed config section (eager router). */
export function createK8sService(config: K8sConfig): K8sService {
  const router = new K8sRouter(config.kubeconfigs, config.defaultContext, config.defaultNamespace)

  return {
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
}
