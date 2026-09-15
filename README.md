# @JacksonChen/dsh-devops

[![Release](https://img.shields.io/github/v/release/Jackson-chen97/dsh-devops)](https://github.com/Jackson-chen97/dsh-devops/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
![Node](https://img.shields.io/badge/node-%E2%89%A522.19-green)
![DSH](https://img.shields.io/badge/dsh-%E2%89%A50.1.x-orange)
[![Topic: dsh-plugin](https://img.shields.io/badge/dsh-plugin-8A2BE2)](https://github.com/topics/dsh-plugin)

GitLab + Kubernetes DevOps monitoring plugin for DeepSeek Harness (DSH).

[中文文档](./README.zh-CN.md)

| GitLab tab | K8s tab |
|------------|---------|
| <img src="docs/images/dashboard-gitlab.png" width="480" /> | <img src="docs/images/dashboard-k8s.png" width="480" /> |

## Features

- **GitLab API**: Create/review/close merge requests, manage tags, monitor CI/CD pipelines with per-job detail
- **Kubernetes API**: Deployment status, pod lists, events, logs, image change and rollout restart
- **Dashboard UI**: Dual-card switcher (GitLab server / project, kubeconfig / context / namespace) with persisted config
- **Multi-config**: Multiple GitLab servers and multiple kubeconfigs, switchable from both the dashboard and settings
- **Webhook + Alert engine**: GitLab webhook → `followup()` notification; background polling detects pipeline failures and pod crashes
- **i18n**: Built-in Chinese / English UI with a one-click language toggle (persisted; follows browser language by default)
- **Self-signed clusters**: Per-request CA pinning from kubeconfig via `node:https`

## Installation

The `dsh plugin` command forwards to pnpm inside the profile directory, so any pnpm source works: npm, git, or a local path.

```sh
# From npm (once published)
dsh plugin --profile web add @JacksonChen/dsh-devops

# From GitHub
dsh plugin --profile web add https://github.com/Jackson-chen97/dsh-devops.git

# From a local checkout (development)
dsh plugin --profile web add "D:/path/to/dsh-devops"
```

Equivalent pnpm commands (if you prefer to work directly in the profile dir):

```sh
cd ~/.dsh/profiles/web
pnpm add @JacksonChen/dsh-devops       # npm (once published)
pnpm add https://github.com/Jackson-chen97/dsh-devops.git  # GitHub
pnpm add "D:/path/to/dsh-devops"       # local path
```

Then declare the plugin in the profile's patch layer `~/.dsh/profiles/web/cordis.patch.yml` (required — the plugin is only loaded after this step):

```yaml
- insert:
    - id: dsh-devops
      name: '@JacksonChen/dsh-devops'
```

Restart DSH, then open Settings → DevOps to configure.

## Install from prebuilt artifacts (no build, no registry)

`lib/` ships a complete, runnable bundle and is **committed to the repo**, so
you can install with no build step and no package registry — ideal for
locked-down or offline machines. A plain `git clone` is enough.

```sh
# 1) Clone anywhere you like
git clone https://github.com/Jackson-chen97/dsh-devops

# 2) Copy the prebuilt bundle into the profile's shared node_modules
#    (~/.dsh is %USERPROFILE%\.dsh on Windows)
DEST=~/.dsh/profiles/node_modules/@JacksonChen/dsh-devops
mkdir -p "$DEST"
cp -R dsh-devops/lib dsh-devops/package.json dsh-devops/cordis.patch.yml "$DEST"/

# 3) Register the bundle: add "@JacksonChen/dsh-devops" to
#    `dsh.profile.bundles` in ~/.dsh/profiles/web/package.json. This is the
#    same list that loads @deepseek-ai/dsh-base and dsh-web-app; the bundle then
#    self-registers through its own cordis.patch.yml. e.g.
#    "dsh": { "profile": { "bundles": [
#      "@deepseek-ai/dsh-base",
#      "@deepseek-ai/dsh-web-app",
#      "@JacksonChen/dsh-devops"
#    ] } }

# 4) Restart DSH, then open Settings → DevOps.
```

> The offline artifact is `lib/*.js` only. The `.d.ts` type files come from the
> normal `pnpm run build` (tsdown); the prebuilt bundle is runtime-only.

## Quick Start

1. Open DSH Settings → DevOps, add GitLab server(s) (Base URL + token) and kubeconfig file(s).
2. On the dashboard, pick the GitLab project and K8s context/namespace — selections are saved to `~/.dsh-devops/config.json` automatically.
3. Create MRs, tags, inspect pipelines and operate deployments right from the dashboard — or just ask the AI, which calls the same tools with the same config.

Or configure via `cordis.patch.yml`:

```yaml
- id: dsh-devops
  name: '@JacksonChen/dsh-devops'
  config:
    gitlab:
      servers:
        - id: main
          baseUrl: 'https://gitlab.example.com'
          projectPath: 'my-group/my-project'
    k8s:
      kubeconfigs:
        - id: prod
          path: '~/.kube/config'
          context: 'prod'
```

## AI Tools

All tools are registered as soon as the plugin loads — **no YAML config needed**. They read the same configuration the Settings → DevOps UI saves (`~/.dsh-devops/config.json`), so switching project/cluster in the dashboard applies to AI calls immediately. Calling a tool before configuring returns a hint to finish setup first.

An explicit `config:` block in the cordis patch entry still works as an override layer for headless setups.

| Tool | Description |
|------|-------------|
| `gitlab_mr_create` | Create MR (auto-triggers pipeline watch) |
| `gitlab_mr_review` | Review MR (approve/request_changes/comment) |
| `gitlab_mr_list` | List merge requests |
| `gitlab_tag_create` | Create git tag |
| `gitlab_pipeline_status` | Get pipeline status |
| `gitlab_pipeline_jobs` | List pipeline jobs |
| `gitlab_pipeline_watch` | Start/stop/check pipeline monitoring |
| `k8s_deployment_status` | Get deployment rolling status |
| `k8s_pods` | List pods with restart counts |
| `k8s_events` | Get recent K8s events |
| `k8s_logs` | Get pod logs (tail N lines) |

## Configuration Reference

### GitLab Config

| Field | Required | Description |
|-------|----------|-------------|
| `baseUrl` | Yes | GitLab instance URL |
| `defaultProject` | No | Default project ID (falls back to first) |
| `projects[].id` | Yes | Unique project identifier |
| `projects[].path` | Yes | GitLab project path (group/project) |
| `projects[].tokenEnv` | Yes | Env var name containing the token |
| `projects[].defaultBranch` | No | Default branch for this project |

### K8s Config

| Field | Required | Description |
|-------|----------|-------------|
| `kubeconfigs[].id` | Yes | Unique cluster identifier |
| `kubeconfigs[].path` | Yes | Kubeconfig file path (~ supported) |
| `kubeconfigs[].context` | No | Context to use (defaults to current-context) |
| `kubeconfigs[].namespace` | No | Default namespace override |
| `defaultContext` | No | Default cluster ID |
| `defaultNamespace` | No | Fallback namespace |

### Webhook Config

| Field | Required | Description |
|-------|----------|-------------|
| `secret` | Yes | Shared secret for webhook verification |
| `projectPaths` | No | Filter by project path (whitelist) |
| `quietEvents` | No | Event types to suppress |

### Monitor Config

| Field | Default | Description |
|-------|---------|-------------|
| `pollIntervalSec` | 60 | Polling interval |
| `cooldownSec` | 300 | Alert cooldown to prevent spam |
| `pipeline[]` | — | Pipeline alert rules |
| `pod[]` | — | Pod alert rules |

## Development

```sh
pnpm install
pnpm run typecheck   # TypeScript check
pnpm run build       # Build with tsdown (output in lib/)
node scripts/offline-build.mjs   # no-registry rebuild of lib/ (Node >= 22.13)
pnpm run test        # Run unit tests
```

## Architecture

```
src/
├── index.ts          # Plugin entry: apply(ctx) orchestrator
├── config.ts         # Unified config parsing + validation
├── types.ts          # Shared public types
├── api.ts            # Local HTTP routes (settings wizard connectivity test)
├── runtime-config.ts # Runtime config loader (~/.dsh-devops/config.json)
├── gitlab/           # GitLab API client + multi-project router
├── k8s/              # K8s API client + kubeconfig parser + multi-cluster router
├── tools/            # Tool registration (gitlab_*, k8s_*)
├── webhook/          # GitLab webhook → followup handler
├── monitor/          # Background polling alert engine + throttle
└── runtime/          # Lazy service wrappers (lazy.ts)
```

## Requirements

- Node.js ≥ 22.19 (native `fetch`, ESM)
- GitLab ≥ 16.0 (MR Approvals API)
- Kubernetes API ≥ 1.25 (apps/v1)
- Network access to GitLab and K8s API endpoints

## License

MIT
