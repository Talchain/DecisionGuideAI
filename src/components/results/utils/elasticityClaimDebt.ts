/**
 * Elasticity / sensitivity claim family — REGISTERED AS FROZEN DEBT.
 *
 * ⚠ THIS MODULE OWNS NOTHING. It is not a selector, and importing it does
 * nothing. It exists so the repo-wide drift walker
 * (`src/test/__tests__/claim-ownership.drift.spec.ts`) can SEE this family and
 * freeze its current size, which is the only thing that stops it growing while
 * it waits for an owner.
 *
 * WHY. `elasticity` / `sensitivity_score` are the producer quantities behind
 * every "what moves the needle" claim in the estate — the tornado, the model
 * tab, the compare hero, the importance bars, the driver pills. Unlike
 * goal-probability (owned by `selectGoalProbability`) and driver-influence
 * (owned by `driverDisplayModel`), this family has NO chooser: each surface
 * reads the raw fields and applies its own normalisation, sign convention and
 * threshold. The family-1 tripwire's header declares it out of scope in so many
 * words. Every site currently reading it is therefore recorded in
 * `tools/ci-guards/claim-drift-baseline.tsv`, and the baseline is SHRINK-ONLY:
 * the count may go down when a site is migrated, and any NEW site is a hard RED.
 * A companion `tools/ci-guards/claim-drift-identities.tsv` records the same
 * reads per FIELD, because a per-file count cannot see one read inside a file
 * being swapped for another; both are written by one command in one pass.
 *
 * WHAT THIS IS NOT. It is not an allowlist. An allowlist says "these reads are
 * fine"; this says "these reads are debt, they are counted, and the number may
 * only fall". Nothing here is sanctioned and nothing is hidden.
 *
 * THE COMPLIANT ROUTE FOR NEW CODE, until an owner exists: do not add a raw
 * read. Consume an already-derived value from a surface that has one, or — if
 * the new site genuinely PRODUCES the field (a wire→internal adapter) — attest
 * it in its own file with `@claim-producer elasticity` plus a `@rationale`,
 * which lands as a visible new row in the baseline diff for review. There is
 * deliberately no third option: a family with no owner cannot sanction a
 * consumer chain, because there is no chain to sanction.
 *
 * REPLACING THIS FILE. When an owner selector lands, it takes over the
 * registration (moving `family`/`rawFields` into its own `CLAIM_OWNERSHIP` with
 * a real `callInstead`) and THIS FILE IS DELETED. Two modules registering the
 * same family, or the same field, is a hard RED in the walker's `control 3a` —
 * so the handover cannot half-happen.
 */

export const CLAIM_OWNERSHIP = {
  family: 'elasticity',
  rawFields: ['elasticity', 'sensitivity_score'],
  /**
   * `null` = no chooser exists yet. The walker treats this as frozen debt: it
   * sanctions no chain, so every read is a violation and lands in the baseline.
   */
  callInstead: null,
  debtReason:
    'No owner selector exists for the elasticity/sensitivity claim yet: every surface ' +
    'normalises, signs and thresholds the raw fields for itself, so there is no single ' +
    'chooser to route consumers through. Registered here to FREEZE the existing debt ' +
    'shrink-only while the owner is designed; see the design doc slice 4.',
} as const
