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
 *
 * ⭐ 18 Aug 2026: that 11px was an INLINE `fontSize`, so it never saw the canvas
 * counter-scale and rendered at 5.5px at the 0.50 auto-fit floor — smaller than
 * the 9px this note records as already rejected at 80–100%. Same declared size,
 * now via the `nodeLabel` token (DS v5 §2.3), which carries the counter-scale.
 *
 * ⭐⭐ THIS COMPONENT NO LONGER POSITIONS ITSELF (2026-09-03). It hand-wrote
 * `absolute -top-2 -right-1 z-10` — one pixel from, and at the SAME z as,
 * `node-corner-stack-{id}` (`absolute -top-2 -right-2 z-10`), the container built
 * specifically to abolish same-corner overlap. It was the fourth occupant of that
 * corner to arrive with its own positioning authority, after rank vs coaching
 * (Codex P1-5) and the edited-since-run dot (Codex P2), and it was fixed the same
 * way all three were: ONE authority owns the corner, everything else is a static
 * flex child. `BaseNode.tsx` renders it inside that stack.
 *
 * ⚠ SO DO NOT RE-ADD AN OFFSET HERE. Nudging `-right-1` to `-right-2` is the
 * fix already rejected for the other three occupants: it leaves two positioning
 * authorities agreeing by coincidence, which is how each of them re-collided.
 *
 * Measured before the move (real Chromium, `e2e/geometry/statusPillCorner.measure.ts`,
 * 1440x900, starters `vendor-selection` / `build-vs-buy`, prior run in history):
 * the pill covered 15px² of the edited-since-run dot's 25px² — 60% of it. The
 * no-run-history arm of the same run measured zero, so the probe discriminated.
 */
import { memo } from 'react'
import { typography } from '../../../styles/typography'

interface StatusPillProps {
  label: string
  /** Tooltip text (defaults to label). */
  title?: string
}

export const StatusPill = memo(({ label, title }: StatusPillProps) => (
  <span
    role="status"
    aria-label={title ?? label}
    className={`${typography.nodeLabel} shrink-0 whitespace-nowrap inline-flex items-center font-medium text-warning bg-warning/15 border border-warning/40 rounded-[10px]`}
    style={{ padding: '2px 8px', lineHeight: 1.2, borderWidth: '0.5px' }}
    title={title ?? label}
    data-testid="needs-input-pill"
  >
    {label}
  </span>
))

StatusPill.displayName = 'StatusPill'
