/**
 * Multi-cluster router: resolves a cluster id to a live {@link K8sClient}.
 *
 * One {@link KubeconfigRef} = one configured cluster (kubeconfig file + the
 * context within it). The router parses each ref eagerly and exposes clients by
 * their `id`, with a sensible default.
 */
import type { KubeconfigRef } from '../config.js'
import { K8sClient } from './client.js'
import { parseKubeconfig } from './kubeconfig.js'

interface ClusterEntry {
  client: K8sClient
  /** Namespace resolved from the kubeconfig context (`default` when absent). */
  contextNamespace: string
  /** Per-ref namespace override (strongest), if configured. */
  refNamespace?: string
}

export class K8sRouter {
  private readonly clusters = new Map<string, ClusterEntry>()
  private readonly defaultClientId: string
  private readonly defaultNamespace?: string

  /**
   * @param kubeconfigs     One entry per cluster. Each `id` is the routing key.
   * @param defaultContext  Preferred default cluster. Used as the default when it
   *                        matches a configured `id`; otherwise the first cluster.
   *                        (Also passed to each file whose ref omits `context`.)
   * @param defaultNamespace Fallback namespace applied when neither a ref nor its
   *                        context specifies one.
   */
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
      defaultContext && this.clusters.has(defaultContext) ? defaultContext : ids[0]
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
