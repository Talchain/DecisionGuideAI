/**
 * Item 3 (Paul 7 Oct; CEE #2776): a link the user draws has no strength yet. The canvas presses
 * `agent-drawn-link:<from>><to>` and CEE answers with ONE card: Olumi's direction, band and one reason, which the
 * user accepts, changes or declines. Accepted, the link reads as Olumi's estimate, accepted (never "Set by you").
 */
import { askAi, type AskAiResult } from './askAi'
import { useCanvasStore } from '../store'
import { useGuidanceStore } from '../stores/guidanceStore'
import { useInspectorPresenceStore } from '../stores/inspectorPresenceStore'
import { isCanvasOnlyLink } from '../utils/canvasOnlyLink'

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

/**
 * ⛔ THE USER'S WRITE IS NEVER QUEUED BEHIND THIS PROPOSAL (DL 58e392, 8 Oct; witnessed on staging 26cf0d86).
 *
 * The turn pipe holds ONE turn in flight; a system event that arrives meanwhile is DEFERRED into a memory-only
 * buffer (`useConversation` `enqueueDeferredSystemSend`). A drawn link is unsized, so its `structural_add_edge` can
 * only be sent once the user states a strength — and pressing the proposal the moment the link was drawn put an LLM
 * turn in the pipe exactly while the user was choosing that strength. Their add then waited behind it, and a reload
 * in that window lost the link they drew.
 *
 * So the proposal FOLLOWS the user instead of racing them. While the link's strength editor is in front of them it is
 * not pressed; it is pressed only when they LEAVE the link still unsized (the inspector closes, or the selection moves
 * off the link). If they state a strength, their figure wins, nothing is proposed, and their add goes out on an idle
 * pipe at once. A removed link proposes nothing. Returns a cancel function (for retargets and tests).
 */
export function proposeWhenLeftUnsized(edgeId: string, propose: (id: string) => AskAiResult = proposeForDrawnLink): () => void {
  let done = false
  let seenOpen = false
  const unsubs: Array<() => void> = []
  const finish = () => { if (done) return; done = true; for (const u of unsubs) u() }
  const check = () => {
    if (done) return
    const state = useCanvasStore.getState()
    const edge = state.edges.find(e => e.id === edgeId)
    // Gone, or the user stated a strength (it is no longer an unsized canvas-only link): their figure wins.
    if (!edge || (edge.data as { weightSource?: unknown } | undefined)?.weightSource === 'user'
      || !isCanvasOnlyLink(edge, state.lastAuthoritativeGraph)) { finish(); return }
    // The inspector raises asynchronously after the open event, so "closed" only means LEFT once it has been seen
    // open; until then, only the selection moving off the link counts as leaving.
    const open = useInspectorPresenceStore.getState().open
    if (open) seenOpen = true
    const stillOnIt = state.selection.edgeIds.has(edgeId) && (open || !seenOpen)
    if (stillOnIt) return
    finish()
    propose(edgeId)
  }
  unsubs.push(useCanvasStore.subscribe(check), useInspectorPresenceStore.subscribe(check))
  return finish
}
