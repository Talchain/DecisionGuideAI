/**
 * StatusPill — small inline status indicator placed top-right of a node card.
 *
 * Used to flag a node that needs user input (factor missing value, goal missing
 * threshold). Replaces the legacy "?" overlay badge per Graph v1.1 wireframe v4
 * (FactorNeedsPre / GoalNoTargetPre).
 *
 * Spec (Polish 4 Task 6): 10px text, 500 weight, 2px×8px padding, 10px radius,
 * warning at 15% bg / 40% border, warning text colour. The original 9px/1px
 * spec was unreadable at typical canvas zoom (80–100%). British English: colour.
 */
import { memo } from 'react'

interface StatusPillProps {
  label: string
  /** Tooltip text (defaults to label). */
  title?: string
}

export const StatusPill = memo(({ label, title }: StatusPillProps) => (
  <span
    role="status"
    aria-label={title ?? label}
    className="absolute -top-2 -right-1 z-10 inline-flex items-center font-sans font-medium text-warning bg-warning/15 border border-warning/40 rounded-[10px]"
    style={{ fontSize: 10, padding: '2px 8px', lineHeight: 1.2, borderWidth: '0.5px' }}
    title={title ?? label}
    data-testid="needs-input-pill"
  >
    {label}
  </span>
))

StatusPill.displayName = 'StatusPill'
