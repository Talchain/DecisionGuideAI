/**
 * ⭐⭐ THE PANEL HELD SIX NAMED REMEDIES AND SENT THE USER TO THE CHAT.
 *
 * ── THE GAP, DERIVED AT `origin/staging` c5b5e86a ─────────────────────────
 * `canRunAnalysis` composes its blocked sentence from WHICHEVER AUTHORITY
 * DECIDED. Once `analysisReadiness` is stated the producer decides, and the
 * expression is:
 *
 *   producerBlockers !== null
 *     ? (corroboration ?? analysisBlockedItems(producerBlockers))
 *     : [{ text: composeReadinessBlockedReason(...) }]
 *
 * `composeReadinessBlockedReason` — the SIDE-CAR arm — already reads
 * `readiness.improvements` (its rung 4, and its skew path), pinned by
 * `blockedReasonNamesImprovements.spec.ts`. **The producer arm never does.**
 * `corroboration` reads `readiness_issues` and `blocker_reason` only, and
 * `analysisBlockedItems([])` returns `BLOCKED_REASON_COPY.unspecified` —
 * *"Olumi needs something more from this model before the next analysis. Ask in
 * the chat and it will explain what is missing."*
 *
 * So on the deployed Run chip's own refusal turn the user is sent to the chat
 * while the producer's named remedies sit in `readinessStore`, unread.
 *
 * ── WHY THAT STATE IS REACHABLE, NOT DEFENSIVE ────────────────────────────
 *   · `producerBlockers.length === 0` is the MEASURED behaviour of the button
 *     the P0 witness pressed — `canRunAnalysis.ts`'s own re-derivation at CEE
 *     `c110c5e3` records `buildAnalysisRefusalReadiness` emitting
 *     `status: 'blocked'` with `blockers` ABSENT from all three exits.
 *   · `readinessAuthoredRefusalItems` returns `null` on a branch that same file
 *     derives at CEE `3575b189`: `may_run === true` with `can_run_analysis`
 *     false — CEE's affirmative scaffold branch, where quoting `blocker_reason`
 *     would print "This model can be analysed now" as the reason it cannot.
 *     That guard is correct and stays; it is also the door to this floor.
 *   · `readiness.improvements` is populated on exactly these turns since
 *     #1503, which normalises `/bff/cee/graph-readiness`'s `quality_factors`
 *     (filtered on a non-empty `recommendation`) into that field.
 *
 * ── WHAT THIS CHANGE MAY NOT DO ───────────────────────────────────────────
 * The side-car may CORROBORATE a refusal the producer made; it may never AUTHOR
 * one. The improvements arm therefore inherits the corroboration gate
 * UNCHANGED — the producer must have itemised nothing, the side-car must itself
 * be refusing, and its verdict must not be stale. Every floor case below is an
 * opposite-direction twin of the repair, not decoration: each is a state where
 * the non-committal rung MUST survive.
 *
 * ⚠ ORDER. `readinessAuthoredRefusalItems` still wins. Owed repairs and CEE's
 * adjudicated headline are the side-car's refusal; improvements are the step
 * before giving up — the same ordering `composeReadinessBlockedReason` already
 * applies between its rung 0 and its rung 4.
 */
import { describe, it, expect } from 'vitest'
import { canRunAnalysis, getRunButtonTooltip } from '../canRunAnalysis'
import { BLOCKED_REASON_COPY } from '../composeBlockedReason'
import { IMPROVEMENT_ACTION_PLACEHOLDER } from '../improvementActionPlaceholder'
import type {
  GraphReadiness,
  GraphImprovement,
  ReadinessIssue,
} from '../../hooks/useGraphReadiness'

/**
 * Two of the six `quality_factors` recommendations from the witnessed payload,
 * as `readinessStore` normalises them. Verbatim producer prose — nothing here
 * is this repo's wording.
 */
const ACTION_A = 'Set an effect value for "Cash Burn Rate" on "Pilot".'
const ACTION_B = 'Give "Regional rollout" a time horizon so the two can be compared.'

function improvement(action: string, over: Partial<GraphImprovement> = {}): GraphImprovement {
  return {
    category: 'general',
    action,
    current_gap: '',
    quality_impact: 5,
    target_quality: 70,
    priority: 'medium',
    effort_minutes: 5,
    ...over,
  }
}

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

/**
 * The side-car on CEE's affirmative scaffold branch: it refuses
 * (`can_run_analysis: false`) while `may_run` is true, so
 * `readinessAuthoredRefusalItems` correctly declines to quote `blocker_reason`
 * — and the improvements are all that is left to say.
 */
function sideCar(overrides: Partial<GraphReadiness> = {}): GraphReadiness {
  return {
    readiness_score: 40,
    readiness_level: 'needs_work',
    can_run_analysis: false,
    confidence_explanation: 'V3 analysis not ready',
    improvements: [improvement(ACTION_A), improvement(ACTION_B)],
    options_ready: 0,
    options_total: 5,
    goal_node_valid: true,
    may_run: true,
    blocker_reason: "This model can be analysed now. Some values are Olumi's suggestions.",
    readiness_issues: [],
    ...overrides,
  }
}

/** The producer refusal turn: `status: 'blocked'`, and no blockers to itemise. */
const REFUSAL_TURN = { status: 'blocked', blockers: [] } as const

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

