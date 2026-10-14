/**
 * Respond sends the person's own words ALONE, as theirs: a chipless composer turn, exactly as typed.
 *
 * Why no heading and no parameters: CEE credits a turn's words to the user only on a chipless `composer` turn
 * (`stated-by-user.ts` `typedByUser`; `turn-executor.ts` runs its typed-constraint door only off chip sources), and it
 * reads the WHOLE message as the user's. A card heading (`On ‘<title>’:`) is Olumi's copy — titles carry node labels and
 * CEE's own wire copy, figures included — so on a composer turn it would be credited to the user; typed parameters
 * force a chip, which demotes the user's words. No CEE reader consumes these parameters (`method_id`, `block_id`, …):
 * they reached nothing. The intervention's target still travels typed, as `selected_elements` (the ask binding).
 */
import { askAi, type AskAiResult } from '../../../canvas/conversation/askAi'
import { useCanvasStore } from '../../../canvas/store'
import type { MethodEntry } from '../decision-overview/actionsCatalogue'
import type { Recommendation } from '../strengthen/strengthenTypes'

export function respondToMethod(_method: MethodEntry, text: string): AskAiResult {
  return askAi({ userWords: text })
}
export function respondToIntervention(rec: Recommendation, text: string): AskAiResult {
  const isEdge = useCanvasStore.getState().edges.some(e => e.id === rec.targetId)
  return askAi({ userWords: text,
    nodeIds: rec.targetId && !isEdge ? [rec.targetId] : [],
    edgeIds: rec.targetId && isEdge ? [rec.targetId] : [],
  })
}
