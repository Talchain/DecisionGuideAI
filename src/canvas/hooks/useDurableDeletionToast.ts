/**
 * useDurableDeletionToast — says, in the product's own voice, that undo declined.
 *
 * WHY A TOAST AND NOT THE ASSISTANT BUBBLE. `STRUCTURAL_DELETE_NOTICE` speaks
 * through a synthetic assistant message because those outcomes arrive on a TURN
 * — the user is reading the chat when the server answers. This one arrives on a
 * CANVAS GESTURE, at the moment of the keystroke, and it must reach the user
 * wherever that gesture came from. It also has to be ungated: the bubble needs a
 * `ConversationProvider`, which `ReactFlowGraph` mounts only when
 * `isAiPanelV2Enabled()`, whereas all four undo entry points
 * (Cmd+Z, the left-rail Undo button, the pane context menu, and the delete
 * toast's own Undo action) are unconditional. A notice that could go dark on the
 * surface that triggers it would re-open the defect quietly.
 *
 * ⚠ SUBSCRIBES BY `seq`, NOT BY VALUE. `ToastProvider` shows one toast at a
 * time and a second identical decline is value-equal to the first, so a
 * value-comparing subscriber would tell the user once for two Cmd+Z presses —
 * exactly the silence this lane exists to remove.
 *
 * ⚠ NO ACTION BUTTON. The sibling history toast offers "Undo"; this one offers
 * nothing, because there is no restore verb in the UI→CEE vocabulary
 * (`WIRE_SYSTEM_EVENT_TYPES`) and every control we could render here would
 * terminate in refusal — the P8 trap `STRUCTURAL_DELETE_NOTICE.base_hash_
 * diverged` documents at length. It states what happened and stops.
 */

import { useEffect, useRef } from 'react'
import { useCanvasStore } from '../store'
import { describeDurableDeletionNotice } from '../store/durableDeletionGuard'
import { useShowToastSafe } from '../ToastContext'

export function useDurableDeletionToast(): void {
  const showToast = useShowToastSafe()
  const lastSeqRef = useRef<number>(0)

  useEffect(() => {
    const unsub = useCanvasStore.subscribe((state) => {
      const notice = state.durableDeletionNotice
      if (notice === null || notice.seq <= lastSeqRef.current) return
      lastSeqRef.current = notice.seq
      // 'warning', so it auto-dismisses: this is a declined gesture, not a
      // failure the user must acknowledge (ToastContext holds `error` on screen
      // until dismissed, which would be a heavier claim than the facts support).
      showToast(describeDurableDeletionNotice(notice), 'warning')
    })
    lastSeqRef.current = useCanvasStore.getState().durableDeletionNotice?.seq ?? 0
    return unsub
  }, [showToast])
}
