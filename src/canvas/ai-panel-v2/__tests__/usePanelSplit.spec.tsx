import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePanelSplit } from '../hooks/usePanelSplit'
import {
  AI_ZONE_MIN_HEIGHT,
  ANALYSIS_ZONE_MIN_HEIGHT,
  POST_ANALYSIS_AI_RATIO,
  PRE_ANALYSIS_AI_RATIO,
} from '../constants'

const PANEL_HEIGHT = 800

describe('usePanelSplit — vertical resize (Batch 2)', () => {
  it('starts at the supplied initialRatio (default = PRE_ANALYSIS_AI_RATIO)', () => {
    const { result } = renderHook(() => usePanelSplit({ getPanelHeight: () => PANEL_HEIGHT }))
    expect(result.current.aiRatio).toBe(PRE_ANALYSIS_AI_RATIO)
  })

  it('respects initialRatio when provided', () => {
    const { result } = renderHook(() =>
      usePanelSplit({ getPanelHeight: () => PANEL_HEIGHT, initialRatio: POST_ANALYSIS_AI_RATIO }),
    )
    expect(result.current.aiRatio).toBe(POST_ANALYSIS_AI_RATIO)
  })

  it('setRatio clamps to the min/max heights derived from the panel height', () => {
    const { result } = renderHook(() => usePanelSplit({ getPanelHeight: () => PANEL_HEIGHT }))
    act(() => result.current.setRatio(0.01))
    expect(result.current.aiRatio).toBe(AI_ZONE_MIN_HEIGHT / PANEL_HEIGHT)
    act(() => result.current.setRatio(0.99))
    expect(result.current.aiRatio).toBe((PANEL_HEIGHT - ANALYSIS_ZONE_MIN_HEIGHT) / PANEL_HEIGHT)
  })

  it('adjustByPx shifts the ratio by the equivalent of the supplied pixel delta', () => {
    const { result } = renderHook(() => usePanelSplit({ getPanelHeight: () => PANEL_HEIGHT }))
    const start = result.current.aiRatio
    act(() => result.current.adjustByPx(80))
    expect(result.current.aiRatio).toBeCloseTo(start + 80 / PANEL_HEIGHT, 4)
  })

  it('startDrag sets isDragging true; pointerup clears it', () => {
    const { result } = renderHook(() => usePanelSplit({ getPanelHeight: () => PANEL_HEIGHT }))
    const ev = {
      button: 0,
      clientX: 100,
      clientY: 200,
      preventDefault: vi.fn(),
    } as unknown as React.PointerEvent
    act(() => result.current.startDrag(ev))
    expect(result.current.isDragging).toBe(true)
    act(() => {
      document.dispatchEvent(new Event('pointerup'))
    })
    expect(result.current.isDragging).toBe(false)
  })

  it('returns 0 if getPanelHeight is 0 (no-op for adjustByPx)', () => {
    const { result } = renderHook(() => usePanelSplit({ getPanelHeight: () => 0 }))
    const before = result.current.aiRatio
    act(() => result.current.adjustByPx(100))
    expect(result.current.aiRatio).toBe(before)
  })
})
