/**
 * ⭐ AN OPTION'S FIRST EFFECT VALUE — the copy and the two predicates the
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

/**
 * ⚠ KNOWN CEE EDGE — NOTED, NOT FIXED HERE.
 *
 * CEE refuses `invalid_existing_intervention` when the stored option carries an
 * `interventions` field that is PRESENT but not a plain object — `null` being
 * the case met in practice — rather than an absent field
 * (`prepareOptionInterventionEdit`: `interventions !== undefined && (null ||
 * typeof !== 'object' || Array.isArray)` ⇒ refuse). The refusal reaches the
 * browser only as the generic 422 `system_event_refused_no_write`: the specific
 * reason is logged by CEE's dispatcher, not sent. So the UI cannot read the
 * cause off the wire, and names it from the stored shape it can see — the same
 * shape CEE's check reads, since the canvas node's data is CEE's node verbatim
 * (`mapDraftNodeToCanvas` spreads it).
 *
 * This mirrors CEE's predicate exactly — including that an ABSENT field is
 * fine — and is used ONLY to choose the sentence after a send did not land. It
 * never gates the input and never claims a write.
 */
export function optionStoredEffectsAreUnaddable(data: unknown): boolean {
  if (data === null || typeof data !== 'object') return false
  if (!Object.prototype.hasOwnProperty.call(data, 'interventions')) return false
  const interventions = (data as { interventions?: unknown }).interventions
  if (interventions === undefined) return false
  return interventions === null || typeof interventions !== 'object' || Array.isArray(interventions)
}

/** The sentence for that refusal. States the cause, and a route that works today. */
export const OPTION_STORED_EFFECTS_UNADDABLE_NOTICE =
  'Not saved — this option’s stored effect list is in a form Olumi cannot add to yet ' +
  '(a known Olumi issue, not a problem with your number). Ask Olumi in the conversation to set it.'
