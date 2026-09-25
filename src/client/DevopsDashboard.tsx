/**
 * DevOps dashboard (conversation.view tab): connection switch cards, stat
 * cards, and GitLab / K8s / Activity / Logs sub-tabs with inline actions
 * (approve/close MR, cancel/retry pipeline, set image, restart, pod logs).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import cssUI from './DevopsUI.module.css'
import type { DevopsClientContext, ClientLocale } from './dsh-context.ts'
import {
  DevopsClient,
  resolveGlServer,
  resolveK8sKc,
  type DashboardDeployment,
  type DashboardMR,
  type DashboardPipeline,
  type DashboardPod,
  type DashboardTag,
  type DashboardEvent,
} from './api.ts'
import type { DevopsSettingsFile, GitLabServerEntry, KubeconfigEntry } from '../types.ts'
import {
  Badge,
  Btn,
  ChipBtn,
  Dot,
  EmptyHint,
  Modal,
  Section as _Section,
  SecHeader,
  Select,
  StatCard,
  SwitchCard,
  TabBar,
  Toast,
  timeAgo,
  useLocaleRevision,
  type TranslateFn,
} from './ui.tsx'

void _Section

const PIPELINE_RUNNING = ['created', 'waiting_for_resource', 'preparing', 'pending', 'running', 'queued', 'scheduled']
const POLL_INTERVAL = 60_000 // 60s auto-refresh

export interface DevopsDashboardProps {
  connection: DevopsClientContext['connection']
  locale: ClientLocale
  t: TranslateFn
}

interface Live {
  mrs?: { ok: boolean; mergeRequests?: DashboardMR[]; message?: string }
  pipelines?: { ok: boolean; pipelines?: DashboardPipeline[]; message?: string }
  tags?: { ok: boolean; tags?: DashboardTag[]; message?: string }
  deployments?: { ok: boolean; deployments?: DashboardDeployment[]; message?: string }
  pods?: { ok: boolean; pods?: DashboardPod[]; message?: string }
  events?: { ok: boolean; events?: DashboardEvent[]; message?: string }
}

export function DevopsDashboard({ connection, locale, t }: DevopsDashboardProps) {
  useLocaleRevision(locale)
  const client = new DevopsClient(connection)
  const [config, setConfig] = useState<DevopsSettingsFile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('gitlab')
  // 二级 tab：GitLab（合并请求/标签/流水线）与 K8s（部署/事件）
  const [gitlabSubTab, setGitlabSubTab] = useState('mrs')
  const [k8sSubTab, setK8sSubTab] = useState('deployments')
  const [live, setLive] = useState<Live | null>(null)
  const [logsData, setLogsData] = useState<string[] | null>(null)
  const [toast, setToast] = useState<{ msg: string; tone: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [newMrOpen, setNewMrOpen] = useState(false)
  const [newTagOpen, setNewTagOpen] = useState(false)
  // Pod 日志（弹窗查看）
  const [podLog, setPodLog] = useState<{ podName: string; logs?: string; err?: string; loading?: boolean } | null>(null)
  // MR / Tag 表单下拉数据（branches/members/tags 快照）
  const [formOpts, setFormOpts] = useState<{ branches: { name: string; isDefault: boolean }[]; members: { username: string; name: string }[]; loading: boolean; projectKey: string }>({
    branches: [],
    members: [],
    loading: false,
    projectKey: '',
  })
  // MR 表单受控字段（source/target/reviewers 下拉+可手输）
  const [mrSource, setMrSource] = useState('')
  const [mrTarget, setMrTarget] = useState('')
  const [mrReviewers, setMrReviewers] = useState('')
  // Tag 表单受控 ref 字段
  const [tagRefSel, setTagRefSel] = useState('')
  // Context bar 下拉数据（项目 / context / namespace 列表）
  const [barOpts, setBarOpts] = useState<{ projects: { path: string }[]; contexts: { name: string }[]; namespaces: string[]; key: string }>({
    projects: [],
    contexts: [],
    namespaces: [],
    key: '',
  })
  // 双卡片连接状态（最近一次列表拉取结果）
  const [connStatus, setConnStatus] = useState<{ gl: string; k8s: string }>({ gl: '', k8s: '' })
  // Pipeline 展开详情
  const [expandedPipe, setExpandedPipe] = useState<number | null>(null)
  const [pipeJobs, setPipeJobs] = useState<{ id: number | null; jobs: { id: number; name: string; stage: string; status: string; duration?: number; failureReason: string }[]; loading: boolean }>({
    id: null,
    jobs: [],
    loading: false,
  })
  // Pipeline job 日志（弹窗查看）
  const [jobLog, setJobLog] = useState<{ jobId: number; name: string; logs?: string; err?: string; loading?: boolean; jobUrl?: string } | null>(null)
  // Deployment 换镜像（弹窗）/ 重启确认（弹窗）
  const [expandedDep, setExpandedDep] = useState<string | null>(null)
  const [depImgEdit, setDepImgEdit] = useState<{ name: string; image: string } | null>(null)
  const [depImgValue, setDepImgValue] = useState('')
  const [depRestart, setDepRestart] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fetchSeqRef = useRef(0)
  const mrDescSeqRef = useRef(0)
  const mrTitleRef = useRef<HTMLInputElement | null>(null)
  const mrDescRef = useRef<HTMLTextAreaElement | null>(null)
  const tagNameRef = useRef<HTMLInputElement | null>(null)
  const tagMsgRef = useRef<HTMLInputElement | null>(null)

  // ─── Load saved config ───────────────────────────────────────────────────────

  useEffect(() => {
    void (async () => {
      try {
        const r = await client.loadConfig()
        if (r.ok && r.config) {
          setConfig(r.config)
          await fetchData(r.config)
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchData = useCallback(
    async (cfg: DevopsSettingsFile | null) => {
      if (!cfg) return
      const seq = ++fetchSeqRef.current // 快速连续切换时，旧请求的响应作废
      const jobs: [string, Promise<unknown>][] = []
      const glServer = resolveGlServer(cfg)
      if (glServer?.baseUrl && glServer?.token && glServer?.projectPath) {
        const base = { baseUrl: glServer.baseUrl, token: glServer.token, projectPath: glServer.projectPath }
        jobs.push(['mrs', client.gitlabMRs({ ...base })])
        jobs.push(['pipelines', client.gitlabPipelines({ ...base, perPage: 10 })])
        jobs.push(['tags', client.gitlabTags(base)])
      }
      const kc = resolveK8sKc(cfg)
      if (kc?.path) {
        const ns = kc.namespace || 'default'
        const kb = { kubeconfigPath: kc.path, context: kc.context, namespace: ns }
        jobs.push(['deployments', client.k8sDeployments(kb)])
        jobs.push(['pods', client.k8sPods(kb)])
        jobs.push(['events', client.k8sEvents({ ...kb, limit: 15 })])
      }
      if (jobs.length === 0) {
        if (seq === fetchSeqRef.current) setLive({})
        return
      }
      const settled = await Promise.all(jobs.map(([, p]) => p.catch(() => ({ ok: false }))))
      if (seq !== fetchSeqRef.current) return
      const data: Record<string, unknown> = {}
      jobs.forEach(([key], i) => {
        data[key] = settled[i]
      })
      setLive(data as Live)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client],
  )

  // Auto-refresh
  useEffect(() => {
    if (!config) return
    timerRef.current = setInterval(() => void fetchData(config), POLL_INTERVAL)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [config, fetchData])

  // Log polling (10s when logs tab active)
  useEffect(() => {
    if (activeTab !== 'logs') return
    void (async () => {
      try {
        const r = await client.logs({ lines: 200 })
        if (r.ok) setLogsData(r.lines ?? [])
      } catch {
        /* ignore */
      }
    })()
    const logTimer = setInterval(() => {
      void (async () => {
        try {
          const r = await client.logs({ lines: 200 })
          if (r.ok) setLogsData(r.lines ?? [])
        } catch {
          /* ignore */
        }
      })()
    }, 10_000)
    return () => clearInterval(logTimer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return
    const toastTimer = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(toastTimer)
  }, [toast])

  const glServer = resolveGlServer(config)
  const glProject = glServer?.projectPath ? { path: glServer.projectPath } : null
  const k8sKc = resolveK8sKc(config)

  // ─── Config switching (context bar) ──────────────────────────────────────────

  async function applyConfig(next: DevopsSettingsFile) {
    setConfig(next)
    try {
      await client.saveConfig(next as unknown as Record<string, unknown>)
    } catch {
      /* 保存失败不打断切换 */
    }
    await fetchData(next)
  }

  function switchServer(id: string) {
    if (!config?.gitlab || id === config.gitlab.activeServerId) return
    setConnStatus((c) => ({ ...c, gl: '' }))
    void applyConfig({ ...config, gitlab: { ...config.gitlab!, activeServerId: id } })
  }

  function switchProject(path: string) {
    if (!config?.gitlab || !glServer || path === glServer.projectPath) return
    const servers = config.gitlab.servers.map((s) => (s.id === glServer.id ? { ...s, projectPath: path } : s))
    void applyConfig({ ...config, gitlab: { ...config.gitlab!, servers } })
  }

  function switchKubeconfig(id: string) {
    if (!config?.k8s || id === config.k8s.activeKubeconfigId) return
    setConnStatus((c) => ({ ...c, k8s: '' }))
    void applyConfig({ ...config, k8s: { ...config.k8s!, activeKubeconfigId: id } })
  }

  function switchContext(ctxName: string) {
    if (!config?.k8s || !k8sKc || ctxName === k8sKc.context) return
    const kubeconfigs = config.k8s.kubeconfigs.map((k) => (k.id === k8sKc.id ? { ...k, context: ctxName, namespace: '' } : k))
    void applyConfig({ ...config, k8s: { ...config.k8s!, kubeconfigs } })
  }

  function switchNamespace(ns: string) {
    if (!config?.k8s || !k8sKc || ns === k8sKc.namespace) return
    const kubeconfigs = config.k8s.kubeconfigs.map((k) => (k.id === k8sKc.id ? { ...k, namespace: ns } : k))
    void applyConfig({ ...config, k8s: { ...config.k8s!, kubeconfigs } })
  }

  // Context bar 下拉数据：跟随 active server / kubeconfig 拉取
  useEffect(() => {
    if (!glServer?.baseUrl || !glServer?.token) return
    const key = `${glServer.id}:${glServer.projectPath}`
    if (barOpts.key === key) return
    let stale = false
    let timer: ReturnType<typeof setTimeout> | null = null
    // GitLab 冷启动时项目列表可能超时，失败自动重试（最多 3 次）
    const fetchProjects = (attempt: number) => {
      client
        .gitlabProjects({ baseUrl: glServer.baseUrl, token: glServer.token })
        .then((r) => {
          if (stale) return
          if (r.ok && r.projects?.length) {
            setBarOpts((o) => ({ ...o, projects: r.projects, key }))
            setConnStatus((c) => ({ ...c, gl: 'ok' }))
          } else if (attempt < 2) {
            timer = setTimeout(() => fetchProjects(attempt + 1), 6000)
          } else {
            setConnStatus((c) => ({ ...c, gl: 'err' }))
          }
        })
        .catch(() => {
          if (!stale && attempt < 2) timer = setTimeout(() => fetchProjects(attempt + 1), 6000)
          else setConnStatus((c) => ({ ...c, gl: 'err' }))
        })
    }
    fetchProjects(0)
    return () => {
      stale = true
      if (timer) clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glServer?.id, glServer?.projectPath, glServer?.baseUrl, glServer?.token])

  useEffect(() => {
    if (!k8sKc?.path) return
    let stale = false
    client
      .k8sContexts({ kubeconfigPath: k8sKc.path })
      .then((r) => {
        if (stale) return
        setBarOpts((o) => ({ ...o, contexts: r.ok ? r.contexts : [] }))
        setConnStatus((c) => ({ ...c, k8s: r.ok ? 'ok' : 'err' }))
      })
      .catch(() => {
        if (!stale) setConnStatus((c) => ({ ...c, k8s: 'err' }))
      })
    client
      .k8sNamespaces({ kubeconfigPath: k8sKc.path, context: k8sKc.context })
      .then((r) => {
        if (!stale) setBarOpts((o) => ({ ...o, namespaces: r.ok ? r.namespaces : [] }))
      })
      .catch(() => {})
    return () => {
      stale = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k8sKc?.id, k8sKc?.path, k8sKc?.context])

  // MR / Tag 表单下拉数据：表单打开时按项目拉取（失败自动重试一次）
  useEffect(() => {
    if ((!newMrOpen && !newTagOpen) || !glServer?.baseUrl || !glServer?.token || !glServer?.projectPath) return
    const projectKey = `${glServer.id}:${glServer.projectPath}`
    if (formOpts.projectKey === projectKey && (formOpts.branches.length || formOpts.members.length)) return
    let stale = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const fetchOpts = (attempt: number) => {
      setFormOpts((o) => ({ ...o, loading: true, projectKey }))
      Promise.all([
        client.gitlabBranches({ baseUrl: glServer.baseUrl, token: glServer.token, path: glServer.projectPath }).catch(() => ({ ok: false, branches: [] })),
        client.gitlabMembers({ baseUrl: glServer.baseUrl, token: glServer.token, path: glServer.projectPath }).catch(() => ({ ok: false, members: [] })),
      ]).then(([br, mem]) => {
        if (stale) return
        const ok = br.ok || mem.ok
        setFormOpts({
          branches: br.ok ? br.branches : [],
          members: mem.ok ? mem.members : [],
          loading: false,
          projectKey,
        })
        if (!ok && attempt < 1) timer = setTimeout(() => fetchOpts(attempt + 1), 5000)
      })
    }
    fetchOpts(0)
    return () => {
      stale = true
      if (timer) clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newMrOpen, newTagOpen, glServer?.id, glServer?.projectPath])

  // 分支列表到位后给 MR / Tag 表单填默认值
  useEffect(() => {
    if (!formOpts.branches.length) return
    const def = formOpts.branches.find((b) => b.isDefault)?.name ?? glServer?.branch ?? 'main'
    setMrTarget((v) => v || def)
    setMrSource((v) => v || glServer?.branch || '')
    setTagRefSel((v) => v || def)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formOpts.branches, formOpts.projectKey])

  // 分支名 → 类型前缀：feature/login → "feat"
  function genMrType(branch: string): string | null {
    const m = /^(feature|feat|fix|bugfix|hotfix|chore|refactor|docs|test)[/-]/.exec(branch || '')
    if (!m?.[1]) return null
    return ['fix', 'bugfix', 'hotfix'].includes(m[1])
      ? 'fix'
      : ['chore', 'refactor', 'docs', 'test'].includes(m[1])
        ? m[1]
        : 'feat'
  }

  const mrAutoRef = useRef({ title: '', desc: '' }) // 记录上次自动生成的内容；用户改过则不再动
  // 选完 Source/Target 分支自动生成 Title / Description
  useEffect(() => {
    if (!newMrOpen || !mrSource || !mrTarget || mrSource === mrTarget) return
    const type = genMrType(mrSource)
    const words = mrSource
      .replace(/^(feature|feat|fix|bugfix|hotfix|chore|refactor|docs|test)[/-]/, '')
      .replace(/[-_]+/g, ' ')
    const autoTitle = type ? `${type}: ${words}${t('autoTitleSuffix', { s: mrSource, t: mrTarget })}` : `merge ${mrSource} into ${mrTarget}`
    const titleInput = mrTitleRef.current
    if (titleInput && (!titleInput.value || titleInput.value === mrAutoRef.current.title)) titleInput.value = autoTitle
    mrAutoRef.current.title = autoTitle
    // Description：源分支最新一次提交的信息（异步取，期间用户填了就不覆盖）
    if (
      mrDescRef.current &&
      (!mrDescRef.current.value || mrDescRef.current.value === mrAutoRef.current.desc) &&
      glServer?.baseUrl &&
      glServer?.token &&
      glServer?.projectPath
    ) {
      const seq = ++mrDescSeqRef.current
      client
        .gitlabLastCommit({ baseUrl: glServer.baseUrl, token: glServer.token, path: glServer.projectPath, branch: mrSource })
        .then((r) => {
          const d = mrDescRef.current
          if (!r.ok || !d || d.value || seq !== mrDescSeqRef.current) return
          const authorSuffix = r.author ? `（${r.author}）` : ''
          const lines = [
            t('descHead'),
            '',
            '- ',
            '',
            t('descCommit'),
            '',
            `- \`${r.shortId}\` ${r.title}${authorSuffix}`,
            '',
            t('descSource'),
            '',
            t('descBranch', { s: mrSource, t: mrTarget }),
          ]
          d.value = lines.join('\n')
          mrAutoRef.current.desc = d.value
        })
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newMrOpen, mrSource, mrTarget])

  // ─── Actions ─────────────────────────────────────────────────────────────────

  async function handleNewMr() {
    if (!glServer || !glServer.projectPath) return
    const source = (mrSource || '').trim()
    const target = (mrTarget || '').trim()
    const title = (mrTitleRef.current?.value ?? '').trim()
    const reviewers = (mrReviewers || '').trim()
    const description = (mrDescRef.current?.value ?? '').trim()
    if (!source || !target || !title) {
      setToast({ msg: t('fillMr'), tone: 'warn' })
      return
    }
    setBusy(true)
    try {
      const r = await client.gitlabCreateMR({
        baseUrl: glServer.baseUrl,
        token: glServer.token,
        projectPath: glServer.projectPath,
        sourceBranch: source,
        targetBranch: target,
        title,
        description,
        reviewers,
      })
      if (r.ok && r.mergeRequest) {
        setToast({ msg: t('mrCreated', { iid: r.mergeRequest.iid }), tone: 'ok' })
        setNewMrOpen(false)
        void fetchData(config)
      } else setToast({ msg: r.message || t('mrFail'), tone: 'err' })
    } catch (e) {
      setToast({ msg: (e as Error).message || t('createFail'), tone: 'err' })
    } finally {
      setBusy(false)
    }
  }

  // 从历史 Tag 生成新版本号：语义化版本 patch+1，无法解析则加 -next 后缀
  function bumpPatch(name: string): string {
    let m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(name)
    if (m) return `v${m[1]}.${m[2]}.${Number(m[3]) + 1}`
    m = /^v?(\d+)\.(\d+)$/.exec(name)
    if (m) return `v${m[1]}.${Number(m[2]) + 1}.0`
    return `${name}-next`
  }

  function pickHistoryTag(name: string) {
    if (!name) return
    if (tagNameRef.current) tagNameRef.current.value = bumpPatch(name)
  }

  async function handleNewTag() {
    if (!glServer || !glServer.projectPath) return
    const tagName = (tagNameRef.current?.value ?? '').trim()
    const ref = (tagRefSel || '').trim()
    const message = (tagMsgRef.current?.value ?? '').trim()
    if (!tagName || !ref) {
      setToast({ msg: t('fillTag'), tone: 'warn' })
      return
    }
    setBusy(true)
    try {
      const r = await client.gitlabCreateTag({ baseUrl: glServer.baseUrl, token: glServer.token, projectPath: glServer.projectPath, tagName, ref, message })
      if (r.ok) {
        setToast({ msg: t('tagCreated', { name: tagName }), tone: 'ok' })
        setNewTagOpen(false)
        void fetchData(config)
      } else setToast({ msg: r.message || t('tagFail'), tone: 'err' })
    } catch (e) {
      setToast({ msg: (e as Error).message || t('createFail'), tone: 'err' })
    } finally {
      setBusy(false)
    }
  }

  async function handleApprove(mr: DashboardMR) {
    if (!glServer || !glProject) return
    setBusy(true)
    try {
      const r = await client.gitlabMRApprove({ baseUrl: glServer.baseUrl, token: glServer.token, projectPath: glProject.path, mrIid: mr.iid })
      if (r.ok) {
        setToast({ msg: t('approved', { iid: mr.iid }) + (r.approvalsBeforeMerge != null ? t('remaining', { n: r.approvalsBeforeMerge }) : ''), tone: 'ok' })
        void fetchData(config)
      } else setToast({ msg: r.message || t('approveFail'), tone: 'err' })
    } catch (e) {
      setToast({ msg: (e as Error).message || t('approveFail'), tone: 'err' })
    } finally {
      setBusy(false)
    }
  }

  async function handlePipelineAction(p: DashboardPipeline, action: 'cancel' | 'retry') {
    if (!glServer || !glProject) return
    setBusy(true)
    try {
      const r = await client.gitlabPipelineAction({ baseUrl: glServer.baseUrl, token: glServer.token, projectPath: glProject.path, pipelineId: p.id, action })
      if (r.ok) {
        setToast({ msg: t('pipAction', { id: p.id, action: action === 'cancel' ? t('pipCanceled') : t('pipRetried') }), tone: 'ok' })
        void fetchData(config)
      } else setToast({ msg: r.message || t('actionFail'), tone: 'err' })
    } catch (e) {
      setToast({ msg: (e as Error).message || t('actionFail'), tone: 'err' })
    } finally {
      setBusy(false)
    }
  }

  async function handleMrClose(mr: DashboardMR) {
    if (!glServer || !glProject) return
    setBusy(true)
    try {
      const r = await client.gitlabMRAction({ baseUrl: glServer.baseUrl, token: glServer.token, projectPath: glProject.path, mrIid: mr.iid, action: 'close' })
      if (r.ok) {
        setToast({ msg: t('mrClosed', { iid: mr.iid }), tone: 'ok' })
        void fetchData(config)
      } else setToast({ msg: r.message || t('closeFail'), tone: 'err' })
    } catch (e) {
      setToast({ msg: (e as Error).message || t('closeFail'), tone: 'err' })
    } finally {
      setBusy(false)
    }
  }

  // Pipeline 展开：拉取该 pipeline 的 jobs
  function togglePipeDetail(p: DashboardPipeline) {
    if (expandedPipe === p.id) {
      setExpandedPipe(null)
      return
    }
    setExpandedPipe(p.id)
    setPipeJobs({ id: p.id, jobs: [], loading: true })
    if (!glServer || !glProject) return
    client
      .gitlabPipelineJobs({ baseUrl: glServer.baseUrl, token: glServer.token, projectPath: glProject.path, pipelineId: p.id })
      .then((r) => setPipeJobs({ id: p.id, jobs: r.ok ? r.jobs : [], loading: false }))
      .catch(() => setPipeJobs({ id: p.id, jobs: [], loading: false }))
  }

  // Pipeline job 日志（弹窗）
  function openJobLog(j: { id: number; name: string }) {
    if (!glServer || !glProject) return
    setJobLog({ jobId: j.id, name: j.name, loading: true })
    client
      .gitlabJobLog({ baseUrl: glServer.baseUrl, token: glServer.token, projectPath: glProject.path, jobId: j.id })
      .then((r) =>
        setJobLog({
          jobId: j.id,
          name: j.name,
          logs: r.ok ? r.logs : undefined,
          err: r.ok ? undefined : r.message || t('logsFail'),
          jobUrl: r.jobUrl,
        }),
      )
      .catch((e) => setJobLog({ jobId: j.id, name: j.name, err: (e as Error).message || t('logsFail') }))
  }

  // Deployment 展开它的 Pods（按 pod 名前缀匹配 deployment 名）
  function toggleDepDetail(d: DashboardDeployment) {
    setExpandedDep((v) => (v === d.name ? null : d.name))
    setDepImgEdit(null)
  }

  function depPods(d: DashboardDeployment): DashboardPod[] {
    return pods.filter((p) => p.name === d.name || p.name.startsWith(d.name + '-'))
  }

  // 更换镜像：提交弹窗里的新镜像
  async function handleSetImage() {
    if (!k8sKc || !depImgEdit) return
    const image = depImgValue.trim()
    if (!image || image === depImgEdit.image) {
      setDepImgEdit(null)
      return
    }
    setBusy(true)
    try {
      const r = await client.k8sSetImage({ kubeconfigPath: k8sKc.path, context: k8sKc.context, namespace: k8sKc.namespace || 'default', name: depImgEdit.name, image })
      if (r.ok) {
        setToast({ msg: t('imageUpdated', { name: depImgEdit.name, image }), tone: 'ok' })
        setDepImgEdit(null)
        void fetchData(config)
      } else setToast({ msg: r.message || t('imgFail'), tone: 'err' })
    } catch (e) {
      setToast({ msg: (e as Error).message || t('imgFail'), tone: 'err' })
    } finally {
      setBusy(false)
    }
  }

  // 重启 deployment（滚动重建 pods）—— 弹窗确认后执行
  async function handleRestartDep() {
    if (!k8sKc || !depRestart) return
    const name = depRestart
    setBusy(true)
    try {
      const r = await client.k8sRestart({ kubeconfigPath: k8sKc.path, context: k8sKc.context, namespace: k8sKc.namespace || 'default', name })
      if (r.ok) {
        setToast({ msg: t('restarting', { name }), tone: 'ok' })
        setDepRestart(null)
        void fetchData(config)
      } else setToast({ msg: r.message || t('restartFail'), tone: 'err' })
    } catch (e) {
      setToast({ msg: (e as Error).message || t('restartFail'), tone: 'err' })
    } finally {
      setBusy(false)
    }
  }

  async function handleViewPodLogs(pod: DashboardPod) {
    if (!k8sKc) return
    setPodLog({ podName: pod.name, loading: true })
    try {
      const r = await client.k8sPodLogs({ kubeconfigPath: k8sKc.path, context: k8sKc.context, namespace: k8sKc.namespace || 'default', podName: pod.name, tailLines: 200 })
      if (r.ok) setPodLog({ podName: pod.name, logs: r.logs ?? '' })
      else setPodLog({ podName: pod.name, err: r.message || t('logsFail') })
    } catch (e) {
      setPodLog({ podName: pod.name, err: (e as Error).message || t('logsFail') })
    }
  }

  // ─── Not configured state ────────────────────────────────────────────────────

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#888', fontSize: 13 }}>{t('loading')}</div>
  }

  if (!config || (!config.gitlab && !config.k8s)) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 40 }}>🖥️</div>
        <div className={cssUI.calloutInfo}>
          <strong>{t('notCfgBig')}</strong>
          <div style={{ marginTop: 8 }}>{t('goCfgHint')}</div>
        </div>
        <Btn
          onClick={() => window.dispatchEvent(new CustomEvent('dsh:open-settings', { detail: { section: 'dsh-devops' } }))}
          small
          variant="outline"
        >
          {t('goCfg')}
        </Btn>
      </div>
    )
  }

  // ─── Derived data ────────────────────────────────────────────────────────────

  const mrs = live?.mrs?.mergeRequests ?? []
  const pipelines = live?.pipelines?.pipelines ?? []
  const tags = live?.tags?.tags ?? []
  const deployments = live?.deployments?.deployments ?? []
  const pods = live?.pods?.pods ?? []
  const events = live?.events?.events ?? []

  const runningPips = pipelines.filter((p) => PIPELINE_RUNNING.includes(p.status)).length
  const okPips = pipelines.filter((p) => p.status === 'success').length
  const failPips = pipelines.filter((p) => p.status === 'failed').length
  const pendingApproval = mrs.filter((m) => (m.approvalsBeforeMerge ?? 0) > 0).length
  const depFail = deployments.filter((d) => d.replicas > 0 && d.ready === 0).length
  const depProg = deployments.filter((d) => d.replicas > 0 && d.ready > 0 && d.ready < d.replicas).length
  const crashPods = pods.filter((p) => p.restarts > 0).length
  const pendPods = pods.filter((p) => p.phase === 'Pending').length

  // ─── Activity feed ───────────────────────────────────────────────────────────

  const feed: { t: string; icon: string; tone: string; text: string; extra?: string; who?: string; ts: number }[] = []
  mrs.forEach((mr) =>
    feed.push({
      t: mr.updatedAt,
      icon: '🔄',
      tone: (mr.approvalsBeforeMerge ?? 0) > 0 ? 'warn' : 'ok',
      text: `!${mr.iid} ${mr.title} → ${mr.targetBranch}`,
      extra: (mr.approvalsBeforeMerge ?? 0) > 0 ? t('pending', { n: mr.approvalsBeforeMerge ?? 0 }) : mr.draft ? 'Draft' : t('mergeable'),
      who: mr.author,
      ts: 0,
    }),
  )
  pipelines.forEach((p) =>
    feed.push({
      t: p.updatedAt || p.createdAt,
      icon: p.status === 'success' ? '✅' : p.status === 'failed' ? '❌' : '⏳',
      tone: p.status === 'failed' ? 'err' : p.status === 'success' ? 'ok' : 'warn',
      text: `pipeline ${p.ref} #${p.id} ${p.status}`,
      ts: 0,
    }),
  )
  deployments.forEach((d) =>
    feed.push({
      t: d.updated,
      icon: '📦',
      tone: d.replicas > 0 && d.ready === d.replicas ? 'ok' : d.ready === 0 ? 'err' : 'warn',
      text: `${d.name} ${d.ready}/${d.replicas} ready`,
      extra: d.imageTag,
      ts: 0,
    }),
  )
  pods.forEach((pod) => {
    if (pod.restarts > 0)
      feed.push({ t: pod.startedAt, icon: '🔁', tone: 'warn', text: `pod ${pod.name} ${t('restartsN', { n: pod.restarts })}`, extra: pod.reason, ts: 0 })
  })
  events.forEach((ev) =>
    feed.push({ t: ev.time, icon: ev.type === 'Warning' ? '⚠️' : '•', tone: ev.type === 'Warning' ? 'err' : 'ok', text: `${ev.reason} ${ev.object}`, extra: ev.message, ts: 0 }),
  )
  feed.forEach((it) => {
    it.ts = it.t ? new Date(it.t).getTime() : 0
  })
  feed.sort((a, b) => b.ts - a.ts)
  const activityItems = feed.slice(0, 30)

  // ─── Render ──────────────────────────────────────────────────────────────────

  const glServers = config?.gitlab?.servers ?? []
  const kcList = config?.k8s?.kubeconfigs ?? []

  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* ─── 双卡片切换区（切换即保存刷新）─── */}
      <SwitchCard icon="📦" title="GitLab" status={glServers.length === 0 ? 'none' : connStatus.gl} t={t}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 160px) 1fr', gap: 8 }}>
          <div>
            <div className={cssUI.fieldLabel}>{t('server')}</div>
            <Select
              t={t}
              value={config.gitlab?.activeServerId ?? ''}
              onChange={switchServer}
              disabled={glServers.length <= 1}
              compact
              placeholder={glServers.length ? t('server') : t('notConfigured')}
              options={glServers.map((s) => ({ value: s.id, label: s.label || s.baseUrl }))}
            />
          </div>
          <div>
            <div className={cssUI.fieldLabel}>{t('project')}</div>
            <Select
              t={t}
              value={glServer?.projectPath ?? ''}
              onChange={switchProject}
              disabled={!glServer?.baseUrl || !glServer?.token}
              compact
              placeholder={!glServer?.baseUrl ? t('glNotCfg') : barOpts.projects.length ? t('selProject') : t('loadingProjects')}
              options={(() => {
                const opts = barOpts.projects.map((p) => ({ value: p.path, label: p.path }))
                const cur = glServer?.projectPath
                if (cur && !barOpts.projects.some((p) => p.path === cur)) opts.unshift({ value: cur, label: cur })
                return opts
              })()}
            />
          </div>
        </div>
      </SwitchCard>

      <SwitchCard icon="☸️" title="Kubernetes" status={kcList.length === 0 ? 'none' : connStatus.k8s} t={t}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 160px) 1fr 1fr', gap: 8 }}>
          <div>
            <div className={cssUI.fieldLabel}>{t('configFile')}</div>
            <Select
              t={t}
              value={config.k8s?.activeKubeconfigId ?? ''}
              onChange={switchKubeconfig}
              disabled={kcList.length <= 1}
              compact
              placeholder={kcList.length ? t('configFile') : t('notConfigured')}
              options={kcList.map((k) => ({ value: k.id, label: k.label || k.path }))}
            />
          </div>
          <div>
            <div className={cssUI.fieldLabel}>Context</div>
            <Select
              t={t}
              value={k8sKc?.context ?? ''}
              onChange={switchContext}
              disabled={!k8sKc?.path}
              compact
              placeholder={k8sKc?.path ? t('ctxPh') : t('notConfigured')}
              options={
                barOpts.contexts.length > 0
                  ? barOpts.contexts.map((c) => ({ value: c.name, label: c.name }))
                  : k8sKc?.context
                    ? [{ value: k8sKc.context, label: k8sKc.context }]
                    : []
              }
            />
          </div>
          <div>
            <div className={cssUI.fieldLabel}>Namespace</div>
            <Select
              t={t}
              value={k8sKc?.namespace ?? ''}
              onChange={switchNamespace}
              disabled={!k8sKc?.path}
              compact
              placeholder={k8sKc?.path ? t('nsPh') : t('notConfigured')}
              options={(() => {
                const nsList = barOpts.namespaces.map((n) => ({ value: n, label: n }))
                const cur = k8sKc?.namespace
                if (cur && !barOpts.namespaces.includes(cur)) nsList.unshift({ value: cur, label: cur })
                return nsList
              })()}
            />
          </div>
        </div>
      </SwitchCard>

      {/* Toast */}
      <Toast toast={toast} />

      {/* Stat cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        <StatCard
          icon="🔄"
          title={t('statMrsTitle')}
          value={glProject ? mrs.length : '—'}
          sub={glProject ? t('statMrsSub', { p: pendingApproval, r: runningPips }) : t('notConfigured')}
          tone={!glProject ? 'neutral' : pendingApproval > 0 ? 'warn' : mrs.length ? 'ok' : 'neutral'}
          subTone={pendingApproval > 0 ? '#fbbf24' : '#888'}
        />
        <StatCard
          icon="🔀"
          title={t('statPipsTitle')}
          value={glProject ? pipelines.length : '—'}
          sub={glProject ? t('statPipSub', { r: runningPips, o: okPips, f: failPips }) : t('notConfigured')}
          tone={!glProject ? 'neutral' : failPips > 0 ? 'err' : runningPips > 0 ? 'warn' : okPips > 0 ? 'ok' : 'neutral'}
          subTone={failPips > 0 ? '#ff8a80' : '#888'}
        />
        <StatCard
          icon="📦"
          title={t('statDepsTitle')}
          value={k8sKc ? deployments.length : '—'}
          sub={k8sKc ? t('statDepSub', { f: depFail, p: depProg }) : t('notConfigured')}
          tone={!k8sKc ? 'neutral' : depFail > 0 ? 'err' : depProg > 0 ? 'warn' : deployments.length ? 'ok' : 'neutral'}
          subTone={depFail > 0 ? '#ff8a80' : '#888'}
        />
        <StatCard
          icon="🐳"
          title={t('statPodsTitle')}
          value={k8sKc ? crashPods + pendPods : '—'}
          sub={k8sKc ? t('statPodSub', { c: crashPods, p: pendPods }) : t('notConfigured')}
          tone={!k8sKc ? 'neutral' : crashPods > 0 ? 'err' : pendPods > 0 ? 'warn' : pods.length ? 'ok' : 'neutral'}
          subTone={crashPods > 0 ? '#ff8a80' : '#888'}
        />
      </div>

      {/* Sub-tabs */}
      <TabBar
        tabs={[
          { id: 'gitlab', label: 'GitLab' },
          { id: 'k8s', label: 'K8s' },
          { id: 'activity', label: t('tabActivity') },
          { id: 'logs', label: t('logs') },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {/* Tab content */}
      <div style={{ maxHeight: 480, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* ─── GitLab tab ─── */}
        {activeTab === 'gitlab' && (
          glServer ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <TabBar
                small
                tabs={[
                  { id: 'mrs', label: t('secMrs'), badge: mrs.length },
                  { id: 'tags', label: t('secTags'), badge: tags.length },
                  { id: 'pipelines', label: t('statPipsTitle'), badge: pipelines.length },
                ]}
                active={gitlabSubTab}
                onChange={setGitlabSubTab}
              />
              {gitlabSubTab === 'mrs' && (
              <div>
                <SecHeader
                  icon="🔄"
                  title={t('secMrs')}
                  badge={mrs.length}
                  badgeTone={pendingApproval > 0 ? 'warn' : 'ok'}
                  onNew={() => setNewMrOpen((o) => !o)}
                  newLabel={t('newMrBtn')}
                />
                <Modal
                  open={newMrOpen}
                  title={t('newMrBtn')}
                  onClose={() => setNewMrOpen(false)}
                  maxWidth={620}
                  footer={
                    <>
                      <Btn onClick={() => void handleNewMr()} small tone="success" disabled={busy}>
                        {t('createMr')}
                      </Btn>
                      <Btn onClick={() => setNewMrOpen(false)} small variant="outline">
                        {t('cancel')}
                      </Btn>
                    </>
                  }
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <div className={cssUI.fieldLabel}>{t('sourceBranch')}</div>
                      <Select
                        value={mrSource}
                        onChange={setMrSource}
                        t={t}
                        placeholder={formOpts.loading ? t('loadingBr') : t('selBranch')}
                        options={[
                          ...(mrSource && !formOpts.branches.some((b) => b.name === mrSource) ? [mrSource] : []),
                          ...formOpts.branches.map((b) => ({ value: b.name, label: b.isDefault ? b.name + t('defaultSuffix') : b.name })),
                        ]}
                      />
                    </div>
                    <div>
                      <div className={cssUI.fieldLabel}>{t('targetBranch')}</div>
                      <Select
                        value={mrTarget}
                        onChange={setMrTarget}
                        t={t}
                        placeholder={formOpts.loading ? t('loadingBr') : t('selBranch')}
                        options={[
                          ...(mrTarget && !formOpts.branches.some((b) => b.name === mrTarget) ? [mrTarget] : []),
                          ...formOpts.branches.map((b) => ({ value: b.name, label: b.isDefault ? b.name + t('defaultSuffix') : b.name })),
                        ]}
                      />
                    </div>
                  </div>
                  <div>
                    <div className={cssUI.fieldLabel}>{t('titleLabel')}</div>
                    <input ref={mrTitleRef} className={cssUI.input} placeholder="feat: ..." />
                  </div>
                  <div>
                    <div className={cssUI.fieldLabel}>{t('reviewersLabel')}</div>
                    {formOpts.members.length > 0 ? (
                      <Select
                        value=""
                        onChange={(username) => {
                          if (!username) return
                          const cur = (mrReviewers || '')
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean)
                          if (!cur.includes(username)) cur.push(username)
                          setMrReviewers(cur.join(', '))
                        }}
                        t={t}
                        placeholder={formOpts.loading ? t('loadingMem') : t('selReviewer')}
                        options={formOpts.members
                          .filter((m) => !(mrReviewers || '')
                            .split(',')
                            .map((x) => x.trim())
                            .includes(m.username))
                          .map((m) => ({ value: m.username, label: `${m.username}（${m.name || m.username}）` }))}
                      />
                    ) : (
                      <div style={{ fontSize: 11, color: '#666' }}>{formOpts.loading ? t('loadingMem') : t('noMem')}</div>
                    )}
                    {(mrReviewers || '').trim() && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                        {(mrReviewers || '')
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .map((u) => (
                            <span key={u} className={cssUI.reviewerChip}>
                              {u}
                              <span
                                className={cssUI.reviewerChipRemove}
                                onClick={() =>
                                  setMrReviewers(
                                    (mrReviewers || '')
                                      .split(',')
                                      .map((x) => x.trim())
                                      .filter((x) => x && x !== u)
                                      .join(', '),
                                  )
                                }
                              >
                                ×
                              </span>
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className={cssUI.fieldLabel}>{t('descLabel')}</div>
                    <textarea ref={mrDescRef} className={cssUI.input} style={{ resize: 'vertical', minHeight: 54 }} placeholder={t('descPh')} />
                  </div>
                </Modal>
                {mrs.length === 0 ? (
                  <EmptyHint>{t('noMrs')}</EmptyHint>
                ) : (
                  mrs.map((mr) => {
                    const ms = mr.mergeStatus || 'unchecked'
                    const dotTone = ms === 'can_be_merged' ? 'ok' : ms === 'cannot_be_merged' ? 'err' : 'warn'
                    return (
                      <div key={mr.iid} className={cssUI.rowItem}>
                        <Dot tone={dotTone} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600 }}>!{mr.iid}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mr.title}</span>
                            {mr.draft || mr.workInProgress ? <Badge tone="accent">{mr.draft ? 'Draft' : 'WIP'}</Badge> : null}
                            {(mr.approvalsBeforeMerge ?? 0) > 0 ? (
                              <Badge tone="warn">{t('pending', { n: mr.approvalsBeforeMerge ?? 0 })}</Badge>
                            ) : (
                              <Badge tone="ok">{t('mergeable')}</Badge>
                            )}
                          </div>
                          <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>
                            {`${mr.sourceBranch} → ${mr.targetBranch} · ${mr.author} · ${timeAgo(mr.updatedAt, t)}`}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                          <ChipBtn tone="primary" disabled={busy} onClick={() => void handleApprove(mr)}>
                            {t('approve')}
                          </ChipBtn>
                          <ChipBtn tone="danger" disabled={busy} onClick={() => void handleMrClose(mr)}>
                            {t('close')}
                          </ChipBtn>
                          {mr.webUrl ? (
                            <ChipBtn title={t('openInGl')} onClick={() => window.open(mr.webUrl, '_blank')}>
                              ↗
                            </ChipBtn>
                          ) : null}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              )}

              {gitlabSubTab === 'tags' && (
              <div>
                <SecHeader icon="🏷️" title={t('secTags')} badge={tags.length} onNew={() => setNewTagOpen((o) => !o)} newLabel={t('newTagBtn')} />
                <Modal
                  open={newTagOpen}
                  title={t('newTagBtn')}
                  onClose={() => setNewTagOpen(false)}
                  maxWidth={620}
                  footer={
                    <>
                      <Btn onClick={() => void handleNewTag()} small tone="success" disabled={busy}>
                        {t('createTag')}
                      </Btn>
                      <Btn onClick={() => setNewTagOpen(false)} small variant="outline">
                        {t('cancel')}
                      </Btn>
                    </>
                  }
                >
                  {/* 历史 Tag 快捷创建 */}
                  {tags.length > 0 && (
                    <div>
                      <div className={cssUI.fieldLabel}>{t('histTag')}</div>
                      <Select
                        value=""
                        onChange={pickHistoryTag}
                        t={t}
                        placeholder={t('pickHist')}
                        options={tags.map((tg) => ({ value: tg.name, label: `${tg.name} → ${bumpPatch(tg.name)} · ${timeAgo(tg.createdAt, t)}` }))}
                      />
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <div className={cssUI.fieldLabel}>{t('tagNameLabel')}</div>
                      <input ref={tagNameRef} className={cssUI.input} placeholder="v1.2.0" list="dsh-devops-tag-names" />
                      {tags.length > 0 ? (
                        <datalist id="dsh-devops-tag-names">
                          {tags.map((tg) => (
                            <option key={tg.name} value={tg.name} />
                          ))}
                        </datalist>
                      ) : null}
                    </div>
                    <div>
                      <div className={cssUI.fieldLabel}>{t('refLabel')}</div>
                      <Select
                        value={tagRefSel}
                        onChange={setTagRefSel}
                        t={t}
                        placeholder={formOpts.loading ? t('loadingShort') : t('selRef')}
                        options={[
                          ...(tagRefSel && !formOpts.branches.some((b) => b.name === tagRefSel) && !tags.some((tg) => tg.name === tagRefSel)
                            ? [tagRefSel]
                            : []),
                          ...formOpts.branches.map((b) => ({ value: b.name, label: `⑂ ${b.name}${b.isDefault ? t('defaultSuffix') : ''}` })),
                          ...tags.map((tg) => ({ value: tg.name, label: `🏷 ${tg.name}` })),
                        ]}
                      />
                    </div>
                  </div>
                  <div>
                    <div className={cssUI.fieldLabel}>{t('msgLabel')}</div>
                    <input ref={tagMsgRef} className={cssUI.input} placeholder={t('releasePh')} />
                  </div>
                </Modal>
                {tags.length === 0 ? (
                  <EmptyHint>{t('noTags')}</EmptyHint>
                ) : (
                  tags.slice(0, 6).map((tg) => (
                    <div key={tg.name} className={cssUI.insetRow}>
                      <span>🏷️</span>
                      <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{tg.name}</span>
                      {tg.message ? (
                        <span style={{ color: '#888', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tg.message}</span>
                      ) : (
                        <span style={{ flex: 1 }} />
                      )}
                      <span style={{ color: '#666', fontSize: 11 }}>{timeAgo(tg.createdAt, t)}</span>
                    </div>
                  ))
                )}
              </div>
              )}

              {gitlabSubTab === 'pipelines' && (
              <div>
                <SecHeader
                  icon="🔀"
                  title={t('statPipsTitle')}
                  badge={pipelines.length}
                  badgeTone={failPips > 0 ? 'err' : runningPips > 0 ? 'warn' : 'neutral'}
                />
                {pipelines.length === 0 ? (
                  <EmptyHint>{t('noPips')}</EmptyHint>
                ) : (
                  pipelines.map((p) => {
                    const run = PIPELINE_RUNNING.includes(p.status)
                    const dot = p.status === 'success' ? 'ok' : p.status === 'failed' ? 'err' : run ? 'warn' : 'neutral'
                    const open = expandedPipe === p.id
                    return (
                      <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div className={cssUI.insetRow}>
                          <span
                            onClick={() => togglePipeDetail(p)}
                            style={{ cursor: 'pointer', color: '#888', fontSize: 10, width: 14, textAlign: 'center', flexShrink: 0 }}
                          >
                            {open ? '▾' : '▸'}
                          </span>
                          <Dot tone={dot} pulse={run} />
                          <span style={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => togglePipeDetail(p)}>
                            #{p.id}
                          </span>
                          <span style={{ color: '#ccc' }}>{p.ref}</span>
                          {p.sha ? <span style={{ color: '#666', fontFamily: 'monospace', fontSize: 11 }}>{p.sha}</span> : null}
                          <span style={{ flex: 1 }} />
                          <span style={{ color: '#888', fontSize: 11 }}>{timeAgo(p.updatedAt || p.createdAt, t)}</span>
                          {run ? (
                            <ChipBtn tone="danger" disabled={busy} onClick={() => void handlePipelineAction(p, 'cancel')}>
                              {t('cancel')}
                            </ChipBtn>
                          ) : null}
                          {p.status === 'failed' ? (
                            <ChipBtn tone="primary" disabled={busy} onClick={() => void handlePipelineAction(p, 'retry')}>
                              {t('retry')}
                            </ChipBtn>
                          ) : null}
                        </div>
                        {/* 展开区：该 pipeline 的 jobs 明细 */}
                        {open && (
                          <div style={{ padding: '4px 10px 6px 28px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {pipeJobs.id === p.id && pipeJobs.loading ? (
                              <div style={{ color: '#555', fontSize: 11 }}>{t('loadingJobs')}</div>
                            ) : (pipeJobs.id === p.id ? pipeJobs.jobs : []).length === 0 ? (
                              <div style={{ color: '#555', fontSize: 11 }}>{t('noJobs')}</div>
                            ) : (
                              (pipeJobs.id === p.id ? pipeJobs.jobs : []).map((j) => {
                                const jdot =
                                  j.status === 'success'
                                    ? 'ok'
                                    : j.status === 'failed'
                                      ? 'err'
                                      : ['created', 'pending', 'running', 'queued', 'scheduled', 'waiting_for_resource', 'preparing'].includes(j.status)
                                        ? 'warn'
                                        : 'neutral'
                                return (
                                  <div
                                    key={j.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      fontSize: 11,
                                      color: '#ccc',
                                      padding: '3px 8px',
                                      borderRadius: 4,
                                      background: 'rgba(255,255,255,0.03)',
                                    }}
                                  >
                                    <Dot tone={jdot} pulse={jdot === 'warn'} />
                                    <span style={{ fontWeight: 500 }}>{j.name}</span>
                                    <span style={{ color: '#666' }}>{j.stage}</span>
                                    <span style={{ color: '#888' }}>{j.status}</span>
                                    {j.failureReason ? <span style={{ color: '#ff8a80' }}>{j.failureReason}</span> : null}
                                    <span style={{ flex: 1 }} />
                                    {j.duration != null ? <span style={{ color: '#666', fontSize: 10 }}>{`${Math.round(j.duration)}s`}</span> : null}
                                    <ChipBtn tone="ghost" onClick={() => openJobLog(j)}>
                                      {t('openJobLog')}
                                    </ChipBtn>
                                  </div>
                                )
                              })
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
              )}
            </div>
          ) : (
            <EmptyHint>{t('glNotCfg2')}</EmptyHint>
          )
        )}

        {/* ─── K8s tab ─── */}
        {activeTab === 'k8s' && (
          k8sKc ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <TabBar
                small
                tabs={[
                  { id: 'deployments', label: t('statDepsTitle'), badge: deployments.length },
                  { id: 'events', label: t('secEvents'), badge: events.length },
                ]}
                active={k8sSubTab}
                onChange={setK8sSubTab}
              />
              {k8sSubTab === 'deployments' && (
              <div>
                <SecHeader
                  icon="📦"
                  title={t('statDepsTitle')}
                  badge={deployments.length}
                  badgeTone={depFail > 0 ? 'err' : depProg > 0 ? 'warn' : 'ok'}
                />
                {deployments.length === 0 ? (
                  <EmptyHint>{t('noDeps')}</EmptyHint>
                ) : (
                  deployments.map((d) => {
                    const st = d.replicas > 0 && d.ready === d.replicas ? 'ok' : d.ready === 0 ? 'err' : 'warn'
                    const open = expandedDep === d.name
                    const depPodList = depPods(d)
                    return (
                      <div key={d.name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div className={cssUI.insetRow}>
                          <span
                            onClick={() => toggleDepDetail(d)}
                            style={{ cursor: 'pointer', color: '#888', fontSize: 10, width: 14, textAlign: 'center', flexShrink: 0 }}
                          >
                            {open ? '▾' : '▸'}
                          </span>
                          <Dot tone={st} />
                          <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => toggleDepDetail(d)}>
                            <div style={{ fontFamily: 'monospace', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {d.name}
                            </div>
                            <div style={{ color: '#888', fontSize: 11 }}>
                              {`${d.ready}/${d.replicas} ${t('ready')} · ${d.imageTag || '—'} · ${timeAgo(d.updated, t)}`}
                            </div>
                          </div>
                          {st === 'ok' ? (
                            <Badge tone="ok">{t('runningBadge')}</Badge>
                          ) : (
                            <Badge tone={st}>{t('issueN', { n: d.replicas - d.ready })}</Badge>
                          )}
                          <ChipBtn
                            tone="ghost"
                            disabled={busy}
                            onClick={() => {
                              setDepImgValue(d.image || '')
                              setDepImgEdit({ name: d.name, image: d.image || '' })
                            }}
                          >
                            {t('setImage')}
                          </ChipBtn>
                          <ChipBtn tone="ghost" disabled={busy} onClick={() => setDepRestart(d.name)}>
                            {t('restart')}
                          </ChipBtn>
                        </div>
                        {/* 展开区：属于该 deployment 的 pods */}
                        {open && (
                          <div style={{ padding: '2px 10px 6px 28px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {depPodList.length === 0 ? (
                              <div style={{ color: '#555', fontSize: 11 }}>{t('noPods')}</div>
                            ) : (
                              depPodList.map((pod) => (
                                <div
                                  key={pod.name}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    fontSize: 11,
                                    color: '#ccc',
                                    padding: '3px 8px',
                                    borderRadius: 4,
                                    background: 'rgba(255,255,255,0.03)',
                                  }}
                                >
                                  <Dot tone={pod.phase === 'Running' ? 'ok' : pod.phase === 'Pending' ? 'warn' : 'err'} />
                                  <span style={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {pod.name}
                                  </span>
                                  {pod.reason || pod.restarts > 0 ? (
                                    <span style={{ color: '#888' }}>
                                      {`${pod.restarts > 0 ? t('restartsN', { n: pod.restarts }) + ' · ' : ''}${pod.reason || ''}`}
                                    </span>
                                  ) : null}
                                  <span style={{ flex: 1 }} />
                                  {pod.restarts > 0 ? <Badge tone="warn">{`${pod.restarts}r`}</Badge> : null}
                                  <ChipBtn tone="ghost" onClick={() => void handleViewPodLogs(pod)}>
                                    {t('logs')}
                                  </ChipBtn>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
              )}

              {k8sSubTab === 'events' && (
              <div>
                <SecHeader icon="📝" title={t('secEvents')} badge={events.length} />
                {events.length === 0 ? (
                  <EmptyHint>{t('noEvents')}</EmptyHint>
                ) : (
                  events.slice(0, 12).map((ev, i) => (
                    <div key={i} style={{ padding: '6px 10px', borderRadius: 6, background: 'var(--ds-alias-surface-inset,#1a1a1a)', fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ color: ev.type === 'Warning' ? '#ff8a80' : '#34c759', fontSize: 11, fontWeight: 600 }}>
                          {ev.type === 'Warning' ? '⚠' : '•'}
                        </span>
                        <span style={{ color: '#888', fontSize: 11 }}>{ev.reason}</span>
                        <span style={{ flex: 1 }} />
                        <span style={{ color: '#666', fontSize: 10 }}>{timeAgo(ev.time, t)}</span>
                      </div>
                      <div style={{ color: '#ccc', lineHeight: 1.4, wordBreak: 'break-word' }}>{ev.message}</div>
                      <div style={{ color: '#666', fontSize: 10, marginTop: 2 }}>{`${ev.kind} / ${ev.object}`}</div>
                    </div>
                  ))
                )}
              </div>
              )}
            </div>
          ) : (
            <EmptyHint>{t('k8sNotCfg2')}</EmptyHint>
          )
        )}

        {/* ─── Activity tab ─── */}
        {activeTab === 'activity' &&
          (activityItems.length === 0 ? (
            <EmptyHint>{t('noActivity')}</EmptyHint>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {activityItems.map((it, i) => (
                <div key={i} className={cssUI.rowItem}>
                  <span style={{ fontSize: 12, flexShrink: 0 }}>{it.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#ddd', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.text}</span>
                      {it.extra ? <Badge tone={it.tone}>{it.extra}</Badge> : null}
                    </div>
                    {it.who ? <div style={{ color: '#888', fontSize: 11, marginTop: 1 }}>{it.who}</div> : null}
                  </div>
                  <span style={{ color: '#666', fontSize: 10, flexShrink: 0 }}>{timeAgo(it.t, t)}</span>
                </div>
              ))}
            </div>
          ))}

        {/* ─── Logs tab ─── */}
        {activeTab === 'logs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 200 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#888' }}>{t('logsLast', { n: (logsData ?? []).length })}</span>
              <Btn
                onClick={() => {
                  void (async () => {
                    try {
                      const r = await client.logs({ lines: 200 })
                      if (r.ok) setLogsData(r.lines ?? [])
                    } catch {
                      /* ignore */
                    }
                  })()
                }}
                small
                variant="outline"
              >
                {t('refresh')}
              </Btn>
            </div>
            <div
              style={{
                minHeight: 200,
                maxHeight: 400,
                overflow: 'auto',
                background: '#0d0d0d',
                borderRadius: 8,
                padding: '10px 12px',
                fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace",
                fontSize: 11,
                lineHeight: 1.6,
              }}
            >
              {(logsData ?? []).length === 0 ? (
                <div style={{ color: '#555', textAlign: 'center', padding: 20 }}>{t('noLogsText')}</div>
              ) : (
                logsData!.map((line, i) => {
                  const isError = line.includes('[ERROR]')
                  const isWarn = line.includes('[WARN]')
                  const cls = isError ? cssUI.logLineError : isWarn ? cssUI.logLineWarn : cssUI.logLineInfo
                  return (
                    <div key={i} className={cls} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {line}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ 换镜像弹窗 ═══ */}
      <Modal
        open={depImgEdit != null}
        title={`${t('setImage')} · ${depImgEdit?.name ?? ''}`}
        onClose={() => setDepImgEdit(null)}
        footer={
          <>
            <Btn onClick={() => void handleSetImage()} small tone="success" disabled={busy}>
              {t('apply')}
            </Btn>
            <Btn onClick={() => setDepImgEdit(null)} small variant="outline">
              {t('cancel')}
            </Btn>
          </>
        }
      >
        <div>
          <div className={cssUI.fieldLabel}>{t('currentImage')}</div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#ccc', padding: '6px 8px', borderRadius: 6, background: 'var(--ds-alias-surface-inset,#1a1a1a)' }}>
            {depImgEdit?.image || '—'}
          </div>
        </div>
        <div>
          <div className={cssUI.fieldLabel}>{t('newImage')}</div>
          <input
            className={cssUI.input}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
            placeholder="nginx:1.27"
            value={depImgValue}
            onChange={(e) => setDepImgValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSetImage()
            }}
          />
        </div>
      </Modal>

      {/* ═══ 重启确认弹窗 ═══ */}
      <Modal
        open={depRestart != null}
        title={`${t('restart')} · ${depRestart ?? ''}`}
        onClose={() => setDepRestart(null)}
        footer={
          <>
            <Btn onClick={() => void handleRestartDep()} small tone="success" disabled={busy}>
              {t('confirmRestart')}
            </Btn>
            <Btn onClick={() => setDepRestart(null)} small variant="outline">
              {t('cancel')}
            </Btn>
          </>
        }
      >
        <div style={{ fontSize: 13, color: '#ccc', lineHeight: 1.6 }}>{t('restartBody', { name: depRestart ?? '' })}</div>
      </Modal>

      {/* ═══ Pipeline job 日志弹窗 ═══ */}
      <Modal
        open={jobLog != null}
        title={`▤ ${jobLog?.name ?? ''} (#${jobLog?.jobId ?? ''})`}
        onClose={() => setJobLog(null)}
        maxWidth={860}
        footer={
          <>
            {jobLog?.jobUrl ? (
              <Btn onClick={() => jobLog && window.open(jobLog.jobUrl, '_blank')} small variant="outline">
                {t('openInGitlab')}
              </Btn>
            ) : null}
            <Btn onClick={() => setJobLog(null)} small variant="outline">
              {t('close')}
            </Btn>
          </>
        }
      >
        <div className={cssUI.logPanel} style={{ maxHeight: 420 }}>
          {jobLog?.loading ? (
            <div style={{ color: '#555' }}>{t('loadingLogs')}</div>
          ) : jobLog?.err ? (
            <div style={{ color: '#ff8a80', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{jobLog.err}</div>
          ) : (
            <div style={{ color: '#8f8', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{jobLog?.logs || t('noLogs')}</div>
          )}
        </div>
      </Modal>

      {/* ═══ Pod 日志弹窗 ═══ */}
      <Modal
        open={podLog != null}
        title={`▤ ${podLog?.podName ?? ''}`}
        onClose={() => setPodLog(null)}
        maxWidth={860}
        footer={
          <Btn onClick={() => setPodLog(null)} small variant="outline">
            {t('close')}
          </Btn>
        }
      >
        <div className={cssUI.logPanel} style={{ maxHeight: 420 }}>
          {podLog?.loading ? (
            <div style={{ color: '#555' }}>{t('loadingLogs')}</div>
          ) : podLog?.err ? (
            <div style={{ color: '#ff8a80', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{podLog.err}</div>
          ) : (
            <div style={{ color: '#8f8', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{podLog?.logs || t('noLogs')}</div>
          )}
        </div>
      </Modal>
    </div>
  )
}
