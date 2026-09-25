/**
 * Alert rule evaluation for pipeline and pod monitoring.
 */

import type { PipelineAlertRuleConfig, PodAlertRuleConfig, MonitorConfig } from '../../config.ts'
import { throttled } from './throttle.ts'

interface DshContext {
  effect(execute: () => any, label?: string): any
  followup?(message: string): void
  log?: { warn(...args: unknown[]): void; error(...args: unknown[]): void }
}

// ─── Pipeline Alerts ──────────────────────────────────────────────────────────

export async function checkPipelineAlerts(
  ctx: DshContext,
  gitlab: any,
  rules: PipelineAlertRuleConfig[],
  config: MonitorConfig,
): Promise<void> {
  const cooldown = config.cooldownSec ?? 300
  const projects: string[] = gitlab.listProjects()

  for (const project of projects) {
    for (const rule of rules) {
      // Filter: only process projects matching this rule
      if (rule.projects && !rule.projects.includes(project)) continue

      // Determine branches to check
      const branches: string[] = rule.branches ?? ['HEAD']

      for (const branch of branches) {
        // Fetch the latest pipeline for this branch
        const pipeline = await gitlab.getLatestPipelineByRef(project, branch)
        if (!pipeline) continue

        // Check trigger type
        if (!matchesPipelineTrigger(pipeline.status, rule.trigger)) continue

        // Throttle check
        const key = `pipeline:${project}:${pipeline.ref}:${pipeline.id}:${rule.trigger}`
        if (throttled(key, cooldown)) continue

        // Format the message
        const message = await formatPipelineAlert(rule, project, pipeline, gitlab)
        ctx.followup?.(message)
      }
    }
  }
}

function matchesPipelineTrigger(status: string, trigger: string): boolean {
  return status === trigger
}

async function formatPipelineAlert(
  rule: PipelineAlertRuleConfig,
  project: string,
  pipeline: any,
  gitlab: any,
): Promise<string> {
  const lines: string[] = []
  lines.push(`🔔 Pipeline ${rule.trigger}: ${project} @ ${pipeline.ref}`)
  lines.push(`   Pipeline #${pipeline.id} | ${pipeline.status}`)

  if (pipeline.webUrl) {
    lines.push(`   ${pipeline.webUrl}`)
  }

  // Include failed jobs if requested
  if (rule.includeFailedJobs) {
    try {
      const jobs: any[] = await gitlab.listPipelineJobs(project, pipeline.id)
      const failed = jobs.filter((j) => j.status === 'failed')
      if (failed.length > 0) {
        lines.push('   Failed jobs:')
        for (const job of failed) {
          lines.push(`     - ${job.name} (${job.status})`)
        }
      }
    } catch {
      // Non-fatal: omit jobs on error
    }
  }

  if (rule.message) {
    lines.push(`   ${rule.message}`)
  }

  return lines.join('\n')
}

// ─── Pod Alerts ───────────────────────────────────────────────────────────────

export async function checkPodAlerts(
  ctx: DshContext,
  k8s: any,
  rules: PodAlertRuleConfig[],
  config: MonitorConfig,
): Promise<void> {
  const cooldown = config.cooldownSec ?? 300
  const clusters: string[] = k8s.listClusters()

  for (const cluster of clusters) {
    for (const rule of rules) {
      // Filter: only process clusters matching this rule
      if (rule.clusters && !rule.clusters.includes(cluster)) continue

      // Determine namespaces to check
      const namespaces: string[] =
        rule.namespaces ?? [k8s.getDefaultNamespace(cluster)]

      for (const namespace of namespaces) {
        const pods: any[] = await k8s.getPodList(cluster, namespace)
        for (const pod of pods) {
          await evaluatePodRule(ctx, k8s, rule, config, cluster, namespace, pod, cooldown)
        }
      }
    }
  }
}

async function evaluatePodRule(
  ctx: DshContext,
  k8s: any,
  rule: PodAlertRuleConfig,
  config: MonitorConfig,
  cluster: string,
  namespace: string,
  pod: any,
  cooldown: number,
): Promise<void> {
  let triggered = false
  let detail = ''

  switch (rule.trigger) {
    case 'crash':
      if (pod.phase === 'Failed') {
        triggered = true
        detail = 'Pod crashed (phase: Failed)'
      }
      break

    case 'restart': {
      const threshold = rule.restartThreshold ?? 3
      if (pod.restartCount > threshold) {
        triggered = true
        detail = `Pod restarts exceeded threshold (${pod.restartCount} > ${threshold})`
      }
      break
    }

    case 'pending_stuck': {
      const timeoutSec = rule.pendingTimeoutSec ?? 300
      if (pod.phase === 'Pending') {
        // Use startTime if available; otherwise treat as pending since creation
        const startMs = pod.startTime
          ? new Date(pod.startTime).getTime()
          : undefined
        if (startMs !== undefined) {
          const pendingMs = Date.now() - startMs
          if (pendingMs > timeoutSec * 1000) {
            triggered = true
            detail = `Pod stuck in Pending for ${Math.round(pendingMs / 1000)}s (timeout: ${timeoutSec}s)`
          }
        }
      }
      break
    }
  }

  if (!triggered) return

  // Throttle check
  const key = `pod:${cluster}:${namespace}:${pod.name}:${rule.trigger}`
  if (throttled(key, cooldown)) return

  // Format the alert
  const message = formatPodAlert(rule, cluster, namespace, pod, detail)
  ctx.followup?.(message)
}

function formatPodAlert(
  rule: PodAlertRuleConfig,
  cluster: string,
  namespace: string,
  pod: any,
  detail: string,
): string {
  const lines: string[] = []
  lines.push(`🐳 Pod alert [${rule.trigger}]: ${pod.name} in ${cluster}/${namespace}`)
  lines.push(`   ${detail}`)
  lines.push(`   Phase: ${pod.phase} | Restarts: ${pod.restartCount}`)

  if (rule.message) {
    lines.push(`   ${rule.message}`)
  }

  return lines.join('\n')
}
