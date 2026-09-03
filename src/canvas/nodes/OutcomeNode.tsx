import { memo, useMemo, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { METRIC_NOUN, METRIC_UNSET } from './shared/metricVocabulary'
import { resolveEdgeSignedStrengthDisplay, edgeValueSource } from '../domain/edgeValueProvenance'
import { strengthIsHumanSettled } from '../domain/edgeStrengthSettlement'

import { useNodeConnections } from '../hooks/useNodeConnections'
import { usePreAnalysisInbound } from '../hooks/usePreAnalysisInbound'
import { usePopoverHover } from '../hooks/usePopoverHover'
import { useScienceIcons } from '../hooks/useScienceIcons'
import { ConnRow, ConnRowsOverflow, Sep, NodeChip, NodePopover, ScienceIcon, PreAnalysisInboundRows, PreAnalysisDrivenByLine } from './shared'
import { useGuidanceStore } from '../stores/guidanceStore'
import { GOAL_FIT_BASIS_CAVEAT_COPY } from '../../components/results/utils/goalFitBasisCaveatCopy'
import { NodeMetricRow, unconfirmedStrengthDisclosure } from './shared'

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
    const assumedPct = signedMean != null ? Math.round(Math.abs(signedMean) * 100) : null
    // ⚠ WHO SUPPLIED THE FIGURE — needed only to NAME the assumer in the unset
    // row's disclosure, never to decide whether to draw it. `'template'` is a
    // real third author (`useBlueprintInsert`), so the sentence cannot hardcode
    // Olumi; `unconfirmedStrengthDisclosure` owns that wording.
    const assumedSource = edgeValueSource(edge.data as Record<string, unknown> | undefined, 'weight')
    /**
     * ⛔ THE ONE QUESTION THIS ROW ASKS: HAS A HUMAN ACCEPTED RESPONSIBILITY FOR
     * THIS STRENGTH? — and it does NOT answer it here. `strengthIsHumanSettled`
     * (`canvas/domain/edgeStrengthSettlement.ts`) is the ONE admission, and that
     * module carries the full reasoning — including the render-witnessed
     * divergence that forced it and why `resolved_by === 'user'` is too wide.
     * It is deliberately not restated here: this card and `RiskNode` ask the
     * same question, so they must not carry two copies of the answer.
     *
     * ⚠⚠ THIS LINE READ `weightSource === 'user'` UNTIL 3 Sep 2026. That is
     * VALUE provenance — *whose number is this?* — while the row's copy claims
     * *nobody has set it*, a claim about a PERSON'S ACT. Two questions under one
     * predicate (CLAUDE.md trap 21), diverging on a state a live affordance
     * produces.
     *
     * ⚠ SCOPE BOUNDARY, STATED SO THE NEXT LANE INHERITS IT RATHER THAN
     * REDISCOVERS IT. A producer strength that is genuinely MEASURED rather
     * than assumed is withheld by this predicate too. Nothing on the wire
     * distinguishes the two today, so the lane that makes real strengths arrive
     * must land a distinguishable provenance, and `edgeStrengthSettlement.ts` is
     * the single place to widen.
     *
     * ⚠ A DISCRIMINATED UNION, NOT TWO NULLABLE FIELDS. The settled arm's
     * `bridgeStrengthPct` is `number`, so the render site cannot reach for a
     * `?? 0` fallback — the previous shape carried one, and an unreachable
     * fallback that would silently draw a 0% bar is exactly the "measured, and
     * it is nought" claim this row refuses to make.
     */
    if (assumedPct !== null && strengthIsHumanSettled(edge.data as Record<string, unknown> | undefined)) {
      /** The figure to DRAW. Present only where a human has settled it. */
      return {
        strengthIsSettled: true as const,
        bridgeStrengthPct: assumedPct,
        assumedPct: null,
        assumedSource: null,
      }
    }
    /** The figure to DISCLOSE — a producer's guess, or nothing at all. */
    return { strengthIsSettled: false as const, bridgeStrengthPct: null, assumedPct, assumedSource }
  }, [edges, nodes, props.id])

  /**
   * The reduced line this card keeps below the legibility floor.
   *
   * ⚠ BRIDGE STRENGTH, BECAUSE IT IS WHAT THIS CARD RELIABLY HAS. Measured on
   * deployed `30bd7f8c`: every risk and every outcome on a real guest model
   * rendered `strength · N% · est.` and NOTHING ELSE — no severity band, no
   * achievement probability. The central resolver asked for those two and lit
   * 0 of 3 risks and 0 of 3 outcomes, which is the very defect it was written to
   * fix (asking for the datum the node lacks) reproduced one type along.
   *
   * ⚠⚠ AND THE RULE THAT USED TO SIT HERE WAS RIGHT ABOUT THE PRINCIPLE AND
   * WRONG ABOUT THE REMEDY. It read: *"`est.` RIDES WITH THE NUMBER AND IS NOT
   * OPTIONAL… a bare 'Strength 50%' at low zoom would state as measured what
   * the card two zoom levels up states as estimated."* The principle is exact.
   * The remedy — keep the number, append a 7px marker — treated the disclaimer
   * as the fix when the FIGURE was the claim. Measured on a real canvas
   * (3 Sep 2026): five cards reading `Strength 50% est.` at once, each drawing a
   * bar exactly half full.
   *
   * ⚠⚠ THE REASON THAT USED TO END THAT PARAGRAPH — *"because 0.5 is
   * `DEFAULT_EDGE_DATA.weight`, the no-information default"* — IS WITHDRAWN AS
   * REFUTED. The canonical, measured root-cause record is in
   * `shared/metricVocabulary.ts` and is deliberately NOT restated here: round 1
   * of this change wrote the diagnosis out in five files and had it wrong in all
   * five, which is the hand-maintained mirror this estate keeps paying for.
   *
   * ⛔ SO THE LINE NOW STATES THE PROVENANCE INSTEAD OF QUALIFYING IT. Where a
   * human has SETTLED the weight there is a figure and no marker, exactly as
   * before. Where nobody has, there is no figure to qualify.
   */
  const lodMetric = useMemo(() => {
    if (!bridgeEdgeData) return null
    const pct = bridgeEdgeData.bridgeStrengthPct
    if (pct != null) return `${METRIC_NOUN.strength} ${pct}%`
    // The connection exists and nobody has said how strong it is. Saying so is
    // the same true thing the full card says, in the width one line allows.
    return `${METRIC_NOUN.strength} ${METRIC_UNSET.inline}`
  }, [bridgeEdgeData])

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
        {METRIC_NOUN.chance}: {Math.round(displayMetadata.achievementProbability * 100)}%
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
        lodMetric={lodMetric}
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
            attribution behind it. Removal trigger: a producer supplies a typed
            per-node goal-attribution field.

            ⚠ R6 REVISED AFTER REVIEW. The first attempt at R6 dropped the noun
            entirely and left a bare "85%", which re-opens exactly the defect
            UI-SEM-089 exists to close: an unlabelled percentage beside a goal
            reads as a computed contribution. Measured by the reviewer — the
            relabel-to-"% contribution" mutant REDs at base and SURVIVED at that
            head, i.e. the guard had been inverted from a PRESENCE assertion to
            an ABSENCE one and could no longer see the masquerade.

            The noun therefore stays on BOTH branches.

            ⚠⚠ AND THE SENTENCE THAT USED TO CLOSE THIS BLOCK IS WITHDRAWN AS OF
            3 Sep 2026, BECAUSE IT DESCRIBED A RENDERING THAT NO LONGER EXISTS
            AND DEFENDED ONE THAT SHOULD NOT HAVE. It read: *"What R6 actually
            removes is the word 'assumed'… '85% strength' when somebody set it,
            '85% strength · est.' when nobody did. The honesty claim and the
            placeholder-wall claim are different claims and both are satisfied."*
            Both claims were NOT satisfied. Collapsing "assumed" to a 7px `est.`
            left a full percentage and a proportional bar making the assessment
            claim, with the only qualification rendered as the smallest thing on
            the card. Measured on a real canvas: five cards reading
            `Strength 50% est.`, each with a bar exactly half full, for a value
            that is `DEFAULT_EDGE_DATA.weight`. The `est.`-beside-the-figure
            branch is gone; where nobody set the weight there is no figure. */}
        {/* ⭐ THE SHARED ROW, NOT A THIRD PRESENTATION OF THE SAME NUMBER.
            This rendered `70% strength · est.` — value first, no bar — while
            `RiskNode` rendered the SAME datum, from the SAME `bridgeEdgeData`
            seam, as `strength ▬▬▬ 70% est.`. One number, one meaning, two
            layouts, on cards a user compares side by side.

            Everything UI-SEM-089 requires is preserved and is now structural
            rather than repeated: the NOUN is the row's `label` and cannot go
            missing. The caption sits in the same 56px column as every other
            node type, and the next node type gets it for free instead of
            hand-copying it — which is how these three drifted apart in the
            first place.

            ⚠ CORRECTED 3 Sep 2026: this block used to add *"and the estimate
            marker rides `trailing` on the same condition it did before"*. It no
            longer does — `trailing` is empty on both branches, because a figure
            that needs `est.` beside it is a figure this row does not print. */}
        {bridgeEdgeData && (
          /* ⭐ TWO ROWS, ONE CAPTION COLUMN — AND THE BAR IS THE THING THAT MOVES.

             A proportional bar is measurement grammar: it is the same visual
             scale an option's COMPUTED win share uses two cards along, and a
             half-full one says "assessed, and middling". `DEFAULT_EDGE_DATA`
             pins `weight: 0.5`, so five cards on one canvas drew exactly that
             bar for a value nobody had ever supplied.

             ⛔ THE ROW IS NOT DELETED, AND THAT IS THE OTHER HALF OF THE FIX.
             An absent row reads as "nothing to see"; the reader needs to know
             the connection EXISTS and that its strength is an open question —
             one they can settle. The caption stays in the shared 3.5rem column
             on both branches, so a board still scans as one table.

             ⚠ THE PRODUCER'S NUMBER IS DEMOTED, NOT DELETED. It rides the
             `title` and the screen-reader phrase, stated as an assumption.
             `NodeMetricRow` requires BOTH carriers: a `title` is unreachable by
             keyboard on a non-focusable row and absent on touch. */
          bridgeEdgeData.strengthIsSettled ? (
            <NodeMetricRow
              label={METRIC_NOUN.strength}
              value={bridgeEdgeData.bridgeStrengthPct / 100}
              formatted={`${bridgeEdgeData.bridgeStrengthPct}%`}
              fillClass="bg-success"
              testId="outcome-strength-row"
            />
          ) : (
            <NodeMetricRow
              label={METRIC_NOUN.strength}
              value={null}
              unsetText={METRIC_UNSET.standalone}
              testId="outcome-strength-row"
              title={unconfirmedStrengthDisclosure(bridgeEdgeData.assumedPct, bridgeEdgeData.assumedSource)}
              phrase={unconfirmedStrengthDisclosure(bridgeEdgeData.assumedPct, bridgeEdgeData.assumedSource)}
            />
          )
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
