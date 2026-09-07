/**
 * RCA-D1 orphan gate — useAnalysisDisplayState must NOT show green
 * "Analysis complete" for an orphaned hydrated result (a report restored on
 * reload with no live-capture fact for the scenario). The same state already
 * surfaces the "can't confirm this is current" orphan banner, so a green
 * completion hero alongside it is a self-contradiction. The hook routes an
 * orphaned source into the existing 'results_stale' branch.
 *
 * These tests mock useAnalysisStateSource directly to drive the source
 * classification without wrestling with the canonical flag + fact wiring
 * (that classifier is covered by useAnalysisStateSource.spec.ts).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { create, type StoreApi, type UseBoundStore } from 'zustand'

interface MockCanvasState {
  ceeAnalysisReady: { status?: string } | null
  results: { status: string; report: unknown; hash?: string | null } | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  analysisFreshness: any
  analysisFreshnessDirty: boolean
}

let store: UseBoundStore<StoreApi<MockCanvasState>>
let mockSource: string

vi.mock('../../store', () => ({
  get useCanvasStore() {
    return store
  },
}))

vi.mock('../useAnalysisStateSource', () => ({
  useAnalysisStateSource: () => ({
    source: mockSource,
    showOrphanBanner: mockSource === 'orphaned_plot_result',
    hasResultsReport: true,
    factPresentForScenario: mockSource !== 'orphaned_plot_result',
  }),
}))

import { useAnalysisDisplayState } from '../useAnalysisDisplayState'

function makeStore(initial: Partial<MockCanvasState> = {}) {
  return create<MockCanvasState>(() => ({
    ceeAnalysisReady: { status: 'ready' },
    // This report must carry a REAL probability. The subject of this file is
    // the orphan gate, but 'complete' is now also conditional on the run
    // having produced something renderable -- an empty option_comparison is a
    // run that finished with no result, and would earn 'ran_without_result'
    // for an honest reason that has nothing to do with orphaning. Keeping the
    // fixture realistic tests the gate; emptying it would test the new rule.
    results: {
      status: 'complete',
      report: { option_comparison: [{ id: 'opt-a', win_probability: 0.62 }] },
    },
    analysisFreshness: { freshness: 'unknown' },
    analysisFreshnessDirty: false,
    ...initial,
  }))
}

describe('useAnalysisDisplayState — RCA-D1 orphan gate', () => {
  beforeEach(() => {
    store = makeStore()
    mockSource = 'cee_v5_run_analysis'
  })

  it('orphaned hydrated result → results_stale, NOT green "Analysis complete"', () => {
    mockSource = 'orphaned_plot_result'
    // Even with a populated report and an 'unknown' (cannot-confirm) verdict —
    // which on its own maps to the neutral completion fact — the orphan source
    // must drop the hero out of green complete.
    const { result } = renderHook(() => useAnalysisDisplayState())
    expect(result.current.state).toBe('results_stale')
    expect(result.current.headline).toBe('Results may be outdated')
    expect(result.current.cta).toEqual({ kind: 'secondary', label: 'Rerun analysis' })
  })

  it('confirmed run (fact present, not orphaned) with fresh verdict → complete', () => {
    mockSource = 'cee_v5_run_analysis'
    store = makeStore({ analysisFreshness: { freshness: 'fresh' } })
    const { result } = renderHook(() => useAnalysisDisplayState())
    expect(result.current.state).toBe('complete')
    expect(result.current.headline).toBe('Analysis complete')
  })

  it('non-orphaned unknown verdict stays complete (neutral completion fact preserved)', () => {
    mockSource = 'direct_plot_legacy'
    const { result } = renderHook(() => useAnalysisDisplayState())
    expect(result.current.state).toBe('complete')
  })
})
