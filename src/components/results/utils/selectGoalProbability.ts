/**
 * selectGoalProbability — single source of truth for the goal_probability /
 * probability_of_joint_goal fallback chain.
 *
 * ROADMAP 1.49: OptionNode.tsx's per-option "chance of target" badge used to
 * read option_probabilities[id].goal_probability directly, with NO
 * probability_of_joint_goal fallback — unlike useResultsSectionData (the
 * hook feeding OptionCards, the analysis hero, and GoalNode), which prefers
 * probability_of_joint_goal (constrained) over goal_probability
 * (unconstrained) when constraints exist, and falls back to the joint value
 * when it's the only number the run carries at all (ISL-auto-derived goal
 * threshold case — see T6 P0-3). The two surfaces could therefore show a
 * different number for the SAME option on a constrained-goal run. Extracted
 * here so every surface calls one function instead of re-deriving the same
 * fallback logic.
 */

export interface GoalProbabilityInput {
  goal_probability?: number
  probability_of_joint_goal?: number
  constraint_analysis?: { constraints?: unknown[] } | null
}

export interface GoalProbabilitySelection {
  /** The number to display, or null when neither source is present. */
  goalProbability: number | null
  /** True when `goalProbability` is the joint-goal (constrained) figure. */
  goalProbabilityIsJoint: boolean
}

export function selectGoalProbability(
  prob: GoalProbabilityInput | null | undefined,
): GoalProbabilitySelection {
  const jointGoalProb =
    typeof prob?.probability_of_joint_goal === 'number' ? prob.probability_of_joint_goal : null
  const unconstrained =
    typeof prob?.goal_probability === 'number' ? prob.goal_probability : null
  const hasConstraints = (prob?.constraint_analysis?.constraints?.length ?? 0) > 0

  // Mirrors the goalProbability branch directly below (rather than comparing
  // resulting numbers, which could false-match on a coincidental equal
  // value) so callers know precisely WHEN the displayed number is the
  // joint-goal figure the goal_fit_basis caveat qualifies.
  const goalProbabilityIsJoint = hasConstraints
    ? jointGoalProb != null
    : unconstrained == null && jointGoalProb != null

  const goalProbability = hasConstraints && jointGoalProb != null
    ? jointGoalProb
    : (unconstrained ?? jointGoalProb)

  return { goalProbability, goalProbabilityIsJoint }
}
