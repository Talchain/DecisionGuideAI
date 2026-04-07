/**
 * ModelHealthCard — Pre-analysis "Decision readiness" hero panel.
 *
 * Thin wrapper around TriageHealthHeader with pre-analysis dimension mapping.
 * Handles the loading/empty state specific to pre-analysis.
 */

import { memo, useMemo } from 'react'
import { TriageHealthHeader } from '@/components/shared/TriageHealthHeader'
import type { TriageDimension } from '@/components/shared/TriageHealthHeader'
import type { DecisionHealthRingDimensions } from './DecisionHealthRing'
import { typography } from '@/styles/typography'

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
  /** Triage content rendered inside the Decision readiness card below the health header */
  children?: React.ReactNode
}

const PRE_ANALYSIS_DIMENSIONS: Omit<TriageDimension, 'value'>[] = [
  { label: 'Structure', tooltip: 'Goal, options, factors, and connections all present and properly linked' },
  { label: 'Evidence', tooltip: 'Proportion of values grounded in your brief or confirmed by you, versus estimated by the AI' },
  { label: 'Coverage', tooltip: 'Whether the model captures trade-offs, risks, a baseline option, and diverse strategies' },
  { label: 'Verified', tooltip: 'Factors, relationships, and contested items you\'ve personally verified or provided estimates for' },
]

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
  children,
}: ModelHealthCardProps) {
  const ringDimensions: DecisionHealthRingDimensions = useMemo(() => ({
    structure: completeness,
    evidence,
    coverage: balance,
    verified: calibration,
  }), [completeness, evidence, balance, calibration])

  const dimensions: TriageDimension[] = useMemo(() => {
    const values = [completeness, evidence, balance, calibration]
    return PRE_ANALYSIS_DIMENSIONS.map((d, i) => ({ ...d, value: values[i] }))
  }, [completeness, evidence, balance, calibration])

  // Empty state — pre-analysis specific
  if (isLoading && !hasGoalNode) {
    return (
      <div className="rounded-lg border border-panel-border bg-panel px-3 py-3" data-testid="model-health-card">
        <p className={`${typography.panelHeader} text-text-header mb-2`}>Decision readiness</p>
        <p className={`${typography.panelBody} text-text-light`}>Generating your decision model...</p>
      </div>
    )
  }

  // Headline synthesised from graph state.
  const headline = goalLabel
    ? `Choosing between ${optionCount} ${optionCount === 1 ? 'strategy' : 'strategies'} to achieve ${goalLabel}`
    : null

  const coaching = coachingSummary != null
    ? coachingSummary
    : 'Your expertise makes the analysis more reliable. The Verified score improves as you verify values in Your expertise below.'

  return (
    <div className="space-y-3" data-testid="decision-readiness-card">
      <TriageHealthHeader
        title="Decision readiness"
        ringLabel="ready"
        ringDimensions={ringDimensions}
        dimensions={dimensions}
        headline={headline}
        coaching={coaching}
        testId="model-health-card"
      />
      {children}
    </div>
  )
})

export default ModelHealthCard
