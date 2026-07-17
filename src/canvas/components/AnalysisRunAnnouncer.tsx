/**
 * AnalysisRunAnnouncer — THE single aria-live region for analysis run
 * start/settle (F9, UI brief 2026-07-16 item 3).
 *
 * Mounted ONCE at the dock root, outside every tab branch, so it survives
 * tab switches and speaks for runs dispatched while Compare, Model or Olumi
 * is fronted (before F9, those runs were silent AND invisible). The
 * per-surface treatments (AnalysisRunStateCover) are visual only.
 *
 * While the Analysis tab is fronted the announcer yields, because that
 * tab's own furniture already announces: the running banner's narration div
 * at start (announcing on top of it is the #329 double-announce trap) and
 * the completion toast / error alert at settle. That yield rule is the pure
 * `runAnnouncementForTransition` in analysisRunStatus.ts, next to the
 * Wave1-L2 ongoing-narration rule it extends.
 *
 * Announcements fire only on observed TRANSITIONS of the composed
 * `useAnalysisTrust().isRunning` (one trust surface): a mid-run mount does
 * not retroactively announce a start it never saw, and fronting a different
 * tab mid-run never re-announces (the message only changes on a
 * transition).
 */
import { useEffect, useRef, useState } from 'react'

import { useCanvasStore } from '../store'
import { useAnalysisTrust } from '../hooks/useAnalysisTrust'
import { runAnnouncementForTransition } from './analysisRunStatus'

export interface AnalysisRunAnnouncerProps {
  /** The Analysis tab is fronted (dock open, results tab active). */
  analysisTabFronted: boolean
}

export function AnalysisRunAnnouncer({ analysisTabFronted }: AnalysisRunAnnouncerProps) {
  const { isRunning } = useAnalysisTrust()
  const resultsStatus = useCanvasStore((s) => s.results?.status ?? null)

  const [message, setMessage] = useState('')

  // Read at transition time via refs so the effect below fires ONLY on
  // isRunning transitions: a tab switch or status refinement mid-run must
  // never re-announce.
  const frontedRef = useRef(analysisTabFronted)
  frontedRef.current = analysisTabFronted
  const statusRef = useRef(resultsStatus)
  statusRef.current = resultsStatus

  // The settled status held BEFORE a run starts (updated only while not
  // running). runAnnouncementForTransition uses it to recognise a FIRST run
  // (from idle/cancelled), which the dock's I.1 auto-switch fronts onto the
  // Analysis tab in the same breath — the announcer yields there rather
  // than racing the auto-switch commit.
  const preRunStatusRef = useRef(resultsStatus)

  // Initialised to the CURRENT value: a mount mid-run observed no
  // transition, so it announces nothing retroactively.
  const wasRunningRef = useRef(isRunning)

  useEffect(() => {
    if (isRunning === wasRunningRef.current) {
      if (!isRunning) preRunStatusRef.current = statusRef.current
      return
    }
    wasRunningRef.current = isRunning
    const announcement = runAnnouncementForTransition({
      transition: isRunning ? 'start' : 'settle',
      settledStatus: statusRef.current,
      preRunStatus: preRunStatusRef.current,
      analysisTabFronted: frontedRef.current,
    })
    if (!isRunning) preRunStatusRef.current = statusRef.current
    // A yielded transition clears the region (an empty string announces
    // nothing) rather than holding stale text into the next transition.
    setMessage(announcement ?? '')
  }, [isRunning, resultsStatus])

  return (
    <div
      className="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="analysis-run-announcer"
    >
      {message}
    </div>
  )
}

export default AnalysisRunAnnouncer
