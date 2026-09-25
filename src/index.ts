export { name, inject, Config, apply } from './host/plugin.ts'
export type { DshDevopsConfig, GitLabService, K8sService } from './host/plugin.ts'
export type {
  MergeRequest,
  Pipeline,
  PipelineJob,
  GitTag,
  DeploymentStatus,
  PodInfo,
  K8sEvent,
  WebhookEvent,
} from './types.ts'
