/**
 * PreAnalysisHealth - Pre-analysis quality assessment display
 *
 * Shows graph readiness status using CEE /graph-readiness endpoint.
 * Displays quality tier (needs_work/fair/strong) with visual indicators
 * and actionable improvements grouped by priority.
 *
 * Features:
 * - Quality tier badge with color coding
 * - Confidence score display
 * - Improvements list grouped by priority (high → medium → low)
 * - "Analyze Now" action button (gated by can_run_analysis)
 */

import { useMemo, useEffect, useCallback } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  TrendingUp,
  Wrench,
  Clock,
  RefreshCw,
  MapPin,
  Plus,
  ArrowRight,
} from 'lucide-react'
import { useGraphReadiness, type ReadinessLevel, type GraphImprovement, type ImprovementPriority, type SuggestedNodeType } from '../hooks/useGraphReadiness'
import { useCanvasStore } from '../store'
import { focusNodeById, focusEdgeById } from '../utils/focusHelpers'
import { typography } from '../../styles/typography'

// Node type display names
const nodeTypeLabels: Record<SuggestedNodeType, string> = {
  risk: 'Risk',
  outcome: 'Outcome',
  option: 'Option',
  factor: 'Factor',
  evidence: 'Evidence',
  goal: 'Goal',
  decision: 'Decision',
}

interface PreAnalysisHealthProps {
  /** Callback when user clicks "Analyze Now" */
  onAnalyze?: () => void
  /** Callback when user clicks an improvement to focus it */
  onFocusImprovement?: (improvement: GraphImprovement) => void
  /** Whether analysis is currently running */
  isAnalyzing?: boolean
  /** Callback when readiness.can_run_analysis changes (for unified gating) */
  onCanRunChange?: (canRun: boolean) => void
}

// Tier styling configuration
const tierConfig: Record<ReadinessLevel, {
  icon: typeof CheckCircle
  bgColor: string
  borderColor: string
  textColor: string
  iconColor: string
  label: string
}> = {
  needs_work: {
    icon: AlertTriangle,
    bgColor: 'bg-carrot-50',
    borderColor: 'border-carrot-200',
    textColor: 'text-carrot-800',
    iconColor: 'text-carrot-600',
    label: 'Needs Work',
  },
  fair: {
    icon: TrendingUp,
    bgColor: 'bg-banana-50',
    borderColor: 'border-banana-200',
    textColor: 'text-banana-800',
    iconColor: 'text-banana-600',
    label: 'Fair',
  },
  strong: {
    icon: CheckCircle,
    bgColor: 'bg-mint-50',
    borderColor: 'border-mint-200',
    textColor: 'text-mint-800',
    iconColor: 'text-mint-600',
    label: 'Strong',
  },
}

// Priority styling
const priorityConfig: Record<ImprovementPriority, {
  badgeColor: string
  textColor: string
}> = {
  high: {
    badgeColor: 'bg-carrot-100 text-carrot-700',
    textColor: 'text-carrot-700',
  },
  medium: {
    badgeColor: 'bg-banana-100 text-banana-700',
    textColor: 'text-banana-700',
  },
  low: {
    badgeColor: 'bg-sky-100 text-sky-700',
    textColor: 'text-sky-700',
  },
}

