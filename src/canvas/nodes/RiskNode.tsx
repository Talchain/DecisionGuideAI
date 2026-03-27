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
import { CoachingCard } from '../components/CoachingCard'

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
  const viewMode = useCanvasStore(state => state.viewMode)

  // Provenance pill: show when source is a meaningful attribution (not user-set or unknown)
  const provenanceLabel = useMemo(() => {
    const source = (props.data?.observedState as any)?.source as string | undefined
    if (!source || source === 'user' || source === 'user_calibration' || source === 'default') return null
    const label = getProvenanceLabel(source)
    return label === 'No evidence yet' || label === `Source: ${source}` ? null : label
  }, [props.data?.observedState])

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

  const report = useCanvasStore(state => state.results.report)

  // Phase 4: "Driven by" — top 2 factors by inbound edge weight (Model view, post-analysis)
  // Include sensitivity rank when available, e.g. "Feature release (#1), Pro price (#2)"
  const drivenBy = useMemo(() => {
    if (viewMode !== 'model' || resultsStatus !== 'complete') return null
    // Build rank lookup from factor_sensitivity (aligned with useNodeDisplayMetadata ranking)
    const sensitivity = (report as any)?.enrichment?.sensitivity_analysis?.factors
      ?? (report as any)?.factor_sensitivity ?? []
    const rankById = new Map<string, number>()
    if (Array.isArray(sensitivity)) {
      const sorted = [...sensitivity]
        .map((f: any) => ({
          id: (f.factor_id || f.factorId || f.node_id || f.nodeId) as string | undefined,
          elasticity: Math.abs(f.elasticity ?? f.sensitivity_score ?? f.importance_score ?? 0),
        }))
        .sort((a, b) => b.elasticity !== a.elasticity
          ? b.elasticity - a.elasticity
          : (a.id ?? '').localeCompare(b.id ?? ''))
      sorted.forEach((f, i) => { if (f.id) rankById.set(f.id, i + 1) })
    }
    const inbound = edges
      .filter(e => e.target === props.id)
      .map(e => {
        const sourceNode = nodes.find(n => n.id === e.source)
        const w = (e.data as any)?.weight as number | undefined
        const rank = rankById.get(e.source)
        return { label: (sourceNode?.data?.label as string | undefined) ?? null, weight: w ?? 0, rank }
      })
      .filter(e => e.label)
      .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
      .slice(0, 2)
    return inbound.length > 0
      ? inbound.map(e => e.rank ? `${e.label} (#${e.rank})` : e.label!).join(', ')
      : null
  }, [viewMode, resultsStatus, edges, nodes, props.id, report])

  return (
    <BaseNode {...props} data={cleanedData} nodeType="risk" icon={metadata.icon}>
      {/* Severity pill (Model view only — Decision view shows name + contribution % only) */}
      {viewMode === 'model' && severity && (
        <div
          className={`${severityColors.bg} ${severityColors.border} ${severityColors.text} border rounded px-2 py-1 ${typography.nodeTitle} mb-2`}
          style={{ textAlign: 'center' }}
        >
          {severity.charAt(0).toUpperCase() + severity.slice(1)} Risk
        </div>
      )}

      {/* T9: Bridge edge data — contribution % (both views) + direction (Model only) */}
      {resultsStatus === 'complete' && bridgeEdgeData && (bridgeEdgeData.contributionPct != null || bridgeEdgeData.signedMean !== null) && (
        <div className={`${typography.nodeLabel} mt-1 text-text-body`}>
          {bridgeEdgeData.contributionPct != null && (
            <div>
              {bridgeEdgeData.contributionPct}% contribution to goal
            </div>
          )}
          {viewMode === 'model' && bridgeEdgeData.signedMean !== null && (
            <InfluenceIndicator
              strength={bridgeEdgeData.signedMean}
              variant="canvas"
              className={`${typography.nodeLabel} text-text-light`}
            />
          )}
        </div>
      )}

      {/* Pre-analysis: bridge edge influence indicator (Model view only) */}
      {viewMode === 'model' && resultsStatus !== 'complete' && bridgeEdgeData && bridgeEdgeData.signedMean !== null && (
        <div className={`${typography.nodeLabel} mt-2 text-text-light`}>
          <InfluenceIndicator
            strength={bridgeEdgeData.signedMean}
            variant="canvas"
            className={`${typography.nodeLabel} text-text-light`}
          />
        </div>
      )}

      {viewMode === 'model' && provenanceLabel && (
        <div className="flex justify-end mt-1.5">
          {provenanceLabel.includes('Olumi') ? (
            <Cpu size={14} className="text-text-light" aria-hidden="true" title={provenanceLabel} />
          ) : (
            <FileText size={14} className="text-text-light" aria-hidden="true" title={provenanceLabel} />
          )}
        </div>
      )}

      {/* "Driven by" line (Model view, post-analysis) */}
      {drivenBy && (
        <div className={`${typography.nodeLabel} text-text-light mt-1`}>
          Driven by: {drivenBy}
        </div>
      )}

      {/* Coaching: risk reduction chip (Model view, post-analysis) */}
      {viewMode === 'model' && resultsStatus === 'complete' && (
        <CoachingCard
          severity="info"
          message=""
          chips={[{ label: 'What reduces this risk?', message: `What factors or actions could reduce ${cleanedLabel || 'this risk'}?` }]}
        />
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
