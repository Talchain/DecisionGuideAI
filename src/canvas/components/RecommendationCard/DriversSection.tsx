/**
 * DriversSection - Why this option
 *
 * Displays primary drivers that led to the recommendation.
 * Each driver is clickable to highlight the corresponding edge on canvas.
 */

import { TrendingUp, ArrowRight } from 'lucide-react'
import { typography } from '../../../styles/typography'
import type { Driver } from './types'

interface DriversSectionProps {
  drivers: Driver[]
  onDriverClick?: (edgeId: string, nodeId?: string) => void
}

const contributionConfig = {
  high: {
    barWidth: 'w-full',
    textColor: 'text-mint-700',
    barColor: 'bg-mint-500',
  },
  medium: {
    barWidth: 'w-2/3',
    textColor: 'text-sky-700',
    barColor: 'bg-sky-500',
  },
  low: {
    barWidth: 'w-1/3',
    textColor: 'text-sand-600',
    barColor: 'bg-sand-400',
  },
}

export function DriversSection({ drivers, onDriverClick }: DriversSectionProps) {
  if (!drivers || drivers.length === 0) {
    return (
      <p className={`${typography.caption} text-ink-500 italic`}>
        No specific drivers identified for this recommendation.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {drivers.map((driver, index) => {
        const config = contributionConfig[driver.contribution]
        const isClickable = !!driver.edge_id || !!driver.node_id

        return (
          <button
            key={driver.edge_id || index}
            type="button"
            onClick={() => isClickable && onDriverClick?.(driver.edge_id, driver.node_id)}
            disabled={!isClickable}
            className={`w-full text-left p-3 rounded-lg border border-sand-200 transition-colors ${
              isClickable
                ? 'hover:border-sky-300 hover:bg-sky-50/50 cursor-pointer'
                : 'cursor-default'
            }`}
          >
            <div className="flex items-start gap-3">
              <TrendingUp
                className={`h-4 w-4 ${config.textColor} flex-shrink-0 mt-0.5`}
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                {/* Factor name and contribution */}
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={`${typography.bodySmall} font-medium text-ink-800`}>
                    {driver.factor}
                  </span>
                  <span className={`${typography.caption} ${config.textColor} capitalize`}>
                    {driver.contribution}
                  </span>
                </div>

                {/* Explanation */}
                <p className={`${typography.caption} text-ink-600 mb-2`}>
                  {driver.explanation}
                </p>

                {/* Contribution bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-sand-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${config.barColor} ${config.barWidth} rounded-full`}
                    />
                  </div>
                  {isClickable && (
                    <span className={`${typography.caption} text-sky-600 flex items-center gap-1`}>
                      View <ArrowRight className="h-3 w-3" />
                    </span>
                  )}
                </div>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
