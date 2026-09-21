/**
 * Pipeline watch: polls pipeline status and follows up on completion/failure.
 *
 * Called automatically after gitlab_mr_create, or manually via gitlab_pipeline_watch.
 */

const POLL_INTERVAL_MS = 30_000
const MAX_DURATION_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Start a pipeline watch for a given project + branch.
 *
 * Polls every 30 seconds until:
 * - Pipeline succeeds → followup success message + stop
 * - Pipeline fails/cancels → followup failure message (with failed jobs) + stop
 * - Max duration exceeded → followup timeout + stop
 * - Plugin unload → cleanup via ctx.effect
 */
export function startPipelineWatch(
  ctx: any,
  gitlab: any,
  project: string | undefined,
  branch: string,
): void {
  const resolvedProject = project ?? gitlab.listProjects()[0]

  ctx.effect(() => {
    const startTime = Date.now()
    let stopped = false

    const timer = setInterval(async () => {
      if (stopped) return
      try {
        const pipeline = await gitlab.getLatestPipelineByRef(resolvedProject, branch)
        if (!pipeline) return // no pipeline found yet

        if (pipeline.status === 'success') {
          stopped = true
          ctx.followup?.(`✅ Pipeline #${pipeline.id} 在 ${branch} 成功: ${pipeline.webUrl}`)
          clearInterval(timer)
        } else if (pipeline.status === 'failed' || pipeline.status === 'canceled') {
          stopped = true
          const jobs = await gitlab.listPipelineJobs(resolvedProject, pipeline.id)
          const failed = jobs.filter((j: any) => j.status === 'failed').map((j: any) => j.name)
          ctx.followup?.(
            `⚠️ Pipeline #${pipeline.id} 在 ${branch} ${pipeline.status}! ` +
              `失败: ${failed.join(', ') || 'N/A'}\n${pipeline.webUrl}`,
          )
          clearInterval(timer)
        } else if (Date.now() > startTime + MAX_DURATION_MS) {
          stopped = true
          ctx.followup?.(`⏰ Pipeline watch (${branch}) 超时停止`)
          clearInterval(timer)
        }
      } catch (err: any) {
        // Transient network errors: retry on next poll
        if (isRecoverable(err)) return
        stopped = true
        ctx.followup?.(`⚠️ Pipeline watch (${branch}) 中断: ${err.message}`)
        clearInterval(timer)
      }
    }, POLL_INTERVAL_MS)

    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, 'dsh-devops:pipeline-watch')
}

/**
 * Check if an error is a transient/recoverable one (network, timeout, 5xx).
 */
function isRecoverable(err: any): boolean {
  if (!err) return false
  const status = err.status ?? err.code
  if (typeof status === 'number' && status >= 500 && status < 600) return true
  if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') return true
  if (err.message?.includes('fetch failed')) return true
  return false
}
