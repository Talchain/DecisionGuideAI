/**
 * 1.16i — visible processing for the whole analysis turn (Paul's extended
 * acceptance: the analysis panel must SHOW the run, not just disable
 * buttons). Rendered by OutputsDock while isRunning && a previous report is
 * still on screen — the skeleton covers the no-report case. DS v4: bg-panel,
 * semantic tokens, Lucide only. aria-live announces the state change.
 *
 * Wave1-L2 (seam D-M) — staged honest narration during the 20-30s wait.
 * The message advances on wall-clock time only; we deliberately claim
 * nothing the client cannot know (no percentages, no scenario counts, no
 * pipeline-stage telemetry — there is none on this wire). Early completion
 * or error simply unmounts the banner via OutputsDock's isRunning gate, so
 * the only obligation here is to clean up timers and never update after
 * unmount. prefers-reduced-motion drops the text fade (static swap) and
 * stills the spinner via motion-reduce:animate-none.
 */
import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { typography } from '../../styles/typography'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

/**
 * Time-based narration stages. Copy is honest and non-specific: it describes
 * what the analysis genuinely does (robustness simulation, sensitivity
 * weighing) without fabricating progress. Thresholds pace a typical 20-30s
 * run; the final stage holds indefinitely for slower runs.
 */
export const ANALYSIS_NARRATION_STAGES = [
  { afterSeconds: 0, message: 'Setting up your analysis…' },
  { afterSeconds: 6, message: 'Running robustness simulations…' },
  { afterSeconds: 14, message: 'Weighing what moves your decision…' },
  { afterSeconds: 22, message: 'Almost there — shaping the results…' },
] as const

/** Resolve the narration message for a given elapsed time in seconds. */
export function narrationForElapsed(elapsedSeconds: number): string {
  for (let i = ANALYSIS_NARRATION_STAGES.length - 1; i >= 0; i--) {
    if (elapsedSeconds >= ANALYSIS_NARRATION_STAGES[i].afterSeconds) {
      return ANALYSIS_NARRATION_STAGES[i].message
    }
  }
  return ANALYSIS_NARRATION_STAGES[0].message
}

const FINAL_STAGE_INDEX = ANALYSIS_NARRATION_STAGES.length - 1

/** Index of the stage active at a given elapsed time in seconds. */
function stageIndexForElapsed(elapsedSeconds: number): number {
  for (let i = FINAL_STAGE_INDEX; i >= 0; i--) {
    if (elapsedSeconds >= ANALYSIS_NARRATION_STAGES[i].afterSeconds) return i
  }
  return 0
}

export function AnalysisRunningBanner() {
  const [stageIndex, setStageIndex] = useState(0)
  const startRef = useRef(Date.now())
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    startRef.current = Date.now()
    const interval = setInterval(() => {
      const elapsedSeconds = (Date.now() - startRef.current) / 1000
      const next = stageIndexForElapsed(elapsedSeconds)
      setStageIndex((current) => (next > current ? next : current))
      // Final stage holds indefinitely — stop ticking once we are there.
      if (next >= FINAL_STAGE_INDEX) clearInterval(interval)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const message = ANALYSIS_NARRATION_STAGES[stageIndex].message

  return (
    <div
      className="mx-3 mb-2 flex items-center gap-2 rounded-md border border-panel-border bg-panel px-3 py-2"
      data-testid="analysis-running-banner"
      role="status"
      aria-live="polite"
    >
      <Loader2
        className="h-4 w-4 animate-spin motion-reduce:animate-none text-info"
        aria-hidden="true"
      />
      <span
        // Re-key per stage so the fade-in replays on each message swap;
        // reduced motion gets a plain static text swap instead.
        key={stageIndex}
        data-testid="analysis-narration"
        className={`${typography.bodySmall} text-text-body${
          prefersReducedMotion ? '' : ' animate-fadeIn'
        }`}
      >
        {message}
      </span>
    </div>
  )
}
