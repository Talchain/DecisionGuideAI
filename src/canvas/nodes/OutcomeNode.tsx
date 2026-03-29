import { memo, useMemo, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { computeSignedMean } from '../domain/edges'
import { getProvenanceLabel } from '../ui/inspector-v2/inspectorStrings'

import { useNodeConnections } from '../hooks/useNodeConnections'
import { usePopoverHover } from '../hooks/usePopoverHover'
import { ConnRow, Sep, OlumiSparkle, BriefIcon, NodePopover } from './shared'
import { useGuidanceStore } from '../stores/guidanceStore'

export const OutcomeNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.outcome
  const displayMetadata = useNodeDisplayMetadata(props.id, 'outcome')

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

  const handleFactorLink = useCallback(() => {
    if (!topFactor) return
    const send = useGuidanceStore.getState()._sendMessage
    if (send) send(`How can I validate my assumption about ${topFactor.connectedNodeLabel}?`)
  }, [topFactor])

  // "View parameters" handler (Detailed view)
  const handleViewParams = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const store = useCanvasStore.getState()
    store.onSelectionChange({ nodes: [{ id: props.id } as any], edges: [] })
    store.setShowInspectorPanel(true)
  }, [props.id])

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

      {/* Actionable guidance */}
      {topFactor && (
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

    </>
  ) : null

  // Achievement metric (Detailed view, independent of isPostAnalysis — comes from displayMetadata)
  const detailedMetrics = displayMetadata.achievementProbability !== null ? (
    <>
      <Sep />
      <p className={`${typography.edgeLabel} text-text-body m-0`}>
        Achievement: {Math.round(displayMetadata.achievementProbability * 100)}%
      </p>
    </>
  ) : null

  return (
    <div
      ref={nodeElRef as React.Ref<HTMLDivElement>}
      style={{ position: 'relative' }}
      onMouseEnter={nodeHandlers.onMouseEnter}
      onMouseLeave={nodeHandlers.onMouseLeave}
    >
      <BaseNode {...props} nodeType="outcome" icon={metadata.icon} maxWidth={220}>
        {/* ===== LAYER 1: Standard body (always visible) ===== */}

        {/* Post-analysis: "Responsible for X% of your goal" */}
        {isPostAnalysis && bridgeEdgeData?.contributionPct != null && (
          <div className={`${typography.nodeLabel} mt-1 text-text-body inline-flex items-center gap-1`}>
            Responsible for {bridgeEdgeData.contributionPct}% of your goal
            {provenanceLabel && (isOlumiProvenance ? <OlumiSparkle /> : <BriefIcon />)}
          </div>
        )}

        {/* Pre-analysis: qualitative */}
        {!isPostAnalysis && bridgeEdgeData?.signedMean != null && (
          <div className={`${typography.edgeLabel} mt-1 text-text-light inline-flex items-center gap-1`}>
            {bridgeEdgeData.signedMean > 0 ? 'Strong positive' : bridgeEdgeData.signedMean < -0.3 ? 'Negative' : 'Moderate'} influence on goal
            {provenanceLabel && (isOlumiProvenance ? <OlumiSparkle /> : <BriefIcon />)}
          </div>
        )}

        {/* ===== LAYER 2: Detailed inline (only in Detailed view) ===== */}
        {isDetailed && layer2Content}
        {isDetailed && detailedMetrics}

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
      </BaseNode>

      {/* ===== LAYER 2: Popover (Standard view, post-analysis, desktop hover) ===== */}
      {!isDetailed && isPostAnalysis && (
        <NodePopover
          visible={showPopover}
          width={240}
          onMouseEnter={popoverHandlers.onMouseEnter}
          onMouseLeave={popoverHandlers.onMouseLeave}
        >
          {layer2Content}
        </NodePopover>
      )}
    </div>
  )
})

OutcomeNode.displayName = 'OutcomeNode'
