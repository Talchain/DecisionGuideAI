/**
 * ⭐⭐ THE ONE SENTENCE EVERY "DEFINE SUCCESS" CTA HANDS TO OLUMI.
 *
 * ── WHY THIS IS A MODULE AND NOT TWO STRINGS ──────────────────────────────
 * Two surfaces prescribe setting a success target and both hand off to the
 * conversation, because the structured Define-success modal is statically
 * closed (`CANONICAL_EDIT_AUTHORITY.goalSuccessTarget` is `'disabled'` in a
 * `const satisfies` object, so `hasServerGraphAuthority` is a compile-time
 * `false`):
 *
 *   · the Strengthen panel's `strengthen:success-measure` card
 *     (`buildRecommendations.ts`), whose primary falls through to the
 *     Ask-Olumi drawer on BOTH Strengthen surfaces;
 *   · the canvas coaching panel's `static:define-success` hygiene row
 *     (`canvas/components/coaching-panel/focus-now/focusConstants.ts`).
 *
 * They carried the same sentence, spelled twice. One authority, imported —
 * never a second place to remember to update (CLAUDE.md trap 12).
 *
 * ── THE WITNESS THIS REPLACES (deployed staging, 2026-09-11) ──────────────
 * UI `9e2916fc` / CEE `dcebc36`. The product prescribed "Focus next: set a
 * success target to unlock Goal fit." and offered `Define success`. Following
 * it exactly cost FOUR turns and ended in an error, with the goal node still
 * reading "Target not captured":
 *
 *   1. the CTA opened a chat hand-off asking to "work through" defining
 *      success — a request for a conversation, not for a target;
 *   2. the user stated "monthly churn at or below 1.2% by 31 March 2027" and
 *      CEE asked "Did you mean 1.2% or an absolute 1.2?" — the drafted
 *      proposal carried no `unit` parameter even though the user's own words
 *      did (CEE `add-constraint.ts`, the Gate-1 unit-ambiguity refusal);
 *   3. the restatement carried no mutation warrant, so it was demoted to an
 *      offer: "Nothing has been changed… Say the word and I will make it."
 *      plus an `Add this limit` chip (CEE telemetry
 *      `v5.turn_executor.mutation_warrant_absent`, demotion `offered`);
 *   4. the chip's resume failed `parameter_invalid_at_execute` and the user
 *      read "I could not apply that constraint because the target or
 *      constraint details were not valid."
 *
 * ── EACH CLAUSE BELOW REMOVES ONE OF THOSE TURNS ──────────────────────────
 *   · "at least"        — the ONLY direction that stamps the goal node's
 *     `goal_threshold_raw`. That field is exactly what CEE's
 *     `admission/analysis-admission.ts::goalTargetStated` reads for
 *     `analysis_admission.semantic_signals.goal_target_stated`, and therefore
 *     the only thing that unlocks Goal fit. Its only chat-path writer stamps
 *     under `targetNode.kind === 'goal' && operator === '>='`
 *     (`tools/handlers/add-constraint.ts`, `isSuccessTargetTurn`), and that
 *     handler states in its own comment that `at_most` goal constraints
 *     deliberately do NOT stamp a threshold — ISL computes
 *     P(samples >= threshold), so encoding a "keep below" bound as a
 *     >=-threshold would invert the claim.
 *   · "[number] [unit]" — the unit is what the Gate-1 refusal asks for.
 *   · "apply it to the model" — an explicit instruction to change something,
 *     so the turn carries a mutation warrant instead of being demoted to a
 *     confirm chip.
 *
 * ⚠ NO EXAMPLE NUMBER, DELIBERATELY. A prefill that is HARMFUL WHEN SENT
 * UNEDITED is a new defect, not a fix: a concrete "for example 92%" is one
 * accepted draft away from a fabricated target the user never chose. The
 * bracketed slots cannot be mistaken for a value, so an unedited send costs
 * one honest clarifying question and never a wrong persist.
 *
 * ⚠ AND WHAT THIS DOES NOT CLAIM. It does not promise the Goal-fit unlock. A
 * goal the team wants to drive DOWN (churn, cost, time) still has no
 * representable success target on this path — the minimisation case is a real
 * gap in the model, not something copy can close.
 */
export const SUCCESS_TARGET_PROMPT =
  'Set a success target on my goal of at least [number] [unit], then apply it to the model. Ask me for the number if I have not filled it in.'
