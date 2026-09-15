# 变更记录 / Changelog

## Unreleased（v0.1.0 之后）

### 新增
- **Job 日志接口**：新增 `gitlab-job-log`（`/log` 优先，404 时回退 `/trace`，兼容 GitLab 11.x 如 11.11.7）；自动剥离 ANSI 转义码与 gitlab-runner 控制行。
- **单侧配置**：`gitlab` 与 `k8s` 配置段均可选，只配一侧即可使用；`migrateConfig` 不再为缺失段补空结构；列表可删到 0 条。
- **设置表单内嵌**：DevOps tab 未配置时直接内嵌配置表单（与「设置 → DevOps」同一组件），保存后自动刷新，无需跳转。
- **`scripts/profile-updater.mjs`**：一键把 `lib/client.js` 同步到已安装的 DSH profile。

### 改进
- **设置页零网络挂载**：打开设置只读本地配置并即时回显保存值；连通性验证仅由「测试连接」显式触发；GitLab 测试成功后自动回填已保存项目 + 分支列表，K8s 回填 context + namespace 列表。
- **save-config 浅合并**：保存一侧配置不再覆盖另一侧原有段。
- **UI 重构**：GitLab / K8s / Activity 子 tab；项目、context 下拉支持搜索；新建 MR / 新建 tag / 换镜像 / 重启改为弹框。
- **构建产物**：`lib/` 重新生成为单 ESM bundle（`lib/index.js` + `lib/client.js`），替换旧多文件产物。
- **README**：更新安装命令与架构树；补充离线安装（预构建 lib，无需 registry）说明。

### 修复
- 修复测试连接按钮卡在「连接中」的问题。
- 修复 DevOps 页「去配置」按钮无反应（shell 无对应的打开设置事件，改为内嵌表单）。
- 修复 GitLab 11.x 下 job 日志 404（`/log` → `/trace` 兜底）。

## v0.1.0
- 首个版本：GitLab + Kubernetes DevOps 监控插件（DSH plugin）。
