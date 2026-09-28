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
 * The second basis a goal figure can stand on (ISL #207, proposal 3; AIQ ACK #72 5876773218): the
 * goal states no level today, so ISL measures the chance from the level its inputs give today.
 * TWO strings, because authorship is only said when the carrier states it (AIQ 5877139338 (1)):
 *   · `olumi_estimate` — the goal's typed entry says `level_author: "olumi"`;
 *   · `from_inputs` — no typed entry reached the UI (fail-closed): author-neutral, never "Olumi's".
 * Neither names the goal's label: labels can be whole statements ("Reach £250k MRR").
 */
export const GOAL_FIT_ESTIMATE_ONLY_CAVEAT_COPY =
  "Measured from Olumi's estimate of where your goal stands today, not a figure you gave."
export const GOAL_FIT_FROM_INPUTS_CAVEAT_COPY =
  'Measured from where your goal stands today as worked out from its inputs, not a figure you gave.'

/** The one mapping from the chooser's base-caveat to its words. */
export function goalFitBaseCaveatCopy(caveat: 'olumi_estimate' | 'from_inputs' | null | undefined): string | null {
  if (caveat === 'olumi_estimate') return GOAL_FIT_ESTIMATE_ONLY_CAVEAT_COPY
  if (caveat === 'from_inputs') return GOAL_FIT_FROM_INPUTS_CAVEAT_COPY
  return null
}
