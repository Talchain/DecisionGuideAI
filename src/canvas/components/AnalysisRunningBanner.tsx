/**
 * 1.16i — visible processing for the whole analysis turn (Paul's extended
 * acceptance: the analysis panel must SHOW the run, not just disable
 * buttons). Rendered by OutputsDock while isRunning && a previous report is
 * still on screen — the skeleton covers the no-report case. DS v4: bg-panel,
 * semantic tokens, Lucide only. aria-live announces the state change.
 *
 * Wave1-L2 (seam D-M) — staged honest narration during the 20-30s wait.
 * Client-side, time-based staging only: the copy never claims a pipeline
 * stage, percentage, scenario count or completion proximity we cannot know
 * from the client. The banner unmounts the moment the run completes or errors
 * (OutputsDock's isRunning gate), so every timer is cleared in effect cleanup
 * — no stuck narration. prefers-reduced-motion: static icon and instant text
 * swap instead of the crossfade.
 *
 * This banner is the SINGLE run-status live region wherever it mounts: its
 * stage table subsumes the dock's pre-existing 20s/40s slow-run escalation,
 * which yields to it. See analysisRunStatus.ts for the reconciliation.
 *
 * Round 2 P1 (REGRESSION) — the clock measures the RUN, not this component.
 * The first cut started a counter at zero on mount, so "elapsed" meant "how
 * long this component has existed". Because the banner SUBSUMES the slow-run
 * region, a banner mounting 25s into a run suppressed a correct "taking
 * longer" line and replaced it with the fresh-start line — worse than no
 * banner at all. Elapsed time now derives from `startedAt`, the run's real
 * start (the store's results.startedAt, set by every path that enters a
 * running status and durable across remounts), so remounts, tab switches and
 * a banner appearing mid-run all show the TRUE elapsed time.
 */
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { typography } from '../../styles/typography'

/**
 * Honest, non-specific narration stages keyed by elapsed-second threshold.
 *
 * Copy rules (ratified experience doctrine): calm, plain-language; no
 * fabricated progress numbers; no exclamation marks; and — the binding
 * honesty invariant — no claim of a pipeline stage, count or completion
 * proximity the client cannot know.
 *
 * Elapsed time is the ONLY input. Every line must therefore be true by
 * construction of elapsed time alone, and must STAY true for every second
 * from its own threshold until the run ends — including a run that dies at
 * the 130s timeout. That rules out the whole "almost there" family: the
 * client consumes zero run state, so it can never know the run is close to
 * done. An earlier table claimed "Almost there — shaping the results…" at a
 * fixed 22s and then held it indefinitely, through timeouts included — a
 * progress bar stuck at 95%.
 *
 * Round 2 P1 (HONESTY) — the same invariant also rules out the comparative
 * family. "This is taking longer than usual" fired at 20s, but 20-30s IS the
 * typical wait, so the line was false on a perfectly ordinary run. And
 * "usual" is not derivable from elapsed time at all: the client holds no
 * distribution of past run durations, so it has no baseline to compare
 * against. Rather than invent one, the copy drops the comparison.
 *
 * What survives is exactly what elapsed time licenses: that a run is in
 * flight, and that it is STILL in flight. "Still analysing" is true at every
 * second from its threshold to the timeout, and escalates the acknowledgement
 * without asserting anything unknowable. The 20s and 40s thresholds
 * deliberately match the dock's pre-existing slow-run escalation, which this
 * table subsumes (see analysisRunStatus.ts) — so the banner must have
 * escalated by each of them, or the subsume would silently lose a line the
 * user would otherwise have seen.
 */
export const NARRATION_STAGES = [
  { afterSeconds: 0, message: 'Analysing your decision…' },
  { afterSeconds: 20, message: 'Still analysing your decision…' },
  { afterSeconds: 40, message: 'Still analysing — complex decisions can take a while…' },
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

/**
 * Whole seconds elapsed since a run start. Clamped at zero so clock skew (a
 * start stamped fractionally in the future) reads as "just started" rather
 * than as negative time.
 */
export function elapsedSecondsSince(startedAt: number, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - startedAt) / 1000))
}

export interface AnalysisRunningBannerProps {
  /**
   * Wall-clock ms when the run actually started — the store's
   * results.startedAt, which the dock already reads. Every store path that
   * enters a running status sets it, and it survives this component
   * unmounting, so it is the only honest origin for the narration clock.
   *
   * Omitted only as a defensive fallback: without it the best available
   * origin is mount time, which is what the round-2 regression was.
   */
  startedAt?: number
  /**
   * F9: whether this mount is a live region (role=status, aria-live).
   * Default true — the Analysis tab's mount keeps today's behaviour
   * unchanged. Mounts OUTSIDE the Analysis tab (via AnalysisRunStateCover)
   * pass false: the dock-level AnalysisRunAnnouncer is the single voice for
   * run transitions there, and one live region per surface is exactly the
   * stacked-narration class the Wave1-L2 rule exists to prevent.
   */
  announces?: boolean
}

export function AnalysisRunningBanner({ startedAt, announces = true }: AnalysisRunningBannerProps = {}) {
  const prefersReducedMotion = usePrefersReducedMotion()

  // Fallback origin, captured once so it cannot drift across re-renders.
  const mountedAtRef = useRef<number | null>(null)
  if (mountedAtRef.current === null) mountedAtRef.current = Date.now()
  const runStartedAt = startedAt ?? mountedAtRef.current

  // Elapsed time is RECOMPUTED from the run start on every tick rather than
  // incremented from zero: that is what makes a mid-run mount, a remount and
  // a backgrounded tab all report the true age of the run. The initialiser
  // matters as much as the tick — a banner mounting at 25s must render the
  // 20s stage on its FIRST frame, not after a second of fresh-start copy.
  const [elapsed, setElapsed] = useState(() => elapsedSecondsSince(runStartedAt))
  useEffect(() => {
    setElapsed(elapsedSecondsSince(runStartedAt))
    const interval = setInterval(() => {
      setElapsed(elapsedSecondsSince(runStartedAt))
    }, 1000)
    return () => clearInterval(interval)
  }, [runStartedAt])

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
      {...(announces ? ({ role: 'status', 'aria-live': 'polite' } as const) : {})}
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
