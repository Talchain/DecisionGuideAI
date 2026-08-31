/**
 * notAnalysedCopy — THE single source for what the results panel says about an
 * option the run never analysed.
 *
 * ## Why a new module rather than reusing existing wording
 *
 * The nearest existing copy is the pre-analysis V2 "Needs mapping" pill
 * (`pre-analysis/OptionPreview.tsx`). It is DARK on staging: `netlify.toml`
 * sets `VITE_FEATURE_PRE_ANALYSIS_V3 = "1"` and `OutputsDock` mounts
 * `PreAnalysisPanelV3` on that flag, so the V2 panel that hosts the pill never
 * renders. There is therefore no results-path copy source to reuse, and this
 * module is a genuine single source rather than a fourth mirror of an existing
 * one (CLAUDE.md trap 12 — the hand-maintained mirror is this estate's dominant
 * defect, so the test is whether the thing being mirrored is LIVE).
 *
 * ## The resolve prompt is the PRODUCER's route, not one we invented
 *
 * `resolveOptionPrompt` reproduces the sentence CEE itself tells users to say.
 * Witnessed on a live captured turn
 * (`src/v5/__tests__/fixtures/live-analysis-turn-critique-degenerate-2026-08-08.json`):
 * CEE emits *"To score it separately, say 'Help me configure Migrate to
 * Salesforce.'"* and the captured user message that follows is exactly
 * `"Help me configure Migrate to Salesforce."`. That fixture is a HISTORIC
 * RECORD (trap 14b): read, never edited. Minting our own phrasing here would
 * be a second route to one capability, and only one of them would be the one
 * the assistant is trained to answer.
 *
 * ## One reason gets an action and one does not, deliberately
 *
 * `no_interventions` is user-actionable: the option has nothing set, and saying
 * what it changes fixes it. `not_returned` is not — the user has already done
 * their part and the engine returned nothing. Offering a configure step there
 * would prescribe a futile action, which is worse than a disclosure that simply
 * reports. Same rule CEE applies to its own status-quo hold disclosure.
 */

import type { NotAnalysedReason } from './notAnalysedOptions'

/** The pill on the card. Names the state; claims nothing about quality. */
export const NOT_ANALYSED_BADGE = 'Not analysed'

/**
 * Why this option carries no rank and no probability.
 *
 * Both sentences state the CONSEQUENCE explicitly ("no rank and no
 * probability") rather than leaving the reader to infer it from an empty card.
 * A card that silently omits numbers reads as a rendering gap; a card that says
 * why reads as a decision.
 */
export function notAnalysedReasonCopy(reason: NotAnalysedReason): string {
  return reason === 'no_interventions'
    ? 'This option has no values set yet, so it was left out of the comparison. It has no rank and no probability.'
    : 'The analysis returned no result for this option, so it has no rank and no probability.'
}

/**
 * The label on the resolve affordance, or `null` when there is nothing for the
 * user to do. `null` is meaningful and must not be defaulted to a generic
 * "Fix it" — see the module header.
 */
export function notAnalysedActionLabel(reason: NotAnalysedReason): string | null {
  return reason === 'no_interventions' ? 'Tell Olumi what it changes' : null
}

/**
 * The chat message the resolve affordance sends — CEE's own documented route.
 *
 * The label is interpolated verbatim from the graph node, exactly as CEE does
 * with its own label slot, so the assistant receives the same string it would
 * have received had the user typed the sentence CEE suggested.
 */
export function resolveOptionPrompt(optionLabel: string): string {
  return `Help me configure ${optionLabel}.`
}

// ─── NOT COMPUTED — a DIFFERENT state, beside "not analysed", never merged ───

/**
 * The pill on a card whose computation produced no usable result.
 *
 * ⚠ DELIBERATELY NOT `NOT_ANALYSED_BADGE`. "Not analysed" would be FALSE here:
 * the option WAS analysed — it was submitted, ISL ran on it and classified the
 * outcome. Reusing that pill would attribute an engine failure to the user's
 * configuration, which is the "lie about whose fault it is" the sibling
 * predicate's docblock refuses.
 *
 * ⛔ AND IT MUST NOT READ AS A VERDICT ON THE OPTION. "Not computed" names the
 * state of the COMPUTATION. Anything scoring the option — "no result",
 * "unavailable", a dash, an empty slot — invites the reader to fill the gap
 * with "it lost", and on this card the gap sits exactly where every sibling
 * card prints a win share.
 */
export const NOT_COMPUTED_BADGE = 'Not computed'

/**
 * Why this option carries no rank and no probability, when the PRODUCER sent no
 * reason of its own.
 *
 * ## Every clause here is load-bearing
 *
 * - *"ran on this option"* — distinguishes it from the not-analysed card, which
 *   says the option was left out. Both cards are numberless and a reader who
 *   cannot tell them apart learns nothing from either.
 * - *"could not produce a usable result"* — the producer's actual claim
 *   (`n_valid === 0`: zero finite samples), stated as a property of the RUN.
 * - *"no rank and no probability"* — states the CONSEQUENCE explicitly, the same
 *   rule {@link notAnalysedReasonCopy} follows: a card that silently omits
 *   numbers reads as a rendering gap; a card that says why reads as a decision.
 * - *"not a verdict on the option"* — the one sentence this whole change exists
 *   for. The state it replaces rendered a hard `0%` and a zero-width bar in the
 *   position where every other card shows how often that option came out ahead,
 *   so the default reading of a numberless card in a ranked list is "it lost".
 *   Saying so is TRUE: zero valid samples is a statement about the simulation,
 *   and carries no information about the option's merit either way.
 *
 * ⚠ NO ACTION IS OFFERED, and that is deliberate. There is nothing the user can
 * do about a degenerate sample draw, and a disclosure that prescribes a futile
 * action is worse than one that reports — the same rule `not_returned` follows
 * in {@link notAnalysedActionLabel}.
 */
export const NOT_COMPUTED_REASON_COPY =
  'The analysis ran on this option but could not produce a usable result, so it has no rank and no probability. This is not a verdict on the option.'

/**
 * What the card says: the producer's own sentence when it sent one, otherwise
 * the sanctioned sentence above.
 *
 * ⚠ THE PRODUCER'S REASON IS ADDED TO THE SANCTIONED SENTENCE, NEVER
 * SUBSTITUTED FOR IT. ISL's `status_reason` is a short internal phrase
 * ("Analysis could not be completed", "Blocked by: <CODE>") written for an
 * operator, and it states neither the consequence nor the non-verdict. Shown
 * alone it would leave the reader to infer both from an empty row — the exact
 * gap this copy exists to close.
 *
 * ⚠ AND IT IS ABSENT FROM ALL 12 LIVE CAPTURES in `src/v5/__tests__/fixtures/`.
 * The common path is therefore the `undefined` arm, so that arm has to be
 * complete on its own — the producer's reason is an enrichment, never the thing
 * that licenses the disclosure.
 */
export function notComputedReasonCopy(producerReason: string | undefined): string {
  return producerReason === undefined
    ? NOT_COMPUTED_REASON_COPY
    : `${NOT_COMPUTED_REASON_COPY} The analysis reported: ${producerReason}`
}
