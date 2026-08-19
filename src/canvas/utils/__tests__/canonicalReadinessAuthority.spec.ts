/**
 * THE RUN GATE ASKS THE CANONICAL READINESS AUTHORITY, AND THE SIDE-CAR VERDICT
 * IS SUPERSEDED — NOT COMBINED WITH IT.
 *
 * ── THE DEFECT THIS PINS (wire capture, frozen quartet, 19 Aug 2026) ────────
 * A fresh guest drafted a 16-node model from the governed brief
 * `04-conflicting-constraints`. `useCanvasStore.getState()` read:
 *
 *   analysisStateV1.readiness = { status: 'ready', blockers: [] }
 *   analysisStateV1.run_state = { kind: 'never_run' }
 *   ceeAnalysisReady.status   = 'ready'   (all three options 'ready')
 *
 * …and `[data-testid="pre-analysis-v3-analyse"]` was `disabled`, with the title
 * *"Olumi needs something more from this model before the next analysis…"* —
 * `BLOCKED_REASON_COPY.unspecified`, the rung that fires when the verdict
 * refuses and carries no structured field naming a cause.
 *
 * That sentence is FALSE: the producer's own readiness carried ZERO blockers.
 * The product asserted something untrue about the user's own model, and the
 * escape route it named (the chat) was itself a no-op.
 *
 * ── THE ROOT CAUSE, NAMED (trap 21: two questions under one name) ───────────
 * TWO readiness notions existed under one name and nothing said so:
 *
 *   COMPETITOR  `readinessStore.readiness.can_run_analysis` — a SIDE-CAR
 *               assessment fetched from `/bff/cee/graph-readiness`. It is the
 *               only thing `canRunAnalysis` ever asked, and it can object
 *               while naming nothing (its empty-canvas verdict carries exactly
 *               five fields and no structured cause, so a retained one lands
 *               on the `unspecified` rung by construction).
 *   CANONICAL   `analysis_state.readiness` — carried by the PRODUCER on every
 *               turn. The contract is explicit that an empty `blockers` list
 *               "is a POSITIVE claim: the producer assessed readiness and
 *               found nothing blocking", and that `run_state` "is the
 *               authority: a consumer must not derive, override or supplement
 *               it". It reached the store, was exposed by
 *               `analysisStateSelector` as `readinessStatus`/`readinessBlockers`
 *               — and had ZERO product consumers. Computed, delivered, unread.
 *
 * ── THE CONVERGENCE (Paul's binding rule: name the owner, SUPERSEDE the rival)
 * `readinessObjectsToRun` stays the ONE definition of a readiness objection and
 * gains the canonical authority as its first argument. When the producer has
 * stated readiness, the side-car verdict is NOT CONSULTED AT ALL. This is the
 * same feature-detected precedence `analysisStateSelector` already applies to
 * every other analysis truth — one authority, asked once — not a second rule
 * bolted beside the first.
 *
 * ── WHAT EACH TEST BELOW IS FOR ─────────────────────────────────────────────
 * The suite is written to FAIL in both directions, which is the whole point:
 *   · AC1 REDs if the gate keeps consulting the side-car when the producer
 *     said ready;
 *   · AC2 REDs if a blocked state explains itself with a constant instead of
 *     with the producer's own blocker list;
 *   · SUPERSESSION REDs if the change is implemented as an OR (a permissive
 *     side-car must not be able to open a gate the producer has closed);
 *   · the LEGACY CONTRAST CONTROL is GREEN at pristine and must stay green —
 *     it proves this file is bound to the real gate and is not vacuous
 *     (trap 13e: an absence claim needs a contrast that reads non-zero).
 */

import { describe, it, expect } from 'vitest'
import type { AnalysisBlocker, AnalysisStateV1 } from '@talchain/schemas/boundary'

import { actionableBlockers, canRunAnalysis, readinessObjectsToRun } from '../canRunAnalysis'
import { selectAnalysisReadinessAuthority } from '../../state/analysisStateSelector'
import { BLOCKED_REASON_COPY } from '../composeBlockedReason'
import type { GraphReadiness } from '../../hooks/useGraphReadiness'
import type { CanRunAnalysisParams } from '../canRunAnalysis'

// ───────────────────────────────────────────────────────────────────────────
// Fixtures.
//
// ⚠ `SIDE_CAR_OBJECTS` is NOT invented: it is field-for-field the verdict
// `readinessStore`'s empty-canvas arm composes and then RETAINS across a failed
// refetch (`readinessStore.ts`, the `currentNodes.length === 0` branch). It
// carries no `goal_node_valid`, no `options_total`, no `scaffold_plan` — which
// is precisely why `composeReadinessBlockedReason` falls to `unspecified` and
// why the deployed tooltip read the way it did.
// ───────────────────────────────────────────────────────────────────────────

