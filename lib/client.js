window.__ModuleLoader__.load({
	id: "@jacksonchen/dsh-devops",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_dom = require("react-dom");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/locales.ts
		/**
		* Locale dictionaries for the dsh-devops web console (zh / en).
		*
		* Registered into the DSH LocaleRuntime so the console follows the app's
		* language setting (Settings → Language) instead of managing its own toggle.
		*/
		const ZH = {
			select: "选择...",
			testConn: "测试连接",
			restored: "已恢复已保存的配置",
			restoreFail: "恢复项目列表失败",
			k8sFail: "K8s 连接失败",
			fillGl: "请填写 Base URL 和 Token",
			connecting: "连接中...",
			fillKc: "请填写 kubeconfig 路径",
			completeOne: "请至少完成一个服务的配置",
			saved: "配置已保存",
			saveFailed: "保存失败",
			notCfgYet: "⚠️ 尚未配置 DevOps 服务",
			fillGlOrK8s: "请填写 GitLab 或 Kubernetes 连接信息后保存。",
			connected: "已连接",
			connectFailed: "连接失败",
			glServers: "GitLab 服务器",
			unnamed: "未命名",
			noUrl: "未填写 URL",
			noPath: "未填写路径",
			editing: "编辑中",
			addServer: "+ 添加服务器",
			addKc: "+ 添加配置文件",
			name: "名称",
			nameGlPh: "如：公司内网 GitLab",
			nameK8sPh: "如：生产集群",
			project: "项目",
			refresh: "刷新",
			testGlFirst: "请先测试连接 GitLab",
			searchProjPh: "搜索项目...",
			search: "搜索",
			testFirst: "请先测试连接",
			loading: "加载中...",
			noProjects: "暂无项目",
			selProject: "选择项目...",
			branch: "分支",
			selProjFirst: "请先选择项目",
			searchBrPh: "搜索分支...",
			loadingBr: "正在加载分支...",
			noBranches: "暂无分支",
			selBranch: "选择分支...",
			brFail: "获取分支失败",
			delGl: "🗑 删除这套 GitLab 配置",
			kcConfig: "Kubeconfig 配置",
			kcPath: "Kubeconfig 路径",
			browse: "浏览...",
			testK8sFirst: "请先测试连接 K8s",
			selCtx: "选择 context...",
			selCtxFirst: "请先选择 Context",
			loadingNs: "正在加载...",
			noNs: "集群中无 namespace",
			selNs: "从集群选择...",
			manualNs: "或手动输入 namespace",
			nsHint: "自动取自 kubeconfig 上下文 / 从集群下拉选择 / 手动输入（无列表权限时）",
			delK8s: "🗑 删除这套 K8s 配置",
			saveConfig: "保存配置",
			justNow: "刚刚",
			minAgo: "{n} 分钟前",
			hourAgo: "{n} 小时前",
			dayAgo: "{n} 天前",
			detecting: "检测中...",
			notConfigured: "未配置",
			server: "服务器",
			configFile: "配置文件",
			glNotCfg: "未配置 GitLab",
			loadingProjects: "加载项目列表...",
			ctxPh: "context...",
			nsPh: "namespace...",
			logs: "日志",
			noMrs: "暂无 Open MR",
			pending: "{n} 待审批",
			mergeable: "✓ 可合并",
			openInGl: "在 GitLab 打开",
			descPh: "变更说明...",
			createMr: "✓ 创建 MR",
			cancel: "取消",
			noTags: "暂无 Tag",
			pickHist: "选择历史 Tag，快速填充...",
			selRef: "选择 ref...",
			releasePh: "发布说明",
			createTag: "✓ 创建 Tag",
			noPips: "暂无 Pipeline 数据",
			loadingJobs: "加载 jobs...",
			noJobs: "无 job 数据",
			noDeps: "暂无 Deployment",
			setImage: "换镜像",
			restart: "重启",
			apply: "✓ 应用",
			noPods: "无运行中的 Pod",
			close: "关闭",
			loadingLogs: "加载日志中...",
			noLogs: "(无日志)",
			noEvents: "暂无事件",
			noActivity: "暂无动态",
			noLogsText: "暂无日志",
			glNotCfg2: "GitLab 未配置",
			k8sNotCfg2: "K8s 未配置",
			loadingShort: "加载...",
			notCfgBig: "未配置 DevOps 服务",
			goCfgHint: "请前往 设置 → DevOps 完成 GitLab / K8s 配置。",
			goCfg: "去配置",
			fillMr: "请至少填写 Source / Target / Title",
			mrFail: "创建 MR 失败",
			createFail: "创建失败",
			fillTag: "请至少填写 Tag Name / Ref",
			tagFail: "创建 Tag 失败",
			approveFail: "审批失败",
			actionFail: "操作失败",
			closeFail: "关闭失败",
			imgFail: "更换镜像失败",
			restartFail: "重启失败",
			logsFail: "获取日志失败",
			k8sCfg: "K8s 配置",
			loadingMem: "成员加载中...",
			noMem: "无可选成员",
			selReviewer: "+ 选择 Reviewer...",
			histTag: "从历史 Tag 快速创建（自动生成新版本号填入 Tag Name）",
			refLabel: "Ref（分支或已有 Tag）",
			reviewersLabel: "Reviewers（从项目成员下拉选择，可多选）",
			sourceBranch: "源分支",
			targetBranch: "目标分支",
			statMrsTitle: "开放 MR",
			statPipsTitle: "流水线",
			statDepsTitle: "部署",
			statPodsTitle: "异常 Pod",
			secMrs: "合并请求",
			secTags: "标签",
			secDeps: "部署",
			secEvents: "最近事件",
			tabActivity: "动态",
			newBtn: "+ 新建",
			newMrBtn: "+ 新建 MR",
			newTagBtn: "+ 新建 Tag",
			approve: "✓ 审批",
			retry: "重试",
			runningBadge: "运行中",
			issueN: "{n} 异常",
			ready: "就绪",
			titleLabel: "标题",
			descLabel: "描述",
			msgLabel: "说明",
			tagNameLabel: "Tag 名称",
			serverLabel: "服务器",
			projectLabel: "项目",
			configFileLabel: "配置文件",
			statMrsSub: "{p} 待审批 · {r} pipeline 运行中",
			statPipSub: "{r} running · {o} ok · {f} failed",
			statDepSub: "{f} failure · {p} progressing",
			statPodSub: "{c} crash · {p} pending",
			defaultSuffix: "（默认）",
			logsLast: "~/.dsh-devops/devops.log · 最近 {n} 条",
			mrCreated: "MR !{iid} 已创建",
			tagCreated: "Tag {name} 已创建",
			approved: "已为 !{iid} 投票审批",
			remaining: " · 剩余 {n}",
			pipAction: "Pipeline #{id} {action}",
			mrClosed: "MR !{iid} 已关闭",
			imageUpdated: "{name} 镜像已更新为 {image}，滚动更新中...",
			restarting: "{name} 重启中（滚动重建 pods）",
			pipCanceled: "已取消",
			pipRetried: "已重试",
			restartsN: "{n} 次重启",
			autoTitleSuffix: "（{s} → {t}）",
			descHead: "## 变更说明",
			descCommit: "## 最新提交",
			descSource: "## 来源",
			descBranch: "- 分支：`{s}` → `{t}`",
			editingWhat: "编辑：{name}",
			searchPh: "搜索...",
			searchEmpty: "无匹配结果",
			selectPh: "选择...",
			currentImage: "当前镜像",
			newImage: "新镜像",
			confirmRestart: "确认重启",
			restartBody: "重启将滚动重建 {name} 的所有 pods，正在进行的请求会中断。确定继续？",
			openJobLog: "日志",
			openInGitlab: "在 GitLab 打开"
		};
		const EN = {
			select: "Select...",
			testConn: "Test connection",
			restored: "Restored saved config",
			restoreFail: "Failed to restore project list",
			k8sFail: "K8s connection failed",
			fillGl: "Please fill in Base URL and Token",
			connecting: "Connecting...",
			fillKc: "Please fill in the kubeconfig path",
			completeOne: "Complete at least one service config",
			saved: "Config saved",
			saveFailed: "Save failed",
			notCfgYet: "⚠️ DevOps services not configured",
			fillGlOrK8s: "Fill in your GitLab or Kubernetes connection info and save.",
			connected: "Connected",
			connectFailed: "Failed",
			glServers: "GitLab servers",
			unnamed: "Unnamed",
			noUrl: "No URL",
			noPath: "No path",
			editing: "Editing",
			addServer: "+ Add server",
			addKc: "+ Add config file",
			name: "Name",
			nameGlPh: "e.g. Company GitLab",
			nameK8sPh: "e.g. Production cluster",
			project: "Project",
			refresh: "Refresh",
			testGlFirst: "Test the GitLab connection first",
			searchProjPh: "Search projects...",
			search: "Search",
			testFirst: "Test connection first",
			loading: "Loading...",
			noProjects: "No projects",
			selProject: "Select project...",
			branch: "Branch",
			selProjFirst: "Select a project first",
			searchBrPh: "Search branches...",
			loadingBr: "Loading branches...",
			noBranches: "No branches",
			selBranch: "Select branch...",
			brFail: "Failed to fetch branches",
			delGl: "🗑 Delete this GitLab config",
			kcConfig: "Kubeconfig configs",
			kcPath: "Kubeconfig path",
			browse: "Browse...",
			testK8sFirst: "Test the K8s connection first",
			selCtx: "Select context...",
			selCtxFirst: "Select a context first",
			loadingNs: "Loading...",
			noNs: "No namespaces in cluster",
			selNs: "Pick from cluster...",
			manualNs: "or type a namespace",
			nsHint: "Auto from kubeconfig context / pick from cluster dropdown / manual input (when listing is not permitted)",
			delK8s: "🗑 Delete this K8s config",
			saveConfig: "Save config",
			justNow: "just now",
			minAgo: "{n} min ago",
			hourAgo: "{n} h ago",
			dayAgo: "{n} d ago",
			detecting: "Checking...",
			notConfigured: "Not configured",
			server: "Server",
			configFile: "Config file",
			glNotCfg: "GitLab not configured",
			loadingProjects: "Loading projects...",
			ctxPh: "context...",
			nsPh: "namespace...",
			logs: "Logs",
			noMrs: "No open MRs",
			pending: "{n} pending",
			mergeable: "✓ Mergeable",
			openInGl: "Open in GitLab",
			descPh: "Describe the changes...",
			createMr: "✓ Create MR",
			cancel: "Cancel",
			noTags: "No tags",
			pickHist: "Pick a tag to prefill...",
			selRef: "Select ref...",
			releasePh: "Release notes",
			createTag: "✓ Create Tag",
			noPips: "No pipelines",
			loadingJobs: "Loading jobs...",
			noJobs: "No jobs",
			noDeps: "No deployments",
			setImage: "Image",
			restart: "Restart",
			apply: "✓ Apply",
			noPods: "No running pods",
			close: "Close",
			loadingLogs: "Loading logs...",
			noLogs: "(no logs)",
			noEvents: "No events",
			noActivity: "No activity",
			noLogsText: "No logs",
			glNotCfg2: "GitLab not configured",
			k8sNotCfg2: "K8s not configured",
			loadingShort: "Loading...",
			notCfgBig: "DevOps services not configured",
			goCfgHint: "Go to Settings → DevOps to finish the GitLab / K8s setup.",
			goCfg: "Configure",
			fillMr: "Fill in Source / Target / Title",
			mrFail: "Failed to create MR",
			createFail: "Creation failed",
			fillTag: "Fill in Tag Name / Ref",
			tagFail: "Failed to create tag",
			approveFail: "Approval failed",
			actionFail: "Action failed",
			closeFail: "Failed to close",
			imgFail: "Failed to set image",
			restartFail: "Restart failed",
			logsFail: "Failed to fetch logs",
			k8sCfg: "K8s config",
			loadingMem: "Loading members...",
			noMem: "No members available",
			selReviewer: "+ Add reviewer...",
			histTag: "Quick create from history (auto-bumps the version into Tag Name)",
			refLabel: "Ref (branch or existing tag)",
			reviewersLabel: "Reviewers (multi-select from project members)",
			sourceBranch: "Source branch",
			targetBranch: "Target branch",
			statMrsTitle: "Open MRs",
			statPipsTitle: "Pipelines",
			statDepsTitle: "Deployments",
			statPodsTitle: "Unhealthy Pods",
			secMrs: "Merge Requests",
			secTags: "Tags",
			secDeps: "Deployments",
			secEvents: "Recent Events",
			tabActivity: "Activity",
			newBtn: "+ New",
			newMrBtn: "+ New MR",
			newTagBtn: "+ New Tag",
			approve: "✓ Approve",
			retry: "Retry",
			runningBadge: "Running",
			issueN: "{n} issue",
			ready: "ready",
			titleLabel: "Title",
			descLabel: "Description",
			msgLabel: "Message",
			tagNameLabel: "Tag Name",
			serverLabel: "Server",
			projectLabel: "Project",
			configFileLabel: "Config file",
			statMrsSub: "{p} pending · {r} pipeline(s) running",
			statPipSub: "{r} running · {o} ok · {f} failed",
			statDepSub: "{f} failure · {p} progressing",
			statPodSub: "{c} crash · {p} pending",
			defaultSuffix: " (default)",
			logsLast: "~/.dsh-devops/devops.log · last {n} lines",
			mrCreated: "MR !{iid} created",
			tagCreated: "Tag {name} created",
			approved: "Approved !{iid}",
			remaining: " · {n} left",
			pipAction: "Pipeline #{id} {action}",
			mrClosed: "MR !{iid} closed",
			imageUpdated: "{name} image updated to {image}, rolling out...",
			restarting: "Restarting {name} (rolling rebuild)",
			pipCanceled: "cancelled",
			pipRetried: "retried",
			restartsN: "{n} restarts",
			autoTitleSuffix: " ({s} → {t})",
			descHead: "## Changes",
			descCommit: "## Latest commit",
			descSource: "## Source",
			descBranch: "- Branch: `{s}` → `{t}`",
			editingWhat: "Edit: {name}",
			searchPh: "Search...",
			searchEmpty: "No matches",
			selectPh: "Select...",
			currentImage: "Current image",
			newImage: "New image",
			confirmRestart: "Restart",
			restartBody: "Restarting will roll-rebuild all pods of {name}. In-flight requests will be interrupted. Continue?",
			openJobLog: "Logs",
			openInGitlab: "Open in GitLab"
		};
		//#endregion
		//#region \0dsh-devops-css:D:\Develop\project\dsh-devops\src\client\DevopsUI.module.css.mjs
		const css = ".XYFaxq_section{border:1px solid var(--ds-alias-border,#2a2a2a);border-radius:8px;margin-bottom:24px;padding:16px}.XYFaxq_sectionTitle{align-items:center;gap:8px;margin-bottom:14px;display:flex}.XYFaxq_sectionTitleText{margin:0;font-size:15px;font-weight:600}.XYFaxq_sectionBadge{color:#34c759;background:#34c75926;border-radius:10px;padding:2px 8px;font-size:11px}.XYFaxq_fieldGap{flex-direction:column;gap:12px;display:flex}.XYFaxq_label{color:var(--ds-alias-foreground-secondary,#888);margin-bottom:4px;font-size:13px;font-weight:500;display:block}.XYFaxq_input{border:1px solid var(--ds-alias-border,#333);background:var(--ds-alias-input-bg,#1a1a1a);width:100%;color:var(--ds-alias-foreground,#eee);box-sizing:border-box;border-radius:6px;outline:none;padding:8px 10px;font-size:14px}.XYFaxq_select{border:1px solid var(--ds-alias-border,#333);background:var(--ds-alias-input-bg,#1a1a1a);width:100%;color:var(--ds-alias-foreground,#eee);box-sizing:border-box;cursor:pointer;border-radius:6px;outline:none;padding:8px 10px;font-size:14px}.XYFaxq_selectCompact{width:100%;min-width:0;padding:3px 6px;font-size:11px}.XYFaxq_selectDisabled{opacity:.5;cursor:not-allowed}.XYFaxq_hint{color:#888;margin-top:4px;font-size:12px}.XYFaxq_callout{color:var(--ds-alias-foreground,#eee);background:#fbbf241a;border:1px solid #fbbf244d;border-radius:8px;padding:12px 16px;font-size:13px;line-height:1.5}.XYFaxq_calloutInfo{color:var(--ds-alias-foreground,#eee);text-align:center;background:#4a9eff1a;border:1px solid #4a9eff4d;border-radius:8px;padding:12px 16px;font-size:13px;line-height:1.5}.XYFaxq_btn{cursor:pointer;white-space:nowrap;color:#fff;background:var(--ds-alias-primary,#4a9eff);border:none;border-radius:6px;padding:7px 14px;font-size:13px;font-weight:500;line-height:1.4}.XYFaxq_btnSmall{padding:5px 10px;font-size:12px}.XYFaxq_btnOutline{color:var(--ds-alias-foreground,#eee);border:1px solid var(--ds-alias-border,#555);background:0 0}.XYFaxq_btnSuccess{color:#fff;background:#34c759}.XYFaxq_btnDisabled{cursor:not-allowed;opacity:.5}.XYFaxq_status{align-items:center;gap:6px;margin-top:4px;font-size:12px;display:flex}.XYFaxq_statusOk{color:#34c759}.XYFaxq_statusError{color:#ff453a}.XYFaxq_statusIdle{color:#888}.XYFaxq_dot{border-radius:50%;flex-shrink:0;width:8px;height:8px;display:inline-block}.XYFaxq_dotPulse{animation:1.3s ease-in-out infinite XYFaxq_devopsPulse}@keyframes XYFaxq_devopsPulse{0%,to{opacity:1}50%{opacity:.35}}.XYFaxq_badge{white-space:nowrap;border-radius:9px;padding:1px 7px;font-size:11px;font-weight:500;line-height:1.5}.XYFaxq_badgeOk{color:#34c759;background:#34c75929}.XYFaxq_badgeWarn{color:#fbbf24;background:#fbbf2429}.XYFaxq_badgeErr{color:#ff8a80;background:#ff453a29}.XYFaxq_badgeAccent{color:#5aa8ff;background:#4a9eff29}.XYFaxq_badgeNeutral{color:#aaa;background:#8c8c8c2e}.XYFaxq_chipBtn{border:1px solid var(--ds-alias-border,#333);color:#bbb;cursor:pointer;white-space:nowrap;background:0 0;border-radius:5px;padding:3px 8px;font-size:11px;line-height:1.4}.XYFaxq_chipBtnPrimary{color:#5aa8ff;background:#4a9eff1f}.XYFaxq_chipBtnDanger{color:#ff8a80;background:#ff453a1f}.XYFaxq_chipBtnDisabled{cursor:not-allowed;opacity:.45}.XYFaxq_statCard{border:1px solid var(--ds-alias-border,#2a2a2a);background:var(--ds-alias-surface,#141414);border-radius:8px;flex-direction:column;gap:3px;min-width:0;padding:12px 13px;display:flex}.XYFaxq_statCardTitle{color:#888;text-overflow:ellipsis;white-space:nowrap;align-items:center;gap:6px;font-size:11px;display:flex;overflow:hidden}.XYFaxq_statCardValue{font-size:19px;font-weight:700;line-height:1.15}.XYFaxq_statCardSub{color:#888;text-overflow:ellipsis;white-space:nowrap;font-size:11px;overflow:hidden}.XYFaxq_tabBar{border-bottom:1px solid var(--ds-alias-border,#2a2a2a);gap:2px;margin-bottom:12px;padding-bottom:8px;display:flex}.XYFaxq_tab{cursor:pointer;color:var(--ds-alias-foreground,#ccc);background:0 0;border:none;border-radius:6px;padding:6px 14px;font-size:13px;font-weight:500;transition:background .15s}.XYFaxq_tabActive{background:var(--ds-alias-primary,#4a9eff);color:#fff}.XYFaxq_switchCard{border:1px solid var(--ds-alias-border,#2a2a2a);background:var(--ds-alias-surface,#141414);border-radius:8px;flex-direction:column;gap:6px;padding:8px 10px 10px;display:flex}.XYFaxq_switchCardHeader{align-items:center;gap:6px;display:flex}.XYFaxq_switchCardTitle{color:#ddd;font-size:11px;font-weight:600}.XYFaxq_fieldLabel{color:#888;margin-bottom:2px;font-size:10px}.XYFaxq_emptyHint{color:#666;padding:10px 4px;font-size:12px}.XYFaxq_toast{border-radius:8px;align-items:center;gap:8px;padding:8px 12px;font-size:12px;display:flex}.XYFaxq_rowItem{background:var(--ds-alias-surface-inset,#1a1a1a);border-radius:6px;align-items:flex-start;gap:8px;padding:7px 10px;font-size:12px;display:flex}.XYFaxq_insetRow{background:var(--ds-alias-surface-inset,#1a1a1a);border-radius:6px;align-items:center;gap:8px;padding:6px 10px;font-size:12px;display:flex}.XYFaxq_serverList{border:1px solid var(--ds-alias-border,#333);border-radius:8px;overflow:hidden}.XYFaxq_serverRow{cursor:pointer;align-items:center;gap:8px;padding:7px 10px;font-size:12px;display:flex}.XYFaxq_serverRowEditing{cursor:default;background:var(--ds-alias-primary,#4a9eff)}.XYFaxq_serverRowName{color:#ddd;flex-shrink:0;font-weight:500}.XYFaxq_serverRowEditing .XYFaxq_serverRowName{color:#fff}.XYFaxq_serverRowUrl{color:#666;text-overflow:ellipsis;white-space:nowrap;flex:1;overflow:hidden}.XYFaxq_serverRowEditing .XYFaxq_serverRowUrl{color:#ffffffbf}.XYFaxq_serverRowEditingTag{color:#fff;background:#fff3;border-radius:4px;flex-shrink:0;padding:1px 6px;font-size:10px}.XYFaxq_dangerLink{color:#ff453a;cursor:pointer;background:0 0;border:none;padding:2px 0;font-size:12px}.XYFaxq_logPanel{border:1px solid var(--ds-alias-border,#333);background:#0d0d0d;border-radius:8px;max-height:220px;padding:10px 12px;font-family:Cascadia Code,Fira Code,JetBrains Mono,monospace;font-size:11px;line-height:1.6;overflow:auto}.XYFaxq_logLineError{color:#ff453a}.XYFaxq_logLineWarn{color:#fbbf24}.XYFaxq_logLineInfo{color:#8f8}.XYFaxq_formBox{border:1px solid var(--ds-alias-border,#333);background:var(--ds-alias-surface-inset,#191919);border-radius:8px;flex-direction:column;gap:8px;padding:12px;display:flex}.XYFaxq_reviewerChip{background:var(--ds-alias-primary,#4a9eff);color:#fff;border-radius:10px;align-items:center;gap:4px;padding:2px 4px 2px 8px;font-size:11px;display:inline-flex}.XYFaxq_reviewerChipRemove{cursor:pointer;text-align:center;background:#ffffff40;border-radius:50%;width:14px;height:14px;font-size:10px;line-height:13px}.XYFaxq_searchWrap{width:100%;min-width:0;display:inline-block;position:relative}.XYFaxq_searchTrigger{border:1px solid var(--ds-alias-border,#333);background:var(--ds-alias-input-bg,#1a1a1a);width:100%;color:var(--ds-alias-foreground,#eee);box-sizing:border-box;cursor:pointer;text-align:left;border-radius:6px;outline:none;align-items:center;gap:6px;padding:8px 10px;font-size:14px;display:flex}.XYFaxq_searchTriggerCompact{padding:3px 6px;font-size:11px}.XYFaxq_searchTriggerValue{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;overflow:hidden}.XYFaxq_searchTriggerPlaceholder{color:#666}.XYFaxq_searchCaret{color:#888;flex-shrink:0;font-size:10px}.XYFaxq_searchTriggerDisabled{cursor:not-allowed;opacity:.5}.XYFaxq_searchPop{z-index:3000;background:var(--ds-alias-surface,#1c1c1c);border:1px solid var(--ds-alias-border,#444);border-radius:6px;position:absolute;top:calc(100% + 2px);left:0;right:0;overflow:hidden;box-shadow:0 8px 24px #00000073}.XYFaxq_searchInput{border:none;border-bottom:1px solid var(--ds-alias-border,#333);background:var(--ds-alias-input-bg,#161616);width:100%;color:var(--ds-alias-foreground,#eee);box-sizing:border-box;outline:none;padding:7px 10px;font-size:13px}.XYFaxq_searchList{max-height:240px;overflow-y:auto}.XYFaxq_searchOption{color:var(--ds-alias-foreground,#ddd);cursor:pointer;white-space:nowrap;text-overflow:ellipsis;padding:6px 10px;font-size:13px;overflow:hidden}.XYFaxq_searchOptionCompact{padding:4px 8px;font-size:11px}.XYFaxq_searchOptionActive{background:#4a9eff2e}.XYFaxq_searchOptionSelected{color:#5aa8ff;font-weight:600}.XYFaxq_searchOptionDisabled{color:#555;cursor:default;font-style:italic}.XYFaxq_searchEmpty{color:#666;text-align:center;padding:10px;font-size:12px}.XYFaxq_modalOverlay{z-index:4000;background:#0000008c;justify-content:center;align-items:flex-start;padding:8vh 16px 16px;display:flex;position:fixed;inset:0}.XYFaxq_modalCard{background:var(--ds-alias-surface,#1b1b1b);border:1px solid var(--ds-alias-border,#3a3a3a);border-radius:10px;flex-direction:column;width:100%;max-width:560px;max-height:82vh;display:flex;box-shadow:0 16px 48px #00000080}.XYFaxq_modalHeader{border-bottom:1px solid var(--ds-alias-border,#2a2a2a);flex-shrink:0;align-items:center;gap:8px;padding:12px 16px;display:flex}.XYFaxq_modalTitle{color:var(--ds-alias-foreground,#eee);text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:600;overflow:hidden}.XYFaxq_modalClose{color:#888;cursor:pointer;background:0 0;border:none;border-radius:4px;margin-left:auto;padding:2px 6px;font-size:13px;line-height:1.4}.XYFaxq_modalClose:hover{color:#ddd;background:#ffffff0f}.XYFaxq_modalBody{flex-direction:column;gap:10px;padding:14px 16px;display:flex;overflow-y:auto}.XYFaxq_modalFooter{border-top:1px solid var(--ds-alias-border,#2a2a2a);flex-shrink:0;align-items:center;gap:8px;padding:12px 16px;display:flex}.XYFaxq_tabSmall{padding:4px 10px;font-size:12px}.XYFaxq_tabBadge{opacity:.75;margin-left:6px;font-size:10px;font-weight:600}.XYFaxq_serverCard{border:1px solid var(--ds-alias-border,#2a2a2a);background:var(--ds-alias-surface,#141414);border-radius:8px;overflow:hidden}.XYFaxq_cardHeader{cursor:pointer;user-select:none;align-items:center;gap:8px;padding:9px 12px;font-size:13px;display:flex}.XYFaxq_cardHeader:hover{background:#ffffff0a}.XYFaxq_cardHeaderLabel{color:var(--ds-alias-foreground,#eee);text-overflow:ellipsis;white-space:nowrap;flex-shrink:0;max-width:40%;font-weight:600;overflow:hidden}.XYFaxq_cardHeaderPath{color:#888;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;font-size:12px;overflow:hidden}.XYFaxq_cardChevron{color:#888;flex-shrink:0;font-size:10px}.XYFaxq_cardBody{border-top:1px solid var(--ds-alias-border,#2a2a2a);flex-direction:column;gap:10px;padding:12px;display:flex}.XYFaxq_emptyCard{color:#888;border:1px dashed var(--ds-alias-border,#3a3a3a);cursor:pointer;background:0 0;border-radius:8px;width:100%;padding:14px;font-size:13px;transition:color .15s,border-color .15s}.XYFaxq_emptyCard:hover{color:var(--ds-alias-foreground,#eee);border-color:var(--ds-alias-primary,#4a9eff)}";
		const tagId = "@jacksonchen/dsh-devops/D:\\Develop\\project\\dsh-devops\\src\\client\\DevopsUI.module.css";
		if (typeof document !== "undefined") {
			let tag = document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]");
			if (!tag) {
				tag = document.createElement("style");
				tag.dataset.pluginCss = tagId;
				document.head.appendChild(tag);
			}
			if (tag.textContent !== css) tag.textContent = css;
		}
		var DevopsUI_module_css_default = {
			"badge": "XYFaxq_badge",
			"badgeAccent": "XYFaxq_badgeAccent",
			"badgeErr": "XYFaxq_badgeErr",
			"badgeNeutral": "XYFaxq_badgeNeutral",
			"badgeOk": "XYFaxq_badgeOk",
			"badgeWarn": "XYFaxq_badgeWarn",
			"btn": "XYFaxq_btn",
			"btnDisabled": "XYFaxq_btnDisabled",
			"btnOutline": "XYFaxq_btnOutline",
			"btnSmall": "XYFaxq_btnSmall",
			"btnSuccess": "XYFaxq_btnSuccess",
			"callout": "XYFaxq_callout",
			"calloutInfo": "XYFaxq_calloutInfo",
			"cardBody": "XYFaxq_cardBody",
			"cardChevron": "XYFaxq_cardChevron",
			"cardHeader": "XYFaxq_cardHeader",
			"cardHeaderLabel": "XYFaxq_cardHeaderLabel",
			"cardHeaderPath": "XYFaxq_cardHeaderPath",
			"chipBtn": "XYFaxq_chipBtn",
			"chipBtnDanger": "XYFaxq_chipBtnDanger",
			"chipBtnDisabled": "XYFaxq_chipBtnDisabled",
			"chipBtnPrimary": "XYFaxq_chipBtnPrimary",
			"dangerLink": "XYFaxq_dangerLink",
			"devopsPulse": "XYFaxq_devopsPulse",
			"dot": "XYFaxq_dot",
			"dotPulse": "XYFaxq_dotPulse",
			"emptyCard": "XYFaxq_emptyCard",
			"emptyHint": "XYFaxq_emptyHint",
			"fieldGap": "XYFaxq_fieldGap",
			"fieldLabel": "XYFaxq_fieldLabel",
			"formBox": "XYFaxq_formBox",
			"hint": "XYFaxq_hint",
			"input": "XYFaxq_input",
			"insetRow": "XYFaxq_insetRow",
			"label": "XYFaxq_label",
			"logLineError": "XYFaxq_logLineError",
			"logLineInfo": "XYFaxq_logLineInfo",
			"logLineWarn": "XYFaxq_logLineWarn",
			"logPanel": "XYFaxq_logPanel",
			"modalBody": "XYFaxq_modalBody",
			"modalCard": "XYFaxq_modalCard",
			"modalClose": "XYFaxq_modalClose",
			"modalFooter": "XYFaxq_modalFooter",
			"modalHeader": "XYFaxq_modalHeader",
			"modalOverlay": "XYFaxq_modalOverlay",
			"modalTitle": "XYFaxq_modalTitle",
			"reviewerChip": "XYFaxq_reviewerChip",
			"reviewerChipRemove": "XYFaxq_reviewerChipRemove",
			"rowItem": "XYFaxq_rowItem",
			"searchCaret": "XYFaxq_searchCaret",
			"searchEmpty": "XYFaxq_searchEmpty",
			"searchInput": "XYFaxq_searchInput",
			"searchList": "XYFaxq_searchList",
			"searchOption": "XYFaxq_searchOption",
			"searchOptionActive": "XYFaxq_searchOptionActive",
			"searchOptionCompact": "XYFaxq_searchOptionCompact",
			"searchOptionDisabled": "XYFaxq_searchOptionDisabled",
			"searchOptionSelected": "XYFaxq_searchOptionSelected",
			"searchPop": "XYFaxq_searchPop",
			"searchTrigger": "XYFaxq_searchTrigger",
			"searchTriggerCompact": "XYFaxq_searchTriggerCompact",
			"searchTriggerDisabled": "XYFaxq_searchTriggerDisabled",
			"searchTriggerPlaceholder": "XYFaxq_searchTriggerPlaceholder",
			"searchTriggerValue": "XYFaxq_searchTriggerValue",
			"searchWrap": "XYFaxq_searchWrap",
			"section": "XYFaxq_section",
			"sectionBadge": "XYFaxq_sectionBadge",
			"sectionTitle": "XYFaxq_sectionTitle",
			"sectionTitleText": "XYFaxq_sectionTitleText",
			"select": "XYFaxq_select",
			"selectCompact": "XYFaxq_selectCompact",
			"selectDisabled": "XYFaxq_selectDisabled",
			"serverCard": "XYFaxq_serverCard",
			"serverList": "XYFaxq_serverList",
			"serverRow": "XYFaxq_serverRow",
			"serverRowEditing": "XYFaxq_serverRowEditing",
			"serverRowEditingTag": "XYFaxq_serverRowEditingTag",
			"serverRowName": "XYFaxq_serverRowName",
			"serverRowUrl": "XYFaxq_serverRowUrl",
			"statCard": "XYFaxq_statCard",
			"statCardSub": "XYFaxq_statCardSub",
			"statCardTitle": "XYFaxq_statCardTitle",
			"statCardValue": "XYFaxq_statCardValue",
			"status": "XYFaxq_status",
			"statusError": "XYFaxq_statusError",
			"statusIdle": "XYFaxq_statusIdle",
			"statusOk": "XYFaxq_statusOk",
			"switchCard": "XYFaxq_switchCard",
			"switchCardHeader": "XYFaxq_switchCardHeader",
			"switchCardTitle": "XYFaxq_switchCardTitle",
			"tab": "XYFaxq_tab",
			"tabActive": "XYFaxq_tabActive",
			"tabBadge": "XYFaxq_tabBadge",
			"tabBar": "XYFaxq_tabBar",
			"tabSmall": "XYFaxq_tabSmall",
			"toast": "XYFaxq_toast"
		};
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
		//#region src/client/api.ts
		/**
		* DevopsClient — the web console's business RPC client.
		*
		* Every method maps to one endpoint on the plugin's read/write channels.
		* Endpoint payloads keep the historical `{ ok, ... }` soft-failure shape
		* (upstream connectivity problems are results, not RPC errors); only
		* transport/dispatch failures reject.
		*/
		var DevopsClient = class {
			connection;
			constructor(connection) {
				this.connection = connection;
			}
			async read(endpoint, payload) {
				const response = await this.connection.rpc.call(DEVOPS_READ_CHANNEL, endpoint, payload);
				if (!response.ok) throw new Error(response.error.message);
				return response.value;
			}
			async write(endpoint, payload) {
				const response = await this.connection.rpc.call(DEVOPS_WRITE_CHANNEL, endpoint, payload);
				if (!response.ok) throw new Error(response.error.message);
				return response.value;
			}
			loadConfig() {
				return this.read("config-load", {});
			}
			saveConfig(patch) {
				return this.write("config-save", patch);
			}
			logs(params = {}) {
				return this.read("logs", params);
			}
			browseFile() {
				return this.read("browse-file", {});
			}
			testGitLab(params) {
				return this.read("test-gitlab", params);
			}
			gitlabProjects(params) {
				return this.read("gitlab-projects", params);
			}
			gitlabBranches(params) {
				return this.read("gitlab-branches", params);
			}
			gitlabMembers(params) {
				return this.read("gitlab-members", params);
			}
			gitlabLastCommit(params) {
				return this.read("gitlab-last-commit", params);
			}
			gitlabMRs(params) {
				return this.read("gitlab-mrs", params);
			}
			gitlabPipelines(params) {
				return this.read("gitlab-pipelines", params);
			}
			gitlabTags(params) {
				return this.read("gitlab-tags", params);
			}
			gitlabPipelineJobs(params) {
				return this.read("gitlab-pipeline-jobs", params);
			}
			gitlabJobLog(params) {
				return this.read("gitlab-job-log", params);
			}
			gitlabCreateMR(params) {
				return this.write("gitlab-create-mr", params);
			}
			gitlabCreateTag(params) {
				return this.write("gitlab-create-tag", params);
			}
			gitlabPipelineAction(params) {
				return this.write("gitlab-pipeline-action", params);
			}
			gitlabMRApprove(params) {
				return this.write("gitlab-mr-approve", params);
			}
			gitlabMRAction(params) {
				return this.write("gitlab-mr-action", params);
			}
			testK8s(params) {
				return this.read("test-k8s", params);
			}
			k8sContexts(params) {
				return this.read("k8s-contexts", params);
			}
			k8sNamespaces(params) {
				return this.read("k8s-namespaces", params);
			}
			k8sDeployments(params) {
				return this.read("k8s-deployments", params);
			}
			k8sPods(params) {
				return this.read("k8s-pods", params);
			}
			k8sEvents(params) {
				return this.read("k8s-events", params);
			}
			k8sPodLogs(params) {
				return this.read("k8s-pod-logs", params);
			}
			k8sSetImage(params) {
				return this.write("k8s-set-image", params);
			}
			k8sRestart(params) {
				return this.write("k8s-restart", params);
			}
		};
		/** Active GitLab server entry (by activeServerId, else the first). */
		function resolveGlServer(cfg) {
			const gl = cfg?.gitlab;
			if (!gl || !Array.isArray(gl.servers)) return null;
			return gl.servers.find((s) => s.id === gl.activeServerId) ?? gl.servers[0] ?? null;
		}
		/** Active kubeconfig entry (by activeKubeconfigId, else the first). */
		function resolveK8sKc(cfg) {
			const k8s = cfg?.k8s;
			if (!k8s || !Array.isArray(k8s.kubeconfigs)) return null;
			return k8s.kubeconfigs.find((k) => k.id === k8s.activeKubeconfigId) ?? k8s.kubeconfigs[0] ?? null;
		}
		//#endregion
		//#region src/client/ui.tsx
		/**
		* Shared UI primitives for the DevOps console (CSS Modules based).
		*/
		/**
		* Re-render on DSH locale switches: the bound `t` resolves at call time, so a
		* revision bump from the LocaleRuntime snapshot is enough to refresh strings.
		*/
		function useLocaleRevision(locale) {
			const subscribe = (0, react.useCallback)((cb) => locale.subscribe(cb), [locale]);
			const getSnapshot = (0, react.useCallback)(() => {
				return locale.getSnapshot()?.revision ?? 0;
			}, [locale]);
			return (0, react.useSyncExternalStore)(subscribe, getSnapshot, getSnapshot);
		}
		const DOT_COLOR = {
			ok: "#34c759",
			warn: "#fbbf24",
			err: "#ff6b60",
			neutral: "#888"
		};
		function Dot({ tone = "neutral", pulse }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: `${DevopsUI_module_css_default.dot}${pulse ? ` ${DevopsUI_module_css_default.dotPulse}` : ""}`,
				style: { background: DOT_COLOR[tone] ?? "#888" }
			});
		}
		function Label({ children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
				className: DevopsUI_module_css_default.label,
				children
			});
		}
		function Input(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
				...props,
				className: DevopsUI_module_css_default.input
			});
		}
		/**
		* Searchable combobox (replaces the native `<select>`).
		*
		* The trigger shows the selected label; opening reveals a filtered list with
		* a search input (case-insensitive substring match). Interactions inside the
		* root stop propagation so DSH's global handlers never close or steal them;
		* clicks outside close the list.
		*/
		function Select({ options, value, onChange, disabled, placeholder, compact, t }) {
			const [open, setOpen] = (0, react.useState)(false);
			const [query, setQuery] = (0, react.useState)("");
			const [active, setActive] = (0, react.useState)(0);
			const rootRef = (0, react.useRef)(null);
			const searchRef = (0, react.useRef)(null);
			const listRef = (0, react.useRef)(null);
			const normalized = (0, react.useMemo)(() => (options ?? []).filter((opt) => opt != null).map((opt) => typeof opt === "string" ? {
				value: opt,
				label: opt,
				disabled: false
			} : {
				value: opt.value ?? "",
				label: opt.label ?? opt.value ?? "",
				disabled: !!opt.disabled
			}).filter((o) => o.value !== ""), [options]);
			const selected = normalized.find((o) => o.value === value);
			const keyword = query.trim().toLowerCase();
			const filtered = keyword ? normalized.filter((o) => o.label.toLowerCase().includes(keyword)) : normalized;
			(0, react.useEffect)(() => {
				if (!open) return;
				const onDocMouseDown = (e) => {
					if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
				};
				const onKey = (e) => {
					if (e.key === "Escape") {
						e.stopPropagation();
						setOpen(false);
					}
				};
				document.addEventListener("mousedown", onDocMouseDown, true);
				document.addEventListener("keydown", onKey, true);
				return () => {
					document.removeEventListener("mousedown", onDocMouseDown, true);
					document.removeEventListener("keydown", onKey, true);
				};
			}, [open]);
			(0, react.useEffect)(() => {
				if (!open) return;
				setQuery("");
				const selectedIdx = Math.max(0, filtered.findIndex((o) => o.value === value));
				setActive(selectedIdx);
				const focusTimer = setTimeout(() => searchRef.current?.focus(), 0);
				return () => clearTimeout(focusTimer);
			}, [open]);
			(0, react.useEffect)(() => {
				if (!open || !listRef.current) return;
				const el = listRef.current.children[active];
				if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest" });
			}, [active, open]);
			function pick(o) {
				if (o.disabled) return;
				onChange(o.value);
				setOpen(false);
			}
			function onKeyDown(e) {
				if (e.key === "ArrowDown") {
					e.preventDefault();
					setActive((a) => Math.min(a + 1, Math.max(0, filtered.length - 1)));
				} else if (e.key === "ArrowUp") {
					e.preventDefault();
					setActive((a) => Math.max(a - 1, 0));
				} else if (e.key === "Enter") {
					e.preventDefault();
					const o = filtered[active];
					if (o && !o.disabled) pick(o);
				}
			}
			if (disabled) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: DevopsUI_module_css_default.searchWrap,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: `${DevopsUI_module_css_default.searchTrigger}${compact ? ` ${DevopsUI_module_css_default.searchTriggerCompact}` : ""} ${DevopsUI_module_css_default.searchTriggerDisabled}`,
					disabled: true,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: DevopsUI_module_css_default.searchTriggerValue,
						children: selected?.label ?? placeholder ?? ""
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: DevopsUI_module_css_default.searchCaret,
						children: "▾"
					})]
				})
			});
			const searchPh = t ? t("searchPh") : "搜索...";
			const emptyText = t ? t("searchEmpty") : "无匹配结果";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: rootRef,
				className: DevopsUI_module_css_default.searchWrap,
				onMouseDown: (e) => e.stopPropagation(),
				onClick: (e) => e.stopPropagation(),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: `${DevopsUI_module_css_default.searchTrigger}${compact ? ` ${DevopsUI_module_css_default.searchTriggerCompact}` : ""}`,
					"aria-expanded": open,
					onClick: () => setOpen((o) => !o),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: `${DevopsUI_module_css_default.searchTriggerValue}${selected ? "" : ` ${DevopsUI_module_css_default.searchTriggerPlaceholder}`}`,
						children: selected?.label ?? placeholder ?? "..."
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: DevopsUI_module_css_default.searchCaret,
						children: open ? "▴" : "▾"
					})]
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: DevopsUI_module_css_default.searchPop,
					onKeyDown,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						ref: searchRef,
						className: DevopsUI_module_css_default.searchInput,
						placeholder: searchPh,
						value: query,
						onChange: (e) => {
							setQuery(e.target.value);
							setActive(0);
						}
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: DevopsUI_module_css_default.searchList,
						ref: listRef,
						children: filtered.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: DevopsUI_module_css_default.searchEmpty,
							children: emptyText
						}) : filtered.map((o, i) => {
							let cls = `${DevopsUI_module_css_default.searchOption}${compact ? ` ${DevopsUI_module_css_default.searchOptionCompact}` : ""}`;
							if (o.disabled) cls += ` ${DevopsUI_module_css_default.searchOptionDisabled}`;
							else if (i === active) cls += ` ${DevopsUI_module_css_default.searchOptionActive}`;
							if (o.value === value) cls += ` ${DevopsUI_module_css_default.searchOptionSelected}`;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: cls,
								onMouseEnter: () => {
									if (!o.disabled) setActive(i);
								},
								onClick: () => pick(o),
								children: o.label
							}, o.value);
						})
					})]
				})]
			});
		}
		/**
		* Lightweight modal dialog (portal to document.body). Interactions inside
		* stop propagation so DSH global handlers ignore them; overlay click and
		* Escape close.
		*/
		function Modal({ open, title, onClose, children, footer, maxWidth }) {
			(0, react.useEffect)(() => {
				if (!open) return;
				const onKey = (e) => {
					if (e.key === "Escape") {
						e.stopPropagation();
						onClose();
					}
				};
				document.addEventListener("keydown", onKey, true);
				return () => document.removeEventListener("keydown", onKey, true);
			}, [open, onClose]);
			if (!open) return null;
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: DevopsUI_module_css_default.modalOverlay,
				onMouseDown: (e) => {
					e.stopPropagation();
					if (e.target === e.currentTarget) onClose();
				},
				onClick: (e) => e.stopPropagation(),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: DevopsUI_module_css_default.modalCard,
					style: maxWidth ? { maxWidth } : void 0,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: DevopsUI_module_css_default.modalHeader,
							onMouseDown: (e) => e.stopPropagation(),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: DevopsUI_module_css_default.modalTitle,
								children: title
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: DevopsUI_module_css_default.modalClose,
								onClick: onClose,
								"aria-label": "close",
								children: "✕"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: DevopsUI_module_css_default.modalBody,
							children
						}),
						footer ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: DevopsUI_module_css_default.modalFooter,
							onMouseDown: (e) => e.stopPropagation(),
							children: footer
						}) : null
					]
				})
			}), document.body);
		}
		function Btn({ children, onClick, disabled, tone = "primary", variant = "solid", small }) {
			let cls = DevopsUI_module_css_default.btn;
			if (small) cls += ` ${DevopsUI_module_css_default.btnSmall}`;
			if (variant === "outline") cls += ` ${DevopsUI_module_css_default.btnOutline}`;
			else if (tone === "success") cls += ` ${DevopsUI_module_css_default.btnSuccess}`;
			if (disabled) cls += ` ${DevopsUI_module_css_default.btnDisabled}`;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: cls,
				onClick: disabled ? void 0 : onClick,
				disabled,
				children
			});
		}
		function Status({ status, msg }) {
			if (!status) return null;
			const cls = status === "ok" ? DevopsUI_module_css_default.statusOk : status === "error" ? DevopsUI_module_css_default.statusError : DevopsUI_module_css_default.statusIdle;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `${DevopsUI_module_css_default.status} ${cls}`,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: { fontSize: 14 },
					children: status === "ok" ? "✓" : status === "error" ? "✗" : "⏳"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: msg ?? "" })]
			});
		}
		function Section({ title, badge, children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: DevopsUI_module_css_default.section,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: DevopsUI_module_css_default.sectionTitle,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: DevopsUI_module_css_default.sectionTitleText,
						children: title
					}), badge ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: DevopsUI_module_css_default.sectionBadge,
						children: badge
					}) : null]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: DevopsUI_module_css_default.fieldGap,
					children
				})]
			});
		}
		function Badge({ tone = "neutral", children }) {
			const cls = tone === "ok" ? DevopsUI_module_css_default.badgeOk : tone === "warn" ? DevopsUI_module_css_default.badgeWarn : tone === "err" ? DevopsUI_module_css_default.badgeErr : tone === "accent" ? DevopsUI_module_css_default.badgeAccent : DevopsUI_module_css_default.badgeNeutral;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: `${DevopsUI_module_css_default.badge} ${cls}`,
				children
			});
		}
		function ChipBtn({ children, onClick, tone = "ghost", title, disabled }) {
			let cls = DevopsUI_module_css_default.chipBtn;
			if (tone === "primary") cls += ` ${DevopsUI_module_css_default.chipBtnPrimary}`;
			else if (tone === "danger") cls += ` ${DevopsUI_module_css_default.chipBtnDanger}`;
			if (disabled) cls += ` ${DevopsUI_module_css_default.chipBtnDisabled}`;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				title,
				disabled,
				className: cls,
				onClick: disabled ? void 0 : onClick,
				children
			});
		}
		function StatCard({ icon, title, value, sub, tone = "neutral", subTone }) {
			const color = tone === "ok" ? "#34c759" : tone === "err" ? "#ff8a80" : tone === "warn" ? "#fbbf24" : "#eee";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: DevopsUI_module_css_default.statCard,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: DevopsUI_module_css_default.statCardTitle,
						children: [icon ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: icon }) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: title })]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: DevopsUI_module_css_default.statCardValue,
						style: { color },
						children: value != null ? value : "—"
					}),
					sub ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: DevopsUI_module_css_default.statCardSub,
						style: subTone ? { color: subTone } : void 0,
						children: sub
					}) : null
				]
			});
		}
		function SecHeader({ icon, title, badge, badgeTone = "neutral", onNew, newLabel, right }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					alignItems: "center",
					gap: 8,
					marginBottom: 8
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: { fontSize: 13 },
						children: icon
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: {
							fontSize: 13,
							fontWeight: 600
						},
						children: title
					}),
					badge != null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
						tone: badgeTone,
						children: badge
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
					right,
					onNew ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Btn, {
						onClick: onNew,
						small: true,
						variant: "outline",
						children: newLabel ?? "+ New"
					}) : null
				]
			});
		}
		function TabBar({ tabs, active, onChange, small }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: DevopsUI_module_css_default.tabBar,
				children: tabs.map((tab) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => onChange(tab.id),
					className: `${DevopsUI_module_css_default.tab}${small ? ` ${DevopsUI_module_css_default.tabSmall}` : ""}${active === tab.id ? ` ${DevopsUI_module_css_default.tabActive}` : ""}`,
					children: [tab.label, tab.badge != null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: DevopsUI_module_css_default.tabBadge,
						children: tab.badge
					}) : null]
				}, tab.id))
			});
		}
		function EmptyHint({ children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: DevopsUI_module_css_default.emptyHint,
				children
			});
		}
		function SwitchCard({ icon, title, status, t, children }) {
			const st = status === "ok" ? {
				tone: "ok",
				text: t("connected")
			} : status === "err" ? {
				tone: "err",
				text: t("connectFailed")
			} : null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: DevopsUI_module_css_default.switchCard,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: DevopsUI_module_css_default.switchCardHeader,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: { fontSize: 12 },
							children: icon
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: DevopsUI_module_css_default.switchCardTitle,
							children: title
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
						st ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							style: {
								display: "flex",
								alignItems: "center",
								gap: 4,
								fontSize: 10,
								color: st.tone === "ok" ? "#34c759" : "#ff453a"
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Dot, {
								tone: st.tone,
								pulse: st.tone === "err"
							}), st.text]
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								fontSize: 10,
								color: "#666"
							},
							children: status === "" ? t("detecting") : t("notConfigured")
						})
					]
				}), children]
			});
		}
		function Toast({ toast }) {
			if (!toast) return null;
			const bg = toast.tone === "err" ? "rgba(255,69,58,0.12)" : toast.tone === "warn" ? "rgba(251,191,36,0.12)" : "rgba(52,199,89,0.12)";
			const border = toast.tone === "err" ? "rgba(255,69,58,0.4)" : toast.tone === "warn" ? "rgba(251,191,36,0.4)" : "rgba(52,199,89,0.4)";
			const fg = toast.tone === "err" ? "#ff8a80" : toast.tone === "warn" ? "#fbbf24" : "#34c759";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: DevopsUI_module_css_default.toast,
				style: {
					background: bg,
					border: `1px solid ${border}`
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: { color: fg },
					children: toast.tone === "err" ? "✗" : toast.tone === "warn" ? "!" : "✓"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: { color: "#ddd" },
					children: toast.msg
				})]
			});
		}
		/** Relative "time ago" label. */
		function timeAgo(ts, t) {
			if (!ts) return "";
			const diff = Date.now() - new Date(ts).getTime();
			if (isNaN(diff) || diff < 0) return "";
			const s = Math.floor(diff / 1e3);
			if (s < 60) return t("justNow");
			const m = Math.floor(s / 60);
			if (m < 60) return t("minAgo", { n: m });
			const hr = Math.floor(m / 60);
			if (hr < 24) return t("hourAgo", { n: hr });
			return t("dayAgo", { n: Math.floor(hr / 24) });
		}
		//#endregion
		//#region src/client/DevopsSettings.tsx
		/**
		* Settings → DevOps section: GitLab / Kubernetes connection wizard.
		*
		* 交互模型（卡片式）：每套 GitLab / kubeconfig 配置是一张可展开的手风琴卡片，
		* 编辑表单住在卡片内部——新增即出现展开的空卡（不再有"悬空表单"和"添加清空已填"），
		* 字段改动直接写回条目，测试连接/项目/分支等状态跟随各自卡片。
		* 保存按钮统一落盘（~/.dsh-devops/config.json，经 RPC）。
		*/
		function emptyGlDraft(id, label) {
			return {
				id,
				label,
				baseUrl: "",
				token: "",
				projectPath: "",
				branch: "",
				testStatus: "",
				testMsg: "",
				projects: [],
				projectsFetching: false,
				projSearch: "",
				branches: [],
				branchesAll: [],
				branchSearch: "",
				branchesLoading: false,
				branchesError: ""
			};
		}
		function emptyKcDraft(id, label) {
			return {
				id,
				label,
				path: "",
				context: "",
				namespace: "",
				testStatus: "",
				testMsg: "",
				contexts: [],
				namespaces: [],
				namespacesLoading: false
			};
		}
		const toGlDraft = (s) => ({
			...emptyGlDraft(s.id, s.label),
			...s
		});
		const toKcDraft = (k) => ({
			...emptyKcDraft(k.id, k.label),
			...k
		});
		/** Strip transient per-card state before persisting a draft. */
		function plainGl(d) {
			const { testStatus, testMsg, projects, projectsFetching, projSearch, branches, branchesAll, branchSearch, branchesLoading, branchesError, ...s } = d;
			return s;
		}
		function plainKc(d) {
			const { testStatus, testMsg, contexts, namespaces, namespacesLoading, ...k } = d;
			return k;
		}
		function DevopsSettings({ connection, locale, t }) {
			useLocaleRevision(locale);
			const client = new DevopsClient(connection);
			const [glDrafts, setGlDrafts] = (0, react.useState)([]);
			const [expandedGl, setExpandedGl] = (0, react.useState)(null);
			const [kcDrafts, setKcDrafts] = (0, react.useState)([]);
			const [expandedKc, setExpandedKc] = (0, react.useState)(null);
			const [saveStatus, setSaveStatus] = (0, react.useState)("");
			const [saveMsg, setSaveMsg] = (0, react.useState)("");
			const [hasSavedConfig, setHasSavedConfig] = (0, react.useState)(false);
			const updateGl = (0, react.useCallback)((id, patch) => {
				setGlDrafts((list) => list.map((d) => d.id === id ? {
					...d,
					...patch
				} : d));
			}, []);
			const updateKc = (0, react.useCallback)((id, patch) => {
				setKcDrafts((list) => list.map((d) => d.id === id ? {
					...d,
					...patch
				} : d));
			}, []);
			(0, react.useEffect)(() => {
				(async () => {
					let r;
					try {
						r = await client.loadConfig();
					} catch {
						return;
					}
					if (!r || !r.ok || !r.config) return;
					const c = r.config;
					const glDrafts0 = (c.gitlab?.servers ?? []).map(toGlDraft);
					const kcDrafts0 = (c.k8s?.kubeconfigs ?? []).map(toKcDraft);
					setGlDrafts(glDrafts0);
					setKcDrafts(kcDrafts0);
					setExpandedGl(glDrafts0[0]?.id ?? null);
					setExpandedKc(kcDrafts0[0]?.id ?? null);
					setHasSavedConfig(true);
					for (const d of glDrafts0) {
						if (!d.baseUrl || !d.token) continue;
						try {
							const pr = await client.gitlabProjects({
								baseUrl: d.baseUrl,
								token: d.token
							});
							if (!pr.ok || !pr.projects) {
								updateGl(d.id, {
									testStatus: "error",
									testMsg: pr.message || t("restoreFail")
								});
								continue;
							}
							updateGl(d.id, {
								testStatus: "ok",
								testMsg: t("restored"),
								projects: pr.projects
							});
							if (d.projectPath && pr.projects.some((p) => p.path === d.projectPath) && d.projectPath) try {
								const br = await client.gitlabBranches({
									baseUrl: d.baseUrl,
									path: d.projectPath,
									token: d.token
								});
								if (br.ok && br.branches) {
									const names = br.branches.map((b) => b.name);
									updateGl(d.id, {
										branches: names,
										branchesAll: names,
										branch: names.includes(d.branch) ? d.branch : names[0] ?? d.branch
									});
								}
							} catch {}
						} catch {
							updateGl(d.id, {
								testStatus: "error",
								testMsg: t("restoreFail")
							});
						}
					}
					for (const d of kcDrafts0) {
						if (!d.path) continue;
						try {
							const tk = await client.testK8s({
								kubeconfigPath: d.path,
								context: d.context || void 0
							});
							if (tk.ok) {
								updateKc(d.id, {
									testStatus: "ok",
									testMsg: tk.message,
									contexts: tk.contexts ?? []
								});
								if (d.context) try {
									const nr = await client.k8sNamespaces({
										kubeconfigPath: d.path,
										context: d.context
									});
									if (nr.ok && nr.namespaces) updateKc(d.id, { namespaces: nr.namespaces });
								} catch {}
							} else updateKc(d.id, {
								testStatus: "error",
								testMsg: tk.message || t("k8sFail")
							});
						} catch {
							updateKc(d.id, {
								testStatus: "error",
								testMsg: t("k8sFail")
							});
						}
					}
				})();
			}, []);
			function addGl() {
				const id = `s${Date.now()}`;
				setGlDrafts((list) => [...list, emptyGlDraft(id, `GitLab ${list.length + 1}`)]);
				setExpandedGl(id);
			}
			function removeGl(id) {
				setGlDrafts((list) => list.filter((d) => d.id !== id));
				setExpandedGl((cur) => cur === id ? null : cur);
			}
			async function toggleGl(id) {
				setExpandedGl((cur) => cur === id ? null : id);
			}
			async function testGl(id) {
				const d = glDrafts.find((x) => x.id === id);
				if (!d) return;
				if (!d.baseUrl || !d.token) {
					updateGl(id, {
						testStatus: "error",
						testMsg: t("fillGl")
					});
					return;
				}
				updateGl(id, {
					testStatus: "testing",
					testMsg: t("connecting"),
					projectsFetching: true
				});
				try {
					const r = await client.testGitLab({
						baseUrl: d.baseUrl,
						token: d.token
					});
					if (!r.ok) {
						updateGl(id, {
							testStatus: "error",
							testMsg: r.message,
							projectsFetching: false
						});
						return;
					}
					updateGl(id, {
						testStatus: "ok",
						testMsg: r.message
					});
					const pr = await client.gitlabProjects({
						baseUrl: d.baseUrl,
						token: d.token
					});
					updateGl(id, {
						projects: pr.ok && pr.projects ? pr.projects : [],
						projectsFetching: false
					});
				} catch (e) {
					updateGl(id, {
						testStatus: "error",
						testMsg: e.message,
						projectsFetching: false
					});
				}
			}
			async function refreshProjects(id) {
				const d = glDrafts.find((x) => x.id === id);
				if (!d?.baseUrl || !d.token) return;
				updateGl(id, { projectsFetching: true });
				try {
					const pr = await client.gitlabProjects({
						baseUrl: d.baseUrl,
						token: d.token
					});
					updateGl(id, {
						projects: pr.ok && pr.projects ? pr.projects : [],
						projectsFetching: false
					});
				} catch {
					updateGl(id, { projectsFetching: false });
				}
			}
			function searchProjects(id) {
				const d = glDrafts.find((x) => x.id === id);
				if (!d) return;
				const keyword = d.projSearch.trim().toLowerCase();
				if (!keyword) {
					refreshProjects(id);
					return;
				}
				const filtered = d.projects.filter((p) => p.path.toLowerCase().includes(keyword) || (p.name || "").toLowerCase().includes(keyword));
				if (filtered.length === 0) searchProjectsServer(id, keyword);
				else updateGl(id, { projects: filtered });
			}
			async function searchProjectsServer(id, keyword) {
				const d = glDrafts.find((x) => x.id === id);
				if (!d?.baseUrl || !d.token) return;
				updateGl(id, { projectsFetching: true });
				try {
					const pr = await client.gitlabProjects({
						baseUrl: d.baseUrl,
						token: d.token,
						search: keyword
					});
					updateGl(id, {
						projects: pr.ok && pr.projects ? pr.projects : [],
						projectsFetching: false
					});
				} catch {
					updateGl(id, { projectsFetching: false });
				}
			}
			async function onProjectChange(id, path) {
				const d = glDrafts.find((x) => x.id === id);
				const proj = d?.projects.find((p) => p.path === path);
				if (!d || !proj) return;
				updateGl(id, {
					projectPath: path,
					branch: proj.defaultBranch || "",
					branches: [],
					branchesLoading: true,
					branchesError: ""
				});
				try {
					const r = await client.gitlabBranches({
						baseUrl: d.baseUrl,
						path: proj.path,
						token: d.token
					});
					if (r.ok && r.branches) {
						const names = r.branches.map((b) => b.name);
						updateGl(id, {
							branches: names,
							branchesAll: names,
							branchesLoading: false,
							branchesError: ""
						});
					} else updateGl(id, {
						branchesLoading: false,
						branchesError: r.message || t("brFail")
					});
				} catch (e) {
					updateGl(id, {
						branchesLoading: false,
						branchesError: e.message || t("brFail")
					});
				}
			}
			function searchBranches(id) {
				const d = glDrafts.find((x) => x.id === id);
				if (!d) return;
				const keyword = d.branchSearch.trim().toLowerCase();
				updateGl(id, { branches: keyword ? d.branchesAll.filter((b) => b.toLowerCase().includes(keyword)) : d.branchesAll });
			}
			function addKc() {
				const id = `k${Date.now()}`;
				setKcDrafts((list) => [...list, emptyKcDraft(id, `K8s ${list.length + 1}`)]);
				setExpandedKc(id);
			}
			function removeKc(id) {
				setKcDrafts((list) => list.filter((d) => d.id !== id));
				setExpandedKc((cur) => cur === id ? null : cur);
			}
			async function testKc(id) {
				const d = kcDrafts.find((x) => x.id === id);
				if (!d) return;
				if (!d.path) {
					updateKc(id, {
						testStatus: "error",
						testMsg: t("fillKc")
					});
					return;
				}
				updateKc(id, {
					testStatus: "testing",
					testMsg: t("connecting")
				});
				try {
					const r = await client.testK8s({
						kubeconfigPath: d.path,
						context: d.context || void 0
					});
					if (!r.ok) {
						updateKc(id, {
							testStatus: "error",
							testMsg: r.message
						});
						return;
					}
					const contexts = r.contexts ?? [];
					const defaultCtx = d.context || contexts[0]?.name || "";
					const defaultNs = contexts.find((c) => c.name === defaultCtx)?.namespace ?? r.namespace ?? "";
					updateKc(id, {
						testStatus: "ok",
						testMsg: r.message,
						contexts,
						context: defaultCtx,
						namespace: d.namespace || defaultNs,
						namespacesLoading: !!defaultCtx
					});
					if (defaultCtx) try {
						const nr = await client.k8sNamespaces({
							kubeconfigPath: d.path,
							context: defaultCtx
						});
						updateKc(id, {
							namespaces: nr.ok && nr.namespaces ? nr.namespaces : [],
							namespacesLoading: false
						});
					} catch {
						updateKc(id, { namespacesLoading: false });
					}
				} catch (e) {
					updateKc(id, {
						testStatus: "error",
						testMsg: e.message
					});
				}
			}
			async function onContextChange(id, ctxName) {
				const d = kcDrafts.find((x) => x.id === id);
				if (!d) return;
				const cfg = d.contexts.find((c) => c.name === ctxName);
				updateKc(id, {
					context: ctxName,
					namespace: cfg?.namespace || "",
					namespaces: [],
					namespacesLoading: true
				});
				try {
					const r = await client.k8sNamespaces({
						kubeconfigPath: d.path,
						context: ctxName
					});
					updateKc(id, {
						namespaces: r.ok && r.namespaces ? r.namespaces : [],
						namespacesLoading: false
					});
				} catch {
					updateKc(id, { namespacesLoading: false });
				}
			}
			async function handleBrowseKc(id) {
				try {
					const r = await client.browseFile();
					if (r.ok && r.path) updateKc(id, {
						path: r.path,
						testStatus: "",
						testMsg: ""
					});
				} catch {}
			}
			async function handleSave() {
				const config = {};
				if (glDrafts.length > 0) {
					const firstUsable = glDrafts.find((s) => s.baseUrl && s.token && s.projectPath);
					config.gitlab = {
						servers: glDrafts.map(plainGl),
						activeServerId: firstUsable?.id ?? glDrafts[0]?.id ?? null
					};
				}
				if (kcDrafts.length > 0) {
					const firstUsable = kcDrafts.find((k) => k.path);
					config.k8s = {
						kubeconfigs: kcDrafts.map(plainKc),
						activeKubeconfigId: firstUsable?.id ?? kcDrafts[0]?.id ?? null
					};
				}
				if (!config.gitlab && !config.k8s) {
					setSaveStatus("error");
					setSaveMsg(t("completeOne"));
					return;
				}
				try {
					const r = await client.saveConfig(config);
					if (r.ok) {
						setSaveStatus("ok");
						setSaveMsg(t("saved"));
						setHasSavedConfig(true);
					} else {
						setSaveStatus("error");
						setSaveMsg(r.message || t("saveFailed"));
					}
				} catch (e) {
					setSaveStatus("error");
					setSaveMsg(e.message);
				}
			}
			const glConnected = glDrafts.some((d) => d.testStatus === "ok");
			const kcConnected = kcDrafts.some((d) => d.testStatus === "ok");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					padding: "0 4px 24px",
					maxWidth: 640
				},
				children: [
					!hasSavedConfig ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: DevopsUI_module_css_default.callout,
						style: { marginBottom: 20 },
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("notCfgYet") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: { marginTop: 4 },
							children: t("fillGlOrK8s")
						})]
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Section, {
						title: "GitLab",
						badge: glConnected ? t("connected") : void 0,
						children: glDrafts.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: DevopsUI_module_css_default.emptyCard,
							onClick: addGl,
							children: ["+ ", t("addServer")]
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								flexDirection: "column",
								gap: 8
							},
							children: [glDrafts.map((d) => {
								const expanded = expandedGl === d.id;
								const st = d.testStatus;
								const keyword = d.branchSearch.trim().toLowerCase();
								const filteredBranches = keyword ? d.branchesAll.filter((b) => b.toLowerCase().includes(keyword)) : d.branches;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: DevopsUI_module_css_default.serverCard,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: DevopsUI_module_css_default.cardHeader,
										onClick: () => void toggleGl(d.id),
										role: "button",
										"aria-expanded": expanded,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Dot, { tone: st === "ok" ? "ok" : st === "error" ? "err" : "neutral" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: DevopsUI_module_css_default.cardHeaderLabel,
												children: d.label || t("unnamed")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: DevopsUI_module_css_default.cardHeaderPath,
												children: d.baseUrl || t("noUrl")
											}),
											st === "ok" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
												tone: "ok",
												children: t("connected")
											}) : st === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
												tone: "err",
												children: t("connectFailed")
											}) : null,
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: DevopsUI_module_css_default.cardChevron,
												children: expanded ? "▾" : "▸"
											})
										]
									}), expanded && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: DevopsUI_module_css_default.cardBody,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Label, { children: t("name") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Input, {
												type: "text",
												value: d.label,
												placeholder: t("nameGlPh"),
												onChange: (e) => updateGl(d.id, { label: e.target.value })
											})] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Label, { children: "Base URL" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Input, {
												type: "url",
												value: d.baseUrl,
												placeholder: "https://gitlab.example.com",
												onChange: (e) => updateGl(d.id, {
													baseUrl: e.target.value,
													testStatus: "",
													testMsg: ""
												})
											})] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Label, { children: "Access Token" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Input, {
												type: "password",
												value: d.token,
												placeholder: "glpat-xxxx...",
												onChange: (e) => updateGl(d.id, {
													token: e.target.value,
													testStatus: "",
													testMsg: ""
												})
											})] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: {
													display: "flex",
													alignItems: "flex-start",
													gap: 12
												},
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Btn, {
													onClick: () => void testGl(d.id),
													disabled: st === "testing",
													children: st === "testing" ? t("connecting") : t("testConn")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Status, {
													status: st,
													msg: d.testMsg
												}) })]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													style: {
														display: "flex",
														alignItems: "center",
														justifyContent: "space-between"
													},
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Label, { children: t("project") }), st === "ok" && d.projects.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Btn, {
														onClick: () => void refreshProjects(d.id),
														disabled: d.projectsFetching,
														variant: "outline",
														small: true,
														children: d.projectsFetching ? "..." : t("refresh")
													}) : null]
												}),
												st !== "ok" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: DevopsUI_module_css_default.hint,
													children: t("testGlFirst")
												}),
												st === "ok" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													style: {
														display: "flex",
														gap: 6,
														marginBottom: 8
													},
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
														type: "text",
														value: d.projSearch,
														placeholder: t("searchProjPh"),
														className: DevopsUI_module_css_default.input,
														style: { flex: 1 },
														onChange: (e) => updateGl(d.id, { projSearch: e.target.value }),
														onKeyDown: (e) => {
															if (e.key === "Enter") searchProjects(d.id);
														}
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Btn, {
														onClick: () => searchProjects(d.id),
														small: true,
														variant: "outline",
														children: t("search")
													})]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Select, {
													t,
													options: d.projects.map((p) => p.path).filter(Boolean),
													value: d.projectPath,
													onChange: (v) => void onProjectChange(d.id, v),
													disabled: st !== "ok" || d.projectsFetching || d.projects.length === 0,
													placeholder: st !== "ok" ? t("testFirst") : d.projectsFetching ? t("loading") : d.projects.length === 0 ? t("noProjects") : t("selProject")
												})
											] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Label, { children: t("branch") }),
												!d.projectPath && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: DevopsUI_module_css_default.hint,
													children: t("selProjFirst")
												}),
												d.branchesError && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													style: {
														fontSize: 12,
														color: "#ff453a",
														marginBottom: 6
													},
													children: ["⚠ ", d.branchesError]
												}),
												d.projectPath && !d.branchesLoading && d.branches.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													style: {
														display: "flex",
														gap: 6,
														marginBottom: 8
													},
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
														type: "text",
														value: d.branchSearch,
														placeholder: t("searchBrPh"),
														className: DevopsUI_module_css_default.input,
														style: { flex: 1 },
														onChange: (e) => updateGl(d.id, { branchSearch: e.target.value }),
														onKeyDown: (e) => {
															if (e.key === "Enter") searchBranches(d.id);
														}
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Btn, {
														onClick: () => searchBranches(d.id),
														small: true,
														variant: "outline",
														children: t("search")
													})]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Select, {
													t,
													options: d.branchesLoading ? [{
														value: "__loading",
														label: t("loadingBr"),
														disabled: true
													}] : filteredBranches.length === 0 ? [{
														value: "__empty",
														label: t("noBranches"),
														disabled: true
													}] : filteredBranches,
													value: d.branch,
													onChange: (v) => updateGl(d.id, { branch: v }),
													disabled: !d.projectPath || d.branchesLoading,
													placeholder: !d.projectPath ? t("selProjFirst") : t("selBranch")
												})
											] }),
											glDrafts.length > 1 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												style: {
													borderTop: "1px solid var(--ds-alias-border,#2a2a2a)",
													paddingTop: 8
												},
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: DevopsUI_module_css_default.dangerLink,
													onClick: () => removeGl(d.id),
													children: t("delGl")
												})
											}) : null
										]
									})]
								}, d.id);
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Btn, {
								onClick: addGl,
								small: true,
								variant: "outline",
								children: t("addServer")
							})]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Section, {
						title: "Kubernetes",
						badge: kcConnected ? t("connected") : void 0,
						children: kcDrafts.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: DevopsUI_module_css_default.emptyCard,
							onClick: addKc,
							children: ["+ ", t("addKc")]
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								flexDirection: "column",
								gap: 8
							},
							children: [kcDrafts.map((d) => {
								const expanded = expandedKc === d.id;
								const st = d.testStatus;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: DevopsUI_module_css_default.serverCard,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: DevopsUI_module_css_default.cardHeader,
										onClick: () => setExpandedKc((cur) => cur === d.id ? null : d.id),
										role: "button",
										"aria-expanded": expanded,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Dot, { tone: st === "ok" ? "ok" : st === "error" ? "err" : "neutral" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: DevopsUI_module_css_default.cardHeaderLabel,
												children: d.label || t("unnamed")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: DevopsUI_module_css_default.cardHeaderPath,
												children: d.path || t("noPath")
											}),
											st === "ok" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
												tone: "ok",
												children: t("connected")
											}) : st === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
												tone: "err",
												children: t("connectFailed")
											}) : null,
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: DevopsUI_module_css_default.cardChevron,
												children: expanded ? "▾" : "▸"
											})
										]
									}), expanded && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: DevopsUI_module_css_default.cardBody,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Label, { children: t("name") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Input, {
												type: "text",
												value: d.label,
												placeholder: t("nameK8sPh"),
												onChange: (e) => updateKc(d.id, { label: e.target.value })
											})] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Label, { children: t("kcPath") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: {
													display: "flex",
													gap: 8
												},
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													style: {
														flex: 1,
														minWidth: 0
													},
													children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Input, {
														type: "url",
														value: d.path,
														placeholder: "~/.kube/config",
														onChange: (e) => updateKc(d.id, {
															path: e.target.value,
															testStatus: "",
															testMsg: ""
														})
													})
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Btn, {
													onClick: () => void handleBrowseKc(d.id),
													variant: "outline",
													children: t("browse")
												})]
											})] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: {
													display: "flex",
													alignItems: "flex-start",
													gap: 12
												},
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Btn, {
													onClick: () => void testKc(d.id),
													disabled: st === "testing",
													children: st === "testing" ? t("connecting") : t("testConn")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Status, {
													status: st,
													msg: d.testMsg
												}) })]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Label, { children: "Context" }),
												st !== "ok" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: DevopsUI_module_css_default.hint,
													children: t("testK8sFirst")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Select, {
													t,
													options: d.contexts.map((c) => c.name).filter(Boolean),
													value: d.context,
													onChange: (v) => void onContextChange(d.id, v),
													disabled: st !== "ok" || d.contexts.length === 0,
													placeholder: st !== "ok" ? t("testFirst") : t("selCtx")
												})
											] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Label, { children: "Namespace" }),
												!d.context && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: DevopsUI_module_css_default.hint,
													children: t("selCtxFirst")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													style: {
														display: "flex",
														gap: 6
													},
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														style: {
															flex: 1,
															minWidth: 0
														},
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Select, {
															t,
															options: d.namespacesLoading ? [{
																value: "__loading",
																label: t("loadingNs"),
																disabled: true
															}] : d.namespaces,
															value: d.namespaces.includes(d.namespace) ? d.namespace : "",
															onChange: (v) => {
																if (!v) return;
																updateKc(d.id, { namespace: v });
															},
															disabled: !d.context || d.namespacesLoading,
															placeholder: !d.context ? t("selCtxFirst") : t("selNs")
														})
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
														type: "text",
														value: d.namespace,
														placeholder: t("manualNs"),
														className: DevopsUI_module_css_default.input,
														style: { flex: 1 },
														onChange: (e) => updateKc(d.id, { namespace: e.target.value })
													})]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: DevopsUI_module_css_default.hint,
													children: t("nsHint")
												})
											] }),
											kcDrafts.length > 1 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												style: {
													borderTop: "1px solid var(--ds-alias-border,#2a2a2a)",
													paddingTop: 8
												},
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: DevopsUI_module_css_default.dangerLink,
													onClick: () => removeKc(d.id),
													children: t("delK8s")
												})
											}) : null
										]
									})]
								}, d.id);
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Btn, {
								onClick: addKc,
								small: true,
								variant: "outline",
								children: t("addKc")
							})]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							alignItems: "center",
							gap: 12
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Btn, {
							onClick: () => void handleSave(),
							tone: "success",
							children: t("saveConfig")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Status, {
							status: saveStatus,
							msg: saveMsg
						})]
					})
				]
			});
		}
		//#endregion
		//#region src/client/DevopsDashboard.tsx
		/**
		* DevOps dashboard (conversation.view tab): connection switch cards, stat
		* cards, and GitLab / K8s / Activity / Logs sub-tabs with inline actions
		* (approve/close MR, cancel/retry pipeline, set image, restart, pod logs).
		*/
		const PIPELINE_RUNNING = [
			"created",
			"waiting_for_resource",
			"preparing",
			"pending",
			"running",
			"queued",
			"scheduled"
		];
		const POLL_INTERVAL = 6e4;
		function DevopsDashboard({ connection, locale, t }) {
			useLocaleRevision(locale);
			const client = new DevopsClient(connection);
			const [config, setConfig] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(true);
			const [activeTab, setActiveTab] = (0, react.useState)("gitlab");
			const [gitlabSubTab, setGitlabSubTab] = (0, react.useState)("mrs");
			const [k8sSubTab, setK8sSubTab] = (0, react.useState)("deployments");
			const [live, setLive] = (0, react.useState)(null);
			const [logsData, setLogsData] = (0, react.useState)(null);
			const [toast, setToast] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const [newMrOpen, setNewMrOpen] = (0, react.useState)(false);
			const [newTagOpen, setNewTagOpen] = (0, react.useState)(false);
			const [podLog, setPodLog] = (0, react.useState)(null);
			const [formOpts, setFormOpts] = (0, react.useState)({
				branches: [],
				members: [],
				loading: false,
				projectKey: ""
			});
			const [mrSource, setMrSource] = (0, react.useState)("");
			const [mrTarget, setMrTarget] = (0, react.useState)("");
			const [mrReviewers, setMrReviewers] = (0, react.useState)("");
			const [tagRefSel, setTagRefSel] = (0, react.useState)("");
			const [barOpts, setBarOpts] = (0, react.useState)({
				projects: [],
				contexts: [],
				namespaces: [],
				key: ""
			});
			const [connStatus, setConnStatus] = (0, react.useState)({
				gl: "",
				k8s: ""
			});
			const [expandedPipe, setExpandedPipe] = (0, react.useState)(null);
			const [pipeJobs, setPipeJobs] = (0, react.useState)({
				id: null,
				jobs: [],
				loading: false
			});
			const [jobLog, setJobLog] = (0, react.useState)(null);
			const [expandedDep, setExpandedDep] = (0, react.useState)(null);
			const [depImgEdit, setDepImgEdit] = (0, react.useState)(null);
			const [depImgValue, setDepImgValue] = (0, react.useState)("");
			const [depRestart, setDepRestart] = (0, react.useState)(null);
			const timerRef = (0, react.useRef)(null);
			const fetchSeqRef = (0, react.useRef)(0);
			const mrDescSeqRef = (0, react.useRef)(0);
			const mrTitleRef = (0, react.useRef)(null);
			const mrDescRef = (0, react.useRef)(null);
			const tagNameRef = (0, react.useRef)(null);
			const tagMsgRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				(async () => {
					try {
						const r = await client.loadConfig();
						if (r.ok && r.config) {
							setConfig(r.config);
							await fetchData(r.config);
						}
					} catch {} finally {
						setLoading(false);
					}
				})();
			}, []);
			const fetchData = (0, react.useCallback)(async (cfg) => {
				if (!cfg) return;
				const seq = ++fetchSeqRef.current;
				const jobs = [];
				const glServer = resolveGlServer(cfg);
				if (glServer?.baseUrl && glServer?.token && glServer?.projectPath) {
					const base = {
						baseUrl: glServer.baseUrl,
						token: glServer.token,
						projectPath: glServer.projectPath
					};
					jobs.push(["mrs", client.gitlabMRs({ ...base })]);
					jobs.push(["pipelines", client.gitlabPipelines({
						...base,
						perPage: 10
					})]);
					jobs.push(["tags", client.gitlabTags(base)]);
				}
				const kc = resolveK8sKc(cfg);
				if (kc?.path) {
					const ns = kc.namespace || "default";
					const kb = {
						kubeconfigPath: kc.path,
						context: kc.context,
						namespace: ns
					};
					jobs.push(["deployments", client.k8sDeployments(kb)]);
					jobs.push(["pods", client.k8sPods(kb)]);
					jobs.push(["events", client.k8sEvents({
						...kb,
						limit: 15
					})]);
				}
				if (jobs.length === 0) {
					if (seq === fetchSeqRef.current) setLive({});
					return;
				}
				const settled = await Promise.all(jobs.map(([, p]) => p.catch(() => ({ ok: false }))));
				if (seq !== fetchSeqRef.current) return;
				const data = {};
				jobs.forEach(([key], i) => {
					data[key] = settled[i];
				});
				setLive(data);
			}, [client]);
			(0, react.useEffect)(() => {
				if (!config) return;
				timerRef.current = setInterval(() => void fetchData(config), POLL_INTERVAL);
				return () => {
					if (timerRef.current) clearInterval(timerRef.current);
				};
			}, [config, fetchData]);
			(0, react.useEffect)(() => {
				if (activeTab !== "logs") return;
				(async () => {
					try {
						const r = await client.logs({ lines: 200 });
						if (r.ok) setLogsData(r.lines ?? []);
					} catch {}
				})();
				const logTimer = setInterval(() => {
					(async () => {
						try {
							const r = await client.logs({ lines: 200 });
							if (r.ok) setLogsData(r.lines ?? []);
						} catch {}
					})();
				}, 1e4);
				return () => clearInterval(logTimer);
			}, [activeTab]);
			(0, react.useEffect)(() => {
				if (!toast) return;
				const toastTimer = setTimeout(() => setToast(null), 3500);
				return () => clearTimeout(toastTimer);
			}, [toast]);
			const glServer = resolveGlServer(config);
			const glProject = glServer?.projectPath ? { path: glServer.projectPath } : null;
			const k8sKc = resolveK8sKc(config);
			async function applyConfig(next) {
				setConfig(next);
				try {
					await client.saveConfig(next);
				} catch {}
				await fetchData(next);
			}
			function switchServer(id) {
				if (!config?.gitlab || id === config.gitlab.activeServerId) return;
				setConnStatus((c) => ({
					...c,
					gl: ""
				}));
				applyConfig({
					...config,
					gitlab: {
						...config.gitlab,
						activeServerId: id
					}
				});
			}
			function switchProject(path) {
				if (!config?.gitlab || !glServer || path === glServer.projectPath) return;
				const servers = config.gitlab.servers.map((s) => s.id === glServer.id ? {
					...s,
					projectPath: path
				} : s);
				applyConfig({
					...config,
					gitlab: {
						...config.gitlab,
						servers
					}
				});
			}
			function switchKubeconfig(id) {
				if (!config?.k8s || id === config.k8s.activeKubeconfigId) return;
				setConnStatus((c) => ({
					...c,
					k8s: ""
				}));
				applyConfig({
					...config,
					k8s: {
						...config.k8s,
						activeKubeconfigId: id
					}
				});
			}
			function switchContext(ctxName) {
				if (!config?.k8s || !k8sKc || ctxName === k8sKc.context) return;
				const kubeconfigs = config.k8s.kubeconfigs.map((k) => k.id === k8sKc.id ? {
					...k,
					context: ctxName,
					namespace: ""
				} : k);
				applyConfig({
					...config,
					k8s: {
						...config.k8s,
						kubeconfigs
					}
				});
			}
			function switchNamespace(ns) {
				if (!config?.k8s || !k8sKc || ns === k8sKc.namespace) return;
				const kubeconfigs = config.k8s.kubeconfigs.map((k) => k.id === k8sKc.id ? {
					...k,
					namespace: ns
				} : k);
				applyConfig({
					...config,
					k8s: {
						...config.k8s,
						kubeconfigs
					}
				});
			}
			(0, react.useEffect)(() => {
				if (!glServer?.baseUrl || !glServer?.token) return;
				const key = `${glServer.id}:${glServer.projectPath}`;
				if (barOpts.key === key) return;
				let stale = false;
				let timer = null;
				const fetchProjects = (attempt) => {
					client.gitlabProjects({
						baseUrl: glServer.baseUrl,
						token: glServer.token
					}).then((r) => {
						if (stale) return;
						if (r.ok && r.projects?.length) {
							setBarOpts((o) => ({
								...o,
								projects: r.projects,
								key
							}));
							setConnStatus((c) => ({
								...c,
								gl: "ok"
							}));
						} else if (attempt < 2) timer = setTimeout(() => fetchProjects(attempt + 1), 6e3);
						else setConnStatus((c) => ({
							...c,
							gl: "err"
						}));
					}).catch(() => {
						if (!stale && attempt < 2) timer = setTimeout(() => fetchProjects(attempt + 1), 6e3);
						else setConnStatus((c) => ({
							...c,
							gl: "err"
						}));
					});
				};
				fetchProjects(0);
				return () => {
					stale = true;
					if (timer) clearTimeout(timer);
				};
			}, [
				glServer?.id,
				glServer?.projectPath,
				glServer?.baseUrl,
				glServer?.token
			]);
			(0, react.useEffect)(() => {
				if (!k8sKc?.path) return;
				let stale = false;
				client.k8sContexts({ kubeconfigPath: k8sKc.path }).then((r) => {
					if (stale) return;
					setBarOpts((o) => ({
						...o,
						contexts: r.ok ? r.contexts : []
					}));
					setConnStatus((c) => ({
						...c,
						k8s: r.ok ? "ok" : "err"
					}));
				}).catch(() => {
					if (!stale) setConnStatus((c) => ({
						...c,
						k8s: "err"
					}));
				});
				client.k8sNamespaces({
					kubeconfigPath: k8sKc.path,
					context: k8sKc.context
				}).then((r) => {
					if (!stale) setBarOpts((o) => ({
						...o,
						namespaces: r.ok ? r.namespaces : []
					}));
				}).catch(() => {});
				return () => {
					stale = true;
				};
			}, [
				k8sKc?.id,
				k8sKc?.path,
				k8sKc?.context
			]);
			(0, react.useEffect)(() => {
				if (!newMrOpen && !newTagOpen || !glServer?.baseUrl || !glServer?.token || !glServer?.projectPath) return;
				const projectKey = `${glServer.id}:${glServer.projectPath}`;
				if (formOpts.projectKey === projectKey && (formOpts.branches.length || formOpts.members.length)) return;
				let stale = false;
				let timer = null;
				const fetchOpts = (attempt) => {
					setFormOpts((o) => ({
						...o,
						loading: true,
						projectKey
					}));
					Promise.all([client.gitlabBranches({
						baseUrl: glServer.baseUrl,
						token: glServer.token,
						path: glServer.projectPath
					}).catch(() => ({
						ok: false,
						branches: []
					})), client.gitlabMembers({
						baseUrl: glServer.baseUrl,
						token: glServer.token,
						path: glServer.projectPath
					}).catch(() => ({
						ok: false,
						members: []
					}))]).then(([br, mem]) => {
						if (stale) return;
						const ok = br.ok || mem.ok;
						setFormOpts({
							branches: br.ok ? br.branches : [],
							members: mem.ok ? mem.members : [],
							loading: false,
							projectKey
						});
						if (!ok && attempt < 1) timer = setTimeout(() => fetchOpts(attempt + 1), 5e3);
					});
				};
				fetchOpts(0);
				return () => {
					stale = true;
					if (timer) clearTimeout(timer);
				};
			}, [
				newMrOpen,
				newTagOpen,
				glServer?.id,
				glServer?.projectPath
			]);
			(0, react.useEffect)(() => {
				if (!formOpts.branches.length) return;
				const def = formOpts.branches.find((b) => b.isDefault)?.name ?? glServer?.branch ?? "main";
				setMrTarget((v) => v || def);
				setMrSource((v) => v || glServer?.branch || "");
				setTagRefSel((v) => v || def);
			}, [formOpts.branches, formOpts.projectKey]);
			function genMrType(branch) {
				const m = /^(feature|feat|fix|bugfix|hotfix|chore|refactor|docs|test)[/-]/.exec(branch || "");
				if (!m?.[1]) return null;
				return [
					"fix",
					"bugfix",
					"hotfix"
				].includes(m[1]) ? "fix" : [
					"chore",
					"refactor",
					"docs",
					"test"
				].includes(m[1]) ? m[1] : "feat";
			}
			const mrAutoRef = (0, react.useRef)({
				title: "",
				desc: ""
			});
			(0, react.useEffect)(() => {
				if (!newMrOpen || !mrSource || !mrTarget || mrSource === mrTarget) return;
				const type = genMrType(mrSource);
				const words = mrSource.replace(/^(feature|feat|fix|bugfix|hotfix|chore|refactor|docs|test)[/-]/, "").replace(/[-_]+/g, " ");
				const autoTitle = type ? `${type}: ${words}${t("autoTitleSuffix", {
					s: mrSource,
					t: mrTarget
				})}` : `merge ${mrSource} into ${mrTarget}`;
				const titleInput = mrTitleRef.current;
				if (titleInput && (!titleInput.value || titleInput.value === mrAutoRef.current.title)) titleInput.value = autoTitle;
				mrAutoRef.current.title = autoTitle;
				if (mrDescRef.current && (!mrDescRef.current.value || mrDescRef.current.value === mrAutoRef.current.desc) && glServer?.baseUrl && glServer?.token && glServer?.projectPath) {
					const seq = ++mrDescSeqRef.current;
					client.gitlabLastCommit({
						baseUrl: glServer.baseUrl,
						token: glServer.token,
						path: glServer.projectPath,
						branch: mrSource
					}).then((r) => {
						const d = mrDescRef.current;
						if (!r.ok || !d || d.value || seq !== mrDescSeqRef.current) return;
						const authorSuffix = r.author ? `（${r.author}）` : "";
						d.value = [
							t("descHead"),
							"",
							"- ",
							"",
							t("descCommit"),
							"",
							`- \`${r.shortId}\` ${r.title}${authorSuffix}`,
							"",
							t("descSource"),
							"",
							t("descBranch", {
								s: mrSource,
								t: mrTarget
							})
						].join("\n");
						mrAutoRef.current.desc = d.value;
					}).catch(() => {});
				}
			}, [
				newMrOpen,
				mrSource,
				mrTarget
			]);
			async function handleNewMr() {
				if (!glServer || !glServer.projectPath) return;
				const source = (mrSource || "").trim();
				const target = (mrTarget || "").trim();
				const title = (mrTitleRef.current?.value ?? "").trim();
				const reviewers = (mrReviewers || "").trim();
				const description = (mrDescRef.current?.value ?? "").trim();
				if (!source || !target || !title) {
					setToast({
						msg: t("fillMr"),
						tone: "warn"
					});
					return;
				}
				setBusy(true);
				try {
					const r = await client.gitlabCreateMR({
						baseUrl: glServer.baseUrl,
						token: glServer.token,
						projectPath: glServer.projectPath,
						sourceBranch: source,
						targetBranch: target,
						title,
						description,
						reviewers
					});
					if (r.ok && r.mergeRequest) {
						setToast({
							msg: t("mrCreated", { iid: r.mergeRequest.iid }),
							tone: "ok"
						});
						setNewMrOpen(false);
						fetchData(config);
					} else setToast({
						msg: r.message || t("mrFail"),
						tone: "err"
					});
				} catch (e) {
					setToast({
						msg: e.message || t("createFail"),
						tone: "err"
					});
				} finally {
					setBusy(false);
				}
			}
			function bumpPatch(name) {
				let m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(name);
				if (m) return `v${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
				m = /^v?(\d+)\.(\d+)$/.exec(name);
				if (m) return `v${m[1]}.${Number(m[2]) + 1}.0`;
				return `${name}-next`;
			}
			function pickHistoryTag(name) {
				if (!name) return;
				if (tagNameRef.current) tagNameRef.current.value = bumpPatch(name);
			}
			async function handleNewTag() {
				if (!glServer || !glServer.projectPath) return;
				const tagName = (tagNameRef.current?.value ?? "").trim();
				const ref = (tagRefSel || "").trim();
				const message = (tagMsgRef.current?.value ?? "").trim();
				if (!tagName || !ref) {
					setToast({
						msg: t("fillTag"),
						tone: "warn"
					});
					return;
				}
				setBusy(true);
				try {
					const r = await client.gitlabCreateTag({
						baseUrl: glServer.baseUrl,
						token: glServer.token,
						projectPath: glServer.projectPath,
						tagName,
						ref,
						message
					});
					if (r.ok) {
						setToast({
							msg: t("tagCreated", { name: tagName }),
							tone: "ok"
						});
						setNewTagOpen(false);
						fetchData(config);
					} else setToast({
						msg: r.message || t("tagFail"),
						tone: "err"
					});
				} catch (e) {
					setToast({
						msg: e.message || t("createFail"),
						tone: "err"
					});
				} finally {
					setBusy(false);
				}
			}
			async function handleApprove(mr) {
				if (!glServer || !glProject) return;
				setBusy(true);
				try {
					const r = await client.gitlabMRApprove({
						baseUrl: glServer.baseUrl,
						token: glServer.token,
						projectPath: glProject.path,
						mrIid: mr.iid
					});
					if (r.ok) {
						setToast({
							msg: t("approved", { iid: mr.iid }) + (r.approvalsBeforeMerge != null ? t("remaining", { n: r.approvalsBeforeMerge }) : ""),
							tone: "ok"
						});
						fetchData(config);
					} else setToast({
						msg: r.message || t("approveFail"),
						tone: "err"
					});
				} catch (e) {
					setToast({
						msg: e.message || t("approveFail"),
						tone: "err"
					});
				} finally {
					setBusy(false);
				}
			}
			async function handlePipelineAction(p, action) {
				if (!glServer || !glProject) return;
				setBusy(true);
				try {
					const r = await client.gitlabPipelineAction({
						baseUrl: glServer.baseUrl,
						token: glServer.token,
						projectPath: glProject.path,
						pipelineId: p.id,
						action
					});
					if (r.ok) {
						setToast({
							msg: t("pipAction", {
								id: p.id,
								action: action === "cancel" ? t("pipCanceled") : t("pipRetried")
							}),
							tone: "ok"
						});
						fetchData(config);
					} else setToast({
						msg: r.message || t("actionFail"),
						tone: "err"
					});
				} catch (e) {
					setToast({
						msg: e.message || t("actionFail"),
						tone: "err"
					});
				} finally {
					setBusy(false);
				}
			}
			async function handleMrClose(mr) {
				if (!glServer || !glProject) return;
				setBusy(true);
				try {
					const r = await client.gitlabMRAction({
						baseUrl: glServer.baseUrl,
						token: glServer.token,
						projectPath: glProject.path,
						mrIid: mr.iid,
						action: "close"
					});
					if (r.ok) {
						setToast({
							msg: t("mrClosed", { iid: mr.iid }),
							tone: "ok"
						});
						fetchData(config);
					} else setToast({
						msg: r.message || t("closeFail"),
						tone: "err"
					});
				} catch (e) {
					setToast({
						msg: e.message || t("closeFail"),
						tone: "err"
					});
				} finally {
					setBusy(false);
				}
			}
			function togglePipeDetail(p) {
				if (expandedPipe === p.id) {
					setExpandedPipe(null);
					return;
				}
				setExpandedPipe(p.id);
				setPipeJobs({
					id: p.id,
					jobs: [],
					loading: true
				});
				if (!glServer || !glProject) return;
				client.gitlabPipelineJobs({
					baseUrl: glServer.baseUrl,
					token: glServer.token,
					projectPath: glProject.path,
					pipelineId: p.id
				}).then((r) => setPipeJobs({
					id: p.id,
					jobs: r.ok ? r.jobs : [],
					loading: false
				})).catch(() => setPipeJobs({
					id: p.id,
					jobs: [],
					loading: false
				}));
			}
			function openJobLog(j) {
				if (!glServer || !glProject) return;
				setJobLog({
					jobId: j.id,
					name: j.name,
					loading: true
				});
				client.gitlabJobLog({
					baseUrl: glServer.baseUrl,
					token: glServer.token,
					projectPath: glProject.path,
					jobId: j.id
				}).then((r) => setJobLog({
					jobId: j.id,
					name: j.name,
					logs: r.ok ? r.logs : void 0,
					err: r.ok ? void 0 : r.message || t("logsFail"),
					jobUrl: r.jobUrl
				})).catch((e) => setJobLog({
					jobId: j.id,
					name: j.name,
					err: e.message || t("logsFail")
				}));
			}
			function toggleDepDetail(d) {
				setExpandedDep((v) => v === d.name ? null : d.name);
				setDepImgEdit(null);
			}
			function depPods(d) {
				return pods.filter((p) => p.name === d.name || p.name.startsWith(d.name + "-"));
			}
			async function handleSetImage() {
				if (!k8sKc || !depImgEdit) return;
				const image = depImgValue.trim();
				if (!image || image === depImgEdit.image) {
					setDepImgEdit(null);
					return;
				}
				setBusy(true);
				try {
					const r = await client.k8sSetImage({
						kubeconfigPath: k8sKc.path,
						context: k8sKc.context,
						namespace: k8sKc.namespace || "default",
						name: depImgEdit.name,
						image
					});
					if (r.ok) {
						setToast({
							msg: t("imageUpdated", {
								name: depImgEdit.name,
								image
							}),
							tone: "ok"
						});
						setDepImgEdit(null);
						fetchData(config);
					} else setToast({
						msg: r.message || t("imgFail"),
						tone: "err"
					});
				} catch (e) {
					setToast({
						msg: e.message || t("imgFail"),
						tone: "err"
					});
				} finally {
					setBusy(false);
				}
			}
			async function handleRestartDep() {
				if (!k8sKc || !depRestart) return;
				const name = depRestart;
				setBusy(true);
				try {
					const r = await client.k8sRestart({
						kubeconfigPath: k8sKc.path,
						context: k8sKc.context,
						namespace: k8sKc.namespace || "default",
						name
					});
					if (r.ok) {
						setToast({
							msg: t("restarting", { name }),
							tone: "ok"
						});
						setDepRestart(null);
						fetchData(config);
					} else setToast({
						msg: r.message || t("restartFail"),
						tone: "err"
					});
				} catch (e) {
					setToast({
						msg: e.message || t("restartFail"),
						tone: "err"
					});
				} finally {
					setBusy(false);
				}
			}
			async function handleViewPodLogs(pod) {
				if (!k8sKc) return;
				setPodLog({
					podName: pod.name,
					loading: true
				});
				try {
					const r = await client.k8sPodLogs({
						kubeconfigPath: k8sKc.path,
						context: k8sKc.context,
						namespace: k8sKc.namespace || "default",
						podName: pod.name,
						tailLines: 200
					});
					if (r.ok) setPodLog({
						podName: pod.name,
						logs: r.logs ?? ""
					});
					else setPodLog({
						podName: pod.name,
						err: r.message || t("logsFail")
					});
				} catch (e) {
					setPodLog({
						podName: pod.name,
						err: e.message || t("logsFail")
					});
				}
			}
			if (loading) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: {
					padding: 24,
					textAlign: "center",
					color: "#888",
					fontSize: 13
				},
				children: t("loading")
			});
			if (!config || !config.gitlab && !config.k8s) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					padding: 24,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: 12
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: { fontSize: 40 },
						children: "🖥️"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: DevopsUI_module_css_default.calloutInfo,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("notCfgBig") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: { marginTop: 8 },
							children: t("goCfgHint")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Btn, {
						onClick: () => window.dispatchEvent(new CustomEvent("dsh:open-settings", { detail: { section: "dsh-devops" } })),
						small: true,
						variant: "outline",
						children: t("goCfg")
					})
				]
			});
			const mrs = live?.mrs?.mergeRequests ?? [];
			const pipelines = live?.pipelines?.pipelines ?? [];
			const tags = live?.tags?.tags ?? [];
			const deployments = live?.deployments?.deployments ?? [];
			const pods = live?.pods?.pods ?? [];
			const events = live?.events?.events ?? [];
			const runningPips = pipelines.filter((p) => PIPELINE_RUNNING.includes(p.status)).length;
			const okPips = pipelines.filter((p) => p.status === "success").length;
			const failPips = pipelines.filter((p) => p.status === "failed").length;
			const pendingApproval = mrs.filter((m) => (m.approvalsBeforeMerge ?? 0) > 0).length;
			const depFail = deployments.filter((d) => d.replicas > 0 && d.ready === 0).length;
			const depProg = deployments.filter((d) => d.replicas > 0 && d.ready > 0 && d.ready < d.replicas).length;
			const crashPods = pods.filter((p) => p.restarts > 0).length;
			const pendPods = pods.filter((p) => p.phase === "Pending").length;
			const feed = [];
			mrs.forEach((mr) => feed.push({
				t: mr.updatedAt,
				icon: "🔄",
				tone: (mr.approvalsBeforeMerge ?? 0) > 0 ? "warn" : "ok",
				text: `!${mr.iid} ${mr.title} → ${mr.targetBranch}`,
				extra: (mr.approvalsBeforeMerge ?? 0) > 0 ? t("pending", { n: mr.approvalsBeforeMerge ?? 0 }) : mr.draft ? "Draft" : t("mergeable"),
				who: mr.author,
				ts: 0
			}));
			pipelines.forEach((p) => feed.push({
				t: p.updatedAt || p.createdAt,
				icon: p.status === "success" ? "✅" : p.status === "failed" ? "❌" : "⏳",
				tone: p.status === "failed" ? "err" : p.status === "success" ? "ok" : "warn",
				text: `pipeline ${p.ref} #${p.id} ${p.status}`,
				ts: 0
			}));
			deployments.forEach((d) => feed.push({
				t: d.updated,
				icon: "📦",
				tone: d.replicas > 0 && d.ready === d.replicas ? "ok" : d.ready === 0 ? "err" : "warn",
				text: `${d.name} ${d.ready}/${d.replicas} ready`,
				extra: d.imageTag,
				ts: 0
			}));
			pods.forEach((pod) => {
				if (pod.restarts > 0) feed.push({
					t: pod.startedAt,
					icon: "🔁",
					tone: "warn",
					text: `pod ${pod.name} ${t("restartsN", { n: pod.restarts })}`,
					extra: pod.reason,
					ts: 0
				});
			});
			events.forEach((ev) => feed.push({
				t: ev.time,
				icon: ev.type === "Warning" ? "⚠️" : "•",
				tone: ev.type === "Warning" ? "err" : "ok",
				text: `${ev.reason} ${ev.object}`,
				extra: ev.message,
				ts: 0
			}));
			feed.forEach((it) => {
				it.ts = it.t ? new Date(it.t).getTime() : 0;
			});
			feed.sort((a, b) => b.ts - a.ts);
			const activityItems = feed.slice(0, 30);
			const glServers = config?.gitlab?.servers ?? [];
			const kcList = config?.k8s?.kubeconfigs ?? [];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					padding: "12px 14px",
					display: "flex",
					flexDirection: "column",
					gap: 10
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SwitchCard, {
						icon: "📦",
						title: "GitLab",
						status: glServers.length === 0 ? "none" : connStatus.gl,
						t,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "grid",
								gridTemplateColumns: "minmax(120px, 160px) 1fr",
								gap: 8
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: DevopsUI_module_css_default.fieldLabel,
								children: t("server")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Select, {
								t,
								value: config.gitlab?.activeServerId ?? "",
								onChange: switchServer,
								disabled: glServers.length <= 1,
								compact: true,
								placeholder: glServers.length ? t("server") : t("notConfigured"),
								options: glServers.map((s) => ({
									value: s.id,
									label: s.label || s.baseUrl
								}))
							})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: DevopsUI_module_css_default.fieldLabel,
								children: t("project")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Select, {
								t,
								value: glServer?.projectPath ?? "",
								onChange: switchProject,
								disabled: !glServer?.baseUrl || !glServer?.token,
								compact: true,
								placeholder: !glServer?.baseUrl ? t("glNotCfg") : barOpts.projects.length ? t("selProject") : t("loadingProjects"),
								options: (() => {
									const opts = barOpts.projects.map((p) => ({
										value: p.path,
										label: p.path
									}));
									const cur = glServer?.projectPath;
									if (cur && !barOpts.projects.some((p) => p.path === cur)) opts.unshift({
										value: cur,
										label: cur
									});
									return opts;
								})()
							})] })]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SwitchCard, {
						icon: "☸️",
						title: "Kubernetes",
						status: kcList.length === 0 ? "none" : connStatus.k8s,
						t,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "grid",
								gridTemplateColumns: "minmax(120px, 160px) 1fr 1fr",
								gap: 8
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: DevopsUI_module_css_default.fieldLabel,
									children: t("configFile")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Select, {
									t,
									value: config.k8s?.activeKubeconfigId ?? "",
									onChange: switchKubeconfig,
									disabled: kcList.length <= 1,
									compact: true,
									placeholder: kcList.length ? t("configFile") : t("notConfigured"),
									options: kcList.map((k) => ({
										value: k.id,
										label: k.label || k.path
									}))
								})] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: DevopsUI_module_css_default.fieldLabel,
									children: "Context"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Select, {
									t,
									value: k8sKc?.context ?? "",
									onChange: switchContext,
									disabled: !k8sKc?.path,
									compact: true,
									placeholder: k8sKc?.path ? t("ctxPh") : t("notConfigured"),
									options: barOpts.contexts.length > 0 ? barOpts.contexts.map((c) => ({
										value: c.name,
										label: c.name
									})) : k8sKc?.context ? [{
										value: k8sKc.context,
										label: k8sKc.context
									}] : []
								})] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: DevopsUI_module_css_default.fieldLabel,
									children: "Namespace"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Select, {
									t,
									value: k8sKc?.namespace ?? "",
									onChange: switchNamespace,
									disabled: !k8sKc?.path,
									compact: true,
									placeholder: k8sKc?.path ? t("nsPh") : t("notConfigured"),
									options: (() => {
										const nsList = barOpts.namespaces.map((n) => ({
											value: n,
											label: n
										}));
										const cur = k8sKc?.namespace;
										if (cur && !barOpts.namespaces.includes(cur)) nsList.unshift({
											value: cur,
											label: cur
										});
										return nsList;
									})()
								})] })
							]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toast, { toast }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "grid",
							gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
							gap: 8
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatCard, {
								icon: "🔄",
								title: t("statMrsTitle"),
								value: glProject ? mrs.length : "—",
								sub: glProject ? t("statMrsSub", {
									p: pendingApproval,
									r: runningPips
								}) : t("notConfigured"),
								tone: !glProject ? "neutral" : pendingApproval > 0 ? "warn" : mrs.length ? "ok" : "neutral",
								subTone: pendingApproval > 0 ? "#fbbf24" : "#888"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatCard, {
								icon: "🔀",
								title: t("statPipsTitle"),
								value: glProject ? pipelines.length : "—",
								sub: glProject ? t("statPipSub", {
									r: runningPips,
									o: okPips,
									f: failPips
								}) : t("notConfigured"),
								tone: !glProject ? "neutral" : failPips > 0 ? "err" : runningPips > 0 ? "warn" : okPips > 0 ? "ok" : "neutral",
								subTone: failPips > 0 ? "#ff8a80" : "#888"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatCard, {
								icon: "📦",
								title: t("statDepsTitle"),
								value: k8sKc ? deployments.length : "—",
								sub: k8sKc ? t("statDepSub", {
									f: depFail,
									p: depProg
								}) : t("notConfigured"),
								tone: !k8sKc ? "neutral" : depFail > 0 ? "err" : depProg > 0 ? "warn" : deployments.length ? "ok" : "neutral",
								subTone: depFail > 0 ? "#ff8a80" : "#888"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatCard, {
								icon: "🐳",
								title: t("statPodsTitle"),
								value: k8sKc ? crashPods + pendPods : "—",
								sub: k8sKc ? t("statPodSub", {
									c: crashPods,
									p: pendPods
								}) : t("notConfigured"),
								tone: !k8sKc ? "neutral" : crashPods > 0 ? "err" : pendPods > 0 ? "warn" : pods.length ? "ok" : "neutral",
								subTone: crashPods > 0 ? "#ff8a80" : "#888"
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TabBar, {
						tabs: [
							{
								id: "gitlab",
								label: "GitLab"
							},
							{
								id: "k8s",
								label: "K8s"
							},
							{
								id: "activity",
								label: t("tabActivity")
							},
							{
								id: "logs",
								label: t("logs")
							}
						],
						active: activeTab,
						onChange: setActiveTab
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							maxHeight: 480,
							overflowY: "auto",
							display: "flex",
							flexDirection: "column",
							gap: 12
						},
						children: [
							activeTab === "gitlab" && (glServer ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									flexDirection: "column",
									gap: 12
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TabBar, {
										small: true,
										tabs: [
											{
												id: "mrs",
												label: t("secMrs"),
												badge: mrs.length
											},
											{
												id: "tags",
												label: t("secTags"),
												badge: tags.length
											},
											{
												id: "pipelines",
												label: t("statPipsTitle"),
												badge: pipelines.length
											}
										],
										active: gitlabSubTab,
										onChange: setGitlabSubTab
									}),
									gitlabSubTab === "mrs" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SecHeader, {
											icon: "🔄",
											title: t("secMrs"),
											badge: mrs.length,
											badgeTone: pendingApproval > 0 ? "warn" : "ok",
											onNew: () => setNewMrOpen((o) => !o),
											newLabel: t("newMrBtn")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Modal, {
											open: newMrOpen,
											title: t("newMrBtn"),
											onClose: () => setNewMrOpen(false),
											maxWidth: 620,
											footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Btn, {
												onClick: () => void handleNewMr(),
												small: true,
												tone: "success",
												disabled: busy,
												children: t("createMr")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Btn, {
												onClick: () => setNewMrOpen(false),
												small: true,
												variant: "outline",
												children: t("cancel")
											})] }),
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													style: {
														display: "grid",
														gridTemplateColumns: "1fr 1fr",
														gap: 8
													},
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														className: DevopsUI_module_css_default.fieldLabel,
														children: t("sourceBranch")
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Select, {
														value: mrSource,
														onChange: setMrSource,
														t,
														placeholder: formOpts.loading ? t("loadingBr") : t("selBranch"),
														options: [...mrSource && !formOpts.branches.some((b) => b.name === mrSource) ? [mrSource] : [], ...formOpts.branches.map((b) => ({
															value: b.name,
															label: b.isDefault ? b.name + t("defaultSuffix") : b.name
														}))]
													})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														className: DevopsUI_module_css_default.fieldLabel,
														children: t("targetBranch")
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Select, {
														value: mrTarget,
														onChange: setMrTarget,
														t,
														placeholder: formOpts.loading ? t("loadingBr") : t("selBranch"),
														options: [...mrTarget && !formOpts.branches.some((b) => b.name === mrTarget) ? [mrTarget] : [], ...formOpts.branches.map((b) => ({
															value: b.name,
															label: b.isDefault ? b.name + t("defaultSuffix") : b.name
														}))]
													})] })]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: DevopsUI_module_css_default.fieldLabel,
													children: t("titleLabel")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													ref: mrTitleRef,
													className: DevopsUI_module_css_default.input,
													placeholder: "feat: ..."
												})] }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														className: DevopsUI_module_css_default.fieldLabel,
														children: t("reviewersLabel")
													}),
													formOpts.members.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Select, {
														value: "",
														onChange: (username) => {
															if (!username) return;
															const cur = (mrReviewers || "").split(",").map((s) => s.trim()).filter(Boolean);
															if (!cur.includes(username)) cur.push(username);
															setMrReviewers(cur.join(", "));
														},
														t,
														placeholder: formOpts.loading ? t("loadingMem") : t("selReviewer"),
														options: formOpts.members.filter((m) => !(mrReviewers || "").split(",").map((x) => x.trim()).includes(m.username)).map((m) => ({
															value: m.username,
															label: `${m.username}（${m.name || m.username}）`
														}))
													}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														style: {
															fontSize: 11,
															color: "#666"
														},
														children: formOpts.loading ? t("loadingMem") : t("noMem")
													}),
													(mrReviewers || "").trim() && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														style: {
															display: "flex",
															flexWrap: "wrap",
															gap: 4,
															marginTop: 6
														},
														children: (mrReviewers || "").split(",").map((s) => s.trim()).filter(Boolean).map((u) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
															className: DevopsUI_module_css_default.reviewerChip,
															children: [u, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: DevopsUI_module_css_default.reviewerChipRemove,
																onClick: () => setMrReviewers((mrReviewers || "").split(",").map((x) => x.trim()).filter((x) => x && x !== u).join(", ")),
																children: "×"
															})]
														}, u))
													})
												] }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: DevopsUI_module_css_default.fieldLabel,
													children: t("descLabel")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
													ref: mrDescRef,
													className: DevopsUI_module_css_default.input,
													style: {
														resize: "vertical",
														minHeight: 54
													},
													placeholder: t("descPh")
												})] })
											]
										}),
										mrs.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyHint, { children: t("noMrs") }) : mrs.map((mr) => {
											const ms = mr.mergeStatus || "unchecked";
											const dotTone = ms === "can_be_merged" ? "ok" : ms === "cannot_be_merged" ? "err" : "warn";
											return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: DevopsUI_module_css_default.rowItem,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Dot, { tone: dotTone }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														style: {
															flex: 1,
															minWidth: 0
														},
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
															style: {
																display: "flex",
																alignItems: "center",
																gap: 6,
																flexWrap: "wrap"
															},
															children: [
																/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																	style: { fontWeight: 600 },
																	children: ["!", mr.iid]
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	style: {
																		overflow: "hidden",
																		textOverflow: "ellipsis",
																		whiteSpace: "nowrap"
																	},
																	children: mr.title
																}),
																mr.draft || mr.workInProgress ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
																	tone: "accent",
																	children: mr.draft ? "Draft" : "WIP"
																}) : null,
																(mr.approvalsBeforeMerge ?? 0) > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
																	tone: "warn",
																	children: t("pending", { n: mr.approvalsBeforeMerge ?? 0 })
																}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
																	tone: "ok",
																	children: t("mergeable")
																})
															]
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
															style: {
																color: "#888",
																fontSize: 11,
																marginTop: 2
															},
															children: `${mr.sourceBranch} → ${mr.targetBranch} · ${mr.author} · ${timeAgo(mr.updatedAt, t)}`
														})]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														style: {
															display: "flex",
															gap: 5,
															flexShrink: 0
														},
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChipBtn, {
																tone: "primary",
																disabled: busy,
																onClick: () => void handleApprove(mr),
																children: t("approve")
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChipBtn, {
																tone: "danger",
																disabled: busy,
																onClick: () => void handleMrClose(mr),
																children: t("close")
															}),
															mr.webUrl ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChipBtn, {
																title: t("openInGl"),
																onClick: () => window.open(mr.webUrl, "_blank"),
																children: "↗"
															}) : null
														]
													})
												]
											}, mr.iid);
										})
									] }),
									gitlabSubTab === "tags" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SecHeader, {
											icon: "🏷️",
											title: t("secTags"),
											badge: tags.length,
											onNew: () => setNewTagOpen((o) => !o),
											newLabel: t("newTagBtn")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Modal, {
											open: newTagOpen,
											title: t("newTagBtn"),
											onClose: () => setNewTagOpen(false),
											maxWidth: 620,
											footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Btn, {
												onClick: () => void handleNewTag(),
												small: true,
												tone: "success",
												disabled: busy,
												children: t("createTag")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Btn, {
												onClick: () => setNewTagOpen(false),
												small: true,
												variant: "outline",
												children: t("cancel")
											})] }),
											children: [
												tags.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: DevopsUI_module_css_default.fieldLabel,
													children: t("histTag")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Select, {
													value: "",
													onChange: pickHistoryTag,
													t,
													placeholder: t("pickHist"),
													options: tags.map((tg) => ({
														value: tg.name,
														label: `${tg.name} → ${bumpPatch(tg.name)} · ${timeAgo(tg.createdAt, t)}`
													}))
												})] }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													style: {
														display: "grid",
														gridTemplateColumns: "1fr 1fr",
														gap: 8
													},
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
															className: DevopsUI_module_css_default.fieldLabel,
															children: t("tagNameLabel")
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
															ref: tagNameRef,
															className: DevopsUI_module_css_default.input,
															placeholder: "v1.2.0",
															list: "dsh-devops-tag-names"
														}),
														tags.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("datalist", {
															id: "dsh-devops-tag-names",
															children: tags.map((tg) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { value: tg.name }, tg.name))
														}) : null
													] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														className: DevopsUI_module_css_default.fieldLabel,
														children: t("refLabel")
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Select, {
														value: tagRefSel,
														onChange: setTagRefSel,
														t,
														placeholder: formOpts.loading ? t("loadingShort") : t("selRef"),
														options: [
															...tagRefSel && !formOpts.branches.some((b) => b.name === tagRefSel) && !tags.some((tg) => tg.name === tagRefSel) ? [tagRefSel] : [],
															...formOpts.branches.map((b) => ({
																value: b.name,
																label: `⑂ ${b.name}${b.isDefault ? t("defaultSuffix") : ""}`
															})),
															...tags.map((tg) => ({
																value: tg.name,
																label: `🏷 ${tg.name}`
															}))
														]
													})] })]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: DevopsUI_module_css_default.fieldLabel,
													children: t("msgLabel")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													ref: tagMsgRef,
													className: DevopsUI_module_css_default.input,
													placeholder: t("releasePh")
												})] })
											]
										}),
										tags.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyHint, { children: t("noTags") }) : tags.slice(0, 6).map((tg) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: DevopsUI_module_css_default.insetRow,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "🏷️" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: {
														fontWeight: 600,
														fontFamily: "monospace"
													},
													children: tg.name
												}),
												tg.message ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: {
														color: "#888",
														flex: 1,
														overflow: "hidden",
														textOverflow: "ellipsis",
														whiteSpace: "nowrap"
													},
													children: tg.message
												}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: {
														color: "#666",
														fontSize: 11
													},
													children: timeAgo(tg.createdAt, t)
												})
											]
										}, tg.name))
									] }),
									gitlabSubTab === "pipelines" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SecHeader, {
										icon: "🔀",
										title: t("statPipsTitle"),
										badge: pipelines.length,
										badgeTone: failPips > 0 ? "err" : runningPips > 0 ? "warn" : "neutral"
									}), pipelines.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyHint, { children: t("noPips") }) : pipelines.map((p) => {
										const run = PIPELINE_RUNNING.includes(p.status);
										const dot = p.status === "success" ? "ok" : p.status === "failed" ? "err" : run ? "warn" : "neutral";
										const open = expandedPipe === p.id;
										return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											style: {
												display: "flex",
												flexDirection: "column",
												gap: 4
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: DevopsUI_module_css_default.insetRow,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														onClick: () => togglePipeDetail(p),
														style: {
															cursor: "pointer",
															color: "#888",
															fontSize: 10,
															width: 14,
															textAlign: "center",
															flexShrink: 0
														},
														children: open ? "▾" : "▸"
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Dot, {
														tone: dot,
														pulse: run
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
														style: {
															fontWeight: 600,
															cursor: "pointer"
														},
														onClick: () => togglePipeDetail(p),
														children: ["#", p.id]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														style: { color: "#ccc" },
														children: p.ref
													}),
													p.sha ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														style: {
															color: "#666",
															fontFamily: "monospace",
															fontSize: 11
														},
														children: p.sha
													}) : null,
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														style: {
															color: "#888",
															fontSize: 11
														},
														children: timeAgo(p.updatedAt || p.createdAt, t)
													}),
													run ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChipBtn, {
														tone: "danger",
														disabled: busy,
														onClick: () => void handlePipelineAction(p, "cancel"),
														children: t("cancel")
													}) : null,
													p.status === "failed" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChipBtn, {
														tone: "primary",
														disabled: busy,
														onClick: () => void handlePipelineAction(p, "retry"),
														children: t("retry")
													}) : null
												]
											}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												style: {
													padding: "4px 10px 6px 28px",
													display: "flex",
													flexDirection: "column",
													gap: 3
												},
												children: pipeJobs.id === p.id && pipeJobs.loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													style: {
														color: "#555",
														fontSize: 11
													},
													children: t("loadingJobs")
												}) : (pipeJobs.id === p.id ? pipeJobs.jobs : []).length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													style: {
														color: "#555",
														fontSize: 11
													},
													children: t("noJobs")
												}) : (pipeJobs.id === p.id ? pipeJobs.jobs : []).map((j) => {
													const jdot = j.status === "success" ? "ok" : j.status === "failed" ? "err" : [
														"created",
														"pending",
														"running",
														"queued",
														"scheduled",
														"waiting_for_resource",
														"preparing"
													].includes(j.status) ? "warn" : "neutral";
													return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														style: {
															display: "flex",
															alignItems: "center",
															gap: 8,
															fontSize: 11,
															color: "#ccc",
															padding: "3px 8px",
															borderRadius: 4,
															background: "rgba(255,255,255,0.03)"
														},
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Dot, {
																tone: jdot,
																pulse: jdot === "warn"
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																style: { fontWeight: 500 },
																children: j.name
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																style: { color: "#666" },
																children: j.stage
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																style: { color: "#888" },
																children: j.status
															}),
															j.failureReason ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																style: { color: "#ff8a80" },
																children: j.failureReason
															}) : null,
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
															j.duration != null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																style: {
																	color: "#666",
																	fontSize: 10
																},
																children: `${Math.round(j.duration)}s`
															}) : null,
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChipBtn, {
																tone: "ghost",
																onClick: () => openJobLog(j),
																children: t("openJobLog")
															})
														]
													}, j.id);
												})
											})]
										}, p.id);
									})] })
								]
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyHint, { children: t("glNotCfg2") })),
							activeTab === "k8s" && (k8sKc ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									flexDirection: "column",
									gap: 12
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TabBar, {
										small: true,
										tabs: [{
											id: "deployments",
											label: t("statDepsTitle"),
											badge: deployments.length
										}, {
											id: "events",
											label: t("secEvents"),
											badge: events.length
										}],
										active: k8sSubTab,
										onChange: setK8sSubTab
									}),
									k8sSubTab === "deployments" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SecHeader, {
										icon: "📦",
										title: t("statDepsTitle"),
										badge: deployments.length,
										badgeTone: depFail > 0 ? "err" : depProg > 0 ? "warn" : "ok"
									}), deployments.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyHint, { children: t("noDeps") }) : deployments.map((d) => {
										const st = d.replicas > 0 && d.ready === d.replicas ? "ok" : d.ready === 0 ? "err" : "warn";
										const open = expandedDep === d.name;
										const depPodList = depPods(d);
										return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											style: {
												display: "flex",
												flexDirection: "column",
												gap: 4
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: DevopsUI_module_css_default.insetRow,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														onClick: () => toggleDepDetail(d),
														style: {
															cursor: "pointer",
															color: "#888",
															fontSize: 10,
															width: 14,
															textAlign: "center",
															flexShrink: 0
														},
														children: open ? "▾" : "▸"
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Dot, { tone: st }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														style: {
															flex: 1,
															minWidth: 0,
															cursor: "pointer"
														},
														onClick: () => toggleDepDetail(d),
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
															style: {
																fontFamily: "monospace",
																fontWeight: 500,
																overflow: "hidden",
																textOverflow: "ellipsis",
																whiteSpace: "nowrap"
															},
															children: d.name
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
															style: {
																color: "#888",
																fontSize: 11
															},
															children: `${d.ready}/${d.replicas} ${t("ready")} · ${d.imageTag || "—"} · ${timeAgo(d.updated, t)}`
														})]
													}),
													st === "ok" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
														tone: "ok",
														children: t("runningBadge")
													}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
														tone: st,
														children: t("issueN", { n: d.replicas - d.ready })
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChipBtn, {
														tone: "ghost",
														disabled: busy,
														onClick: () => {
															setDepImgValue(d.image || "");
															setDepImgEdit({
																name: d.name,
																image: d.image || ""
															});
														},
														children: t("setImage")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChipBtn, {
														tone: "ghost",
														disabled: busy,
														onClick: () => setDepRestart(d.name),
														children: t("restart")
													})
												]
											}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												style: {
													padding: "2px 10px 6px 28px",
													display: "flex",
													flexDirection: "column",
													gap: 3
												},
												children: depPodList.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													style: {
														color: "#555",
														fontSize: 11
													},
													children: t("noPods")
												}) : depPodList.map((pod) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													style: {
														display: "flex",
														alignItems: "center",
														gap: 8,
														fontSize: 11,
														color: "#ccc",
														padding: "3px 8px",
														borderRadius: 4,
														background: "rgba(255,255,255,0.03)"
													},
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Dot, { tone: pod.phase === "Running" ? "ok" : pod.phase === "Pending" ? "warn" : "err" }),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															style: {
																fontFamily: "monospace",
																overflow: "hidden",
																textOverflow: "ellipsis",
																whiteSpace: "nowrap"
															},
															children: pod.name
														}),
														pod.reason || pod.restarts > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															style: { color: "#888" },
															children: `${pod.restarts > 0 ? t("restartsN", { n: pod.restarts }) + " · " : ""}${pod.reason || ""}`
														}) : null,
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
														pod.restarts > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
															tone: "warn",
															children: `${pod.restarts}r`
														}) : null,
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChipBtn, {
															tone: "ghost",
															onClick: () => void handleViewPodLogs(pod),
															children: t("logs")
														})
													]
												}, pod.name))
											})]
										}, d.name);
									})] }),
									k8sSubTab === "events" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SecHeader, {
										icon: "📝",
										title: t("secEvents"),
										badge: events.length
									}), events.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyHint, { children: t("noEvents") }) : events.slice(0, 12).map((ev, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										style: {
											padding: "6px 10px",
											borderRadius: 6,
											background: "var(--ds-alias-surface-inset,#1a1a1a)",
											fontSize: 12
										},
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: {
													display: "flex",
													alignItems: "center",
													gap: 6,
													marginBottom: 2
												},
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														style: {
															color: ev.type === "Warning" ? "#ff8a80" : "#34c759",
															fontSize: 11,
															fontWeight: 600
														},
														children: ev.type === "Warning" ? "⚠" : "•"
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														style: {
															color: "#888",
															fontSize: 11
														},
														children: ev.reason
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														style: {
															color: "#666",
															fontSize: 10
														},
														children: timeAgo(ev.time, t)
													})
												]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												style: {
													color: "#ccc",
													lineHeight: 1.4,
													wordBreak: "break-word"
												},
												children: ev.message
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												style: {
													color: "#666",
													fontSize: 10,
													marginTop: 2
												},
												children: `${ev.kind} / ${ev.object}`
											})
										]
									}, i))] })
								]
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyHint, { children: t("k8sNotCfg2") })),
							activeTab === "activity" && (activityItems.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyHint, { children: t("noActivity") }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									display: "flex",
									flexDirection: "column",
									gap: 4
								},
								children: activityItems.map((it, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: DevopsUI_module_css_default.rowItem,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: {
												fontSize: 12,
												flexShrink: 0
											},
											children: it.icon
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											style: {
												flex: 1,
												minWidth: 0
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: {
													display: "flex",
													alignItems: "center",
													gap: 6
												},
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: {
														color: "#ddd",
														fontSize: 12,
														overflow: "hidden",
														textOverflow: "ellipsis",
														whiteSpace: "nowrap"
													},
													children: it.text
												}), it.extra ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
													tone: it.tone,
													children: it.extra
												}) : null]
											}), it.who ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												style: {
													color: "#888",
													fontSize: 11,
													marginTop: 1
												},
												children: it.who
											}) : null]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: {
												color: "#666",
												fontSize: 10,
												flexShrink: 0
											},
											children: timeAgo(it.t, t)
										})
									]
								}, i))
							})),
							activeTab === "logs" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									flexDirection: "column",
									gap: 6,
									minHeight: 200
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: {
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center"
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: {
											fontSize: 11,
											color: "#888"
										},
										children: t("logsLast", { n: (logsData ?? []).length })
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Btn, {
										onClick: () => {
											(async () => {
												try {
													const r = await client.logs({ lines: 200 });
													if (r.ok) setLogsData(r.lines ?? []);
												} catch {}
											})();
										},
										small: true,
										variant: "outline",
										children: t("refresh")
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									style: {
										minHeight: 200,
										maxHeight: 400,
										overflow: "auto",
										background: "#0d0d0d",
										borderRadius: 8,
										padding: "10px 12px",
										fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace",
										fontSize: 11,
										lineHeight: 1.6
									},
									children: (logsData ?? []).length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										style: {
											color: "#555",
											textAlign: "center",
											padding: 20
										},
										children: t("noLogsText")
									}) : logsData.map((line, i) => {
										const isError = line.includes("[ERROR]");
										const isWarn = line.includes("[WARN]");
										const cls = isError ? DevopsUI_module_css_default.logLineError : isWarn ? DevopsUI_module_css_default.logLineWarn : DevopsUI_module_css_default.logLineInfo;
										return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: cls,
											style: {
												whiteSpace: "pre-wrap",
												wordBreak: "break-all"
											},
											children: line
										}, i);
									})
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Modal, {
						open: depImgEdit != null,
						title: `${t("setImage")} · ${depImgEdit?.name ?? ""}`,
						onClose: () => setDepImgEdit(null),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Btn, {
							onClick: () => void handleSetImage(),
							small: true,
							tone: "success",
							disabled: busy,
							children: t("apply")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Btn, {
							onClick: () => setDepImgEdit(null),
							small: true,
							variant: "outline",
							children: t("cancel")
						})] }),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: DevopsUI_module_css_default.fieldLabel,
							children: t("currentImage")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								fontFamily: "monospace",
								fontSize: 12,
								color: "#ccc",
								padding: "6px 8px",
								borderRadius: 6,
								background: "var(--ds-alias-surface-inset,#1a1a1a)"
							},
							children: depImgEdit?.image || "—"
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: DevopsUI_module_css_default.fieldLabel,
							children: t("newImage")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: DevopsUI_module_css_default.input,
							style: {
								fontFamily: "monospace",
								fontSize: 12
							},
							placeholder: "nginx:1.27",
							value: depImgValue,
							onChange: (e) => setDepImgValue(e.target.value),
							onKeyDown: (e) => {
								if (e.key === "Enter") handleSetImage();
							}
						})] })]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal, {
						open: depRestart != null,
						title: `${t("restart")} · ${depRestart ?? ""}`,
						onClose: () => setDepRestart(null),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Btn, {
							onClick: () => void handleRestartDep(),
							small: true,
							tone: "success",
							disabled: busy,
							children: t("confirmRestart")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Btn, {
							onClick: () => setDepRestart(null),
							small: true,
							variant: "outline",
							children: t("cancel")
						})] }),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								fontSize: 13,
								color: "#ccc",
								lineHeight: 1.6
							},
							children: t("restartBody", { name: depRestart ?? "" })
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal, {
						open: jobLog != null,
						title: `▤ ${jobLog?.name ?? ""} (#${jobLog?.jobId ?? ""})`,
						onClose: () => setJobLog(null),
						maxWidth: 860,
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [jobLog?.jobUrl ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Btn, {
							onClick: () => jobLog && window.open(jobLog.jobUrl, "_blank"),
							small: true,
							variant: "outline",
							children: t("openInGitlab")
						}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Btn, {
							onClick: () => setJobLog(null),
							small: true,
							variant: "outline",
							children: t("close")
						})] }),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: DevopsUI_module_css_default.logPanel,
							style: { maxHeight: 420 },
							children: jobLog?.loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: { color: "#555" },
								children: t("loadingLogs")
							}) : jobLog?.err ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									color: "#ff8a80",
									whiteSpace: "pre-wrap",
									wordBreak: "break-all"
								},
								children: jobLog.err
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									color: "#8f8",
									whiteSpace: "pre-wrap",
									wordBreak: "break-all"
								},
								children: jobLog?.logs || t("noLogs")
							})
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal, {
						open: podLog != null,
						title: `▤ ${podLog?.podName ?? ""}`,
						onClose: () => setPodLog(null),
						maxWidth: 860,
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Btn, {
							onClick: () => setPodLog(null),
							small: true,
							variant: "outline",
							children: t("close")
						}),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: DevopsUI_module_css_default.logPanel,
							style: { maxHeight: 420 },
							children: podLog?.loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: { color: "#555" },
								children: t("loadingLogs")
							}) : podLog?.err ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									color: "#ff8a80",
									whiteSpace: "pre-wrap",
									wordBreak: "break-all"
								},
								children: podLog.err
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									color: "#8f8",
									whiteSpace: "pre-wrap",
									wordBreak: "break-all"
								},
								children: podLog?.logs || t("noLogs")
							})
						})
					})
				]
			});
		}
		//#endregion
		//#region src/client/index.ts
		/**
		* dsh-devops web console entry — loaded by the DSH client ModuleLoader.
		*
		* Exports the DSH client contract: `inject` (services to mount on ctx) and
		* `apply` (slot registrations). The bundle is wrapped by tsdown into
		* `window.__ModuleLoader__.load({ id, factory })`.
		*
		* Slot registration follows the declarative pattern: `ctx.slots.inject(name,
		* setup)` declares participation in a slot and runs `setup` (which registers
		* the component) only once the parent slot exists — registering directly into
		* an undeclared slot throws.
		*/
		const inject = [
			"slots",
			"locale",
			"connection"
		];
		function apply(ctx) {
			ctx.locale.register("dsh-devops", "zh", ZH);
			ctx.locale.register("dsh-devops", "en", EN);
			const translate = ctx.locale.bind("dsh-devops");
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "dsh-devops",
				order: 100,
				label: "DevOps",
				inject: () => ({
					connection: ctx.connection,
					locale: ctx.locale,
					t: translate
				})
			}, DevopsSettings));
			ctx.slots.inject("conversation.view", () => ctx.slots.register({
				name: "conversation.view",
				id: "devops",
				order: 50,
				label: () => "DevOps",
				inject: () => ({
					connection: ctx.connection,
					locale: ctx.locale,
					t: translate
				})
			}, DevopsDashboard));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
