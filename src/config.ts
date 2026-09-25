/**
 * Plugin configuration: Schemastery schema + cross-field validation.
 *
 * Schemastery schema: Cordis validates the user's `config` against this at
 * load time and fills schema defaults before calling `apply`. Cross-field
 * business rules (webhook requires gitlab, monitor requires gitlab or k8s)
 * are enforced by `parseConfig` as a second gate.
 *
 * IMPORTANT: Do NOT use `.required()` on any field in this schema.
 * Schemastery validates `.required()` sub-fields even when the parent object
 * is absent from the input, causing boot failures for unconfigured plugins.
 * Actual field-presence validation is handled by `parseConfig()` (the "second
 * gate") which only enforces required fields when their section IS present.
 */

import Schema from 'schemastery'

export interface GitLabProjectConfig {
  id: string
  path: string
  defaultBranch?: string
  /** Direct token (settings-file source). Takes precedence over tokenEnv. */
  token?: string
  /** Env var name holding the token (cordis config source). */
  tokenEnv?: string
}

export interface GitLabConfig {
  baseUrl: string
  /** GitLab personal access token (direct value) */
  token: string
  defaultProject?: string
  projects: GitLabProjectConfig[]
}

export interface KubeconfigRef {
  /** Unique identifier (used for tool parameter routing) */
  id: string
  /** Kubeconfig file path (supports ~ expansion) */
  path: string
  /** Optional: specify which context to use from the file (defaults to current-context) */
  context?: string
  /** Optional: default namespace override */
  namespace?: string
}

export interface K8sConfig {
  /** List of kubeconfig file references (supports multiple files = multiple clusters) */
  kubeconfigs: KubeconfigRef[]
  /** Default cluster to use (corresponds to context in kubeconfig) */
  defaultContext?: string
  /** Default namespace when context doesn't specify one */
  defaultNamespace?: string
}

export interface WebhookConfig {
  secret: string
  projectPaths?: string[]
  quietEvents?: string[]
}

export interface MonitorConfig {
  pollIntervalSec?: number
  cooldownSec?: number
  pipeline?: PipelineAlertRuleConfig[]
  pod?: PodAlertRuleConfig[]
}

export interface PipelineAlertRuleConfig {
  projects?: string[]
  branches?: string[]
  trigger: 'failed' | 'canceled' | 'success'
  message?: string
  includeFailedJobs?: boolean
}

export interface PodAlertRuleConfig {
  clusters?: string[]
  namespaces?: string[]
  trigger: 'crash' | 'restart' | 'pending_stuck'
  restartThreshold?: number
  pendingTimeoutSec?: number
  message?: string
  includeLogs?: boolean
}

export interface DshDevopsConfig {
  /** GitLab config (optional — omit to disable GitLab capabilities) */
  gitlab?: GitLabConfig
  /** K8s config (optional) */
  k8s?: K8sConfig
  /** Webhook config (optional, requires gitlab) */
  webhook?: WebhookConfig
  /** Monitor/alert config (optional, requires gitlab or k8s) */
  monitor?: MonitorConfig
}

/** The exported `Config` is what Cordis validates and injects into `apply`. */
export type Config = DshDevopsConfig

