/**
 * useHistoryToast — Shows a transient toast with undo action after each labelled history entry.
 *
 * Subscribes to the history past array length. When it increases and the most recent
 * entry has a label, fires a toast with the label and an "Undo" action button.
 *
 * Graph Editing Experience Task 8d.
 *
 * ⚠ IT ALSO MOUNTS `useDurableDeletionToast`, AND THAT IS A DELIBERATE CHOICE
 * WITH A REASON, not tidiness. Both hooks answer the same question — *what does
 * the canvas tell the user about what just happened to graph history?* — and
 * they are siblings: this one announces a history entry being PUSHED (offering
 * Undo), the other announces a history entry being RESTORED ONLY IN PART,
 * because the server had durably deleted something in it.
 *
 * The mechanical reason it is composed here rather than called beside this hook
 * in `ReactFlowGraph`: every hook in that region of `ReactFlowGraph` sits after
 * an early return, so all 117 are rules-of-hooks violations held by an explicit
 * ratchet (`scripts/ci/assert-rules-of-hooks-ratchet.mjs`) — *"an exception for
 * its EXISTING violations, not a licence to add more. Each one is a render-time
 * crash."* A second call site there would have added the 118th and failed the
 * gate. Composing costs no new violation and no new mount to keep in sync.
 */

import { useEffect, useRef } from 'react'
import { useCanvasStore } from '../store'
import { useShowToast } from '../ToastContext'
import { useDurableDeletionToast } from './useDurableDeletionToast'

export function useHistoryToast() {
  const showToast = useShowToast()
  // Sibling notice, same surface, same mount — see the header.
  useDurableDeletionToast()
  const prevLengthRef = useRef<number>(0)

  useEffect(() => {
    const unsub = useCanvasStore.subscribe(
      (state) => {
        const currentLength = state.history.past.length
        if (currentLength > prevLengthRef.current) {
          // A new history entry was pushed
          const latest = state.history.past[currentLength - 1]
          if (latest?.label) {
            showToast(latest.label, 'info', {
              label: 'Undo',
              onClick: () => useCanvasStore.getState().undo(),
            })
          }
        }
        prevLengthRef.current = currentLength
      },
    )
    // Initialise ref
    prevLengthRef.current = useCanvasStore.getState().history.past.length
    return unsub
  }, [showToast])
}
