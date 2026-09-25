/**
 * Monitor module entry point — starts the polling loop for alert checks.
 */

import type { MonitorConfig } from '../config.ts'
import { checkPipelineAlerts, checkPodAlerts } from '../core/monitor/rules.ts'
import { clearThrottle } from '../core/monitor/throttle.ts'

interface DshContext {
  effect(execute: () => any, label?: string): any
  followup?(message: string): void
  log?: { warn(...args: unknown[]): void; error(...args: unknown[]): void }
}

/**
 * Starts the monitor polling loop.
 *
 * @param ctx       Plugin context (effect, followup, log)
 * @param config    Monitor configuration
 * @param services  Registered services: { gitlab?, k8s? }
 */
export function startMonitor(
  ctx: DshContext,
  config: MonitorConfig,
  services: { gitlab?: any; k8s?: any },
): void {
  const intervalMs = (config.pollIntervalSec ?? 60) * 1000

  ctx.effect(() => {
    const timer = setInterval(async () => {
      try {
        // Pipeline alerts
        if (config.pipeline?.length && services.gitlab) {
          await checkPipelineAlerts(ctx, services.gitlab, config.pipeline, config)
        }

        // Pod alerts
        if (config.pod?.length && services.k8s) {
          await checkPodAlerts(ctx, services.k8s, config.pod, config)
        }
      } catch (err: any) {
        console.error('[dsh-devops:monitor] tick error:', err?.message ?? err)
      }
    }, intervalMs)

    // Cleanup: clear interval + throttle state on unload
    return () => {
      clearInterval(timer)
      clearThrottle()
    }
  }, 'dsh-devops:monitor')
}