const SIDE_CAR_OBJECTS: GraphReadiness = {
  readiness_score: 0,
  readiness_level: 'needs_work',
  can_run_analysis: false,
  confidence_explanation: 'Add some nodes to get started',
  improvements: [],
}

const SIDE_CAR_PERMITS: GraphReadiness = {
  readiness_score: 82,
  readiness_level: 'ready',
  can_run_analysis: true,
  confidence_explanation: 'Analysis available',
  improvements: [],
}

function blocker(overrides: Partial<AnalysisBlocker> = {}): AnalysisBlocker {
  return {
    code: 'OPTION_NOT_READY',
    category: 'options',
    message: 'The option has no effect values.',
    repairability: 'user_repairable',
    ...overrides,
  }
}

/**
 * The producer's STATED readiness vocabulary, as a closed set.
 *
 * Mirrored from CEE `orchestrator-v5/context/canonical-analysis-state.ts:137-145`
 * (`ANALYSIS_READY_STATUSES`). FIVE members — and `'unknown'` is deliberately
 * NOT one of them: that is `READINESS_STATUS_UNSUPPLIED`
 * (`orchestrator-v5/compose/analysis-state-v1.ts:106`), the sentinel substituted
 * when no status was supplied, minted in a different file. Treating it as a
 * sixth member of this list is the conflation the sentinel guard exists to undo.
 */
const ANALYSIS_READY_STATUSES = [
  'ready',
  'needs_user_mapping',
  'needs_encoding',
  'needs_user_input',
  'blocked',
] as const

/**
 * The stated statuses that can describe a RUNNABLE model — the five above minus
 * `blocked`.
 *
 * ⚠ DERIVED AT THE PRODUCER, and this is the load-bearing distinction. A
 * proposal to make the gate `status !== 'ready'` was refuted there: at
 * `cee/transforms/analysis-ready.ts:958-969` the payload-status chain emits
 * `needs_user_mapping` for an unconnected controllable factor its own payload
 * step calls "informational", and `needs_encoding` for the UI-SEM-091 scaffold
 * state that is explicitly runnable. `blocked` is absent from that chain
 * entirely and is written only by hard-block and refusal paths.
 */
const RUNNABLE_STATED_STATUSES = ANALYSIS_READY_STATUSES.filter((s) => s !== 'blocked')

/**
 * A full `AnalysisStateV1` as the wire carries it, so the cases below travel
 * through `selectAnalysisReadinessAuthority` — THE REAL SEAM — rather than
 * hand-constructing the authority object the gate happens to accept. Without
 * this, a sentinel guard living in the selector would be invisible to every
 * assertion in this file.
 */
