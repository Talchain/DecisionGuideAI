/**
 * ConditionalGuidance - When to reconsider display
 *
 * Shows conditions under which the recommendation might change.
 * Helps users understand the robustness of the analysis.
 *
 * Features:
 * - Robustness indicator (high/medium/low)
 * - Individual condition cards with if/then/likelihood
 * - Monitoring guidance where available
 * - Links to relevant graph elements
 */

import { useState } from 'react'
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Eye,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Zap,
} from 'lucide-react'
import { useConditionalRecommendations } from '../../hooks/useConditionalRecommendations'
import { typography } from '../../../styles/typography'
import type { ConditionalGuidanceProps, NarratedCondition } from './types'

// Robustness level configuration
const robustnessConfig = {
  high: {
    icon: ShieldCheck,
    bgColor: 'bg-mint-50',
    borderColor: 'border-mint-200',
    textColor: 'text-mint-700',
    iconColor: 'text-mint-600',
    label: 'Highly Robust',
  },
  medium: {
    icon: Shield,
    bgColor: 'bg-banana-50',
    borderColor: 'border-banana-200',
    textColor: 'text-banana-700',
    iconColor: 'text-banana-600',
    label: 'Moderately Robust',
  },
  low: {
    icon: ShieldAlert,
    bgColor: 'bg-carrot-50',
    borderColor: 'border-carrot-200',
    textColor: 'text-carrot-700',
    iconColor: 'text-carrot-600',
    label: 'Sensitive to Assumptions',
  },
}

// Impact level configuration
const impactConfig = {
  high: {
    bgColor: 'bg-carrot-100',
    textColor: 'text-carrot-700',
    label: 'High impact',
  },
  medium: {
    bgColor: 'bg-banana-100',
    textColor: 'text-banana-700',
    label: 'Medium impact',
  },
  low: {
    bgColor: 'bg-sky-100',
    textColor: 'text-sky-700',
    label: 'Low impact',
  },
}

