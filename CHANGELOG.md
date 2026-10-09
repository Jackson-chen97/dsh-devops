# 变更记录 / Changelog

## v0.3.6 — 控制台样式对齐 DSH 宿主原生设计

### 变更
- **宿主 token 桥接层**：`theme.ts` 从「自研色板 + JS 主题检测」重写为纯 CSS 宿主 token 桥接——`--dsh-devops-*` 变量在 `body` / `body[data-ds-dark-theme]` 两段声明为 `var(--dsw-alias-*, <每主题 fallback>)`，亮/暗即时跟随宿主原生明暗属性切换（零检测逻辑、零重渲染）；无宿主 token 的环境（jsdom 测试 / 旧宿主）按同一宿主属性取对应 fallback
- **发丝描边与圆角节奏**：全部 1px 描边 → 0.5px，卡片/输入/分隔按宿主层级取 l3/l4/l2/l1；卡片 r16 / 小卡 r12 / 行与输入 r8；按钮、badge、chip 统一 999px 胶囊 + `corner-shape: round`
- **主按钮与 Tab 对齐宿主**：主按钮改为宿主反色胶囊按钮（亮 = 近黑底白字 / 暗 = 近白底深字，hover 走 `button-primary-hover`，0.16s 过渡）；二级 tab 从实心蓝底白字改为宿主下划线式（active = 业务主色字 + 2px 下划线，容器底线 0.5px l2）
- **状态色 tint 随主题**：badge / chip / callout / 搜索激活选项的底色从暗色硬编码 tint 改为 `color-mix(状态色 10–12%, transparent)` + 状态色字，明暗自动适配；neutral 徽标用宿主 `bg-module-platform` + `label-secondary`
- **浮层对齐宿主**：弹窗（r16、`bg-layer-2`、`border: 0` + `--dsw-elevation-prominent` 阴影，遮罩加 `--dsw-mask-blur` 背景模糊）、搜索弹层（r8、`bg-layer-2` + `--dsw-elevation-panel`）、toast（宿主规格：固定深灰 chip + 浅色字 + elevation 阴影，tone 以状态色符号区分）
- **日志面板**：底色改宿主 `markdown-code-block`（亮 #f9fafb / 暗 #1b1b1c），等宽字体改宿主 `--ds-font-family-code` 栈（替换自持 Cascadia 栈，含视图内联的 `monospace` 字面量）
- **细节**：`.label` 13→12px、`.fieldLabel` 10→11px（宿主最小字号）；统计卡 hover 从 accent 描边改为 `label-dimmed` 边 + `interactive-bg-hover` 底；reviewer chip 从实心蓝改为 business-tertiary 底 + business-primary 字
- **下拉框尺寸统一**：监控台切换卡的五个下拉框（GitLab 服务器/项目、kubeconfig/context/namespace）去掉 `compact` 小规格（11px 字、3/6 padding、约 18px 高），与输入框/按钮统一为标准尺寸（14px 字、8/10 padding、r8、0.5px l4 描边）；`Select` 组件的 `compact` prop 与 `searchTriggerCompact` / `searchOptionCompact` 类随之删除
- **布局按数据源归位**：GitLab 配置卡（服务器/项目切换）移入 GitLab tab 下方，K8s 配置卡（kubeconfig/context/namespace）移入 K8s tab 下方，顶部不再常驻两张切换卡；4 张统计卡（开放 MR / 流水线 / 部署 / 异常 Pod）上移至面板最顶部，tab 切换栏之下。配置与数据同屏，未配置的 tab 仍显示原空态提示
- **字体大小统一适配宿主**：控制台字号全部桥接宿主内容字体 token——正文 / 输入 / 标题走宿主 `--dsh-content-font-size`（14px），按钮 / 标签 / 列表行走 `--dsh-content-font-size-secondary`（13px）；微文本（badge / 日志 / 微符号）与统计卡数值联动宿主字号调节量 `--dsh-content-font-delta`，宿主调字号时控制台自动缩放。原 12px 文本升宿主 13px 次级档、10px 微符号升宿主最小 11px（徽标 / tag 规格）、15px 标题收敛为 14px 正文、统计数值 20px → 宿主标题档 18px

