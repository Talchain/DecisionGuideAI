/**
 * useFocusNow container — enforces the two boundaries the presentational layer
 * cannot: (1) the uncertified coaching_summary is gated OFF; (2) the row action
 * prefills the composer AND opens the chat tab so the prefill is visible, but
 * NEVER sends and never triggers an analysis run. Also maps the live freshness
 * source to the banner.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const { prefillChat, sendMessage, runV2Analysis, forceActivateOutputTab, focusFloating, setCanvasState } =
  vi.hoisted(() => ({
    prefillChat: vi.fn(),
    sendMessage: vi.fn(),
    runV2Analysis: vi.fn(),
    forceActivateOutputTab: vi.fn(),
    focusFloating: vi.fn(),
    setCanvasState: vi.fn(),
  }))

vi.mock('@/canvas/store', () => ({
  useCanvasStore: Object.assign(
    (sel: (s: unknown) => unknown) =>
      sel({
        ceeAnalysisReady: { coaching_summary: 'live CEE prose that is not claim-certified' },
        analysisFreshness: { freshness: 'stale' },
        analysisFreshnessDirty: false,
      }),
    { setState: setCanvasState },
  ),
}))
vi.mock('@/canvas/hooks/useV2Run', () => ({
  useV2Run: () => ({ runV2Analysis, isRunning: false, cancelRun: vi.fn(), error: null }),
}))
vi.mock('@/canvas/stores/guidanceStore', () => ({
  useGuidanceStore: Object.assign(() => undefined, {
    getState: () => ({ _prefillChat: prefillChat, _sendMessage: sendMessage }),
  }),
}))
vi.mock('@/stores/uiStore', () => ({
  useUIStore: Object.assign(() => undefined, {
    getState: () => ({ forceActivateOutputTab }),
  }),
}))
vi.mock('@/canvas/hooks/useFloatingFocus', () => ({ focusFloating }))
vi.mock('@/flags', () => ({ isAiPanelV2Enabled: () => true }))

import { useFocusNow } from '../useFocusNow'

describe('useFocusNow container', () => {
  beforeEach(() => {
    prefillChat.mockClear()
    sendMessage.mockClear()
    runV2Analysis.mockClear()
    forceActivateOutputTab.mockClear()
    focusFloating.mockClear()
    setCanvasState.mockClear()
  })

  it('gates the uncertified coaching_summary OFF (summary is null despite live data)', () => {
    const { result } = renderHook(() => useFocusNow())
    expect(result.current.summary).toBeNull()
  })

  it('still surfaces the static rows and maps freshness to the banner', () => {
    const { result } = renderHook(() => useFocusNow())
    expect(result.current.rows.length).toBeGreaterThan(0)
    expect(result.current.rows.every((r) => r.ownership === 'static_hygiene')).toBe(true)
    expect(result.current.banner).toEqual({ kind: 'stale', canRerun: true })
  })

  it('onPrefill persists the composer text, reveals the chat, and never sends', () => {
    const { result } = renderHook(() => useFocusNow())
    result.current.onPrefill?.('Help me add a risk.')
    // 1. persists the composer text (a freshly-mounting composer initialises from it)
    expect(setCanvasState).toHaveBeenCalledWith({ draftComposerText: 'Help me add a risk.' })
    // 2. updates the live composer when one is already mounted
    expect(prefillChat).toHaveBeenCalledWith('Help me add a risk.')
    // 3. reveals the Olumi chat surface (docked tab + best-effort floating focus)
    expect(forceActivateOutputTab).toHaveBeenCalledWith('olumi')
    expect(focusFloating).toHaveBeenCalled()
    // never auto-sends, never triggers a re-run
    expect(sendMessage).not.toHaveBeenCalled()
    expect(runV2Analysis).not.toHaveBeenCalled()
  })

  it('onRerun triggers a re-run', () => {
    const { result } = renderHook(() => useFocusNow())
    result.current.onRerun?.()
    expect(runV2Analysis).toHaveBeenCalledTimes(1)
  })
})
