/**
 * attributionSuppression — the reader between ISL's correlation disclosure and
 * the ONE sentence the estate is licensed to say about a withheld per-factor
 * attribution.
 *
 * WHAT THESE FIELDS ARE, IN THE PRODUCER'S OWN WORDS. Both paragraphs are
 * verbatim `.describe()` text from the pinned contract (`@talchain/schemas`
 * 0.48.0, `dist/boundary/enrichment.js:1027-1043`, vendored tarball):
 *
 *   `p_win_sensitivity` — "Percentage-point-of-win OAT deltas. Typed OPEN
 *     (shape owned by ISL, which declares `List[dict]`). ABSENT UNDER ACTIVE
 *     CORRELATION BY DESIGN — ISL suppresses it and names it in
 *     `correlation_model.suppressed_attributions` ('absent from the response,
 *     not null') while `factor_evppi` stays emitted. So absence here is a
 *     SUPPRESSION VERDICT, not a missing convenience. Transport only — pp
 *     display is barred by PP_TOKEN doctrine."
 *
 *   `correlation_model` — "ISL's correlation disclosure — typed OPEN (shape
 *     owned by ISL; observed member: `suppressed_attributions`). It is the
 *     DISCRIMINATOR that makes an absent `p_win_sensitivity` readable as
 *     suppression rather than as 'not computed', which is why the family
 *     travels together: transporting the suppressed field's explanation without
 *     the explanation is the two-states-one-byte defect by construction."
 *
 * That second paragraph is the ENTIRE licence for this module. The UI has been
 * transporting BOTH halves since the VOI family landed (`mapV5AnalysisToReport`
 * carries them verbatim) and reading NEITHER — which is the two-states-one-byte
 * defect arriving from the consumer side: the discriminator is in the browser
 * and the user is told nothing.
 *
 * ⛔ WHAT THIS CANNOT SAY, AND WHY. NO MAGNITUDE, EVER — and here that is not a
 * house style, it is the producer's own instruction ("pp display is barred by
 * PP_TOKEN doctrine"), backed by `__tests__/helpers/refutedEvpiClaimMatchers`'
 * `PP_TOKEN` and by `tests/contracts/no-evpi-display.contract.test.ts`. The
 * verdict is a closed two-member STRING enum, so there is no path by which a
 * digit from the suppressed payload can reach the DOM through this module — the
 * same structural guarantee `decisionVoi.ts` gives one field over, and it is
 * asserted rather than merely described in the spec.
 *
 * It also may not say WHICH factors were suppressed. `suppressed_attributions`
 * names them, but `correlation_model` is `z.object({}).passthrough()` — fully
 * OPEN — so the element shape is not typed, and the neighbouring register
 * already bans id-shaped names outright (`resolveNextCopy.partial`: "Never
 * names WHICH factors"). The count is not rendered either: a count is a
 * magnitude about a suppressed quantity and buys the reader nothing they can
 * act on.
 *
 * NO CONSTANTS, NO THRESHOLDS, NO CROSS-ESTIMATOR INFERENCE. Nothing here reads
 * `factor_evppi`, `decision_evpi` or any noise floor. The producer keeps
 * emitting `factor_evppi` under suppression, so the two are independent states
 * and a reader that mixed them would invent a relationship ISL did not report.
 */

/**
 * The two states this pair of fields can put us in — no more, and never fewer.
 *
 * · `not_attested` — no readable suppression disclosure, OR the attribution
 *                    array actually arrived. The surface renders NOTHING.
 *                    Never a placeholder, never "unknown", never a zero.
 * · `suppressed`   — the producer withheld the per-factor attribution and named
 *                    what it withheld. Licenses the withholding notice and
 *                    NOTHING stronger.
 *
 * There is deliberately NO `not_computed` member. The wire cannot distinguish
 * "ISL never ran this phase" from "ISL ran and emitted nothing readable", and
 * both call for the same behaviour — silence — so minting a third name would be
 * a distinction the surface cannot act on and the wire cannot support.
 */
export type AttributionSuppressionVerdict = 'not_attested' | 'suppressed'

/**
 * `unknown` in, twice and deliberately: both fields arrive through a
 * passthrough, so the report type is a promise about the KEY and not about the
 * value. Validating here rather than at the declaration keeps the one verdict
 * in one place.
 *
 * FAIL-CLOSED IS THE WHOLE DESIGN. `correlation_model` is typed OPEN by the
 * contract, so every shape assumption below can drift under us without a
 * schema bump. The safe direction on any unreadable shape is `not_attested` —
 * silence — because the failure mode of guessing wrong in the other direction
 * is telling a user their analysis withheld something when it did not.
 */
export function readAttributionSuppression(
  correlationModel: unknown,
  pWinSensitivity: unknown,
): AttributionSuppressionVerdict {
  // ORDER IS LOAD-BEARING. If the attribution array actually arrived then
  // nothing was suppressed, whatever the correlation disclosure says — the
  // producer's rule is that suppression means the field is ABSENT. An arrived
  // EMPTY array is still an arrived array: it is ISL reporting no rows, not ISL
  // withholding rows, and those are different claims.
  if (Array.isArray(pWinSensitivity)) return 'not_attested'

  // Plain object only. `typeof null === 'object'` and arrays are objects too,
  // so both are excluded explicitly rather than by hopeful duck-typing.
  if (
    typeof correlationModel !== 'object' ||
    correlationModel === null ||
    Array.isArray(correlationModel)
  ) {
    return 'not_attested'
  }

  const named = (correlationModel as Record<string, unknown>).suppressed_attributions

  // A disclosure that names NOTHING has attested nothing. An empty array is the
  // producer saying it suppressed no attribution, and it must not light the
  // notice — that would be a withholding claim with no withholding behind it.
  if (!Array.isArray(named) || named.length === 0) return 'not_attested'

  return 'suppressed'
}
