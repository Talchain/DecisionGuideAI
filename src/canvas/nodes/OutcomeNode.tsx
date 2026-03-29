import { memo, useMemo, useCallback } from 'react'
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
import { useNodeConnections } from '../hooks/useNodeConnections'
import { ConnRow, Sep, ExpertOverlay } from './shared'
import { useGuidanceStore } from '../stores/guidanceStore'

export const OutcomeNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.outcome
  const displayMetadata = useNodeDisplayMetadata(props.id, 'outcome')

  const edges = useCanvasStore(state => state.edges)
  const nodes = useCanvasStore(state => state.nodes)
  const resultsStatus = useCanvasStore(state => state.results.status)
  const isPostAnalysis = resultsStatus === 'complete'

  // Provenance pill (expert overlay only)
  const provenanceLabel = useMemo(() => {
    const source = (props.data?.observedState as any)?.source as string | undefined
    if (!source || source === 'user' || source === 'user_calibration' || source === 'default') return null
    const label = getProvenanceLabel(source)
    return label === 'No evidence yet' || label === `Source: ${source}` ? null : label
  }, [props.data?.observedState])

  // Bridge edge to goal — contribution %
  const bridgeEdgeData = useMemo(() => {
    const goalNode = nodes.find(n => n.data?.type === 'goal' || n.type === 'goal')
    if (!goalNode) return null
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

  // ConnRow data: "Depends on:" — inbound edges from factors
  const inboundConnections = useNodeConnections(props.id, 'inbound')

  // Top factor for actionable guidance
  const topFactor = inboundConnections.length > 0 ? inboundConnections[0] : null

  const handleFactorLink = useCallback(() => {
    if (!topFactor) return
    const send = useGuidanceStore.getState()._sendMessage
    if (send) send(`How can I validate my assumption about ${topFactor.connectedNodeLabel}?`)
  }, [topFactor])

  return (
    <BaseNode {...props} nodeType="outcome" icon={metadata.icon} maxWidth={220}>
      {/* Post-analysis: "Responsible for X% of your goal" */}
      {isPostAnalysis && bridgeEdgeData?.contributionPct != null && (
        <div className={`${typography.nodeLabel} mt-1 text-text-body`}>
          Responsible for {bridgeEdgeData.contributionPct}% of your goal
        </div>
      )}

      {/* Pre-analysis: qualitative */}
      {!isPostAnalysis && bridgeEdgeData?.signedMean != null && (
        <div className={`${typography.edgeLabel} mt-1 text-text-light`}>
          {bridgeEdgeData.signedMean > 0 ? 'Strong positive' : bridgeEdgeData.signedMean < -0.3 ? 'Negative' : 'Moderate'} influence on goal
        </div>
      )}

      {/* Post-analysis: "Depends on:" ConnRows */}
      {isPostAnalysis && inboundConnections.length > 0 && (
        <>
          <Sep />
          <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5`}>Depends on:</p>
          {inboundConnections.map(conn => (
            <ConnRow
              key={conn.edgeId}
              edgeId={conn.edgeId}
              nodeKind={conn.connectedNodeKind}
              label={conn.connectedNodeLabel}
              confidencePct={conn.confidencePct}
            />
          ))}
        </>
      )}

      {/* Actionable guidance */}
      {isPostAnalysis && topFactor && (
        <>
          <Sep />
          <p className={`${typography.edgeLabel} text-text-body m-0`}>
            Strengthen this:{' '}
            <button
              type="button"
              className={`${typography.edgeLabel} text-info underline cursor-pointer nodrag nopan`}
              onClick={handleFactorLink}
              onPointerDown={(e) => e.stopPropagation()}
            >
              validate {topFactor.connectedNodeLabel.length > 22 ? `${topFactor.connectedNodeLabel.slice(0, 22)}...` : topFactor.connectedNodeLabel}
            </button>
          </p>
        </>
      )}

      {/* Expert overlay (only when there's data to show) */}
      {(displayMetadata.achievementProbability !== null || (isPostAnalysis && bridgeEdgeData?.signedMean != null) || provenanceLabel) && (
        <ExpertOverlay>
          {displayMetadata.achievementProbability !== null && (
            <p className={`${typography.edgeLabel} text-text-body m-0`}>
              Achievement: {Math.round(displayMetadata.achievementProbability * 100)}%
            </p>
          )}
          {isPostAnalysis && bridgeEdgeData?.signedMean !== null && bridgeEdgeData?.signedMean !== undefined && (
            <InfluenceIndicator
              strength={bridgeEdgeData.signedMean}
              variant="canvas"
              className={`${typography.edgeLabel} text-text-light`}
            />
          )}
          {provenanceLabel && (
            <div className="mt-0.5">
              {provenanceLabel.includes('Olumi') ? (
                <Cpu size={10} className="text-text-light" title="Estimated by Olumi" />
              ) : (
                <FileText size={10} className="text-text-light" title="From your brief" />
              )}
            </div>
          )}
        </ExpertOverlay>
      )}
    </BaseNode>
  )
})

OutcomeNode.displayName = 'OutcomeNode'
