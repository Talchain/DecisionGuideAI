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

export const RiskNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.risk

  const probability = props.data?.probability as number | undefined
  const impact = props.data?.impact as RiskImpact | undefined
  const severity = calculateRiskSeverity(probability, impact)
  const severityColors = getRiskSeverityColors(severity)

  const cleanedLabel = cleanDisplayLabel(props.data?.label as string | undefined)
  const cleanedData = { ...props.data, label: cleanedLabel || props.data?.label }

  // T9: Bridge edge data — find edge from this risk node to goal node
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
    if (resultsStatus !== 'complete') return null
    const goalNode = nodes.find(n => n.data?.type === 'goal' || n.type === 'goal')
    if (!goalNode) return null
    const edge = edges.find(e => e.source === props.id && e.target === goalNode.id)
    if (!edge) return null

    const weight = (edge.data as any)?.weight as number | undefined
    const signedMean = computeSignedMean(edge.data as Record<string, unknown> | undefined)
    // Canvas store canonical name — CEE ingestion normalises to camelCase
    const existsProbability = (edge.data as any)?.beliefExists as number | undefined
    return {
      signedMean,
      contributionPct: weight != null ? Math.round(weight * 100) : null,
      existsProbability: typeof existsProbability === 'number' ? existsProbability : null,
    }
  }, [edges, nodes, resultsStatus, props.id])

  return (
    <BaseNode {...props} data={cleanedData} nodeType="risk" icon={metadata.icon}>
      {severity && (
        <div
          className={`${severityColors.bg} ${severityColors.border} ${severityColors.text} border rounded px-2 py-1 ${typography.nodeTitle} mb-2`}
          style={{ textAlign: 'center' }}
        >
          {severity.charAt(0).toUpperCase() + severity.slice(1)} Risk
        </div>
      )}

      {/* T9: Bridge edge data — contribution % + direction, neutral colours */}
      {bridgeEdgeData && (
        <div className={`${typography.nodeLabel} mt-1 text-text-body`}>
          {bridgeEdgeData.contributionPct != null && (
            <div>
              {bridgeEdgeData.contributionPct}% contribution to goal
            </div>
          )}
          <InfluenceIndicator
            strength={bridgeEdgeData.signedMean}
            variant="canvas"
            className={`${typography.nodeLabel} text-text-light`}
          />
          {bridgeEdgeData.existsProbability !== null && (
            <div className="text-text-light mt-0.5">
              {Math.round(bridgeEdgeData.existsProbability * 100)}% certain
            </div>
          )}
        </div>
      )}

      {provenanceLabel && (
        <div className="flex justify-end mt-1.5">
          {provenanceLabel.includes('Olumi') ? (
            <Cpu size={12} className="text-text-light" aria-hidden="true" title={provenanceLabel} />
          ) : (
            <FileText size={12} className="text-text-light" aria-hidden="true" title={provenanceLabel} />
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

RiskNode.displayName = 'RiskNode'
