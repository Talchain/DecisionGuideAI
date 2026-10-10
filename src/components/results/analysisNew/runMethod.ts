/**
 * One catalogue-method invocation for the strip, Challenge card and Actions menu.
 * The shared action registry owns capability and identity. Unsupported methods
 * return unavailable; supported methods reuse the current offer's press spine.
 * Only an unmounted conversation retains the existing editable drawer fallback.
 */
import { actionOfMethod, registeredPressId } from '../../../canvas/conversation/actionRegistry'
import { pressAction, type PressActionResult } from '../../../canvas/conversation/pressAction'
import { openAskOlumi } from '../coaching/askOlumiStore'
import type { MethodEntry } from '../decision-overview/actionsCatalogue'

export type RunMethodResult = PressActionResult | 'drawer'

/** A supported method sends one turn; only a missing conversation opens its existing drawer. */
export function runMethod(method: MethodEntry): RunMethodResult {
  const action = actionOfMethod(method.id)
  const result = action ? pressAction(action) : 'unavailable'
  if (result !== 'none') return result
  openAskOlumi({
    context: method.description,
    draft: method.prompt,
    label: method.title,
    // The existing drawer's buildChipMeta lifts chip_id, so mounting later cannot downgrade this to prose.
    parameters: { method_id: method.id, chip_id: registeredPressId(action!) },
    // Same technique, same intent, whichever surface invoked it.
    ...(method.intent ? { intent: method.intent } : {}),
    source: 'chip',
  })
  return 'drawer'
}
