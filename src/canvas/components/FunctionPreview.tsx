/**
 * FunctionPreview - Visual preview of edge function shapes
 * Shows how different function types transform input to output.
 */

import { memo, useMemo } from 'react'

export type EdgeFunctionType = 'linear' | 'diminishing_returns' | 'threshold' | 's_curve'

export interface FunctionParams {
  /** Threshold value for threshold function (0-1) */
  threshold?: number
  /** Curvature parameter for diminishing returns (0.1-2) */
  curvature?: number
  /** Midpoint for s-curve (0-1) */
  midpoint?: number
  /** Steepness for s-curve (1-10) */
  steepness?: number
}

export interface FunctionPreviewProps {
  /** Function type to preview */
  type: EdgeFunctionType
  /** Function parameters */
  params?: FunctionParams
  /** Width of the preview */
  width?: number
  /** Height of the preview */
  height?: number
  /** Show axis labels */
  showLabels?: boolean
  /** Highlight color */
  color?: string
  /** Optional className */
  className?: string
}

// Function evaluators
function linear(x: number): number {
  return x
}

function diminishingReturns(x: number, curvature = 0.5): number {
  // Using power function: y = x^(1/curvature) for curvature > 1
  // and y = 1 - (1-x)^curvature for curvature < 1
  const c = Math.max(0.1, Math.min(2, curvature))
  return Math.pow(x, c)
}

function threshold(x: number, thresholdValue = 0.5): number {
  return x >= thresholdValue ? 1 : 0
}

function sCurve(x: number, midpoint = 0.5, steepness = 5): number {
  // Logistic function: 1 / (1 + e^(-k*(x-m)))
  const k = Math.max(1, Math.min(10, steepness))
  const m = Math.max(0, Math.min(1, midpoint))
  return 1 / (1 + Math.exp(-k * (x - m) * 10))
}

function evaluateFunction(
  type: EdgeFunctionType,
  x: number,
  params?: FunctionParams
): number {
  switch (type) {
    case 'linear':
      return linear(x)
    case 'diminishing_returns':
      return diminishingReturns(x, params?.curvature)
    case 'threshold':
      return threshold(x, params?.threshold)
    case 's_curve':
      return sCurve(x, params?.midpoint, params?.steepness)
    default:
      return x
  }
}

export const FUNCTION_TYPE_INFO: Record<EdgeFunctionType, { label: string; description: string }> = {
  linear: {
    label: 'Linear',
    description: 'Output increases proportionally with input',
  },
  diminishing_returns: {
    label: 'Diminishing Returns',
    description: 'Early gains are larger, later gains taper off',
  },
  threshold: {
    label: 'Threshold',
    description: 'No effect until threshold is crossed, then full effect',
  },
  s_curve: {
    label: 'S-Curve',
    description: 'Slow start, rapid middle, slow finish (adoption curve)',
  },
}

export const FunctionPreview = memo(function FunctionPreview({
  type,
  params,
  width = 80,
  height = 60,
  showLabels = false,
  color = '#0ea5e9', // sky-500
  className = '',
}: FunctionPreviewProps) {
  // Generate path points
  const pathD = useMemo(() => {
    const points: string[] = []
    const steps = 50
    const padding = 4

    for (let i = 0; i <= steps; i++) {
      const x = i / steps
      const y = evaluateFunction(type, x, params)

      // Map to SVG coordinates (y is inverted)
      const svgX = padding + x * (width - 2 * padding)
      const svgY = height - padding - y * (height - 2 * padding)

      points.push(i === 0 ? `M ${svgX} ${svgY}` : `L ${svgX} ${svgY}`)
    }

    return points.join(' ')
  }, [type, params, width, height])

  // Threshold indicator position
  const thresholdX = useMemo(() => {
    if (type !== 'threshold') return null
    const t = params?.threshold ?? 0.5
    return 4 + t * (width - 8)
  }, [type, params?.threshold, width])

  // Midpoint indicator for s-curve
  const midpointX = useMemo(() => {
    if (type !== 's_curve') return null
    const m = params?.midpoint ?? 0.5
    return 4 + m * (width - 8)
  }, [type, params?.midpoint, width])

  return (
    <div className={`inline-block ${className}`}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="bg-sand-50 rounded border border-sand-200"
        aria-label={`${FUNCTION_TYPE_INFO[type].label} function preview`}
        role="img"
      >
        {/* Grid lines */}
        <line
          x1={4}
          y1={height - 4}
          x2={width - 4}
          y2={height - 4}
          stroke="#d4d4d8"
          strokeWidth={1}
        />
        <line
          x1={4}
          y1={4}
          x2={4}
          y2={height - 4}
          stroke="#d4d4d8"
          strokeWidth={1}
        />

        {/* Diagonal reference line (linear) */}
        {type !== 'linear' && (
          <line
            x1={4}
            y1={height - 4}
            x2={width - 4}
            y2={4}
            stroke="#e5e5e5"
            strokeWidth={1}
            strokeDasharray="2 2"
          />
        )}

        {/* Threshold indicator */}
        {thresholdX !== null && (
          <line
            x1={thresholdX}
            y1={4}
            x2={thresholdX}
            y2={height - 4}
            stroke="#f97316" // orange-500
            strokeWidth={1}
            strokeDasharray="3 2"
          />
        )}

        {/* Midpoint indicator */}
        {midpointX !== null && (
          <line
            x1={midpointX}
            y1={4}
            x2={midpointX}
            y2={height - 4}
            stroke="#a855f7" // purple-500
            strokeWidth={1}
            strokeDasharray="3 2"
          />
        )}

        {/* Function curve */}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {showLabels && (
        <div className="flex justify-between mt-1 px-1">
          <span className="text-[10px] text-ink-400">0</span>
          <span className="text-[10px] text-ink-600 font-medium">
            {FUNCTION_TYPE_INFO[type].label}
          </span>
          <span className="text-[10px] text-ink-400">1</span>
        </div>
      )}
    </div>
  )
})

// Export function type options for dropdowns
export const EDGE_FUNCTION_TYPES: EdgeFunctionType[] = [
  'linear',
  'diminishing_returns',
  'threshold',
  's_curve',
]
