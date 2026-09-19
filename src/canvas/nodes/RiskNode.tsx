import { memo, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY, RiskNodeDataSchema } from '../domain/nodes'
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
import { nodeRecordedValue } from '../domain/nodeRecordedValue'

/**
 * ⭐⭐⭐ A THIN CARD MUST SAY THAT THE MODEL IS THIN, NOT LOOK LIKE A THIN TOOL.
 *
 * Paul's product ruling: *"We are a reasoning enhancement tool. If it doesn't
 * enhance critical and creative thinking, it has no value."* A board of cards
 * carrying a name and nothing else reads as *"this tool is empty"* when the
 * truth is *"this model is empty, and here is the next thing to put in it"*.
 * That is a coaching moment the product was throwing away.
 *
 * ⭐ MEASURED, NOT ARGUED — AND IT IS THE MODAL STATE, NOT AN EDGE CASE.
 * Across all five committed starters (`canvas/starters/data/*.draft.json`),
 * **14 of 14 risk nodes carry exactly `id`, `kind`, `label`, `provenance` and
 * nothing else.** No `probability`, no `impact`, no value of any kind. So the
 * card this branch renders is not a hypothetical — it is what every shipped
 * starter ships, on every risk.
 *
 *   ⚠ CONTRAST CONTROL, SAME SCAN, SAME FILES (an absence claim needs one —
 *   CLAUDE.md trap 13e): the 34 FACTOR nodes in those files carry six content
 *   keys between them — `category`, `display_value`, `encoding_map`,
 *   `extractionType`, `observed_state`, `prior`. The probe discriminates; the
 *   zero on risks is the data, not a blind instrument.
 *
 * ⭐⭐ WHY THE RISK CARD WAS THE ONE THAT SAID NOTHING. `BaseNode`'s
 * `isIncomplete` has arms for `factor`, `goal`, `decision` and `option`, then
 * `return false`. **`risk` and `outcome` have no arm at all**, so they can
 * never reach the `Needs input` StatusPill. Every other kind already has a
 * channel for this:
 *
 *     factor    `Needs input` pill + `Help me estimate this` chip
 *     goal      `Target not captured` (GOAL_NO_TARGET_STATE)
 *     option    `Not in this analysis` (CEE-stamped, selectOptionExclusionMessage)
 *     decision  `Needs input` via the !hasOptions arm
 *     risk      — nothing —
 *
 * And it is silent by CONSTRUCTION rather than by omission: `exposureReadout`
 * joins the two halves with `.filter(Boolean)`, so when neither exists the join
 * is `''`, `riskExposureLine` is `null`, and the card renders no row. The
 * "honest absence" that refuses to fabricate a `0%` also refuses to say that
 * nothing was recorded. This line is the second half of that honesty.
 *
 * ⛔ IT STATES A FACT ABOUT THE MODEL, NEVER A VERDICT ON THE RISK. *"Likelihood
 * and impact not set yet"* is a claim about what Olumi holds. *"This risk is
 * minor"* would be a claim about the world, and it is not ours to make — the
 * same boundary `TierInvitation`'s header draws when it refuses to say *"your
 * risks are thin"*. Nothing here reads the label, ranks the risk, or implies
 * that an unsized risk matters less than a sized one.
 *
 * ⛔ AND IT MUST NOT MAKE THE CARD LOOK COMPLETE. The fix for a sparse board is
 * NOT to fill cards with plausible-looking text; it is to say plainly that the
 * model holds little here. No figure is invented, no bar is drawn, and the
 * severity badge stays absent — `calculateRiskSeverity` still returns nothing,
 * exactly as before.
 *
 * ⚠ `not set yet` IS DERIVED FROM `METRIC_UNSET.inline`, NEVER RE-TYPED, and
 * that is load-bearing rather than tidiness. The same three words already
 * declare an unset bridge strength two rows above this one on this very card.
 * Two hand-typed copies on one card is the hand-maintained mirror this estate
 * keeps paying for (CLAUDE.md trap 12), and `metricVocabulary.ts`'s own header
 * spends a paragraph on why the word travels by reference. Re-word the register
 * and this sentence follows; it cannot drift out of step with the row beside it.
 *
 * ⚠ AND WHY "yet" SURVIVES THE COMPOSITION. `METRIC_UNSET`'s header states the
 * reason and it applies unchanged here: *"'Not set' is a deficit; 'not set yet'
 * is an invitation… a card that reads as an apology for missing data teaches a
 * reader to ignore it."*
 *
 * ⚠ TWO DIFFERENT ABSENCES, NAMED APART (CLAUDE.md trap 21). The strength row
 * above says `Not set yet` about the CONNECTION from this risk to the goal —
 * an edge property, settled by `strengthIsHumanSettled`. This line is about the
 * risk's OWN size. A card can be in either state independently, and pooling
 * them under one sentence is the reconciliation that keeps costing this estate
 * real time.
 *
 * ⛔⛔ IT NAMES TWO FIELDS AND NEVER SAYS "NOTHING" — AND THIS CARD HAS ALREADY
 * SHIPPED THE DEFECT THAT RULES OUT THE SHORTER SENTENCE. `lodMetric`'s header
 * records it: a risk carrying a recorded `4 months` sat under **`Strength not
 * set yet`**, and *"the card announced that nothing was recorded while holding
 * the thing that was."* A risk can carry its own magnitude through
 * `nodeRecordedValue`/`observed_state` independently of `probability` and
 * `impact`, so *"Nothing recorded yet"* — the obvious phrasing, and the one the
 * backlog reaches for — would be FALSE on exactly that card. Naming the two
 * fields keeps the sentence true of every state the data admits, and it is
 * still the useful thing to say: a reader who recorded a duration and no
 * likelihood has a real gap, and the shorter sentence would have hidden it
 * behind a falsehood.
 *
 * ⚠ NOT PHASE-GATED, ON THIS FILE'S NEIGHBOUR'S OWN RULING. `BaseNode`'s
 * `isIncomplete` note: *"An analysis does not resolve an unknown; it proceeds
 * despite one. Hiding the marker on completion tells the user the gap closed."*
 * CEE writes neither field on a run — 14 of 14 starter risks arrive without
 * them and stay that way — so a post-run risk with no likelihood still has no
 * likelihood. The sentence follows the data, not the phase.
 *
 * ⚠ NO ROUTE IS PROMISED, AND THAT IS DERIVED. `RiskPanel` renders a real
 * `risk-probability-input`, but `InspectorRouter` admits only
 * `factor-controllable`, `factor-external` and `option` to `panelOwnsAuthority`
 * — every other panel body is wrapped in `<fieldset disabled>`, which natively
 * inerts it. So "open its details and set one" would be the exact promise
 * `GoalNode` had to withdraw when its threshold editor turned out to be inert.
 * The sentence states the fact; the CHIP beside it is the route, and it goes
 * somewhere that demonstrably answers.
 */
