import { memo, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { FileText, Cpu } from 'lucide-react'
import { computeSignedMean } from '../domain/edges'
import { getProvenanceLabel } from '../ui/inspector-v2/inspectorStrings'
import { InfluenceIndicator } from '../ui/shared/InfluenceIndicator'

export const OutcomeNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.outcome
  const displayMetadata = useNodeDisplayMetadata(props.id, 'outcome')

  // T9: Bridge edge data — find edge from this node to goal node
  const edges = useCanvasStore(state => state.edges)
  const nodes = useCanvasStore(state => state.nodes)
  const resultsStatus = useCanvasStore(state => state.results.status)

  // Provenance pill: show when source is a meaningful attribution (not user-set or unknown)
  const provenanceLabel = useMemo(() => {
    const source = (props.data?.observedState as any)?.source as string | undefined
    if (!source || source === 'user' || source === 'user_calibration' || source === 'default') return null
    const label = getProvenanceLabel(source)
    return label === 'No evidence yet' || label === `Source: ${source}` ? null : label
  }, [props.data?.observedState])

  const bridgeEdgeData = useMemo(() => {
    // Find the goal node
    const goalNode = nodes.find(n => n.data?.type === 'goal' || n.type === 'goal')
    if (!goalNode) return null
    // Find edge from this node to goal
    const edge = edges.find(e => e.source === props.id && e.target === goalNode.id)
    if (!edge) return null

    const weight = (edge.data as any)?.weight as number | undefined
    const hasStrength = typeof (edge.data as any)?.strength_mean === 'number' || weight != null
    const signedMean = hasStrength ? computeSignedMean(edge.data as Record<string, unknown> | undefined) : null
    return {
      signedMean,
      contributionPct: weight != null ? Math.round(weight * 100) : null,
    }
  }, [edges, nodes, props.id])

  return (
    <BaseNode {...props} nodeType="outcome" icon={metadata.icon}>
      {/* Achievement probability (pre-existing) */}
      {displayMetadata.achievementProbability !== null && (
        <div className={`${typography.nodeTitle} mb-1 text-text-body`}>
          {Math.round(displayMetadata.achievementProbability * 100)}% chance
        </div>
      )}

      {/* Post-analysis: contribution % + direction indicator — neutral colours */}
      {resultsStatus === 'complete' && bridgeEdgeData && (bridgeEdgeData.contributionPct != null || bridgeEdgeData.signedMean !== null) && (
        <div className={`${typography.nodeLabel} mt-1.5 text-text-body`}>
          {bridgeEdgeData.contributionPct != null && (
            <div>
              {bridgeEdgeData.contributionPct}% contribution to goal
            </div>
          )}
          {bridgeEdgeData.signedMean !== null && (
            <InfluenceIndicator
              strength={bridgeEdgeData.signedMean}
              variant="canvas"
              className={`${typography.nodeLabel} text-text-light`}
            />
          )}
        </div>
      )}

      {/* Pre-analysis: bridge edge influence indicator */}
      {resultsStatus !== 'complete' && bridgeEdgeData && bridgeEdgeData.signedMean !== null && (
        <div className={`${typography.nodeLabel} mt-2 text-text-light`}>
          <InfluenceIndicator
            strength={bridgeEdgeData.signedMean}
            variant="canvas"
            className={`${typography.nodeLabel} text-text-light`}
          />
        </div>
      )}

      {provenanceLabel && (
        <div className="flex justify-end mt-1.5">
          {provenanceLabel.includes('Olumi') ? (
            <Cpu size={14} className="text-text-light" aria-hidden="true" title={provenanceLabel} />
          ) : (
            <FileText size={14} className="text-text-light" aria-hidden="true" title={provenanceLabel} />
          )}
        </div>
      )}

      {typeof props.data?.description === 'string' && props.data.description && (
        <div className={`${typography.nodeLabel} opacity-70 mt-1`}>
          {props.data.description}
        </div>
      )}
    </BaseNode>
  )
})

OutcomeNode.displayName = 'OutcomeNode'
