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
 * sends one chip turn. It used to open the Ask-Olumi drawer with an editable
 * draft, so reaching Olumi took a second press, and the strip's own icons sent
 * nothing at all.
 *
 * ⚠ NOTHING ABOUT THE WIRE LIVES HERE. A catalogue method is an action in
 * `ACTION_REGISTRY` (S-B slice 0), which owns the chip id it sends and whether
 * CEE answers that id with a typed handler or, for now, an ordinary Agent turn.
 * The served CEE lane routes on `chip.id` only: it reads neither `method_id` nor
 * `chip.intent` (measured at CEE `df15c8c1`: `method_id` in 0 files under
 * `src/`, against 10 for the contrast `agent-next-pre-mortem`).
 */
import { actionOfMethod } from '../../../canvas/conversation/actionRegistry'
import { pressAction, type PressActionResult } from '../../../canvas/conversation/pressAction'
import { openAskOlumi } from '../coaching/askOlumiStore'
import type { MethodEntry } from '../decision-overview/actionsCatalogue'

export type RunMethodResult = PressActionResult | 'drawer'

/**
 * Presses the method's action: one chip turn to Olumi.
 *
 * ⚠ NEVER A DEAD PRESS. With no conversation mounted (`none`), or for a method
 * the registry does not hold, the method keeps its drawer, whose own disabled
 * state says why nothing can be sent. A busy conversation is `askAi`'s to
 * report (it toasts and sends nothing).
 */
export function runMethod(method: MethodEntry): RunMethodResult {
  const action = actionOfMethod(method.id)
  const result: PressActionResult = action ? pressAction(action) : 'none'
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
