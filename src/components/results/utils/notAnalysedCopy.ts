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
 * THE USER TOOK IT OUT (schemas 0.69.0 `excluded_infeasible` / `excluded_removed`): the DL's words (5932328304), one
 * wording on the panel and the canvas card. It is the user's own act, so never "Not analysed" or "not compared", and it
 * holds on any Run that recorded it.
 */
export const TAKEN_OUT_INFEASIBLE_LABEL = 'Taken out: not feasible'
export const TAKEN_OUT_REMOVED_LABEL = 'Taken out'
export function takenOutLabel(reason: NotAnalysedReason): string | null {
  if (reason === 'taken_out_infeasible') return TAKEN_OUT_INFEASIBLE_LABEL
  if (reason === 'taken_out_removed') return TAKEN_OUT_REMOVED_LABEL
  return null
}

/** The badge beside the option's name: the taken-out label when the user took it out, else "Not analysed". */
export function notAnalysedBadge(reason: NotAnalysedReason): string {
  return takenOutLabel(reason) ?? NOT_ANALYSED_BADGE
}

/**
 * Why this option carries no rank and no probability.
 *
 * Both sentences state the CONSEQUENCE explicitly ("no rank and no
 * probability") rather than leaving the reader to infer it from an empty card.
 * A card that silently omits numbers reads as a rendering gap; a card that says
 * why reads as a decision.
 */
export function notAnalysedReasonCopy(reason: NotAnalysedReason, resultsCurrent = true): string {
  const takenOut = takenOutLabel(reason)
  if (takenOut !== null) return takenOut
  if (reason === 'excluded_olumi_proposed') return OLUMI_PROPOSED_EXCLUDED_COPY
  // ⛔ AIQ pre-share hold (R3 B0 S3): on a Run that is not current, the option may have been added after it — "left out
  // of the comparison" is a claim about that Run. The graph fact stays; the Run claim goes.
  if (reason === 'no_interventions' && !resultsCurrent) return NOT_ANALYSED_NO_VALUES_NOT_CURRENT
  return reason === 'no_interventions'
    ? 'This option has no values set yet, so it was left out of the comparison. It has no rank and no probability.'
    : NOT_ANALYSED_NO_RESULT_COPY
}

/**
 * ⛔ CAUSE-NEUTRAL, AND THAT IS THE POINT (AIQ #75 5924727155). `not_returned` means: configured, absent from the
 * comparison, and NO participation record. That covers a computation that came back empty AND an option CEE left out
 * on purpose (an unadopted Olumi suggestion, whose typed fact CEE does not emit yet: Panel #75 5924723004). "The
 * analysis returned no result" told Paul the analysis failed on an option it never ran, so he could re-run for a result
 * that will never come. This sentence is true of both causes and names neither.
 */
export const NOT_ANALYSED_NO_RESULT_COPY = 'This run has no result for this option, so it has no rank and no probability.'

/**
 * The Run's typed participation fact (Runtime #72 5888341208), said as it is. Olumi's proposal is never presented as the
 * user's option or as endorsed (AIQ 5887015488, DL 5887510885). Meaning: AIQ.
 */
export const OLUMI_SUGGESTION_TAG = "Olumi's suggestion"
export const OLUMI_RISK_NOT_IN_CHANCE_SUFFIX = 'not in the chance'
/** `kept_olumi_provisional`'s tag suffix. Not "provisional": that word already means "rests on Olumi's assumptions" (AIQ 5888943993). */
export const OLUMI_KEPT_TAG_SUFFIX = 'compared for now'
/**
 * The Reasoning row's short form (DL 58e392 GO, 8 Oct 2026; Paul: "very punchy … additional helpful context under
 * progressive disclosure"): the fact at rest, the rest under the row's chevron. `OLUMI_PROPOSED_EXCLUDED_COPY` is the two
 * joined, so every surface that says it whole says exactly these words.
 */
export const OLUMI_PROPOSED_EXCLUDED_SHORT = "Olumi's suggestion, so this run left it out."
export const OLUMI_PROPOSED_EXCLUDED_DETAIL =
  "It isn't one of yours, so this run compared your options without it. It has no rank and no probability."
export const OLUMI_PROPOSED_EXCLUDED_COPY = `Olumi suggested this option. ${OLUMI_PROPOSED_EXCLUDED_DETAIL}`
/**
 * `kept_olumi_provisional`: the comparison kept Olumi's option. WITH ids, because the gate excluded the user's own
 * option(s) — they are named. WITHOUT ids, because the user named fewer than two options: nothing failed, so nothing is
 * said to be unanalysable (DL CHANGES_REQUIRED on #2305; Runtime 5888591648). Meaning: AIQ.
 */
