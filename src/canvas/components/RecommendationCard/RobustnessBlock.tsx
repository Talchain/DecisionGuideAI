/**
 * RobustnessBlock - Unified robustness display
 *
 * Brief 10: Consolidates sensitivity, robustness bounds, and VoI
 * into a single cohesive block within the Recommendation Card.
 *
 * Features:
 * - Task 1: Single unified block structure
 * - Task 2: Robustness label display (robust/moderate/fragile)
 * - Task 3: Top 2-3 sensitive parameters with flip thresholds
 * - Task 4: Value of Information suggestions (EVPI > threshold)
 * - Task 5: Progressive disclosure (expandable details)
 * - Task 7: ISL narrative integration
 * - Task 8: Responsive behaviour for different scenarios
 * - Task 9: Loading states
 */

import { useState, useMemo, memo } from 'react'
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  Search,
  Loader2,
  Info,
  Scale,
} from 'lucide-react'
import { typography } from '../../../styles/typography'
import { Tooltip } from '../Tooltip'
import { ParetoMiniChart } from './ParetoMiniChart'
import { useStoredRiskProfile } from '../RiskTolerancePanel'
import type {
  RobustnessBlockProps,
  RobustnessLabel,
  SensitiveParameter,
  ValueOfInformation,
} from './types'
import type { RiskProfilePreset } from '../../../adapters/plot/types'

// ============================================================================
// Task 2: Robustness Label Configuration
// ============================================================================

/** Risk profile icons and labels */
const riskProfileConfig: Record<RiskProfilePreset, {
  icon: typeof Shield
  label: string
  robustnessAdvice: (label: RobustnessLabel) => string
}> = {
  risk_averse: {
    icon: Shield,
    label: 'Conservative',
    robustnessAdvice: (label) => {
      if (label === 'fragile') return 'High sensitivity detected — consider waiting for more data before deciding'
      if (label === 'moderate') return 'Some uncertainty remains — review key sensitivities before committing'
      return 'Good robustness — recommendation aligns with conservative approach'
    },
  },
  neutral: {
    icon: Scale,
    label: 'Balanced',
    robustnessAdvice: (label) => {
      if (label === 'fragile') return 'High sensitivity — consider the trade-offs carefully'
      if (label === 'moderate') return 'Moderate certainty — acceptable for balanced decision-making'
      return 'Strong robustness — high confidence in recommendation'
    },
  },
  risk_seeking: {
    icon: TrendingUp,
    label: 'Aggressive',
    robustnessAdvice: (label) => {
      if (label === 'fragile') return 'High upside potential but significant downside risk'
      if (label === 'moderate') return 'Good risk-reward balance with some sensitivity'
      return 'Solid foundation — can pursue aggressive strategies'
    },
  },
}

const robustnessConfig: Record<RobustnessLabel, {
  icon: typeof Shield
  bgColor: string
  textColor: string
  iconColor: string
  borderColor: string
  label: string
  description: string
  meterFill: number
}> = {
  robust: {
    icon: ShieldCheck,
    bgColor: 'bg-mint-50',
    textColor: 'text-mint-700',
    iconColor: 'text-mint-600',
    borderColor: 'border-mint-200',
    label: 'Robust',
    description: 'Recommendation is stable across plausible parameter variations',
    meterFill: 5,
  },
  moderate: {
    icon: Shield,
    bgColor: 'bg-banana-50',
    textColor: 'text-banana-700',
    iconColor: 'text-banana-600',
    borderColor: 'border-banana-200',
    label: 'Moderate',
    description: 'Some parameters could change the recommendation if varied significantly',
    meterFill: 3,
  },
  fragile: {
    icon: ShieldAlert,
    bgColor: 'bg-carrot-50',
    textColor: 'text-carrot-700',
    iconColor: 'text-carrot-600',
    borderColor: 'border-carrot-200',
    label: 'Fragile',
    description: 'Recommendation is sensitive to small changes in key parameters',
    meterFill: 1,
  },
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Robustness meter visualization (5 segments)
 */
function RobustnessMeter({ label }: { label: RobustnessLabel }) {
  const config = robustnessConfig[label]
  const filledSegments = config.meterFill

  return (
    <div className="flex items-center gap-0.5" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`w-1.5 h-3 rounded-sm transition-colors ${
            i < filledSegments
              ? label === 'robust'
                ? 'bg-mint-500'
                : label === 'moderate'
                  ? 'bg-banana-500'
                  : 'bg-carrot-500'
              : 'bg-sand-200'
          }`}
        />
      ))}
    </div>
  )
}