export const RISK_EXPOSURE_UNSET_LINE = `Likelihood and impact ${METRIC_UNSET.inline}.`

export const RiskNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.risk

  // Read the existing input contract; malformed imports must not become a risk estimate.
  const probabilityInput = RiskNodeDataSchema.shape.probability.safeParse(props.data?.probability)
  const impactInput = RiskNodeDataSchema.shape.impact.safeParse(props.data?.impact)
  const probability = probabilityInput.success ? probabilityInput.data : undefined
  const impact = impactInput.success ? impactInput.data : undefined
  const severity = calculateRiskSeverity(probability, impact)

  // The defining probability × impact pair (P1.7). Honest absence: each half only
  // renders when its value exists — never a fabricated 0% or default impact. The
  // percentage is display formatting of the 0-1 probability (same untagged pattern
  // as confidence display in lib/format.ts), not a semantic transform.
  //
  // ⚠ LIFTED ABOVE THE CHIP CLUSTER, UNCHANGED, AND THE MOVE IS THE POINT. The
  // face chip below now has to know whether this card said anything about its
  // own size, and the alternative was to re-derive that from `probability` and
  // `impact` beside the chip — a second opinion about one question, which is how
  // two surfaces on one card come to disagree. One join, read twice.
  const probabilityPct = typeof probability === 'number' ? Math.round(probability * 100) : null
  const exposureReadout = [
    probabilityPct != null ? `${probabilityPct}% likely` : null,
    impact ? `${impact.charAt(0).toUpperCase()}${impact.slice(1)} impact` : null,
  ].filter(Boolean).join(' · ')
  /**
   * ⭐ THE PREDICATE IS THE COMPONENT'S OWN JOIN, NOT A SECOND OPINION ABOUT IT.
   *
   * `exposureReadout` is already the authority for "what does this card have to
   * say about its own size" — both halves feed it and `.filter(Boolean)` drops
   * the absent ones. Reading its emptiness means the sentence and the readout
   * cannot disagree: there is no state where a figure renders AND the card
   * claims nothing is set, because they are two branches of one value.
   *
   * ⛔ DELIBERATELY NOT `severity == null`. `calculateRiskSeverity` needs BOTH
   * halves, so it is null on a risk carrying a likelihood and no impact — a
   * card which demonstrably HAS recorded something and must not be told it has
   * not. That mutant is pinned in the spec; it is trap 19 in miniature (a
   * predicate another population also satisfies).
   */
  const exposureUnstated = exposureReadout === ''

  /**
   * ⭐ THE RISK'S OWN SIZE, IN ITS OWN UNIT. The two lines above parse
   * `probability` and `impact`; measured across the staging golden path, the CEE
   * fixtures and the starter captures, **both are present on 0 of 23 risk
   * nodes**. This is the datum 4 of those 23 actually carry — `12 months`,
   * `4 months`, and two cost figures — and nothing read it.
   * See `domain/nodeRecordedValue` for the coverage table and the contrast
   * control that makes the zero readable.
   */
  const recordedValue = useMemo(
    () => nodeRecordedValue(props.data as Record<string, unknown> | undefined),
    [props.data],
  )
  const severityColors = getRiskSeverityColors(severity)

  const cleanedLabel = cleanDisplayLabel(typeof props.data?.label === 'string' ? props.data.label : undefined)
  const description = typeof props.data?.description === 'string' && props.data.description.trim() ? props.data.description : null
  const body = typeof props.data?.body === 'string' && props.data.body.trim() ? props.data.body : null
  const summary = description ?? body
  // Compose only the display copy: both authored fields stay available through
  // the existing chevron, while the canonical node and Ask context stay intact.
  const fullDescription = description && body && body.trim() !== description.trim()
    ? `${description}\n\n${body}`
    : summary
  const cleanedData = { ...props.data, label: cleanedLabel || 'Untitled risk', description: fullDescription ?? undefined }
  const riskContext = fullDescription ? `\nRisk context: ${fullDescription}` : ''

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
    if (!bridgeEdgeData) {
      /* ⭐ STRICTLY ADDITIVE, AND THE ADDITIVENESS IS THE SAFETY ARGUMENT. This
         branch returned `null`, which renders an EMPTY BOX below the legibility
         floor — the defect `shared/lodMetricLine.ts` exists to close, still open
         for any risk with no bridge edge. Every branch that spoke before speaks
         identically now; only the silent one gained a voice. A fix for a blank
         card must not be able to change a card that was already speaking
         (CLAUDE.md trap 22b, the opposite-direction twin).

         ⭐ AND IT OBEYS THAT MODULE'S OWN RULE: *ask for the datum the card is
         already displaying at full zoom, not the one an analysis would produce.*
         This is the string the body renders one zoom step up, read from the same
         owner, so the two cannot disagree. It needs no run — which matters
         because zooming out to grasp the whole model is something people do
         BEFORE they analyse. */
      return recordedValue ?? null
    }
    /**
     * ⭐⭐ THE RISK'S OWN MAGNITUDE OUTRANKS A SCORE ABOUT ONE OF ITS EDGES.
     *
     * Node design system, rule 2: *"The node's own unit comes before any score.
     * A normalised figure with no unit is not a compact presentation of a value,
     * it is a different quantity wearing its name."* And the anatomy: *"The
     * node's own value in its own unit comes first… A run adds relative scores
     * BELOW that — never in place of it."*
     *
     * ⛔ THIS BRANCH INVERTED BOTH, AND THE INVERSION WAS INVISIBLE BECAUSE THE
     * TWO LIVED IN DIFFERENT ARMS OF ONE `if`. `recordedValue` — the risk's own
     * size, in months or pounds, from `observedState` — was reachable ONLY on
     * the `!bridgeEdgeData` arm. Give the same risk a bridge edge and the line
     * became `Strength 40%`: a normalised 0..1 weight belonging to an EDGE,
     * displacing a native quantity belonging to the NODE.
     *
     * ⛔⛔ AND THE UNSET ARM WAS WORSE THAN A DISPLACEMENT — IT WAS AN ABSENCE
     * CLAIM OVER A PRESENT VALUE. A risk carrying a recorded `4 months`, on an
     * edge nobody has weighted, rendered **`Strength not set yet`**. The card
     * announced that nothing was recorded while holding the thing that was.
     *
     * ⭐ THE PRECEDENCE IS NOT INVENTED HERE. `GoalNode` already ships
     * `targetLine ?? …` for exactly this question — the node's own target wins
     * the single line, and the derived figure takes it only when the target is
     * absent. Reusing that rule rather than minting a second one is deliberate:
     * two rules for one question is how the two authorities behind the last two
     * P0s in this lane came to disagree.
     *
     * ⚠ THIS IS NOT STRICTLY ADDITIVE AND MUST NOT BE SOLD AS SUCH. A risk that
     * has BOTH a recorded magnitude and a weighted bridge edge changes what it
     * says: `Strength 40%` → `4 months`. There is one line at this rung, so
     * "below" is not available and the rule's own precedence decides which
     * survives. Measured coverage bounds the blast radius: `display_value` is
     * carried by **4 of 23** risks on the captures, so at most four cards can
     * change, and every one of them changes from a figure about an edge to a
     * figure about itself.
     */
    if (recordedValue) return recordedValue
    const pct = bridgeEdgeData.bridgeStrengthPct
    if (pct != null) return `${METRIC_NOUN.strength} ${pct}%`
    // The connection exists and nobody has said how strong it is. Saying so is
    // the same true thing the full card says, in the width one line allows.
    return `${METRIC_NOUN.strength} ${METRIC_UNSET.inline}`
  }, [bridgeEdgeData, recordedValue])

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

  /**
   * ⭐ ONE QUESTION REACHES THE CARD FACE. The rest stay in the popover.
   *
   * The line this replaces read "Body never renders chips directly; they live
   * in popovers (Standard) or inline in Detailed view" — accurate, and the
   * reason a real user in the DEFAULT view sees no coaching at all.
   *
   * MEASURED on deployed `9748b336`, Standard view, post-analysis, in the
   * resting state (no hover): `What reduces this` **0**, `Explore mitigation`
   * **0**, `What would we see first` **0**. Contrast controls in the same
   * probe: 71 `react-flow__node` and 26 `Influence` — the probe could read the
   * page. `NodePopover.tsx:129` is `if (!visible) return null`, so a hidden
   * popover's children are ABSENT FROM THE DOM, not merely invisible.
   *
   * ⚠ AND THE SUITE CANNOT SEE THIS. `render-matrix.spec.tsx:66-70` MOCKS
   * `NodePopover` into a plain always-rendering div — deliberately, so the
   * content is readable without a 300ms hover delay. So "Standard post: same
   * two chips" passes against content no user can reach without hovering.
   * jsdom cannot prove visibility (CLAUDE.md trap 3); here the mock removes
   * the very gate that hides the chips, so the test is green *because* of the
   * thing that makes the defect invisible.
   *
   * The precedent is in this estate and this is the same move: `DecisionNode`
   * put its pre-analysis pair on the card with the note "THE INVITATIONS
   * BELONG ON THE CARD, NOT BEHIND A HOVER".
   *
   * WHY THE LEADING INDICATOR IS THE ONE PROMOTED: the other two both ask how
   * to REDUCE the risk; only this one asks how you would KNOW it was
   * happening, so without it a risk can reach a decision with no agreed
   * trigger for acting on it. Promoted in BOTH phases — a leading indicator is
   * as useful while framing as it is after a run.
   *
   * It is promoted, NOT duplicated: it leaves `riskPopoverChips` so hovering
   * never shows the same question twice. Detailed view still renders all three
   * inline and is unchanged.
   */
  /**
   * ⭐⭐ THE DIAGNOSIS IS HALF A COACHING MOMENT; THIS IS THE OTHER HALF.
   *
   * *"Likelihood and impact not set yet"* on its own is a diagnosis. Paired
   * with a question the reader can actually ask, it is the thing this product
   * claims to be. The sentence says what the model holds; this says what would
   * be worth putting in it.
   *
   * ⛔ ADDED, NOT SWAPPED. Promoting the leading-indicator question to the card
   * face was a reasoned decision with its own measurement (see the block above:
   * *"without it a risk can reach a decision with no agreed trigger for acting
   * on it"*,
   * and it is deliberately phase-independent). Since 14 of 14 starter risks are
   * unsized, swapping on this predicate would delete that question from every
   * risk on every shipped starter — reversing a settled ruling by side effect,
   * on evidence that says nothing about it.
   *
   * ⭐ IT REUSES `NodeChip` RATHER THAN INVENTING A CONTROL, and that buys the
   * touch target for free: `NodeChip`'s `before:` pseudo-element expands it to
   * the WCAG 2.2 AA 2.5.8 24px box without changing the painted size, and its
   * chrome already recedes at rest. A hand-rolled button here would be an
   * 18.5px target and a fourth amber-adjacent vocabulary.
   *
   * ⚠ IT ASKS; IT NEVER WRITES. `NodeChip` with a null `actionType` dispatches a
   * coaching prompt into the conversation — the user reads the answer and
   * decides. A control that silently wrote a probability onto the node would
   * make the AI the author of the user's risk assessment, which is the line
   * `TierInvitation`'s header draws and `CLAUDE.md` ratifies: *"Humans remain
   * the authors and the decision-makers."*
   *
   * ⚠ DENSITY, STATED RATHER THAN HOPED. This puts a SECOND chip on the face of
   * an unsized risk, and Paul's 15 Sep note — *"it looks an absolute mess"* —
   * was about exactly this kind of accumulation. Three things bound it: the
   * chips share one `flex-wrap` row rather than adding a block; the chrome is
   * transparent at rest after #1061's quietening, so at rest this is one more
   * short line of text, not one more bordered box; and it is gated on a card
   * that currently renders NOTHING in that region, which is the emptiest card
   * class on the board (median risk height 86px against option 250, factor
   * 141 — `nodeLayoutConstants.ts`). If it is still too much, this chip can be
   * withdrawn on its own and the sentence above stands without it.
   */
  const riskFaceChip = useMemo(() => (
    <div className="flex gap-1 flex-wrap mt-1.5">
      <NodeChip chipId="risk_leading_indicator" actionType={null} label="What would we see first?" message={`What early signs or leading indicators would tell us ${cleanedLabel || 'this risk'} is starting to happen, and what should trigger a response?${riskContext}`} />
      {exposureUnstated && (
        <NodeChip chipId="risk_size_exposure" actionType={null} label="How likely is this?" message={`How likely is ${cleanedLabel || 'this risk'}, and how serious would it be if it happened? Help me put a first estimate on both, and tell me what I would need to know to sharpen them.${riskContext}`} />
      )}
    </div>
  ), [cleanedLabel, riskContext, exposureUnstated])

  const riskPopoverChips = useMemo(() => (
    <div className="flex gap-1 flex-wrap mt-1.5">
      <NodeChip chipId="risk_what_reduces" actionType={null} label="What reduces this?" message={`What factors or actions could reduce ${cleanedLabel || 'this risk'}?${riskContext}`} />
      <NodeChip chipId="risk_add_mitigation" actionType={null} label="Explore mitigation" message={`Suggest a mitigation strategy for ${cleanedLabel || 'this risk'}, and explain what it would change.${riskContext}`} />
    </div>
  ), [cleanedLabel, riskContext])

  // Detailed view keeps all three inline, exactly as before.
  const riskChips = useMemo(() => (
    <div className="flex gap-1 flex-wrap mt-1.5">
      <NodeChip chipId="risk_what_reduces" actionType={null} label="What reduces this?" message={`What factors or actions could reduce ${cleanedLabel || 'this risk'}?${riskContext}`} />
      <NodeChip chipId="risk_add_mitigation" actionType={null} label="Explore mitigation" message={`Suggest a mitigation strategy for ${cleanedLabel || 'this risk'}, and explain what it would change.${riskContext}`} />
      <NodeChip chipId="risk_leading_indicator" actionType={null} label="What would we see first?" message={`What early signs or leading indicators would tell us ${cleanedLabel || 'this risk'} is starting to happen, and what should trigger a response?${riskContext}`} />
    </div>
  ), [cleanedLabel, riskContext])

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

  const riskExposureLine = exposureReadout ? (
    <div className={`${typography.edgeLabel} text-text-light mt-1`} data-testid="risk-exposure-line">Entered estimate · {exposureReadout}</div>
  ) : (
    <div className={`${typography.edgeLabel} text-text-light mt-1`} data-testid="risk-exposure-unset">
      {RISK_EXPOSURE_UNSET_LINE}
    </div>
  )

  // ----- Layer 2 content: post-analysis (shared between popover and Detailed inline) -----
  const layer2ContentPost = isPostAnalysis ? (
    <>
      {/* "Depends on:" ConnRows (max 3) */}
      {inboundConnections.length > 0 && (
        <>
          <Sep />
          <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5`}>Depends on:</p>
          {/* Wireframe v4: max 3 ConnRows in both PHASE views (pre-/post-analysis —
              NOT standard/detailed; this block is detailed-view only, see FactorNode.tsx:688); remainder disclosed
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
      /* The TAP path. A no-op on a pointer device (`usePopoverHover` gates it
         on `hover: none`); on touch it is the only way this node preview can
         be opened at all. It does not stopPropagation, so the tap still
         selects the node. */
      onClick={nodeHandlers.onClick}
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
        {/* Authored context stays compact; BaseNode's chevron retains the full description. */}
        {summary && (
          <p className={`${typography.nodeLabel} text-text-light m-0 mb-1 line-clamp-2 break-words whitespace-pre-wrap group-aria-expanded:hidden`} data-testid="risk-context-preview">
            {summary}
          </p>
        )}

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
        {/* ⭐⭐ THE RISK'S OWN MAGNITUDE, ABOVE EVERY FIGURE THAT IS ABOUT
            SOMETHING ELSE. The row beneath describes a CONNECTION's strength and
            the block below it a severity derived from probability × impact —
            neither of which is this risk's size. A risk labelled "Time to Reach
            Customer Target" holds `12 months` in its own data and printed none
            of it (`RiskNode` carried zero `observedState` references against a
            contrast of twenty in `FactorNode`).

            ⛔ NO BAR, AND THAT IS THE POINT RATHER THAN AN OMISSION. A
            proportional bar is measurement grammar for a 0..1 share — what
            `NodeMetricRow` requires and what the strength row beneath uses. A
            recorded magnitude in months or pounds has no such scale, and drawing
            one would put a native value on a normalised axis, which is the
            confusion this row exists to end.

            ⚠ ABSENT WHEN NOTHING IS RECORDED, with no placeholder. "Not set yet"
            belongs to a connection strength somebody can settle; a risk nobody
            has sized is a different fact, and pooling the two under one noun is
            what the design review objected to. */}
        {recordedValue && (
          <p
            className={`${typography.nodeValue} text-text-body m-0`}
            data-testid="risk-recorded-value"
          >
            {recordedValue}
          </p>
        )}

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

        {/* The leading-indicator question rides the CARD in Standard view; the
            reduce/mitigate pair stays in the popover. Detailed renders all
            three inline below. See `riskFaceChip` for the measurement. */}
        {!isDetailed && riskFaceChip}

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
          {riskPopoverChips}
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
          {riskPopoverChips}
        </NodePopover>
      )}
    </div>
  )
})

RiskNode.displayName = 'RiskNode'
