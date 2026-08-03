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
import { formatTargetValue } from './utils/formatTargetValue'
import type { ConstraintAnalysis, ConstraintItem } from '../../types/constraints'
import {
  constraintConfidenceColour,
  CONSTRAINT_CONFIDENCE_THRESHOLDS,
} from '../../types/constraints'
import { formatProbabilityWithResolution } from '../../utils/formatPercent'

export interface SuccessTargetRowProps {
  /** Current goal threshold value (null = not set) */
  goalThreshold?: number | null
  /** Whether analysis is currently running */
  isRunning?: boolean
  /** Callback when user commits a new threshold value */
  onApplyThreshold?: (threshold: number) => void
  /** Multi-constraint analysis from the winning option */
  constraintAnalysis?: ConstraintAnalysis
  /** Whether "Hits target" bars are visible (all options have probability_of_goal) */
  showHitsTarget?: boolean
  /** Outcome unit type for display formatting */
  outcomeUnit?: 'currency' | 'percent' | 'count'
  /** Currency symbol when outcomeUnit is 'currency' */
  outcomeUnitSymbol?: string
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
  // ROADMAP 2.333: was `${Math.round(item.prob_satisfied * 100)}%`, so a
  // constraint satisfied in 7 of 10000 runs printed "0%" — a measured,
  // non-zero probability rendered as impossibility.
  //
  // The COMPARATIVE register is the right one here, not the goal register:
  // constraint satisfaction is a hit frequency over simulated scenarios
  // ("satisfied in 0 of n runs"), the same shape as "came out ahead in n of
  // N". That means an EXACT zero deliberately keeps reading "0%" — the floor
  // exists to stop a non-zero value printing as zero, not to stop zero
  // printing. `null` samples: this surface holds a constraint item, not the
  // option object, so it has no per-option count to pass; the floored
  // fallback arm applies and understates rather than inventing a resolution.
  const readout = formatProbabilityWithResolution(item.prob_satisfied, null)
  const colour = constraintConfidenceColour(item.prob_satisfied)
  const isMissed = item.prob_satisfied < 0.5

  return (
    <div
      className="flex flex-col gap-1 py-1.5 border-b border-panel-border last:border-b-0"
      data-testid={`constraint-row-${item.node_id}`}
    >
      <div className="flex items-center gap-2">
        <ConstraintIcon prob={item.prob_satisfied} />
        <span className={`${typography.panelBody} text-text-body flex-1 truncate`} title={`${item.label} ${renderOperator(item.operator)} ${item.threshold}`}>
          {item.label} {renderOperator(item.operator)} {item.threshold}
        </span>
        <span className={`${typography.panelBody} ${colour} tabular-nums flex-shrink-0`}>
          {readout}
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
  isRunning = false,
  onApplyThreshold,
  constraintAnalysis,
  showHitsTarget = true,
  outcomeUnit,
  outcomeUnitSymbol,
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
    // Same register, same reason as the per-constraint rows above: the joint
    // figure is "met every target in n of N runs", so it floors a non-zero
    // value and keeps a true zero as "0%".
    const jointReadout = formatProbabilityWithResolution(
      constraintAnalysis.joint_probability,
      null,
    )
    const jointColour = constraintConfidenceColour(constraintAnalysis.joint_probability)

    return (
      <div className="p-3 bg-panel border border-panel-border rounded-lg" data-testid="success-target-row">
        {/* Headline: joint probability + edit link */}
        <div className="flex items-center justify-between min-h-[28px]">
          <span className={`${typography.panelHeader} text-text-header`}>
            Meeting all targets:{' '}
            <span className={jointColour}>{jointReadout}</span>
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
              {formatTargetValue(goalThreshold!, outcomeUnit, outcomeUnitSymbol)}
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
              className={`w-[100px] px-2 py-1 ${typography.panelBody} border border-info rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info tabular-nums`}
              aria-label="Edit success target value"
              data-testid="success-target-input"
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
            data-testid="success-target-set-button"
          >
            Set target
          </button>
        )}
      </div>

      {/* V12.5: Explanatory paragraph removed — "Set target" link is self-explanatory */}
    </div>
  )
}
