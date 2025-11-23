import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../../store'
import { loadRuns } from '../runHistory'
import type { ReportV1 } from '../../../adapters/plot/types'

/**
 * CEE history persistence & restore tests
 */

describe('Canvas Store – CEE history integration', () => {
  beforeEach(() => {
    // Reset store state that matters for these tests
    const state = useCanvasStore.getState()
    if ((state as any).resultsReset) {
      ;(state as any).resultsReset()
    }
    state.setRunMeta({
      diagnostics: undefined,
      correlationIdHeader: undefined,
      degraded: undefined,
      ceeReview: undefined,
      ceeTrace: undefined,
      ceeError: undefined,
    } as any)

    // Clear history
    try {
      window.localStorage?.clear()
    } catch {}
  })

  it('persists CEE metadata into run history on resultsComplete', () => {
    const { resultsStart, resultsComplete } = useCanvasStore.getState()

    const report: ReportV1 = {
      schema: 'report.v1',
      meta: {
        seed: 42,
        response_id: 'cee-history-1',
        elapsed_ms: 1000,
      },
      model_card: {
        response_hash: 'hash-cee-1',
        response_hash_algo: 'sha256',
        normalized: true,
      },
      results: {
        conservative: 10,
        likely: 20,
        optimistic: 30,
      },
      confidence: {
        level: 'high',
        why: 'test',
      },
      drivers: [],
    }

    const ceeReview = {
      story: {
        headline: 'Persisted headline',
        key_drivers: [],
        next_actions: [],
      },
      journey: { is_complete: true, missing_envelopes: [] },
    }

    const ceeTrace = {
      requestId: 'req-history-1',
      degraded: false,
      timestamp: '2025-11-20T18:30:00Z',
    }

    const ceeError = {
      code: 'CEE_TEMPORARY',
      retryable: true,
      traceId: 'trace-history-1',
      suggestedAction: 'retry' as const,
    }

    resultsStart({ seed: 42 })
    resultsComplete({
      report,
      hash: report.model_card.response_hash,
      ceeReview: ceeReview as any,
      ceeTrace: ceeTrace as any,
      ceeError: ceeError as any,
    } as any)

    const runs = loadRuns()
    expect(runs.length).toBeGreaterThanOrEqual(1)
    const latest = runs[0]

    expect(latest.ceeReview).toEqual(ceeReview)
    expect(latest.ceeTrace).toEqual(ceeTrace)
    expect(latest.ceeError).toEqual(ceeError)
  })

  it('restores CEE metadata from history on resultsLoadHistorical and clears stale runMeta', () => {
    const { resultsStart, resultsComplete, resultsLoadHistorical, setRunMeta } = useCanvasStore.getState()

    // Seed stale runMeta first
    setRunMeta({
      diagnostics: { resumes: 1, trims: 0, recovered_events: 1, correlation_id: 'stale-corr' } as any,
      correlationIdHeader: 'stale-hdr',
      degraded: true,
      ceeReview: {
        story: { headline: 'Stale headline' },
        journey: { is_complete: false, missing_envelopes: ['env-a'] },
      } as any,
      ceeTrace: {
        requestId: 'stale-req',
        degraded: true,
        timestamp: '2025-11-20T18:00:00Z',
      } as any,
      ceeError: {
        code: 'CEE_TEMPORARY',
        retryable: true,
        traceId: 'stale-trace',
        suggestedAction: 'retry',
      } as any,
    })

    const report: ReportV1 = {
      schema: 'report.v1',
      meta: {
        seed: 99,
        response_id: 'cee-history-2',
        elapsed_ms: 500,
      },
      model_card: {
        response_hash: 'hash-cee-2',
        response_hash_algo: 'sha256',
        normalized: true,
      },
      results: {
        conservative: 5,
        likely: 15,
        optimistic: 25,
      },
      confidence: {
        level: 'medium',
        why: 'history',
      },
      drivers: [],
    }

    const ceeReview = {
      story: {
        headline: 'Restored headline',
        key_drivers: [],
        next_actions: [],
      },
      journey: { is_complete: true, missing_envelopes: [] },
    }

    const ceeTrace = {
      requestId: 'req-history-2',
      degraded: false,
      timestamp: '2025-11-20T19:00:00Z',
    }

    const ceeError = {
      code: 'CEE_TEMPORARY',
      retryable: true,
      traceId: 'trace-history-2',
      suggestedAction: 'retry' as const,
    }

    // Create a historical run with CEE metadata
    resultsStart({ seed: 99 })
    resultsComplete({
      report,
      hash: report.model_card.response_hash,
      ceeReview: ceeReview as any,
      ceeTrace: ceeTrace as any,
      ceeError: ceeError as any,
    } as any)

    const runs = loadRuns()
    expect(runs.length).toBeGreaterThanOrEqual(1)
    const storedRun = runs[0]

    // Load historical run into store
    resultsLoadHistorical(storedRun as any)

    const runMeta = useCanvasStore.getState().runMeta as any

    // Stale diagnostics/headers/degraded should be cleared
    expect(runMeta.diagnostics).toBeUndefined()
    expect(runMeta.correlationIdHeader).toBeUndefined()
    expect(runMeta.degraded).toBeUndefined()

    // CEE metadata should match StoredRun values
    expect(runMeta.ceeReview?.story?.headline).toBe('Restored headline')
    expect(runMeta.ceeTrace?.requestId).toBe('req-history-2')
    expect(runMeta.ceeError?.traceId).toBe('trace-history-2')
  })
})
