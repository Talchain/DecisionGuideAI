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

import { useState, memo, type ReactNode } from 'react'
import { X, Info } from 'lucide-react'
import { DecisionHealthRing } from '@/components/shared/DecisionHealthRing'
import type { DecisionHealthRingDimensions } from '@/components/shared/DecisionHealthRing'
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
  /**
   * Dimension bars to display below the headline. Independent of ring mode —
   * single-mode callers (post-analysis hero) can still surface bars.
   */
  dimensions?: TriageDimension[]
  /** Optional headline below the ring (e.g. decision summary sentence) */
  headline?: string | null
  /** Optional coaching line — dismissible per session */
  coaching?: string | null
  /** Override the centre ring score (0-100) instead of computing from dimensions */
  overrideScore?: number | null
  /** Test ID for the container */
  testId?: string
  /**
   * Hide the title and coaching line — used by the v2 pre-analysis panel
   * where the top status banner replaces the title. The DOM still includes
   * a visually-hidden title for tests/screen readers.
   */
  hideTitle?: boolean
  /**
   * Ring rendering mode (ring only — `dimensions` controls bars independently).
   * - 'composite' (default): three concentric arcs.
   * - 'single': single-value ring (caller supplies overrideScore) + optional ringCaption.
   */
  mode?: 'composite' | 'single'
  /** Caption rendered below the ring in single mode (e.g. "win probability"). */
  ringCaption?: string
  /**
   * Optional qualifier slot rendered between the headline and dimension bars.
   * Used by post-analysis to surface a one-line readiness qualifier
   * (e.g. "Confidence limited by unverified estimates").
   */
  qualifier?: ReactNode
  /**
   * Optional secondary indicator rendered below the ring (and the optional
   * caption). Used by post-analysis to surface a stability score + bar
   * adjacent to the win-probability ring.
   */
  secondaryIndicator?: ReactNode
  /**
   * Brief 5.8B follow-up: when true, omit the outer `bg-panel` card shell so
   * the caller can compose the header inside a larger T1 wrapper without
   * producing visible nested-card chrome. Padding/spacing are dropped too —
   * the parent wrapper owns layout.
   */
  noCardWrapper?: boolean
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
        <div className="w-full h-[5px] rounded-sm overflow-hidden bg-panel-border">
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
  hideTitle = false,
  mode = 'composite',
  ringCaption,
  qualifier,
  secondaryIndicator,
  noCardWrapper = false,
}: TriageHealthHeaderProps) {
  const [coachingDismissed, setCoachingDismissed] = useState(false)

  const showCoaching = !coachingDismissed && coaching != null && !hideTitle
  // Bars render whenever the caller supplies a non-empty `dimensions` array,
  // regardless of ring mode. The earlier composite-only gate prevented the
  // post-analysis hero (single-value ring + 3-dim readiness bars + qualifier)
  // from sharing this primitive.
  const showBars = dimensions != null && dimensions.length > 0

  // Brief 5.8B follow-up: when used inside the post-analysis T1 wrapper, the
  // parent owns the `bg-panel rounded-lg border` chrome. Drop ours to avoid
  // nested-card visual weight; keep internal spacing identical.
  const wrapperClass = noCardWrapper
    ? hideTitle ? 'space-y-2' : 'space-y-3'
    : `rounded-lg border border-panel-border bg-panel px-3 ${hideTitle ? 'py-2 space-y-2' : 'py-3 space-y-3'}`

  return (
    <div
      className={wrapperClass}
      data-testid={testId}
    >
      {hideTitle ? (
        <p className="sr-only">{title}</p>
      ) : (
        <p className={`${typography.panelHeader} text-text-header`}>{title}</p>
      )}

      {/* Ring + headline + dimensions layout */}
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <DecisionHealthRing
            dimensions={ringDimensions}
            size={72}
            centerLabel={ringLabel}
            overrideScore={overrideScore}
            mode={mode}
          />
          {ringCaption && (
            <p className={`${typography.panelMeta} text-text-light`}>{ringCaption}</p>
          )}
          {secondaryIndicator}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          {headline && (
            <p className={`${typography.panelHeader} text-text-body`}>{headline}</p>
          )}

          {qualifier}

          {/* 2×2 dimension bars — render when caller supplies dimensions */}
          {showBars && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {dimensions!.map((dim) => (
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
