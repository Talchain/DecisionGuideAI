import { memo, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'

import { useNodeConnections } from '../hooks/useNodeConnections'
import { usePreAnalysisInbound } from '../hooks/usePreAnalysisInbound'
import { usePopoverHover } from '../hooks/usePopoverHover'
import { useScienceIcons } from '../hooks/useScienceIcons'
import { ConnRow, ConnRowsOverflow, Sep, NodePopover, ScienceIcon, PreAnalysisInboundRows, PreAnalysisDrivenByLine } from './shared'
import { CoachingChipRow } from './coaching/CoachingChipRow'
import { resolveNodeCoaching } from './coaching/resolveNodeCoaching'
import { cleanDisplayLabel } from '../utils/graphDisplayCalculations'

export const OutcomeNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.outcome
  /**
   * ⭐⭐ NOT READ ANY MORE, AND THAT IS A FINDING RATHER THAN A TIDY-UP.
   *
   * `useNodeDisplayMetadata` was subscribed here for EXACTLY ONE consumer: the
   * `Goal chance: N%` block removed below. With that gone, `eslint` reported the
   * binding unused — i.e. **the outcome card's entire connection to analysis
   * metadata existed to render a figure belonging to the goal.**
   *
   * That corroborates the measured producer coverage from the other direction:
   * 15 of 15 outcome nodes carry provenance and nothing else, so there was never
   * an outcome-scoped number in that hook for this card to read. The subscription
   * is dropped rather than silenced, which also drops a store subscription per
   * outcome node.
   */
  const cleanedLabel = cleanDisplayLabel(typeof props.data?.label === 'string' ? props.data.label : undefined)
  const description = typeof props.data?.description === 'string' && props.data.description.trim() ? props.data.description : null
  const body = typeof props.data?.body === 'string' && props.data.body.trim() ? props.data.body : null
  const summary = description ?? body
  // Compose only the display copy: both authored fields stay available through
  // the existing chevron, while the canonical node and Ask context stay intact.
  const fullDescription = description && body && body.trim() !== description.trim()
    ? `${description}\n\n${body}`
    : summary
  const cleanedData = { ...props.data, label: cleanedLabel || 'Untitled outcome', description: fullDescription ?? undefined }
  const outcomeContext = fullDescription ? `\nOutcome context: ${fullDescription}` : ''

  const resultsStatus = useCanvasStore(state => state.results.status)
  const viewMode = useCanvasStore(state => state.viewMode)
  const isPostAnalysis = resultsStatus === 'complete'
  const isDetailed = viewMode === 'expert'

  // Popover hover
  const { showPopover, nodeHandlers, popoverHandlers, nodeElRef } = usePopoverHover()

  // Science icons (spec Section 4.1)
  const scienceIcons = useScienceIcons(props.id, 'outcome')

  /**
   * ⛔ NO LINK-STRENGTH ROW AND NO OPTION-REACH COUNT, AT ANY RUNG — contract
   * v3.1 (VC-01): "Outcome/risk records are distinct from the strength of
   * their connections", and pt 8 drops "N options connect/move this" unless it
   * genuinely differentiates (the v3.1 fixture removes it from every outcome;
   * served as gaps U1 + U2, 24 Sep). Strength is the CONNECTION's fact: its
   * line, hover and inspector carry it. Supersedes UI-SEM-089's on-card
   * "assumed strength" readout — with no readout there is nothing left to
   * masquerade as a computed contribution. No `lodMetric` is declared: this
   * card owns no reduced line, and `resolveLodMetricLine`'s outcome arm
   * withholds too (it held the goal's chance, not this outcome's).
   */

  // ConnRow data: "Depends on:" — inbound edges from factors (post-analysis only)
  const inboundConnections = useNodeConnections(props.id, 'inbound')

  // Pre-analysis inbound edges with strengths (for popover). Provenance-gated
  // and shared with RiskNode — see `usePreAnalysisInbound`.
  const { items: preAnalysisInbound, topSetItem: preAnalysisTopSet } = usePreAnalysisInbound(props.id)

  // Top factor for actionable guidance
  const topFactor = inboundConnections.length > 0 ? inboundConnections[0] : null

  const factorLabel = topFactor?.connectedNodeLabel.trim()
  const validateQuestion = factorLabel
    ? `How can I validate my assumption about ${factorLabel} and its effect on ${cleanedLabel || 'this outcome'}?${outcomeContext}`
    : null

  // ----- Layer 2 content: post-analysis (shared between popover and Detailed inline) -----
  const layer2ContentPost = isPostAnalysis ? (
    <>
      {/* "Depends on:" ConnRows (max 3 Standard, max 5 Detailed) */}
      {inboundConnections.length > 0 && (
        <>
          <Sep />
          <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5`}>Depends on:</p>
          {/* Wireframe v4 OutcomePostDet: max 3 ConnRows in both PHASE views (pre-/post-analysis —
              NOT standard/detailed; this block is detailed-view only, see FactorNode.tsx:688);
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
      {validateQuestion && (
        <>
          <Sep />
          <p className={`${typography.edgeLabel} text-text-body m-0 mb-1 break-words`}>
            Test the connection from {factorLabel}
          </p>
          {/* ⚠ `className={null}` — pristine rendered this chip BARE beneath its
              own <p>, with no flex row. See CoachingChipRow's docblock. */}
          <CoachingChipRow
            className={null}
            chips={resolveNodeCoaching({
              kind: 'outcome',
              surface: 'validate',
              state: { isPostAnalysis },
              context: { label: cleanedLabel, outcomeContext, validateQuestion },
            })}
          />
        </>
      )}
    </>
  ) : null

  // ----- Layer 2 content: pre-analysis popover -----
  const preAnalysisPopoverContent = !isPostAnalysis && preAnalysisInbound.length > 0 ? (
    <>
      <PreAnalysisDrivenByLine items={preAnalysisInbound} topSetItem={preAnalysisTopSet} />
      <PreAnalysisInboundRows items={preAnalysisInbound.slice(0, 5)} />
    </>
  ) : null

  // Existing coaching route, with authored context and a consequence question in both phases.
  /**
   * ⭐ THE FALSIFICATION QUESTION REACHES THE CARD, AND SURVIVES THE RUN.
   *
   * Two separate reasons it was unreachable, and this fixes both.
   *
   * 1. LOCATION. In Standard view (the default) every chip lived in a hover
   *    popover, and `NodePopover.tsx:129` is `if (!visible) return null` — so
   *    the children are ABSENT FROM THE DOM, not merely invisible. Measured on
   *    deployed `9748b336` in the resting state: `What would falsify` **0**,
   *    with 71 `react-flow__node` and 26 `Influence` as contrast controls in
   *    the same probe.
   *
   * 2. PHASE. `outcome_what_would_falsify` was gated `!isPostAnalysis`, so
   *    running the analysis DELETED it. That is backwards: an outcome is worth
   *    falsifying most once the model has produced a number for it. Nothing
   *    else claims this surface — `DecisionNode` is the one node whose
   *    post-analysis Standard body is contested (its `restingState.spec`), and
   *    that node is deliberately untouched here.
   *
   * ⚠ THE SUITE COULD NOT SEE EITHER PROBLEM. `render-matrix.spec.tsx:66-70`
   * mocks `NodePopover` into an always-rendering div, so assertions about
   * "Standard" chips were passing against content behind a 300ms hover.
   *
   * `Explore consequences` and `What affects this?` stay in the popover, so the
   * promoted question is never rendered twice. Detailed view is unchanged.
   */
  const outcomeCoachingContext = useMemo(
    () => ({ label: cleanedLabel, outcomeContext }),
    [cleanedLabel, outcomeContext],
  )
  const outcomeCoachingState = useMemo(() => ({ isPostAnalysis }), [isPostAnalysis])

  const outcomeFaceCoaching = useMemo(
    () => resolveNodeCoaching({ kind: 'outcome', surface: 'card', state: outcomeCoachingState, context: outcomeCoachingContext }),
    [outcomeCoachingState, outcomeCoachingContext],
  )

  const outcomePopoverChips = useMemo(() => (
    <CoachingChipRow
      className="flex gap-1 flex-wrap mt-1.5"
      chips={resolveNodeCoaching({ kind: 'outcome', surface: 'popover', state: outcomeCoachingState, context: outcomeCoachingContext })}
    />
  ), [outcomeCoachingState, outcomeCoachingContext])

  // Detailed view keeps the full set inline. The falsification question is no
  // longer phase-gated here either — same reason as above.
  const outcomeChips = useMemo(() => (
    <CoachingChipRow
      className="flex gap-1 flex-wrap mt-1.5"
      chips={resolveNodeCoaching({ kind: 'outcome', surface: 'detailed', state: outcomeCoachingState, context: outcomeCoachingContext })}
    />
  ), [outcomeCoachingState, outcomeCoachingContext])

  /**
   * ⛔⛔ `Goal chance: N%` IS GONE FROM THE OUTCOME CARD (17 Sep 2026), AND THE
   * REASON IS THAT TWO COMMENTS IN THIS FILE SAID OPPOSITE THINGS ABOUT ONE
   * NUMBER WHILE THE USER READ A THIRD.
   *
   * Above the block, the honest one: *"This existing Detailed-only field is the
   * analysis goal probability, **not an outcome-specific forecast**."*
   * At the mount site, the other: *"The achievement metric is a distinct
   * diagnostic (**probability of the outcome occurring at all**, not the
   * goal-bridge contribution shown in Layer 1) so it stays."*
   * On screen, a third: **`Goal chance: 62%`**, on a card named for an outcome.
   *
   * ⭐ SETTLED AT THE PRODUCER RATHER THAN BY PICKING A COMMENT
   * (`hooks/useNodeDisplayMetadata.ts:484-516`):
   *
   *     const recommendedOptionId = report.robustness?.recommended_option_id
   *     const rec = optionProbabilities[recommendedOptionId]
   *     achievementProbability = selectGoalProbability(rec).goalProbability
   *
   * It is **the recommended OPTION's probability of achieving THE GOAL**. There
   * is no outcome id anywhere in that read. ⇒ the first comment is right, the
   * second is false, and — the part that decides this — **the figure is
   * identical on every outcome card in the model**, because nothing about it is
   * scoped to the node it was drawn on.
   *
   * ⛔ THAT MAKES IT THREE VIOLATIONS AT ONCE, NOT A WORDING PROBLEM:
   *  · **Rule 6** — *"a card may not display a metric the product does not
   *    produce."* Measured coverage for the outcome kind is **provenance only**:
   *    15 of 15 outcome nodes carry a name, a kind and a stamp and nothing else.
   *    No unit, no value, no effect.
   *  · **The anatomy** — position 2 is *"what the model records"* **about this
   *    node**. This records nothing about this node.
   *  · **Paul's standing ruling** — *"saying the same copy on every node is a
   *    waste of space"*. Identical number AND identical label, on every outcome.
   *
   * ⭐ NOTHING IS LOST, WHICH IS WHY THIS IS A DELETION AND NOT A RELABEL.
   * `GoalNode` already renders this exact figure, through this exact selector,
   * on the node it actually belongs to, with `GOAL_FIT_BASIS_CAVEAT_COPY`
   * beside it. The outcome card was a second, unscoped copy of the goal's own
   * number. A relabel — *"the recommended option's chance of reaching the
   * goal"* — would be TRUE and still wrong here: it would put a sentence about
   * the goal and an option onto a third node's card, and repeat it fifteen
   * times.
   *
   * ⚠ THE CAVEAT MACHINERY IS NOT WEAKENED, it is no longer needed HERE.
   * `achievementProbabilityIsModelledBasis` and `GOAL_FIT_BASIS_CAVEAT_COPY`
   * remain live on `GoalNode`, `OptionNode` and `GoalPanel`, which is where the
   * shared rule *"surfaces rendering the number MUST render the caveat
   * alongside it"* still binds. One fewer surface rendering the number is one
   * fewer surface that can drift out of step with it.
   *
   * ⚠ HEIGHT MOVES DOWN, NOT UP: a `Sep` plus one or two lines leave the
   * Detailed outcome card. Nothing else on any card changes, and no default-view
   * card changes at all — this block was `isDetailed`-only.
   */

  return (
    <div
      ref={nodeElRef as React.Ref<HTMLDivElement>}
      style={{ position: 'relative' }}
      onMouseEnter={nodeHandlers.onMouseEnter}
      onMouseLeave={nodeHandlers.onMouseLeave}
      /* The TAP path. A no-op on a pointer device (`usePopoverHover` gates it
         on `hover: none`); on touch it is the only way this node preview can
         be opened at all. It does not stopPropagation, so the tap still
         selects the node. */
      onClick={nodeHandlers.onClick}
    >
      <BaseNode
        {...props}
        data={cleanedData}
        nodeType="outcome"
        icon={metadata.icon}
        coaching={outcomeFaceCoaching}
        headerSlot={isDetailed && scienceIcons.length > 0 ? (
          <span className="inline-flex items-center gap-1">
            {scienceIcons.map(si => (
              <ScienceIcon key={si.id} icon={si.icon} tooltip={si.tooltip} action={si.action} colour={si.colour} />
            ))}
          </span>
        ) : undefined}
      >
        {/* Authored consequence; the existing chevron retains its full description. */}
        {summary && (
          <p className={`${typography.nodeLabel} text-text-light m-0 mb-1 line-clamp-2 break-words whitespace-pre-wrap group-aria-expanded:hidden`} data-testid="outcome-context-preview">
            {summary}
          </p>
        )}

        {/* ===== LAYER 1: Standard body (always visible) ===== */}

        {/* ⛔ No link-strength row and no option-reach line (contract v3.1 —
            see the note above `inboundConnections`). */}

        {/* The falsification question rides the CARD in Standard view, in both
            phases. The remaining chips stay in the popover; Detailed renders
            the full set inline below. See `outcomeFaceChip`. */}
        {/* ⛔ NO COACHING CHIP ON THE FACE (ED 11:52Z point 5: "move the repeated
            coaching prompts behind the one coaching affordance"). The card's
            question is the rail's coaching icon (`coaching` on BaseNode). */}

        {/* ===== LAYER 2: Detailed inline (only in Detailed view) =====
            Graph v1.1 Task 4: align with wireframe v4 OutcomePostDet —
            percentage (Layer 1), separator, "Depends on:" ConnRows (max 3),
            separator, one Strengthen action.

            ⛔ THIS COMMENT USED TO END: "The achievement metric is a distinct
            diagnostic (probability of the outcome occurring at all, not the
            goal-bridge contribution shown in Layer 1) so it stays." That is
            REFUTED at the producer — see the block above `return` for the
            derivation — and the metric no longer renders here. The sentence is
            quoted rather than deleted because it is the reason the figure
            survived on this card for as long as it did. */}
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
          {outcomePopoverChips}
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
          {outcomePopoverChips}
        </NodePopover>
      )}
    </div>
  )
})

OutcomeNode.displayName = 'OutcomeNode'
