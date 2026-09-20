/**
 * ⭐⭐ ONE INVOCATION FOR A SCIENCE-GROUNDED METHOD, WHEREVER IT IS OFFERED.
 *
 * Paul's instruction, 18 Sep 2026: "Surface the Methods menu — make it
 * prominent." That gives `METHOD_CATALOGUE` a SECOND surface, and a second
 * surface is exactly where this estate's dominant defect starts: two call sites
 * build the same payload, one gains a field, and they drift with a red nowhere.
 *
 * So the payload is built HERE, once. `ActionsMenu` (the dropdown) and
 * `MethodsYouCanRun` (the visible section) both call this and neither re-types
 * it. Nothing about WHAT a method says lives here — that is the catalogue's.
 *
 * ⚠ `parameters.method_id` IS LOAD-BEARING, not decoration. It is what makes the
 * eventual turn a conversation-typed dispatch carrying `chip_metadata`, which is
 * the only turn shape CEE resolves a DSK protocol on. Drop it and the method
 * still opens a drawer, still sends, and silently stops being decision science —
 * the failure mode that has no red.
 */
import { openAskOlumi } from '../coaching/askOlumiStore'
import type { MethodEntry } from '../decision-overview/actionsCatalogue'

/**
 * Opens the Ask-Olumi drawer with the method's prompt as an EDITABLE draft.
 *
 * ⛔ IT DOES NOT AUTO-SEND, and that is the product argument rather than a
 * technical one: the person chooses the move, so the person gets to shape the
 * question before it goes. A method that fires on click would be the tool doing
 * the thinking again.
 */
export function runMethod(method: MethodEntry): void {
  openAskOlumi({
    context: method.description,
    draft: method.prompt,
    label: method.title,
    parameters: { method_id: method.id },
    // Same technique, same intent, whichever surface invoked it.
    ...(method.intent ? { intent: method.intent } : {}),
    source: 'chip',
  })
}
