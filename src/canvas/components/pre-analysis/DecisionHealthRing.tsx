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
  /** Ring diameter in px (default 120) */
  size?: number
  /** Show legend + calibration bar below the ring (default true) */
  showLegend?: boolean
}

// Arc geometry: 270 degree arc
const START_ANGLE = 135 // degrees from 12 o'clock
const TOTAL_ANGLE = 270
const DEFAULT_SIZE = 120

function toRad(deg: number) {
  return (deg * Math.PI) / 180
}

function arcPath(r: number, cx: number, cy: number): string {
  const startRad = toRad(START_ANGLE - 90)
  const endRad = toRad(START_ANGLE + TOTAL_ANGLE - 90)
  const x1 = cx + r * Math.cos(startRad)
  const y1 = cy + r * Math.sin(startRad)
  const x2 = cx + r * Math.cos(endRad)
  const y2 = cy + r * Math.sin(endRad)
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
  size = DEFAULT_SIZE,
  showLegend = true,
}: DecisionHealthRingProps) {
  // Clamp all values to [0, 1]
  const clamp = (v: number) => Math.max(0, Math.min(1, v))
  const c = clamp(completeness)
  const e = clamp(evidence)
  const b = clamp(balance)
  const cal = clamp(calibration)

  // Overall score: equal-weighted average, always integer, 0 when all dimensions are 0
  const overallScore = Math.round((c + e + b + cal) / 4 * 100)

  // Scale radii proportionally to size (base: 120px → 48/38/28)
  const scale = size / DEFAULT_SIZE
  const cx = size / 2
  const cy = size / 2
  const strokeWidth = Math.max(3, 6 * scale)
  const scoreFontSize = Math.max(12, 20 * scale)
  const labelFontSize = Math.max(7, 9 * scale)

  const arcs: ArcConfig[] = [
    { label: 'Completeness', value: c, radius: 48 * scale, color: 'var(--semantic-success, #10b981)' },
    { label: 'Evidence', value: e, radius: 38 * scale, color: 'var(--semantic-warning, #f59e0b)' },
    { label: 'Balance', value: b, radius: 28 * scale, color: 'var(--semantic-info, #3b82f6)' },
  ]

  // Calibration bar color: danger when low, success when high
  const calColor = cal >= 0.5 ? 'var(--semantic-success, #10b981)' : 'var(--semantic-danger, #ef4444)'

  return (
    <div className={`flex flex-col ${showLegend ? 'items-center' : 'items-start'} gap-2 py-2`}>
      {/* SVG ring */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`Decision health: ${overallScore}%`}>
        {arcs.map((arc) => {
          const circ = arcCircumference(arc.radius)
          const fillLen = circ * arc.value
          const path = arcPath(arc.radius, cx, cy)
          return (
            <g key={arc.label}>
              {/* Background track */}
              <path
                d={path}
                fill="none"
                stroke="var(--panel-border, #e5e5e5)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                opacity={0.4}
              />
              {/* Filled arc */}
              <path
                d={path}
                fill="none"
                stroke={arc.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={`${fillLen} ${circ}`}
              />
            </g>
          )
        })}
        {/* Centre text */}
        <text
          x={cx}
          y={cy - 4 * scale}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-text-body"
          style={{ fontSize: `${scoreFontSize}px`, fontWeight: 600, fontFamily: 'Inter, sans-serif' }}
        >
          {overallScore}
        </text>
        <text
          x={cx}
          y={cy + 12 * scale}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-text-light"
          style={{ fontSize: `${labelFontSize}px`, fontFamily: 'Inter, sans-serif' }}
        >
          health
        </text>
      </svg>

      {showLegend && (
        <>
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
        </>
      )}
    </div>
  )
})

export default DecisionHealthRing
