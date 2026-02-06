/**
 * SuccessTarget Component (Redesign — inline-editable, multi-target ready)
 *
 * Displays success target constraints with click-to-edit values
 * and right-aligned probabilities.
 *
 * Interaction:
 * - Click value → edit mode (focused input)
 * - Enter or Apply button → commit edit
 * - Escape or blur → revert (do NOT commit on blur — prevents accidental rerun)
 * - "+ Add" button disabled with tooltip "Coming soon"
 *
 * C7: Small inline "Apply" icon-button appears in edit mode
 * as secondary commit affordance for touch/mobile devices
 * (mobile "Done" key fires blur, not Enter).
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { Plus, Check } from 'lucide-react'
import { typography } from '../../styles/typography'
import type { GoalConstraint } from './types'

export interface SuccessTargetProps {
  /** Array of goal constraints (currently always 0 or 1) */
  goalConstraints: GoalConstraint[]
  /** Probability of meeting ALL constraints jointly (multi-target future) */
  probabilityOfJointGoal?: number | null
  /** Whether the threshold was extracted from brief */
  isFromBrief?: boolean
  /** Whether analysis is running */
  isRunning?: boolean
  /** Callback when a constraint value is edited and committed */
  onUpdateConstraint?: (id: string, newValue: number) => void
  /** Remove a constraint */
  onRemoveConstraint?: (id: string) => void

  // Legacy props for backward compatibility during migration
  /** @deprecated Use goalConstraints instead */
  goalThreshold?: number | null
  /** @deprecated Use goalConstraints[].label instead */
  goalLabel?: string
  /** Unit type for formatting */
  outcomeUnit?: 'currency' | 'percent' | 'count'
  /** Currency symbol if outcomeUnit is 'currency' */
  outcomeUnitSymbol?: string
  /** Callback when threshold is changed */
  onApplyThreshold?: (threshold: number | null) => void
}

/**
 * Format a probability (0-1) as integer percentage string.
 */
