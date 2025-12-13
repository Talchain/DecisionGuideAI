/**
 * MultiGoalParetoPanel - Unified multi-goal trade-off visualization
 *
 * Task 5.3: Visualize trade-offs when goals conflict
 *
 * Features:
 * 1. Detect conflicting goals from CEE analysis
 * 2. Display Pareto frontier chart
 * 3. Highlight non-dominated options
 * 4. Interactive priority weight adjustment
 */

import { memo, useState, useMemo, useCallback } from 'react'
import {
  Scale,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Sliders,
  RotateCcw,
  Award,
  Target,
  Info,
  Sparkles,
} from 'lucide-react'
import { typography } from '../../styles/typography'
import { useCanvasStore } from '../store'
import { usePareto } from '../../hooks/usePareto'
import {
  detectGoalConflicts,
  applyWeights,
  getDefaultWeights,
  formatConflictStrength,
  type GoalCorrelation,
} from '../utils/goalConflictDetection'
import { ParetoChart } from '../../components/results/ParetoChart'

interface MultiGoalParetoPanelProps {
  /** Callback when an option is clicked */
  onOptionClick?: (optionId: string) => void
  /** Start expanded */
  defaultExpanded?: boolean
  /** Additional CSS class */
  className?: string
}

// Conflict severity styling
const conflictStyles = {
  strong: {
    bgColor: 'bg-carrot-50',
    borderColor: 'border-carrot-200',
    textColor: 'text-carrot-700',
    iconColor: 'text-carrot-500',
  },
  moderate: {
    bgColor: 'bg-banana-50',
    borderColor: 'border-banana-200',
    textColor: 'text-banana-700',
    iconColor: 'text-banana-500',
  },
  weak: {
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200',
    textColor: 'text-sky-700',
    iconColor: 'text-sky-500',
  },
  none: {
    bgColor: 'bg-mint-50',
    borderColor: 'border-mint-200',
    textColor: 'text-mint-700',
    iconColor: 'text-mint-500',
  },
}

