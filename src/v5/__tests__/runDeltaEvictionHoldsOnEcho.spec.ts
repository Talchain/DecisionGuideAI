/**
 * ⭐⭐ THE EVICTION TRADE, PINNED IN BOTH DIRECTIONS SO IT IS VISIBLE RATHER THAN
 * INHERITED.
 *
 * Review raised that the eviction sits inside the results-hash branch while the
 * WRITE (correctly) does not, and that `hash` is a CONTENT hash
 * (`mapV5AnalysisToReport.ts:1459`) rather than a run identity. Both true. The
 * implied fix — evict whenever an analysis arrives without a delta — was measured
 * at CEE's bytes and REFUSED, because it is worse than the defect it closes:
 *
 *   CEE re-emits a BYTE-IDENTICAL `analysis_result` on ordinary follow-up turns.
 *   `compose.ts:1766` builds it from the PRIOR fact on the FRESH lifecycle
 *   branch, and the builder's own note (`compose.ts:1155`) says both turns "emit
 *   an IDENTICAL block for a given analysis — keeping DGAI's content-hash dedupe
 *   and Results-panel hydration consistent across the run_analysis turn and any
 *   follow-up explain / what_would_flip turn."
 *
 * ⇒ Unconditional eviction blanks "What's changed" on the person's NEXT
 * QUESTION. That is the routine path; the collision it would close needs a new
 * run byte-identical in summary, leading option, win probabilities AND full
 * Monte Carlo enrichment, while also carrying no delta.
 *
 * ⚠ THE CORRECT FIX IS NOT AVAILABLE TO THIS LAYER. There is no run identity on
 * the deployed V5 path — `store.ts:5482`, live-confirmed 25 Jul 2026. Its own
 * conclusion stands: that needs a producer-boundary decision, not a UI change.
 *
 * RE-SURFACE TRIGGER: the first turn envelope carrying a run id or seed echo.
 */
import { describe, expect, it, vi } from 'vitest'
import type { OlumiResponse, RunDelta } from '@talchain/schemas/boundary'
import { applyV5State, type V5ApplicatorStore } from '../applyV5State'

const blockA = {
  type: 'analysis_result' as const,
  summary: 'A leads',
  leading_option_id: 'opt_a',
  win_probabilities: { opt_a: 0.64, opt_b: 0.36 },
  enrichment: {},
}
const blockB = { ...blockA, summary: 'B leads', leading_option_id: 'opt_b' }

const DELTA = {
  attribution_case: 'C1_attributable',
  pair_provenance: { seed_equal: true, hash_equal: false, builds_equal: 'equal', n_equal: true },
  leader: { changed: false, noise_verdict: 'not_noise_qualified' },
  win_probabilities: [{ option_id: 'opt_a', prior: 0.5, current: 0.64, noise_verdict: 'signal' }],
  flip_thresholds: [],
} as unknown as RunDelta

const response = (over: Record<string, unknown> = {}): OlumiResponse => ({
  response_version: 2,
  assistant_text: '',
  blocks: [],
  suggested_actions: [],
  insights: [],
  stage_indicator: 'analyse',
  ...over,
} as OlumiResponse)

function makeStore(over: Partial<V5ApplicatorStore> = {}): V5ApplicatorStore & {
  setRunDelta: ReturnType<typeof vi.fn>
  resultsComplete: ReturnType<typeof vi.fn>
} {
  return {
    setCurrentStage: vi.fn(),
    updateNode: vi.fn(),
    updateEdgeData: vi.fn(),
    setRunMeta: vi.fn(),
    setCeeAnalysisReady: vi.fn(),
    resultsComplete: vi.fn(),
    setRunDelta: vi.fn(),
    nodes: [],
    edges: [],
    currentResultsHash: null,
    currentScenarioId: 'scn-1',
    ...over,
  } as never
}

/** Derived by RUNNING the applicator — never a literal, which would drift. */
function hashOf(block: typeof blockA): string {
  const probe = makeStore()
  applyV5State(response({ blocks: [block] }), probe)
  const h = probe.resultsComplete.mock.calls[0]?.[0]?.hash
  if (typeof h !== 'string') throw new Error('probe captured no hash — the harness is blind')
  return h
}

describe('⛔ a follow-up turn re-delivering the SAME analysis must not clear the explanation', () => {
  it('an echo with no delta leaves the stored delta untouched', () => {
    const hash = hashOf(blockA)
    const store = makeStore({ currentResultsHash: hash })

    // The follow-up explain turn: identical block, no run_delta.
    applyV5State(response({ blocks: [blockA] }), store)

    // ⛔ THE ASSERTION THAT MATTERS. Not "was not called with null" — NOT CALLED.
    // A write of any kind here would either evict or restamp something the turn
    // does not know about.
    expect(store.setRunDelta).not.toHaveBeenCalled()
  })

  it('⭐ CONTRAST — the same shape WITH a delta does write, so the case above is not vacuous', () => {
    const hash = hashOf(blockA)
    const store = makeStore({ currentResultsHash: hash })

    applyV5State(response({ blocks: [blockA], run_delta: DELTA }), store)

    // This is the two-writer fix: an echo-hash turn carrying a delta still stores
    // it. If this went silent, the test above would be passing for the wrong
    // reason — a seam that never writes at all.
    expect(store.setRunDelta).toHaveBeenCalledTimes(1)
    expect(store.setRunDelta.mock.calls[0][0]).toMatchObject({ analysisHash: hash, scenarioId: 'scn-1' })
  })
})

describe('⭐ a genuinely new analysis carrying no delta DOES evict', () => {
  it('evicts when the content hash moves', () => {
    const store = makeStore({ currentResultsHash: hashOf(blockA) })

    applyV5State(response({ blocks: [blockB] }), store)

    expect(store.setRunDelta).toHaveBeenCalledTimes(1)
    expect(store.setRunDelta).toHaveBeenCalledWith(null)
  })

  it('contrast — the two blocks really do hash differently, or the case above proves nothing', () => {
    expect(hashOf(blockA)).not.toBe(hashOf(blockB))
  })
})

describe('⚠ THE ACCEPTED LIMIT, written down rather than discovered later', () => {
  /**
   * A new run whose content collides with the displayed one is INDISTINGUISHABLE
   * from an echo at this seam — that is what a content hash means. This case
   * documents the consequence in executable form: it is the same input as the
   * echo case, and the product holds the delta. When a run identity arrives, this
   * expectation flips and the branch becomes unconditional.
   */
  it('a colliding-content turn with no delta holds the delta — by construction, not by choice', () => {
    const store = makeStore({ currentResultsHash: hashOf(blockA) })
    applyV5State(response({ blocks: [blockA] }), store)
    expect(store.setRunDelta).not.toHaveBeenCalled()
  })
})