describe('canRunAnalysis — the producer arm names the remedies it already holds', () => {
  // ── THE REPAIR ───────────────────────────────────────────────────────────
  it('names the producer’s own improvements instead of sending the user to the chat', () => {
    const result = gate({ readiness: sideCar(), analysisReadiness: REFUSAL_TURN })

    expect(result.allowed).toBe(false)
    // Bound by IDENTITY to the exact producer sentences, never to a substring
    // another line could satisfy.
    expect(texts(result)).toEqual([ACTION_A, ACTION_B])
    // Bound to the DEFECT, not merely to the repair: the floor must be gone.
    expect(texts(result)).not.toContain(BLOCKED_REASON_COPY.unspecified)
    // The summary, the tooltip and the list come from ONE computation — a fix
    // that repaired only the sentences would still render the old string on the
    // two surfaces that consume the join.
    expect(result.blockedListing?.summary).toBe(`${ACTION_A} ${ACTION_B}`)
    expect(getRunButtonTooltip(result)).toBe(`${ACTION_A} ${ACTION_B}`)
  })

  it('names them when the side-car carries no headline at all', () => {
    const result = gate({
      readiness: sideCar({ may_run: false, blocker_reason: undefined }),
      analysisReadiness: REFUSAL_TURN,
    })
    expect(texts(result)).toEqual([ACTION_A, ACTION_B])
  })

  it('routes a remedy to the single node it names, so the line is an act', () => {
    const result = gate({
      readiness: sideCar({
        improvements: [improvement(ACTION_A, { affected_nodes: ['opt_pilot'] })],
      }),
      analysisReadiness: REFUSAL_TURN,
    })
    expect(texts(result)).toEqual([ACTION_A])
    expect(result.blockedListing?.sentences.map((s) => s.scope?.id)).toEqual(['opt_pilot'])
  })

  it('gives NO scope when a remedy names several nodes — a link to an arbitrary one is worse than none', () => {
    const result = gate({
      readiness: sideCar({
        improvements: [improvement(ACTION_A, { affected_nodes: ['opt_pilot', 'opt_rollout'] })],
      }),
      analysisReadiness: REFUSAL_TURN,
    })
    expect(texts(result)).toEqual([ACTION_A])
    expect(result.blockedListing?.sentences[0]?.scope).toBeUndefined()
  })

  // ── ORDER: the side-car's REFUSAL still outranks its coaching ─────────────
  it('prefers the owed repairs over the improvements when both are present', () => {
    const owed = [1, 2].map((n) => issue(n, 'required'))
    const result = gate({
      readiness: sideCar({ readiness_issues: owed, may_run: false }),
      analysisReadiness: REFUSAL_TURN,
    })
    expect(texts(result)).toEqual(owed.map((i) => i.message))
    expect(texts(result)).not.toContain(ACTION_A)
  })

  it('prefers CEE’s adjudicated headline over the improvements', () => {
    const HEADLINE = "This model can't be analysed yet. Set the values yourself, or ask Olumi to."
    const result = gate({
      readiness: sideCar({ may_run: false, blocker_reason: HEADLINE }),
      analysisReadiness: REFUSAL_TURN,
    })
    expect(texts(result)).toEqual([HEADLINE])
    expect(texts(result)).not.toContain(ACTION_A)
  })

  // ── THE FLOORS — each an opposite-direction twin of the repair ────────────
  it('FLOOR — a STALE verdict is never quoted, improvements included', () => {
    const result = gate({
      readiness: sideCar(),
      analysisReadiness: REFUSAL_TURN,
      readinessStale: true,
    })
    expect(texts(result)).toEqual([BLOCKED_REASON_COPY.unspecified])
    expect(texts(result)).not.toContain(ACTION_A)
  })

  it('FLOOR — a side-car that is NOT refusing may not explain a refusal it did not make', () => {
    const result = gate({
      readiness: sideCar({ can_run_analysis: true }),
      analysisReadiness: REFUSAL_TURN,
    })
    expect(texts(result)).toEqual([BLOCKED_REASON_COPY.unspecified])
    expect(texts(result)).not.toContain(ACTION_A)
  })

  it('FLOOR — when the producer DID itemise, the deciding authority speaks for itself', () => {
    const MESSAGE = 'Choose the missing effect value for "Cash Burn Rate" on "Pilot".'
    const result = gate({
      readiness: sideCar(),
      analysisReadiness: {
        status: 'blocked',
        blockers: [{ code: 'MISSING_OPTION_VALUE', message: MESSAGE }],
      },
    })
    expect(texts(result)).toEqual([MESSAGE])
    expect(texts(result)).not.toContain(ACTION_A)
  })

  it('FLOOR — the store’s SYNTHESISED action is a fabrication, not producer prose', () => {
    const result = gate({
      readiness: sideCar({ improvements: [improvement(IMPROVEMENT_ACTION_PLACEHOLDER)] }),
      analysisReadiness: REFUSAL_TURN,
    })
    expect(texts(result)).toEqual([BLOCKED_REASON_COPY.unspecified])
    expect(texts(result)).not.toContain(IMPROVEMENT_ACTION_PLACEHOLDER)
  })

  it('FLOOR — one fabricated entry degrades the WHOLE list, never a partial one', () => {
    const result = gate({
      readiness: sideCar({
        improvements: [improvement(ACTION_A), improvement(IMPROVEMENT_ACTION_PLACEHOLDER)],
      }),
      analysisReadiness: REFUSAL_TURN,
    })
    expect(texts(result)).toEqual([BLOCKED_REASON_COPY.unspecified])
  })

  it('FLOOR — no improvements to name leaves the honest non-committal rung', () => {
    const result = gate({
      readiness: sideCar({ improvements: [] }),
      analysisReadiness: REFUSAL_TURN,
    })
    expect(texts(result)).toEqual([BLOCKED_REASON_COPY.unspecified])
  })
})
