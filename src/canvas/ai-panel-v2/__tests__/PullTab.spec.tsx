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

describe('PullTab — left-anchored icon control (Fix 4)', () => {
  it('renders ONLY the two non-active modes as icon buttons', () => {
    resizeWindow(1600)
    renderTab({ activeMode: 'compact' })
    // Active mode is implicit — not shown.
    expect(screen.queryByTestId('ai-panel-v2-mode-compact')).toBeNull()
    expect(screen.getByTestId('ai-panel-v2-mode-conversation')).toBeInTheDocument()
    expect(screen.getByTestId('ai-panel-v2-mode-focus')).toBeInTheDocument()
  })

  it('switches the visible set when the active mode changes', () => {
    resizeWindow(1600)
    renderTab({ activeMode: 'conversation' })
    expect(screen.queryByTestId('ai-panel-v2-mode-conversation')).toBeNull()
    expect(screen.getByTestId('ai-panel-v2-mode-compact')).toBeInTheDocument()
    expect(screen.getByTestId('ai-panel-v2-mode-focus')).toBeInTheDocument()
  })

  it('exposes role="tablist" + role="tab" + aria-labels', () => {
    resizeWindow(1600)
    renderTab({ activeMode: 'compact' })
    expect(screen.getByRole('tablist')).toBeInTheDocument()
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(2) // active mode hidden
    expect(screen.getByLabelText(/conversation mode/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/focus mode/i)).toBeInTheDocument()
  })

  it('clicking an icon calls onModeClick with that mode', async () => {
    resizeWindow(1600)
    const { onModeClick } = renderTab({ activeMode: 'compact' })
    await act(async () => {
      screen.getByTestId('ai-panel-v2-mode-conversation').click()
    })
    expect(onModeClick).toHaveBeenCalledWith('conversation')
  })

  it('disables Focus icon when viewport < FOCUS_MIN_VIEWPORT', async () => {
    resizeWindow(FOCUS_MIN_VIEWPORT - 1)
    const { onModeClick } = renderTab({ activeMode: 'compact' })
    const focusBtn = screen.getByTestId('ai-panel-v2-mode-focus')
    expect(focusBtn).toBeDisabled()
    expect(focusBtn.getAttribute('title')).toMatch(/wider screen/i)
    await act(async () => { focusBtn.click() })
    expect(onModeClick).not.toHaveBeenCalled()
  })

  it('enables Focus icon when viewport ≥ FOCUS_MIN_VIEWPORT', () => {
    resizeWindow(FOCUS_MIN_VIEWPORT)
    renderTab({ activeMode: 'compact' })
    expect(screen.getByTestId('ai-panel-v2-mode-focus')).not.toBeDisabled()
  })

  it('pointer-down on the drag chrome calls onStartDrag', () => {
    resizeWindow(1600)
    const { onStartDrag } = renderTab()
    const drag = screen.getByTestId('ai-panel-v2-pull-tab-drag')
    fireEvent.pointerDown(drag, { button: 0, clientX: 100, clientY: 100 })
    expect(onStartDrag).toHaveBeenCalledTimes(1)
  })

  it('pointer-down on an icon does NOT trigger drag start (only mode switch)', () => {
    resizeWindow(1600)
    const { onStartDrag } = renderTab({ activeMode: 'compact' })
    const icon = screen.getByTestId('ai-panel-v2-mode-conversation')
    fireEvent.pointerDown(icon, { button: 0, clientX: 100, clientY: 100 })
    expect(onStartDrag).not.toHaveBeenCalled()
  })

  it('arrow keys on the drag chrome adjust by ±20px (brief §11.4)', () => {
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
