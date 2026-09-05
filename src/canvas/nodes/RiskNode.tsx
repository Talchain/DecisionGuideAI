import { memo, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import type { RiskImpact } from '../domain/nodes'
import { calculateRiskSeverity, getRiskSeverityColors, cleanDisplayLabel } from '../utils/graphDisplayCalculations'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { METRIC_NOUN, METRIC_UNSET } from './shared/metricVocabulary'
import { composeCounterfactualQuestion } from './shared/counterfactualQuestion'
import { resolveEdgeSignedStrengthDisplay, edgeValueSource } from '../domain/edgeValueProvenance'
import { strengthIsHumanSettled } from '../domain/edgeStrengthSettlement'

import { useNodeConnections } from '../hooks/useNodeConnections'
import { usePreAnalysisInbound } from '../hooks/usePreAnalysisInbound'
import { usePopoverHover } from '../hooks/usePopoverHover'
import { useScienceIcons } from '../hooks/useScienceIcons'
import { ConnRow, ConnRowsOverflow, Sep, NodeChip, NodePopover, ScienceIcon, PreAnalysisInboundRows, PreAnalysisDrivenByLine } from './shared'
import { useGuidanceStore } from '../stores/guidanceStore'
import { NodeMetricRow, unconfirmedStrengthDisclosure } from './shared'

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
     * THIS STRENGTH? — and it does NOT answer it here.
     *
     * ⚠⚠ CORRECTED 3 Sep 2026, AND THE CORRECTION IS THE WHOLE POINT. This line
     * read `weightSource === 'user'`, and the paragraph here defended that as
     * "the one question this row asks: did a human SET this strength". It was
     * the wrong field for the sentence beside it. `weightSource` answers *whose
     * number is this?*; the row's copy claims *nobody has set it*. Those are
     * different questions (CLAUDE.md trap 21), and they DIVERGE on a state a
     * live affordance produces: `ContestedEdgeCard`'s "Accept review" →
     * `ModelTabBody.handleResolveContested` stamps `weightSource: 'cee'`
     * deliberately (the value IS the producer's) while recording the user's
     * adjudication in `validation`. The card therefore told a user who had just
     * settled this strength that nobody had.
     *
     * ⛔ AND THE REMEDY IS NOT TO READ TWO FIELDS HERE. That would be a second
     * answer to a question `selectAssumedStrengthToResolve` already owns, free
     * to drift. `strengthIsHumanSettled` is the ONE admission both consume.
     *
     * ⚠ SCOPE BOUNDARY, STATED SO THE NEXT LANE INHERITS IT RATHER THAN
     * REDISCOVERS IT. A producer strength that is genuinely MEASURED rather
     * than assumed is withheld by this predicate too. Nothing on the wire
     * distinguishes the two today — CEE stamps `'cee'` for both — so the CEE
     * lane that makes real strengths arrive must land a distinguishable
     * provenance, and `edgeStrengthSettlement.ts` is the single place to widen.
     */
    /**
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
  // and shared with OutcomeNode — see `usePreAnalysisInbound`.
  const { items: preAnalysisInbound, topSetItem: preAnalysisTopSet } = usePreAnalysisInbound(props.id)

  // Top factor for actionable guidance
  const topFactor = inboundConnections.length > 0 ? inboundConnections[0] : null

  // The counterfactual affordance's ONE sentence — rendered AND sent. Null when
  // there is no top factor, or its label is blank: no affordance rather than a
  // degenerate question.
  const counterfactualQuestion = composeCounterfactualQuestion(topFactor?.connectedNodeLabel)

  // Coaching chips — same pair in both phases. Body never renders chips
  // directly; they live in popovers (Standard) or inline in Detailed view.
  const riskChips = useMemo(() => (
    <div className="flex gap-1 flex-wrap mt-1.5">
      <NodeChip chipId="risk_what_reduces" actionType={null} label="What reduces this?" message={`What factors or actions could reduce ${cleanedLabel || 'this risk'}?`} />
      <NodeChip chipId="risk_add_mitigation" actionType={null} label="Add mitigation" message={`Suggest a mitigation strategy for ${cleanedLabel || 'this risk'}`} />
    </div>
  ), [cleanedLabel])

  // Severity badge — derived from node probability × impact via calculateRiskSeverity
  // (the existing probability×impact derivation, reused not re-added). P1.7: now
  // rendered in the always-visible Standard body (Layer 1), not Expert/popover-only.
  const detailedMetrics = severity ? (
    <div
      // The `textAlign: 'center'` that was here is gone. This div carries no
      // `inline-flex`, no `w-fit` and no width, so it is a full-bleed block
      // inside the card: the badge text sat centred while every other line of
      // the node was left-aligned.
      className={`${severityColors.bg} ${severityColors.border} ${severityColors.text} border rounded px-1.5 py-0.5 ${typography.edgeLabel} mb-1`}
    >
      {severity.charAt(0).toUpperCase() + severity.slice(1)} Risk
    </div>
  ) : null

  // The defining probability × impact pair (P1.7). Honest absence: each half only
  // renders when its value exists — never a fabricated 0% or default impact. The
  // percentage is display formatting of the 0-1 probability (same untagged pattern
  // as confidence display in lib/format.ts), not a semantic transform.
  const probabilityPct = typeof probability === 'number' ? Math.round(probability * 100) : null
  const exposureReadout = [
    probabilityPct != null ? `${probabilityPct}% likely` : null,
    impact ? `${impact.charAt(0).toUpperCase()}${impact.slice(1)} impact` : null,
  ].filter(Boolean).join(' · ')
  const riskExposureLine = exposureReadout ? (
    <div className={`${typography.edgeLabel} text-text-light mt-1`}>{exposureReadout}</div>
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
      {/* ⛔ ONE STRING. `counterfactualQuestion` is read by BOTH the label and
          the message — see that module for why. This block previously rendered
          the subject sliced to 18 chars INSIDE the sentence while sending the
          full one, so the user read one question and asked another. Do not
          re-introduce a slice here; if the line is too long, that is CSS. */}
      {counterfactualQuestion && (
        <>
          <Sep />
          <p className={`${typography.edgeLabel} text-text-body m-0`}>
            <button
              type="button"
              className={`${typography.edgeLabel} text-info underline cursor-pointer nodrag nopan`}
              onClick={(e) => {
                e.stopPropagation()
                const send = useGuidanceStore.getState()._sendMessage
                if (send) send(counterfactualQuestion)
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {counterfactualQuestion}
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
            (the assumed drag toward the goal), not an engine-computed
            contribution. It previously flipped its label from "assumed
            strength" to "goal drag" the moment results.status became
            'complete' — masquerading an un-computed input as a computed
            goal contribution without any producer attribution behind it.
            Removal trigger: a producer supplies a typed per-node
            goal-attribution field.

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
            `Strength 50% est.`, each with a bar exactly half full — figures the
            DRAFTING MODEL supplied, which no human had settled. (Round 1 read
            that 0.5 as `DEFAULT_EDGE_DATA.weight`. Refuted: an unstamped default
            cannot reach this row at all. Canonical record —
            `shared/metricVocabulary.ts`.) The `est.`-beside-the-figure
            branch is gone; where nobody set the weight there is no figure. */}
        {bridgeEdgeData && (
          /* ⭐ TWO ROWS, ONE CAPTION COLUMN — AND THE BAR IS THE THING THAT MOVES.

             A proportional bar is measurement grammar: it is the same visual
             scale an option's COMPUTED win share uses two cards along, and a
             half-full one says "assessed, and middling". The five cards that
             prompted this drew exactly that bar for the DRAFTING MODEL'S own
             0.5 — a figure something DID supply, and no human had settled.

             ⚠ NOT a bare `DEFAULT_EDGE_DATA.weight`, which is what round 1
             claimed and is REFUTED: the default carries no provenance stamp, so
             `resolveEdgeSignedStrengthDisplay` returns `{show:false}` and the
             pre-PR gate rendered NO ROW. For `Strength 50%` to appear a wire
             value must have arrived. Canonical record, including why the
             flattening is modal (4 of 12 draws) rather than constant:
             `shared/metricVocabulary.ts`.

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
              fillClass="bg-danger"
              testId="risk-strength-row"
            />
          ) : (
            <NodeMetricRow
              label={METRIC_NOUN.strength}
              value={null}
              unsetText={METRIC_UNSET.standalone}
              testId="risk-strength-row"
              title={unconfirmedStrengthDisclosure(bridgeEdgeData.assumedPct, bridgeEdgeData.assumedSource)}
              phrase={unconfirmedStrengthDisclosure(bridgeEdgeData.assumedPct, bridgeEdgeData.assumedSource)}
            />
          )
        )}

        {/* Severity badge + probability × impact pair — visible in STANDARD view
            (P1.7). Both are derived/read straight from node data; no fabrication
            when data is absent. */}
        {detailedMetrics && <div className="mt-1">{detailedMetrics}</div>}
        {riskExposureLine}

        {/* Coaching chips moved to popovers — see `riskChips` useMemo above
            and the popover branches at the bottom of this file. In Detailed
            view they appear inline beneath layer-2 content. */}

        {/* ===== LAYER 2: Detailed inline (only in Detailed view) =====
            Graph v1.1 Task 4: align with wireframe v4. The severity badge now
            lives in Layer 1 (Standard-visible, P1.7) so it is NOT repeated here. */}
        {isDetailed && layer2ContentPost}

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
          {/* Severity badge lives in Layer 1 (Standard-visible, P1.7) — the popover
              carries only the post-analysis detail + coaching chips. */}
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
