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
import { useAnalysisState } from '../../state/analysisStateSelector'

export function useEditConfirmation() {
  const [lastConfirmed, setLastConfirmed] = useState<{ field: string; ts: number } | null>(null)
  // ⚠ RE-POINTED (analysis-state authority, step 5). This derived
  // `resolveDisplayedFreshness` from the freshness slice directly and was blind
  // to CEE's composed verdict, so the edit-confirmation chip could claim the
  // model was confirmably fresh on a turn CEE had refused to vouch for.
  // Byte-identical when CEE states no verdict.
  const displayed = useAnalysisState().displayedFreshness

  const confirm = useCallback((field: string) => {
    setLastConfirmed({ field, ts: Date.now() })
  }, [])

  // Not confirmably fresh per the sole freshness owner + an edit happened here.
  const notConfirmablyFresh = displayed === 'stale' || displayed === 'unknown'
  const isStaleAfterEdit = notConfirmablyFresh && lastConfirmed !== null

  return { confirm, lastConfirmed, isStaleAfterEdit }
}
