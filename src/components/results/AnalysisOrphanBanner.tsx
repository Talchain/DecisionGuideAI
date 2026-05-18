/**
 * AnalysisOrphanBanner — surfaced when the Results panel is showing a
 * `direct_plot_legacy` style result with the V5 canonical-analysis flag ON
 * but no successful V5 run_analysis fact attached to the current scenario.
 *
 * v5-canonical-analysis brief (PR 1, item 5):
 * - Source classification comes from `useAnalysisStateSource`.
 * - Render only when source === 'orphaned_plot_result'. The flag being OFF
 *   is NOT an orphan condition (per correction 2).
 * - The "Run analysis" button fires the exact same V5 chip/action path the
 *   suggested chips use (action_type: 'run_analysis', source: 'chip')
 *   — never a free-text message. The dispatcher is read off the
 *   GuidanceStore (registered by ConversationPanel on mount).
 *
 * Copy constraints (no emoji, no em dash, no "winner/winning", no internal
 * terms like "validator/schema/dispatcher/handler/trace/payload").
 */
import { useCallback } from 'react'

import { useGuidanceStore } from '../../canvas/stores/guidanceStore'
import { useAnalysisStateSource } from '../../canvas/hooks/useAnalysisStateSource'
import { typography } from '../../styles/typography'

export function AnalysisOrphanBanner() {
  const { showOrphanBanner } = useAnalysisStateSource()
  const dispatchAction = useGuidanceStore((s) => s._dispatchAction)

  const handleRunAnalysis = useCallback(() => {
    if (!dispatchAction) return
    dispatchAction({
      action_type: 'run_analysis',
      label: 'Run analysis',
      message: 'Run analysis',
      source: 'chip',
    })
  }, [dispatchAction])

  if (!showOrphanBanner) return null

  return (
    <div
      role="status"
      data-testid="analysis-orphan-banner"
      className="flex items-start gap-3 rounded-lg border border-panel-border bg-panel p-3"
    >
      <div className="flex-1">
        <p className={`${typography.body} text-text-body`}>
          Analysis needs refresh
        </p>
        <p className={`${typography.bodySmall} text-text-light mt-1`}>
          Re-run analysis to attach AI explanations to these results.
        </p>
      </div>
      <button
        type="button"
        onClick={handleRunAnalysis}
        disabled={!dispatchAction}
        data-testid="analysis-orphan-banner-run"
        className={[
          'shrink-0 rounded-full px-4 py-2 min-h-[44px]',
          'bg-primary text-text-on-color',
          'hover:opacity-90 active:opacity-80',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2',
          'disabled:opacity-40 disabled:pointer-events-none',
          typography.bodySmall,
        ].join(' ')}
      >
        Run analysis
      </button>
    </div>
  )
}
