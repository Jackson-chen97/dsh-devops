/**
 * Shared domain types for the dsh-devops plugin.
 */

// ─── GitLab ────────────────────────────────────────────────────────────────────

export interface MergeRequest {
  iid: number
  title: string
  state: 'opened' | 'closed' | 'merged' | 'locked'
  sourceBranch: string
  targetBranch: string
  webUrl: string
  approvals: { approved: boolean; required: number; given: number }
}

export type PipelineStatus =
  | 'created'
  | 'waiting_for_resource'
  | 'preparing'
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'canceled'
  | 'skipped'
  | 'manual'
  | 'scheduled'

export interface Pipeline {
  id: number
  status: PipelineStatus
  ref: string
  sha: string
  webUrl: string
  createdAt: string
  finishedAt?: string
}

export interface PipelineJob {
  id: number
  name: string
  status: PipelineStatus
  stage: string
  duration?: number
}

export interface GitTag {
  name: string
  target: string
  message?: string
  commitId: string
}

// ─── Kubernetes ────────────────────────────────────────────────────────────────

export interface DeploymentStatus {
  name: string
  namespace: string
  readyReplicas: number
  availableReplicas: number
  desiredReplicas: number
  updatedReplicas: number
  conditions: DeploymentCondition[]
}

export interface DeploymentCondition {
  type: 'Available' | 'Progressing' | 'ReplicaFailure'
  status: 'True' | 'False' | 'Unknown'
  reason: string
  message: string
  lastUpdateTime: string
}

export interface PodInfo {
  name: string
  namespace: string
  phase: 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown'
  nodeName?: string
  restartCount: number
  containers: { name: string; ready: boolean; restartCount: number }[]
  startTime?: string
  /** Failure reason: current waiting state, else last terminated reason. */
  reason?: string
}

export interface K8sEvent {
  type: 'Normal' | 'Warning'
  reason: string
  message: string
  object: { kind: string; name: string; namespace: string }
  count?: number
  lastTimestamp: string
  eventTime?: string
}

// ─── Webhook ───────────────────────────────────────────────────────────────────

export type WebhookEvent =
  | { type: 'merge_request'; action: 'open' | 'update' | 'close' | 'merge' | 'approval' | 'unapproval' }
  | { type: 'pipeline'; action: 'created' | 'success' | 'failed' | 'canceled' | 'skipped' }
  | { type: 'tag_push' }
  | { type: 'note'; action: 'create' }

// ─── Settings file (~/.dsh-devops/config.json) ────────────────────────────────
//
// The Settings → DevOps UI writes this file; the host merges it with the
// cordis config (cordis override wins) and resolves live services from it.

export interface GitLabServerEntry {
  id: string
  label: string
  baseUrl: string
  token: string
  projectPath: string
  branch: string
}

export interface KubeconfigEntry {
  id: string
  label: string
  path: string
  context: string
  namespace: string
}

export interface DevopsSettingsFile {
  gitlab?: {
    servers: GitLabServerEntry[]
    activeServerId: string | null
  }
  k8s?: {
    kubeconfigs: KubeconfigEntry[]
    activeKubeconfigId: string | null
  }
}
