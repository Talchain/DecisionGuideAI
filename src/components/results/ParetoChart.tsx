/**
 * ParetoChart Component
 *
 * Displays Pareto frontier for multi-criteria decisions.
 * Shows scatter plot with options as points, highlighting
 * Pareto-optimal (non-dominated) options.
 *
 * Features:
 * - SVG-based scatter plot (no external deps)
 * - Pareto frontier line connecting optimal options
 * - Dominated options shown greyed/smaller
 * - Hover tooltips with all criteria scores
 * - Axis selector when >2 criteria
 * - Mobile list view (<640px)
 */

import { useState, useMemo, useCallback } from 'react'
import { ChevronDown, ChevronRight, Award, XCircle, RefreshCw, AlertCircle } from 'lucide-react'
import { typography } from '../../styles/typography'
import { usePareto, type UseParetoParams } from '../../hooks/usePareto'

interface ParetoChartProps {
  /** Options with their criteria scores */
  options: Array<{
    id: string
    label: string
    scores: Record<string, number>
  }>
  /** Criteria names (keys in scores) */
  criteria: string[]
  /** Callback when option is clicked */
  onOptionClick?: (optionId: string) => void
  /** Additional CSS classes */
  className?: string
}

// Chart dimensions
const CHART_WIDTH = 400
const CHART_HEIGHT = 300
const PADDING = { top: 20, right: 20, bottom: 40, left: 50 }
const PLOT_WIDTH = CHART_WIDTH - PADDING.left - PADDING.right
const PLOT_HEIGHT = CHART_HEIGHT - PADDING.top - PADDING.bottom

// Point sizes
const FRONTIER_POINT_SIZE = 8
const DOMINATED_POINT_SIZE = 5

/**
 * Scale value to plot coordinates
 */
function scaleValue(
  value: number,
  min: number,
  max: number,
  plotSize: number
): number {
  if (max === min) return plotSize / 2
  return ((value - min) / (max - min)) * plotSize
}

/**
 * Format score for display
 */
function formatScore(value: number): string {
  if (value >= 0 && value <= 1) {
    return `${(value * 100).toFixed(0)}%`
  }
  return value.toFixed(1)
}

