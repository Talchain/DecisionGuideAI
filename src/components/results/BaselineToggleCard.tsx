/**
 * BaselineToggleCard Component (Compact single-line redesign)
 *
 * Single-line warning (~40px) when no baseline option is included.
 * Layout: ⚠ No baseline included  [?]  [Add baseline]
 *
 * C1: Baseline does NOT trigger rerun. The [Add baseline] button
 * mutates the decision draft only. User must manually rerun.
 */

import { AlertTriangle } from 'lucide-react'
import { typography } from '../../styles/typography'

export interface BaselineToggleCardProps {
  /** Whether to show this card (typically: !hasBaseline && !isSingleOption) */
  show: boolean
  /** Whether an analysis is currently running */
  isRunning?: boolean
  /** Callback to add baseline to decision draft (does NOT trigger rerun) */
  onAddBaseline?: () => void
}

export function BaselineToggleCard({
  show,
  isRunning = false,
  onAddBaseline,
}: BaselineToggleCardProps) {
  if (!show) return null

  const handleAddBaseline = () => {
    if (onAddBaseline) {
      onAddBaseline()
    }
    // Baseline added to draft. User must manually rerun to generate comparison data.
    console.log('[BaselineToggleCard] Baseline added to draft')
  }

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 bg-warning-light border border-warning/30 rounded-lg max-h-10"
      data-testid="baseline-toggle-card"
    >
      {/* Warning icon */}
      <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" aria-hidden="true" />

      {/* Message */}
      <span className={`${typography.panelBody} text-text-body flex-1`}>
        No baseline included
      </span>

      {/* [?] tooltip */}
      <span
        className={`w-5 h-5 flex items-center justify-center rounded-full ${typography.panelMeta} text-text-light border border-panel-border cursor-help flex-shrink-0`}
        title="A 'do nothing' option shows whether any option improves on your current position."
        aria-label="Why add a baseline?"
      >
        ?
      </span>

      {/* Add baseline button */}
      <button
        onClick={handleAddBaseline}
        disabled={isRunning}
        className={`px-2 py-1 ${typography.panelBody} text-info hover:text-info-hover border border-info/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0`}
        type="button"
      >
        {isRunning ? 'Adding...' : 'Add baseline'}
      </button>
    </div>
  )
}
