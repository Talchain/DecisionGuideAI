/**
 * SuccessTarget Component (Task 2 redesign)
 *
 * Always-visible inline input for setting success target threshold.
 * Replaces the previous multi-state design with a simpler inline approach.
 *
 * Design guidelines compliance:
 * - Input: min-height 44px, 12px 16px padding, 12px border-radius
 * - Button: sm size (8px 16px padding), secondary style
 * - Label: 14px (typography.label)
 */

import { useState, useCallback, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { typography } from '../../styles/typography'

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
 * Get placeholder text based on unit type.
 */
function getPlaceholder(unit?: 'currency' | 'percent' | 'count', symbol?: string): string {
  switch (unit) {
    case 'currency':
      return symbol ? `e.g. ${symbol}20000` : 'e.g. 20000'
    case 'percent':
      return 'e.g. 50'
    default:
      return 'e.g. 100'
  }
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
  const [inputValue, setInputValue] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  // Sync input value with goalThreshold when it changes externally
  useEffect(() => {
    setInputValue(goalThreshold?.toString() ?? '')
    setHasChanges(false)
  }, [goalThreshold])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    // Check if value differs from current threshold
    const numValue = newValue === '' ? null : parseFloat(newValue)
    const currentValue = goalThreshold ?? null
    setHasChanges(numValue !== currentValue)
  }, [goalThreshold])

  const handleApplyAndRerun = useCallback(() => {
    if (!onApplyThreshold) return

    const numValue = inputValue === '' ? null : parseFloat(inputValue)
    // Only apply if it's a valid number or explicitly clearing
    if (inputValue !== '' && isNaN(numValue as number)) return

    onApplyThreshold(numValue)
    setHasChanges(false)
  }, [inputValue, onApplyThreshold])

  const handleRemoveThreshold = useCallback(() => {
    if (!onApplyThreshold) return
    onApplyThreshold(null)
    setInputValue('')
    setHasChanges(false)
  }, [onApplyThreshold])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && hasChanges) {
      handleApplyAndRerun()
    }
  }, [hasChanges, handleApplyAndRerun])

  const hasThreshold = goalThreshold != null
  const showApplyButton = hasChanges && inputValue !== ''
  const showRemoveButton = hasThreshold

  // Build label text
  const labelText = goalLabel || 'Success target'
  const attribution = isFromBrief ? ' (from your brief)' : hasThreshold ? ' (your target)' : ''

  return (
    <div className="p-4 bg-panel border border-panel-border rounded-lg" data-testid="success-target">
      {/* Helper text as label - 14px per design guidelines */}
      <label className={`block ${typography.label} text-text-light mb-2`}>
        Set a success target to see how likely you are to achieve your goal
      </label>

      {/* Inline input row */}
      <div className="flex items-center gap-3">
        {/* Label + input */}
        <div className="flex items-center gap-2 flex-1">
          <span className={`${typography.label} text-text-body font-medium whitespace-nowrap`}>
            {labelText}:
          </span>
          <div className="relative flex-1 max-w-[200px]">
            <input
              type="number"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={getPlaceholder(outcomeUnit, outcomeUnitSymbol)}
              disabled={isRunning}
              className="w-full min-h-[44px] px-4 py-3 text-sm border border-panel-border rounded-xl focus:outline-none focus:ring-2 focus:ring-info focus:border-info disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={`${labelText} value`}
            />
            {/* Remove button (× inside input when threshold exists) */}
            {showRemoveButton && !isRunning && (
              <button
                onClick={handleRemoveThreshold}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-light hover:text-danger rounded transition-colors"
                aria-label="Remove target"
                type="button"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {/* Attribution */}
          {attribution && (
            <span className={`${typography.label} text-text-light whitespace-nowrap`}>
              {attribution}
            </span>
          )}
        </div>

        {/* Apply button - only visible when value has changed */}
        {showApplyButton && (
          <button
            onClick={handleApplyAndRerun}
            disabled={isRunning}
            className="px-4 py-2 text-sm font-medium text-text-body bg-transparent border border-panel-border hover:bg-panel-hover rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
            type="button"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Running...
              </>
            ) : (
              'Apply and re-run'
            )}
          </button>
        )}
      </div>
    </div>
  )
}
