// @vitest-environment jsdom
/// <reference types="@testing-library/react" />
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { createElement } from 'react'
import { DevopsSettings } from '../../src/client/DevopsSettings.tsx'
import { DevopsDashboard } from '../../src/client/DevopsDashboard.tsx'
import { apply as clientApply, inject as clientInject } from '../../src/client/index.ts'
import { ZH } from '../../src/client/locales.ts'
import type { DevopsClientContext, ClientLocale, ClientSlots } from '../../src/client/dsh-context.ts'

const t = (key: string, vars?: Record<string, unknown>) => {
  let s: string = ZH[key as keyof typeof ZH] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
  return s
}

function makeLocale(): ClientLocale {
  return {
    register: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    bind: (ns: string) => t,
    getSnapshot: () => ({ revision: 1 }),
    subscribe: () => () => {},
  }
}

function makeSlots() {
  const registered: { options: unknown; component: unknown }[] = []
  const injected: string[] = []
  const slots: ClientSlots = {
    inject: (name, setup) => {
      injected.push(name)
      // The real slot runtime invokes the setup as soon as the parent slot
      // exists; mirror that so the test sees the nested registration.
      setup()
      return () => {}
    },
    register: (options, component) => {
      registered.push({ options, component })
      return () => {}
    },
  }
  return { slots, registered, injected }
}

function makeCtx(rpcValue: unknown) {
  const { slots, registered, injected } = makeSlots()
  const connection = {
    rpc: {
      call: vi.fn(async (): Promise<{ ok: true; value: unknown }> => ({ ok: true, value: rpcValue })),
    },
  }
  const ctx: DevopsClientContext = {
    slots,
    locale: makeLocale(),
    connection,
    effect: (fn) => fn(),
  }
  return { ctx, registered, injected, connection }
}

describe('client entry', () => {
  it('declares its injected services and registers both slots', () => {
    expect(clientInject).toEqual(['slots', 'locale', 'connection'])
    const { ctx, registered, injected } = makeCtx({ ok: true, config: null })
    clientApply(ctx)
    expect(injected).toEqual(['settings.section', 'conversation.view'])
    const ids = registered.map((r) => (r.options as { id: string }).id)
    expect(ids).toContain('dsh-devops')
    expect(ids).toContain('devops')
  })

  it('registers the locale dictionaries', () => {
    const { ctx } = makeCtx({ ok: true, config: null })
    const register = vi.fn()
    ctx.locale.register = register
    clientApply(ctx)
    expect(register).toHaveBeenCalledWith('dsh-devops', 'zh', expect.anything())
    expect(register).toHaveBeenCalledWith('dsh-devops', 'en', expect.anything())
  })
})

describe('DevopsSettings (jsdom smoke)', () => {
  it('renders the GitLab / Kubernetes sections and loads the saved config', async () => {
    const { ctx } = makeCtx({ ok: true, config: null })
    const props = { connection: ctx.connection, locale: ctx.locale, t }
    render(createElement(DevopsSettings, props))
    await waitFor(() => expect(ctx.connection.rpc.call).toHaveBeenCalled())
    expect(screen.getByText('GitLab')).toBeTruthy()
    expect(screen.getByText('Kubernetes')).toBeTruthy()
    expect(screen.getByText(ZH.saveConfig)).toBeTruthy()
  })

  it('card flow: empty state → add → fill → save persists servers', async () => {
    const calls: { channel: string; endpoint: string; payload: unknown }[] = []
    const connection = {
      rpc: {
        call: vi.fn(
          async (channel: string, endpoint: string, payload: unknown): Promise<{ ok: true; value: unknown }> => {
            calls.push({ channel, endpoint, payload })
            if (endpoint === 'config-load') return { ok: true, value: { ok: true, config: null } }
            return { ok: true, value: { ok: true } }
          },
        ),
      },
    }
    const props = { connection, locale: makeLocale(), t }
    render(createElement(DevopsSettings, props))
    await waitFor(() => expect(screen.getByText('+ ' + ZH.addServer)).toBeTruthy())

    // 空态点击 → 出现展开的空卡（编辑表单直接在卡片内）
    fireEvent.click(screen.getByText('+ ' + ZH.addServer))
    const nameInput = await waitFor(() => screen.getByPlaceholderText(ZH.nameGlPh) as HTMLInputElement)
    expect(nameInput).toBeTruthy()

    // 填写并保存 → save-config 收到 servers 列表
    fireEvent.change(nameInput, { target: { value: '本地 GitLab' } })
    fireEvent.change(screen.getByPlaceholderText('https://gitlab.example.com'), { target: { value: 'http://localhost:8080' } })
    fireEvent.click(screen.getByText(ZH.saveConfig))
    await waitFor(() => {
      const save = calls.find((c) => c.endpoint === 'config-save')
      expect(save).toBeTruthy()
      const servers = (save!.payload as { gitlab: { servers: { label: string; baseUrl: string }[] } }).gitlab.servers
      expect(servers[0]!.label).toBe('本地 GitLab')
      expect(servers[0]!.baseUrl).toBe('http://localhost:8080')
    })
  })
})