function wireState(readiness: AnalysisStateV1['readiness']): AnalysisStateV1 {
  return {
    run_state: { kind: 'never_run' },
    readiness,
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

/**
 * The gate as the deployed canvas calls it: a real model on screen, nothing
 * held, nothing streaming, no validation issues. Only the two readiness
 * authorities vary between tests, so any difference in the verdict is
 * attributable to them and to nothing else.
 */
function gate(overrides: Partial<CanRunAnalysisParams> = {}) {
  return canRunAnalysis({
    graphHealth: null,
    readiness: SIDE_CAR_OBJECTS,
    hasBlockers: false,
    nodeCount: 16,
    isRunning: false,
    analysisHeldOn: null,
    draftStreamPhase: 'idle',
    optionsNeedingValues: [],
    readinessStale: false,
    ...overrides,
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// ACCEPTANCE 1 — a producer-ready model with zero blockers is RUNNABLE.
// ═══════════════════════════════════════════════════════════════════════════

describe('AC1 — producer says ready with zero blockers: the control is ENABLED', () => {
  it('opens the gate even though the side-car verdict objects', () => {
    const result = gate({
      analysisReadiness: { status: 'ready', blockers: [] },
    })

    expect(result.allowed).toBe(true)
    // An open gate makes no refusal at all — not a softer one.
    expect(result.reason).toBeUndefined()
    expect(result.blockingReasons ?? []).toEqual([])
  })

  it('never emits the false sentence the deployed build showed', () => {
    const result = gate({
      analysisReadiness: { status: 'ready', blockers: [] },
    })

    // The exact string read off the frozen build's button title.
    expect(result.reason).not.toBe(BLOCKED_REASON_COPY.unspecified)
  })

  it('an empty blocker list is a POSITIVE claim, across the producer\'s REAL vocabulary', () => {
    // ⚠ RE-DERIVED FROM THE PRODUCER, 19 Aug 2026 (trap 13c). This case used to
    // read `{ status: 'unknown_code', blockers: [] }` and was justified by the
    // contract's `describe()` prose calling `status` an open producer-owned
    // code. The prose is not the producer. At CEE staging the STATED vocabulary
    // is the five-member `ANALYSIS_READY_STATUSES`
    // (`orchestrator-v5/context/canonical-analysis-state.ts:137-145`), so
    // `'unknown_code'` is a fixture the producer CANNOT EMIT — and a fixture
    // outside the producer's output domain proves nothing (trap 16-inverse).
    //
    // What the rung actually claims is narrower and true: for a STATED verdict,
    // the itemised blocker list is what decides, and an empty one is a positive
    // finding. Asserted across every value the producer can actually send.
    for (const status of RUNNABLE_STATED_STATUSES) {
      expect(gate({ analysisReadiness: { status, blockers: [] } }).allowed, status).toBe(true)
    }
  })

  it('A CASE PER STATED STATUS — `blocked` refuses, the other four defer to the list', () => {
    // Bound by the status LITERAL, one row per value, never by a predicate
    // another status could satisfy (trap 19). The table IS the claim:
    //
    //   ready              [] -> PERMIT   nothing itemised, nothing blocking
    //   needs_user_mapping [] -> PERMIT   informational unconnected factor
    //   needs_encoding     [] -> PERMIT   the UI-SEM-091 scaffold state
    //   needs_user_input   [] -> PERMIT   its blockers ARE the list; empty = none
    //   blocked            [] -> REFUSE   the refusal builder's own carrier
    expect(gate({ analysisReadiness: { status: 'ready', blockers: [] } }).allowed).toBe(true)
    expect(gate({ analysisReadiness: { status: 'needs_user_mapping', blockers: [] } }).allowed).toBe(true)
    expect(gate({ analysisReadiness: { status: 'needs_encoding', blockers: [] } }).allowed).toBe(true)
    expect(gate({ analysisReadiness: { status: 'needs_user_input', blockers: [] } }).allowed).toBe(true)
    expect(gate({ analysisReadiness: { status: 'blocked', blockers: [] } }).allowed).toBe(false)
  })

  it('a refusal turn does not hand back an ENABLED button one turn later', () => {
    // `buildAnalysisRefusalReadiness` (`analysis-ready-helper.ts:1440`) emits
    // `status: 'blocked'` with no `blockers` key, so the wire carries `[]`. On
    // the blockers-only predicate that OPENED the gate immediately after CEE had
    // refused the run — click, refused, button live again, click, refused.
    const refusalTurn = gate({ analysisReadiness: { status: 'blocked', blockers: [] } })
    expect(refusalTurn.allowed).toBe(false)
  })

  it('and the sentence it shows names nothing it cannot name', () => {
    // Honesty check on the empty-list refusal. The producer itemised nothing, so
    // the copy must not imply a specific missing thing — it says only that
    // something more is needed and points at the chat, which on a refusal turn
    // genuinely carries CEE's own explanation.
    const reason = gate({ analysisReadiness: { status: 'blocked', blockers: [] } }).reason
    expect(reason).toBe(BLOCKED_REASON_COPY.unspecified)
    // Never a fabricated specific: no quoted label, no count, no identifier.
    expect(reason).not.toMatch(/"/)
    expect(reason).not.toMatch(/\d/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ACCEPTANCE 2 — a genuinely blocked model is disabled AND says WHY, from the
// producer's own list.
// ═══════════════════════════════════════════════════════════════════════════

describe('AC2 — real blockers close the gate and NAME themselves', () => {
  it('blocks, and quotes the blocker the producer scoped', () => {
    const result = gate({
      analysisReadiness: {
        status: 'not_ready',
        blockers: [blocker({ option_label: 'Extend the free trial' })],
      },
    })

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Extend the free trial')
    expect(result.reason).not.toBe(BLOCKED_REASON_COPY.unspecified)
  })

  it('the sentence DERIVES from the list — two different lists cannot share one constant', () => {
    // Trap 19, in its cheapest form: a constant satisfies any single assertion.
    // Two lists that differ only in their labels must produce two sentences that
    // differ in exactly the same way, or the copy is not derived at all.
    const a = gate({
      analysisReadiness: {
        status: 'not_ready',
        blockers: [blocker({ option_label: 'Extend the free trial' })],
      },
    }).reason
    const b = gate({
      analysisReadiness: {
        status: 'not_ready',
        blockers: [blocker({ option_label: 'Hold the current price' })],
      },
    }).reason

    expect(a).not.toBe(b)
    expect(a).toContain('Extend the free trial')
    expect(b).toContain('Hold the current price')
    expect(a).not.toContain('Hold the current price')
  })

  it('names a factor-scoped blocker too — the scope field, not one hard-coded key', () => {
    const result = gate({
      analysisReadiness: {
        status: 'not_ready',
        blockers: [blocker({ category: 'factors', factor_label: 'Support headcount' })],
      },
    })

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Support headcount')
  })

  it('two blockers name both; more than two publish the producer COUNT', () => {
    const two = gate({
      analysisReadiness: {
        status: 'not_ready',
        blockers: [
          blocker({ option_label: 'Extend the free trial' }),
          blocker({ option_label: 'Hold the current price' }),
        ],
      },
    }).reason
    expect(two).toContain('Extend the free trial')
    expect(two).toContain('Hold the current price')

    // Four unnameable blockers: the count is still drawn from the LIST, so it
    // moves with the list. A constant cannot do that either.
    const four = gate({
      analysisReadiness: {
        status: 'not_ready',
        blockers: [blocker(), blocker(), blocker(), blocker()],
      },
    }).reason
    const three = gate({
      analysisReadiness: {
        status: 'not_ready',
        blockers: [blocker(), blocker(), blocker()],
      },
    }).reason
    expect(four).toContain('4')
    expect(three).toContain('3')
    expect(four).not.toBe(three)
    expect(four).not.toBe(BLOCKED_REASON_COPY.unspecified)
  })

  it('an unquotable label degrades to the count, never to a leaked identifier', () => {
    // `safeDisplayLabel`'s rule, inherited unchanged: a label carrying a
    // glossary-banned term is not quoted back, and the id is NEVER shown.
    const result = gate({
      analysisReadiness: {
        status: 'not_ready',
        blockers: [blocker({ option_id: 'opt_extend', option_label: 'Rebuild the graph layer' })],
      },
    })

    expect(result.allowed).toBe(false)
    expect(result.reason).not.toContain('opt_extend')
    expect(result.reason).not.toContain('Rebuild the graph layer')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SUPERSESSION — the canonical authority ANSWERS; it is not OR-ed with the
// side-car. This is the test that fails if the fix is written as a parallel
// rule, which is precisely what Paul's convergence ruling forbids.
// ═══════════════════════════════════════════════════════════════════════════

describe('supersession, in BOTH directions', () => {
  it('a permissive side-car cannot open a gate the producer has closed', () => {
    const result = gate({
      readiness: SIDE_CAR_PERMITS,
      analysisReadiness: {
        status: 'not_ready',
        blockers: [blocker({ option_label: 'Hold the current price' })],
      },
    })

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Hold the current price')
  })

  it('an objecting side-car cannot close a gate the producer has opened', () => {
    expect(gate({ readiness: SIDE_CAR_OBJECTS, analysisReadiness: { status: 'ready', blockers: [] } }).allowed).toBe(true)
  })

  it('the side-car staleness mark does not reach the producer verdict', () => {
    // `readinessStale` is a fact about the SIDE-CAR's evidence. Letting it
    // rewrite a producer-stated refusal would re-mix the two authorities the
    // moment they were separated — the defect one level up.
    const result = gate({
      readinessStale: true,
      analysisReadiness: {
        status: 'not_ready',
        blockers: [blocker({ option_label: 'Extend the free trial' })],
      },
    })

    expect(result.reason).toContain('Extend the free trial')
    expect(result.reason).not.toBe(BLOCKED_REASON_COPY.staleRecheck)
  })

  it('the dispatch barrier asks the SAME predicate, with the same precedence', () => {
    // `readinessObjectsToRun` is re-asked at dispatch time (ROADMAP 2.635 I-4).
    // If the precedence lived only in `canRunAnalysis`, the render gate would
    // open and the barrier would refuse — a run that dies between the click and
    // the wire, which is the silent class this lane is also fixing.
    expect(readinessObjectsToRun(SIDE_CAR_OBJECTS, { status: 'ready', blockers: [] })).toBe(false)
    expect(
      readinessObjectsToRun(SIDE_CAR_PERMITS, { status: 'not_ready', blockers: [blocker()] }),
    ).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// CONTRAST CONTROL — green at pristine, and it must stay green.
//
// Everything above is an assertion about a NEW branch. Without these, a fix
// that simply forced `allowed: true` would satisfy AC1 and this file would
// applaud. These pin the legacy behaviour that must survive untouched: when
// the producer has stated NOTHING, the side-car still answers, both ways.
// ═══════════════════════════════════════════════════════════════════════════

describe('CONTRAST CONTROL — no producer verdict: the side-car still answers', () => {
  it('an objecting side-car still closes the gate when readiness is not stated', () => {
    const result = gate({ analysisReadiness: null })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe(BLOCKED_REASON_COPY.unspecified)
  })

  it('a permissive side-car still opens it when readiness is not stated', () => {
    expect(gate({ readiness: SIDE_CAR_PERMITS, analysisReadiness: null }).allowed).toBe(true)
  })

  it('an omitted argument is identical to an explicit null — absence is one state', () => {
    const omitted = gate()
    const explicit = gate({ analysisReadiness: null })
    expect(omitted.allowed).toBe(explicit.allowed)
    expect(omitted.reason).toBe(explicit.reason)
  })

  it('the earlier rungs still outrank readiness, whichever authority answers', () => {
    // A producer "ready" must not resurrect a run for an empty canvas, a held
    // model, or a draft whose values have not settled. Those rungs answer
    // different questions and return BEFORE readiness is consulted.
    const ready = { status: 'ready', blockers: [] as AnalysisBlocker[] }
    expect(gate({ nodeCount: 0, analysisReadiness: ready }).allowed).toBe(false)
    expect(gate({ analysisHeldOn: 'starter', analysisReadiness: ready }).allowed).toBe(false)
    expect(gate({ draftStreamPhase: 'settling', analysisReadiness: ready }).allowed).toBe(false)
    expect(gate({ isRunning: true, analysisReadiness: ready }).allowed).toBe(false)
  })

  it('a validation blocker still closes the gate under a producer-ready verdict', () => {
    // Two DIFFERENT questions again: `graphHealth` is the client's own
    // validation, and the producer's readiness says nothing about it.
    const result = gate({
      graphHealth: { issues: [{ severity: 'error', message: 'Two options share one label' }] },
      hasBlockers: true,
      analysisReadiness: { status: 'ready', blockers: [] },
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Two options share one label')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// THE UNSUPPLIED SENTINEL — an absence wearing a status code.
//
// These cases go through `selectAnalysisReadinessAuthority`, not through a
// hand-built authority object, because the guard lives in the selector and a
// spec that skipped it would pass against a selector that had none.
// ═══════════════════════════════════════════════════════════════════════════

describe("CEE's `unknown` sentinel behaves IDENTICALLY to an absent verdict", () => {
  const viaSelector = (state: AnalysisStateV1 | null) =>
    gate({ analysisReadiness: selectAnalysisReadinessAuthority(state) })

  it('does not let an unsupplied verdict discard an objecting side-car', () => {
    // The harm, stated plainly: `{ status: 'unknown', blockers: [] }` read as a
    // stated verdict is a POSITIVE claim that nothing is blocking — so the gate
    // would open and the side-car would never be asked, on a turn where CEE
    // said only that it had not assessed. CEE's own comment forbids reading the
    // sentinel as `blocked`; reading it as READY is worse.
    const unsupplied = viaSelector(wireState({ status: 'unknown', blockers: [] }))
    expect(unsupplied.allowed).toBe(false)
    expect(unsupplied.reason).toBe(BLOCKED_REASON_COPY.unspecified)
  })

  it('IDENTICAL to absence — same verdict, same sentence, both directions', () => {
    // Bound by EQUIVALENCE, not by a hard-coded expectation (trap 19): whatever
    // the not-stated path does, the sentinel path must do. A future change to
    // the fallback cannot silently separate them.
    const absent = gate({ analysisReadiness: null })
    const unsupplied = viaSelector(wireState({ status: 'unknown', blockers: [] }))
    expect(unsupplied.allowed).toBe(absent.allowed)
    expect(unsupplied.reason).toBe(absent.reason)

    // And with a PERMISSIVE side-car, both open — proving the equivalence is not
    // just "the sentinel always blocks".
    const absentOpen = gate({ readiness: SIDE_CAR_PERMITS, analysisReadiness: null })
    const unsuppliedOpen = gate({
      readiness: SIDE_CAR_PERMITS,
      analysisReadiness: selectAnalysisReadinessAuthority(
        wireState({ status: 'unknown', blockers: [] }),
      ),
    })
    expect(unsuppliedOpen.allowed).toBe(absentOpen.allowed)
    expect(unsuppliedOpen.allowed).toBe(true)
  })

  it('the sentinel does not swallow blockers the producer DID itemise', () => {
    // The fail-safe direction. If a turn ever carries the sentinel WITH a
    // populated list, falling to the side-car must not lose it — so this pins
    // that the guard is scoped to the status and cannot become a blanket escape.
    const withBlockers = viaSelector(
      wireState({
        status: 'unknown',
        blockers: [blocker({ option_label: 'Extend the free trial' })],
      }),
    )
    expect(withBlockers.allowed).toBe(false)
  })

  it('DISCRIMINATION — every STATED status still reaches the gate through the selector', () => {
    // The other half of the pair. Without this, a selector that returned `null`
    // for everything would satisfy the three cases above — and would have
    // silently deleted the entire fix.
    for (const status of ANALYSIS_READY_STATUSES) {
      const authority = selectAnalysisReadinessAuthority(wireState({ status, blockers: [] }))
      expect(authority, status).not.toBeNull()
      expect(authority!.status, status).toBe(status)
      // Reaching the gate, it supersedes the objecting side-car — permitting for
      // every runnable status, refusing for `blocked`, and in BOTH cases proving
      // the selector handed the verdict on rather than nulling it.
      expect(gate({ analysisReadiness: authority }).allowed, status).toBe(status !== 'blocked')
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ADVISORY BLOCKERS RIDE ALONG ON A READY PAYLOAD — AND MUST NOT CLOSE THE GATE
//
// ── THE DEFECT THIS PINS (derived at CEE `a61fe7ff`, the deployed build) ────
// #792 made `blockers` the predicate, as a RAW COUNT. But the producer's list
// is not homogeneous. CEE's own header says so
// (`orchestrator-v5/context/canonical-analysis-state.ts:47-56`):
//
//   "`status === 'ready'` carrying advisory `constraint_dropped` blockers is a
//    BY-DESIGN combination on the shared contract (the egress boundary injects
//    informational constraint-drop blockers onto an already-ready payload
//    without recomputing status). It must NOT downgrade usability."
//
// The chain, at the bytes: `extractConstraintDropBlockers`
// (`cee/transforms/analysis-ready.ts:1474`) mints the blocker →
// `cee/unified-pipeline/stages/boundary.ts:198` pushes it onto an already-ready
// `analysis_ready.blockers` WITHOUT recomputing status →
// `orchestrator/tools/draft-graph.ts:907` carries `blockers` through verbatim →
// `orchestrator-v5/compose/analysis-state-v1.ts:322` `mapWireBlockers` maps it
// onto the wire with NO actionability filter, as
// `code: 'CONSTRAINT_REVIEW_REQUIRED'` (`analysis-ready-helper.ts:705`, the sole
// emitter of that code).
//
// So a raw count refuses a model the producer JUST CALLED READY — the 2.635
// defect in a new spelling. Worse, the same payload's `usable_for_prose` and
// `usable_for_chips` stay TRUE, so the product contradicts itself on one turn.
//
// ── WHAT EACH TEST IS FOR ──────────────────────────────────────────────────
// · RED-FIRST REDs at pristine (the gate refuses a ready model).
// · ACTIONABLE STILL REFUSES is the DISCRIMINATING PARTNER: it stays green at
//   pristine and REDs the moment the filter is widened to drop an actionable
//   code — proving the fix narrows the count to a named class rather than
//   simply counting fewer things.
// · The DRIFT PIN REDs if CEE renames or reclassifies the code we restate.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The producer's advisory blocker code, restated from CEE
 * `orchestrator/tools/analysis-ready-helper.ts:705` — the `constraint_dropped`
 * case of `blockerIssue`, and the only branch in that repo that emits it.
 */
const ADVISORY_CODE = 'CONSTRAINT_REVIEW_REQUIRED'

/**
 * The ACTIONABLE codes `blockerIssue` emits, restated from the same switch
 * (`analysis-ready-helper.ts:683-702`). These are the images of CEE's
 * `ACTIONABLE_BLOCKER_TYPES` (`canonical-analysis-state.ts:130`:
 * `missing_value`, `ambiguous_value`, `missing_connection`) — the set
 * difference against the schema's four-member `AnalysisBlockerType` enum
 * (`src/schemas/analysis-ready.ts:140`) is exactly `constraint_dropped`, which
 * is what `ADVISORY_CODE` above is the wire spelling of.
 */
const ACTIONABLE_CODES = [
  'MISSING_OPTION_VALUE',
  'AMBIGUOUS_OPTION_VALUE',
  'MISSING_OPTION_CONNECTION',
] as const

/**
 * The advisory blocker AS CEE SHIPS IT — the `common` fields of `blockerIssue`
 * (`repairability: 'human_input_required'`), the `option_values` category that
 * `constraint_dropped` shares with `missing_value`, and the producer-authored
 * message. The shared category is the point: `category` CANNOT discriminate
 * here, which is why the fix keys on `code`.
 */
function advisoryBlocker(overrides: Partial<AnalysisBlocker> = {}): AnalysisBlocker {
  return blocker({
    code: ADVISORY_CODE,
    category: 'option_values',
    message: 'Review the unresolved constraint for "Cut burn rate by 30%".',
    repairability: 'human_input_required',
    factor_id: 'fac_burn_rate',
    factor_label: 'Cut burn rate by 30%',
    ...overrides,
  })
}

describe('advisory blockers on a READY payload do not close the gate', () => {
  it('RED-FIRST — a ready model carrying only a constraint_dropped advisory is RUNNABLE', () => {
    // The exact combination CEE documents as by-design. At pristine the raw
    // count refuses this, which is the defect.
    const result = gate({
      analysisReadiness: { status: 'ready', blockers: [advisoryBlocker()] },
    })

    expect(result.allowed).toBe(true)
    // And it must not manufacture a refusal sentence about a model the producer
    // called ready — the 2.635 failure mode, which was a FALSE sentence as much
    // as a dead control.
    expect(result.reason).toBeUndefined()
    expect(result.blockingReasons ?? []).not.toContain(BLOCKED_REASON_COPY.unspecified)
  })

  it('goes through the REAL selector seam, not a hand-built authority', () => {
    // Bound to `selectAnalysisReadinessAuthority` for the same reason the rest
    // of this file is: a guard living in the selector would otherwise be
    // invisible to every assertion here.
    const authority = selectAnalysisReadinessAuthority(
      wireState({ status: 'ready', blockers: [advisoryBlocker()] }),
    )
    expect(authority).not.toBeNull()
    expect(authority!.blockers.map((b) => b.code)).toEqual([ADVISORY_CODE])
    expect(readinessObjectsToRun(SIDE_CAR_OBJECTS, authority)).toBe(false)
    expect(gate({ analysisReadiness: authority }).allowed).toBe(true)
  })

  it('DISCRIMINATING PARTNER — every ACTIONABLE code still closes the gate on a ready payload', () => {
    // Green at pristine, and the half that REDs if the filter is widened to
    // drop an actionable code. Without it, "stop counting blockers entirely"
    // would satisfy the RED-FIRST case above and delete the gate.
    for (const code of ACTIONABLE_CODES) {
      const result = gate({
        analysisReadiness: { status: 'ready', blockers: [blocker({ code })] },
      })
      expect(result.allowed, code).toBe(false)
    }
  })

  it('an advisory blocker does not MASK an actionable one sharing the list', () => {
    // Bound by code IDENTITY, never by array position: the advisory sits FIRST
    // here, so a fix that inspected only `blockers[0]` would wrongly permit.
    const result = gate({
      analysisReadiness: {
        status: 'ready',
        blockers: [advisoryBlocker(), blocker({ code: 'MISSING_OPTION_VALUE' })],
      },
    })
    expect(result.allowed).toBe(false)
  })

  it('an UNRECOGNISED code still refuses — the denylist fails CLOSED', () => {
    // `code` is an OPEN vocabulary by contract ("a closed enum here would
    // reject codes a newer producer legitimately emits"). An allowlist of
    // actionable codes would fail OPEN on a newly-minted actionable code; this
    // asserts the chosen direction, which is the safe one.
    const result = gate({
      analysisReadiness: {
        status: 'ready',
        blockers: [blocker({ code: 'SOME_FUTURE_PRODUCER_CODE' })],
      },
    })
    expect(result.allowed).toBe(false)
  })

  it('`blocked` still refuses even when every blocker is advisory', () => {
    // Clause (a) is untouched by this change and must stay untouched: a
    // refusal turn emits `status: 'blocked'`, and the gate must not reopen one
    // turn later just because the list happens to hold nothing actionable.
    expect(
      gate({ analysisReadiness: { status: 'blocked', blockers: [advisoryBlocker()] } }).allowed,
    ).toBe(false)
    expect(gate({ analysisReadiness: { status: 'blocked', blockers: [] } }).allowed).toBe(false)
  })

  it('DRIFT PIN — UI-side only: this spec and the gate waive the same one code', () => {
    // ⚠ SCOPE, CORRECTED 19 Aug 2026. This case claimed it REDs "if CEE renames
    // the code". It cannot: nothing in this repo observes the producer, and a
    // CEE-side rename lands green here. Read it as a UI-side pin and nothing
    // more — the producer half needs a live capture or a CEE-side guard.
    //
    // The literal below is deliberately kept as DOCUMENTATION of the wire
    // spelling, and it is NOT the discriminating assertion: it compares a local
    // const to its own literal and can never fail. The two assertions after it
    // are the ones with teeth, because both derive their answer from the
    // SOURCE's `ADVISORY_BLOCKER_CODES` by running the gate.
    expect(ADVISORY_CODE).toBe('CONSTRAINT_REVIEW_REQUIRED')
    // The advisory code must NOT appear among the actionable ones — the two
    // sets are disjoint by construction, and a rename that collided them would
    // otherwise pass silently.
    expect(ACTIONABLE_CODES).not.toContain(ADVISORY_CODE as never)
    // And exactly ONE code is waived. A second entry appearing here without a
    // derivation at the producer is the hand-maintained mirror drifting.
    const waived = ACTIONABLE_CODES.filter(
      (c) => gate({ analysisReadiness: { status: 'ready', blockers: [blocker({ code: c })] } }).allowed,
    )
    expect(waived).toEqual([])
  })
})


// ═══════════════════════════════════════════════════════════════════════════
// ACCEPTANCE — THE SENTENCE DESCRIBES THE LIST THE GATE DECIDED ON.
//
// Finding 794-1. The gate counts only ACTIONABLE blockers; the refusal beneath
// it was composed from the RAW list. With one actionable blocker and one
// advisory one the product refused over the first and then named BOTH:
//
//   "Launch in Q1" and "Burn rate" are not ready for analysis yet.
//   Ask in the chat what they need.
//
// `Burn rate` is the blocker the gate has JUST RULED OUT. The user is sent to
// fix something that cannot open the run — and the file's own rule one line up
// says the reason comes from whichever authority decided. It did; it then
// described a different list than the decision was made on.
//
// ⚠ NOT A REGRESSION: the pre-#794 gate named both too, because it counted
// both. #794 is the change that made the two lists differ, so the sentence
// becomes its problem.
//
// THE PAIR IS THE EVIDENCE, and neither half alone is:
//  · MIXED asserts the ONE-blocker rung naming ONLY the actionable label.
//  · TWO-ACTIONABLE TWIN asserts the TWO-blocker rung naming BOTH. Without it,
//    "always compose from the first blocker" or "always emit the one-blocker
//    rung" would satisfy MIXED — the assertion would pass by naming FEWER
//    things rather than by naming the RIGHT things.
// Both bind by the label's IDENTITY through the copy factories, never by a
// substring another rung could satisfy.
// ═══════════════════════════════════════════════════════════════════════════

/** The actionable blocker AS CEE SHIPS IT, scoped to a quotable option. */
function actionableBlocker(overrides: Partial<AnalysisBlocker> = {}): AnalysisBlocker {
  return blocker({
    code: 'MISSING_OPTION_VALUE',
    category: 'option_values',
    message: 'Choose the missing effect value for "Launch in Q1".',
    repairability: 'human_input_required',
    option_id: 'opt_launch_q1',
    option_label: 'Launch in Q1',
    ...overrides,
  })
}

describe('the refusal names the blockers the gate actually decided on', () => {
  it('MIXED — one actionable + one advisory names ONLY the actionable one', () => {
    const result = gate({
      analysisReadiness: {
        status: 'needs_user_input',
        blockers: [actionableBlocker(), advisoryBlocker({ factor_label: 'Burn rate' })],
      },
    })

    // Precondition, pinned in-test: this payload must genuinely be the mixed
    // case, or the assertion below could pass because the fixture stopped
    // reproducing anything rather than because the code is right.
    expect(actionableBlockers([actionableBlocker(), advisoryBlocker()]).map((b) => b.code)).toEqual([
      'MISSING_OPTION_VALUE',
    ])

    expect(result.allowed).toBe(false)
    // Bound by IDENTITY through the factory: the one-blocker rung, quoting the
    // ACTIONABLE element's own label.
    expect(result.reason).toBe(BLOCKED_REASON_COPY.canonicalOneBlocker('Launch in Q1'))
    // And the advisory element is named NOWHERE — not in the primary sentence,
    // not in a `+N more` tail, not in any other blocking reason.
    expect(result.reason).not.toContain('Burn rate')
    for (const line of result.blockingReasons ?? []) {
      expect(line).not.toContain('Burn rate')
    }
  })

  it('TWO-ACTIONABLE TWIN — two actionable blockers still name BOTH', () => {
    // The discriminating partner. It REDs if the fix degrades to "name one
    // thing" or "name the first thing", which is how a narrowing assertion
    // passes for the wrong reason.
    const result = gate({
      analysisReadiness: {
        status: 'needs_user_input',
        blockers: [
          actionableBlocker(),
          actionableBlocker({
            code: 'AMBIGUOUS_OPTION_VALUE',
            option_id: 'opt_hold',
            option_label: 'Hold until Q3',
          }),
        ],
      },
    })

    expect(result.allowed).toBe(false)
    expect(result.reason).toBe(
      BLOCKED_REASON_COPY.canonicalTwoBlockers('Launch in Q1', 'Hold until Q3'),
    )
  })

  it('ADVISORY-ONLY ON A `blocked` STATUS degrades to the non-committal rung', () => {
    // The domain case the fix must not get wrong. Here the gate is closed by
    // clause (a) — the STATUS — and the actionable list is EMPTY, so there is
    // no blocker entitled to be named. The honest answer is the less-specific
    // TRUE rung, never the advisory element the status did not refuse over.
    const result = gate({
      analysisReadiness: {
        status: 'blocked',
        blockers: [advisoryBlocker({ factor_label: 'Burn rate' })],
      },
    })

    expect(result.allowed).toBe(false)
    expect(result.reason).toBe(BLOCKED_REASON_COPY.unspecified)
    expect(result.reason).not.toContain('Burn rate')
  })
})
