/**
 * ModelHealthCard — Pre-analysis "Decision readiness" hero panel.
 *
 * Thin wrapper around TriageHealthHeader with pre-analysis dimension mapping.
 * Handles the loading/empty state specific to pre-analysis.
 */

import { memo, useMemo } from 'react'
import { TriageHealthHeader } from '@/components/shared/TriageHealthHeader'
import type { TriageDimension } from '@/components/shared/TriageHealthHeader'
import type { DecisionHealthRingDimensions } from '@/components/shared/DecisionHealthRing'
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
  /**
   * Compact mode for v2 panel structure: omits title, headline, and coaching;
   * shows only the ring + 4 dimension bars in a single tight row.
   * Status text comes from the new top banner instead.
   */
  compact?: boolean
  /**
   * Dynamic coaching headline derived from the highest-priority bucket signal
   * (Must fix → review-tier → improve-confidence-tier → Ready). Computed by the
   * panel parent so it has access to bucket-level state.
   *
   * Precedence at render: coachingSummary (CEE-provided) → dynamicHeadline →
   * null. The previous static fallback ("Your expertise makes the analysis
   * more reliable…") was deleted per the bias-and-headline brief.
   */
  dynamicHeadline?: string | null
}

const PRE_ANALYSIS_DIMENSIONS: Omit<TriageDimension, 'value'>[] = [
  { label: 'Decision shape', tooltip: 'Whether your decision has the structural elements needed for analysis: options to compare, a goal to optimise, factors that drive outcomes, and connections between them.' },
  { label: 'Evidence', tooltip: 'Proportion of values grounded in your brief or confirmed by you, versus estimated by the AI' },
  { label: 'Your contribution', tooltip: 'The percentage of factor values you have set or confirmed, versus those estimated by Olumi. Higher means the analysis is grounded in your knowledge.' },
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
  compact = false,
  dynamicHeadline = null,
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

  // Headline synthesised from graph state (legacy non-compact path).
  const headline = goalLabel
    ? `Choosing between ${optionCount} ${optionCount === 1 ? 'strategy' : 'strategies'} to achieve ${goalLabel}`
    : null

  // Coaching line precedence (both compact and non-compact):
  //   1. CEE-provided coaching_summary
  //   2. Bucket-derived dynamicHeadline from the panel parent
  //   3. null (no static fallback — the previous "Your expertise…" copy was
  //      deleted in the bias-and-headline brief)
  const coaching = coachingSummary ?? dynamicHeadline ?? null

  // Compact mode (v2 panel): ring + dimension bars + static readiness reframe.
  // Headline + subline are fixed copy from the pre-analysis-power-v1 brief —
  // they honestly signal that the model is ready to run a first pass, not
  // ready to trust the result. Dynamic coaching strings (coachingSummary,
  // dynamicHeadline) are no longer rendered here; the new sentence is the
  // single trust-anchor.
  if (compact) {
    return (
      <div className="space-y-2" data-testid="decision-readiness-card">
        <TriageHealthHeader
          title="Decision readiness"
          ringLabel="ready"
          ringDimensions={ringDimensions}
          dimensions={dimensions}
          headline={null}
          coaching={null}
          testId="model-health-card"
          hideTitle
        />
        <div data-testid="model-health-card-headline">
          <p className={`${typography.panelHeader} text-text-header`}>
            Ready for provisional analysis
          </p>
          <p className={`${typography.panelMeta} text-text-light line-clamp-2 mt-0.5`}>
            Good enough to run, but results will be assumption-led until you confirm the highest-impact inputs.
          </p>
        </div>
        {children}
      </div>
    )
  }

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
