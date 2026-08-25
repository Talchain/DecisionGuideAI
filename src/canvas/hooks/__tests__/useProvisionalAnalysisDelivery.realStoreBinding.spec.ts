/**
 * ROADMAP 2.1271 — THE APPLIER'S STORE VIEW IS BOUND TO THE **REAL** CANVAS STORE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS, AND WHY IT MAY NOT USE A STORE DOUBLE
 * ═══════════════════════════════════════════════════════════════════════════
 * The delivery hook shipped with
 *
 *     getStore: () => useCanvasStore.getState() as unknown as ScenarioAnalysisApplyStore
 *
 * The double cast switched typechecking off across a shape that does not match.
 * The canvas store carries the results hash at `results.hash`, never at the top
 * level (the turn path splices it in for exactly this reason —
 * `conversation/useConversation.ts:4783`), and every member of
 * `ScenarioAnalysisApplyStore` is optional. So `currentResultsHash` resolved to
 * `undefined`, `hash === (undefined ?? null)` was never true for a string hash,
 * and the `alreadyHeld` branch was DEAD on the deployed path.
 *
 * ⚠⚠ AND THE SUITE COULD NOT SEE IT. Both existing specs FABRICATE the field
 * (`applyScenarioAnalysisRead.spec.ts:104,260`,
 * `useProvisionalAnalysisDelivery.spec.ts:82`), so the mutant that drops the
 * dedupe scored BITTEN against a store shape production never produces — a
 * perfect kill-rate against the wrong oracle (CLAUDE.md trap 13c). A mutant kit
 * measures whether a test can DETECT a change; it never measures whether the
 * EXPECTATION is right.
 *
 * Therefore every assertion below runs against `useCanvasStore` ITSELF. Nothing
 * here constructs a store literal, and nothing here states a hash it computed
 * by hand: the precondition is established by driving the REAL writer, so if
 * the store's shape drifts again this file REDs instead of agreeing with a
 * model of the store that stopped being true.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE REACHABLE HARM BEING PINNED
 * ═══════════════════════════════════════════════════════════════════════════
 * With the dedupe dead, every terminal read re-writes the results slice
 * unconditionally — including `enrichment: null` and `rawV2Response: null`,
 * which CLEAR those slots (`canvas/store.ts:3673`). A user who runs an analysis
 * manually inside the armed 60s window and then receives the read has the slice
 * overwritten underneath them: animations restart, the Compare capture is
 * re-seeded, the V2-shaped slots are nulled. That is precisely what the
 * applier's own header says the dedupe prevents.
 */

import { describe, it, expect, beforeEach } from 'vitest'

import { useCanvasStore } from '../../store'
import {
  readProvisionalApplyStore,
  runProvisionalDeliverySchedule,
} from '../useProvisionalAnalysisDelivery'
import { applyScenarioAnalysisRead } from '../../hydrate/applyScenarioAnalysisRead'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

// ─── Fixtures ─────────────────────────────────────────────────────────────

function verdict(runState: AnalysisStateV1['run_state']): AnalysisStateV1 {
  return {
    run_state: runState,
    readiness: { status: 'ready', blockers: [] },
    leader_claim: { permitted: false, withheld_reason: 'separation_unavailable' },
    robustness: {},
    usable_for_prose: false,
    usable_for_chips: false,
    usable_for_followup: false,
    requires_rerun: false,
    blocked_unusable: false,
    contradictions: [],
  } as AnalysisStateV1
}

/** A real `analysis_result` block, of the shape CEE's builder emits. */
const RESULT_BLOCK = {
  type: 'analysis_result',
  summary: 'Hiring leads on the current model.',
  leading_option_id: 'opt_hire',
  win_probabilities: { opt_hire: 0.68, opt_hold: 0.32 },
  computed_against_hash: 'hash_draft',
  enrichment: {
    analysis_status: 'ok',
    option_comparison: [
      { option_id: 'opt_hire', option_label: 'Hire', win_probability: 0.68, outcome_mean: 0.55 },
      { option_id: 'opt_hold', option_label: 'Hold', win_probability: 0.32, outcome_mean: 0.41 },
    ],
  },
}

