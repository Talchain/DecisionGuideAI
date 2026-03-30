/**
 * TargetProbabilityBars — stacked horizontal bars showing per-constraint probabilities.
 *
 * Renders inside the hero section when goal_threshold exists and constraint
 * probabilities are available. Shows individual constraint bars + optional
 * "All targets" joint probability row when 2+ constraints exist.
 *
 * Data source: ConstraintAnalysis from the winning option's analysis.
 */

import { typography } from '../../styles/typography'
import { evaluativeVar } from '../../styles/evaluative'
import type { ConstraintAnalysis } from '../../types/constraints'
import Tooltip from '../Tooltip'

export interface TargetProbabilityBarsProps {
  /** Constraint analysis from the winning option */
  constraintAnalysis?: ConstraintAnalysis | null
  /** Whether a goal threshold is set (gates entire display) */
  goalThreshold?: number | null
}

export function TargetProbabilityBars({
  constraintAnalysis,
  goalThreshold,
}: TargetProbabilityBarsProps) {
  // Gate: only show when goal threshold exists AND constraints are available
  if (goalThreshold == null) return null
  if (!constraintAnalysis?.constraints?.length) return null

  // Filter to constraints that have probabilities
  const validConstraints = constraintAnalysis.constraints.filter(
    c => typeof c.prob_satisfied === 'number',
  )
  if (validConstraints.length === 0) return null

  const hasMultiple = validConstraints.length >= 2
  const jointProbability = constraintAnalysis.joint_probability

  return (
    <div className="flex flex-col gap-1.5 mb-2" data-testid="target-probability-bars">
      {/* Individual constraint rows */}
      {validConstraints.map(c => {
        const pct = Math.round(c.prob_satisfied * 100)
        return (
          <Tooltip key={c.node_id} content="Probability of meeting this target">
            <div className="flex items-center gap-2" style={{ fontSize: 11 }}>
              <span className={`${typography.panelMeta} text-text-body flex-1 min-w-0 truncate`} title={c.label}>
                {c.label}
              </span>
              <div
                className="flex-shrink-0 rounded-sm overflow-hidden"
                style={{ width: 56, height: 6, background: 'var(--border-default)' }}
              >
                <div
                  className="h-full rounded-sm"
                  style={{
                    width: `${Math.max(2, pct)}%`,
                    background: evaluativeVar(c.prob_satisfied),
                  }}
                />
              </div>
              <span className={`${typography.panelMeta} font-semibold text-text-header flex-shrink-0 text-right`} style={{ minWidth: 28 }}>
                {pct}%
              </span>
            </div>
          </Tooltip>
        )
      })}

      {/* Joint probability row — only when 2+ constraints */}
      {hasMultiple && typeof jointProbability === 'number' && (
        <Tooltip content="Probability of hitting all targets simultaneously">
          <div
            className="flex items-center gap-2 pt-1.5 border-t border-panel-border"
            style={{ fontSize: 12 }}
            data-testid="target-joint-row"
          >
            <span className={`${typography.panelBody} font-semibold text-text-header flex-1`}>
              All targets
            </span>
            <div
              className="flex-shrink-0 rounded overflow-hidden"
              style={{ width: 56, height: 8, background: 'var(--border-default)' }}
            >
              <div
                className="h-full rounded"
                style={{
                  width: `${Math.max(2, Math.round(jointProbability * 100))}%`,
                  background: 'var(--info)',
                }}
              />
            </div>
            <span className={`${typography.panelBody} font-semibold text-info flex-shrink-0 text-right`} style={{ minWidth: 28 }}>
              {Math.round(jointProbability * 100)}%
            </span>
          </div>
        </Tooltip>
      )}
    </div>
  )
}
