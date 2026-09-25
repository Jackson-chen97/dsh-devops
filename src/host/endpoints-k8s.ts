/**
 * Kubernetes RPC endpoints (raw params — kubeconfigPath + context — so the
 * dashboard can test connectivity and act BEFORE saving the config).
 */
import { K8sClient } from '../core/k8s/client.ts'
import { expandPath, parseKubeconfig } from '../core/k8s/kubeconfig.ts'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message }
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** Parse the kubeconfig and build a client; throws with a descriptive message. */
function clientFrom(params: { kubeconfigPath?: string; context?: string }): K8sClient {
  const ctx = parseKubeconfig(params.kubeconfigPath ?? '', params.context)
  return new K8sClient(ctx)
}

/** All context entries of a kubeconfig file, with their configured namespace. */
export function kubeconfigContexts(kubeconfigPath: string): { name: string; namespace: string }[] {
  const doc = parse(readFileSync(expandPath(kubeconfigPath), 'utf8')) as {
    contexts?: { name?: string; context?: { namespace?: string } }[]
  }
  return (doc?.contexts ?? [])
    .map((c) => ({ name: c?.name ?? '', namespace: c?.context?.namespace ?? '' }))
    .filter((c) => c.name)
}

// ─── Read endpoints ────────────────────────────────────────────────────────────

export async function testK8s(params: { kubeconfigPath?: string; context?: string }) {
  if (!params.kubeconfigPath) return fail('Missing kubeconfigPath')
  try {
    const kctx = parseKubeconfig(params.kubeconfigPath, params.context)
    const client = new K8sClient(kctx)
    const info = await client.getVersion()
    // Context list for the dropdown; each entry carries the namespace
    // configured for that context so the client can prefill the namespace.
    let contexts: { name: string; namespace: string }[] = []
    try {
      contexts = kubeconfigContexts(params.kubeconfigPath)
    } catch {
      /* best-effort */
    }
    return {
      ok: true,
      message: `Connected to ${kctx.server} (${info.gitVersion ?? 'unknown version'})`,
      server: kctx.server,
      namespace: kctx.namespace,
      contexts,
    }
  } catch (err) {
    return fail(errorMessage(err))
  }
}

export async function k8sContexts(params: { kubeconfigPath?: string }) {
  if (!params.kubeconfigPath) return { ok: false, contexts: [], message: 'Missing kubeconfigPath' }
  try {
    return { ok: true, contexts: kubeconfigContexts(params.kubeconfigPath) }
  } catch (err) {
    return { ok: false, contexts: [], message: errorMessage(err) }
  }
}

export async function k8sNamespaces(params: { kubeconfigPath?: string; context?: string }) {
  try {
    const client = clientFrom(params)
    return { ok: true, namespaces: await client.listNamespaces() }
  } catch (err) {
    if (isAbort(err)) return { ok: false, namespaces: [], message: 'Timed out' }
    return { ok: false, namespaces: [], message: errorMessage(err) }
  }
}

export async function k8sDeployments(params: { kubeconfigPath?: string; context?: string; namespace?: string }) {
  try {
    const kctx = parseKubeconfig(params.kubeconfigPath ?? '', params.context)
    const ns = params.namespace || kctx.namespace
    const client = new K8sClient(kctx)
    return { ok: true, deployments: await client.getDeploymentsWithImage(ns) }
  } catch (err) {
    if (isAbort(err)) return { ok: false, deployments: [], message: 'Timed out' }
    return { ok: false, deployments: [], message: errorMessage(err) }
  }
}

export async function k8sPods(params: { kubeconfigPath?: string; context?: string; namespace?: string }) {
  if (!params.kubeconfigPath || !params.namespace) {
    return { ok: false, pods: [], message: 'Missing kubeconfigPath or namespace' }
  }
  try {
    const client = clientFrom(params)
    const pods = await client.getPods(params.namespace)
    return {
      ok: true,
      pods: pods.map((p) => ({
        name: p.name,
        phase: p.phase,
        ready: p.containers.filter((c) => c.ready).length,
        total: p.containers.length,
        restarts: p.restartCount,
        node: p.nodeName ?? '',
        reason: p.reason ?? '',
        startedAt: p.startTime ?? '',
      })),
    }
  } catch (err) {
    if (isAbort(err)) return { ok: false, pods: [], message: 'Timed out' }
    return { ok: false, pods: [], message: errorMessage(err) }
  }
}

export async function k8sEvents(params: { kubeconfigPath?: string; context?: string; namespace?: string; limit?: number }) {
  if (!params.kubeconfigPath || !params.namespace) {
    return { ok: false, events: [], message: 'Missing kubeconfigPath or namespace' }
  }
  try {
    const client = clientFrom(params)
    const events = await client.getEvents(params.namespace, Math.min(params.limit ?? 20, 100))
    return {
      ok: true,
      events: events.map((ev) => ({
        type: ev.type,
        reason: ev.reason,
        message: ev.message,
        object: ev.object.name,
        kind: ev.object.kind,
        time: ev.lastTimestamp || ev.eventTime || '',
      })),
    }
  } catch (err) {
    if (isAbort(err)) return { ok: false, events: [], message: 'Timed out' }
    return { ok: false, events: [], message: errorMessage(err) }
  }
}

export async function k8sPodLogs(params: {
  kubeconfigPath?: string
  context?: string
  namespace?: string
  podName?: string
  container?: string
  tailLines?: number
}) {
  if (!params.kubeconfigPath || !params.namespace || !params.podName) {
    return { ok: false, logs: '', message: 'Missing kubeconfigPath, namespace or podName' }
  }
  try {
    const client = clientFrom(params)
    const logs = await client.getPodLogs(
      params.namespace,
      params.podName,
      params.container,
      Math.min(params.tailLines ?? 100, 1000),
    )
    return { ok: true, logs }
  } catch (err) {
    if (isAbort(err)) return { ok: false, logs: '', message: 'Timed out' }
    return { ok: false, logs: '', message: errorMessage(err) }
  }
}

// ─── Write endpoints ───────────────────────────────────────────────────────────

export async function k8sSetImage(params: {
  kubeconfigPath?: string
  context?: string
  namespace?: string
  name?: string
  image?: string
  container?: string
}) {
  if (!params.image) return fail('Missing image')
  try {
    const client = clientFrom(params)
    await client.setDeploymentImage(params.namespace!, params.name!, params.image, params.container)
    return { ok: true }
  } catch (err) {
    return fail(errorMessage(err))
  }
}

export async function k8sRestart(params: {
  kubeconfigPath?: string
  context?: string
  namespace?: string
  name?: string
}) {
  try {
    const client = clientFrom(params)
    await client.restartDeployment(params.namespace!, params.name!)
    return { ok: true }
  } catch (err) {
    return fail(errorMessage(err))
  }
}
