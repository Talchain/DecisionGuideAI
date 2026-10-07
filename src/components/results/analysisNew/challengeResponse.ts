/** Respond sends the person's own words; model targets stay on the typed selection carrier. */
import { askAi, type AskAiResult } from '../../../canvas/conversation/askAi'
import { useCanvasStore } from '../../../canvas/store'
import type { MethodEntry } from '../decision-overview/actionsCatalogue'
import type { Recommendation } from '../strengthen/strengthenTypes'

export function respondToMethod(method: MethodEntry, text: string): AskAiResult {
  return askAi({ userWords: `On ‘${method.title}’:\n${text}` })
}
export function respondToIntervention(rec: Recommendation, text: string): AskAiResult {
  const isEdge = useCanvasStore.getState().edges.some(e => e.id === rec.targetId)
  return askAi({ userWords: `On ‘${rec.title}’:${typeof rec.action.parameters?.block_id === 'string' ? `\nblock_id: ${rec.action.parameters.block_id}` : ''}\n${text}`,
    nodeIds: rec.targetId && !isEdge ? [rec.targetId] : [],
    edgeIds: rec.targetId && isEdge ? [rec.targetId] : [],
  })
}
