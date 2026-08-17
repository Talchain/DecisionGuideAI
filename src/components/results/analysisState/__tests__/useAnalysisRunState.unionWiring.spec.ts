/**
 * `useAnalysisRunState` — THE STORE/SELECTOR WIRING, as distinct from the mapping.
 *
 * ⚠ WHY A SECOND FILE. `useAnalysisRunState.mapping.spec.ts` pins the PURE
 * function arm by arm and is deliberately store-free. It therefore cannot see
 * the two things that live only in the hook body, and both are places a correct
 * mapping can still be fed the wrong input:
 *
 *   1. THE `authority` GATE. The hook must pass the WIRE's own kind, i.e.
 *      `composed.authority === 'wire' ? composed.runStateKind : null`. Passing
 *      `composed.runStateKind` UNCONDITIONALLY is the naive substitution #741
 *      was written to catch — and the mapping spec cannot catch it, because from
 *      the pure function's side a legacy-derived kind arriving in
 *      `wireRunStateKind` is indistinguishable from a real wire verdict. The
 *      lie is in the WIRING, so it has to be pinned at the wiring.
 *
 *   2. THE DELETED FRESHNESS DERIVATION. The hook used to call
 *      `resolveDisplayedFreshness(analysisFreshness, analysisFreshnessDirty)`
 *      itself, making it a SECOND reader of the freshness slice. It now consumes
 *      `useAnalysisState().displayedFreshness`. The case below discriminates
 *      those two sources by making them DISAGREE — which is the only way to
 *      prove which one is actually being read.
 *
 * Both dependencies are mocked on purpose: this file is about which value
 * reaches the mapping, not about whether the selector computes it correctly
 * (that is `analysisStateSelector.spec.ts`, against the real schema).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

import type { ComposedAnalysisState } from '@/canvas/state/analysisStateSelector'

/** Mutable doubles, reset per test. */
let composed: ComposedAnalysisState
let storeState: Record<string, unknown>

vi.mock('@/canvas/state/analysisStateSelector', () => ({
  useAnalysisState: () => composed,
}))

vi.mock('@/canvas/store', () => ({
  useCanvasStore: (selector: (s: Record<string, unknown>) => unknown) => selector(storeState),
}))

// Imported AFTER the mocks so the hook binds to them.
const { useAnalysisRunState } = await import('../useAnalysisRunState')

/**
 * A composed state shaped like the selector's DERIVED branch. Only the four
 * members this hook reads are load-bearing; the rest satisfy the type.
 */
function composedState(over: Partial<ComposedAnalysisState>): ComposedAnalysisState {
  return {
    authority: 'derived',
    wire: null,
    runStateKind: 'unknown_degraded',
    semantic: 'cannot_confirm',
    displayedFreshness: null,
    trust: { semantic: 'cannot_confirm', orphaned: false, isRunning: false },
    displayState: { state: 'complete' },
    resultsTab: { show: false },
    source: 'none',
    leaderClaimPermitted: null,
    leaderWithheldReason: null,
    leaderSeparation: null,
    robustnessAggregateLevel: null,
    factorsThatFlipLeader: null,
    readinessStatus: null,
    readinessBlockers: null,
    usableForProse: null,
    usableForChips: null,
    usableForFollowup: null,
    requiresRerun: false,
    blockedUnusable: null,
    contradictions: null,
    ...over,
  } as ComposedAnalysisState
}

beforeEach(() => {
  composed = composedState({})
  storeState = {
    analysisRefusalNotice: null,
    results: { status: 'complete' },
    hasCompletedFirstRun: true,
    // Present, and DELIBERATELY CONTRADICTORY to the selector's value in the
    // deletion case below. If the hook ever starts reading these again, that
    // case REDs.
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
    analysisFreshnessDirty: false,
  }
})

const run = () => renderHook(() => useAnalysisRunState()).result.current

describe('useAnalysisRunState — the authority gate (the naive-substitution guard)', () => {
  it('a LEGACY turn does NOT let the selector\'s derived kind override a refusal', () => {
    // ⭐⭐ THE REGRESSION THIS FILE EXISTS FOR. On a legacy turn the selector
    // derives a kind — here the strongest possible contradiction,
    // `complete_current` — and it NEVER derives `refused`. If the hook passed
    // `runStateKind` through unconditionally, the refusal notice would go dark
    // and the surface would present retained numbers as current.
    composed = composedState({ authority: 'derived', runStateKind: 'complete_current' })
    storeState.analysisRefusalNotice = { blockedReason: 'no goal node', computedAt: null }

    expect(run()).toBe('refused')
  })

  it('a WIRE turn honours the wire verdict at the same cell — the discriminating pair', () => {
    // Same store, same refusal, ONLY `authority` flips. The answer must differ,
    // which is what proves the gate is reading `authority` and not something
    // that happens to correlate with it.
    composed = composedState({ authority: 'wire', runStateKind: 'complete_current' })
    storeState.analysisRefusalNotice = { blockedReason: 'no goal node', computedAt: null }

    expect(run()).toBe('complete_current')
  })

  it('a wire `refused` reaches the surface as `refused`', () => {
    composed = composedState({ authority: 'wire', runStateKind: 'refused' })
    expect(run()).toBe('refused')
  })

  it('a wire `blocked` is NOT flattened to `refused` — only the wire can say blocked', () => {
    composed = composedState({ authority: 'wire', runStateKind: 'blocked' })
    expect(run()).toBe('blocked')
  })
})

describe('useAnalysisRunState — the freshness derivation is the SELECTOR\'s, not a second read', () => {
  it('reads `displayedFreshness` from the selector, not from the freshness slice', () => {
    // THE DISCRIMINATOR. The store slice says `fresh` (which would map to
    // `complete_current`); the selector says `stale` (which maps to
    // `complete_stale`). They disagree BY CONSTRUCTION, so the result names
    // which source was read. Restoring the deleted
    // `resolveDisplayedFreshness(analysisFreshness, ...)` call REDs this.
    composed = composedState({ authority: 'derived', displayedFreshness: 'stale' })
    storeState.analysisFreshness = { freshness: 'fresh', freshnessReason: 'graph_hash_match' }
    storeState.analysisFreshnessDirty = false

    expect(run()).toBe('complete_stale')
  })

  it('the opposite direction, so the case above is not passing on a constant', () => {
    composed = composedState({ authority: 'derived', displayedFreshness: 'fresh' })
    storeState.analysisFreshness = { freshness: 'stale', freshnessReason: 'graph_hash_diverged' }

    expect(run()).toBe('complete_current')
  })

  it('an in-flight LOCAL run still outranks everything the selector said', () => {
    composed = composedState({ authority: 'wire', runStateKind: 'complete_current' })
    storeState.results = { status: 'streaming' }

    expect(run()).toBe('running')
  })
})
