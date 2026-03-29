import { memo, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import type { RiskImpact } from '../domain/nodes'
import { calculateRiskSeverity, getRiskSeverityColors, cleanDisplayLabel } from '../utils/graphDisplayCalculations'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { FileText, Cpu } from 'lucide-react'
import { computeSignedMean } from '../domain/edges'
import { getProvenanceLabel } from '../ui/inspector-v2/inspectorStrings'
import { InfluenceIndicator } from '../ui/shared/InfluenceIndicator'
import { useNodeConnections } from '../hooks/useNodeConnections'
import { ConnRow, Sep, NodeChip, ExpertOverlay } from './shared'

export const RiskNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.risk

  const probability = props.data?.probability as number | undefined
  const impact = props.data?.impact as RiskImpact | undefined
  const severity = calculateRiskSeverity(probability, impact)
  const severityColors = getRiskSeverityColors(severity)

  const cleanedLabel = cleanDisplayLabel(props.data?.label as string | undefined)
  const cleanedData = { ...props.data, label: cleanedLabel || props.data?.label }

  const edges = useCanvasStore(state => state.edges)
  const nodes = useCanvasStore(state => state.nodes)
  const resultsStatus = useCanvasStore(state => state.results.status)
  const isPostAnalysis = resultsStatus === 'complete'

  // Provenance (expert overlay)
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

  return (
    <BaseNode {...props} data={cleanedData} nodeType="risk" icon={metadata.icon} maxWidth={220}>
      {/* Post-analysis: "Responsible for X% of your goal (negative)" */}
      {isPostAnalysis && bridgeEdgeData?.contributionPct != null && (
        <div className={`${typography.nodeLabel} mt-1 text-text-body`}>
          Responsible for {bridgeEdgeData.contributionPct}% of your goal (negative)
        </div>
      )}

      {/* Pre-analysis: qualitative */}
      {!isPostAnalysis && bridgeEdgeData?.signedMean != null && (
        <div className={`${typography.edgeLabel} mt-1 text-text-light`}>
          {Math.abs(bridgeEdgeData.signedMean) > 0.5 ? 'Strong' : 'Moderate'} negative influence on goal
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

      {/* Coaching chips (both views, post-analysis) */}
      {isPostAnalysis && (
        <>
          <Sep />
          <div className="flex gap-1 flex-wrap mt-0.5">
            <NodeChip label="What reduces this?" message={`What factors or actions could reduce ${cleanedLabel || 'this risk'}?`} />
            <NodeChip label="Add mitigation" message={`Suggest a mitigation strategy for ${cleanedLabel || 'this risk'}`} />
          </div>
        </>
      )}

      {/* Expert overlay */}
      <ExpertOverlay>
        {severity && (
          <div
            className={`${severityColors.bg} ${severityColors.border} ${severityColors.text} border rounded px-1.5 py-0.5 ${typography.edgeLabel} mb-1`}
            style={{ textAlign: 'center' }}
          >
            {severity.charAt(0).toUpperCase() + severity.slice(1)} Risk
          </div>
        )}
        {bridgeEdgeData?.signedMean !== null && bridgeEdgeData?.signedMean !== undefined && (
          <InfluenceIndicator
            strength={bridgeEdgeData.signedMean}
            variant="canvas"
            className={`${typography.edgeLabel} text-text-light`}
          />
        )}
        {provenanceLabel && (
          <div className="flex items-center gap-1 mt-0.5">
            {provenanceLabel.includes('Olumi') ? (
              <Cpu size={10} className="text-text-light" aria-hidden="true" />
            ) : (
              <FileText size={10} className="text-text-light" aria-hidden="true" />
            )}
            <span className={`${typography.edgeLabel} text-text-light`}>{provenanceLabel}</span>
          </div>
        )}
      </ExpertOverlay>

      {typeof props.data?.description === 'string' && props.data.description && (
        <div className={`${typography.nodeLabel} opacity-70 mt-1`}>
          {props.data.description}
        </div>
      )}
    </BaseNode>
  )
})

RiskNode.displayName = 'RiskNode'
