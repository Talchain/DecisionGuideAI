/**
 * AnalysisFreshnessNotice — cautious freshness/staleness messaging for the
 * Analysis results path.
 *
 * Renders CEE's `analysis_ready.freshness` verdict (held in the `analysisFreshness`
 * store slice) as one of four non-scientific lines. It reads the slice directly
 * (a `state` prop overrides it for tests/stories). When the slice is unset it
 * renders nothing — it never asserts a freshness state we don't have.
 *
 * Source rules live in the slice reducer (retain / order-by-computed_at /
 * never-absence→fresh). This component is display-only: it does NOT use
 * v5AnalysisFact directly, the graph-hash stale guard deleted on 2026-07-16,
 * or any local graph-hash computation, and it never shows the technical
 * reason/hash fields as copy (they ride on data-*).
 *
 * RERUN OWNERSHIP (anchor-run-control, Paul 21-Jul)
 * -------------------------------------------------
 * This strip is INFORMATIONAL: it states fresh/stale/unknown but carries NO
 * Rerun. The one Rerun lives in the sticky bottom AnalysisFooter (OutputsDock),
 * ALONGSIDE the robustness verdict — the always-visible anchor Paul expects the
 * run control to occupy. The footer sits OUTSIDE the tab's one scroller, so it
 * can never scroll away; there is exactly one Rerun and no duplicate.
 *
 * `sticky top-0 z-10 bg-panel` is kept so the freshness line stays legible over
 * the scrolling body (not to pin a control) — see OutputsDock.rerunSingleOwner.
 */
import { useEffect, useRef } from 'react'
import { useCanvasStore } from '@/canvas/store'
import { useAnalysisStateSource } from '@/canvas/hooks/useAnalysisStateSource'
import { typography } from '@/styles/typography'
import {
  classifyFreshnessForDisplay,
  resolveDisplayedFreshness,
  type AnalysisFreshnessState,
  type AnalysisFreshnessValue,
} from '@/canvas/store/analysisFreshness'
import { resolveTrustEffectiveState } from '@/canvas/hooks/useAnalysisTrust'
import { useShowToastSafe } from '@/canvas/ToastContext'
import { RUN_ENDED_WITHOUT_NEW_RESULTS_COPY } from '@/canvas/components/analysisRunStatus'

/** Cautious, non-scientific copy. One short line per state. */
export const FRESHNESS_COPY: Record<AnalysisFreshnessValue, string> = {
  fresh: 'Analysis reflects the current model.',
  stale: 'Model changed since this analysis. Re-run to update.',
  unknown: 'Cannot confirm whether this analysis is current.',
  none: 'No analysis yet.',
}

// Prototype v6 dot vocabulary: the status indicator is a colour-only dot —
// no shape change between states (parity audit: icon-shape swapping added a
// second channel the prototype deliberately avoids).
const DOT_COLOUR: Record<AnalysisFreshnessValue, string> = {
  fresh: 'bg-success',
  stale: 'bg-warning',
  unknown: 'bg-text-light',
  none: 'bg-text-light',
}

export interface AnalysisFreshnessNoticeProps {
  /** Override the store slice (tests / Storybook). `undefined` → read the store. */
  state?: AnalysisFreshnessState | null
  /** Override the local dirty overlay (tests / Storybook). `undefined` → read the store. */
  dirty?: boolean
  className?: string
}

/** Orphan axis only — the strip already owns verdict + running locally. */
function useAnalysisTrustSource(): { orphaned: boolean } {
  const { source } = useAnalysisStateSource()
  return { orphaned: source === 'orphaned_plot_result' }
}

