import { GitLabClient } from './client.js';
export class GitLabRouter {
    baseUrl;
    defaultProject;
    clients;
    constructor(baseUrl, projects, defaultProject){
        this.baseUrl = baseUrl;
        this.defaultProject = defaultProject;
        this.clients = new Map();
        for (const p of projects){
            const token = p.token ?? (p.tokenEnv ? process.env[p.tokenEnv] : undefined);
            if (!token) {
                throw new Error(`[dsh-devops] GitLab project "${p.id}": no direct token and environment variable "${p.tokenEnv}" is not set`);
            }
            this.clients.set(p.id, new GitLabClient(baseUrl, p.path, token));
        }
    }
    resolve(id) {
        const key = id ?? this.defaultProject;
        if (!key) {
            throw new Error('[dsh-devops] GitLab: no project id provided and no defaultProject configured');
        }
        const client = this.clients.get(key);
        if (!client) {
            const available = [
                ...this.clients.keys()
            ].join(', ');
            throw new Error(`[dsh-devops] GitLab: unknown project id "${key}". Available: ${available}`);
        }
        return client;
    }
    list() {
        return [
            ...this.clients.keys()
        ];
    }
}
