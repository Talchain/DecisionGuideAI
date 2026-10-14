/** Respond keeps the person's wording; finding/method parameters and model targets travel typed. */
import { askAi, type AskAiResult } from '../../../canvas/conversation/askAi'
import { useCanvasStore } from '../../../canvas/store'
import type { MethodEntry } from '../decision-overview/actionsCatalogue'
import type { Recommendation } from '../strengthen/strengthenTypes'

export function respondToMethod(method: MethodEntry, text: string): AskAiResult {
  return askAi({ userWords: `On ‘${method.title}’:\n${text}`, parameters: { method_id: method.id } })
}
export function respondToIntervention(rec: Recommendation, text: string): AskAiResult {
  const isEdge = useCanvasStore.getState().edges.some(e => e.id === rec.targetId)
  return askAi({ userWords: `On ‘${rec.title}’:\n${text}`,
    ...(rec.action.parameters !== undefined ? { parameters: rec.action.parameters } : {}),
    nodeIds: rec.targetId && !isEdge ? [rec.targetId] : [],
    edgeIds: rec.targetId && isEdge ? [rec.targetId] : [],
  })
}
