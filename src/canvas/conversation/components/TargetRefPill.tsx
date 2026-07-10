import { memo } from 'react'

// TargetRefPill — a conversation-block reference pill (target_refs / proposal
// change targets) that pans + highlights its canvas element on click.
//
// Fail-closed contract (UI-SEAMLESSNESS-REVIEW R1/R3): the pill is clickable
// ONLY while the referenced element exists on the canvas — checked against
// the canvas store at render time, scoped by kind (edge ids never resolve
// against nodes and vice versa). When the target is stale/unknown the pill
// renders as today's inert <span>, byte-identical styling, so a dead
// reference never advertises an affordance it can't honour.
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
  /** Set to 'listitem' when rendered inside a role="list" refs container. */
  role?: string
}

export const TargetRefPill = memo(function TargetRefPill({
  id,
  label,
  kind = 'node',
  className,
  role,
}: TargetRefPillProps) {
  // RED-checkpoint stub: inert rendering only; click-to-focus lands next commit.
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
})

export default TargetRefPill
