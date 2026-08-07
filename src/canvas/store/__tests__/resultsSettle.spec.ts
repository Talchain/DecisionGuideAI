/**
 * 1.16i rerun UX — resultsSettle store action.
 *
 * The live V5 run path sets status 'preparing' at dispatch (authoritative
 * analysing state). Not every V5 envelope carries a fresh analysis_result
 * (clarifying question, unchanged hash, error) — resultsSettle is the
 * every-exit cleanup: from 'preparing' it returns to 'complete' when a
 * preserved report exists (restoring analysisStateReady) or 'idle' when
 * none does, and NEVER disturbs any other status.
 */
import { describe, it, expect, beforeEach } from 'vitest'

import { useCanvasStore } from '../../store'

describe('resultsSettle', () => {
  beforeEach(() => {
    useCanvasStore.getState().resultsReset()
  })

  it('settles preparing → idle when no prior report exists', () => {
    useCanvasStore.getState().resultsStart({ seed: undefined, wasForced: false })
    expect(useCanvasStore.getState().results.status).toBe('preparing')

    useCanvasStore.getState().resultsSettle()

    expect(useCanvasStore.getState().results.status).toBe('idle')
  })

  it('settles preparing → complete when a prior report is preserved, restoring analysisStateReady', () => {
    // Seed a completed run, then start a re-run (resultsStart preserves report).
    useCanvasStore.setState((s) => ({
      results: {
        ...s.results,
        status: 'complete',
        progress: 100,
        report: { summary: 'prior run' } as never,
        hash: 'hash-1',
      },
      analysisStateReady: true,
    }))
    useCanvasStore.getState().resultsStart({ seed: undefined, wasForced: false })
    expect(useCanvasStore.getState().results.status).toBe('preparing')
    expect(useCanvasStore.getState().analysisStateReady).toBe(false)

    useCanvasStore.getState().resultsSettle()

    const state = useCanvasStore.getState()
    expect(state.results.status).toBe('complete')
    expect(state.results.report).toEqual({ summary: 'prior run' })
    expect(state.analysisStateReady).toBe(true)
  })

  it('no-ops on every non-preparing status', () => {
    for (const status of ['idle', 'connecting', 'streaming', 'complete', 'error', 'cancelled'] as const) {
      useCanvasStore.setState((s) => ({ results: { ...s.results, status } }))
      useCanvasStore.getState().resultsSettle()
      expect(useCanvasStore.getState().results.status).toBe(status)
    }
  })
})
