import Schema from "@deepseek-ai/schemastery";
import { request } from "node:https";
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { defineTool } from "@deepseek-ai/dsh-tools";

//#region src/config.ts
/**

* Schemastery schema for the plugin config.

*

* Top-level sections (gitlab, k8s, webhook, monitor) are all optional.

* If a section is present, its required sub-fields are enforced here.

* Cross-field rules (webhook requires gitlab, etc.) are handled by parseConfig.

*/
/**

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
		const hasRules = (config.monitor.pipeline?.length ?? 0) > 0 || (config.monitor.pod?.length ?? 0) > 0;
		if (!hasRules) delete config.monitor;
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
//#region src/gitlab/client.ts
var GitLabError = class extends Error {
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
		commitId: raw.commit?.id ?? ""
	};
}
var GitLabClient = class {
	projectUrl;
	constructor(baseUrl, projectPath, token) {
		this.baseUrl = baseUrl;
		this.projectPath = projectPath;
		this.token = token;
		this.projectUrl = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectPath)}`;
	}
	/**
	
	* Send a request to the GitLab API and parse the JSON response.
	
	* Throws {@link GitLabError} on non-2xx status codes.
	
	*/
	async request(method, path, body) {
		const url = path.startsWith("http") ? path : `${this.projectUrl}${path}`;
		const headers = {
			"PRIVATE-TOKEN": this.token,
			"Content-Type": "application/json"
		};
		const res = await fetch(url, {
			method,
			headers,
			body: body !== void 0 ? JSON.stringify(body) : void 0
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
	/** Create a new merge request. */
	async createMR(sourceBranch, targetBranch, title, description) {
		const raw = await this.request("POST", "/merge_requests", {
			source_branch: sourceBranch,
			target_branch: targetBranch,
			title,
			...description !== void 0 ? { description } : {}
		});
		return mapMR(raw);
	}
	/** Approve a merge request. */
	async approveMR(mrIid) {
		await this.request("POST", `/merge_requests/${mrIid}/approve`);
	}
	/** Request changes on a merge request (post a review note with a negative verdict). */
	async requestChanges(mrIid, comment) {
		await this.request("POST", `/merge_requests/${mrIid}/notes`, { body: `🔴 Changes requested: ${comment}` });
	}
	/** Post a comment (note) on a merge request. */
	async commentMR(mrIid, body) {
		await this.request("POST", `/merge_requests/${mrIid}/notes`, { body });
	}
	/** List open merge requests. */
	async listMRs() {
		const raw = await this.request("GET", "/merge_requests?state=opened");
		return raw.map(mapMR);
	}
	/** Create a new tag pointing at the given ref (branch, tag, or commit SHA). */
	async createTag(name$1, ref, message) {
		const raw = await this.request("POST", "/repository/tags", {
			tag_name: name$1,
			ref,
			...message !== void 0 ? { message } : {}
		});
		return mapTag(raw);
	}
	/** Get a single pipeline by its numeric id. */
	async getPipeline(pipelineId) {
		const raw = await this.request("GET", `/pipelines/${pipelineId}`);
		return mapPipeline(raw);
	}
	/** Get the latest pipeline for a given ref (branch/tag). */
	async getLatestPipelineByRef(ref) {
		const raw = await this.request("GET", `/pipelines?ref=${encodeURIComponent(ref)}&order_by=id&sort=desc&per_page=1`);
		if (!Array.isArray(raw) || raw.length === 0) return void 0;
		return mapPipeline(raw[0]);
	}
	/** List all jobs in a pipeline. */
	async listPipelineJobs(pipelineId) {
		const raw = await this.request("GET", `/pipelines/${pipelineId}/jobs`);
		return raw.map(mapJob);
	}
	/** Fetch the log output of a job. */
	async getJobLog(jobId) {
		const url = `${this.projectUrl}/jobs/${jobId}/log`;
		const res = await fetch(url, { headers: { "PRIVATE-TOKEN": this.token } });
		if (!res.ok) throw new GitLabError(res.status, "unknown", `Failed to fetch job log: ${res.status}`);
		return res.text();
	}
};

//#endregion
//#region src/gitlab/router.ts
var GitLabRouter = class {
	clients;
	constructor(baseUrl, projects, defaultProject) {
		this.baseUrl = baseUrl;
		this.defaultProject = defaultProject;
		this.clients = new Map();
		for (const p of projects) {
			const token = p.token ?? (p.tokenEnv ? process.env[p.tokenEnv] : void 0);
			if (!token) throw new Error(`[dsh-devops] GitLab project "${p.id}": no direct token and environment variable "${p.tokenEnv}" is not set`);
			this.clients.set(p.id, new GitLabClient(baseUrl, p.path, token));
		}
	}
	/**
	
	* Resolve a {@link GitLabClient} for the given project id,
	
	* or fall back to the configured default project.
	
	*/
	resolve(id) {
		const key = id ?? this.defaultProject;
		if (!key) throw new Error("[dsh-devops] GitLab: no project id provided and no defaultProject configured");
		const client = this.clients.get(key);
		if (!client) {
			const available = [...this.clients.keys()].join(", ");
			throw new Error(`[dsh-devops] GitLab: unknown project id "${key}". Available: ${available}`);
		}
		return client;
	}
	/** Return all configured project ids. */
	list() {
		return [...this.clients.keys()];
	}
};

//#endregion
//#region src/gitlab/index.ts
/**

* Register the GitLab service with the DSH context.

*

* @param ctx    — DSH host context (typed `any`; carries the full Cordis API at runtime)

* @param config — parsed GitLab configuration section

* @returns the public {@link GitLabService} instance

*/
function registerGitLab(ctx, config) {
	const router = new GitLabRouter(config.baseUrl, config.projects, config.defaultProject);
	ctx.effect(() => {
		return () => {};
	}, "gitlab");
	const service = {
		listProjects: () => router.list(),
		createMR: (project, sourceBranch, targetBranch, title, description) => router.resolve(project).createMR(sourceBranch, targetBranch, title, description),
		approveMR: (project, mrIid) => router.resolve(project).approveMR(mrIid),
		requestChanges: (project, mrIid, comment) => router.resolve(project).requestChanges(mrIid, comment),
		commentMR: (project, mrIid, body) => router.resolve(project).commentMR(mrIid, body),
		listMRs: (project) => router.resolve(project).listMRs(),
		createTag: (project, name$1, ref, message) => router.resolve(project).createTag(name$1, ref, message),
		getPipeline: (project, pipelineId) => router.resolve(project).getPipeline(pipelineId),
		getLatestPipelineByRef: (project, ref) => router.resolve(project).getLatestPipelineByRef(ref),
		listPipelineJobs: (project, pipelineId) => router.resolve(project).listPipelineJobs(pipelineId),
		getJobLog: (project, jobId) => router.resolve(project).getJobLog(jobId)
	};
	return service;
}

//#endregion
//#region src/k8s/client.ts
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
function toPodInfo(p, fallbackNamespace) {
	const s = p.status ?? {};
	const containers = (s.containerStatuses ?? []).map((c) => ({
		name: c.name ?? "",
		ready: c.ready ?? false,
		restartCount: c.restartCount ?? 0
	}));
	const phaseStr = s.phase ?? "";
	return {
		name: p.metadata?.name ?? "",
		namespace: p.metadata?.namespace ?? fallbackNamespace,
		phase: inSet(phaseStr, POD_PHASES) ? phaseStr : "Unknown",
		nodeName: s.nodeName,
		restartCount: containers.reduce((sum, c) => sum + c.restartCount, 0),
		containers,
		startTime: s.startTime
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
		lastTimestamp: e.lastTimestamp ?? ""
	};
}
var K8sClient = class {
	ctx;
	server;
	constructor(ctx) {
		this.ctx = ctx;
		this.server = ctx.server.replace(/\/+$/, "");
	}
	/** Authenticated GET returning parsed JSON. */
	async getJson(path) {
		const res = await this.fetch(path, "application/json");
		return await res.json();
	}
	/** Authenticated GET returning the body as text. */
	async getText(path) {
		const res = await this.fetch(path, "application/json");
		return res.text();
	}
	async fetch(path, accept) {
		const url = new URL(`${this.server}${path}`);
		const ca = this.ctx.caData ? Buffer.from(this.ctx.caData, "base64") : void 0;
		const res = await new Promise((resolve, reject) => {
			const req = request({
				hostname: url.hostname,
				port: url.port || 443,
				path: `${url.pathname}${url.search}`,
				method: "GET",
				headers: {
					Authorization: `Bearer ${this.ctx.token}`,
					Accept: accept
				},
				...this.ctx.insecureSkipTlsVerify ? { rejectUnauthorized: false } : ca ? {
					ca,
					rejectUnauthorized: true,
					checkServerIdentity: () => void 0
				} : {}
			}, (upstream) => {
				const chunks = [];
				upstream.on("data", (c) => chunks.push(c));
				upstream.on("end", () => {
					const body = Buffer.concat(chunks).toString("utf8");
					const status = upstream.statusCode ?? 0;
					const bodyless = status === 204 || status === 304;
					resolve(new Response(bodyless ? null : body, {
						status,
						statusText: upstream.statusMessage ?? ""
					}));
				});
			});
			req.on("error", reject);
			req.end();
		}).catch((err) => {
			throw new Error(`[k8s] request to ${path} failed: ${err.message}`);
		});
		if (!res.ok) {
			const body = await res.text().catch(() => "");
			throw new Error(`[k8s] GET ${path} failed: ${res.status} ${res.statusText}${body ? ` — ${truncate(body)}` : ""}`);
		}
		return res;
	}
	/** List all deployments in a namespace. */
	async getDeployments(namespace) {
		const data = await this.getJson(`/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments`);
		return data.items.map((d) => toDeploymentStatus(d, namespace));
	}
	/** Get a single deployment by name. */
	async getDeployment(namespace, name$1) {
		const d = await this.getJson(`/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name$1)}`);
		return toDeploymentStatus(d, namespace);
	}
	/** List all pods in a namespace. */
	async getPods(namespace) {
		const data = await this.getJson(`/api/v1/namespaces/${encodeURIComponent(namespace)}/pods`);
		return data.items.map((p) => toPodInfo(p, namespace));
	}
	/** List recent events in a namespace, optionally limited. */
	async getEvents(namespace, limit) {
		const q = limit ? `?limit=${limit}` : "";
		const data = await this.getJson(`/api/v1/namespaces/${encodeURIComponent(namespace)}/events${q}`);
		return data.items.map((e) => toK8sEvent(e, namespace));
	}
	/** Fetch (tail of) a pod's logs. */
	async getPodLogs(namespace, podName, container, tailLines) {
		const params = new URLSearchParams();
		if (container) params.set("container", container);
		if (tailLines != null) params.set("tailLines", String(tailLines));
		const qs = params.toString();
		const path = `/api/v1/namespaces/${encodeURIComponent(namespace)}/pods/${encodeURIComponent(podName)}/log${qs ? `?${qs}` : ""}`;
		return this.getText(path);
	}
};

//#endregion
//#region src/k8s/kubeconfig.ts
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
//#region src/k8s/router.ts
var K8sRouter = class {
	clusters = new Map();
	defaultClientId;
	defaultNamespace;
	/**
	
	* @param kubeconfigs     One entry per cluster. Each `id` is the routing key.
	
	* @param defaultContext  Preferred default cluster. Used as the default when it
	
	*                        matches a configured `id`; otherwise the first cluster.
	
	*                        (Also passed to each file whose ref omits `context`.)
	
	* @param defaultNamespace Fallback namespace applied when neither a ref nor its
	
	*                        context specifies one.
	
	*/
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

//#endregion
//#region src/k8s/index.ts
/**

* Register the K8s service with the DSH context.

*

* Eagerly parses every configured kubeconfig so misconfiguration surfaces at

* startup (inside the lifecycle effect) rather than on first use.

*

* @param ctx    — DSH host context (carries the full Cordis API at runtime)

* @param config — parsed K8s configuration section

* @returns the public {@link K8sService} instance

*/
function registerK8s(ctx, config) {
	const router = new K8sRouter(config.kubeconfigs, config.defaultContext, config.defaultNamespace);
	ctx.effect(() => {
		const ids = router.list();
		ctx.log?.warn?.(`[dsh-devops:k8s] ready — ${ids.length} cluster(s): ${ids.join(", ")}`);
		return () => {};
	}, "dsh-devops:k8s");
	const service = {
		listClusters: () => router.list(),
		getDefaultNamespace: (cluster) => router.getDefaultNamespace(cluster),
		getDeploymentStatus: (cluster, namespace, name$1) => router.resolve(cluster).getDeployment(namespace, name$1),
		getDeploymentStatusList: (cluster, namespace) => router.resolve(cluster).getDeployments(namespace),
		getPodList: (cluster, namespace) => router.resolve(cluster).getPods(namespace),
		getEvents: (cluster, namespace, limit) => router.resolve(cluster).getEvents(namespace, limit),
		getPodLogs: (cluster, namespace, podName, container, tailLines) => router.resolve(cluster).getPodLogs(namespace, podName, container, tailLines)
	};
	return service;
}

//#endregion
//#region src/tools/pipeline-watch.ts
/**

* Pipeline watch: polls pipeline status and follows up on completion/failure.

*

* Called automatically after gitlab_mr_create, or manually via gitlab_pipeline_watch.

*/
const POLL_INTERVAL_MS = 3e4;
const MAX_DURATION_MS = 30 * 60 * 1e3;
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
					const jobs = await gitlab.listPipelineJobs(resolvedProject, pipeline.id);
					const failed = jobs.filter((j) => j.status === "failed").map((j) => j.name);
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
//#region src/tools/gitlab.ts
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
		ctx.log?.warn?.("[dsh-devops] ctx.tools not available, skipping GitLab tool registration");
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
			const mr = await gitlab.createMR(project, args.source_branch, args.target_branch, args.title, args.description);
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
//#region src/tools/k8s.ts
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
		ctx.log?.warn?.("[dsh-devops] ctx.tools not available, skipping K8s tool registration");
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
			if (args.name) {
				const dep = await k8s.getDeploymentStatus(cluster, ns, args.name);
				return formatDeployment(dep);
			}
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
			const logs = await k8s.getPodLogs(cluster, ns, pod, container, tailLines);
			return {
				pod,
				namespace: ns,
				tail_lines: tailLines,
				logs
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
//#region src/tools/index.ts
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
	tool.execute = async (args) => pruneUndefined(await execute(args));
	return tool;
}
function registerTools(ctx, services) {
	if (services.gitlab) registerGitLabTools(ctx, services.gitlab);
	if (services.k8s) registerK8sTools(ctx, services.k8s);
}

//#endregion
//#region src/webhook/handler.ts
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
const MR_ACTIONS = new Set([
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
	const mrAction = action;
	return {
		type: "merge_request",
		action: mrAction
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
		case "tag_push": {
			const ref = str(safeGet(payload, "ref"));
			return `🏷️ 新 Tag: ${ref}`;
		}
		case "note": {
			const mrId = str(safeGet(payload, "merge_request.iid")) || str(safeGet(payload, "object_attributes.merge_request_id"));
			const note = str(safeGet(payload, "object_attributes.note"));
			const truncated = note.length > 200 ? `${note.slice(0, 200)}…` : note;
			return `💬 MR !${mrId} 新评论: ${truncated}`;
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
//#region src/webhook/index.ts
/**

* Read a header value from an untyped req object, trying both the original

* case and the lower-case form (Node.js normalises to lower-case, but some

* frameworks preserve the original case).

*/
function getHeader(req, name$1) {
	const headers = req?.headers ?? {};
	if (headers[name$1] != null) return String(headers[name$1]);
	const lower = name$1.toLowerCase();
	if (headers[lower] != null) return String(headers[lower]);
	return void 0;
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
		const token = getHeader(req, "X-Gitlab-Token") ?? "";
		if (token !== config.secret) {
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
		ctx.log?.error("[dsh-devops:webhook] Error handling webhook request", err);
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
			const endpoint = ctx.webhook.register({
				path: WEBHOOK_PATH,
				method: "POST",
				secret: config.secret
			});
			endpoint.onEvent((req, res) => {
				handleWebhookRequest(req, res, ctx, config);
			});
			ctx.log?.warn(`[dsh-devops:webhook] Registered webhook via ctx.webhook at ${WEBHOOK_PATH}`);
			return;
		}
		if (ctx.http?.register) {
			const endpoint = ctx.http.register({
				path: WEBHOOK_PATH,
				method: "POST"
			});
			endpoint.onEvent((req, res) => {
				handleWebhookRequest(req, res, ctx, config);
			});
			ctx.log?.warn(`[dsh-devops:webhook] Registered webhook via ctx.http fallback at ${WEBHOOK_PATH}`);
			return;
		}
		ctx.log?.warn("[dsh-devops:webhook] Neither ctx.webhook nor ctx.http is available; skipping webhook registration. Webhook notifications will not work.");
	}, "webhook-register");
}

//#endregion
//#region src/monitor/throttle.ts
/**

* Alert throttling — suppresses duplicate alerts within a cooldown window.

*/
const lastFired = new Map();
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
//#region src/monitor/rules.ts
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
			const key = `pipeline:${project}:${pipeline.ref}:${pipeline.id}:${rule.trigger}`;
			if (throttled(key, cooldown)) continue;
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
		const jobs = await gitlab.listPipelineJobs(project, pipeline.id);
		const failed = jobs.filter((j) => j.status === "failed");
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
	const key = `pod:${cluster}:${namespace}:${pod.name}:${rule.trigger}`;
	if (throttled(key, cooldown)) return;
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
//#region src/monitor/index.ts
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
				ctx.log?.error("[dsh-devops:monitor] tick error:", err?.message ?? err);
			}
		}, intervalMs);
		return () => {
			clearInterval(timer);
			clearThrottle();
		};
	}, "dsh-devops:monitor");
}

