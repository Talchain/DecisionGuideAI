import { memo, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'

export const GoalNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.goal
  const displayMetadata = useNodeDisplayMetadata(props.id, 'goal')

  // T10: Robustness level + stability from report
  const report = useCanvasStore(state => state.results.report)
  const resultsStatus = useCanvasStore(state => state.results.status)

  const robustnessData = useMemo(() => {
    if (resultsStatus !== 'complete' || !report) return null
    const robustness = (report as any)?.robustness
    if (!robustness) return null
    const stability: number | null = typeof (robustness.recommendation_stability ?? robustness.recommendationStability) === 'number'
      ? (robustness.recommendation_stability ?? robustness.recommendationStability)
      : null
    const level: string | null = robustness.level ?? robustness.robustness_level ?? null
    return { stability, level }
  }, [report, resultsStatus])

  // T10: Threshold context from node data
  const thresholdRaw = props.data?.goal_threshold_raw as string | number | undefined
  const thresholdUnit = props.data?.goal_threshold_unit as string | undefined
  const thresholdCap = props.data?.goal_threshold_cap as string | number | undefined

  // T10: Stability bar colour from robustness level
  const stabilityBarColor = useMemo(() => {
    switch (robustnessData?.level) {
      case 'high':     return 'bg-success'
      case 'moderate': return 'bg-goal'
      case 'low':      return 'bg-warning'
      default:         return 'bg-goal'
    }
  }, [robustnessData])

  // Prefer report-level stability over displayMetadata fallback
  const stabilityValue = robustnessData?.stability ?? displayMetadata.stabilityPercentage

  return (
    <BaseNode {...props} nodeType="goal" icon={metadata.icon}>
      {/* Achievement probability */}
      {displayMetadata.achievementProbability !== null && (
        <div className={`${typography.nodeTitle} mb-1 text-success`}>
          {Math.round(displayMetadata.achievementProbability * 100)}% chance
        </div>
      )}

      {/* T10: Stability bar + Marginal badge when stability < 60% */}
      {stabilityValue !== null && (
        <div className="mt-2 mb-1">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className={`${typography.nodeLabel} text-text-light`}>Stability</span>
            <span className={`${typography.nodeTitle} text-text-body`}>
              {Math.round(stabilityValue * 100)}%
            </span>
            {stabilityValue < 0.6 && (
              <span className={`${typography.nodeLabel} bg-warning-light text-text-body rounded-full px-1.5 py-0.5 ml-auto`}>
                Marginal
              </span>
            )}
          </div>
          <div className="h-1.5 bg-factor-light rounded-full overflow-hidden">
            <div
              className={`h-full ${stabilityBarColor} rounded-full transition-all duration-300`}
              style={{ width: `${Math.round(stabilityValue * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Fallback: "Recommended in X% of scenarios" only when no stability bar shown */}
      {displayMetadata.achievementProbability === null && stabilityValue === null && displayMetadata.stabilityPercentage !== null && (
        <div className={`${typography.nodeTitle} mb-1 text-info`}>
          Recommended in {Math.round(displayMetadata.stabilityPercentage * 100)}% of scenarios
        </div>
      )}

      {/* T10: Threshold context */}
      {(thresholdRaw !== undefined || thresholdCap !== undefined) && (
        <div className={`${typography.nodeLabel} text-text-light mt-1`}>
          Target: {thresholdRaw !== undefined ? String(thresholdRaw) : '—'}
          {thresholdUnit ? ` ${thresholdUnit}` : ''}
          {thresholdCap !== undefined ? ` of ${String(thresholdCap)} modelled range` : ''}
        </div>
      )}

      {props.data?.description && (
        <div className={`${typography.nodeLabel} opacity-70 mt-1`}>
          {props.data.description}
        </div>
      )}
    </BaseNode>
  )
})

GoalNode.displayName = 'GoalNode'
