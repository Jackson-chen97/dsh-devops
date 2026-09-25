/**
 * Settings-file store: ~/.dsh-devops/config.json.
 *
 * This is what Settings → DevOps writes; tools and the monitor resolve it
 * lazily so dashboard changes apply without a restart. Includes the legacy
 * single-server → multi-server migration.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { DevopsSettingsFile, GitLabServerEntry, KubeconfigEntry } from '../types.ts'
import { CONFIG_FILE, ensureDevopsDir, writeLog } from '../core/logging.ts'

/** Read the raw settings file (null when missing/corrupt). */
export function readSettingsFile(): DevopsSettingsFile | null {
  try {
    if (!existsSync(CONFIG_FILE)) return null
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) as DevopsSettingsFile
  } catch {
    return null
  }
}

/**
 * Shallow-merge `patch` into the settings file: sections not present in the
 * patch (e.g. saving only k8s) keep their previous value.
 */
export function saveSettingsFile(patch: Record<string, unknown>): { ok: boolean; message?: string } {
  try {
    ensureDevopsDir()
    let existing: Record<string, unknown> = {}
    if (existsSync(CONFIG_FILE)) {
      try {
        existing = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'))
      } catch {
        existing = {}
      }
    }
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) existing = {}
    writeFileSync(CONFIG_FILE, JSON.stringify({ ...existing, ...patch }, null, 2), 'utf8')
    writeLog('info', 'save-config', 'config written')
    return { ok: true }
  } catch (err) {
    const message = (err as Error).message
    writeLog('error', 'save-config', message)
    return { ok: false, message: `保存失败: ${message}` }
  }
}

/** Active GitLab server entry (by activeServerId, else the first). */
export function resolveGitLabServer(cfg: DevopsSettingsFile | null): GitLabServerEntry | null {
  const gl = cfg?.gitlab
  if (!gl || !Array.isArray(gl.servers)) return null
  return gl.servers.find((s) => s.id === gl.activeServerId) ?? gl.servers[0] ?? null
}

/** Active kubeconfig entry (by activeKubeconfigId, else the first). */
export function resolveKubeconfigEntry(cfg: DevopsSettingsFile | null): KubeconfigEntry | null {
  const k8s = cfg?.k8s
  if (!k8s || !Array.isArray(k8s.kubeconfigs)) return null
  return k8s.kubeconfigs.find((k) => k.id === k8s.activeKubeconfigId) ?? k8s.kubeconfigs[0] ?? null
}

/**
 * Migrate the legacy single-server config shape to the multi-server shape.
 * Legacy: {gitlab: {baseUrl, token, projects: [...]}, k8s: {kubeconfigPath, ...}}
 * Target: {gitlab: {servers: [...], activeServerId}, k8s: {kubeconfigs: [...], activeKubeconfigId}}
 */
export function migrateSettingsFile(raw: unknown): DevopsSettingsFile {
  const out = JSON.parse(JSON.stringify(raw ?? {})) as Record<string, any>
  const gl = (out.gitlab = out.gitlab ?? {})
  if (!Array.isArray(gl.servers) && gl.baseUrl) {
    const legacyProject = Array.isArray(gl.projects) ? gl.projects[0] : null
    gl.servers = [
      {
        id: 's1',
        label: 'GitLab',
        baseUrl: gl.baseUrl,
        token: gl.token || '',
        projectPath: legacyProject?.path || '',
        branch: legacyProject?.defaultBranch || legacyProject?.branch || '',
      },
    ]
  }
  delete gl.baseUrl
  delete gl.token
  delete gl.projects
  delete gl.defaultProject
  gl.servers = (gl.servers ?? []).filter((s: any) => s && s.id)
  if (!gl.activeServerId || !gl.servers.some((s: any) => s.id === gl.activeServerId)) {
    gl.activeServerId = gl.servers[0]?.id ?? null
  }

  const k8s = (out.k8s = out.k8s ?? {})
  if (!Array.isArray(k8s.kubeconfigs) && k8s.kubeconfigPath) {
    k8s.kubeconfigs = [
      { id: 'k1', path: k8s.kubeconfigPath, context: k8s.context || '', namespace: k8s.namespace || '' },
    ]
  }
  delete k8s.kubeconfigPath
  delete k8s.context
  delete k8s.namespace
  k8s.kubeconfigs = (k8s.kubeconfigs ?? []).map((k: any) => ({
    ...k,
    label: k.label || (k.path ? k.path.split(/[\\/]/).pop() : 'K8s 配置'),
  }))
  if (!k8s.activeKubeconfigId || !k8s.kubeconfigs.some((k: any) => k.id === k8s.activeKubeconfigId)) {
    k8s.activeKubeconfigId = k8s.kubeconfigs[0]?.id ?? null
  }

  return out as DevopsSettingsFile
}
