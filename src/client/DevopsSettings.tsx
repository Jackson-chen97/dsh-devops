/**
 * Settings → DevOps section: GitLab / Kubernetes connection wizard.
 *
 * 交互模型（卡片式）：每套 GitLab / kubeconfig 配置是一张可展开的手风琴卡片，
 * 编辑表单住在卡片内部——新增即出现展开的空卡（不再有"悬空表单"和"添加清空已填"），
 * 字段改动直接写回条目，测试连接/项目/分支等状态跟随各自卡片。
 * 保存按钮统一落盘（~/.dsh-devops/config.json，经 RPC）。
 */
import { useCallback, useEffect, useState } from 'react'
import cssUI from './DevopsUI.module.css'
import type { DevopsClientContext, ClientLocale } from './dsh-context.ts'
import { DevopsClient } from './api.ts'
import type { DevopsSettingsFile, GitLabServerEntry, KubeconfigEntry } from '../types.ts'
import {
  Badge,
  Btn,
  Dot,
  Input,
  Label,
  Section,
  Select,
  Status,
  useLocaleRevision,
  type TranslateFn,
} from './ui.tsx'

// ─── 草稿类型：配置条目 + 该卡片的临时状态 ──────────────────────────────────────

interface ProjectOption {
  id: string
  name: string
  path: string
  defaultBranch: string
}

interface GlDraft extends GitLabServerEntry {
  testStatus: '' | 'testing' | 'ok' | 'error'
  testMsg: string
  projects: ProjectOption[]
  projectsFetching: boolean
  projSearch: string
  branches: string[]
  branchesAll: string[]
  branchSearch: string
  branchesLoading: boolean
  branchesError: string
}

interface ContextOption {
  name: string
  namespace: string
}

interface KcDraft extends KubeconfigEntry {
  testStatus: '' | 'testing' | 'ok' | 'error'
  testMsg: string
  contexts: ContextOption[]
  namespaces: string[]
  namespacesLoading: boolean
}

function emptyGlDraft(id: string, label: string): GlDraft {
  return {
    id,
    label,
    baseUrl: '',
    token: '',
    projectPath: '',
    branch: '',
    testStatus: '',
    testMsg: '',
    projects: [],
    projectsFetching: false,
    projSearch: '',
    branches: [],
    branchesAll: [],
    branchSearch: '',
    branchesLoading: false,
    branchesError: '',
  }
}

function emptyKcDraft(id: string, label: string): KcDraft {
  return {
    id,
    label,
    path: '',
    context: '',
    namespace: '',
    testStatus: '',
    testMsg: '',
    contexts: [],
    namespaces: [],
    namespacesLoading: false,
  }
}

const toGlDraft = (s: GitLabServerEntry): GlDraft => ({ ...emptyGlDraft(s.id, s.label), ...s })
const toKcDraft = (k: KubeconfigEntry): KcDraft => ({ ...emptyKcDraft(k.id, k.label), ...k })

/** Strip transient per-card state before persisting a draft. */
function plainGl(d: GlDraft): GitLabServerEntry {
  const { testStatus, testMsg, projects, projectsFetching, projSearch, branches, branchesAll, branchSearch, branchesLoading, branchesError, ...s } = d
  void testStatus
  void testMsg
  void projects
  void projectsFetching
  void projSearch
  void branches
  void branchesAll
  void branchSearch
  void branchesLoading
  void branchesError
  return s
}

function plainKc(d: KcDraft): KubeconfigEntry {
  const { testStatus, testMsg, contexts, namespaces, namespacesLoading, ...k } = d
  void testStatus
  void testMsg
  void contexts
  void namespaces
  void namespacesLoading
  return k
}

export interface DevopsSettingsProps {
  connection: DevopsClientContext['connection']
  locale: ClientLocale
  t: TranslateFn
}