//#endregion
//#region src/api.ts
function writeJson(res, status, body) {
	res.writeHead(status, { "Content-Type": "application/json" });
	res.end(JSON.stringify(body));
}
function readBody(req) {
	if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
	if (req.readable === false || req.readable === void 0 && req._readableState?.readable === false) return Promise.resolve(req.body ?? {});
	return new Promise((resolve, reject) => {
		let data = "";
		let settled = false;
		const finish = (val) => {
			if (!settled) {
				settled = true;
				resolve(val);
			}
		};
		const fail = (err) => {
			if (!settled) {
				settled = true;
				reject(err);
			}
		};
		req.on("data", (chunk) => {
			data += chunk;
		});
		req.on("end", () => {
			try {
				finish(data ? JSON.parse(data) : {});
			} catch {
				finish({});
			}
		});
		req.on("error", fail);
		setTimeout(() => {
			if (!settled) try {
				finish(data ? JSON.parse(data) : {});
			} catch {
				finish({});
			}
		}, 1e3).unref();
	});
}
/** Check if the request is from localhost. */
function isLocalhost(req) {
	const addr = req.socket?.remoteAddress ?? "";
	return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
}
/** Mask secret header values for logging. */
function maskHeaders(headers) {
	if (!headers) return "{}";
	try {
		const h = new Headers(headers);
		const out = {};
		h.forEach((v, k) => {
			out[k] = /token|authorization|key|cookie/i.test(k) ? v.slice(0, 6) + "***" : v;
		});
		return JSON.stringify(out);
	} catch {
		return "{}";
	}
}
/** Fetch with timeout via AbortController. Logs URL + request + response to devops.log.
*  When `tls` is given (a resolved kubeconfig context), the cluster CA is pinned
*  (or verification skipped on insecureSkipTlsVerify) — native fetch cannot do per-request CAs. */
async function fetchWithTimeout(url, init, ms = 5e3, tls) {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), ms);
	const method = (init.method ?? "GET").toUpperCase();
	const bodySnippet = init.body ? String(init.body).slice(0, 300) : "";
	writeLog("info", "API-REQ", `${method} ${url} | headers=${maskHeaders(init.headers)}${bodySnippet ? " | body=" + bodySnippet : ""}`);
	const started = Date.now();
	try {
		let res;
		if (tls?.caData || tls?.insecureSkipTlsVerify) res = await httpsGet(url, {
			headers: init.headers,
			signal: ctrl.signal,
			ca: tls.caData ? Buffer.from(tls.caData, "base64") : void 0,
			insecureSkipTlsVerify: tls.insecureSkipTlsVerify
		});
		else res = await fetch(url, {
			...init,
			signal: ctrl.signal
		});
		const text = await res.text();
		writeLog(res.ok ? "info" : "warn", "API-RES", `${res.status} ${method} ${url} | ${Date.now() - started}ms | ${text.slice(0, 800)}`);
		const bodyless = res.status === 204 || res.status === 304;
		return new Response(bodyless ? null : text, {
			status: res.status,
			statusText: res.statusText,
			headers: res.headers
		});
	} catch (err) {
		writeLog("error", "API-ERR", `${method} ${url} | ${Date.now() - started}ms | ${err.name === "AbortError" ? `timeout(${ms}ms)` : err.message ?? "unknown"}`);
		throw err;
	} finally {
		clearTimeout(timer);
	}
}
/** GET via node:https with an optional pinned CA (fetch cannot set a per-request CA). */
function httpsGet(url, opts) {
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
				resolve(new Response(Buffer.concat(chunks).toString("utf8"), {
					status: upstream.statusCode ?? 0,
					statusText: upstream.statusMessage ?? ""
				}));
			});
		});
		req.on("error", reject);
		opts.signal?.addEventListener("abort", () => req.destroy(new Error("AbortError")));
		if (opts.body) req.write(opts.body);
		req.end();
	});
}
async function testGitLab(params) {
	const { baseUrl, token } = params;
	if (!baseUrl || !token) return {
		ok: false,
		message: "Missing required fields: baseUrl, token"
	};
	try {
		const url = `${baseUrl.replace(/\/+$/, "")}/api/v4/user`;
		const res = await fetchWithTimeout(url, { headers: { "PRIVATE-TOKEN": token } });
		if (res.status === 401) return {
			ok: false,
			message: "Authentication failed (401) — token invalid or expired"
		};
		if (!res.ok) return {
			ok: false,
			message: `GitLab API error: ${res.status} ${res.statusText}`
		};
		const user = await res.json();
		return {
			ok: true,
			message: `Connected as ${user.username ?? user.name ?? "user"}`
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			message: "Connection timed out (5s)"
		};
		return {
			ok: false,
			message: `Network error: ${err.message}`
		};
	}
}
/** Fetch/search projects visible to the token. Optional `search` keyword for server-side filtering. */
async function gitlabProjects(params) {
	const { baseUrl, token, search } = params;
	if (!baseUrl || !token) return {
		ok: false,
		projects: [],
		message: "Missing baseUrl or token"
	};
	try {
		const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
		const url = `${baseUrl.replace(/\/+$/, "")}/api/v4/projects?membership=true&per_page=100&order_by=last_activity_at&sort=desc${searchParam}`;
		const res = await fetchWithTimeout(url, { headers: { "PRIVATE-TOKEN": token } }, 2e4);
		if (!res.ok) return {
			ok: false,
			projects: [],
			message: `GitLab API error: ${res.status}`
		};
		const raw = await res.json();
		const projects = raw.map((p) => ({
			id: String(p.id),
			name: p.name,
			path: p.path_with_namespace,
			defaultBranch: p.default_branch
		}));
		return {
			ok: true,
			projects
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			projects: [],
			message: "Timed out"
		};
		return {
			ok: false,
			projects: [],
			message: err.message
		};
	}
}
async function gitlabBranches(params) {
	const { baseUrl, path, token, search } = params;
	if (!token) return {
		ok: false,
		branches: [],
		message: "Missing token"
	};
	try {
		const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
		const url = `${baseUrl.replace(/\/+$/, "")}/api/v4/projects/${encodeURIComponent(path)}/repository/branches?per_page=100${searchParam}`;
		const res = await fetchWithTimeout(url, { headers: { "PRIVATE-TOKEN": token } }, 12e3);
		if (!res.ok) {
			const detail = await res.text().catch(() => "");
			return {
				ok: false,
				branches: [],
				message: `GitLab API error: ${res.status}${detail ? " | " + detail.slice(0, 120) : ""}`
			};
		}
		const raw = await res.json();
		return {
			ok: true,
			branches: raw.map((b) => ({
				name: b.name,
				isDefault: b.default === true
			}))
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			branches: [],
			message: "Timed out"
		};
		return {
			ok: false,
			branches: [],
			message: err.message
		};
	}
}
/** Latest commit on a branch (for MR description auto-fill). */
async function gitlabLastCommit(params) {
	const { baseUrl, path, token, branch } = params;
	if (!token || !branch) return {
		ok: false,
		message: "Missing token or branch"
	};
	try {
		const url = `${baseUrl.replace(/\/+$/, "")}/api/v4/projects/${encodeURIComponent(path)}/repository/commits?ref_name=${encodeURIComponent(branch)}&per_page=1`;
		const res = await fetchWithTimeout(url, { headers: { "PRIVATE-TOKEN": token } }, 12e3);
		if (!res.ok) {
			const detail = await res.text().catch(() => "");
			return {
				ok: false,
				message: `GitLab API error: ${res.status}${detail ? " | " + detail.slice(0, 120) : ""}`
			};
		}
		const raw = await res.json();
		const c = raw[0];
		if (!c) return {
			ok: false,
			message: "分支上没有提交"
		};
		return {
			ok: true,
			shortId: c.short_id ?? "",
			title: c.title ?? "",
			message: (c.message ?? "").trim(),
			author: c.author_name ?? "",
			date: c.committed_date ?? ""
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			message: "Timed out"
		};
		return {
			ok: false,
			message: err.message
		};
	}
}
/** List project members (for the MR reviewer dropdown). */
async function gitlabMembers(params) {
	const { baseUrl, path, token, search } = params;
	if (!token) return {
		ok: false,
		members: [],
		message: "Missing token"
	};
	try {
		const searchParam = search ? `&query=${encodeURIComponent(search)}` : "";
		const url = `${baseUrl.replace(/\/+$/, "")}/api/v4/projects/${encodeURIComponent(path)}/members/all?per_page=100${searchParam}`;
		const res = await fetchWithTimeout(url, { headers: { "PRIVATE-TOKEN": token } }, 12e3);
		if (!res.ok) {
			const detail = await res.text().catch(() => "");
			return {
				ok: false,
				members: [],
				message: `GitLab API error: ${res.status}${detail ? " | " + detail.slice(0, 120) : ""}`
			};
		}
		const raw = await res.json();
		return {
			ok: true,
			members: raw.map((m) => ({
				username: m.username,
				name: m.name
			}))
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			members: [],
			message: "Timed out"
		};
		return {
			ok: false,
			members: [],
			message: err.message
		};
	}
}
async function testK8s(params) {
	const { kubeconfigPath, context } = params;
	if (!kubeconfigPath) return {
		ok: false,
		message: "Missing kubeconfigPath"
	};
	try {
		const kctx = parseKubeconfig(kubeconfigPath, context);
		const res = await fetchWithTimeout(`${kctx.server}/version`, { headers: {
			Authorization: `Bearer ${kctx.token}`,
			Accept: "application/json"
		} }, 5e3, kctx);
		if (res.status === 401) return {
			ok: false,
			message: "K8s API: token rejected (401) — token expired or invalid"
		};
		if (res.status === 403) return {
			ok: false,
			message: "K8s API: forbidden (403) — insufficient RBAC permissions"
		};
		if (!res.ok) return {
			ok: false,
			message: `K8s API error: ${res.status} ${res.statusText}`
		};
		const info = await res.json();
		const expanded = expandPath(kubeconfigPath);
		let contexts = [];
		try {
			const { readFileSync: readFileSync$1 } = await import("node:fs");
			const { parse: parse$1 } = await import("yaml");
			const doc = parse$1(readFileSync$1(expanded, "utf8"));
			contexts = (doc?.contexts ?? []).map((c) => ({
				name: c?.name ?? "",
				namespace: c?.context?.namespace ?? ""
			})).filter((c) => c.name);
		} catch {}
		return {
			ok: true,
			message: `Connected to ${kctx.server} (${info.gitVersion ?? "unknown version"})`,
			server: kctx.server,
			namespace: kctx.namespace,
			contexts
		};
	} catch (err) {
		return {
			ok: false,
			message: err.message
		};
	}
}
async function k8sContexts(params) {
	const { kubeconfigPath } = params;
	if (!kubeconfigPath) return {
		ok: false,
		contexts: [],
		message: "Missing kubeconfigPath"
	};
	try {
		const expanded = expandPath(kubeconfigPath);
		const { readFileSync: readFileSync$1 } = await import("node:fs");
		const { parse: parse$1 } = await import("yaml");
		const doc = parse$1(readFileSync$1(expanded, "utf8"));
		const contexts = (doc?.contexts ?? []).map((c) => ({
			name: c?.name ?? "",
			namespace: c?.context?.namespace ?? ""
		})).filter((c) => c.name);
		return {
			ok: true,
			contexts
		};
	} catch (err) {
		return {
			ok: false,
			contexts: [],
			message: err.message
		};
	}
}
async function k8sNamespaces(params) {
	const { kubeconfigPath, context } = params;
	try {
		const kctx = parseKubeconfig(kubeconfigPath, context);
		const res = await fetchWithTimeout(`${kctx.server}/api/v1/namespaces`, { headers: {
			Authorization: `Bearer ${kctx.token}`,
			Accept: "application/json"
		} }, 5e3, kctx);
		if (!res.ok) return {
			ok: false,
			namespaces: [],
			message: `K8s API error: ${res.status}`
		};
		const data = await res.json();
		const namespaces = data.items.filter((ns) => ns.status?.phase === "Active" || !ns.status).map((ns) => ns.metadata.name);
		return {
			ok: true,
			namespaces
		};
	} catch (err) {
		return {
			ok: false,
			namespaces: [],
			message: err.message
		};
	}
}
async function k8sDeployments(params) {
	const { kubeconfigPath, context, namespace } = params;
	try {
		const kctx = parseKubeconfig(kubeconfigPath, context);
		const ns = namespace || kctx.namespace;
		const res = await fetchWithTimeout(`${kctx.server}/apis/apps/v1/namespaces/${encodeURIComponent(ns)}/deployments`, { headers: {
			Authorization: `Bearer ${kctx.token}`,
			Accept: "application/json"
		} }, 1e4, kctx);
		if (!res.ok) return {
			ok: false,
			deployments: [],
			message: `K8s API error: ${res.status}`
		};
		const data = await res.json();
		const deployments = (data.items ?? []).map((d) => {
			const spec = d.spec ?? {};
			const status = d.status ?? {};
			const image = spec?.template?.spec?.containers?.[0]?.image ?? "";
			return {
				name: d.metadata?.name ?? "",
				ready: status.readyReplicas ?? 0,
				replicas: status.replicas ?? spec.replicas ?? 0,
				image,
				imageTag: (image.split(":")[1] ?? "").slice(0, 24),
				updated: d.metadata?.creationTimestamp ?? ""
			};
		});
		return {
			ok: true,
			deployments
		};
	} catch (err) {
		return {
			ok: false,
			deployments: [],
			message: err.message
		};
	}
}
/** List merge requests for a project. */
async function gitlabMRs(params) {
	const { baseUrl, token, projectPath, state } = params;
	if (!baseUrl || !token || !projectPath) return {
		ok: false,
		mergeRequests: [],
		message: "Missing baseUrl, token or projectPath"
	};
	try {
		const stateParam = state ? `&state=${encodeURIComponent(state)}` : "&state=opened";
		const url = `${baseUrl.replace(/\/+$/, "")}/api/v4/projects/${encodeURIComponent(projectPath)}/merge_requests?per_page=20&order_by=updated_at&sort=desc${stateParam}`;
		const res = await fetchWithTimeout(url, { headers: { "PRIVATE-TOKEN": token } }, 1e4);
		if (!res.ok) return {
			ok: false,
			mergeRequests: [],
			message: `GitLab API error: ${res.status}`
		};
		const raw = await res.json();
		const mergeRequests = raw.map((mr) => ({
			iid: mr.iid,
			title: mr.title,
			state: mr.state,
			author: mr.author?.username ?? "unknown",
			sourceBranch: mr.source_branch,
			targetBranch: mr.target_branch,
			createdAt: mr.created_at,
			updatedAt: mr.updated_at,
			approvalsBeforeMerge: mr.approvals_before_merge ?? null,
			mergeStatus: mr.merge_status ?? "",
			workInProgress: !!mr.work_in_progress,
			draft: !!mr.draft,
			webUrl: mr.web_url
		}));
		return {
			ok: true,
			mergeRequests
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			mergeRequests: [],
			message: "Timed out"
		};
		return {
			ok: false,
			mergeRequests: [],
			message: err.message
		};
	}
}
/** List recent pipelines for a project. */
async function gitlabPipelines(params) {
	const { baseUrl, token, projectPath, ref, perPage } = params;
	if (!baseUrl || !token || !projectPath) return {
		ok: false,
		pipelines: [],
		message: "Missing baseUrl, token or projectPath"
	};
	try {
		const refParam = ref ? `&ref=${encodeURIComponent(ref)}` : "";
		const count = Math.min(perPage ?? 10, 50);
		const url = `${baseUrl.replace(/\/+$/, "")}/api/v4/projects/${encodeURIComponent(projectPath)}/pipelines?per_page=${count}&order_by=id&sort=desc${refParam}`;
		const res = await fetchWithTimeout(url, { headers: { "PRIVATE-TOKEN": token } }, 1e4);
		if (!res.ok) return {
			ok: false,
			pipelines: [],
			message: `GitLab API error: ${res.status}`
		};
		const raw = await res.json();
		const pipelines = raw.map((p) => ({
			id: p.id,
			status: p.status,
			ref: p.ref,
			sha: p.sha?.slice(0, 8),
			createdAt: p.created_at,
			updatedAt: p.updated_at,
			duration: p.duration
		}));
		return {
			ok: true,
			pipelines
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			pipelines: [],
			message: "Timed out"
		};
		return {
			ok: false,
			pipelines: [],
			message: err.message
		};
	}
}
/** Jobs of a pipeline (for the expandable pipeline detail view). */
async function gitlabPipelineJobs(params) {
	const { baseUrl, token, projectPath, pipelineId } = params;
	if (!baseUrl || !token || !projectPath) return {
		ok: false,
		jobs: [],
		message: "Missing params"
	};
	try {
		const url = `${baseUrl.replace(/\/+$/, "")}/api/v4/projects/${encodeURIComponent(projectPath)}/pipelines/${pipelineId}/jobs?per_page=50`;
		const res = await fetchWithTimeout(url, { headers: { "PRIVATE-TOKEN": token } }, 15e3);
		if (!res.ok) return {
			ok: false,
			jobs: [],
			message: `GitLab API error: ${res.status}`
		};
		const raw = await res.json();
		const jobs = raw.map((j) => ({
			id: j.id,
			name: j.name,
			stage: j.stage,
			status: j.status,
			duration: j.duration,
			failureReason: j.failure_reason || ""
		}));
		return {
			ok: true,
			jobs
		};
	} catch (err) {
		return {
			ok: false,
			jobs: [],
			message: err.message
		};
	}
}
/** Strip ANSI escape codes and gitlab-runner control lines from a raw job trace, leaving plain text. */
function cleanJobLog(s) {
	return s.replace(/\u001b\[[0-9;?]*[a-zA-Z]/g, "").split("\n").filter((l) => !/^section_(start|end):/.test(l) && !/^get:job:/.test(l)).join("\n");
}
/** Get the build log of a single GitLab pipeline job. Tries /log (GitLab ≥12), falls back to /trace (GitLab 11.x). */
async function gitlabJobLog(params) {
	const { baseUrl, token, projectPath, jobId } = params;
	if (!baseUrl || !token || !projectPath || !jobId) return {
		ok: false,
		logs: "",
		message: "Missing params"
	};
	const jobUrl = `${baseUrl.replace(/\/+$/, "")}/projects/${projectPath}/jobs/${jobId}`;
	const apiBase = `${baseUrl.replace(/\/+$/, "")}/api/v4/projects/${encodeURIComponent(projectPath)}/jobs/${jobId}`;
	const authed = { headers: { "PRIVATE-TOKEN": token } };
	try {
		let res = await fetchWithTimeout(`${apiBase}/log`, authed, 15e3);
		if (res.status === 404) res = await fetchWithTimeout(`${apiBase}/trace`, authed, 15e3);
		if (res.status === 404) return {
			ok: false,
			logs: "",
			message: "未获取到日志（该 GitLab 版本无可用的日志接口），请通过 GitLab 页面查看",
			jobUrl
		};
		if (res.status === 202) return {
			ok: false,
			logs: "",
			message: "Job 仍在运行，日志暂不可用，请稍后重试",
			jobUrl
		};
		if (!res.ok) return {
			ok: false,
			logs: "",
			message: `GitLab API error: ${res.status}`,
			jobUrl
		};
		return {
			ok: true,
			logs: cleanJobLog(await res.text())
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			logs: "",
			message: "Timed out",
			jobUrl
		};
		return {
			ok: false,
			logs: "",
			message: err.message,
			jobUrl
		};
	}
}
/** List pods in a K8s namespace. */
async function k8sPods(params) {
	const { kubeconfigPath, context, namespace } = params;
	if (!kubeconfigPath || !namespace) return {
		ok: false,
		pods: [],
		message: "Missing kubeconfigPath or namespace"
	};
	try {
		const kctx = parseKubeconfig(kubeconfigPath, context);
		const res = await fetchWithTimeout(`${kctx.server}/api/v1/namespaces/${encodeURIComponent(namespace)}/pods`, { headers: {
			Authorization: `Bearer ${kctx.token}`,
			Accept: "application/json"
		} }, 1e4, kctx);
		if (!res.ok) return {
			ok: false,
			pods: [],
			message: `K8s API error: ${res.status}`
		};
		const data = await res.json();
		const pods = (data.items ?? []).map((pod) => {
			const cs = pod.status?.containerStatuses ?? [];
			const restarts = cs.reduce((sum, c) => sum + (c.restartCount ?? 0), 0);
			let reason = "";
			for (const c of cs) if (c.state?.waiting?.reason) reason = c.state.waiting.reason;
			else if (!reason && c.lastState?.terminated?.reason && c.lastState.terminated.reason !== "Completed") reason = c.lastState.terminated.reason;
			return {
				name: pod.metadata?.name,
				phase: pod.status?.phase ?? "Unknown",
				ready: cs.filter((c) => c.ready).length,
				total: cs.length,
				restarts,
				node: pod.spec?.nodeName ?? "",
				reason,
				startedAt: pod.status?.startTime ?? ""
			};
		});
		return {
			ok: true,
			pods
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			pods: [],
			message: "Timed out"
		};
		return {
			ok: false,
			pods: [],
			message: err.message
		};
	}
}
/** List recent events in a K8s namespace. */
async function k8sEvents(params) {
	const { kubeconfigPath, context, namespace, limit } = params;
	if (!kubeconfigPath || !namespace) return {
		ok: false,
		events: [],
		message: "Missing kubeconfigPath or namespace"
	};
	try {
		const kctx = parseKubeconfig(kubeconfigPath, context);
		const count = Math.min(limit ?? 20, 100);
		const res = await fetchWithTimeout(`${kctx.server}/api/v1/namespaces/${encodeURIComponent(namespace)}/events?limit=${count}&sort={by:lastTimestamp,order:descending}`, { headers: {
			Authorization: `Bearer ${kctx.token}`,
			Accept: "application/json"
		} }, 1e4, kctx);
		if (!res.ok) return {
			ok: false,
			events: [],
			message: `K8s API error: ${res.status}`
		};
		const data = await res.json();
		const events = (data.items ?? []).map((ev) => ({
			type: ev.type ?? "Normal",
			reason: ev.reason ?? "",
			message: ev.message ?? "",
			object: ev.involvedObject?.name ?? "",
			kind: ev.involvedObject?.kind ?? "",
			time: ev.lastTimestamp ?? ev.eventTime ?? ""
		}));
		return {
			ok: true,
			events
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			events: [],
			message: "Timed out"
		};
		return {
			ok: false,
			events: [],
			message: err.message
		};
	}
}
/** List repository tags for a project (newest first). */
async function gitlabTags(params) {
	const { baseUrl, token, projectPath } = params;
	if (!baseUrl || !token || !projectPath) return {
		ok: false,
		tags: [],
		message: "Missing baseUrl, token or projectPath"
	};
	try {
		const url = `${baseUrl.replace(/\/+$/, "")}/api/v4/projects/${encodeURIComponent(projectPath)}/repository/tags?per_page=20&order_by=updated&sort=desc`;
		const res = await fetchWithTimeout(url, { headers: { "PRIVATE-TOKEN": token } }, 1e4);
		if (!res.ok) return {
			ok: false,
			tags: [],
			message: `GitLab API error: ${res.status}`
		};
		const raw = await res.json();
		const tags = raw.map((t) => ({
			name: t.name,
			message: t.message ?? t.release?.message ?? "",
			createdAt: t.commit?.created_at ?? ""
		}));
		return {
			ok: true,
			tags
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			tags: [],
			message: "Timed out"
		};
		return {
			ok: false,
			tags: [],
			message: err.message
		};
	}
}
/** Resolve a list of usernames to GitLab user ids (best-effort) for reviewer_ids. */
async function resolveUserIds(baseUrl, token, names) {
	const ids = [];
	for (const name$1 of names) try {
		const su = await fetchWithTimeout(`${baseUrl.replace(/\/+$/, "")}/api/v4/users?search=${encodeURIComponent(name$1)}&per_page=5`, { headers: { "PRIVATE-TOKEN": token } }, 8e3);
		if (!su.ok) continue;
		const users = await su.json();
		const u = users.find((x) => x.username.toLowerCase() === name$1.toLowerCase()) ?? users[0];
		if (u?.id) ids.push(u.id);
	} catch {}
	return ids;
}
/** Create a merge request. `reviewers` is a comma/space separated username list. */
async function gitlabCreateMr(params) {
	const { baseUrl, token, projectPath, sourceBranch, targetBranch, title, description, reviewers } = params;
	if (!baseUrl || !token || !projectPath) return {
		ok: false,
		message: "Missing baseUrl, token or projectPath"
	};
	if (!sourceBranch || !targetBranch || !title) return {
		ok: false,
		message: "Missing source, target or title"
	};
	try {
		const url = `${baseUrl.replace(/\/+$/, "")}/api/v4/projects/${encodeURIComponent(projectPath)}/merge_requests`;
		const body = {
			source_branch: sourceBranch,
			target_branch: targetBranch,
			title,
			remove_source_branch: true
		};
		if (description) body.description = description;
		if (reviewers) {
			const names = reviewers.split(/[,，\s]+/).map((s) => s.trim().replace(/^@/, "")).filter(Boolean);
			const ids = await resolveUserIds(baseUrl, token, names);
			if (ids.length) body["reviewer_ids"] = ids;
		}
		const res = await fetchWithTimeout(url, {
			method: "POST",
			headers: {
				"PRIVATE-TOKEN": token,
				"Content-Type": "application/json"
			},
			body: JSON.stringify(body)
		}, 1e4);
		if (!res.ok) {
			const detail = await res.text().catch(() => "");
			return {
				ok: false,
				message: `GitLab API error: ${res.status}${detail ? " | " + detail.slice(0, 160) : ""}`
			};
		}
		const mr = await res.json();
		return {
			ok: true,
			mergeRequest: {
				iid: mr.iid,
				title: mr.title,
				webUrl: mr.web_url
			}
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			message: "Timed out"
		};
		return {
			ok: false,
			message: err.message
		};
	}
}
/** Create a lightweight tag. */
async function gitlabCreateTag(params) {
	const { baseUrl, token, projectPath, tagName, ref, message } = params;
	if (!baseUrl || !token || !projectPath) return {
		ok: false,
		message: "Missing baseUrl, token or projectPath"
	};
	if (!tagName || !ref) return {
		ok: false,
		message: "Missing tag name or ref"
	};
	try {
		const url = `${baseUrl.replace(/\/+$/, "")}/api/v4/projects/${encodeURIComponent(projectPath)}/repository/tags`;
		const body = {
			tag_name: tagName,
			ref
		};
		if (message) body.message = message;
		const res = await fetchWithTimeout(url, {
			method: "POST",
			headers: {
				"PRIVATE-TOKEN": token,
				"Content-Type": "application/json"
			},
			body: JSON.stringify(body)
		}, 1e4);
		if (!res.ok) {
			const detail = await res.text().catch(() => "");
			return {
				ok: false,
				message: `GitLab API error: ${res.status}${detail ? " | " + detail.slice(0, 160) : ""}`
			};
		}
		const tag = await res.json();
		return {
			ok: true,
			tag: { name: tag.name }
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			message: "Timed out"
		};
		return {
			ok: false,
			message: err.message
		};
	}
}
/** Cancel or retry a pipeline. `action` is 'cancel' or 'retry'. */
async function gitlabPipelineAction(params) {
	const { baseUrl, token, projectPath, pipelineId, action } = params;
	if (!baseUrl || !token || !projectPath) return {
		ok: false,
		message: "Missing baseUrl, token or projectPath"
	};
	if (!["cancel", "retry"].includes(action)) return {
		ok: false,
		message: "action must be 'cancel' or 'retry'"
	};
	try {
		const url = `${baseUrl.replace(/\/+$/, "")}/api/v4/projects/${encodeURIComponent(projectPath)}/pipelines/${pipelineId}/${action}`;
		const res = await fetchWithTimeout(url, {
			method: "POST",
			headers: { "PRIVATE-TOKEN": token }
		}, 1e4);
		if (!res.ok) {
			const detail = await res.text().catch(() => "");
			return {
				ok: false,
				message: `GitLab API error: ${res.status}${detail ? " | " + detail.slice(0, 160) : ""}`
			};
		}
		return { ok: true };
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			message: "Timed out"
		};
		return {
			ok: false,
			message: err.message
		};
	}
}
/** Approve a merge request (uses the caller token's approval). */
async function gitlabMrApprove(params) {
	const { baseUrl, token, projectPath, mrIid } = params;
	if (!baseUrl || !token || !projectPath) return {
		ok: false,
		message: "Missing baseUrl, token or projectPath"
	};
	try {
		const url = `${baseUrl.replace(/\/+$/, "")}/api/v4/projects/${encodeURIComponent(projectPath)}/merge_requests/${mrIid}/approve`;
		const res = await fetchWithTimeout(url, {
			method: "POST",
			headers: { "PRIVATE-TOKEN": token }
		}, 1e4);
		if (!res.ok) {
			const detail = await res.text().catch(() => "");
			return {
				ok: false,
				message: `GitLab API error: ${res.status}${detail ? " | " + detail.slice(0, 160) : ""}`
			};
		}
		const mr = await res.json();
		return {
			ok: true,
			approvalsBeforeMerge: mr.approvals_before_merge ?? null
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			message: "Timed out"
		};
		return {
			ok: false,
			message: err.message
		};
	}
}
/** Close / reopen a merge request. */
async function gitlabMrAction(params) {
	const { baseUrl, token, projectPath, mrIid, action } = params;
	if (!baseUrl || !token || !projectPath) return {
		ok: false,
		message: "Missing baseUrl, token or projectPath"
	};
	if (!["close", "reopen"].includes(action)) return {
		ok: false,
		message: `Unknown action: ${action}`
	};
	try {
		const url = `${baseUrl.replace(/\/+$/, "")}/api/v4/projects/${encodeURIComponent(projectPath)}/merge_requests/${mrIid}`;
		const res = await fetchWithTimeout(url, {
			method: "PUT",
			headers: {
				"PRIVATE-TOKEN": token,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ state_event: action })
		}, 1e4);
		if (!res.ok) {
			const detail = await res.text().catch(() => "");
			return {
				ok: false,
				message: `GitLab API error: ${res.status}${detail ? " | " + detail.slice(0, 160) : ""}`
			};
		}
		const mr = await res.json();
		return {
			ok: true,
			state: mr.state ?? action
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			message: "Timed out"
		};
		return {
			ok: false,
			message: err.message
		};
	}
}
/** Tail the logs of a pod container (plain text). */
async function k8sPodLogs(params) {
	const { kubeconfigPath, context, namespace, podName, container, tailLines } = params;
	if (!kubeconfigPath || !namespace || !podName) return {
		ok: false,
		logs: "",
		message: "Missing kubeconfigPath, namespace or podName"
	};
	try {
		const kctx = parseKubeconfig(kubeconfigPath, context);
		const n = Math.min(tailLines ?? 100, 1e3);
		const containerParam = container ? `&container=${encodeURIComponent(container)}` : "";
		const res = await fetchWithTimeout(`${kctx.server}/api/v1/namespaces/${encodeURIComponent(namespace)}/pods/${encodeURIComponent(podName)}/log?tailLines=${n}${containerParam}`, { headers: {
			Authorization: `Bearer ${kctx.token}`,
			Accept: "application/json"
		} }, 1e4, kctx);
		if (!res.ok) {
			const detail = await res.text().catch(() => "");
			return {
				ok: false,
				logs: "",
				message: `K8s API error: ${res.status}${detail ? " | " + detail.slice(0, 160) : ""}`
			};
		}
		return {
			ok: true,
			logs: await res.text()
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			logs: "",
			message: "Timed out"
		};
		return {
			ok: false,
			logs: "",
			message: err.message
		};
	}
}
/** PATCH a deployment (strategic-merge) — used for image change and restart. */
async function k8sPatchDeployment(params) {
	const { kubeconfigPath, context, namespace, name: name$1, patch } = params;
	if (!kubeconfigPath || !namespace || !name$1 || !patch) return {
		ok: false,
		message: "Missing params"
	};
	try {
		const kctx = parseKubeconfig(kubeconfigPath, context);
		const res = await httpsGet(`${kctx.server}/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name$1)}`, {
			method: "PATCH",
			headers: {
				Authorization: `Bearer ${kctx.token}`,
				Accept: "application/json",
				"Content-Type": "application/strategic-merge-patch+json"
			},
			body: JSON.stringify(patch),
			ca: kctx.caData ? Buffer.from(kctx.caData, "base64") : void 0,
			insecureSkipTlsVerify: kctx.insecureSkipTlsVerify
		});
		const text = await res.text();
		if (!res.ok) return {
			ok: false,
			message: `K8s API error: ${res.status}${text ? " | " + text.slice(0, 160) : ""}`
		};
		return { ok: true };
	} catch (err) {
		return {
			ok: false,
			message: err.message
		};
	}
}
/** Change the image of a deployment's first container (or the named one). */
async function k8sSetImage(params) {
	const { kubeconfigPath, context, namespace, name: name$1, image, container } = params;
	if (!image) return {
		ok: false,
		message: "Missing image"
	};
	try {
		const kctx = parseKubeconfig(kubeconfigPath, context);
		let containerName = container;
		if (!containerName) {
			const res = await fetchWithTimeout(`${kctx.server}/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name$1)}`, { headers: {
				Authorization: `Bearer ${kctx.token}`,
				Accept: "application/json"
			} }, 1e4, kctx);
			if (!res.ok) return {
				ok: false,
				message: `K8s API error: ${res.status}`
			};
			const dep = await res.json();
			containerName = dep?.spec?.template?.spec?.containers?.[0]?.name;
			if (!containerName) return {
				ok: false,
				message: "Deployment has no containers"
			};
		}
		return k8sPatchDeployment({
			...params,
			patch: { spec: { template: { spec: { containers: [{
				name: containerName,
				image
			}] } } } }
		});
	} catch (err) {
		return {
			ok: false,
			message: err.message
		};
	}
}
/** Restart a deployment (annotate pod template with restartedAt, like kubectl rollout restart). */
async function k8sRestartDeployment(params) {
	return k8sPatchDeployment({
		...params,
		patch: { spec: { template: { metadata: { annotations: { "kubectl.kubernetes.io/restartedAt": new Date().toISOString() } } } } }
	});
}
async function browseFile(_params) {
	const platform = process.platform;
	if (platform === "win32") {
		const { execFile } = await import("node:child_process");
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
			], { timeout: 12e4 }, (err, stdout, stderr) => {
				const path = stdout?.trim();
				if (err && !path) {
					console.error("[dsh-devops] browse-file error:", err.message, stderr?.trim() || "");
					resolve({
						ok: false,
						path: "",
						message: err.message
					});
				} else resolve({
					ok: true,
					path: path || ""
				});
			});
		});
	}
	return {
		ok: false,
		path: "",
		message: "File browse not supported on this platform"
	};
}
const CONFIG_DIR = join(homedir(), ".dsh-devops");
const CONFIG_FILE$1 = join(CONFIG_DIR, "config.json");
const LOG_FILE = join(CONFIG_DIR, "devops.log");
const MAX_LOG_SIZE = 5 * 1024 * 1024;
function ensureConfigDir() {
	if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
}
/** Write a log entry to ~/.dsh-devops/devops.log */
function writeLog(level, message, detail) {
	try {
		ensureConfigDir();
		try {
			const st = statSync(LOG_FILE);
			if (st.size > MAX_LOG_SIZE) {
				const content = readFileSync(LOG_FILE, "utf8");
				writeFileSync(LOG_FILE, content.slice(-512 * 1024), "utf8");
			}
		} catch {}
		const ts = new Date().toISOString();
		const line = `[${ts}] [${level.toUpperCase()}] ${message}${detail ? " | " + detail : ""}\n`;
		appendFileSync(LOG_FILE, line, "utf8");
	} catch {}
}
/** Read log entries for the API */
function readLogs(params) {
	try {
		if (!existsSync(LOG_FILE)) return {
			ok: true,
			lines: []
		};
		const raw = readFileSync(LOG_FILE, "utf8");
		let allLines = raw.split("\n").filter(Boolean);
		const level = (params.level ?? "").toLowerCase();
		if (level) allLines = allLines.filter((l) => l.includes(`[${level.toUpperCase()}]`));
		const search = (params.search ?? "").toLowerCase();
		if (search) allLines = allLines.filter((l) => l.toLowerCase().includes(search));
		const limit = Math.min(Number(params.lines) || 200, 5e3);
		allLines = allLines.slice(-limit);
		return {
			ok: true,
			lines: allLines
		};
	} catch (err) {
		return {
			ok: false,
			lines: [],
			message: err.message
		};
	}
}
function saveConfig(params) {
	try {
		ensureConfigDir();
		let existing = {};
		if (existsSync(CONFIG_FILE$1)) try {
			existing = JSON.parse(readFileSync(CONFIG_FILE$1, "utf8"));
		} catch {
			existing = {};
		}
		if (!existing || typeof existing !== "object" || Array.isArray(existing)) existing = {};
		writeFileSync(CONFIG_FILE$1, JSON.stringify({
			...existing,
			...params
		}, null, 2), "utf8");
		writeLog("info", "save-config", "config written");
		return {
			ok: true,
			message: "配置已保存"
		};
	} catch (err) {
		writeLog("error", "save-config", err.message);
		return {
			ok: false,
			message: `保存失败: ${err.message}`
		};
	}
}
function loadConfig(_params) {
	try {
		if (!existsSync(CONFIG_FILE$1)) return {
			ok: true,
			config: null
		};
		const raw = readFileSync(CONFIG_FILE$1, "utf8");
		const config = JSON.parse(raw);
		return {
			ok: true,
			config
		};
	} catch (err) {
		return {
			ok: false,
			config: null,
			message: err.message
		};
	}
}
/**
* Register the /devops/api HTTP prefix route.
* Called from the plugin's `apply()` function.
*/
function registerDevopsApi(ctx) {
	ctx.effect(() => ctx.webServer.register({
		kind: "prefix",
		path: "/devops/api",
		handler: async (req, res) => {
			if (!isLocalhost(req)) {
				writeJson(res, 403, {
					ok: false,
					message: "Forbidden"
				});
				return;
			}
			if (req.method !== "POST") {
				writeJson(res, 405, {
					ok: false,
					message: "Method not allowed"
				});
				return;
			}
			const pathname = new URL(req.url ?? "/", "http://dsh.internal").pathname;
			const method = pathname.startsWith("/devops/api/") ? pathname.slice(12) : pathname.startsWith("/") ? pathname.slice(1) : "";
			const handlers = {
				"test-gitlab": testGitLab,
				"gitlab-projects": gitlabProjects,
				"gitlab-branches": gitlabBranches,
				"gitlab-mrs": gitlabMRs,
				"gitlab-pipelines": gitlabPipelines,
				"gitlab-tags": gitlabTags,
				"gitlab-members": gitlabMembers,
				"gitlab-last-commit": gitlabLastCommit,
				"gitlab-create-mr": gitlabCreateMr,
				"gitlab-create-tag": gitlabCreateTag,
				"gitlab-pipeline-action": gitlabPipelineAction,
				"gitlab-mr-approve": gitlabMrApprove,
				"gitlab-mr-action": gitlabMrAction,
				"gitlab-pipeline-jobs": gitlabPipelineJobs,
				"gitlab-job-log": gitlabJobLog,
				"k8s-set-image": k8sSetImage,
				"k8s-restart": k8sRestartDeployment,
				"test-k8s": testK8s,
				"k8s-contexts": k8sContexts,
				"k8s-namespaces": k8sNamespaces,
				"k8s-deployments": k8sDeployments,
				"k8s-pods": k8sPods,
				"k8s-events": k8sEvents,
				"k8s-pod-logs": k8sPodLogs,
				"browse-file": browseFile,
				"save-config": saveConfig,
				"load-config": loadConfig,
				"logs": readLogs
			};
			const handler = handlers[method];
			if (!handler) {
				writeJson(res, 404, {
					ok: false,
					message: `Unknown method: ${method}`
				});
				return;
			}
			const started = Date.now();
			try {
				const body = await readBody(req);
				const inSnippet = JSON.stringify(body).slice(0, 400);
				const result = await handler(body);
				const ms = Date.now() - started;
				const outSnippet = JSON.stringify(result).slice(0, 400);
				writeLog(result?.ok === false ? "warn" : "info", `POST /devops/api/${method}`, `${ms}ms | in=${inSnippet} | out=${outSnippet}`);
				writeJson(res, 200, result);
			} catch (err) {
				const ms = Date.now() - started;
				writeLog("error", `POST /devops/api/${method}`, `${ms}ms | ${err.message}`);
				writeJson(res, 500, {
					ok: false,
					message: err.message ?? "Internal error"
				});
			}
		}
	}), "dsh-devops: /devops/api routes");
}

