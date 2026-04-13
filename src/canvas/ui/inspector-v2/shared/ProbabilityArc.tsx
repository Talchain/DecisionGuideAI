/**
 * ProbabilityArc — SVG circular progress with centred percentage
 * Used in Goal impact (achievement probability) and Option impact (win rate)
 */

interface ProbabilityArcProps {
  /** 0–1 probability */
  value: number
  /** px, default 80 */
  size?: number
  /** CSS colour, defaults to success */
  color?: string
}

export function ProbabilityArc({
  value,
  size = 80,
  color = 'var(--success)',
}: ProbabilityArcProps) {
  const strokeWidth = 6
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - Math.max(0, Math.min(1, value)))

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--border-default)"
        strokeWidth={strokeWidth}
      />
      {/* Fill arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      {/* Centre text */}
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fontSize: size * 0.28,
          fontWeight: 700,
          fill: 'var(--text-header)',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {Math.round(value * 100)}%
      </text>
    </svg>
  )
}
