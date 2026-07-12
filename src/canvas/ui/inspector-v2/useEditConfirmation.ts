/**
 * useEditConfirmation — tracks last-edited field for "Updated ✓" indicator.
 * Returns { confirm(field), lastConfirmed, isStaleAfterEdit }.
 *
 * Wave F-B (brief §5.3): staleness comes from the CANONICAL freshness owner
 * (CEE verdict + the local dirty overlay via resolveDisplayedFreshness),
 * never a local had-results heuristic. The prompt still requires an edit
 * confirmed in THIS panel (lastConfirmed) so untouched panels stay quiet.
 */

import { useState, useCallback } from 'react'
import { useCanvasStore } from '../../store'
import { resolveDisplayedFreshness } from '../../store/analysisFreshness'

export function useEditConfirmation() {
  const [lastConfirmed, setLastConfirmed] = useState<{ field: string; ts: number } | null>(null)
  const freshness = useCanvasStore(s => s.analysisFreshness)
  const dirty = useCanvasStore(s => s.analysisFreshnessDirty)

  const confirm = useCallback((field: string) => {
    setLastConfirmed({ field, ts: Date.now() })
  }, [])

  // Not confirmably fresh per the sole freshness owner + an edit happened here.
  const displayed = freshness ? resolveDisplayedFreshness(freshness, dirty) : null
  const notConfirmablyFresh = displayed === 'stale' || displayed === 'unknown'
  const isStaleAfterEdit = notConfirmablyFresh && lastConfirmed !== null

  return { confirm, lastConfirmed, isStaleAfterEdit }
}
