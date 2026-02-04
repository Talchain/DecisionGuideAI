/**
 * BaselineToggleCard Component (P2 Task 2)
 *
 * Actionable inline card to add a "do nothing" baseline option.
 * Replaces the old passive baseline warning.
 *
 * Features:
 * - Primary action: "Add 'do nothing' baseline" button
 * - Secondary: "Learn why baselines help" expandable explanation
 * - Auto-triggers re-run after baseline is added
 * - Hidden when baseline already exists
 */

import { useState, useCallback } from 'react'
import { Plus, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { typography } from '../../styles/typography'

export interface BaselineToggleCardProps {
  /** Whether to show this card (typically: !hasBaseline) */
  show: boolean
  /** Whether an analysis is currently running */
  isRunning?: boolean
  /** Callback to add baseline and trigger re-run */
  onAddBaseline?: () => void
}

export function BaselineToggleCard({
  show,
  isRunning = false,
  onAddBaseline,
}: BaselineToggleCardProps) {
  const [showExplanation, setShowExplanation] = useState(false)

  const handleAddBaseline = useCallback(() => {
    if (onAddBaseline) {
      onAddBaseline()
    }
  }, [onAddBaseline])

  const toggleExplanation = useCallback(() => {
    setShowExplanation(prev => !prev)
  }, [])

  if (!show) return null

  return (
    <div
      className="p-3 bg-panel border border-warning/30 rounded-lg"
      data-testid="baseline-toggle-card"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className={`${typography.body} text-text-body font-medium`}>
            No baseline option included
          </p>
          <p className={`${typography.caption} text-text-light mt-1`}>
            A baseline helps compare options against your current situation.
          </p>
        </div>
        <button
          onClick={handleAddBaseline}
          disabled={isRunning}
          className="px-3 py-1.5 text-sm font-medium text-white bg-info hover:bg-info/90 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 flex-shrink-0"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" />
              Add 'do nothing' baseline
            </>
          )}
        </button>
      </div>

      {/* Expandable explanation */}
      <div className="mt-2">
        <button
          onClick={toggleExplanation}
          className="text-xs text-text-light hover:text-text-body flex items-center gap-1 transition-colors"
        >
          {showExplanation ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          Learn why baselines help
        </button>
        {showExplanation && (
          <p className={`${typography.caption} text-text-light mt-2 pl-4 border-l-2 border-panel-border`}>
            A baseline anchors comparisons to your current situation, making differences between options more meaningful.
            Without a baseline, it's harder to understand if any option actually improves on doing nothing.
          </p>
        )}
      </div>
    </div>
  )
}
