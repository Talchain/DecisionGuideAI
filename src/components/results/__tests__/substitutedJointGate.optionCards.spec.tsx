/**
 * OptionCards — THE POSSESSIVE GATE (ROADMAP 2.282).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE DEFECT, WITNESSED LIVE ON STAGING, 2026-08-01
 * ─────────────────────────────────────────────────────────────────────────
 * CEE never stamped `goal_threshold_frame` and never wrote the goal node's
 * `observed_state` baseline, so ISL REFUSED to produce `probability_of_goal`
 * (`GOAL_THRESHOLD_FRAME_UNSPECIFIED` — "a level threshold compared against
 * the goal's change-from-origin samples yields a structurally impossible
 * probability, so probability_of_goal is omitted rather than guessed").
 *
 * The threshold is nonetheless auto-materialised as a constraint
 * (`auto_goal_threshold`) and evaluated against the delta samples anyway, so
 * `probability_of_joint_goal` arrives populated. `selectGoalProbability`
 * then substitutes it — `basis: 'joint_goal_substituted'`,
 * `mayUsePossessiveGoalFraming: false`.
 *
 * Six surfaces honour that withhold. `OptionCards` did not: it rendered the
 * substituted number as "Hits target" and "< 1% likely to reach target",
 * possessive wording naming a target the number does not answer. On the
 * witnessed run the shipped 0.0054 answers "is the uplift >= £6M?" while the
 * user asked "is the uplift >= £2M?" (~0.55) — a ~100x understatement, in
 * the direction of "this decision is hopeless", delivered in the user's own
 * possessive voice. The V7 goal lens BESIDE IT rendered the withheld wording
 * for the very same number, in the same render.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS FIXTURE IS SHAPED THE WAY IT IS
 * ─────────────────────────────────────────────────────────────────────────
 * The option rows below are the RAW PRODUCER BYTES from the witnessed run
 * (`PHASE0-EVIDENCE-2026-07-28/witness-2258-raw/run1b/wire-analysis-2-res.txt`,
 * `enrichment.option_comparison`) — not values invented to suit the
 * assertion. `probability_of_joint_goal` present, `goal_probability` and
 * `probability_of_goal` absent, no `constraint_analysis`,
 * `goal_fit_basis.scored_from === 'modelled_outcome_distribution'`.
 *
 * ⚠ AND THE FLAG IS NOT HAND-SET. `goalFitIsSubstitutedJoint` here is
 * derived by calling the REAL `selectGoalProbability` on those raw bytes and
 * reading its `basis`, with the SAME expression `useResultsSectionData` uses
 * (`basis === 'joint_goal_substituted'`). A hand-set `true` would pin a
 * boolean this spec invented; this pins the live producer shape through the
 * real chooser into the real component. Test 1 is the anti-vacuity control
 * (CLAUDE.md trap 13): it proves the fixture is genuinely IN the state under
 * test before any copy is asserted about it — if a future selector change
 * stopped substituting, that control REDs rather than the copy tests passing
 * by testing nothing.
 *
 * RED-first: tests 2 and 3 fail at `fef179ce` (the tip this was written
 * against), where the rendered card carries "< 1% likely to reach target"
 * and "Hits target".
 *
 * Mutual exclusivity is pinned in BOTH directions: tests 4 and 5 supply a
 * REAL `probability_of_goal` on the identical payload and require the
 * possessive wording to SURVIVE. A fix that simply deleted the possessive
 * copy would pass 2 and 3 and fail 4 and 5.
 *
 * Scope limit (CLAUDE.md trap 3): jsdom proves PRESENCE and ABSENCE of
 * strings in the rendered output. It proves nothing about layout, wrapping
 * or visibility.
 */

import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { OptionCards } from '../OptionCards'
import type { OptionResult } from '../types'
import { GOAL_ANCHOR_COPY } from '../utils/goalAnchorCopy'
import {
  selectGoalProbability,
  type GoalProbabilityInput,
} from '../utils/selectGoalProbability'

/** The two possessive forms this card shipped, quoted for the assertions. */
const POSSESSIVE_BAR_LABEL = 'Hits target'
const POSSESSIVE_BADGE_TAIL = 'likely to reach target'

/**
 * The five options exactly as the producer sent them on the witnessed run.
 * Kept as the raw wire shape (snake_case, producer field names) because that
 * is what `selectGoalProbability` consumes — mapping them by hand first
 * would put a reimplementation between the evidence and the assertion.
 */
const WITNESSED_PRODUCER_OPTIONS: ReadonlyArray<
  GoalProbabilityInput & { option_id: string; label: string; win_probability: number }
