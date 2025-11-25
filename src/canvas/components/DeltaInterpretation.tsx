/**
 * DeltaInterpretation Component
 *
 * Shows user-friendly interpretation of changes between runs in Compare view.
 * Explains whether changes improve or worsen outcomes relative to objective.
 */

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { DeltaResult } from '../utils/interpretOutcome'
import { typography } from '../../styles/typography'

interface DeltaInterpretationProps {
  delta: DeltaResult
  objectiveText: string
  fromValue: number
  toValue: number
  units?: string
}

export function DeltaInterpretation({
  delta,
  objectiveText,
  fromValue,
  toValue,
  units,
}: DeltaInterpretationProps) {
  const iconMap = {
    better: TrendingUp,
    worse: TrendingDown,
    similar: Minus,
  }
  const Icon = iconMap[delta.direction]

  const colorMap = {
    better: 'text-success-700',
    worse: 'text-danger-700',
    similar: 'text-ink-900/70',
  }

  const directionText = {
    better: 'improves',
    worse: 'worsens',
    similar: 'has little impact on',
  }[delta.direction]

  const magnitudeText = delta.direction === 'similar' ? '' : `${delta.magnitude} `

  const formatValue = (v: number) => {
    if (units) return `${v.toFixed(2)} ${units}`
    return v.toFixed(2)
  }

  return (
    <div
      className={`flex items-start gap-2 ${colorMap[delta.direction]}`}
      data-testid="delta-interpretation"
    >
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
      <div>
        <p className={typography.body}>
          Your latest changes <strong>{magnitudeText}{directionText}</strong> this plan for{' '}
          {objectiveText}.
        </p>
        {delta.direction !== 'similar' && (
          <p className={`${typography.bodySmall} text-ink-900/70 mt-1`}>
            Expected outcome moved from {formatValue(fromValue)} to {formatValue(toValue)}
            {delta.deltaPercent !== null && (
              <>
                {' '}
                (
                <span className="font-medium tabular-nums">
                  {delta.deltaPercent > 0 ? '+' : ''}
                  {delta.deltaPercent.toFixed(1)}%
                </span>
                )
              </>
            )}
          </p>
        )}
      </div>
    </div>
  )
}
