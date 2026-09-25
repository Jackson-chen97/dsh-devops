/**
 * Minimal Kubernetes REST client.
 *
 * Requests go through the shared {@link requestWithTimeout} helper; when the
 * kubeconfig carries `certificate-authority-data` the CA is pinned per request
 * (`insecureSkipTlsVerify` disables verification, matching kubectl semantics).
 */
import type { DeploymentStatus, K8sEvent, PodInfo } from '../../types.ts'
import { requestWithTimeout } from '../http.ts'
import type { K8sContext } from './kubeconfig.ts'

// ─── Raw K8s API shapes (only the fields we map) ───────────────────────────────

interface K8sList<T> {
  items: T[]
}

interface RawCondition {
  type?: string
  status?: string
  reason?: string
  message?: string
  lastUpdateTime?: string
}

interface RawDeployment {
  metadata?: { name?: string; namespace?: string; creationTimestamp?: string }
  spec?: { replicas?: number; template?: { spec?: { containers?: { name?: string; image?: string }[] } } }
  status?: {
    replicas?: number
    readyReplicas?: number
    availableReplicas?: number
    updatedReplicas?: number
    conditions?: RawCondition[]
  }
}

interface RawContainerStatus {
  name?: string
  ready?: boolean
  restartCount?: number
  state?: { waiting?: { reason?: string } }
  lastState?: { terminated?: { reason?: string } }
}

interface RawPod {
  metadata?: { name?: string; namespace?: string }
  spec?: { nodeName?: string }
  status?: {
    phase?: string
    nodeName?: string
    startTime?: string
    containerStatuses?: RawContainerStatus[]
  }
}

interface RawEvent {
  type?: string
  reason?: string
  message?: string
  count?: number
  lastTimestamp?: string
  eventTime?: string
  involvedObject?: { kind?: string; name?: string; namespace?: string }
}

// ─── Mapping helpers ────────────────────────────────────────────────────────────

const CONDITION_TYPES: readonly DeploymentStatus['conditions'][number]['type'][] = [
  'Available',
  'Progressing',
  'ReplicaFailure',
]
const CONDITION_STATUSES: readonly DeploymentStatus['conditions'][number]['status'][] = ['True', 'False', 'Unknown']
const POD_PHASES: readonly PodInfo['phase'][] = [
  'Pending',
  'Running',
  'Succeeded',
  'Failed',
  'Unknown',
]

/** Type-narrowing membership check for string-union fields coming from the API. */
function inSet<T extends string>(value: string, set: readonly T[]): value is T {
  return (set as readonly string[]).includes(value)
}

function truncate(s: string, max = 300): string {
  return s.length > max ? `${s.slice(0, max)}…` : s
}

function toDeploymentCondition(c: RawCondition): DeploymentStatus['conditions'][number] {
  const typeStr = c.type ?? ''
  const statusStr = c.status ?? ''
  return {
    type: inSet(typeStr, CONDITION_TYPES) ? typeStr : 'Progressing',
    status: inSet(statusStr, CONDITION_STATUSES) ? statusStr : 'Unknown',
    reason: c.reason ?? '',
    message: c.message ?? '',
    lastUpdateTime: c.lastUpdateTime ?? '',
  }
}

function toDeploymentStatus(d: RawDeployment, fallbackNamespace: string): DeploymentStatus {
  const s = d.status ?? {}
  return {
    name: d.metadata?.name ?? '',
    namespace: d.metadata?.namespace ?? fallbackNamespace,
    readyReplicas: s.readyReplicas ?? 0,
    availableReplicas: s.availableReplicas ?? 0,
    desiredReplicas: d.spec?.replicas ?? 0,
    updatedReplicas: s.updatedReplicas ?? 0,
    conditions: (s.conditions ?? []).map(toDeploymentCondition),
  }
}

/**
 * Surface a meaningful failure reason: the current waiting state wins, else
 * the last terminated reason (e.g. OOMKilled, Error) for crashlooping pods.
 */
