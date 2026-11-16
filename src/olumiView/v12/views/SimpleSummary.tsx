import { useEffect } from 'react'
import type { View } from '../../client'
import { differencesKey, readDifferences, useDifferences } from '../../../olumiCore/team/differences'
import { BODY } from '../../../olumiCore/team/ui'
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
 * One line, e.g. "3 places you differ; 1 changes the answer". Only after an authorised reveal and a valid comparison (two people each gave
 * a view, core's read not gated); otherwise nothing at all, so no count can leak a private view. Counts come from core's differences
 * payload; the words are chrome.
 */
export function SimpleSummary({ sid, view }: { sid: string; view: View }): JSX.Element | null {
  const data = useRevealedDifferences(sid, view)
  if (!validComparison(view, data)) return null
  const line = summaryLine(countDifferences(data))
  return line === null ? null : <p className={BODY} data-testid="differ-summary">{line}</p>
}
