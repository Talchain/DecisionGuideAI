/**
 * 1.16i — visible processing for the whole analysis turn (Paul's extended
 * acceptance: the analysis panel must SHOW the run, not just disable
 * buttons). Rendered by OutputsDock while isRunning && a previous report is
 * still on screen — the skeleton covers the no-report case. DS v4: bg-panel,
 * semantic tokens, Lucide only. aria-live announces the state change.
 *
 * Wave1-L2 (seam D-M) — staged honest narration during the 20-30s wait.
 * Client-side, time-based staging only: the copy never claims a pipeline
 * stage, percentage or scenario count we cannot know from the client. The
 * banner unmounts the moment the run completes or errors (OutputsDock's
 * isRunning gate), so every timer is cleared in effect cleanup — no stuck
 * narration. prefers-reduced-motion: static icon and instant text swap
 * instead of the crossfade.
 */
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { typography } from '../../styles/typography'

/**
 * Honest, non-specific narration stages keyed by elapsed-second threshold.
 * Copy rules (ratified experience doctrine): calm, plain-language,
 * science-grounded; no fabricated progress numbers; no exclamation marks.
 */
export const NARRATION_STAGES = [
  { afterSeconds: 0, message: 'Setting up your analysis…' },
  { afterSeconds: 6, message: 'Running robustness simulations…' },
  { afterSeconds: 14, message: 'Weighing what moves your decision…' },
  { afterSeconds: 22, message: 'Almost there — shaping the results…' },
] as const

/** Resolve the narration message for a given elapsed time (seconds). */
export function narrationForElapsed(elapsedSeconds: number): string {
  // Walk stages in reverse to find the highest threshold that applies
  for (let i = NARRATION_STAGES.length - 1; i >= 0; i--) {
    if (elapsedSeconds >= NARRATION_STAGES[i].afterSeconds) {
      return NARRATION_STAGES[i].message
    }
  }
  return NARRATION_STAGES[0].message
}

/** Duration of the text crossfade between stages (skipped under reduced motion). */
const CROSSFADE_MS = 200

export function AnalysisRunningBanner() {
  const prefersReducedMotion = usePrefersReducedMotion()

  // Timer-driven elapsed counter (no Date dependence: the banner is mounted
  // for the lifetime of the run, so a 1s tick is accurate enough for copy).
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((s) => s + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const targetMessage = narrationForElapsed(elapsed)

  // Crossfade: fade the old line out, then swap and fade the new one in.
  // Under prefers-reduced-motion the swap is instant and static.
  const [displayed, setDisplayed] = useState(targetMessage)
  const [fading, setFading] = useState(false)
  const reducedMotionRef = useRef(prefersReducedMotion)
  reducedMotionRef.current = prefersReducedMotion

  useEffect(() => {
    if (targetMessage === displayed) return undefined
    if (reducedMotionRef.current) {
      setDisplayed(targetMessage)
      return undefined
    }
    setFading(true)
    const timeout = setTimeout(() => {
      setDisplayed(targetMessage)
      setFading(false)
    }, CROSSFADE_MS)
    return () => clearTimeout(timeout)
  }, [targetMessage, displayed])

  return (
    <div
      className="mx-3 mb-2 flex items-center gap-2 rounded-md border border-panel-border bg-panel px-3 py-2"
      data-testid="analysis-running-banner"
      role="status"
      aria-live="polite"
    >
      <Loader2
        className={`h-4 w-4 text-info ${prefersReducedMotion ? '' : 'animate-spin'}`}
        aria-hidden="true"
      />
      <span
        data-testid="analysis-narration"
        className={`${typography.bodySmall} text-text-body ${
          prefersReducedMotion
            ? ''
            : `transition-opacity duration-200 ${fading ? 'opacity-0' : 'opacity-100'}`
        }`}
      >
        {displayed}
      </span>
    </div>
  )
}