function podFailureReason(cs: RawContainerStatus[]): string {
  let reason = ''
  for (const c of cs) {
    if (c.state?.waiting?.reason) reason = c.state.waiting.reason
    else if (!reason && c.lastState?.terminated?.reason && c.lastState.terminated.reason !== 'Completed') {
      reason = c.lastState.terminated.reason
    }
  }
  return reason
}

function toPodInfo(p: RawPod, fallbackNamespace: string): PodInfo {
  const s = p.status ?? {}
  const cs = s.containerStatuses ?? []
  const containers = cs.map((c) => ({
    name: c.name ?? '',
    ready: c.ready ?? false,
    restartCount: c.restartCount ?? 0,
  }))
  const phaseStr = s.phase ?? ''
  return {
    name: p.metadata?.name ?? '',
    namespace: p.metadata?.namespace ?? fallbackNamespace,
    phase: inSet(phaseStr, POD_PHASES) ? phaseStr : 'Unknown',
    nodeName: s.nodeName ?? p.spec?.nodeName,
    restartCount: containers.reduce((sum, c) => sum + c.restartCount, 0),
    containers,
    startTime: s.startTime,
    reason: podFailureReason(cs),
  }
}

function toK8sEvent(e: RawEvent, fallbackNamespace: string): K8sEvent {
  return {
    type: e.type === 'Warning' ? 'Warning' : 'Normal',
    reason: e.reason ?? '',
    message: e.message ?? '',
    object: {
      kind: e.involvedObject?.kind ?? '',
      name: e.involvedObject?.name ?? '',
      namespace: e.involvedObject?.namespace ?? fallbackNamespace,
    },
    count: e.count,
    lastTimestamp: e.lastTimestamp ?? '',
    eventTime: e.eventTime ?? '',
  }
}

// ─── Client ─────────────────────────────────────────────────────────────────────

/** Dashboard projection of a deployment: adds image + creation info. */
export interface DeploymentWithImage {
  name: string
  ready: number
  replicas: number
  image: string
  imageTag: string
  updated: string
}

export class K8sClient {
  private readonly server: string

  constructor(private readonly ctx: K8sContext) {
    this.server = ctx.server.replace(/\/+$/, '')
  }