### 实现
- `src/client/theme.ts`：删除 `detectTheme` / `colorLuminance` / `MutationObserver` / `matchMedia` 检测链；`THEME_CSS` 改为 `body` 上两段桥接声明（宿主 token 声明在 body，`:root` 桥接因作用域解析不到宿主变量，故必须挂 body）；`initDevopsTheme` 保持幂等注入并替换旧版残留的 stale `<style>` 标签
- `src/client/DevopsUI.module.css`：全量按宿主规格重调，删除死类 `select` / `selectCompact` / `selectDisabled` / `serverRow*` / `formBox` / `searchTriggerCompact` / `searchOptionCompact`
- `src/client/ui.tsx`：Toast 硬编码 rgba 底/边移入 CSS（`--dsh-devops-toast-bg` + 状态色符号）
- `src/client/DevopsDashboard.tsx`：内联 `borderRadius` 4/6 → 6/8 统一，内联等宽字体改 `var(--ds-font-family-code, monospace)`（颜色本就走变量，自动跟随）；顶部双 SwitchCard 提为 `gitlabSwitchCard` / `k8sSwitchCard` 常量，分别渲染为对应 tab 内容区首个子元素，统计卡 grid 上移至 tab 切换栏之上
- `src/client/theme.ts`：新增 4 个字号变量 `--dsh-devops-font` / `-font-2` / `-font-3` / `-font-xl`（两主题块相同声明：base/secondary 桥宿主内容字体 token，微文本与展示档 `calc(Npx + var(--dsh-content-font-delta, 0px))` 联动宿主字号调节）；`DevopsUI.module.css` 41 处字号字面量全部映射到这些变量，`ui.tsx` / `DevopsSettings.tsx` / `DevopsDashboard.tsx` 约 35 处内联 `fontSize` 字面量改 `var(--dsh-devops-font*)`（40px 装饰 emoji 除外）

### 测试
- `tests/client/theme.spec.ts` 重写：`colorLuminance` / `detectTheme` 套件删除；新断言——桥接声明在 `body`（无 `:root`）、暗色块声明数与亮色块相等且 ≥30、每个变量要么 `var(<宿主 token>, <原始 fallback>)` 要么显式自持（toast 字色、日志命中高亮）、字号变量按字阶断言（base/secondary 必须桥宿主内容字体 token，微文本/展示档必须联动宿主字号调节量）、注入幂等、stale 标签替换、不写任何 `data-dsh-devops-theme` 属性
- 全量测试通过（typecheck + build + vitest），lib/ 已重建

## v0.3.5 — 原生侧边栏面板入口（新会话下方）

### 新增
- **DSH 原生侧边栏入口**：监控台现为侧边栏一级面板——「新会话」按钮下方新增 DevOps 行（git 分支图标 + 本地化标签），点击即在主区域打开监控台，再点「新会话」返回对话。按钮、排版、tooltip、选中态与折叠布局全部由 DSH 原生 Sidebar 承载，与内置 Plugins 等面板完全同构（对齐 dsh-mnemon 的 `sidebar.panellist` + `main` 席位模式）
- **主区域面板席位**：`main` 槽 keyed 注册（key `devops`），DSH 选中时渲染 `DevopsDashboard` 组件，注入 props（`connection` / `locale` / `t`）与会话 DevOps tab 完全一致；无会话依赖，可在任意会话下打开
- **声明式嵌套注册**：`ctx.slots.inject('main', () => ctx.slots.inject('sidebar.panellist', …))`——两个槽位由宿主声明后才注册，替换型 shell（未声明原生面板槽）下自动跳过、不报错，既有会话 tab / 设置页入口不受影响

### 实现
- `src/client/index.ts`：新增 `main`（keyed，`key: 'devops'`）与 `sidebar.panellist`（list，`id: 'devops'`、`order: 30`）成对注册，面板 id 同一常量；注册选项补 `locale: 'dsh-devops'` 使标签随语言切换重解析
- `src/client/DevopsPanelIcon.tsx`：新增侧边栏图标组件（git 分支字形，`{ size, active }` props，`currentColor` 描边随主题深浅色自适应，选中行加粗 + 实心标记）
- `src/client/dsh-context.ts`：`ClientSlots.register` 选项补 `key?: string`（keyed 槽）与 `locale?: string`
- `src/client/locales.ts`：新增 `panelLabel` 键（zh/en 同键：'DevOps'）
- `package.json`：`dsh.client.inject` 由服务名改为**包名**形式（DSH 0.2.0 模块图按包名解析依赖，旧的服务名写法不匹配图节点、实际为空操作）：`@deepseek-ai/dsh-client-connection` / `-locale` / `-ui-conversation` / `-ui-layout` / `-ui-settings` / `-ui-sidebar` / `-ui-slots`