beforeEach(() => {
  // Return the REAL store's results slice to its pre-analysis state. Deliberately
  // `resultsReset` — the store's own action — rather than a hand-built literal.
  useCanvasStore.getState().resultsReset()
})

// ─── The binding itself ───────────────────────────────────────────────────

describe('readProvisionalApplyStore is bound to the REAL canvas store', () => {
  it('exposes the two writers the applier is allowed to call, and NOTHING from the graph slices', () => {
    const view = readProvisionalApplyStore()

    // POSITIVE: the applier's whole contract is these two writers.
    expect(typeof view.setAnalysisStateV1).toBe('function')
    expect(typeof view.resultsComplete).toBe('function')

    // BOUNDARY: `applyScenarioAnalysisRead`'s header says the graph belongs to
    // `serverGraphHydration`. The previous spread handed over the entire store,
    // so that boundary was documented rather than real. Bind it by identity to
    // the exact member set.
    expect(Object.keys(view).sort()).toEqual(
      [
        'currentResultsHash',
        // ⚠ ADDED BY THE DIVERGENCE GUARDS, AND THIS SPEC CORRECTLY OBJECTED.
        // The applier now needs ONE more fact — whether the canvas on screen
        // derives from a server graph we accepted — so the member set genuinely
        // changed and this expectation had to move with it. Recorded rather
        // than quietly widened: the whole point of an identity binding is that
        // adding a member is a decision someone makes on purpose.
        'graphAcceptedForCanvas',
        'resultsComplete',
        'setAnalysisStateV1',
      ].sort(),
    )
  })

  it('⭐ the new member is a DERIVED BOOLEAN — no graph slice crosses the boundary', () => {
    // This is the guard the member-set assertion above was really protecting,
    // now made explicit. `graphAcceptedForCanvas` is derived FROM a graph slice
    // (`lastAuthoritativeGraph`), and the boundary it must respect is that the
    // SLICE ITSELF never crosses — the applier gets an answer, not the graph.
    //
    // ⚠ WHAT THIS TEST ACTUALLY CATCHES — measured, not assumed, because the
    // first version of this comment OVERSTATED it and was false.
    //
    // It claimed a future edit handing over `lastAuthoritativeGraph` "REDs
    // here". IT DOES NOT: that field is an OBJECT, and the `Array.isArray`
    // loop below only catches ARRAYS (i.e. `nodes`). Leaking the object REDs
    // the MEMBER-SET IDENTITY BINDING in the test above, not this one.
    //
    // So the two tests split the work and neither covers both:
    //   leak `nodes`                  → REDs here AND the member-set test
    //   leak `lastAuthoritativeGraph` → REDs the member-set test ONLY
    //
    // Recorded rather than quietly corrected: a false guarantee in a test is
    // worse than no guarantee, because the next reader trusts it. This PR
    // corrected exactly that defect class one file over, and then reproduced it
    // here in the same commit — which is how ordinary the failure is.
    const view = readProvisionalApplyStore()
    expect(typeof view.graphAcceptedForCanvas).toBe('boolean')
    for (const value of Object.values(view)) {
      expect(Array.isArray(value)).toBe(false)
    }
  })

  it('⭐ it tracks the REAL store, both ways — not a constant', () => {
    // Trap 13b: a guard whose discrimination is unpinned. Asserting only `true`
    // (or only `false`) would pass against a hardcoded literal. Drive the actual
    // store fields both ways and require the derived answer to MOVE.
    useCanvasStore.setState({
      lastAuthoritativeGraph: null,
      nodes: [{ id: 'local-1', type: 'factor', position: { x: 0, y: 0 }, data: {} }] as never,
    } as never)
    expect(readProvisionalApplyStore().graphAcceptedForCanvas).toBe(false)

    useCanvasStore.setState({
      lastAuthoritativeGraph: { nodeIds: ['server-a'], edgePairs: [] },
    } as never)
    expect(readProvisionalApplyStore().graphAcceptedForCanvas).toBe(true)

    // An EMPTY canvas is not divergent — nothing local for a verdict to misdescribe.
    useCanvasStore.setState({ lastAuthoritativeGraph: null, nodes: [] as never } as never)
    expect(readProvisionalApplyStore().graphAcceptedForCanvas).toBe(true)
  })

  it('⭐ carries `currentResultsHash` sourced from the REAL store at `results.hash`', () => {
    // PRECONDITION, PINNED IN-TEST (trap 13b): drive the store's OWN writer so
    // the hash under test is the one production would hold, not one we invented.
    const outcome = applyScenarioAnalysisRead({
      analysisState: verdict({ kind: 'complete_current', computed_at: '2026-08-17T09:15:50.000Z' }),
      analysisResult: RESULT_BLOCK,
      store: readProvisionalApplyStore(),
    })
    expect(outcome.outcome).toBe('applied')

    const liveHash = useCanvasStore.getState().results?.hash
    // The precondition must be REAL: a blank hash would make the assertion
    // below pass for the wrong reason (it would compare null against null).
    expect(typeof liveHash).toBe('string')
    expect(liveHash).not.toBe('')

    // THE BINDING. Identity against the live store's own value — not a value
    // predicate another field could satisfy (trap 19).
    expect(readProvisionalApplyStore().currentResultsHash).toBe(liveHash)
  })

  it('reports `null`, never `undefined`, before any analysis has landed', () => {
    // The dedupe compares `hash === (currentResultsHash ?? null)`. Both spellings
    // behave identically THERE, but a consumer that ever switches to `===` on the
    // raw member would diverge, so pin the normalised value at the source.
    expect(useCanvasStore.getState().results?.hash).toBeUndefined()
    expect(readProvisionalApplyStore().currentResultsHash).toBeNull()
  })
})