function formatProbability(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${Math.round(value * 100)}%`
}

/**
 * Single target row with click-to-edit value.
 */
function TargetRow({
  constraint,
  isEditing,
  onStartEdit,
  onCommit,
  onRevert,
  isRunning,
}: {
  constraint: GoalConstraint
  isEditing: boolean
  onStartEdit: () => void
  onCommit: (newValue: number) => void
  onRevert: () => void
  isRunning: boolean
}) {
  const [editValue, setEditValue] = useState(constraint.value.toString())
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // Sync edit value when constraint changes externally
  useEffect(() => {
    if (!isEditing) {
      setEditValue(constraint.value.toString())
    }
  }, [constraint.value, isEditing])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const parsed = parseFloat(editValue)
      if (!isNaN(parsed)) {
        onCommit(parsed)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onRevert()
    }
  }, [editValue, onCommit, onRevert])

  const handleApplyClick = useCallback(() => {
    const parsed = parseFloat(editValue)
    if (!isNaN(parsed)) {
      onCommit(parsed)
    }
  }, [editValue, onCommit])

  const operatorDisplay = constraint.operator === '>=' ? '≥'
    : constraint.operator === '<=' ? '≤'
    : constraint.operator

  return (
    <div className="flex items-center gap-2 min-h-[36px]">
      {/* Label + operator */}
      <span className={`${typography.body} text-text-body`}>
        {constraint.label}
      </span>
      <span className={`${typography.body} text-text-light`}>
        {operatorDisplay}
      </span>

      {/* Value — click-to-edit */}
      {isEditing ? (
        <span className="inline-flex items-center gap-1">
          <input
            ref={inputRef}
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={onRevert}
            disabled={isRunning}
            className="w-[100px] px-2 py-1 text-sm border border-info rounded focus:outline-none focus:ring-2 focus:ring-info tabular-nums"
            aria-label={`Edit ${constraint.label} value`}
          />
          {/* C7: Apply button for touch/mobile commit */}
          <button
            type="button"
            onMouseDown={(e) => {
              // Prevent blur from firing before click (mouse users)
              e.preventDefault()
              handleApplyClick()
            }}
            onKeyDown={(e) => {
              // Keyboard users: Enter/Space fires keydown, not mousedown
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleApplyClick()
              }
            }}
            className="w-5 h-5 flex items-center justify-center text-success hover:text-success-hover rounded transition-colors"
            aria-label="Apply value"
            title="Apply"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={onStartEdit}
          disabled={isRunning}
          className={`${typography.body} font-medium text-info hover:underline cursor-pointer tabular-nums disabled:opacity-50 disabled:cursor-not-allowed`}
          aria-label={`Edit ${constraint.label} value: ${constraint.value}`}
        >
          {constraint.value}
        </button>
      )}

      {/* Spacer */}
      <span className="flex-1" />

      {/* Probability — right-aligned */}
      <span className={`${typography.body} font-medium text-text-body tabular-nums flex-shrink-0`}>
        {formatProbability(constraint.probability)}
      </span>
    </div>
  )
}

export function SuccessTarget({
  goalConstraints,
  probabilityOfJointGoal,
  isFromBrief = false,
  isRunning = false,
  onUpdateConstraint,
  onRemoveConstraint,
  // Legacy props
  goalThreshold,
  goalLabel,
  onApplyThreshold,
}: SuccessTargetProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showEditHint, setShowEditHint] = useState(false)

  // Build effective constraints from either new or legacy props
  const effectiveConstraints: GoalConstraint[] = goalConstraints?.length
    ? goalConstraints
    : goalThreshold != null
    ? [{
        id: 'primary',
        label: goalLabel || 'Target',
        operator: '>=' as const,
        value: goalThreshold,
        probability: null, // Probability comes from parent via goalConstraints
      }]
    : []

  const count = effectiveConstraints.length
  const headerText = count <= 1 ? 'Success target' : 'Success targets'
  const showCombinedRow = count > 1 && probabilityOfJointGoal != null

  const handleStartEdit = useCallback((id: string) => {
    if (isRunning) return
    setEditingId(id)
    setShowEditHint(true)
  }, [isRunning])

  const handleCommit = useCallback((id: string, newValue: number) => {
    setEditingId(null)
    setShowEditHint(false)
    if (onUpdateConstraint) {
      onUpdateConstraint(id, newValue)
    } else if (onApplyThreshold) {
      // Legacy fallback
      onApplyThreshold(newValue)
    }
  }, [onUpdateConstraint, onApplyThreshold])

  const handleRevert = useCallback(() => {
    setEditingId(null)
    setShowEditHint(false)
  }, [])

  // Empty state — no constraints set
  if (count === 0) {
    return (
      <div className="p-3 bg-panel border border-panel-border rounded-lg" data-testid="success-target">
        <div className="flex items-center justify-between mb-2">
          <span className={`${typography.label} text-text-header font-medium`}>
            {headerText}
          </span>
          <button
            type="button"
            disabled
            className="flex items-center gap-1 text-xs text-text-light opacity-50 cursor-not-allowed"
            title="Coming soon"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>
        <p className={`${typography.caption} text-text-light`}>
          Set a success target to see how likely you are to achieve your goal
        </p>
      </div>
    )
  }

  return (
    <div className="p-3 bg-panel border border-panel-border rounded-lg" data-testid="success-target">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className={`${typography.label} text-text-header font-medium`}>
          {headerText}
          {isFromBrief && (
            <span className={`${typography.caption} text-text-light font-normal ml-1`}>(from your brief)</span>
          )}
        </span>
        <button
          type="button"
          disabled
          className="flex items-center gap-1 text-xs text-text-light opacity-50 cursor-not-allowed"
          title="Coming soon"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>

      {/* Target rows */}
      <div className="space-y-1">
        {effectiveConstraints.map((constraint) => (
          <TargetRow
            key={constraint.id}
            constraint={constraint}
            isEditing={editingId === constraint.id}
            onStartEdit={() => handleStartEdit(constraint.id)}
            onCommit={(newValue) => handleCommit(constraint.id, newValue)}
            onRevert={handleRevert}
            isRunning={isRunning}
          />
        ))}

        {/* Combined row (multi-target only) */}
        {showCombinedRow && (
          <div className="flex items-center gap-2 min-h-[36px] border-t border-panel-border pt-1 mt-1">
            <span className={`${typography.body} text-text-body font-medium`}>
              Combined
            </span>
            <span className="flex-1" />
            <span className={`${typography.body} font-medium text-text-body tabular-nums flex-shrink-0`}>
              {formatProbability(probabilityOfJointGoal)}
            </span>
          </div>
        )}
      </div>

      {/* C7: Edit mode hint */}
      {showEditHint && editingId != null && (
        <p className={`${typography.caption} text-text-light mt-1`}>
          Enter to apply · Esc to cancel
        </p>
      )}
    </div>
  )
}
