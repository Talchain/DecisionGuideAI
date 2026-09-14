/**
 * The `run_delta` READ — written beside a new analysis, evicted by one.
 *
 * ⭐⭐ THE EVICTION CASES ARE THE POINT. A delta that outlives the analysis it
 * describes is not a missing feature, it is a WRONG ONE: a real,
 * producer-computed comparison rendered under numbers it was never about. Every
 * case below fails silently in production, so each is pinned rather than
 * reasoned about.
 */
import { describe, expect, it, vi } from 'vitest'
import type { OlumiResponse, RunDelta } from '@talchain/schemas/boundary'
import { applyV5State, type V5ApplicatorStore } from '../applyV5State'
import type { StoredRunDelta } from '../../canvas/state/storedRunDelta'

const analysisBlock = {
  type: 'analysis_result' as const,
  summary: 'A leads',
  leading_option_id: 'opt_a',
  win_probabilities: { opt_a: 0.64, opt_b: 0.36 },
  enrichment: {},
}

const DELTA = {
  attribution_case: 'C1_attributable',
  pair_provenance: { seed_equal: true, hash_equal: false, builds_equal: 'equal', n_equal: true },
  leader: { changed: false, noise_verdict: 'signal' },
  win_probabilities: [{ option_id: 'opt_a', prior: 0.5, current: 0.64, noise_verdict: 'signal' }],
  flip_thresholds: [],
} as unknown as RunDelta

function baseResponse(overrides: Record<string, unknown> = {}): OlumiResponse {
  return {
    response_version: 2,
    assistant_text: '',
    blocks: [],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
    ...overrides,
  } as OlumiResponse
}

function makeStore(over: Partial<V5ApplicatorStore> = {}): V5ApplicatorStore & {
  setRunDelta: ReturnType<typeof vi.fn>
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


/** The hash the applicator WILL derive for a block — by running it, never a literal. */
function hashOf(block: typeof analysisBlock): string {
  const probe = makeStore()
  applyV5State(baseResponse({ blocks: [block] }), probe)
  const h = (probe.resultsComplete as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]?.hash
  if (typeof h !== 'string') throw new Error('probe captured no hash — the harness is blind')
  return h
}

const lastStored = (store: { setRunDelta: ReturnType<typeof vi.fn> }): StoredRunDelta | null =>
  store.setRunDelta.mock.calls.at(-1)?.[0] ?? null

describe('a new analysis carrying a delta stores it WITH its identity', () => {
  it('stamps the analysis hash and the scenario', () => {
    const store = makeStore()
    applyV5State(baseResponse({ blocks: [analysisBlock], run_delta: DELTA }), store)

    expect(store.setRunDelta).toHaveBeenCalledTimes(1)
    const stored = lastStored(store)
    expect(stored?.delta).toBe(DELTA)
    expect(stored?.scenarioId).toBe('scn-1')
    // ⭐ BOUND BY IDENTITY, not by a literal: the stamped hash must be the very
    // one `resultsComplete` recorded for this analysis. A hand-written string
    // here could match by accident and would not notice the two diverging.
    const hydrated = (store.resultsComplete as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as { hash: string }
    expect(stored?.analysisHash).toBe(hydrated.hash)
  })

  it('carries the producer block through VERBATIM — no reshaping on the way in', () => {
    const store = makeStore()
    applyV5State(baseResponse({ blocks: [analysisBlock], run_delta: DELTA }), store)
    expect(lastStored(store)?.delta).toEqual(DELTA)
  })
})

describe('⛔ eviction — the silent failures', () => {
  it('a NEW analysis carrying NO delta EVICTS the previous one', () => {
    const store = makeStore()
    applyV5State(baseResponse({ blocks: [analysisBlock] }), store)
    expect(store.setRunDelta).toHaveBeenCalledTimes(1)
    expect(lastStored(store)).toBeNull()
  })

  it('a turn with no analysis at all leaves the slice ALONE (it must survive conversation)', () => {
    const store = makeStore()
    applyV5State(baseResponse({ assistant_text: 'just chatting' }), store)
    expect(store.setRunDelta).not.toHaveBeenCalled()
  })

  it('a re-delivered analysis carrying NO delta does not evict', () => {
    const store = makeStore({ currentResultsHash: hashOf(analysisBlock) })
    applyV5State(baseResponse({ blocks: [analysisBlock] }), store)
    expect(store.setRunDelta).not.toHaveBeenCalled()
  })
})

describe('⛔⛔ THE SECOND WRITER — a delta must survive an analysis hydrated by the READ LEG', () => {
  /**
   * ⭐⭐ THE DEFECT THIS FILE ONCE PINNED AS CORRECT.
   *
   * `results.hash` has TWO writers. The turn leg is this file. The other is the
   * PROVISIONAL ANALYSIS READ LEG — `canvas/hydrate/applyScenarioAnalysisRead.ts`,
   * live and unflagged on the primary canvas route (`routes/CanvasMVP.tsx:106`
   * calls `useProvisionalAnalysisDelivery`). It derives its hash through the SAME
   * `mapV5AnalysisToReport(block).model_card.response_hash`, on the same block, so
   * the two hashes COLLIDE BY CONSTRUCTION — its own comment says so: "The SAME
   * hash dedupe the turn applier uses".
   *
   * And its store type `ScenarioAnalysisApplyStore` has NO `setRunDelta` member —
   * absent BY CONSTRUCTION, not by omission (0 occurrences in that file, against
   * 5 for `resultsComplete`). A delta rides a TOP-LEVEL response key; the read leg
   * receives only a block. So that leg can move the join key and can never carry
   * a delta.
   *
   * ⇒ If the read leg hydrates run N first, the turn carrying run N's `run_delta`
   * finds `hash === prevHash`, takes the duplicate-hash skip, and the delta is
   * DISCARDED — silently, with no error and no red. The section then renders
   * nothing forever, which is indistinguishable from "the producer sent nothing".
   *
   * ⛔ AND THIS SPEC USED TO ASSERT THAT DROP WAS CORRECT. Its previous case said
   * `expect(store.setRunDelta).not.toHaveBeenCalled()` on exactly this input — a
   * guard agreeing with the defect (CLAUDE.md trap 13b), written by the same hand
   * that wrote the bug. The two causes were fused under one condition: "this
   * analysis is already displayed" and "there is nothing new to store" are
   * DIFFERENT questions, and only the second licenses dropping a delta.
   */
  it('stores the delta when the analysis was ALREADY hydrated by the other writer', () => {
    // The read leg got there first: results.hash already holds this analysis.
    const store = makeStore({ currentResultsHash: hashOf(analysisBlock) })
    // The turn then arrives carrying the SAME analysis plus its run_delta.
    applyV5State(baseResponse({ blocks: [analysisBlock], run_delta: DELTA }), store)

    expect(store.setRunDelta, 'the delta was dropped because another writer had already hydrated this analysis').toHaveBeenCalledTimes(1)
    expect(lastStored(store)?.delta).toBe(DELTA)
    // ⭐ Bound by IDENTITY to the analysis on screen, not to a literal.
    expect(lastStored(store)?.analysisHash).toBe(hashOf(analysisBlock))
  })
})

describe('a host without the slice is unaffected', () => {
  it('applies cleanly when setRunDelta is absent', () => {
    const store = makeStore({ setRunDelta: undefined } as never)
    expect(() => applyV5State(baseResponse({ blocks: [analysisBlock], run_delta: DELTA }), store)).not.toThrow()
  })
})
