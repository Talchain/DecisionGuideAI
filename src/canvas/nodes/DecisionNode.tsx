/**
 * Decision node component
 * Uses BaseNode for consistent structure and schema types
 */
import { memo, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { Crosshair } from 'lucide-react'
import type { DecisionNodeData } from '../domain/nodes'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { getStabilityClassification } from '../../lib/stability'

export const DecisionNode = memo(({ id, data, selected }: NodeProps<DecisionNodeData>) => {
  const edges = useCanvasStore(state => state.edges)
  const nodes = useCanvasStore(state => state.nodes)
  const resultsStatus = useCanvasStore(state => state.results.status)
  const report = useCanvasStore(state => state.results.report)

  const optionCount = useMemo(() => {
    const outgoingEdges = edges.filter(e => e.source === id)
    return outgoingEdges.filter(e => {
      const targetNode = nodes.find(n => n.id === e.target)
      return targetNode?.type === 'option' || targetNode?.data?.type === 'option'
    }).length
  }, [edges, nodes, id])

  // Post-analysis: extract winner name, win probability, stability tier
  const headline = useMemo(() => {
    if (resultsStatus !== 'complete' || !report) return null
    const robustness = (report as any)?.robustness
    const recommendedId = robustness?.recommended_option_id ?? robustness?.recommendedOptionId
    if (!recommendedId) return null

    const winnerNode = nodes.find(n => n.id === recommendedId)
    const winnerLabel = (winnerNode?.data?.label as string | undefined) ?? null
    if (!winnerLabel) return null

    const optionProbs = (report as any)?.option_probabilities ?? {}
    const winProb = optionProbs[recommendedId]?.win_probability as number | undefined

    const stability = robustness?.recommendation_stability ?? robustness?.recommendationStability
    const stabilityTier = typeof stability === 'number'
      ? getStabilityClassification(stability)?.badgeLabel ?? null
      : null

    return { winnerLabel, winProb, stabilityTier }
  }, [resultsStatus, report, nodes])

  return (
    <BaseNode
      nodeType="decision"
      icon={Crosshair}
      id={id}
      data={data}
      selected={selected}
    >
      {/* Post-analysis: headline result */}
      {headline ? (
        <div className="mt-1">
          <div className={`${typography.nodeLabel} text-text-body font-semibold truncate`} title={headline.winnerLabel}>
            Winner: {headline.winnerLabel}
          </div>
          <div className={`${typography.nodeLabel} text-text-light mt-0.5`}>
            {headline.winProb != null && <>{Math.round(headline.winProb * 100)}% win probability</>}
            {headline.winProb != null && headline.stabilityTier && ' · '}
            {headline.stabilityTier && <>{headline.stabilityTier} stability</>}
          </div>
        </div>
      ) : optionCount > 0 ? (
        <div className={`${typography.nodeLabel} text-text-light mt-1`}>
          {optionCount} option{optionCount !== 1 ? 's' : ''} compared
        </div>
      ) : null}
    </BaseNode>
  )
})

DecisionNode.displayName = 'DecisionNode'

export default DecisionNode
