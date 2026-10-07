/**
 * ⭐⭐ ONE INVOCATION FOR A SCIENCE-GROUNDED METHOD, WHEREVER IT IS OFFERED.
 *
 * Paul's instruction, 18 Sep 2026: "Surface the Methods menu — make it
 * prominent." That gives `METHOD_CATALOGUE` a SECOND surface, and a second
 * surface is exactly where this estate's dominant defect starts: two call sites
 * build the same payload, one gains a field, and they drift with a red nowhere.
 *
 * So the invocation is built HERE, once. The Reasoning tab's method strip, its
 * Challenge card and `ActionsMenu` all call this and none re-types it.
 *
 * ⭐ A PRESS RUNS THE METHOD (Paul, 7 Oct 2026: the methods "don't seem to be
 * working properly, so we actually need to make them genuinely work"). One press
 * sends one chip turn through `askAi`, the estate's one Ask builder. It used to
 * open the Ask-Olumi drawer with an editable draft, so reaching Olumi took a
 * second press, and the strip's own icons sent nothing at all.
 *
 * ⚠ WHAT REACHES CEE IS THE CHIP ID, NOTHING ELSE. The served agent lane routes
 * by `chip.id`; it reads neither `method_id` nor `chip.intent` (measured at CEE
 * `df15c8c1`: `method_id` in 0 files under `src/`, against 10 for the contrast
 * `agent-next-pre-mortem`). So:
 *   · `pre_mortem` and `different_option` ask through the intents whose press
 *     ids CEE answers with its own method turn (`agent-next-pre-mortem`,
 *     `agent-next-widen`). `askAi` sends the press id only where CEE accepts it
 *     (a current Run) and the plain ask everywhere else.
 *   · every other method sends `ask:method:<catalogue id>`: an ordinary chip
 *     turn, so Olumi's question is never taken as the person's own words and
 *     the change and Run tools stay withheld. CEE has no typed route for these
 *     yet; do not write "runs the protocol" on the strength of this id.
 */
import { askAi, type AskAiResult } from '../../../canvas/conversation/askAi'
import type { AskIntent } from '../../../canvas/conversation/askAiQuestions'
import { openAskOlumi } from '../coaching/askOlumiStore'
import type { MethodEntry } from '../decision-overview/actionsCatalogue'

/**
 * The ONE question each catalogue method asks, by catalogue id. A method with
 * no entry falls back to the drawer; `aMethodPressRunsTheMethod.spec` derives
 * its rows from the catalogue so a new method cannot be left without one.
 */
export const METHOD_ASK_INTENT: Readonly<Record<string, AskIntent>> = {
  reframe_problem: 'method-reframe',
  different_option: 'widen',
  consider_opposite: 'method-opposite',
  outside_view: 'method-outside-view',
  pre_mortem: 'pre-mortem',
  explore_tradeoffs: 'compare-options',
  review_bias: 'method-bias',
}

/** The intents whose chip id `askAi` chooses itself (a CEE press id on a current Run). */
const ROUTED_BY_ASK_AI: ReadonlySet<AskIntent> = new Set<AskIntent>(['widen', 'pre-mortem'])

export const methodAskId = (methodId: string): string => `ask:method:${methodId}`

export type RunMethodResult = AskAiResult | 'drawer'

/**
 * Sends the method's question to Olumi as one chip turn.
 *
 * ⚠ NEVER A DEAD PRESS. With no conversation mounted (`askAi` returns `none`)
 * the method keeps its drawer, whose own disabled state says why nothing can be
 * sent. A busy conversation is `askAi`'s to report (it toasts and sends nothing).
 */
export function runMethod(method: MethodEntry): RunMethodResult {
  const intent: AskIntent | undefined = METHOD_ASK_INTENT[method.id]
  const result: AskAiResult =
    intent === undefined ? 'none'
    : ROUTED_BY_ASK_AI.has(intent) ? askAi({ intent, includeOptions: intent === 'widen' })
    : askAi({ intent, pressId: methodAskId(method.id) })
  if (result !== 'none') return result
  openAskOlumi({
    context: method.description,
    draft: method.prompt,
    label: method.title,
    parameters: { method_id: method.id },
    // Same technique, same intent, whichever surface invoked it.
    ...(method.intent ? { intent: method.intent } : {}),
    source: 'chip',
  })
  return 'drawer'
}
