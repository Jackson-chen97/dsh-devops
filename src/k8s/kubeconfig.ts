/**
 * Kubeconfig file parsing.
 *
 * Reads a kubeconfig (YAML) file, selects a context (explicit name or the
 * file's `current-context`), and resolves the referenced cluster + user into a
 * single {@link K8sContext} used by the K8s client.
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'yaml'

/** A resolved kubeconfig context: everything the client needs to talk to a cluster. */
export interface K8sContext {
  /** API server base URL, e.g. `https://api.example.com:6443` */
  server: string
  /** Bearer token used for authentication. */
  token: string
  /** Base64-encoded cluster CA (from `certificate-authority-data`). */
  caData?: string
  /** Whether TLS verification is to be skipped. */
  insecureSkipTlsVerify?: boolean
  /** Namespace to use when none is given by the caller (context namespace, else `default`). */
  namespace: string
}

/**
 * Expand a leading `~` (or `~/...`) in a path to the user's home directory.
 * Paths that do not start with `~` are returned unchanged.
 */
export function expandPath(p: string): string {
  if (p === '~') return homedir()
  if (p.startsWith('~/') || p.startsWith('~\\')) {
    return join(homedir(), p.slice(2))
  }
  return p
}

// ─── Minimal kubeconfig shapes (only the fields we read) ────────────────────────

interface RawClusterObject {
  'server'?: string
  'certificate-authority-data'?: string
  'insecure-skip-tls-verify'?: boolean
  [key: string]: unknown
}

interface RawClusterEntry {
  cluster?: RawClusterObject
  name?: string
}

interface RawUserObject {
  'token'?: string
  'auth-provider'?: {
    name?: string
    config?: {
      'access-token'?: string
    }
  }
  [key: string]: unknown
}

interface RawUserEntry {
  name?: string
  user?: RawUserObject
}

interface RawContextInner {
  'cluster'?: string
  'user'?: string
  'namespace'?: string
  [key: string]: unknown
}

interface RawContextEntry {
  context?: RawContextInner
  name?: string
}

interface RawKubeconfig {
  'current-context'?: string
  clusters?: RawClusterEntry[]
  users?: RawUserEntry[]
  contexts?: RawContextEntry[]
}

/**
 * Parse a kubeconfig file into a resolved {@link K8sContext}.
 *
 * @param filePath    Path to the kubeconfig file (supports `~` expansion).
 * @param contextName  Context to select. When omitted, the file's
 *                    `current-context` is used.
 * @throws Descriptive errors when the file/context/cluster/user cannot be found
 *         or a required field (server, token) is missing.
 */
export function parseKubeconfig(filePath: string, contextName?: string): K8sContext {
  const expanded = expandPath(filePath)

  let raw: string
  try {
    raw = readFileSync(expanded, 'utf8')
  } catch (err) {
    throw new Error(`[k8s] cannot read kubeconfig file at "${expanded}": ${(err as Error).message}`)
  }

  let doc: RawKubeconfig
  try {
    doc = parse(raw) as RawKubeconfig
  } catch (err) {
    throw new Error(`[k8s] failed to parse YAML in kubeconfig "${expanded}": ${(err as Error).message}`)
  }
  if (!doc || typeof doc !== 'object') {
    throw new Error(`[k8s] kubeconfig "${expanded}" did not parse to a mapping`)
  }

  const clusters = doc.clusters ?? []
  const users = doc.users ?? []
  const contexts = doc.contexts ?? []

  // ── Select the context ──────────────────────────────────────────────────
  const targetName = contextName ?? doc['current-context']
  if (!targetName) {
    throw new Error(
      `[k8s] kubeconfig "${expanded}" has no current-context and no context name was provided`,
    )
  }

  const ctx = contexts.find((c) => c.name === targetName)
  if (!ctx) {
    const available = contexts.map((c) => c.name).filter(Boolean).join(', ') || 'none'
    throw new Error(
      `[k8s] context "${targetName}" not found in kubeconfig "${expanded}" (available: ${available})`,
    )
  }

  const inner = ctx.context ?? {}
  const clusterName = inner['cluster']
  const userRef = inner['user']
  if (!clusterName) {
    throw new Error(`[k8s] context "${targetName}" does not reference a cluster`)
  }
  if (!userRef) {
    throw new Error(`[k8s] context "${targetName}" does not reference a user`)
  }

  // ── Resolve the cluster ─────────────────────────────────────────────────
  const clusterEntry = clusters.find((c) => c.name === clusterName)
  if (!clusterEntry) {
    throw new Error(
      `[k8s] cluster "${clusterName}" (referenced by context "${targetName}") not found in kubeconfig "${expanded}"`,
    )
  }
  const cluster: RawClusterObject = clusterEntry.cluster ?? {}
  const server = cluster['server']
  if (!server) {
    throw new Error(`[k8s] cluster "${clusterName}" does not specify a server`)
  }

  // ── Resolve the user + token ────────────────────────────────────────────
  const userEntry = users.find((u) => u.name === userRef)
  if (!userEntry) {
    throw new Error(
      `[k8s] user "${userRef}" (referenced by context "${targetName}") not found in kubeconfig "${expanded}"`,
    )
  }
  const user: RawUserObject = userEntry.user ?? {}
  const token = user['token'] ?? user['auth-provider']?.config?.['access-token']
  if (!token) {
    throw new Error(
      `[k8s] user "${userRef}" does not provide a token (looked for "token" and "auth-provider.config.access-token")`,
    )
  }

  return {
    server,
    token,
    caData: cluster['certificate-authority-data'] || undefined,
    insecureSkipTlsVerify: cluster['insecure-skip-tls-verify'] || undefined,
    namespace: inner['namespace'] ?? 'default',
  }
}
