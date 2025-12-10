/**
 * ParetoInsights - CEE-enhanced insights for Pareto frontier
 *
 * Provides AI-generated explanations for Pareto analysis:
 * - Why certain options are on the frontier
 * - Trade-off explanations between frontier options
 * - Suggestions based on user's risk tolerance
 * - Recommendations for the "best fit" option
 *
 * Features:
 * - Collapsible panel with key insights
 * - Provenance badges for AI suggestions
 * - Click to focus on specific options
 * - Risk-adjusted recommendations
 */

import { memo, useState, useMemo, useCallback } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Sparkles,
  Scale,
  TrendingUp,
  Shield,
  Zap,
  Target,
  ArrowRight,
} from 'lucide-react'
import { typography } from '../../styles/typography'
import { ProvenanceBadge } from './ProvenanceBadge'
import { useStoredRiskProfile } from './RiskTolerancePanel'
import type { RiskProfilePreset } from '../../adapters/plot/types'

interface ParetoOption {
  id: string
  label: string
  scores: Record<string, number>
}

interface ParetoInsightsProps {
  /** Options with their scores */
  options: ParetoOption[]
  /** Criteria names */
  criteria: string[]
  /** IDs of frontier options */
  frontier: string[]
  /** IDs of dominated options */
  dominated: string[]
  /** Dominance pairs */
  dominancePairs: Array<{ dominator: string; dominated: string }>
  /** Callback when option is clicked */
  onOptionClick?: (optionId: string) => void
  /** Start expanded */
  defaultExpanded?: boolean
}

// Risk profile styling
const riskStyles: Record<RiskProfilePreset, {
  icon: typeof Shield
  label: string
  recommendation: string
}> = {
  risk_averse: {
    icon: Shield,
    label: 'Conservative choice',
    recommendation: 'Focus on the option with the best worst-case outcome',
  },
  neutral: {
    icon: Scale,
    label: 'Balanced choice',
    recommendation: 'Consider the option with the best expected value across criteria',
  },
  risk_seeking: {
    icon: Zap,
    label: 'Aggressive choice',
    recommendation: 'Focus on the option with the highest upside potential',
  },
}

