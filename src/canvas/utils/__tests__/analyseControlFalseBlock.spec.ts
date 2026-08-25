/**
 * THE ANALYSE CONTROL IS DISABLED ON A MODEL CEE WOULD ANALYSE THIS INSTANT,
 * WHILE THE CHAT SIMULTANEOUSLY OFFERS A LIVE "Run analysis" CHIP.
 *
 * ── THE DEFECT THIS PINS (derived at both producers, 25 Aug 2026) ───────────
 * CEE's `resolveRunAdmission` waives three blocker codes by EXCLUDING the
 * incomplete option and running on the rest:
 *
 *   WAIVABLE_BY_EXCLUSION = { MISSING_OPTION_VALUE,
 *                             OPTION_NEEDS_ENCODING,
 *                             OPTION_NEEDS_MAPPING }
 *   (cee `orchestrator-v5/tools/handlers/analysis-ready-core.ts:378-382`)
 *
 * On such a turn CEE emits `status: 'needs_user_input'` AND `may_run: true`.
 * Its own comment says so, at the payload builder, citing a measured capture:
 *
 *   "Measured on the `live-4day-week` capture: one unconfigured option gives
 *    `status: needs_user_input, willProceed: TRUE`, while two and three give
 *    `needs_user_input, willProceed: false` — one status, both verdicts, which
 *    is exactly why no reading of `status` can recover the answer."
 *   (cee `orchestrator/tools/analysis-ready-helper.ts:1190-1194`)
 *
 * Those waived codes are `option_values` / `option_mapping`, so `hardBlocked`
 * is false and the status is NOT `'blocked'`. The blockers themselves still
 * ride the wire — `analysis-state-v1.ts` maps `input.readiness.blockers`
 * straight through — and the UI's advisory set is a single member
 * (`CONSTRAINT_REVIEW_REQUIRED`), so every one of them is ACTIONABLE here.
 *
 * `readinessObjectsToRun` therefore counts them and REFUSES, while
 * `SuggestedChips.tsx:267` renders the "Run analysis" chip on
 * `admitsRunAffordance(status, may_run)` — which the same payload satisfies.
 * Two Olumi affordances contradict each other on one screen: the chat offers
 * the run, the panel says the model is not ready for it.
 *
 * ── WHY THE UI CANNOT SEE THE WAIVER ANY OTHER WAY ──────────────────────────
 * CEE stamps `waived_by_exclusion: true` on the waived issue. `@talchain/schemas`
 * 0.48.0 types `AnalysisBlockerSchema` as `.strict()` with exactly eight fields,
 * and `waived_by_exclusion` is not one of them; `AnalysisReadinessSchema` is
 * `.strict()` with exactly `{status, blockers}` and carries no `may_run`. So the
 * authority object the gate is handed CANNOT carry the waiver, and `may_run`
 * must arrive as its own value off the `analysis_ready` slice — which is
 * precisely where `useAnalysisMayRun()` already reads it.
 *
 * ── THE FIX THIS FILE SPECIFIES ─────────────────────────────────────────────
 * `readinessObjectsToRun` gains a third argument, `mayRun`, and the ACTIONABLE
 * BLOCKER clause alone becomes waivable by it:
 *
 *   status === 'blocked' || (actionableBlockers(...).length > 0 && mayRun !== true)
 *
 * ⭐⭐ THE `blocked` CLAUSE IS DELIBERATELY *NOT* WAIVABLE, AND THIS IS THE
 * LOAD-BEARING CORRECTION. The obvious shape — `(A || B) && mayRun !== true` —
 * re-opens a defect that clause was written to close, because `may_run` CAN GO
 * STALE ACROSS A REFUSAL TURN:
 *
 *   · `buildAnalysisRefusalReadiness` (cee `analysis-ready-helper.ts:1478-1493`)
 *     emits `{status: 'blocked', blocked_reason, options: [], goal_node_id: ''}`
 *     and sets NO `may_run` — the field is written in exactly one place,
 *     `buildCanonicalAnalysisReadyFromGraph:1221`.
 *   · That degenerate payload is REJECTED by the UI's own normaliser
 *     (`applyV5State.ts:233-234`), and `applyV5State.ts:1219` only writes the
 *     slice `if (normalised)` — so `ceeAnalysisReady` KEEPS ITS PREVIOUS VALUE,
 *     stale `may_run: true` included, while `analysisStateV1` moves to blocked.
 *
 * A waiver spanning both clauses would then hand the user an ENABLED Analyse
 * control one turn after CEE refused the run — which is, verbatim, the harm
 * `canRunAnalysis.ts:457-460` records the `blocked` clause as existing to
 * prevent: "the Analyse control would turn ENABLED one turn after CEE refused
 * the run. The user clicks, and is refused again."
 *
 * ── AND CLAUSE (a) DOES NOT CARRY THE FALSE-BLOCK ANYWAY: A PROOF ───────────
 * The question was put directly — can CEE emit `status: 'blocked'` on a turn
 * where `resolveRunAdmission` returned `willProceed: true`? Derived at CEE
 * `4a064e60`, read-only. **It cannot.** `may_run` and `status` are taken from
 * ONE assessment in ONE expression (`analysis-ready-helper.ts:1218-1221`:
 * `payload = admission.assessment.analysisReady`, `may_run =
 * admission.willProceed`), so the two can only be paired as that assessment
 * produced them. Inside the assessor `status: 'blocked'` has exactly two
 * writers (`:1130` and `:1136`), and there are exactly two `willProceed: true`
 * returns (`analysis-ready-core.ts:493` and `:562`):
 *
 *   · `:493` fires when `strict.status !== 'unrecoverable'`, which by
 *     `readinessResultFrom:148` means `assessment.safeToAnalyse === true`,
 *     which by `analysis-ready-helper.ts:1144` is DEFINED as
 *     `blockingIssues.length === 0 && analysisReady.status === 'ready'`.
 *     The status is therefore `'ready'` by construction.
 *   · `:562` fires only when every blocking issue is waivable by exclusion
 *     (`:538`), i.e. every code is one of the three, i.e. every category is
 *     `option_values` / `option_mapping`. Writer 1 (`:1130`) needs
 *     `hardBlocked` — some issue in `graph_structure` / `numeric_integrity` /
 *     `internal` — and those category sets are DISJOINT, so it cannot fire.
 *     Writer 2 (`:1136`) needs `!semantic`, but this path already asserted
 *     `wireOptions.length > 0` at `:500-503`, so it cannot fire either.
 *
 * `status: 'blocked'` and `may_run: true` are therefore MUTUALLY EXCLUSIVE on
 * any single payload. Guarding clause (a) with `mayRun` would be a no-op on a
 * same-turn payload — and, on a cross-turn STALE one, actively harmful for the
 * reason above. A4-5 pins that boundary in the only direction the UI can see.
 *
 * ── WHAT EACH TEST BELOW IS FOR ─────────────────────────────────────────────
 * The suite fails in BOTH directions, because a gate guards two opposite harms:
 *   · A4-1 / A4-2 RED at pristine — the false block, and the two affordances
 *     disagreeing on one payload. They are the reason this lane exists.
 *   · A4-3 / A4-4 are GREEN at pristine and MUST STAY GREEN — absent or false
 *     `may_run` must leave today's refusal byte-identical, sentence included.
 *   · A4-5 is GREEN at pristine and MUST STAY GREEN — it is the guard against
 *     the `(A || B) && mayRun !== true` shape, and it REDs under it.
 *   · A4-6 is the CONTRAST CONTROL: green at pristine, proving this file is
 *     bound to the real gate and is not vacuous (trap 13e).
 */

