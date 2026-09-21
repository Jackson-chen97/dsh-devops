/**
 * @jacksonchen/dsh-devops — Plugin entry point.
 * Note: DSH host will handle TypeScript compilation via tsx at runtime.
 */

// Re-export main functionality (types handled by .ts files)
export { parseConfig } from './config.ts';
export { Config } from './config.ts';
export { registerGitLab } from './gitlab/index.ts';
export { registerK8s } from './k8s/index.ts';
export { registerTools } from './tools/index.ts';
export { registerWebhook } from './webhook/index.ts';
export { startMonitor } from './monitor/index.ts';
export { registerDevopsApi } from './api.ts';
export { createLazyGitLabService, createLazyK8sService } from './runtime/lazy.ts';

export const name = 'dsh-devops';

export async function apply(ctx, cfg) {
  // Use dynamic import for TypeScript support at runtime
  const mod = await import('./index.ts');
  return mod.apply(ctx, cfg);
}