describe('DevopsDashboard (jsdom smoke)', () => {
  it('shows the not-configured empty state when no config is saved', async () => {
    const { ctx } = makeCtx({ ok: true, config: null })
    const props = { connection: ctx.connection, locale: ctx.locale, t }
    render(createElement(DevopsDashboard, props))
    await waitFor(() => expect(screen.getByText(ZH.notCfgBig)).toBeTruthy())
    expect(screen.getByText(ZH.goCfg)).toBeTruthy()
  })

  it('renders deployments with pod start time and refresh button, and filters via search', async () => {
    const config = {
      k8s: {
        kubeconfigs: [{ id: 'kc1', label: '测试集群', path: '/tmp/kc.yaml', context: '', namespace: 'ns1' }],
        activeKubeconfigId: 'kc1',
      },
    }
    const deployments = [
      { name: 'order-server', ready: 2, replicas: 2, image: 'registry/order-server:1.0.0', imageTag: '1.0.0', updated: '2026-01-01T00:00:00Z' },
      { name: 'mall-gateway', ready: 1, replicas: 1, image: 'registry/mall-gateway:2.0.0', imageTag: '2.0.0', updated: '2026-01-01T00:00:00Z' },
    ]
    const pods = [
      {
        name: 'order-server-abc123',
        phase: 'Running',
        ready: 1,
        total: 1,
        restarts: 0,
        node: 'node-1',
        reason: '',
        startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      },
    ]
    const call = vi.fn(async (_channel: string, endpoint: string): Promise<{ ok: true; value: unknown }> => {
      if (endpoint === 'config-load') return { ok: true, value: { ok: true, config } }
      if (endpoint === 'k8s-deployments') return { ok: true, value: { ok: true, deployments } }
      if (endpoint === 'k8s-pods') return { ok: true, value: { ok: true, pods } }
      if (endpoint === 'k8s-events') return { ok: true, value: { ok: true, events: [] } }
      return { ok: true, value: { ok: false } }
    })
    const connection = { rpc: { call } }
    render(createElement(DevopsDashboard, { connection, locale: makeLocale(), t }))
    // 切到 K8s tab（'K8s' 文本同时出现在 SwitchCard 标题里，取 tab 按钮）
    const k8sTab = await waitFor(() => {
      const btn = screen
        .getAllByText('K8s')
        .map((el) => el.closest('button'))
        .find((b) => b && b.textContent === 'K8s')
      expect(btn).toBeTruthy()
      return btn!
    })
    fireEvent.click(k8sTab)
    // 两个部署都渲染
    await waitFor(() => expect(screen.getByText('order-server')).toBeTruthy())
    expect(screen.getByText('mall-gateway')).toBeTruthy()
    // 展开 deployment：pod 行显示启动时间
    fireEvent.click(screen.getByText('order-server'))
    await waitFor(() => expect(screen.getByText('order-server-abc123')).toBeTruthy())
    expect(screen.getByText(t('minAgo', { n: 5 }))).toBeTruthy()
    // 子 tab 刷新按钮：点击后重新拉取列表（初始 1 次 + 手动 1 次）
    const depCalls = () => call.mock.calls.filter(([, ep]) => ep === 'k8s-deployments').length
    expect(depCalls()).toBe(1)
    const refreshBtn = await waitFor(() => {
      const btn = screen.getByText(ZH.refresh).closest('button') as HTMLButtonElement
      expect(btn).toBeTruthy()
      expect(btn.disabled).toBe(false)
      return btn
    })
    fireEvent.click(refreshBtn)
    await waitFor(() => expect(depCalls()).toBe(2))
    // 搜索过滤
    fireEvent.change(screen.getByPlaceholderText(ZH.searchDepsPh), { target: { value: 'order' } })
    expect(screen.getByText('order-server')).toBeTruthy()
    expect(screen.queryByText('mall-gateway')).toBeNull()
    // 无匹配提示
    fireEvent.change(screen.getByPlaceholderText(ZH.searchDepsPh), { target: { value: 'zzz' } })
    expect(screen.getByText(ZH.noMatchDeps)).toBeTruthy()
  })

  it('stat cards jump to the matching tab / sub-tab on click', async () => {
    const config = {
      gitlab: {
        servers: [
          { id: 'gl1', label: 'GitLab', baseUrl: 'http://localhost:8080', token: 'tok', projectPath: 'group/proj', branch: 'main' },
        ],
        activeServerId: 'gl1',
      },
      k8s: {
        kubeconfigs: [{ id: 'kc1', label: '测试集群', path: '/tmp/kc.yaml', context: '', namespace: 'ns1' }],
        activeKubeconfigId: 'kc1',
      },
    }
    const pipelines = [
      {
        id: 42,
        status: 'success',
        ref: 'main',
        sha: 'abc12345',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        duration: 60,
        webUrl: 'http://localhost:8080/group/proj/-/pipelines/42',
      },
    ]
    const call = vi.fn(async (_channel: string, endpoint: string): Promise<{ ok: true; value: unknown }> => {
      if (endpoint === 'config-load') return { ok: true, value: { ok: true, config } }
      if (endpoint === 'gitlab-mrs') return { ok: true, value: { ok: true, mergeRequests: [] } }
      if (endpoint === 'gitlab-pipelines') return { ok: true, value: { ok: true, pipelines } }
      if (endpoint === 'gitlab-tags') return { ok: true, value: { ok: true, tags: [] } }
      if (endpoint === 'gitlab-projects')
        return { ok: true, value: { ok: true, projects: [{ id: '1', name: 'proj', path: 'group/proj', defaultBranch: 'main' }] } }
      if (endpoint === 'k8s-deployments') return { ok: true, value: { ok: true, deployments: [] } }
      if (endpoint === 'k8s-pods') return { ok: true, value: { ok: true, pods: [] } }
      if (endpoint === 'k8s-events') return { ok: true, value: { ok: true, events: [] } }
      if (endpoint === 'k8s-contexts') return { ok: true, value: { ok: true, contexts: [] } }
      if (endpoint === 'k8s-namespaces') return { ok: true, value: { ok: true, namespaces: ['ns1'] } }
      return { ok: true, value: { ok: false } }
    })
    render(createElement(DevopsDashboard, { connection: { rpc: { call } }, locale: makeLocale(), t }))
    // 默认 gitlab/mrs 子 tab：MR 列表为空提示
    await waitFor(() => expect(screen.getByText(ZH.noMrs)).toBeTruthy())
    // 点击「流水线」统计卡（同文本也出现在子 tab 按钮上，用 statCard 容器定位）
    const card = screen
      .getAllByText(ZH.statPipsTitle)
      .map((el) => el.closest('[class*="statCard"]'))
      .find((c): c is Element => c != null)
    expect(card).toBeTruthy()
    fireEvent.click(card!)
    // 跳到 gitlab/pipelines 子 tab：流水线行渲染
    await waitFor(() => expect(screen.getByText('#42')).toBeTruthy())
  })

  it('MR list filters by state (server-side) and hides actions when not opened', async () => {
    const config = {
      gitlab: {
        servers: [
          { id: 'gl1', label: 'GitLab', baseUrl: 'http://localhost:8080', token: 'tok', projectPath: 'group/proj', branch: 'main' },
        ],
        activeServerId: 'gl1',
      },
    }
    const mr = (iid: number, title: string) => ({
      iid,
      title,
      state: 'opened',
      author: 'dev',
      sourceBranch: 'feat/x',
      targetBranch: 'main',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      approvalsBeforeMerge: 0,
      mergeStatus: 'can_be_merged',
      workInProgress: false,
      draft: false,
      webUrl: `http://localhost:8080/group/proj/-/merge_requests/${iid}`,
    })
    const call = vi.fn(async (_channel: string, endpoint: string, payload: unknown): Promise<{ ok: true; value: unknown }> => {
      if (endpoint === 'config-load') return { ok: true, value: { ok: true, config } }
      if (endpoint === 'gitlab-mrs') {
        const state = (payload as { state?: string }).state
        return { ok: true, value: { ok: true, mergeRequests: state === 'merged' ? [mr(9, 'merged-mr')] : [mr(1, 'open-mr')] } }
      }
      if (endpoint === 'gitlab-pipelines') return { ok: true, value: { ok: true, pipelines: [] } }
      if (endpoint === 'gitlab-tags') return { ok: true, value: { ok: true, tags: [] } }
      return { ok: true, value: { ok: false } }
    })
    render(createElement(DevopsDashboard, { connection: { rpc: { call } }, locale: makeLocale(), t }))
    // 默认 opened 子 tab：显示 !1
    await waitFor(() => expect(screen.getByText('!1')).toBeTruthy())
    expect(screen.getByText('open-mr')).toBeTruthy()
    // 切到已合并：server-side 重拉（state=merged）
    fireEvent.click(screen.getByText(ZH.stateMerged))
    await waitFor(() => expect(screen.getByText('!9')).toBeTruthy())
    expect(screen.getByText('merged-mr')).toBeTruthy()
    expect(screen.queryByText('!1')).toBeNull()
    // 该状态的请求确已发出
    expect(call.mock.calls.some(([, ep, p]) => ep === 'gitlab-mrs' && (p as { state?: string }).state === 'merged')).toBe(true)
    // 非开放状态不显示审批/关闭按钮
    expect(screen.queryByText(ZH.approve)).toBeNull()
    expect(screen.queryByText(ZH.close)).toBeNull()
    // 切回开放
    fireEvent.click(screen.getByText(ZH.stateOpened))
    await waitFor(() => expect(screen.getByText('!1')).toBeTruthy())
  })

  it('pipeline list filters by status client-side', async () => {
    const config = {
      gitlab: {
        servers: [
          { id: 'gl1', label: 'GitLab', baseUrl: 'http://localhost:8080', token: 'tok', projectPath: 'group/proj', branch: 'main' },
        ],
        activeServerId: 'gl1',
      },
    }
    const pip = (id: number, status: string) => ({
      id,
      status,
      ref: 'main',
      sha: `abc${id}`,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      duration: 60,
      webUrl: `http://localhost:8080/group/proj/-/pipelines/${id}`,
    })
    const call = vi.fn(async (_channel: string, endpoint: string): Promise<{ ok: true; value: unknown }> => {
      if (endpoint === 'config-load') return { ok: true, value: { ok: true, config } }
      if (endpoint === 'gitlab-mrs') return { ok: true, value: { ok: true, mergeRequests: [] } }
      if (endpoint === 'gitlab-pipelines')
        return { ok: true, value: { ok: true, pipelines: [pip(42, 'success'), pip(43, 'failed'), pip(44, 'running')] } }
      if (endpoint === 'gitlab-tags') return { ok: true, value: { ok: true, tags: [] } }
      return { ok: true, value: { ok: false } }
    })
    render(createElement(DevopsDashboard, { connection: { rpc: { call } }, locale: makeLocale(), t }))
    // 默认 mrs 子 tab；切到 pipelines 子 tab（统计卡同名但非按钮）
    const pipeTab = await waitFor(() => {
      const btn = screen
        .getAllByText(ZH.statPipsTitle)
        .map((el) => el.closest('button'))
        .find((b) => b && b.textContent?.includes(ZH.statPipsTitle))
      expect(btn).toBeTruthy()
      return btn!
    })
    fireEvent.click(pipeTab)
    await waitFor(() => expect(screen.getByText('#42')).toBeTruthy())
    expect(screen.getByText('#43')).toBeTruthy()
    expect(screen.getByText('#44')).toBeTruthy()
    // 失败：仅 #43
    fireEvent.click(screen.getByText(ZH.statusFailed))
    await waitFor(() => expect(screen.getByText('#43')).toBeTruthy())
    expect(screen.queryByText('#42')).toBeNull()
    expect(screen.queryByText('#44')).toBeNull()
    // 运行中：#44
    fireEvent.click(screen.getByText(ZH.statusRunning))
    await waitFor(() => expect(screen.getByText('#44')).toBeTruthy())
    expect(screen.queryByText('#43')).toBeNull()
    // 已取消：无匹配提示
    fireEvent.click(screen.getByText(ZH.statusCanceled))
    await waitFor(() => expect(screen.getByText(ZH.noMatch)).toBeTruthy())
    // 复位
    fireEvent.click(screen.getByText(ZH.filterAll))
    await waitFor(() => expect(screen.getByText('#42')).toBeTruthy())
  })

  it('deployment list filters by readiness client-side', async () => {
    const config = {
      k8s: {
        kubeconfigs: [{ id: 'kc1', label: '测试集群', path: '/tmp/kc.yaml', context: '', namespace: 'ns1' }],
        activeKubeconfigId: 'kc1',
      },
    }
    const deployments = [
      { name: 'order-server', ready: 2, replicas: 2, image: 'registry/order-server:1.0.0', imageTag: '1.0.0', updated: '2026-01-01T00:00:00Z' },
      { name: 'legacy-svc', ready: 0, replicas: 2, image: 'registry/legacy-svc:0.9.0', imageTag: '0.9.0', updated: '2026-01-01T00:00:00Z' },
      { name: 'part-svc', ready: 1, replicas: 2, image: 'registry/part-svc:0.1.0', imageTag: '0.1.0', updated: '2026-01-01T00:00:00Z' },
    ]
    const call = vi.fn(async (_channel: string, endpoint: string): Promise<{ ok: true; value: unknown }> => {
      if (endpoint === 'config-load') return { ok: true, value: { ok: true, config } }
      if (endpoint === 'k8s-deployments') return { ok: true, value: { ok: true, deployments } }
      if (endpoint === 'k8s-pods') return { ok: true, value: { ok: true, pods: [] } }
      if (endpoint === 'k8s-events') return { ok: true, value: { ok: true, events: [] } }
      return { ok: true, value: { ok: false } }
    })
    render(createElement(DevopsDashboard, { connection: { rpc: { call } }, locale: makeLocale(), t }))
    const k8sTab = await waitFor(() => {
      const btn = screen.getAllByText('K8s').map((el) => el.closest('button')).find((b) => b && b.textContent === 'K8s')
      expect(btn).toBeTruthy()
      return btn!
    })
    fireEvent.click(k8sTab)
    await waitFor(() => expect(screen.getByText('order-server')).toBeTruthy())
    // 未就绪：仅 legacy-svc
    fireEvent.click(screen.getByText(ZH.depDown))
    await waitFor(() => expect(screen.getByText('legacy-svc')).toBeTruthy())
    expect(screen.queryByText('order-server')).toBeNull()
    expect(screen.queryByText('part-svc')).toBeNull()
    // 部分就绪：仅 part-svc
    fireEvent.click(screen.getByText(ZH.depPartial))
    await waitFor(() => expect(screen.getByText('part-svc')).toBeTruthy())
    expect(screen.queryByText('legacy-svc')).toBeNull()
    expect(screen.queryByText('order-server')).toBeNull()
    // 复位
    fireEvent.click(screen.getByText(ZH.filterAll))
    await waitFor(() => expect(screen.getByText('order-server')).toBeTruthy())
  })
})
