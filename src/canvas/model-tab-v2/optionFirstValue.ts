/**
 * ⭐ AN OPTION'S FIRST EFFECT VALUE — the question and the reference line the
 * direct input needs, in one place.
 *
 * THE USER PROBLEM (Paul's manual test, 23 Sep 2026): an option added in chat,
 * its size given four times, never analysed — it had no effect values, and the
 * only route this product offered to give it one was a typed sentence. The
 * option's detail region now renders an input per factor the option is LINKED
 * to and does not yet change; Save sends `option_intervention_edit` through
 * `useModelEditAuthority.proposeOptionIntervention`.
 *
 * THE CONTRACT: CEE `src/orchestrator-v5/system-events/option-intervention-edit.ts`
 * `prepareOptionInterventionEdit` (CEE staging `140917d0`) prepares a write
 * when the option has NO existing intervention for the factor, provided
 * `linkedFactorsOf(graph, option)` includes it. The UI's equivalent reader is
 * `buildOptionInterventionCandidates` (`adapters.ts`).
 */

import type { OptionInterventionCandidate } from './types'
import { formatSmartNumber } from '../components/model-tab/utils'

/** The input's question. Names, never ids — both arguments are resolved labels. */
export function firstValueQuestion(optionLabel: string, factorLabel: string): string {
  return `What does ${optionLabel} change ${factorLabel} to?`
}

/**
 * The reference line beside the input, or `null` when the factor records
 * nothing to show.
 *
 * ⚠ THE 0–1 NUMBER IS THE POINT, NOT DECORATION. The input takes the existing
 * option editor's model scale (0 to 1 — `buildOptionInterventionEditEvent`
 * refuses anything else), while the factor's own value is in its real unit
 * ("£20,000"). Showing only the unit value would invite the reader to type
 * 15000 and be refused; showing where the factor stands on the input's own
 * scale lets them answer the question asked.
 *
 * ⚠ AN ESTIMATE IS LABELLED AS OLUMI'S. It renders only when no supplied value
 * exists (the outline row's own `estimateText` condition), and never as though
 * it were the user's number.
 */
export function firstValueReference(c: OptionInterventionCandidate): string | null {
  const scale =
    c.factorModelValue === null ? null : `${formatSmartNumber(c.factorModelValue)} on the 0–1 scale`
  if (c.factorValue !== null) return scale ? `Now ${c.factorValue} (${scale})` : `Now ${c.factorValue}`
  if (c.factorEstimate !== null) {
    return scale ? `Olumi estimates ${c.factorEstimate} (${scale})` : `Olumi estimates ${c.factorEstimate}`
  }
  return scale ? `Now ${scale}` : null
}

/*
 * ⛔ WITHDRAWN (Panel F1 on #1911): ~~`optionStoredEffectsAreUnaddable` and
 * `OPTION_STORED_EFFECTS_UNADDABLE_NOTICE` — "Not saved — this option's stored
 * effect list is in a form Olumi cannot add to yet"~~. They chose that sentence
 * from a canvas `interventions: null` on every `unverified` settlement, where a
 * write may have landed, and the cause they named cannot occur: CEE's
 * persistence projection coerces a null `interventions` to `{}`
 * (`normalise-option-interventions.ts` `sweepInvalidNodeInterventions`). An
 * `unverified` send says "could not confirm", whatever the stored shape.
 */
