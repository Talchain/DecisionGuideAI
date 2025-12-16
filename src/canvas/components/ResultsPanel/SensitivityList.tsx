/**
 * SensitivityList - Display sensitive parameters from ISL robustness analysis
 *
 * Brief H Task 5: Shows factors that most affect the recommendation
 *
 * Features:
 * - Sorted by sensitivity score (highest impact first)
 * - Shows current value vs flip threshold
 * - Click to focus on canvas node
 * - Visual indicator of sensitivity magnitude
 */

import { useCallback } from 'react'
import { AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { typography } from '../../../styles/typography'
import type { SensitiveParameter } from '../RecommendationCard/types'

interface SensitivityListProps {
  /** Sensitive parameters from ISL robustness */
  parameters: SensitiveParameter[]
  /** Callback when parameter is clicked */
  onParameterClick?: (nodeId: string) => void
  /** Maximum items to show (default: all) */
  maxItems?: number
  /** Compact mode (less details) */
  compact?: boolean
}

export function SensitivityList({
  parameters,
  onParameterClick,
  maxItems,
  compact = false,
}: SensitivityListProps) {
  const handleClick = useCallback(
    (nodeId: string) => {
      onParameterClick?.(nodeId)
    },
    [onParameterClick]
  )

  if (parameters.length === 0) {
    return (
      <div className="p-3 text-center text-ink-500" data-testid="sensitivity-empty">
        <p className={typography.caption}>
          No sensitive parameters identified
        </p>
      </div>
    )
  }

  // Sort by sensitivity score (highest first) and limit
  const sortedParams = [...parameters]
    .sort((a, b) => b.sensitivity - a.sensitivity)
    .slice(0, maxItems ?? parameters.length)

  return (
    <div className="divide-y divide-sand-100" data-testid="sensitivity-list">
      {sortedParams.map((param) => {
        const gapPct = Math.abs(
          Math.round((param.flip_threshold - param.current_value) * 100)
        )
        const isClose = gapPct <= 10 // Within 10% of flipping
        const DirectionIcon = param.direction === 'increase' ? ArrowUpRight : ArrowDownRight

        return (
          <button
            key={param.node_id}
            type="button"
            onClick={() => handleClick(param.node_id)}
            className="w-full px-3 py-2.5 text-left hover:bg-sand-50 transition-colors flex items-start gap-3"
            data-testid={`sensitivity-${param.node_id}`}
          >
            {/* Sensitivity indicator */}
            <div
              className={`w-1.5 h-full min-h-[2.5rem] rounded-full flex-shrink-0 ${
                param.sensitivity >= 0.7
                  ? 'bg-carrot-400'
                  : param.sensitivity >= 0.4
                    ? 'bg-banana-400'
                    : 'bg-sand-300'
              }`}
              title={`Sensitivity: ${Math.round(param.sensitivity * 100)}%`}
            />

            <div className="flex-1 min-w-0">
              {/* Header row */}
              <div className="flex items-center gap-2 mb-1">
                <span className={`${typography.bodySmall} font-medium text-ink-800 truncate`}>
                  {param.label}
                </span>
                {isClose && (
                  <AlertTriangle
                    className="h-3.5 w-3.5 text-carrot-500 flex-shrink-0"
                    aria-label="Close to threshold"
                  />
                )}
              </div>

              {!compact && (
                <>
                  {/* Values row */}
                  <div className="flex items-center gap-4 mb-1">
                    <div className="flex items-center gap-1">
                      <span className={`${typography.caption} text-ink-500`}>
                        Current:
                      </span>
                      <span className={`${typography.caption} font-medium text-ink-700`}>
                        {Math.round(param.current_value * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <DirectionIcon className="h-3 w-3 text-ink-400" aria-hidden="true" />
                      <span className={`${typography.caption} text-ink-500`}>
                        Flips at:
                      </span>
                      <span
                        className={`${typography.caption} font-medium ${
                          isClose ? 'text-carrot-600' : 'text-ink-700'
                        }`}
                      >
                        {Math.round(param.flip_threshold * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Gap indicator */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-sand-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isClose ? 'bg-carrot-400' : 'bg-sky-400'
                        }`}
                        style={{ width: `${Math.min(100, gapPct * 2)}%` }}
                      />
                    </div>
                    <span className={`${typography.caption} text-ink-500`}>
                      {gapPct}% gap
                    </span>
                  </div>

                  {/* Explanation if available */}
                  {param.explanation && (
                    <p className={`${typography.caption} text-ink-500 mt-1`}>
                      {param.explanation}
                    </p>
                  )}
                </>
              )}

              {compact && (
                <div className="flex items-center gap-2">
                  <span className={`${typography.caption} text-ink-500`}>
                    {Math.round(param.current_value * 100)}%
                  </span>
                  <DirectionIcon className="h-3 w-3 text-ink-400" aria-hidden="true" />
                  <span
                    className={`${typography.caption} ${
                      isClose ? 'text-carrot-600 font-medium' : 'text-ink-500'
                    }`}
                  >
                    {Math.round(param.flip_threshold * 100)}%
                  </span>
                  <span className={`${typography.caption} text-ink-400`}>
                    ({gapPct}% gap)
                  </span>
                </div>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