export function ParetoChart({
  options,
  criteria,
  onOptionClick,
  className = '',
}: ParetoChartProps) {
  // State for axis selection (when >2 criteria)
  const [xAxis, setXAxis] = useState(criteria[0] || '')
  const [yAxis, setYAxis] = useState(criteria[1] || '')
  const [hoveredOption, setHoveredOption] = useState<string | null>(null)
  const [expandedDominated, setExpandedDominated] = useState<Set<string>>(new Set())

  // Ensure axis selections are valid
  const effectiveXAxis = criteria.includes(xAxis) ? xAxis : criteria[0] || ''
  const effectiveYAxis = criteria.includes(yAxis) ? yAxis : criteria[1] || ''

  // Fetch Pareto analysis
  const {
    frontier,
    dominated,
    dominancePairs,
    isLoading,
    error,
    refetch,
  } = usePareto({
    options,
    criteria,
    enabled: options.length >= 3 && criteria.length >= 2,
  })

  // Calculate plot bounds
  const { xMin, xMax, yMin, yMax } = useMemo(() => {
    if (options.length === 0 || !effectiveXAxis || !effectiveYAxis) {
      return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }
    }

    const xValues = options.map((o) => o.scores[effectiveXAxis] ?? 0)
    const yValues = options.map((o) => o.scores[effectiveYAxis] ?? 0)

    const xMinVal = Math.min(...xValues)
    const xMaxVal = Math.max(...xValues)
    const yMinVal = Math.min(...yValues)
    const yMaxVal = Math.max(...yValues)

    // Add 10% padding to bounds
    const xPad = (xMaxVal - xMinVal) * 0.1 || 0.1
    const yPad = (yMaxVal - yMinVal) * 0.1 || 0.1

    return {
      xMin: xMinVal - xPad,
      xMax: xMaxVal + xPad,
      yMin: yMinVal - yPad,
      yMax: yMaxVal + yPad,
    }
  }, [options, effectiveXAxis, effectiveYAxis])

  // Create frontier set for quick lookup
  const frontierSet = useMemo(() => new Set(frontier), [frontier])

  // Calculate point positions
  const points = useMemo(() => {
    return options.map((opt) => {
      const x = scaleValue(
        opt.scores[effectiveXAxis] ?? 0,
        xMin,
        xMax,
        PLOT_WIDTH
      )
      const y =
        PLOT_HEIGHT -
        scaleValue(opt.scores[effectiveYAxis] ?? 0, yMin, yMax, PLOT_HEIGHT)

      return {
        ...opt,
        x: x + PADDING.left,
        y: y + PADDING.top,
        isFrontier: frontierSet.has(opt.id),
      }
    })
  }, [options, effectiveXAxis, effectiveYAxis, xMin, xMax, yMin, yMax, frontierSet])

  // Sort frontier points for line drawing (by x coordinate)
  const frontierLine = useMemo(() => {
    return points
      .filter((p) => p.isFrontier)
      .sort((a, b) => a.x - b.x)
  }, [points])

  // Get dominators for a given option
  const getDominators = useCallback(
    (optionId: string): string[] => {
      return dominancePairs
        .filter((p) => p.dominated === optionId)
        .map((p) => p.dominator)
    },
    [dominancePairs]
  )

  // Toggle expanded state for dominated option
  const toggleExpanded = useCallback((optionId: string) => {
    setExpandedDominated((prev) => {
      const next = new Set(prev)
      if (next.has(optionId)) {
        next.delete(optionId)
      } else {
        next.add(optionId)
      }
      return next
    })
  }, [])

  // Handle option click
  const handleOptionClick = useCallback(
    (optionId: string) => {
      onOptionClick?.(optionId)
    },
    [onOptionClick]
  )

  // Loading state
  if (isLoading) {
    return (
      <div
        className={`p-4 bg-paper-50 border border-sand-200 rounded-xl ${className}`}
        data-testid="pareto-chart-loading"
      >
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-sand-200 rounded w-40" />
          <div className="h-64 bg-sand-100 rounded" />
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div
        className={`p-4 bg-carrot-50 border border-carrot-200 rounded-xl ${className}`}
        data-testid="pareto-chart-error"
        role="alert"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-carrot-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className={`${typography.label} text-carrot-800`}>
              Pareto analysis unavailable
            </p>
            <p className={`${typography.caption} text-carrot-600 mt-1`}>
              {error.message}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className={`${typography.caption} mt-2 inline-flex items-center gap-1 text-carrot-700 hover:text-carrot-800`}
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Empty state (not enough options/criteria)
  if (options.length < 3 || criteria.length < 2) {
    return (
      <div
        className={`p-4 bg-sand-50 border border-sand-200 rounded-xl ${className}`}
        data-testid="pareto-chart-empty"
      >
        <p className={`${typography.body} text-sand-600`}>
          {options.length < 3
            ? 'Add more options to see Pareto frontier'
            : 'Need at least 2 criteria for Pareto analysis'}
        </p>
      </div>
    )
  }

  // Mobile list view
  const mobileView = (
    <div className="sm:hidden space-y-2" data-testid="pareto-mobile-view">
      {/* Frontier options */}
      {frontier.map((optId) => {
        const opt = options.find((o) => o.id === optId)
        if (!opt) return null
        return (
          <button
            key={optId}
            type="button"
            onClick={() => handleOptionClick(optId)}
            className="w-full text-left p-3 rounded-lg bg-teal-50 border border-teal-200 hover:bg-teal-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-teal-600" />
              <span className={`${typography.label} text-teal-800`}>
                {opt.label}
              </span>
              <span className={`${typography.caption} ml-auto px-2 py-0.5 rounded-full bg-teal-200 text-teal-800`}>
                Frontier
              </span>
            </div>
            <div className={`${typography.caption} text-teal-600 mt-1 grid grid-cols-2 gap-1`}>
              {criteria.map((c) => (
                <span key={c}>
                  {c}: {formatScore(opt.scores[c] ?? 0)}
                </span>
              ))}
            </div>
          </button>
        )
      })}

      {/* Dominated options */}
      {dominated.map((optId) => {
        const opt = options.find((o) => o.id === optId)
        if (!opt) return null
        const isExpanded = expandedDominated.has(optId)
        const dominators = getDominators(optId)

        return (
          <div
            key={optId}
            className="p-3 rounded-lg bg-sand-50 border border-sand-200"
          >
            <button
              type="button"
              onClick={() => toggleExpanded(optId)}
              className="w-full text-left flex items-center gap-2"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-sand-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-sand-500" />
              )}
              <span className={`${typography.label} text-sand-700`}>
                {opt.label}
              </span>
              <span className={`${typography.caption} ml-auto px-2 py-0.5 rounded-full bg-sand-200 text-sand-600`}>
                Dominated
              </span>
            </button>

            {isExpanded && (
              <div className="mt-2 pl-6 space-y-2">
                <div className={`${typography.caption} text-sand-600 grid grid-cols-2 gap-1`}>
                  {criteria.map((c) => (
                    <span key={c}>
                      {c}: {formatScore(opt.scores[c] ?? 0)}
                    </span>
                  ))}
                </div>
                {dominators.length > 0 && (
                  <div className={`${typography.caption} text-sand-500`}>
                    <span className="font-medium">Why dominated?</span>
                    <p className="mt-0.5">
                      Outperformed by:{' '}
                      {dominators
                        .map((d) => options.find((o) => o.id === d)?.label || d)
                        .join(', ')}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  // Desktop chart view
  const desktopView = (
    <div className="hidden sm:block" data-testid="pareto-desktop-view">
      {/* Axis selectors (when >2 criteria) */}
      {criteria.length > 2 && (
        <div className="flex gap-4 mb-3">
          <label className={`${typography.caption} text-ink-600`}>
            X-Axis:
            <select
              value={effectiveXAxis}
              onChange={(e) => setXAxis(e.target.value)}
              className="ml-2 px-2 py-1 border border-sand-300 rounded text-sm"
            >
              {criteria.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className={`${typography.caption} text-ink-600`}>
            Y-Axis:
            <select
              value={effectiveYAxis}
              onChange={(e) => setYAxis(e.target.value)}
              className="ml-2 px-2 py-1 border border-sand-300 rounded text-sm"
            >
              {criteria.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* SVG Chart */}
      <svg
        width={CHART_WIDTH}
        height={CHART_HEIGHT}
        className="overflow-visible"
        role="img"
        aria-label="Pareto frontier chart"
      >
        {/* Grid lines */}
        <g className="grid-lines" stroke="#e5e7eb" strokeWidth="1">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const x = PADDING.left + t * PLOT_WIDTH
            const y = PADDING.top + t * PLOT_HEIGHT
            return (
              <g key={t}>
                <line x1={x} y1={PADDING.top} x2={x} y2={PADDING.top + PLOT_HEIGHT} />
                <line x1={PADDING.left} y1={y} x2={PADDING.left + PLOT_WIDTH} y2={y} />
              </g>
            )
          })}
        </g>

        {/* Axes */}
        <g className="axes" stroke="#374151" strokeWidth="2">
          {/* X axis */}
          <line
            x1={PADDING.left}
            y1={PADDING.top + PLOT_HEIGHT}
            x2={PADDING.left + PLOT_WIDTH}
            y2={PADDING.top + PLOT_HEIGHT}
          />
          {/* Y axis */}
          <line
            x1={PADDING.left}
            y1={PADDING.top}
            x2={PADDING.left}
            y2={PADDING.top + PLOT_HEIGHT}
          />
        </g>

        {/* Axis labels */}
        <text
          x={PADDING.left + PLOT_WIDTH / 2}
          y={CHART_HEIGHT - 5}
          textAnchor="middle"
          className="text-xs fill-ink-600"
        >
          {effectiveXAxis}
        </text>
        <text
          x={15}
          y={PADDING.top + PLOT_HEIGHT / 2}
          textAnchor="middle"
          transform={`rotate(-90, 15, ${PADDING.top + PLOT_HEIGHT / 2})`}
          className="text-xs fill-ink-600"
        >
          {effectiveYAxis}
        </text>

        {/* Pareto frontier line */}
        {frontierLine.length > 1 && (
          <polyline
            points={frontierLine.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#0d9488"
            strokeWidth="2"
            strokeDasharray="4,2"
          />
        )}

        {/* Dominated points (smaller, greyed) */}
        {points
          .filter((p) => !p.isFrontier)
          .map((point) => (
            <g key={point.id}>
              <circle
                cx={point.x}
                cy={point.y}
                r={DOMINATED_POINT_SIZE}
                fill="#9ca3af"
                fillOpacity="0.5"
                stroke="#6b7280"
                strokeWidth="1"
                className="cursor-pointer transition-all hover:fill-opacity-80"
                onMouseEnter={() => setHoveredOption(point.id)}
                onMouseLeave={() => setHoveredOption(null)}
                onClick={() => handleOptionClick(point.id)}
              />
            </g>
          ))}

        {/* Frontier points (larger, teal) */}
        {points
          .filter((p) => p.isFrontier)
          .map((point) => (
            <g key={point.id}>
              <circle
                cx={point.x}
                cy={point.y}
                r={FRONTIER_POINT_SIZE}
                fill="#0d9488"
                stroke="#065f46"
                strokeWidth="2"
                className="cursor-pointer transition-all hover:r-10"
                onMouseEnter={() => setHoveredOption(point.id)}
                onMouseLeave={() => setHoveredOption(null)}
                onClick={() => handleOptionClick(point.id)}
              />
              {/* Label */}
              <text
                x={point.x}
                y={point.y - 12}
                textAnchor="middle"
                className="text-xs fill-teal-800 font-medium pointer-events-none"
              >
                {point.label.length > 15
                  ? point.label.slice(0, 12) + '...'
                  : point.label}
              </text>
            </g>
          ))}

        {/* Tooltip */}
        {hoveredOption && (
          <g>
            {(() => {
              const point = points.find((p) => p.id === hoveredOption)
              if (!point) return null

              const tooltipWidth = 140
              const tooltipHeight = 20 + criteria.length * 16
              let tooltipX = point.x + 10
              let tooltipY = point.y - tooltipHeight / 2

              // Adjust if tooltip goes off screen
              if (tooltipX + tooltipWidth > CHART_WIDTH) {
                tooltipX = point.x - tooltipWidth - 10
              }
              if (tooltipY < 0) tooltipY = 0
              if (tooltipY + tooltipHeight > CHART_HEIGHT) {
                tooltipY = CHART_HEIGHT - tooltipHeight
              }

              return (
                <g>
                  <rect
                    x={tooltipX}
                    y={tooltipY}
                    width={tooltipWidth}
                    height={tooltipHeight}
                    fill="white"
                    stroke="#d1d5db"
                    strokeWidth="1"
                    rx="4"
                    className="drop-shadow-md"
                  />
                  <text
                    x={tooltipX + 8}
                    y={tooltipY + 16}
                    className="text-xs fill-ink-900 font-medium"
                  >
                    {point.label.length > 18
                      ? point.label.slice(0, 15) + '...'
                      : point.label}
                  </text>
                  {criteria.map((c, i) => (
                    <text
                      key={c}
                      x={tooltipX + 8}
                      y={tooltipY + 32 + i * 16}
                      className="text-xs fill-ink-600"
                    >
                      {c}: {formatScore(point.scores[c] ?? 0)}
                    </text>
                  ))}
                </g>
              )
            })()}
          </g>
        )}
      </svg>

      {/* Legend */}
      <div className="flex gap-4 mt-2 justify-center">
        <span className={`${typography.caption} text-ink-600 flex items-center gap-1`}>
          <span className="w-3 h-3 rounded-full bg-teal-600" />
          Pareto optimal ({frontier.length})
        </span>
        <span className={`${typography.caption} text-ink-500 flex items-center gap-1`}>
          <span className="w-2 h-2 rounded-full bg-gray-400 opacity-50" />
          Dominated ({dominated.length})
        </span>
      </div>
    </div>
  )

  return (
    <div
      className={`p-4 bg-paper-50 border border-sand-200 rounded-xl ${className}`}
      data-testid="pareto-chart"
    >
      <h3 className={`${typography.label} text-ink-800 mb-3`}>
        Pareto Frontier Analysis
      </h3>

      {mobileView}
      {desktopView}
    </div>
  )
}