export type OlumiKeptCause =
  /** The fact names no ids (the no-ids keep cannot tell WHY fewer than two of the user's options were compared). */
  | { readonly kind: 'fewer_than_two' }
  /** The fact names ids and every one resolves to a label on the canvas. */
  | { readonly kind: 'named'; readonly labels: readonly string[] }
  /** The fact names ids that no longer all resolve (e.g. an option since deleted): no cause is claimed. */
  | { readonly kind: 'unresolved' }
export function olumiProposedKeptCopy(cause: OlumiKeptCause): string {
  // AIQ 5889823627: true whether the user named fewer than two options or one of theirs could not be analysed — so it
  // also serves ids the canvas can no longer name, and never claims which cause it was.
  if (cause.kind === 'fewer_than_two' || cause.kind === 'unresolved') {
    return 'Olumi suggested this option. It is compared only because fewer than two of your own options could be compared in this run, so this run puts no option forward.'
  }
  const named = cause.labels.map((l) => `\u2018${l}\u2019`)
  const who = named.length === 1 ? named[0] : `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`
  return `Olumi suggested this option. It is compared only because ${who} can't be analysed yet, so this run puts no option forward.`
}

/*
 * ⛔⛔ THE FOURTH-WORLD SENTENCE WAS WITHDRAWN, AND THE WITHDRAWAL IS RECORDED
 * HERE RATHER THAN REVERTED SILENTLY.
 *
 * What stood here was `OPTION_LEFT_OUT_AFTER_GRAPH_EDIT_COPY` —
 *
 *   "The last analysis has no result for this option, so it has no rank and no
 *    probability. The graph has changed since that analysis ran — run it again
 *    to see where this option stands."
 *
 * — selected by `optionLeftOutOfRunCopy` when a store flag said the graph had
 * moved since the run. Both are gone, along with the superset reason type in
 * `notAnalysedOptions.ts`. `notAnalysedReasonCopy` is once more the whole copy
 * vocabulary for this family, and the canvas calls it directly.
 *
 * ## The first half of that sentence was right, and it is the part worth keeping
 *
 * *"HAS no result for"* rather than *"RETURNED no result for"* is a real
 * distinction: "returned" asserts the run was ASKED about this option. That
 * observation stands and is not lost — it is why the canvas now WITHHOLDS the
 * `not_returned` arm rather than restating it, when the product cannot vouch
 * for the result on screen.
 *
 * ## The second half asserted a fact nothing could supply
 *
 * *"The graph has changed since that analysis ran"* is a CHANGE ASSERTION, and
 * it was gated on `graphEditedSinceLastRun` — which `resultsLoadHistorical`
 * (`canvas/store.ts:6026`) and `resultsHydrateFromSupabase` (`:6097`) reset to
 * `false` in the same `set()` that installs a restored run. So on the reload
 * path the gate opened and the sentence it was written to prevent came back.
 *
 * ⭐ AND THE HONEST SIGNAL CANNOT RESCUE IT. `useAnalysisResultsAreCurrent`
 * answers *"is this result confirmably about the current graph?"*; its `false`
 * pools 'changed' with 'cannot_confirm'. A restored run is cannot-confirm, and
 * "the graph has changed" is not a true thing to say about cannot-confirm. A
 * claim needing a fact the authority does not hold is a claim to drop, not one
 * to re-gate — which is the whole lesson of this pair of PRs.
 */

/**
 * ⭐ THE KEPT FIRST HALF, AS ITS OWN SENTENCE (canvas card, side-by-side DIFF
 * 27 Sep, item 5). When the result on screen cannot be vouched for, the canvas
 * withholds the `not_returned` sentence but keeps the `Not analysed` state, as
 * `NotAnalysedOptionCard` already does. The card still needs a hover and a
 * screen-reader sentence, and this is the one the note above says was right:
 * "HAS no result", never "RETURNED". It asserts no change, so it is true
 * whether the option was left out of the run or added after it.
 */
export const NOT_ANALYSED_NO_VALUES_NOT_CURRENT =
  'This option has no values set yet, and the last analysis has no result for it. It has no rank and no probability.'

export const NOT_ANALYSED_IN_LAST_ANALYSIS =
  'The last analysis has no result for this option, so it has no rank and no probability.'

/**
 * The label on the resolve affordance, or `null` when there is nothing for the
 * user to do. `null` is meaningful and must not be defaulted to a generic
 * "Fix it" — see the module header.
 */
export function notAnalysedActionLabel(reason: NotAnalysedReason): string | null {
  return reason === 'no_interventions' ? 'Tell Olumi what it changes'
    : reason === 'excluded_olumi_proposed' ? INCLUDE_OLUMI_OPTION_LABEL
      : null
}

