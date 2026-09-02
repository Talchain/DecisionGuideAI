/**
 * ⭐⭐ THE PRODUCER REFUSED AND ITEMISED NOTHING — AND THE PRODUCT SAID NOTHING.
 *
 * ⚠⚠ MEASURED AT DEPLOYED STAGING `3fdefbd3` (2 Sep 2026), by running this
 * repo's own gate against the payload the P0 witness captured.
 *
 * `WhyNoAnalysisYet`'s header records the witness: the primary Run affordance
 * fired `POST /bff/cee/graph-readiness`, which answered with
 * `can_run_analysis: false`, CEE's own written refusal in `blocker_reason`, and
 * five `readiness_issues` — and the user was shown NOTHING. #1140 forwarded both
 * fields through `readinessStore`'s keep-list and moved the producer rung above
 * the count rung, and on the SIDE-CAR branch that works: the sentence reaches
 * the screen (pinned below, so this spec also guards #1140).
 *
 * ⭐ IT DOES NOT REACH THE SCREEN ON THE OTHER BRANCH, AND THAT BRANCH IS
 * REACHABLE BY CONSTRUCTION. `canRunAnalysis` composes its sentence from
 * WHICHEVER AUTHORITY DECIDED, and once `analysisReadiness` is stated the
 * producer decides. `readinessObjectsToRun` clause (a) refuses on
 * `status === 'blocked'` ALONE — its own comment derives why, at CEE:
 * *"`buildAnalysisRefusalReadiness` emits `status: 'blocked'` with NO `blockers`
 * key, so on a refusal turn the list is `[]`"*. The sentence is then composed
 * from that same empty list, and `analysisBlockedSentences` returns the
 * non-committal `unspecified` rung for it.
 *
 * So on a CEE refusal turn the user reads *"Olumi needs something more from
 * this model before the next analysis. Ask in the chat and it will explain what
 * is missing."* — while the side-car holds a refusal WITH A ROUTE, already in
 * the store, unread.
 *
 * ⭐ TWO COMMENTS IN THIS CODEBASE CONTRADICT EACH OTHER ON EXACTLY THIS, WHICH
 * IS WHY IT WENT UNSEEN. `analysisBlockedSentences`' header says the empty list
 * *"MUST NEVER REACH HERE … the real protection is `readinessObjectsToRun`,
 * which never asks"*; `readinessObjectsToRun`'s clause (a) says it asks exactly
 * then, and must. The second is right, the first is a stale reassurance — and
 * the measurement below is what settles it rather than a third opinion.
 *
 * ── WHAT THE FIX MAY AND MAY NOT DO ────────────────────────────────────────
 * The side-car may CORROBORATE a refusal the producer made; it may never author
 * one. Every guard below is a case where the floor MUST be kept, and they are
 * not decoration — each is an opposite-direction twin of the repair:
 *
 *   · the side-car does not itself refuse    → its sentences are about another
 *                                              answer and cannot explain this one
 *   · the side-car verdict is STALE          → quoting an authority inherits its
 *                                              staleness (this module's I-3 rule)
 *   · `may_run === true`                     → CEE's affirmative branch; printing
 *                                              "can be analysed now" as the reason
 *                                              it cannot is the contradiction
 *                                              `producerAuthoredRefusal` exists
 *                                              to stop
 *   · the producer DID itemise blockers      → the deciding authority speaks for
 *                                              itself; the side-car is not consulted
 *
 * ── INV-P6, AND WHY THIS SPEC PINS BOTH DIRECTIONS ─────────────────────────
 * CEE's own source says *"A PANEL THAT IGNORES THIS FIELD REPRODUCES THE
 * DEFECT"* of `obligation`. On the witnessed model every issue was `offered` —
 * Olumi's own suggestions — so rendering the five as a task list would demand
 * the user fix values the product invented, which is the harm the refusal
 * names. The twin cases below are therefore NOT symmetric decoration: one
 * proves owed repairs APPEAR with their factor and option labels, the other
 * proves offered ones are NOT demanded and the headline stands in their place.
 */
