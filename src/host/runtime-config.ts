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

// ─── Config discovery view (devops_config tool) ────────────────────────────
//
// Built straight from the settings file — the same effective source the lazy
// tools resolve against — because only it carries the `label`s a user means
// when saying "查看 [配置名] 的 [服务]" (resolve*Config() discards them).
// Token values are never included: tool output enters model context, while
// `config-load` (browser-only) remains the sole token carrier.
// Type aliases (not interfaces) so the result is assignable to the
// tool's Record<string, JsonValue> output contract.

/** One GitLab server entry as the devops_config tool reports it. */
export type GitLabServerView = {
  id: string
  label: string
  baseUrl: string
  projectPath: string
  branch: string
  tokenConfigured: boolean
}

/** One kubeconfig entry as the devops_config tool reports it. */
export type KubeconfigView = {
  id: string
  label: string
  path: string
  context: string
  namespace: string
}

/** Result of buildConfigView — exactly what devops_config returns. */
export type DevopsConfigView = {
  configured: boolean
  gitlab?: { activeServerId: string | null; servers: GitLabServerView[] }
  k8s?: { activeKubeconfigId: string | null; kubeconfigs: KubeconfigView[] }
  hint?: string
  message?: string
}

const CONFIG_TOOL_HINT =
  'Pass a server id as the `project` parameter and a kubeconfig id as the `cluster` parameter in the gitlab_*/k8s_* tools.'

/**
 * Discover every configured GitLab server and kubeconfig for the
 * devops_config tool. Returns `{ configured: false, message }` when nothing
 * is present, so the model gets an actionable hint instead of an error.
 */
export function buildConfigView(): DevopsConfigView {
  const file = loadMigratedSettings()
  const gl = file?.gitlab
  const servers: GitLabServerView[] = (gl && Array.isArray(gl.servers) ? gl.servers : [])
    .filter((s) => s.id)
    .map((s) => ({
      id: s.id,
      label: s.label || s.id,
      baseUrl: s.baseUrl || '',
      projectPath: s.projectPath || '',
      branch: s.branch || '',
      tokenConfigured: !!s.token,
    }))
  const kubeconfigs: KubeconfigView[] = (file?.k8s && Array.isArray(file.k8s.kubeconfigs) ? file.k8s.kubeconfigs : [])
    .filter((k) => k.id)
    .map((k) => ({
      id: k.id,
      label: k.label || k.id,
      path: k.path || '',
      context: k.context || '',
      namespace: k.namespace || '',
    }))

  if (!servers.length && !kubeconfigs.length) return { configured: false, message: NOT_CONFIGURED_MSG }

  // Mirror the resolver's active-selection logic so the reported "active"
  // id matches what the other tools actually fall back to.
  const usableServers = servers.filter((s) => s.baseUrl && s.tokenConfigured)
  const activeServerId =
    usableServers.find((s) => s.id === gl?.activeServerId)?.id ?? usableServers[0]?.id ?? null
  const usableKc = kubeconfigs.filter((k) => k.path)
  const activeKubeconfigId =
    usableKc.find((k) => k.id === file?.k8s?.activeKubeconfigId)?.id ?? usableKc[0]?.id ?? null

  const view: DevopsConfigView = { configured: true, hint: CONFIG_TOOL_HINT }
  if (servers.length) view.gitlab = { activeServerId, servers }
  if (kubeconfigs.length) view.k8s = { activeKubeconfigId, kubeconfigs }
  return view
}
