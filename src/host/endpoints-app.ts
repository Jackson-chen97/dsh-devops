/**
 * App-level RPC endpoints: settings file persistence, plugin log retrieval,
 * and the native kubeconfig file browse dialog (Windows).
 */
import { execFile } from 'node:child_process'
import { saveSettingsFile } from './config-store.ts'
import { loadMigratedSettings } from './runtime-config.ts'
import { readLogs } from '../core/logging.ts'

export async function configLoad(_params: Record<string, unknown>) {
  const raw = loadMigratedSettings()
  return { ok: true, config: raw }
}

export async function configSave(params: Record<string, unknown>) {
  const result = saveSettingsFile(params)
  return { ok: result.ok, message: result.ok ? '配置已保存' : result.message }
}

export async function logs(params: { level?: string; search?: string; lines?: number } = {}) {
  return readLogs(params)
}

/**
 * Native file browse (Windows only): a PowerShell OpenFileDialog so the user
 * can pick a kubeconfig without typing paths.
 */
export async function browseFile(_params: Record<string, unknown>) {
  if (process.platform !== 'win32') {
    return { ok: false, path: '', message: 'File browse not supported on this platform' }
  }
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$d = New-Object System.Windows.Forms.OpenFileDialog',
    "$d.Title = '选择 kubeconfig 文件'",
    "$d.Filter = '配置文件 (*.yaml;*.yml;*.json;*.config)|*.yaml;*.yml;*.json;*.config|所有文件 (*.*)|*.*'",
    '$r = $d.ShowDialog()',
    'if ($r -eq [System.Windows.Forms.DialogResult]::OK) { $d.FileName }',
  ].join('; ')
  return new Promise((resolve) => {
    // Use 'powershell' (Windows PowerShell) — always in system PATH on Windows
    execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 120000 }, (err, stdout) => {
      const path = stdout?.trim()
      if (err && !path) {
        resolve({ ok: false, path: '', message: err.message })
      } else {
        resolve({ ok: true, path: path || '' })
      }
    })
  })
}
