/**
 * Item 3 (Paul 7 Oct; CEE #2776): a link the user draws has no strength yet. The canvas presses
 * `agent-drawn-link:<from>><to>` and CEE answers with ONE card: Olumi's direction, band and one reason, which the
 * user accepts, changes or declines. Accepted, the link reads as Olumi's estimate, accepted (never "Set by you").
 */
import { askAi, type AskAiResult } from './askAi'
import { useCanvasStore } from '../store'
import { useGuidanceStore } from '../stores/guidanceStore'

// A link FROM an option or the decision states a setting or a choice, not a strength: no band to propose.
const CAUSE_TYPES: ReadonlySet<string> = new Set(['factor', 'outcome', 'risk'])
const EFFECT_TYPES: ReadonlySet<string> = new Set(['factor', 'outcome', 'risk', 'goal'])

export function proposeForDrawnLink(edgeId: string): AskAiResult {
  const { nodes, edges } = useCanvasStore.getState()
  const edge = edges.find(e => e.id === edgeId)
  const typeOf = (id: string | undefined) => nodes.find(n => n.id === id)?.type ?? ''
  if (!edge || !CAUSE_TYPES.has(typeOf(edge.source)) || !EFFECT_TYPES.has(typeOf(edge.target))) return 'none'
  // A gesture is not an ask: while Olumi is answering, the draw stays quiet. The busy notice belongs to a press the
  // person made, and the editor is already open for their own figure.
  if (useGuidanceStore.getState()._isConversationBusy?.()) return 'busy'
  return askAi({ intent: 'drawn-link', edgeIds: [edge.id] })
}
