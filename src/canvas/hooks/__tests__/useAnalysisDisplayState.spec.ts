/**
 * useAnalysisDisplayState — hook integration over the canvas store.
 * The pure helper is exhaustively unit-tested in
 * deriveAnalysisDisplayState.spec.ts; these tests cover the store-to-helper
 * wiring (which selectors fire, which fields the helper sees) using a
 * minimal Zustand vanilla store as a stand-in for useCanvasStore.
 *
 * Staleness is sourced from the CEE freshness slice + local dirty overlay via
 * the shared classifyFreshnessForDisplay (=== 'changed'), NOT the legacy
 * graphEditedSinceLastRun flag. The real classifier runs against the mock store.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { create, type StoreApi, type UseBoundStore } from 'zustand'

interface MockCanvasState {
  ceeAnalysisReady: { status?: string } | null
  results: { status: string; report: unknown } | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  analysisFreshness: any
  analysisFreshnessDirty: boolean
}

let store: UseBoundStore<StoreApi<MockCanvasState>>

vi.mock('../../store', () => {
  return {
    get useCanvasStore() {
      return store
    },
  }
})

import { useAnalysisDisplayState } from '../useAnalysisDisplayState'

function makeStore(initial: Partial<MockCanvasState> = {}) {
  return create<MockCanvasState>(() => ({
    ceeAnalysisReady: null,
    results: { status: 'idle', report: null },
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    ...initial,
  }))
}

describe('useAnalysisDisplayState', () => {
  beforeEach(() => {
    store = makeStore()
  })

  it('returns ready_to_analyse view when CEE status is ready and no report', () => {
    store = makeStore({ ceeAnalysisReady: { status: 'ready' } })
    const { result } = renderHook(() => useAnalysisDisplayState())
    expect(result.current.state).toBe('ready_to_analyse')
    expect(result.current.headline).toBe('Ready to analyse')
    expect(result.current.cta).toEqual({ kind: 'primary', label: 'Run analysis' })
  })

  it('returns complete view when results.report is populated and freshness is current', () => {
    store = makeStore({
      ceeAnalysisReady: { status: 'ready' },
      results: { status: 'complete', report: { option_comparison: [] } },
      analysisFreshness: { freshness: 'fresh' },
      analysisFreshnessDirty: false,
    })
    const { result } = renderHook(() => useAnalysisDisplayState())
    expect(result.current.state).toBe('complete')
    expect(result.current.headline).toBe('Analysis complete')
    expect(result.current.cta).toBeNull()
  })

  it('returns results_stale view when the CEE freshness verdict is stale (changed)', () => {
    store = makeStore({
      ceeAnalysisReady: { status: 'ready' },
      results: { status: 'complete', report: { option_comparison: [] } },
      analysisFreshness: { freshness: 'stale' },
    })
    const { result } = renderHook(() => useAnalysisDisplayState())
    expect(result.current.state).toBe('results_stale')
    expect(result.current.cta).toEqual({ kind: 'secondary', label: 'Rerun analysis' })
  })

  it('returns results_stale when a retained fresh verdict is dirtied by a local edit (changed)', () => {
    store = makeStore({
      ceeAnalysisReady: { status: 'ready' },
      results: { status: 'complete', report: { option_comparison: [] } },
      analysisFreshness: { freshness: 'fresh' },
      analysisFreshnessDirty: true,
    })
    const { result } = renderHook(() => useAnalysisDisplayState())
    expect(result.current.state).toBe('results_stale')
  })

  it('CEE-sourced unknown (cannot-confirm) → complete, NOT results_stale (no fabricated "outdated")', () => {
    store = makeStore({
      ceeAnalysisReady: { status: 'ready' },
      results: { status: 'complete', report: { option_comparison: [] } },
      analysisFreshness: { freshness: 'unknown' },
      analysisFreshnessDirty: true,
    })
    const { result } = renderHook(() => useAnalysisDisplayState())
    expect(result.current.state).toBe('complete')
    expect(result.current.headline).toBe('Analysis complete')
  })

  it('returns not_ready view when CEE status is missing/non-ready', () => {
    store = makeStore({ ceeAnalysisReady: { status: 'needs_user_input' } })
    const { result } = renderHook(() => useAnalysisDisplayState())
    expect(result.current.state).toBe('not_ready')
    expect(result.current.cta).toBeNull()
  })

  // Brief Task 2 precedence: non-ready CEE wins even when a prior report
  // is still in the store (e.g. user deletes the goal node after a run).
  it('non-ready CEE overrides a populated report → not_ready, NOT complete', () => {
    store = makeStore({
      ceeAnalysisReady: { status: 'needs_user_mapping' },
      results: { status: 'complete', report: { option_comparison: [] } },
    })
    const { result } = renderHook(() => useAnalysisDisplayState())
    expect(result.current.state).toBe('not_ready')
    expect(result.current.headline).toBe('Set up your model')
  })

  // The exact bug repro from bundle bef4470b — stale resultsStatus 'complete'
  // lingering with hasReport=false MUST yield ready_to_analyse, not complete.
  it('bug-shape: hasReport=false + resultsStatus=complete + CEE ready → ready_to_analyse', () => {
    store = makeStore({
      ceeAnalysisReady: { status: 'ready' },
      results: { status: 'complete', report: null },
    })
    const { result } = renderHook(() => useAnalysisDisplayState())
    expect(result.current.state).toBe('ready_to_analyse')
    expect(result.current.headline).not.toBe('Analysis complete')
  })

  it('tolerates partial-mock store shapes (legacy fixtures omit fields)', () => {
    // Some legacy test fixtures mock the store without `results` or the
    // freshness slices. The hook must not crash; it falls back to safe defaults.
    store = create<Partial<MockCanvasState>>(() => ({
      ceeAnalysisReady: { status: 'ready' },
    })) as unknown as UseBoundStore<StoreApi<MockCanvasState>>
    const { result } = renderHook(() => useAnalysisDisplayState())
    expect(result.current.state).toBe('ready_to_analyse')
  })
})
