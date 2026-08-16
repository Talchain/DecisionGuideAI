import { memo, useCallback } from 'react'
import { MessageSquare, PanelRight } from 'lucide-react'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { askAI } from '../../contextMenu/actions'
import type { NodeType } from '../../domain/nodes'
import { openNodeInspector } from './openNodeInspector'

/**
 * NodeQuickActions — the contextual efficiency layer (R5, Paul, 16 Aug 2026).
 *
 * "nodes/edges carry a compact CONTEXTUAL EFFICIENCY LAYER — small clickable
 * icons and/or a hover menu giving one-click access to (a) ask Olumi about
 * THIS element and (b) open the precise analysis lens for THIS element —
 * powerful science-grounded shortcuts for practised users, balanced against
 * clutter. Full functionality stays in the inspector and may be DUPLICATED
 * there. Full buttons/instructional text on nodes: no. Efficiency principle:
 * minimise clicks to power functionality; nothing buried. Every hover action
 * has a click/tap/keyboard equivalent."
 *
 * Design notes, each answering a constraint from that ruling:
 *
 * - QUIET AT REST. Hidden by opacity, revealed on hover, on keyboard focus
 *   within the card, and whenever the node is SELECTED. Selection is what
 *   makes this reachable without a pointer at all: select with the keyboard,
 *   the actions appear, Tab to them.
 * - CLICK/TAP/KEYBOARD PARITY. Native <button>s, so Tab and Enter/Space work
 *   with no key handling of our own. `group-focus-within` keeps them visible
 *   while they hold focus — without it, a focused button would be invisible,
 *   which is the exact "hover action with no keyboard equivalent" the ruling
 *   forbids. Reveal is opacity-only, never `display`/`hidden`, so the buttons
 *   stay in the tab order and in the accessibility tree at rest.
 *   Touch devices (`pointer: coarse`) get them permanently visible: a touch
 *   device has no hover, so opacity-on-hover would be a tap target that never
 *   appears. So does a SELECTED node, via `alwaysVisible`.
 * - NOTHING BURIED, NOTHING DUPLICATED BADLY. Both actions route through the
 *   machinery that already exists — `askAI` (which selects the element so the
 *   turn carries `selected_elements`, reveals the Olumi surface, and toasts if
 *   the conversation never registers) and `openNodeInspector` (the node twin
 *   of `openEdgeStrengthEditor`). No new transport, no second grammar.
 * - NO DEAD CONTROLS. The ask button renders only when a conversation surface
 *   has actually registered a send channel, the same gate the inspector's own
 *   "ask about this" uses. A control that cannot work is not shown.
 *
 * `stopPropagation` is deliberate and, unlike the dead on-node pencil this
 * replaces, harmless: these buttons perform the selection themselves, so
 * suppressing the node click costs nothing.
 */
export interface NodeQuickActionsProps {
  nodeId: string
  nodeType: NodeType
  /** The node's label, used in the button's accessible name. */
  label: string
  /** Keep the actions visible regardless of hover — used when the node is
   *  selected, which is what gives a keyboard-only user a way to reach them. */
  alwaysVisible?: boolean
}

export const NodeQuickActions = memo(function NodeQuickActions({
  nodeId,
  nodeType,
  label,
  alwaysVisible = false,
}: NodeQuickActionsProps) {
  // Same availability gate as the inspector's ask affordance: no chat channel
  // registered means no ask button, rather than a button that silently fails.
  const canAsk = useGuidanceStore(s => s._sendMessage !== null || s._prefillChat !== null)

  const handleAsk = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const node = useCanvasStore.getState().nodes.find(n => n.id === nodeId)
    if (!node) return
    askAI(
      { kind: 'node', nodeId, nodeType, node, screenPos: { x: 0, y: 0 } },
      'explain_element',
    )
  }, [nodeId, nodeType])

  const handleInspect = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    openNodeInspector(nodeId)
  }, [nodeId])

  const stopPointer = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
  }, [])

  return (
    <div
      className={`node-quick-actions absolute top-1.5 right-1.5 z-[2] flex gap-0.5 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 [@media(pointer:coarse)]:opacity-100 motion-reduce:transition-none ${alwaysVisible ? 'opacity-100' : 'opacity-0'}`}
      data-testid={`node-quick-actions-${nodeId}`}
    >
      {canAsk && (
        <button
          type="button"
          onClick={handleAsk}
          onPointerDown={stopPointer}
          className="nodrag inline-flex h-5 w-5 items-center justify-center rounded bg-panel/90 text-text-light hover:text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
          aria-label={`Ask Olumi about ${label}`}
          title={`Ask Olumi about ${label}`}
          data-testid={`node-action-ask-${nodeId}`}
        >
          <MessageSquare size={11} aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        onClick={handleInspect}
        onPointerDown={stopPointer}
        className="nodrag inline-flex h-5 w-5 items-center justify-center rounded bg-panel/90 text-text-light hover:text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
        aria-label={`Open details for ${label}`}
        title={`Open details for ${label}`}
        data-testid={`node-action-inspect-${nodeId}`}
      >
        <PanelRight size={11} aria-hidden="true" />
      </button>
    </div>
  )
})
