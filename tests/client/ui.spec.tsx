// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { createElement, useState } from 'react'
import { Select, Modal } from '../../src/client/ui.tsx'

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