//#endregion
//#region src/runtime-config.ts
const CONFIG_FILE = join(homedir(), ".dsh-devops", "config.json");
const NOT_CONFIGURED_MSG = "[dsh-devops] Not configured yet — open DSH Settings → DevOps, add the connection info, and save.";
/** Read the raw settings-file config (null when missing/corrupt). */
function readConfigJson() {
	try {
		if (!existsSync(CONFIG_FILE)) return null;
		return JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
	} catch {
		return null;
	}
}
/** Minimal server-side mirror of the client's migrateConfig (legacy → servers list). */
function normalizeConfigJson(raw) {
	if (!raw || typeof raw !== "object") return raw;
	const out = JSON.parse(JSON.stringify(raw));
	const gl = out.gitlab || {};
	if (!Array.isArray(gl.servers) && gl.baseUrl) {
		const legacyProject = Array.isArray(gl.projects) ? gl.projects[0] : null;
		gl.servers = [{
			id: "s1",
			label: "GitLab",
			baseUrl: gl.baseUrl,
			token: gl.token || "",
			projectPath: legacyProject?.path || "",
			branch: legacyProject?.defaultBranch || ""
		}];
	}
	const k8s = out.k8s || {};
	if (!Array.isArray(k8s.kubeconfigs) && k8s.kubeconfigPath) k8s.kubeconfigs = [{
		id: "k1",
		path: k8s.kubeconfigPath,
		context: k8s.context || "",
		namespace: k8s.namespace || ""
	}];
	out.gitlab = gl;
	out.k8s = k8s;
	return out;
}
/**

* Resolve the effective GitLab config.

* Returns null when neither source has a usable GitLab section.

*/
function resolveGitLabConfig(cordisRaw) {
	const raw = cordisRaw && typeof cordisRaw === "object" ? cordisRaw : {};
	if (raw.gitlab && typeof raw.gitlab === "object" && raw.gitlab.baseUrl) return raw.gitlab;
	const file = normalizeConfigJson(readConfigJson());
	const gl = file?.gitlab || {};
	const servers = Array.isArray(gl.servers) ? gl.servers : [];
	const active = servers.find((s) => s.id === gl.activeServerId) || servers[0];
	if (!active?.baseUrl || !active?.token || !active?.projectPath) return null;
	const usable = servers.filter((s) => s.baseUrl && s.token);
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
	const file = normalizeConfigJson(readConfigJson());
	const k8s = file?.k8s || {};
	const kcList = Array.isArray(k8s.kubeconfigs) ? k8s.kubeconfigs : [];
	const usable = kcList.filter((k) => k.path);
	if (!usable.length) return null;
	const active = usable.find((k) => k.id === k8s.activeKubeconfigId) || usable[0];
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
//#region src/runtime/lazy.ts
function notConfigured() {
	throw new Error(NOT_CONFIGURED_MSG);
}
/**

* GitLab service that rebuilds its router from the effective config on every

* call. Cheap: the underlying client is stateless HTTP.

*/
function createLazyGitLabService(ctx, cordisRaw) {
	function router() {
		const cfg = resolveGitLabConfig(cordisRaw);
		if (!cfg) notConfigured();
		try {
			return new GitLabRouter(cfg.baseUrl, cfg.projects, cfg.defaultProject);
		} catch (err) {
			ctx.log?.warn?.(`[dsh-devops] GitLab router build failed: ${err.message}`);
			throw err;
		}
	}
	return {
		listProjects: () => {
			const r = router();
			return r ? r.list() : [];
		},
		createMR: (p, s, t, title, desc) => router().resolve(p).createMR(s, t, title, desc),
		approveMR: (p, iid) => router().resolve(p).approveMR(iid),
		requestChanges: (p, iid, c) => router().resolve(p).requestChanges(iid, c),
		commentMR: (p, iid, body) => router().resolve(p).commentMR(iid, body),
		listMRs: (p) => router().resolve(p).listMRs(),
		createTag: (p, name$1, ref, msg) => router().resolve(p).createTag(name$1, ref, msg),
		getPipeline: (p, id) => router().resolve(p).getPipeline(id),
		getLatestPipelineByRef: (p, ref) => router().resolve(p).getLatestPipelineByRef(ref),
		listPipelineJobs: (p, id) => router().resolve(p).listPipelineJobs(id),
		getJobLog: (p, id) => router().resolve(p).getJobLog(id)
	};
}
/**

* K8s service that rebuilds its router from the effective config on every

* call. Re-parses kubeconfig files per call (~ms file IO) in exchange for

* always-current cluster/context/namespace selection.

*/
function createLazyK8sService(ctx, cordisRaw) {
	function router() {
		const cfg = resolveK8sConfig(cordisRaw);
		if (!cfg) notConfigured();
		try {
			return new K8sRouter(cfg.kubeconfigs, cfg.defaultContext, cfg.defaultNamespace);
		} catch (err) {
			ctx.log?.warn?.(`[dsh-devops] K8s router build failed: ${err.message}`);
			throw err;
		}
	}
	return {
		listClusters: () => {
			const r = router();
			return r ? r.list() : [];
		},
		getDefaultNamespace: (cluster) => router().getDefaultNamespace(cluster),
		getDeploymentStatus: (c, ns, name$1) => router().resolve(c).getDeployment(ns, name$1),
		getDeploymentStatusList: (c, ns) => router().resolve(c).getDeployments(ns),
		getPodList: (c, ns) => router().resolve(c).getPods(ns),
		getEvents: (c, ns, limit) => router().resolve(c).getEvents(ns, limit),
		getPodLogs: (c, ns, podName, container, tailLines) => router().resolve(c).getPodLogs(ns, podName, container, tailLines)
	};
}

//#endregion
//#region src/index.ts
const name = "dsh-devops";
const inject = ["webServer", "tools"];
/**
* Plugin apply function — called by the DSH/Cordis loader.
*
* @param ctx - The DSH host context (services, tools, events, effects, etc.)
* @param rawConfig - Raw user config from cordis.yml
*/
function apply(ctx, rawConfig) {
	const raw = rawConfig && typeof rawConfig === "object" ? rawConfig : {};
	const config = parseConfig(raw);
	const gitlabService = createLazyGitLabService(ctx, raw);
	const k8sService = createLazyK8sService(ctx, raw);
	registerTools(ctx, {
		gitlab: gitlabService,
		k8s: k8sService
	});
	if (config.webhook) registerWebhook(ctx, config.webhook);
	if (config.monitor) {
		const eagerGitlab = config.gitlab ? registerGitLab(ctx, config.gitlab) : gitlabService;
		const eagerK8s = config.k8s ? registerK8s(ctx, config.k8s) : k8sService;
		startMonitor(ctx, config.monitor, {
			gitlab: eagerGitlab,
			k8s: eagerK8s
		});
	}
	registerDevopsApi(ctx);
}

//#endregion
export { Config, apply, inject, name };