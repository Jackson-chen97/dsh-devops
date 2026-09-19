window.__ModuleLoader__.load({
  id: "@jacksonchen/dsh-devops",
  factory: (require) => {
    const React = require("react");
    const h = React.createElement;
    const { useState, useCallback, useRef, useEffect } = React;

    // ─── API helper ───────────────────────────────────────────────────────────────

    async function apiCall(method, body) {
      const res = await fetch(`/devops/api/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.json();
    }

    // ─── Shared styles ────────────────────────────────────────────────────────────

    const S = {
      section: { marginBottom: 24, border: "1px solid var(--ds-alias-border, #2a2a2a)", borderRadius: 8, padding: 16 },
      sectionTitle: { display: "flex", alignItems: "center", gap: 8, marginBottom: 14 },
      label: { display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4, color: "var(--ds-alias-foreground-secondary, #888)" },
      input: {
        width: "100%", padding: "8px 10px", fontSize: 14,
        border: "1px solid var(--ds-alias-border, #333)", borderRadius: 6,
        background: "var(--ds-alias-input-bg, #1a1a1a)", color: "var(--ds-alias-foreground, #eee)",
        boxSizing: "border-box", outline: "none",
      },
      select: {
        width: "100%", padding: "8px 10px", fontSize: 14,
        border: "1px solid var(--ds-alias-border, #333)", borderRadius: 6,
        background: "var(--ds-alias-input-bg, #1a1a1a)", color: "var(--ds-alias-foreground, #eee)",
        boxSizing: "border-box", outline: "none",
      },
      row: { display: "flex", alignItems: "flex-start", gap: 12 },
      rowEnd: { display: "flex", alignItems: "center", gap: 12 },
      fieldGap: { display: "flex", flexDirection: "column", gap: 12 },
      hint: { fontSize: 12, color: "#888", marginTop: 4 },
      callout: {
        padding: "12px 16px", borderRadius: 8, fontSize: 13, lineHeight: 1.5,
        background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)",
        color: "var(--ds-alias-foreground, #eee)",
      },
      calloutInfo: {
        padding: "12px 16px", borderRadius: 8, fontSize: 13, lineHeight: 1.5,
        background: "rgba(74,158,255,0.1)", border: "1px solid rgba(74,158,255,0.3)",
        color: "var(--ds-alias-foreground, #eee)",
      },
    };

    const BTN = {
      primary: { background: "var(--ds-alias-primary, #4a9eff)", color: "#fff" },
      secondary: { background: "transparent", color: "var(--ds-alias-foreground, #eee)", border: "1px solid var(--ds-alias-border, #555)" },
      success: { background: "#34c759", color: "#fff" },
    };

    // ─── i18n（zh / en）────────────────────────────────────────────────────────────

    const I18N_EN = {
      select: "Select...", testConn: "Test connection", restored: "Restored saved config", restoreFail: "Failed to restore project list",
      k8sFail: "K8s connection failed", fillGl: "Please fill in Base URL and Token", connecting: "Connecting...",
      fillKc: "Please fill in the kubeconfig path", completeOne: "Complete at least one service config",
      saved: "Config saved", saveFailed: "Save failed", notCfgYet: "⚠️ DevOps services not configured",
      fillGlOrK8s: "Fill in your GitLab or Kubernetes connection info and save.",
      connected: "Connected", connectFailed: "Failed", glServers: "GitLab servers",
      unnamed: "Unnamed", noUrl: "No URL", noPath: "No path", editing: "Editing",
      addServer: "+ Add server", addKc: "+ Add config file", name: "Name",
      nameGlPh: "e.g. Company GitLab", nameK8sPh: "e.g. Production cluster",
      project: "Project", refresh: "Refresh", testGlFirst: "Test the GitLab connection first",
      searchProjPh: "Search projects...", search: "Search", testFirst: "Test connection first",
      loading: "Loading...", noProjects: "No projects", selProject: "Select project...",
      branch: "Branch", selProjFirst: "Select a project first", searchBrPh: "Search branches...",
      loadingBr: "Loading branches...", noBranches: "No branches", selBranch: "Select branch...",
      brFail: "Failed to fetch branches", delGl: "🗑 Delete this GitLab config",
      kcConfig: "Kubeconfig configs", kcPath: "Kubeconfig path", browse: "Browse...",
      testK8sFirst: "Test the K8s connection first", selCtx: "Select context...",
      selCtxFirst: "Select a context first", loadingNs: "Loading...", noNs: "No namespaces in cluster",
      selNs: "Pick from cluster...", manualNs: "or type a namespace",
      nsHint: "Auto from kubeconfig context / pick from cluster dropdown / manual input (when listing is not permitted)",
      delK8s: "🗑 Delete this K8s config", saveConfig: "Save config",
      justNow: "just now", minAgo: "{n} min ago", hourAgo: "{n} h ago", dayAgo: "{n} d ago",
      detecting: "Checking...", notConfigured: "Not configured", server: "Server", configFile: "Config file",
      glNotCfg: "GitLab not configured", loadingProjects: "Loading projects...", ctxPh: "context...", nsPh: "namespace...",
      logs: "Logs", noMrs: "No open MRs", pending: "{n} pending", mergeable: "✓ Mergeable",
      openInGl: "Open in GitLab", descPh: "Describe the changes...", createMr: "✓ Create MR", cancel: "Cancel",
      noTags: "No tags", pickHist: "Pick a tag to prefill...", selRef: "Select ref...",
      releasePh: "Release notes", createTag: "✓ Create Tag", noPips: "No pipelines",
      loadingJobs: "Loading jobs...", noJobs: "No jobs", noDeps: "No deployments",
      setImage: "Image", restart: "Restart", apply: "✓ Apply", noPods: "No running pods",
      close: "Close", loadingLogs: "Loading logs...", noLogs: "(no logs)", noEvents: "No events",
      noActivity: "No activity", noLogsText: "No logs", glNotCfg2: "GitLab not configured",
      k8sNotCfg2: "K8s not configured", loadingShort: "Loading...", notCfgBig: "DevOps services not configured",
      goCfgHint: "Go to Settings → DevOps to finish the GitLab / K8s setup.", goCfg: "Configure",
      fillMr: "Fill in Source / Target / Title", mrFail: "Failed to create MR", createFail: "Creation failed",
      fillTag: "Fill in Tag Name / Ref", tagFail: "Failed to create tag", approveFail: "Approval failed",
      actionFail: "Action failed", closeFail: "Failed to close", imgFail: "Failed to set image",
      restartFail: "Restart failed", logsFail: "Failed to fetch logs", k8sCfg: "K8s config",
      loadingMem: "Loading members...", noMem: "No members available", selReviewer: "+ Add reviewer...",
      histTag: "Quick create from history (auto-bumps the version into Tag Name)",
      refLabel: "Ref (branch or existing tag)",
      reviewersLabel: "Reviewers (multi-select from project members)",
      sourceBranch: "Source branch", targetBranch: "Target branch",
      statMrsTitle: "Open MRs", statPipsTitle: "Pipelines", statDepsTitle: "Deployments", statPodsTitle: "Unhealthy Pods",
      secMrs: "Merge Requests", secTags: "Tags", secPips: "Pipelines", secDeps: "Deployments", secEvents: "Recent Events",
      tabActivity: "Activity", newBtn: "+ New", newMrBtn: "+ New MR", newTagBtn: "+ New Tag",
      approve: "✓ Approve", retry: "Retry", runningBadge: "Running", issueN: "{n} issue", ready: "ready",
      titleLabel: "Title", descLabel: "Description", msgLabel: "Message", tagNameLabel: "Tag Name",
      serverLabel: "Server", projectLabel: "Project", configFileLabel: "Config file",
      statMrsSub: "{p} pending · {r} pipeline(s) running", statPipSub: "{r} running · {o} ok · {f} failed",
      statDepSub: "{f} failure · {p} progressing", statPodSub: "{c} crash · {p} pending",
      defaultSuffix: " (default)", tabActivity: "Activity", logsLast: "~/.dsh-devops/devops.log · last {n} lines",
      mrCreated: "MR !{iid} created", tagCreated: "Tag {name} created", approved: "Approved !{iid}",
      remaining: " · {n} left", pipAction: "Pipeline #{id} {action}", mrClosed: "MR !{iid} closed",
      imageUpdated: "{name} image updated to {image}, rolling out...", restarting: "Restarting {name} (rolling rebuild)",
      pipCanceled: "cancelled", pipRetried: "retried", restartsN: "{n} restarts",
      autoTitleSuffix: " ({s} → {t})", descHead: "## Changes", descCommit: "## Latest commit",
      descSource: "## Source", descBranch: "- Branch: `{s}` → `{t}`", editingWhat: "Edit: {name}",
    };
    // 中文即源文案
    const I18N_ZH = {
      select: "选择...", testConn: "测试连接", restored: "已恢复已保存的配置", restoreFail: "恢复项目列表失败",
      k8sFail: "K8s 连接失败", fillGl: "请填写 Base URL 和 Token", connecting: "连接中...",
      fillKc: "请填写 kubeconfig 路径", completeOne: "请至少完成一个服务的配置",
      saved: "配置已保存", saveFailed: "保存失败", notCfgYet: "⚠️ 尚未配置 DevOps 服务",
      fillGlOrK8s: "请填写 GitLab 或 Kubernetes 连接信息后保存。",
      connected: "已连接", connectFailed: "连接失败", glServers: "GitLab 服务器",
      unnamed: "未命名", noUrl: "未填写 URL", noPath: "未填写路径", editing: "编辑中",
      addServer: "+ 添加服务器", addKc: "+ 添加配置文件", name: "名称",
      nameGlPh: "如：公司内网 GitLab", nameK8sPh: "如：生产集群",
      project: "项目", refresh: "刷新", testGlFirst: "请先测试连接 GitLab",
      searchProjPh: "搜索项目...", search: "搜索", testFirst: "请先测试连接",
      loading: "加载中...", noProjects: "暂无项目", selProject: "选择项目...",
      branch: "分支", selProjFirst: "请先选择项目", searchBrPh: "搜索分支...",
      loadingBr: "正在加载分支...", noBranches: "暂无分支", selBranch: "选择分支...",
      brFail: "获取分支失败", delGl: "🗑 删除这套 GitLab 配置",
      kcConfig: "Kubeconfig 配置", kcPath: "Kubeconfig 路径", browse: "浏览...",
      testK8sFirst: "请先测试连接 K8s", selCtx: "选择 context...",
      selCtxFirst: "请先选择 Context", loadingNs: "正在加载...", noNs: "集群中无 namespace",
      selNs: "从集群选择...", manualNs: "或手动输入 namespace",
      nsHint: "自动取自 kubeconfig 上下文 / 从集群下拉选择 / 手动输入（无列表权限时）",
      delK8s: "🗑 删除这套 K8s 配置", saveConfig: "保存配置",
      justNow: "刚刚", minAgo: "{n} 分钟前", hourAgo: "{n} 小时前", dayAgo: "{n} 天前",
      detecting: "检测中...", notConfigured: "未配置", server: "服务器", configFile: "配置文件",
      glNotCfg: "未配置 GitLab", loadingProjects: "加载项目列表...", ctxPh: "context...", nsPh: "namespace...",
      logs: "日志", noMrs: "暂无 Open MR", pending: "{n} 待审批", mergeable: "✓ 可合并",
      openInGl: "在 GitLab 打开", descPh: "变更说明...", createMr: "✓ 创建 MR", cancel: "取消",
      noTags: "暂无 Tag", pickHist: "选择历史 Tag，快速填充...", selRef: "选择 ref...",
      releasePh: "发布说明", createTag: "✓ 创建 Tag", noPips: "暂无 Pipeline 数据",
      loadingJobs: "加载 jobs...", noJobs: "无 job 数据", noDeps: "暂无 Deployment",
      setImage: "换镜像", restart: "重启", apply: "✓ 应用", noPods: "无运行中的 Pod",
      close: "关闭", loadingLogs: "加载日志中...", noLogs: "(无日志)", noEvents: "暂无事件",
      noActivity: "暂无动态", noLogsText: "暂无日志", glNotCfg2: "GitLab 未配置",
      k8sNotCfg2: "K8s 未配置", loadingShort: "加载...", notCfgBig: "未配置 DevOps 服务",
      goCfgHint: "请前往 设置 → DevOps 完成 GitLab / K8s 配置。", goCfg: "去配置",
      fillMr: "请至少填写 Source / Target / Title", mrFail: "创建 MR 失败", createFail: "创建失败",
      fillTag: "请至少填写 Tag Name / Ref", tagFail: "创建 Tag 失败", approveFail: "审批失败",
      actionFail: "操作失败", closeFail: "关闭失败", imgFail: "更换镜像失败",
      restartFail: "重启失败", logsFail: "获取日志失败", k8sCfg: "K8s 配置",
      loadingMem: "成员加载中...", noMem: "无可选成员", selReviewer: "+ 选择 Reviewer...",
      histTag: "从历史 Tag 快速创建（自动生成新版本号填入 Tag Name）",
      refLabel: "Ref（分支或已有 Tag）",
      reviewersLabel: "Reviewers（从项目成员下拉选择，可多选）",
      sourceBranch: "源分支", targetBranch: "目标分支",
      statMrsTitle: "开放 MR", statPipsTitle: "流水线", statDepsTitle: "部署", statPodsTitle: "异常 Pod",
      secMrs: "合并请求", secTags: "标签", secPips: "流水线", secDeps: "部署", secEvents: "最近事件",
      tabActivity: "动态", newBtn: "+ 新建", newMrBtn: "+ 新建 MR", newTagBtn: "+ 新建 Tag",
      approve: "✓ 审批", retry: "重试", runningBadge: "运行中", issueN: "{n} 异常", ready: "就绪",
      titleLabel: "标题", descLabel: "描述", msgLabel: "说明", tagNameLabel: "Tag 名称",
      serverLabel: "服务器", projectLabel: "项目", configFileLabel: "配置文件",
      statMrsSub: "{p} 待审批 · {r} pipeline 运行中", statPipSub: "{r} running · {o} ok · {f} failed",
      statDepSub: "{f} failure · {p} progressing", statPodSub: "{c} crash · {p} pending",
      defaultSuffix: "（默认）", logsLast: "~/.dsh-devops/devops.log · 最近 {n} 条",
      mrCreated: "MR !{iid} 已创建", tagCreated: "Tag {name} 已创建", approved: "已为 !{iid} 投票审批",
      remaining: " · 剩余 {n}", pipAction: "Pipeline #{id} {action}", mrClosed: "MR !{iid} 已关闭",
      imageUpdated: "{name} 镜像已更新为 {image}，滚动更新中...", restarting: "{name} 重启中（滚动重建 pods）",
      pipCanceled: "已取消", pipRetried: "已重试", restartsN: "{n} 次重启",
      autoTitleSuffix: "（{s} → {t}）", descHead: "## 变更说明", descCommit: "## 最新提交",
      descSource: "## 来源", descBranch: "- 分支：`{s}` → `{t}`", editingWhat: "编辑：{name}", editingWhat: "编辑：{name}",
    };
    const I18N = { zh: I18N_ZH, en: I18N_EN };

    let LANG = "zh";
    try { LANG = localStorage.getItem("dsh-devops-lang") || (/^zh/i.test(navigator.language || "") ? "zh" : "en"); } catch { /* non-browser */ }
    const LANG_EVT = "dsh-devops-lang";
    function setLang(l) {
      LANG = l;
      try { localStorage.setItem("dsh-devops-lang", l); } catch { /* ignore */ }
      window.dispatchEvent(new Event(LANG_EVT));
    }
    function t(key, vars) {
      let s = I18N[LANG]?.[key] ?? I18N.zh[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
      return s;
    }
    // 订阅语言变化（切换后强制重渲染当前组件）
    function useLang() {
      const [, force] = useState(0);
      useEffect(() => {
        const f = () => force((x) => x + 1);
        window.addEventListener(LANG_EVT, f);
        return () => window.removeEventListener(LANG_EVT, f);
      }, []);
      return LANG;
    }
    function LangToggle() {
      useLang();
      return h("button", {
        title: "Language / 语言",
        onClick: () => setLang(LANG === "zh" ? "en" : "zh"),
        style: { marginLeft: "auto", fontSize: 10, padding: "2px 8px", borderRadius: 5, border: "1px solid var(--ds-alias-border,#333)", background: "transparent", color: "#888", cursor: "pointer", flexShrink: 0 },
      }, LANG === "zh" ? "EN" : "中文");
    }

    // ─── Sub-components ───────────────────────────────────────────────────────────

    function Label({ children }) {
      return h("label", { style: S.label }, children);
    }

    function Input(props) {
      return h("input", { style: S.input, ...props });
    }

    function Select({ options, value, onChange, disabled, placeholder, style, name }) {
      const selectRef = useRef(null);
      const containerRef = useRef(null);
      
      if (name) useEffect(() => {
        console.log("[devops-sel:" + name + "] MOUNT");
        
        // 防止在 conversation 期间，全局事件关闭下拉框
        let mousedownSkip = false;
        const onMousedown = (e) => {
          if (containerRef.current && containerRef.current.contains(e.target)) {
            mousedownSkip = true;
          }
        };
        const onMouseUp = () => {
          mousedownSkip = false;
        };
        
        document.addEventListener('mousedown', onMousedown, true);
        document.addEventListener('mouseup', onMouseUp, true);
        
        return () => {
          console.log("[devops-sel:" + name + "] UNMOUNT");
          document.removeEventListener('mousedown', onMousedown, true);
          document.removeEventListener('mouseup', onMouseUp, true);
        };
      }, [name]);
      
      const validOpts = (options || []).filter((opt) => opt != null);
      return h("div", { 
        ref: containerRef,
        style: { position: "relative", display: "inline-block" },
        onMouseDown: () => { /* 捕获外部 click */ }
      },
        h("select", {
          ref: selectRef,
          style: { ...S.select, opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer", ...style },
          value: value || "",
          onChange: (e) => onChange(e.target.value),
          disabled,
          onMouseDown: name ? () => console.log("[devops-sel:" + name + "] mousedown disabled=" + !!disabled) : undefined,
          // 阻止事件冒泡，防止被 DSH 的全局事件拦截
          onClick: (e) => e.stopPropagation(),
        }, [
          h("option", { key: "__ph", value: "", disabled: !!disabled }, placeholder || t("select")),
          ...validOpts.map((opt) => {
            const val = typeof opt === "string" ? opt : (opt.value != null ? opt.value : null);
            if (val == null) return null;
            const lbl = typeof opt === "string" ? opt : (opt.label != null ? opt.label : val);
            const optDisabled = typeof opt === "object" && opt.disabled;
            return h("option", { key: val, value: val, disabled: optDisabled }, lbl);
          }).filter(Boolean),
        ]),
      );
    }

    function Btn({ children, onClick, disabled, tone = "primary", variant = "solid", small }) {
      const style = {
        padding: small ? "5px 10px" : "7px 14px", fontSize: small ? 12 : 13, fontWeight: 500, border: "none",
        borderRadius: 6, cursor: disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap", lineHeight: 1.4,
        ...BTN[tone],
        ...(variant === "outline" ? { background: "transparent", border: "1px solid var(--ds-alias-border, #555)" } : {}),
        opacity: disabled ? 0.5 : 1,
      };
      return h("button", { style, onClick: disabled ? undefined : onClick, disabled }, children);
    }

    function Status({ status, msg }) {
      if (!status) return null;
      const color = status === "ok" ? "#34c759" : status === "error" ? "#ff453a" : "#888";
      return h("div", { style: { fontSize: 12, marginTop: 4, color, display: "flex", alignItems: "center", gap: 6 } },
        h("span", { style: { fontSize: 14 } }, status === "ok" ? "✓" : status === "error" ? "✗" : "⏳"),
        h("span", null, msg || ""),
      );
    }

    function Section({ title, badge, children }) {
      return h("div", { style: S.section },
        h("div", { style: S.sectionTitle },
          h("h3", { style: { margin: 0, fontSize: 15, fontWeight: 600 } }, title),
          badge ? h("span", { style: { fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "rgba(52,199,89,0.15)", color: "#34c759" } }, badge) : null,
        ),
        h("div", { style: S.fieldGap }, children),
      );
    }

    // ─── Metric Card (for Dashboard) ──────────────────────────────────────────────

    function MetricCard({ title, value, status, icon }) {
      const color = status === "ok" ? "#34c759" : status === "error" ? "#ff453a" : status === "warn" ? "#fbbf24" : "#888";
      return h("div", {
        style: {
          border: "1px solid var(--ds-alias-border, #2a2a2a)", borderRadius: 8,
          padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4,
          background: "var(--ds-alias-surface, #141414)",
        },
      },
        h("div", { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#888" } },
          icon ? h("span", null, icon) : null,
          h("span", null, title),
        ),
        h("div", { style: { fontSize: 16, fontWeight: 600, color } }, value || "—"),
      );
    }

    // ─── Tab Bar (for Dashboard sub-tabs) ─────────────────────────────────────────

    function TabBar({ tabs, active, onChange }) {
      return h("div", {
        style: { display: "flex", gap: 2, marginBottom: 12, borderBottom: "1px solid var(--ds-alias-border, #2a2a2a)", paddingBottom: 8 },
      },
        tabs.map((tab) =>
          h("button", {
            key: tab.id,
            onClick: () => onChange(tab.id),
            style: {
              padding: "6px 14px", fontSize: 13, fontWeight: 500, border: "none",
              borderRadius: 6, cursor: "pointer",
              background: active === tab.id ? "var(--ds-alias-primary, #4a9eff)" : "transparent",
              color: active === tab.id ? "#fff" : "var(--ds-alias-foreground, #ccc)",
              transition: "background 0.15s",
            },
          }, tab.label)
        )
      );
    }

    // ─── Settings component ───────────────────────────────────────────────────────

    const SETTINGS_DEFAULT = {
      glServers: [],
      glServerId: "",
      gitlabLabel: "",
      gitlabBaseUrl: "https://gitlab.com",
      gitlabToken: "",
      gitlabTestStatus: "",
      gitlabTestMsg: "",
      gitlabProjects: [],
      projectFetching: false,
      selectedProjectId: "",
      selectedProjectPath: "",
      selectedProjectBranch: "",
      projectBranches: [],
      projectBranchesLoading: false,
      projectBranchesError: "",
      projectBranchesAll: [],
      kcList: [],
      kcId: "",
      k8sLabel: "",
      glStatus: {},
      kcStatus: {},
      k8sPath: "",
      k8sTestStatus: "",
      k8sTestMsg: "",
      k8sContexts: [],
      k8sContext: "",
      k8sNamespaces: [],
      k8sNamespacesLoading: false,
      k8sNamespace: "",
      saveStatus: "",
      saveMsg: "",
      hasSavedConfig: false,
    };

    function DevopsSettings() {
      useLang(); // 语言切换时重渲染
      const [state, setState] = useState(SETTINGS_DEFAULT);
      const searchInputRef = useRef(null);
      const branchSearchRef = useRef(null);
      const nsInputRef = useRef(null);

      const set = useCallback((patch) => {
        setState((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));
      }, []);

      // ─── Load saved config on mount ───────────────────────────────────────────

      useEffect(() => {
        (async () => {
          let r;
          try { r = await apiCall("load-config", {}); } catch { return; }
          if (!r || !r.ok || !r.config) return;
          const c = migrateConfig(r.config);
          if (JSON.stringify(c) !== JSON.stringify(r.config)) apiCall("save-config", c).catch(() => {});

          // ── GitLab: server list + active server fields ─────────────────────
          const gl = c.gitlab || {};
          const glServer = resolveGlServer(c);
          setState((s) => ({
            ...s,
            glServers: gl.servers || [],
            glServerId: gl.activeServerId || "",
            hasSavedConfig: true,
            ...(glServer ? {
              gitlabLabel: glServer.label || "",
              gitlabBaseUrl: glServer.baseUrl || "",
              gitlabToken: glServer.token || "",
              selectedProjectPath: glServer.projectPath || "",
              selectedProjectBranch: glServer.branch || "",
            } : {}),
          }));

          // Re-verify the connection + repopulate the project dropdown so the
          // saved selection actually shows. A successful fetch doubles as the
          // connection check, so only then do we mark the section connected.
          if (glServer?.baseUrl && glServer?.token) {
            try {
              const pr = await apiCall("gitlab-projects", { baseUrl: glServer.baseUrl, token: glServer.token });
              if (pr.ok && pr.projects) {
                const known = !!(glServer.projectPath && pr.projects.some((p) => p.path === glServer.projectPath));
                setState((s) => ({
                  ...s,
                  gitlabTestStatus: "ok",
                  gitlabTestMsg: t("restored"),
                  gitlabProjects: pr.projects,
                  glStatus: { ...s.glStatus, [glServer.id]: "ok" },
                  selectedProjectPath: known ? glServer.projectPath : s.selectedProjectPath,
                  selectedProjectId: known ? (pr.projects.find((p) => p.path === glServer.projectPath)?.id || "") : s.selectedProjectId,
                }));
                if (known && glServer.projectPath) {
                  try {
                    const br = await apiCall("gitlab-branches", { baseUrl: glServer.baseUrl, path: glServer.projectPath, token: glServer.token });
                    if (br.ok && br.branches) {
                      const names = br.branches.map((b) => b.name);
                      setState((s) => ({
                        ...s,
                        projectBranches: names,
                        projectBranchesAll: names,
                        selectedProjectBranch: names.includes(s.selectedProjectBranch) ? s.selectedProjectBranch : (names[0] || ""),
                      }));
                    }
                  } catch { /* branch list is best-effort */ }
                }
              } else {
                setState((s) => ({ ...s, gitlabTestStatus: "error", gitlabTestMsg: pr.message || t("restoreFail"), glStatus: { ...s.glStatus, [glServer.id]: "err" } }));
              }
            } catch {
              setState((s) => ({ ...s, gitlabTestStatus: "error", gitlabTestMsg: t("restoreFail"), glStatus: { ...s.glStatus, [glServer.id]: "err" } }));
            }
          }

          // ── K8s: kubeconfig list + active entry ────────────────────────────
          const k8s = c.k8s || {};
          const kc = resolveK8sKc(c);
          setState((s) => ({
            ...s,
            kcList: k8s.kubeconfigs || [],
            kcId: k8s.activeKubeconfigId || "",
            ...(kc ? { k8sLabel: kc.label || "", k8sPath: kc.path || "", k8sContext: kc.context || "", k8sNamespace: kc.namespace || "" } : {}),
          }));
          if (kc?.path) {
            // test-k8s hits /version (the real connection check) and returns the
            // context list, so one call both verifies and populates the dropdown.
            try {
              const tk = await apiCall("test-k8s", { kubeconfigPath: kc.path, context: kc.context || undefined });
              if (tk.ok) {
                setState((s) => ({
                  ...s,
                  k8sTestStatus: "ok",
                  k8sTestMsg: tk.message,
                  kcStatus: { ...s.kcStatus, [kc.id]: "ok" },
                  k8sContexts: tk.contexts || [],
                }));
                // Namespace list is best-effort: the user may lack RBAC to list
                // namespaces, and the free-text input still works without it.
                if (kc.context) {
                  try {
                    const nr = await apiCall("k8s-namespaces", { kubeconfigPath: kc.path, context: kc.context });
                    if (nr.ok && nr.namespaces) {
                      setState((s) => ({ ...s, k8sNamespaces: nr.namespaces }));
                    }
                  } catch { /* ignore — custom namespace still usable */ }
                }
              } else {
                setState((s) => ({ ...s, k8sTestStatus: "error", k8sTestMsg: tk.message || t("k8sFail"), kcStatus: { ...s.kcStatus, [kc.id]: "err" } }));
              }
            } catch {
              setState((s) => ({ ...s, k8sTestStatus: "error", k8sTestMsg: t("k8sFail"), kcStatus: { ...s.kcStatus, [kc.id]: "err" } }));
            }
          }
        })();
      }, []);

      // ─── Multi-server / multi-kubeconfig management ──────────────────────────

      function switchGlServer(id) {
        const srv = state.glServers.find((s) => s.id === id);
        if (!srv) return;
        set({
          glServerId: id,
          gitlabLabel: srv.label || "",
          gitlabBaseUrl: srv.baseUrl || "",
          gitlabToken: srv.token || "",
          selectedProjectId: "", selectedProjectPath: srv.projectPath || "", selectedProjectBranch: srv.branch || "",
          gitlabProjects: [], gitlabTestStatus: "", gitlabTestMsg: "",
          projectBranches: [], projectBranchesAll: [], projectBranchesError: "",
        });
      }
      function addGlServer() {
        const id = `s${Date.now()}`;
        const label = `GitLab ${state.glServers.length + 1}`;
        const next = [...state.glServers, { id, label, baseUrl: "", token: "", projectPath: "", branch: "" }];
        set({
          glServers: next, glServerId: id, gitlabLabel: label,
          gitlabBaseUrl: "", gitlabToken: "",
          selectedProjectId: "", selectedProjectPath: "", selectedProjectBranch: "",
          gitlabProjects: [], gitlabTestStatus: "", gitlabTestMsg: "",
          projectBranches: [], projectBranchesAll: [], projectBranchesError: "",
        });
      }
      function removeGlServer() {
        if (state.glServers.length <= 1) return;
        const next = state.glServers.filter((s) => s.id !== state.glServerId);
        const newId = next[0]?.id || "";
        const srv = next.find((s) => s.id === newId);
        set({
          glServers: next, glServerId: newId,
          gitlabLabel: srv?.label || "", gitlabBaseUrl: srv?.baseUrl || "", gitlabToken: srv?.token || "",
          selectedProjectId: "", selectedProjectPath: srv?.projectPath || "", selectedProjectBranch: srv?.branch || "",
          gitlabProjects: [], gitlabTestStatus: "", gitlabTestMsg: "",
          projectBranches: [], projectBranchesAll: [], projectBranchesError: "",
        });
      }
      function switchKc(id) {
        const kc = state.kcList.find((k) => k.id === id);
        if (!kc) return;
        set({
          kcId: id, k8sLabel: kc.label || "", k8sPath: kc.path || "",
          k8sContext: kc.context || "", k8sNamespace: kc.namespace || "",
          k8sTestStatus: "", k8sTestMsg: "", k8sContexts: [], k8sNamespaces: [],
        });
      }
      function addKc() {
        const id = `k${Date.now()}`;
        const label = `K8s ${state.kcList.length + 1}`;
        set({
          kcList: [...state.kcList, { id, label, path: "", context: "", namespace: "" }],
          kcId: id, k8sLabel: label, k8sPath: "",
          k8sTestStatus: "", k8sTestMsg: "", k8sContexts: [], k8sNamespaces: [], k8sContext: "", k8sNamespace: "",
        });
      }
      function removeKc() {
        if (state.kcList.length <= 1) return;
        const next = state.kcList.filter((k) => k.id !== state.kcId);
        const newId = next[0]?.id || "";
        const kc = next.find((k) => k.id === newId);
        set({
          kcList: next, kcId: newId, k8sLabel: kc?.label || "", k8sPath: kc?.path || "",
          k8sContext: kc?.context || "", k8sNamespace: kc?.namespace || "",
          k8sTestStatus: "", k8sTestMsg: "", k8sContexts: [], k8sNamespaces: [],
        });
      }

      // ─── GitLab: Test + auto-fetch ────────────────────────────────────────────

      async function handleTestGitLab() {
        const { gitlabBaseUrl, gitlabToken } = state;
        if (!gitlabBaseUrl || !gitlabToken) {
          set({ gitlabTestStatus: "error", gitlabTestMsg: t("fillGl") });
          return;
        }
        set({ gitlabTestStatus: "testing", gitlabTestMsg: t("connecting") });
        try {
          const r = await apiCall("test-gitlab", { baseUrl: gitlabBaseUrl, token: gitlabToken });
          if (r.ok) {
            set((st) => ({ gitlabTestStatus: "ok", gitlabTestMsg: r.message, projectFetching: true, glStatus: { ...st.glStatus, [st.glServerId]: "ok" } }));
            const pr = await apiCall("gitlab-projects", { baseUrl: gitlabBaseUrl, token: gitlabToken });
            if (pr.ok && pr.projects) {
              set({ gitlabProjects: pr.projects, projectFetching: false });
            } else {
              set({ projectFetching: false });
            }
          } else {
            set((st) => ({ gitlabTestStatus: "error", gitlabTestMsg: r.message, projectFetching: false, glStatus: { ...st.glStatus, [st.glServerId]: "err" } }));
          }
        } catch (e) {
          set((st) => ({ gitlabTestStatus: "error", gitlabTestMsg: e.message, projectFetching: false, glStatus: { ...st.glStatus, [st.glServerId]: "err" } }));
        }
      }

      // ─── GitLab: Refresh projects ─────────────────────────────────────────────

      async function handleRefreshProjects() {
        set({ projectFetching: true });
        try {
          const pr = await apiCall("gitlab-projects", { baseUrl: state.gitlabBaseUrl, token: state.gitlabToken });
          if (pr.ok && pr.projects) {
            set({ gitlabProjects: pr.projects, projectFetching: false });
          } else {
            set({ projectFetching: false });
          }
        } catch {
          set({ projectFetching: false });
        }
      }

      // ─── GitLab: Search projects ───────────────────────────────────────────────

      async function handleSearchProjects() {
        const keyword = (searchInputRef.current?.value || "").trim().toLowerCase();
        if (!keyword) {
          // Empty keyword → full refresh (server-side, no filter)
          handleRefreshProjects();
          return;
        }
        // Client-side filter on already-loaded list
        const filtered = state.gitlabProjects.filter((p) =>
          p.path.toLowerCase().includes(keyword) || (p.name || "").toLowerCase().includes(keyword)
        );
        if (filtered.length > 0) {
          set({ gitlabProjects: filtered });
        } else {
          // No local match → try server-side search
          set({ projectFetching: true });
          try {
            const pr = await apiCall("gitlab-projects", { baseUrl: state.gitlabBaseUrl, token: state.gitlabToken, search: keyword });
            if (pr.ok && pr.projects) {
              set({ gitlabProjects: pr.projects, projectFetching: false });
            } else {
              set({ projectFetching: false });
            }
          } catch {
            set({ projectFetching: false });
          }
        }
      }

      // ─── GitLab: Project change → fetch branches ──────────────────────────────

      async function handleProjectChange(path) {
        const proj = state.gitlabProjects.find((p) => p.path === path);
        if (!proj) return;
        set({
          selectedProjectId: proj.id,
          selectedProjectPath: proj.path,
          selectedProjectBranch: proj.defaultBranch || "",
          projectBranches: [],
          projectBranchesLoading: true,
        });
        try {
          const r = await apiCall("gitlab-branches", {
            baseUrl: state.gitlabBaseUrl,
            path: proj.path,
            token: state.gitlabToken,
          });
          if (r.ok && r.branches) {
            const names = r.branches.map((b) => b.name);
            set({ projectBranches: names, projectBranchesAll: names, projectBranchesLoading: false, projectBranchesError: "" });
          } else {
            set({ projectBranchesLoading: false, projectBranchesError: r.message || t("brFail") });
          }
        } catch (e) {
          set({ projectBranchesLoading: false, projectBranchesError: e.message || t("brFail") });
        }
      }

      // ─── GitLab: Search branches (client-side filter on loaded list) ──────────────

      function handleSearchBranches() {
        const keyword = (branchSearchRef.current?.value || "").trim().toLowerCase();
        const all = state.projectBranchesAll;
        if (!keyword) {
          set({ projectBranches: all });
          return;
        }
        const filtered = all.filter((b) => b.toLowerCase().includes(keyword));
        set({ projectBranches: filtered });
      }

      // ─── K8s: Test connection ───────────────────────────────────────────────────

      async function handleTestK8s() {
        const { k8sPath } = state;
        if (!k8sPath) {
          set({ k8sTestStatus: "error", k8sTestMsg: t("fillKc") });
          return;
        }
        set({ k8sTestStatus: "testing", k8sTestMsg: t("connecting") });
        try {
          const r = await apiCall("test-k8s", { kubeconfigPath: k8sPath });
          if (r.ok) {
            const contexts = r.contexts || [];
            const defaultCtx = contexts[0]?.name || "";
            // Prefill the namespace from the kubeconfig's configured namespace
            // for the default context (method 1); user can still override below.
            const defaultNs = contexts[0]?.namespace || r.namespace || "";
            set((st) => ({
              k8sTestStatus: "ok", k8sTestMsg: r.message, kcStatus: { ...st.kcStatus, [st.kcId]: "ok" },
              k8sContexts: contexts, k8sContext: defaultCtx,
              k8sNamespaces: [], k8sNamespace: defaultNs, k8sNamespacesLoading: false,
            }));
            if (defaultCtx) {
              set({ k8sNamespacesLoading: true });
              try {
                const nr = await apiCall("k8s-namespaces", { kubeconfigPath: k8sPath, context: defaultCtx });
                if (nr.ok && nr.namespaces) {
                  set({ k8sNamespaces: nr.namespaces, k8sNamespacesLoading: false });
                } else {
                  set({ k8sNamespacesLoading: false });
                }
              } catch {
                set({ k8sNamespacesLoading: false });
              }
            }
          } else {
            set({ k8sTestStatus: "error", k8sTestMsg: r.message });
          }
        } catch (e) {
          set({ k8sTestStatus: "error", k8sTestMsg: e.message });
        }
      }

      // ─── K8s: Context change ────────────────────────────────────────────────────

      async function handleContextChange(ctx) {
        // Prefill the namespace from the kubeconfig's configured namespace for
        // the selected context (method 1). Empty -> leave blank for the user.
        const cfg = (state.k8sContexts || []).find((c) => c.name === ctx) || {};
        set({ k8sContext: ctx, k8sNamespaces: [], k8sNamespace: cfg.namespace || "", k8sNamespacesLoading: true });
        try {
          const r = await apiCall("k8s-namespaces", { kubeconfigPath: state.k8sPath, context: ctx });
          if (r.ok && r.namespaces) {
            set({ k8sNamespaces: r.namespaces, k8sNamespacesLoading: false });
          } else {
            set({ k8sNamespacesLoading: false });
          }
        } catch {
          set({ k8sNamespacesLoading: false });
        }
      }

      // ─── K8s: File browse ──────────────────────────────────────────────────────

      async function handleBrowseFile() {
        try {
          const r = await apiCall("browse-file", {});
          if (r.ok && r.path) {
            set({ k8sPath: r.path, k8sTestStatus: "", k8sTestMsg: "" });
          }
        } catch { /* cancelled */ }
      }

      // ─── Save ──────────────────────────────────────────────────────────────────

      async function handleSave() {
        const config = {};
        // GitLab：把当前表单字段写回选中 server，整体保存 servers 列表
        if (state.glServers.length > 0 && state.glServerId) {
          const servers = state.glServers.map((s) =>
            s.id === state.glServerId
              ? {
                  ...s,
                  label: state.gitlabLabel || s.label,
                  baseUrl: state.gitlabBaseUrl,
                  token: state.gitlabToken,
                  projectPath: state.selectedProjectPath,
                  branch: state.selectedProjectBranch,
                }
              : s,
          );
          config.gitlab = { servers, activeServerId: state.glServerId };
        }
        // The free-text input is the source of truth for the namespace; the
        // Select (fetched namespaces) writes into it. Fall back to state.
        const nsValue =
          (typeof nsInputRef.current?.value === "string" ? nsInputRef.current.value.trim() : "") ||
          state.k8sNamespace || "";
        // K8s：把当前表单字段写回选中 kubeconfig，整体保存列表
        if (state.kcList.length > 0 && state.kcId) {
          const kubeconfigs = state.kcList.map((k) =>
            k.id === state.kcId
              ? {
                  ...k,
                  label: state.k8sLabel || k.label,
                  path: state.k8sPath,
                  context: state.k8sContext || "",
                  namespace: nsValue,
                }
              : k,
          );
          config.k8s = { kubeconfigs, activeKubeconfigId: state.kcId };
        }
        if (Object.keys(config).length === 0) {
          set({ saveStatus: "error", saveMsg: t("completeOne") });
          return;
        }
        try {
          const r = await apiCall("save-config", config);
          if (r.ok) {
            set({ saveStatus: "ok", saveMsg: t("saved"), hasSavedConfig: true });
          } else {
            set({ saveStatus: "error", saveMsg: r.message || t("saveFailed") });
          }
        } catch (e) {
          set({ saveStatus: "error", saveMsg: e.message });
        }
      }

      // ─── Render ─────────────────────────────────────────────────────────────────

      const gitlabConnected = state.gitlabTestStatus === "ok";
      const k8sConnected = state.k8sTestStatus === "ok";

      return h("div", { style: { padding: "0 4px 24px", maxWidth: 640 } },

        // 语言切换
        h("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: 8 } }, h(LangToggle)),

        // Not-configured prompt
        !state.hasSavedConfig
          ? h("div", { style: { ...S.callout, marginBottom: 20 } },
              h("strong", null, t("notCfgYet")),
              h("div", { style: { marginTop: 4 } }, t("fillGlOrK8s")),
            )
          : null,

        // ═══ GitLab ═══
        h(Section, { title: "GitLab", badge: gitlabConnected ? t("connected") : undefined },

          // ── 服务器列表（点击切换编辑对象，每行是一套完整配置）──
          h("div", null,
            h(Label, null, t("glServers")),
            h("div", { style: { border: "1px solid var(--ds-alias-border,#333)", borderRadius: 8, overflow: "hidden" } },
              state.glServers.map((s, i) => {
                const editing = s.id === state.glServerId;
                const st = state.glStatus[s.id];
                return h("div", {
                  key: s.id,
                  onClick: () => { if (!editing) switchGlServer(s.id); },
                  style: {
                    display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", fontSize: 12, cursor: editing ? "default" : "pointer",
                    background: editing ? "var(--ds-alias-primary, #4a9eff)" : i % 2 ? "transparent" : "var(--ds-alias-surface-inset,#1a1a1a)",
                    borderTop: i ? "1px solid var(--ds-alias-border,#2a2a2a)" : "none",
                  },
                },
                  h(Dot, { tone: st === "ok" ? "ok" : st === "err" ? "err" : "neutral" }),
                  h("span", { style: { fontWeight: 500, color: editing ? "#fff" : "#ddd", flexShrink: 0 } }, s.label || t("unnamed")),
                  h("span", { style: { color: editing ? "rgba(255,255,255,0.75)" : "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 } }, s.baseUrl || t("noUrl")),
                  editing ? h("span", { style: { fontSize: 10, color: "#fff", background: "rgba(255,255,255,0.2)", borderRadius: 4, padding: "1px 6px", flexShrink: 0 } }, t("editing")) : null,
                );
              }),
            ),
            h("div", { style: { marginTop: 6 } },
              h(Btn, { onClick: addGlServer, small: true, variant: "outline" }, t("addServer")),
            ),
          ),

          // ── 编辑区 ──
          h("div", { style: { borderTop: "1px solid var(--ds-alias-border,#2a2a2a)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 10 } },
            h("div", { style: { fontSize: 12, fontWeight: 600, color: "#ccc" } },
              t("editingWhat", { name: state.gitlabLabel || state.gitlabBaseUrl || t("unnamed") })),

            // Connection
            h("div", null,
              h(Label, null, t("name")),
              h(Input, { type: "text", value: state.gitlabLabel, placeholder: t("nameGlPh"), onChange: (e) => set({ gitlabLabel: e.target.value }) }),
            ),
            h("div", null,
              h(Label, null, "Base URL"),
              h(Input, { type: "url", value: state.gitlabBaseUrl, placeholder: "https://gitlab.example.com", onChange: (e) => set({ gitlabBaseUrl: e.target.value, gitlabTestStatus: "", gitlabTestMsg: "" }) }),
            ),
          h("div", null,
            h(Label, null, "Access Token"),
            h(Input, { type: "password", value: state.gitlabToken, placeholder: "glpat-xxxx...", onChange: (e) => set({ gitlabToken: e.target.value, gitlabTestStatus: "", gitlabTestMsg: "" }) }),
          ),
          h("div", { style: S.row },
            h(Btn, { onClick: handleTestGitLab, disabled: state.gitlabTestStatus === "testing" },
              state.gitlabTestStatus === "testing" ? t("connecting") : t("testConn")),
            h("div", null, h(Status, { status: state.gitlabTestStatus, msg: state.gitlabTestMsg })),
          ),

          // Project search + select
          h("div", null,
            h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
              h(Label, null, t("project")),
              state.gitlabProjects.length > 0
                ? h(Btn, { onClick: handleRefreshProjects, disabled: state.projectFetching, variant: "outline", small: true },
                    state.projectFetching ? "..." : t("refresh"))
                : null,
            ),
            !gitlabConnected && h("div", { style: S.hint }, t("testGlFirst")),
            // Search input + button (uncontrolled pattern for DSH settings panel)
            gitlabConnected && h("div", { style: { display: "flex", gap: 6, marginBottom: 8 } },
              h("input", {
                ref: searchInputRef,
                type: "text",
                defaultValue: "",
                placeholder: t("searchProjPh"),
                style: { ...S.input, flex: 1 },
              }),
              h(Btn, { onClick: handleSearchProjects, small: true, variant: "outline" }, t("search")),
            ),
            h(Select, {
              options: state.gitlabProjects.map((p) => p.path).filter(Boolean),
              value: state.selectedProjectPath,
              onChange: handleProjectChange,
              disabled: !gitlabConnected || state.projectFetching || state.gitlabProjects.length === 0,
              placeholder: !gitlabConnected ? t("testFirst") : state.projectFetching ? t("loading") : state.gitlabProjects.length === 0 ? t("noProjects") : t("selProject"),
            }),
          ),

          // Branch select — ALWAYS visible
          h("div", null,
            h(Label, null, t("branch")),
            !state.selectedProjectId && h("div", { style: S.hint }, t("selProjFirst")),
            // Branch error surfacing
            state.projectBranchesError && h("div", { style: { fontSize: 12, color: "#ff453a", marginBottom: 6 } }, `⚠ ${state.projectBranchesError}`),
            // Branch search input + button (client-side filter)
            state.selectedProjectId && !state.projectBranchesLoading && h("div", { style: { display: "flex", gap: 6, marginBottom: 8 } },
              h("input", {
                ref: branchSearchRef,
                type: "text",
                defaultValue: "",
                placeholder: t("searchBrPh"),
                style: { ...S.input, flex: 1 },
              }),
              h(Btn, { onClick: handleSearchBranches, small: true, variant: "outline" }, t("search")),
            ),
            h(Select, {
              options: state.projectBranchesLoading
                ? [{ value: "__loading", label: t("loadingBr"), disabled: true }]
                : state.projectBranches.length === 0
                  ? [{ value: "__empty", label: t("noBranches"), disabled: true }]
                  : state.projectBranches,
              value: state.selectedProjectBranch,
              onChange: (v) => set({ selectedProjectBranch: v }),
              disabled: !state.selectedProjectId || state.projectBranchesLoading,
              placeholder: !state.selectedProjectId ? t("selProjFirst") : t("selBranch"),
            }),
          ),

          // 危险区：删除当前编辑的这套 GitLab 配置
          state.glServers.length > 1
            ? h("div", { style: { borderTop: "1px solid var(--ds-alias-border,#2a2a2a)", paddingTop: 8 } },
                h("button", { style: { background: "transparent", border: "none", color: "#ff453a", cursor: "pointer", fontSize: 12, padding: "2px 0" }, onClick: removeGlServer }, t("delGl")),
              )
            : null,
          ),
        ),

        // ═══ Kubernetes ═══
        h(Section, { title: "Kubernetes", badge: k8sConnected ? t("connected") : undefined },

          // ── kubeconfig 列表 ──
          h("div", null,
            h(Label, null, t("kcConfig")),
            h("div", { style: { border: "1px solid var(--ds-alias-border,#333)", borderRadius: 8, overflow: "hidden" } },
              state.kcList.map((k, i) => {
                const editing = k.id === state.kcId;
                const st = state.kcStatus[k.id];
                return h("div", {
                  key: k.id,
                  onClick: () => { if (!editing) switchKc(k.id); },
                  style: {
                    display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", fontSize: 12, cursor: editing ? "default" : "pointer",
                    background: editing ? "var(--ds-alias-primary, #4a9eff)" : i % 2 ? "transparent" : "var(--ds-alias-surface-inset,#1a1a1a)",
                    borderTop: i ? "1px solid var(--ds-alias-border,#2a2a2a)" : "none",
                  },
                },
                  h(Dot, { tone: st === "ok" ? "ok" : st === "err" ? "err" : "neutral" }),
                  h("span", { style: { fontWeight: 500, color: editing ? "#fff" : "#ddd", flexShrink: 0 } }, k.label || t("unnamed")),
                  h("span", { style: { color: editing ? "rgba(255,255,255,0.75)" : "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 } }, k.path || t("noPath")),
                  editing ? h("span", { style: { fontSize: 10, color: "#fff", background: "rgba(255,255,255,0.2)", borderRadius: 4, padding: "1px 6px", flexShrink: 0 } }, t("editing")) : null,
                );
              }),
            ),
            h("div", { style: { marginTop: 6 } },
              h(Btn, { onClick: addKc, small: true, variant: "outline" }, t("addKc")),
            ),
          ),

          // ── 编辑区 ──
          h("div", { style: { borderTop: "1px solid var(--ds-alias-border,#2a2a2a)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 10 } },
            h("div", { style: { fontSize: 12, fontWeight: 600, color: "#ccc" } },
              t("editingWhat", { name: state.k8sLabel || state.k8sPath || t("unnamed") })),

            h("div", null,
              h(Label, null, t("name")),
              h(Input, { type: "text", value: state.k8sLabel, placeholder: t("nameK8sPh"), onChange: (e) => set({ k8sLabel: e.target.value }) }),
            ),

            h("div", null,
            h(Label, null, t("kcPath")),
            h("div", { style: { display: "flex", gap: 8 } },
              h("div", { style: { flex: 1, minWidth: 0 } },
                h(Input, { type: "url", value: state.k8sPath, placeholder: "~/.aging/config", onChange: (e) => set({ k8sPath: e.target.value, k8sTestStatus: "", k8sTestMsg: "" }) }),
              ),
              h(Btn, { onClick: handleBrowseFile, variant: "outline" }, t("browse")),
            ),
          ),
          h("div", { style: S.row },
            h(Btn, { onClick: handleTestK8s, disabled: state.k8sTestStatus === "testing" },
              state.k8sTestStatus === "testing" ? t("connecting") : t("testConn")),
            h("div", null, h(Status, { status: state.k8sTestStatus, msg: state.k8sTestMsg })),
          ),

          // Context select — ALWAYS visible. `k8sContexts` entries are
          // {name, namespace}; the dropdown shows the name, and the selected
          // context's kubeconfig namespace is used to prefill the field below.
          h("div", null,
            h(Label, null, "Context"),
            !k8sConnected && h("div", { style: S.hint }, t("testK8sFirst")),
            h(Select, {
              options: (state.k8sContexts || []).map((c) => c.name).filter(Boolean),
              value: state.k8sContext,
              onChange: handleContextChange,
              disabled: !k8sConnected || (state.k8sContexts || []).length === 0,
              placeholder: !k8sConnected ? t("testFirst") : t("selCtx"),
            }),
          ),

          // Namespace — supports three input methods:
          //   1) prefilled from the kubeconfig context's configured namespace,
          //   2) picked from the fetched namespace list (writes into the input),
          //   3) free-text custom input (source of truth — for users who lack
          //      permission to list namespaces, or want a value not in the list).
          h("div", null,
            h(Label, null, "Namespace"),
            !state.k8sContext && h("div", { style: S.hint }, t("selCtxFirst")),
            h("div", { style: { display: "flex", gap: 6 } },
              h("div", { style: { flex: "0 0 46%", minWidth: 0 } },
                h(Select, {
                  options: state.k8sNamespacesLoading
                    ? [{ value: "__loading", label: t("loadingNs"), disabled: true }]
                    : state.k8sNamespaces.length === 0
                      ? [{ value: "__empty", label: t("noNs"), disabled: true }]
                      : state.k8sNamespaces,
                  value: state.k8sNamespaces.includes(state.k8sNamespace) ? state.k8sNamespace : "",
                  onChange: (v) => {
                    if (!v) return;
                    if (nsInputRef.current) nsInputRef.current.value = v;
                    set({ k8sNamespace: v });
                  },
                  disabled: !state.k8sContext || state.k8sNamespacesLoading,
                  placeholder: !state.k8sContext ? t("selCtxFirst") : t("selNs"),
                }),
              ),
              // Free-text input (source of truth). Remounts on context change
              // (via key) so its defaultValue is re-read from state.k8sNamespace.
              h("input", {
                ref: nsInputRef,
                key: `ns-${state.k8sContext}`,
                type: "text",
                defaultValue: state.k8sNamespace || "",
                placeholder: t("manualNs"),
                style: { ...S.input, flex: 1 },
              }),
            ),
            h("div", { style: S.hint }, t("nsHint")),
          ),

          // 危险区：删除当前编辑的这套 kubeconfig
          state.kcList.length > 1
            ? h("div", { style: { borderTop: "1px solid var(--ds-alias-border,#2a2a2a)", paddingTop: 8 } },
                h("button", { style: { background: "transparent", border: "none", color: "#ff453a", cursor: "pointer", fontSize: 12, padding: "2px 0" }, onClick: removeKc }, t("delK8s")),
              )
            : null,
          ),
        ),

        // ═══ Save ═══
        h("div", { style: S.rowEnd },
          h(Btn, { onClick: handleSave, tone: "success" }, t("saveConfig")),
          h(Status, { status: state.saveStatus, msg: state.saveMsg }),
        ),
      );
    }

    // ─── Dashboard shared bits ────────────────────────────────────────────────────

    function timeAgo(ts) {
      if (!ts) return "";
      const diff = Date.now() - new Date(ts).getTime();
      if (isNaN(diff) || diff < 0) return "";
      const s = Math.floor(diff / 1000);
      if (s < 60) return t("justNow");
      const m = Math.floor(s / 60);
      if (m < 60) return t("minAgo", { n: m });
      const hr = Math.floor(m / 60);
      if (hr < 24) return t("hourAgo", { n: hr });
      return t("dayAgo", { n: Math.floor(hr / 24) });
    }

    const DOT_COLOR = { ok: "#34c759", warn: "#fbbf24", err: "#ff6b60", neutral: "#888" };

    function Dot({ tone = "neutral", pulse }) {
      return h("span", { style: {
        width: 8, height: 8, borderRadius: "50%", background: DOT_COLOR[tone] || "#888",
        flexShrink: 0, animation: pulse ? "dshPulse 1.3s ease-in-out infinite" : "none",
      }});
    }

    function Badge({ tone = "neutral", children }) {
      const map = {
        ok: ["rgba(52,199,89,0.16)", "#34c759"], warn: ["rgba(251,191,36,0.16)", "#fbbf24"],
        err: ["rgba(255,69,58,0.16)", "#ff8a80"], accent: ["rgba(74,158,255,0.16)", "#5aa8ff"],
        neutral: ["rgba(140,140,140,0.18)", "#aaa"],
      };
      const [bg, fg] = map[tone] || map.neutral;
      return h("span", { style: { fontSize: 11, padding: "1px 7px", borderRadius: 9, background: bg, color: fg, fontWeight: 500, whiteSpace: "nowrap", lineHeight: 1.5 } }, children);
    }

    function ChipBtn({ children, onClick, tone = "ghost", title, disabled }) {
      const bg = tone === "danger" ? "rgba(255,69,58,0.12)" : tone === "primary" ? "rgba(74,158,255,0.12)" : "transparent";
      const fg = tone === "danger" ? "#ff8a80" : tone === "primary" ? "#5aa8ff" : "#bbb";
      return h("button", {
        title, disabled, onClick: disabled ? undefined : onClick,
        style: { fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "1px solid var(--ds-alias-border,#333)", background: bg, color: fg, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1, whiteSpace: "nowrap", lineHeight: 1.4 },
      }, children);
    }

    function StatCard({ icon, title, value, sub, tone = "neutral", subTone }) {
      const c = tone === "ok" ? "#34c759" : tone === "err" ? "#ff8a80" : tone === "warn" ? "#fbbf24" : "#eee";
      return h("div", { style: { border: "1px solid var(--ds-alias-border,#2a2a2a)", borderRadius: 8, padding: "12px 13px", background: "var(--ds-alias-surface,#141414)", display: "flex", flexDirection: "column", gap: 3, minWidth: 0 } },
        h("div", { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#888" } },
          icon ? h("span", null, icon) : null,
          h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, title)),
        h("div", { style: { fontSize: 19, fontWeight: 700, color: c, lineHeight: 1.15 } }, value != null ? value : "—"),
        sub ? h("div", { style: { fontSize: 11, color: subTone || "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, sub) : null,
      );
    }

    function SecHeader({ icon, title, badge, badgeTone = "neutral", onNew, newLabel, right }) {
      return h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 } },
        h("span", { style: { fontSize: 13 } }, icon),
        h("span", { style: { fontSize: 13, fontWeight: 600 } }, title),
        badge != null ? h(Badge, { tone: badgeTone }, badge) : null,
        h("span", { style: { flex: 1 } }),
        right,
        onNew ? h(Btn, { onClick: onNew, small: true, variant: "outline" }, newLabel || t("newBtn")) : null,
      );
    }

    function EmptyHint({ children }) {
      return h("div", { style: { padding: "10px 4px", fontSize: 12, color: "#666" } }, children);
    }

    // ─── Dashboard component (方案 C) ──────────────────────────────────────────────

    const PIPELINE_RUNNING = ["created", "waiting_for_resource", "preparing", "pending", "running", "queued", "scheduled"];
    const POLL_INTERVAL = 60_000; // 60s auto-refresh

    // ─── Config migration (legacy single-server → multi-server) ───────────────────
    // Legacy: {gitlab: {baseUrl, token, projects: [...]}, k8s: {kubeconfigs: [...]}}
    // Target: {gitlab: {servers: [{id,label,baseUrl,token,projectPath,branch}], activeServerId},
    //          k8s: {kubeconfigs: [...], activeKubeconfigId}}
    function migrateConfig(cfg) {
      if (!cfg || typeof cfg !== "object") return cfg;
      const out = JSON.parse(JSON.stringify(cfg));
      const gl = out.gitlab || {};
      if (!Array.isArray(gl.servers)) {
        const legacyProject = Array.isArray(gl.projects) ? gl.projects[0] : null;
        gl.servers = [{
          id: "s1", label: "GitLab",
          baseUrl: gl.baseUrl || "", token: gl.token || "",
          projectPath: legacyProject?.path || "", branch: legacyProject?.defaultBranch || legacyProject?.branch || "",
        }];
      }
      delete gl.baseUrl; delete gl.token; delete gl.projects; delete gl.defaultProject;
      gl.servers = gl.servers.filter((s) => s && s.id);
      if (!gl.activeServerId || !gl.servers.some((s) => s.id === gl.activeServerId)) {
        gl.activeServerId = gl.servers[0]?.id || null;
      }
      const k8s = out.k8s || {};
      if (!Array.isArray(k8s.kubeconfigs)) k8s.kubeconfigs = [];
      k8s.kubeconfigs = k8s.kubeconfigs.map((k) => ({
        ...k,
        label: k.label || (k.path ? k.path.split(/[\\/]/).pop() : t("k8sCfg")),
      }));
      if (!k8s.activeKubeconfigId || !k8s.kubeconfigs.some((k) => k.id === k8s.activeKubeconfigId)) {
        k8s.activeKubeconfigId = k8s.kubeconfigs[0]?.id || null;
      }
      out.gitlab = gl; out.k8s = k8s;
      return out;
    }

    function resolveGlServer(cfg) {
      const gl = cfg?.gitlab;
      if (!gl || !Array.isArray(gl.servers)) return null;
      return gl.servers.find((s) => s.id === gl.activeServerId) || gl.servers[0] || null;
    }
    function resolveK8sKc(cfg) {
      const k8s = cfg?.k8s;
      if (!k8s || !Array.isArray(k8s.kubeconfigs)) return null;
      return k8s.kubeconfigs.find((k) => k.id === k8s.activeKubeconfigId) || k8s.kubeconfigs[0] || null;
    }

    function DevopsDashboard() {
      useLang(); // 语言切换时重渲染
      const [config, setConfig] = useState(null);
      const [loading, setLoading] = useState(true);
      const [activeTab, setActiveTab] = useState("gitlab");
      const [live, setLive] = useState(null);
      const [logsData, setLogsData] = useState(null);
      const [toast, setToast] = useState(null);
      const [busy, setBusy] = useState(false);
      const [newMrOpen, setNewMrOpen] = useState(false);
      const [newTagOpen, setNewTagOpen] = useState(false);
      const [logView, setLogView] = useState(null);
      // MR / Tag 表单下拉数据（branches/members/tags 快照）
      const [formOpts, setFormOpts] = useState({ branches: [], members: [], loading: false, projectKey: "" });
      // MR 表单受控字段（source/target/reviewers 改为下拉+可手输）
      const [mrSource, setMrSource] = useState("");
      const [mrTarget, setMrTarget] = useState("");
      const [mrReviewers, setMrReviewers] = useState("");
      // Tag 表单受控 ref 字段
      const [tagRefSel, setTagRefSel] = useState("");
      // Context bar 下拉数据（项目 / context / namespace 列表）
      const [barOpts, setBarOpts] = useState({ projects: [], contexts: [], namespaces: [], key: "" });
      // 双卡片连接状态（最近一次列表拉取结果）
      const [connStatus, setConnStatus] = useState({ gl: "", k8s: "" });
      // Pipeline 展开详情
      const [expandedPipe, setExpandedPipe] = useState(null);
      const [pipeJobs, setPipeJobs] = useState({ id: null, jobs: [], loading: false });
      // Deployment 展开 Pods / 换镜像编辑 / 操作确认
      const [expandedDep, setExpandedDep] = useState(null);
      const [depImgEdit, setDepImgEdit] = useState(null); // 正在编辑镜像的 deployment 名
      const depImgRef = useRef(null);
      const timerRef = useRef(null);
      const fetchSeqRef = useRef(0);
      const mrDescSeqRef = useRef(0);
      const mrTitleRef = useRef(null);
      const mrDescRef = useRef(null);
      const tagNameRef = useRef(null);
      const tagMsgRef = useRef(null);

      // ===== DEBUG PROBE (remove after diagnosis) =====
      window.__devopsRc = (window.__devopsRc || 0) + 1;
      if (window.__devopsRc % 20 === 1) console.log("[devops] RENDER #" + window.__devopsRc);
      useEffect(() => {
        console.log("[devops] DASHBOARD MOUNT");
        const scroller = document.querySelector("[data-conversation-scroll]");
        let last = 0;
        const onScroll = () => {
          const now = Date.now();
          if (!scroller || now - last < 300) return;
          last = now;
          console.log("[devops] SCROLL top=" + Math.round(scroller.scrollTop) + " clientH=" + scroller.clientHeight + " scrollH=" + scroller.scrollHeight);
        };
        if (scroller) scroller.addEventListener("scroll", onScroll, true);
        return () => {
          console.log("[devops] DASHBOARD UNMOUNT");
          if (scroller) scroller.removeEventListener("scroll", onScroll, true);
        };
      }, []);
      // ===== END DEBUG PROBE =====

      // Load saved config
      useEffect(() => {
        (async () => {
          try {
            const r = await apiCall("load-config", {});
            if (r.ok && r.config) {
              const migrated = migrateConfig(r.config);
              const changed = JSON.stringify(migrated) !== JSON.stringify(r.config);
              if (changed) apiCall("save-config", migrated).catch(() => {});
              setConfig(migrated);
              await fetchData(migrated);
            }
          } catch {
            /* ignore */
          } finally {
            setLoading(false);
          }
        })();
      }, []);

      async function fetchData(cfg) {
        if (!cfg) return;
        const seq = ++fetchSeqRef.current; // 快速连续切换时，旧请求的响应作废
        const jobs = [];
        const glServer = resolveGlServer(cfg);
        if (glServer?.baseUrl && glServer?.token && glServer?.projectPath) {
          const base = { baseUrl: glServer.baseUrl, token: glServer.token, projectPath: glServer.projectPath };
          jobs.push(["mrs", apiCall("gitlab-mrs", { ...base, state: "opened" })]);
          jobs.push(["pipelines", apiCall("gitlab-pipelines", { ...base, perPage: 10 })]);
          jobs.push(["tags", apiCall("gitlab-tags", base)]);
        }
        const kc = resolveK8sKc(cfg);
        if (kc?.path) {
          const ns = kc.namespace || "default";
          const kb = { kubeconfigPath: kc.path, context: kc.context, namespace: ns };
          jobs.push(["deployments", apiCall("k8s-deployments", kb)]);
          jobs.push(["pods", apiCall("k8s-pods", kb)]);
          jobs.push(["events", apiCall("k8s-events", { ...kb, limit: 15 })]);
        }
        if (jobs.length === 0) { if (seq === fetchSeqRef.current) setLive({}); return; }
        const settled = await Promise.all(jobs.map(([, p]) => p.catch(() => ({ ok: false }))));
        if (seq !== fetchSeqRef.current) return;
        const data = {};
        jobs.forEach(([key], i) => { data[key] = settled[i]; });
        setLive(data);
      }

      // Auto-refresh
      useEffect(() => {
        if (!config) return;
        timerRef.current = setInterval(() => fetchData(config), POLL_INTERVAL);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
      }, [config]);

      // Log polling (10s when logs tab active)
      useEffect(() => {
        if (activeTab !== "logs") return;
        (async () => {
          try {
            const r = await apiCall("logs", { lines: 200 });
            if (r.ok) setLogsData(r.lines || []);
          } catch { /* ignore */ }
        })();
        const logTimer = setInterval(async () => {
          try {
            const r = await apiCall("logs", { lines: 200 });
            if (r.ok) setLogsData(r.lines || []);
          } catch { /* ignore */ }
        }, 10_000);
        return () => clearInterval(logTimer);
      }, [activeTab]);

      // Toast auto-dismiss
      useEffect(() => {
        if (!toast) return;
        const toastTimer = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(toastTimer);
      }, [toast]);

      const glServer = resolveGlServer(config);
      const glCfg = glServer; // 兼容既有引用（baseUrl/token）
      const glProject = glServer?.projectPath ? { path: glServer.projectPath } : null;
      const k8sKc = resolveK8sKc(config);

      // ─── Config switching (context bar) ─────────────────────────────────────────

      async function applyConfig(next) {
        setConfig(next);
        try { await apiCall("save-config", next); } catch { /* 保存失败不打断切换 */ }
        await fetchData(next);
      }
      function switchServer(id) {
        if (!config || id === config.gitlab.activeServerId) return;
        setConnStatus((c) => ({ ...c, gl: "" })); // 切换后旧状态不再代表当前选择，回到「检测中」
        applyConfig({ ...config, gitlab: { ...config.gitlab, activeServerId: id } });
      }
      function switchProject(path) {
        if (!config || !glServer || path === glServer.projectPath) return;
        const servers = config.gitlab.servers.map((s) => (s.id === glServer.id ? { ...s, projectPath: path } : s));
        applyConfig({ ...config, gitlab: { ...config.gitlab, servers } });
      }
      function switchKubeconfig(id) {
        if (!config || id === config.k8s.activeKubeconfigId) return;
        setConnStatus((c) => ({ ...c, k8s: "" }));
        applyConfig({ ...config, k8s: { ...config.k8s, activeKubeconfigId: id } });
      }
      function switchContext(ctx) {
        if (!config || !k8sKc || ctx === k8sKc.context) return;
        const kubeconfigs = config.k8s.kubeconfigs.map((k) => (k.id === k8sKc.id ? { ...k, context: ctx, namespace: "" } : k));
        applyConfig({ ...config, k8s: { ...config.k8s, kubeconfigs } });
      }
      function switchNamespace(ns) {
        if (!config || !k8sKc || ns === k8sKc.namespace) return;
        const kubeconfigs = config.k8s.kubeconfigs.map((k) => (k.id === k8sKc.id ? { ...k, namespace: ns } : k));
        applyConfig({ ...config, k8s: { ...config.k8s, kubeconfigs } });
      }

      // Context bar 下拉数据：跟随 active server / kubeconfig 拉取
      useEffect(() => {
        if (!glServer?.baseUrl || !glServer?.token) return;
        const key = `${glServer.id}:${glServer.projectPath}`;
        if (barOpts.key === key) return;
        let stale = false;
        let timer = null;
        // GitLab 冷启动时项目列表可能超时，失败自动重试（最多 3 次）
        const fetchProjects = (attempt) => {
          apiCall("gitlab-projects", { baseUrl: glServer.baseUrl, token: glServer.token })
            .then((r) => {
              if (stale) return;
              if (r.ok && r.projects?.length) {
                setBarOpts((o) => ({ ...o, projects: r.projects, key }));
                setConnStatus((c) => ({ ...c, gl: "ok" }));
              } else if (attempt < 2) {
                timer = setTimeout(() => fetchProjects(attempt + 1), 6000);
              } else {
                setConnStatus((c) => ({ ...c, gl: "err" }));
              }
            })
            .catch(() => { if (!stale && attempt < 2) timer = setTimeout(() => fetchProjects(attempt + 1), 6000); else setConnStatus((c) => ({ ...c, gl: "err" })); });
        };
        fetchProjects(0);
        return () => { stale = true; if (timer) clearTimeout(timer); };
      }, [glServer?.id, glServer?.projectPath, glServer?.baseUrl, glServer?.token]);
      useEffect(() => {
        if (!k8sKc?.path) return;
        const key = `kc:${k8sKc.id}:${k8sKc.context}`;
        let stale = false;
        apiCall("k8s-contexts", { kubeconfigPath: k8sKc.path })
          .then((r) => {
            if (stale) return;
            setBarOpts((o) => ({ ...o, contexts: r.ok ? r.contexts : [] }));
            setConnStatus((c) => ({ ...c, k8s: r.ok ? "ok" : "err" }));
          })
          .catch(() => { if (!stale) setConnStatus((c) => ({ ...c, k8s: "err" })); });
        apiCall("k8s-namespaces", { kubeconfigPath: k8sKc.path, context: k8sKc.context })
          .then((r) => { if (!stale) setBarOpts((o) => ({ ...o, namespaces: r.ok ? r.namespaces : [] })); })
          .catch(() => {});
        return () => { stale = true; };
      }, [k8sKc?.id, k8sKc?.path, k8sKc?.context]);

      // MR / Tag 表单下拉数据：表单打开时按项目拉取（失败自动重试一次）
      useEffect(() => {
        if ((!newMrOpen && !newTagOpen) || !glServer?.baseUrl || !glServer?.token || !glServer?.projectPath) return;
        const projectKey = `${glServer.id}:${glServer.projectPath}`;
        if (formOpts.projectKey === projectKey && (formOpts.branches.length || formOpts.members.length)) return;
        let stale = false;
        let timer = null;
        const fetchOpts = (attempt) => {
          setFormOpts((o) => ({ ...o, loading: true, projectKey }));
          Promise.all([
            apiCall("gitlab-branches", { baseUrl: glServer.baseUrl, token: glServer.token, path: glServer.projectPath }).catch(() => ({ ok: false })),
            apiCall("gitlab-members", { baseUrl: glServer.baseUrl, token: glServer.token, path: glServer.projectPath }).catch(() => ({ ok: false })),
          ]).then(([br, mem]) => {
            if (stale) return;
            const ok = br.ok || mem.ok;
            setFormOpts({
              branches: br.ok ? br.branches : [],
              members: mem.ok ? mem.members : [],
              loading: false,
              projectKey,
            });
            if (!ok && attempt < 1) timer = setTimeout(() => fetchOpts(attempt + 1), 5000);
          });
        };
        fetchOpts(0);
        return () => { stale = true; if (timer) clearTimeout(timer); };
      }, [newMrOpen, newTagOpen, glServer?.id, glServer?.projectPath]);

      // 分支列表到位后给 MR / Tag 表单填默认值
      useEffect(() => {
        if (!formOpts.branches.length) return;
        const def = formOpts.branches.find((b) => b.isDefault)?.name || glServer?.branch || "main";
        setMrTarget((v) => v || def);
        setMrSource((v) => v || glServer?.branch || "");
        setTagRefSel((v) => v || def);
      }, [formOpts.branches, formOpts.projectKey]);

      // 分支名 → 类型前缀：feature/login → "feat"
      function genMrType(branch) {
        const m = /^(feature|feat|fix|bugfix|hotfix|chore|refactor|docs|test)[/-]/.exec(branch || "");
        if (!m) return null;
        return ["fix", "bugfix", "hotfix"].includes(m[1]) ? "fix"
          : ["chore", "refactor", "docs", "test"].includes(m[1]) ? m[1]
          : "feat";
      }
      const mrAutoRef = useRef({ title: "", desc: "" }); // 记录上次自动生成的内容；用户改过则不再动
      // 选完 Source/Target 分支自动生成 Title / Description（源分支合并到目标分支的信息 + 源分支最新提交；仅填充空字段或仍是上次自动生成的内容）
      useEffect(() => {
        if (!newMrOpen || !mrSource || !mrTarget || mrSource === mrTarget) return;
        const type = genMrType(mrSource);
        const words = mrSource.replace(/^(feature|feat|fix|bugfix|hotfix|chore|refactor|docs|test)[/-]/, "").replace(/[-_]+/g, " ");
        const autoTitle = type ? `${type}: ${words}${t("autoTitleSuffix", { s: mrSource, t: mrTarget })}` : `merge ${mrSource} into ${mrTarget}`;
        const titleInput = mrTitleRef.current;
        if (titleInput && (!titleInput.value || titleInput.value === mrAutoRef.current.title)) titleInput.value = autoTitle;
        mrAutoRef.current.title = autoTitle;
        // Description：源分支最新一次提交的信息（异步取，期间用户填了就不覆盖）
        if (mrDescRef.current && (!mrDescRef.current.value || mrDescRef.current.value === mrAutoRef.current.desc) && glServer?.baseUrl && glServer?.token && glServer?.projectPath) {
          const seq = ++mrDescSeqRef.current;
          apiCall("gitlab-last-commit", { baseUrl: glServer.baseUrl, token: glServer.token, path: glServer.projectPath, branch: mrSource })
            .then((r) => {
              const d = mrDescRef.current;
              if (!r.ok || !d || d.value || seq !== mrDescSeqRef.current) return;
              const authorSuffix = r.author ? `（${r.author}）` : "";
              const lines = [t("descHead"), "", "- ", "", t("descCommit"), "", `- \`${r.shortId}\` ${r.title}${authorSuffix}`, "", t("descSource"), "", t("descBranch", { s: mrSource, t: mrTarget })];
              d.value = lines.join("\n");
              mrAutoRef.current.desc = d.value;
            })
            .catch(() => {});
        }
      }, [newMrOpen, mrSource, mrTarget]);

      // ─── Actions ────────────────────────────────────────────────────────────────

      async function handleNewMr() {
        if (!glServer || !glServer.projectPath) return;
        const source = (mrSource || "").trim();
        const target = (mrTarget || "").trim();
        const title = (mrTitleRef.current?.value || "").trim();
        const reviewers = (mrReviewers || "").trim();
        const description = (mrDescRef.current?.value || "").trim();
        if (!source || !target || !title) { setToast({ msg: t("fillMr"), tone: "warn" }); return; }
        setBusy(true);
        try {
          const r = await apiCall("gitlab-create-mr", { baseUrl: glServer.baseUrl, token: glServer.token, projectPath: glServer.projectPath, sourceBranch: source, targetBranch: target, title, description, reviewers });
          if (r.ok) { setToast({ msg: t("mrCreated", { iid: r.mergeRequest.iid }), tone: "ok" }); setNewMrOpen(false); fetchData(config); }
          else setToast({ msg: r.message || t("mrFail"), tone: "err" });
        } catch (e) { setToast({ msg: e.message || t("createFail"), tone: "err" }); }
        finally { setBusy(false); }
      }

      // 从历史 Tag 生成新版本号：语义化版本 patch+1（两位数则补 patch 位），无法解析则加 -next 后缀
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
        const tagName = (tagNameRef.current?.value || "").trim();
        const ref = (tagRefSel || "").trim();
        const message = (tagMsgRef.current?.value || "").trim();
        if (!tagName || !ref) { setToast({ msg: t("fillTag"), tone: "warn" }); return; }
        setBusy(true);
        try {
          const r = await apiCall("gitlab-create-tag", { baseUrl: glServer.baseUrl, token: glServer.token, projectPath: glServer.projectPath, tagName, ref, message });
          if (r.ok) { setToast({ msg: t("tagCreated", { name: tagName }), tone: "ok" }); setNewTagOpen(false); fetchData(config); }
          else setToast({ msg: r.message || t("tagFail"), tone: "err" });
        } catch (e) { setToast({ msg: e.message || t("createFail"), tone: "err" }); }
        finally { setBusy(false); }
      }

      async function handleApprove(mr) {
        if (!glCfg || !glProject) return;
        setBusy(true);
        try {
          const r = await apiCall("gitlab-mr-approve", { baseUrl: glCfg.baseUrl, token: glCfg.token, projectPath: glProject.path, mrIid: mr.iid });
          if (r.ok) { setToast({ msg: t("approved", { iid: mr.iid }) + (r.approvalsBeforeMerge != null ? t("remaining", { n: r.approvalsBeforeMerge }) : ""), tone: "ok" }); fetchData(config); }
          else setToast({ msg: r.message || t("approveFail"), tone: "err" });
        } catch (e) { setToast({ msg: e.message || t("approveFail"), tone: "err" }); }
        finally { setBusy(false); }
      }

      async function handlePipelineAction(p, action) {
        if (!glCfg || !glProject) return;
        setBusy(true);
        try {
          const r = await apiCall("gitlab-pipeline-action", { baseUrl: glCfg.baseUrl, token: glCfg.token, projectPath: glProject.path, pipelineId: p.id, action });
          if (r.ok) { setToast({ msg: t("pipAction", { id: p.id, action: action === "cancel" ? t("pipCanceled") : t("pipRetried") }), tone: "ok" }); fetchData(config); }
          else setToast({ msg: r.message || t("actionFail"), tone: "err" });
        } catch (e) { setToast({ msg: e.message || t("actionFail"), tone: "err" }); }
        finally { setBusy(false); }
      }

      async function handleMrClose(mr) {
        if (!glCfg || !glProject) return;
        setBusy(true);
        try {
          const r = await apiCall("gitlab-mr-action", { baseUrl: glCfg.baseUrl, token: glCfg.token, projectPath: glProject.path, mrIid: mr.iid, action: "close" });
          if (r.ok) { setToast({ msg: t("mrClosed", { iid: mr.iid }), tone: "ok" }); fetchData(config); }
          else setToast({ msg: r.message || t("closeFail"), tone: "err" });
        } catch (e) { setToast({ msg: e.message || t("closeFail"), tone: "err" }); }
        finally { setBusy(false); }
      }

      // Pipeline 展开：拉取该 pipeline 的 jobs
      function togglePipeDetail(p) {
        if (expandedPipe === p.id) { setExpandedPipe(null); return; }
        setExpandedPipe(p.id);
        setPipeJobs({ id: p.id, jobs: [], loading: true });
        apiCall("gitlab-pipeline-jobs", { baseUrl: glCfg.baseUrl, token: glCfg.token, projectPath: glProject.path, pipelineId: p.id })
          .then((r) => setPipeJobs({ id: p.id, jobs: r.ok ? r.jobs : [], loading: false }))
          .catch(() => setPipeJobs({ id: p.id, jobs: [], loading: false }));
      }

      // Deployment 展开它的 Pods（按 pod 名前缀匹配 deployment 名）
      function toggleDepDetail(d) {
        setExpandedDep((v) => (v === d.name ? null : d.name));
        setDepImgEdit(null);
      }
      function depPods(d) {
        return pods.filter((p) => p.name === d.name || p.name.startsWith(d.name + "-"));
      }

      // 更换镜像：提交编辑框里的新镜像
      async function handleSetImage(d) {
        if (!k8sKc) return;
        const image = (depImgRef.current?.value || "").trim();
        if (!image || image === d.image) { setDepImgEdit(null); return; }
        setBusy(true);
        try {
          const r = await apiCall("k8s-set-image", { kubeconfigPath: k8sKc.path, context: k8sKc.context, namespace: k8sKc.namespace || "default", name: d.name, image });
          if (r.ok) { setToast({ msg: t("imageUpdated", { name: d.name, image }), tone: "ok" }); setDepImgEdit(null); fetchData(config); }
          else setToast({ msg: r.message || t("imgFail"), tone: "err" });
        } catch (e) { setToast({ msg: e.message || t("imgFail"), tone: "err" }); }
        finally { setBusy(false); }
      }

      // 重启 deployment（滚动重建 pods）
      async function handleRestartDep(d) {
        if (!k8sKc) return;
        setBusy(true);
        try {
          const r = await apiCall("k8s-restart", { kubeconfigPath: k8sKc.path, context: k8sKc.context, namespace: k8sKc.namespace || "default", name: d.name });
          if (r.ok) { setToast({ msg: t("restarting", { name: d.name }), tone: "ok" }); fetchData(config); }
          else setToast({ msg: r.message || t("restartFail"), tone: "err" });
        } catch (e) { setToast({ msg: e.message || t("restartFail"), tone: "err" }); }
        finally { setBusy(false); }
      }

      async function handleViewPodLogs(pod) {
        if (!k8sKc) return;
        setLogView({ podName: pod.name, loading: true });
        try {
          const r = await apiCall("k8s-pod-logs", { kubeconfigPath: k8sKc.path, context: k8sKc.context, namespace: k8sKc.namespace || "default", podName: pod.name, tailLines: 200 });
          if (r.ok) setLogView({ podName: pod.name, logs: r.logs || "" });
          else setLogView({ podName: pod.name, err: r.message || t("logsFail") });
        } catch (e) { setLogView({ podName: pod.name, err: e.message || t("logsFail") }); }
      }

      // ─── Not configured state ───────────────────────────────────────────────────

      if (loading) {
        return h("div", { style: { padding: 24, textAlign: "center", color: "#888", fontSize: 13 } }, t("loading"));
      }

      if (!config || (!config.gitlab && !config.k8s)) {
        return h("div", { style: { padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 } },
          h("div", { style: { fontSize: 40 } }, "🖥️"),
          h("div", { style: { ...S.calloutInfo, textAlign: "center" } },
            h("strong", null, t("notCfgBig")),
            h("div", { style: { marginTop: 8 } }, t("goCfgHint")),
          ),
          h(Btn, { onClick: () => window.dispatchEvent(new CustomEvent("dsh:open-settings", { detail: { section: "dsh-devops" } })), small: true, variant: "outline" }, t("goCfg")),
        );
      }

      // ─── Derived data ───────────────────────────────────────────────────────────

      const mrs = live?.mrs?.mergeRequests || [];
      const pipelines = live?.pipelines?.pipelines || [];
      const tags = live?.tags?.tags || [];
      const deployments = live?.deployments?.deployments || [];
      const pods = live?.pods?.pods || [];
      const events = live?.events?.events || [];

      const runningPips = pipelines.filter((p) => PIPELINE_RUNNING.includes(p.status)).length;
      const okPips = pipelines.filter((p) => p.status === "success").length;
      const failPips = pipelines.filter((p) => p.status === "failed").length;
      const pendingApproval = mrs.filter((m) => (m.approvalsBeforeMerge ?? 0) > 0).length;
      const depFail = deployments.filter((d) => d.replicas > 0 && d.ready === 0).length;
      const depProg = deployments.filter((d) => d.replicas > 0 && d.ready > 0 && d.ready < d.replicas).length;
      const crashPods = pods.filter((p) => p.restarts > 0).length;
      const pendPods = pods.filter((p) => p.phase === "Pending").length;

      const rowStyle = { display: "flex", alignItems: "flex-start", gap: 8, padding: "7px 10px", borderRadius: 6, background: "var(--ds-alias-surface-inset,#1a1a1a)", fontSize: 12 };
      const insetRow = { display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, background: "var(--ds-alias-surface-inset,#1a1a1a)", fontSize: 12 };

      // ─── Activity feed ────────────────────────────────────────────────────────────

      const feed = [];
      mrs.forEach((mr) => feed.push({ t: mr.updatedAt, icon: "🔄", tone: (mr.approvalsBeforeMerge ?? 0) > 0 ? "warn" : "ok", text: `!${mr.iid} ${mr.title} → ${mr.targetBranch}`, extra: (mr.approvalsBeforeMerge ?? 0) > 0 ? t("pending", { n: mr.approvalsBeforeMerge }) : (mr.draft ? "Draft" : t("mergeable")), who: mr.author }));
      pipelines.forEach((p) => feed.push({ t: p.updatedAt || p.createdAt, icon: p.status === "success" ? "✅" : p.status === "failed" ? "❌" : "⏳", tone: p.status === "failed" ? "err" : p.status === "success" ? "ok" : "warn", text: `pipeline ${p.ref} #${p.id} ${p.status}` }));
      deployments.forEach((d) => feed.push({ t: d.updated, icon: "📦", tone: d.replicas > 0 && d.ready === d.replicas ? "ok" : d.ready === 0 ? "err" : "warn", text: `${d.name} ${d.ready}/${d.replicas} ready`, extra: d.imageTag }));
      pods.forEach((pod) => { if (pod.restarts > 0) feed.push({ t: pod.startedAt, icon: "🔁", tone: "warn", text: `pod ${pod.name} ${t("restartsN", { n: pod.restarts })}`, extra: pod.reason }); });
      events.forEach((ev) => feed.push({ t: ev.time, icon: ev.type === "Warning" ? "⚠️" : "•", tone: ev.type === "Warning" ? "err" : "ok", text: `${ev.reason} ${ev.object}`, extra: ev.message }));
      feed.forEach((it) => { it.ts = it.t ? new Date(it.t).getTime() : 0; });
      feed.sort((a, b) => b.ts - a.ts);
      const activityItems = feed.slice(0, 30);

      // ─── Render ─────────────────────────────────────────────────────────────────

      const glServers = config?.gitlab?.servers || [];
      const kcList = config?.k8s?.kubeconfigs || [];
      // 卡片内下拉统一样式（栅格内自动伸缩，不换行）
      const cardSelect = { ...S.select, fontSize: 11, padding: "3px 6px", width: "100%", minWidth: 0 };
      // 切换卡片：标题 + 连接状态点 + 内容
      function SwitchCard({ icon, title, status, children }) {
        const statusMap = { ok: { tone: "ok", text: t("connected") }, err: { tone: "err", text: t("connectFailed") } };
        const st = statusMap[status];
        return h("div", { style: { border: "1px solid var(--ds-alias-border,#2a2a2a)", borderRadius: 8, background: "var(--ds-alias-surface,#141414)", padding: "8px 10px 10px", display: "flex", flexDirection: "column", gap: 6 } },
          h("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
            h("span", { style: { fontSize: 12 } }, icon),
            h("span", { style: { fontSize: 11, fontWeight: 600, color: "#ddd" } }, title),
            h("span", { style: { flex: 1 } }),
            st
              ? h("span", { style: { display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: st.tone === "ok" ? "#34c759" : "#ff453a" } },
                  h(Dot, { tone: st.tone, pulse: st.tone === "err" }), st.text)
              : h("span", { style: { fontSize: 10, color: "#666" } }, status === "" ? t("detecting") : t("notConfigured")),
          ),
          children,
        );
      }
      const fieldLabel = { fontSize: 10, color: "#888", marginBottom: 2 };

      return h("div", { style: { padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 } },
        h("style", null, "@keyframes dshPulse{0%,100%{opacity:1}50%{opacity:0.35}}"),

        // 语言切换
        h("div", { style: { display: "flex" } }, h(LangToggle)),

        // ─── 双卡片切换区（每套 GitLab 地址 / kubeconfig 是一个整体配置对象，切换即保存刷新）───
        // 卡片 1：📦 GitLab（服务器 + 项目）
        h(SwitchCard, { icon: "📦", title: "GitLab", status: glServers.length === 0 ? "none" : connStatus.gl },
          h("div", { style: { display: "grid", gridTemplateColumns: "minmax(120px, 160px) 1fr", gap: 8 } },
            h("div", null,
              h("div", { style: fieldLabel }, t("server")),
              h(Select, {
                name: "server",
                value: config.gitlab.activeServerId || "",
                onChange: switchServer,
                disabled: glServers.length <= 1,
                style: cardSelect,
                placeholder: glServers.length ? t("server") : t("notConfigured"),
                options: glServers.map((s) => ({ value: s.id, label: s.label || s.baseUrl })),
              }),
            ),
            h("div", null,
              h("div", { style: fieldLabel }, t("project")),
              h(Select, {
                name: "project",
                value: glServer?.projectPath || "",
                onChange: switchProject,
                disabled: !glServer?.baseUrl || !glServer?.token,
                style: cardSelect,
                placeholder: !glServer?.baseUrl ? t("glNotCfg") : barOpts.projects.length ? t("selProject") : t("loadingProjects"),
                options: (() => {
                  const opts = barOpts.projects.map((p) => ({ value: p.path, label: p.path }));
                  const cur = glServer?.projectPath;
                  if (cur && !barOpts.projects.some((p) => p.path === cur)) opts.unshift({ value: cur, label: cur });
                  return opts;
                })(),
              }),
            ),
          ),
        ),

        // 卡片 2：☸️ Kubernetes（kubeconfig + context + namespace）
        h(SwitchCard, { icon: "☸️", title: "Kubernetes", status: kcList.length === 0 ? "none" : connStatus.k8s },
          h("div", { style: { display: "grid", gridTemplateColumns: "minmax(120px, 160px) 1fr 1fr", gap: 8 } },
            h("div", null,
              h("div", { style: fieldLabel }, t("configFile")),
              h(Select, {
                name: "kubeconfig",
                value: config.k8s.activeKubeconfigId || "",
                onChange: switchKubeconfig,
                disabled: kcList.length <= 1,
                style: cardSelect,
                placeholder: kcList.length ? t("configFile") : t("notConfigured"),
                options: kcList.map((k) => ({ value: k.id, label: k.label || k.path })),
              }),
            ),
            h("div", null,
              h("div", { style: fieldLabel }, "Context"),
              h(Select, {
                name: "context",
                value: k8sKc?.context || "",
                onChange: switchContext,
                disabled: !k8sKc?.path,
                style: cardSelect,
                placeholder: k8sKc?.path ? t("ctxPh") : t("notConfigured"),
                options: barOpts.contexts.length > 0
                  ? barOpts.contexts.map((c) => ({ value: c.name, label: c.name }))
                  : (k8sKc?.context ? [{ value: k8sKc.context, label: k8sKc.context }] : []),
              }),
            ),
            h("div", null,
              h("div", { style: fieldLabel }, "Namespace"),
              h(Select, {
                name: "namespace",
                value: k8sKc?.namespace || "",
                onChange: switchNamespace,
                disabled: !k8sKc?.path,
                style: cardSelect,
                placeholder: k8sKc?.path ? t("nsPh") : t("notConfigured"),
                options: (() => {
                  const nsList = barOpts.namespaces.map((n) => ({ value: n, label: n }));
                  const cur = k8sKc?.namespace;
                  if (cur && !barOpts.namespaces.includes(cur)) nsList.unshift({ value: cur, label: cur });
                  return nsList;
                })(),
              }),
            ),
          ),
        ),

        // Toast
        toast
          ? h("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, fontSize: 12, background: toast.tone === "err" ? "rgba(255,69,58,0.12)" : toast.tone === "warn" ? "rgba(251,191,36,0.12)" : "rgba(52,199,89,0.12)", border: `1px solid ${toast.tone === "err" ? "rgba(255,69,58,0.4)" : toast.tone === "warn" ? "rgba(251,191,36,0.4)" : "rgba(52,199,89,0.4)"}`, color: toast.tone === "err" ? "#ff8a80" : toast.tone === "warn" ? "#fbbf24" : "#34c759" } },
              h("span", null, toast.tone === "err" ? "✗" : toast.tone === "warn" ? "!" : "✓"),
              h("span", { style: { color: "#ddd" } }, toast.msg),
            )
          : null,

        // Stat cards grid
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 } },
          h(StatCard, { icon: "🔄", title: t("statMrsTitle"), value: glProject ? mrs.length : "—", sub: glProject ? t("statMrsSub", { p: pendingApproval, r: runningPips }) : t("notConfigured"), tone: !glProject ? "neutral" : pendingApproval > 0 ? "warn" : mrs.length ? "ok" : "neutral", subTone: pendingApproval > 0 ? "#fbbf24" : "#888" }),
          h(StatCard, { icon: "🔀", title: t("statPipsTitle"), value: glProject ? pipelines.length : "—", sub: glProject ? t("statPipSub", { r: runningPips, o: okPips, f: failPips }) : t("notConfigured"), tone: !glProject ? "neutral" : failPips > 0 ? "err" : runningPips > 0 ? "warn" : okPips > 0 ? "ok" : "neutral", subTone: failPips > 0 ? "#ff8a80" : "#888" }),
          h(StatCard, { icon: "📦", title: t("statDepsTitle"), value: k8sKc ? deployments.length : "—", sub: k8sKc ? t("statDepSub", { f: depFail, p: depProg }) : t("notConfigured"), tone: !k8sKc ? "neutral" : depFail > 0 ? "err" : depProg > 0 ? "warn" : deployments.length ? "ok" : "neutral", subTone: depFail > 0 ? "#ff8a80" : "#888" }),
          h(StatCard, { icon: "🐳", title: t("statPodsTitle"), value: k8sKc ? crashPods + pendPods : "—", sub: k8sKc ? t("statPodSub", { c: crashPods, p: pendPods }) : t("notConfigured"), tone: !k8sKc ? "neutral" : crashPods > 0 ? "err" : pendPods > 0 ? "warn" : pods.length ? "ok" : "neutral", subTone: crashPods > 0 ? "#ff8a80" : "#888" }),
        ),

        // Sub-tabs
        h(TabBar, {
          tabs: [
            { id: "gitlab", label: "GitLab" },
            { id: "k8s", label: "K8s" },
            { id: "activity", label: t("tabActivity") },
            { id: "logs", label: t("logs") },
          ],
          active: activeTab,
          onChange: setActiveTab,
        }),

        // Tab content
        h("div", { style: { maxHeight: 480, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 } },

          // ─── GitLab tab ───
          activeTab === "gitlab" && (
            glCfg
              ? h("div", { style: { display: "flex", flexDirection: "column", gap: 14 } },
                  // Merge Requests
                  h("div", null,
                    h(SecHeader, { icon: "🔄", title: t("secMrs"), badge: mrs.length, badgeTone: pendingApproval > 0 ? "warn" : "ok", onNew: () => setNewMrOpen((o) => !o), newLabel: t("newMrBtn") }),
                    newMrOpen && h("div", { style: { border: "1px solid var(--ds-alias-border,#333)", borderRadius: 8, padding: 12, background: "var(--ds-alias-surface-inset,#191919)", display: "flex", flexDirection: "column", gap: 8 } },
                      h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } },
                        h("div", null,
                          h("div", { style: { fontSize: 11, color: "#888", marginBottom: 3 } }, t("sourceBranch")),
                          h(Select, {
                            value: mrSource,
                            onChange: setMrSource,
                            placeholder: formOpts.loading ? t("loadingBr") : t("selBranch"),
                            options: [
                              ...(mrSource && !formOpts.branches.some((b) => b.name === mrSource) ? [mrSource] : []),
                              ...formOpts.branches.map((b) => ({ value: b.name, label: b.isDefault ? b.name + t("defaultSuffix") : b.name })),
                            ],
                          })),
                        h("div", null,
                          h("div", { style: { fontSize: 11, color: "#888", marginBottom: 3 } }, t("targetBranch")),
                          h(Select, {
                            value: mrTarget,
                            onChange: setMrTarget,
                            placeholder: formOpts.loading ? t("loadingBr") : t("selBranch"),
                            options: [
                              ...(mrTarget && !formOpts.branches.some((b) => b.name === mrTarget) ? [mrTarget] : []),
                              ...formOpts.branches.map((b) => ({ value: b.name, label: b.isDefault ? b.name + t("defaultSuffix") : b.name })),
                            ],
                          })),
                      ),
                      h("div", null,
                        h("div", { style: { fontSize: 11, color: "#888", marginBottom: 3 } }, t("titleLabel")),
                        h("input", { ref: mrTitleRef, style: S.input, placeholder: "feat: ..." })),
                      h("div", null,
                        h("div", { style: { fontSize: 11, color: "#888", marginBottom: 3 } }, t("reviewersLabel")),
                        formOpts.members.length > 0
                          ? h(Select, {
                              value: "",
                              onChange: (username) => {
                                if (!username) return;
                                const cur = (mrReviewers || "").split(",").map((s) => s.trim()).filter(Boolean);
                                if (!cur.includes(username)) cur.push(username);
                                setMrReviewers(cur.join(", "));
                              },
                              placeholder: formOpts.loading ? t("loadingMem") : t("selReviewer"),
                              options: formOpts.members
                                .filter((m) => !(mrReviewers || "").split(",").map((x) => x.trim()).includes(m.username))
                                .map((m) => ({ value: m.username, label: `${m.username}（${m.name || m.username}）` })),
                            })
                          : h("div", { style: { fontSize: 11, color: "#666" } }, formOpts.loading ? t("loadingMem") : t("noMem")),
                        (mrReviewers || "").trim() && h("div", { style: { display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 } },
                          (mrReviewers || "").split(",").map((s) => s.trim()).filter(Boolean).map((u) =>
                            h("span", { key: u, style: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 4px 2px 8px", borderRadius: 10, background: "var(--ds-alias-primary, #4a9eff)", color: "#fff" } },
                              u,
                              h("span", {
                                style: { cursor: "pointer", width: 14, height: 14, lineHeight: "13px", textAlign: "center", borderRadius: "50%", background: "rgba(255,255,255,0.25)", fontSize: 10 },
                                onClick: () => setMrReviewers((mrReviewers || "").split(",").map((x) => x.trim()).filter((x) => x && x !== u).join(", ")),
                              }, "×"),
                            ),
                          ),
                        ),
                      ),
                      h("div", null,
                        h("div", { style: { fontSize: 11, color: "#888", marginBottom: 3 } }, t("descLabel")),
                        h("textarea", { ref: mrDescRef, style: { ...S.input, resize: "vertical", minHeight: 54 }, placeholder: t("descPh") })),
                      h("div", { style: { display: "flex", gap: 8, alignItems: "center" } },
                        h(Btn, { onClick: handleNewMr, small: true, tone: "success", disabled: busy }, t("createMr")),
                        h(Btn, { onClick: () => setNewMrOpen(false), small: true, variant: "outline" }, t("cancel")),
                      ),
                    ),
                    mrs.length === 0
                      ? h(EmptyHint, null, t("noMrs"))
                      : mrs.map((mr) => {
                          const ms = mr.mergeStatus || "unchecked";
                          const dotTone = ms === "can_be_merged" ? "ok" : ms === "cannot_be_merged" ? "err" : "warn";
                          return h("div", { key: mr.iid, style: rowStyle },
                            h(Dot, { tone: dotTone }),
                            h("div", { style: { flex: 1, minWidth: 0 } },
                              h("div", { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" } },
                                h("span", { style: { fontWeight: 600 } }, `!${mr.iid}`),
                                h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, mr.title),
                                mr.draft || mr.workInProgress ? h(Badge, { tone: "accent" }, mr.draft ? "Draft" : "WIP") : null,
                                (mr.approvalsBeforeMerge ?? 0) > 0
                                  ? h(Badge, { tone: "warn" }, t("pending", { n: mr.approvalsBeforeMerge }))
                                  : h(Badge, { tone: "ok" }, t("mergeable")),
                              ),
                              h("div", { style: { color: "#888", fontSize: 11, marginTop: 2 } }, `${mr.sourceBranch} → ${mr.targetBranch} · ${mr.author} · ${timeAgo(mr.updatedAt)}`),
                            ),
                            h("div", { style: { display: "flex", gap: 5, flexShrink: 0 } },
                              h(ChipBtn, { children: t("approve"), tone: "primary", disabled: busy, onClick: () => handleApprove(mr) }),
                              h(ChipBtn, { children: t("close"), tone: "danger", disabled: busy, onClick: () => handleMrClose(mr) }),
                              mr.webUrl ? h(ChipBtn, { children: "↗", title: t("openInGl"), onClick: () => window.open(mr.webUrl, "_blank") }) : null,
                            ),
                          );
                        }),
                  ),
                  // Tags
                  h("div", null,
                    h(SecHeader, { icon: "🏷️", title: t("secTags"), badge: tags.length, onNew: () => setNewTagOpen((o) => !o), newLabel: t("newTagBtn") }),
                    newTagOpen && h("div", { style: { border: "1px solid var(--ds-alias-border,#333)", borderRadius: 8, padding: 12, background: "var(--ds-alias-surface-inset,#191919)", display: "flex", flexDirection: "column", gap: 8 } },
                      // 历史 Tag 快捷创建：选中后自动把 patch+1 的新版本号填进 Tag Name（Ref 由用户自行选择）
                      tags.length > 0 && h("div", null,
                        h("div", { style: { fontSize: 11, color: "#888", marginBottom: 3 } }, t("histTag")),
                        h(Select, {
                          value: "",
                          onChange: pickHistoryTag,
                          placeholder: t("pickHist"),
                          options: tags.map((t) => ({ value: t.name, label: `${t.name} → ${bumpPatch(t.name)} · ${timeAgo(t.createdAt)}` })),
                        }),
                      ),
                      h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } },
                        h("div", null,
                          h("div", { style: { fontSize: 11, color: "#888", marginBottom: 3 } }, t("tagNameLabel")),
                          h("input", {
                            ref: tagNameRef, style: S.input, placeholder: "v1.2.0",
                            list: "dsh-devops-tag-names",
                          }),
                          tags.length > 0
                            ? h("datalist", { id: "dsh-devops-tag-names" },
                                tags.map((t) => h("option", { key: t.name, value: t.name })))
                            : null),
                        h("div", null,
                          h("div", { style: { fontSize: 11, color: "#888", marginBottom: 3 } }, t("refLabel")),
                          h(Select, {
                            value: tagRefSel,
                            onChange: setTagRefSel,
                            placeholder: formOpts.loading ? t("loadingShort") : t("selRef"),
                            options: [
                              ...(tagRefSel && !formOpts.branches.some((b) => b.name === tagRefSel) && !tags.some((t) => t.name === tagRefSel) ? [tagRefSel] : []),
                              ...formOpts.branches.map((b) => ({ value: b.name, label: `⑂ ${b.name}${b.isDefault ? t("defaultSuffix") : ""}` })),
                              ...tags.map((t) => ({ value: t.name, label: `🏷 ${t.name}` })),
                            ],
                          })),
                      ),
                      h("div", null,
                        h("div", { style: { fontSize: 11, color: "#888", marginBottom: 3 } }, t("msgLabel")),
                        h("input", { ref: tagMsgRef, style: S.input, placeholder: t("releasePh") })),
                      h("div", { style: { display: "flex", gap: 8, alignItems: "center" } },
                        h(Btn, { onClick: handleNewTag, small: true, tone: "success", disabled: busy }, t("createTag")),
                        h(Btn, { onClick: () => setNewTagOpen(false), small: true, variant: "outline" }, t("cancel")),
                      ),
                    ),
                    tags.length === 0
                      ? h(EmptyHint, null, t("noTags"))
                      : tags.slice(0, 6).map((t) => h("div", { key: t.name, style: insetRow },
                          h("span", null, "🏷️"),
                          h("span", { style: { fontWeight: 600, fontFamily: "monospace" } }, t.name),
                          t.message ? h("span", { style: { color: "#888", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, t.message) : h("span", { style: { flex: 1 } }),
                          h("span", { style: { color: "#666", fontSize: 11 } }, timeAgo(t.createdAt)),
                        )),
                  ),
                  // Pipelines
                  h("div", null,
                    h(SecHeader, { icon: "🔀", title: t("statPipsTitle"), badge: pipelines.length, badgeTone: failPips > 0 ? "err" : runningPips > 0 ? "warn" : "neutral" }),
                    pipelines.length === 0
                      ? h(EmptyHint, null, t("noPips"))
                      : pipelines.map((p) => {
                          const run = PIPELINE_RUNNING.includes(p.status);
                          const dot = p.status === "success" ? "ok" : p.status === "failed" ? "err" : run ? "warn" : "neutral";
                          const open = expandedPipe === p.id;
                          return h("div", { key: p.id, style: { display: "flex", flexDirection: "column", gap: 4 } },
                            h("div", { style: insetRow },
                              h("span", {
                                onClick: () => togglePipeDetail(p),
                                style: { cursor: "pointer", color: "#888", fontSize: 10, width: 14, textAlign: "center", flexShrink: 0 },
                              }, open ? "▾" : "▸"),
                              h(Dot, { tone: dot, pulse: run }),
                              h("span", { style: { fontWeight: 600, cursor: "pointer" }, onClick: () => togglePipeDetail(p) }, `#${p.id}`),
                              h("span", { style: { color: "#ccc" } }, p.ref),
                              p.sha ? h("span", { style: { color: "#666", fontFamily: "monospace", fontSize: 11 } }, p.sha) : null,
                              h("span", { style: { flex: 1 } }),
                              h("span", { style: { color: "#888", fontSize: 11 } }, timeAgo(p.updatedAt || p.createdAt)),
                              run ? h(ChipBtn, { children: t("cancel"), tone: "danger", disabled: busy, onClick: () => handlePipelineAction(p, "cancel") }) : null,
                              p.status === "failed" ? h(ChipBtn, { children: t("retry"), tone: "primary", disabled: busy, onClick: () => handlePipelineAction(p, "retry") }) : null,
                            ),
                            // 展开区：该 pipeline 的 jobs 明细
                            open && h("div", { style: { padding: "4px 10px 6px 28px", display: "flex", flexDirection: "column", gap: 3 } },
                              pipeJobs.id === p.id && pipeJobs.loading
                                ? h("div", { style: { color: "#555", fontSize: 11 } }, t("loadingJobs"))
                                : (pipeJobs.id === p.id ? pipeJobs.jobs : []).length === 0
                                  ? h("div", { style: { color: "#555", fontSize: 11 } }, t("noJobs"))
                                  : (pipeJobs.id === p.id ? pipeJobs.jobs : []).map((j) => {
                                      const jdot = j.status === "success" ? "ok" : j.status === "failed" ? "err" : ["created", "pending", "running", "queued", "scheduled", "waiting_for_resource", "preparing"].includes(j.status) ? "warn" : "neutral";
                                      return h("div", { key: j.id, style: { display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#ccc", padding: "3px 8px", borderRadius: 4, background: "rgba(255,255,255,0.03)" } },
                                        h(Dot, { tone: jdot, pulse: jdot === "warn" }),
                                        h("span", { style: { fontWeight: 500 } }, j.name),
                                        h("span", { style: { color: "#666" } }, j.stage),
                                        h("span", { style: { color: "#888" } }, j.status),
                                        j.failureReason ? h("span", { style: { color: "#ff8a80" } }, j.failureReason) : null,
                                        h("span", { style: { flex: 1 } }),
                                        j.duration != null ? h("span", { style: { color: "#666", fontSize: 10 } }, `${Math.round(j.duration)}s`) : null,
                                      );
                                    }),
                            ),
                          );
                        }),
                  ),
                )
              : h(EmptyHint, null, t("glNotCfg2"))
          ),

          // ─── K8s tab ───
          activeTab === "k8s" && (
            k8sKc
              ? h("div", { style: { display: "flex", flexDirection: "column", gap: 14 } },
                  // Deployments（展开查看 Pods；支持换镜像 / 重启）
                  h("div", null,
                    h(SecHeader, { icon: "📦", title: t("statDepsTitle"), badge: deployments.length, badgeTone: depFail > 0 ? "err" : depProg > 0 ? "warn" : "ok" }),
                    deployments.length === 0
                      ? h(EmptyHint, null, t("noDeps"))
                      : deployments.map((d) => {
                          const st = d.replicas > 0 && d.ready === d.replicas ? "ok" : d.ready === 0 ? "err" : "warn";
                          const open = expandedDep === d.name;
                          const depPodList = depPods(d);
                          return h("div", { key: d.name, style: { display: "flex", flexDirection: "column", gap: 4 } },
                            h("div", { style: insetRow },
                              h("span", {
                                onClick: () => toggleDepDetail(d),
                                style: { cursor: "pointer", color: "#888", fontSize: 10, width: 14, textAlign: "center", flexShrink: 0 },
                              }, open ? "▾" : "▸"),
                              h(Dot, { tone: st }),
                              h("div", { style: { flex: 1, minWidth: 0, cursor: "pointer" }, onClick: () => toggleDepDetail(d) },
                                h("div", { style: { fontFamily: "monospace", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, d.name),
                                h("div", { style: { color: "#888", fontSize: 11 } }, `${d.ready}/${d.replicas} ${t("ready")} · ${d.imageTag || "—"} · ${timeAgo(d.updated)}`),
                              ),
                              st === "ok" ? h(Badge, { tone: "ok" }, t("runningBadge")) : h(Badge, { tone: st }, t("issueN", { n: d.replicas - d.ready })),
                              h(ChipBtn, { children: depImgEdit === d.name ? t("cancel") : t("setImage"), tone: "ghost", disabled: busy, onClick: () => setDepImgEdit(depImgEdit === d.name ? null : d.name) }),
                              h(ChipBtn, { children: t("restart"), tone: "ghost", disabled: busy, onClick: () => handleRestartDep(d) }),
                            ),
                            // 换镜像编辑行
                            depImgEdit === d.name && h("div", { style: { display: "flex", gap: 6, padding: "0 10px 6px 28px" } },
                              h("input", {
                                ref: depImgRef,
                                defaultValue: d.image || "",
                                placeholder: "nginx:1.27",
                                style: { ...S.input, flex: 1, fontFamily: "monospace", fontSize: 11 },
                                onKeyDown: (e) => { if (e.key === "Enter") handleSetImage(d); },
                              }),
                              h(Btn, { onClick: () => handleSetImage(d), small: true, tone: "success", disabled: busy }, t("apply")),
                            ),
                            // 展开区：属于该 deployment 的 pods
                            open && h("div", { style: { padding: "2px 10px 6px 28px", display: "flex", flexDirection: "column", gap: 3 } },
                              depPodList.length === 0
                                ? h("div", { style: { color: "#555", fontSize: 11 } }, t("noPods"))
                                : depPodList.map((pod) => h("div", { key: pod.name, style: { display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#ccc", padding: "3px 8px", borderRadius: 4, background: "rgba(255,255,255,0.03)" } },
                                    h(Dot, { tone: pod.phase === "Running" ? "ok" : pod.phase === "Pending" ? "warn" : "err" }),
                                    h("span", { style: { fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, pod.name),
                                    (pod.reason || pod.restarts > 0) ? h("span", { style: { color: "#888" } }, `${pod.restarts > 0 ? t("restartsN", { n: pod.restarts }) + " · " : ""}${pod.reason || ""}`) : null,
                                    h("span", { style: { flex: 1 } }),
                                    pod.restarts > 0 ? h(Badge, { tone: "warn" }, `${pod.restarts}r`) : null,
                                    h(ChipBtn, { children: t("logs"), tone: "ghost", onClick: () => handleViewPodLogs(pod) }),
                                  )),
                            ),
                          );
                        }),
                    // pod 日志面板（从 deployment 展开的 pods 打开）
                    logView && h("div", { style: { border: "1px solid var(--ds-alias-border,#333)", borderRadius: 8, background: "#0d0d0d", padding: "10px 12px", fontFamily: "'Cascadia Code','Fira Code','JetBrains Mono',monospace", fontSize: 11, lineHeight: 1.6, maxHeight: 220, overflow: "auto" } },
                      h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontFamily: "sans-serif" } },
                        h("span", { style: { color: "#ccc", fontWeight: 600 } }, `▤ ${logView.podName}`),
                        h("span", { style: { flex: 1 } }),
                        h(ChipBtn, { children: t("close"), onClick: () => setLogView(null) }),
                      ),
                      logView.loading
                        ? h("div", { style: { color: "#555" } }, t("loadingLogs"))
                        : logView.err
                          ? h("div", { style: { color: "#ff8a80", whiteSpace: "pre-wrap", wordBreak: "break-all" } }, logView.err)
                          : h("div", { style: { color: "#8f8", whiteSpace: "pre-wrap", wordBreak: "break-all" } }, logView.logs || t("noLogs")),
                    ),
                  ),
                  // Events
                  h("div", null,
                    h(SecHeader, { icon: "📝", title: t("secEvents"), badge: events.length }),
                    events.length === 0
                      ? h(EmptyHint, null, t("noEvents"))
                      : events.slice(0, 12).map((ev, i) => h("div", { key: i, style: { padding: "6px 10px", borderRadius: 6, background: "var(--ds-alias-surface-inset,#1a1a1a)", fontSize: 12 } },
                          h("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 2 } },
                            h("span", { style: { color: ev.type === "Warning" ? "#ff8a80" : "#34c759", fontSize: 11, fontWeight: 600 } }, ev.type === "Warning" ? "⚠" : "•"),
                            h("span", { style: { color: "#888", fontSize: 11 } }, ev.reason),
                            h("span", { style: { flex: 1 } }),
                            h("span", { style: { color: "#666", fontSize: 10 } }, timeAgo(ev.time)),
                          ),
                          h("div", { style: { color: "#ccc", lineHeight: 1.4, wordBreak: "break-word" } }, ev.message),
                          h("div", { style: { color: "#666", fontSize: 10, marginTop: 2 } }, `${ev.kind} / ${ev.object}`),
                        )),
                  ),
                )
              : h(EmptyHint, null, t("k8sNotCfg2"))
          ),

          // ─── Activity tab ───
          activeTab === "activity" && (
            activityItems.length === 0
              ? h(EmptyHint, null, t("noActivity"))
              : h("div", { style: { display: "flex", flexDirection: "column", gap: 4 } },
                  activityItems.map((it, i) => h("div", { key: i, style: rowStyle },
                    h("span", { style: { fontSize: 12, flexShrink: 0 } }, it.icon),
                    h("div", { style: { flex: 1, minWidth: 0 } },
                      h("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
                        h("span", { style: { color: "#ddd", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, it.text),
                        it.extra ? h(Badge, { tone: it.tone }, it.extra) : null,
                      ),
                      it.who ? h("div", { style: { color: "#888", fontSize: 11, marginTop: 1 } }, it.who) : null,
                    ),
                    h("span", { style: { color: "#666", fontSize: 10, flexShrink: 0 } }, timeAgo(it.t)),
                  )),
                )
          ),

          // ─── Logs tab ───
          activeTab === "logs" && (
            h("div", { style: { display: "flex", flexDirection: "column", gap: 6, minHeight: 200 } },
              h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                h("span", { style: { fontSize: 11, color: "#888" } }, t("logsLast", { n: (logsData ?? []).length })),
                h(Btn, { onClick: async () => { try { const r = await apiCall("logs", { lines: 200 }); if (r.ok) setLogsData(r.lines || []); } catch {} }, small: true, variant: "outline" }, t("refresh")),
              ),
              h("div", {
                style: {
                  minHeight: 200, maxHeight: 400, overflow: "auto",
                  background: "#0d0d0d", borderRadius: 8, padding: "10px 12px",
                  fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace",
                  fontSize: 11, lineHeight: 1.6,
                }
              },
                (logsData ?? []).length === 0
                  ? h("div", { style: { color: "#555", textAlign: "center", padding: 20 } }, t("noLogsText"))
                  : logsData.map((line, i) => {
                      const isError = line.includes("[ERROR]");
                      const isWarn = line.includes("[WARN]");
                      return h("div", { key: i, style: { color: isError ? "#ff453a" : isWarn ? "#fbbf24" : "#8f8", whiteSpace: "pre-wrap", wordBreak: "break-all" } }, line);
                    })
              ),
            )
          ),
        ),
      );
    }

    // ─── Plugin entry ─────────────────────────────────────────────────────────────

    console.log("[devops-init] Starting plugin initialization...");
    
    return {
      name: "@jacksonchen/dsh-devops",
      inject: ["slots", "locale"],
      apply(ctx) {
        console.log("[devops-init] Plugin apply() called, registering slots...");
        
        // 1. Register settings section (DevOps config form) - direct register without intermediate variable
        ctx.slots.register({
          name: "settings.section",
          id: "dsh-devops",
          order: 100,
          label: "DevOps",
        }, DevopsSettings);
        
        console.log("[devops-init] Settings section registered with id:", "dsh-devops");
        
        // 2. Register conversation top tab (对话顶部 tab)
        ctx.slots.inject("conversation.view", () => ctx.slots.register({
          name: "conversation.view",
          id: "devops",
          order: 50,
          label: () => "DevOps",
          inject: (sessionId) => ({ sessionId }),
        }, DevopsDashboard));
      },
    };
  },
});
