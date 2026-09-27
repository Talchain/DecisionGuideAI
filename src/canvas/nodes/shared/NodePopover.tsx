/**
 * NodePopover — ⭐⭐ RETIRED. Canvas visual contract v3.1 §01: "Clicking a card
 * opens only the inspector. Hover shows a one-line tooltip." Detail lives in the
 * inspector (DESIGN-GAP-v31 row 6; node anatomy v3.2: "Nothing is shown just to
 * say that nothing exists"; "No link text inside a card").
 *
 * MEASURED on served 91717719 (27 Sep 2026, 1280×800): resting the pointer on a
 * card for 300ms opened a 240–260px panel over the neighbouring cards on all
 * five starters. On a yes/no factor it also CONTRADICTED the card it belonged
 * to: the card read "Not adopted" while the panel's option list read "Low (0)"
 * and "Very high (1)" — a tier word invented over a binary value, with the raw
 * 0–1 number beside it.
 *
 * The component stays as a no-op so its six call sites need no churn; the
 * per-card hover state they compute is now inert. The portal and its keyboard
 * scope (the `nodeKeyboardScope` bleed fix) are in git history before this
 * change, should a hover surface ever return.
 */
import type { ReactNode, RefObject } from 'react'

interface NodePopoverProps {
  visible: boolean
  width?: number
  children: ReactNode
  onMouseEnter: () => void
  onMouseLeave: () => void
  /** Ref to the anchor element (node wrapper) for positioning */
  anchorRef?: RefObject<HTMLElement | null>
}

export function NodePopover(_props: NodePopoverProps): null {
  return null
}
