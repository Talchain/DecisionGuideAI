/**
 * DecisionHealthRing — SVG concentric arc chart showing 4 decision quality dimensions.
 *
 * 3 concentric 270-degree arcs (completeness, evidence, balance) + calibration bar below.
 * Overall score (weighted average, 0-100) displayed in the ring centre.
 *
 * Follows StabilityGauge SVG arc pattern (stroke-dasharray technique).
 */

import { memo } from 'react'
import { typography } from '@/styles/typography'

interface DecisionHealthRingProps {
  /** Completeness: 0-1 (from ceeQuality.structure / 10) */
  completeness: number
  /** Evidence: 0-1 (ratio of non-AI factors) */
  evidence: number
  /** Balance: 0-1 (composite of negative edges, risks, baseline, option diversity) */
  balance: number
  /** Calibration: 0-1 (reviewedCount / totalReviewableCount) */
  calibration: number
}

// Arc geometry: 270 degree arc
const START_ANGLE = 135 // degrees from 12 o'clock
const TOTAL_ANGLE = 270
const CX = 60
const CY = 60

function toRad(deg: number) {
  return (deg * Math.PI) / 180
}

function arcPath(r: number): string {
  const startRad = toRad(START_ANGLE - 90)
  const endRad = toRad(START_ANGLE + TOTAL_ANGLE - 90)
  const x1 = CX + r * Math.cos(startRad)
  const y1 = CY + r * Math.sin(startRad)
  const x2 = CX + r * Math.cos(endRad)
  const y2 = CY + r * Math.sin(endRad)
  return `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${x2} ${y2}`
}

function arcCircumference(r: number): number {
  return 2 * Math.PI * r * (TOTAL_ANGLE / 360)
}

interface ArcConfig {
  label: string
  value: number
  radius: number
  color: string
}

export const DecisionHealthRing = memo(function DecisionHealthRing({
  completeness,
  evidence,
  balance,
  calibration,
}: DecisionHealthRingProps) {
  // Clamp all values to [0, 1]
  const clamp = (v: number) => Math.max(0, Math.min(1, v))
  const c = clamp(completeness)
  const e = clamp(evidence)
  const b = clamp(balance)
  const cal = clamp(calibration)

  // Overall score: equal-weighted average
  const overallScore = Math.round(((c + e + b + cal) / 4) * 100)

  const arcs: ArcConfig[] = [
    { label: 'Completeness', value: c, radius: 48, color: 'var(--semantic-success, #10b981)' },
    { label: 'Evidence', value: e, radius: 38, color: 'var(--semantic-warning, #f59e0b)' },
    { label: 'Balance', value: b, radius: 28, color: 'var(--semantic-info, #3b82f6)' },
  ]

  // Calibration bar color: danger when low, success when high
  const calColor = cal >= 0.5 ? 'var(--semantic-success, #10b981)' : 'var(--semantic-danger, #ef4444)'

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      {/* SVG ring */}
      <svg width={120} height={120} viewBox="0 0 120 120" aria-label={`Decision health: ${overallScore}%`}>
        {arcs.map((arc) => {
          const circ = arcCircumference(arc.radius)
          const fillLen = circ * arc.value
          const path = arcPath(arc.radius)
          return (
            <g key={arc.label}>
              {/* Background track */}
              <path
                d={path}
                fill="none"
                stroke="var(--panel-border, #e5e5e5)"
                strokeWidth={6}
                strokeLinecap="round"
                opacity={0.4}
              />
              {/* Filled arc */}
              <path
                d={path}
                fill="none"
                stroke={arc.color}
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray={`${fillLen} ${circ}`}
              />
            </g>
          )
        })}
        {/* Centre text */}
        <text
          x={CX}
          y={CY - 4}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-text-body"
          style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}
        >
          {overallScore}
        </text>
        <text
          x={CX}
          y={CY + 12}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-text-light"
          style={{ fontSize: '9px', fontFamily: 'Inter, sans-serif' }}
        >
          health
        </text>
      </svg>

      {/* Calibration bar */}
      <div className="w-full max-w-[120px] space-y-0.5">
        <div className="flex items-center justify-between">
          <span className={`${typography.panelMeta} text-text-light`}>Calibration</span>
          <span className={`${typography.panelMeta} text-text-light`}>{Math.round(cal * 100)}%</span>
        </div>
        <div className="w-full h-1.5 bg-panel-border rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.round(cal * 100)}%`, backgroundColor: calColor }}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 px-2">
        {arcs.map((arc) => (
          <div key={arc.label} className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: arc.color }}
            />
            <span className={`${typography.panelMeta} text-text-light`}>
              {arc.label} {Math.round(arc.value * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
})

export default DecisionHealthRing