import { describe, it, expect } from 'vitest'
import { canRunAnalysis, getRunButtonTooltip } from '../canRunAnalysis'
import { BLOCKED_REASON_COPY } from '../composeBlockedReason'
import type { GraphReadiness, ReadinessIssue } from '../../hooks/useGraphReadiness'

/** CEE's own adjudicated headline, verbatim from the witness. */
const BLOCKER_REASON =
  "This model can't be analysed yet. The values involved are Olumi's own suggestions, not yours — ask Olumi to work them through, or set them yourself."

function issue(n: number, obligation: 'required' | 'offered'): ReadinessIssue {
  return {
    message: `Factor "Factor ${n}" needs a numeric value for option "Option ${n}".`,
    code: 'MISSING_OPTION_VALUE',
    option_id: `opt_${n}`,
    option_label: `Option ${n}`,
    factor_id: `fac_${n}`,
    factor_label: `Factor ${n}`,
    obligation,
  }
}

const OFFERED_FIVE = [1, 2, 3, 4, 5].map((n) => issue(n, 'offered'))
const OWED_FIVE = [1, 2, 3, 4, 5].map((n) => issue(n, 'required'))

function sideCar(overrides: Partial<GraphReadiness> = {}): GraphReadiness {
  return {
    readiness_score: 40,
    // The three-member CEE vocabulary (`CEE_READINESS_LEVELS`); a fixture
    // outside it is not a payload this product can receive.
    readiness_level: 'needs_work',
    can_run_analysis: false,
    confidence_explanation: 'V3 analysis not ready',
    improvements: [],
    options_ready: 0,
    options_total: 5,
    goal_node_valid: true,
    may_run: false,
    blocker_reason: BLOCKER_REASON,
    readiness_issues: OFFERED_FIVE,
    ...overrides,
  }
}

/** The producer refusal turn: `status: 'blocked'`, and no blockers to itemise. */
const REFUSAL_TURN = { status: 'blocked', blockers: [] } as const
/** The same shape one step along: the only blocker present is advisory. */
const ADVISORY_ONLY = {
  status: 'blocked',
  blockers: [{ code: 'CONSTRAINT_REVIEW_REQUIRED', message: 'Review the dropped constraint.' }],
} as const

function gate(params: {
  readiness: GraphReadiness | null
  analysisReadiness?: unknown
  readinessStale?: boolean
}) {
  return canRunAnalysis({
    graphHealth: null,
    readiness: params.readiness,
    analysisReadiness: params.analysisReadiness as never,
    mayRun: false,
    hasBlockers: false,
    nodeCount: 12,
    isRunning: false,
    readinessStale: params.readinessStale ?? false,
  } as never)
}

const texts = (r: ReturnType<typeof gate>) => (r.blockedListing?.sentences ?? []).map((s) => s.text)

