import { memo, useCallback } from 'react'
import { AlertTriangle } from 'lucide-react'
import { typography } from '../../styles/typography'
import { useStaleGuard } from '../ui/inspector-v2/useStaleGuard'
import { useV2Run } from '../hooks/useV2Run'
import { useGuidanceStore } from '../stores/guidanceStore'
import { isV5CanonicalAnalysisEnabled } from '../../flags'
import { isV5Eligible } from '../../v5/eligibility'

// Brief §5.4 / §6.2 — persistent badge above the input bar when the
// graph has changed since the last analysis run.
//
//   ⚠ Analysis stale · Rerun
//
// Text-first (correction #15): icon + body text + clickable Rerun link.
// Colour is supplementary. Returns null when the analysis isn't stale.
//
// Rerun goes through the existing run pathway (useV2Run.runV2Analysis) by
// default — no new analysis trigger surface per correction #10.
//
// v5-canonical-analysis brief: when the canonical flag is on, route through
// the same chip-action path that OutputsDock / suggested chips use, so CEE
// persists a run_analysis fact and Phase 3 coaching can attach.

export const StaleAnalysisBadge = memo(function StaleAnalysisBadge() {
  const { isStale } = useStaleGuard()
  const { runV2Analysis, isRunning } = useV2Run()

  const handleRerun = useCallback(() => {
    if (isRunning) return
    if (
      isV5CanonicalAnalysisEnabled() &&
      isV5Eligible({ flag: import.meta.env.VITE_ENABLE_V5_ORCHESTRATOR }).eligible
    ) {
      const dispatch = useGuidanceStore.getState()._dispatchAction
      if (dispatch) {
        dispatch({
          action_type: 'run_analysis',
          label: 'Run analysis',
          message: 'Run analysis',
          source: 'chip',
        })
        return
      }
    }
    void runV2Analysis()
  }, [isRunning, runV2Analysis])

  if (!isStale) return null

  return (
    <div
      data-testid="ai-panel-v2-stale-badge"
      role="status"
      aria-live="polite"
      className={[
        'flex items-center justify-between gap-2 mx-3 mt-1 mb-1',
        'px-2 py-1 rounded-sm bg-panel border border-warning/30',
        typography.panelMeta,
        'text-warning',
      ].join(' ')}
    >
      <span className="inline-flex items-center gap-1.5">
        <AlertTriangle className="w-3 h-3" aria-hidden="true" />
        <span>Analysis stale</span>
      </span>
      <button
        type="button"
        onClick={handleRerun}
        disabled={isRunning}
        className="text-info hover:underline disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-info rounded-sm px-1"
        data-testid="ai-panel-v2-stale-rerun"
        aria-label="Rerun analysis"
      >
        Rerun
      </button>
    </div>
  )
})
