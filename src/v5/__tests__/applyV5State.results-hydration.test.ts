/**
 * applyV5State — step 5 (results hydration) integration tests.
 *
 * Asserts the contract between applyV5State and store.resultsComplete when
 * an analysis_result block arrives: build a ReportV1 via
 * mapV5AnalysisToReport, hash-dedupe against currentResultsHash, write
 * through resultsComplete with the V5 provenance string. Mirrors the V4
 * envelope path's dedupe/source-tag conventions
 * (useConversation.ts:1861-1895).
 */
import { describe, expect, it, vi } from 'vitest'

import type { OlumiResponse } from '@talchain/schemas/boundary'

import { applyV5State, type V5ApplicatorStore } from '../applyV5State'

function baseResponse(overrides: Partial<OlumiResponse> = {}): OlumiResponse {
  return {
    response_version: 2,
    assistant_text: '',
    blocks: [],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'frame',
    ...overrides,
  }
}

function makeStore(
  extras: Partial<V5ApplicatorStore> = {},
): {
  store: V5ApplicatorStore
  resultsComplete: ReturnType<typeof vi.fn>
  setRunMeta: ReturnType<typeof vi.fn>
} {
  const resultsComplete = vi.fn()
  const setRunMeta = vi.fn()
  return {
    store: {
      setCurrentStage: vi.fn(),
      updateNode: vi.fn(),
      updateEdgeData: vi.fn(),
      setRunMeta,
      setCeeAnalysisReady: vi.fn(),
      resultsComplete,
      nodes: [],
      edges: [],
      currentResultsHash: null,
      ...extras,
    },
    resultsComplete,
    setRunMeta,
  }
}

const validAnalysisBlock = {
  type: 'analysis_result' as const,
  summary: 'A leads',
  leading_option_id: 'opt_a',
  win_probabilities: { opt_a: 0.64, opt_b: 0.36 },
  enrichment: {
    factor_sensitivity: [
      { factor_id: 'fac_market', factor_label: 'Market', sensitivity: 0.4, direction: 'positive' as const },
    ],
  },
}

