/**
 * ModelHealthCard — Decision readiness hero panel (Layout 5A "Coach-led").
 *
 * Layout: "Decision readiness" title. Below: 54px ring (left) beside decision
 * headline + 4 dimension bars in a 2×2 grid. Below: dismissible coaching line.
 *
 * Dimension labels: Structure, Evidence, Coverage, Verified.
 * Bar colours use evaluative thresholds (DS v5 §11.6).
 */

import { useState, memo, useMemo } from 'react'
import { X, Info } from 'lucide-react'
import { DecisionHealthRing } from './DecisionHealthRing'
import type { DecisionHealthRingDimensions } from './DecisionHealthRing'
import Tooltip from '../../../components/Tooltip'
import { typography } from '@/styles/typography'
import { evaluativeVar } from '@/styles/evaluative'

interface DimensionData {
  label: string
  value: number
  tooltip: string
}

interface ModelHealthCardProps {
  completeness: number
  evidence: number
  balance: number
  calibration: number
  optionCount: number
  goalLabel: string | null
  coachingSummary: string | null
  isLoading: boolean
  hasGoalNode: boolean
}

function DimensionBar({ dim }: { dim: DimensionData }) {
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

export const ModelHealthCard = memo(function ModelHealthCard({
  completeness,
  evidence,
  balance,
  calibration,
  optionCount,
  goalLabel,
  coachingSummary,
  isLoading,
  hasGoalNode,
}: ModelHealthCardProps) {
  const [coachingDismissed, setCoachingDismissed] = useState(false)

  // Map existing prop names to new dimension names for the ring
  const ringDimensions: DecisionHealthRingDimensions = useMemo(() => ({
    structure: completeness,
    evidence,
    coverage: balance,
    verified: calibration,
  }), [completeness, evidence, balance, calibration])

  // Empty state
  if (isLoading && !hasGoalNode) {
    return (
      <div className="rounded-lg border border-panel-border bg-panel px-3 py-3" data-testid="model-health-card">
        <p className={`${typography.panelHeader} text-text-header mb-2`}>Decision readiness</p>
        <p className={`${typography.panelBody} text-text-light`}>Generating your decision model...</p>
      </div>
    )
  }

  const dimensions: DimensionData[] = [
    {
      label: 'Structure',
      value: completeness,
      tooltip: 'Goal, options, factors, and connections all present and properly linked',
    },
    {
      label: 'Evidence',
      value: evidence,
      tooltip: 'Proportion of values grounded in your brief or confirmed by you, versus estimated by the AI',
    },
    {
      label: 'Coverage',
      value: balance,
      tooltip: 'Whether the model captures trade-offs, risks, a baseline option, and diverse strategies',
    },
    {
      label: 'Verified',
      value: calibration,
      tooltip: 'Factors, relationships, and contested items you\'ve personally verified or provided estimates for',
    },
  ]

  // Headline synthesised from graph state — no CEE `graph_summary` field exists yet.
  // Replace with CEE-provided summary when the field is added to the response envelope.
  const summary = goalLabel
    ? `Choosing between ${optionCount} ${optionCount === 1 ? 'strategy' : 'strategies'} to achieve ${goalLabel}`
    : null

  const showCoaching = !coachingDismissed && coachingSummary == null

  return (
    <div className="rounded-lg border border-panel-border bg-panel px-3 py-3 space-y-3" data-testid="model-health-card">
      <p className={`${typography.panelHeader} text-text-header`}>Decision readiness</p>

      {/* Ring + headline + dimensions layout */}
      <div className="flex items-start gap-3">
        {/* Ring — 54px, left-aligned */}
        <DecisionHealthRing dimensions={ringDimensions} size={54} />

        {/* Text column */}
        <div className="flex-1 min-w-0 space-y-2">
          {summary && (
            <p className={`${typography.panelHeader} text-text-body`}>{summary}</p>
          )}

          {/* 2×2 dimension bars */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {dimensions.map((dim) => (
              <DimensionBar key={dim.label} dim={dim} />
            ))}
          </div>
        </div>
      </div>

      {/* Coaching line — dismissible per session */}
      {showCoaching && (
        <div className="flex items-start gap-2 px-2 py-1.5 bg-panel-hover rounded-md">
          <Info size={14} className="text-info flex-shrink-0 mt-0.5" />
          <p className={`${typography.panelMeta} text-text-light flex-1`}>
            Your expertise makes the analysis more reliable. The Verified score improves as you verify values in Your expertise below.
          </p>
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

export default ModelHealthCard
