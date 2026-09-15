import { checkPipelineAlerts, checkPodAlerts } from './rules.js';
import { clearThrottle } from './throttle.js';
export function startMonitor(ctx, config, services) {
    const intervalMs = (config.pollIntervalSec ?? 60) * 1000;
    ctx.effect(()=>{
        const timer = setInterval(async ()=>{
            try {
                if (config.pipeline?.length && services.gitlab) {
                    await checkPipelineAlerts(ctx, services.gitlab, config.pipeline, config);
                }
                if (config.pod?.length && services.k8s) {
                    await checkPodAlerts(ctx, services.k8s, config.pod, config);
                }
            } catch (err) {
                ctx.log?.error('[dsh-devops:monitor] tick error:', err?.message ?? err);
            }
        }, intervalMs);
        return ()=>{
            clearInterval(timer);
            clearThrottle();
        };
    }, 'dsh-devops:monitor');
}
