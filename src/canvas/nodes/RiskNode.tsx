import { memo, useMemo, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import type { RiskImpact } from '../domain/nodes'
import { calculateRiskSeverity, getRiskSeverityColors, cleanDisplayLabel } from '../utils/graphDisplayCalculations'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { computeSignedMean } from '../domain/edges'
import { getProvenanceLabel } from '../ui/inspector-v2/inspectorStrings'

import { useNodeConnections } from '../hooks/useNodeConnections'
import { usePopoverHover } from '../hooks/usePopoverHover'
import { ConnRow, Sep, NodeChip, OlumiSparkle, BriefIcon, NodePopover } from './shared'
import { useGuidanceStore } from '../stores/guidanceStore'

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
  const viewMode = useCanvasStore(state => state.viewMode)
  const isPostAnalysis = resultsStatus === 'complete'
  const isDetailed = viewMode === 'expert'

  // Popover hover
  const { showPopover, nodeHandlers, popoverHandlers, nodeElRef } = usePopoverHover()

  // Provenance
  const provenanceLabel = useMemo(() => {
    const source = (props.data?.observedState as any)?.source as string | undefined
    if (!source || source === 'user' || source === 'user_calibration' || source === 'default') return null
    const label = getProvenanceLabel(source)
    return label === 'No evidence yet' || label === `Source: ${source}` ? null : label
  }, [props.data?.observedState])

  const isOlumiProvenance = provenanceLabel?.includes('Olumi') ?? false

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

  // "View parameters" handler (Detailed view)
  const handleViewParams = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const store = useCanvasStore.getState()
    store.onSelectionChange({ nodes: [{ id: props.id } as any], edges: [] })
    store.setShowInspectorPanel(true)
  }, [props.id])

  // Severity badge (Detailed view, independent of isPostAnalysis — derived from node probability/impact)
  const detailedMetrics = severity ? (
    <div
      className={`${severityColors.bg} ${severityColors.border} ${severityColors.text} border rounded px-1.5 py-0.5 ${typography.edgeLabel} mb-1`}
      style={{ textAlign: 'center' }}
    >
      {severity.charAt(0).toUpperCase() + severity.slice(1)} Risk
    </div>
  ) : null

  // ----- Layer 2 content (shared between popover and Detailed inline) -----
  const layer2Content = isPostAnalysis ? (
    <>
      {/* "Depends on:" ConnRows (max 3) */}
      {inboundConnections.length > 0 && (
        <>
          <Sep />
          <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5`}>Depends on:</p>
          {inboundConnections.slice(0, 3).map(conn => (
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

      {/* Actionable: factor-specific wording */}
      {topFactor && (
        <>
          <Sep />
          <p className={`${typography.edgeLabel} text-text-body m-0`}>
            Driven by factors outside your control.{' '}
            <button
              type="button"
              className={`${typography.edgeLabel} text-info underline cursor-pointer nodrag nopan`}
              onClick={(e) => {
                e.stopPropagation()
                const send = useGuidanceStore.getState()._sendMessage
                if (send) send(`What if ${topFactor.connectedNodeLabel} worsens?`)
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              What if {topFactor.connectedNodeLabel.length > 18 ? `${topFactor.connectedNodeLabel.slice(0, 18)}...` : topFactor.connectedNodeLabel} worsens?
            </button>
          </p>
        </>
      )}

    </>
  ) : null

  return (
    <div
      ref={nodeElRef as React.Ref<HTMLDivElement>}
      style={{ position: 'relative' }}
      onMouseEnter={nodeHandlers.onMouseEnter}
      onMouseLeave={nodeHandlers.onMouseLeave}
    >
      <BaseNode {...props} data={cleanedData} nodeType="risk" icon={metadata.icon} maxWidth={220}>
        {/* ===== LAYER 1: Standard body (always visible) ===== */}

        {/* Post-analysis: "Responsible for X% of your goal (negative)" */}
        {isPostAnalysis && bridgeEdgeData?.contributionPct != null && (
          <div className={`${typography.nodeLabel} mt-1 text-text-body inline-flex items-center gap-1`}>
            Responsible for {bridgeEdgeData.contributionPct}% of your goal (negative)
            {provenanceLabel && (isOlumiProvenance ? <OlumiSparkle /> : <BriefIcon />)}
          </div>
        )}

        {/* Pre-analysis: qualitative */}
        {!isPostAnalysis && bridgeEdgeData?.signedMean != null && (
          <div className={`${typography.edgeLabel} mt-1 text-text-light inline-flex items-center gap-1`}>
            {Math.abs(bridgeEdgeData.signedMean) > 0.5 ? 'Strong' : 'Moderate'} negative influence on goal
            {provenanceLabel && (isOlumiProvenance ? <OlumiSparkle /> : <BriefIcon />)}
          </div>
        )}

        {/* Coaching chips (both views, post-analysis) — kept in Layer 1 */}
        {isPostAnalysis && (
          <>
            <Sep />
            <div className="flex gap-1 flex-wrap mt-0.5">
              <NodeChip label="What reduces this?" message={`What factors or actions could reduce ${cleanedLabel || 'this risk'}?`} />
              <NodeChip label="Add mitigation" message={`Suggest a mitigation strategy for ${cleanedLabel || 'this risk'}`} />
            </div>
          </>
        )}

        {/* ===== LAYER 2: Detailed inline (only in Detailed view) ===== */}
        {isDetailed && detailedMetrics}
        {isDetailed && layer2Content}

        {/* "View parameters" link (Detailed, post-analysis) */}
        {isDetailed && isPostAnalysis && (
          <button
            type="button"
            className={`${typography.edgeLabel} text-info underline cursor-pointer mt-1.5 nodrag nopan`}
            onClick={handleViewParams}
            onPointerDown={(e) => e.stopPropagation()}
          >
            View parameters
          </button>
        )}

        {typeof props.data?.description === 'string' && props.data.description && (
          <div className={`${typography.nodeLabel} opacity-70 mt-1`}>
            {props.data.description}
          </div>
        )}
      </BaseNode>

      {/* ===== LAYER 2: Popover (Standard view, post-analysis, desktop hover) ===== */}
      {!isDetailed && isPostAnalysis && (
        <NodePopover
          visible={showPopover}
          width={240}
          onMouseEnter={popoverHandlers.onMouseEnter}
          onMouseLeave={popoverHandlers.onMouseLeave}
        >
          {detailedMetrics}
          {layer2Content}
        </NodePopover>
      )}
    </div>
  )
})

RiskNode.displayName = 'RiskNode'
