/**
 * @jacksonchen/dsh-devops — Plugin entry point.
 *
 * A single unified DSH plugin providing GitLab + K8s DevOps monitoring.
 * All modules are activated on-demand based on configuration:
 * - gitlab section → GitLab service + tools
 * - k8s section → K8s service + tools
 * - webhook section → webhook endpoint (requires gitlab)
 * - monitor section → background polling alert engine
 */

import type { Context } from '@deepseek-ai/cordis'
import { parseConfig, type DshDevopsConfig, type GitLabConfig, type K8sConfig, type WebhookConfig, type MonitorConfig } from './config.js'
import { registerGitLab, type GitLabService } from './gitlab/index.js'
import { registerK8s, type K8sService } from './k8s/index.js'
import { registerTools } from './tools/index.js'
import { registerWebhook } from './webhook/index.js'
import { startMonitor } from './monitor/index.js'
import { registerDevopsApi } from './api.js'
import { createLazyGitLabService, createLazyK8sService } from './runtime/lazy.js'

export const name = 'dsh-devops'

/**
 * Schemastery config schema — Cordis validates the user's `config` against this
 * at load time and fills schema defaults before calling `apply`. Re-exported from
 * the config module so it is discoverable as the entry's `Config` value.
 * (Cross-field business rules live in `parseConfig`, the second gate in `apply`.)
 */
export { Config } from './config.js'

// webServer is required for ctx.webServer.register() in registerDevopsApi;
// tools is required for ctx.tools.register() in the AI tool modules
export const inject = ['webServer', 'tools']

/**
 * Plugin apply function — called by the DSH/Cordis loader.
 *
 * @param ctx - The DSH host context (services, tools, events, effects, etc.)
 * @param rawConfig - Raw user config from cordis.yml
 */
export function apply(ctx: Context, rawConfig: unknown): void {
  // All config sections are optional. A missing/non-object config (e.g. the
  // bundle is installed but not configured yet) means "load clean, everything
  // disabled" rather than a startup crash.
  const raw = rawConfig && typeof rawConfig === 'object' ? rawConfig : {}
  const config = parseConfig(raw) as DshDevopsConfig

  // 1-3. Services + tools — always registered. Both services resolve their
  // config lazily on every call (cordis config overrides, else the settings
  // file ~/.dsh-devops/config.json the dashboard writes), so "install →
  // configure in Settings → AI tools work" needs no restart and no YAML.
  // When nothing is configured yet, tool execute() returns a friendly
  // "go to Settings → DevOps" error instead of the tool being absent.
  const gitlabService: GitLabService = createLazyGitLabService(ctx, raw)
  const k8sService: K8sService = createLazyK8sService(ctx, raw)
  registerTools(ctx, { gitlab: gitlabService, k8s: k8sService })

  // 4. Register webhook (if configured — requires a static cordis config)
  if (config.webhook) {
    registerWebhook(ctx, config.webhook)
  }

  // 5. Start monitor engine (if configured — background polling needs a
  // static config; uses the eager services when cordis config exists)
  if (config.monitor) {
    const eagerGitlab = config.gitlab ? registerGitLab(ctx, config.gitlab) : gitlabService
    const eagerK8s = config.k8s ? registerK8s(ctx, config.k8s) : k8sService
    startMonitor(ctx, config.monitor, { gitlab: eagerGitlab, k8s: eagerK8s })
  }

  // 6. Register /devops/api HTTP routes (always available for settings wizard)
  registerDevopsApi(ctx)
}

// Re-export types for consumers
export type { DshDevopsConfig, GitLabConfig, K8sConfig, WebhookConfig, MonitorConfig } from './config.js'
export type { GitLabService } from './gitlab/index.js'
export type { K8sService } from './k8s/index.js'
export type {
  MergeRequest,
  Pipeline,
  PipelineJob,
  GitTag,
  PipelineWatch,
  DeploymentStatus,
  PodInfo,
  K8sEvent,
  WebhookEvent,
} from './types.js'
