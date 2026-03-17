/**
 * DraftLoadingAnimation
 *
 * Time-based progressive loading indicator for AI draft generation.
 * Status message escalates based on elapsed wall-clock time so users
 * understand the system is still working on complex briefs.
 *
 * Stages:
 *   0–15 s  "Generating your decision model…"
 *  15–30 s  "Mapping factors and causal relationships…"
 *  30–60 s  "This is a complex decision — building a thorough model…"
 *  60–120 s "Still working — complex briefs can take up to two minutes. You can keep waiting or simplify your brief and try again."
 */

import { useEffect, useState, useRef } from 'react'
import { typography } from '../../styles/typography'

/** Progressive message stages keyed by elapsed-second threshold */
export const PROGRESSIVE_STAGES = [
  { afterSeconds: 0,  message: 'Generating your decision model…' },
  { afterSeconds: 15, message: 'Mapping factors and causal relationships…' },
  { afterSeconds: 30, message: 'This is a complex decision — building a thorough model…' },
  { afterSeconds: 60, message: 'Still working — complex briefs can take up to two minutes. You can keep waiting or simplify your brief and try again.' },
] as const

/** Resolve the current message for a given elapsed time (seconds) */
export function messageForElapsed(elapsedSeconds: number): string {
  // Walk stages in reverse to find the highest threshold that applies
  for (let i = PROGRESSIVE_STAGES.length - 1; i >= 0; i--) {
    if (elapsedSeconds >= PROGRESSIVE_STAGES[i].afterSeconds) {
      return PROGRESSIVE_STAGES[i].message
    }
  }
  return PROGRESSIVE_STAGES[0].message
}

export function DraftLoadingAnimation() {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())

  useEffect(() => {
    startRef.current = Date.now()
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const message = messageForElapsed(elapsed)

  return (
    <div className="flex flex-col items-center justify-center py-6 px-4" data-testid="draft-loading">
      {/* Status text */}
      <div className="text-center min-h-[48px]">
        <p className={`${typography.body} text-text-body transition-opacity duration-300`}>
          {message}
        </p>
        <p className={`${typography.caption} text-text-light mt-1`}>
          {elapsed < 60
            ? `${elapsed}s elapsed`
            : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s elapsed`}
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-48 h-1.5 bg-panel-border rounded-full mt-4 overflow-hidden">
        <div
          className="h-full rounded-full animate-progress-sweep bg-info"
        />
      </div>
    </div>
  )
}
