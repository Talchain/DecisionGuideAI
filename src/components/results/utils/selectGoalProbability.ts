/**
 * selectGoalProbability — THE single source of truth for the question
 * "which producer quantity, if any, may be shown as this option's goal
 * probability, and with what provenance".
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
 *
 * ─────────────────────────────────────────────────────────────────────────
 * GOAL-PROBABILITY IDENTITY (this file's second job, and the reason it now
 * publishes a basis rather than a bare number + boolean)
 * ─────────────────────────────────────────────────────────────────────────
 * The producer emits TWO semantically different quantities:
 *
 *   • `goal_probability`         P(this option's outcome clears the goal
 *                                threshold) — the user's stated goal.
 *   • `probability_of_joint_goal` P(ALL constraints jointly satisfied).
 *
 * They are collapsed under one display name, and until this module owned the
 * decision outright they were chosen by TWO independent implementations with
 * DIFFERENT rules — this selector for the results panel, and an inline chain
 * in `canvas/hooks/useNodeDisplayMetadata.ts` for the canvas nodes and the
 * inspector. On the documented ISL-auto-derived-threshold run
 * (`goal_probability` ABSENT, `probability_of_joint_goal` PRESENT) the two
 * disagreed LIVE: this selector returned the joint value and flagged it,
 * while the canvas chain returned `null` — so the results panel rendered a
 * percentage and its provenance caveat while the canvas GoalNode rendered
 * "This run did not produce a goal probability", in the same session, about
 * the same option. `useNodeDisplayMetadata` now calls this function; there is
 * one chooser, not two.
 *
 * `basis` names WHICH quantity the returned number actually is, because
 * "may we show a goal probability" is not answerable without it:
 *
 *   • 'goal_probability'        the true per-option goal quantity.
 *   • 'joint_goal_constrained'  the joint quantity, chosen because THIS
 *                               option carries its own constraint analysis —
 *                               the user's own goal AND the user's own
 *                               limits, which the "and limits" copy names.
 *   • 'joint_goal_substituted'  the joint quantity STANDING IN for an absent
 *                               goal quantity. The number is real and the
 *                               user is entitled to it, but it answers a
 *                               different question from the one the
 *                               possessive framing ("your goal") asserts, so
 *                               `mayUsePossessiveGoalFraming` is false here.
 *   • 'none'                    no admissible value.
 *
 * `goalProbability` and `goalProbabilityIsJoint` are DERIVED from `basis`
 * rather than computed alongside it, so the number and the claim about which
 * quantity it is cannot drift apart.
 */

import { PLOT_JOINT_HEADLINE_SUSPECT } from '../../../adapters/plot/constraintTrust'

/**
 * CLAIM-OWNERSHIP REGISTRATION.
 *
 * Declares to the repo-wide drift walker
 * (`src/test/__tests__/claim-ownership.drift.spec.ts`) that THIS module is the
 * sole chooser for these producer fields. The walker DISCOVERS this by globbing
 * `git ls-files` for the export and then dynamically importing the module to
 * read the value below — so there is no list of families anywhere else, in the
 * walker or in the lint config, and a new owner registers a new family by
 * construction. That is deliberate: the predecessor instrument hand-lists its
 * family in two files, and a list a human must remember to sync is the defect
 * class that drifts silently.
 *
 * This is not decoration. `GoalProbabilityInput` below is DERIVED from
 * `rawFields`, so a field this selector reads but does not declare is a COMPILE
 * error, and a field it declares but never reads is dead weight a reviewer can
 * see. The declaration cannot drift from the implementation.
 *
 * WHY `probability_of_goal` IS OWNED AND READ. It is the WIRE spelling of the
 * same quantity as `goal_probability`: `RawOption` (`src/lib/mappers/types.ts`)
 * declares three names for it, `mapV5AnalysisToReport` reads
 * `probability_of_goal` and writes `goal_probability`, and
 * `responseMapper` does the same. A consumer reaching for the wire spelling is
 * re-deriving the claim exactly as much as one reaching for the mapped
 * spelling, so the family owns both — and this selector therefore has to ACCEPT
 * both, or the sites that hold a wire-shaped option (the compare-tab snapshot
 * factory, the inspector's report-level reads) would have no compliant route and
 * the registration would be claiming ownership the code does not back.
 *
 * WHY `goalProbability` IS NOT REGISTERED, though it is a fourth alias on
 * `RawOption`: it is also the name of THIS selector's own output field. A
 * name-based scanner cannot tell "raw producer alias" from "the owner's own
 * output property" when they share a name, so registering it measures 23
 * violator files / 60 hits of which ~14 files are correct code reading the
 * selector's output — it would punish exactly the compliance the migration
 * bought. The walker enforces this: `control 3b` fails at registration time if a
 * `rawField` collides with a key of this function's return value (derived by
 * calling it, never declared). The real remedy for that alias is a rename, and
 * it is tracked as a follow-up, not smuggled in here.
 */
