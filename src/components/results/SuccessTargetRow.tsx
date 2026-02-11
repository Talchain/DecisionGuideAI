/**
 * SuccessTargetRow — Compact inline success target input for Options Compare.
 *
 * V9.2 spec:
 * - When set: "Success target ≥ [value]" + "Apply & rerun" button + microcopy
 * - When unset: placeholder prompting user to set a target
 * - Replaces legacy SuccessTarget.tsx (323-line multi-target component)
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { Check } from 'lucide-react'
import { typography } from '../../styles/typography'

export interface SuccessTargetRowProps {
  /** Current goal threshold value (null = not set) */
  goalThreshold?: number | null
  /** Whether the threshold was extracted from the brief */
  isFromBrief?: boolean
  /** Whether analysis is currently running */
  isRunning?: boolean
  /** Callback when user commits a new threshold value */
  onApplyThreshold?: (threshold: number) => void
}

export function SuccessTargetRow({
  goalThreshold,
  isFromBrief = false,
  isRunning = false,
  onApplyThreshold,
}: SuccessTargetRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const hasTarget = goalThreshold != null

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleStartEdit = useCallback(() => {
    if (isRunning) return
    setEditValue(hasTarget ? String(goalThreshold) : '')
    setIsEditing(true)
  }, [isRunning, hasTarget, goalThreshold])

  const handleCommit = useCallback(() => {
    const parsed = parseFloat(editValue)
    if (!isNaN(parsed) && onApplyThreshold) {
      onApplyThreshold(parsed)
    }
    setIsEditing(false)
  }, [editValue, onApplyThreshold])

  const handleRevert = useCallback(() => {
    setIsEditing(false)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleCommit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleRevert()
    }
  }, [handleCommit, handleRevert])

  return (
    <div className="p-3 bg-panel border border-panel-border rounded-lg" data-testid="success-target-row">
      <div className="flex items-center gap-2 min-h-[28px]">
        <span className={`${typography.panelHeader} text-text-header flex-shrink-0`}>
          Success target
          {isFromBrief && (
            <span className={`${typography.panelMeta} text-text-light font-normal ml-1`}>
              (from brief)
            </span>
          )}
        </span>

        {hasTarget && !isEditing && (
          <>
            <span className={`${typography.panelBody} text-text-light`}>≥</span>
            <button
              type="button"
              onClick={handleStartEdit}
              disabled={isRunning}
              className={`${typography.panelBody} text-info hover:underline cursor-pointer tabular-nums disabled:opacity-50 disabled:cursor-not-allowed`}
              aria-label={`Edit success target: ${goalThreshold}`}
            >
              {goalThreshold}
            </button>
          </>
        )}

        {isEditing && (
          <span className="inline-flex items-center gap-1">
            <span className={`${typography.panelBody} text-text-light`}>≥</span>
            <input
              ref={inputRef}
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleRevert}
              disabled={isRunning}
              className={`w-[100px] px-2 py-1 ${typography.panelBody} border border-info rounded focus:outline-none focus:ring-2 focus:ring-info tabular-nums`}
              aria-label="Edit success target value"
            />
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                handleCommit()
              }}
              className="w-5 h-5 flex items-center justify-center text-success hover:text-success-hover rounded transition-colors"
              aria-label="Apply value"
              title="Apply"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </span>
        )}

        {!hasTarget && !isEditing && (
          <button
            type="button"
            onClick={handleStartEdit}
            disabled={isRunning}
            className={`${typography.panelBody} text-info hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Set target
          </button>
        )}
      </div>

      {/* Microcopy */}
      {hasTarget && !isEditing && (
        <p className={`${typography.panelMeta} text-text-light mt-1.5`}>
          <strong className="text-text-body">Wins</strong> = outperforms alternatives.{' '}
          <strong className="text-text-body">Hits target</strong> = reaches your success target.
        </p>
      )}
      {!hasTarget && !isEditing && (
        <p className={`${typography.panelMeta} text-text-light mt-1.5`}>
          Set a success target to see each option's chance of achieving it.
        </p>
      )}
    </div>
  )
}