export function AnalysisFreshnessNotice({ state: stateProp, dirty: dirtyProp, className = '' }: AnalysisFreshnessNoticeProps) {
  const showToast = useShowToastSafe()
  const storeState = useCanvasStore((s) => s.analysisFreshness)
  const storeDirty = useCanvasStore((s) => s.analysisFreshnessDirty)
  const resultsStatus = useCanvasStore((s) => s.results?.status)
  const importHold = useCanvasStore((s) => s.importPendingServerRegistration)
  const state = stateProp !== undefined ? stateProp : storeState
  const dirty = dirtyProp !== undefined ? dirtyProp : storeDirty
  const isRunning =
    resultsStatus === 'preparing' || resultsStatus === 'connecting' || resultsStatus === 'streaming'

  // F11 fold: the orphan banner is DELETED as a separate surface — a result
  // with no live run fact (recovered session) is this strip's no-verdict
  // cannot-confirm variant, carrying the SAME single Rerun action (C1: one
  // Rerun owner). Before the fold, one underlying state could stack two
  // banners ("Results may be outdated" + "Refresh analysis") — Paul's
  // 16-Jul session, F10+F11.
  const { orphaned } = useAnalysisTrustSource()

  // The ONE precedence rule, shared with computeAnalysisTrust so the strip
  // and the composed hook cannot diverge: a held fresh/stale/unknown verdict
  // wins; an orphaned result with NO verdict — or with a 'none' verdict,
  // which would claim "No analysis yet." over a visible results body —
  // renders the cannot-confirm variant with the one Rerun. No verdict and no
  // orphan → nothing to say (never claim a freshness state we don't hold).
  const { state: effectiveState, orphanSynthesised } = resolveTrustEffectiveState(state, orphaned)

  // The toast must claim exactly what the strip claims — same state, same
  // classification (acceptance: the completion toast and the strip can never
  // disagree). 'current' is the ONLY semantic that supports "with the current
  // model"; a retained 'stale', a cannot-confirm downgrade or a
  // run-completed-without-verdict all get the neutral completion line.
  // Interim 2.467: the toast must claim exactly what the strip claims, so it
  // takes the same importHold input (an unregistered import can never produce
  // the "with the current model" completion line).
  const completionSemantic = classifyFreshnessForDisplay(effectiveState, dirty, importHold)

  // Parity audit: the prototype confirms a completed rerun. Watch the
  // running→complete transition; the strip is the canonical freshness owner
  // so the toast lives here (single mount — no double-fire).
  const wasRunningRef = useRef(false)
  useEffect(() => {
    if (isRunning) {
      wasRunningRef.current = true
    } else if (wasRunningRef.current) {
      wasRunningRef.current = false
      if (resultsStatus === 'complete') {
        // Lane 3 (SF2) toast honesty: a resultless SETTLE also lands on
        // 'complete' (the previous report restored, no new results) — with
        // the body now mounted through the run, announcing "rerun completed"
        // for that case would be a lie.
        if (useCanvasStore.getState().results?.settledWithoutNewReport) {
          // Shared constant (review-folds C2): the dock-level announcer
          // speaks the SAME copy for this settle — one string, no drift.
          showToast(RUN_ENDED_WITHOUT_NEW_RESULTS_COPY)
        } else if (completionSemantic === 'current') {
          showToast('Analysis rerun completed with the current model')
        } else {
          showToast('Analysis rerun completed')
        }
      }
    }
  }, [isRunning, resultsStatus, showToast, completionSemantic])

  if (!effectiveState) return null

  // CEE verdict is the source of truth; the local dirty overlay may only
  // downgrade a retained 'fresh' to cannot-confirm (never fabricate 'stale').
  const freshness = resolveDisplayedFreshness(effectiveState, dirty) as AnalysisFreshnessValue
  const isStale = freshness === 'stale'
  // Mark when the displayed verdict differs from CEE's because of a local edit —
  // technical signal for tests/debug only, not user copy.
  const downgraded = effectiveState.freshness === 'fresh' && freshness === 'unknown'

  return (
    <div
      data-testid="analysis-freshness-notice"
      data-freshness={freshness}
      data-cee-freshness={effectiveState.freshness}
      data-freshness-dirty={downgraded ? 'true' : undefined}
      data-orphaned={orphanSynthesised ? 'true' : undefined}
      data-freshness-reason={effectiveState.freshnessReason}
      // `sticky top-0 z-10 bg-panel` keeps the freshness line legible over the
      // scrolling body; the Rerun lives in the bottom anchor (see header).
      className={`sticky top-0 z-10 flex items-center gap-2 rounded-md border px-3 py-2 bg-panel ${isStale ? 'border-warning/30' : 'border-panel-border'} ${className}`.trim()}
    >
      <span
        className={`flex-none w-2 h-2 rounded-full ${isRunning ? 'bg-info' : DOT_COLOUR[freshness]}`}
        aria-hidden="true"
        data-testid="freshness-dot"
      />
      {/* Live region on the freshness copy. Stale message renders in header
          colour per the prototype's heavier emphasis; a run in flight states
          so honestly. Recovery (Rerun) lives in the bottom anchor footer. */}
      <span role="status" className={`${typography.panelBody} ${isStale ? 'text-text-header' : 'text-text-body'} flex-1`}>
        {isRunning ? 'Rerunning the analysis with the current model…' : FRESHNESS_COPY[freshness]}
      </span>
    </div>
  )
}

export default AnalysisFreshnessNotice
