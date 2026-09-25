# AGENTS.md — dsh-devops

DSH（DeepSeek Harness）插件：GitLab + Kubernetes DevOps 控制平面（AI 工具 + Web 控制台 + Webhook + 告警监控）。pnpm + TypeScript + tsdown + vitest，Node ≥ 20（开发机构需 ≥ 22）。

## 命令

```sh
pnpm install         # 安装依赖
pnpm build           # tsdown 双段构建：Node ESM host + 浏览器 CJS client → lib/
pnpm typecheck       # tsc --noEmit
pnpm test            # vitest（tests/**/*.spec.{ts,tsx}）
pnpm verify          # typecheck + build + test 一次跑完
```

## 分层与边界

- `src/core/` — 框架无关领域层（gitlab/k8s 客户端与服务、webhook 解析、monitor 规则、`http.ts`、`logging.ts`）。**禁止 import DSH/cordis API**。
- `src/host/` — DSH 宿主适配（`plugin.ts` 入口、`rpc.ts` + `endpoints-*.ts`、`tools*.ts`、懒加载 `services.ts`、`config-store.ts`）。可以 import core，不得 import client。
- `src/client/` — React TSX Web 控制台（`index.ts` 经 slots 注入 settings/dashboard；`api.ts` 是 RPC 业务封装；`ui.tsx` 共享原语；`locales.ts` zh/en 字典）。不 import host/core 的 Node 模块。
- `src/protocol.ts` — host/client 共享的 RPC 通道与端点名；新增端点必须两侧同步。

## 关键规则（容易踩坑）

1. **lib/ 是提交的构建产物**：安装（本地 link / 克隆）直接加载 `lib/index.js` + `lib/client.js`。改完 `src/` 必须 `pnpm build`，否则 DSH 加载旧代码。
2. **导入必须写真实扩展名**（`.ts` / `.tsx`）。tsc 能把 `./ui.ts` 解析到 `ui.tsx`，但 vite/vitest 不能——写错会只在测试里炸。
3. **cordis ctx 属性访问受追踪**：`apply()` 期间访问未 inject 的服务（如 `ctx.log`）直接抛错。用 `console`，不要碰 `ctx.log`。host 的 `inject` 只有 `['tools']`；`connection` 在 `apply` 内用 `ctx.inject(['connection'], ...)` 条件注入（headless 自动跳过）。
4. **插槽必须声明式注册**：`ctx.slots.inject(name, () => ctx.slots.register(...))`——直接 register 未声明插槽会导致客户端加载失败。
5. **RPC 契约**：通道 `/dsh-devops-read`（只读）与 `/dsh-devops-write`（写操作）；handler 返回 `{ ok: true, value } | { ok: false, error }` 信封；端点业务载荷保留历史 `{ ok, message }` 软失败形状（连通性问题不是 RPC 错误）。
6. **k8s 请求一律走 `core/http.ts` 的 `requestWithTimeout`**：kubeconfig 需要逐请求 CA 固定（node:https 路径）；`body` 与 `bodyText` 两条路径都接受字符串体（曾因 TLS 分支丢 body 修过 bug）。
7. **工具结果必须 JSON 无损**：execute 用 `cleanTool()` 包裹（剔除 undefined）。
8. **Config schema 禁用 `.required()`**：空配置必须能干净启动；`parseConfig` 先剥离空段再校验跨字段规则。配置优先级：cordis 覆盖 > `~/.dsh-devops/config.json`（设置页写入）。路径常量只在 `core/logging.ts` 定义。注意设置文件是 `servers[]`/`kubeconfigs[]` 形状，cordis config 是 schema 形状，两者不同。
9. **客户端事件**：Select/Modal 等原语内部对 mousedown/click/keydown `stopPropagation()`，防止 DSH 全局处理器关闭下拉/弹窗——新增交互原语要沿用该模式。
10. **i18n**：文案一律进 `src/client/locales.ts`（zh 为源，en 必须同键——有测试校验）；翻译函数经 `ctx.locale.bind('dsh-devops')` 注入组件，组件用 `useLocaleRevision` 响应语言切换。
11. **依赖分层**：`schemastery`/`yaml` 是 dependencies；`@deepseek-ai/cordis`、`@deepseek-ai/dsh-tools`、`react` 是 peerDependencies；`dsh-tools` 精确 pin 与宿主一致的版本。

## 测试

- 默认 node 环境；React 组件测试文件头加 `// @vitest-environment jsdom`。
- vitest 复用 `tsdown.config.ts` 的 `clientCssPlugin(false)` 编译 `.module.css`（类名带 hash，断言用 `[class*="xxx"]`）。
- 触碰 `~/.dsh-devops` 的测试必须先 `vi.mock('node:os', …)` 把 homedir 指到临时目录再动态 import 被测模块（参考 `tests/host/runtime-config.spec.ts`）。

## 验证环境

- 本地 DSH：`~/.dsh/profiles/web` 以 `link:` 依赖指向本仓库；`dsh --profile web --port 8123 --no-open` 启动，浏览器 token 打印在 stdout。
- Docker：GitLab CE（localhost:8080，root PAT 可用 `gitlab-rails runner` 生成）+ k3s（127.0.0.1:6443，token 型 kubeconfig 在 `~/.kube/dsh-devops-test.yaml`）。
- UI 改动用内置浏览器回归：设置 → DevOps（卡片式向导）与会话 DevOps tab（二级 tab 仪表盘）。

## 文档

- `README.md` 与 `README.zh-CN.md` 内容互为镜像，改动需双份同步（zh 为主）。
- `CHANGELOG.md` 每个版本一个条目；`lib/` 随仓库提交（离线安装设计）。
