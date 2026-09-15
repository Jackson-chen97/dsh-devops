export class GitLabError extends Error {
    status;
    code;
    constructor(status, code, message){
        super(message), this.status = status, this.code = code;
        this.name = 'GitLabError';
    }
}
function mapMR(raw) {
    return {
        iid: raw.iid,
        title: raw.title,
        state: raw.state,
        sourceBranch: raw.source_branch,
        targetBranch: raw.target_branch,
        webUrl: raw.web_url,
        approvals: {
            approved: raw.approved === true,
            required: raw.approvals_required ?? 0,
            given: raw.approvals_count ?? 0
        }
    };
}
function mapPipeline(raw) {
    return {
        id: raw.id,
        status: raw.status,
        ref: raw.ref,
        sha: raw.sha,
        webUrl: raw.web_url,
        createdAt: raw.created_at,
        finishedAt: raw.finished_at
    };
}
function mapJob(raw) {
    return {
        id: raw.id,
        name: raw.name,
        status: raw.status,
        stage: raw.stage,
        duration: raw.duration
    };
}
function mapTag(raw) {
    return {
        name: raw.name,
        target: raw.target,
        message: raw.message,
        commitId: raw.commit?.id ?? ''
    };
}
export class GitLabClient {
    baseUrl;
    projectPath;
    token;
    projectUrl;
    constructor(baseUrl, projectPath, token){
        this.baseUrl = baseUrl;
        this.projectPath = projectPath;
        this.token = token;
        this.projectUrl = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectPath)}`;
    }
    async request(method, path, body) {
        const url = path.startsWith('http') ? path : `${this.projectUrl}${path}`;
        const headers = {
            'PRIVATE-TOKEN': this.token,
            'Content-Type': 'application/json'
        };
        const res = await fetch(url, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined
        });
        if (!res.ok) {
            let code = 'unknown';
            let message = `GitLab API error ${res.status}`;
            try {
                const err = await res.json();
                code = err.message || err.error || err.error_description || 'unknown';
                message = err.message || err.error || err.error_description || message;
            } catch  {}
            throw new GitLabError(res.status, code, message);
        }
        if (res.status === 204) return undefined;
        return await res.json();
    }
    async createMR(sourceBranch, targetBranch, title, description) {
        const raw = await this.request('POST', '/merge_requests', {
            source_branch: sourceBranch,
            target_branch: targetBranch,
            title,
            ...description !== undefined ? {
                description
            } : {}
        });
        return mapMR(raw);
    }
    async approveMR(mrIid) {
        await this.request('POST', `/merge_requests/${mrIid}/approve`);
    }
    async requestChanges(mrIid, comment) {
        await this.request('POST', `/merge_requests/${mrIid}/notes`, {
            body: `🔴 Changes requested: ${comment}`
        });
    }
    async commentMR(mrIid, body) {
        await this.request('POST', `/merge_requests/${mrIid}/notes`, {
            body
        });
    }
    async listMRs() {
        const raw = await this.request('GET', '/merge_requests?state=opened');
        return raw.map(mapMR);
    }
    async createTag(name, ref, message) {
        const raw = await this.request('POST', '/repository/tags', {
            tag_name: name,
            ref,
            ...message !== undefined ? {
                message
            } : {}
        });
        return mapTag(raw);
    }
    async getPipeline(pipelineId) {
        const raw = await this.request('GET', `/pipelines/${pipelineId}`);
        return mapPipeline(raw);
    }
    async getLatestPipelineByRef(ref) {
        const raw = await this.request('GET', `/pipelines?ref=${encodeURIComponent(ref)}&order_by=id&sort=desc&per_page=1`);
        if (!Array.isArray(raw) || raw.length === 0) return undefined;
        return mapPipeline(raw[0]);
    }
    async listPipelineJobs(pipelineId) {
        const raw = await this.request('GET', `/pipelines/${pipelineId}/jobs`);
        return raw.map(mapJob);
    }
    async getJobLog(jobId) {
        const url = `${this.projectUrl}/jobs/${jobId}/log`;
        const res = await fetch(url, {
            headers: {
                'PRIVATE-TOKEN': this.token
            }
        });
        if (!res.ok) {
            throw new GitLabError(res.status, 'unknown', `Failed to fetch job log: ${res.status}`);
        }
        return res.text();
    }
}
