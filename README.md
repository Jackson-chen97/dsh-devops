# @jacksonchen/dsh-devops

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
- **i18n**: Chinese / English dictionaries registered into the DSH LocaleRuntime — the console follows the app's language setting
- **Self-signed clusters**: Per-request CA pinning from kubeconfig via `node:https`

## Installation

**🚀 Recommended: Local Checkout Method (No npm dependency issues)**

Due to a known issue with `@deepseek-ai/dsh-type-meta` missing from npm, the **local checkout method is the most reliable way** to install this plugin. See [GitHub discussion #410](https://github.com/deepseek-ai/deepseek-harness/discussions/410) and [discussion #984](https://github.com/deepseek-ai/deepseek-harness/discussions/984).

---

### Method 1: Complete Setup Guide (Recommended ✅)

This guide walks you through cloning the repository and installing it locally.

#### Step 1: Clone the Repository

```sh
# Create a directory for your project tools (or use existing location)
mkdir -p ~/dev/tools
cd ~/dev/tools

# Clone the dsh-devops repository
git clone https://github.com/Jackson-chen97/dsh-devops
cd dsh-devops

# Verify the project structure
ls -la
```

Expected output shows:
```
src/          # Source TypeScript code
package.json  # Project configuration
README.md     # This documentation
```

#### Step 2: Install Plugin in DSH Profile

Use one of these two methods:

**Option A: Using dsh plugin CLI command**
```sh
dsh plugin --profile web add "~/dev/tools/dsh-devops"
```

**Option B: Direct configuration in profile package.json**
```sh
# Edit your profile's package.json
nano ~/.dsh/profiles/web/package.json
# Or use your preferred editor: notepad, vim, code, etc.

# Add this line to the "dependencies" section:
{
  "@jacksonchen/dsh-devops": "~/dev/tools/dsh-devops"
}
```

#### Step 3: Declare Plugin in Patch Layer

Add the following to `~/.dsh/profiles/web/cordis.patch.yml`:

```yaml
- insert:
    - id: dsh-devops
      name: '@jacksonchen/dsh-devops'
```

If the file doesn't exist yet, create it with that content.

#### Step 4: Restart DSH

```sh
# Stop any running DSH instance first if needed
# Then start fresh
dsh --profile web
```

The browser should open automatically at http://127.0.0.1:3080/

#### Step 5: Configure DevOps Settings

1. Open DSH Settings → DevOps tab
2. Add your GitLab server(s): Base URL + Token
3. Add your K8s kubeconfig file(s)
4. Save and return to dashboard

---

### Why Local Checkout?

✅ **Works offline** - No pnpm registry needed  
✅ **Bypasses dependency issues** - The `dsh-type-meta` problem is avoided  
✅ **Hot reload support** - Code changes take effect immediately after restart  
✅ **Prebuilt plugin bundle** - the checkout ships `lib/` built by tsdown (host ESM + web client CJS)  
✅ **Perfect for development/testing** - Ideal during active development  

---

### Other Methods (For Reference Only)

Once the `dsh-type-meta` issue is resolved by maintainers, you can use these traditional methods:

**From npm (after publishing):**
```sh
dsh plugin --profile web add @jacksonchen/dsh-devops
```

**From GitHub:**
```sh
dsh plugin --profile web add https://github.com/Jackson-chen97/dsh-devops.git
```

Equivalent pnpm commands in profile directory:

```sh
cd ~/.dsh/profiles/web
pnpm add @jacksonchen/dsh-devops       # npm (once published)
pnpm add https://github.com/Jackson-chen97/dsh-devops.git  # GitHub
```

**Note:** Unlike traditional npm packages, the local checkout method is loaded directly from this directory — build once with `pnpm install && pnpm build` (or use the committed `lib/`) and the DSH host loads `lib/index.js` while the web app injects `lib/client.js`.

1. Open DSH Settings > DevOps, add GitLab server(s) (Base URL + token) and kubeconfig file(s).
2. On the dashboard, pick the GitLab project and K8s context/namespace — selections are saved to `~/.dsh-devops/config.json` automatically.
3. Create MRs, tags, inspect pipelines and operate deployments right from the dashboard — or just ask the AI, which calls the same tools with the same config.

Or configure via `cordis.patch.yml`:

```yaml
- id: dsh-devops
  name: '@jacksonchen/dsh-devops'
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

All tools are registered as soon as the plugin loads — **no YAML config needed**. They read the same configuration the Settings > DevOps UI saves (`~/.dsh-devops/config.json`), so switching project/cluster in the dashboard applies to AI calls immediately. Calling a tool before configuring returns a hint to finish setup first.

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
| `pipeline[]` | ⚠️ | Pipeline alert rules |
| `pod[]` | ⚠️ | Pod alert rules |

## Development

```sh
pnpm install
pnpm run typecheck   # TypeScript check
pnpm run build       # tsdown dual build: host ESM + browser client (output in lib/)
pnpm run test        # run vitest suite
pnpm run verify      # typecheck + build + test in one go
```

**Note:** With a local link install (the profile dependencies point at this directory), DSH loads the artifacts in lib/ directly — re-run `pnpm build` after changing src/, otherwise the host keeps loading the stale bundle. The committed lib/ also means a fresh clone can be installed without building.

## Architecture

```
src/
├── index.ts            # Public contract: name / inject / Config / apply
├── protocol.ts         # RPC channel + endpoint names (shared host/client)
├── config.ts           # Schemastery schema + cross-field validation
├── types.ts            # Shared domain types
├── core/               # Framework-independent domain layer
│   ├── gitlab/         #   GitLab REST client + multi-project router/service
│   ├── k8s/            #   K8s REST client + kubeconfig parser + router/service
│   ├── webhook/        #   Pure event parsing + followup message generation
│   ├── monitor/        #   Alert rule evaluation + throttle
│   ├── http.ts         #   fetch/node:https with timeout + CA pinning
│   └── logging.ts      #   ~/.dsh-devops/devops.log writer/reader
├── host/               # DSH host adaptation layer
│   ├── plugin.ts       #   apply(): lazy services + tools + RPC + webhook + monitor
│   ├── rpc.ts          #   /dsh-devops-read + /dsh-devops-write channels
│   ├── endpoints-*.ts  #   RPC endpoint handlers (raw params, test-before-save)
│   ├── tools*.ts       #   gitlab_* / k8s_* AI tool definitions
│   ├── services.ts     #   Lazy per-call service wrappers
│   ├── config-store.ts #   ~/.dsh-devops/config.json persistence + migration
│   └── runtime-config.ts # cordis override > settings file resolution
└── client/             # Web console (React TSX + CSS Modules, zh/en locales)
    ├── index.ts        #   slots.inject('settings.section' | 'conversation.view')
    ├── api.ts          #   DevopsClient — RPC wrapper over the two channels
    ├── DevopsSettings.tsx / DevopsDashboard.tsx
    └── ui.tsx          #   Shared primitives (Btn/Select/StatCard/…)
```

## Requirements

- Node.js ≥ 22.19 (native `fetch`, ESM)
- GitLab ≥ 16.0 (MR Approvals API)
- Kubernetes API ≥ 1.25 (apps/v1)
- Network access to GitLab and K8s API endpoints

## License

MIT