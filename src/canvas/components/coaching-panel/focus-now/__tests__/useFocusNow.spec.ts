/**
 * useFocusNow container — enforces the two boundaries the presentational layer
 * cannot: (1) the uncertified coaching_summary is gated OFF; (2) the row action
 * prefills the composer ONLY and never sends. Also maps the live freshness source
 * to the banner.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const { prefillChat, sendMessage, runV2Analysis } = vi.hoisted(() => ({
  prefillChat: vi.fn(),
  sendMessage: vi.fn(),
  runV2Analysis: vi.fn(),
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
  useV2Run: () => ({ runV2Analysis, isRunning: false, cancelRun: vi.fn(), error: null }),
}))
vi.mock('@/canvas/stores/guidanceStore', () => ({
  useGuidanceStore: Object.assign(() => undefined, {
    getState: () => ({ _prefillChat: prefillChat, _sendMessage: sendMessage }),
  }),
}))

import { useFocusNow } from '../useFocusNow'

describe('useFocusNow container', () => {
  beforeEach(() => {
    prefillChat.mockClear()
    sendMessage.mockClear()
    runV2Analysis.mockClear()
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

  it('onPrefill prefills the composer only — never sends', () => {
    const { result } = renderHook(() => useFocusNow())
    result.current.onPrefill?.('Help me add a risk.')
    expect(prefillChat).toHaveBeenCalledWith('Help me add a risk.')
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('onRerun triggers a re-run', () => {
    const { result } = renderHook(() => useFocusNow())
    result.current.onRerun?.()
    expect(runV2Analysis).toHaveBeenCalledTimes(1)
  })
})