export const Config: Schema<Config> = Schema.object({
  gitlab: Schema.object({
    baseUrl: Schema.string(),
    token: Schema.string(),
    defaultProject: Schema.string(),
    projects: Schema.array(
      Schema.object({
        id: Schema.string(),
        path: Schema.string(),
        defaultBranch: Schema.string(),
      }),
    ),
  }),
  k8s: Schema.object({
    kubeconfigs: Schema.array(
      Schema.object({
        id: Schema.string(),
        path: Schema.string(),
        context: Schema.string(),
        namespace: Schema.string(),
      }),
    ),
    defaultContext: Schema.string(),
    defaultNamespace: Schema.string(),
  }),
  webhook: Schema.object({
    secret: Schema.string(),
    projectPaths: Schema.array(Schema.string()),
    quietEvents: Schema.array(Schema.string()),
  }),
  monitor: Schema.object({
    pollIntervalSec: Schema.number().default(30),
    cooldownSec: Schema.number().default(300),
    pipeline: Schema.array(
      Schema.object({
        projects: Schema.array(Schema.string()),
        branches: Schema.array(Schema.string()),
        trigger: Schema.union(['failed', 'canceled', 'success']),
        message: Schema.string(),
        includeFailedJobs: Schema.boolean(),
      }),
    ),
    pod: Schema.array(
      Schema.object({
        clusters: Schema.array(Schema.string()),
        namespaces: Schema.array(Schema.string()),
        trigger: Schema.union(['crash', 'restart', 'pending_stuck']),
        restartThreshold: Schema.number(),
        pendingTimeoutSec: Schema.number(),
        message: Schema.string(),
        includeLogs: Schema.boolean(),
      }),
    ),
  }),
})

/**
 * Parse and validate the raw plugin config.
 * Throws a descriptive error on missing/invalid fields.
 *
 * Called by `apply()` as a second gate after Cordis schema validation,
 * enforcing cross-field business rules that cannot be expressed in a
 * flat Schemastery schema.
 */
export function parseConfig(raw: unknown): DshDevopsConfig {
  if (!raw || typeof raw !== 'object') {
    throw new Error('[dsh-devops] config must be an object')
  }

  const config = { ...(raw as DshDevopsConfig) }

  // Schemastery fills every declared section with an empty object/array even
  // when the user did not configure it. Strip sections that are "effectively
  // empty" so downstream code can use simple truthiness checks.
  if (config.gitlab && !config.gitlab.baseUrl) {
    delete config.gitlab
  }
  if (config.k8s && (!config.k8s.kubeconfigs || config.k8s.kubeconfigs.length === 0)) {
    delete config.k8s
  }
  if (config.webhook && !config.webhook.secret) {
    delete config.webhook
  }
  if (config.monitor) {
    const hasRules = (config.monitor.pipeline?.length ?? 0) > 0 || (config.monitor.pod?.length ?? 0) > 0
    if (!hasRules) delete config.monitor
  }

  if (config.gitlab) {
    if (!config.gitlab.baseUrl) {
      throw new Error('[dsh-devops] gitlab.baseUrl is required when gitlab section is present')
    }
    if (!config.gitlab.token) {
      throw new Error('[dsh-devops] gitlab.token is required when gitlab section is present')
    }
    if (!config.gitlab.projects?.length) {
      throw new Error('[dsh-devops] gitlab.projects must be a non-empty array')
    }
    for (const p of config.gitlab.projects) {
      if (!p.id) throw new Error('[dsh-devops] gitlab project must have an id')
      if (!p.path) throw new Error(`[dsh-devops] gitlab project "${p.id}" must have a path`)
    }
  }

  if (config.k8s) {
    if (!config.k8s.kubeconfigs?.length) {
      throw new Error('[dsh-devops] k8s.kubeconfigs must be a non-empty array when k8s section is present')
    }
    for (const ref of config.k8s.kubeconfigs) {
      if (!ref.id) throw new Error('[dsh-devops] k8s kubeconfig ref must have an id')
      if (!ref.path) throw new Error(`[dsh-devops] k8s kubeconfig "${ref.id}" must have a path`)
    }
  }

  if (config.webhook) {
    if (!config.webhook.secret) {
      throw new Error('[dsh-devops] webhook.secret is required')
    }
    if (!config.gitlab) {
      throw new Error('[dsh-devops] webhook requires gitlab section to be configured')
    }
  }

  if (config.monitor) {
    if (!config.gitlab && !config.k8s) {
      throw new Error('[dsh-devops] monitor requires at least gitlab or k8s to be configured')
    }
  }

  return config
}
