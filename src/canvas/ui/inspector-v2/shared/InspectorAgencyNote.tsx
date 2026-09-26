/**
 * InspectorAgencyNote — the pane's own save truth, as the contract's quiet
 * 10px `.inspector-note` at the foot of the inspector body.
 *
 * ⭐ CANVAS VISUAL CONTRACT v3.1 POINT 11 (DESIGN-GAP-v31 row 8): "Show one
 * human-agency statement in the panel, not a version per tab … Repeated
 * disclaimers are removed; the panel footer keeps the one statement." The
 * served inspector opened EVERY pane with a 106–137px peach box
 * (`bg-panel-hover`, radius 4px) holding "You decide. Olumi's model informs
 * your thinking; it doesn't choose for you." above the save truth — the
 * repeated disclaimer the point removes. The statement now belongs to the
 * right panel's footer (Panel lane: "Implications depend on this model and its
 * assumptions. You own the conclusion."), so this component no longer renders
 * it. `INSPECTOR_AGENCY_STATEMENT` stays exported from `useInspectorMutations`
 * (a file another open PR edits) and is simply no longer mounted here.
 *
 * ⚠ THE NOTICE KEEPS ITS IDENTITY. `id="inspector-authority-notice"` is what
 * the Router's `<fieldset disabled>` names in `aria-describedby`, and specs
 * bind the notice by `textContent` equality with the pane's constant. Only its
 * STYLE and POSITION changed: from the first thing in the body to the last,
 * from a boxed 11px paragraph to the contract's 10px note with a hairline rule.
 * The note is still said on every pane, because every pane's truth differs
 * (what saves here and what does not) — that is a needed note, not a repeated
 * disclaimer.
 *
 * Contrast (point 12): `text-text-light`, the design system's muted token
 * (#6E6B6B, 5.23:1 on the panel — measured).
 */
import type { ReactNode } from 'react'
import { inspectorNote } from '../inspectorStyle'

export function InspectorAgencyNote({ children }: { children: ReactNode }) {
  return (
    <p
      id="inspector-authority-notice"
      role="note"
      data-testid="inspector-authority-notice"
      className={inspectorNote}
    >
      {children}
    </p>
  )
}
