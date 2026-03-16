import { getThresholdToken } from '../results/utils/getThresholdColour'
import { typography } from '../../styles/typography'

interface StabilityGaugeProps {
  value: number | null | undefined
  size?: number
}

export function StabilityGauge({ value, size = 24 }: StabilityGaugeProps) {
  if (value == null) return null

  const token = getThresholdToken(value)
  const pct = Math.round(value * 100)

  // Arc geometry: 270 degree arc
  const r = 10 // radius
  const cx = 12
  const cy = 12
  const startAngle = 135 // degrees from 12 o'clock
  const totalAngle = 270

  // Convert to radians and compute arc path
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const startRad = toRad(startAngle - 90) // SVG starts from 3 o'clock
  const endRad = toRad(startAngle + totalAngle - 90)

  const x1 = cx + r * Math.cos(startRad)
  const y1 = cy + r * Math.sin(startRad)
  const x2 = cx + r * Math.cos(endRad)
  const y2 = cy + r * Math.sin(endRad)

  const arcPath = `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${x2} ${y2}`

  // Circumference for stroke-dasharray
  const circumference = 2 * Math.PI * r * (totalAngle / 360)
  const fillLength = circumference * value

  return (
    <span className="inline-flex items-center gap-1.5" data-testid="stability-gauge">
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        {/* Background track */}
        <path
          d={arcPath}
          fill="none"
          stroke="var(--panel-border)"
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.5}
        />
        {/* Filled arc */}
        <path
          d={arcPath}
          fill="none"
          stroke={`var(--${token})`}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={`${fillLength} ${circumference}`}
        />
      </svg>
      <span className={`${typography.panelMeta} text-text-light`}>{pct}%</span>
    </span>
  )
}
