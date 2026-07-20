/**
 * constraintTrust — single suppression switch for constraint-derived numbers.
 *
 * PROVENANCE (2026-07-20)
 * -----------------------
 * PLoT's constraint normalisation is broken when a constrained node lacks an
 * explicit scale (ROADMAP 2.83, a PLoT P0). In that state the constraint
 * probabilities PLoT returns are not merely imprecise — they can INVERT: a
 * VIOLATED cap can be reported as `prob_satisfied` / `probability_of_joint_goal`
 * ≈ 1.0 ("100% chance you hit your target" when the target was missed), and the
 * failure margins are +25–43% off. The bite is the COMMON case: a CEE-drafted
 * graph rarely carries an explicit scale on its nodes, so the defect fires on
 * ordinary conversational runs.
 *
 * We cannot trust the wire here, and we deliberately do NOT try to detect the
 * bite condition client-side (replicating a producer defect predicate on the
 * consumer is the hand-maintained-mirror class that drifts silently — see the
 * two-repo `generateGraphHash` twins and the vitest flags-mock allowlist). So
 * this is a BLANKET honesty gate: while it is `true`, every constraint-derived
 * number is suppressed at the two seams that carry it into the UI
 * (`selectGoalProbability` and the V2 responseMapper's per-option
 * `constraint_analysis` passthrough), and every downstream surface falls back
 * to its existing absent-constraint branch. Presence-only copy (that a target
 * or constraint EXISTS, with no number) is untouched.
 *
 * FLIP TRIGGER
 * ------------
 * Flip to `false` — a one-line PR — ONLY when the A1 orchestrator signals the
 * PLoT normalisation fix is DEPLOYED-AND-VERIFIED (not merely merged). The
 * positive-control spec (`constraintTrust`/`selectGoalProbability` suites)
 * pins that flipping this constant restores the full constraint-number flow,
 * so the restoration PR is safe.
 *
 * Removal (delete the constant + inline the `false` branch) is tracked as
 * UI-SEM-088.
 */
export const PLOT_CONSTRAINT_NUMBERS_SUSPECT = true