export function PreAnalysisHealth({
  onAnalyze,
  onFocusImprovement,
  isAnalyzing = false,
  onCanRunChange,
}: PreAnalysisHealthProps) {
  const { readiness, loading, error, refresh } = useGraphReadiness()
  const setHighlightedNodes = useCanvasStore((s) => s.setHighlightedNodes)

  // Notify parent when readiness.can_run_analysis changes (for unified run gating)
  useEffect(() => {
    // Default to true when loading or no data yet (don't block by default)
    const canRun = readiness?.can_run_analysis ?? true
    onCanRunChange?.(canRun)
  }, [readiness?.can_run_analysis, onCanRunChange])

  // Handle focusing on affected elements
  const handleFocusImprovement = useCallback((improvement: GraphImprovement) => {
    // Call parent callback if provided
    onFocusImprovement?.(improvement)

    // Highlight affected nodes for 3 seconds
    if (improvement.affected_nodes && improvement.affected_nodes.length > 0) {
      setHighlightedNodes(improvement.affected_nodes)
      focusNodeById(improvement.affected_nodes[0])
      setTimeout(() => setHighlightedNodes([]), 3000)
    }
    // Focus edge if no nodes
    else if (improvement.affected_edges && improvement.affected_edges.length > 0) {
      focusEdgeById(improvement.affected_edges[0])
    }
  }, [onFocusImprovement, setHighlightedNodes])

  // Group improvements by priority
  const groupedImprovements = useMemo(() => {
    if (!readiness?.improvements) return { high: [], medium: [], low: [] }

    return {
      high: readiness.improvements.filter((i) => i.priority === 'high'),
      medium: readiness.improvements.filter((i) => i.priority === 'medium'),
      low: readiness.improvements.filter((i) => i.priority === 'low'),
    }
  }, [readiness?.improvements])

  const totalImprovements =
    groupedImprovements.high.length +
    groupedImprovements.medium.length +
    groupedImprovements.low.length

  // Loading state
  if (loading && !readiness) {
    return (
      <div className="p-4 bg-sand-50 border border-sand-200 rounded-xl">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-sand-500 animate-spin" aria-hidden="true" />
          <span className={`${typography.body} text-sand-600`}>
            Checking graph health...
          </span>
        </div>
      </div>
    )
  }

  // Error state with fallback display
  if (error && !readiness) {
    return (
      <div className="p-4 bg-carrot-50 border border-carrot-200 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-carrot-600" aria-hidden="true" />
            <span className={`${typography.body} text-carrot-700`}>
              Could not check graph health
            </span>
          </div>
          <button
            type="button"
            onClick={refresh}
            className={`${typography.caption} flex items-center gap-1 px-2 py-1 rounded text-carrot-600 hover:bg-carrot-100 transition-colors`}
            aria-label="Retry health check"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  // No readiness data yet (shouldn't happen, but handle gracefully)
  if (!readiness) {
    return null
  }

  const config = tierConfig[readiness.readiness_level]
  const TierIcon = config.icon

  return (
    <div className="space-y-4" data-testid="pre-analysis-health">
      {/* Quality Tier Header */}
      <div className={`p-4 ${config.bgColor} border ${config.borderColor} rounded-xl`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <TierIcon
              className={`h-6 w-6 ${config.iconColor} flex-shrink-0`}
              aria-hidden="true"
            />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`${typography.body} font-semibold ${config.textColor}`}>
                  {config.label}
                </span>
                <span className={`${typography.caption} ${config.textColor} opacity-70`}>
                  ({readiness.readiness_score}%)
                </span>
                {loading && (
                  <Loader2 className="h-3.5 w-3.5 text-sand-400 animate-spin" aria-hidden="true" />
                )}
              </div>
              <p className={`${typography.caption} ${config.textColor} opacity-80`}>
                {readiness.confidence_explanation}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {totalImprovements > 0 && (
              <span className={`${typography.caption} text-ink-500`}>
                {totalImprovements} improvement{totalImprovements !== 1 ? 's' : ''}
              </span>
            )}
            <button
              type="button"
              onClick={onAnalyze}
              disabled={!readiness.can_run_analysis || isAnalyzing}
              className={`${typography.bodySmall} px-4 py-2 rounded-lg font-medium transition-colors ${
                readiness.can_run_analysis && !isAnalyzing
                  ? 'bg-sky-500 text-white hover:bg-sky-600'
                  : 'bg-sand-200 text-sand-500 cursor-not-allowed'
              }`}
              aria-label={readiness.can_run_analysis ? 'Run analysis' : 'Fix issues before running analysis'}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin inline mr-1.5" />
                  Analyzing...
                </>
              ) : (
                'Analyze Now'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Improvements List */}
      {totalImprovements > 0 && (
        <div className="space-y-3">
          {/* High priority */}
          {groupedImprovements.high.length > 0 && (
            <ImprovementSection
              title="High Priority"
              priority="high"
              improvements={groupedImprovements.high}
              onFocus={handleFocusImprovement}
            />
          )}

          {/* Medium priority */}
          {groupedImprovements.medium.length > 0 && (
            <ImprovementSection
              title="Recommended"
              priority="medium"
              improvements={groupedImprovements.medium}
              onFocus={handleFocusImprovement}
            />
          )}

          {/* Low priority */}
          {groupedImprovements.low.length > 0 && (
            <ImprovementSection
              title="Nice to Have"
              priority="low"
              improvements={groupedImprovements.low}
              onFocus={handleFocusImprovement}
            />
          )}
        </div>
      )}
    </div>
  )
}

// Improvement section sub-component
interface ImprovementSectionProps {
  title: string
  priority: ImprovementPriority
  improvements: GraphImprovement[]
  onFocus?: (improvement: GraphImprovement) => void
}

function ImprovementSection({ title, priority, improvements, onFocus }: ImprovementSectionProps) {
  const config = priorityConfig[priority]

  return (
    <div className="bg-paper-50 border border-sand-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2 bg-sand-50 border-b border-sand-200">
        <span className={`${typography.label} ${config.textColor}`}>{title}</span>
      </div>
      <div className="divide-y divide-sand-100">
        {improvements.map((improvement, index) => (
          <ImprovementItem
            key={`${improvement.category}-${index}`}
            improvement={improvement}
            priority={priority}
            onClick={() => onFocus?.(improvement)}
          />
        ))}
      </div>
    </div>
  )
}

// Individual improvement item
interface ImprovementItemProps {
  improvement: GraphImprovement
  priority: ImprovementPriority
  onClick?: () => void
}

function ImprovementItem({ improvement, priority, onClick }: ImprovementItemProps) {
  const config = priorityConfig[priority]
  const affectedNodeCount = improvement.affected_nodes?.length ?? 0
  const affectedEdgeCount = improvement.affected_edges?.length ?? 0
  const hasAffectedElements = affectedNodeCount + affectedEdgeCount > 0
  const hasSuggestedType = !!improvement.suggested_node_type

  // Calculate display values for target score
  const currentScore = improvement.current_score
  const targetScore = improvement.target_quality

  return (
    <button
      type="button"
      onClick={hasAffectedElements || hasSuggestedType ? onClick : undefined}
      disabled={!hasAffectedElements && !hasSuggestedType}
      className={`w-full px-4 py-3 text-left transition-colors ${
        hasAffectedElements || hasSuggestedType
          ? 'cursor-pointer hover:bg-sand-50'
          : 'cursor-default'
      }`}
      aria-label={`${improvement.action} - ${improvement.category}`}
    >
      <div className="flex items-start gap-3">
        <Wrench className="h-4 w-4 text-ink-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          {/* Action title with category badge */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`${typography.body} text-ink-800`}>
              {improvement.action}
            </span>
            <span className={`${typography.caption} px-1.5 py-0.5 rounded ${config.badgeColor}`}>
              {improvement.category}
            </span>
          </div>

          {/* Target score display: Current → Target */}
          {currentScore !== undefined && targetScore !== undefined && (
            <div className={`${typography.caption} flex items-center gap-1.5 mb-1 text-mint-600`}>
              <span className="text-ink-500">{Math.round(currentScore)}%</span>
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
              <span className="font-medium">{Math.round(targetScore)}%</span>
              <span className="text-ink-400">(+{improvement.quality_impact}pts)</span>
            </div>
          )}

          {/* Gap description */}
          {improvement.current_gap && (
            <p className={`${typography.caption} text-ink-500 mb-1`}>
              {improvement.current_gap}
            </p>
          )}

          {/* Metadata row: time, affected count, suggested type */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`${typography.caption} flex items-center gap-1 text-ink-400`}>
              <Clock className="h-3 w-3" aria-hidden="true" />
              ~{improvement.effort_minutes}m
            </span>

            {/* Node count badge */}
            {affectedNodeCount > 0 && (
              <span className={`${typography.caption} flex items-center gap-1 text-sky-600`}>
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {affectedNodeCount} node{affectedNodeCount !== 1 ? 's' : ''} affected
              </span>
            )}

            {/* Suggested node type hint */}
            {hasSuggestedType && (
              <span className={`${typography.caption} flex items-center gap-1 px-1.5 py-0.5 rounded bg-mint-100 text-mint-700`}>
                <Plus className="h-3 w-3" aria-hidden="true" />
                Add {nodeTypeLabels[improvement.suggested_node_type!]}
              </span>
            )}

            {/* Click to focus hint */}
            {hasAffectedElements && !hasSuggestedType && (
              <span className={`${typography.caption} text-sky-600`}>
                Click to focus
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