### 测试
- client-smoke 新增 1 例：main / sidebar.panellist 以同一面板 id 配对（key/id）、order=30、面板注入 props 与行标签 i18n、图标组件接受 `{ size, active }`；入口用例断言更新为四个槽位（settings.section / conversation.view / main / sidebar.panellist）
- 全量测试通过（typecheck + build + vitest）

## v0.3.4 — 控制台增强：全 tab 绝对时间 / 流水线 job 启动时间 / Pod 启动时间可见

### 新增
- **全 tab 绝对时间显示**：合并请求、标签、部署、事件、动态流五个列表统一新增绝对时间列（`YYYY-MM-DD HH:mm:ss` 本地时间），与原有相对时间并列显示——绝对时间用 fg-3 色调，相对时间用 fg-4 色调（更暗），视觉主次分明。数据字段均已存在（`createdAt` / `updatedAt` / `updated` / `time` / `t`），无数据层改动
- **流水线 job 启动时间**：每个 job 行显示 `started_at`（绝对时间 `YYYY-MM-DD HH:mm:ss`），与已有的耗时（duration）并列。GitLab job API 原生返回 `started_at`，此前在 `RawJob` 未声明、`mapJob` 未映射，现已补全
- **Pod 启动时间从 tooltip 升为可见文本**：K8s 部署展开区每个 Pod 行的启动时间此前仅在 `title` 属性（悬浮）中，现改为直接显示绝对时间 + 相对时间双文本，与全 tab 风格统一

### 数据链
- `RawJob` 加 `started_at?: string` → `mapJob` 输出 `startedAt: string` → `listPipelineJobs` 返回类型补 `startedAt` → `DashboardJob` 补 `startedAt: string`

### 测试
- 全量 122 例通过（typecheck + build + vitest）

## v0.3.3 — 控制台增强：Pod 启动时间 / 子 tab 刷新 / 统计卡跳转 / 列表状态筛选

### 新增
- **Pod 启动时间**：K8s 部署展开区每个 Pod 行显示启动时间——相对时间（如「5 分钟前」），悬浮显示本地精确时间 `YYYY-MM-DD HH:mm:ss`；数据链 `PodInfo.startTime` → RPC `startedAt`（`endpoints-k8s.ts`）→ `DashboardPod.startedAt` 已存在，此前未渲染；未启动的 Pod 不显示
- **五个子 tab 独立刷新**：GitLab（合并请求/标签/流水线）与 K8s（部署/事件）每个子 tab 的标题栏右侧新增刷新按钮，与 60s 自动轮询同一机制（重拉全部列表 + seq 防过期响应）；请求期间按钮禁用
- **统计卡点击跳转**：开放 MR / 流水线 / 部署 / 异常 Pod 四张统计卡可点击，跳到对应 tab + 子 tab（部署与异常 Pod 均到 deployments——Pod 在 deployment 展开区内）
- **列表状态筛选**：
  - 合并请求：开放 / 已合并 / 已关闭 chip 组，server-side 筛选（`gitlab-mrs` 端点带 `state`，切换即重拉该状态列表）；「开放 MR」统计卡与动态流固定按 opened 计数、不受筛选影响；非开放状态下隐藏审批/关闭按钮（审批/关闭仅对开放 MR 有意义）
  - 流水线：全部 / 成功 / 失败 / 运行中 / 已取消 chip 组，客户端过滤——GitLab `status` 查询无法表达「运行中」组（created / waiting_for_resource / preparing / pending / running / queued / scheduled 共 7 态）
  - 部署：全部 / 正常 / 部分就绪 / 未就绪 chip 组，客户端过滤，与统计卡同口径（0/0 缩容视为正常）；与既有搜索框组合生效（先状态筛选、后搜索）
  - 各子 tab 标题徽标改为显示筛选后行数；「列表为空」与「筛选无匹配」区分提示（新增 `noMatch` 文案，zh/en 同键）

### 测试
- client-smoke 新增 3 例：MR 状态筛选（含 `state=merged` 请求断言与非开放态按钮隐藏）、流水线状态筛选（含「运行中」组与无匹配态）、部署就绪度筛选；全量 122 例通过

## v0.3.2 — 控制台增强：标签提交信息 / 日志工具栏 / 部署搜索

