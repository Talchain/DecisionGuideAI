import { memo, useCallback } from 'react'
import { useCanvasStore } from '../../store'
import { focusByTarget } from '../../utils/focusHelpers'

// TargetRefPill — a conversation-block reference pill (target_refs / proposal
// change targets) that pans + highlights its canvas element on click.
//
// Fail-closed contract (UI-SEAMLESSNESS-REVIEW R1/R3): the pill is clickable
// ONLY while the referenced element exists on the canvas — checked against
// the canvas store at render time, scoped by kind (edge ids never resolve
// against nodes and vice versa). When the target is stale/unknown the pill
// renders as the same inert <span> it was before this component existed, so
// a dead reference never advertises an affordance it can't honour.
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

export const TargetRefPill = memo(function TargetRefPill({
  id,
  label,
  kind = 'node',
  className,
  role,
}: TargetRefPillProps) {
  const isEdge = kind === 'edge'
  const exists = useCanvasStore((s) =>
    isEdge ? s.edges.some((e) => e.id === id) : s.nodes.some((n) => n.id === id),
  )

  const handleClick = useCallback(() => {
    // Same kind collapse as EntityLink: all non-edge targets are canvas
    // nodes. Reduced-motion is handled inside the focus helper.
    focusByTarget(id, isEdge ? 'edge' : 'node')
  }, [id, isEdge])

  if (!exists) {
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
