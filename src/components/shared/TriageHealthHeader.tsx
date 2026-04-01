/**
 * TriageHealthHeader — shared health header for pre-analysis and post-analysis panels.
 *
 * Renders: title, ring (left) beside headline + 4 dimension bars in a 2×2 grid,
 * plus optional coaching line below.
 *
 * Pre-analysis: title="Decision readiness", ringLabel="ready"
 * Post-analysis: title="Decision confidence", ringLabel="trust"
 *
 * Bar colours use evaluative thresholds (DS v5 §11.6).
 */

import { useState, memo } from 'react'
import { X, Info } from 'lucide-react'
import { DecisionHealthRing } from '@/canvas/components/pre-analysis/DecisionHealthRing'
import type { DecisionHealthRingDimensions } from '@/canvas/components/pre-analysis/DecisionHealthRing'
import Tooltip from '@/components/Tooltip'
import { typography } from '@/styles/typography'
import { evaluativeVar } from '@/styles/evaluative'

export interface TriageDimension {
  label: string
  value: number
  tooltip: string
}

export interface TriageHealthHeaderProps {
  /** Panel title ("Decision readiness" or "Decision confidence") */
  title: string
  /** Ring centre label ("ready" or "trust") */
  ringLabel: string
  /** Four 0-1 dimension values for the ring arcs + overall score */
  ringDimensions: DecisionHealthRingDimensions
  /** Dimension bars to display (4 items in 2×2 grid) */
  dimensions: TriageDimension[]
  /** Optional headline below the ring (e.g. decision summary sentence) */
  headline?: string | null
  /** Optional coaching line — dismissible per session */
  coaching?: string | null
  /** Override the centre ring score (0-100) instead of computing from dimensions */
  overrideScore?: number | null
  /** Test ID for the container */
  testId?: string
}

function DimensionBar({ dim }: { dim: TriageDimension }) {
  const pct = Math.round(Math.max(0, Math.min(1, dim.value)) * 100)
  const color = evaluativeVar(dim.value)
  return (
    <Tooltip content={dim.tooltip} delay={300}>
      <div className="min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className={`${typography.panelMeta} text-text-light`}>{dim.label}</span>
          <span className={`${typography.panelMeta} text-text-light`}>{pct}%</span>
        </div>
        <div className="w-full h-[5px] rounded-sm overflow-hidden" style={{ backgroundColor: 'var(--border-default, #EEE6D8)' }}>
          <div
            className="h-full rounded-sm transition-all duration-300"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </Tooltip>
  )
}

export const TriageHealthHeader = memo(function TriageHealthHeader({
  title,
  ringLabel,
  ringDimensions,
  dimensions,
  headline,
  coaching,
  overrideScore,
  testId = 'triage-health-header',
}: TriageHealthHeaderProps) {
  const [coachingDismissed, setCoachingDismissed] = useState(false)

  const showCoaching = !coachingDismissed && coaching != null

  return (
    <div className="rounded-lg border border-panel-border bg-panel px-3 py-3 space-y-3" data-testid={testId}>
      <p className={`${typography.panelHeader} text-text-header`}>{title}</p>

      {/* Ring + headline + dimensions layout */}
      <div className="flex items-start gap-3">
        <DecisionHealthRing dimensions={ringDimensions} size={64} centerLabel={ringLabel} overrideScore={overrideScore} />

        <div className="flex-1 min-w-0 space-y-2">
          {headline && (
            <p className={`${typography.panelHeader} text-text-body`}>{headline}</p>
          )}

          {/* 2×2 dimension bars — only show incomplete dimensions (Task 3: no 100% indicator line) */}
          {dimensions.some(d => d.value < 1) && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {dimensions.filter(d => d.value < 1).map((dim) => (
                <DimensionBar key={dim.label} dim={dim} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Coaching line */}
      {showCoaching && (
        <div className="flex items-start gap-2 px-2 py-1.5 bg-panel-hover rounded-md">
          <Info size={14} className="text-info flex-shrink-0 mt-0.5" />
          <p className={`${typography.panelMeta} text-text-light flex-1`}>{coaching}</p>
          <button
            type="button"
            onClick={() => setCoachingDismissed(true)}
            className="flex-shrink-0 p-1 rounded text-text-light hover:text-text-body hover:bg-panel-hover cursor-pointer"
            aria-label="Dismiss coaching"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  )
})

export default TriageHealthHeader
