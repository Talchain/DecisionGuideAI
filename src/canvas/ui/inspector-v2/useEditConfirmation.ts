/**
 * useEditConfirmation — tracks last-edited field for "Updated ✓" indicator.
 * Returns { confirm(field), lastConfirmed, isStaleAfterEdit }.
 */

import { useState, useCallback, useRef } from 'react'
import { useCanvasStore } from '../../store'

export function useEditConfirmation() {
  const [lastConfirmed, setLastConfirmed] = useState<{ field: string; ts: number } | null>(null)
  const resultsStatus = useCanvasStore(s => s.results?.status)
  const hadResultsRef = useRef(resultsStatus === 'complete')

  // Track whether results were complete before edit
  if (resultsStatus === 'complete') hadResultsRef.current = true

  const confirm = useCallback((field: string) => {
    setLastConfirmed({ field, ts: Date.now() })
  }, [])

  // Results are stale if they existed before this edit session
  const isStaleAfterEdit = hadResultsRef.current && lastConfirmed !== null

  return { confirm, lastConfirmed, isStaleAfterEdit }
}