// ─── The dedupe, on the production path ───────────────────────────────────

describe('⭐ the results dedupe FIRES on the deployed path', () => {
  it('a second delivery of the same analysis is `alreadyHeld` and re-writes NOTHING', () => {
    // FIRST delivery — the answer the user was waiting for.
    const first = applyScenarioAnalysisRead({
      analysisState: verdict({ kind: 'complete_current', computed_at: '2026-08-17T09:15:50.000Z' }),
      analysisResult: RESULT_BLOCK,
      store: readProvisionalApplyStore(),
    })
    expect(first).toEqual({ outcome: 'applied', kind: 'complete_current', resultsHydrated: true })

    // PRECONDITION: the real store now holds a hash for the dedupe to match.
    const heldHash = useCanvasStore.getState().results?.hash
    expect(typeof heldHash).toBe('string')
    expect(heldHash).not.toBe('')
    const finishedAtBefore = useCanvasStore.getState().results?.finishedAt

    // SECOND delivery — the same analysis arriving on a later poll.
    const second = applyScenarioAnalysisRead({
      analysisState: verdict({ kind: 'complete_current', computed_at: '2026-08-17T09:15:50.000Z' }),
      analysisResult: RESULT_BLOCK,
      store: readProvisionalApplyStore(),
    })

    // ⚠ THIS IS THE ASSERTION THE FABRICATED-STORE SPECS COULD NOT MAKE.
    expect(second).toEqual({ outcome: 'alreadyHeld', kind: 'complete_current' })

    // And the harm itself: the slice was not re-written. `finishedAt` is stamped
    // by `resultsComplete` on every call (`canvas/store.ts`), so an unchanged
    // stamp is direct evidence the writer did not run a second time.
    expect(useCanvasStore.getState().results?.finishedAt).toBe(finishedAtBefore)
    expect(useCanvasStore.getState().results?.hash).toBe(heldHash)
  })

  it('DISCRIMINATING TWIN — a DIFFERENT analysis is still applied', () => {
    applyScenarioAnalysisRead({
      analysisState: verdict({ kind: 'complete_current', computed_at: '2026-08-17T09:15:50.000Z' }),
      analysisResult: RESULT_BLOCK,
      store: readProvisionalApplyStore(),
    })
    const firstHash = useCanvasStore.getState().results?.hash
    expect(typeof firstHash).toBe('string')

    // A genuinely different analysis: different win probabilities, so the mapper
    // derives a different `response_hash`.
    const otherBlock = {
      ...RESULT_BLOCK,
      summary: 'Holding leads on the current model.',
      leading_option_id: 'opt_hold',
      win_probabilities: { opt_hire: 0.31, opt_hold: 0.69 },
    }
    const second = applyScenarioAnalysisRead({
      analysisState: verdict({ kind: 'complete_current', computed_at: '2026-08-17T09:15:50.000Z' }),
      analysisResult: otherBlock,
      store: readProvisionalApplyStore(),
    })

    // Without this twin, "always return alreadyHeld" would pass the test above.
    // With it, the pair is only satisfiable by a dedupe that actually compares.
    expect(second.outcome).toBe('applied')
    expect(useCanvasStore.getState().results?.hash).not.toBe(firstHash)
  })
})

