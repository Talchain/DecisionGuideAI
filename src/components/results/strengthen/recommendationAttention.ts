/**
 * A recommendation, expressed as something Olumi can hold your attention on.
 *
 * ⭐ WHY THIS NEEDS NOTHING FROM THE PRODUCER, AND WHY THAT IS THE POINT.
 *
 * The attention channel (`canvas/utils/olumiAttention.ts`) shipped able to be
 * raised by exactly one thing: a CEE `ui_directive` carrying a note. That is
 * roughly one conversational path, so the treatment was effectively dark while
 * ~7 user-triggered surfaces already called `focusModelTarget` and got a bare
 * viewport move.
 *
 * Every field the note wants is ALREADY on the recommendation the user is
 * looking at when they click "Show on canvas". Nothing here is composed,
 * inferred or invented — this maps producer text onto a display shape:
 *
 *   rec.title      → the card's title      (the engine's own "what")
 *   signal/whyNow  → the card's body       (via the SAME `strengthenWhyLine`
 *                                           the panel renders, so the canvas
 *                                           and the panel cannot diverge)
 *   rec.sourceLine → the card's sourceLine (verbatim — the note's own contract
 *                                           says "never composed here")
 *   rec.action     → the card's action     (its `prompt` is already a QUESTION;
 *                                           the card sends it through the same
 *                                           `openAskOlumi` the panel button does)
 *
 * ⚠ THE MOVE IS DERIVED FROM `helpType`, WHICH THE ENGINE OWNS — never guessed
 * from the copy. `helpType` is the engine's own classification of what kind of
 * help this is, so the card's verb is the engine's judgement re-presented, not
 * a second opinion minted in the UI. A UI that decided for itself that a
 * recommendation was a "challenge" would be originating reasoning semantics,
 * which is the line this whole surface is built not to cross.
 */

import type { OlumiAttentionNote } from '../../../canvas/utils/olumiAttention'
import { strengthenWhyLine } from '../analysisNew/analysisNewCopy'
import type { HelpType, Recommendation } from './strengthenTypes'

/**
 * The engine's help type → the attention card's closed move grammar.
 *
 * ⚠ FAIL-CLOSED, AND `commit` IS DELIBERATELY `null`. None of the four moves
 * honestly describes "record the decision" — it is not a move on the model at
 * all — and inventing the nearest one would put a wrong verb on screen in
 * Olumi's voice. Today `commit` cannot reach this path anyway
 * (`buildRecommendations.ts` gives it `targetId: null`, so "Show on canvas"
 * never renders for it), but the mapping does not RELY on that: a null move
 * means the click still focuses the element and simply raises no card, which
 * is what should happen if a future commit rec gains a target.
 */
const MOVE_BY_HELP_TYPE: Record<HelpType, OlumiAttentionNote['move'] | null> = {
  // Make an existing quantity precise — the same act as checking a value.
  clarify: 'calibrate',
  // Bring in something the model does not yet contain.
  broaden: 'expand',
  // Question something the model asserts.
  challenge: 'challenge',
  // Weigh what is already there against the evidence.
  evaluate: 'calibrate',
  // See the note above. Not a move on the model.
  commit: null,
}

/**
 * Build the note for a recommendation, or `null` when there is nothing honest
 * to say beside the element — in which case the caller focuses without a card.
 */
export function attentionNoteForRecommendation(
  rec: Pick<Recommendation, 'helpType' | 'title' | 'signal' | 'whyNow' | 'sourceLine' | 'action'>,
): OlumiAttentionNote | null {
  const move = MOVE_BY_HELP_TYPE[rec.helpType]
  if (!move) return null

  const body = strengthenWhyLine(rec.signal, rec.whyNow)
  // A card with a heading and no explanation is a label, not a reason to look.
  if (!body) return null

  return {
    move,
    title: rec.title,
    body,
    ...(rec.sourceLine ? { sourceLine: rec.sourceLine } : {}),
    ...(rec.action?.label
      ? {
          actions: [
            {
              // Stable within the card, and derived from the move rather than
              // from the label text, which is copy and may change.
              id: `strengthen-${move}`,
              label: rec.action.label,
              // The engine's own prompt, unmodified. It is phrased as a
              // question; re-writing it here would be the UI putting words in
              // the producer's mouth.
              ...(rec.action.prompt ? { prompt: rec.action.prompt } : {}),
            },
          ],
        }
      : {}),
  }
}
