/**
 * Shared modelled-basis caveat copy (ROADMAP 1.6b + follow-up,
 * claim-integrity). Single source of the exact wording so every render
 * site that shows a `probability_of_joint_goal`-derived number gated on
 * `goal_fit_basis.scored_from === 'modelled_outcome_distribution'` says
 * the same thing — OptionCards.tsx (the original 1.6b site), the
 * analysis-hero detail line, and the canvas goal-node badge all import
 * this constant rather than re-specifying the sentence.
 */
export const GOAL_FIT_BASIS_CAVEAT_COPY =
  "Modelled from the target's projected outcome distribution, not a directly-set starting value."

/**
 * The second basis a goal figure can stand on (ISL #207, proposal 3; AIQ ACK #72 5876773218):
 * the goal states no level today, so ISL measures the chance from the level its inputs give
 * today — and when any of those inputs is Olumi's estimate (`frame_verdict: 'estimate_only'`),
 * so is the base. Rendered adjacent to the figure whenever `goalFitIsEstimateOnly` is true.
 * Names no goal label: labels can be whole statements ("Reach £250k MRR").
 */
export const GOAL_FIT_ESTIMATE_ONLY_CAVEAT_COPY =
  "Measured from Olumi's estimate of where your goal stands today, not a figure you gave."
