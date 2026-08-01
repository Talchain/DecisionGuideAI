/**
 * ROADMAP 2.275 — the CONTAINER/POINTER gap behind the witnessed goal-node
 * contradiction, pinned at the level where it actually occurs.
 *
 * `selectGoalProbability` was already the single chooser and both surfaces
 * called it — the module header says so explicitly. The defect survived that
 * unification because the CANVAS never reached the chooser: this hook reads
 * `option_probabilities[recommendedOptionId]`, and the live V5 payload
 * (witness-2267 `f-turn-2.json`, `r4-turn-2.json`) carries
 *   · `robustness.recommended_option_id` — ABSENT (key not present at all)
 *   · `leading_option_id`                — null
 * while every option in `option_comparison` carries a real
 * `probability_of_joint_goal` plus `goal_fit_basis.scored_from`.
 *
 * So the `if (recommendedOptionId)` gate never opened, `achievementProbability`
 * stayed null, and the node denied a figure the same report held four times.
 *
 * These tests exercise the classification directly against that payload shape.
 */

import { describe, it, expect } from 'vitest'
import { selectGoalProbability } from '../../../components/results/utils/selectGoalProbability'

/** Verbatim from witness-2267 f-turn-2.json `enrichment.option_comparison[]`. */
const WITNESSED_OPTION_PROBABILITIES: Record<string, any> = {
  opt_bristol: {
    probability_of_joint_goal: 0.0002,
    goal_fit_basis: { scored_from: 'modelled_outcome_distribution', node_ids: ['goal_capacity'] },
  },
  opt_leeds: {
    probability_of_joint_goal: 0,
    goal_fit_basis: { scored_from: 'modelled_outcome_distribution', node_ids: ['goal_capacity'] },
  },
  opt_phased: {
    probability_of_joint_goal: 0.0004,
    goal_fit_basis: { scored_from: 'modelled_outcome_distribution', node_ids: ['goal_capacity'] },
  },
  opt_status_quo: {
    probability_of_joint_goal: 0,
    goal_fit_basis: { scored_from: 'modelled_outcome_distribution', node_ids: ['goal_capacity'] },
  },
}

/**
 * The exact predicate the hook now applies for `goalFitAvailable` — asking the
 * OWNER, never re-deriving. Kept in the test as an executable statement of the
 * contract the hook must satisfy.
 */
function anyOptionCarriesGoalFit(optionProbabilities: Record<string, unknown>): boolean {
  return Object.values(optionProbabilities).some(
    (entry) => entry != null && selectGoalProbability(entry as any).goalProbability != null,
  )
}

describe('goalFitAvailable — the canvas must not deny a figure the report holds', () => {
  it('is TRUE on the witnessed payload, where no option is designated', () => {
    // The pointer the hook needs is genuinely absent…
    const recommendedOptionId = undefined
    expect(recommendedOptionId).toBeUndefined()

    // …yet every option carries an admissible goal figure.
    expect(anyOptionCarriesGoalFit(WITNESSED_OPTION_PROBABILITIES)).toBe(true)
  })

  it('the per-option figures are the JOINT quantity, substituted — not a fabrication', () => {
    const sel = selectGoalProbability(WITNESSED_OPTION_PROBABILITIES.opt_bristol)
    expect(sel.basis).toBe('joint_goal_substituted')
    expect(sel.goalProbability).toBe(0.0002)
    expect(sel.goalFitIsModelledBasis).toBe(true)
    // The number is real but does not answer "your goal", so possessive
    // framing stays withheld — the canvas copy must not claim it either.
    expect(sel.mayUsePossessiveGoalFraming).toBe(false)
  })

  it('is FALSE when the run genuinely carries no goal figure for any option', () => {
    expect(
      anyOptionCarriesGoalFit({
        opt_a: { win_probability: 0.5 },
        opt_b: { win_probability: 0.5 },
      }),
    ).toBe(false)
  })

  it('a hard zero still counts as a figure the run produced', () => {
    // witness §11c: run 4 returned exactly 0 for all four options. Zero is a
    // result, not an absence — denying it would be the same defect inverted.
    expect(anyOptionCarriesGoalFit({ opt_a: { probability_of_joint_goal: 0 } })).toBe(true)
  })
})