> = [
  {
    option_id: 'opt_hybrid',
    label: 'Hybrid: Moderate Price Rise + New Channels',
    win_probability: 0.4242199999999999,
    probability_of_joint_goal: 0.0054,
    goal_fit_basis: { scored_from: 'modelled_outcome_distribution' },
  },
  {
    option_id: 'opt_new_channels',
    label: 'Expand into New Sales Channels',
    win_probability: 0.06275333333333334,
    probability_of_joint_goal: 0.0018,
    goal_fit_basis: { scored_from: 'modelled_outcome_distribution' },
  },
  {
    option_id: 'opt_price_increase',
    label: 'Raise Prices Across Product Lines',
    win_probability: 0.14703666666666668,
    probability_of_joint_goal: 0.0001,
    goal_fit_basis: { scored_from: 'modelled_outcome_distribution' },
  },
  {
    option_id: 'opt_sales_push',
    label: 'Aggressive Sales & Marketing Push',
    win_probability: 0.3516200000000001,
    probability_of_joint_goal: 0.0009,
    goal_fit_basis: { scored_from: 'modelled_outcome_distribution' },
  },
  {
    option_id: 'opt_status_quo',
    label: 'Continue Current Activities (Status Quo)',
    win_probability: 0.014369999999999996,
    probability_of_joint_goal: 0,
    goal_fit_basis: { scored_from: 'modelled_outcome_distribution' },
  },
]

/** The witnessed outcome distributions, in the same wire order. */
const WITNESSED_OUTCOMES = [
  { mean: 0.29154567698619926, p10: 0.025710384846958232, p50: 0.29398102336776166, p90: 0.5549520306467898 },
  { mean: 0.2598664187491496, p10: 0.025978776107274636, p50: 0.2590512530425989, p90: 0.49750823188643584 },
  { mean: 0.22474601439768335, p10: -0.01286168520096562, p50: 0.23742923214536393, p90: 0.4427062511108739 },
  { mean: 0.26910334664085706, p10: 0.037108037935912205, p50: 0.2727971439915111, p90: 0.4933236377564564 },
  { mean: 0.18532435319408924, p10: 0.009734954649756239, p50: 0.19174522198351251, p90: 0.35000594277527003 },
]

/**
 * The hook's mapping, and ONLY the hook's mapping.
 *
 * `goalProbability`, `goalFitIsModelledBasis` and `goalFitIsSubstitutedJoint`
 * all come out of the real selector's return value — the last one via the
 * exact expression at `useResultsSectionData.ts` ("Which quantity
 * `goalProbability` actually IS, carried to the render layer"). Nothing about
 * the substitution decision is re-derived here.
 */
function toOptionResults(
  producerOptions: ReadonlyArray<
    GoalProbabilityInput & { option_id: string; label: string; win_probability: number }
  >,
): OptionResult[] {
  return producerOptions.map((prob, i) => {
    const goalDecision = selectGoalProbability(prob)
    return {
      id: prob.option_id,
      label: prob.label,
      expected: WITNESSED_OUTCOMES[i].mean,
      outcome: WITNESSED_OUTCOMES[i],
      isRecommended: i === 0,
      winProbability: prob.win_probability,
      nValidSamples: 10000,
      goalProbability: goalDecision.goalProbability,
      goalFitIsModelledBasis: goalDecision.goalFitIsModelledBasis,
      goalFitIsSubstitutedJoint: goalDecision.basis === 'joint_goal_substituted',
    } as OptionResult
  })
}

/** The witnessed payload with a REAL goal probability added per option. */
function withRealGoalProbability(value: number) {
  return WITNESSED_PRODUCER_OPTIONS.map((o) => ({ ...o, probability_of_goal: value }))
}

function renderCards(options: OptionResult[]) {
  return render(
    <OptionCards options={options} winnerId="opt_hybrid" hasGoalThreshold />,
  )
}

