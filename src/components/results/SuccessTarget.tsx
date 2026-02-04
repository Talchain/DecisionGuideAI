/**
 * SuccessTarget Component (P2 Task 1)
 *
 * Inline success target affordance at the top of the Results panel.
 * Surfaces goal_threshold which currently lives buried in advanced settings.
 *
 * Three states:
 * A) Target extracted by CEE: "{goal_label}: {threshold}{unit}" with edit icon + "(from your brief)"
 * B) Target set by user: same as A but no attribution or "(your target)"
 * C) No target: prompt to set one with input affordance
 *
 * Uses "Apply & re-run" button pattern (NOT auto-run on change).
 */

import { useState, useCallback, useEffect } from 'react'
import { Pencil, Target, X, Loader2 } from 'lucide-react'
import { typography } from '../../styles/typography'
import { formatOutcomeValue, type OutcomeUnits } from '../../lib/format'

export interface SuccessTargetProps {
  /** Current goal threshold value */
  goalThreshold?: number | null
  /** Label for the goal (e.g., "MRR", "Churn rate") */
  goalLabel?: string
  /** Unit type for formatting */
  outcomeUnit?: 'currency' | 'percent' | 'count'
  /** Currency symbol if outcomeUnit is 'currency' */
  outcomeUnitSymbol?: string
  /** Whether the threshold was extracted by CEE from the brief */
  isFromBrief?: boolean
  /** Whether an analysis is currently running */
  isRunning?: boolean
  /** Callback when threshold is changed and user clicks "Apply & re-run" */
  onApplyThreshold?: (threshold: number | null) => void
}

/**
 * Format threshold value for display based on unit type.
 */
function formatThreshold(
  value: number | null | undefined,
  unit?: 'currency' | 'percent' | 'count',
  symbol?: string
): string {
  if (value == null) return '—'

  const units: OutcomeUnits = {
    type: unit || 'count',
    symbol: symbol,
  }

  return formatOutcomeValue(value, units)
}

export function SuccessTarget({
  goalThreshold,
  goalLabel,
  outcomeUnit,
  outcomeUnitSymbol,
  isFromBrief = false,
  isRunning = false,
  onApplyThreshold,
}: SuccessTargetProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  // Reset edit state when goalThreshold changes externally
  useEffect(() => {
    if (!isEditing) {
      setEditValue(goalThreshold?.toString() ?? '')
      setHasChanges(false)
    }
  }, [goalThreshold, isEditing])

  const handleStartEdit = useCallback(() => {
    setEditValue(goalThreshold?.toString() ?? '')
    setIsEditing(true)
    setHasChanges(false)
  }, [goalThreshold])

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditValue(goalThreshold?.toString() ?? '')
    setHasChanges(false)
  }, [goalThreshold])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setEditValue(newValue)
    // Check if value differs from current threshold
    const numValue = newValue === '' ? null : parseFloat(newValue)
    setHasChanges(numValue !== goalThreshold)
  }, [goalThreshold])

  const handleApplyAndRerun = useCallback(() => {
    if (!onApplyThreshold) return

    const numValue = editValue === '' ? null : parseFloat(editValue)
    // Only apply if it's a valid number or explicitly clearing
    if (editValue !== '' && (isNaN(numValue as number))) return

    onApplyThreshold(numValue)
    setIsEditing(false)
    setHasChanges(false)
  }, [editValue, onApplyThreshold])

  const handleClearThreshold = useCallback(() => {
    if (!onApplyThreshold) return
    onApplyThreshold(null)
    setIsEditing(false)
    setHasChanges(false)
  }, [onApplyThreshold])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && hasChanges) {
      handleApplyAndRerun()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }, [hasChanges, handleApplyAndRerun, handleCancelEdit])

  const hasThreshold = goalThreshold != null

  // State C: No target set - show prompt (clicking "Set target" transitions to edit mode in State A/B block)
  if (!hasThreshold && !isEditing) {
    return (
      <div className="p-3 bg-panel border border-panel-border rounded-lg" data-testid="success-target">
        <div className="flex items-center gap-3">
          <Target className="w-4 h-4 text-text-light flex-shrink-0" />
          <div className="flex-1">
            <p className={`${typography.body} text-text-body`}>
              Set a success target to see how likely you are to achieve your goal
            </p>
          </div>
          <button
            onClick={handleStartEdit}
            disabled={isRunning}
            className="px-3 py-1.5 text-sm font-medium text-white bg-info hover:bg-info/90 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            Set target
          </button>
        </div>
      </div>
    )
  }

  // State A/B: Target exists - show value with edit option
  return (
    <div className="p-3 bg-panel border border-panel-border rounded-lg" data-testid="success-target">
      {!isEditing ? (
        <div className="flex items-center gap-3">
          <Target className="w-4 h-4 text-success flex-shrink-0" />
          <div className="flex-1">
            <span className={`${typography.body} text-text-body`}>
              <span className="font-medium">Target:</span>{' '}
              {goalLabel ? `${goalLabel} ` : ''}
              {formatThreshold(goalThreshold, outcomeUnit, outcomeUnitSymbol)}
            </span>
            {isFromBrief && (
              <span className="ml-2 text-xs text-text-light">(from your brief)</span>
            )}
            {!isFromBrief && hasThreshold && (
              <span className="ml-2 text-xs text-text-light">(your target)</span>
            )}
          </div>
          <button
            onClick={handleStartEdit}
            disabled={isRunning}
            className="p-1.5 text-text-light hover:text-text-body rounded-md transition-colors disabled:opacity-50"
            aria-label="Edit target"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Target className="w-4 h-4 text-success flex-shrink-0" />
            <span className={`${typography.body} text-text-body font-medium`}>
              Edit target{goalLabel ? ` for ${goalLabel}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={editValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={`Enter ${goalLabel || 'target'} value`}
              autoFocus
              className="flex-1 px-3 py-1.5 text-sm border border-panel-border rounded-md focus:outline-none focus:ring-2 focus:ring-info focus:border-info"
            />
            <button
              onClick={handleApplyAndRerun}
              disabled={!hasChanges || isRunning}
              className="px-3 py-1.5 text-sm font-medium text-white bg-info hover:bg-info/90 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Running...
                </>
              ) : (
                'Apply & re-run'
              )}
            </button>
            <button
              onClick={handleCancelEdit}
              className="p-1.5 text-text-light hover:text-text-body rounded-md transition-colors"
              aria-label="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Option to clear threshold */}
          <button
            onClick={handleClearThreshold}
            disabled={isRunning}
            className="text-xs text-text-light hover:text-danger transition-colors disabled:opacity-50"
          >
            Remove target
          </button>
        </div>
      )}
    </div>
  )
}