  /** Authenticated request returning the raw Response. */
  private async request(
    path: string,
    opts: { method?: 'GET' | 'PATCH'; body?: string; timeoutMs?: number } = {},
  ): Promise<Response> {
    const res = await requestWithTimeout(`${this.server}${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${this.ctx.token}`,
        Accept: 'application/json',
        ...(opts.body ? { 'Content-Type': 'application/strategic-merge-patch+json' } : {}),
      },
      ...(opts.body ? { body: opts.body } : {}),
      timeoutMs: opts.timeoutMs ?? 10000,
      tls: { caData: this.ctx.caData, insecureSkipTlsVerify: this.ctx.insecureSkipTlsVerify },
    }).catch((err) => {
      throw new Error(`[k8s] request to ${path} failed: ${(err as Error).message}`)
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(
        `[k8s] ${opts.method ?? 'GET'} ${path} failed: ${res.status} ${res.statusText}${body ? ` — ${truncate(body)}` : ''}`,
      )
    }
    return res
  }

  private async getJson<T>(path: string, timeoutMs?: number): Promise<T> {
    const res = await this.request(path, { timeoutMs })
    return (await res.json()) as T
  }

  /** API server version (connection test). */
  async getVersion(): Promise<{ gitVersion?: string }> {
    return this.getJson('/version', 5000)
  }

  /** Names of the active namespaces in the cluster. */
  async listNamespaces(): Promise<string[]> {
    const data = await this.getJson<K8sList<{ metadata?: { name?: string }; status?: { phase?: string } }>>(
      '/api/v1/namespaces',
      5000,
    )
    return data.items
      .filter((ns) => ns.status?.phase === 'Active' || !ns.status)
      .map((ns) => ns.metadata?.name ?? '')
      .filter(Boolean)
  }

  /** List all deployments in a namespace. */
  async getDeployments(namespace: string): Promise<DeploymentStatus[]> {
    const data = await this.getJson<K8sList<RawDeployment>>(
      `/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments`,
    )
    return data.items.map((d) => toDeploymentStatus(d, namespace))
  }

  /** Dashboard projection: deployments with image + creation timestamp. */
  async getDeploymentsWithImage(namespace: string): Promise<DeploymentWithImage[]> {
    const data = await this.getJson<K8sList<RawDeployment>>(
      `/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments`,
    )
    return data.items.map((d) => {
      const spec = d.spec ?? {}
      const status = d.status ?? {}
      const image = spec.template?.spec?.containers?.[0]?.image ?? ''
      return {
        name: d.metadata?.name ?? '',
        ready: status.readyReplicas ?? 0,
        replicas: status.replicas ?? spec.replicas ?? 0,
        image,
        imageTag: (image.split(':')[1] ?? '').slice(0, 24),
        updated: d.metadata?.creationTimestamp ?? '',
      }
    })
  }

  /** Get a single deployment by name. */
  async getDeployment(namespace: string, name: string): Promise<DeploymentStatus> {
    const d = await this.getJson<RawDeployment>(
      `/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name)}`,
    )
    return toDeploymentStatus(d, namespace)
  }

  /** List all pods in a namespace. */
  async getPods(namespace: string): Promise<PodInfo[]> {
    const data = await this.getJson<K8sList<RawPod>>(
      `/api/v1/namespaces/${encodeURIComponent(namespace)}/pods`,
    )
    return data.items.map((p) => toPodInfo(p, namespace))
  }

  /** List recent events in a namespace, optionally limited. */
  async getEvents(namespace: string, limit?: number): Promise<K8sEvent[]> {
    const q = limit ? `?limit=${limit}` : ''
    const data = await this.getJson<K8sList<RawEvent>>(
      `/api/v1/namespaces/${encodeURIComponent(namespace)}/events${q}`,
    )
    return data.items.map((e) => toK8sEvent(e, namespace))
  }

  /** Fetch (tail of) a pod's logs. */
  async getPodLogs(namespace: string, podName: string, container?: string, tailLines?: number): Promise<string> {
    const params = new URLSearchParams()
    if (container) params.set('container', container)
    if (tailLines != null) params.set('tailLines', String(tailLines))
    const qs = params.toString()
    const path = `/api/v1/namespaces/${encodeURIComponent(namespace)}/pods/${encodeURIComponent(podName)}/log${
      qs ? `?${qs}` : ''
    }`
    // The pod-logs subresource only accepts json/yaml/protobuf Accept types
    // (406 on text/plain); the body is the plain-text log either way.
    const res = await this.request(path)
    return res.text()
  }

  /** Strategic-merge PATCH on a deployment (image change, restart annotation). */
  async patchDeployment(namespace: string, name: string, patch: Record<string, unknown>): Promise<void> {
    await this.request(
      `/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    )
  }

  /** Change the image of a deployment's first container (or the named one). */
  async setDeploymentImage(
    namespace: string,
    name: string,
    image: string,
    container?: string,
  ): Promise<void> {
    let containerName = container
    if (!containerName) {
      // Strategic-merge merges containers by name — resolve the first
      // container's name first.
      const dep = await this.getJson<RawDeployment>(
        `/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name)}`,
      )
      containerName = dep.spec?.template?.spec?.containers?.[0]?.name
      if (!containerName) throw new Error('Deployment has no containers')
    }
    await this.patchDeployment(namespace, name, {
      spec: { template: { spec: { containers: [{ name: containerName, image }] } } },
    })
  }

  /** Restart a deployment (annotate pod template, like kubectl rollout restart). */
  async restartDeployment(namespace: string, name: string): Promise<void> {
    await this.patchDeployment(namespace, name, {
      spec: { template: { metadata: { annotations: { 'kubectl.kubernetes.io/restartedAt': new Date().toISOString() } } } },
    })
  }
}
