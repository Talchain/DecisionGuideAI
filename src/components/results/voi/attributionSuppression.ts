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
 * defect arriving from the consumer side.
 *
 * ⚠⚠ WHAT `suppressed_attributions` ACTUALLY CONTAINS — CORRECTED AT THE
 * PRODUCER'S BYTES, BECAUSE THIS MODULE'S FIRST VERSION HAD IT WRONG.
 *
 * It does NOT name factors. It is ISL's manifest of withheld ATTRIBUTION
 * KINDS, drawn from a closed FOUR-member vocabulary declared as module
 * constants at `src/models/response_v2.py:1437-1440` (ISL staging `28fe0c9`):
 *
 *     SUPPRESSED_ATTR_FACTOR_SENSITIVITY   = "factor_sensitivity"
 *     SUPPRESSED_ATTR_STABILITY_THRESHOLDS = "stability_thresholds"
 *     SUPPRESSED_ATTR_CONDITIONAL_WINNERS  = "conditional_winners"
 *     SUPPRESSED_ATTR_P_WIN_SENSITIVITY    = "p_win_sensitivity"
 *
 * The field's own `.describe()` says so too (`response_v2.py:1481-1489`):
 * "Independence-assuming per-factor attributions omitted under active
 * correlation (e.g. factor_sensitivity, p_win_sensitivity,
 * conditional_winners)". Factor NODE IDS are a DIFFERENT field on the same
 * block — `correlated_factors: List[str]` (`response_v2.py:1459-1462`). PLoT
 * says it verbatim as well (`src/lib/driver-order.ts:351-352`: "the members are
 * ATTRIBUTION NAMES ... not factor ids").
 *
 * ⭐ WHY THIS READS THE MEMBER AND NOT THE LENGTH — the correction that matters
 * most, because the surface it licenses names ONE estimand.
 *
 * The manifest is RECORD-not-PREDICT: ISL appends at each SKIP SITE, so its
 * membership is a function of which phases were requested and ran
 * (`src/services/robustness_analyzer_v2.py`):
 *
 *   :2351-2360  `factor_sensitivity` + `stability_thresholds`
 *               iff `has_uncertainties()` AND `"sensitivity" in analysis_types`
 *   :2373-2375  `conditional_winners`
 *               iff `has_uncertainties()` AND `len(request.options) > 1`
 *   :2585-2587  `p_win_sensitivity`
 *               iff `request.include_voi` AND `has_uncertainties()`
 *
 * Those gates are INDEPENDENT, so a non-empty manifest that does not contain
 * `p_win_sensitivity` is a shape the producer really emits. Reading the LENGTH
 * would light a sentence about win-probability attribution on a run where only
 * `factor_sensitivity` was withheld — a lie, not a gap.
 *
 * That the length reader looks equivalent TODAY is an accident of a PLoT
 * constant: `src/integrations/isl/translator-v3.ts:967` hardcodes
 * `include_voi: true`, and `src/types/engine-v3.ts:707-714` records that an
 * inbound `include_voi` is IGNORED. The day that becomes request-gated the two
 * questions come apart. This module therefore asks the producer's own question,
 * the same one all three sibling services ask:
 *
 *   ISL   `src/utils/response_builder.py:338-347`
 *         `SUPPRESSED_ATTR_FACTOR_SENSITIVITY in ...suppressed_attributions`
 *   PLoT  `src/lib/driver-order.ts:510-511`
 *         `islSuppressedAttributions?.includes('factor_sensitivity')`
 *   CEE   `src/orchestrator-v5/coaching/uncertainty-priority.ts:193`
 *         `suppressed.some((s) => s === 'p_win_sensitivity')`
 *
 * CEE's is the IDENTICAL question to this one, on the identical field. Two
 * services answering one question two different ways is the defect trap 21
 * describes; this module now matches its sibling exactly.
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
 * It also may not name anything. `suppressed_attributions` carries no factor
 * ids to leak, but `correlated_factors` on the same block does — and the
 * neighbouring register already bans id-shaped names outright
 * (`resolveNextCopy.partial`: "Never names WHICH factors"). Nothing on the
 * `correlation_model` object other than the one manifest membership is read
 * here. The count is not rendered either: a count is a magnitude about a
 * suppressed quantity and buys the reader nothing they can act on.
 *
 * NO CONSTANTS, NO THRESHOLDS, NO CROSS-ESTIMATOR INFERENCE. Nothing here reads
 * `factor_evppi`, `decision_evpi` or any noise floor. The producer keeps
 * emitting `factor_evppi` under suppression, so the two are independent states
 * and a reader that mixed them would invent a relationship ISL did not report.
 */

/**
 * The ONE manifest member this module is licensed to act on, spelled as the
 * producer spells it (`SUPPRESSED_ATTR_P_WIN_SENSITIVITY`,
 * `src/models/response_v2.py:1440`).
 *
 * DELIBERATELY NOT A MIRROR OF ALL FOUR. A local copy of the whole vocabulary
 * would be a hand-maintained mirror with nothing to fail it (trap 12), and this
 * module has no use for the other three: it licenses one sentence about one
 * estimand. The other members are exercised as INPUTS in the spec's corpus,
 * which is where they belong — as producer shapes this reader must stay silent
 * about.
 *
 * The spec deliberately does NOT import this constant. It spells the literal
 * out from the producer's bytes so that changing this line REDs the suite
 * instead of moving both sides together (trap 13b — a guard agreeing with
 * itself).
 */
const SUPPRESSED_ATTRIBUTION_P_WIN_SENSITIVITY = 'p_win_sensitivity'

/**
 * The two states this pair of fields can put us in — no more, and never fewer.
 *
 * · `not_attested` — no readable suppression disclosure naming the
 *                    win-probability attribution, OR the attribution arrived.
 *                    The surface renders NOTHING. Never a placeholder, never
 *                    "unknown", never a zero.
 * · `suppressed`   — the producer withheld the per-factor WIN-PROBABILITY
 *                    attribution and named it. Licenses the withholding notice
 *                    and NOTHING stronger.
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
  // ORDER IS LOAD-BEARING, AND THIS BRANCH IS THE FAIL-CLOSED ONE.
  //
  // The producer's rule is that suppression means the field is ABSENT — "absent
  // from the response, not null". So ANY arrived value refutes the manifest,
  // and that includes values this reader cannot parse: an arrived-but-malformed
  // `p_win_sensitivity` is a transport or shape problem, never a producer
  // saying it withheld the attribution.
  //
  // ⚠ THIS IS WHY THE MAPPER CARRIES THE KEY VERBATIM. If a malformed value
  // were narrowed away upstream, present-but-unreadable would arrive here
  // indistinguishable from absent, and the notice would fire on a run whose
  // attribution ISL may well have computed. `mapV5AnalysisToReport.ts` carries
  // the key whenever the producer sent one, precisely so this branch can see
  // it. `null` lands here too, and lands on SILENCE: the contract's suppression
  // signal is absence, and a null is not that signal.
  if (pWinSensitivity !== undefined) return 'not_attested'

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

  if (!Array.isArray(named)) return 'not_attested'

  // MEMBERSHIP, NOT LENGTH — see the header. Exact string identity: no
  // substring, no prefix, no case folding, because the producer emits one exact
  // literal and a near-miss (`p_win_sensitivity_v2`) is a DIFFERENT attribution
  // this surface has no sentence for. An empty manifest falls out of `.some`
  // as `false`, which is the same silence a manifest naming other kinds gets.
  return named.some((member) => member === SUPPRESSED_ATTRIBUTION_P_WIN_SENSITIVITY)
    ? 'suppressed'
    : 'not_attested'
}
