/**
 * Model tab v2 — KEYBOARD NAVIGATION (design §5.2).
 *
 * ⚠ NOT YET WIRED by the 16 Aug 2026 mount train (which mounted the outline +
 * detail region + in-row editing; the input itself handles Enter/Escape).
 * Tab-through-and-fix remains to be wired to the mounted outline. See
 * `types.ts`.
 *
 * Enter states an intent · Escape cancels · Tab and Shift+Tab move to the next
 * and previous EDITABLE value in outline order · ⌘/Ctrl+Enter confirms a
 * standing proposal. The outline is a list, so tab-through-and-fix is the fast
 * path for repairing many values — which is the entire point of turning the tab
 * into an outline rather than an accordion of report cards.
 *
 * ⚠ THIS HOOK NEVER WRITES AND NEVER REPORTS SUCCESS. Every key that would
 * cause a mutation calls a handler the HOST supplies. When the host supplies
 * none — which is the situation until Codex's transactional-edit vertical
 * freezes its API — the key press does nothing at all and says nothing. It must
 * never swallow the gesture and report a success it cannot know about; that is
 * the fake-success path the lane boundary forbids, and it would be worse here
 * than in a button because a keyboard user gets no visible affordance to
 * disbelieve.
 *
 * The movement logic is exported as PURE FUNCTIONS rather than buried in the
 * hook so its specs can bind to it directly, by identity, without a DOM.
 */

import { useCallback } from 'react'
import type { KeyboardEvent } from 'react'
import type { ModelRow } from './types'

/**
 * The ids a keyboard user can land on, in the order the outline renders them.
 *
 * ⚠ NON-EDITABLE ROWS ARE SKIPPED, NOT HIDDEN. An audit figure or a derived
 * count is still on screen and still selectable with the mouse; it is simply not
 * a stop on the tab-through-and-fix path, because stopping on values nobody can
 * change is what makes keyboard repair slower than the mouse.
 */
export function editableOrder(rows: readonly ModelRow[]): readonly string[] {
  return rows.filter(r => r.editable).map(r => r.id)
}

/**
 * The next editable id after `currentId`, or `null` at the end.
 *
 * ⚠ DELIBERATELY DOES NOT WRAP. Wrapping silently returns the user to the top
 * of a repair queue they believe they have finished, and there is no way to tell
 * the second lap from the first. Returning `null` lets the caller release focus
 * to the browser, which is the behaviour a keyboard user already understands.
 *
 * An unknown `currentId` yields the FIRST editable id — entering the outline
 * from outside is a legitimate state, not an error.
 */
export function nextEditableId(
  rows: readonly ModelRow[],
  currentId: string | null,
  direction: 'forward' | 'backward' = 'forward',
): string | null {
  const order = editableOrder(rows)
  if (order.length === 0) return null

  const index = currentId === null ? -1 : order.indexOf(currentId)
  if (index === -1) {
    return direction === 'forward' ? order[0] : order[order.length - 1]
  }

  const target = direction === 'forward' ? index + 1 : index - 1
  if (target < 0 || target >= order.length) return null
  return order[target]
}

/**
 * Handlers the HOST owns. Every one of them is optional, and an absent handler
 * means the corresponding key does nothing — never a stub, never a local write.
 */
export interface OutlineKeyboardHandlers {
  /** Move the keyboard's focus. Pure navigation; safe to supply today. */
  onMoveTo?: (id: string) => void
  /** Enter — state an intent to edit. Requires the write authority. */
  onStateIntent?: (id: string) => void
  /** Escape — abandon whatever is in progress on this row. */
  onCancel?: (id: string) => void
  /** ⌘/Ctrl+Enter — confirm a standing proposal. Requires the write authority. */
  onConfirmProposal?: (id: string) => void
}

export interface UseOutlineKeyboardArgs {
  rows: readonly ModelRow[]
  focusedId: string | null
  handlers?: OutlineKeyboardHandlers
}

export function useOutlineKeyboard({ rows, focusedId, handlers }: UseOutlineKeyboardArgs) {
  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const id = focusedId

      if (event.key === 'Tab') {
        const target = nextEditableId(rows, id, event.shiftKey ? 'backward' : 'forward')
        // At either end, the event is left alone so focus leaves the outline the
        // way the browser would normally take it.
        if (target === null) return
        event.preventDefault()
        handlers?.onMoveTo?.(target)
        return
      }

      if (id === null) return

      if (event.key === 'Enter') {
        /*
         * ⌘/Ctrl+Enter confirms; a bare Enter states an intent. Both are checked
         * against a handler being present: with no write authority wired, the
         * gesture is a no-op and the row keeps saying what it said before.
         */
        if (event.metaKey || event.ctrlKey) {
          if (handlers?.onConfirmProposal) {
            event.preventDefault()
            handlers.onConfirmProposal(id)
          }
          return
        }
        if (handlers?.onStateIntent) {
          event.preventDefault()
          handlers.onStateIntent(id)
        }
        return
      }

      if (event.key === 'Escape') {
        if (handlers?.onCancel) {
          event.preventDefault()
          handlers.onCancel(id)
        }
      }
    },
    [rows, focusedId, handlers],
  )

  return { onKeyDown, editableIds: editableOrder(rows) }
}
