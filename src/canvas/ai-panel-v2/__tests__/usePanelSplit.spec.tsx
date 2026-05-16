import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { fireEvent } from '@testing-library/dom'

import { usePanelSplit } from '../hooks/usePanelSplit'
import {
  AI_ZONE_MIN_HEIGHT,
  ANALYSIS_ZONE_MIN_HEIGHT,
  COMPACT_AI_RATIO,
  CONVERSATION_AI_RATIO,
  MODE_THRESHOLDS,
} from '../constants'

function setup(panelHeight = 1000) {
  return renderHook(() => usePanelSplit({ getPanelHeight: () => panelHeight }))
}

describe('usePanelSplit — mode + clamp', () => {
  it('starts in Compact mode with the Compact preset ratio', () => {
    const { result } = setup()
    expect(result.current.activeMode).toBe('compact')
    expect(result.current.aiRatio).toBeCloseTo(COMPACT_AI_RATIO, 5)
  })

  it('clicking Conversation jumps to the Conversation preset', () => {
    const { result } = setup()
    act(() => result.current.setMode('conversation'))
    expect(result.current.activeMode).toBe('conversation')
    expect(result.current.aiRatio).toBeCloseTo(CONVERSATION_AI_RATIO, 5)
  })

  it('clicking Compact jumps back to the Compact preset', () => {
    const { result } = setup()
    act(() => result.current.setMode('conversation'))
    act(() => result.current.setMode('compact'))
    expect(result.current.activeMode).toBe('compact')
    expect(result.current.aiRatio).toBeCloseTo(COMPACT_AI_RATIO, 5)
  })

  it('arrow-key adjust clamps to AI_ZONE_MIN_HEIGHT', () => {
    const PANEL = 1000
    const { result } = setup(PANEL)
    // Big negative shrink → would go below min.
    act(() => result.current.adjustByPx(-10_000))
    expect(result.current.aiRatio * PANEL).toBeCloseTo(AI_ZONE_MIN_HEIGHT, 5)
  })

  it('arrow-key adjust clamps to leave at least ANALYSIS_ZONE_MIN_HEIGHT for the dock', () => {
    const PANEL = 1000
    const { result } = setup(PANEL)
    act(() => result.current.adjustByPx(10_000))
    const aiPx = result.current.aiRatio * PANEL
    expect(aiPx).toBeCloseTo(PANEL - ANALYSIS_ZONE_MIN_HEIGHT, 5)
  })

  it('mode highlight follows the ratio when it leaves the explicit band', () => {
    const PANEL = 1000
    const { result } = setup(PANEL)
    // Click Compact (ratio = 0.30, in compact band)
    act(() => result.current.setMode('compact'))
    expect(result.current.activeMode).toBe('compact')
    // Drag up by enough to leave the compact band into the conversation band.
    act(() => result.current.adjustByPx(220)) // ~+0.22 ratio → ~0.52
    expect(result.current.aiRatio).toBeGreaterThan(MODE_THRESHOLDS.compact.max)
    expect(result.current.activeMode).toBe('conversation')
  })

  it('vertical drag updates the ratio after the 8px axis dead-zone', () => {
    const PANEL = 1000
    const { result } = setup(PANEL)
    const initialRatio = result.current.aiRatio

    const fakeEvent = {
      button: 0,
      clientY: 500,
      preventDefault: () => {},
    } as unknown as React.PointerEvent
    act(() => result.current.startDrag(fakeEvent))

    // jsdom's PointerEvent constructor needs an explicit `clientY` because
    // synthesised PointerEvents don't read it from the init dict the way
    // browsers do — set the property directly.
    const dispatchMove = (clientY: number) => {
      const ev = new Event('pointermove', { bubbles: true }) as PointerEvent & { clientY: number }
      Object.defineProperty(ev, 'clientY', { value: clientY })
      act(() => { document.dispatchEvent(ev) })
    }
    const dispatchUp = () => {
      const ev = new Event('pointerup', { bubbles: true })
      act(() => { document.dispatchEvent(ev) })
    }

    // Small movement below 8px should NOT change the ratio (axis not committed).
    dispatchMove(504)
    expect(result.current.aiRatio).toBeCloseTo(initialRatio, 5)

    // Movement past 8px commits the axis and changes the ratio.
    dispatchMove(480)
    // Moving UP (smaller clientY) at the AI-zone top edge expands the AI zone.
    expect(result.current.aiRatio).toBeGreaterThan(initialRatio)

    dispatchUp()
    expect(result.current.isDragging).toBe(false)
  })
})