/**
 * ⭐ RunView PR 1b (DL 8 Oct; probe 94160333): an unadopted Olumi suggestion the Run left out can be brought in. The
 * press drafts the turn CEE's own adoption door reads (`proposeNewOption`: the suggestion named by its EXACT label in
 * the user's words → an "Add Olumi's suggestion … with the levels shown" approval card; nothing changes until Yes).
 */
export const INCLUDE_OLUMI_OPTION_LABEL = 'Include it'
export function includeOlumiOptionPrompt(optionLabel: string): string {
  return `Add Olumi's suggestion "${optionLabel}" to my comparison.`
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

// ─── EXPLORE AN ALTERNATIVE — the act beside an option the run left out ───

/**
 * The label on the act beside an option the run left out of the comparison.
 *
 * ## It is a QUESTION, because the act is a question
 *
 * The label says what the button does and promises nothing else. Compare
 * `contextIntegrity/WhatIWasGivenSection.tsx`'s `addAction` — *"Where does this
 * fit?"* — the sanctioned shape for an ask on this same tab, adopted here
 * rather than re-invented. That label started life as *"Add this"*, and the
 * product could not do it; the comment above it records 15 arms over 5 rounds
 * against the live CEE router in which every ADD phrasing was refused
 * (`ORPHAN_NODE`, `NO_PATH_TO_GOAL`, `PIPELINE_OWNED_FIELD`) and every ASK
 * phrasing was answered. The same evidence governs this act, so the same
 * conclusion does: it asks.
 *
 * ⛔ NOT *"Bring this into the comparison"*. That names an outcome this act
 * cannot deliver — nothing here mutates the graph, re-runs anything, or can
 * promise the option will be analysable. A label naming an outcome the click
 * does not produce is the permanently-greyed control one level up: it works,
 * and it still lies.
 *
 * ⚠ CHECKED AGAINST THE WHOLE TAB BEFORE IT WAS CHOSEN, because two things
 * under one name is this estate's signature defect. `StrengthenTheReasoning`
 * renders *"Ask what this analysis might be missing"* on THIS tab, which is
 * why this is not an *"Ask what…"* label; `decision-overview` owns the stem
 * *"What would it take to …?"*; `OptionCards` (Analysis tab) owns *"Explore a
 * different approach"* and the catalogue owns *"Explore trade-offs"*, which is
 * why it is not an *"Explore…"* label either. Measured at this tip: this exact
 * string occurs nowhere else in `src/`.
 */
export const BRING_INTO_COMPARISON_LABEL = 'What would bring this in?'

/**
 * The question the act sends: the option, the run's OWN stated ground for
 * leaving it out, and the ask.
 *
 * ## THE GROUND IS SWITCHED ON, NEVER AVERAGED
 *
 * The two reasons are not two spellings of one state, and the difference is
 * exactly the honesty rule this act has to satisfy:
 *
 *   · `no_interventions` — NOTHING WAS COMPUTED ABOUT THIS OPTION. It was never
 *     submitted, because there was nothing to submit. A question that said the
 *     analysis returned nothing for it would assert a computation that never
 *     happened, on the one card whose whole subject is a missing computation.
 *   · `not_returned` — it is configured and this run has nothing for it. That is
 *     an engine miss OR a deliberate exclusion CEE has not typed yet, so the
 *     ground names neither cause (AIQ 5924727155): "you have not set this up"
 *     would blame the user, and "the analysis returned no result" would blame
 *     the engine for an option it may never have run.
 *
 * Each arm states only what its own ground licenses. Neither implies the option
 * was scored, compared, or found wanting, and neither promises that answering
 * will get it into the comparison — the engine may well reply that it cannot.
 *
 * ⚠ THE GROUNDS ARE BOTH STATED, AND THERE IS NO THIRD "no reason known" ARM,
 * because at this tip there is no such run. `deriveNotAnalysedReason`
 * (`utils/notAnalysedOptions.ts`) is TOTAL over the two-value union and the
 * single live producer (`useResultsSectionData.ts:2227`) sets `notAnalysed` and
 * `notAnalysedReason` in one object literal, so an option cannot reach a
 * surface marked not-analysed with the reason missing. A technique arm would be
 * unreachable code dressed as an honesty guarantee.
 *
 * The label is interpolated bare, exactly as {@link resolveOptionPrompt} does
 * it, so the assistant receives the option's own name in the slot it expects.
 */
export function bringIntoComparisonQuestion(
  optionLabel: string,
  reason: NotAnalysedReason,
): string {
  const ground =
    reason === 'no_interventions'
      ? `${optionLabel} has no values set yet, so it was left out of the comparison.`
      : `This run has no result for ${optionLabel}.`
  return `${ground} What would it take to bring it in?`
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
