import { useEffect } from 'react'
import type { View } from '../../client'
import { differencesKey, readDifferences, useDifferences } from '../../../olumiCore/team/differences'
import { countDifferences, summaryLine, validComparison } from './differGroups'

/** Read core's differences only for a viewer already authorised to see revealed views (so nothing is even asked before a reveal). */
export function useRevealedDifferences(sid: string, view: View) {
  const authorised = !view.gated && view.collab.shared.length > 0
  const key = differencesKey(sid, view)
  const data = useDifferences((s) => (s.sid === sid ? s.data : null))
  useEffect(() => { if (authorised) void readDifferences(sid, key) }, [authorised, sid, key])
  return authorised ? data : null
}

/**
 * The count line, e.g. "3 places you differ; 1 changes the answer": only after an authorised reveal and a valid comparison (two people each
 * gave a view, core's read not gated); otherwise null, so no count can leak a private view. Counts come from core's differences payload; the
 * words are chrome. The Team tab draws it as its "Where you differ" step's line.
 */
export function useDifferLine(sid: string, view: View): string | null {
  const data = useRevealedDifferences(sid, view)
  return validComparison(view, data) ? summaryLine(countDifferences(data)) : null
}
