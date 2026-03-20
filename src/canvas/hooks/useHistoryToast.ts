/**
 * useHistoryToast — Shows a transient toast with undo action after each labelled history entry.
 *
 * Subscribes to the history past array length. When it increases and the most recent
 * entry has a label, fires a toast with the label and an "Undo" action button.
 *
 * Graph Editing Experience Task 8d.
 */

import { useEffect, useRef } from 'react'
import { useCanvasStore } from '../store'
import { useShowToast } from '../ToastContext'

export function useHistoryToast() {
  const showToast = useShowToast()
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
