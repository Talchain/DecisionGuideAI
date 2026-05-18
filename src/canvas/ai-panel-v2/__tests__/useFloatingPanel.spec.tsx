import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFloatingPanel } from '../hooks/useFloatingPanel'
import {
  FLOATING_DEFAULT_HEIGHT,
  FLOATING_DEFAULT_WIDTH,
  FLOATING_MIN_HEIGHT,
  FLOATING_MIN_WIDTH,
} from '../constants'

afterEach(() => {
  vi.restoreAllMocks()
})

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true })
}

describe('useFloatingPanel — drag + resize', () => {
  it('returns default rect clamped to viewport', () => {
    setViewport(1600, 1000)
    const { result } = renderHook(() => useFloatingPanel())
    const { rect } = result.current
    expect(rect.width).toBe(FLOATING_DEFAULT_WIDTH)
    expect(rect.height).toBe(FLOATING_DEFAULT_HEIGHT)
    // Anchor right-edge: left should be near viewport - width - offset.
    expect(rect.left + rect.width).toBeLessThanOrEqual(1600)
  })

  it('startDrag → pointermove updates position; pointerup ends drag', () => {
    setViewport(1600, 1000)
    const { result } = renderHook(() => useFloatingPanel())
    const startLeft = result.current.rect.left
    const startTop = result.current.rect.top

    const evDown = {
      button: 0,
      clientX: 1000,
      clientY: 200,
      preventDefault: vi.fn(),
    } as unknown as React.PointerEvent
    act(() => result.current.startDrag(evDown))
    expect(result.current.isDragging).toBe(true)

    // Drag LEFT and UP so the result clears the right/bottom clamps —
    // the default position is anchored to the right edge so leftward
    // drag has more headroom to verify the delta math.
    act(() => {
      const move = new Event('pointermove') as PointerEvent
      Object.defineProperty(move, 'clientX', { value: 920 })
      Object.defineProperty(move, 'clientY', { value: 250 })
      document.dispatchEvent(move)
    })

    expect(result.current.rect.left).toBeCloseTo(startLeft - 80, -1)
    expect(result.current.rect.top).toBeCloseTo(startTop + 50, -1)

    act(() => {
      document.dispatchEvent(new Event('pointerup'))
    })
    expect(result.current.isDragging).toBe(false)
  })

  it('startResize → pointermove resizes within min/max bounds', () => {
    setViewport(1600, 1000)
    const { result } = renderHook(() => useFloatingPanel())
    const startW = result.current.rect.width
    const startH = result.current.rect.height

    const evDown = {
      button: 0,
      clientX: 1200,
      clientY: 700,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.PointerEvent
    act(() => result.current.startResize(evDown))
    expect(result.current.isResizing).toBe(true)

    act(() => {
      const move = new Event('pointermove') as PointerEvent
      Object.defineProperty(move, 'clientX', { value: 1260 })
      Object.defineProperty(move, 'clientY', { value: 760 })
      document.dispatchEvent(move)
    })

    expect(result.current.rect.width).toBeCloseTo(startW + 60, -1)
    expect(result.current.rect.height).toBeCloseTo(startH + 60, -1)

    act(() => {
      document.dispatchEvent(new Event('pointerup'))
    })
    expect(result.current.isResizing).toBe(false)
  })

  it('clamps width and height to MIN dims on aggressive shrink', () => {
    setViewport(1600, 1000)
    const { result } = renderHook(() => useFloatingPanel())
    const evDown = {
      button: 0,
      clientX: 1000,
      clientY: 700,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.PointerEvent
    act(() => result.current.startResize(evDown))
    act(() => {
      const move = new Event('pointermove') as PointerEvent
      Object.defineProperty(move, 'clientX', { value: 0 })
      Object.defineProperty(move, 'clientY', { value: 0 })
      document.dispatchEvent(move)
    })
    expect(result.current.rect.width).toBe(FLOATING_MIN_WIDTH)
    expect(result.current.rect.height).toBe(FLOATING_MIN_HEIGHT)
  })
})
