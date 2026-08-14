/**
 * decisionVoi — the reader between `enrichment.decision_evpi` and the ONE
 * sentence the estate is licensed to say about it.
 * V7-C slice 2a, design of record
 * `olumi-docs/docs-designs/RESOLVE-NEXT-DECISION-EVPI-DESIGN-2026-08-13.md` §2.
 *
 * WHAT THIS FIELD IS, IN THE PRODUCER'S OWN WORDS
 * ───────────────────────────────────────────────
 * The whole-decision expected value of perfect information: ISL computes it as
 * `E[max_o U] − max_o E[U] = min_o expected_regret[o]` on the joint pre-noise
 * Common-Random-Numbers population — the value of resolving ALL uncertainty
 * before choosing. It captures OPTION SWITCHING, which the per-factor
 * `factor_evppi` ranking cannot: each of those rows scores one unknown on its
 * own, and the pinned schema caps each of them AT this total
 * (`@talchain/schemas` `dist/boundary/enrichment.d.ts`: "Strong–Oakley
 * regression EVPPI, OUTCOME units, >= 0, capped at decision_evpi").
 *
 * THE ABSENCE RULE IS THE CONTRACT, VERBATIM. From the pinned schema's own
 * `.describe()` on this field (`dist/boundary/enrichment.js`, vendored tarball):
 *
 *   "Absence means NOT COMPUTED — never 0. A measured 0 is a real result
 *    (nothing about this decision is worth learning) and must be preserved.
 *    The wire carries no discriminator between the two beyond key presence, so
 *    a consumer coalescing with `?? 0` converts 'we did not compute this' into
 *    'we measured that information is worthless here'."
 *
 * That paragraph is the ENTIRE licence for this module, and it is why the
 * return type has THREE members rather than a number-or-null: the two absences
 * the wire cannot distinguish from each other are one verdict, and the measured
 * zero — which the contract calls "a real result" — is its own.
 *
 * ⛔ WHAT THIS CANNOT SAY, AND WHY. `decision_evpi` arrives with **no noise
 * floor, no confidence interval and no `n_samples` of its own** — unlike a
 * `factor_evppi` row, which carries `noise_floor`, `n_samples`, `clamped_low`,
 * `clamped_high` and a `status` band. So a SMALL POSITIVE VALUE IS NOT
 * DISTINGUISHABLE FROM ESTIMATOR NOISE on the wire we have, and
 * "there is value in learning more" is NOT a licensed claim. The ceiling is
 * "this run did not come back at zero" — a statement about the returned value,
 * framed as the absence of the zero measurement.
 *
 * Borrowing `factor_evppi.noise_floor` as a decision-level threshold is
 * specifically forbidden: it is a permutation null for a per-factor regression,
 * a DIFFERENT ESTIMAND from `min_o expected_regret` on the CRN population.
 * Substituting one for the other is exactly what `voiRanking.ts`'s
 * "ABSENT ≠ ZERO, EVERYWHERE … DEGRADE, NEVER FABRICATE" forbids one level down.
 *
 * NO CONSTANTS. There is no threshold, no ratio, no band and no cross-estimator
 * inference anywhere in this file. That is not minimalism for its own sake: it
 * is the largest honest claim available without a Paul ruling on whether the UI
 * may hold a threshold constant at all. A ratio band
 * (`evppi_rank1 / decision_evpi`) is dimensionless and cap-bounded to [0,1] and
 * is the natural next slice — and it is deferred ON THAT RULING, not on a
 * contract gap.
 *
 * NO MAGNITUDE LEAVES THIS MODULE. The number is read, classified, and dropped.
 * The verdict is a string enum, so there is no path by which a digit can reach
 * the DOM from here — the same structural guarantee `voiRanking.ts` gives for
 * the per-factor rows.
 */

/**
 * The three states the wire can put us in — no more, and never fewer.
 *
 * · `not_computed`     — absent, `null`, or a non-finite/non-number value.
 *                        The surface renders NOTHING. Never a placeholder,
 *                        never a zero, never "unknown".
 * · `measured_zero`    — exactly `0`. The contract calls this "a real result
 *                        (nothing about this decision is worth learning)", and
 *                        it is the ONE state in this family where a no-effect
 *                        claim is genuinely licensed.
 * · `measured_non_zero`— finite and not zero. Licenses "did not come back at
 *                        zero" and NOTHING stronger (see the header).
 */
export type DecisionVoiVerdict = 'not_computed' | 'measured_zero' | 'measured_non_zero'

/**
 * Classify `report.decision_evpi`.
 *
 * `unknown` in, deliberately: this reads a field the report type declares but
 * whose value arrives from the wire through a passthrough, so the type is a
 * promise about the KEY and not about the value. Validating here rather than at
 * the declaration keeps the one verdict in one place.
 *
 * `Number.isFinite` is the ES2015 STATIC, not the coercing global: it returns
 * `false` for a non-number without converting it, so it carries the
 * "is a number" half of the check too. A preceding `typeof v === 'number'`
 * guard could not fail independently of it. NaN and ±Infinity are therefore
 * `not_computed` — a value we cannot read is a value we decline to classify,
 * and the fail-safe direction is silence.
 *
 * ⚠ `=== 0` matches `-0` as well, which is correct: the producer declares the
 * field `>= 0` by construction (a minimum of non-negative regrets), so a
 * signed zero is the same measured zero and must not fall through to the
 * non-zero branch.
 */
export function readDecisionVoi(raw: unknown): DecisionVoiVerdict {
  if (!Number.isFinite(raw)) return 'not_computed'
  return (raw as number) === 0 ? 'measured_zero' : 'measured_non_zero'
}
