import Schema from "schemastery";
import { request } from "node:https";
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { execFile } from "node:child_process";
//#region src/config.ts
/**
* Plugin configuration: Schemastery schema + cross-field validation.
*
* Schemastery schema: Cordis validates the user's `config` against this at
* load time and fills schema defaults before calling `apply`. Cross-field
* business rules (webhook requires gitlab, monitor requires gitlab or k8s)
* are enforced by `parseConfig` as a second gate.
*
* IMPORTANT: Do NOT use `.required()` on any field in this schema.
* Schemastery validates `.required()` sub-fields even when the parent object
* is absent from the input, causing boot failures for unconfigured plugins.
* Actual field-presence validation is handled by `parseConfig()` (the "second
* gate") which only enforces required fields when their section IS present.
*/
const Config = Schema.object({
	gitlab: Schema.object({
		baseUrl: Schema.string(),
		token: Schema.string(),
		defaultProject: Schema.string(),
		projects: Schema.array(Schema.object({
			id: Schema.string(),
			path: Schema.string(),
			defaultBranch: Schema.string()
		}))
	}),
	k8s: Schema.object({
		kubeconfigs: Schema.array(Schema.object({
			id: Schema.string(),
			path: Schema.string(),
			context: Schema.string(),
			namespace: Schema.string()
		})),
		defaultContext: Schema.string(),
		defaultNamespace: Schema.string()
	}),
	webhook: Schema.object({
		secret: Schema.string(),
		projectPaths: Schema.array(Schema.string()),
		quietEvents: Schema.array(Schema.string())
	}),
	monitor: Schema.object({
		pollIntervalSec: Schema.number().default(30),
		cooldownSec: Schema.number().default(300),
		pipeline: Schema.array(Schema.object({
			projects: Schema.array(Schema.string()),
			branches: Schema.array(Schema.string()),
			trigger: Schema.union([
				"failed",
				"canceled",
				"success"
			]),
			message: Schema.string(),
			includeFailedJobs: Schema.boolean()
		})),
		pod: Schema.array(Schema.object({
			clusters: Schema.array(Schema.string()),
			namespaces: Schema.array(Schema.string()),
			trigger: Schema.union([
				"crash",
				"restart",
				"pending_stuck"
			]),
			restartThreshold: Schema.number(),
			pendingTimeoutSec: Schema.number(),
			message: Schema.string(),
			includeLogs: Schema.boolean()
		}))
	})
});
/**
* Parse and validate the raw plugin config.
* Throws a descriptive error on missing/invalid fields.
*
* Called by `apply()` as a second gate after Cordis schema validation,
* enforcing cross-field business rules that cannot be expressed in a
* flat Schemastery schema.
*/
function parseConfig(raw) {
	if (!raw || typeof raw !== "object") throw new Error("[dsh-devops] config must be an object");
	const config = { ...raw };
	if (config.gitlab && !config.gitlab.baseUrl) delete config.gitlab;
	if (config.k8s && (!config.k8s.kubeconfigs || config.k8s.kubeconfigs.length === 0)) delete config.k8s;
	if (config.webhook && !config.webhook.secret) delete config.webhook;
	if (config.monitor) {
		if (!((config.monitor.pipeline?.length ?? 0) > 0 || (config.monitor.pod?.length ?? 0) > 0)) delete config.monitor;
	}
	if (config.gitlab) {
		if (!config.gitlab.baseUrl) throw new Error("[dsh-devops] gitlab.baseUrl is required when gitlab section is present");
		if (!config.gitlab.token) throw new Error("[dsh-devops] gitlab.token is required when gitlab section is present");
		if (!config.gitlab.projects?.length) throw new Error("[dsh-devops] gitlab.projects must be a non-empty array");
		for (const p of config.gitlab.projects) {
			if (!p.id) throw new Error("[dsh-devops] gitlab project must have an id");
			if (!p.path) throw new Error(`[dsh-devops] gitlab project "${p.id}" must have a path`);
		}
	}
	if (config.k8s) {
		if (!config.k8s.kubeconfigs?.length) throw new Error("[dsh-devops] k8s.kubeconfigs must be a non-empty array when k8s section is present");
		for (const ref of config.k8s.kubeconfigs) {
			if (!ref.id) throw new Error("[dsh-devops] k8s kubeconfig ref must have an id");
			if (!ref.path) throw new Error(`[dsh-devops] k8s kubeconfig "${ref.id}" must have a path`);
		}
	}
	if (config.webhook) {
		if (!config.webhook.secret) throw new Error("[dsh-devops] webhook.secret is required");
		if (!config.gitlab) throw new Error("[dsh-devops] webhook requires gitlab section to be configured");
	}
	if (config.monitor) {
		if (!config.gitlab && !config.k8s) throw new Error("[dsh-devops] monitor requires at least gitlab or k8s to be configured");
	}
	return config;
}
//#endregion
//#region src/core/http.ts
/**
* HTTP helpers shared by the GitLab/K8s clients and the RPC endpoints.
*
* `requestWithTls` exists because native `fetch` cannot pin a per-request CA
* (needed for kubeconfig `certificate-authority-data`) — those requests go
* through `node:https` with the cluster CA pinned (or verification skipped on
* `insecure-skip-tls-verify`).
*/
/** Request via node:https with an optional pinned CA (fetch cannot set a per-request CA). */
function httpsRequest(url, opts) {
	return new Promise((resolve, reject) => {
		const u = new URL(url);
		const req = request({
			hostname: u.hostname,
			port: u.port || 443,
			path: `${u.pathname}${u.search}`,
			method: opts.method ?? "GET",
			headers: opts.body ? {
				...opts.headers,
				"Content-Length": Buffer.byteLength(opts.body)
			} : opts.headers,
			...opts.insecureSkipTlsVerify ? { rejectUnauthorized: false } : opts.ca ? {
				ca: opts.ca,
				rejectUnauthorized: true,
				checkServerIdentity: () => void 0
			} : {}
		}, (upstream) => {
			const chunks = [];
			upstream.on("data", (c) => chunks.push(c));
			upstream.on("end", () => {
				const body = Buffer.concat(chunks).toString("utf8");
				const status = upstream.statusCode ?? 0;
				resolve(new Response(status === 204 || status === 304 ? null : body, {
					status,
					statusText: upstream.statusMessage ?? ""
				}));
			});
		});
		req.on("error", reject);
		opts.signal?.addEventListener("abort", () => req.destroy(/* @__PURE__ */ new Error("AbortError")));
		if (opts.body) req.write(opts.body);
		req.end();
	});
}
/**
* Fetch with timeout via AbortController.
* When `tls` is given (a resolved kubeconfig context), the cluster CA is
* pinned (or verification skipped on insecureSkipTlsVerify) via node:https.
* String bodies work on both paths (`body` for fetch, `bodyText` for the
* node:https call — either form is accepted).
*/
async function requestWithTimeout(url, init = {}) {
	const ms = init.timeoutMs ?? 5e3;
	const bodyText = init.bodyText ?? (typeof init.body === "string" ? init.body : void 0);
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), ms);
	try {
		if (init.tls?.caData || init.tls?.insecureSkipTlsVerify) return await httpsRequest(url, {
			method: init.method,
			headers: init.headers,
			body: bodyText,
			signal: ctrl.signal,
			ca: init.tls.caData ? Buffer.from(init.tls.caData, "base64") : void 0,
			insecureSkipTlsVerify: init.tls.insecureSkipTlsVerify
		});
		return await fetch(url, {
			method: init.method,
			headers: init.headers,
			body: init.body,
			signal: ctrl.signal
		});
	} finally {
		clearTimeout(timer);
	}
}
//#endregion
//#region src/core/gitlab/client.ts
var GitLabError = class extends Error {
	status;
	code;
	constructor(status, code, message) {
		super(message);
		this.status = status;
		this.code = code;
		this.name = "GitLabError";
	}
};
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
		},
		author: raw.author?.username ?? "unknown",
		createdAt: raw.created_at ?? "",
		updatedAt: raw.updated_at ?? "",
		mergeStatus: raw.merge_status ?? "",
		workInProgress: !!raw.work_in_progress,
		draft: !!raw.draft,
		approvalsBeforeMerge: raw.approvals_before_merge ?? null
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
		finishedAt: raw.finished_at,
		updatedAt: raw.updated_at ?? "",
		duration: raw.duration ?? null
	};
}
function mapJob(raw) {
	return {
		id: raw.id,
		name: raw.name,
		status: raw.status,
		stage: raw.stage,
		duration: raw.duration,
		failureReason: raw.failure_reason || ""
	};
}
function mapTag(raw) {
	return {
		name: raw.name,
		target: raw.target,
		message: raw.message ?? raw.release?.message ?? "",
		commitId: raw.commit?.id ?? "",
		createdAt: raw.commit?.created_at ?? ""
	};
}
/** Strip ANSI escape codes and gitlab-runner control lines from a raw job trace. */
function cleanJobLog(s) {
	return s.replace(new RegExp(String.fromCharCode(27) + String.fromCharCode(91) + "[0-9;?]*[a-zA-Z]", "g"), "").split("\n").filter((l) => !/^section_(start|end):/.test(l) && !/^get:job:/.test(l)).join("\n");
}
var GitLabClient = class {
	baseUrl;
	token;
	constructor(baseUrl, token) {
		this.baseUrl = baseUrl;
		this.token = token;
	}
	get apiBase() {
		return `${this.baseUrl.replace(/\/+$/, "")}/api/v4`;
	}
	projectApi(projectPath) {
		return `${this.apiBase}/projects/${encodeURIComponent(projectPath)}`;
	}
	/**
	* Send a request to the GitLab API and parse the JSON response.
	* Throws {@link GitLabError} on non-2xx status codes.
	*/
	async request(method, path, body, timeoutMs = 1e4) {
		const res = await requestWithTimeout(path.startsWith("http") ? path : `${this.apiBase}${path}`, {
			method,
			headers: {
				"PRIVATE-TOKEN": this.token,
				...body !== void 0 ? { "Content-Type": "application/json" } : {}
			},
			...body !== void 0 ? { body: JSON.stringify(body) } : {},
			timeoutMs
		});
		if (!res.ok) {
			let code = "unknown";
			let message = `GitLab API error ${res.status}`;
			try {
				const err = await res.json();
				code = err.message || err.error || err.error_description || "unknown";
				message = err.message || err.error || err.error_description || message;
			} catch {}
			throw new GitLabError(res.status, code, message);
		}
		if (res.status === 204) return void 0;
		return await res.json();
	}
	/** Validate the token: GET /user. */
	async getCurrentUser() {
		return this.request("GET", "/user");
	}
	/** Projects visible to the token, newest activity first. */
	async listProjects(search) {
		const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
		return (await this.request("GET", `/projects?membership=true&per_page=100&order_by=last_activity_at&sort=desc${searchParam}`, void 0, 2e4)).map((p) => ({
			id: String(p.id),
			name: p.name,
			path: p.path_with_namespace,
			defaultBranch: p.default_branch
		}));
	}
	/** Resolve usernames to user ids (best-effort) for reviewer_ids. */
	async resolveUserIds(names) {
		const ids = [];
		for (const name of names) try {
			const users = await this.request("GET", `/users?search=${encodeURIComponent(name)}&per_page=5`, void 0, 8e3);
			const u = users.find((x) => x.username.toLowerCase() === name.toLowerCase()) ?? users[0];
			if (u?.id) ids.push(u.id);
		} catch {}
		return ids;
	}
	/** List repository branches (per_page=100), optional server-side search. */
	async listBranches(projectPath, search) {
		const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
		return (await this.request("GET", `/projects/${encodeURIComponent(projectPath)}/repository/branches?per_page=100${searchParam}`, void 0, 12e3)).map((b) => ({
			name: b.name,
			isDefault: b.default === true
		}));
	}
	/** List project members (for the MR reviewer dropdown). */
	async listMembers(projectPath, search) {
		const searchParam = search ? `&query=${encodeURIComponent(search)}` : "";
		return (await this.request("GET", `/projects/${encodeURIComponent(projectPath)}/members/all?per_page=100${searchParam}`, void 0, 12e3)).map((m) => ({
			username: m.username,
			name: m.name
		}));
	}
	/** Latest commit on a branch (for MR description auto-fill). */
	async getLastCommit(projectPath, branch) {
		const c = (await this.request("GET", `/projects/${encodeURIComponent(projectPath)}/repository/commits?ref_name=${encodeURIComponent(branch)}&per_page=1`, void 0, 12e3))[0];
		if (!c) return null;
		return {
			shortId: c.short_id ?? "",
			title: c.title ?? "",
			message: (c.message ?? "").trim(),
			author: c.author_name ?? "",
			date: c.committed_date ?? ""
		};
	}
	/** Create a merge request. */
	async createMR(projectPath, sourceBranch, targetBranch, title, description, reviewers) {
		const body = {
			source_branch: sourceBranch,
			target_branch: targetBranch,
			title,
			remove_source_branch: true,
			...description !== void 0 ? { description } : {}
		};
		if (reviewers) {
			const names = reviewers.split(/[,\uFF0C\s]+/).map((s) => s.trim().replace(/^@/, "")).filter(Boolean);
			const ids = await this.resolveUserIds(names);
			if (ids.length) body["reviewer_ids"] = ids;
		}
		return mapMR(await this.request("POST", `/projects/${encodeURIComponent(projectPath)}/merge_requests`, body));
	}
	/** Approve a merge request. */
	async approveMR(projectPath, mrIid) {
		return { approvalsBeforeMerge: (await this.request("POST", `/projects/${encodeURIComponent(projectPath)}/merge_requests/${mrIid}/approve`)).approvals_before_merge ?? null };
	}
	/** Request changes on a merge request (post a review note with a negative verdict). */
	async requestChanges(projectPath, mrIid, comment) {
		await this.request("POST", `/projects/${encodeURIComponent(projectPath)}/merge_requests/${mrIid}/notes`, { body: ` Changes requested: ${comment}` });
	}
	/** Post a comment (note) on a merge request. */
	async commentMR(projectPath, mrIid, body) {
		await this.request("POST", `/projects/${encodeURIComponent(projectPath)}/merge_requests/${mrIid}/notes`, { body });
	}
	/** List open merge requests. */
	async listMRs(projectPath, state = "opened", perPage = 20) {
		return (await this.request("GET", `/projects/${encodeURIComponent(projectPath)}/merge_requests?per_page=${perPage}&order_by=updated_at&sort=desc&state=${encodeURIComponent(state)}`)).map(mapMR);
	}
	/** Close / reopen a merge request. */
	async setMRState(projectPath, mrIid, action) {
		return (await this.request("PUT", `/projects/${encodeURIComponent(projectPath)}/merge_requests/${mrIid}`, { state_event: action })).state ?? action;
	}
	/** Create a tag pointing at the given ref (branch, tag, or commit SHA). */
	async createTag(projectPath, name, ref, message) {
		return mapTag(await this.request("POST", `/projects/${encodeURIComponent(projectPath)}/repository/tags`, {
			tag_name: name,
			ref,
			...message !== void 0 ? { message } : {}
		}));
	}
	/** List repository tags (newest first). */
	async listTags(projectPath, perPage = 20) {
		return (await this.request("GET", `/projects/${encodeURIComponent(projectPath)}/repository/tags?per_page=${perPage}&order_by=updated&sort=desc`)).map(mapTag);
	}
	/** Get a single pipeline by its numeric id. */
	async getPipeline(projectPath, pipelineId) {
		return mapPipeline(await this.request("GET", `/projects/${encodeURIComponent(projectPath)}/pipelines/${pipelineId}`));
	}
	/** Get the latest pipeline for a given ref (branch/tag); omit for the default branch. */
	async getLatestPipelineByRef(projectPath, ref) {
		const refParam = ref ? `&ref=${encodeURIComponent(ref)}` : "";
		const raw = await this.request("GET", `/projects/${encodeURIComponent(projectPath)}/pipelines?order_by=id&sort=desc&per_page=1${refParam}`);
		if (!Array.isArray(raw) || raw.length === 0) return void 0;
		const mapped = mapPipeline(raw[0]);
		return {
			id: mapped.id,
			status: mapped.status,
			ref: mapped.ref,
			sha: mapped.sha,
			webUrl: mapped.webUrl,
			createdAt: mapped.createdAt,
			finishedAt: mapped.finishedAt
		};
	}
	/** List recent pipelines for a project (newest first). */
	async listPipelines(projectPath, ref, perPage = 10) {
		const refParam = ref ? `&ref=${encodeURIComponent(ref)}` : "";
		const count = Math.min(perPage, 50);
		return (await this.request("GET", `/projects/${encodeURIComponent(projectPath)}/pipelines?per_page=${count}&order_by=id&sort=desc${refParam}`)).map((p) => ({
			...mapPipeline(p),
			sha: p.sha?.slice(0, 8) ?? ""
		}));
	}
	/** Cancel or retry a pipeline. */
	async pipelineAction(projectPath, pipelineId, action) {
		await this.request("POST", `/projects/${encodeURIComponent(projectPath)}/pipelines/${pipelineId}/${action}`);
	}
	/** List all jobs in a pipeline. */
	async listPipelineJobs(projectPath, pipelineId, perPage = 50) {
		return (await this.request("GET", `/projects/${encodeURIComponent(projectPath)}/pipelines/${pipelineId}/jobs?per_page=${perPage}`, void 0, 15e3)).map(mapJob);
	}
	/** Web UI URL of a job (for the "open in GitLab" fallback). */
	jobUrl(projectPath, jobId) {
		return `${this.baseUrl.replace(/\/+$/, "")}/projects/${projectPath}/jobs/${jobId}`;
	}
	/**
	* Fetch the log output of a job. Tries /log (GitLab ≥12), falls back to
	* /trace (GitLab 11.x); returns null with the job URL when unavailable.
	*/
	async getJobLog(projectPath, jobId) {
		const apiBase = `${this.apiBase}/projects/${encodeURIComponent(projectPath)}/jobs/${jobId}`;
		const jobUrl = this.jobUrl(projectPath, jobId);
		let res = await requestWithTimeout(`${apiBase}/log`, {
			headers: { "PRIVATE-TOKEN": this.token },
			timeoutMs: 15e3
		});
		if (res.status === 404) res = await requestWithTimeout(`${apiBase}/trace`, {
			headers: { "PRIVATE-TOKEN": this.token },
			timeoutMs: 15e3
		});
		if (res.status === 404) return {
			logs: "",
			jobUrl,
			unavailable: "missing"
		};
		if (res.status === 202) return {
			logs: "",
			jobUrl,
			unavailable: "running"
		};
		if (!res.ok) throw new GitLabError(res.status, "unknown", `GitLab API error: ${res.status}`);
		return {
			logs: cleanJobLog(await res.text()),
			jobUrl
		};
	}
};
//#endregion
//#region src/core/gitlab/service.ts
/**
* Resolves a {@link GitLabClient} + project path by project id, falling back
* to the configured default project.
*/
var GitLabRouter = class {
	defaultProject;
	entries = /* @__PURE__ */ new Map();
	constructor(baseUrl, projects, defaultProject) {
		this.defaultProject = defaultProject;
		for (const p of projects) {
			const token = p.token ?? (p.tokenEnv ? process.env[p.tokenEnv] : void 0);
			if (!token) throw new Error(`[dsh-devops] GitLab project "${p.id}": no direct token and environment variable "${p.tokenEnv}" is not set`);
			this.entries.set(p.id, {
				client: new GitLabClient(baseUrl, token),
				projectPath: p.path
			});
		}
	}
	/** Resolve the entry for the given project id (or the default project). */
	resolve(id) {
		const key = id ?? this.defaultProject;
		if (!key) throw new Error("[dsh-devops] GitLab: no project id provided and no defaultProject configured");
		const entry = this.entries.get(key);
		if (!entry) {
			const available = [...this.entries.keys()].join(", ");
			throw new Error(`[dsh-devops] GitLab: unknown project id "${key}". Available: ${available}`);
		}
		return entry;
	}
	/** Return all configured project ids. */
	list() {
		return [...this.entries.keys()];
	}
};
/** Build the GitLab service from a parsed config section (eager router). */
function createGitLabService(config) {
	const router = new GitLabRouter(config.baseUrl, config.projects, config.defaultProject);
	return {
		listProjects: () => router.list(),
		createMR: (project, sourceBranch, targetBranch, title, description, reviewers) => {
			const r = router.resolve(project);
			return r.client.createMR(r.projectPath, sourceBranch, targetBranch, title, description, reviewers);
		},
		approveMR: (project, mrIid) => {
			const r = router.resolve(project);
			return r.client.approveMR(r.projectPath, mrIid).then(() => void 0);
		},
		requestChanges: (project, mrIid, comment) => {
			const r = router.resolve(project);
			return r.client.requestChanges(r.projectPath, mrIid, comment);
		},
		commentMR: (project, mrIid, body) => {
			const r = router.resolve(project);
			return r.client.commentMR(r.projectPath, mrIid, body);
		},
		listMRs: (project) => {
			const r = router.resolve(project);
			return r.client.listMRs(r.projectPath);
		},
		createTag: (project, name, ref, message) => {
			const r = router.resolve(project);
			return r.client.createTag(r.projectPath, name, ref, message);
		},
		getPipeline: (project, pipelineId) => {
			const r = router.resolve(project);
			return r.client.getPipeline(r.projectPath, pipelineId);
		},
		getLatestPipelineByRef: (project, ref) => {
			const r = router.resolve(project);
			return r.client.getLatestPipelineByRef(r.projectPath, ref);
		},
		listPipelineJobs: (project, pipelineId) => {
			const r = router.resolve(project);
			return r.client.listPipelineJobs(r.projectPath, pipelineId);
		},
		getJobLog: (project, jobId) => {
			const r = router.resolve(project);
			return r.client.getJobLog(r.projectPath, jobId).then((r) => r.logs);
		}
	};
}
//#endregion
//#region src/core/k8s/client.ts
const CONDITION_TYPES = [
	"Available",
	"Progressing",
	"ReplicaFailure"
];
const CONDITION_STATUSES = [
	"True",
	"False",
	"Unknown"
];
const POD_PHASES = [
	"Pending",
	"Running",
	"Succeeded",
	"Failed",
	"Unknown"
];
/** Type-narrowing membership check for string-union fields coming from the API. */
function inSet(value, set) {
	return set.includes(value);
}
function truncate(s, max = 300) {
	return s.length > max ? `${s.slice(0, max)}…` : s;
}
function toDeploymentCondition(c) {
	const typeStr = c.type ?? "";
	const statusStr = c.status ?? "";
	return {
		type: inSet(typeStr, CONDITION_TYPES) ? typeStr : "Progressing",
		status: inSet(statusStr, CONDITION_STATUSES) ? statusStr : "Unknown",
		reason: c.reason ?? "",
		message: c.message ?? "",
		lastUpdateTime: c.lastUpdateTime ?? ""
	};
}
function toDeploymentStatus(d, fallbackNamespace) {
	const s = d.status ?? {};
	return {
		name: d.metadata?.name ?? "",
		namespace: d.metadata?.namespace ?? fallbackNamespace,
		readyReplicas: s.readyReplicas ?? 0,
		availableReplicas: s.availableReplicas ?? 0,
		desiredReplicas: d.spec?.replicas ?? 0,
		updatedReplicas: s.updatedReplicas ?? 0,
		conditions: (s.conditions ?? []).map(toDeploymentCondition)
	};
}
/**
* Surface a meaningful failure reason: the current waiting state wins, else
* the last terminated reason (e.g. OOMKilled, Error) for crashlooping pods.
*/
function podFailureReason(cs) {
	let reason = "";
	for (const c of cs) if (c.state?.waiting?.reason) reason = c.state.waiting.reason;
	else if (!reason && c.lastState?.terminated?.reason && c.lastState.terminated.reason !== "Completed") reason = c.lastState.terminated.reason;
	return reason;
}
function toPodInfo(p, fallbackNamespace) {
	const s = p.status ?? {};
	const cs = s.containerStatuses ?? [];
	const containers = cs.map((c) => ({
		name: c.name ?? "",
		ready: c.ready ?? false,
		restartCount: c.restartCount ?? 0
	}));
	const phaseStr = s.phase ?? "";
	return {
		name: p.metadata?.name ?? "",
		namespace: p.metadata?.namespace ?? fallbackNamespace,
		phase: inSet(phaseStr, POD_PHASES) ? phaseStr : "Unknown",
		nodeName: s.nodeName ?? p.spec?.nodeName,
		restartCount: containers.reduce((sum, c) => sum + c.restartCount, 0),
		containers,
		startTime: s.startTime,
		reason: podFailureReason(cs)
	};
}
function toK8sEvent(e, fallbackNamespace) {
	return {
		type: e.type === "Warning" ? "Warning" : "Normal",
		reason: e.reason ?? "",
		message: e.message ?? "",
		object: {
			kind: e.involvedObject?.kind ?? "",
			name: e.involvedObject?.name ?? "",
			namespace: e.involvedObject?.namespace ?? fallbackNamespace
		},
		count: e.count,
		lastTimestamp: e.lastTimestamp ?? "",
		eventTime: e.eventTime ?? ""
	};
}
var K8sClient = class {
	ctx;
	server;
	constructor(ctx) {
		this.ctx = ctx;
		this.server = ctx.server.replace(/\/+$/, "");
	}
	/** Authenticated request returning the raw Response. */
	async request(path, opts = {}) {
		const res = await requestWithTimeout(`${this.server}${path}`, {
			method: opts.method ?? "GET",
			headers: {
				Authorization: `Bearer ${this.ctx.token}`,
				Accept: "application/json",
				...opts.body ? { "Content-Type": "application/strategic-merge-patch+json" } : {}
			},
			...opts.body ? { body: opts.body } : {},
			timeoutMs: opts.timeoutMs ?? 1e4,
			tls: {
				caData: this.ctx.caData,
				insecureSkipTlsVerify: this.ctx.insecureSkipTlsVerify
			}
		}).catch((err) => {
			throw new Error(`[k8s] request to ${path} failed: ${err.message}`);
		});
		if (!res.ok) {
			const body = await res.text().catch(() => "");
			throw new Error(`[k8s] ${opts.method ?? "GET"} ${path} failed: ${res.status} ${res.statusText}${body ? ` — ${truncate(body)}` : ""}`);
		}
		return res;
	}
	async getJson(path, timeoutMs) {
		return await (await this.request(path, { timeoutMs })).json();
	}
	/** API server version (connection test). */
	async getVersion() {
		return this.getJson("/version", 5e3);
	}
	/** Names of the active namespaces in the cluster. */
	async listNamespaces() {
		return (await this.getJson("/api/v1/namespaces", 5e3)).items.filter((ns) => ns.status?.phase === "Active" || !ns.status).map((ns) => ns.metadata?.name ?? "").filter(Boolean);
	}
	/** List all deployments in a namespace. */
	async getDeployments(namespace) {
		return (await this.getJson(`/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments`)).items.map((d) => toDeploymentStatus(d, namespace));
	}
	/** Dashboard projection: deployments with image + creation timestamp. */
	async getDeploymentsWithImage(namespace) {
		return (await this.getJson(`/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments`)).items.map((d) => {
			const spec = d.spec ?? {};
			const status = d.status ?? {};
			const image = spec.template?.spec?.containers?.[0]?.image ?? "";
			return {
				name: d.metadata?.name ?? "",
				ready: status.readyReplicas ?? 0,
				replicas: status.replicas ?? spec.replicas ?? 0,
				image,
				imageTag: (image.split(":")[1] ?? "").slice(0, 24),
				updated: d.metadata?.creationTimestamp ?? ""
			};
		});
	}
	/** Get a single deployment by name. */
	async getDeployment(namespace, name) {
		return toDeploymentStatus(await this.getJson(`/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name)}`), namespace);
	}
	/** List all pods in a namespace. */
	async getPods(namespace) {
		return (await this.getJson(`/api/v1/namespaces/${encodeURIComponent(namespace)}/pods`)).items.map((p) => toPodInfo(p, namespace));
	}
	/** List recent events in a namespace, optionally limited. */
	async getEvents(namespace, limit) {
		const q = limit ? `?limit=${limit}` : "";
		return (await this.getJson(`/api/v1/namespaces/${encodeURIComponent(namespace)}/events${q}`)).items.map((e) => toK8sEvent(e, namespace));
	}
	/** Fetch (tail of) a pod's logs. */
	async getPodLogs(namespace, podName, container, tailLines) {
		const params = new URLSearchParams();
		if (container) params.set("container", container);
		if (tailLines != null) params.set("tailLines", String(tailLines));
		const qs = params.toString();
		const path = `/api/v1/namespaces/${encodeURIComponent(namespace)}/pods/${encodeURIComponent(podName)}/log${qs ? `?${qs}` : ""}`;
		return (await this.request(path)).text();
	}
	/** Strategic-merge PATCH on a deployment (image change, restart annotation). */
	async patchDeployment(namespace, name, patch) {
		await this.request(`/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name)}`, {
			method: "PATCH",
			body: JSON.stringify(patch)
		});
	}
	/** Change the image of a deployment's first container (or the named one). */
	async setDeploymentImage(namespace, name, image, container) {
		let containerName = container;
		if (!containerName) {
			containerName = (await this.getJson(`/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name)}`)).spec?.template?.spec?.containers?.[0]?.name;
			if (!containerName) throw new Error("Deployment has no containers");
		}
		await this.patchDeployment(namespace, name, { spec: { template: { spec: { containers: [{
			name: containerName,
			image
		}] } } } });
	}
	/** Restart a deployment (annotate pod template, like kubectl rollout restart). */
	async restartDeployment(namespace, name) {
		await this.patchDeployment(namespace, name, { spec: { template: { metadata: { annotations: { "kubectl.kubernetes.io/restartedAt": (/* @__PURE__ */ new Date()).toISOString() } } } } });
	}
};
//#endregion
//#region src/core/k8s/kubeconfig.ts
/**
* Kubeconfig file parsing.
*
* Reads a kubeconfig (YAML) file, selects a context (explicit name or the
* file's `current-context`), and resolves the referenced cluster + user into a
* single {@link K8sContext} used by the K8s client.
*/
/**
* Expand a leading `~` (or `~/...`) in a path to the user's home directory.
* Paths that do not start with `~` are returned unchanged.
*/
function expandPath(p) {
	if (p === "~") return homedir();
	if (p.startsWith("~/") || p.startsWith("~\\")) return join(homedir(), p.slice(2));
	return p;
}
/**
* Parse a kubeconfig file into a resolved {@link K8sContext}.
*
* @param filePath    Path to the kubeconfig file (supports `~` expansion).
* @param contextName  Context to select. When omitted, the file's
*                    `current-context` is used.
* @throws Descriptive errors when the file/context/cluster/user cannot be found
*         or a required field (server, token) is missing.
*/
function parseKubeconfig(filePath, contextName) {
	const expanded = expandPath(filePath);
	let raw;
	try {
		raw = readFileSync(expanded, "utf8");
	} catch (err) {
		throw new Error(`[k8s] cannot read kubeconfig file at "${expanded}": ${err.message}`);
	}
	let doc;
	try {
		doc = parse(raw);
	} catch (err) {
		throw new Error(`[k8s] failed to parse YAML in kubeconfig "${expanded}": ${err.message}`);
	}
	if (!doc || typeof doc !== "object") throw new Error(`[k8s] kubeconfig "${expanded}" did not parse to a mapping`);
	const clusters = doc.clusters ?? [];
	const users = doc.users ?? [];
	const contexts = doc.contexts ?? [];
	const targetName = contextName ?? doc["current-context"];
	if (!targetName) throw new Error(`[k8s] kubeconfig "${expanded}" has no current-context and no context name was provided`);
	const ctx = contexts.find((c) => c.name === targetName);
	if (!ctx) {
		const available = contexts.map((c) => c.name).filter(Boolean).join(", ") || "none";
		throw new Error(`[k8s] context "${targetName}" not found in kubeconfig "${expanded}" (available: ${available})`);
	}
	const inner = ctx.context ?? {};
	const clusterName = inner["cluster"];
	const userRef = inner["user"];
	if (!clusterName) throw new Error(`[k8s] context "${targetName}" does not reference a cluster`);
	if (!userRef) throw new Error(`[k8s] context "${targetName}" does not reference a user`);
	const clusterEntry = clusters.find((c) => c.name === clusterName);
	if (!clusterEntry) throw new Error(`[k8s] cluster "${clusterName}" (referenced by context "${targetName}") not found in kubeconfig "${expanded}"`);
	const cluster = clusterEntry.cluster ?? {};
	const server = cluster["server"];
	if (!server) throw new Error(`[k8s] cluster "${clusterName}" does not specify a server`);
	const userEntry = users.find((u) => u.name === userRef);
	if (!userEntry) throw new Error(`[k8s] user "${userRef}" (referenced by context "${targetName}") not found in kubeconfig "${expanded}"`);
	const user = userEntry.user ?? {};
	const token = user["token"] ?? user["auth-provider"]?.config?.["access-token"];
	if (!token) throw new Error(`[k8s] user "${userRef}" does not provide a token (looked for "token" and "auth-provider.config.access-token")`);
	return {
		server,
		token,
		caData: cluster["certificate-authority-data"] || void 0,
		insecureSkipTlsVerify: cluster["insecure-skip-tls-verify"] || void 0,
		namespace: inner["namespace"] ?? "default"
	};
}
//#endregion
//#region src/core/k8s/service.ts
/**
* One {@link KubeconfigRef} = one configured cluster (kubeconfig file + the
* context within it). The router parses each ref eagerly and exposes clients
* by their `id`, with a sensible default.
*/
var K8sRouter = class {
	clusters = /* @__PURE__ */ new Map();
	defaultClientId;
	defaultNamespace;
	constructor(kubeconfigs, defaultContext, defaultNamespace) {
		if (!kubeconfigs.length) throw new Error("[k8s] router requires at least one kubeconfig");
		for (const ref of kubeconfigs) {
			const ctx = parseKubeconfig(ref.path, ref.context ?? defaultContext);
			this.clusters.set(ref.id, {
				client: new K8sClient(ctx),
				contextNamespace: ctx.namespace,
				refNamespace: ref.namespace
			});
		}
		const ids = [...this.clusters.keys()];
		this.defaultClientId = defaultContext && this.clusters.has(defaultContext) ? defaultContext : ids[0];
		this.defaultNamespace = defaultNamespace;
	}
	/** All configured cluster ids. */
	list() {
		return [...this.clusters.keys()];
	}
	/** Resolve a cluster id (or the default) to its client. */
	resolve(id) {
		return this.entry(id).client;
	}
	/**
	* Effective namespace for a cluster. Precedence:
	* ref override → context namespace (when it isn't the implicit `default`) →
	* router default → `default`.
	*/
	getDefaultNamespace(id) {
		const e = this.entry(id);
		if (e.refNamespace) return e.refNamespace;
		if (e.contextNamespace !== "default") return e.contextNamespace;
		return this.defaultNamespace ?? "default";
	}
	entry(id) {
		const key = id ?? this.defaultClientId;
		const e = this.clusters.get(key);
		if (!e) throw new Error(`[k8s] unknown cluster id "${key}" (configured: ${[...this.clusters.keys()].join(", ")})`);
		return e;
	}
};
/** Build the K8s service from a parsed config section (eager router). */
function createK8sService(config) {
	const router = new K8sRouter(config.kubeconfigs, config.defaultContext, config.defaultNamespace);
	return {
		listClusters: () => router.list(),
		getDefaultNamespace: (cluster) => router.getDefaultNamespace(cluster),
		getDeploymentStatus: (cluster, namespace, name) => router.resolve(cluster).getDeployment(namespace, name),
		getDeploymentStatusList: (cluster, namespace) => router.resolve(cluster).getDeployments(namespace),
		getPodList: (cluster, namespace) => router.resolve(cluster).getPods(namespace),
		getEvents: (cluster, namespace, limit) => router.resolve(cluster).getEvents(namespace, limit),
		getPodLogs: (cluster, namespace, podName, container, tailLines) => router.resolve(cluster).getPodLogs(namespace, podName, container, tailLines)
	};
}
//#endregion
//#region src/host/pipeline-watch.ts
/**
* Pipeline watch: polls pipeline status and follows up on completion/failure.
*
* Called automatically after gitlab_mr_create, or manually via gitlab_pipeline_watch.
*/
const POLL_INTERVAL_MS = 3e4;
const MAX_DURATION_MS = 18e5;
/**
* Start a pipeline watch for a given project + branch.
*
* Polls every 30 seconds until:
* - Pipeline succeeds → followup success message + stop
* - Pipeline fails/cancels → followup failure message (with failed jobs) + stop
* - Max duration exceeded → followup timeout + stop
* - Plugin unload → cleanup via ctx.effect
*/
function startPipelineWatch(ctx, gitlab, project, branch) {
	const resolvedProject = project ?? gitlab.listProjects()[0];
	ctx.effect(() => {
		const startTime = Date.now();
		let stopped = false;
		const timer = setInterval(async () => {
			if (stopped) return;
			try {
				const pipeline = await gitlab.getLatestPipelineByRef(resolvedProject, branch);
				if (!pipeline) return;
				if (pipeline.status === "success") {
					stopped = true;
					ctx.followup?.(`✅ Pipeline #${pipeline.id} 在 ${branch} 成功: ${pipeline.webUrl}`);
					clearInterval(timer);
				} else if (pipeline.status === "failed" || pipeline.status === "canceled") {
					stopped = true;
					const failed = (await gitlab.listPipelineJobs(resolvedProject, pipeline.id)).filter((j) => j.status === "failed").map((j) => j.name);
					ctx.followup?.(`⚠️ Pipeline #${pipeline.id} 在 ${branch} ${pipeline.status}! 失败: ${failed.join(", ") || "N/A"}\n${pipeline.webUrl}`);
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
		return () => {
			stopped = true;
			clearInterval(timer);
		};
	}, "dsh-devops:pipeline-watch");
}
/**
* Check if an error is a transient/recoverable one (network, timeout, 5xx).
*/
function isRecoverable(err) {
	if (!err) return false;
	const status = err.status ?? err.code;
	if (typeof status === "number" && status >= 500 && status < 600) return true;
	if (err.code === "ECONNRESET" || err.code === "ETIMEDOUT" || err.code === "ENOTFOUND") return true;
	if (err.message?.includes("fetch failed")) return true;
	return false;
}
//#endregion
//#region src/host/tools-gitlab.ts
/**
* GitLab tool definitions.
*
* Registers 7 tools into the DSH tool catalog using defineTool:
* - gitlab_mr_create
* - gitlab_mr_review
* - gitlab_mr_list
* - gitlab_tag_create
* - gitlab_pipeline_status
* - gitlab_pipeline_jobs
* - gitlab_pipeline_watch
*/
/** Render an arbitrary value as a formatted JSON text block. */
function renderObject$1(value) {
	return [{
		type: "text",
		text: JSON.stringify(value, null, 2)
	}];
}
/**
* Register GitLab tools with the DSH context.
* @param ctx - DSH context (has ctx.tools?.register or ctx.tool?.register)
* @param gitlab - GitLabService instance
*/
function registerGitLabTools(ctx, gitlab) {
	const register = (ctx.tools?.register ?? ctx.tool?.register)?.bind(ctx.tools ?? ctx.tool);
	if (!register) {
		console.warn("[dsh-devops] ctx.tools not available, skipping GitLab tool registration");
		return;
	}
	register(cleanTool(defineTool({
		name: "gitlab_mr_create",
		description: "Create a GitLab merge request. Auto-starts pipeline monitoring unless watch_pipeline is false.",
		parameters: {
			project: {
				type: "string",
				description: "Project ID (optional, uses default)"
			},
			source_branch: {
				type: "string",
				description: "Source branch name",
				required: true
			},
			target_branch: {
				type: "string",
				description: "Target branch name",
				required: true
			},
			title: {
				type: "string",
				description: "MR title",
				required: true
			},
			description: {
				type: "string",
				description: "MR description (markdown)"
			},
			reviewers: {
				type: "array",
				description: "Reviewer usernames (optional)",
				items: { type: "string" }
			},
			watch_pipeline: {
				type: "boolean",
				description: "Auto-start pipeline watch (default: true)"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: true
			},
			render: (_args, value) => renderObject$1(value)
		},
		async execute(args) {
			const project = args.project || void 0;
			const mr = await gitlab.createMR(project, args.source_branch, args.target_branch, args.title, args.description, Array.isArray(args.reviewers) && args.reviewers.length ? args.reviewers.map(String).join(", ") : void 0);
			let watchMsg = "";
			if (args.watch_pipeline !== false) {
				startPipelineWatch(ctx, gitlab, project, args.source_branch);
				watchMsg = `📡 Pipeline monitoring started for ${args.source_branch}`;
			}
			return {
				iid: mr.iid,
				title: mr.title,
				state: mr.state,
				web_url: mr.webUrl,
				watch: watchMsg
			};
		}
	})));
	register(cleanTool(defineTool({
		name: "gitlab_mr_review",
		description: "Review a GitLab merge request: approve, request changes, or add a comment.",
		parameters: {
			project: {
				type: "string",
				description: "Project ID (optional, uses default)"
			},
			mr_iid: {
				type: "number",
				description: "MR iid (the number after !)",
				required: true
			},
			action: {
				type: "string",
				description: "Review action",
				enum: [
					"approve",
					"request_changes",
					"comment"
				],
				required: true
			},
			comment: {
				type: "string",
				description: "Review comment"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: true
			},
			render: (_args, value) => renderObject$1(value)
		},
		async execute(args) {
			const project = args.project || void 0;
			const mrIid = args.mr_iid;
			const action = args.action;
			const comment = args.comment;
			switch (action) {
				case "approve":
					await gitlab.approveMR(project, mrIid);
					return {
						ok: true,
						action: "approved",
						mr_iid: mrIid
					};
				case "request_changes":
					await gitlab.requestChanges(project, mrIid, comment ?? "");
					return {
						ok: true,
						action: "changes_requested",
						mr_iid: mrIid
					};
				case "comment":
					await gitlab.commentMR(project, mrIid, comment ?? "");
					return {
						ok: true,
						action: "commented",
						mr_iid: mrIid
					};
				default: throw new Error(`Unknown review action: ${action}`);
			}
		}
	})));
	register(cleanTool(defineTool({
		name: "gitlab_mr_list",
		description: "List merge requests for a project.",
		parameters: {
			project: {
				type: "string",
				description: "Project ID (optional, uses default)"
			},
			state: {
				type: "string",
				description: "MR state filter (informational, currently defaults to opened)",
				enum: [
					"opened",
					"closed",
					"merged",
					"all"
				]
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: true
			},
			render: (_args, value) => renderObject$1(value)
		},
		async execute(args) {
			const project = args.project || void 0;
			const mrs = await gitlab.listMRs(project);
			return {
				count: mrs.length,
				merge_requests: mrs.map((mr) => ({
					iid: mr.iid,
					title: mr.title,
					state: mr.state,
					source_branch: mr.sourceBranch,
					target_branch: mr.targetBranch,
					web_url: mr.webUrl,
					approvals: mr.approvals
				}))
			};
		}
	})));
	register(cleanTool(defineTool({
		name: "gitlab_tag_create",
		description: "Create a git tag in a GitLab project.",
		parameters: {
			project: {
				type: "string",
				description: "Project ID (optional, uses default)"
			},
			name: {
				type: "string",
				description: "Tag name (e.g., v1.0.0)",
				required: true
			},
			ref: {
				type: "string",
				description: "Branch/commit to tag (defaults to default branch)"
			},
			message: {
				type: "string",
				description: "Annotated tag message"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: true
			},
			render: (_args, value) => renderObject$1(value)
		},
		async execute(args) {
			const project = args.project || void 0;
			const tag = await gitlab.createTag(project, args.name, args.ref, args.message);
			return {
				name: tag.name,
				commit_id: tag.commitId,
				message: tag.message
			};
		}
	})));
	register(cleanTool(defineTool({
		name: "gitlab_pipeline_status",
		description: "Get the latest pipeline status for a branch.",
		parameters: {
			project: {
				type: "string",
				description: "Project ID (optional, uses default)"
			},
			ref: {
				type: "string",
				description: "Branch/tag to check (defaults to default branch)"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: true
			},
			render: (_args, value) => renderObject$1(value)
		},
		async execute(args) {
			const project = args.project || void 0;
			const ref = args.ref;
			const pipeline = await gitlab.getLatestPipelineByRef(project, ref);
			if (!pipeline) return {
				status: "none",
				message: `No pipeline found for ref "${ref ?? "default"}"`
			};
			return {
				id: pipeline.id,
				status: pipeline.status,
				ref: pipeline.ref,
				sha: pipeline.sha,
				web_url: pipeline.webUrl,
				created_at: pipeline.createdAt,
				finished_at: pipeline.finishedAt
			};
		}
	})));
	register(cleanTool(defineTool({
		name: "gitlab_pipeline_jobs",
		description: "List all jobs in a pipeline.",
		parameters: {
			project: {
				type: "string",
				description: "Project ID (optional, uses default)"
			},
			pipeline_id: {
				type: "number",
				description: "Pipeline ID",
				required: true
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: true
			},
			render: (_args, value) => renderObject$1(value)
		},
		async execute(args) {
			const project = args.project || void 0;
			const jobs = await gitlab.listPipelineJobs(project, args.pipeline_id);
			return {
				pipeline_id: args.pipeline_id,
				count: jobs.length,
				jobs: jobs.map((j) => ({
					id: j.id,
					name: j.name,
					stage: j.stage,
					status: j.status,
					duration_sec: j.duration
				}))
			};
		}
	})));
	register(cleanTool(defineTool({
		name: "gitlab_pipeline_watch",
		description: "Start, stop, or check pipeline monitoring for a branch.",
		parameters: {
			project: {
				type: "string",
				description: "Project ID (optional, uses default)"
			},
			action: {
				type: "string",
				description: "Watch action",
				enum: ["start", "status"],
				required: true
			},
			branch: {
				type: "string",
				description: "Branch to monitor",
				required: true
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: true
			},
			render: (_args, value) => renderObject$1(value)
		},
		async execute(args) {
			const project = args.project || void 0;
			const branch = args.branch;
			switch (args.action) {
				case "start":
					startPipelineWatch(ctx, gitlab, project, branch);
					return {
						ok: true,
						message: `📡 Watching pipeline for branch: ${branch}`
					};
				case "status": return {
					ok: true,
					message: `⏳ Pipeline watch for ${branch} is active (polling every 30s)`
				};
				default: throw new Error(`Unknown watch action: ${args.action}`);
			}
		}
	})));
}
//#endregion
//#region src/host/tools-k8s.ts
/**
* K8s tool definitions.
*
* Registers 4 tools into the DSH tool catalog using defineTool:
* - k8s_deployment_status
* - k8s_pods
* - k8s_events
* - k8s_logs
*/
/** Render an arbitrary value as a formatted JSON text block. */
function renderObject(value) {
	return [{
		type: "text",
		text: JSON.stringify(value, null, 2)
	}];
}
/**
* Register K8s tools with the DSH context.
* @param ctx - DSH context
* @param k8s - K8sService instance
*/
function registerK8sTools(ctx, k8s) {
	const register = (ctx.tools?.register ?? ctx.tool?.register)?.bind(ctx.tools ?? ctx.tool);
	if (!register) {
		console.warn("[dsh-devops] ctx.tools not available, skipping K8s tool registration");
		return;
	}
	register(cleanTool(defineTool({
		name: "k8s_deployment_status",
		description: "Get deployment rolling status (replicas, conditions). Returns all deployments if no name given.",
		parameters: {
			cluster: {
				type: "string",
				description: "Cluster ID (optional, uses default)"
			},
			namespace: {
				type: "string",
				description: "Namespace (uses cluster default)"
			},
			name: {
				type: "string",
				description: "Specific deployment name (optional, lists all if omitted)"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: true
			},
			render: (_args, value) => renderObject(value)
		},
		async execute(args) {
			const cluster = args.cluster || void 0;
			const ns = args.namespace || k8s.getDefaultNamespace(cluster);
			if (args.name) return formatDeployment(await k8s.getDeploymentStatus(cluster, ns, args.name));
			const deps = await k8s.getDeploymentStatusList(cluster, ns);
			return {
				namespace: ns,
				count: deps.length,
				deployments: deps.map(formatDeployment)
			};
		}
	})));
	register(cleanTool(defineTool({
		name: "k8s_pods",
		description: "List pods in a namespace with phase and restart counts.",
		parameters: {
			cluster: {
				type: "string",
				description: "Cluster ID (optional, uses default)"
			},
			namespace: {
				type: "string",
				description: "Namespace (uses cluster default)"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: true
			},
			render: (_args, value) => renderObject(value)
		},
		async execute(args) {
			const cluster = args.cluster || void 0;
			const ns = args.namespace || k8s.getDefaultNamespace(cluster);
			const pods = await k8s.getPodList(cluster, ns);
			return {
				namespace: ns,
				count: pods.length,
				pods: pods.map((p) => ({
					name: p.name,
					phase: p.phase,
					restart_count: p.restartCount,
					node: p.nodeName,
					containers: p.containers.map((c) => ({
						name: c.name,
						ready: c.ready,
						restarts: c.restartCount
					}))
				}))
			};
		}
	})));
	register(cleanTool(defineTool({
		name: "k8s_events",
		description: "Get recent Kubernetes events in a namespace.",
		parameters: {
			cluster: {
				type: "string",
				description: "Cluster ID (optional, uses default)"
			},
			namespace: {
				type: "string",
				description: "Namespace (uses cluster default)"
			},
			limit: {
				type: "number",
				description: "Max events to return (default: 20)"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: true
			},
			render: (_args, value) => renderObject(value)
		},
		async execute(args) {
			const cluster = args.cluster || void 0;
			const ns = args.namespace || k8s.getDefaultNamespace(cluster);
			const limit = args.limit || 20;
			const events = await k8s.getEvents(cluster, ns, limit);
			return {
				namespace: ns,
				count: events.length,
				events: events.map((e) => ({
					type: e.type,
					reason: e.reason,
					message: e.message,
					object: e.object,
					count: e.count,
					last_timestamp: e.lastTimestamp
				}))
			};
		}
	})));
	register(cleanTool(defineTool({
		name: "k8s_logs",
		description: "Get pod logs (tail last N lines).",
		parameters: {
			cluster: {
				type: "string",
				description: "Cluster ID (optional, uses default)"
			},
			namespace: {
				type: "string",
				description: "Namespace (uses cluster default)"
			},
			pod: {
				type: "string",
				description: "Pod name",
				required: true
			},
			container: {
				type: "string",
				description: "Container name (optional, first container if omitted)"
			},
			tail_lines: {
				type: "number",
				description: "Number of lines from the end (default: 100)"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: true
			},
			render: (_args, value) => renderObject(value)
		},
		async execute(args) {
			const cluster = args.cluster || void 0;
			const ns = args.namespace || k8s.getDefaultNamespace(cluster);
			const pod = args.pod;
			const container = args.container;
			const tailLines = args.tail_lines || 100;
			return {
				pod,
				namespace: ns,
				tail_lines: tailLines,
				logs: await k8s.getPodLogs(cluster, ns, pod, container, tailLines)
			};
		}
	})));
}
function formatDeployment(dep) {
	return {
		name: dep.name,
		namespace: dep.namespace,
		ready: `${dep.readyReplicas}/${dep.desiredReplicas}`,
		available: dep.availableReplicas,
		updated: dep.updatedReplicas,
		conditions: dep.conditions.map((c) => ({
			type: c.type,
			status: c.status,
			reason: c.reason,
			message: c.message
		}))
	};
}
//#endregion
//#region src/host/tools.ts
/**
* Tool registration for dsh-devops.
*
* Registers all gitlab_* and k8s_* tools into the DSH tool catalog.
*/
/**
* Strip `undefined` fields (and functions) from a tool result. The host
* validates tool output as lossless JSON, which rejects `undefined` values
* that legitimately occur when upstream API objects lack optional fields
* (e.g. a pipeline without `finished_at`).
*/
function pruneUndefined(value) {
	if (value === void 0 || typeof value === "function") return null;
	if (Array.isArray(value)) return value.map(pruneUndefined);
	if (value && typeof value === "object") {
		const out = {};
		for (const [k, v] of Object.entries(value)) out[k] = pruneUndefined(v);
		return out;
	}
	return value;
}
/** Wrap a tool definition so every execute() result is JSON-lossless-safe. */
function cleanTool(tool) {
	const execute = tool.execute.bind(tool);
	tool.execute = async (...args) => pruneUndefined(await execute(...args));
	return tool;
}
function registerTools(ctx, services) {
	if (services.gitlab) registerGitLabTools(ctx, services.gitlab);
	if (services.k8s) registerK8sTools(ctx, services.k8s);
}
//#endregion
//#region src/core/webhook/handler.ts
/**
* Safely read a nested property from an unknown object by dot-path.
* Returns undefined when any segment in the path is missing or non-object.
*/
function safeGet(obj, path) {
	if (obj == null || typeof obj !== "object") return void 0;
	let current = obj;
	for (const key of path.split(".")) {
		if (current == null || typeof current !== "object") return void 0;
		current = current[key];
	}
	return current;
}
/** Coerce an unknown value to a display string; empty string for null/undefined. */
function str(value) {
	return value == null ? "" : String(value);
}
const MR_ACTIONS = /* @__PURE__ */ new Set([
	"open",
	"update",
	"close",
	"merge",
	"approval",
	"unapproval"
]);
/**
* Parse the X-Gitlab-Event header into a WebhookEvent.
*
* Returns null for:
*  - "Merge Request Hook" (deferred — requires payload inspection via
*    {@link parseMergeRequestEvent})
*  - Any unknown or missing header
*/
function parseEvent(header) {
	switch (header) {
		case "Merge Request Hook": return null;
		case "Pipeline Hook": return {
			type: "pipeline",
			action: "created"
		};
		case "Tag Push Hook": return { type: "tag_push" };
		case "Note Hook": return {
			type: "note",
			action: "create"
		};
		default: return null;
	}
}
/**
* Inspect a Merge Request Hook payload and return the corresponding WebhookEvent.
*
* Reads `payload.object_attributes.action` and maps it to one of the known
* merge-request actions. Returns null when the action is missing or unrecognized.
*/
function parseMergeRequestEvent(payload) {
	if (payload == null || typeof payload !== "object") return null;
	const action = payload.object_attributes?.action;
	if (typeof action !== "string" || !MR_ACTIONS.has(action)) return null;
	return {
		type: "merge_request",
		action
	};
}
/**
* Generate a human-readable follow-up message for a parsed WebhookEvent.
*
* Returns null for "silent" events that should not produce a notification:
*  - merge_request open / update
*  - pipeline created / skipped
*/
function toFollowupMessage(event, payload) {
	switch (event.type) {
		case "merge_request": {
			const iid = str(safeGet(payload, "object_attributes.iid"));
			const title = str(safeGet(payload, "object_attributes.title"));
			const target = str(safeGet(payload, "object_attributes.target_branch"));
			switch (event.action) {
				case "merge": return `✅ MR !${iid} "${title}" 已合并到 ${target}`;
				case "approval": return `👍 MR !${iid} 获得审批`;
				case "unapproval": return `👎 MR !${iid} 审批被撤回`;
				case "close": return `🔒 MR !${iid} "${title}" 已关闭`;
				default: return null;
			}
		}
		case "pipeline": {
			const id = str(safeGet(payload, "object_attributes.id"));
			const ref = str(safeGet(payload, "object_attributes.ref"));
			const webUrl = str(safeGet(payload, "object_attributes.web_url"));
			switch (event.action) {
				case "success": return `✅ Pipeline #${id} 在 ${ref} 成功`;
				case "failed": return `⚠️ Pipeline #${id} 在 ${ref} 失败! ${webUrl}`;
				case "canceled": return `🚫 Pipeline #${id} 被取消`;
				default: return null;
			}
		}
		case "tag_push": return `🏷️ 新 Tag: ${str(safeGet(payload, "ref"))}`;
		case "note": {
			const mrId = str(safeGet(payload, "merge_request.iid")) || str(safeGet(payload, "object_attributes.merge_request_id"));
			const note = str(safeGet(payload, "object_attributes.note"));
			return `💬 MR !${mrId} 新评论: ${note.length > 200 ? `${note.slice(0, 200)}…` : note}`;
		}
	}
}
/**
* Normalise the X-Gitlab-Event header value into a short event-type name
* suitable for matching against `config.quietEvents`.
*
* Known mappings:
*   "Merge Request Hook" → "merge_request"
*   "Pipeline Hook"      → "pipeline"
*   "Tag Push Hook"      → "tag_push"
*   "Note Hook"          → "note"
*   "Push Hook"          → "push"
*   "Issue Hook"         → "issue"
*
* Unknown headers are normalised by lowercasing, stripping the trailing
* " hook", and replacing spaces with underscores.
*/
function getEventType(header) {
	if (!header) return "unknown";
	const known = {
		"Merge Request Hook": "merge_request",
		"Pipeline Hook": "pipeline",
		"Tag Push Hook": "tag_push",
		"Note Hook": "note",
		"Push Hook": "push",
		"Issue Hook": "issue"
	};
	if (known[header] !== void 0) return known[header];
	return header.toLowerCase().replace(/\s*hook\s*$/, "").replace(/\s+/g, "_");
}
//#endregion
//#region src/host/webhook.ts
/**
* Read a header value from an untyped req object, trying both the original
* case and the lower-case form (Node.js normalises to lower-case, but some
* frameworks preserve the original case).
*/
function getHeader(req, name) {
	const headers = req?.headers ?? {};
	if (headers[name] != null) return String(headers[name]);
	const lower = name.toLowerCase();
	if (headers[lower] != null) return String(headers[lower]);
}
/**
* Attempt to parse the request body as JSON.
* Handles both pre-parsed objects (some frameworks) and raw strings.
*/
function parseBody(req) {
	const body = req?.body;
	if (body == null) return {};
	if (typeof body === "object") return body;
	if (typeof body === "string") try {
		return JSON.parse(body);
	} catch {
		return {};
	}
	return {};
}
/**
* Check whether the incoming request passes the project-path filter.
* Returns true when the filter is not configured or the project matches.
*/
function matchesProjectFilter(payload, projectPaths) {
	if (!projectPaths || projectPaths.length === 0) return true;
	const p = payload;
	const projectPath = p?.project?.path_with_namespace ?? p?.project?.path ?? "";
	if (!projectPath) return true;
	return projectPaths.some((pp) => projectPath === pp || projectPath.endsWith(`/${pp}`));
}
/**
* Core webhook request handler shared by both registration paths.
* Called for every incoming webhook POST after the framework has dispatched it.
*/
function handleWebhookRequest(req, res, ctx, config) {
	try {
		if ((getHeader(req, "X-Gitlab-Token") ?? "") !== config.secret) {
			res.writeHead?.(401, { "Content-Type": "application/json" });
			res.end?.(JSON.stringify({ error: "Unauthorized" }));
			return;
		}
		const rawEventHeader = getHeader(req, "X-Gitlab-Event");
		const eventTypeName = getEventType(rawEventHeader);
		if (config.quietEvents?.includes(eventTypeName)) {
			res.writeHead?.(200);
			res.end?.();
			return;
		}
		const payload = parseBody(req);
		if (!matchesProjectFilter(payload, config.projectPaths)) {
			res.writeHead?.(200);
			res.end?.();
			return;
		}
		let event = parseEvent(rawEventHeader);
		if (rawEventHeader === "Merge Request Hook") event = parseMergeRequestEvent(payload);
		if (event == null) {
			res.writeHead?.(200);
			res.end?.();
			return;
		}
		const message = toFollowupMessage(event, payload);
		if (message != null) ctx.followup?.(`[GitLab] ${message}`);
		res.writeHead?.(200);
		res.end?.();
	} catch (err) {
		console.error("[dsh-devops:webhook] Error handling webhook request", err);
		res.writeHead?.(500);
		res.end?.();
	}
}
/**
* Register the GitLab webhook handler on the DSH context.
*
* Registration strategy (first match wins):
*  1. `ctx.webhook.register()`  — preferred; passes the secret so the
*     framework can verify it before invoking the handler.
*  2. `ctx.http.register()`     — fallback; the handler performs its own
*     secret check on every request.
*  3. Neither available         — logs a warning and returns silently.
*
* The handler:
*  - Verifies `X-Gitlab-Token` matches `config.secret` (401 on mismatch)
*  - Normalises `X-Gitlab-Event` into an event type name
*  - Silently drops events listed in `config.quietEvents`
*  - Filters by `config.projectPaths` when set
*  - Generates a follow-up message via `toFollowupMessage` and calls
*    `ctx.followup` with a `[GitLab]`-prefixed string
*
* Lifecycle: registration is wrapped in `ctx.effect` so the DSH session
* teardown can cancel the endpoint if needed.
*/
function registerWebhook(ctx, config) {
	const WEBHOOK_PATH = "/gitlab-webhook";
	ctx.effect(() => {
		if (ctx.webhook?.register) {
			ctx.webhook.register({
				path: WEBHOOK_PATH,
				method: "POST",
				secret: config.secret
			}).onEvent((req, res) => {
				handleWebhookRequest(req, res, ctx, config);
			});
			console.warn(`[dsh-devops:webhook] Registered webhook via ctx.webhook at ${WEBHOOK_PATH}`);
			return;
		}
		if (ctx.http?.register) {
			ctx.http.register({
				path: WEBHOOK_PATH,
				method: "POST"
			}).onEvent((req, res) => {
				handleWebhookRequest(req, res, ctx, config);
			});
			console.warn(`[dsh-devops:webhook] Registered webhook via ctx.http fallback at ${WEBHOOK_PATH}`);
			return;
		}
		console.warn("[dsh-devops:webhook] Neither ctx.webhook nor ctx.http is available; skipping webhook registration. Webhook notifications will not work.");
	}, "webhook-register");
}
//#endregion
//#region src/core/monitor/throttle.ts
/**
* Alert throttling — suppresses duplicate alerts within a cooldown window.
*/
const lastFired = /* @__PURE__ */ new Map();
/**
* Returns true if the alert for `key` should be suppressed (within cooldown).
* Records the fire time if it should not be suppressed.
*/
function throttled(key, cooldownSec) {
	const now = Date.now();
	const last = lastFired.get(key);
	if (last !== void 0 && now - last < cooldownSec * 1e3) return true;
	lastFired.set(key, now);
	return false;
}
/**
* Clears all throttle entries. Called on plugin unload.
*/
function clearThrottle() {
	lastFired.clear();
}
//#endregion
//#region src/core/monitor/rules.ts
async function checkPipelineAlerts(ctx, gitlab, rules, config) {
	const cooldown = config.cooldownSec ?? 300;
	const projects = gitlab.listProjects();
	for (const project of projects) for (const rule of rules) {
		if (rule.projects && !rule.projects.includes(project)) continue;
		const branches = rule.branches ?? ["HEAD"];
		for (const branch of branches) {
			const pipeline = await gitlab.getLatestPipelineByRef(project, branch);
			if (!pipeline) continue;
			if (!matchesPipelineTrigger(pipeline.status, rule.trigger)) continue;
			if (throttled(`pipeline:${project}:${pipeline.ref}:${pipeline.id}:${rule.trigger}`, cooldown)) continue;
			const message = await formatPipelineAlert(rule, project, pipeline, gitlab);
			ctx.followup?.(message);
		}
	}
}
function matchesPipelineTrigger(status, trigger) {
	return status === trigger;
}
async function formatPipelineAlert(rule, project, pipeline, gitlab) {
	const lines = [];
	lines.push(`🔔 Pipeline ${rule.trigger}: ${project} @ ${pipeline.ref}`);
	lines.push(`   Pipeline #${pipeline.id} | ${pipeline.status}`);
	if (pipeline.webUrl) lines.push(`   ${pipeline.webUrl}`);
	if (rule.includeFailedJobs) try {
		const failed = (await gitlab.listPipelineJobs(project, pipeline.id)).filter((j) => j.status === "failed");
		if (failed.length > 0) {
			lines.push("   Failed jobs:");
			for (const job of failed) lines.push(`     - ${job.name} (${job.status})`);
		}
	} catch {}
	if (rule.message) lines.push(`   ${rule.message}`);
	return lines.join("\n");
}
async function checkPodAlerts(ctx, k8s, rules, config) {
	const cooldown = config.cooldownSec ?? 300;
	const clusters = k8s.listClusters();
	for (const cluster of clusters) for (const rule of rules) {
		if (rule.clusters && !rule.clusters.includes(cluster)) continue;
		const namespaces = rule.namespaces ?? [k8s.getDefaultNamespace(cluster)];
		for (const namespace of namespaces) {
			const pods = await k8s.getPodList(cluster, namespace);
			for (const pod of pods) await evaluatePodRule(ctx, k8s, rule, config, cluster, namespace, pod, cooldown);
		}
	}
}
async function evaluatePodRule(ctx, k8s, rule, config, cluster, namespace, pod, cooldown) {
	let triggered = false;
	let detail = "";
	switch (rule.trigger) {
		case "crash":
			if (pod.phase === "Failed") {
				triggered = true;
				detail = "Pod crashed (phase: Failed)";
			}
			break;
		case "restart": {
			const threshold = rule.restartThreshold ?? 3;
			if (pod.restartCount > threshold) {
				triggered = true;
				detail = `Pod restarts exceeded threshold (${pod.restartCount} > ${threshold})`;
			}
			break;
		}
		case "pending_stuck": {
			const timeoutSec = rule.pendingTimeoutSec ?? 300;
			if (pod.phase === "Pending") {
				const startMs = pod.startTime ? new Date(pod.startTime).getTime() : void 0;
				if (startMs !== void 0) {
					const pendingMs = Date.now() - startMs;
					if (pendingMs > timeoutSec * 1e3) {
						triggered = true;
						detail = `Pod stuck in Pending for ${Math.round(pendingMs / 1e3)}s (timeout: ${timeoutSec}s)`;
					}
				}
			}
			break;
		}
	}
	if (!triggered) return;
	if (throttled(`pod:${cluster}:${namespace}:${pod.name}:${rule.trigger}`, cooldown)) return;
	const message = formatPodAlert(rule, cluster, namespace, pod, detail);
	ctx.followup?.(message);
}
function formatPodAlert(rule, cluster, namespace, pod, detail) {
	const lines = [];
	lines.push(`🐳 Pod alert [${rule.trigger}]: ${pod.name} in ${cluster}/${namespace}`);
	lines.push(`   ${detail}`);
	lines.push(`   Phase: ${pod.phase} | Restarts: ${pod.restartCount}`);
	if (rule.message) lines.push(`   ${rule.message}`);
	return lines.join("\n");
}
//#endregion
//#region src/host/monitor.ts
/**
* Starts the monitor polling loop.
*
* @param ctx       Plugin context (effect, followup, log)
* @param config    Monitor configuration
* @param services  Registered services: { gitlab?, k8s? }
*/
function startMonitor(ctx, config, services) {
	const intervalMs = (config.pollIntervalSec ?? 60) * 1e3;
	ctx.effect(() => {
		const timer = setInterval(async () => {
			try {
				if (config.pipeline?.length && services.gitlab) await checkPipelineAlerts(ctx, services.gitlab, config.pipeline, config);
				if (config.pod?.length && services.k8s) await checkPodAlerts(ctx, services.k8s, config.pod, config);
			} catch (err) {
				console.error("[dsh-devops:monitor] tick error:", err?.message ?? err);
			}
		}, intervalMs);
		return () => {
			clearInterval(timer);
			clearThrottle();
		};
	}, "dsh-devops:monitor");
}
//#endregion
//#region src/protocol.ts
/**
* Shared RPC protocol between the host plugin and the web client.
*
* Channels follow the DSH Connection convention: absolute logical channel
* prefixes dispatched by endpoint name. The payload and result of every
* endpoint are JSON-safe values; handlers return the `ConnectionRpcResult`
* envelope (`{ ok: true, value } | { ok: false, error }`).
*/
/** Read-only endpoints: connection tests, listings, config/log retrieval. */
const DEVOPS_READ_CHANNEL = "/dsh-devops-read";
/** Mutating endpoints: create MR/tag, pipeline actions, image/restart, config save. */
const DEVOPS_WRITE_CHANNEL = "/dsh-devops-write";
//#endregion
//#region src/host/endpoints-gitlab.ts
/**
* GitLab RPC endpoints.
*
* These work with RAW parameters (baseUrl, token, projectPath) rather than
* configured service instances, so the dashboard can test connectivity and
* act BEFORE saving the config. Every endpoint returns an `{ ok, ... }`
* payload (soft failures carry a `message`) — the RPC layer wraps the value
* into the ConnectionRpcResult envelope.
*/
/** Build a client from raw params; null when params are missing. */
function gitlabClientFrom(params) {
	if (!params.baseUrl || !params.token) return null;
	return new GitLabClient(params.baseUrl, params.token);
}
function fail$1(message) {
	return {
		ok: false,
		message
	};
}
function isAbort$1(err) {
	return err instanceof Error && err.name === "AbortError";
}
function errorMessage$1(err) {
	return err instanceof Error ? err.message : String(err);
}
async function testGitLab(params) {
	if (!params.baseUrl || !params.token) return fail$1("Missing required fields: baseUrl, token");
	try {
		const user = await new GitLabClient(params.baseUrl, params.token).getCurrentUser();
		return {
			ok: true,
			message: `Connected as ${user.username ?? user.name ?? "user"}`
		};
	} catch (err) {
		if (isAbort$1(err)) return fail$1("Connection timed out (5s)");
		return fail$1(`Network error: ${errorMessage$1(err)}`);
	}
}
async function gitlabProjects(params) {
	const client = gitlabClientFrom(params);
	if (!client) return {
		ok: false,
		projects: [],
		message: "Missing baseUrl or token"
	};
	try {
		return {
			ok: true,
			projects: await client.listProjects(params.search)
		};
	} catch (err) {
		if (isAbort$1(err)) return {
			ok: false,
			projects: [],
			message: "Timed out"
		};
		return {
			ok: false,
			projects: [],
			message: errorMessage$1(err)
		};
	}
}
async function gitlabBranches(params) {
	const client = gitlabClientFrom(params);
	if (!client || !params.path) return {
		ok: false,
		branches: [],
		message: "Missing baseUrl, token or path"
	};
	try {
		return {
			ok: true,
			branches: await client.listBranches(params.path, params.search)
		};
	} catch (err) {
		if (isAbort$1(err)) return {
			ok: false,
			branches: [],
			message: "Timed out"
		};
		return {
			ok: false,
			branches: [],
			message: errorMessage$1(err)
		};
	}
}
async function gitlabMembers(params) {
	const client = gitlabClientFrom(params);
	if (!client || !params.path) return {
		ok: false,
		members: [],
		message: "Missing baseUrl, token or path"
	};
	try {
		return {
			ok: true,
			members: await client.listMembers(params.path, params.search)
		};
	} catch (err) {
		if (isAbort$1(err)) return {
			ok: false,
			members: [],
			message: "Timed out"
		};
		return {
			ok: false,
			members: [],
			message: errorMessage$1(err)
		};
	}
}
async function gitlabLastCommit(params) {
	const client = gitlabClientFrom(params);
	if (!client || !params.path || !params.branch) return fail$1("Missing token or branch");
	try {
		const c = await client.getLastCommit(params.path, params.branch);
		if (!c) return fail$1("分支上没有提交");
		return {
			ok: true,
			...c
		};
	} catch (err) {
		if (isAbort$1(err)) return fail$1("Timed out");
		return fail$1(errorMessage$1(err));
	}
}
async function gitlabMRs(params) {
	const client = gitlabClientFrom(params);
	if (!client || !params.projectPath) return {
		ok: false,
		mergeRequests: [],
		message: "Missing baseUrl, token or projectPath"
	};
	try {
		return {
			ok: true,
			mergeRequests: await client.listMRs(params.projectPath, params.state || "opened")
		};
	} catch (err) {
		if (isAbort$1(err)) return {
			ok: false,
			mergeRequests: [],
			message: "Timed out"
		};
		return {
			ok: false,
			mergeRequests: [],
			message: errorMessage$1(err)
		};
	}
}
async function gitlabPipelines(params) {
	const client = gitlabClientFrom(params);
	if (!client || !params.projectPath) return {
		ok: false,
		pipelines: [],
		message: "Missing baseUrl, token or projectPath"
	};
	try {
		return {
			ok: true,
			pipelines: await client.listPipelines(params.projectPath, params.ref, params.perPage ?? 10)
		};
	} catch (err) {
		if (isAbort$1(err)) return {
			ok: false,
			pipelines: [],
			message: "Timed out"
		};
		return {
			ok: false,
			pipelines: [],
			message: errorMessage$1(err)
		};
	}
}
async function gitlabTags(params) {
	const client = gitlabClientFrom(params);
	if (!client || !params.projectPath) return {
		ok: false,
		tags: [],
		message: "Missing baseUrl, token or projectPath"
	};
	try {
		return {
			ok: true,
			tags: await client.listTags(params.projectPath)
		};
	} catch (err) {
		if (isAbort$1(err)) return {
			ok: false,
			tags: [],
			message: "Timed out"
		};
		return {
			ok: false,
			tags: [],
			message: errorMessage$1(err)
		};
	}
}
async function gitlabPipelineJobs(params) {
	const client = gitlabClientFrom(params);
	if (!client || !params.projectPath || !params.pipelineId) return {
		ok: false,
		jobs: [],
		message: "Missing params"
	};
	try {
		return {
			ok: true,
			jobs: await client.listPipelineJobs(params.projectPath, params.pipelineId)
		};
	} catch (err) {
		return {
			ok: false,
			jobs: [],
			message: errorMessage$1(err)
		};
	}
}
async function gitlabJobLog(params) {
	const client = gitlabClientFrom(params);
	if (!client || !params.projectPath || !params.jobId) return {
		ok: false,
		logs: "",
		message: "Missing params"
	};
	try {
		const result = await client.getJobLog(params.projectPath, params.jobId);
		if (result.unavailable === "missing") return {
			ok: false,
			logs: "",
			message: "未获取到日志（该 GitLab 版本无可用的日志接口），请通过 GitLab 页面查看",
			jobUrl: result.jobUrl
		};
		if (result.unavailable === "running") return {
			ok: false,
			logs: "",
			message: "Job 仍在运行，日志暂不可用，请稍后重试",
			jobUrl: result.jobUrl
		};
		return {
			ok: true,
			logs: result.logs,
			jobUrl: result.jobUrl
		};
	} catch (err) {
		if (isAbort$1(err)) return {
			ok: false,
			logs: "",
			message: "Timed out"
		};
		return {
			ok: false,
			logs: "",
			message: errorMessage$1(err)
		};
	}
}
async function gitlabCreateMR(params) {
	const client = gitlabClientFrom(params);
	if (!client || !params.projectPath) return fail$1("Missing baseUrl, token or projectPath");
	if (!params.sourceBranch || !params.targetBranch || !params.title) return fail$1("Missing source, target or title");
	try {
		const mr = await client.createMR(params.projectPath, params.sourceBranch, params.targetBranch, params.title, params.description, params.reviewers);
		return {
			ok: true,
			mergeRequest: {
				iid: mr.iid,
				title: mr.title,
				webUrl: mr.webUrl
			}
		};
	} catch (err) {
		if (isAbort$1(err)) return fail$1("Timed out");
		return fail$1(errorMessage$1(err));
	}
}
async function gitlabCreateTag(params) {
	const client = gitlabClientFrom(params);
	if (!client || !params.projectPath) return fail$1("Missing baseUrl, token or projectPath");
	if (!params.tagName || !params.ref) return fail$1("Missing tag name or ref");
	try {
		return {
			ok: true,
			tag: { name: (await client.createTag(params.projectPath, params.tagName, params.ref, params.message)).name }
		};
	} catch (err) {
		if (isAbort$1(err)) return fail$1("Timed out");
		return fail$1(errorMessage$1(err));
	}
}
async function gitlabPipelineAction(params) {
	const client = gitlabClientFrom(params);
	if (!client || !params.projectPath) return fail$1("Missing baseUrl, token or projectPath");
	if (params.action !== "cancel" && params.action !== "retry") return fail$1("action must be 'cancel' or 'retry'");
	try {
		await client.pipelineAction(params.projectPath, params.pipelineId, params.action);
		return { ok: true };
	} catch (err) {
		if (isAbort$1(err)) return fail$1("Timed out");
		return fail$1(errorMessage$1(err));
	}
}
async function gitlabMRApprove(params) {
	const client = gitlabClientFrom(params);
	if (!client || !params.projectPath) return fail$1("Missing baseUrl, token or projectPath");
	try {
		return {
			ok: true,
			approvalsBeforeMerge: (await client.approveMR(params.projectPath, params.mrIid)).approvalsBeforeMerge
		};
	} catch (err) {
		if (isAbort$1(err)) return fail$1("Timed out");
		return fail$1(errorMessage$1(err));
	}
}
async function gitlabMRAction(params) {
	const client = gitlabClientFrom(params);
	if (!client || !params.projectPath) return fail$1("Missing baseUrl, token or projectPath");
	if (params.action !== "close" && params.action !== "reopen") return fail$1(`Unknown action: ${params.action}`);
	try {
		return {
			ok: true,
			state: await client.setMRState(params.projectPath, params.mrIid, params.action)
		};
	} catch (err) {
		if (isAbort$1(err)) return fail$1("Timed out");
		return fail$1(errorMessage$1(err));
	}
}
//#endregion
//#region src/host/endpoints-k8s.ts
/**
* Kubernetes RPC endpoints (raw params — kubeconfigPath + context — so the
* dashboard can test connectivity and act BEFORE saving the config).
*/
function fail(message) {
	return {
		ok: false,
		message
	};
}
function isAbort(err) {
	return err instanceof Error && err.name === "AbortError";
}
function errorMessage(err) {
	return err instanceof Error ? err.message : String(err);
}
/** Parse the kubeconfig and build a client; throws with a descriptive message. */
function clientFrom(params) {
	return new K8sClient(parseKubeconfig(params.kubeconfigPath ?? "", params.context));
}
/** All context entries of a kubeconfig file, with their configured namespace. */
function kubeconfigContexts(kubeconfigPath) {
	return (parse(readFileSync(expandPath(kubeconfigPath), "utf8"))?.contexts ?? []).map((c) => ({
		name: c?.name ?? "",
		namespace: c?.context?.namespace ?? ""
	})).filter((c) => c.name);
}
async function testK8s(params) {
	if (!params.kubeconfigPath) return fail("Missing kubeconfigPath");
	try {
		const kctx = parseKubeconfig(params.kubeconfigPath, params.context);
		const info = await new K8sClient(kctx).getVersion();
		let contexts = [];
		try {
			contexts = kubeconfigContexts(params.kubeconfigPath);
		} catch {}
		return {
			ok: true,
			message: `Connected to ${kctx.server} (${info.gitVersion ?? "unknown version"})`,
			server: kctx.server,
			namespace: kctx.namespace,
			contexts
		};
	} catch (err) {
		return fail(errorMessage(err));
	}
}
async function k8sContexts(params) {
	if (!params.kubeconfigPath) return {
		ok: false,
		contexts: [],
		message: "Missing kubeconfigPath"
	};
	try {
		return {
			ok: true,
			contexts: kubeconfigContexts(params.kubeconfigPath)
		};
	} catch (err) {
		return {
			ok: false,
			contexts: [],
			message: errorMessage(err)
		};
	}
}
async function k8sNamespaces(params) {
	try {
		return {
			ok: true,
			namespaces: await clientFrom(params).listNamespaces()
		};
	} catch (err) {
		if (isAbort(err)) return {
			ok: false,
			namespaces: [],
			message: "Timed out"
		};
		return {
			ok: false,
			namespaces: [],
			message: errorMessage(err)
		};
	}
}
async function k8sDeployments(params) {
	try {
		const kctx = parseKubeconfig(params.kubeconfigPath ?? "", params.context);
		const ns = params.namespace || kctx.namespace;
		return {
			ok: true,
			deployments: await new K8sClient(kctx).getDeploymentsWithImage(ns)
		};
	} catch (err) {
		if (isAbort(err)) return {
			ok: false,
			deployments: [],
			message: "Timed out"
		};
		return {
			ok: false,
			deployments: [],
			message: errorMessage(err)
		};
	}
}
async function k8sPods(params) {
	if (!params.kubeconfigPath || !params.namespace) return {
		ok: false,
		pods: [],
		message: "Missing kubeconfigPath or namespace"
	};
	try {
		return {
			ok: true,
			pods: (await clientFrom(params).getPods(params.namespace)).map((p) => ({
				name: p.name,
				phase: p.phase,
				ready: p.containers.filter((c) => c.ready).length,
				total: p.containers.length,
				restarts: p.restartCount,
				node: p.nodeName ?? "",
				reason: p.reason ?? "",
				startedAt: p.startTime ?? ""
			}))
		};
	} catch (err) {
		if (isAbort(err)) return {
			ok: false,
			pods: [],
			message: "Timed out"
		};
		return {
			ok: false,
			pods: [],
			message: errorMessage(err)
		};
	}
}
async function k8sEvents(params) {
	if (!params.kubeconfigPath || !params.namespace) return {
		ok: false,
		events: [],
		message: "Missing kubeconfigPath or namespace"
	};
	try {
		return {
			ok: true,
			events: (await clientFrom(params).getEvents(params.namespace, Math.min(params.limit ?? 20, 100))).map((ev) => ({
				type: ev.type,
				reason: ev.reason,
				message: ev.message,
				object: ev.object.name,
				kind: ev.object.kind,
				time: ev.lastTimestamp || ev.eventTime || ""
			}))
		};
	} catch (err) {
		if (isAbort(err)) return {
			ok: false,
			events: [],
			message: "Timed out"
		};
		return {
			ok: false,
			events: [],
			message: errorMessage(err)
		};
	}
}
async function k8sPodLogs(params) {
	if (!params.kubeconfigPath || !params.namespace || !params.podName) return {
		ok: false,
		logs: "",
		message: "Missing kubeconfigPath, namespace or podName"
	};
	try {
		return {
			ok: true,
			logs: await clientFrom(params).getPodLogs(params.namespace, params.podName, params.container, Math.min(params.tailLines ?? 100, 1e3))
		};
	} catch (err) {
		if (isAbort(err)) return {
			ok: false,
			logs: "",
			message: "Timed out"
		};
		return {
			ok: false,
			logs: "",
			message: errorMessage(err)
		};
	}
}
async function k8sSetImage(params) {
	if (!params.image) return fail("Missing image");
	try {
		await clientFrom(params).setDeploymentImage(params.namespace, params.name, params.image, params.container);
		return { ok: true };
	} catch (err) {
		return fail(errorMessage(err));
	}
}
async function k8sRestart(params) {
	try {
		await clientFrom(params).restartDeployment(params.namespace, params.name);
		return { ok: true };
	} catch (err) {
		return fail(errorMessage(err));
	}
}
//#endregion
//#region src/core/logging.ts
/**
* Plugin log file (~/.dsh-devops/devops.log): append-only with size rotation,
* plus filtered reads served to the dashboard Logs tab.
*/
const DEVOPS_DIR = join(homedir(), ".dsh-devops");
const CONFIG_FILE = join(DEVOPS_DIR, "config.json");
const LOG_FILE = join(DEVOPS_DIR, "devops.log");
const MAX_LOG_SIZE = 5242880;
function ensureDevopsDir() {
	if (!existsSync(DEVOPS_DIR)) mkdirSync(DEVOPS_DIR, { recursive: true });
}
/** Write a log entry to ~/.dsh-devops/devops.log (best-effort, never throws). */
function writeLog(level, message, detail) {
	try {
		ensureDevopsDir();
		try {
			if (statSync(LOG_FILE).size > MAX_LOG_SIZE) {
				const content = readFileSync(LOG_FILE, "utf8");
				writeFileSync(LOG_FILE, content.slice(-524288), "utf8");
			}
		} catch {}
		const line = `[${(/* @__PURE__ */ new Date()).toISOString()}] [${level.toUpperCase()}] ${message}${detail ? " | " + detail : ""}\n`;
		appendFileSync(LOG_FILE, line, "utf8");
	} catch {}
}
/** Read log entries for the dashboard (level/search filters, last-N tail). */
function readLogs(params = {}) {
	try {
		if (!existsSync(LOG_FILE)) return {
			ok: true,
			lines: []
		};
		let allLines = readFileSync(LOG_FILE, "utf8").split("\n").filter(Boolean);
		const level = (params.level ?? "").toLowerCase();
		if (level) allLines = allLines.filter((l) => l.includes(`[${level.toUpperCase()}]`));
		const search = (params.search ?? "").toLowerCase();
		if (search) allLines = allLines.filter((l) => l.toLowerCase().includes(search));
		const limit = Math.min(Number(params.lines) || 200, 5e3);
		return {
			ok: true,
			lines: allLines.slice(-limit)
		};
	} catch (err) {
		return {
			ok: false,
			lines: [],
			message: err.message
		};
	}
}
//#endregion
//#region src/host/config-store.ts
/**
* Settings-file store: ~/.dsh-devops/config.json.
*
* This is what Settings → DevOps writes; tools and the monitor resolve it
* lazily so dashboard changes apply without a restart. Includes the legacy
* single-server → multi-server migration.
*/
/** Read the raw settings file (null when missing/corrupt). */
function readSettingsFile() {
	try {
		if (!existsSync(CONFIG_FILE)) return null;
		return JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
	} catch {
		return null;
	}
}
/**
* Shallow-merge `patch` into the settings file: sections not present in the
* patch (e.g. saving only k8s) keep their previous value.
*/
function saveSettingsFile(patch) {
	try {
		ensureDevopsDir();
		let existing = {};
		if (existsSync(CONFIG_FILE)) try {
			existing = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
		} catch {
			existing = {};
		}
		if (!existing || typeof existing !== "object" || Array.isArray(existing)) existing = {};
		writeFileSync(CONFIG_FILE, JSON.stringify({
			...existing,
			...patch
		}, null, 2), "utf8");
		writeLog("info", "save-config", "config written");
		return { ok: true };
	} catch (err) {
		const message = err.message;
		writeLog("error", "save-config", message);
		return {
			ok: false,
			message: `保存失败: ${message}`
		};
	}
}
/**
* Migrate the legacy single-server config shape to the multi-server shape.
* Legacy: {gitlab: {baseUrl, token, projects: [...]}, k8s: {kubeconfigPath, ...}}
* Target: {gitlab: {servers: [...], activeServerId}, k8s: {kubeconfigs: [...], activeKubeconfigId}}
*/
function migrateSettingsFile(raw) {
	const out = JSON.parse(JSON.stringify(raw ?? {}));
	const gl = out.gitlab = out.gitlab ?? {};
	if (!Array.isArray(gl.servers) && gl.baseUrl) {
		const legacyProject = Array.isArray(gl.projects) ? gl.projects[0] : null;
		gl.servers = [{
			id: "s1",
			label: "GitLab",
			baseUrl: gl.baseUrl,
			token: gl.token || "",
			projectPath: legacyProject?.path || "",
			branch: legacyProject?.defaultBranch || legacyProject?.branch || ""
		}];
	}
	delete gl.baseUrl;
	delete gl.token;
	delete gl.projects;
	delete gl.defaultProject;
	gl.servers = (gl.servers ?? []).filter((s) => s && s.id);
	if (!gl.activeServerId || !gl.servers.some((s) => s.id === gl.activeServerId)) gl.activeServerId = gl.servers[0]?.id ?? null;
	const k8s = out.k8s = out.k8s ?? {};
	if (!Array.isArray(k8s.kubeconfigs) && k8s.kubeconfigPath) k8s.kubeconfigs = [{
		id: "k1",
		path: k8s.kubeconfigPath,
		context: k8s.context || "",
		namespace: k8s.namespace || ""
	}];
	delete k8s.kubeconfigPath;
	delete k8s.context;
	delete k8s.namespace;
	k8s.kubeconfigs = (k8s.kubeconfigs ?? []).map((k) => ({
		...k,
		label: k.label || (k.path ? k.path.split(/[\\/]/).pop() : "K8s 配置")
	}));
	if (!k8s.activeKubeconfigId || !k8s.kubeconfigs.some((k) => k.id === k8s.activeKubeconfigId)) k8s.activeKubeconfigId = k8s.kubeconfigs[0]?.id ?? null;
	return out;
}
//#endregion
//#region src/host/runtime-config.ts
const NOT_CONFIGURED_MSG = "[dsh-devops] Not configured yet — open DSH Settings → DevOps, add the connection info, and save.";
/** Read + migrate the settings file (null when missing/corrupt). */
function loadMigratedSettings() {
	const raw = readSettingsFile();
	if (!raw) return null;
	return migrateSettingsFile(raw);
}
/**
* Resolve the effective GitLab config.
* Returns null when neither source has a usable GitLab section.
*/
function resolveGitLabConfig(cordisRaw) {
	const raw = cordisRaw && typeof cordisRaw === "object" ? cordisRaw : {};
	if (raw.gitlab && typeof raw.gitlab === "object" && raw.gitlab.baseUrl) return raw.gitlab;
	const gl = loadMigratedSettings()?.gitlab;
	if (!gl) return null;
	const servers = Array.isArray(gl.servers) ? gl.servers : [];
	const usable = servers.filter((s) => s.baseUrl && s.token);
	const active = servers.find((s) => s.id === gl.activeServerId && s.baseUrl && s.token) ?? usable[0];
	if (!active || !active.baseUrl || !active.token || !active.projectPath) return null;
	return {
		baseUrl: active.baseUrl,
		token: active.token,
		defaultProject: active.id,
		projects: usable.map((s) => ({
			id: s.id,
			path: s.projectPath || "",
			token: s.token,
			defaultBranch: s.branch || void 0
		}))
	};
}
/**
* Resolve the effective K8s config.
* Returns null when neither source has a usable K8s section.
*/
function resolveK8sConfig(cordisRaw) {
	const raw = cordisRaw && typeof cordisRaw === "object" ? cordisRaw : {};
	if (raw.k8s && typeof raw.k8s === "object" && Array.isArray(raw.k8s.kubeconfigs) && raw.k8s.kubeconfigs.length) return raw.k8s;
	const k8s = loadMigratedSettings()?.k8s;
	if (!k8s) return null;
	const usable = (Array.isArray(k8s.kubeconfigs) ? k8s.kubeconfigs : []).filter((k) => k.path);
	if (!usable.length) return null;
	const active = usable.find((k) => k.id === k8s.activeKubeconfigId) ?? usable[0];
	if (!active) return null;
	return {
		kubeconfigs: usable.map((k) => ({
			id: k.id,
			path: k.path,
			context: k.context || void 0,
			namespace: k.namespace || void 0
		})),
		defaultContext: active.id
	};
}
//#endregion
//#region src/host/endpoints-app.ts
/**
* App-level RPC endpoints: settings file persistence, plugin log retrieval,
* and the native kubeconfig file browse dialog (Windows).
*/
async function configLoad(_params) {
	return {
		ok: true,
		config: loadMigratedSettings()
	};
}
async function configSave(params) {
	const result = saveSettingsFile(params);
	return {
		ok: result.ok,
		message: result.ok ? "配置已保存" : result.message
	};
}
async function logs(params = {}) {
	return readLogs(params);
}
/**
* Native file browse (Windows only): a PowerShell OpenFileDialog so the user
* can pick a kubeconfig without typing paths.
*/
async function browseFile(_params) {
	if (process.platform !== "win32") return {
		ok: false,
		path: "",
		message: "File browse not supported on this platform"
	};
	const script = [
		"Add-Type -AssemblyName System.Windows.Forms",
		"$d = New-Object System.Windows.Forms.OpenFileDialog",
		"$d.Title = '选择 kubeconfig 文件'",
		"$d.Filter = '配置文件 (*.yaml;*.yml;*.json;*.config)|*.yaml;*.yml;*.json;*.config|所有文件 (*.*)|*.*'",
		"$r = $d.ShowDialog()",
		"if ($r -eq [System.Windows.Forms.DialogResult]::OK) { $d.FileName }"
	].join("; ");
	return new Promise((resolve) => {
		execFile("powershell", [
			"-NoProfile",
			"-NonInteractive",
			"-Command",
			script
		], { timeout: 12e4 }, (err, stdout) => {
			const path = stdout?.trim();
			if (err && !path) resolve({
				ok: false,
				path: "",
				message: err.message
			});
			else resolve({
				ok: true,
				path: path || ""
			});
		});
	});
}
//#endregion
//#region src/host/rpc.ts
function success(value) {
	return {
		ok: true,
		value
	};
}
function failure(error) {
	return {
		ok: false,
		error: {
			code: "internal",
			message: error instanceof Error ? error.message : String(error),
			details: {}
		}
	};
}
const READ_ENDPOINTS = {
	"test-gitlab": testGitLab,
	"gitlab-projects": gitlabProjects,
	"gitlab-branches": gitlabBranches,
	"gitlab-members": gitlabMembers,
	"gitlab-last-commit": gitlabLastCommit,
	"gitlab-mrs": gitlabMRs,
	"gitlab-pipelines": gitlabPipelines,
	"gitlab-tags": gitlabTags,
	"gitlab-pipeline-jobs": gitlabPipelineJobs,
	"gitlab-job-log": gitlabJobLog,
	"test-k8s": testK8s,
	"k8s-contexts": k8sContexts,
	"k8s-namespaces": k8sNamespaces,
	"k8s-deployments": k8sDeployments,
	"k8s-pods": k8sPods,
	"k8s-events": k8sEvents,
	"k8s-pod-logs": k8sPodLogs,
	"config-load": configLoad,
	logs,
	"browse-file": browseFile
};
const WRITE_ENDPOINTS = {
	"gitlab-create-mr": gitlabCreateMR,
	"gitlab-create-tag": gitlabCreateTag,
	"gitlab-pipeline-action": gitlabPipelineAction,
	"gitlab-mr-approve": gitlabMRApprove,
	"gitlab-mr-action": gitlabMRAction,
	"k8s-set-image": k8sSetImage,
	"k8s-restart": k8sRestart,
	"config-save": configSave
};
function createChannelHandler(endpoints) {
	return async (endpoint, payload) => {
		const handler = endpoints[endpoint];
		if (!handler) return failure(/* @__PURE__ */ new Error(`Unknown dsh-devops endpoint: ${endpoint}`));
		try {
			return success(await handler(payload));
		} catch (err) {
			return failure(err);
		}
	};
}
/**
* Mount the DevOps RPC channels on the Connection service.
*
* Uses `ctx.inject(['connection'], ...)` so headless profiles (no web
* runtime) simply skip registration instead of failing to load.
*/
function registerDevopsRpc(ctx) {
	ctx.inject?.(["connection"], (webContext) => {
		const connection = webContext?.connection;
		if (!connection?.rpc?.handle) {
			console.warn("[dsh-devops] connection.rpc not available; web console disabled");
			return;
		}
		const readHandler = createChannelHandler(READ_ENDPOINTS);
		const writeHandler = createChannelHandler(WRITE_ENDPOINTS);
		const disposeRead = connection.rpc.handle(DEVOPS_READ_CHANNEL, readHandler, { authority: "trusted-host" });
		const disposeWrite = connection.rpc.handle(DEVOPS_WRITE_CHANNEL, writeHandler, { authority: "loopback" });
		return () => {
			for (const dispose of [disposeRead, disposeWrite]) try {
				typeof dispose === "function" && dispose();
			} catch {}
		};
	});
}
//#endregion
//#region src/host/services.ts
/**
* Lazy service wrappers — GitLab/K8s services that resolve their configuration
* on every call instead of at plugin load time.
*
* This is what makes "install → configure in Settings → AI tools work" possible
* with no restart: tools are registered unconditionally, and each execute()
* re-reads the same settings file the dashboard writes.
*/
function notConfigured() {
	throw new Error(NOT_CONFIGURED_MSG);
}
/**
* GitLab service resolving its config + rebuilding the router on every call.
* Cheap: the underlying client is stateless HTTP, and per-call rebuild keeps
* project/cluster switches from the dashboard immediately effective.
*/
function createLazyGitLabService(log) {
	function router() {
		const cfg = resolveGitLabConfig(void 0);
		if (!cfg) notConfigured();
		try {
			return new GitLabRouter(cfg.baseUrl, cfg.projects, cfg.defaultProject);
		} catch (err) {
			log?.warn?.(`[dsh-devops] GitLab router build failed: ${err.message}`);
			throw err;
		}
	}
	return {
		listProjects: () => {
			const cfg = resolveGitLabConfig(void 0);
			return cfg ? new GitLabRouter(cfg.baseUrl, cfg.projects, cfg.defaultProject).list() : [];
		},
		createMR: (p, source, target, title, description, reviewers) => {
			const r = router().resolve(p);
			return r.client.createMR(r.projectPath, source, target, title, description, reviewers);
		},
		approveMR: (p, iid) => {
			const r = router().resolve(p);
			return r.client.approveMR(r.projectPath, iid).then(() => void 0);
		},
		requestChanges: (p, iid, comment) => {
			const r = router().resolve(p);
			return r.client.requestChanges(r.projectPath, iid, comment);
		},
		commentMR: (p, iid, body) => {
			const r = router().resolve(p);
			return r.client.commentMR(r.projectPath, iid, body);
		},
		listMRs: (p) => {
			const r = router().resolve(p);
			return r.client.listMRs(r.projectPath);
		},
		createTag: (p, name, ref, message) => {
			const r = router().resolve(p);
			return r.client.createTag(r.projectPath, name, ref, message);
		},
		getPipeline: (p, id) => {
			const r = router().resolve(p);
			return r.client.getPipeline(r.projectPath, id);
		},
		getLatestPipelineByRef: (p, ref) => {
			const r = router().resolve(p);
			return r.client.getLatestPipelineByRef(r.projectPath, ref);
		},
		listPipelineJobs: (p, id) => {
			const r = router().resolve(p);
			return r.client.listPipelineJobs(r.projectPath, id);
		},
		getJobLog: (p, id) => {
			const r = router().resolve(p);
			return r.client.getJobLog(r.projectPath, id).then((x) => x.logs);
		}
	};
}
/**
* K8s service resolving its config + rebuilding the router on every call.
* Re-parses kubeconfig files per call (~ms file IO) in exchange for
* always-current cluster/context/namespace selection.
*/
function createLazyK8sService(log) {
	function router() {
		const cfg = resolveK8sConfig(void 0);
		if (!cfg) notConfigured();
		try {
			return new K8sRouter(cfg.kubeconfigs, cfg.defaultContext, cfg.defaultNamespace);
		} catch (err) {
			log?.warn?.(`[dsh-devops] K8s router build failed: ${err.message}`);
			throw err;
		}
	}
	return {
		listClusters: () => {
			const cfg = resolveK8sConfig(void 0);
			return cfg ? new K8sRouter(cfg.kubeconfigs, cfg.defaultContext, cfg.defaultNamespace).list() : [];
		},
		getDefaultNamespace: (cluster) => router().getDefaultNamespace(cluster),
		getDeploymentStatus: (c, ns, name) => router().resolve(c).getDeployment(ns, name),
		getDeploymentStatusList: (c, ns) => router().resolve(c).getDeployments(ns),
		getPodList: (c, ns) => router().resolve(c).getPods(ns),
		getEvents: (c, ns, limit) => router().resolve(c).getEvents(ns, limit),
		getPodLogs: (c, ns, podName, container, tailLines) => router().resolve(c).getPodLogs(ns, podName, container, tailLines)
	};
}
//#endregion
//#region src/host/plugin.ts
const name = "dsh-devops";
/**
* Tools are required (headless profiles have them); the Connection service is
* injected conditionally inside `apply` so headless setups skip the web
* console instead of failing to load.
*/
const inject = ["tools"];
/**
* Plugin apply — called by the DSH/Cordis loader.
*
* @param ctx       - the DSH host context (services, tools, effects, etc.)
* @param rawConfig - raw user config from the cordis patch
*/
function apply(ctx, rawConfig) {
	const config = parseConfig(rawConfig && typeof rawConfig === "object" ? rawConfig : {});
	const gitlabService = createLazyGitLabService();
	const k8sService = createLazyK8sService();
	registerTools(ctx, {
		gitlab: gitlabService,
		k8s: k8sService
	});
	registerDevopsRpc(ctx);
	if (config.webhook) registerWebhook(ctx, config.webhook);
	if (config.monitor) {
		const eagerGitlab = config.gitlab ? createGitLabService(config.gitlab) : gitlabService;
		const eagerK8s = config.k8s ? createK8sService(config.k8s) : k8sService;
		startMonitor(ctx, config.monitor, {
			gitlab: eagerGitlab,
			k8s: eagerK8s
		});
	}
}
//#endregion
export { Config, apply, inject, name };
