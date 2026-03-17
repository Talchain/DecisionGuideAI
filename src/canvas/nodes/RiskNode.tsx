import { memo, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import type { RiskImpact } from '../domain/nodes'
import { calculateRiskSeverity, getRiskSeverityColors, cleanDisplayLabel } from '../utils/graphDisplayCalculations'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { computeSignedMean, describeEdgeInfluence } from '../domain/edges'

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

  const bridgeEdgeData = useMemo(() => {
    if (resultsStatus !== 'complete') return null
    const goalNode = nodes.find(n => n.data?.type === 'goal' || n.type === 'goal')
    if (!goalNode) return null
    const edge = edges.find(e => e.source === props.id && e.target === goalNode.id)
    if (!edge) return null

    const signedMean = computeSignedMean(edge.data as Record<string, unknown> | undefined)
    const existsProbability = (edge.data as any)?.exists_probability ?? (edge.data as any)?.beliefExists ?? (edge.data as any)?.belief
    return { signedMean, existsProbability: typeof existsProbability === 'number' ? existsProbability : null }
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

      {/* T9: Bridge edge data */}
      {bridgeEdgeData && (
        <div className={`${typography.nodeLabel} mt-1 text-text-light`}>
          <span className={`${typography.nodeTitle} font-semibold text-danger`}>
            {describeEdgeInfluence(bridgeEdgeData.signedMean)}
          </span>
          {bridgeEdgeData.existsProbability !== null && (
            <> · {Math.round(bridgeEdgeData.existsProbability * 100)}% certain</>
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
