import { registerGitLabTools } from './gitlab.js';
import { registerK8sTools } from './k8s.js';
function pruneUndefined(value) {
    if (value === undefined || typeof value === 'function') return null;
    if (Array.isArray(value)) return value.map(pruneUndefined);
    if (value && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value))out[k] = pruneUndefined(v);
        return out;
    }
    return value;
}
export function cleanTool(tool) {
    const execute = tool.execute.bind(tool);
    tool.execute = async (args)=>pruneUndefined(await execute(args));
    return tool;
}
export function registerTools(ctx, services) {
    if (services.gitlab) registerGitLabTools(ctx, services.gitlab);
    if (services.k8s) registerK8sTools(ctx, services.k8s);
}
export { registerGitLabTools, registerK8sTools };
