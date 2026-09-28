# 变更记录 / Changelog

## v0.3.0 — 新增 devops_config 配置发现工具

### 新增
- **devops_config 工具**：无参数，返回全部已配置的 GitLab 服务器/项目与 kubeconfig/集群（id、label、baseUrl、projectPath、branch、context、namespace 与当前激活项），并附 hint 说明如何把名字映射为 gitlab_* 工具的 `project` 与 k8s_* 工具的 `cluster` 参数；用户说「查看 [配置名] 的 [服务] 日志」时，agent 可先调用它完成名字 → id 的映射
- **token 不进工具输出**：token 值不出现在 AI 工具结果中（工具输出会进入模型上下文），改为 `tokenConfigured` 布尔标志；浏览器设置页的 config-load RPC 仍是唯一 token 载体
- **有效激活项与解析器一致**：报告的 activeServerId / activeKubeconfigId 复用 resolveGitLabConfig / resolveK8sConfig 的「active 不可用则回退首个可用」选择逻辑，即其他工具实际会解析到的配置
- **未配置时返回结果而非抛错**：`{configured: false, message}` 复用 NOT_CONFIGURED_MSG 常量，引导先完成设置
- **测试**：新增 tests/host/tools-config.spec.ts（7 例：注册名/无参 schema、未配置提示、双 server + 双 kubeconfig 全字段与激活回退、token 屏蔽、空节省略、render JSON 无损）

### 变更
- 工具总数 11 → 12：devops_config 无服务依赖，插件加载即注册（其余工具行为不变）

## v0.2.0 — 项目架构与 Web 控制台全面重构

### 架构
- **三层结构**：src/core/（框架无关领域层：GitLab/K8s 客户端、webhook 解析、告警规则、HTTP/日志工具）+ src/host/（DSH 宿主适配：插件装配、RPC 端点、AI 工具、webhook/monitor 注册、配置存储）+ src/client/（React WebUI）
- **WebUI 重写**：2207 行手写 client.js 迁移为 TSX 组件（DevopsSettings / DevopsDashboard / 共享 UI 原语），CSS Modules + lightningcss 编译内联，tsdown 双段构建（Node ESM host + 浏览器 CJS client，ModuleLoader 包装）
- **RPC 通道取代 HTTP API**：28 个 /devops/api/* HTTP 端点迁移为 Connection RPC 通道（/dsh-devops-read + /dsh-devops-write），客户端经 connection.rpc.call 调用，host 侧 ctx.inject(['connection']) 条件注册（headless 环境自动跳过）
- **i18n 接入 DSH LocaleRuntime**：内置语言切换改为 ctx.locale.register/bind，跟随应用语言设置；zh/en 字典键级对齐（测试保证）
- **插槽声明式注册**：settings.section / conversation.view 统一走 ctx.slots.inject → register 模式（直接注册未声明插槽会抛错）
- **严格 TypeScript**：strict + noUncheckedIndexedAccess + verbatimModuleSyntax + isolatedModules，.ts 扩展名导入

### Web 控制台
- **全部分下拉框支持搜索**：原生 select 重写为可搜索 Combobox（触发按钮 + 搜索框 + 过滤列表，键盘 ↑/↓/Enter/Escape 支持，点击外部关闭），覆盖设置向导与仪表盘全部下拉
- **二级 tab 栏**：合并请求 / 标签 / 流水线（GitLab 下）与部署 / 最近事件（K8s 下）由纵向堆叠改为二级 tab（小尺寸 + 数量徽标），每页只渲染对应区块
- **流水线 job 日志**：展开流水线后每个 job 带「日志」按钮，弹窗展示经 ANSI 清洗的完整构建日志，并提供「在 GitLab 打开」链接
- **K8s pod 日志弹窗化**：点击 pod 行「日志」打开弹窗（标题为 pod 名），与 job 日志弹窗交互一致
- **操作弹窗化**：新建 MR / 新建 Tag / 换镜像 / 重启 全部改为 Modal 弹窗（重启带确认说明），自研 Modal 原语（portal + 遮罩点击/Escape 关闭，内部事件 stopPropagation 防 DSH 全局拦截）
- **设置页卡片式交互**：每套 GitLab / kubeconfig 配置是一张可展开的手风琴卡片（状态点 + 名称 + 地址 + 连接徽标），表单住在卡片内部，字段改动直接写回条目；空态为虚线大按钮；加载后自动展开首卡并静默重验连接

### 修复
- **k8s PATCH 请求体丢失**：requestWithTimeout 的 TLS 分支未读取 body 字段，导致换镜像/重启 400（浏览器端到端验证发现）
- **config 路径唯一来源**：~/.dsh-devops/config.json 路径重复定义合并到 core/logging.ts
- 清理调试残留（.v-frame.txt、探针脚本、无效 test:e2e 脚本、tsdown external 正则笔误）
- **config 测试与实现对齐**：按「空配置段 = 未配置」的真实契约重写（旧测试断言了不存在的校验）

### 工程化
- vitest 覆盖 core/host/client 三层（82 个测试）：配置迁移、RPC 端点分发、通道映射、locale 对齐、搜索下拉/弹窗/设置卡片流等 jsdom 组件测试
- 客户端测试复用 tsdown 的 CSS Modules 插件（injectStyles=false），jsdom 环境渲染冒烟
- 依赖分层：schemastery/yaml 为 dependencies；@deepseek-ai/cordis、dsh-tools、react 为 peerDependencies；dsh-tools 精确 pin 0.1.5-rc.2（与宿主一致）
- 端到端验证：Docker GitLab（CE + runner，绿色 pipeline）+ k3s（token kubeconfig）真实环境，内置浏览器完成配置向导与读写操作验证

## v0.1.2

### 新增
- **本地目录安装指南**：详细的 5 步本地安装流程（克隆仓库 → 配置 profile → 声明插件 → 重启 DSH → 配置设置）
- **安装方式说明**：区分推荐方式（本地目录）与传统方式（npm/GitHub），解释 dsh-type-meta 依赖问题的背景

### 改进
- **README 重构**：完整的安装分步指南，包含 Windows/Linux 兼容命令和多编辑器选择提示
- **移除了对 lib 目录的引用**：明确说明本地开发直接加载 TypeScript 源码，使用 tsx 运行时编译
- **中文文档同步**：中英双语文档保持一致的安装指南和注意事项说明

### 修复
- 解决了 `dsh-type-meta` npm 包缺失导致的安装失败问题，提供可靠的本地目录解决方案
- 移除了误导性的预构建产物说明，澄清无需预先构建即可安装



## v0.1.0
- 首个版本：GitLab + Kubernetes DevOps 监控插件（DSH plugin）。