/**
 * Task 3: Sensitive parameter row
 */
function SensitiveParameterRow({
  param,
  onClick,
}: {
  param: SensitiveParameter
  onClick?: (nodeId: string) => void
}) {
  const isIncrease = param.direction === 'increase'
  const Icon = isIncrease ? TrendingUp : TrendingDown
  const threshold = Math.round(param.flip_threshold * 100)
  const current = Math.round(param.current_value * 100)
  const gap = Math.abs(threshold - current)

  // Determine urgency based on how close to flip threshold
  const isUrgent = gap < 10

  return (
    <button
      type="button"
      onClick={() => onClick?.(param.node_id)}
      className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
        isUrgent
          ? 'bg-carrot-50 border-carrot-200 hover:bg-carrot-100'
          : 'bg-sand-50 border-sand-200 hover:bg-sand-100'
      }`}
      data-testid={`sensitive-param-${param.node_id}`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Icon
            className={`h-3.5 w-3.5 ${isUrgent ? 'text-carrot-600' : 'text-ink-500'}`}
            aria-hidden="true"
          />
          <span className={`${typography.bodySmall} font-medium text-ink-800`}>
            {param.label}
          </span>
        </div>
        <span
          className={`${typography.caption} ${
            isUrgent ? 'text-carrot-700 font-medium' : 'text-ink-500'
          }`}
        >
          {gap}% from flip
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`${typography.caption} text-ink-600`}>
          Current: {current}%
        </span>
        <span className={`${typography.caption} text-ink-400`}>→</span>
        <span
          className={`${typography.caption} ${
            isUrgent ? 'text-carrot-700' : 'text-ink-600'
          }`}
        >
          Flips at: {threshold}%
        </span>
      </div>
      {param.explanation && (
        <p className={`${typography.caption} text-ink-500 mt-1`}>
          {param.explanation}
        </p>
      )}
    </button>
  )
}

/**
 * Task 4: Value of Information row
 */
function VoiRow({
  voi,
  onClick,
}: {
  voi: ValueOfInformation
  onClick?: (nodeId: string, action: string) => void
}) {
  const evpiDisplay = voi.evpi < 1
    ? `${(voi.evpi * 100).toFixed(0)}%`
    : `$${voi.evpi.toLocaleString()}`

  const confidenceColor = voi.confidence === 'high'
    ? 'text-mint-600'
    : voi.confidence === 'medium'
      ? 'text-banana-600'
      : 'text-ink-500'

  return (
    <button
      type="button"
      onClick={() => onClick?.(voi.node_id, voi.suggested_action || 'investigate')}
      className="w-full text-left p-2.5 rounded-lg bg-violet-50 border border-violet-200 hover:bg-violet-100 transition-colors"
      data-testid={`voi-${voi.node_id}`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5 text-violet-600" aria-hidden="true" />
          <span className={`${typography.bodySmall} font-medium text-ink-800`}>
            {voi.label}
          </span>
        </div>
        <span className={`${typography.caption} font-medium text-violet-700`}>
          EVPI: {evpiDisplay}
        </span>
      </div>
      {voi.suggested_action && (
        <p className={`${typography.caption} text-violet-700 mb-1`}>
          {voi.suggested_action}
        </p>
      )}
      <div className="flex items-center gap-2">
        {voi.resolution_cost != null && (
          <span className={`${typography.caption} text-ink-500`}>
            Est. cost: ${voi.resolution_cost.toLocaleString()}
          </span>
        )}
        {voi.confidence && (
          <span className={`${typography.caption} ${confidenceColor}`}>
            ({voi.confidence} confidence)
          </span>
        )}
      </div>
    </button>
  )
}

/**
 * Skeleton loader for robustness block
 */
function RobustnessBlockSkeleton() {
  return (
    <div
      className="p-4 bg-sand-50 border border-sand-200 rounded-lg animate-pulse"
      data-testid="robustness-block-loading"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-5 h-5 bg-sand-200 rounded" />
        <div className="w-32 h-4 bg-sand-200 rounded" />
        <div className="flex gap-0.5 ml-auto">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-1.5 h-3 bg-sand-200 rounded-sm" />
          ))}
        </div>
      </div>
      <div className="w-full h-10 bg-sand-200 rounded" />
      <div className="mt-3 space-y-2">
        <div className="w-3/4 h-3 bg-sand-200 rounded" />
        <div className="w-1/2 h-3 bg-sand-200 rounded" />
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export const RobustnessBlock = memo(function RobustnessBlock({
  robustness,
  loading = false,
  error = null,
  onParameterClick,
  onVoiActionClick,
  onParetoOptionClick,
  defaultExpanded = false,
  compact = false,
}: RobustnessBlockProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  // Task 10: Get user's risk profile for personalized advice
  const riskProfile = useStoredRiskProfile()

  // Task 3: Filter to top 2-3 sensitive parameters
  const topSensitiveParams = useMemo(() => {
    if (!robustness?.sensitivity) return []
    return robustness.sensitivity
      .sort((a, b) => b.sensitivity - a.sensitivity)
      .slice(0, 3)
  }, [robustness?.sensitivity])

  // Task 4: Filter to worth-investigating VoI items
  const worthInvestigatingVoi = useMemo(() => {
    if (!robustness?.value_of_information) return []
    return robustness.value_of_information.filter((v) => v.worth_investigating)
  }, [robustness?.value_of_information])

  // Task 8: Determine display mode based on data availability
  const displayMode = useMemo(() => {
    if (!robustness) return 'empty'
    if (robustness.pareto && robustness.pareto.frontier.length > 1) return 'multi-goal'
    if (topSensitiveParams.length === 0 && worthInvestigatingVoi.length === 0) return 'minimal'
    return 'standard'
  }, [robustness, topSensitiveParams, worthInvestigatingVoi])

  // Task 9: Loading state
  if (loading) {
    return <RobustnessBlockSkeleton />
  }

  // Error state
  if (error) {
    return (
      <div
        className="p-3 bg-carrot-50 border border-carrot-200 rounded-lg"
        data-testid="robustness-block-error"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-carrot-600" />
          <span className={`${typography.bodySmall} text-carrot-800`}>
            Could not load robustness analysis
          </span>
        </div>
      </div>
    )
  }

  // Empty state
  if (!robustness || displayMode === 'empty') {
    return null
  }

  const config = robustnessConfig[robustness.robustness_label]
  const Icon = config.icon

  // Compact mode: just badge
  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${config.bgColor} ${config.borderColor} border`}
        data-testid="robustness-block-compact"
        title={config.description}
      >
        <Icon className={`h-4 w-4 ${config.iconColor}`} aria-hidden="true" />
        <span className={`${typography.caption} ${config.textColor}`}>
          Robustness:
        </span>
        <RobustnessMeter label={robustness.robustness_label} />
        <span className={`${typography.caption} font-medium ${config.textColor}`}>
          {config.label}
        </span>
      </div>
    )
  }

  return (
    <div
      className={`rounded-lg overflow-hidden border ${config.borderColor}`}
      data-testid="robustness-block"
    >
      {/* Header - Task 2: Robustness Label */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full px-4 py-3 flex items-center justify-between ${config.bgColor} hover:opacity-90 transition-opacity`}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-ink-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-ink-500" />
          )}
          <Icon className={`h-4 w-4 ${config.iconColor}`} aria-hidden="true" />
          <span className={`${typography.body} font-medium ${config.textColor}`}>
            Robustness: {config.label}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <RobustnessMeter label={robustness.robustness_label} />
          <Tooltip content={config.description} position="left">
            <Info className={`h-3.5 w-3.5 ${config.iconColor}`} aria-hidden="true" />
          </Tooltip>
        </div>
      </button>

      {/* Task 5: Expanded content - Progressive disclosure */}
      {isExpanded && (
        <div className="bg-paper-50 divide-y divide-sand-100">
          {/* Task 7: Narrative summary */}
          {robustness.narrative && (
            <div className="px-4 py-3">
              <p className={`${typography.bodySmall} text-ink-700`}>
                {robustness.narrative}
              </p>
            </div>
          )}

          {/* Task 10: Risk-adjusted advice based on user's profile */}
          {riskProfile && (
            <div className="px-4 py-3" data-testid="risk-adjusted-advice">
              <div className="flex items-center gap-2 mb-2">
                {(() => {
                  const profileConfig = riskProfileConfig[riskProfile.profile]
                  const ProfileIcon = profileConfig.icon
                  return (
                    <>
                      <ProfileIcon className="h-4 w-4 text-sky-600" aria-hidden="true" />
                      <span className={`${typography.label} text-ink-700`}>
                        For Your {profileConfig.label} Profile
                      </span>
                    </>
                  )
                })()}
              </div>
              <p className={`${typography.caption} text-sky-700 bg-sky-50 px-3 py-2 rounded-lg border border-sky-200`}>
                {riskProfileConfig[riskProfile.profile].robustnessAdvice(robustness.robustness_label)}
              </p>
            </div>
          )}

          {/* Task 3: Sensitive parameters */}
          {topSensitiveParams.length > 0 && (
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-banana-600" aria-hidden="true" />
                <span className={`${typography.label} text-ink-700`}>
                  Key Sensitivities
                </span>
                <span className={`${typography.caption} text-ink-500`}>
                  ({topSensitiveParams.length})
                </span>
              </div>
              <div className="space-y-2">
                {topSensitiveParams.map((param) => (
                  <SensitiveParameterRow
                    key={param.node_id}
                    param={param}
                    onClick={onParameterClick}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Task 4: Value of Information */}
          {worthInvestigatingVoi.length > 0 && (
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-violet-600" aria-hidden="true" />
                <span className={`${typography.label} text-ink-700`}>
                  Worth Investigating
                </span>
                <span className={`${typography.caption} text-violet-600`}>
                  High value of information
                </span>
              </div>
              <div className="space-y-2">
                {worthInvestigatingVoi.map((voi) => (
                  <VoiRow
                    key={voi.node_id}
                    voi={voi}
                    onClick={onVoiActionClick}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Task 6: Pareto analysis visualization (if multi-goal) */}
          {displayMode === 'multi-goal' && robustness.pareto && (
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Scale className="h-4 w-4 text-teal-600" aria-hidden="true" />
                <span className={`${typography.label} text-ink-700`}>
                  Multi-Goal Trade-offs
                </span>
                <span className={`${typography.caption} px-2 py-0.5 rounded-full bg-teal-100 text-teal-700`}>
                  {robustness.pareto.frontier.length} optimal options
                </span>
              </div>
              {robustness.pareto.tradeoff_narrative && (
                <p className={`${typography.caption} text-ink-600 mb-2`}>
                  {robustness.pareto.tradeoff_narrative}
                </p>
              )}
              {/* Brief 10.6: Pareto mini chart */}
              <ParetoMiniChart
                pareto={robustness.pareto}
                onOptionClick={onParetoOptionClick}
              />
            </div>
          )}

          {/* Minimal mode: just recommendation status */}
          {displayMode === 'minimal' && (
            <div className="px-4 py-3">
              <p className={`${typography.caption} text-ink-500`}>
                {robustness.recommendation.recommendation_status === 'clear'
                  ? 'Clear winner - no significant sensitivities detected'
                  : robustness.recommendation.recommendation_status === 'close_call'
                    ? 'Close call between top options'
                    : 'Consider gathering more data before deciding'}
              </p>
            </div>
          )}

          {/* Footer: confidence context */}
          <div className="px-4 py-2 bg-sand-50">
            <span className={`${typography.caption} text-ink-500`}>
              Status: {
                robustness.recommendation.recommendation_status === 'clear'
                  ? 'Clear recommendation'
                  : robustness.recommendation.recommendation_status === 'close_call'
                    ? 'Close call — consider sensitivities'
                    : 'Uncertain — more data needed'
              }
            </span>
          </div>
        </div>
      )}
    </div>
  )
})

export default RobustnessBlock
