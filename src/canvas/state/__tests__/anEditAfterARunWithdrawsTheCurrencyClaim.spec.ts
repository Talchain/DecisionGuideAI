/**
 * AN EDIT AFTER A RUN WITHDRAWS THE CURRENCY CLAIM — end to end, through the
 * real store.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS: EACH HALF WAS PINNED AND THE JOIN WAS NOT
 * ═══════════════════════════════════════════════════════════════════════════
 * The plan's Parallel C is done when "the correct model/result is visible,
 * later edits truthfully make it stale, and reopening retains meaning and
 * state". The middle clause has a complete mechanism:
 *
 *   setObservedValue            (useInspectorMutations.ts:651)
 *     -> updateNode             (store.ts:3642)
 *     -> hasAnalyticalNodeChange  — `observedState` is an analytical field
 *     -> invalidateAnalysisReady  (store.ts:2905)
 *     -> markAnalysisFreshnessDirty
 *     -> resolveDisplayedFreshness: a retained 'fresh' verdict becomes 'unknown'
 *
 * ⚠ AND NOTHING DROVE IT END TO END. The store hop is covered by inspector
 * specs; the panel hop is covered by specs that pass `isStale` / `staleReason`
 * as PROPS. So both ends were green and the chain between them was unpinned —
 * exactly the "component witnesses never compose into a journey claim" rule in
 * CLAUDE.md's status ladder. A refactor anywhere in the middle would have taken
 * the currency withdrawal out with nothing going red.
 *
 * ⭐ SO THIS DRIVES THE REAL MUTATION AGAINST THE REAL STORE and asserts the
 * REAL selector. It invents no fixture for any hop it is testing.
 *
 * ⚠ WHAT IT DELIBERATELY DOES NOT CLAIM. It does not fabricate 'stale' — the
 * rule's own words: "it never fabricates 'stale'". The product's honest answer
 * after a local edit is that currency can no longer be CONFIRMED, because CEE
 * has not been asked again. Asserting 'stale' here would pin a claim the client
 * is not entitled to make.
 */
import { describe, it, expect, beforeEach } from 'vitest'

import { useCanvasStore } from '../../store'
import { resolveDisplayedFreshness } from '../../store/analysisFreshness'

const FACTOR = 'f-capital-raised'

/** A model with one analytical factor, and a run CEE has vouched for as current. */
function seedAnalysedModel(): void {
  useCanvasStore.setState({
    currentScenarioId: 'scenario-witness',
    nodes: [
      { id: 'g1', type: 'goal', data: { label: 'Raise the round' } },
      { id: 'o1', type: 'option', data: { label: 'Target angels' } },
      {
        id: FACTOR,
        type: 'factor',
        data: { label: 'Capital Raised', observedState: { value: 0.2 } },
      },
    ] as never,
    edges: [] as never,
    history: { past: [], future: [] },
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' } as never,
    analysisFreshnessDirty: false,
  } as never)
}

const displayed = (): string | null => {
  const s = useCanvasStore.getState()
  return resolveDisplayedFreshness(
    (s as unknown as { analysisFreshness: never }).analysisFreshness,
    s.analysisFreshnessDirty,
  )
}

beforeEach(seedAnalysedModel)

describe('THE CONTROL — before any edit, the run is presented as current', () => {
  /**
   * ⭐⭐ Without this, "the claim is withdrawn" could pass on a model that never
   * held a currency claim in the first place — the whole assertion would be
   * about a fixture, not about an edit (CLAUDE.md trap 13).
   */
  it('a vouched-for run reads as fresh, and nothing is dirty', () => {
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
    expect(displayed()).toBe('fresh')
  })
})

describe('changing a number the analysis used withdraws the currency claim', () => {
  /**
   * ⛔ THE JOURNEY HOP. This is the edit Paul makes from "What I estimated" —
   * `FactorValueControl` -> `proposeFactorValue` -> `mutations.setObservedValue`
   * -> `updateNode`. Driven here through the store action that write lands on,
   * so the analytical-change recognition is exercised rather than assumed.
   */
  it('the displayed freshness stops saying fresh', () => {
    const node = useCanvasStore.getState().nodes.find((n) => n.id === FACTOR)!
    useCanvasStore.getState().updateNode(FACTOR, {
      data: { ...node.data, observedState: { value: 0.9 } },
    } as never)

    expect(
      useCanvasStore.getState().analysisFreshnessDirty,
      'an analytical edit must mark the retained verdict no-longer-confirmable',
    ).toBe(true)
    expect(displayed()).not.toBe('fresh')
  })

  /**
   * ⭐ AND IT SAYS "CANNOT CONFIRM", NOT "STALE". `resolveDisplayedFreshness`'s
   * own rule: "it never fabricates 'stale'". CEE has not been asked again, so
   * the client knows only that it can no longer vouch — claiming the stronger
   * fact would be the overclaim this panel keeps having to remove.
   */
  it('and says it cannot confirm, rather than asserting the result is stale', () => {
    const node = useCanvasStore.getState().nodes.find((n) => n.id === FACTOR)!
    useCanvasStore.getState().updateNode(FACTOR, {
      data: { ...node.data, observedState: { value: 0.9 } },
    } as never)
    expect(displayed()).toBe('unknown')
  })

  /**
   * ⚠ THE OPPOSITE-DIRECTION TWIN (trap 22b). A NON-analytical edit must NOT
   * withdraw the claim — otherwise renaming a node would tell the reader their
   * result no longer describes the model, which is false and trains them to
   * ignore the signal.
   */
  it('a cosmetic edit leaves the currency claim standing', () => {
    const node = useCanvasStore.getState().nodes.find((n) => n.id === FACTOR)!
    useCanvasStore.getState().updateNode(FACTOR, {
      data: { ...node.data, label: 'Capital Raised (renamed)' },
    } as never)

    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
    expect(displayed()).toBe('fresh')
  })

  /**
   * ⚠ AND RE-WRITING THE SAME VALUE IS NOT AN EDIT. The comparison is semantic
   * (`analyticalChange.ts`: "a byte-identical rewrite is NOT treated as a
   * change"), which is what stops CEE re-sending an unchanged observed_state
   * from withdrawing a claim nothing invalidated.
   */
  it('re-writing the identical value changes nothing', () => {
    const node = useCanvasStore.getState().nodes.find((n) => n.id === FACTOR)!
    useCanvasStore.getState().updateNode(FACTOR, {
      data: { ...node.data, observedState: { value: 0.2 } },
    } as never)
    expect(displayed()).toBe('fresh')
  })
})
