/**
 * SuccessTargetRow — Compact inline success target input for Options Compare.
 *
 * V9.2 spec:
 * - When set: "Success target ≥ [value]" + "Apply & rerun" button + microcopy
 * - When unset: placeholder prompting user to set a target
 *
 * Multi-constraint display:
 * - When winning option has constraint_analysis with ≥1 constraint, shows
 *   joint probability headline + per-constraint breakdown rows.
 * - Confidence colour encoding: ≥70% green, 40-69% blue, <40% orange
 * - Falls back to existing "Set target" placeholder when absent.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { Check, CheckCircle, AlertTriangle, Info } from 'lucide-react'
import { typography } from '../../styles/typography'
import type { ConstraintAnalysis, ConstraintItem } from '../../types/constraints'
import {
  constraintConfidenceColour,
  CONSTRAINT_CONFIDENCE_THRESHOLDS,
} from '../../types/constraints'

export interface SuccessTargetRowProps {
  /** Current goal threshold value (null = not set) */
  goalThreshold?: number | null
  /** Whether the threshold was extracted from the brief */
  isFromBrief?: boolean
  /** Whether analysis is currently running */
  isRunning?: boolean
  /** Callback when user commits a new threshold value */
  onApplyThreshold?: (threshold: number) => void
  /** Multi-constraint analysis from the winning option */
  constraintAnalysis?: ConstraintAnalysis
  /** Whether "Hits target" bars are visible (all options have probability_of_goal) */
  showHitsTarget?: boolean
}

/** Render ASCII operator as unicode for display */
function renderOperator(op: string): string {
  if (op === '>=') return '≥'
  if (op === '<=') return '≤'
  return op
}

/** Icon for a single constraint row based on prob_satisfied */
function ConstraintIcon({ prob }: { prob: number }) {
  // Thresholds: ≥0.70 green check, <0.40 orange warning, between = blue info
  if (prob >= CONSTRAINT_CONFIDENCE_THRESHOLDS.HIGH) {
    return <CheckCircle className="w-3.5 h-3.5 text-success flex-shrink-0" />
  }
  if (prob < CONSTRAINT_CONFIDENCE_THRESHOLDS.LOW) {
    return <AlertTriangle className="w-3.5 h-3.5 text-danger flex-shrink-0" />
  }
  return <Info className="w-3.5 h-3.5 text-info flex-shrink-0" />
}

/** Single constraint row */
function ConstraintRow({ item }: { item: ConstraintItem }) {
  const pct = Math.round(item.prob_satisfied * 100)
  const colour = constraintConfidenceColour(item.prob_satisfied)
  const isMissed = item.prob_satisfied < 0.5

  return (
    <div
      className="flex flex-col gap-1 py-1.5 border-b border-panel-border last:border-b-0"
      data-testid={`constraint-row-${item.node_id}`}
    >
      <div className="flex items-center gap-2">
        <ConstraintIcon prob={item.prob_satisfied} />
        <span className={`${typography.panelBody} text-text-body flex-1 truncate`}>
          {item.label} {renderOperator(item.operator)} {item.threshold}
        </span>
        <span className={`${typography.panelBody} ${colour} tabular-nums flex-shrink-0`}>
          {pct}%
        </span>
        {item.binding && (
          <span className={`${typography.panelMeta} text-danger flex-shrink-0`}>
            (binding)
          </span>
        )}
      </div>
      {/* Task M.1.2 Step 2: Display failure margin when constraint is missed */}
      {isMissed && item.failure_margin_median != null && (
        <p className={`${typography.panelMeta} text-warning ml-6`}>
          Typically misses by {item.failure_margin_median} {/* TODO: Add unit from parent context if available */}
        </p>
      )}
    </div>
  )
}

export function SuccessTargetRow({
  goalThreshold,
  isFromBrief = false,
  isRunning = false,
  onApplyThreshold,
  constraintAnalysis,
  showHitsTarget = true,
}: SuccessTargetRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const hasTarget = goalThreshold != null
  const hasConstraints = constraintAnalysis != null &&
    constraintAnalysis.constraints.length > 0

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

  // ── Multi-constraint display ──────────────────────────────────────────────
  if (hasConstraints) {
    const jointPct = Math.round(constraintAnalysis.joint_probability * 100)
    const jointColour = constraintConfidenceColour(constraintAnalysis.joint_probability)

    return (
      <div className="p-3 bg-panel border border-panel-border rounded-lg" data-testid="success-target-row">
        {/* Headline: joint probability + edit link */}
        <div className="flex items-center justify-between min-h-[28px]">
          <span className={`${typography.panelHeader} text-text-header`}>
            Meeting all targets:{' '}
            <span className={jointColour}>{jointPct}%</span>
          </span>
          <button
            type="button"
            onClick={handleStartEdit}
            disabled={isRunning}
            className={`${typography.panelBody} text-info hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Edit targets
          </button>
        </div>

        {/* Per-constraint breakdown */}
        <div className="mt-2" data-testid="constraint-breakdown">
          {constraintAnalysis.constraints.map((c) => (
            <ConstraintRow key={c.node_id} item={c} />
          ))}
        </div>
      </div>
    )
  }

  // ── Existing single-target / no-target display ────────────────────────────
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
      {hasTarget && !isEditing && showHitsTarget && (
        <p className={`${typography.panelMeta} text-text-light mt-1.5`}>
          <strong className="text-text-body">Wins</strong> = outperforms alternatives.{' '}
          <strong className="text-text-body">Hits target</strong> = reaches your success target.
        </p>
      )}
      {hasTarget && !isEditing && !showHitsTarget && (
        <p className={`${typography.panelMeta} text-text-light mt-1.5`}>
          <strong className="text-text-body">Wins</strong> = outperforms alternatives.
          Run analysis again to compute target likelihood.
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
