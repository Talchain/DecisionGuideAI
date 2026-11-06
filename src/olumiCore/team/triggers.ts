import type { View } from '../../olumiView/client'
import { nonEmpty, type SuggestedTrigger } from '../../olumiView/tipping'

/** The triggers core suggests for one option (`collab.suggested_triggers`, the current approved version's), in core's order; none for no option or a core without them. */
export function suggestedTriggersFor(collab: View['collab'], option: string | null): SuggestedTrigger[] {
  const s = collab.suggested_triggers
  if (option === null || !Array.isArray(s)) return []
  return s.filter((t) => t.option === option && nonEmpty(t.fact) && nonEmpty(t.text))
}