export function DevopsSettings({ connection, locale, t }: DevopsSettingsProps) {
  useLocaleRevision(locale) // 语言切换时重渲染
  const client = new DevopsClient(connection)
  const [glDrafts, setGlDrafts] = useState<GlDraft[]>([])
  const [expandedGl, setExpandedGl] = useState<string | null>(null)
  const [kcDrafts, setKcDrafts] = useState<KcDraft[]>([])
  const [expandedKc, setExpandedKc] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState('')
  const [saveMsg, setSaveMsg] = useState('')
  const [hasSavedConfig, setHasSavedConfig] = useState(false)

  const updateGl = useCallback((id: string, patch: Partial<GlDraft>) => {
    setGlDrafts((list) => list.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }, [])
  const updateKc = useCallback((id: string, patch: Partial<KcDraft>) => {
    setKcDrafts((list) => list.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }, [])

  // ─── 载入已保存配置：恢复卡片 + 静默重验连接 ─────────────────────────────────

  useEffect(() => {
    void (async () => {
      let r: Awaited<ReturnType<DevopsClient['loadConfig']>>
      try {
        r = await client.loadConfig()
      } catch {
        return
      }
      if (!r || !r.ok || !r.config) return
      const c = r.config as DevopsSettingsFile
      const glDrafts0 = (c.gitlab?.servers ?? []).map(toGlDraft)
      const kcDrafts0 = (c.k8s?.kubeconfigs ?? []).map(toKcDraft)
      setGlDrafts(glDrafts0)
      setKcDrafts(kcDrafts0)
      setExpandedGl(glDrafts0[0]?.id ?? null)
      setExpandedKc(kcDrafts0[0]?.id ?? null)
      setHasSavedConfig(true)

      // 静默重验：对每套完整保存的 GitLab 配置拉取项目/分支，让下拉直接可用
      for (const d of glDrafts0) {
        if (!d.baseUrl || !d.token) continue
        try {
          const pr = await client.gitlabProjects({ baseUrl: d.baseUrl, token: d.token })
          if (!pr.ok || !pr.projects) {
            updateGl(d.id, { testStatus: 'error', testMsg: pr.message || t('restoreFail') })
            continue
          }
          updateGl(d.id, { testStatus: 'ok', testMsg: t('restored'), projects: pr.projects })
          const known = d.projectPath && pr.projects.some((p) => p.path === d.projectPath)
          if (known && d.projectPath) {
            try {
              const br = await client.gitlabBranches({ baseUrl: d.baseUrl, path: d.projectPath, token: d.token })
              if (br.ok && br.branches) {
                const names = br.branches.map((b) => b.name)
                updateGl(d.id, {
                  branches: names,
                  branchesAll: names,
                  branch: names.includes(d.branch) ? d.branch : names[0] ?? d.branch,
                })
              }
            } catch {
              /* 分支列表尽力而为 */
            }
          }
        } catch {
          updateGl(d.id, { testStatus: 'error', testMsg: t('restoreFail') })
        }
      }

      // K8s：test-k8s 一次调用同时验证并拿回 context 列表
      for (const d of kcDrafts0) {
        if (!d.path) continue
        try {
          const tk = await client.testK8s({ kubeconfigPath: d.path, context: d.context || undefined })
          if (tk.ok) {
            updateKc(d.id, { testStatus: 'ok', testMsg: tk.message, contexts: tk.contexts ?? [] })
            if (d.context) {
              try {
                const nr = await client.k8sNamespaces({ kubeconfigPath: d.path, context: d.context })
                if (nr.ok && nr.namespaces) updateKc(d.id, { namespaces: nr.namespaces })
              } catch {
                /* 手动 namespace 仍可用 */
              }
            }
          } else {
            updateKc(d.id, { testStatus: 'error', testMsg: tk.message || t('k8sFail') })
          }
        } catch {
          updateKc(d.id, { testStatus: 'error', testMsg: t('k8sFail') })
        }
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── GitLab 卡片操作 ─────────────────────────────────────────────────────────

  function addGl() {
    const id = `s${Date.now()}`
    setGlDrafts((list) => [...list, emptyGlDraft(id, `GitLab ${list.length + 1}`)])
    setExpandedGl(id)
  }
  function removeGl(id: string) {
    setGlDrafts((list) => list.filter((d) => d.id !== id))
    setExpandedGl((cur) => (cur === id ? null : cur))
  }
  async function toggleGl(id: string) {
    setExpandedGl((cur) => (cur === id ? null : id))
  }

  async function testGl(id: string) {
    const d = glDrafts.find((x) => x.id === id)
    if (!d) return
    if (!d.baseUrl || !d.token) {
      updateGl(id, { testStatus: 'error', testMsg: t('fillGl') })
      return
    }
    updateGl(id, { testStatus: 'testing', testMsg: t('connecting'), projectsFetching: true })
    try {
      const r = await client.testGitLab({ baseUrl: d.baseUrl, token: d.token })
      if (!r.ok) {
        updateGl(id, { testStatus: 'error', testMsg: r.message, projectsFetching: false })
        return
      }
      updateGl(id, { testStatus: 'ok', testMsg: r.message })
      const pr = await client.gitlabProjects({ baseUrl: d.baseUrl, token: d.token })
      updateGl(id, { projects: pr.ok && pr.projects ? pr.projects : [], projectsFetching: false })
    } catch (e) {
      updateGl(id, { testStatus: 'error', testMsg: (e as Error).message, projectsFetching: false })
    }
  }

  async function refreshProjects(id: string) {
    const d = glDrafts.find((x) => x.id === id)
    if (!d?.baseUrl || !d.token) return
    updateGl(id, { projectsFetching: true })
    try {
      const pr = await client.gitlabProjects({ baseUrl: d.baseUrl, token: d.token })
      updateGl(id, { projects: pr.ok && pr.projects ? pr.projects : [], projectsFetching: false })
    } catch {
      updateGl(id, { projectsFetching: false })
    }
  }

  function searchProjects(id: string) {
    const d = glDrafts.find((x) => x.id === id)
    if (!d) return
    const keyword = d.projSearch.trim().toLowerCase()
    if (!keyword) {
      void refreshProjects(id)
      return
    }
    const filtered = d.projects.filter(
      (p) => p.path.toLowerCase().includes(keyword) || (p.name || '').toLowerCase().includes(keyword),
    )
    if (filtered.length === 0) void searchProjectsServer(id, keyword)
    else updateGl(id, { projects: filtered })
  }

  async function searchProjectsServer(id: string, keyword: string) {
    const d = glDrafts.find((x) => x.id === id)
    if (!d?.baseUrl || !d.token) return
    updateGl(id, { projectsFetching: true })
    try {
      const pr = await client.gitlabProjects({ baseUrl: d.baseUrl, token: d.token, search: keyword })
      updateGl(id, { projects: pr.ok && pr.projects ? pr.projects : [], projectsFetching: false })
    } catch {
      updateGl(id, { projectsFetching: false })
    }
  }

  async function onProjectChange(id: string, path: string) {
    const d = glDrafts.find((x) => x.id === id)
    const proj = d?.projects.find((p) => p.path === path)
    if (!d || !proj) return
    updateGl(id, {
      projectPath: path,
      branch: proj.defaultBranch || '',
      branches: [],
      branchesLoading: true,
      branchesError: '',
    })
    try {
      const r = await client.gitlabBranches({ baseUrl: d.baseUrl, path: proj.path, token: d.token })
      if (r.ok && r.branches) {
        const names = r.branches.map((b) => b.name)
        updateGl(id, { branches: names, branchesAll: names, branchesLoading: false, branchesError: '' })
      } else {
        updateGl(id, { branchesLoading: false, branchesError: r.message || t('brFail') })
      }
    } catch (e) {
      updateGl(id, { branchesLoading: false, branchesError: (e as Error).message || t('brFail') })
    }
  }

  function searchBranches(id: string) {
    const d = glDrafts.find((x) => x.id === id)
    if (!d) return
    const keyword = d.branchSearch.trim().toLowerCase()
    updateGl(id, { branches: keyword ? d.branchesAll.filter((b) => b.toLowerCase().includes(keyword)) : d.branchesAll })
  }

  // ─── K8s 卡片操作 ────────────────────────────────────────────────────────────

  function addKc() {
    const id = `k${Date.now()}`
    setKcDrafts((list) => [...list, emptyKcDraft(id, `K8s ${list.length + 1}`)])
    setExpandedKc(id)
  }
  function removeKc(id: string) {
    setKcDrafts((list) => list.filter((d) => d.id !== id))
    setExpandedKc((cur) => (cur === id ? null : cur))
  }

  async function testKc(id: string) {
    const d = kcDrafts.find((x) => x.id === id)
    if (!d) return
    if (!d.path) {
      updateKc(id, { testStatus: 'error', testMsg: t('fillKc') })
      return
    }
    updateKc(id, { testStatus: 'testing', testMsg: t('connecting') })
    try {
      const r = await client.testK8s({ kubeconfigPath: d.path, context: d.context || undefined })
      if (!r.ok) {
        updateKc(id, { testStatus: 'error', testMsg: r.message })
        return
      }
      const contexts = r.contexts ?? []
      const defaultCtx = d.context || contexts[0]?.name || ''
      const defaultNs = contexts.find((c) => c.name === defaultCtx)?.namespace ?? r.namespace ?? ''
      updateKc(id, {
        testStatus: 'ok',
        testMsg: r.message,
        contexts,
        context: defaultCtx,
        namespace: d.namespace || defaultNs,
        namespacesLoading: !!defaultCtx,
      })
      if (defaultCtx) {
        try {
          const nr = await client.k8sNamespaces({ kubeconfigPath: d.path, context: defaultCtx })
          updateKc(id, { namespaces: nr.ok && nr.namespaces ? nr.namespaces : [], namespacesLoading: false })
        } catch {
          updateKc(id, { namespacesLoading: false })
        }
      }
    } catch (e) {
      updateKc(id, { testStatus: 'error', testMsg: (e as Error).message })
    }
  }

  async function onContextChange(id: string, ctxName: string) {
    const d = kcDrafts.find((x) => x.id === id)
    if (!d) return
    const cfg = d.contexts.find((c) => c.name === ctxName)
    updateKc(id, { context: ctxName, namespace: cfg?.namespace || '', namespaces: [], namespacesLoading: true })
    try {
      const r = await client.k8sNamespaces({ kubeconfigPath: d.path, context: ctxName })
      updateKc(id, { namespaces: r.ok && r.namespaces ? r.namespaces : [], namespacesLoading: false })
    } catch {
      updateKc(id, { namespacesLoading: false })
    }
  }

  async function handleBrowseKc(id: string) {
    try {
      const r = await client.browseFile()
      if (r.ok && r.path) updateKc(id, { path: r.path, testStatus: '', testMsg: '' })
    } catch {
      /* cancelled */
    }
  }

  // ─── 保存 ────────────────────────────────────────────────────────────────────

  async function handleSave() {
    const config: Record<string, unknown> = {}
    if (glDrafts.length > 0) {
      const firstUsable = glDrafts.find((s) => s.baseUrl && s.token && s.projectPath)
      config.gitlab = {
        servers: glDrafts.map(plainGl),
        activeServerId: firstUsable?.id ?? glDrafts[0]?.id ?? null,
      }
    }
    if (kcDrafts.length > 0) {
      const firstUsable = kcDrafts.find((k) => k.path)
      config.k8s = {
        kubeconfigs: kcDrafts.map(plainKc),
        activeKubeconfigId: firstUsable?.id ?? kcDrafts[0]?.id ?? null,
      }
    }
    if (!config.gitlab && !config.k8s) {
      setSaveStatus('error')
      setSaveMsg(t('completeOne'))
      return
    }
    try {
      const r = await client.saveConfig(config)
      if (r.ok) {
        setSaveStatus('ok')
        setSaveMsg(t('saved'))
        setHasSavedConfig(true)
      } else {
        setSaveStatus('error')
        setSaveMsg(r.message || t('saveFailed'))
      }
    } catch (e) {
      setSaveStatus('error')
      setSaveMsg((e as Error).message)
    }
  }

  const glConnected = glDrafts.some((d) => d.testStatus === 'ok')
  const kcConnected = kcDrafts.some((d) => d.testStatus === 'ok')

  // ─── 渲染 ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '0 4px 24px', maxWidth: 640 }}>
      {!hasSavedConfig ? (
        <div className={cssUI.callout} style={{ marginBottom: 20 }}>
          <strong>{t('notCfgYet')}</strong>
          <div style={{ marginTop: 4 }}>{t('fillGlOrK8s')}</div>
        </div>
      ) : null}

      {/* ═══ GitLab ═══ */}
      <Section title="GitLab" badge={glConnected ? t('connected') : undefined}>
        {glDrafts.length === 0 ? (
          <button type="button" className={cssUI.emptyCard} onClick={addGl}>
            + {t('addServer')}
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {glDrafts.map((d) => {
              const expanded = expandedGl === d.id
              const st = d.testStatus
              const keyword = d.branchSearch.trim().toLowerCase()
              const filteredBranches = keyword
                ? d.branchesAll.filter((b) => b.toLowerCase().includes(keyword))
                : d.branches
              return (
                <div key={d.id} className={cssUI.serverCard}>
                  <div
                    className={cssUI.cardHeader}
                    onClick={() => void toggleGl(d.id)}
                    role="button"
                    aria-expanded={expanded}
                  >
                    <Dot tone={st === 'ok' ? 'ok' : st === 'error' ? 'err' : 'neutral'} />
                    <span className={cssUI.cardHeaderLabel}>{d.label || t('unnamed')}</span>
                    <span className={cssUI.cardHeaderPath}>{d.baseUrl || t('noUrl')}</span>
                    {st === 'ok' ? (
                      <Badge tone="ok">{t('connected')}</Badge>
                    ) : st === 'error' ? (
                      <Badge tone="err">{t('connectFailed')}</Badge>
                    ) : null}
                    <span className={cssUI.cardChevron}>{expanded ? '▾' : '▸'}</span>
                  </div>
                  {expanded && (
                    <div className={cssUI.cardBody}>
                      <div>
                        <Label>{t('name')}</Label>
                        <Input
                          type="text"
                          value={d.label}
                          placeholder={t('nameGlPh')}
                          onChange={(e) => updateGl(d.id, { label: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Base URL</Label>
                        <Input
                          type="url"
                          value={d.baseUrl}
                          placeholder="https://gitlab.example.com"
                          onChange={(e) => updateGl(d.id, { baseUrl: e.target.value, testStatus: '', testMsg: '' })}
                        />
                      </div>
                      <div>
                        <Label>Access Token</Label>
                        <Input
                          type="password"
                          value={d.token}
                          placeholder="glpat-xxxx..."
                          onChange={(e) => updateGl(d.id, { token: e.target.value, testStatus: '', testMsg: '' })}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <Btn onClick={() => void testGl(d.id)} disabled={st === 'testing'}>
                          {st === 'testing' ? t('connecting') : t('testConn')}
                        </Btn>
                        <div>
                          <Status status={st} msg={d.testMsg} />
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Label>{t('project')}</Label>
                          {st === 'ok' && d.projects.length > 0 ? (
                            <Btn onClick={() => void refreshProjects(d.id)} disabled={d.projectsFetching} variant="outline" small>
                              {d.projectsFetching ? '...' : t('refresh')}
                            </Btn>
                          ) : null}
                        </div>
                        {st !== 'ok' && <div className={cssUI.hint}>{t('testGlFirst')}</div>}
                        {st === 'ok' && (
                          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                            <input
                              type="text"
                              value={d.projSearch}
                              placeholder={t('searchProjPh')}
                              className={cssUI.input}
                              style={{ flex: 1 }}
                              onChange={(e) => updateGl(d.id, { projSearch: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') searchProjects(d.id)
                              }}
                            />
                            <Btn onClick={() => searchProjects(d.id)} small variant="outline">
                              {t('search')}
                            </Btn>
                          </div>
                        )}
                        <Select
                          t={t}
                          options={d.projects.map((p) => p.path).filter(Boolean)}
                          value={d.projectPath}
                          onChange={(v) => void onProjectChange(d.id, v)}
                          disabled={st !== 'ok' || d.projectsFetching || d.projects.length === 0}
                          placeholder={
                            st !== 'ok'
                              ? t('testFirst')
                              : d.projectsFetching
                                ? t('loading')
                                : d.projects.length === 0
                                  ? t('noProjects')
                                  : t('selProject')
                          }
                        />
                      </div>

                      <div>
                        <Label>{t('branch')}</Label>
                        {!d.projectPath && <div className={cssUI.hint}>{t('selProjFirst')}</div>}
                        {d.branchesError && (
                          <div style={{ fontSize: 12, color: '#ff453a', marginBottom: 6 }}>⚠ {d.branchesError}</div>
                        )}
                        {d.projectPath && !d.branchesLoading && d.branches.length > 0 && (
                          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                            <input
                              type="text"
                              value={d.branchSearch}
                              placeholder={t('searchBrPh')}
                              className={cssUI.input}
                              style={{ flex: 1 }}
                              onChange={(e) => updateGl(d.id, { branchSearch: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') searchBranches(d.id)
                              }}
                            />
                            <Btn onClick={() => searchBranches(d.id)} small variant="outline">
                              {t('search')}
                            </Btn>
                          </div>
                        )}
                        <Select
                          t={t}
                          options={
                            d.branchesLoading
                              ? [{ value: '__loading', label: t('loadingBr'), disabled: true }]
                              : filteredBranches.length === 0
                                ? [{ value: '__empty', label: t('noBranches'), disabled: true }]
                                : filteredBranches
                          }
                          value={d.branch}
                          onChange={(v) => updateGl(d.id, { branch: v })}
                          disabled={!d.projectPath || d.branchesLoading}
                          placeholder={!d.projectPath ? t('selProjFirst') : t('selBranch')}
                        />
                      </div>

                      {glDrafts.length > 1 ? (
                        <div style={{ borderTop: '1px solid var(--ds-alias-border,#2a2a2a)', paddingTop: 8 }}>
                          <button type="button" className={cssUI.dangerLink} onClick={() => removeGl(d.id)}>
                            {t('delGl')}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )
            })}
            <Btn onClick={addGl} small variant="outline">
              {t('addServer')}
            </Btn>
          </div>
        )}
      </Section>

      {/* ═══ Kubernetes ═══ */}
      <Section title="Kubernetes" badge={kcConnected ? t('connected') : undefined}>
        {kcDrafts.length === 0 ? (
          <button type="button" className={cssUI.emptyCard} onClick={addKc}>
            + {t('addKc')}
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {kcDrafts.map((d) => {
              const expanded = expandedKc === d.id
              const st = d.testStatus
              return (
                <div key={d.id} className={cssUI.serverCard}>
                  <div
                    className={cssUI.cardHeader}
                    onClick={() => setExpandedKc((cur) => (cur === d.id ? null : d.id))}
                    role="button"
                    aria-expanded={expanded}
                  >
                    <Dot tone={st === 'ok' ? 'ok' : st === 'error' ? 'err' : 'neutral'} />
                    <span className={cssUI.cardHeaderLabel}>{d.label || t('unnamed')}</span>
                    <span className={cssUI.cardHeaderPath}>{d.path || t('noPath')}</span>
                    {st === 'ok' ? (
                      <Badge tone="ok">{t('connected')}</Badge>
                    ) : st === 'error' ? (
                      <Badge tone="err">{t('connectFailed')}</Badge>
                    ) : null}
                    <span className={cssUI.cardChevron}>{expanded ? '▾' : '▸'}</span>
                  </div>
                  {expanded && (
                    <div className={cssUI.cardBody}>
                      <div>
                        <Label>{t('name')}</Label>
                        <Input
                          type="text"
                          value={d.label}
                          placeholder={t('nameK8sPh')}
                          onChange={(e) => updateKc(d.id, { label: e.target.value })}
                        />
                      </div>

                      <div>
                        <Label>{t('kcPath')}</Label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Input
                              type="url"
                              value={d.path}
                              placeholder="~/.kube/config"
                              onChange={(e) => updateKc(d.id, { path: e.target.value, testStatus: '', testMsg: '' })}
                            />
                          </div>
                          <Btn onClick={() => void handleBrowseKc(d.id)} variant="outline">
                            {t('browse')}
                          </Btn>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <Btn onClick={() => void testKc(d.id)} disabled={st === 'testing'}>
                          {st === 'testing' ? t('connecting') : t('testConn')}
                        </Btn>
                        <div>
                          <Status status={st} msg={d.testMsg} />
                        </div>
                      </div>

                      <div>
                        <Label>Context</Label>
                        {st !== 'ok' && <div className={cssUI.hint}>{t('testK8sFirst')}</div>}
                        <Select
                          t={t}
                          options={d.contexts.map((c) => c.name).filter(Boolean)}
                          value={d.context}
                          onChange={(v) => void onContextChange(d.id, v)}
                          disabled={st !== 'ok' || d.contexts.length === 0}
                          placeholder={st !== 'ok' ? t('testFirst') : t('selCtx')}
                        />
                      </div>

                      <div>
                        <Label>Namespace</Label>
                        {!d.context && <div className={cssUI.hint}>{t('selCtxFirst')}</div>}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Select
                              t={t}
                              options={
                                d.namespacesLoading
                                  ? [{ value: '__loading', label: t('loadingNs'), disabled: true }]
                                  : d.namespaces
                              }
                              value={d.namespaces.includes(d.namespace) ? d.namespace : ''}
                              onChange={(v) => {
                                if (!v) return
                                updateKc(d.id, { namespace: v })
                              }}
                              disabled={!d.context || d.namespacesLoading}
                              placeholder={!d.context ? t('selCtxFirst') : t('selNs')}
                            />
                          </div>
                          <input
                            type="text"
                            value={d.namespace}
                            placeholder={t('manualNs')}
                            className={cssUI.input}
                            style={{ flex: 1 }}
                            onChange={(e) => updateKc(d.id, { namespace: e.target.value })}
                          />
                        </div>
                        <div className={cssUI.hint}>{t('nsHint')}</div>
                      </div>

                      {kcDrafts.length > 1 ? (
                        <div style={{ borderTop: '1px solid var(--ds-alias-border,#2a2a2a)', paddingTop: 8 }}>
                          <button type="button" className={cssUI.dangerLink} onClick={() => removeKc(d.id)}>
                            {t('delK8s')}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )
            })}
            <Btn onClick={addKc} small variant="outline">
              {t('addKc')}
            </Btn>
          </div>
        )}
      </Section>

      {/* ═══ Save ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Btn onClick={() => void handleSave()} tone="success">
          {t('saveConfig')}
        </Btn>
        <Status status={saveStatus} msg={saveMsg} />
      </div>
    </div>
  )
}
