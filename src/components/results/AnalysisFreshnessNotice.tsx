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
 * v5AnalysisFact, useStaleGuard, or any local graph-hash computation, and it
 * never shows the technical reason/hash fields as copy (they ride on data-*).
 */
import { useEffect, useRef } from 'react'
import { RefreshCw } from 'lucide-react'
import { useCanvasStore } from '@/canvas/store'
import { typography } from '@/styles/typography'
import {
  resolveDisplayedFreshness,
  type AnalysisFreshnessState,
  type AnalysisFreshnessValue,
} from '@/canvas/store/analysisFreshness'
import { executeCanonicalRun } from '@/canvas/analysis/canonicalRunRegistry'
import { useShowToastSafe } from '@/canvas/ToastContext'

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

export function AnalysisFreshnessNotice({ state: stateProp, dirty: dirtyProp, className = '' }: AnalysisFreshnessNoticeProps) {
  const showToast = useShowToastSafe()
  const storeState = useCanvasStore((s) => s.analysisFreshness)
  const storeDirty = useCanvasStore((s) => s.analysisFreshnessDirty)
  const resultsStatus = useCanvasStore((s) => s.results?.status)
  const state = stateProp !== undefined ? stateProp : storeState
  const dirty = dirtyProp !== undefined ? dirtyProp : storeDirty
  const isRunning =
    resultsStatus === 'preparing' || resultsStatus === 'connecting' || resultsStatus === 'streaming'

  // Parity audit: the prototype confirms a completed rerun ('Analysis rerun
  // completed with the current model'). Watch the running→complete
  // transition; the strip is the canonical freshness owner so the toast
  // lives here (single mount — no double-fire).
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
          showToast('The run ended without new results. Showing your previous analysis.')
        } else {
          showToast('Analysis rerun completed with the current model')
        }
      }
    }
  }, [isRunning, resultsStatus, showToast])

  // No verdict yet → no notice (never claim a freshness state we don't hold).
  if (!state) return null

  // CEE verdict is the source of truth; the local dirty overlay may only
  // downgrade a retained 'fresh' to cannot-confirm (never fabricate 'stale').
  const freshness = resolveDisplayedFreshness(state, dirty) as AnalysisFreshnessValue
  const isStale = freshness === 'stale'
  // Recovery applies to BOTH not-confirmably-fresh states: a stale verdict
  // and a cannot-confirm 'unknown' (e.g. recovered session, local edit
  // downgrade). The old top-level banner offered Rerun for both — the strip
  // must not drop that affordance. 'none' has nothing to rerun.
  // Parity audit: the prototype offers Rerun in the FRESH state too (rerun
  // against the current model is always a legitimate action); only 'none'
  // (nothing analysed yet) has nothing to rerun.
  const offersRerun = freshness !== 'none'
  // Mark when the displayed verdict differs from CEE's because of a local edit —
  // technical signal for tests/debug only, not user copy.
  const downgraded = state.freshness === 'fresh' && freshness === 'unknown'

  return (
    <div
      data-testid="analysis-freshness-notice"
      data-freshness={freshness}
      data-cee-freshness={state.freshness}
      data-freshness-dirty={downgraded ? 'true' : undefined}
      data-freshness-reason={state.freshnessReason}
      className={`flex items-center gap-2 rounded-md border px-3 py-2 bg-panel ${isStale ? 'border-warning/30' : 'border-panel-border'} ${className}`.trim()}
    >
      <span
        className={`flex-none w-2 h-2 rounded-full ${isRunning ? 'bg-info' : DOT_COLOUR[freshness]}`}
        aria-hidden="true"
        data-testid="freshness-dot"
      />
      {/* Live region on the copy only (review c) — never around the button.
          Stale message renders in header colour per the prototype's heavier
          emphasis; a run in flight states so honestly. */}
      <span role="status" className={`${typography.panelBody} ${isStale ? 'text-text-header' : 'text-text-body'} flex-1`}>
        {isRunning ? 'Rerunning the analysis with the current model…' : FRESHNESS_COPY[freshness]}
      </span>
      {offersRerun && (
        // Wave F-B (brief §5.2): the strip is the sole stale owner and carries
        // THE recovery action — canonical-runner routed, never a private
        // pipeline. Disabled while any run is analysing ('preparing' from V2
        // resultsStart or V5 resultsAnalysing, plus the SSE states).
        <button
          type="button"
          data-testid="freshness-strip-rerun"
          onClick={() => {
            // Honest recovery (brief §5.2 'the recovery action remains
            // crisp'): a blocked or unavailable run says WHY instead of
            // silently doing nothing.
            void executeCanonicalRun({ source: 'freshness-strip' }).then((outcome) => {
              if (outcome.status === 'blocked' || outcome.status === 'unavailable') {
                showToast(outcome.reason)
              }
            })
          }}
          disabled={isRunning}
          className={`${typography.panelBody} inline-flex items-center gap-1 px-3 py-1 rounded-pill border border-panel-border text-text-body hover:bg-panel-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-fast`}
        >
          <RefreshCw size={12} aria-hidden="true" />
          Rerun
        </button>
      )}
    </div>
  )
}

export default AnalysisFreshnessNotice
