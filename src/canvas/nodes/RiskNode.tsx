import { memo, useMemo, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import type { RiskImpact } from '../domain/nodes'
import { calculateRiskSeverity, getRiskSeverityColors, cleanDisplayLabel } from '../utils/graphDisplayCalculations'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { computeSignedMean } from '../domain/edges'

import { useNodeConnections } from '../hooks/useNodeConnections'
import { usePopoverHover } from '../hooks/usePopoverHover'
import { useScienceIcons } from '../hooks/useScienceIcons'
import { ConnRow, ConnRowsOverflow, Sep, NodeChip, NodePopover, ScienceIcon } from './shared'
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

  // Science icons (spec Section 4.1)
  const scienceIcons = useScienceIcons(props.id, 'risk')

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

  // Coaching chips — same pair in both phases. Body never renders chips
  // directly; they live in popovers (Standard) or inline in Detailed view.
  const riskChips = useMemo(() => (
    <div className="flex gap-1 flex-wrap mt-1.5">
      <NodeChip chipId="risk_what_reduces" actionType={null} label="What reduces this?" message={`What factors or actions could reduce ${cleanedLabel || 'this risk'}?`} />
      <NodeChip chipId="risk_add_mitigation" actionType={null} label="Add mitigation" message={`Suggest a mitigation strategy for ${cleanedLabel || 'this risk'}`} />
    </div>
  ), [cleanedLabel])

  // Severity badge (Detailed view, independent of isPostAnalysis — derived from node probability/impact)
  const detailedMetrics = severity ? (
    <div
      className={`${severityColors.bg} ${severityColors.border} ${severityColors.text} border rounded px-1.5 py-0.5 ${typography.edgeLabel} mb-1`}
      style={{ textAlign: 'center' }}
    >
      {severity.charAt(0).toUpperCase() + severity.slice(1)} Risk
    </div>
  ) : null

  // ----- Layer 2 content: post-analysis (shared between popover and Detailed inline) -----
  const layer2ContentPost = isPostAnalysis ? (
    <>
      {/* "Depends on:" ConnRows (max 3) */}
      {inboundConnections.length > 0 && (
        <>
          <Sep />
          <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5`}>Depends on:</p>
          {/* Wireframe v4: max 3 ConnRows in both views; remainder disclosed
              via "+N more in inspector" (audit §8 P0-5). */}
          {inboundConnections.slice(0, 3).map(conn => (
            <ConnRow
              key={conn.edgeId}
              edgeId={conn.edgeId}
              nodeKind={conn.connectedNodeKind}
              label={conn.connectedNodeLabel}
              confidencePct={conn.confidencePct}
            />
          ))}
          <ConnRowsOverflow total={inboundConnections.length} shown={3} />
        </>
      )}

      {/* Actionable: factor-specific wording. Graph v1.1 Task 4: removed the
          "Driven by factors outside your control" lead-in — the dashed border
          on the connected external factor already communicates that. */}
      {topFactor && (
        <>
          <Sep />
          <p className={`${typography.edgeLabel} text-text-body m-0`}>
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
      {/* Polish 4 review: removed the "Are there other risks?" /
          "What's the worst case?" chips. The body now carries the canonical
          pair ("What reduces this?" + "Add mitigation") in both phases — the
          audit table allows max 2 chips per node and stacking another 2 in
          the popover would push the total to 4. */}
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
        data={cleanedData}
        nodeType="risk"
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

        {/* Post-analysis: "30%" (semibold entity colour) + "goal drag" (meta) */}
        {isPostAnalysis && bridgeEdgeData?.contributionPct != null && (
          <div className="mt-1 inline-flex items-center gap-1">
            <span className={`${typography.nodeLabel} font-semibold text-danger`}>{bridgeEdgeData.contributionPct}%</span>
            <span className={`${typography.edgeLabel} text-text-light`}>goal drag</span>
          </div>
        )}

        {/* Pre-analysis: assumed strength percentage */}
        {!isPostAnalysis && bridgeEdgeData?.bridgeStrengthPct != null && (
          <div className="mt-1 inline-flex items-center gap-1">
            <span className={`${typography.nodeLabel} font-semibold text-danger`}>{bridgeEdgeData.bridgeStrengthPct}%</span>
            <span className={`${typography.edgeLabel} text-text-light`}>assumed strength</span>
          </div>
        )}

        {/* Coaching chips moved to popovers — see `riskChips` useMemo above
            and the popover branches at the bottom of this file. In Detailed
            view they appear inline beneath layer-2 content. */}

        {/* ===== LAYER 2: Detailed inline (only in Detailed view) =====
            Graph v1.1 Task 4: align with wireframe v4. Severity badge is a
            state indicator (not coaching text) so it's retained alongside the
            percentage + chips already in Layer 1. */}
        {isDetailed && detailedMetrics}
        {isDetailed && layer2ContentPost}

        {/* Detailed pre-analysis: inbound factor list — max 3 whole rows in
            the card, remainder disclosed (audit §8 P0-5 containment). */}
        {isDetailed && !isPostAnalysis && preAnalysisInbound.length > 0 && (
          <>
            <Sep />
            <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5`}>Driven by:</p>
            {preAnalysisInbound.slice(0, 3).map((item, i) => (
              <div key={i} className={`${typography.edgeLabel} text-text-light m-0 flex justify-between gap-2`}>
                <span className="truncate">{item.nodeLabel}</span>
                <span className={`${typography.nodeLabel} font-semibold shrink-0`}>{item.strengthPct}%</span>
              </div>
            ))}
            <ConnRowsOverflow total={preAnalysisInbound.length} shown={3} />
          </>
        )}

        {/* Detailed view: coaching chips inline (Standard renders them in
            the popovers below). */}
        {isDetailed && riskChips}

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
          anchorRef={nodeElRef}
        >
          {detailedMetrics}
          {layer2ContentPost}
          {riskChips}
        </NodePopover>
      )}

      {/* ===== LAYER 2: Popover (Standard view, pre-analysis, desktop hover) =====
          Always renders in pre-analysis Standard so the coaching chips have
          a home, even when there are no inbound factors yet. */}
      {!isDetailed && !isPostAnalysis && (
        <NodePopover
          visible={showPopover}
          width={240}
          onMouseEnter={popoverHandlers.onMouseEnter}
          onMouseLeave={popoverHandlers.onMouseLeave}
          anchorRef={nodeElRef}
        >
          {preAnalysisPopoverContent}
          {riskChips}
        </NodePopover>
      )}
    </div>
  )
})

RiskNode.displayName = 'RiskNode'
