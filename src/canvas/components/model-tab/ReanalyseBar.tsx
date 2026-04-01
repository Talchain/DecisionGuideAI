/**
 * ReanalyseBar — sticky bottom bar prompting re-analysis after graph edits.
 *
 * Visible only when graphEditedSinceLastRun === true in canvas store.
 * Triggers onReanalyse() which calls OutputsDock's handleRunAnalysis.
 */

import { RefreshCw } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { useCanvasStore } from '../../store'

interface ReanalyseBarProps {
  onReanalyse?: () => void
}

export function ReanalyseBar({ onReanalyse }: ReanalyseBarProps) {
  const graphEditedSinceLastRun = useCanvasStore(s => s.graphEditedSinceLastRun)

  if (!graphEditedSinceLastRun) return null

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
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-text-on-color ${typography.panelMeta} font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shrink-0`}
        data-testid="reanalyse-button"
      >
        <RefreshCw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        Re-analyse
      </button>
    </div>
  )
}