// ─── The PRODUCTION WIRING, not just the helper ───────────────────────────

/**
 * ⚠ THE GAP THIS CLOSES, and it is the one that let the defect ship.
 *
 * Every assertion above proves `readProvisionalApplyStore` is correct. NONE of
 * them proves the delivery USES it — and the original defect was precisely a
 * wiring one: the helper did not exist, the hook inlined its own expression,
 * and every spec injected a substitute `getStore`. A suite can be exhaustive
 * about a function and silent about whether anything calls it (trap 3b: bind to
 * the path that actually mounts).
 *
 * So `getStore` is now OPTIONAL on the core, production passes nothing, and
 * these two cases drive the schedule WITHOUT it — exercising the real default
 * against the real store.
 */
describe('⭐ the DEFAULT store view — what production actually runs', () => {
  const TERMINAL_READ = {
    status: 'graph' as const,
    analysisState: verdict({ kind: 'complete_current', computed_at: '2026-08-17T09:15:50.000Z' }),
    analysisResult: RESULT_BLOCK,
  }

  it('dedupes against the REAL store when no `getStore` is injected', async () => {
    // PRECONDITION: the real store already holds this exact analysis.
    const seeded = applyScenarioAnalysisRead({
      analysisState: TERMINAL_READ.analysisState,
      analysisResult: RESULT_BLOCK,
      store: readProvisionalApplyStore(),
    })
    expect(seeded.outcome).toBe('applied')
    expect(typeof useCanvasStore.getState().results?.hash).toBe('string')

    const outcome = await runProvisionalDeliverySchedule({
      scenarioId: 'scn_1',
      userId: null,
      signal: new AbortController().signal,
      // ⭐ NO `getStore`. This is the production configuration.
      read: async () => TERMINAL_READ as never,
      wait: async () => {},
      delays: [0],
    })

    // With the shipped double-cast this reads 'delivered': the dedupe cannot
    // see a hash the store view never carried.
    expect(outcome).toBe('already_held')
  })

  it('DISCRIMINATING TWIN — the default still DELIVERS an analysis the store lacks', async () => {
    // Same configuration, empty store. Without this twin, a default that always
    // reported `already_held` would satisfy the case above.
    expect(useCanvasStore.getState().results?.hash).toBeUndefined()

    const outcome = await runProvisionalDeliverySchedule({
      scenarioId: 'scn_1',
      userId: null,
      signal: new AbortController().signal,
      read: async () => TERMINAL_READ as never,
      wait: async () => {},
      delays: [0],
    })

    expect(outcome).toBe('delivered')
    expect(typeof useCanvasStore.getState().results?.hash).toBe('string')
  })
})