describe('applyV5State — step 5: results hydration', () => {
  it('calls resultsComplete exactly once for a well-formed analysis_result block', () => {
    const { store, resultsComplete } = makeStore()
    const result = applyV5State(
      baseResponse({ blocks: [validAnalysisBlock], stage_indicator: 'analyse' }),
      store,
    )

    expect(resultsComplete).toHaveBeenCalledTimes(1)
    expect(result.applied).toContain('analysis_result:results_hydrated')
  })

  it('passes resultsSource: "conversation" and null V2-shaped fields (enrichment, rawV2Response)', () => {
    const { store, resultsComplete } = makeStore()
    applyV5State(baseResponse({ blocks: [validAnalysisBlock] }), store)

    const callArgs = resultsComplete.mock.calls[0]?.[0] as {
      resultsSource: string
      enrichment: unknown
      rawV2Response: unknown
    }
    expect(callArgs.resultsSource).toBe('conversation')
    expect(callArgs.enrichment).toBeNull()
    expect(callArgs.rawV2Response).toBeNull()
  })

  it('hydrated report carries option_probabilities keyed exactly by win_probabilities keys', () => {
    const { store, resultsComplete } = makeStore()
    applyV5State(baseResponse({ blocks: [validAnalysisBlock] }), store)

    const callArgs = resultsComplete.mock.calls[0]?.[0] as {
      report: { option_probabilities?: Record<string, { win_probability?: number }> }
    }
    expect(callArgs.report.option_probabilities).toBeDefined()
    const keys = Object.keys(callArgs.report.option_probabilities!).sort()
    expect(keys).toEqual(['opt_a', 'opt_b'])
    expect(callArgs.report.option_probabilities!.opt_a.win_probability).toBe(0.64)
    expect(callArgs.report.option_probabilities!.opt_b.win_probability).toBe(0.36)
  })

  it('hydrated report carries factor_sensitivity from enrichment', () => {
    const { store, resultsComplete } = makeStore()
    applyV5State(baseResponse({ blocks: [validAnalysisBlock] }), store)

    const callArgs = resultsComplete.mock.calls[0]?.[0] as {
      report: { factor_sensitivity?: Array<{ factor_id: string; sensitivity: number }> }
    }
    expect(callArgs.report.factor_sensitivity).toBeDefined()
    expect(callArgs.report.factor_sensitivity![0].factor_id).toBe('fac_market')
    expect(callArgs.report.factor_sensitivity![0].sensitivity).toBe(0.4)
  })

  it('passes a stable response_hash to resultsComplete (used for dedupe)', () => {
    const { store, resultsComplete } = makeStore()
    applyV5State(baseResponse({ blocks: [validAnalysisBlock] }), store)

    const callArgs = resultsComplete.mock.calls[0]?.[0] as { hash: string; report: { model_card: { response_hash: string } } }
    expect(callArgs.hash).toMatch(/^v5:[0-9a-f]{16}$/)
    expect(callArgs.hash).toBe(callArgs.report.model_card.response_hash)
  })

  it('skips the write when currentResultsHash matches the new block hash (dedupe)', () => {
    // First call: compute hash and capture it
    const { store: probeStore, resultsComplete: probeResultsComplete } = makeStore()
    applyV5State(baseResponse({ blocks: [validAnalysisBlock] }), probeStore)
    const observedHash = probeResultsComplete.mock.calls[0]?.[0]?.hash as string

    // Second call: provide that same hash as currentResultsHash → no write
    const { store, resultsComplete } = makeStore({ currentResultsHash: observedHash })
    const result = applyV5State(
      baseResponse({ blocks: [validAnalysisBlock] }),
      store,
    )

    expect(resultsComplete).not.toHaveBeenCalled()
    expect(result.applied).not.toContain('analysis_result:results_hydrated')
  })

  it('emits when currentResultsHash differs from the new block hash', () => {
    const { store, resultsComplete } = makeStore({ currentResultsHash: 'v5:0000000000000000' })
    applyV5State(baseResponse({ blocks: [validAnalysisBlock] }), store)
    expect(resultsComplete).toHaveBeenCalledTimes(1)
  })

  it('does NOT call resultsComplete when the response has no analysis_result block', () => {
    const { store, resultsComplete } = makeStore()
    const result = applyV5State(
      baseResponse({
        blocks: [{ type: 'text', content: 'hi' }],
        stage_indicator: 'frame',
      }),
      store,
    )

    expect(resultsComplete).not.toHaveBeenCalled()
    expect(result.applied).not.toContain('analysis_result:results_hydrated')
  })

  it('defers (records reason, does not throw) when store omits resultsComplete', () => {
    // Minimal store without resultsComplete — applicator should not crash.
    const minimalStore: V5ApplicatorStore = {
      setCurrentStage: vi.fn(),
      updateNode: vi.fn(),
      updateEdgeData: vi.fn(),
      setRunMeta: vi.fn(),
      setCeeAnalysisReady: vi.fn(),
      nodes: [],
      edges: [],
      // resultsComplete intentionally omitted
    }

    const result = applyV5State(
      baseResponse({ blocks: [validAnalysisBlock] }),
      minimalStore,
    )

    expect(result.applied).not.toContain('analysis_result:results_hydrated')
    const deferredReasons = result.deferred.map((d) => d.reason)
    expect(deferredReasons).toContain('results_hydration_store_lacks_resultsComplete')
  })

  it('preserves existing step 2 decision_review write (setRunMeta still called when enrichment has decision_review)', () => {
    const { store, resultsComplete, setRunMeta } = makeStore()
    applyV5State(
      baseResponse({
        blocks: [
          {
            ...validAnalysisBlock,
            enrichment: {
              ...validAnalysisBlock.enrichment,
              decision_review: {
                intent: 'selection',
                analysis_state: 'ran',
                readiness: { level: 'ready', headline: 'Go', factors: [] },
                blocks: [],
              },
            },
          },
        ],
      }),
      store,
    )

    // Step 2 wrote ceeReviewV1
    expect(setRunMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        ceeReviewV1: expect.objectContaining({ intent: 'selection' }),
      }),
    )
    // Step 5 wrote results
    expect(resultsComplete).toHaveBeenCalledTimes(1)
  })

  it('stale-turn guard prevents results hydration (no resultsComplete call)', () => {
    const { store, resultsComplete } = makeStore()
    const result = applyV5State(
      baseResponse({ blocks: [validAnalysisBlock] }),
      store,
      { turnClientId: 'old', currentClientTurnId: 'new' },
    )

    expect(resultsComplete).not.toHaveBeenCalled()
    expect(result.applied).toEqual([])
    expect(result.deferred[0]?.reason).toBe('stale_turn_all_writes_skipped')
  })

  it('confidence level derived from robustness.fragile_edges vs robust_edges ratio', () => {
    const { store, resultsComplete } = makeStore()
    const blockWithRobustness = {
      ...validAnalysisBlock,
      enrichment: {
        ...validAnalysisBlock.enrichment,
        robustness: {
          fragile_edges: ['e1'],
          robust_edges: ['e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9'],
        },
      },
    }
    applyV5State(baseResponse({ blocks: [blockWithRobustness] }), store)

    const callArgs = resultsComplete.mock.calls[0]?.[0] as {
      report: { confidence: { level: string; why: string } }
    }
    expect(callArgs.report.confidence.level).toBe('high')
    expect(callArgs.report.confidence.why).toContain('1 fragile edge')
    expect(callArgs.report.confidence.why).toContain('8 robust edges')
  })
})

