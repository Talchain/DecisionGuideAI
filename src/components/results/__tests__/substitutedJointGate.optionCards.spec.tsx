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
 *
 * ═════════════════════════════════════════════════════════════════════════
 * ⭐ SUPERSEDED IN PART BY L62 (2026-08-04) — READ BEFORE EDITING
 * ═════════════════════════════════════════════════════════════════════════
 * 2.282's fix was a COPY switch: keep the substituted number, drop the
 * possessive voice. L60's diagnosis
 * (`PHASE0-EVIDENCE-2026-07-28/diagnosis-goalfit-untruth.md` §5–§8, verified
 * live at the deployed tips) established that the NUMBER is the untruth. ISL
 * evaluates the constraint with a bare `value >= threshold`, comparing a
 * LEVEL or COUNT threshold against CHANGE-frame Monte-Carlo samples with no
 * conversion — so P ≈ 0 is arithmetically forced for every option in every
 * decision, and `probability_of_goal` was absent precisely because ISL's frame
 * guard had honestly refused to guess. 2.282 was re-voicing a fabrication.
 *
 * `selectGoalProbability` therefore no longer substitutes at all (basis
 * `'joint_goal_withheld'`, no number). The tests below that asserted the
 * WITHHELD WORDING renders are inverted: nothing renders. Their possessive
 * assertions are unchanged and still load-bearing, and the two positive
 * controls — a real `probability_of_goal` keeps the possessive — are
 * untouched, because they are what stops this reading as "the card went
 * blank".
 *
 * The 2.282 narrative above is kept verbatim rather than rewritten: it is the
 * record of what was believed and fixed at the time, and the amendment is
 * more legible beside it than in place of it.
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
      // L62: the hook's expression, verbatim — the owner's PERMISSION on a
      // present number, not a basis literal.
      goalFitIsSubstitutedJoint:
        goalDecision.goalProbability != null && !goalDecision.mayUsePossessiveGoalFraming,
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
      expect(d.basis).toBe('joint_goal_withheld')
      expect(d.mayUsePossessiveGoalFraming).toBe(false)
      expect(d.jointSubstitutionWithheld).toBe(true)
    }
    // ⭐ THE INVERSION. 2.282 asserted `goalProbability === 0.0054` here and
    // said this control "would catch a fix that suppressed the number instead
    // of the framing". Suppressing the number is exactly what L62 does, on
    // evidence 2.282 did not have — so the control asserts the opposite now,
    // and the joint quantity is pinned as still-published beside it.
    expect(decisions[0].goalProbability).toBeNull()
    expect(decisions[0].jointGoalProbability).toBe(0.0054)

    // And the withhold survives the hook's mapping into the prop the card reads.
    const mapped = toOptionResults(WITNESSED_PRODUCER_OPTIONS)
    expect(mapped.every((o) => o.goalFitIsSubstitutedJoint === false)).toBe(true)
    expect(mapped[0].goalProbability).toBeNull()
  })

  it('L62: the low-goal badge does not render AT ALL over a withheld joint figure — neither voice, no number', () => {
    const { container } = renderCards(toOptionResults(WITNESSED_PRODUCER_OPTIONS))
    const text = container.textContent ?? ''

    // The 2.282 assertions, unchanged: the possessive must not appear.
    expect(text).not.toContain('< 1% likely to reach target')
    expect(text).not.toContain(POSSESSIVE_BADGE_TAIL)

    // ⭐ INVERTED. 2.282 required the badge to SURVIVE, carrying the register's
    // withheld phrase over the same value ("the fix is a copy switch, never a
    // value transform"). With the value itself withheld there is no badge.
    expect(container.querySelector('[data-testid="low-goal-warning-opt_hybrid"]')).toBeNull()
    expect(text).not.toContain(GOAL_ANCHOR_COPY.phrase('1%', true))
    expect(text).not.toContain('< 1%')
  })

  it('L62: the goal bar carries neither the possessive label nor the withheld caption', () => {
    const { container } = renderCards(toOptionResults(WITNESSED_PRODUCER_OPTIONS))
    const text = container.textContent ?? ''

    // 2.282's assertion, unchanged.
    expect(text).not.toContain(POSSESSIVE_BAR_LABEL)
    // ⭐ INVERTED: 2.282 required the withheld label to REPLACE it. There is no
    // number to caption, so neither appears.
    expect(text).not.toContain(GOAL_ANCHOR_COPY.label(true))
    expect(
      container.querySelectorAll('[data-testid^="goal-fit-substituted-label-"]'),
    ).toHaveLength(0)
    // Control: the cards themselves DID render, so the absences above are about
    // the goal claim and not about an empty component.
    expect(container.querySelectorAll('[data-testid^="option-card-"]').length).toBeGreaterThan(0)
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

  it('L62: the withheld run shows NEITHER voice, and the honest run shows exactly the possessive one', () => {
    // 2.282 pinned `possessive === !withheld` — exactly one voice per render.
    // Under L62 the withheld run has zero of both, so the XOR no longer holds
    // and asserting it would be false. Each arm is pinned explicitly instead,
    // which is strictly stronger: the XOR was satisfiable by a card rendering
    // the WRONG single voice.
    const cases = [
      { options: toOptionResults(WITNESSED_PRODUCER_OPTIONS), expectPossessive: false },
      { options: toOptionResults(withRealGoalProbability(0.055)), expectPossessive: true },
    ]
    for (const { options, expectPossessive } of cases) {
      const { container, unmount } = renderCards(options)
      const text = container.textContent ?? ''
      const possessive = text.includes(POSSESSIVE_BADGE_TAIL) || text.includes(POSSESSIVE_BAR_LABEL)
      const withheldVoice =
        text.includes(GOAL_ANCHOR_COPY.label(true)) ||
        text.includes(GOAL_ANCHOR_COPY.phrase('< 1%', true)) ||
        text.includes(GOAL_ANCHOR_COPY.phrase('6%', true))
      expect(possessive).toBe(expectPossessive)
      // The withheld VOICE is retired outright: it existed only to caption a
      // substituted number, and there is no longer such a number.
      expect(withheldVoice).toBe(false)
      unmount()
    }
  })
})
