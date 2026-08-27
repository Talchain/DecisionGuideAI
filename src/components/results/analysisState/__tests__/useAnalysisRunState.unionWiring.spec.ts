/**
 * `useAnalysisRunState` — THE STORE/SELECTOR WIRING, as distinct from the mapping.
 *
 * ⚠ WHY A SECOND FILE. `useAnalysisRunState.mapping.spec.ts` pins the PURE
 * function arm by arm and is deliberately store-free. It therefore cannot see
 * the two things that live only in the hook body, and both are places a correct
 * mapping can still be fed the wrong input:
 *
 *   1. WHICH SELECTOR MEMBER REACHES THE MAPPING. From the pure function's side,
 *      a legacy-derived kind arriving in `wireRunStateKind` is indistinguishable
 *      from a real wire verdict — the naive substitution #741 was written to
 *      catch. That lie lives in the WIRING, so it is pinned at the wiring.
 *
 *      ⚠ HOW THIS CHANGED, AND WHY THE FILE IS STILL WORTH ITS KEEP. The hook
 *      used to gate the read on `composed.authority === 'wire'`. The gate is gone
 *      — not weakened: the selector's legacy run-state derivation was DELETED, so
 *      `runStateKind` is `null` on a derived turn and there is no non-null legacy
 *      kind left to pass through by mistake. The footgun is closed at the TYPE
 *      level, which no test can be as strong as. What is still only observable
 *      here is the BEHAVIOUR either side of that seam: with no wire kind the
 *      local refusal must speak, and with one the wire must win — including the
 *      B1 carve-out for `never_run`, which no type can express.
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

// ⚠ BOTH FACTORIES SPREAD `importOriginal` — trap 12's exact mechanism. A bare
// `vi.mock(path, () => ({ … }))` REPLACES the module, so every export the factory
// does not list becomes `undefined`. In this repo that has already cost 51 tests
// silently (the flags-mock allowlist), and it fails at COLLECTION with an error
// that names the importer rather than the mock. Spreading the original means only
// the ONE export each test needs to control is overridden, and anything these
// modules gain later keeps working without this file having to be updated.
vi.mock('@/canvas/state/analysisStateSelector', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useAnalysisState: () => composed,
}))

vi.mock('@/canvas/store', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useCanvasStore: (selector: (s: Record<string, unknown>) => unknown) => selector(storeState),
}))

// Imported AFTER the mocks so the hook binds to them.
const { useAnalysisRunState } = await import('../useAnalysisRunState')

/**
 * A composed state shaped like the selector's DERIVED branch. Only the members
 * this hook reads are load-bearing; the rest satisfy the type.
 *
 * ⚠ THE DEFAULT IS `runStateKind: null`, AND THAT IS A CORRECTNESS FIX, NOT
 * TIDYING. It used to default to `'unknown_degraded'` alongside
 * `authority: 'derived'` — a pair the selector CAN NO LONGER PRODUCE, since
 * deleting the legacy run-state derivation made `authority === 'wire'` ⟺
 * `runStateKind !== null` (pinned in `analysisStateSelector.spec.ts`). A fixture
 * outside the producer's output domain proves nothing about the consumer, however
 * green it goes: trap 16's inverse, and the reason `composedState` now defaults
 * to the only derived-branch value that exists.
 *
 * Every case below that wants a kind therefore passes `authority: 'wire'` with
 * it, which is the only combination the producer can emit.
 */
function composedState(over: Partial<ComposedAnalysisState>): ComposedAnalysisState {
  return {
    authority: 'derived',
    wire: null,
    runStateKind: null,
    semantic: 'cannot_confirm',
    displayedFreshness: null,
    trust: { semantic: 'cannot_confirm', orphaned: false, isRunning: false },
    displayState: { state: 'complete' },
    resultsTab: { show: false },
    source: 'none',
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

describe('useAnalysisRunState — the wire/refusal union at the store seam', () => {
  it('a LEGACY turn (no wire kind) lets the LOCAL refusal reach the user', () => {
    // ⭐⭐ THE REGRESSION THIS FILE EXISTS FOR, restated for the post-deletion
    // shape. It used to set `authority:'derived'` WITH a non-null
    // `runStateKind:'complete_current'` — the strongest contradiction the legacy
    // derivation could produce — and assert the hook did not pass it through.
    //
    // That pair is now PRODUCER-UNEMITTABLE: the legacy derivation is deleted, so
    // a derived turn carries `runStateKind: null`. The substitution footgun is
    // gone at the TYPE level rather than guarded at runtime, which is strictly
    // better than this test was. What remains worth pinning is the behaviour that
    // matters to the user: with no wire kind, the refusal still speaks.
    composed = composedState({ authority: 'derived', runStateKind: null })
    storeState.analysisRefusalNotice = { blockedReason: 'no goal node', computedAt: null }

    expect(run()).toBe('refused')
  })

  it('a WIRE turn honours the wire verdict at the same cell — the discriminating pair', () => {
    // Same store, same refusal; only the wire's presence differs. The answer must
    // differ too, which is what proves the wire limb is load-bearing and that the
    // case above is not passing on a constant.
    composed = composedState({ authority: 'wire', runStateKind: 'complete_current' })
    storeState.analysisRefusalNotice = { blockedReason: 'no goal node', computedAt: null }

    expect(run()).toBe('complete_current')
  })

  it('B1: a wire `never_run` does NOT silence a live refusal, at the store seam', () => {
    // The blocker fix driven through the real hook rather than the pure mapper,
    // because the harm was only visible once the mounted consumer's composition
    // table was consulted: `never_run` renders no banner at all.
    composed = composedState({ authority: 'wire', runStateKind: 'never_run' })
    storeState.analysisRefusalNotice = { blockedReason: 'no goal node', computedAt: null }
    expect(run()).toBe('refused')

    // The pair: same wire kind, no refusal → `never_run` is honoured, so the
    // carve-out has not simply disabled it.
    storeState.analysisRefusalNotice = null
    expect(run()).toBe('never_run')
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
