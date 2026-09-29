/**
 * ⭐ E1d — A PENCIL ON ANYTHING YOU CAN EDIT ON THE CARD (Paul 29 Sep, "a pencil cue on anything you can edit").
 *
 * It shows while its `group/edit` parent is hovered or keyboard-focused, and never otherwise. It is ZERO-WIDTH and
 * absolutely placed, so it cannot move a word, wrap a line or grow a card. `aria-hidden`: every editable control
 * already says "click to edit" (or "Double-click to rename it") in its accessible name.
 *
 * The parent must carry `group/edit` — a NAMED group, because the card itself is a `group` and a bare
 * `group-hover` would light every pencil on the card at once.
 */
import { Pencil } from 'lucide-react'

export function EditPencilCue({ testId = 'edit-pencil-cue' }: { testId?: string }) {
  return (
    <span aria-hidden="true" data-testid={testId} className="relative inline-block h-0 w-0 align-baseline">
      <Pencil
        size={10}
        className="pointer-events-none absolute left-1 -top-2.5 text-text-light opacity-0 transition-opacity group-hover/edit:opacity-100 group-focus-visible/edit:opacity-100"
      />
    </span>
  )
}
