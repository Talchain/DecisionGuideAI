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
 *   • 'joint_goal_withheld'     a joint quantity WAS available and is being
 *                               withheld from the goal-fit slot. No number is
 *                               returned. See the L62 block below.
 *   • 'none'                    no admissible value.
 *
 * `goalProbability` and `goalProbabilityIsJoint` are DERIVED from `basis`
 * rather than computed alongside it, so the number and the claim about which
 * quantity it is cannot drift apart.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⭐ L62 (2026-08-04) — THE SUBSTITUTION IS WITHHELD, NOT RE-VOICED
 * ─────────────────────────────────────────────────────────────────────────
 * This basis used to be `'joint_goal_substituted'`: the joint number WAS
 * returned, and the fix of the day (ROADMAP 2.282) was to withhold only the
 * possessive VOICE around it — "chance of meeting every target this run
 * scored" instead of "chance of hitting your goal". That was a copy fix over
 * a number that should never have been shown.
 *
 * L60's diagnosis (`PHASE0-EVIDENCE-2026-07-28/diagnosis-goalfit-untruth.md`
 * §5–§8, verified live at the deployed tips) establishes why the NUMBER is
 * the problem, not the wording. `probability_of_joint_goal` is
 * P(all constraints jointly satisfied), and ISL evaluates every constraint
 * with `value >= constraint.threshold` — a LEVEL/COUNT threshold compared
 * directly against CHANGE-frame Monte-Carlo samples, with no frame
 * conversion and no refusal path. P ≈ 0 is then ARITHMETICALLY FORCED for
 * every option regardless of option quality. Three flavours were witnessed
 * producing exactly that: a draft-minted fraction constraint, a chat-minted
 * COUNT constraint ("≤ 2 account executives" scored as P(risk-score ≤ 0.25)),
 * and a goal-target LEVEL constraint. The honest channel
 * (`probability_of_goal`) had already FAILED CLOSED on all three — ISL's
 * frame guard refusing to guess — and this selector was papering over that
 * refusal with the unguarded number from the channel the guard does not
 * cover.
 *
 * WHY THE GATE IS TOTAL RATHER THAN CONDITIONAL. The obvious narrower gate
 * is "substitute only when the producer marked the constraints decision-grade
 * AND the frames are compatible". The second half is not derivable: NOTHING
 * on the wire states the frame of a constraint threshold or of the samples it
 * is compared against (`GoalConstraint` carries no frame field; the frame
 * attestation exists only on `goal_threshold`, a different channel). And the
 * first half does not discriminate — measured against the three witnessed
 * producer captures, `constraints_decision_grade` is TRUE on two of the three
 * fabrications and FALSE on the third. `goal_fit_basis` and the
 * `CONSTRAINT_GOALFIT_MODELLED_BASIS` warning are absent entirely from one of
 * them. There is no field, and no conjunction of fields, that separates a
 * frame-broken joint figure from a sound one.
 *
 * So the strongest gate that is DERIVED rather than assumed is the total one:
 * the joint figure never stands in for an absent goal probability. It is
 * still published as `jointGoalProbability` and still rendered, unchanged, by
 * the surfaces that label it honestly as the joint-constraints channel.
 *
 * REINSTATEMENT TRIGGER (do not relax this gate without it): a producer-side
 * frame attestation on the constraint channel — the ISL/PLoT half of L60's
 * fix stack — such that a joint figure can be shown to answer the question
 * the goal-fit slot asks. Until such a field exists and is read here, any
 * conditional substitution is a guess wearing a guarantee.
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
  /**
   * ⚠ RENAMED FROM `'joint_goal_substituted'` BY L62, DELIBERATELY.
   *
   * The rename is the instrument. Every consumer that compared against the
   * old literal is now a COMPILE error rather than a silently-false branch,
   * so the compiler enumerates the blast radius instead of a human listing it
   * (CLAUDE.md trap 12 — derive, never mirror). Do not add the old member back
   * as an alias.
   */
  | 'joint_goal_withheld'

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
   * False whenever `goalProbability` is null, which now includes every
   * `joint_goal_withheld` run: there is no number to frame.
   */
  mayUsePossessiveGoalFraming: boolean
  /**
   * ⭐ L62. True ⇔ `basis === 'joint_goal_withheld'` — the run DID carry a
   * joint figure and this selector refused to put it in the goal-fit slot.
   *
   * Published because "no goal number" and "a goal number was withheld" need
   * DIFFERENT copy, and a surface must not have to re-derive which it is
   * holding. The no-target line ("Set a success target to see which option is
   * most likely to reach it") is a lie in this state: the user did set a
   * target, or the run did carry constraints — what failed is that nothing on
   * the wire lets us score them honestly. Surfaces read this and say so.
   */
  jointSubstitutionWithheld: boolean
}

/**
 * ⭐ L62 — THE ONE MAPPING from a basis to "must a RENDERED number withhold
 * the possessive voice".
 *
 * Four surfaces (`OptionNode`, `GoalNode`, `GoalPanel`, `DecisionSummary`)
 * each narrowed the basis with their own inline `=== 'joint_goal_substituted'`
 * literal. That was one vocabulary while there was one literal to test; the
 * moment the set of withholding bases changes it becomes four copies of a rule
 * (CLAUDE.md trap 12). It is a function now, and it lives beside the basis it
 * reads.
 *
 * ⚠ STATE OF THIS FUNCTION TODAY, PLAINLY: it returns true for exactly one
 * basis, and that basis NEVER carries a number — `selectGoalProbability`
 * returns `goalProbability: null` for it. Every call site is additionally
 * gated on a present number, so **no call site can currently take the
 * withholding arm**. This is deliberately NOT dressed up as a live guard: it
 * is the seam that keeps the four surfaces speaking one language, and it goes
 * live again the day a basis both carries a number and forbids the possessive.
 * It is not evidence that anything is being protected today — what protects
 * the user today is that the number is withheld at source.
 */
export function basisWithholdsPossessive(
  basis: GoalProbabilityBasis | null | undefined,
): boolean {
  return basis === 'joint_goal_withheld'
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
      // This arm never substitutes either, so nothing is withheld FROM a
      // substitution here — the L62 gate below is what owns that state.
      jointSubstitutionWithheld: false,
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
          ? // ⭐ L62: was `'joint_goal_substituted'`, and the joint number was
            // returned here. It is now withheld — see the L62 block in the
            // module header for the derivation.
            'joint_goal_withheld'
          : 'none'

  const goalProbabilityIsJoint = basis === 'joint_goal_constrained'

  // Derived FROM the basis (never computed in parallel with it), so the
  // number and the statement of which quantity it is cannot diverge.
  // `joint_goal_withheld` falls through to null by construction: there is no
  // arm that returns a number for it, so no future edit can reintroduce the
  // substitution without changing the basis itself.
  const goalProbability = goalProbabilityIsJoint
    ? jointGoalProb
    : basis === 'goal_probability'
      ? unconstrained
      : null

  return {
    goalProbability,
    goalProbabilityIsJoint,
    // UNCHANGED by the gate, deliberately: the surfaces that render the joint
    // figure as its OWN, separately-labelled claim ("chance of hitting every
    // target") are honest and keep their number. The gate governs the GOAL-FIT
    // slot only.
    jointGoalProbability: jointGoalProb,
    basis,
    goalFitIsModelledBasis:
      goalProbabilityIsJoint && goalFitBasisScoredFrom === 'modelled_outcome_distribution',
    mayUsePossessiveGoalFraming: goalProbability != null,
    jointSubstitutionWithheld: basis === 'joint_goal_withheld',
  }
}
