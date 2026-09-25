/**
 * Plugin log file (~/.dsh-devops/devops.log): append-only with size rotation,
 * plus filtered reads served to the dashboard Logs tab.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const DEVOPS_DIR = join(homedir(), '.dsh-devops')
export const CONFIG_FILE = join(DEVOPS_DIR, 'config.json')
export const LOG_FILE = join(DEVOPS_DIR, 'devops.log')

const MAX_LOG_SIZE = 5 * 1024 * 1024 // 5 MB rotation threshold

export function ensureDevopsDir(): void {
  if (!existsSync(DEVOPS_DIR)) mkdirSync(DEVOPS_DIR, { recursive: true })
}

/** Write a log entry to ~/.dsh-devops/devops.log (best-effort, never throws). */
export function writeLog(level: 'info' | 'warn' | 'error', message: string, detail?: string): void {
  try {
    ensureDevopsDir()
    // Rotate: if the file exceeds MAX_LOG_SIZE, keep only the last 512KB.
    try {
      const st = statSync(LOG_FILE)
      if (st.size > MAX_LOG_SIZE) {
        const content = readFileSync(LOG_FILE, 'utf8')
        writeFileSync(LOG_FILE, content.slice(-512 * 1024), 'utf8')
      }
    } catch {
      /* file may not exist yet */
    }

    const ts = new Date().toISOString()
    const line = `[${ts}] [${level.toUpperCase()}] ${message}${detail ? ' | ' + detail : ''}\n`
    appendFileSync(LOG_FILE, line, 'utf8')
  } catch {
    /* best-effort logging */
  }
}

/** Read log entries for the dashboard (level/search filters, last-N tail). */
export function readLogs(params: { level?: string; search?: string; lines?: number } = {}): {
  ok: boolean
  lines: string[]
  message?: string
} {
  try {
    if (!existsSync(LOG_FILE)) return { ok: true, lines: [] }
    let allLines = readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean)

    const level = (params.level ?? '').toLowerCase()
    if (level) {
      allLines = allLines.filter((l) => l.includes(`[${level.toUpperCase()}]`))
    }

    const search = (params.search ?? '').toLowerCase()
    if (search) {
      allLines = allLines.filter((l) => l.toLowerCase().includes(search))
    }

    const limit = Math.min(Number(params.lines) || 200, 5000)
    return { ok: true, lines: allLines.slice(-limit) }
  } catch (err) {
    return { ok: false, lines: [], message: (err as Error).message }
  }
}