describe('OptionCards — possessive gate on a substituted joint goal figure (ROADMAP 2.282)', () => {
  it('control: the witnessed payload really does drive the selector to `joint_goal_substituted` (so the copy tests below are not vacuous)', () => {
    const decisions = WITNESSED_PRODUCER_OPTIONS.map((o) => selectGoalProbability(o))

    for (const d of decisions) {
      expect(d.basis).toBe('joint_goal_substituted')
      expect(d.mayUsePossessiveGoalFraming).toBe(false)
    }
    // The substituted VALUE is the joint figure, unchanged — the fix is a
    // copy switch, and this control would catch a "fix" that suppressed the
    // number instead of the framing.
    expect(decisions[0].goalProbability).toBe(0.0054)

    // And it survives the hook's mapping into the prop the card reads.
    const mapped = toOptionResults(WITNESSED_PRODUCER_OPTIONS)
    expect(mapped.every((o) => o.goalFitIsSubstitutedJoint === true)).toBe(true)
    expect(mapped[0].goalProbability).toBe(0.0054)
  })

  it('RED-first: the low-goal badge does NOT say "likely to reach target" over a substituted joint figure', () => {
    const { container } = renderCards(toOptionResults(WITNESSED_PRODUCER_OPTIONS))
    const text = container.textContent ?? ''

    // The witnessed string, verbatim.
    expect(text).not.toContain('< 1% likely to reach target')
    expect(text).not.toContain(POSSESSIVE_BADGE_TAIL)

    // The badge still renders, still carries the number, and now names the
    // quantity it actually is — the register's compact readout, verbatim.
    expect(text).toContain(GOAL_ANCHOR_COPY.phrase('< 1%', true))
  })

  it('RED-first: the goal bar does NOT carry the possessive "Hits target" label over a substituted joint figure', () => {
    const { container } = renderCards(toOptionResults(WITNESSED_PRODUCER_OPTIONS))
    const text = container.textContent ?? ''

    expect(text).not.toContain(POSSESSIVE_BAR_LABEL)
    // Replaced by the register's label form — the same string `WinGauge`'s
    // goal block renders for the same state.
    expect(text).toContain(GOAL_ANCHOR_COPY.label(true))
    // Exactly one caption per RENDERED card. The count is DERIVED from the
    // DOM rather than hard-coded to the five fixture options, because
    // `OptionCards` truncates to `TOP_N` behind a "Show all" toggle — a
    // literal 5 here would be a hand-maintained mirror of a constant this
    // spec does not own (CLAUDE.md trap 12), and it would silently become
    // the wrong number the day that constant moves.
    const renderedCards = container.querySelectorAll('[data-testid^="option-card-"]')
    expect(renderedCards.length).toBeGreaterThan(0)
    expect(container.querySelectorAll('[data-testid^="goal-fit-substituted-label-"]'))
      .toHaveLength(renderedCards.length)
  })

  it('positive control: a REAL probability_of_goal KEEPS the possessive "Hits target" label and renders no withheld caption', () => {
    // 0.55 is the honest answer the witness derived for the leading option
    // once the frame is stamped ("is the uplift >= £2M?").
    const options = toOptionResults(withRealGoalProbability(0.55))
    expect(options.every((o) => o.goalFitIsSubstitutedJoint === false)).toBe(true)

    const { container } = renderCards(options)
    const text = container.textContent ?? ''

    expect(text).toContain(POSSESSIVE_BAR_LABEL)
    expect(text).not.toContain(GOAL_ANCHOR_COPY.label(true))
    expect(container.querySelectorAll('[data-testid^="goal-fit-substituted-label-"]'))
      .toHaveLength(0)
  })

  it('positive control: a REAL probability_of_goal below the low-goal threshold KEEPS the possessive badge wording', () => {
    // Below 0.10 so the badge branch is exercised in this arm too — without
    // this the badge's possessive wording would be pinned in one direction
    // only, and deleting it outright would still pass.
    const options = toOptionResults(withRealGoalProbability(0.055))
    expect(options.every((o) => o.goalFitIsSubstitutedJoint === false)).toBe(true)

    const { container } = renderCards(options)
    const text = container.textContent ?? ''

    expect(text).toContain(`6% ${POSSESSIVE_BADGE_TAIL}`)
    expect(text).not.toContain(GOAL_ANCHOR_COPY.phrase('6%', true))
    expect(container.querySelectorAll('[data-testid="low-goal-warning-opt_hybrid"]'))
      .toHaveLength(1)
  })

  it('the two arms are mutually exclusive: no render shows both voices at once', () => {
    for (const options of [
      toOptionResults(WITNESSED_PRODUCER_OPTIONS),
      toOptionResults(withRealGoalProbability(0.055)),
    ]) {
      const { container, unmount } = renderCards(options)
      const text = container.textContent ?? ''
      const possessive = text.includes(POSSESSIVE_BADGE_TAIL) || text.includes(POSSESSIVE_BAR_LABEL)
      const withheld =
        text.includes(GOAL_ANCHOR_COPY.label(true)) ||
        text.includes(GOAL_ANCHOR_COPY.phrase('< 1%', true)) ||
        text.includes(GOAL_ANCHOR_COPY.phrase('6%', true))
      expect(possessive).toBe(!withheld)
      unmount()
    }
  })
})
