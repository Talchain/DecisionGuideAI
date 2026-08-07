/**
 * AnalysisRunStateCover — the shared in-flight treatment for dock surfaces
 * OUTSIDE the Analysis tab (F9, UI brief 2026-07-16 item 3).
 *
 * Before this, run-state furniture existed only inside the Analysis tab's
 * scroller: dispatching a run with Compare or Model fronted (or with the
 * coaching panel in view) changed NOTHING on screen. This component gives
 * every such surface the same two primitives the Analysis tab already uses:
 *
 *  - content retained behind it → the running banner (same staged, honest
 *    narration, driven by the run's TRUE start clock via
 *    useAnalysisTrust().runStartedAt);
 *  - nothing retained → a skeleton, built from the DS Skeleton brick.
 *
 * Both forms are VISUAL ONLY. The dock-level AnalysisRunAnnouncer is the
 * single aria-live voice for run start/settle, so the banner mounts here
 * with announces=false and the skeleton is decorative (aria-hidden). One
 * live region per surface is exactly the stacked-narration class the
 * Wave1-L2 rule (analysisRunStatus.ts) exists to prevent.
 *
 * Presentational by design: run state arrives as props so render-only
 * bodies (the coaching panel, Phase 0) can adopt it without store access.
 * Store-aware surfaces read `useAnalysisTrust()` and pass `isRunning` /
 * `runStartedAt` straight through — one trust surface, no parallel
 * run-state source.
 */
import { Skeleton } from '../../components/ui/Skeleton'
import { AnalysisRunningBanner } from './AnalysisRunningBanner'

export interface AnalysisRunStateCoverProps {
  /** An analysis is in flight (useAnalysisTrust().isRunning). */
  isRunning: boolean
  /** True run start clock (useAnalysisTrust().runStartedAt). */
  startedAt?: number
  /**
   * Whether the hosting surface keeps content on screen during the run.
   * Retained content gets the banner above it (marked, never blanked);
   * an empty surface gets the skeleton instead of a frozen empty state.
   */
  contentRetained: boolean
}

/** Decorative loading shape: one neutral card of DS Skeleton lines. */
function AnalysisRunSkeleton() {
  return (
    <div
      className="mx-3 mb-2 rounded-md border border-panel-border bg-panel p-3 space-y-2"
      data-testid="analysis-run-skeleton"
      aria-hidden="true"
    >
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  )
}

export function AnalysisRunStateCover({
  isRunning,
  startedAt,
  contentRetained,
}: AnalysisRunStateCoverProps) {
  if (!isRunning) return null
  if (contentRetained) {
    return <AnalysisRunningBanner startedAt={startedAt} announces={false} />
  }
  return <AnalysisRunSkeleton />
}

export default AnalysisRunStateCover