describe('canRunAnalysis — a producer refusal that itemises nothing', () => {
  // ── THE REPAIR ───────────────────────────────────────────────────────────
  it('names CEE’s own refusal instead of the non-committal rung on a refusal turn', () => {
    const result = gate({ readiness: sideCar(), analysisReadiness: REFUSAL_TURN })

    expect(result.allowed).toBe(false)
    expect(texts(result)).toEqual([BLOCKER_REASON])
    // Bound to the DEFECT, not merely to the repair: the floor must be gone.
    expect(texts(result)).not.toContain(BLOCKED_REASON_COPY.unspecified)
    // The summary and the list come from one computation — the provenance check
    // in `vettedBlockerList` drops the whole list if these two disagree, so a
    // fix that repaired only the sentences would still render nothing.
    expect(result.blockedListing?.summary).toBe(BLOCKER_REASON)
    expect(getRunButtonTooltip(result)).toBe(BLOCKER_REASON)
  })

  it('does the same when the only stated blocker is advisory', () => {
    const result = gate({ readiness: sideCar(), analysisReadiness: ADVISORY_ONLY })
    expect(texts(result)).toEqual([BLOCKER_REASON])
  })

  // ── INV-P6, DIRECTION 1: owed repairs APPEAR, with their scopes ───────────
  it('names every OWED repair, each routed to the option that owes it', () => {
    const result = gate({
      readiness: sideCar({ readiness_issues: OWED_FIVE }),
      analysisReadiness: REFUSAL_TURN,
    })

    expect(texts(result)).toEqual(OWED_FIVE.map((i) => i.message))
    // Bound BY IDENTITY, not by a value predicate another line could satisfy.
    expect(result.blockedListing?.sentences.map((s) => s.scope?.id)).toEqual([
      'opt_1',
      'opt_2',
      'opt_3',
      'opt_4',
      'opt_5',
    ])
    expect(result.blockedListing?.sentences.map((s) => s.scope?.label)).toEqual([
      'Option 1',
      'Option 2',
      'Option 3',
      'Option 4',
      'Option 5',
    ])
  })

  // ── INV-P6, DIRECTION 2: offered ones are NOT demanded ────────────────────
  it('demands none of the OFFERED repairs, and lets the headline stand for them', () => {
    const result = gate({ readiness: sideCar(), analysisReadiness: REFUSAL_TURN })

    for (const offered of OFFERED_FIVE) {
      expect(texts(result)).not.toContain(offered.message)
    }
    expect(texts(result)).toHaveLength(1)
  })

  it('demands none of the repairs waived by exclusion', () => {
    const waived = OWED_FIVE.map((i) => ({ ...i, waived_by_exclusion: true }))
    const result = gate({
      readiness: sideCar({ readiness_issues: waived }),
      analysisReadiness: REFUSAL_TURN,
    })
    for (const w of waived) expect(texts(result)).not.toContain(w.message)
    expect(texts(result)).toEqual([BLOCKER_REASON])
  })

  // ── THE FLOOR IS KEPT: four opposite-direction guards ─────────────────────
  it('keeps the floor when the side-car does not itself refuse', () => {
    const result = gate({
      readiness: sideCar({ can_run_analysis: true }),
      analysisReadiness: REFUSAL_TURN,
    })
    expect(texts(result)).toEqual([BLOCKED_REASON_COPY.unspecified])
  })

  it('keeps the floor when the side-car verdict is stale', () => {
    const result = gate({
      readiness: sideCar(),
      analysisReadiness: REFUSAL_TURN,
      readinessStale: true,
    })
    expect(texts(result)).toEqual([BLOCKED_REASON_COPY.unspecified])
  })

  it('keeps the floor when CEE’s admission verdict is affirmative', () => {
    // `may_run === true` is CEE's `willProceed`, whose sentence is "This model
    // CAN be analysed now" — printing it as the reason the run is refused is the
    // founder-witnessed contradiction, so the floor is the honest answer.
    const result = gate({
      readiness: sideCar({ may_run: true }),
      analysisReadiness: REFUSAL_TURN,
    })
    expect(texts(result)).toEqual([BLOCKED_REASON_COPY.unspecified])
  })

  it('keeps the floor when the side-car carries no refusal of its own', () => {
    const result = gate({
      readiness: sideCar({ blocker_reason: undefined, readiness_issues: undefined }),
      analysisReadiness: REFUSAL_TURN,
    })
    expect(texts(result)).toEqual([BLOCKED_REASON_COPY.unspecified])
  })

  it('never consults the side-car when the producer itemised its own blockers', () => {
    const result = gate({
      readiness: sideCar(),
      analysisReadiness: {
        status: 'needs_user_input',
        blockers: [{ code: 'MISSING_OPTION_VALUE', message: 'Choose the missing effect value.' }],
      },
    })
    expect(texts(result)).toEqual(['Choose the missing effect value.'])
    expect(texts(result)).not.toContain(BLOCKER_REASON)
  })

  // ── #1140's OWN GUARANTEE, PINNED HERE TOO ───────────────────────────────
  it('still names the refusal on the side-car branch (guards #1140)', () => {
    const result = gate({ readiness: sideCar(), analysisReadiness: null })
    expect(texts(result)).toEqual([BLOCKER_REASON])
  })
})
