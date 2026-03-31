/**
 * DecisionHealthRing — SVG concentric arc chart showing 4 decision quality dimensions.
 *
 * 3 concentric 270-degree arcs (structure, evidence, coverage) rendered with evaluative
 * threshold colours (DS v5 §11.6). A 4th dimension (verified) is averaged into the
 * overall score but not drawn as a ring to keep the visualisation clean.
 *
 * Centre: numeric score + configurable label (default "ready").
 *
 * Evaluative thresholds (§11.6):
 *   0–39% → danger, 40–69% → warning, ≥70% → success
 */

import { memo } from 'react'
import { evaluativeVar } from '@/styles/evaluative'

export interface DecisionHealthRingDimensions {
  structure: number
  evidence: number
  coverage: number
  verified: number
}

interface DecisionHealthRingProps {
  /** Four 0-1 dimension values */
  dimensions: DecisionHealthRingDimensions
  /** Ring diameter in px (default 54) */
  size?: number
  /** Centre label below the score (default "ready") */
  centerLabel?: string
  /** Override the centre score (0-100) instead of computing from dimensions.
   *  Used post-analysis to display ISL recommendation_stability directly. */
  overrideScore?: number | null
}

// Arc geometry: 270 degree arc
const START_ANGLE = 135 // degrees from 12 o'clock
const TOTAL_ANGLE = 270
const DEFAULT_SIZE = 54

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
}

export const DecisionHealthRing = memo(function DecisionHealthRing({
  dimensions,
  size = DEFAULT_SIZE,
  centerLabel = 'ready',
  overrideScore,
}: DecisionHealthRingProps) {
  const clamp = (v: number) => Math.max(0, Math.min(1, v))
  const s = clamp(dimensions.structure)
  const e = clamp(dimensions.evidence)
  const cov = clamp(dimensions.coverage)
  const v = clamp(dimensions.verified)

  // When overrideScore is provided (post-analysis), use it directly.
  // Otherwise compute equal-weighted average from dimensions (pre-analysis).
  const overallScore = overrideScore != null
    ? Math.round(overrideScore)
    : Math.round((s + e + cov + v) / 4 * 100)

  // Scale radii proportionally to size (base: 54px → 24/19/14)
  const scale = size / DEFAULT_SIZE
  const cx = size / 2
  const cy = size / 2
  const strokeWidth = Math.max(2, 3 * scale)
  const scoreFontSize = Math.max(10, 14 * scale)
  const labelFontSize = Math.max(6, 8 * scale)

  const arcs: ArcConfig[] = [
    { label: 'Structure', value: s, radius: 24 * scale },
    { label: 'Evidence', value: e, radius: 19 * scale },
    { label: 'Coverage', value: cov, radius: 14 * scale },
  ]

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={centerLabel === '%' ? `Decision score: ${overallScore}%` : `Decision ${centerLabel}: ${overallScore}%`}
      className="flex-shrink-0"
    >
      {arcs.map((arc) => {
        const circ = arcCircumference(arc.radius)
        const fillLen = circ * arc.value
        const path = arcPath(arc.radius, cx, cy)
        return (
          <g key={arc.label}>
            {/* Track */}
            <path
              d={path}
              fill="none"
              stroke="var(--border-default, #EEE6D8)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            {/* Filled arc — evaluative colour */}
            <path
              d={path}
              fill="none"
              stroke={evaluativeVar(arc.value)}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${fillLen} ${circ}`}
            />
          </g>
        )
      })}
      {/* Centre score + label */}
      {centerLabel === '%' ? (
        /* Symbol suffix: render "95%" as a single text element */
        <text
          x={cx}
          y={cy + 2 * scale}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-text-body"
          style={{ fontSize: `${scoreFontSize}px`, fontWeight: 600, fontFamily: 'Inter, sans-serif' }}
        >
          {overallScore}%
        </text>
      ) : (
        /* Word label: score on top, label below (e.g. "72" / "ready") */
        <>
          <text
            x={cx}
            y={cy - 2 * scale}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-text-body"
            style={{ fontSize: `${scoreFontSize}px`, fontWeight: 600, fontFamily: 'Inter, sans-serif' }}
          >
            {overallScore}
          </text>
          <text
            x={cx}
            y={cy + 8 * scale}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-text-light"
            style={{ fontSize: `${labelFontSize}px`, fontFamily: 'Inter, sans-serif' }}
          >
            {centerLabel}
          </text>
        </>
      )}
    </svg>
  )
})

export default DecisionHealthRing
