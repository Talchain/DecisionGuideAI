/**
 * ConstraintViolationsSection - Shows excluded options and active constraints
 *
 * Task 1.3: Displays when options are excluded due to constraints
 * - Excluded options shown with strikethrough and grey styling
 * - Active constraints shown with info badge
 */

import { Ban, Info, AlertTriangle } from 'lucide-react'
import { typography } from '../../../styles/typography'
import type { ConstraintViolation, ActiveConstraint } from './types'

interface ConstraintViolationsSectionProps {
  /** Options excluded due to constraint violations */
  violations?: ConstraintViolation[]
  /** Constraints that are currently binding (at boundary) */
  activeConstraints?: ActiveConstraint[]
  /** Callback when an excluded option is clicked */
  onOptionClick?: (optionId: string) => void
}

/**
 * Format a constraint value with units
 */
function formatConstraintValue(value: number | undefined, units?: string): string {
  if (value === undefined) return 'N/A'

  if (units === 'currency' || units === 'dollars' || units === 'usd') {
    return `$${value.toLocaleString()}`
  }
  if (units === 'percent' || units === '%') {
    return `${value}%`
  }
  if (units === 'days' || units === 'hours' || units === 'weeks') {
    return `${value} ${units}`
  }

  return units ? `${value} ${units}` : value.toString()
}

export function ConstraintViolationsSection({
  violations = [],
  activeConstraints = [],
  onOptionClick,
}: ConstraintViolationsSectionProps) {
  const hasViolations = violations.length > 0
  const hasActiveConstraints = activeConstraints.length > 0

  if (!hasViolations && !hasActiveConstraints) {
    return null
  }

  return (
    <div className="space-y-3" data-testid="constraint-violations-section">
      {/* Excluded Options */}
      {hasViolations && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Ban className="h-4 w-4 text-sand-500" aria-hidden="true" />
            <span className={`${typography.caption} font-medium text-sand-600 uppercase tracking-wide`}>
              Excluded Options
            </span>
          </div>

          {violations.map((violation) => (
            <button
              key={violation.option_id}
              type="button"
              onClick={() => onOptionClick?.(violation.option_id)}
              className="w-full p-3 bg-sand-50 border border-sand-200 rounded-lg text-left hover:bg-sand-100 transition-colors"
              data-testid={`excluded-option-${violation.option_id}`}
            >
              <div className="flex items-start gap-3">
                {/* Strikethrough option name */}
                <div className="flex-1 min-w-0">
                  <p className={`${typography.bodySmall} text-sand-500 line-through`}>
                    {violation.option_label}
                  </p>
                  <p className={`${typography.caption} text-sand-500 mt-1`}>
                    Excluded — exceeds {violation.constraint_label}
                    {violation.actual_value !== undefined && violation.limit_value !== undefined && (
                      <span className="ml-1">
                        ({formatConstraintValue(violation.actual_value, violation.units)} vs.{' '}
                        {formatConstraintValue(violation.limit_value, violation.units)} limit)
                      </span>
                    )}
                  </p>
                </div>

                {/* Constraint type badge */}
                <span className={`${typography.caption} px-2 py-0.5 rounded bg-sand-200 text-sand-600 flex-shrink-0`}>
                  {violation.constraint_type}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Active Constraints (binding) */}
      {hasActiveConstraints && (
        <div className="space-y-2">
          {activeConstraints.map((constraint, index) => (
            <div
              key={`constraint-${index}`}
              className="p-3 bg-sky-50 border border-sky-200 rounded-lg"
              data-testid={`active-constraint-${index}`}
            >
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-sky-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className={`${typography.bodySmall} text-sky-800`}>
                    <span className="font-medium">{constraint.label}</span> constraint is binding
                  </p>
                  <p className={`${typography.caption} text-sky-700 mt-0.5`}>
                    Current: {formatConstraintValue(constraint.current_value, constraint.units)} /{' '}
                    Limit: {formatConstraintValue(constraint.limit_value, constraint.units)}
                  </p>
                  {constraint.relaxation_benefit && (
                    <p className={`${typography.caption} text-sky-600 mt-1 italic`}>
                      {constraint.relaxation_benefit}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary message when constraints affect results */}
      {(hasViolations || hasActiveConstraints) && (
        <div className="flex items-start gap-2 pt-2 border-t border-sand-100">
          <AlertTriangle className="h-3.5 w-3.5 text-banana-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className={`${typography.caption} text-banana-700`}>
            {hasViolations && hasActiveConstraints
              ? `${violations.length} option${violations.length > 1 ? 's' : ''} excluded and ${activeConstraints.length} constraint${activeConstraints.length > 1 ? 's' : ''} at limit`
              : hasViolations
                ? `${violations.length} option${violations.length > 1 ? 's were' : ' was'} excluded due to constraints`
                : `${activeConstraints.length} constraint${activeConstraints.length > 1 ? 's are' : ' is'} at the limit — relaxing may improve outcomes`
            }
          </p>
        </div>
      )}
    </div>
  )
}
