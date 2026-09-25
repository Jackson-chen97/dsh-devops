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
import type { GitLabConfig, K8sConfig } from '../config.ts'
import type { DevopsSettingsFile } from '../types.ts'
import { migrateSettingsFile, readSettingsFile } from './config-store.ts'

export const NOT_CONFIGURED_MSG =
  '[dsh-devops] Not configured yet — open DSH Settings → DevOps, add the connection info, and save.'

/** Read + migrate the settings file (null when missing/corrupt). */
export function loadMigratedSettings(): DevopsSettingsFile | null {
  const raw = readSettingsFile()
  if (!raw) return null
  return migrateSettingsFile(raw)
}

/**
 * Resolve the effective GitLab config.
 * Returns null when neither source has a usable GitLab section.
 */
export function resolveGitLabConfig(cordisRaw: unknown): GitLabConfig | null {
  // 1. cordis override
  const raw = (cordisRaw && typeof cordisRaw === 'object' ? cordisRaw : {}) as Record<string, any>
  if (raw.gitlab && typeof raw.gitlab === 'object' && raw.gitlab.baseUrl) {
    return raw.gitlab as GitLabConfig
  }
  // 2. settings file (active server = the whole effective config)
  const file = loadMigratedSettings()
  const gl = file?.gitlab
  if (!gl) return null
  const servers = Array.isArray(gl.servers) ? gl.servers : []
  const usable = servers.filter((s) => s.baseUrl && s.token)
  const active = servers.find((s) => s.id === gl.activeServerId && s.baseUrl && s.token) ?? usable[0]
  if (!active || !active.baseUrl || !active.token || !active.projectPath) return null
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
  const raw = (cordisRaw && typeof cordisRaw === 'object' ? cordisRaw : {}) as Record<string, any>
  if (raw.k8s && typeof raw.k8s === 'object' && Array.isArray(raw.k8s.kubeconfigs) && raw.k8s.kubeconfigs.length) {
    return raw.k8s as K8sConfig
  }
  const file = loadMigratedSettings()
  const k8s = file?.k8s
  if (!k8s) return null
  const kcList = Array.isArray(k8s.kubeconfigs) ? k8s.kubeconfigs : []
  const usable = kcList.filter((k) => k.path)
  if (!usable.length) return null
  const active = usable.find((k) => k.id === k8s.activeKubeconfigId) ?? usable[0]
  if (!active) return null
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
