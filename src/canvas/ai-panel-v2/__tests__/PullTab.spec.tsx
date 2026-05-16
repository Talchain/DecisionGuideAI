import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'

import { PullTab } from '../PullTab'
import { FOCUS_MIN_VIEWPORT } from '../constants'

function resizeWindow(width: number, height = 800) {
  Object.defineProperty(window, 'innerWidth', { writable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { writable: true, value: height })
  window.dispatchEvent(new Event('resize'))
}

let originalWidth: number
beforeEach(() => {
  originalWidth = window.innerWidth
})

afterEach(() => {
  cleanup()
  resizeWindow(originalWidth)
})

function renderTab(props: Partial<React.ComponentProps<typeof PullTab>> = {}) {
  const onModeClick = vi.fn()
  const onStartDrag = vi.fn()
  const onAdjustByPx = vi.fn()
  render(
    <PullTab
      activeMode={props.activeMode ?? 'compact'}
      onModeClick={props.onModeClick ?? onModeClick}
      onStartDrag={props.onStartDrag ?? onStartDrag}
      onAdjustByPx={props.onAdjustByPx ?? onAdjustByPx}
    />,
  )
  return { onModeClick, onStartDrag, onAdjustByPx }
}

describe('PullTab (step 5 — brief §4 pull-tab)', () => {
  it('renders all three mode labels with the correct testids', () => {
    resizeWindow(1600)
    renderTab()
    expect(screen.getByTestId('ai-panel-v2-mode-compact')).toBeInTheDocument()
    expect(screen.getByTestId('ai-panel-v2-mode-conversation')).toBeInTheDocument()
    expect(screen.getByTestId('ai-panel-v2-mode-focus')).toBeInTheDocument()
  })

  it('exposes role="tablist" and role="tab" with aria-selected', () => {
    resizeWindow(1600)
    renderTab({ activeMode: 'conversation' })
    expect(screen.getByRole('tablist')).toBeInTheDocument()
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(3)
    const conv = screen.getByTestId('ai-panel-v2-mode-conversation')
    expect(conv.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('ai-panel-v2-mode-compact').getAttribute('aria-selected')).toBe('false')
  })

  it('highlights the active mode via data-active', () => {
    resizeWindow(1600)
    renderTab({ activeMode: 'compact' })
    expect(screen.getByTestId('ai-panel-v2-mode-compact').dataset.active).toBe('true')
    expect(screen.getByTestId('ai-panel-v2-mode-conversation').dataset.active).toBe('false')
  })

  it('clicking an inactive mode calls onModeClick with that mode', async () => {
    resizeWindow(1600)
    const { onModeClick } = renderTab({ activeMode: 'compact' })
    await act(async () => {
      screen.getByTestId('ai-panel-v2-mode-conversation').click()
    })
    expect(onModeClick).toHaveBeenCalledWith('conversation')
  })

  it('disables Focus when viewport < FOCUS_MIN_VIEWPORT', async () => {
    resizeWindow(FOCUS_MIN_VIEWPORT - 1)
    const { onModeClick } = renderTab({ activeMode: 'compact' })
    const focusBtn = screen.getByTestId('ai-panel-v2-mode-focus')
    expect(focusBtn).toBeDisabled()
    expect(focusBtn.getAttribute('title')).toMatch(/wider screen/i)
    await act(async () => { focusBtn.click() })
    expect(onModeClick).not.toHaveBeenCalled()
  })

  it('enables Focus when viewport ≥ FOCUS_MIN_VIEWPORT', () => {
    resizeWindow(FOCUS_MIN_VIEWPORT)
    renderTab({ activeMode: 'compact' })
    expect(screen.getByTestId('ai-panel-v2-mode-focus')).not.toBeDisabled()
  })

  it('pointer-down on the drag region calls onStartDrag', () => {
    resizeWindow(1600)
    const { onStartDrag } = renderTab()
    const drag = screen.getByTestId('ai-panel-v2-pull-tab-drag')
    fireEvent.pointerDown(drag, { button: 0, clientX: 100, clientY: 100 })
    expect(onStartDrag).toHaveBeenCalledTimes(1)
  })

  it('arrow keys on the drag region adjust by ±20px (brief §11.4)', () => {
    resizeWindow(1600)
    const { onAdjustByPx } = renderTab()
    const drag = screen.getByTestId('ai-panel-v2-pull-tab-drag')
    fireEvent.keyDown(drag, { key: 'ArrowUp' })
    fireEvent.keyDown(drag, { key: 'ArrowDown' })
    expect(onAdjustByPx).toHaveBeenNthCalledWith(1, -20)
    expect(onAdjustByPx).toHaveBeenNthCalledWith(2, 20)
  })

  it('the drag region is keyboard-focusable (separator role)', () => {
    resizeWindow(1600)
    renderTab()
    const drag = screen.getByTestId('ai-panel-v2-pull-tab-drag')
    expect(drag.getAttribute('role')).toBe('separator')
    expect(drag.getAttribute('tabindex')).toBe('0')
  })
})
