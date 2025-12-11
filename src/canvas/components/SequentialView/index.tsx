/**
 * SequentialView - Multi-stage decision visualization
 *
 * Shows a timeline of decision stages with:
 * - Visual stage progression
 * - Current stage highlight
 * - Stage-by-stage recommendations
 * - Value of flexibility indicator
 *
 * Only renders when graph has sequential metadata (2+ stages).
 */

import { useState } from 'react'
import {
  Calendar,
  ChevronRight,
  ChevronDown,
  CircleDot,
  Circle,
  CheckCircle2,
  Target,
  Eye,
  Sparkles,
  Loader2,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react'
import { useSequentialAnalysis } from '../../hooks/useSequentialAnalysis'
import { typography } from '../../../styles/typography'
import type {
  SequentialViewProps,
  DecisionStage,
  StageExplanation,
  StageAnalysis,
} from './types'

// Timing badge configuration
const timingConfig = {
  now: {
    bgColor: 'bg-mint-100',
    textColor: 'text-mint-700',
    label: 'Now',
  },
  next: {
    bgColor: 'bg-banana-100',
    textColor: 'text-banana-700',
    label: 'Next',
  },
  later: {
    bgColor: 'bg-sand-100',
    textColor: 'text-sand-600',
    label: 'Later',
  },
}

export function SequentialView({
  autoDetect = true,
  sequentialMetadata,
  onStageClick,
  onStageDetailsClick,
}: SequentialViewProps) {
  const [expandedStage, setExpandedStage] = useState<number | null>(0) // First stage expanded by default

  const {
    analysis,
    explanation,
    isSequential,
    metadata,
    loading,
    error,
    fetch: fetchAnalysis,
  } = useSequentialAnalysis({
    autoFetch: autoDetect,
    sequentialMetadata,
  })

  // Don't render if not sequential
  if (!isSequential || !metadata) {
    return null
  }

  // Loading state
  if (loading && !analysis) {
    return (
      <div
        className="bg-paper-50 border border-sand-200 rounded-xl p-6"
        data-testid="sequential-view-loading"
      >
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-sky-500 animate-spin" aria-hidden="true" />
          <span className={`${typography.body} text-ink-600`}>
            Analyzing decision stages...
          </span>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !analysis) {
    return (
      <div
        className="bg-carrot-50 border border-carrot-200 rounded-xl p-4"
        data-testid="sequential-view-error"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-carrot-600" aria-hidden="true" />
            <span className={`${typography.body} text-carrot-800`}>
              Could not analyze stages
            </span>
          </div>
          <button
            type="button"
            onClick={() => fetchAnalysis()}
            className={`${typography.caption} flex items-center gap-1 px-3 py-1.5 rounded-lg text-carrot-700 hover:bg-carrot-100 transition-colors`}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  const stages = metadata.stages
  const currentStage = metadata.current_stage

  return (
    <div
      className="bg-paper-50 border border-sand-200 rounded-xl overflow-hidden shadow-sm"
      data-testid="sequential-view"
    >
      {/* Header */}
      <div className="px-4 py-4 border-b border-sand-100">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="h-4 w-4 text-sky-600" aria-hidden="true" />
          <span className={`${typography.caption} font-medium text-sky-700 uppercase tracking-wide`}>
            Decision Stages
          </span>
          <span className={`${typography.caption} text-ink-500`}>
            ({stages.length} stages)
          </span>
        </div>

        {/* Executive summary */}
        {explanation?.executive_summary && (
          <p className={`${typography.body} text-ink-700`}>
            {explanation.executive_summary}
          </p>
        )}
      </div>

      {/* Timeline visualization */}
      <div className="px-4 py-4 border-b border-sand-100">
        <StageTimeline
          stages={stages}
          currentStage={currentStage}
          onStageClick={(idx) => {
            setExpandedStage(idx === expandedStage ? null : idx)
            onStageClick?.(idx)
          }}
        />
      </div>

      {/* Current stage highlight */}
      <div className="px-4 py-3 bg-mint-50 border-b border-mint-200">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-mint-600" aria-hidden="true" />
          <span className={`${typography.bodySmall} font-medium text-mint-800`}>
            You are at: Stage {currentStage} - {stages[currentStage]?.label}
          </span>
        </div>
      </div>

      {/* Stage cards */}
      <div className="divide-y divide-sand-100">
        {stages.map((stage, idx) => {
          const stageExplanation = explanation?.stage_explanations?.find(
            (e) => e.stage_index === idx
          )
          const stageAnalysis = analysis?.stage_analyses?.find(
            (a) => a.stage_index === idx
          )

          return (
            <StageCard
              key={stage.decision_node_id}
              stage={stage}
              explanation={stageExplanation}
              analysis={stageAnalysis}
              isCurrent={idx === currentStage}
              isExpanded={expandedStage === idx}
              onToggle={() => setExpandedStage(idx === expandedStage ? null : idx)}
              onDetailsClick={() => onStageDetailsClick?.(idx)}
            />
          )
        })}
      </div>

      {/* Value of flexibility */}
      {analysis && analysis.value_of_flexibility > 0 && (
        <div className="px-4 py-3 bg-sky-50 border-t border-sky-200">
          <div className="flex items-start gap-2">
            <TrendingUp className="h-4 w-4 text-sky-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span className={`${typography.bodySmall} font-medium text-sky-800`}>
                Value of flexibility: +{(analysis.value_of_flexibility * 100).toFixed(0)}%
              </span>
              {explanation?.flexibility_explanation && (
                <p className={`${typography.caption} text-sky-700 mt-0.5`}>
                  {explanation.flexibility_explanation}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Visual timeline of stages
 */
interface StageTimelineInternalProps {
  stages: DecisionStage[]
  currentStage: number
  onStageClick?: (index: number) => void
}

function StageTimeline({ stages, currentStage, onStageClick }: StageTimelineInternalProps) {
  return (
    <div className="flex items-center justify-between">
      {stages.map((stage, idx) => {
        const isCompleted = idx < currentStage
        const isCurrent = idx === currentStage
        const isLast = idx === stages.length - 1

        return (
          <div key={stage.decision_node_id} className="flex items-center flex-1">
            {/* Stage dot */}
            <button
              type="button"
              onClick={() => onStageClick?.(idx)}
              className={`relative flex flex-col items-center ${
                isCurrent || isCompleted ? 'cursor-pointer' : 'cursor-default'
              }`}
              aria-label={`Stage ${idx}: ${stage.label}`}
            >
              {/* Dot */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  isCompleted
                    ? 'bg-mint-500 text-white'
                    : isCurrent
                      ? 'bg-sky-500 text-white ring-4 ring-sky-200'
                      : 'bg-sand-200 text-sand-500'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : isCurrent ? (
                  <CircleDot className="h-5 w-5" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </div>

              {/* Label */}
              <span
                className={`${typography.caption} mt-2 text-center max-w-[80px] truncate ${
                  isCurrent ? 'text-sky-700 font-medium' : 'text-ink-500'
                }`}
              >
                {stage.label}
              </span>

              {/* Timing badge */}
              {stage.timing && (
                <span
                  className={`${typography.caption} mt-1 px-1.5 py-0.5 rounded ${
                    timingConfig[stage.timing].bgColor
                  } ${timingConfig[stage.timing].textColor}`}
                >
                  {timingConfig[stage.timing].label}
                </span>
              )}
            </button>

            {/* Connector line */}
            {!isLast && (
              <div
                className={`flex-1 h-0.5 mx-2 ${
                  idx < currentStage ? 'bg-mint-400' : 'bg-sand-200'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Individual stage card with details
 */
interface StageCardInternalProps {
  stage: DecisionStage
  explanation?: StageExplanation
  analysis?: StageAnalysis
  isCurrent: boolean
  isExpanded: boolean
  onToggle: () => void
  onDetailsClick?: () => void
}

function StageCard({
  stage,
  explanation,
  analysis,
  isCurrent,
  isExpanded,
  onToggle,
  onDetailsClick,
}: StageCardInternalProps) {
  const timing = stage.timing ? timingConfig[stage.timing] : null

  return (
    <div
      className={`${isCurrent ? 'bg-sky-50/50' : ''}`}
      data-testid={`stage-card-${stage.index}`}
    >
      {/* Header - clickable */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-sand-50/50 transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-ink-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-ink-500" />
          )}
          <span className={`${typography.bodySmall} font-medium text-ink-800`}>
            Stage {stage.index}: {stage.label}
          </span>
          {isCurrent && (
            <span className={`${typography.caption} px-2 py-0.5 rounded-full bg-sky-100 text-sky-700`}>
              Current
            </span>
          )}
          {timing && !isCurrent && (
            <span className={`${typography.caption} px-2 py-0.5 rounded-full ${timing.bgColor} ${timing.textColor}`}>
              {timing.label}
            </span>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 pl-11 space-y-3 animate-in fade-in-0 slide-in-from-top-1 duration-150">
          {/* What to do */}
          {explanation?.what_to_do && (
            <div className="p-3 bg-mint-50 border border-mint-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-mint-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <span className={`${typography.caption} font-medium text-mint-800 block mb-1`}>
                    Recommended
                  </span>
                  <p className={`${typography.bodySmall} text-mint-700`}>
                    {explanation.what_to_do}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* What to observe */}
          {explanation?.what_to_observe && (
            <div className="flex items-start gap-2">
              <Eye className="h-4 w-4 text-sky-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <span className={`${typography.caption} font-medium text-ink-600 block`}>
                  Watch for:
                </span>
                <p className={`${typography.caption} text-ink-500`}>
                  {explanation.what_to_observe}
                </p>
              </div>
            </div>
          )}

          {/* Why it matters */}
          {explanation?.why_this_matters && (
            <p className={`${typography.caption} text-ink-500 italic`}>
              {explanation.why_this_matters}
            </p>
          )}

          {/* Trigger condition */}
          {stage.trigger_condition && (
            <div className={`${typography.caption} text-ink-500 p-2 bg-sand-50 rounded`}>
              <span className="font-medium">Trigger:</span> {stage.trigger_condition}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Re-export types
export * from './types'
