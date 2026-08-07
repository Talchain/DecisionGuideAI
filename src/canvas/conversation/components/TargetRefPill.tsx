import { memo, useCallback } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { useCanvasStore } from '../../store'
import { focusByTarget } from '../../utils/focusHelpers'

// TargetRefPill — a conversation-block reference pill (target_refs / proposal
// change targets) that pans + highlights its canvas element on click.
//
// Fail-closed contract (UI-SEAMLESSNESS-REVIEW R1/R3): the pill is clickable
// ONLY while the referenced element resolves to exactly one canvas element,
// checked against the canvas store at render time and scoped by kind (edge
// refs never resolve against nodes and vice versa). When the target is
// stale, unknown, or ambiguous the pill renders as the same inert <span> it
// was before this component existed, so a dead reference never advertises an
// affordance it can't honour.
//
// Resolution (F4, 16-Jul feedback item 2) follows the ratified string-target
// rule the R3 proposal badges already use:
//   - non-edge kinds: exact canvas node id, else a UNIQUE exact trimmed
//     case-sensitive node-label match, else inert.
//   - edge kind: exact canvas edge id, else a UNIQUE producer edge id
//     stashed on edge.data (edge_id / plot_edge_id / plot_id, the
//     focusModelTarget and idMapping conventions; canvas edge ids are
//     locally generated and rarely match producer ids), else inert. Edge
//     labels are derived weight/belief text, not identity, so labels never
//     resolve edges.
// Resolution is render-time, not ingest-time: the store subscription means
// labels that drift while a block sits on screen re-resolve, and a pill
// never points at a guess. Ambiguity always fails closed.
//
// When the target exists but ReactFlow is not mounted (no focus handler
// registered), a click warns and no-ops inside focusHelpers — identical to
// EntityLink; pinned by TargetRefPill.noHandler.spec.tsx.
//
// DS: the caller supplies the pill classes — pills keep their outlined
// identity (bg-transparent border, text-text-body); this is NOT restyled to
// EntityLink's text-link look. No telemetry (mirrors EntityLink).

export interface TargetRefPillProps {
  id: string
  label: string
  /** Producer-owned kind string ('factor'/'goal'/'option'/'risk'/'edge'/…).
   * Only 'edge' routes to edge focus; all other kinds are canvas nodes. */
  kind?: string
  /** Pill classes, applied in both the clickable and inert states. */
  className?: string
  /** Set to 'listitem' when rendered inside a role="list" refs container.
   * In the clickable state the role goes on a wrapper span so the inner
   * <button> keeps its native role and list semantics stay valid. */
  role?: string
}

const INTERACTIVE_CLASSES =
  'cursor-pointer hover:border-info/50 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-info'

/**
 * Resolve a non-edge ref to a canvas node id: exact id, else UNIQUE exact
 * trimmed case-sensitive label, else null (inert).
 */
function resolveNodeTarget(nodes: Node[], id: string, label: string): string | null {
  if (nodes.some((n) => n.id === id)) return id
  const wanted = label.trim()
  if (!wanted) return null
  let found: string | null = null
  for (const n of nodes) {
    const l = (n.data as Record<string, unknown> | undefined)?.label
    if (typeof l === 'string' && l.trim() === wanted) {
      if (found !== null) return null
      found = n.id
    }
  }
  return found
}

/**
 * Resolve an edge ref to a canvas edge id: exact canvas id, else a UNIQUE
 * producer id stashed on edge.data, else null (inert).
 */
function resolveEdgeTarget(edges: Edge[], id: string): string | null {
  if (edges.some((e) => e.id === id)) return id
  let found: string | null = null
  for (const e of edges) {
    const d = e.data as Record<string, unknown> | undefined
    if (d && (d.edge_id === id || d.plot_edge_id === id || d.plot_id === id)) {
      if (found !== null) return null
      found = e.id
    }
  }
  return found
}

export const TargetRefPill = memo(function TargetRefPill({
  id,
  label,
  kind = 'node',
  className,
  role,
}: TargetRefPillProps) {
  const isEdge = kind === 'edge'
  // Selector returns a primitive (string | null), so the pill re-renders
  // only when its own resolution changes, never on unrelated store churn
  // (node drags update the nodes array identity every frame).
  const resolvedId = useCanvasStore((s) =>
    isEdge ? resolveEdgeTarget(s.edges, id) : resolveNodeTarget(s.nodes, id, label),
  )

  const handleClick = useCallback(() => {
    // Same kind collapse as EntityLink: all non-edge targets are canvas
    // nodes. Reduced-motion is handled inside the focus helper.
    if (resolvedId) focusByTarget(resolvedId, isEdge ? 'edge' : 'node')
  }, [resolvedId, isEdge])

  if (!resolvedId) {
    return (
      <span
        {...(role ? { role } : {})}
        data-ref-id={id}
        data-ref-kind={kind}
        className={className}
      >
        {label}
      </span>
    )
  }

  return (
    // shrink-0 keeps flex-item behaviour identical to the inert state when the
    // caller's classes carry flex-shrink: 0 (the proposal badge row is
    // flex-nowrap); it is a no-op in the flex-wrap refs rows.
    <span {...(role ? { role } : {})} className="inline-flex shrink-0">
      <button
        type="button"
        onClick={handleClick}
        data-ref-id={id}
        data-ref-kind={kind}
        data-resolved-id={resolvedId}
        data-testid={`target-ref-pill-${id}`}
        aria-label={`Highlight ${label} on the canvas`}
        className={[className, INTERACTIVE_CLASSES].filter(Boolean).join(' ')}
      >
        {label}
      </button>
    </span>
  )
})

export default TargetRefPill
