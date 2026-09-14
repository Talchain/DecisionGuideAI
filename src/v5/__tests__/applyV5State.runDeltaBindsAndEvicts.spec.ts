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

  it('a RE-DELIVERED analysis (same hash) does not rewrite the slice', () => {
    // First, learn the hash this block derives.
    const probe = makeStore()
    applyV5State(baseResponse({ blocks: [analysisBlock], run_delta: DELTA }), probe)
    const hash = (probe.resultsComplete as ReturnType<typeof vi.fn>).mock.calls[0]?.[0].hash as string

    // Now replay it as an echo: `currentResultsHash` already holds that hash.
    const store = makeStore({ currentResultsHash: hash })
    applyV5State(baseResponse({ blocks: [analysisBlock], run_delta: DELTA }), store)
    expect(store.setRunDelta).not.toHaveBeenCalled()
  })
})

describe('a host without the slice is unaffected', () => {
  it('applies cleanly when setRunDelta is absent', () => {
    const store = makeStore({ setRunDelta: undefined } as never)
    expect(() => applyV5State(baseResponse({ blocks: [analysisBlock], run_delta: DELTA }), store)).not.toThrow()
  })
})