export const CLAIM_OWNERSHIP = {
  family: 'goal-probability',
  rawFields: ['goal_probability', 'probability_of_goal', 'probability_of_joint_goal'],
  /** Consumers must call this instead. Named in the walker's failure message. */
  callInstead: 'selectGoalProbability',
} as const

type OwnedField = (typeof CLAIM_OWNERSHIP.rawFields)[number]

/**
 * Which producer quantity the returned `goalProbability` actually IS. Never
 * inferred by a consumer — consumers read this, they do not re-derive it.
 */
export type GoalProbabilityBasis =
  | 'none'
  | 'goal_probability'
  | 'joint_goal_constrained'
  | 'joint_goal_substituted'

export interface GoalProbabilityInput extends Partial<Record<OwnedField, number>> {
  constraint_analysis?: { constraints?: unknown[] } | null
  goal_fit_basis?: { scored_from?: string } | null
}

export interface GoalProbabilitySelection {
  /** The number to display, or null when no source is admissible. */
  goalProbability: number | null
  /** True when `goalProbability` is the joint-goal (constrained) figure. */
  goalProbabilityIsJoint: boolean
  /**
   * The raw joint-goal quantity — P(ALL constraints jointly satisfied) — as the
   * producer sent it, or null when absent. NOT a second answer to "what is this
   * option's goal probability": that question has exactly one answer, and it is
   * `goalProbability` above.
   *
   * It is published because two surfaces render the joint figure as its OWN,
   * separately-labelled claim alongside the goal figure — the inspector's
   * "chance of hitting every target" row, and the compare-tab snapshot's
   * `jointGoalProbability`. Before this existed, both read
   * `probability_of_joint_goal` off the producer directly, which is precisely
   * the reach-around the owner exists to prevent: any surface holding the raw
   * field can also start CHOOSING with it, and then there are two choosers
   * again. Reading it here means every read of the quantity, for either
   * purpose, goes through this module.
   */
  jointGoalProbability: number | null
  /** Which producer quantity `goalProbability` is. Never null; 'none' when absent. */
  basis: GoalProbabilityBasis
  /**
   * Display-honesty (ROADMAP 1.6b, doctrine B / PLoT #204): true ONLY when
   * the number above IS the joint-goal figure AND the producer marked it as
   * scored from a modelled outcome distribution. EVERY surface that renders
   * the number must render `GOAL_FIT_BASIS_CAVEAT_COPY` adjacent to it when
   * this is true — computed here, once, so no surface can show the number
   * with the caveat and another show it without.
   */
  goalFitIsModelledBasis: boolean
  /**
   * Whether prose may call the thing this number measures "YOUR goal".
   *
   * False on `joint_goal_substituted`: the value is P(all constraints jointly
   * satisfied) standing in for an absent goal probability, so the possessive
   * would attribute to the user a question the number does not answer. The
   * NUMBER is still shown (it is real, computed, and decision-relevant) —
   * only the possessive framing is withheld.
   */
  mayUsePossessiveGoalFraming: boolean
}