import { describe, it, expect } from 'vitest'
import type { AnalysisBlocker, AnalysisStateV1 } from '@talchain/schemas/boundary'

import {
  actionableBlockers,
  canRunAnalysis,
  readinessObjectsToRun,
  type CanRunAnalysisParams,
} from '../canRunAnalysis'
import { selectAnalysisReadinessAuthority } from '../../state/analysisStateSelector'
import { admitsRunAffordance } from '../../hooks/useAnalysisReady'
import type { GraphReadiness } from '../../hooks/useGraphReadiness'

// ───────────────────────────────────────────────────────────────────────────
// Fixtures — every field DERIVED FROM THE PRODUCER, not invented.
//
// `MISSING_OPTION_VALUE` carries `category: 'option_values'`, the message
// `Choose the missing effect value${suffix}.` and
// `repairability: 'human_input_required'`, all read at CEE
// `orchestrator/tools/analysis-ready-helper.ts:714-720` (+ `:947` for the
// repairability on the same `common` spread).
// ───────────────────────────────────────────────────────────────────────────

/** The option the user left open, named once so every assertion binds to IT. */
const WAIVED_OPTION_ID = 'opt_hire_contractor'
const WAIVED_OPTION_LABEL = 'Hire a contractor'

/** A SECOND, DIFFERENT option — the discriminating partner for identity tests. */
const OTHER_OPTION_ID = 'opt_do_nothing'
const OTHER_OPTION_LABEL = 'Do nothing'

