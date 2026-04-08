import { memo, useMemo, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { computeSignedMean } from '../domain/edges'

import { useNodeConnections } from '../hooks/useNodeConnections'
import { usePopoverHover } from '../hooks/usePopoverHover'
import { useScienceIcons } from '../hooks/useScienceIcons'
import { ConnRow, Sep, NodeChip, NodePopover, ScienceIcon } from './shared'
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

  // Science icons (spec Section 4.1)
  const scienceIcons = useScienceIcons(props.id, 'outcome')

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
      bridgeStrengthPct: signedMean != null ? Math.round(Math.abs(signedMean) * 100) : null,
      contributionPct: weight != null ? Math.round(weight * 100) : null,
    }
  }, [edges, nodes, props.id])

  // ConnRow data: "Depends on:" — inbound edges from factors (post-analysis only)
  const inboundConnections = useNodeConnections(props.id, 'inbound')

  // Pre-analysis inbound edges with strengths (for popover)
  const preAnalysisInbound = useMemo(() => {
    if (isPostAnalysis) return []
    const inbound = edges.filter(e => e.target === props.id)
    const items: { nodeLabel: string; strengthPct: number }[] = []
    for (const edge of inbound) {
      const sourceNode = nodes.find(n => n.id === edge.source)
      if (!sourceNode) continue
      const label = (sourceNode.data?.label as string) ?? 'Untitled'
      const sm = computeSignedMean(edge.data as Record<string, unknown> | undefined)
      items.push({ nodeLabel: label, strengthPct: Math.round(Math.abs(sm) * 100) })
    }
    items.sort((a, b) => b.strengthPct - a.strengthPct)
    return items
  }, [edges, nodes, props.id, isPostAnalysis])

  // Top factor for actionable guidance
  const topFactor = inboundConnections.length > 0 ? inboundConnections[0] : null

  const handleFactorLink = useCallback(() => {
    if (!topFactor) return
    const send = useGuidanceStore.getState()._sendMessage
    if (send) send(`How can I validate my assumption about ${topFactor.connectedNodeLabel}?`)
  }, [topFactor])

  // ----- Layer 2 content: post-analysis (shared between popover and Detailed inline) -----
  const layer2ContentPost = isPostAnalysis ? (
    <>
      {/* "Depends on:" ConnRows (max 3 Standard, max 5 Detailed) */}
      {inboundConnections.length > 0 && (
        <>
          <Sep />
          <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5`}>Depends on:</p>
          {inboundConnections.slice(0, isDetailed ? 5 : 3).map(conn => (
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

  // ----- Layer 2 content: pre-analysis popover -----
  const preAnalysisPopoverContent = !isPostAnalysis && preAnalysisInbound.length > 0 ? (
    <>
      <p className={`${typography.edgeLabel} text-text-body m-0 mb-1`}>
        Driven by {preAnalysisInbound.length} factor{preAnalysisInbound.length !== 1 ? 's' : ''}.
        {preAnalysisInbound[0] && (
          <> Strongest: {preAnalysisInbound[0].nodeLabel} at {preAnalysisInbound[0].strengthPct}%.</>
        )}
      </p>
      {preAnalysisInbound.slice(0, 5).map((item, i) => (
        <div key={i} className={`${typography.edgeLabel} text-text-light m-0 flex justify-between gap-2`}>
          <span className="truncate">{item.nodeLabel}</span>
          <span className={`${typography.nodeLabel} font-semibold shrink-0`}>{item.strengthPct}%</span>
        </div>
      ))}
      <Sep />
      <NodeChip label="Are there other outcomes that matter?" message="Are there other outcomes or consequences I should consider for this decision?" />
    </>
  ) : null

  // Achievement metric (Detailed view) — diagnostic indicator distinct from
  // the Layer 1 contribution percentage (which is bridge weight to goal).
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
      <BaseNode
        {...props}
        nodeType="outcome"
        icon={metadata.icon}
        headerSlot={scienceIcons.length > 0 ? (
          <span className="inline-flex items-center gap-1">
            {scienceIcons.map(si => (
              <ScienceIcon key={si.id} icon={si.icon} tooltip={si.tooltip} action={si.action} colour={si.colour} />
            ))}
          </span>
        ) : undefined}
      >
        {/* ===== LAYER 1: Standard body (always visible) ===== */}

        {/* Post-analysis: "55%" (semibold entity colour) + "of your goal" (meta) */}
        {isPostAnalysis && bridgeEdgeData?.contributionPct != null && (
          <div className="mt-1 inline-flex items-center gap-1">
            <span className={`${typography.nodeLabel} font-semibold text-success`}>{bridgeEdgeData.contributionPct}%</span>
            <span className={`${typography.edgeLabel} text-text-light`}>of your goal</span>
          </div>
        )}

        {/* Pre-analysis: influence percentage */}
        {!isPostAnalysis && bridgeEdgeData?.bridgeStrengthPct != null && (
          <div className="mt-1 inline-flex items-center gap-1">
            <span className={`${typography.nodeLabel} font-semibold text-success`}>{bridgeEdgeData.bridgeStrengthPct}%</span>
            <span className={`${typography.edgeLabel} text-text-light`}>influence</span>
          </div>
        )}

        {/* ===== LAYER 2: Detailed inline (only in Detailed view) =====
            Graph v1.1 Task 4: align with wireframe v4 OutcomePostDet —
            percentage (Layer 1), separator, "Depends on:" ConnRows (max 3),
            separator, one Strengthen action. The achievement metric is a
            distinct diagnostic (probability of the outcome occurring at all,
            not the goal-bridge contribution shown in Layer 1) so it stays. */}
        {isDetailed && layer2ContentPost}
        {isDetailed && detailedMetrics}

        {/* Detailed pre-analysis: full inbound factor list (max 5) */}
        {isDetailed && !isPostAnalysis && preAnalysisInbound.length > 0 && (
          <>
            <Sep />
            <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5`}>Driven by:</p>
            {preAnalysisInbound.slice(0, 5).map((item, i) => (
              <div key={i} className={`${typography.edgeLabel} text-text-light m-0 flex justify-between gap-2`}>
                <span className="truncate">{item.nodeLabel}</span>
                <span className={`${typography.nodeLabel} font-semibold shrink-0`}>{item.strengthPct}%</span>
              </div>
            ))}
          </>
        )}

      </BaseNode>

      {/* ===== LAYER 2: Popover (Standard view, post-analysis, desktop hover) ===== */}
      {!isDetailed && isPostAnalysis && (
        <NodePopover
          visible={showPopover}
          width={240}
          onMouseEnter={popoverHandlers.onMouseEnter}
          onMouseLeave={popoverHandlers.onMouseLeave}
          anchorRef={nodeElRef}
        >
          {layer2ContentPost}
        </NodePopover>
      )}

      {/* ===== LAYER 2: Popover (Standard view, pre-analysis, desktop hover) ===== */}
      {!isDetailed && !isPostAnalysis && preAnalysisInbound.length > 0 && (
        <NodePopover
          visible={showPopover}
          width={240}
          onMouseEnter={popoverHandlers.onMouseEnter}
          onMouseLeave={popoverHandlers.onMouseLeave}
          anchorRef={nodeElRef}
        >
          {preAnalysisPopoverContent}
        </NodePopover>
      )}
    </div>
  )
})

OutcomeNode.displayName = 'OutcomeNode'
