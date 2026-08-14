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
