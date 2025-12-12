/**
 * RecommendationCard - Primary recommendation display
 *
 * Phase 4 CEE-powered recommendation card that provides:
 * - Clear action headline
 * - Confidence indicator
 * - Summary explanation
 * - Expandable sections for reasoning, tradeoffs, assumptions
 *
 * Replaces/enhances DecisionSummary with richer CEE integration.
 */

import { useMemo, useEffect } from 'react'
import {
  Sparkles,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  Loader2,
  RefreshCw,
  Ban,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { useRecommendation } from '../../hooks/useRecommendation'
import { useConditionalRecommendations } from '../../hooks/useConditionalRecommendations'
import { useCanvasStore } from '../../store'
import { typography } from '../../../styles/typography'
import { formatOutcomeValue, formatRange } from '../../../lib/format'
import { ExpandableSection } from './ExpandableSection'
import { DriversSection } from './DriversSection'
import { TradeoffsSection } from './TradeoffsSection'
import { AssumptionsSection } from './AssumptionsSection'
import { ConstraintViolationsSection } from './ConstraintViolationsSection'
import { RobustnessIndicator } from './RobustnessIndicator'
import { ConditionalGuidance } from '../ConditionalGuidance'
import { cleanInsightText } from '../../utils/cleanInsightText'
import { checkRecommendationCoherence, getCoherenceWarningMessage } from '../../utils/coherenceCheck'
import type { RecommendationCardProps, ConstraintViolation, ActiveConstraint } from './types'
import type { ConfidenceLevel } from '../../../adapters/plot/types'

// Confidence styling
const confidenceConfig: Record<ConfidenceLevel, {
  icon: typeof CheckCircle
  bgColor: string
  textColor: string
  iconColor: string
  fillColor: string
  dots: number
  label: string
}> = {
  high: {
    icon: CheckCircle,
    bgColor: 'bg-mint-50',
    textColor: 'text-mint-700',
    iconColor: 'text-mint-600',
    fillColor: 'bg-mint-500',
    dots: 5,
    label: 'High',
  },
  medium: {
    icon: AlertTriangle,
    bgColor: 'bg-banana-50',
    textColor: 'text-banana-700',
    iconColor: 'text-banana-600',
    fillColor: 'bg-banana-500',
    dots: 3,
    label: 'Medium',
  },
  low: {
    icon: AlertTriangle,
    bgColor: 'bg-carrot-50',
    textColor: 'text-carrot-700',
    iconColor: 'text-carrot-600',
    fillColor: 'bg-carrot-500',
    dots: 2,
    label: 'Low',
  },
}

/**
 * Confidence dots indicator
 */
function ConfidenceDots({ level, filled }: { level: ConfidenceLevel; filled: number }) {
  const config = confidenceConfig[level]
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${
            i < filled ? config.fillColor : 'bg-sand-200'
          }`}
        />
      ))}
    </div>
  )
}

export function RecommendationCard({
  runId,
  responseHash,
  autoFetch = true,
  onDriverClick,
  onAssumptionClick,
  onValidateClick,
  optionCount = 0,
  isAnalyzing = false,
  outcomeData,
}: RecommendationCardProps) {
  // Use the recommendation hook
  const {
    recommendation,
    loading,
    error,
    fetch: fetchRecommendation,
  } = useRecommendation({
    runId,
    responseHash,
    autoFetch,
  })

  // Get highlighted nodes for visual feedback
  const setHighlightedNodes = useCanvasStore((s) => s.setHighlightedNodes)

  // Task 3.1: Fetch robustness data for ranking stability indicator
  const {
    conditions: conditionalData,
    loading: robustnessLoading,
  } = useConditionalRecommendations({
    runId,
    responseHash,
    autoFetch: true,
  })

  // Handle driver click with highlighting
  const handleDriverClick = (edgeId: string, nodeId?: string) => {
    if (nodeId) {
      setHighlightedNodes([nodeId])
      setTimeout(() => setHighlightedNodes([]), 3000)
    }
    onDriverClick?.(edgeId, nodeId)
  }

  // Handle assumption click
  const handleAssumptionClick = (edgeId: string, nodeId?: string) => {
    if (nodeId) {
      setHighlightedNodes([nodeId])
      setTimeout(() => setHighlightedNodes([]), 3000)
    }
    onAssumptionClick?.(edgeId, nodeId)
  }

  // Compute section badge counts
  const criticalAssumptions = useMemo(() => {
    return recommendation?.reasoning?.assumptions?.filter(
      (a) => a.criticality === 'critical'
    ).length ?? 0
  }, [recommendation])

  const driverCount = recommendation?.reasoning?.primary_drivers?.length ?? 0
  const tradeoffCount = recommendation?.reasoning?.key_tradeoffs?.length ?? 0
  const assumptionCount = recommendation?.reasoning?.assumptions?.length ?? 0

  // Get results for coherence check and constraint violations
  const results = useCanvasStore((s) => s.results)
  const outcomeValue = results?.report?.results?.likely

  // Task 1.6: Coherence check - detect contradictions between recommendation and outcome
  const coherenceCheck = useMemo(() => {
    if (!recommendation) return { isCoherent: true }

    const outcomeDescription = results?.report?.insights?.summary || ''
    return checkRecommendationCoherence(
      recommendation.recommendation.headline,
      outcomeDescription,
      outcomeValue
    )
  }, [recommendation, results?.report?.insights?.summary, outcomeValue])

  // Log incoherence to console (would be Sentry in production)
  useEffect(() => {
    if (!coherenceCheck.isCoherent && coherenceCheck.contradiction) {
      console.warn('[RecommendationCard] Coherence issue detected:', {
        type: coherenceCheck.contradiction.type,
        description: coherenceCheck.contradiction.description,
        recommendation: coherenceCheck.contradiction.recommendationText,
        outcome: coherenceCheck.contradiction.outcomeText,
      })
      // In production, this would be: Sentry.captureMessage('Recommendation coherence issue', { extra: coherenceCheck.contradiction })
    }
  }, [coherenceCheck])

  // Task 1.3: Extract constraint violations from results (if present)
  const constraintData = useMemo(() => {
    const violations: ConstraintViolation[] = []
    const activeConstraints: ActiveConstraint[] = []

    // Check if results contain constraint information
    const reportData = results?.report as any

    // Look for excluded options due to constraints
    if (reportData?.excluded_options && Array.isArray(reportData.excluded_options)) {
      for (const excluded of reportData.excluded_options) {
        violations.push({
          option_id: excluded.option_id || excluded.id,
          option_label: excluded.option_label || excluded.label || 'Unknown option',
          constraint_label: excluded.constraint_label || excluded.reason || 'constraint',
          constraint_type: excluded.constraint_type || 'other',
          limit_value: excluded.limit_value,
          actual_value: excluded.actual_value,
          units: excluded.units,
        })
      }
    }

    // Look for binding constraints
    if (reportData?.binding_constraints && Array.isArray(reportData.binding_constraints)) {
      for (const binding of reportData.binding_constraints) {
        activeConstraints.push({
          label: binding.label || binding.name || 'Constraint',
          type: binding.type || 'other',
          current_value: binding.current_value ?? binding.value ?? 0,
          limit_value: binding.limit_value ?? binding.limit ?? 0,
          units: binding.units,
          relaxation_benefit: binding.relaxation_benefit || (
            `Relaxing this constraint may improve outcomes`
          ),
        })
      }
    }

    return { violations, activeConstraints }
  }, [results?.report])

  const hasConstraintIssues = constraintData.violations.length > 0 || constraintData.activeConstraints.length > 0

  // Loading state
  if (loading && !recommendation) {
    return (
      <div
        className="bg-paper-50 border border-sand-200 rounded-xl p-6"
        data-testid="recommendation-card-loading"
      >
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-sky-500 animate-spin" aria-hidden="true" />
          <span className={`${typography.body} text-ink-600`}>
            Generating recommendation...
          </span>
        </div>
      </div>
    )
  }

  // Error state with retry
  if (error && !recommendation) {
    return (
      <div
        className="bg-carrot-50 border border-carrot-200 rounded-xl p-4"
        data-testid="recommendation-card-error"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-carrot-600" aria-hidden="true" />
            <span className={`${typography.body} text-carrot-800`}>
              Could not generate recommendation
            </span>
          </div>
          <button
            type="button"
            onClick={() => fetchRecommendation()}
            className={`${typography.caption} flex items-center gap-1 px-3 py-1.5 rounded-lg text-carrot-700 hover:bg-carrot-100 transition-colors`}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  // No recommendation yet
  if (!recommendation) {
    return null
  }

  const { recommendation: rec, reasoning } = recommendation
  const confidenceLevel = rec.confidence || 'medium'
  const config = confidenceConfig[confidenceLevel]
  const ConfidenceIcon = config.icon

  return (
    <div
      className="bg-paper-50 border border-sand-200 rounded-xl overflow-hidden shadow-sm"
      data-testid="recommendation-card"
    >
      {/* Header */}
      <div className="px-4 py-4 border-b border-sand-100">
        {/* AI badge and help */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" aria-hidden="true" />
            <span className={`${typography.caption} font-medium text-violet-700 uppercase tracking-wide`}>
              Recommended Action
            </span>
          </div>
          <button
            type="button"
            className="p-1 rounded hover:bg-sand-100 transition-colors"
            aria-label="How we got here"
            title="How we got here"
          >
            <HelpCircle className="h-4 w-4 text-ink-400" />
          </button>
        </div>

        {/* Headline - cleaned to remove meaningless metrics */}
        <h3 className="text-xl font-bold text-ink-900 mb-3">
          {cleanInsightText(rec.headline) || rec.headline}
        </h3>

        {/* Confidence and Robustness indicators */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Confidence indicator */}
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${config.bgColor}`}>
            <span className={`${typography.caption} ${config.textColor}`}>Confidence:</span>
            <ConfidenceDots level={confidenceLevel} filled={config.dots} />
            <span className={`${typography.caption} font-medium ${config.textColor}`}>
              {config.label}
            </span>
          </div>

          {/* Task 3.1: Robustness indicator */}
          {conditionalData?.robustness_summary && (
            <RobustnessIndicator
              level={conditionalData.robustness_summary.level}
              switchingScenarios={conditionalData.robustness_summary.switching_scenarios}
              explanation={conditionalData.robustness_summary.explanation}
              compact
            />
          )}
        </div>

        {/* Summary - cleaned to remove meaningless metrics */}
        <p className={`${typography.body} text-ink-700 mt-3`}>
          {cleanInsightText(rec.summary) || rec.summary}
        </p>

        {/* Task 2+4: Compact outcome display - Success Likelihood + Range */}
        {outcomeData?.p50 != null && (
          <div className="mt-4 p-3 bg-sand-50 rounded-lg border border-sand-200">
            <div className="flex items-center justify-between">
              <div>
                <p className={`${typography.caption} text-ink-500`}>Success Likelihood</p>
                <p className={`${typography.h3} font-bold ${
                  outcomeData.p50 >= 60 ? 'text-mint-700' :
                  outcomeData.p50 >= 40 ? 'text-banana-700' : 'text-carrot-700'
                }`}>
                  {formatOutcomeValue(outcomeData.p50, outcomeData.units, outcomeData.unitSymbol)}
                </p>
              </div>
              {outcomeData.p10 != null && outcomeData.p90 != null && (
                <div className="text-right">
                  <p className={`${typography.caption} text-ink-500`}>70% Range</p>
                  <p className={`${typography.bodySmall} text-ink-700`}>
                    {formatRange(outcomeData.p10, outcomeData.p90, outcomeData.units, outcomeData.unitSymbol)}
                  </p>
                </div>
              )}
            </div>
            {/* Baseline comparison */}
            {outcomeData.baseline != null && outcomeData.p50 != null && (() => {
              const delta = outcomeData.p50 - outcomeData.baseline
              const isProbScale = outcomeData.p50 >= 0 && outcomeData.p50 <= 1
              const deltaPct = isProbScale ? delta * 100 : delta
              const isIncrease = delta > 0
              const isPositive = (outcomeData.goalDirection === 'maximize' && isIncrease) ||
                (outcomeData.goalDirection === 'minimize' && !isIncrease)
              if (Math.abs(deltaPct) < 0.5) return null
              return (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-sand-200">
                  {isIncrease ? (
                    <TrendingUp className={`h-4 w-4 ${isPositive ? 'text-mint-600' : 'text-carrot-600'}`} />
                  ) : (
                    <TrendingDown className={`h-4 w-4 ${isPositive ? 'text-mint-600' : 'text-carrot-600'}`} />
                  )}
                  <span className={`${typography.caption} ${isPositive ? 'text-mint-700' : 'text-carrot-700'}`}>
                    {isIncrease ? '+' : ''}{Math.round(deltaPct)}% vs baseline
                  </span>
                </div>
              )
            })()}
          </div>
        )}

        {/* Task 1.6: Coherence warning banner */}
        {!coherenceCheck.isCoherent && coherenceCheck.contradiction && (
          <div
            className="mt-3 p-3 bg-banana-50 border border-banana-200 rounded-lg"
            data-testid="coherence-warning"
            role="alert"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-banana-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div>
                <p className={`${typography.bodySmall} font-medium text-banana-800`}>
                  {getCoherenceWarningMessage(coherenceCheck.contradiction.type)}
                </p>
                <p className={`${typography.caption} text-banana-700 mt-1`}>
                  {coherenceCheck.contradiction.description}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Expandable Sections - Task 5: Hide sections when empty (no placeholder text) */}
      <div className="divide-y divide-sand-100">
        {/* Why this option - only show if drivers exist */}
        {driverCount > 0 && (
          <ExpandableSection
            title="Why this option"
            badgeCount={driverCount}
            testId="section-drivers"
          >
            <DriversSection
              drivers={reasoning.primary_drivers}
              onDriverClick={handleDriverClick}
            />
          </ExpandableSection>
        )}

        {/* What you're trading off - only show if tradeoffs exist */}
        {tradeoffCount > 0 && (
          <ExpandableSection
            title="What you're trading off"
            badgeCount={tradeoffCount}
            badgeVariant="warning"
            testId="section-tradeoffs"
          >
            <TradeoffsSection
              tradeoffs={reasoning.key_tradeoffs}
              onTradeoffClick={(edgeId) => onDriverClick?.(edgeId)}
            />
          </ExpandableSection>
        )}

        {/* Assumptions to validate - only show if assumptions exist */}
        {assumptionCount > 0 && (
          <ExpandableSection
            title="Assumptions to validate"
            badgeCount={criticalAssumptions > 0 ? criticalAssumptions : assumptionCount}
            badgeVariant={criticalAssumptions > 0 ? 'critical' : 'default'}
            testId="section-assumptions"
          >
            <AssumptionsSection
              assumptions={reasoning.assumptions}
              onAssumptionClick={handleAssumptionClick}
            />
          </ExpandableSection>
        )}

        {/* Task 1.3: Constraint violations and binding constraints */}
        {hasConstraintIssues && (
          <ExpandableSection
            title="Constraint impacts"
            badgeCount={constraintData.violations.length}
            badgeVariant={constraintData.violations.length > 0 ? 'warning' : 'default'}
            testId="section-constraints"
          >
            <ConstraintViolationsSection
              violations={constraintData.violations}
              activeConstraints={constraintData.activeConstraints}
            />
          </ExpandableSection>
        )}

        {/* When to reconsider - Conditional Guidance (Deliverable 2) */}
        <ExpandableSection
          title="When to reconsider"
          testId="section-reconsider"
        >
          <ConditionalGuidance
            runId={runId}
            responseHash={responseHash}
            autoFetch={true}
            maxConditions={5}
            onConditionClick={(edgeId, nodeId) => {
              if (nodeId) {
                setHighlightedNodes([nodeId])
                setTimeout(() => setHighlightedNodes([]), 3000)
              }
              onDriverClick?.(edgeId || '', nodeId)
            }}
            compact={true}
          />
        </ExpandableSection>
      </div>

      {/* Action buttons - Compare CTA moved to DecisionSummary for unification */}
      {assumptionCount > 0 && onValidateClick && (
        <div className="px-4 py-3 border-t border-sand-100">
          <button
            type="button"
            onClick={onValidateClick}
            className={`${typography.bodySmall} w-full px-4 py-2.5 rounded-lg font-medium border border-sky-300 text-sky-700 hover:bg-sky-50 transition-colors`}
          >
            Validate Assumptions
          </button>
        </div>
      )}

      {/* Loading overlay for refresh */}
      {loading && recommendation && (
        <div className="absolute inset-0 bg-paper-50/80 flex items-center justify-center">
          <Loader2 className="h-6 w-6 text-sky-500 animate-spin" />
        </div>
      )}
    </div>
  )
}

// Re-export types
export * from './types'