### 新增
- **行级「在 GitLab 打开」按钮（↗，行最右）**：合并请求（原有）、标签、流水线、流水线 job 四类列表行统一带 ↗ 按钮——tag URL `{baseUrl}/{projectPath}/tags/{name}`（该 GitLab 版本 tag 页面无 `/-/` 前缀）、job URL `{baseUrl}/{projectPath}/-/jobs/{id}`、pipeline 直接用 API 返回的 `web_url`
- **标签展开查看提交信息**：标签列表每行可展开（▸/▾），显示该 tag 指向的最新提交——提交 sha（短 8 位、悬浮完整 sha）、提交信息（commit title）、提交人（committer_name，缺省回退 author_name）、提交时间（本地时间 `YYYY-MM-DD HH:mm:ss`）。GitLab tags API 原生返回的 commit 详情此前在 `mapTag` 被丢弃，现已透传到客户端（`DashboardTag` 补 `commitId/target/commitDate/commitAuthor/commitTitle/webUrl`）
- **日志搜索 / 刷新 / 滑动到底部**：新增共享 `LogViewer` 组件（ui.tsx），三个日志面板（插件日志 tab、Pipeline job 日志弹窗、Pod 日志弹窗）统一接入——搜索框即时过滤（大小写不敏感，显示「n/m 行」计数并高亮命中子串，主题变量 `--dsh-devops-log-match` 深/浅各一套）、刷新按钮（同参数重新拉取，job 运行中 202 / 日志接口 404 时可稍后刷新重试）、「底部」按钮；面板贴底时自动跟随新日志尾部，向上滚动即暂停跟随。两个日志弹窗的刷新/回底按钮放在弹窗底部左侧、与「关闭」并排（LogViewer 经 `ref` 句柄暴露刷新/回底，工具栏只留搜索框），插件日志 tab 保持在工具栏；刷新时保留现有内容（面板变暗表示加载中，仅首次打开才显示 loading 占位），不再整块闪烁
- **部署列表搜索**：K8s tab 部署列表顶部新增搜索框，按 name / 镜像即时过滤（大小写不敏感），无匹配显示空态提示

### 修复
- **「在 GitLab 打开」地址错误**：`GitLabClient.jobUrl` 此前拼成 API 形状的 `{baseUrl}/projects/{path}/jobs/{id}`（旧版路由），现改为 Web UI 正确格式 `{baseUrl}/{projectPath}/-/jobs/{jobId}`（job 列表行的 ↗ 使用该地址；job 日志弹窗不再放该按钮）

### 测试
- 新增 tests/core/gitlab-client.spec.ts（jobUrl/tagUrl 拼接与 baseUrl 尾斜杠、tag commit 字段映射及 author/committer 回退、job 行 webUrl）；ui.spec.tsx 补 LogViewer（渲染分类、搜索过滤/计数/高亮、刷新与回底按钮、cornerControls 浮动模式、空态与无匹配态）；client-smoke 补仪表盘部署搜索渲染测试；全量 117 例通过

## v0.3.1 — 修复浅色模式下 Web 控制台显示问题

### 修复
- **浅色模式**：Web 控制台此前无任何主题机制——48 处 `var(--ds-alias-*, 深色回退值)` + 约 60 处写死的深色（纯黑日志框、各级灰字、黑色遮罩）在宿主切到浅色时整块呈深色。客户端现拥有自有 `--dsh-devops-*` 双层变量：深色为默认（仍引用宿主 alias 变量，宿主提供值即跟随），浅色配色完全自给自足（不引用 `--ds-alias-*`，防止宿主深色值泄漏进浅色模式）
- **主题自动检测**：宿主不暴露主题 API，检测链按优先级取信号——DOM 显式标记（宿主 `data-ds-theme-source` / `data-theme`（仅认 light/dark，`system` 视为无信号）/ 精确 class token / `meta[name=color-scheme]` / `<html>` 上级联或 inline 的 `color-scheme` 声明）→ 宿主 `--ds-alias-surface`/`--ds-alias-foreground` 计算值亮度（BT.709 权重）→ `prefers-color-scheme` 兜底；结果写入 `<html>` 的 `data-dsh-devops-theme` 命名空间属性，MutationObserver + matchMedia change 实时重检测，CSS 变量与 inline style 的 `var()` 同步切换，无需 React 重渲染
- **日志面板跟随浅色**：背景由纯黑 `#0d0d0d` 改 `#f6f8fa`，info/warn/err 行色同步调为浅色底可读的深色调
- **测试**：新增 tests/client/theme.spec.ts（17 例：颜色解析/亮度边界、宿主真实标记 `data-ds-theme-source` 与 `color-scheme` 及多级检测信号优先级、样式表注入幂等与 stale 替换、MutationObserver 与 matchMedia change 重检测）；全量 106 例通过

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
