/**
 * Shared RPC protocol between the host plugin and the web client.
 *
 * Channels follow the DSH Connection convention: absolute logical channel
 * prefixes dispatched by endpoint name. The payload and result of every
 * endpoint are JSON-safe values; handlers return the `ConnectionRpcResult`
 * envelope (`{ ok: true, value } | { ok: false, error }`).
 */

/** Read-only endpoints: connection tests, listings, config/log retrieval. */
export const DEVOPS_READ_CHANNEL = '/dsh-devops-read'

/** Mutating endpoints: create MR/tag, pipeline actions, image/restart, config save. */
export const DEVOPS_WRITE_CHANNEL = '/dsh-devops-write'

/** Every endpoint served on {@link DEVOPS_READ_CHANNEL}. */
export type DevopsReadEndpoint =
  // GitLab (raw params — usable before saving config)
  | 'test-gitlab'
  | 'gitlab-projects'
  | 'gitlab-branches'
  | 'gitlab-members'
  | 'gitlab-last-commit'
  | 'gitlab-mrs'
  | 'gitlab-pipelines'
  | 'gitlab-tags'
  | 'gitlab-pipeline-jobs'
  | 'gitlab-job-log'
  // Kubernetes (raw params)
  | 'test-k8s'
  | 'k8s-contexts'
  | 'k8s-namespaces'
  | 'k8s-deployments'
  | 'k8s-pods'
  | 'k8s-events'
  | 'k8s-pod-logs'
  // App: settings file, logs, native file browse
  | 'config-load'
  | 'logs'
  | 'browse-file'

/** Every endpoint served on {@link DEVOPS_WRITE_CHANNEL}. */
export type DevopsWriteEndpoint =
  | 'gitlab-create-mr'
  | 'gitlab-create-tag'
  | 'gitlab-pipeline-action'
  | 'gitlab-mr-approve'
  | 'gitlab-mr-action'
  | 'k8s-set-image'
  | 'k8s-restart'
  | 'config-save'
