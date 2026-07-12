/**
 * useFocusNow container — enforces the boundaries the presentational layer cannot:
 * (1) the uncertified coaching_summary is gated OFF; (2) the row action AUTO-SENDS
 * the prompt to Olumi (via the reliably-registered _sendMessage) and reveals the
 * chat — it does NOT prefill. Gates the controls off when no chat can
 * receive the message / aiPanelV2 is disabled. (Its stale banner retired in
 * Wave F-B — the Analysis freshness strip is the sole stale owner.)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const h = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  runV2Analysis: vi.fn(),
  reveal: vi.fn(),
  aiPanelV2: vi.fn(() => true),
  sendRegistered: { value: true },
}))

vi.mock('@/canvas/store', () => ({
  useCanvasStore: (sel: (s: unknown) => unknown) =>
    sel({
      ceeAnalysisReady: { coaching_summary: 'live CEE prose that is not claim-certified' },
      analysisFreshness: { freshness: 'stale' },
      analysisFreshnessDirty: false,
    }),
}))
vi.mock('@/canvas/hooks/useV2Run', () => ({
  useV2Run: () => ({ runV2Analysis: h.runV2Analysis, isRunning: false, cancelRun: vi.fn(), error: null }),
}))
vi.mock('@/canvas/stores/guidanceStore', () => ({
  useGuidanceStore: Object.assign(
    (sel: (s: unknown) => unknown) => sel({ _sendMessage: h.sendRegistered.value ? h.sendMessage : null }),
    { getState: () => ({ _sendMessage: h.sendRegistered.value ? h.sendMessage : null }) },
  ),
}))
vi.mock('@/canvas/conversation/revealOlumi', () => ({ revealOlumiSurface: h.reveal }))
vi.mock('@/flags', () => ({ isAiPanelV2Enabled: h.aiPanelV2 }))

import { useFocusNow } from '../useFocusNow'

describe('useFocusNow container', () => {
  beforeEach(() => {
    h.sendRegistered.value = true
    h.aiPanelV2.mockReturnValue(true)
    h.sendMessage.mockClear()
    h.runV2Analysis.mockClear()
    h.reveal.mockClear()
  })

  it('gates the uncertified coaching_summary OFF (summary is null despite live data)', () => {
    const { result } = renderHook(() => useFocusNow())
    expect(result.current.summary).toBeNull()
  })

  it('still surfaces the static rows; the stale banner is RETIRED (Wave F-B — the freshness strip is the sole owner)', () => {
    const { result } = renderHook(() => useFocusNow())
    expect(result.current.rows.length).toBeGreaterThan(0)
    expect(result.current.rows.every((r) => r.ownership === 'static_hygiene')).toBe(true)
    // Brief §5.3: no second stale banner inside Strengthen your model.
    expect(result.current.banner).toEqual({ kind: 'none' })
  })

  it('onPrefill AUTO-SENDS the prompt to Olumi and reveals the chat', () => {
    const { result } = renderHook(() => useFocusNow())
    result.current.onPrefill?.('Help me add a risk.')
    expect(h.sendMessage).toHaveBeenCalledWith('Help me add a risk.')
    expect(h.reveal).toHaveBeenCalled()
    // it is a re-run of neither analysis nor anything else
    expect(h.runV2Analysis).not.toHaveBeenCalled()
  })

  it('exposes actionsEnabled=true when aiPanelV2 is on and a send wire is registered', () => {
    const { result } = renderHook(() => useFocusNow())
    expect(result.current.actionsEnabled).toBe(true)
  })

  it('exposes actionsEnabled=false when aiPanelV2 is off (controls must hide, not be dead)', () => {
    h.aiPanelV2.mockReturnValue(false)
    const { result } = renderHook(() => useFocusNow())
    expect(result.current.actionsEnabled).toBe(false)
  })

  it('exposes actionsEnabled=false when no chat can receive the message', () => {
    h.sendRegistered.value = false
    const { result } = renderHook(() => useFocusNow())
    expect(result.current.actionsEnabled).toBe(false)
  })

  it('onRerun is retired with the banner (Wave F-B — the freshness strip owns the Rerun)', () => {
    const { result } = renderHook(() => useFocusNow())
    expect(result.current.onRerun).toBeUndefined()
    expect(h.runV2Analysis).not.toHaveBeenCalled()
  })
})
