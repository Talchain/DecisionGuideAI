import { memo, useMemo, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { resolveEdgeSignedStrengthDisplay } from '../domain/edgeValueProvenance'

import { useNodeConnections } from '../hooks/useNodeConnections'
import { usePreAnalysisInbound } from '../hooks/usePreAnalysisInbound'
import { usePopoverHover } from '../hooks/usePopoverHover'
import { useScienceIcons } from '../hooks/useScienceIcons'
import { ConnRow, ConnRowsOverflow, Sep, NodeChip, NodePopover, ScienceIcon, PreAnalysisInboundRows, PreAnalysisDrivenByLine } from './shared'
import { useGuidanceStore } from '../stores/guidanceStore'
import { GOAL_FIT_BASIS_CAVEAT_COPY } from '../../components/results/utils/goalFitBasisCaveatCopy'

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
    // ⛔ Provenance gate. The previous test — `strength_mean` present OR
    // `weight != null` — could NOT fire: `DEFAULT_EDGE_DATA`/`USER_EDGE_DEFAULTS`
    // always define `weight`, so `hasStrength` was true for every edge that
    // exists in the product and this rendered `USER_EDGE_DEFAULTS.weight` (0.3)
    // as a bold coloured "contribution" figure. Same shape as the F1 defect in
    // `RelationshipsSection`: a gate whose condition is a tautology.
    const display = resolveEdgeSignedStrengthDisplay(edge.data as Record<string, unknown> | undefined)
    const signedMean = display.show ? display.value : null
    return {
      signedMean,
      bridgeStrengthPct: signedMean != null ? Math.round(Math.abs(signedMean) * 100) : null,
    }
  }, [edges, nodes, props.id])

  // ConnRow data: "Depends on:" — inbound edges from factors (post-analysis only)
  const inboundConnections = useNodeConnections(props.id, 'inbound')

  // Pre-analysis inbound edges with strengths (for popover). Provenance-gated
  // and shared with RiskNode — see `usePreAnalysisInbound`.
  const { items: preAnalysisInbound, topSetItem: preAnalysisTopSet } = usePreAnalysisInbound(props.id)

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
          {/* Wireframe v4 OutcomePostDet: max 3 ConnRows in both views;
              remainder disclosed via "+N more in inspector" (audit §8 P0-5). */}
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
      <PreAnalysisDrivenByLine items={preAnalysisInbound} topSetItem={preAnalysisTopSet} />
      <PreAnalysisInboundRows items={preAnalysisInbound.slice(0, 5)} />
      {/* Polish 4 review: removed the "Are there other outcomes that matter?"
          chip — the body now carries the canonical "What strengthens this?"
          chip and the audit table allows only one chip per outcome node. */}
    </>
  ) : null

  // Coaching chip (pre-analysis only) — moved out of body. Lives in the
  // pre-analysis popover (Standard) or inline in Detailed view.
  const outcomeChips = useMemo(() => {
    if (isPostAnalysis) return null
    return (
      <div className="flex gap-1 flex-wrap mt-1.5">
        <NodeChip
          chipId="outcome_what_strengthens"
          actionType={null}
          label="What strengthens this?"
          message={`What upstream factors strengthen ${(props.data?.label as string) ?? 'this outcome'}?`}
        />
      </div>
    )
  }, [isPostAnalysis, props.data])

  // Achievement metric (Detailed view) — diagnostic indicator distinct from
  // the Layer 1 contribution percentage (which is bridge weight to goal).
  const detailedMetrics = displayMetadata.achievementProbability !== null ? (
    <>
      <Sep />
      <p className={`${typography.edgeLabel} text-text-body m-0`}>
        Achievement: {Math.round(displayMetadata.achievementProbability * 100)}%
      </p>
      {/* Display-honesty (ROADMAP 1.6b tail — goal-fit caveat residuals): the
          achievement-probability number above is scored from a MODELLED
          forward-propagated outcome distribution, not a directly-elicited
          base — same gate + shared wording as GoalNode/OptionCards'
          caveat (GOAL_FIT_BASIS_CAVEAT_COPY), rendered adjacent to the
          number it qualifies, never separately, never invented. */}
      {displayMetadata.achievementProbabilityIsModelledBasis === true && (
        <p
          className={`${typography.edgeLabel} text-text-light m-0`}
          data-testid="goal-fit-basis-caveat-outcome-node"
        >
          {GOAL_FIT_BASIS_CAVEAT_COPY}
        </p>
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

        {/* Assumed bridge-strength percentage — honest in ALL states.
            UI-SEM-089 (display honesty — assumed input never presented as
            computed output): this number is the STATIC graph edge weight
            (the user's / CEE's assumed strength toward the goal), not an
            engine-computed contribution. It previously flipped its label
            from "assumed strength" to "of your goal" the moment
            results.status became 'complete' — masquerading an un-computed
            input as a computed goal contribution without any producer
            attribution behind it. Kept as "assumed strength" pre- AND
            post-analysis. Removal trigger: a producer supplies a typed
            per-node goal-attribution field. */}
        {bridgeEdgeData?.bridgeStrengthPct != null && (
          <div className="mt-1 inline-flex items-center gap-1">
            <span className={`${typography.nodeLabel} font-semibold text-success`}>{bridgeEdgeData.bridgeStrengthPct}%</span>
            <span className={`${typography.edgeLabel} text-text-light`}>assumed strength</span>
          </div>
        )}

        {/* Coaching chip moved to popover — see `outcomeChips` useMemo and
            popover branches below. In Detailed view it appears inline beneath
            the pre-analysis driver list. */}

        {/* ===== LAYER 2: Detailed inline (only in Detailed view) =====
            Graph v1.1 Task 4: align with wireframe v4 OutcomePostDet —
            percentage (Layer 1), separator, "Depends on:" ConnRows (max 3),
            separator, one Strengthen action. The achievement metric is a
            distinct diagnostic (probability of the outcome occurring at all,
            not the goal-bridge contribution shown in Layer 1) so it stays. */}
        {isDetailed && layer2ContentPost}
        {isDetailed && detailedMetrics}

        {/* Detailed pre-analysis: inbound factor list — max 3 whole rows in
            the card, remainder disclosed (audit §8 P0-5 containment). */}
        {isDetailed && !isPostAnalysis && preAnalysisInbound.length > 0 && (
          <>
            <Sep />
            <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5`}>Driven by:</p>
            <PreAnalysisInboundRows items={preAnalysisInbound.slice(0, 3)} />
            <ConnRowsOverflow total={preAnalysisInbound.length} shown={3} />
          </>
        )}

        {/* Detailed pre-analysis: coaching chip inline (Standard renders it
            in the popover below). */}
        {isDetailed && outcomeChips}

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

      {/* ===== LAYER 2: Popover (Standard view, pre-analysis, desktop hover) =====
          Always renders in pre-analysis Standard so the coaching chip has a
          home, even when there are no inbound factors yet. */}
      {!isDetailed && !isPostAnalysis && (
        <NodePopover
          visible={showPopover}
          width={240}
          onMouseEnter={popoverHandlers.onMouseEnter}
          onMouseLeave={popoverHandlers.onMouseLeave}
          anchorRef={nodeElRef}
        >
          {preAnalysisPopoverContent}
          {outcomeChips}
        </NodePopover>
      )}
    </div>
  )
})

OutcomeNode.displayName = 'OutcomeNode'
