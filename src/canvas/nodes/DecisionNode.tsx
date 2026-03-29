/**
 * Decision node component — v3 wireframe
 * Pre-analysis: name, option count, "Explore more options" chip, narrow-framing bias icon
 * Post-analysis: compound winner + risk sentence, coaching chips
 * Self-sufficient — no popover, no MetricPills, no ExpertOverlay.
 */
import { memo, useMemo, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { Crosshair } from 'lucide-react'
import type { DecisionNodeData } from '../domain/nodes'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { NodeChip, BiasIcon } from './shared'

export const DecisionNode = memo(({ id, data, selected }: NodeProps<DecisionNodeData>) => {
  const edges = useCanvasStore(state => state.edges)
  const nodes = useCanvasStore(state => state.nodes)
  const resultsStatus = useCanvasStore(state => state.results.status)
  const report = useCanvasStore(state => state.results.report)
  const isPostAnalysis = resultsStatus === 'complete'

  const optionCount = useMemo(() => {
    const outgoingEdges = edges.filter(e => e.source === id)
    return outgoingEdges.filter(e => {
      const targetNode = nodes.find(n => n.id === e.target)
      return targetNode?.type === 'option' || targetNode?.data?.type === 'option'
    }).length
  }, [edges, nodes, id])

  // Post-analysis headline: winner name + win probability
  const headline = useMemo(() => {
    if (!isPostAnalysis || !report) return null
    const robustness = (report as any)?.robustness
    const recommendedId = robustness?.recommended_option_id ?? robustness?.recommendedOptionId
    if (!recommendedId) return null

    const winnerNode = nodes.find(n => n.id === recommendedId)
    const winnerLabel = (winnerNode?.data?.label as string | undefined) ?? null
    if (!winnerLabel) return null

    const optionProbs = (report as any)?.option_probabilities ?? {}
    const winProb = optionProbs[recommendedId]?.win_probability as number | undefined

    return { winnerLabel, winProb }
  }, [isPostAnalysis, report, nodes])

  // Biggest risk: risk node with highest bridge edge weight to goal
  const biggestRisk = useMemo(() => {
    if (!isPostAnalysis) return null
    const goalNode = nodes.find(n => n.type === 'goal' || n.data?.type === 'goal')
    if (!goalNode) return null

    const riskNodes = nodes.filter(n => n.type === 'risk' || n.data?.type === 'risk')
    let best: { nodeId: string; label: string; weight: number } | null = null

    for (const risk of riskNodes) {
      const edge = edges.find(e => e.source === risk.id && e.target === goalNode.id)
      if (!edge) continue
      const weight = (edge.data as any)?.weight as number | undefined
      if (weight != null && (best === null || weight > best.weight)) {
        best = {
          nodeId: risk.id,
          label: (risk.data?.label as string) ?? '',
          weight,
        }
      }
    }
    return best
  }, [isPostAnalysis, nodes, edges])

  const handleRiskClick = useCallback(() => {
    if (!biggestRisk) return
    const store = useCanvasStore.getState()
    store.setHighlightedNodes([biggestRisk.nodeId])
    store.onSelectionChange({ nodes: [{ id: biggestRisk.nodeId } as any], edges: [] })
    store.setShowInspectorPanel(true)
    setTimeout(() => store.setHighlightedNodes([]), 3000)
  }, [biggestRisk])

  // Truncate risk label for inline display
  const truncatedRiskLabel = biggestRisk
    ? (biggestRisk.label.length > 22 ? `${biggestRisk.label.slice(0, 22)}...` : biggestRisk.label)
    : null

  return (
    <BaseNode
      nodeType="decision"
      icon={Crosshair}
      id={id}
      data={data}
      selected={selected}
      maxWidth={320}
    >
      {/* Post-analysis: compound winner + risk sentence */}
      {headline ? (
        <div className="mt-1">
          <div className={`${typography.nodeLabel} text-text-body`}>
            {headline.winnerLabel} wins {headline.winProb != null ? `${Math.round(headline.winProb * 100)}%` : ''} of scenarios{biggestRisk && biggestRisk.label ? (
              <>
                , but sensitive to{' '}
                <button
                  type="button"
                  className={`${typography.nodeLabel} text-info underline cursor-pointer nodrag nopan`}
                  onClick={handleRiskClick}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {truncatedRiskLabel}
                </button>
              </>
            ) : null}
          </div>
          {/* Post-analysis chips */}
          <div className="flex gap-1 flex-wrap mt-1.5">
            <NodeChip label="Challenge this result" message="What assumptions would need to change for a different option to win?" />
            <NodeChip label="Explore more options" message="What other options should I consider?" />
          </div>
        </div>
      ) : optionCount > 0 ? (
        <>
          {/* Pre-analysis: option count + chips */}
          <div className={`${typography.nodeLabel} text-text-light mt-1`}>
            {optionCount} option{optionCount !== 1 ? 's' : ''} compared
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <NodeChip label="Explore more options" message="Suggest a third option I haven't considered for this decision" />
            {optionCount < 3 && (
              <BiasIcon bias="narrow-framing" tip={`Only ${optionCount} option${optionCount !== 1 ? 's' : ''}. Decisions improve with more alternatives.`} linkLabel="Explore a third path" linkMessage="Suggest a third option I haven't considered for this decision" />
            )}
          </div>
        </>
      ) : null}
    </BaseNode>
  )
})

DecisionNode.displayName = 'DecisionNode'

export default DecisionNode
