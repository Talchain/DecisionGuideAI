/**
 * Sparkline - Tiny inline SVG chart showing trend over last 5 runs
 *
 * Features:
 * - Lightweight (no dependencies)
 * - Inline SVG with minimal overhead
 * - Auto-scales to data range
 * - Accessible with aria-label
 * - Responsive width
 */

interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  strokeColor?: string
  strokeWidth?: number
  showDot?: boolean
}

export function Sparkline({
  values,
  width = 80,
  height = 24,
  strokeColor = 'var(--olumi-primary)',
  strokeWidth = 2,
  showDot = true
}: SparklineProps) {
  // Need at least 2 points for a line
  if (values.length < 2) {
    return null
  }

  // Take last 5 values
  const data = values.slice(-5)

  // Calculate scaling
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min

  // Avoid division by zero
  const normalizedRange = range === 0 ? 1 : range

  // Padding for the chart
  const padding = strokeWidth * 2

  // Calculate points
  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - 2 * padding)
    const y = padding + (1 - (value - min) / normalizedRange) * (height - 2 * padding)
    return `${x},${y}`
  }).join(' ')

  // Format trend description
  const trend = data[data.length - 1] > data[0] ? 'increasing' : 'decreasing'
  const percentChange = data[0] !== 0
    ? Math.abs(((data[data.length - 1] - data[0]) / data[0]) * 100)
    : 0

  const ariaLabel = `Trend ${trend} by ${percentChange.toFixed(1)}% over last ${data.length} runs`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
      }}
    >
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.8}
      />

      {/* Dot at last point */}
      {showDot && data.length > 0 && (
        <circle
          cx={padding + ((data.length - 1) / (data.length - 1)) * (width - 2 * padding)}
          cy={padding + (1 - (data[data.length - 1] - min) / normalizedRange) * (height - 2 * padding)}
          r={strokeWidth * 1.5}
          fill={strokeColor}
        />
      )}
    </svg>
  )
}
