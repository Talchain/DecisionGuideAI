import { memo, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { computeSignedMean } from '../domain/edges'

export const OutcomeNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.outcome
  const displayMetadata = useNodeDisplayMetadata(props.id, 'outcome')

  // T9: Bridge edge data — find edge from this node to goal node
  const edges = useCanvasStore(state => state.edges)
  const nodes = useCanvasStore(state => state.nodes)
  const resultsStatus = useCanvasStore(state => state.results.status)

  const bridgeEdgeData = useMemo(() => {
    if (resultsStatus !== 'complete') return null
    // Find the goal node
    const goalNode = nodes.find(n => n.data?.type === 'goal' || n.type === 'goal')
    if (!goalNode) return null
    // Find edge from this node to goal
    const edge = edges.find(e => e.source === props.id && e.target === goalNode.id)
    if (!edge) return null

    const signedMean = computeSignedMean(edge.data as Record<string, unknown> | undefined)
    const existsProbability = (edge.data as any)?.exists_probability ?? (edge.data as any)?.beliefExists ?? (edge.data as any)?.belief
    return { signedMean, existsProbability: typeof existsProbability === 'number' ? existsProbability : null }
  }, [edges, nodes, resultsStatus, props.id])

  return (
    <BaseNode {...props} nodeType="outcome" icon={metadata.icon}>
      {/* Achievement probability (pre-existing) */}
      {displayMetadata.achievementProbability !== null && (
        <div className={`${typography.nodeTitle} mb-1 text-success`}>
          {Math.round(displayMetadata.achievementProbability * 100)}% chance
        </div>
      )}

      {/* T9: Bridge edge data */}
      {bridgeEdgeData && (
        <div className={`${typography.nodeLabel} mt-2 text-text-light`}>
          <span className={`${typography.nodeTitle} font-semibold text-success`}>
            {bridgeEdgeData.signedMean >= 0 ? '+' : ''}{bridgeEdgeData.signedMean.toFixed(2)}
          </span>
          {' '}impact on goal
          {bridgeEdgeData.existsProbability !== null && (
            <> · {Math.round(bridgeEdgeData.existsProbability * 100)}% certain</>
          )}
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

OutcomeNode.displayName = 'OutcomeNode'
