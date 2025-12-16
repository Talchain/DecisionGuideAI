/**
 * TippingPointsList - Display tipping points from ISL robustness analysis
 *
 * Brief H Task 6: Shows threshold values where recommendation would change
 *
 * Features:
 * - Shows current vs threshold for each parameter
 * - Visual indicator of distance to tipping point
 * - Warning highlight for close thresholds
 * - Click to focus on canvas node
 */

import { useCallback } from 'react'
import { AlertTriangle, Target } from 'lucide-react'
import { typography } from '../../../styles/typography'
import type { SensitiveParameter } from '../RecommendationCard/types'

interface TippingPointsListProps {
  /** Sensitive parameters with flip thresholds */
  parameters: SensitiveParameter[]
  /** Callback when parameter is clicked */
  onParameterClick?: (nodeId: string) => void
  /** Maximum items to show */
  maxItems?: number
}

export function TippingPointsList({
  parameters,
  onParameterClick,
  maxItems = 3,
}: TippingPointsListProps) {
  const handleClick = useCallback(
    (nodeId: string) => {
      onParameterClick?.(nodeId)
    },
    [onParameterClick]
  )

  // Filter to only params with meaningful flip thresholds
  const tippingPoints = parameters
    .filter(p => p.flip_threshold !== undefined && p.flip_threshold !== p.current_value)
    .slice(0, maxItems)

  if (tippingPoints.length === 0) {
    return (
      <div className="p-3 text-center" data-testid="tipping-points-empty">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Target className="h-4 w-4 text-mint-500" aria-hidden="true" />
          <span className={`${typography.bodySmall} font-medium text-mint-700`}>
            Robust recommendation
          </span>
        </div>
        <p className={`${typography.caption} text-ink-500`}>
          No close tipping points identified
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2 p-3" data-testid="tipping-points-list">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-4 w-4 text-banana-500" aria-hidden="true" />
        <span className={`${typography.caption} font-medium text-ink-700`}>
          Tipping Points
        </span>
      </div>

      {tippingPoints.map((param) => {
        const gapPct = Math.abs(
          Math.round((param.flip_threshold - param.current_value) * 100)
        )
        const isVeryClose = gapPct <= 5
        const isClose = gapPct <= 10

        return (
          <button
            key={param.node_id}
            type="button"
            onClick={() => handleClick(param.node_id)}
            className={`w-full p-2.5 rounded-lg text-left transition-colors ${
              isVeryClose
                ? 'bg-carrot-50 border border-carrot-200 hover:bg-carrot-100'
                : isClose
                  ? 'bg-banana-50 border border-banana-200 hover:bg-banana-100'
                  : 'bg-sand-50 border border-sand-200 hover:bg-sand-100'
            }`}
            data-testid={`tipping-point-${param.node_id}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span
                className={`${typography.bodySmall} font-medium ${
                  isVeryClose ? 'text-carrot-800' : isClose ? 'text-banana-800' : 'text-ink-800'
                }`}
              >
                {param.label}
              </span>
              <span
                className={`${typography.caption} font-semibold ${
                  isVeryClose ? 'text-carrot-600' : isClose ? 'text-banana-600' : 'text-ink-600'
                }`}
              >
                {gapPct}% away
              </span>
            </div>

            <p
              className={`${typography.caption} ${
                isVeryClose ? 'text-carrot-700' : isClose ? 'text-banana-700' : 'text-ink-600'
              }`}
            >
              If {param.label.toLowerCase()}{' '}
              {param.direction === 'increase' ? 'rises to' : 'falls to'}{' '}
              <strong>{Math.round(param.flip_threshold * 100)}%</strong>
              {' '}(from {Math.round(param.current_value * 100)}%), recommendation flips
            </p>
          </button>
        )
      })}
    </div>
  )
}
