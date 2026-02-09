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
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 bg-warning-bg border border-warning/20 rounded-lg"
      data-testid="baseline-toggle-card"
    >
      {/* Subtle indicator icon (not a prominent warning) */}
      <div className="w-1.5 h-1.5 rounded-full bg-warning flex-shrink-0" aria-hidden="true" />

      {/* Message */}
      <span className={`${typography.panelBody} text-text-body flex-1`}>
        No baseline included
      </span>

      {/* Add baseline text button (calm, not prominent CTA) */}
      <button
        onClick={handleAddBaseline}
        disabled={isRunning}
        className={`${typography.panelBody} text-info hover:text-info-hover hover:underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0`}
        type="button"
      >
        {isRunning ? 'Adding...' : 'Add baseline'}
      </button>
    </div>
  )
}
