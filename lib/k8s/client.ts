/**
 * Minimal Kubernetes REST client.
 *
 * Uses `node:https` with Bearer-token authentication. No extra HTTP
 * dependencies are required.
 *
 * TLS: when the kubeconfig carries `certificate-authority-data`, that CA is
 * pinned per request. `insecureSkipTlsVerify` disables verification entirely
 * (matching kubectl semantics).
 */
import { request as httpsRequest } from 'node:https'
import type { DeploymentCondition, DeploymentStatus, K8sEvent, PodInfo } from '../types.js'
import type { K8sContext } from './kubeconfig.js'

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
  metadata?: { name?: string; namespace?: string }
  spec?: { replicas?: number }
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
}

interface RawPod {
  metadata?: { name?: string; namespace?: string }
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
  involvedObject?: { kind?: string; name?: string; namespace?: string }
}

// ─── Mapping helpers ────────────────────────────────────────────────────────────

const CONDITION_TYPES: readonly DeploymentCondition['type'][] = [
  'Available',
  'Progressing',
  'ReplicaFailure',
]
const CONDITION_STATUSES: readonly DeploymentCondition['status'][] = ['True', 'False', 'Unknown']
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

function toDeploymentCondition(c: RawCondition): DeploymentCondition {
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

function toPodInfo(p: RawPod, fallbackNamespace: string): PodInfo {
  const s = p.status ?? {}
  const containers = (s.containerStatuses ?? []).map((c) => ({
    name: c.name ?? '',
    ready: c.ready ?? false,
    restartCount: c.restartCount ?? 0,
  }))
  const phaseStr = s.phase ?? ''
  return {
    name: p.metadata?.name ?? '',
    namespace: p.metadata?.namespace ?? fallbackNamespace,
    phase: inSet(phaseStr, POD_PHASES) ? phaseStr : 'Unknown',
    nodeName: s.nodeName,
    restartCount: containers.reduce((sum, c) => sum + c.restartCount, 0),
    containers,
    startTime: s.startTime,
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
  }
}

// ─── Client ─────────────────────────────────────────────────────────────────────

export class K8sClient {
  private readonly ctx: K8sContext
  private readonly server: string

  constructor(ctx: K8sContext) {
    this.ctx = ctx
    this.server = ctx.server.replace(/\/+$/, '')
  }

  /** Authenticated GET returning parsed JSON. */
  private async getJson<T>(path: string): Promise<T> {
    const res = await this.fetch(path, 'application/json')
    return (await res.json()) as T
  }

  /** Authenticated GET returning the body as text. */
  private async getText(path: string): Promise<string> {
    // The pod-logs subresource only accepts json/yaml/protobuf Accept types
    // (406 on text/plain); the body is the plain-text log either way.
    const res = await this.fetch(path, 'application/json')
    return res.text()
  }

  private async fetch(path: string, accept: string): Promise<Response> {
    const url = new URL(`${this.server}${path}`)
    const ca = this.ctx.caData ? Buffer.from(this.ctx.caData, 'base64') : undefined
    const res = await new Promise<Response>((resolve, reject) => {
      const req = httpsRequest(
        {
          hostname: url.hostname,
          port: url.port || 443,
          path: `${url.pathname}${url.search}`,
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.ctx.token}`,
            Accept: accept,
          },
          ...(this.ctx.insecureSkipTlsVerify
            ? { rejectUnauthorized: false }
            : ca
              ? { ca, rejectUnauthorized: true, checkServerIdentity: () => undefined }
              : {}),
        },
        (upstream) => {
          const chunks: Buffer[] = []
          upstream.on('data', (c: Buffer) => chunks.push(c))
          upstream.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8')
            const status = upstream.statusCode ?? 0
            // Node's Response rejects body-less statuses (204/304) with a body
            // attached; empty-body statuses get an explicit null body.
            const bodyless = status === 204 || status === 304
            resolve(
              new Response(bodyless ? null : body, {
                status,
                statusText: upstream.statusMessage ?? '',
              }),
            )
          })
        },
      )
      req.on('error', reject)
      req.end()
    }).catch((err) => {
      throw new Error(`[k8s] request to ${path} failed: ${(err as Error).message}`)
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(
        `[k8s] GET ${path} failed: ${res.status} ${res.statusText}${body ? ` — ${truncate(body)}` : ''}`,
      )
    }
    return res
  }

  /** List all deployments in a namespace. */
  async getDeployments(namespace: string): Promise<DeploymentStatus[]> {
    const data = await this.getJson<K8sList<RawDeployment>>(
      `/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments`,
    )
    return data.items.map((d) => toDeploymentStatus(d, namespace))
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
  async getPodLogs(
    namespace: string,
    podName: string,
    container?: string,
    tailLines?: number,
  ): Promise<string> {
    const params = new URLSearchParams()
    if (container) params.set('container', container)
    if (tailLines != null) params.set('tailLines', String(tailLines))
    const qs = params.toString()
    const path = `/api/v1/namespaces/${encodeURIComponent(namespace)}/pods/${encodeURIComponent(podName)}/log${
      qs ? `?${qs}` : ''
    }`
    return this.getText(path)
  }
}
