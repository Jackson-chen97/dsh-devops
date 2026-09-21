/**
 * Runtime config resolution — unifies the two config sources so AI tools and
 * the web dashboard share one configuration.
 *
 * Precedence per section:
 *   1. cordis plugin config (`cordis.patch.yml` insert entry `config` block) —
 *      explicit override for advanced users / headless setups;
 *   2. `~/.dsh-devops/config.json` — what the Settings → DevOps UI writes.
 *
 * Tools resolve this lazily on every execute(), so dashboard changes
 * (project / cluster switches) apply to AI calls immediately, no restart.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { GitLabConfig, K8sConfig } from './config.js'

const CONFIG_FILE = join(homedir(), '.dsh-devops', 'config.json')

export const NOT_CONFIGURED_MSG =
  '[dsh-devops] Not configured yet — open DSH Settings → DevOps, add the connection info, and save.'

/** Read the raw settings-file config (null when missing/corrupt). */
function readConfigJson(): any | null {
  try {
    if (!existsSync(CONFIG_FILE)) return null
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'))
  } catch {
    return null
  }
}

/** Minimal server-side mirror of the client's migrateConfig (legacy → servers list). */
function normalizeConfigJson(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw
  const out = JSON.parse(JSON.stringify(raw))
  const gl = out.gitlab || {}
  if (!Array.isArray(gl.servers) && gl.baseUrl) {
    const legacyProject = Array.isArray(gl.projects) ? gl.projects[0] : null
    gl.servers = [{
      id: 's1', label: 'GitLab',
      baseUrl: gl.baseUrl, token: gl.token || '',
      projectPath: legacyProject?.path || '', branch: legacyProject?.defaultBranch || '',
    }]
  }
  const k8s = out.k8s || {}
  if (!Array.isArray(k8s.kubeconfigs) && k8s.kubeconfigPath) {
    k8s.kubeconfigs = [{ id: 'k1', path: k8s.kubeconfigPath, context: k8s.context || '', namespace: k8s.namespace || '' }]
  }
  out.gitlab = gl
  out.k8s = k8s
  return out
}

/**
 * Resolve the effective GitLab config.
 * Returns null when neither source has a usable GitLab section.
 */
export function resolveGitLabConfig(cordisRaw: unknown): GitLabConfig | null {
  // 1. cordis override
  const raw = (cordisRaw && typeof cordisRaw === 'object' ? cordisRaw : {}) as any
  if (raw.gitlab && typeof raw.gitlab === 'object' && raw.gitlab.baseUrl) {
    return raw.gitlab as GitLabConfig
  }
  // 2. settings file (active server = the whole effective config)
  const file = normalizeConfigJson(readConfigJson())
  const gl = file?.gitlab || {}
  const servers: any[] = Array.isArray(gl.servers) ? gl.servers : []
  const active = servers.find((s) => s.id === gl.activeServerId) || servers[0]
  if (!active?.baseUrl || !active?.token || !active?.projectPath) return null
  const usable = servers.filter((s) => s.baseUrl && s.token)
  return {
    baseUrl: active.baseUrl,
    token: active.token,
    defaultProject: active.id,
    projects: usable.map((s) => ({
      id: s.id,
      path: s.projectPath || '',
      token: s.token,
      defaultBranch: s.branch || undefined,
    })),
  }
}

/**
 * Resolve the effective K8s config.
 * Returns null when neither source has a usable K8s section.
 */
export function resolveK8sConfig(cordisRaw: unknown): K8sConfig | null {
  const raw = (cordisRaw && typeof cordisRaw === 'object' ? cordisRaw : {}) as any
  if (raw.k8s && typeof raw.k8s === 'object' && Array.isArray(raw.k8s.kubeconfigs) && raw.k8s.kubeconfigs.length) {
    return raw.k8s as K8sConfig
  }
  const file = normalizeConfigJson(readConfigJson())
  const k8s = file?.k8s || {}
  const kcList: any[] = Array.isArray(k8s.kubeconfigs) ? k8s.kubeconfigs : []
  const usable = kcList.filter((k) => k.path)
  if (!usable.length) return null
  const active = usable.find((k) => k.id === k8s.activeKubeconfigId) || usable[0]
  return {
    kubeconfigs: usable.map((k) => ({
      id: k.id,
      path: k.path,
      context: k.context || undefined,
      namespace: k.namespace || undefined,
    })),
    defaultContext: active.id,
  }
}
