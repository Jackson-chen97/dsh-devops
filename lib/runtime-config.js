import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
const CONFIG_FILE = join(homedir(), '.dsh-devops', 'config.json');
export const NOT_CONFIGURED_MSG = '[dsh-devops] Not configured yet — open DSH Settings → DevOps, add the connection info, and save.';
function readConfigJson() {
    try {
        if (!existsSync(CONFIG_FILE)) return null;
        return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
    } catch  {
        return null;
    }
}
function normalizeConfigJson(raw) {
    if (!raw || typeof raw !== 'object') return raw;
    const out = JSON.parse(JSON.stringify(raw));
    const gl = out.gitlab || {};
    if (!Array.isArray(gl.servers) && gl.baseUrl) {
        const legacyProject = Array.isArray(gl.projects) ? gl.projects[0] : null;
        gl.servers = [
            {
                id: 's1',
                label: 'GitLab',
                baseUrl: gl.baseUrl,
                token: gl.token || '',
                projectPath: legacyProject?.path || '',
                branch: legacyProject?.defaultBranch || ''
            }
        ];
    }
    const k8s = out.k8s || {};
    if (!Array.isArray(k8s.kubeconfigs) && k8s.kubeconfigPath) {
        k8s.kubeconfigs = [
            {
                id: 'k1',
                path: k8s.kubeconfigPath,
                context: k8s.context || '',
                namespace: k8s.namespace || ''
            }
        ];
    }
    out.gitlab = gl;
    out.k8s = k8s;
    return out;
}
export function resolveGitLabConfig(cordisRaw) {
    const raw = cordisRaw && typeof cordisRaw === 'object' ? cordisRaw : {};
    if (raw.gitlab && typeof raw.gitlab === 'object' && raw.gitlab.baseUrl) {
        return raw.gitlab;
    }
    const file = normalizeConfigJson(readConfigJson());
    const gl = file?.gitlab || {};
    const servers = Array.isArray(gl.servers) ? gl.servers : [];
    const active = servers.find((s)=>s.id === gl.activeServerId) || servers[0];
    if (!active?.baseUrl || !active?.token || !active?.projectPath) return null;
    const usable = servers.filter((s)=>s.baseUrl && s.token);
    return {
        baseUrl: active.baseUrl,
        token: active.token,
        defaultProject: active.id,
        projects: usable.map((s)=>({
                id: s.id,
                path: s.projectPath || '',
                token: s.token,
                defaultBranch: s.branch || undefined
            }))
    };
}
export function resolveK8sConfig(cordisRaw) {
    const raw = cordisRaw && typeof cordisRaw === 'object' ? cordisRaw : {};
    if (raw.k8s && typeof raw.k8s === 'object' && Array.isArray(raw.k8s.kubeconfigs) && raw.k8s.kubeconfigs.length) {
        return raw.k8s;
    }
    const file = normalizeConfigJson(readConfigJson());
    const k8s = file?.k8s || {};
    const kcList = Array.isArray(k8s.kubeconfigs) ? k8s.kubeconfigs : [];
    const usable = kcList.filter((k)=>k.path);
    if (!usable.length) return null;
    const active = usable.find((k)=>k.id === k8s.activeKubeconfigId) || usable[0];
    return {
        kubeconfigs: usable.map((k)=>({
                id: k.id,
                path: k.path,
                context: k.context || undefined,
                namespace: k.namespace || undefined
            })),
        defaultContext: active.id
    };
}