function missingValueBlocker(
  optionId: string,
  optionLabel: string,
): AnalysisBlocker {
  return {
    code: 'MISSING_OPTION_VALUE',
    category: 'option_values',
    message: `Choose the missing effect value for "${optionLabel}".`,
    repairability: 'human_input_required',
    option_id: optionId,
    option_label: optionLabel,
  }
}

/**
 * The single member of the UI's advisory set
 * (`canRunAnalysis.ts:391` — `ADVISORY_BLOCKER_CODES`). Used ONLY by the
 * contrast control, which must stay green with no `may_run` in play at all.
 */
const ADVISORY_BLOCKER: AnalysisBlocker = {
  code: 'CONSTRAINT_REVIEW_REQUIRED',
  category: 'option_values',
  message: 'Confirm the constraint that was dropped.',
  repairability: 'human_input_required',
}

/**
 * The side-car verdict, field-for-field the one `readinessStore` composes and
 * RETAINS on its empty-canvas arm. It OBJECTS — so any test whose gate opens
 * proves the producer branch decided, never this.
 */
const SIDE_CAR_OBJECTS: GraphReadiness = {
  readiness_score: 0,
  readiness_level: 'needs_work',
  can_run_analysis: false,
  confidence_explanation: 'Add some nodes to get started',
  improvements: [],
}

/**
 * A full `AnalysisStateV1` as the wire carries it, so every case travels
 * through `selectAnalysisReadinessAuthority` — THE REAL SEAM — rather than
 * hand-building the authority object the gate happens to accept.
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
 * ⭐ THE PAYOFF TURN, as CEE emits it: `needs_user_input` (NOT `blocked`) with
 * one waivable blocker naming ONE option, on a graph the run will admit by
 * leaving that option out.
 */
const PAYOFF_TURN_AUTHORITY = selectAnalysisReadinessAuthority(
  wireState({
    status: 'needs_user_input',
    blockers: [missingValueBlocker(WAIVED_OPTION_ID, WAIVED_OPTION_LABEL)],
  }),
)

/** A refusal turn: the producer's hard stop. */
const REFUSED_TURN_AUTHORITY = selectAnalysisReadinessAuthority(
  wireState({ status: 'blocked', blockers: [] }),
)

