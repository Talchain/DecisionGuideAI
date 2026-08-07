/**
 * constraintTrust — independently-controlled suppression switches for the two
 * seams that carry PLoT constraint-derived numbers into the UI.
 *
 * BACKGROUND (the original blanket gate, 2026-07-20)
 * --------------------------------------------------
 * PLoT's constraint normalisation was broken when a constrained node lacked an
 * explicit scale (ROADMAP 2.83, a PLoT P0): the constraint probabilities could
 * INVERT — a VIOLATED cap reported as `prob_satisfied` /
 * `probability_of_joint_goal` ≈ 1.0 — and margins were +25–43% off. #410
 * shipped ONE constant, `PLOT_CONSTRAINT_NUMBERS_SUSPECT = true`, that
 * blanket-suppressed BOTH seams at once.
 *
 * THE SPLIT (2026-07-21)
 * ----------------------
 * The two seams have now diverged: the producer fix that clears seam 1 does
 * NOT clear seam 2 (seam 2 is blocked on a separate, UI-side mapper-seam
 * defect). One constant can no longer describe reality, so it is split into two
 * independently-flippable flags — one per seam, each with its own provenance.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SEAM 1 — headline goal probability (`selectGoalProbability`)
 * ─────────────────────────────────────────────────────────────────────────────
 * PLoT's constraint-normalisation fix is DEPLOYED-AND-VERIFIED (not merely
 * merged): A3, 2026-07-16, PLoT staging tip ea106565 (== /health), evidence
 * `acceptance-evidence/a3-verify-2026-07-16/constraint-norm-split/
 * POSTFIX-VERIFICATION.md`. On a violated-cap option the deployed V5
 * `probability_of_joint_goal` now flips 1→0 IN LOCKSTEP with the standalone
 * constraint probability — i.e. the headline value is CORRECT AT SOURCE. The
 * joint→headline substitution is therefore RESTORED.
 *   ⇒ FALSE (trusted, restored).
 */
export const PLOT_JOINT_HEADLINE_SUSPECT = false

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SEAM 2 — per-option constraint_analysis block (V2 `responseMapper`)
 * ─────────────────────────────────────────────────────────────────────────────
 * STILL SUSPECT — for a different reason than the (now-fixed) normalisation
 * defect. Our mappers read a `constraint_analysis` SHAPE that PLoT never emits
 * on the live V5 path, so #410's seam-2 positive control was a SYNTHETIC
 * fixture, and `selectGoalProbability` prefers the unconstrained number when
 * both fields are present. Restoring per-option bars/verdict is blocked on the
 * mapper-seam work (align the read shape to what PLoT actually emits) plus A3's
 * forthcoming `scale_provenance` / `constraints_decision_grade` markers. Until
 * then the per-option block stays omitted.
 *   ⇒ TRUE (suspect, still gated).
 *
 * FLIP TRIGGER (seam 2): flip to `false` only when the mapper-seam defect is
 * fixed AND A3 signals the decision-grade markers are deployed-and-verified.
 * The `responseMapper.constraintGate` positive control pins that flipping this
 * constant restores the per-option passthrough, so that PR is safe.
 *
 * Removal of both constants (delete + inline the branches) is tracked as
 * UI-SEM-088.
 */
export const PLOT_PER_OPTION_CONSTRAINTS_SUSPECT = true
