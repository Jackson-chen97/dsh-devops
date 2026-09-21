/**
 * Shared public types for the dsh-devops plugin.
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

export interface Pipeline {
  id: number
  status: PipelineStatus
  ref: string
  sha: string
  webUrl: string
  createdAt: string
  finishedAt?: string
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

export interface PipelineWatch {
  projectId: string
  pipelineId: number
  branch: string
  status: 'watching' | 'completed' | 'failed' | 'canceled'
  startedAt: string
  lastPollAt?: string
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
}

export interface K8sEvent {
  type: 'Normal' | 'Warning'
  reason: string
  message: string
  object: { kind: string; name: string; namespace: string }
  count?: number
  lastTimestamp: string
}

// ─── Webhook ───────────────────────────────────────────────────────────────────

export type WebhookEvent =
  | { type: 'merge_request'; action: 'open' | 'update' | 'close' | 'merge' | 'approval' | 'unapproval' }
  | { type: 'pipeline'; action: 'created' | 'success' | 'failed' | 'canceled' | 'skipped' }
  | { type: 'tag_push' }
  | { type: 'note'; action: 'create' }

// ─── Monitor Rules ─────────────────────────────────────────────────────────────

export interface PipelineAlertRule {
  projects?: string[]
  branches?: string[]
  trigger: 'failed' | 'canceled' | 'success'
  message?: string
  includeFailedJobs?: boolean
}

export interface PodAlertRule {
  clusters?: string[]
  namespaces?: string[]
  trigger: 'crash' | 'restart' | 'pending_stuck'
  restartThreshold?: number
  pendingTimeoutSec?: number
  message?: string
  includeLogs?: boolean
}
