/**
 * @jacksonchen/dsh-devops — host plugin entry.
 *
 * A single DSH plugin providing GitLab + Kubernetes DevOps capabilities:
 * - AI tools (gitlab_* / k8s_*) backed by lazily-resolved services
 * - Web console over Connection RPC channels (Settings + dashboard)
 * - GitLab webhook notifications (requires static config)
 * - Background polling alert monitor (requires static config)
 */

import type { Context } from '@deepseek-ai/cordis'
import { parseConfig, Config, type DshDevopsConfig } from '../config.ts'
import { createGitLabService, type GitLabService } from '../core/gitlab/service.ts'
import { createK8sService, type K8sService } from '../core/k8s/service.ts'
import { registerTools } from './tools.ts'
import { registerWebhook } from './webhook.ts'
import { startMonitor } from './monitor.ts'
import { registerDevopsRpc } from './rpc.ts'
import { createLazyGitLabService, createLazyK8sService } from './services.ts'

export const name = 'dsh-devops'

/**
 * Tools are required (headless profiles have them); the Connection service is
 * injected conditionally inside `apply` so headless setups skip the web
 * console instead of failing to load.
 */
export const inject = ['tools']

export { Config }

/**
 * Plugin apply — called by the DSH/Cordis loader.
 *
 * @param ctx       - the DSH host context (services, tools, effects, etc.)
 * @param rawConfig - raw user config from the cordis patch
 */
export function apply(ctx: Context, rawConfig: unknown): void {
  // All config sections are optional. A missing/non-object config (e.g. the
  // bundle is installed but not configured yet) means "load clean, everything
  // disabled" rather than a startup crash.
  const raw = rawConfig && typeof rawConfig === 'object' ? rawConfig : {}
  const config = parseConfig(raw) as DshDevopsConfig

  // 1. Lazy services + tools — always registered. Both services resolve their
  //    config on every call (cordis overrides, else the settings file
  //    ~/.dsh-devops/config.json the dashboard writes), so "install →
  //    configure in Settings → AI tools work" needs no restart and no YAML.
  //    When nothing is configured yet, tool execute() returns a friendly
  //    "go to Settings → DevOps" error instead of the tool being absent.
  const gitlabService: GitLabService = createLazyGitLabService()
  const k8sService: K8sService = createLazyK8sService()
  registerTools(ctx as never, { gitlab: gitlabService, k8s: k8sService })

  // 2. Web console RPC channels (skipped on headless profiles — see
  //    registerDevopsRpc's conditional injection of `connection`).
  registerDevopsRpc(ctx as never)

  // 3. Register webhook (if configured — requires a static cordis config)
  if (config.webhook) {
    registerWebhook(ctx as never, config.webhook)
  }

  // 4. Start monitor engine (if configured — background polling needs a
  //    static config; uses the eager services when cordis config exists)
  if (config.monitor) {
    const eagerGitlab = config.gitlab ? createGitLabService(config.gitlab) : gitlabService
    const eagerK8s = config.k8s ? createK8sService(config.k8s) : k8sService
    startMonitor(ctx as never, config.monitor, { gitlab: eagerGitlab, k8s: eagerK8s })
  }
}

// Re-export types for consumers
export type { DshDevopsConfig } from '../config.ts'
export type { GitLabService } from '../core/gitlab/service.ts'
export type { K8sService } from '../core/k8s/service.ts'
