/**
 * ⭐ CARD POSITIONS LAST FOR THIS VISIT, AND THE CANVAS SAYS SO ONCE (DL-3 ruling (1), 19 Oct 2026).
 *
 * Dragging a card sends no request: CEE's canonical model has no position field, so a moved card returns to the
 * model's layout on reopen (verifier, staging fe4e4b9d). Drag stays, because Paul asked to move cards (19 Sep,
 * `ReactFlowGraph.tsx` interaction mode). The first drag of a visit says what it keeps, once. No store.
 */
import { CANVAS_TOAST_EVENT } from './heldCanvasNotices'

export const CARD_POSITION_NOTICE = "Card positions are for this visit; the model's layout is restored when you reopen."

let saidThisVisit = false

/** After a card drag: the notice once per page visit, then nothing. */
export function noteCardMoved(): void {
  if (saidThisVisit || typeof window === 'undefined') return
  saidThisVisit = true
  window.dispatchEvent(new CustomEvent(CANVAS_TOAST_EVENT, { detail: { message: CARD_POSITION_NOTICE, level: 'info' } }))
}

/** Tests only: a fresh visit. */
export function resetCardPositionNoticeForTests(): void {
  saidThisVisit = false
}
