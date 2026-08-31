/**
 * Olumi attention — the AI holding your gaze on part of the model.
 *
 * ⭐ WHY THIS IS NOT THE EXISTING PULSE, AND MUST NOT BECOME IT.
 *
 * `appliedEditPulse` answers *"did a number move under the user's eyes?"* — an
 * acknowledgement that something CHANGED. Two seconds is the right length for
 * that, and it is the single choke point every edit feeder shares.
 *
 * This answers a different question: *"may I hold your attention here while I
 * explain?"* It has to persist, because the user is reading a sentence about
 * the thing it points at. Lengthening the pulse to serve both would make every
 * applied edit hold too — two intents under one name, which is the defect class
 * this estate pays for most often. So they are separate channels, and a node
 * can legitimately be in both at once.
 *
 * ⚠ IT ALSO DOES NOT WRITE `dimmedNodeIds`. That set already has two writers
 * (`usePathHighlight` and `handleFocusNode`) with a documented precedence rule
 * between them. A third writer would need a three-way rule nobody has agreed.
 * The dim is DERIVED here instead — anything not attended is dimmed for as long
 * as attention is held — so the existing contract is untouched and attention
 * cannot strand a dim it did not set.
 *
 * ⚠ AND IT CARRIES ITS BINDING. `turnId` and `modelVersion` are not decoration.
 * PR #747 refused canvas grounding on the argument that the canvas is ONE
 * GLOBAL SLOT: marks from the latest turn sit beside every older answer in the
 * transcript, so a reader attributes them to the wrong one. Carrying the turn
 * and the model version means a consumer can tell whether what is lit still
 * belongs to what is being read, instead of assuming it does.
 */

import { useCanvasStore } from '../store'

/** What the AI wants said beside the thing it is pointing at. */
export interface OlumiAttentionNote {
  /** The reasoning move this belongs to. A closed grammar, deliberately. */
  move: 'expand' | 'challenge' | 'calibrate' | 'reframe'
  title: string
  body: string
  /** Rendered verbatim when present — never composed here. */
  sourceLine?: string
  /**
   * What the user can do from here. `prompt` prefills the conversation with a
   * QUESTION — never an answer. A card that handed the user a conclusion would
   * fail the product test this whole surface exists to pass.
   */
  actions?: Array<{ id: string; label: string; prompt?: string }>
}

export interface OlumiAttention {
  nodeIds: string[]
  edgeIds: string[]
  note: OlumiAttentionNote | null
  /** The turn this attention belongs to — see the binding note above. */
  turnId: string | null
  /** The model version it was computed against. */
  modelVersion: number | null
}

export const OLUMI_ATTENTION_EVENT = 'olumi:attention'

/**
 * Ask the canvas to hold attention. Fail-closed: ids not on the canvas are
 * dropped, and a request whose targets have ALL gone stale writes nothing
 * rather than dimming the whole graph around nothing.
 */
export function requestOlumiAttention(next: {
  nodeIds?: string[]
  edgeIds?: string[]
  note?: OlumiAttentionNote | null
  turnId?: string | null
}): { applied: string[]; dropped: string[] } {
  const state = useCanvasStore.getState()
  const nodes = state.nodes ?? []
  const edges = state.edges ?? []

  const wantedNodes = next.nodeIds ?? []
  const wantedEdges = next.edgeIds ?? []
  const liveNodes = wantedNodes.filter((id) => nodes.some((n) => n.id === id))
  const liveEdges = wantedEdges.filter((id) => edges.some((e) => e.id === id))
  const dropped = [
    ...wantedNodes.filter((id) => !liveNodes.includes(id)),
    ...wantedEdges.filter((id) => !liveEdges.includes(id)),
  ]

  if (liveNodes.length === 0 && liveEdges.length === 0) {
    return { applied: [], dropped }
  }

  /*
   * ⚠ AND AN ATTENTION THAT NAMES NO LIVE NODE IS ALSO REFUSED — the guard
   * above is true for the all-stale case and was FALSE for the edge-only case,
   * which is one predicate covering two situations.
   *
   * An edge-only hold writes `nodeIds: []`. Two consumers then disagree about
   * whether anything is on screen: `BaseNode` dims every node that is not
   * attended — which, with no attended nodes, is ALL of them — while
   * `OlumiAttentionCard` anchors on `nodeIds[0]` and renders nothing. The
   * result is a fully greyed canvas with no explanation and no dismiss button.
   *
   * The card cannot anchor without a node, so this is a state the UI has no way
   * to present. Refusing it here closes it for EVERY caller, including ones
   * that do not exist yet: the `ui_directive` path cannot reach it today only
   * because `ui_directive.note` is `z.string()` on a `.strict()` block at the
   * vendored pin, so the object-note branch is dead — which means a contract
   * bump alone would arm this, in a lane that has no reason to look here.
   *
   * Callers holding an edge should hold its endpoint nodes too; that is both
   * the fix and the honest presentation, since a claim about a link is a claim
   * about the two things it joins (`focusModelTarget` does this).
   */
  if (liveNodes.length === 0) {
    return { applied: [], dropped: [...dropped, ...liveEdges] }
  }

  state.setOlumiAttention?.({
    nodeIds: liveNodes,
    edgeIds: liveEdges,
    note: next.note ?? null,
    turnId: next.turnId ?? null,
    modelVersion: typeof state.layoutVersion === 'number' ? state.layoutVersion : null,
  })
  return { applied: [...liveNodes, ...liveEdges], dropped }
}

export function clearOlumiAttention(): void {
  useCanvasStore.getState().clearOlumiAttention?.()
}
