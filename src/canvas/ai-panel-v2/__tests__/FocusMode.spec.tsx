import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { usePanelSplit } from '../hooks/usePanelSplit'
import { useFocusColumn } from '../hooks/useFocusColumn'
import {
  FOCUS_COLUMN_DEFAULT,
  FOCUS_COLUMN_MIN,
  FOCUS_MIN_VIEWPORT,
  FOCUS_SNAP_THRESHOLD,
} from '../constants'

function resizeWindow(width: number, height = 900) {
  Object.defineProperty(window, 'innerWidth', { writable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { writable: true, value: height })
  window.dispatchEvent(new Event('resize'))
}

let originalWidth: number
beforeEach(() => { originalWidth = window.innerWidth })
afterEach(() => { resizeWindow(originalWidth) })

describe('usePanelSplit — Focus mode', () => {
  it('setMode("focus") activates Focus when viewport ≥ FOCUS_MIN_VIEWPORT', () => {
    resizeWindow(FOCUS_MIN_VIEWPORT)
    const { result } = renderHook(() => usePanelSplit({ getPanelHeight: () => 1000 }))
    act(() => result.current.setMode('focus'))
    expect(result.current.activeMode).toBe('focus')
  })

  it('setMode("focus") is suppressed below FOCUS_MIN_VIEWPORT', () => {
    resizeWindow(FOCUS_MIN_VIEWPORT - 1)
    const { result } = renderHook(() => usePanelSplit({ getPanelHeight: () => 1000 }))
    act(() => result.current.setMode('focus'))
    expect(result.current.activeMode).not.toBe('focus')
  })

  it('Exiting Focus by setMode("compact") clears focusActive and restores Compact preset', () => {
    resizeWindow(FOCUS_MIN_VIEWPORT)
    const { result } = renderHook(() => usePanelSplit({ getPanelHeight: () => 1000 }))
    act(() => result.current.setMode('focus'))
    act(() => result.current.setMode('compact'))
    expect(result.current.activeMode).toBe('compact')
  })

  it('adjustByPx is a no-op while Focus is active (vertical resize disabled)', () => {
    resizeWindow(FOCUS_MIN_VIEWPORT)
    const { result } = renderHook(() => usePanelSplit({ getPanelHeight: () => 1000 }))
    act(() => result.current.setMode('focus'))
    const ratioBefore = result.current.aiRatio
    act(() => result.current.adjustByPx(200))
    expect(result.current.aiRatio).toBeCloseTo(ratioBefore, 5)
  })

  it('narrowing the viewport below FOCUS_MIN_VIEWPORT drops out of Focus', () => {
    resizeWindow(FOCUS_MIN_VIEWPORT)
    const { result } = renderHook(() => usePanelSplit({ getPanelHeight: () => 1000 }))
    act(() => result.current.setMode('focus'))
    expect(result.current.activeMode).toBe('focus')
    act(() => resizeWindow(FOCUS_MIN_VIEWPORT - 1))
    expect(result.current.activeMode).not.toBe('focus')
  })
})

describe('useFocusColumn — width clamp + snap-back', () => {
  it('starts at FOCUS_COLUMN_DEFAULT', () => {
    const { result } = renderHook(() => useFocusColumn({ onExit: vi.fn() }))
    expect(result.current.width).toBe(FOCUS_COLUMN_DEFAULT)
  })

  it('left-edge drag widens (clamped to ≥ FOCUS_COLUMN_MIN)', () => {
    resizeWindow(1800)
    const { result } = renderHook(() => useFocusColumn({ onExit: vi.fn() }))
    // Simulate startLeftEdgeResize: dragStartX=200, dragStartWidth=default
    const ev = { button: 0, clientX: 200, preventDefault: () => {} } as unknown as React.PointerEvent
    act(() => result.current.startLeftEdgeResize(ev))
    // Drag LEFT to clientX=50 → dx = -150 → proposed = default + 150 → wider
    const move = new Event('pointermove', { bubbles: true }) as PointerEvent & { clientX: number }
    Object.defineProperty(move, 'clientX', { value: 50 })
    act(() => { document.dispatchEvent(move) })
    expect(result.current.width).toBeGreaterThanOrEqual(FOCUS_COLUMN_MIN)
    expect(result.current.width).toBeGreaterThan(FOCUS_COLUMN_DEFAULT)
  })

  it('right-edge drag inward fires onExit when width approaches FOCUS_COLUMN_MIN', () => {
    const onExit = vi.fn()
    resizeWindow(1800)
    const { result } = renderHook(() => useFocusColumn({ onExit }))
    const start = { button: 0, clientX: 600, preventDefault: () => {} } as unknown as React.PointerEvent
    act(() => result.current.startRightEdgeResize(start))
    // Drag right edge LEFT a long way → width shrinks below min
    const move = new Event('pointermove', { bubbles: true }) as PointerEvent & { clientX: number }
    Object.defineProperty(move, 'clientX', { value: 100 })
    act(() => { document.dispatchEvent(move) })
    // Release → onExit should fire because width <= MIN + SNAP_THRESHOLD
    const up = new Event('pointerup', { bubbles: true })
    act(() => { document.dispatchEvent(up) })
    expect(result.current.width).toBeLessThanOrEqual(FOCUS_COLUMN_MIN + FOCUS_SNAP_THRESHOLD)
    expect(onExit).toHaveBeenCalledTimes(1)
  })
})
