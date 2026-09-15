const POLL_INTERVAL_MS = 30_000;
const MAX_DURATION_MS = 30 * 60 * 1000;
export function startPipelineWatch(ctx, gitlab, project, branch) {
    const resolvedProject = project ?? gitlab.listProjects()[0];
    ctx.effect(()=>{
        const startTime = Date.now();
        let stopped = false;
        const timer = setInterval(async ()=>{
            if (stopped) return;
            try {
                const pipeline = await gitlab.getLatestPipelineByRef(resolvedProject, branch);
                if (!pipeline) return;
                if (pipeline.status === 'success') {
                    stopped = true;
                    ctx.followup?.(`✅ Pipeline #${pipeline.id} 在 ${branch} 成功: ${pipeline.webUrl}`);
                    clearInterval(timer);
                } else if (pipeline.status === 'failed' || pipeline.status === 'canceled') {
                    stopped = true;
                    const jobs = await gitlab.listPipelineJobs(resolvedProject, pipeline.id);
                    const failed = jobs.filter((j)=>j.status === 'failed').map((j)=>j.name);
                    ctx.followup?.(`⚠️ Pipeline #${pipeline.id} 在 ${branch} ${pipeline.status}! ` + `失败: ${failed.join(', ') || 'N/A'}\n${pipeline.webUrl}`);
                    clearInterval(timer);
                } else if (Date.now() > startTime + MAX_DURATION_MS) {
                    stopped = true;
                    ctx.followup?.(`⏰ Pipeline watch (${branch}) 超时停止`);
                    clearInterval(timer);
                }
            } catch (err) {
                if (isRecoverable(err)) return;
                stopped = true;
                ctx.followup?.(`⚠️ Pipeline watch (${branch}) 中断: ${err.message}`);
                clearInterval(timer);
            }
        }, POLL_INTERVAL_MS);
        return ()=>{
            stopped = true;
            clearInterval(timer);
        };
    }, 'dsh-devops:pipeline-watch');
}
function isRecoverable(err) {
    if (!err) return false;
    const status = err.status ?? err.code;
    if (typeof status === 'number' && status >= 500 && status < 600) return true;
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') return true;
    if (err.message?.includes('fetch failed')) return true;
    return false;
}
