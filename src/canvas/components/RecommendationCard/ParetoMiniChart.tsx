/**
 * ParetoMiniChart - Compact Pareto frontier visualization
 *
 * Brief 10.6: Inline Pareto visualization for RobustnessBlock
 * Simplified version showing frontier vs dominated with minimal footprint.
 */

import { memo, useMemo } from 'react'
import { Award, XCircle } from 'lucide-react'
import { typography } from '../../../styles/typography'
import type { ParetoResult } from './types'

interface ParetoMiniChartProps {
  /** Pareto analysis result */
  pareto: ParetoResult
  /** Option labels lookup */
  optionLabels?: Record<string, string>
  /** Callback when option is clicked */
  onOptionClick?: (optionId: string) => void
  /** Additional CSS classes */
  className?: string
}

// Mini chart dimensions
const CHART_WIDTH = 200
const CHART_HEIGHT = 120
const PADDING = 20

/**
 * Generate mock positions for visualization
 * In production, these would come from actual multi-criteria scores
 */
function generateMockPositions(
  frontier: string[],
  dominated: string[],
  width: number,
  height: number
): Array<{ id: string; x: number; y: number; isFrontier: boolean }> {
  const points: Array<{ id: string; x: number; y: number; isFrontier: boolean }> = []

  // Frontier points along the frontier curve
  frontier.forEach((id, i) => {
    const t = frontier.length > 1 ? i / (frontier.length - 1) : 0.5
    // Pareto frontier typically curves from top-left to bottom-right
    const x = PADDING + t * (width - 2 * PADDING)
    const y = PADDING + (1 - Math.sqrt(1 - t * t)) * (height - 2 * PADDING)
    points.push({ id, x, y, isFrontier: true })
  })

  // Dominated points below the frontier
  dominated.forEach((id, i) => {
    const t = (i + 1) / (dominated.length + 1)
    const x = PADDING + t * (width - 2 * PADDING)
    const y = height - PADDING - 10 + Math.random() * 20
    points.push({ id, x, y, isFrontier: false })
  })

  return points
}

export const ParetoMiniChart = memo(function ParetoMiniChart({
  pareto,
  optionLabels = {},
  onOptionClick,
  className = '',
}: ParetoMiniChartProps) {
  // Generate point positions
  const points = useMemo(
    () => generateMockPositions(pareto.frontier, pareto.dominated, CHART_WIDTH, CHART_HEIGHT),
    [pareto.frontier, pareto.dominated]
  )

  // Frontier points for line
  const frontierLine = useMemo(
    () => points.filter((p) => p.isFrontier).sort((a, b) => a.x - b.x),
    [points]
  )

  // Handle empty state
  if (pareto.frontier.length === 0) {
    return (
      <div className={`p-3 bg-sand-50 rounded-lg ${className}`}>
        <p className={`${typography.caption} text-ink-500`}>
          No Pareto frontier available
        </p>
      </div>
    )
  }

  // Simple list view for very small datasets
  if (pareto.frontier.length <= 2 && pareto.dominated.length <= 2) {
    return (
      <div className={`space-y-2 ${className}`} data-testid="pareto-mini-list">
        {/* Frontier options */}
        {pareto.frontier.map((optId) => (
          <button
            key={optId}
            type="button"
            onClick={() => onOptionClick?.(optId)}
            className="w-full text-left p-2 rounded-lg bg-teal-50 border border-teal-200 hover:bg-teal-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Award className="w-3.5 h-3.5 text-teal-600" aria-hidden="true" />
              <span className={`${typography.caption} font-medium text-teal-800`}>
                {optionLabels[optId] || optId}
              </span>
              <span className={`${typography.caption} ml-auto px-1.5 py-0.5 rounded bg-teal-200 text-teal-700`}>
                Optimal
              </span>
            </div>
          </button>
        ))}

        {/* Dominated options (collapsed) */}
        {pareto.dominated.length > 0 && (
          <div className="flex items-center gap-2 text-sand-600">
            <XCircle className="w-3 h-3" aria-hidden="true" />
            <span className={`${typography.caption}`}>
              {pareto.dominated.length} dominated option{pareto.dominated.length > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    )
  }

  // Chart view for larger datasets
  return (
    <div className={className} data-testid="pareto-mini-chart">
      <svg
        width={CHART_WIDTH}
        height={CHART_HEIGHT}
        className="overflow-visible"
        role="img"
        aria-label={`Pareto frontier: ${pareto.frontier.length} optimal, ${pareto.dominated.length} dominated`}
      >
        {/* Background */}
        <rect
          x={PADDING - 5}
          y={PADDING - 5}
          width={CHART_WIDTH - 2 * PADDING + 10}
          height={CHART_HEIGHT - 2 * PADDING + 10}
          fill="#f8fafc"
          rx="4"
        />

        {/* Frontier line */}
        {frontierLine.length > 1 && (
          <polyline
            points={frontierLine.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#0d9488"
            strokeWidth="2"
            strokeDasharray="4,2"
          />
        )}

        {/* Dominated points */}
        {points
          .filter((p) => !p.isFrontier)
          .map((point) => (
            <circle
              key={point.id}
              cx={point.x}
              cy={point.y}
              r={4}
              fill="#9ca3af"
              fillOpacity="0.5"
              stroke="#6b7280"
              strokeWidth="1"
              className="cursor-pointer hover:fill-opacity-80 transition-opacity"
              onClick={() => onOptionClick?.(point.id)}
            >
              <title>{optionLabels[point.id] || point.id} (dominated)</title>
            </circle>
          ))}

        {/* Frontier points */}
        {points
          .filter((p) => p.isFrontier)
          .map((point) => (
            <g key={point.id}>
              <circle
                cx={point.x}
                cy={point.y}
                r={6}
                fill="#0d9488"
                stroke="#065f46"
                strokeWidth="2"
                className="cursor-pointer hover:r-8 transition-all"
                onClick={() => onOptionClick?.(point.id)}
              >
                <title>{optionLabels[point.id] || point.id} (optimal)</title>
              </circle>
            </g>
          ))}
      </svg>

      {/* Legend */}
      <div className="flex gap-3 mt-1 justify-center">
        <span className={`${typography.caption} text-ink-600 flex items-center gap-1`}>
          <span className="w-2 h-2 rounded-full bg-teal-600" />
          Optimal ({pareto.frontier.length})
        </span>
        <span className={`${typography.caption} text-ink-500 flex items-center gap-1`}>
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 opacity-50" />
          Dominated ({pareto.dominated.length})
        </span>
      </div>
    </div>
  )
})

export default ParetoMiniChart