export function selectGoalProbability(
  prob: GoalProbabilityInput | null | undefined,
): GoalProbabilitySelection {
  const jointGoalProb =
    typeof prob?.probability_of_joint_goal === 'number' ? prob.probability_of_joint_goal : null
  // Both spellings of the SAME producer quantity (see the registration header):
  // the mapped `goal_probability` wins where a payload carries both, so every
  // existing caller — all of which hold post-mapper shapes — is unaffected.
  const unconstrained =
    typeof prob?.goal_probability === 'number'
      ? prob.goal_probability
      : typeof prob?.probability_of_goal === 'number'
        ? prob.probability_of_goal
        : null
  const goalFitBasisScoredFrom =
    typeof prob?.goal_fit_basis?.scored_from === 'string' ? prob.goal_fit_basis.scored_from : null

  // Honesty gate (UI-SEM-088, seam 1): while true, `probability_of_joint_goal`
  // can INVERT, so we NEVER substitute it — every surface falls back to the
  // unconstrained `goal_probability`. Gated on the constant, not on
  // `constraint_analysis` presence, because the live V5 path never populates
  // per-option `constraint_analysis`, so the joint number arrives with no
  // client-visible constraint marker; the constant is the only signal that
  // survives. We drop the auto-derived `?? jointGoalProb` tail too (returning
  // null rather than a possibly-inverted joint): the no-user-target case it
  // served is already suppressed upstream by UI-SEM-071.
  //
  // As of 2026-07-21 this seam is RESTORED (constant FALSE): A3's PLoT
  // constraint-normalisation fix is deployed-and-verified (PLoT ea106565,
  // POSTFIX-VERIFICATION.md — joint flips 1→0 in lockstep on a violated cap),
  // so the branch below no longer fires and the full joint→headline flow runs.
  // Seam 2 (per-option `constraint_analysis` in the responseMapper) stays
  // gated on its own constant. Presence of a target is unaffected either way.
  if (PLOT_JOINT_HEADLINE_SUSPECT) {
    return {
      goalProbability: unconstrained,
      goalProbabilityIsJoint: false,
      // The honesty gate governs SUBSTITUTION of the joint value into the
      // headline claim, which is suppressed above. It does not govern a surface
      // that renders the joint figure as its own separately-labelled row, and
      // those surfaces read the producer field directly regardless of this
      // constant today — so publishing it here changes no rendered output in
      // either state of the gate, while keeping the read inside this module.
      jointGoalProbability: jointGoalProb,
      basis: unconstrained != null ? 'goal_probability' : 'none',
      goalFitIsModelledBasis: false,
      mayUsePossessiveGoalFraming: unconstrained != null,
    }
  }

  const hasConstraints = (prob?.constraint_analysis?.constraints?.length ?? 0) > 0

  // THE identity decision, made exactly once. Ordered so that each branch
  // names a distinct producer situation rather than a coincidence of values:
  // a per-option constraint analysis makes the joint figure the right answer;
  // otherwise the goal quantity is the right answer whenever the run carries
  // it; only when it does not does the joint figure stand in for it.
  const basis: GoalProbabilityBasis =
    hasConstraints && jointGoalProb != null
      ? 'joint_goal_constrained'
      : unconstrained != null
        ? 'goal_probability'
        : jointGoalProb != null
          ? 'joint_goal_substituted'
          : 'none'

  const goalProbabilityIsJoint =
    basis === 'joint_goal_constrained' || basis === 'joint_goal_substituted'

  // Derived FROM the basis (never computed in parallel with it), so the
  // number and the statement of which quantity it is cannot diverge.
  const goalProbability = goalProbabilityIsJoint
    ? jointGoalProb
    : basis === 'goal_probability'
      ? unconstrained
      : null

  return {
    goalProbability,
    goalProbabilityIsJoint,
    jointGoalProbability: jointGoalProb,
    basis,
    goalFitIsModelledBasis:
      goalProbabilityIsJoint && goalFitBasisScoredFrom === 'modelled_outcome_distribution',
    mayUsePossessiveGoalFraming: goalProbability != null && basis !== 'joint_goal_substituted',
  }
}
