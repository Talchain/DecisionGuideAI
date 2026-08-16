/**
 * ActionIcons — the Confirm icon, absolute bottom-right of a node card.
 * Confirm: shown when extractionType === 'inferred' (marks value user-reviewed).
 *
 * The Edit pencil that used to live here is GONE, for two reasons.
 *
 * 1. It was DEAD. Its handler set the store field `showInspectorPanel`, which
 *    has zero render consumers repo-wide — nothing subscribes to it, no JSX
 *    gates on it; it round-trips to localStorage and into the debug bundle and
 *    nowhere else. The inspector's real gate is `showFullInspector`, LOCAL
 *    React state in ReactFlowGraph, reachable from outside only via the
 *    `olumi:open-full-inspector` event. So the pencil looked like the way to
 *    open a node's details and did nothing at all. Its `stopPropagation` made
 *    that worse: it also suppressed the node click, which IS what opens the
 *    inspector — so clicking the affordance was strictly worse than clicking
 *    anywhere else on the node.
 * 2. It is now REDUNDANT. `NodeQuickActions` (rendered by BaseNode on every
 *    node type) carries "open this node's details" as part of the R5 contextual
 *    efficiency layer, routed through `openNodeInspector`, which works. Keeping
 *    a second control for the same job would be two grammars for one action.
 *
 * `showEdit` is retained as an accepted-and-ignored prop only long enough for
 * the two call sites (FactorNode, OptionNode) to be cleaned up in this same
 * change — it is not part of this component's contract.
 */
import { useCallback } from 'react'
import { Check } from 'lucide-react'

interface ActionIconsProps {
  nodeId: string
  showConfirm?: boolean
  onConfirm?: () => void
}

export function ActionIcons({ showConfirm, onConfirm }: ActionIconsProps) {
  // Hooks before any early return — the previous version returned above its
  // own useCallbacks, which is a conditional hook order.
  const handleConfirm = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onConfirm?.()
  }, [onConfirm])

  if (!showConfirm) return null

  return (
    <div className="absolute bottom-2 right-2.5 flex gap-0.5">
      <button
        type="button"
        className="p-0.5 rounded bg-success/10 hover:bg-success/20 transition-colors nodrag nopan focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
        title="Confirm value"
        aria-label="Confirm value"
        onClick={handleConfirm}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Check size={11} className="text-success" />
      </button>
    </div>
  )
}