// ---------------------------------------------------------------------------
// #4: clearing the local freshness dirty overlay on a genuine new run.
// The CEE analysis_ready contract carries no computed_at / run id, so the
// reducer's echo-guard cannot distinguish a same-verdict rerun from an echo.
// The reliable run identity is the analysis_result response_hash dedupe: a NEW
// hash means a completed run → clear the overlay; a duplicate hash or a turn with
// no analysis_result block (conversational echo) must NOT clear it.
// ---------------------------------------------------------------------------

describe('applyV5State — step 5: dirty overlay clear (run identity)', () => {
  it('clears the overlay when a new analysis_result hydrates (new response_hash)', () => {
    const clearAnalysisFreshnessDirty = vi.fn()
    const { store } = makeStore({ clearAnalysisFreshnessDirty, currentResultsHash: null })

    applyV5State(baseResponse({ blocks: [validAnalysisBlock] }), store)

    expect(clearAnalysisFreshnessDirty).toHaveBeenCalledTimes(1)
  })

  it('does NOT clear the overlay for a duplicate analysis_result (same response_hash = echo)', () => {
    // Discover the hydrated hash via a probe run, then re-run with currentResultsHash set to it.
    const probeResultsComplete = vi.fn()
    const probe = makeStore({ resultsComplete: probeResultsComplete })
    applyV5State(baseResponse({ blocks: [validAnalysisBlock] }), probe.store)
    const hydratedHash = (probeResultsComplete.mock.calls[0]?.[0] as { hash: string }).hash
    expect(hydratedHash).toBeTruthy()

    const clearAnalysisFreshnessDirty = vi.fn()
    const { store } = makeStore({ clearAnalysisFreshnessDirty, currentResultsHash: hydratedHash })
    applyV5State(baseResponse({ blocks: [validAnalysisBlock] }), store)

    expect(clearAnalysisFreshnessDirty).not.toHaveBeenCalled()
  })

  it('does NOT clear the overlay on a turn with no analysis_result block (conversational echo)', () => {
    const clearAnalysisFreshnessDirty = vi.fn()
    const { store } = makeStore({ clearAnalysisFreshnessDirty })

    applyV5State(baseResponse({ blocks: [] }), store)

    expect(clearAnalysisFreshnessDirty).not.toHaveBeenCalled()
  })
})
