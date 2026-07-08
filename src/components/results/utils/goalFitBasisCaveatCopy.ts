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