/**
 * The gate as the deployed canvas calls it: a real model on screen, nothing
 * held, nothing streaming, no validation issues. Only the readiness inputs and
 * `mayRun` vary, so any difference in the verdict is attributable to them.
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
// A4-1 — THE FALSE BLOCK. RED at pristine.
// ═══════════════════════════════════════════════════════════════════════════

describe('A4-1 — CEE will run this graph now, so the Analyse control is ENABLED', () => {
  it('opens the gate when may_run is true despite a waivable actionable blocker', () => {
    expect(
      readinessObjectsToRun(SIDE_CAR_OBJECTS, PAYOFF_TURN_AUTHORITY, true),
    ).toBe(false)
  })

  it('threads may_run through canRunAnalysis itself, not only the predicate', () => {
    const result = gate({ analysisReadiness: PAYOFF_TURN_AUTHORITY, mayRun: true })

    expect(result.allowed).toBe(true)
    // An open gate makes NO refusal at all — not a softer one.
    expect(result.reason).toBeUndefined()
    expect(result.blockingReasons ?? []).toEqual([])
  })

  it('stops naming the waived option as the thing standing in the way', () => {
    const result = gate({ analysisReadiness: PAYOFF_TURN_AUTHORITY, mayRun: true })

    // ⭐ BOUND BY IDENTITY: the LABEL of the specific option CEE is excluding,
    // not a value predicate a different option could satisfy. Under the defect
    // this string is exactly what the disabled control's title carried.
    expect(JSON.stringify(result)).not.toContain(WAIVED_OPTION_LABEL)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// A4-2 — THE TWO AFFORDANCES AGREE. RED at pristine.
// ═══════════════════════════════════════════════════════════════════════════

describe('A4-2 — the chat chip and the Analyse control cannot contradict each other', () => {
  it('agrees with admitsRunAffordance on the exact payload that splits them today', () => {
    const chipIsOffered = admitsRunAffordance('needs_user_input', true)
    const controlIsEnabled = !readinessObjectsToRun(
      SIDE_CAR_OBJECTS,
      PAYOFF_TURN_AUTHORITY,
      true,
    )

    // The chip renders today — that half is already shipped and must not move.
    expect(chipIsOffered).toBe(true)
    // …and the control must reach the SAME verdict from the SAME two facts.
    expect(controlIsEnabled).toBe(chipIsOffered)
  })

  it('still agrees when neither affordance is admitted', () => {
    const chipIsOffered = admitsRunAffordance('needs_user_input', false)
    const controlIsEnabled = !readinessObjectsToRun(
      SIDE_CAR_OBJECTS,
      PAYOFF_TURN_AUTHORITY,
      false,
    )

    expect(chipIsOffered).toBe(false)
    expect(controlIsEnabled).toBe(chipIsOffered)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// A4-3 / A4-4 — THE OTHER DOOR. GREEN at pristine, and MUST STAY GREEN.
//
// A widening that changed anything when the producer did NOT say `may_run`
// would trade one silent failure for its inverse. `undefined` is a pre-`may_run`
// CEE and MUST behave byte-identically to today — sentence included.
// ═══════════════════════════════════════════════════════════════════════════

describe('A4-3 — an absent may_run leaves today’s refusal byte-identical', () => {
  it('still refuses when may_run is undefined', () => {
    expect(
      readinessObjectsToRun(SIDE_CAR_OBJECTS, PAYOFF_TURN_AUTHORITY, undefined),
    ).toBe(true)
  })

  it('refuses identically whether the argument is omitted or passed as undefined', () => {
    expect(readinessObjectsToRun(SIDE_CAR_OBJECTS, PAYOFF_TURN_AUTHORITY)).toBe(
      readinessObjectsToRun(SIDE_CAR_OBJECTS, PAYOFF_TURN_AUTHORITY, undefined),
    )
  })

  it('still explains the refusal with the producer’s own sentence for THAT option', () => {
    const withoutMayRun = gate({ analysisReadiness: PAYOFF_TURN_AUTHORITY })
    const omittedEntirely = gate({
      analysisReadiness: PAYOFF_TURN_AUTHORITY,
      mayRun: undefined,
    })

    expect(withoutMayRun.allowed).toBe(false)
    // ⭐ IDENTITY: the producer's verbatim sentence naming the specific option.
    expect(withoutMayRun.reason).toContain(WAIVED_OPTION_LABEL)
    // Byte-identical, not merely "also refused".
    expect(omittedEntirely).toEqual(withoutMayRun)
  })
})

describe('A4-4 — an explicit may_run:false leaves today’s refusal byte-identical', () => {
  it('still refuses when the producer says the run will not proceed', () => {
    expect(
      readinessObjectsToRun(SIDE_CAR_OBJECTS, PAYOFF_TURN_AUTHORITY, false),
    ).toBe(true)
  })

  it('produces the same gate result as the pre-may_run path', () => {
    const withFalse = gate({ analysisReadiness: PAYOFF_TURN_AUTHORITY, mayRun: false })
    const withoutIt = gate({ analysisReadiness: PAYOFF_TURN_AUTHORITY })

    expect(withFalse.allowed).toBe(false)
    expect(withFalse).toEqual(withoutIt)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// A4-5 ⭐⭐ THE CORRECTION — A REFUSAL IS NOT WAIVABLE BY A STALE `may_run`.
//
// GREEN at pristine (the argument is ignored there) and MUST STAY GREEN. It
// REDs under the `(A || B) && mayRun !== true` shape, which is the whole reason
// it is written down.
// ═══════════════════════════════════════════════════════════════════════════

describe('A4-5 — status:blocked keeps refusing even when may_run says true', () => {
  it('does not let a stale may_run re-enable the control after a refusal turn', () => {
    // The store state one turn after CEE refused: the authority has moved to
    // `blocked`, while `ceeAnalysisReady` still holds the PREVIOUS turn's
    // `may_run: true` because the degenerate refusal payload was discarded by
    // `normaliseV5AnalysisReady` and the slice was never rewritten.
    expect(
      readinessObjectsToRun(SIDE_CAR_OBJECTS, REFUSED_TURN_AUTHORITY, true),
    ).toBe(true)
  })

  it('keeps the gate shut through canRunAnalysis on that same state', () => {
    const result = gate({ analysisReadiness: REFUSED_TURN_AUTHORITY, mayRun: true })

    expect(result.allowed).toBe(false)
  })

  it('refuses a blocked status carrying a waivable blocker too', () => {
    // Belt and braces: `blocked` must dominate the waiver even when the list
    // happens to hold a code the exclusion could otherwise answer.
    const blockedWithWaivable = selectAnalysisReadinessAuthority(
      wireState({
        status: 'blocked',
        blockers: [missingValueBlocker(WAIVED_OPTION_ID, WAIVED_OPTION_LABEL)],
      }),
    )

    expect(readinessObjectsToRun(SIDE_CAR_OBJECTS, blockedWithWaivable, true)).toBe(
      true,
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// A4-6 — CONTRAST CONTROL. Green at pristine, green after, and it proves this
// file is bound to the REAL gate rather than passing vacuously.
// ═══════════════════════════════════════════════════════════════════════════

describe('A4-6 — contrast control: the untouched paths still behave as they did', () => {
  it('an advisory-only blocker list never blocked, and still does not', () => {
    const advisoryOnly = selectAnalysisReadinessAuthority(
      wireState({ status: 'ready', blockers: [ADVISORY_BLOCKER] }),
    )

    // No `may_run` anywhere in this case — if it were load-bearing here, the
    // widening would have reached a path it had no business touching.
    expect(readinessObjectsToRun(SIDE_CAR_OBJECTS, advisoryOnly)).toBe(false)
    expect(actionableBlockers(advisoryOnly!.blockers)).toEqual([])
  })

  it('the actionable filter still sees the waivable code as actionable', () => {
    // The waiver lives in the GATE, not in the filter: the blocker is real and
    // is still itemised for any surface that lists impediments. Moving the fix
    // into `actionableBlockers` would silently delete it from those lists.
    expect(actionableBlockers(PAYOFF_TURN_AUTHORITY!.blockers)).toHaveLength(1)
    expect(actionableBlockers(PAYOFF_TURN_AUTHORITY!.blockers)[0]!.option_id).toBe(
      WAIVED_OPTION_ID,
    )
  })

  it('the side-car branch is untouched when no producer verdict exists', () => {
    // `mayRun` must not reach the side-car fallback: that branch answers a
    // different question, from a different authority, and CEE's admission
    // verdict says nothing about it.
    expect(readinessObjectsToRun(SIDE_CAR_OBJECTS, null, true)).toBe(true)
    expect(readinessObjectsToRun(SIDE_CAR_OBJECTS, undefined, true)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// A4-7 — IDENTITY BINDING, proved by a DIFFERENT object in the same shape.
// ═══════════════════════════════════════════════════════════════════════════

describe('A4-7 — the verdict follows the blocker list, not the fixture’s shape', () => {
  it('opens on a two-blocker list only because may_run says the run proceeds', () => {
    const twoOpenOptions = selectAnalysisReadinessAuthority(
      wireState({
        status: 'needs_user_input',
        blockers: [
          missingValueBlocker(WAIVED_OPTION_ID, WAIVED_OPTION_LABEL),
          missingValueBlocker(OTHER_OPTION_ID, OTHER_OPTION_LABEL),
        ],
      }),
    )

    // CEE declines two open options (`willProceed: false` on the measured
    // capture) — and with `may_run: false` the control must agree.
    expect(readinessObjectsToRun(SIDE_CAR_OBJECTS, twoOpenOptions, false)).toBe(true)
    // The SAME list opens when — and only when — the producer admits the run.
    expect(readinessObjectsToRun(SIDE_CAR_OBJECTS, twoOpenOptions, true)).toBe(false)
  })

  it('names the other option when the other option is the one blocking', () => {
    const otherOnly = selectAnalysisReadinessAuthority(
      wireState({
        status: 'needs_user_input',
        blockers: [missingValueBlocker(OTHER_OPTION_ID, OTHER_OPTION_LABEL)],
      }),
    )
    const result = gate({ analysisReadiness: otherOnly })

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain(OTHER_OPTION_LABEL)
    expect(result.reason).not.toContain(WAIVED_OPTION_LABEL)
  })
})