export const ParetoInsights = memo(function ParetoInsights({
  options,
  criteria,
  frontier,
  dominated,
  dominancePairs,
  onOptionClick,
  defaultExpanded = false,
}: ParetoInsightsProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const riskProfile = useStoredRiskProfile()

  // Get frontier options with full data
  const frontierOptions = useMemo(() => {
    return frontier
      .map((id) => options.find((o) => o.id === id))
      .filter((o): o is ParetoOption => o !== undefined)
  }, [frontier, options])

  // Calculate best option per risk profile
  const riskAdjustedPick = useMemo(() => {
    if (frontierOptions.length === 0) return null

    const profile = riskProfile?.profile || 'neutral'

    // For each frontier option, calculate a composite score
    const scored = frontierOptions.map((opt) => {
      const scores = Object.values(opt.scores)
      const minScore = Math.min(...scores)
      const maxScore = Math.max(...scores)
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length

      // Weight by risk profile
      let composite: number
      if (profile === 'risk_averse') {
        // Emphasize worst-case (min score)
        composite = minScore * 0.6 + avgScore * 0.3 + maxScore * 0.1
      } else if (profile === 'risk_seeking') {
        // Emphasize best-case (max score)
        composite = minScore * 0.1 + avgScore * 0.3 + maxScore * 0.6
      } else {
        // Balanced
        composite = minScore * 0.25 + avgScore * 0.5 + maxScore * 0.25
      }

      return { ...opt, composite }
    })

    // Sort by composite score descending
    scored.sort((a, b) => b.composite - a.composite)

    return scored[0] || null
  }, [frontierOptions, riskProfile])

  // Generate trade-off explanation between top 2 frontier options
  const tradeOffExplanation = useMemo(() => {
    if (frontierOptions.length < 2) return null

    const opt1 = frontierOptions[0]
    const opt2 = frontierOptions[1]

    const differences: Array<{
      criterion: string
      winner: string
      winnerLabel: string
      margin: number
    }> = []

    for (const criterion of criteria) {
      const score1 = opt1.scores[criterion] ?? 0
      const score2 = opt2.scores[criterion] ?? 0
      if (Math.abs(score1 - score2) > 0.05) {
        differences.push({
          criterion,
          winner: score1 > score2 ? opt1.id : opt2.id,
          winnerLabel: score1 > score2 ? opt1.label : opt2.label,
          margin: Math.abs(score1 - score2),
        })
      }
    }

    return {
      option1: opt1,
      option2: opt2,
      differences,
    }
  }, [frontierOptions, criteria])

  // Generate "why dominated" explanation for top dominated option
  const dominationExplanation = useMemo(() => {
    if (dominated.length === 0 || dominancePairs.length === 0) return null

    const topDominatedId = dominated[0]
    const topDominated = options.find((o) => o.id === topDominatedId)
    if (!topDominated) return null

    const dominators = dominancePairs
      .filter((p) => p.dominated === topDominatedId)
      .map((p) => options.find((o) => o.id === p.dominator))
      .filter((o): o is ParetoOption => o !== undefined)

    if (dominators.length === 0) return null

    // Find which criteria the dominator wins on
    const dominator = dominators[0]
    const winsOn = criteria.filter((c) => {
      const domScore = dominator.scores[c] ?? 0
      const subScore = topDominated.scores[c] ?? 0
      return domScore > subScore
    })

    return {
      dominated: topDominated,
      dominator,
      winsOn,
    }
  }, [dominated, dominancePairs, options, criteria])

  // Handle option click
  const handleOptionClick = useCallback(
    (optionId: string) => {
      onOptionClick?.(optionId)
    },
    [onOptionClick]
  )

  // Don't render if not enough data
  if (frontier.length === 0) {
    return null
  }

  const profileStyle = riskStyles[riskProfile?.profile || 'neutral']
  const ProfileIcon = profileStyle.icon

  return (
    <div
      className="bg-paper-50 border border-sand-200 rounded-xl overflow-hidden"
      data-testid="pareto-insights"
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-sand-50 transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-ink-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-ink-500" />
          )}
          <Sparkles className="h-4 w-4 text-violet-500" aria-hidden="true" />
          <span className={`${typography.body} font-medium text-ink-800`}>
            Pareto Insights
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`${typography.caption} px-2 py-0.5 rounded-full bg-teal-100 text-teal-700`}>
            {frontier.length} optimal
          </span>
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-sand-200 divide-y divide-sand-100">
          {/* Risk-adjusted recommendation */}
          {riskAdjustedPick && (
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <ProfileIcon className="h-4 w-4 text-sky-600" aria-hidden="true" />
                <span className={`${typography.label} text-ink-700`}>
                  {profileStyle.label}
                </span>
                <ProvenanceBadge type="inferred" compact />
              </div>

              <button
                type="button"
                onClick={() => handleOptionClick(riskAdjustedPick.id)}
                className="w-full text-left p-3 rounded-lg bg-sky-50 border border-sky-200 hover:bg-sky-100 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Target className="h-4 w-4 text-sky-600" aria-hidden="true" />
                  <span className={`${typography.body} font-medium text-sky-800`}>
                    {riskAdjustedPick.label}
                  </span>
                </div>
                <p className={`${typography.caption} text-sky-600`}>
                  {profileStyle.recommendation}
                </p>
              </button>
            </div>
          )}

          {/* Trade-off explanation */}
          {tradeOffExplanation && tradeOffExplanation.differences.length > 0 && (
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Scale className="h-4 w-4 text-banana-600" aria-hidden="true" />
                <span className={`${typography.label} text-ink-700`}>
                  Key trade-off
                </span>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => handleOptionClick(tradeOffExplanation.option1.id)}
                  className={`${typography.caption} px-2 py-1 rounded bg-teal-100 text-teal-700 hover:bg-teal-200 transition-colors`}
                >
                  {tradeOffExplanation.option1.label}
                </button>
                <span className={`${typography.caption} text-ink-500`}>vs</span>
                <button
                  type="button"
                  onClick={() => handleOptionClick(tradeOffExplanation.option2.id)}
                  className={`${typography.caption} px-2 py-1 rounded bg-teal-100 text-teal-700 hover:bg-teal-200 transition-colors`}
                >
                  {tradeOffExplanation.option2.label}
                </button>
              </div>

              <ul className="space-y-1">
                {tradeOffExplanation.differences.slice(0, 3).map((diff) => (
                  <li
                    key={diff.criterion}
                    className={`${typography.caption} text-ink-600 flex items-center gap-1`}
                  >
                    <TrendingUp className="h-3 w-3 text-mint-500" aria-hidden="true" />
                    <span className="font-medium">{diff.winnerLabel}</span>
                    <span>wins on</span>
                    <span className="font-medium">{diff.criterion}</span>
                    <span className="text-ink-400">
                      (+{(diff.margin * 100).toFixed(0)}%)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Domination explanation */}
          {dominationExplanation && (
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <ArrowRight className="h-4 w-4 text-carrot-500" aria-hidden="true" />
                <span className={`${typography.label} text-ink-700`}>
                  Why "{dominationExplanation.dominated.label}" is dominated
                </span>
              </div>

              <p className={`${typography.caption} text-ink-600`}>
                <button
                  type="button"
                  onClick={() => handleOptionClick(dominationExplanation.dominator.id)}
                  className="font-medium text-teal-700 hover:underline"
                >
                  {dominationExplanation.dominator.label}
                </button>
                {' outperforms on '}
                <span className="font-medium">
                  {dominationExplanation.winsOn.join(', ')}
                </span>
                {' without being worse on any other criterion.'}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-2 bg-sand-50">
            <span className={`${typography.caption} text-ink-500`}>
              Pareto frontier: options where improving one criterion means sacrificing another
            </span>
          </div>
        </div>
      )}
    </div>
  )
})
