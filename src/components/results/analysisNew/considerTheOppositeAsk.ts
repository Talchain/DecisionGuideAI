/**
 * considerTheOppositeAsk — ONE place that decides whether "What would change
 * your mind?" may speak as a FINDING or only as a TECHNIQUE, and composes the
 * ask either way.
 *
 * ⭐⭐ WHY IT IS A MODULE AND NOT A TERNARY IN THE COMPONENT.
 *
 * The distinction is the product claim. A component that inlined it would put
 * the honesty rule inside a render tree, where the only way to test it is to
 * mount something — and where the next surface that wants this act would write
 * the ternary again, slightly differently, which is how one concept acquires
 * two carriers. The rule is a function of the data, so it lives with the data.
 *
 * ── THE RULE ───────────────────────────────────────────────────────────────
 *
 *   GROUNDED   `condition.quantity` is present. The run calculated a reversal
 *              condition AND a figure survived into the sentence the tab
 *              already renders. The question names the producer's own factor
 *              and the producer's own threshold.
 *
 *   TECHNIQUE  `condition` exists but `quantity` does not — `glanceCondition`'s
 *              "{label} changes materially" arm, where the producer found a
 *              flip but neither a printable unit nor a `current_value` made the
 *              number placeable. The act is offered as a reasoning technique
 *              and claims no computation.
 *
 *   NOTHING    `condition` is null. There is no reversal finding on this run,
 *              so there is nothing for this act to be ABOUT. It renders no
 *              control at all — not a disabled one. A control that cannot act
 *              is an advertisement, and the greyed permanently-dead Undo pair
 *              is the counter-example this estate has been told about twice.
 *
 * ⚠⚠ WHY `quantity` AND NOT THE SENTENCE. All three of `glanceCondition`'s arms
 * produce a non-empty `text`, so "is there a figure here?" cannot be read off
 * it without matching prose — and a prose match would silently start answering
 * a different question the first time the wording changed. `quantity` is the
 * structured answer, set by the same branch that composed the sentence.
 *
 * ⚠ THE TECHNIQUE IDENTITY IS THE CATALOGUE'S, NOT THIS MODULE'S. The ask
 * carries `method_id: 'consider_opposite'` and that entry's own accepted CEE
 * intent, so CEE resolves the SAME DSK protocol it already resolves for the
 * technique, and the product does not acquire a second consider-the-opposite.
 * `METHOD_CATALOGUE` remains the authority on both; they are read from it here
 * rather than restated, so a rename in the catalogue is a loud failure and not
 * a silently-unrouted turn.
 *
 * ⛔ IT ASKS. IT NEVER EDITS. The measured finding behind that choice is
 * recorded in `WhatIWasGivenSection.tsx`: across 15 arms over 5 rounds against
 * the live CEE router, every ADD phrasing a receipt could compose was refused,
 * and every ASK phrasing was answered with concrete, model-grounded options.
 * The user's answer is what may later become an edit, through the existing
 * writers, on a later turn. Two honest steps beat one false promise.
 */

import { METHOD_CATALOGUE } from '../decision-overview/actionsCatalogue'
import { ANALYSIS_NEW_COPY } from './analysisNewCopy'
import type { GlanceCondition } from './analysisNewTypes'

/**
 * The catalogue entry this act IS. Looked up rather than restated, so a rename
 * cannot leave the ask pointing at a `method_id` CEE will not recognise while
 * everything still renders (trap 12 — derive, do not mirror).
 */
const CONSIDER_OPPOSITE_ID = 'consider_opposite'

/** Which of the two honest claims this act is entitled to make. */
export type ChangeYourMindForm = 'grounded' | 'technique'

export interface ChangeYourMindAsk {
  form: ChangeYourMindForm
  /** The sentence rendered beside the control. */
  lead: string
  /** The drawer's context line. Same sentence; the drawer states its own basis. */
  context: string
  /** The PREFILLED, EDITABLE question. The user reads and sends; nothing auto-sends. */
  draft: string
  /** Dispatch label. */
  label: string
  /** `{ method_id }`, so CEE learns which technique the user invoked. */
  parameters: Record<string, unknown>
  /** The catalogue entry's own accepted intent, or absent. The gate fails closed. */
  intent?: string
  /** Canvas focus target carried through, or absent. Never fabricated. */
  targetId?: string
}

/**
 * Compose the act for a run, or `null` when the run has no reversal finding.
 *
 * ⚠ RETURNS `null` RATHER THAN A DISABLED SHAPE. The caller renders nothing at
 * all for `null`; there is no third "offered but inert" state to get wrong.
 */
export function buildChangeYourMindAsk(
  condition: GlanceCondition | null | undefined,
): ChangeYourMindAsk | null {
  if (!condition) return null

  const entry = METHOD_CATALOGUE.find((m) => m.id === CONSIDER_OPPOSITE_ID)
  const copy = ANALYSIS_NEW_COPY.changeYourMind
  const targetId =
    typeof condition.targetId === 'string' && condition.targetId.length > 0
      ? condition.targetId
      : undefined

  /**
   * ⚠ BOTH HALVES, NOT EITHER. A `quantity` carrying an empty factor label or
   * an empty threshold could not compose a sentence that names anything, and
   * "This run put the point where the ordering changes at  for " is a grounded
   * claim about nothing. The gate is the sentence's own precondition.
   */
  const q = condition.quantity
  const grounded =
    !!q && typeof q.factorLabel === 'string' && q.factorLabel.length > 0 &&
    typeof q.thresholdText === 'string' && q.thresholdText.length > 0

  const base = {
    label: copy.actLabel,
    parameters: { method_id: CONSIDER_OPPOSITE_ID },
    ...(entry?.intent ? { intent: entry.intent } : {}),
    ...(targetId ? { targetId } : {}),
  }

  if (grounded) {
    const lead = copy.groundedLead(q!.factorLabel, q!.thresholdText)
    return {
      ...base,
      form: 'grounded',
      lead,
      context: lead,
      draft: copy.groundedDraft(q!.factorLabel, q!.thresholdText),
    }
  }

  return {
    ...base,
    form: 'technique',
    lead: copy.techniqueLead,
    context: copy.techniqueLead,
    /**
     * ⚠ THE CONDITION'S OWN PROSE IS NOT SPLICED IN HERE. On this arm the only
     * thing the producer gave us is an unplaceable sentence; passing it to the
     * model as though it were a quantity would launder prose into a figure,
     * which is the fabrication the whole distinction exists to prevent.
     */
    draft: copy.techniqueDraft,
  }
}
