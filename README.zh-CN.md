# @jacksonchen/dsh-devops

[![Release](https://img.shields.io/github/v/release/Jackson-chen97/dsh-devops)](https://github.com/Jackson-chen97/dsh-devops/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
![Node](https://img.shields.io/badge/node-%E2%89%A522.19-green)
![DSH](https://img.shields.io/badge/dsh-%E2%89%A50.1.x-orange)
[![Topic: dsh-plugin](https://img.shields.io/badge/dsh-plugin-8A2BE2)](https://github.com/topics/dsh-plugin)

面向 DeepSeek Harness（DSH）的 GitLab + Kubernetes 研发监控插件�?
[English](./README.md)

| GitLab 页签 | K8s 页签 |
|------------|---------|
| <img src="docs/images/dashboard-gitlab.png" width="480" /> | <img src="docs/images/dashboard-k8s.png" width="480" /> |

## 功能特�?
- **GitLab API**：创�?评审/关闭 MR、管�?Tag、监�?CI/CD Pipeline（可展开查看每个 Job 的详情）
- **Kubernetes API**：Deployment 状态、Pod 列表、事件、日志，支持更换镜像与滚动重�?- **监控�?UI**：双卡片切换器（GitLab 服务�?项目、kubeconfig/Context/Namespace），选择自动保存
- **多配置管�?*：支持多�?GitLab 服务器与多个 kubeconfig，可在监控台和设置页随时切换
- **Webhook + 告警引擎**：GitLab Webhook �?`followup()` 通知；后台轮询自动发�?Pipeline 失败�?Pod 崩溃
- **多语言**：内置中�?/ 英文界面，一键切换语言（记忆选择，默认跟随浏览器语言�?- **自签证书集群**：基�?kubeconfig �?CA 逐请求注入（`node:https` CA pinning�?
## 安装

`dsh plugin` 命令实际转发�?profile 目录内的 pnpm，因�?npm、Git 仓库、本地路径都可以作为安装源�?
```sh
# �?npm 安装（发布后�?dsh plugin --profile web add @jacksonchen/dsh-devops

# �?GitHub 安装
dsh plugin --profile web add https://github.com/Jackson-chen97/dsh-devops.git

# 从本地目录安装（开发模式）
dsh plugin --profile web add "D:/path/to/dsh-devops"
```

等价�?pnpm 命令（如果偏好直接在 profile 目录操作）：

```sh
cd ~/.dsh/profiles/web
pnpm add @jacksonchen/dsh-devops       # npm（发布后�?pnpm add https://github.com/Jackson-chen97/dsh-devops.git  # GitHub
pnpm add "D:/path/to/dsh-devops"       # 本地路径
```

然后�?profile 的补丁层 `~/.dsh/profiles/web/cordis.patch.yml` 中声明插件（必须——加了这个插件才会被加载）：

```yaml
- insert:
    - id: dsh-devops
      name: '@jacksonchen/dsh-devops'
```

重启 DSH，打开 设置 �?DevOps 完成配置�?
## 从预构建产物安装（无需构建、无需 registry�?
`lib/` 里是完整可运行的构建产物，并�?*已提交到仓库**——因此安装时**无需构建步骤、无需包管理器**，适合受限或离线环境。直�?`git clone` 即可�?
```sh
# 1) 克隆到任意目�?git clone https://github.com/Jackson-chen97/dsh-devops

# 2) 把预构建 bundle 拷到 profile 的共�?node_modules
#    （Windows �?~/.dsh �?%USERPROFILE%\.dsh�?DEST=~/.dsh/profiles/node_modules/@jacksonchen/dsh-devops
mkdir -p "$DEST"
cp -R dsh-devops/lib dsh-devops/package.json dsh-devops/cordis.patch.yml "$DEST"/

# 3) 注册 bundle：把 "@jacksonchen/dsh-devops" 加进
#    ~/.dsh/profiles/web/package.json �?`dsh.profile.bundles`。这和加�?#    @deepseek-ai/dsh-base、dsh-web-app 用的是同一份列表；bundle 会通过
#    自带�?cordis.patch.yml 自我注册。例如：
#    "dsh": { "profile": { "bundles": [
#      "@deepseek-ai/dsh-base",
#      "@deepseek-ai/dsh-web-app",
#      "@jacksonchen/dsh-devops"
#    ] } }

# 4) 重启 DSH，打开 设置 �?DevOps�?```

> 离线产物只含 `lib/*.js`；`.d.ts` 类型文件由正常的 `pnpm run build`（tsdown）生成，
> 预构�?bundle 仅提供运行时�?
## 快速开�?
1. 打开 DSH 设置 �?DevOps，添�?GitLab 服务器（Base URL + Token）和 kubeconfig 文件�?2. 在监控台选择 GitLab 项目�?K8s �?Context/Namespace，选择会自动保存到 `~/.dsh-devops/config.json`�?3. 直接在监控台创建 MR/Tag、查�?Pipeline、运�?Deployment——或者直接对 AI 说，AI 通过同一套工具、同一份配置完成�?
也可以通过 `cordis.patch.yml` 配置�?
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

## AI 工具

插件加载即注册全部工具—�?*无需任何 YAML 配置**。工具读取与设置页（设置 �?DevOps）相同的配置（`~/.dsh-devops/config.json`），在监控台切换项目/集群�?AI 调用立即跟随；未配置时调用会返回「请先完成配置」的提示引导用户�?
无头部署等高级场景仍可在 cordis 补丁条目�?`config:` 块中显式覆盖配置�?
| 工具 | 说明 |
|------|------|
| `gitlab_mr_create` | 创建 MR（自动触�?Pipeline 监控�?|
| `gitlab_mr_review` | 评审 MR（approve/request_changes/comment�?|
| `gitlab_mr_list` | 列出 Merge Request |
| `gitlab_tag_create` | 创建 Git Tag |
| `gitlab_pipeline_status` | 查询 Pipeline 状�?|
| `gitlab_pipeline_jobs` | 列出 Pipeline �?Job 明细 |
| `gitlab_pipeline_watch` | 启动/停止/查询 Pipeline 监控 |
| `k8s_deployment_status` | 查询 Deployment 发布状�?|
| `k8s_pods` | 列出 Pod（含重启次数�?|
| `k8s_events` | 获取最�?K8s 事件 |
| `k8s_logs` | 获取 Pod 日志（tail N 行） |

## 配置参�?
### GitLab 配置

| 字段 | 必填 | 说明 |
|------|------|------|
| `baseUrl` | �?| GitLab 实例地址 |
| `defaultProject` | �?| 默认项目 ID（缺省取第一个） |
| `projects[].id` | �?| 项目唯一标识 |
| `projects[].path` | �?| GitLab 项目路径（group/project�?|
| `projects[].tokenEnv` | �?| 存放 Token 的环境变量名 |
| `projects[].defaultBranch` | �?| 该项目的默认分支 |

### K8s 配置

| 字段 | 必填 | 说明 |
|------|------|------|
| `kubeconfigs[].id` | �?| 集群唯一标识 |
| `kubeconfigs[].path` | �?| kubeconfig 文件路径（支�?`~`�?|
| `kubeconfigs[].context` | �?| 使用�?Context（缺省取 current-context�?|
| `kubeconfigs[].namespace` | �?| 默认 Namespace 覆盖 |
| `defaultContext` | �?| 默认集群 ID |
| `defaultNamespace` | �?| 兜底 Namespace |

### Webhook 配置

| 字段 | 必填 | 说明 |
|------|------|------|
| `secret` | �?| Webhook 校验共享密钥 |
| `projectPaths` | �?| 项目路径白名单过�?|
| `quietEvents` | �?| 需要静默的事件类型 |

### Monitor 配置

| 字段 | 默认�?| 说明 |
|------|--------|------|
| `pollIntervalSec` | 60 | 轮询间隔（秒�?|
| `cooldownSec` | 300 | 告警冷却时间，防止刷�?|
| `pipeline[]` | �?| Pipeline 告警规则 |
| `pod[]` | �?| Pod 告警规则 |

## 开�?
```sh
pnpm install
pnpm run typecheck   # TypeScript 类型检�?pnpm run build       # 使用 tsdown 构建（输出到 lib/�?node scripts/offline-build.mjs   # 离线重建 lib/（Node >= 22.13，无需 registry�?pnpm run test        # 运行单元测试
```

## 架构

```
src/
├── index.ts          # 插件入口：apply(ctx) 编排
├── config.ts         # 统一配置解析与校�?├── types.ts          # 公共类型定义
├── api.ts            # 本地 HTTP 路由（设置向导连通性测试）
├── runtime-config.ts # 运行时配置（~/.dsh-devops/config.json�?├── gitlab/           # GitLab API 客户�?+ 多项目路�?├── k8s/              # K8s API 客户�?+ kubeconfig 解析 + 多集群路�?├── tools/            # 工具注册（gitlab_*、k8s_*�?├── webhook/          # GitLab Webhook �?followup 处理
├── monitor/          # 后台轮询告警引擎 + 节流
└── runtime/          # 惰性服务包装（lazy.ts�?```

## 环境要求

- Node.js �?22.19（原�?`fetch`、ESM�?- GitLab �?16.0（MR Approvals API�?- Kubernetes API �?1.25（apps/v1�?- 可访�?GitLab �?K8s API 端点的网�?
## 许可�?
MIT
