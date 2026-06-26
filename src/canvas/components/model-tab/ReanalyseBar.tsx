/**
 * ReanalyseBar — sticky bottom bar prompting re-analysis after graph edits.
 *
 * Visible only when the analysis is DEFINITELY out of date — the shared CEE
 * freshness display semantic (`classifyFreshnessForDisplay`) is 'changed'
 * (CEE 'stale' OR a retained-fresh-now-dirtied by a local edit), NOT the local
 * `graphEditedSinceLastRun` flag (which would claim "Model changed" without a
 * CEE verdict). Triggers onReanalyse() which calls OutputsDock's handleRunAnalysis.
 */

import { RefreshCw } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { useCanvasStore } from '../../store'
import { classifyFreshnessForDisplay } from '../../store/analysisFreshness'

interface ReanalyseBarProps {
  onReanalyse?: () => void
}

export function ReanalyseBar({ onReanalyse }: ReanalyseBarProps) {
  const analysisFreshness = useCanvasStore(s => s.analysisFreshness)
  const analysisFreshnessDirty = useCanvasStore(s => s.analysisFreshnessDirty)

  if (classifyFreshnessForDisplay(analysisFreshness, analysisFreshnessDirty) !== 'changed') return null

  return (
    <div
      className="sticky bottom-0 left-0 right-0 bg-panel border-t border-warning/30 px-3 py-2 flex items-center justify-between gap-2"
      data-testid="reanalyse-bar"
      role="status"
      aria-live="polite"
    >
      <span className={`${typography.panelMeta} text-text-light flex-1 min-w-0`}>
        Model changed. Results may be out of date.
      </span>
      <button
        type="button"
        onClick={onReanalyse}
        disabled={!onReanalyse}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-text-on-color ${typography.panelMeta} font-medium hover:bg-primary-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-inset disabled:opacity-50 disabled:cursor-not-allowed shrink-0`}
        data-testid="reanalyse-button"
      >
        <RefreshCw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        Rerun analysis
      </button>
    </div>
  )
}
