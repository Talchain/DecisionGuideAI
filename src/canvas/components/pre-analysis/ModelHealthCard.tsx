/**
 * ModelHealthCard — Section card replacing Header + DecisionHealthRing + ModelHealthSection.
 *
 * Layout: "Model health" title. Below: 80px ring (left) beside text column with
 * decision summary + 4 dimension bars in a 2×2 grid. Below: dismissible coaching line.
 *
 * Score formula: Math.round((complete + evidence + balance + calibrated) / 4 * 100).
 * Always integer. 0 when all dimensions are 0.
 */

import { useState, memo } from 'react'
import { X, Info } from 'lucide-react'
import { DecisionHealthRing } from './DecisionHealthRing'
import Tooltip from '../../../components/Tooltip'
import { typography } from '@/styles/typography'

interface DimensionData {
  label: string
  value: number
  color: string
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
  return (
    <Tooltip content={dim.tooltip} delay={300}>
      <div className="min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className={`${typography.panelMeta} text-text-light`}>{dim.label}</span>
          <span className={`${typography.panelMeta} text-text-light`}>{pct}%</span>
        </div>
        <div className="w-full h-1.5 bg-panel-border rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, backgroundColor: dim.color }}
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

  // Empty state
  if (isLoading && !hasGoalNode) {
    return (
      <div className="rounded-lg border border-panel-border bg-panel px-3 py-3" data-testid="model-health-card">
        <p className={`${typography.panelHeader} text-text-header mb-2`}>Model health</p>
        <p className={`${typography.panelBody} text-text-light`}>Generating your decision model...</p>
      </div>
    )
  }

  const calColor = calibration >= 0.5 ? 'var(--semantic-success, #10b981)' : 'var(--semantic-danger, #ef4444)'

  const dimensions: DimensionData[] = [
    {
      label: 'Complete',
      value: completeness,
      color: 'var(--semantic-success, #10b981)',
      tooltip: 'Goal, options, factors, and connections all present and properly linked',
    },
    {
      label: 'Evidence',
      value: evidence,
      color: 'var(--semantic-warning, #f59e0b)',
      tooltip: 'Proportion of values grounded in your brief or confirmed by you, versus estimated by the AI',
    },
    {
      label: 'Balance',
      value: balance,
      color: 'var(--semantic-info, #3b82f6)',
      tooltip: 'Whether the model captures trade-offs, risks, a baseline option, and diverse strategies',
    },
    {
      label: 'Calibrated',
      value: calibration,
      color: calColor,
      tooltip: 'Factors, relationships, and contested items you\'ve personally verified or provided estimates for',
    },
  ]

  const summary = goalLabel
    ? `Choosing between ${optionCount} ${optionCount === 1 ? 'strategy' : 'strategies'} to achieve ${goalLabel}`
    : null

  const showCoaching = !coachingDismissed && coachingSummary == null

  return (
    <div className="rounded-lg border border-panel-border bg-panel px-3 py-3 space-y-3" data-testid="model-health-card">
      <p className={`${typography.panelHeader} text-text-header`}>Model health</p>

      {/* Ring + dimensions layout */}
      <div className="flex items-start gap-3">
        {/* Ring — 80px, left-aligned */}
        <div className="flex-shrink-0">
          <DecisionHealthRing
            completeness={completeness}
            evidence={evidence}
            balance={balance}
            calibration={calibration}
            size={80}
            showLegend={false}
          />
        </div>

        {/* Text column */}
        <div className="flex-1 min-w-0 space-y-2">
          {summary && (
            <p className={`${typography.panelBody} text-text-body`}>{summary}</p>
          )}

          {/* 2×2 dimension bars */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
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
            Your expertise makes the analysis more reliable. The Calibrated score improves as you verify values in Your expertise below.
          </p>
          <button
            type="button"
            onClick={() => setCoachingDismissed(true)}
            className="flex-shrink-0 text-text-light hover:text-text-body cursor-pointer"
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
