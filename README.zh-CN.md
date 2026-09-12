# @JacksonChen/dsh-devops

[![Release](https://img.shields.io/github/v/release/Jackson-chen97/dsh-devops)](https://github.com/Jackson-chen97/dsh-devops/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
![Node](https://img.shields.io/badge/node-%E2%89%A522.19-green)
![DSH](https://img.shields.io/badge/dsh-%E2%89%A50.1.x-orange)
[![Topic: dsh-plugin](https://img.shields.io/badge/dsh-plugin-8A2BE2)](https://github.com/topics/dsh-plugin)

面向 DeepSeek Harness（DSH）的 GitLab + Kubernetes 研发监控插件。

[English](./README.md)

| GitLab 页签 | K8s 页签 |
|------------|---------|
| <img src="docs/images/dashboard-gitlab.png" width="480" /> | <img src="docs/images/dashboard-k8s.png" width="480" /> |

## 功能特性

- **GitLab API**：创建/评审/关闭 MR、管理 Tag、监控 CI/CD Pipeline（可展开查看每个 Job 的详情）
- **Kubernetes API**：Deployment 状态、Pod 列表、事件、日志，支持更换镜像与滚动重启
- **监控台 UI**：双卡片切换器（GitLab 服务器/项目、kubeconfig/Context/Namespace），选择自动保存
- **多配置管理**：支持多套 GitLab 服务器与多个 kubeconfig，可在监控台和设置页随时切换
- **Webhook + 告警引擎**：GitLab Webhook → `followup()` 通知；后台轮询自动发现 Pipeline 失败与 Pod 崩溃
- **多语言**：内置中文 / 英文界面，一键切换语言（记忆选择，默认跟随浏览器语言）
- **自签证书集群**：基于 kubeconfig 的 CA 逐请求注入（`node:https` CA pinning）

## 安装

`dsh plugin` 命令实际转发到 profile 目录内的 pnpm，因此 npm、Git 仓库、本地路径都可以作为安装源。

```sh
# 从 npm 安装（发布后）
cd ~/.dsh/profiles/web
pnpm add @JacksonChen/dsh-devops

# 从 GitHub 安装
cd ~/.dsh/profiles/web
pnpm add https://github.com/Jackson-chen97/dsh-devops.git

# 从本地目录安装（开发模式）
cd ~/.dsh/profiles/web
pnpm add "D:/path/to/dsh-devops"
```

然后在 profile 的补丁层 `~/.dsh/profiles/web/cordis.patch.yml` 中声明插件（必须——加了这个插件才会被加载）：

```yaml
- insert:
    - id: dsh-devops
      name: '@JacksonChen/dsh-devops'
```

重启 DSH，打开 设置 → DevOps 完成配置。

## 快速开始

1. 打开 DSH 设置 → DevOps，添加 GitLab 服务器（Base URL + Token）和 kubeconfig 文件。
2. 在监控台选择 GitLab 项目和 K8s 的 Context/Namespace，选择会自动保存到 `~/.dsh-devops/config.json`。
3. 直接在监控台创建 MR/Tag、查看 Pipeline、运维 Deployment——或者直接对 AI 说，AI 通过同一套工具、同一份配置完成。

也可以通过 `cordis.patch.yml` 配置：

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

## AI 工具

插件加载即注册全部工具——**无需任何 YAML 配置**。工具读取与设置页（设置 → DevOps）相同的配置（`~/.dsh-devops/config.json`），在监控台切换项目/集群后 AI 调用立即跟随；未配置时调用会返回「请先完成配置」的提示引导用户。

无头部署等高级场景仍可在 cordis 补丁条目的 `config:` 块中显式覆盖配置。

| 工具 | 说明 |
|------|------|
| `gitlab_mr_create` | 创建 MR（自动触发 Pipeline 监控） |
| `gitlab_mr_review` | 评审 MR（approve/request_changes/comment） |
| `gitlab_mr_list` | 列出 Merge Request |
| `gitlab_tag_create` | 创建 Git Tag |
| `gitlab_pipeline_status` | 查询 Pipeline 状态 |
| `gitlab_pipeline_jobs` | 列出 Pipeline 的 Job 明细 |
| `gitlab_pipeline_watch` | 启动/停止/查询 Pipeline 监控 |
| `k8s_deployment_status` | 查询 Deployment 发布状态 |
| `k8s_pods` | 列出 Pod（含重启次数） |
| `k8s_events` | 获取最近 K8s 事件 |
| `k8s_logs` | 获取 Pod 日志（tail N 行） |

## 配置参考

### GitLab 配置

| 字段 | 必填 | 说明 |
|------|------|------|
| `baseUrl` | 是 | GitLab 实例地址 |
| `defaultProject` | 否 | 默认项目 ID（缺省取第一个） |
| `projects[].id` | 是 | 项目唯一标识 |
| `projects[].path` | 是 | GitLab 项目路径（group/project） |
| `projects[].tokenEnv` | 是 | 存放 Token 的环境变量名 |
| `projects[].defaultBranch` | 否 | 该项目的默认分支 |

### K8s 配置

| 字段 | 必填 | 说明 |
|------|------|------|
| `kubeconfigs[].id` | 是 | 集群唯一标识 |
| `kubeconfigs[].path` | 是 | kubeconfig 文件路径（支持 `~`） |
| `kubeconfigs[].context` | 否 | 使用的 Context（缺省取 current-context） |
| `kubeconfigs[].namespace` | 否 | 默认 Namespace 覆盖 |
| `defaultContext` | 否 | 默认集群 ID |
| `defaultNamespace` | 否 | 兜底 Namespace |

### Webhook 配置

| 字段 | 必填 | 说明 |
|------|------|------|
| `secret` | 是 | Webhook 校验共享密钥 |
| `projectPaths` | 否 | 项目路径白名单过滤 |
| `quietEvents` | 否 | 需要静默的事件类型 |

### Monitor 配置

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `pollIntervalSec` | 60 | 轮询间隔（秒） |
| `cooldownSec` | 300 | 告警冷却时间，防止刷屏 |
| `pipeline[]` | — | Pipeline 告警规则 |
| `pod[]` | — | Pod 告警规则 |

## 开发

```sh
pnpm install
pnpm run typecheck   # TypeScript 类型检查
pnpm run build       # 使用 tsdown 构建（输出到 lib/）
pnpm run test        # 运行单元测试
```

## 架构

```
src/
├── index.ts          # 插件入口：apply(ctx) 编排
├── config.ts         # 统一配置解析与校验
├── types.ts          # 公共类型定义
├── gitlab/           # GitLab API 客户端 + 多项目路由
├── k8s/              # K8s API 客户端 + kubeconfig 解析 + 多集群路由
├── tools/            # 工具注册（gitlab_*、k8s_*）
├── webhook/          # GitLab Webhook → followup 处理
├── monitor/          # 后台轮询告警引擎 + 节流
└── ui/               # 监控台面板（可选，DSH UI 扩展）
```

## 环境要求

- Node.js ≥ 22.19（原生 `fetch`、ESM）
- GitLab ≥ 16.0（MR Approvals API）
- Kubernetes API ≥ 1.25（apps/v1）
- 可访问 GitLab 与 K8s API 端点的网络

## 许可证

MIT
