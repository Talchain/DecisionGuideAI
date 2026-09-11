/**
 * ⛔⛔ AN ABSENCE OF EVIDENCE IS NOT A REFUSAL.
 *
 * `leader_claim.withheld_reason` carries TWO DIFFERENT FACTS under one field
 * name, and CEE says so in its own source
 * (`orchestrator-v5/compose/analysis-state-v1.ts:189-215`):
 *
 *   · `constraint_verdict_withheld` / `options_do_not_separate`
 *       — **WE LOOKED AND DECLINED.** A leader must not be named.
 *   · `separation_unavailable`, `analysis_run_identity_unconfirmed`,
 *     `analysis_run_identity_conflict`
 *       — **WE DID NOT LOOK.** The separation half was unreadable at this seam.
 *       It carries no verdict about whether a leader may be named.
 *
 * CEE classifies them itself, in `LEADER_CLAIM_REASON_KINDS`. **That
 * classification does not cross the wire**: `AnalysisLeaderClaimSchema` is
 * `.strict()` over `{permitted, withheld_reason?, separation?}`, so a consumer
 * receives the CODE and must classify it or collapse the two facts.
 *
 * This UI collapsed them. `producerWithholdsLeaderClaim` read
 * `permitted === false` alone, so a "we did not look" became
 * `'leader_claim_withheld'`, was STAMPED onto the held report and PERSISTED —
 * and since nothing grants permission back (`applyV5State` step 5b: *"it
 * subtracts and never adds… permission returns the only way it safely can:
 * with a NEW run"*), an unreadable turn cost the user their leading option
 * until they re-ran the whole analysis. CEE's own file names the mismatch:
 * *"A3 currently does NOT — it reads `permitted` as a permission."*
 *
 * ── WHY THIS IS A MIRROR, AND WHY THAT IS THE LESSER EVIL ──────────────────
 * These five strings are CEE's vocabulary, restated here. That is trap 12 and
 * it is deliberate: the KIND is not on the wire, so a consumer either mirrors
 * the vocabulary or collapses the distinction, and collapsing it is the defect
 * above. The mirror is made safe by its DIRECTION, not by discipline:
 *
 * ⛔ **ONLY A POSITIVELY-RECOGNISED `not_evaluated` CODE RELAXES ANYTHING.**
 * An unknown code, an absent reason, a non-string — every one of them keeps the
 * withholding. So a future CEE code this build has never seen behaves exactly
 * as today: it withholds. The mirror can only ever go SHORT, and going short
 * costs a leading option the run was entitled to — never a leading option it
 * was not.
 *
 * ⚠ AND IT DOES NOT TOUCH THE OTHER HARM. `producerMarksAnalysisUnusable`
 * (`blocked_unusable === true`) is a SEPARATE predicate with a separate
 * producer-side owner, and it still withdraws the designation on its own
 * account. This only stops an UNREADABLE SEPARATION being read as a REFUSAL.
 */

/** CEE's `withheld_reason` codes that mean "we did not look". */
const NOT_EVALUATED_REASONS: ReadonlySet<string> = new Set([
  'separation_unavailable',
  'analysis_run_identity_unconfirmed',
  'analysis_run_identity_conflict',
])

/**
 * Does this reason mean the producer DID NOT EVALUATE the separation, rather
 * than that it looked and declined?
 *
 * ⚠ FAIL-CLOSED IN EVERY ARM. `false` is the answer for an absent reason, a
 * non-string, an empty string, and any code this build does not recognise —
 * because "not evaluated" is the arm that RELAXES a withholding, and a consumer
 * must never relax on a code the producer may not even have minted.
 */
export function reasonMeansNotEvaluated(reason: unknown): boolean {
  return typeof reason === 'string' && NOT_EVALUATED_REASONS.has(reason)
}

/** The codes above, exported so a test can bind to them by identity. */
export const NOT_EVALUATED_REASON_CODES: readonly string[] = Array.from(NOT_EVALUATED_REASONS)
