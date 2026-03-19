import { memo, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
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
    const signedMean = computeSignedMean(edge.data as Record<string, unknown> | undefined)
    const existsProbability = (edge.data as any)?.exists_probability ?? (edge.data as any)?.beliefExists ?? (edge.data as any)?.belief
    return {
      signedMean,
      contributionPct: weight != null ? Math.round(weight * 100) : null,
      existsProbability: typeof existsProbability === 'number' ? existsProbability : null,
    }
  }, [edges, nodes, props.id])

  return (
    <BaseNode {...props} nodeType="outcome" icon={metadata.icon}>
      {/* Achievement probability (pre-existing) */}
      {displayMetadata.achievementProbability !== null && (
        <div className={`${typography.nodeTitle} mb-1 text-success`}>
          {Math.round(displayMetadata.achievementProbability * 100)}% chance
        </div>
      )}

      {/* Post-analysis: contribution % + predicted range */}
      {resultsStatus === 'complete' && bridgeEdgeData && (
        <div className={`${typography.nodeLabel} mt-1.5`}>
          {bridgeEdgeData.contributionPct != null && (
            <div className="text-success font-semibold">
              {bridgeEdgeData.contributionPct}% contribution to goal
            </div>
          )}
          {displayMetadata.predictedOutcome ? (
            <div className="text-text-light mt-0.5">
              {displayMetadata.predictedOutcome.mean != null && (
                <span>~{displayMetadata.predictedOutcome.mean.toFixed(2)}</span>
              )}
              {displayMetadata.predictedOutcome.p10 != null && displayMetadata.predictedOutcome.p90 != null && (
                <span className="ml-1">
                  ({displayMetadata.predictedOutcome.p10.toFixed(2)}–{displayMetadata.predictedOutcome.p90.toFixed(2)})
                </span>
              )}
            </div>
          ) : (
            <InfluenceIndicator
              strength={bridgeEdgeData.signedMean}
              variant="canvas"
              className={`${typography.nodeTitle} font-semibold text-success`}
            />
          )}
          {bridgeEdgeData.existsProbability !== null && (
            <div className="text-text-light mt-0.5">
              {Math.round(bridgeEdgeData.existsProbability * 100)}% certain
            </div>
          )}
        </div>
      )}

      {/* Pre-analysis: bridge edge influence indicator */}
      {resultsStatus !== 'complete' && bridgeEdgeData && (
        <div className={`${typography.nodeLabel} mt-2 text-text-light`}>
          <InfluenceIndicator
            strength={bridgeEdgeData.signedMean}
            variant="canvas"
            className={`${typography.nodeTitle} font-semibold text-success`}
          />
          {bridgeEdgeData.existsProbability !== null && (
            <> · {Math.round(bridgeEdgeData.existsProbability * 100)}% certain</>
          )}
        </div>
      )}

      {provenanceLabel && (
        <div className={`${typography.nodeLabel} mt-1.5`}>
          <span className="bg-panel border border-info/30 text-text-body rounded-full px-1.5 py-0.5">
            {provenanceLabel}
          </span>
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
