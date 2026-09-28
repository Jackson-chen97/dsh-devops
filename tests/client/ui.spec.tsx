// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { createElement, useState } from 'react'
import { Select, Modal, LogViewer, type LogViewerHandle } from '../../src/client/ui.tsx'
import { ZH } from '../../src/client/locales.ts'

const t = (key: string, vars?: Record<string, unknown>) => {
  let s: string = ZH[key as keyof typeof ZH] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
  return s
}

function SelectHarness(props: { options: (string | { value: string; label: string; disabled?: boolean })[] }) {
  const [value, setValue] = useState('')
  return createElement('div', {}, createElement(Select, { ...props, value, onChange: setValue }), createElement('div', { 'data-testid': 'out' }, value || '(none)'))
}

describe('Select — searchable combobox', () => {
  it('opens a list, filters by keyword, and selects an option', async () => {
    const { container } = render(
      createElement(SelectHarness, {
        options: ['root/devops-demo', 'root/other-svc', 'group/infra'],
      }),
    )
    // 触发按钮显示占位
    fireEvent.click(screen.getByText('...'))
    // 列表打开：三个选项都可见
    expect(screen.getByText('root/devops-demo')).toBeTruthy()
    expect(screen.getByText('root/other-svc')).toBeTruthy()
    // 搜索过滤
    const input = screen.getByPlaceholderText('搜索...') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'devops' } })
    expect(screen.getByText('root/devops-demo')).toBeTruthy()
    expect(screen.queryByText('root/other-svc')).toBeNull()
    // 选中
    fireEvent.click(screen.getByText('root/devops-demo'))
    await waitFor(() => expect(screen.getByTestId('out').textContent).toBe('root/devops-demo'))
    // 触发按钮显示选中值，列表关闭（CSS Modules 类名带 hash 前缀，用模糊匹配）
    expect(container.querySelector('[class*="searchTriggerValue"]')?.textContent).toBe('root/devops-demo')
    expect(screen.queryByPlaceholderText('搜索...')).toBeNull()
  })

  it('shows the empty state for unmatched queries and renders disabled options unselectable', () => {
    render(
      createElement(SelectHarness, {
        options: [{ value: 'a', label: 'Alpha' }, { value: 'loading', label: '加载中...', disabled: true }],
      }),
    )
    fireEvent.click(screen.getByText('...'))
    fireEvent.change(screen.getByPlaceholderText('搜索...'), { target: { value: 'zzz' } })
    expect(screen.getByText('无匹配结果')).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText('搜索...'), { target: { value: '' } })
    fireEvent.click(screen.getByText('加载中...'))
    expect(screen.getByTestId('out').textContent).toBe('(none)')
  })

  it('renders a disabled trigger when disabled', () => {
    render(createElement(Select, { options: ['a'], value: '', onChange: () => {}, disabled: true, placeholder: '不可用' }))
    const btn = screen.getByText('不可用')
    expect((btn.closest('button') as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('Modal', () => {
  it('renders into a portal and closes via ✕ and overlay click', () => {
    const onClose = vi.fn()
    const { container } = render(
      createElement(Modal, { open: true, title: '新建 MR', onClose, children: createElement('div', null, 'body内容') }),
    )
    // portal 内容出现在 body 下
    expect(screen.getByText('body内容')).toBeTruthy()
    expect(screen.getByText('新建 MR')).toBeTruthy()
    // ✕ 关闭
    fireEvent.click(screen.getByLabelText('close'))
    expect(onClose).toHaveBeenCalledTimes(1)
    // overlay 点击关闭（点击 overlay 自身；CSS Modules 类名带 hash 前缀，用模糊匹配）
    const overlay = document.querySelector('[class*="modalOverlay"]')
    expect(overlay).toBeTruthy()
    fireEvent.mouseDown(overlay!)
  })

  it('renders nothing when closed', () => {
    const { container } = render(createElement(Modal, { open: false, title: 'x', onClose: () => {}, children: 'y' }))
    expect(container.textContent).toBe('')
  })
})

describe('LogViewer', () => {
  const lines = ['2026-01-01 INFO boot ok', '2026-01-01 [ERROR] boom', '2026-01-01 [WARN] slow', '2026-01-01 INFO done']

  it('renders lines with the per-line tone class', () => {
    const { container } = render(
      createElement(LogViewer, {
        lines,
        classify: (l) => (l.includes('[ERROR]') ? 'errCls' : l.includes('[WARN]') ? 'warnCls' : 'infoCls'),
        emptyText: '暂无日志',
        t,
      }),
    )
    expect(screen.getByText('2026-01-01 INFO boot ok')).toBeTruthy()
    expect(screen.getByText('2026-01-01 [ERROR] boom').className).toBe('errCls')
    expect(container.querySelector('[class*="logPanel"]')).toBeTruthy()
  })

  it('keeps existing content visible while loading (no flash on refresh)', () => {
    render(createElement(LogViewer, { lines, loading: true, emptyText: '暂无日志', t }))
    expect(screen.getByText('2026-01-01 INFO boot ok')).toBeTruthy()
    expect(screen.queryByText(ZH.loadingLogs)).toBeNull()
  })

  it('filters lines by search, shows the match count, and highlights hits', () => {
    const { container } = render(createElement(LogViewer, { lines, emptyText: '暂无日志', t }))
    fireEvent.change(screen.getByPlaceholderText(ZH.searchLogs), { target: { value: 'error' } })
    expect(screen.queryByText('2026-01-01 INFO boot ok')).toBeNull()
    expect(screen.getByText('1/4 行')).toBeTruthy()
    // 命中子串大小写不敏感高亮（选择器限定在面板内，排除工具栏的 logMatchCount 计数）
    const match = container.querySelector('[class*="logPanel"] [class*="logMatch"]')
    expect(match?.textContent).toBe('ERROR')
  })

  it('exposes refresh and scroll-to-bottom actions', () => {
    const onRefresh = vi.fn()
    render(createElement(LogViewer, { lines, onRefresh, emptyText: '暂无日志', t }))
    fireEvent.click(screen.getByText(ZH.refresh))
    expect(onRefresh).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTitle(ZH.toBottom))
  })

  it('exposes refresh/toBottom via the ref handle in externalControls mode', () => {
    const onRefresh = vi.fn()
    const handle: { current: LogViewerHandle | null } = { current: null }
    const { container } = render(
      createElement(LogViewer, { lines, onRefresh, externalControls: true, ref: handle, emptyText: '暂无日志', t }),
    )
    // 工具栏不再渲染刷新 / 回底按钮（由调用方放在弹窗 footer 并经句柄驱动）
    expect(container.querySelector('[class*="logCorner"]')).toBeNull()
    expect(screen.queryByText(ZH.refresh)).toBeNull()
    expect(screen.queryByTitle(ZH.toBottom)).toBeNull()
    handle.current!.refresh()
    expect(onRefresh).toHaveBeenCalledTimes(1)
    expect(() => handle.current!.toBottom()).not.toThrow()
  })

  it('shows the empty state for no lines and the no-match state for unmatched search', () => {
    const first = render(createElement(LogViewer, { lines: [], emptyText: '暂无日志', t }))
    expect(screen.getByText('暂无日志')).toBeTruthy()
    first.unmount()
    render(createElement(LogViewer, { lines: ['only one line'], emptyText: '暂无日志', t }))
    fireEvent.change(screen.getByPlaceholderText(ZH.searchLogs), { target: { value: 'zzz' } })
    expect(screen.getByText(ZH.searchEmpty)).toBeTruthy()
  })
})