export function ConditionalGuidance({
  runId,
  responseHash,
  autoFetch = true,
  maxConditions = 5,
  onConditionClick,
  compact = false,
}: ConditionalGuidanceProps) {
  const [showAll, setShowAll] = useState(false)

  const {
    conditions,
    narratedConditions,
    loading,
    error,
    fetch: fetchConditions,
  } = useConditionalRecommendations({
    runId,
    responseHash,
    autoFetch,
    maxConditions,
  })

  // Loading state
  if (loading && !narratedConditions) {
    return (
      <div className="flex items-center gap-2 p-3 bg-sand-50 rounded-lg">
        <Loader2 className="h-4 w-4 text-sand-500 animate-spin" aria-hidden="true" />
        <span className={`${typography.caption} text-sand-600`}>
          Analyzing conditions...
        </span>
      </div>
    )
  }

  // Error state with retry
  if (error && !narratedConditions) {
    return (
      <div className="flex items-center justify-between p-3 bg-carrot-50 border border-carrot-200 rounded-lg">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-carrot-600" aria-hidden="true" />
          <span className={`${typography.caption} text-carrot-700`}>
            Could not load conditions
          </span>
        </div>
        <button
          type="button"
          onClick={() => fetchConditions()}
          className={`${typography.caption} flex items-center gap-1 px-2 py-1 rounded text-carrot-600 hover:bg-carrot-100 transition-colors`}
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      </div>
    )
  }

  // No data yet - show placeholder
  if (!narratedConditions || !conditions) {
    return (
      <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg">
        <div className="flex items-start gap-2">
          <Shield className="h-4 w-4 text-sky-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className={`${typography.caption} text-sky-700`}>
            Conditional guidance will be available after analysis. This helps you understand when the recommendation might change.
          </p>
        </div>
      </div>
    )
  }

  const robustnessLevel = conditions.robustness_summary.level
  const robustness = robustnessConfig[robustnessLevel]
  const RobustnessIcon = robustness.icon

  const allConditions = narratedConditions.conditions
  const visibleConditions = showAll ? allConditions : allConditions.slice(0, 2)
  const hasMore = allConditions.length > 2

  return (
    <div className="space-y-3" data-testid="conditional-guidance">
      {/* Robustness summary */}
      <div className={`flex items-start gap-3 p-3 rounded-lg ${robustness.bgColor} border ${robustness.borderColor}`}>
        <RobustnessIcon
          className={`h-5 w-5 ${robustness.iconColor} flex-shrink-0 mt-0.5`}
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`${typography.bodySmall} font-semibold ${robustness.textColor}`}>
              {robustness.label}
            </span>
          </div>
          <p className={`${typography.caption} ${robustness.textColor}`}>
            {narratedConditions.robustness_statement}
          </p>
        </div>
      </div>

      {/* Conditions list */}
      {allConditions.length > 0 && (
        <div className="space-y-2">
          <p className={`${typography.caption} text-ink-500 flex items-center gap-1.5`}>
            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
            This recommendation could change if:
          </p>

          {visibleConditions.map((condition, index) => (
            <ConditionCard
              key={index}
              condition={condition}
              index={index + 1}
              onConditionClick={onConditionClick}
              compact={compact}
            />
          ))}

          {/* Show more/less toggle */}
          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className={`${typography.caption} w-full flex items-center justify-center gap-1 py-2 text-sky-600 hover:text-sky-700 transition-colors`}
            >
              {showAll ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Show {allConditions.length - 2} more condition{allConditions.length - 2 > 1 ? 's' : ''}
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* No conditions message */}
      {allConditions.length === 0 && (
        <div className="p-3 bg-mint-50 border border-mint-200 rounded-lg">
          <div className="flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-mint-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className={`${typography.caption} text-mint-700`}>
              No significant conditions identified. The recommendation appears stable across the analyzed scenarios.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Individual condition card
 */
interface ConditionCardInternalProps {
  condition: NarratedCondition
  index: number
  onConditionClick?: (edgeId?: string, nodeId?: string) => void
  compact?: boolean
}

function ConditionCard({
  condition,
  index,
  onConditionClick,
  compact = false,
}: ConditionCardInternalProps) {
  const impact = impactConfig[condition.impact]

  return (
    <div
      className="p-3 bg-paper-50 border border-sand-200 rounded-lg"
      data-testid={`condition-card-${index}`}
    >
      <div className="flex items-start gap-3">
        {/* Index number */}
        <span className={`${typography.caption} font-bold text-ink-400 flex-shrink-0 mt-0.5`}>
          {index}.
        </span>

        <div className="flex-1 min-w-0 space-y-2">
          {/* If statement */}
          <p className={`${typography.bodySmall} text-ink-800`}>
            <span className="font-medium">{condition.if_statement}</span>
          </p>

          {/* Then statement */}
          <p className={`${typography.caption} text-ink-600`}>
            → {condition.then_statement}
          </p>

          {/* Because statement (if not compact) */}
          {!compact && condition.because_statement && (
            <p className={`${typography.caption} text-ink-500 italic`}>
              {condition.because_statement}
            </p>
          )}

          {/* Metadata row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Likelihood */}
            {condition.likelihood && (
              <span className={`${typography.caption} text-ink-500`}>
                ⚠️ {condition.likelihood}
              </span>
            )}

            {/* Impact badge */}
            <span className={`${typography.caption} px-1.5 py-0.5 rounded ${impact.bgColor} ${impact.textColor}`}>
              {impact.label}
            </span>
          </div>

          {/* Monitoring guidance */}
          {condition.how_to_monitor && (
            <div className="flex items-start gap-2 mt-2 p-2 bg-sky-50 rounded">
              <Eye className="h-3.5 w-3.5 text-sky-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span className={`${typography.caption} text-sky-700`}>
                Monitor: {condition.how_to_monitor}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Re-export types
export * from './types'