export const MultiGoalParetoPanel = memo(function MultiGoalParetoPanel({
  onOptionClick,
  defaultExpanded = false,
  className = '',
}: MultiGoalParetoPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [showWeights, setShowWeights] = useState(false)

  // Get analysis results from store
  const results = useCanvasStore((s) => s.results)
  const nodes = useCanvasStore((s) => s.nodes)

  // Extract goals/criteria and options from results
  const { goals, options, criteria } = useMemo(() => {
    const report = results?.report
    if (!report) {
      return { goals: [], options: [], criteria: [] }
    }

    // Get goal nodes from graph
    const goalNodes = nodes
      .filter((n) => n.type === 'goal' || n.type === 'outcome')
      .map((n) => ({
        id: n.id,
        label: (n.data as any)?.label || n.id,
      }))

    // Extract option rankings or comparisons
    const rankings = (report as any)?.rankings || (report as any)?.ranked_options || []
    const reportOptions = rankings.map((r: any) => ({
      id: r.option_id || r.id,
      label: r.option_label || r.label || r.option_id,
      scores: r.criteria_scores || r.scores || {},
    }))

    // Get criteria names from first option's scores or from report
    const reportCriteria =
      (report as any)?.criteria ||
      (reportOptions[0]?.scores ? Object.keys(reportOptions[0].scores) : [])

    return {
      goals: goalNodes,
      options: reportOptions,
      criteria: reportCriteria,
    }
  }, [results, nodes])

  // Initialize weights state
  const [weights, setWeights] = useState<Record<string, number>>(() =>
    getDefaultWeights(criteria)
  )

  // Detect goal conflicts
  const conflictAnalysis = useMemo(() => {
    const optionScores = options.map((o) => ({
      optionId: o.id,
      scores: o.scores,
    }))
    return detectGoalConflicts(criteria, optionScores)
  }, [criteria, options])

  // Get Pareto analysis
  const {
    frontier,
    dominated,
    dominancePairs,
    isLoading: paretoLoading,
    error: paretoError,
  } = usePareto({
    options,
    criteria,
    enabled: options.length >= 3 && criteria.length >= 2,
  })

  // Apply weights to get ranked options
  const weightedOptions = useMemo(() => {
    const optionScores = options.map((o) => ({
      optionId: o.id,
      label: o.label,
      scores: o.scores,
    }))
    return applyWeights(optionScores, weights).sort(
      (a, b) => b.weightedScore - a.weightedScore
    )
  }, [options, weights])

  // Handle weight change
  const handleWeightChange = useCallback((criterion: string, value: number) => {
    setWeights((prev) => ({
      ...prev,
      [criterion]: value,
    }))
  }, [])

  // Reset weights to equal
  const resetWeights = useCallback(() => {
    setWeights(getDefaultWeights(criteria))
  }, [criteria])

  // Handle option click
  const handleOptionClick = useCallback(
    (optionId: string) => {
      onOptionClick?.(optionId)
    },
    [onOptionClick]
  )

  // Don't render if not enough data
  if (options.length < 3 || criteria.length < 2) {
    return null
  }

  // Get the worst conflict for summary
  const worstConflict = conflictAnalysis.conflictingPairs[0]
  const worstStyle = worstConflict
    ? conflictStyles[worstConflict.conflictStrength]
    : conflictStyles.none

  return (
    <div
      className={`bg-paper-50 border border-sand-200 rounded-xl overflow-hidden shadow-sm ${className}`}
      data-testid="multi-goal-pareto-panel"
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
            <ChevronUp className="h-4 w-4 text-ink-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-ink-500" />
          )}
          <Scale className="h-4 w-4 text-violet-500" aria-hidden="true" />
          <span className={`${typography.body} font-medium text-ink-800`}>
            Multi-Goal Trade-offs
          </span>
        </div>

        <div className="flex items-center gap-2">
          {conflictAnalysis.hasConflicts ? (
            <span
              className={`${typography.caption} px-2 py-0.5 rounded-full ${worstStyle.bgColor} ${worstStyle.textColor}`}
            >
              {conflictAnalysis.conflictingPairs.length} conflict
              {conflictAnalysis.conflictingPairs.length > 1 ? 's' : ''}
            </span>
          ) : (
            <span className={`${typography.caption} px-2 py-0.5 rounded-full bg-mint-100 text-mint-700`}>
              Goals aligned
            </span>
          )}
          <span className={`${typography.caption} px-2 py-0.5 rounded-full bg-teal-100 text-teal-700`}>
            {frontier.length} optimal
          </span>
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-sand-200">
          {/* Conflict warnings */}
          {conflictAnalysis.hasConflicts && (
            <div className="px-4 py-3 border-b border-sand-100">
              <div className="flex items-start gap-2 mb-2">
                <AlertTriangle
                  className={`h-4 w-4 ${worstStyle.iconColor} flex-shrink-0 mt-0.5`}
                  aria-hidden="true"
                />
                <div>
                  <p className={`${typography.bodySmall} font-medium ${worstStyle.textColor}`}>
                    Conflicting goals detected
                  </p>
                  <p className={`${typography.caption} text-ink-600 mt-1`}>
                    {conflictAnalysis.recommendations[0]}
                  </p>
                </div>
              </div>

              {/* Conflict details */}
              <div className="flex flex-wrap gap-2 mt-2">
                {conflictAnalysis.conflictingPairs.slice(0, 3).map((pair) => (
                  <ConflictBadge
                    key={`${pair.goal1Id}-${pair.goal2Id}`}
                    pair={pair}
                    criteria={criteria}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Priority Weight Adjustment */}
          <div className="px-4 py-3 border-b border-sand-100">
            <button
              type="button"
              onClick={() => setShowWeights(!showWeights)}
              className="flex items-center gap-2 text-left w-full"
            >
              <Sliders className="h-4 w-4 text-sky-600" aria-hidden="true" />
              <span className={`${typography.label} text-ink-700`}>
                Adjust Priority Weights
              </span>
              {showWeights ? (
                <ChevronUp className="h-3 w-3 text-ink-400 ml-auto" />
              ) : (
                <ChevronDown className="h-3 w-3 text-ink-400 ml-auto" />
              )}
            </button>

            {showWeights && (
              <div className="mt-3 space-y-3">
                <p className={`${typography.caption} text-ink-500`}>
                  Drag sliders to prioritize criteria. Higher weight = more important.
                </p>

                {criteria.map((criterion) => (
                  <WeightSlider
                    key={criterion}
                    criterion={criterion}
                    value={weights[criterion] ?? 0}
                    onChange={(value) => handleWeightChange(criterion, value)}
                  />
                ))}

                <button
                  type="button"
                  onClick={resetWeights}
                  className={`${typography.caption} flex items-center gap-1 text-ink-500 hover:text-ink-700`}
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset to equal
                </button>
              </div>
            )}
          </div>

          {/* Weighted Rankings */}
          <div className="px-4 py-3 border-b border-sand-100">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-mint-600" aria-hidden="true" />
              <span className={`${typography.label} text-ink-700`}>
                Options by Your Priorities
              </span>
              <Sparkles className="h-3 w-3 text-violet-400 ml-1" />
            </div>

            <div className="space-y-2">
              {weightedOptions.slice(0, 5).map((opt, idx) => {
                const isFrontier = frontier.includes(opt.optionId)
                return (
                  <button
                    key={opt.optionId}
                    type="button"
                    onClick={() => handleOptionClick(opt.optionId)}
                    className={`w-full text-left p-2 rounded-lg border transition-colors ${
                      isFrontier
                        ? 'bg-teal-50 border-teal-200 hover:bg-teal-100'
                        : 'bg-sand-50 border-sand-200 hover:bg-sand-100'
                    }`}
                    data-testid={`weighted-option-${opt.optionId}`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`${typography.caption} w-5 h-5 flex items-center justify-center rounded-full ${
                          idx === 0
                            ? 'bg-mint-500 text-white'
                            : 'bg-sand-200 text-sand-600'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span
                        className={`${typography.bodySmall} font-medium ${
                          isFrontier ? 'text-teal-800' : 'text-ink-700'
                        }`}
                      >
                        {opt.label}
                      </span>
                      {isFrontier && (
                        <Award className="h-3.5 w-3.5 text-teal-600 ml-auto" />
                      )}
                    </div>
                    <div className={`${typography.caption} text-ink-500 ml-7 mt-1`}>
                      Weighted score: {(opt.weightedScore * 100).toFixed(0)}%
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Pareto Frontier Chart */}
          <div className="p-4">
            <ParetoChart
              options={options}
              criteria={criteria}
              onOptionClick={handleOptionClick}
            />
          </div>

          {/* Footer explanation */}
          <div className="px-4 py-2 bg-sand-50 border-t border-sand-100">
            <div className="flex items-start gap-2">
              <Info className="h-3.5 w-3.5 text-ink-400 flex-shrink-0 mt-0.5" />
              <span className={`${typography.caption} text-ink-500`}>
                Options on the Pareto frontier (teal) represent optimal trade-offs — improving
                one criterion requires sacrificing another.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

/**
 * Conflict badge showing trade-off between two criteria
 */
interface ConflictBadgeProps {
  pair: GoalCorrelation
  criteria: string[]
}

function ConflictBadge({ pair, criteria }: ConflictBadgeProps) {
  const style = conflictStyles[pair.conflictStrength]
  const goal1Label = criteria.find((c) => c === pair.goal1Id) || pair.goal1Id
  const goal2Label = criteria.find((c) => c === pair.goal2Id) || pair.goal2Id

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${style.bgColor} ${style.textColor}`}
      title={formatConflictStrength(pair.conflictStrength)}
    >
      <span className="font-medium">{goal1Label}</span>
      <Scale className="h-3 w-3" />
      <span className="font-medium">{goal2Label}</span>
    </div>
  )
}

/**
 * Weight adjustment slider for a criterion
 */
interface WeightSliderProps {
  criterion: string
  value: number
  onChange: (value: number) => void
}

function WeightSlider({ criterion, value, onChange }: WeightSliderProps) {
  const percentage = Math.round(value * 100)

  return (
    <div className="flex items-center gap-3">
      <span className={`${typography.caption} text-ink-700 w-24 truncate`} title={criterion}>
        {criterion}
      </span>
      <input
        type="range"
        min="0"
        max="100"
        value={percentage}
        onChange={(e) => onChange(parseInt(e.target.value, 10) / 100)}
        className="flex-1 h-2 bg-sand-200 rounded-lg appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-4
          [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-sky-500
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:hover:bg-sky-600"
        aria-label={`Weight for ${criterion}`}
        data-testid={`weight-slider-${criterion}`}
      />
      <span className={`${typography.caption} text-ink-600 w-10 text-right`}>
        {percentage}%
      </span>
    </div>
  )
}

// Re-export types for external use
export type { GoalCorrelation, ConflictAnalysis } from '../utils/goalConflictDetection'
