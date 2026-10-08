/**
 * The original Examine press, shared with the Relationship inspector's single
 * Ask Olumi action. Its retired standalone section no longer mounts; the view
 * still owns the basis, why-line and prepared question.
 */
import { requestAsk } from '../askSemantic'
import type { ExamineLinkView } from './examineLinkView'

export function requestExamineLink(edgeId: string, view: ExamineLinkView) {
  return requestAsk({
    text: view.prepare.text,
    label: view.prepare.label,
    targetId: edgeId,
    edgeIds: [edgeId],
    nodeIds: [],
    intent: 'examine-link',
  })
}
