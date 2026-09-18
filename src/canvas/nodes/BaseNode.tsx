/**
 * Base node component
 * Shared structure and styling for all node types
 * British English: visualisation, colour
 *
 * Features:
 * - Chevron icon to expand/collapse description
 * - Expandable description with sanitized markdown
 * - Smooth transitions
 */

import { memo, useState, useCallback, useEffect, useMemo, type ReactNode, type CSSProperties } from 'react'
import { optionsWereAssessed } from '../domain/optionAssessment'
import { linkedOptionIds } from '../domain/linkedOptions'
import { Handle, Position, type NodeProps, useUpdateNodeInternals } from '@xyflow/react'
import type { NodeType, Controllability } from '../domain/nodes'
import { ChevronDown, ChevronUp, Flag as FlagIcon, ArrowUp, ArrowDown, Minus, type LucideIcon } from 'lucide-react'
import { useEditPreviewStore } from '../stores/editPreviewStore'
import { sanitizeMarkdown } from '../../lib/renderSafeRichText'
import { UnknownKindWarning } from '../components/UnknownKindWarning'
import { NodeCoachingMarker } from './shared/NodeCoachingMarker'
import { useNodeConstraints } from './shared/useNodeConstraints'
import { Target } from 'lucide-react'
import { useCanvasStore } from '../store'
import { tierInvitations } from '../utils/ghostTiers'
import { TierInvitationRow } from './shared/TierInvitation'
import { selectLodBodyHidden, selectLensDetailActive, LOD_BLANKED_BODY_ATTR } from '../utils/zoomLegibility'
import { useLayoutStore } from '../layoutStore'
import {
  NODE_CARD_MAX_W,
  NODE_CARD_PADDING_X,
  NODE_HEADER_GAP_PX,
  NODE_TYPE_GLYPH_PX,
  NODE_HEADER_RESERVE_PX,
  NODE_LAYOUT_MIN_W,
  NODE_TITLE_MIN_MEASURE_PX,
} from '../utils/nodeLayoutConstants'
import { nodeColors } from './colors'
import { typography } from '../../styles/typography'
import { getControllabilityBorderStyle } from '../utils/graphDisplayCalculations'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { isFactorNeedsInput } from '../utils/observedStateHelpers'
import { resolveLodMetricLine } from './shared/lodMetricLine'
import { resolveLodMetricFacts } from './shared/lodMetricFacts'
import { isGoalDefined } from '../../utils/isGoalDefined'
import { FOOTER_COPY } from '../components/pre-analysis-v3/constants'
import { isGraphLensEnabled } from '../../flags'
import { NodeShapeIndicator } from './NodeShapeIndicator'
import { StatusPill } from './shared/StatusPill'
import { useReadinessStore, selectOptionExclusionMessage } from '../stores/readinessStore'
import {
  isRetainedExcludedFromAnalysis,
  UNFINISHED_CONTRIBUTION_COPY,
  UNFINISHED_CONTRIBUTION_TEST_ID,
} from './shared/analysisParticipation'
import { NodeQuickActions } from './shared/NodeQuickActions'
import { NODE_QUICK_ACTION_BAND_PX, CANVAS_CORNER_STACK_CLASSES } from './shared/canvasGlyphScale'
import { NodeProvenanceMark } from './shared/NodeProvenanceMark'
import { sensitivityRankBadgeAccessibleName, sensitivityRankBadgeLabel, STRUCTURAL_UNSET } from './shared/metricVocabulary'
import { useAssistantFocusStore } from '../stores/assistantFocusStore'

const NODE_TYPE_DESCRIPTIONS: Record<string, string> = {
  decision: 'The choice you\'re making',
  option: 'One possible course of action',
  factor: 'A variable that influences your decision',
  outcome: 'A positive result this decision affects',
  risk: 'A negative result this decision affects',
  goal: 'What you\'re trying to achieve',
}

interface BaseNodeProps extends NodeProps {
  nodeType: NodeType
  icon: LucideIcon
  children?: ReactNode
  /** D2: keep this node's title readable at level-of-detail zoom even though
   * it is not a goal/decision (e.g. the leading option). */
  lodKeepLabel?: boolean
  maxWidth?: number
  headerSlot?: ReactNode
  /**
   * A caller-supplied member of the TOP-RIGHT CORNER STACK, rendered first in
   * that container's DOM order.
   *
   * It exists so a node type with its own corner badge does not hand-write
   * `absolute -top-2 -right-2 z-10` again. `OptionNode`'s "Leading option" pill
   * did exactly that — the identical anchor and z as the stack — so on a
   * leading option that also carried an edited-since-run dot or a coaching
   * marker, two independently positioned boxes claimed one point. The corner
   * has ONE owner (see the five-member contract on the stack itself below, and
   * the `NodeQuickActions` note above it), and this is how a caller joins it
   * rather than competing with it.
   *
   * ⚠ THE RANK BADGE IS DELIBERATELY ABSENT FROM THAT COLLISION SET, because it
   * cannot join it. In `useNodeDisplayMetadata.ts`, `sensitivityRank` is
   * declared `null` and REASSIGNED in exactly one place — inside that hook's
   * `if (nodeType === 'factor')` branch. BaseNode passes its own `nodeType`,
   * and `cornerSlot`'s only caller passes `"option"` — so on the one node type
   * that can supply this slot, the rank badge never renders. (It is still a
   * member of the container's five-member order below: that order is written
   * total so it stays correct if a gate ever changes.)
   * `OptionNode.leadingPillCornerStack.spec.tsx` PINS the
   * impossibility twice — at runtime, and against the hook's own source — so
   * such a change REDs rather than silently producing an overlap nobody
   * measured.
   *
   * FIRST is deliberate where it is observable: the stack is anchored by its
   * right edge and grows leftward, so a wide text pill entering here leaves the
   * badges below at exactly the distance from the corner they already have, and
   * leaves the interactive coaching marker rightmost — which is the reason the
   * stack's contract puts it last. Against the `StatusPill` immediately below
   * it the order is UNOBSERVABLE (disjoint on RESULTS MODE — this said "by node
   * type" until 8 Sep 2026, and that gate no longer exists; the mechanism is
   * derived once, on the stack's contract below); against the edited dot and
   * the coaching marker it is widest-first and load-bearing.
   */
  cornerSlot?: ReactNode
  /** Override border colour + style classes (e.g. 'border-info border-dashed'). Replaces entity colour. */
  borderClassOverride?: string
  /**
   * ⭐ THE REDUCED LINE, DECLARED BY THE NODE THAT OWNS THE DATUM.
   *
   * `shared/lodMetricLine.ts` resolves this centrally where the value is
   * reachable from `data` + `displayMetadata`. It is NOT reachable for every
   * type: a risk's and an outcome's headline figure is the BRIDGE STRENGTH,
   * aggregated from the store's EDGES by the node component itself, and a
   * central resolver reading only `data` cannot see it.
   *
   * Measured on deployed `30bd7f8c`, which is why this prop exists: the central
   * resolver lit 6/6 factors and 4/4 options and **0/3 risks and 0/3
   * outcomes**, because it asked those two for a severity band and an
   * achievement probability that the real model does not carry. That is the
   * SAME defect the resolver was written to fix — asking for the datum the node
   * lacks — reproduced one type along, and no test could see it because every
   * fixture supplied the field the real wire omits.
   *
   * So the owner declares it. When set, this WINS over the central resolver.
   */
  lodMetric?: string | null
}

/**
 * Base node with shared header and structure
 * Includes connection handles and accessibility attributes
 * Click chevron icon to expand/collapse description
 */

/**
 * ⭐⭐ THE BLANKED BODY'S BOX — one line tall, not the body's full height.
 *
 * `visibility: hidden` keeps an element's dimensions; that was deliberate once
 * (stable edge anchors) and it is what made every card at the default zoom a
 * tall empty rectangle. The height here is exactly the reduced line the card
 * still shows, and it carries `--canvas-label-scale` because the line it must
 * hold does — an unscaled height would clip the line at the settle zoom, which
 * is the counter-scale asymmetry that put the `Needs input` pill in the header.
 *
 * `overflow: hidden` is load-bearing beside the height: without it the hidden
 * children still paint outside a zero-ish box in browsers that honour
 * visibility per-element, and a hidden child can still be a scroll target.
 */
const LOD_BLANKED_BODY_STYLE: CSSProperties = {
  visibility: 'hidden',
  height: 'calc(16px * var(--canvas-label-scale, 1))',
  overflow: 'hidden',
}

export const BaseNode = memo(({ id, nodeType, icon: _icon, data, selected, children, maxWidth, headerSlot, cornerSlot, borderClassOverride, lodKeepLabel = false, lodMetric }: BaseNodeProps) => {
  const label = typeof data?.label === 'string' && data.label ? data.label : 'Untitled'
  /**
   * ⭐⭐ EVERY KIND SHOWS THE LIMITS THAT NAME IT — because the kinds that
   * actually carry constraints are not the one this started on.
   *
   * Of the constraints in the shipped starter models, NOT ONE targets a
   * factor: `headcount-allocation` constrains a GOAL, `pricing-model`
   * constrains an OUTCOME (*"net revenue retention above 110%"*, explicit, from
   * the brief). A constraint surface built on `FactorNode` would have been dark
   * on exactly the two models that have constraints.
   *
   * ⛔ THE GOAL IS EXCLUDED, DELIBERATELY AND NOT AS A TIDY-UP. `GoalNode`
   * already renders its constraints through the same formatter AND pairs each
   * with the satisfaction probability the run computed — a strictly richer
   * surface. A second line here would say less, twice.
   */
  const { lines: constraintLines } = useNodeConstraints(id, label)
  const showConstraintLines = nodeType !== 'goal' && constraintLines.length > 0
  const description = typeof data?.description === 'string' ? data.description : undefined

  // Phase 3: Get node colours from new system
  const colors = nodeColors[nodeType as keyof typeof nodeColors] || nodeColors.factor

  // Local state for expand/collapse (no persistence per spec)
  const [isExpanded, setIsExpanded] = useState(false)
  const updateNodeInternals = useUpdateNodeInternals()

  // Phase 3: Node highlighting
  // React #185 FIX: Return primitive boolean from selector to prevent re-renders
  // on every store update. Selecting the entire Set causes infinite loops since
  // Set references change on each store update.
  /**
   * ⭐ THE REASONING FRONTIER, ON THE CARD THE DOOR USED TO STAND BESIDE.
   *
   * Resolved from the graph rather than passed in, because the anchor is a
   * property of the whole row (which card ends it), not of this node — and
   * `tierInvitations` shares its anchor resolver with the graph-space placement
   * it replaces, so the two cannot pick different cards.
   */
  const allNodes = useCanvasStore(s => s.nodes)
  const myInvitations = useMemo(
    // ⚠ GUARDED, AND NOT ONLY FOR TESTS. Every card reads this, so an absent or
    // not-yet-populated `nodes` slice would crash the whole canvas rather than
    // omit one affordance. Sixteen specs that mock the store caught it; a user
    // hitting the same state would have seen a blank board.
    () => (Array.isArray(allNodes) ? tierInvitations(allNodes as never).get(id) ?? [] : []),
    [allNodes, id],
  )
  const isHighlighted = useCanvasStore(s => s.highlightedNodes.has(id))
  /**
   * Olumi attention — held while the AI is explaining THIS element, unlike the
   * two-second acknowledgement above. Primitive-boolean selectors (React #185),
   * and the dim is DERIVED rather than written into `dimmedNodeIds`, which
   * already has two writers with a precedence rule between them.
   */
  const isAttended = useCanvasStore(s => s.olumiAttention?.nodeIds.includes(id) === true)
  const isAttentionDimmed = useCanvasStore(
    // ⚠ `!= null`, NOT `!== null`. Spec store doubles omit this slice entirely,
    // so the value is `undefined` there — and `undefined !== null` is true,
    // which dimmed every node in every test that mounts a partial store. Same
    // fail-soft convention the rest of this file uses for optional slices.
    // ⚠ AND `nodeIds.length > 0`, WITHOUT WHICH AN EDGE-ONLY ATTENTION GREYS
    // OUT THE WHOLE CANVAS. Attention may hold edges and no nodes; then no node
    // is attended, this predicate is true for EVERY node, and all of them dim to
    // 30% — while `OlumiAttentionCard` returns null at `attention.nodeIds[0]`,
    // so no card and therefore no Dismiss button renders. The dim is derived
    // from attention and the exit was drawn from the card, so the two disagreed
    // about whether anything was on screen. An attention that names no node
    // dims no node.
    s =>
      s.olumiAttention != null &&
      s.olumiAttention.nodeIds.length > 0 &&
      s.olumiAttention.nodeIds.includes(id) === false,
  )
  // Assistant focus is a static, independently-owned marker. It does not use
  // React Flow's `selected` prop and does not enter the transient highlight
  // Set, so it can coexist with both without borrowing either lifetime.
  const isAssistantFocused = useAssistantFocusStore(
    (state) => state.target?.kind === 'node' && state.target.id === id,
  )
  // N3: edited since the last analysis run (amber corner dot; undefined-safe
  // for node-spec store doubles without the slice).
  const isEditedSinceRun = useCanvasStore(s => s.editedSinceRunNodeIds?.has(id) === true)
  // Analysis-graph projection: this node is a key driver being viewed in the V7
  // evidence disclosure. Primitive-boolean selector (React #185) + optional
  // chaining so store doubles without the slice stay safe.
  const isAnalysisDriver = useCanvasStore(
    s => s.analysisHighlight?.source === 'drivers' && s.analysisHighlight?.nodeIds?.has(id) === true,
  )
  /**
   * D2: level-of-detail — which rung of the semantic-zoom ladder the canvas is
   * on. Undefined-safe for spec store doubles without the slice: `selectLodBodyHidden`
   * defaults an absent rung to `full`, i.e. an ordinary card.
   *
   * ⚠ TWO NAMES, BECAUSE THEY ARE TWO QUESTIONS. `lodBodyHidden` is "is the body
   * blanked?" and is true at `line` only — every use below is a rename of the
   * former `lodActive` and nothing more. `showCardControls` is "may this card
   * show its in-card controls?", which the ladder will answer differently at
   * `quiet`; it is DECLARED in `utils/zoomLegibility` and mounted by nothing
   * yet. Collapsing them back into one flag is how the notice and the nodes
   * would come to disagree (trap 21).
   */
  const lodBodyHidden = useCanvasStore(selectLodBodyHidden)
  /**
   * ⭐⭐⭐ THE LENS, NOT THE CAMERA, DECIDES DETAIL AT `quiet`.
   *
   * `lodBodyHidden` stays exactly what it was — "is the canvas at the `line`
   * rung?" — and every other reader below still consumes it, because the kind
   * tint, the quick actions and the title boost are all answers to THAT
   * question. ⛔ Collapsing this into it would be trap 21 a third time in one
   * file.
   *
   * THIS is the narrower question "should this PARTICULAR card show less?", and
   * it is true in two unrelated situations: the whole canvas is below the
   * legibility floor, or **the reader has chosen a lens and this card is one the
   * lens set aside**. The second is new, and it is what finally spends the
   * `quiet` rung — see `lensDetailSpentAt`'s header for the measured chain.
   *
   * ⚠ The replacement-line rule below governs BOTH. A set-aside card blanks its
   * body only where a reduced line exists to take its place; otherwise it keeps
   * what it had. A lens is a question, not a reason to show someone an empty box.
   */
  const lensDetailActive = useCanvasStore(selectLensDetailActive)
  const lodKeepsTitle = nodeType === 'goal' || nodeType === 'decision' || lodKeepLabel

  /**
   * ⭐⭐ A NODE NEVER LOSES ITS NAME (30 Aug 2026, Paul, on the deployed build:
   * "when I zoom out of the graph, the content in it shouldn't disappear —
   * it's a terrible user experience").
   *
   * This used to be `lodBodyHidden && !lodKeepsTitle`, so below the 0.50
   * level-of-detail threshold every node except the goal, the decision and the
   * leading option rendered its TITLE as `visibility: hidden` — and the body
   * with it. The graph became anonymous coloured boxes.
   *
   * The reasoning behind it was sound and is why the BODY still hides: at low
   * zoom the counter-scale is capped, dense body content stops being legible,
   * and hiding it keeps the card's box (so ELK and the edge anchors stay
   * stable). But that argument was applied one level too far. A user zooms out
   * DELIBERATELY, to read structure — and structure is unreadable without
   * knowing which node is which. Small text you can squint at is strictly
   * better than a box that says nothing, and a blank card is indistinguishable
   * from a broken render.
   *
   * The anchors still get the boost; everything else keeps its ordinary title,
   * so no card's geometry assumption changes.
   *
   * ⭐⭐ AND THE "BOOST" WAS A 25% SHRINK, IN ITS ENTIRE DOMAIN OF APPLICATION —
   * measured in a real browser on this tip, 1 Sep 2026. See the rendering
   * branch below for the derivation; the short version is that the boost was
   * spelled as a NON-CANVAS Tailwind size (`text-lg`), so it was the only title
   * on the canvas that did not carry `--canvas-label-scale`, and below the
   * legibility floor the counter-scale is exactly what keeps a title from
   * collapsing. The two cards this product singles out as always-legible were
   * rendering the SMALLEST text on the canvas.
   */
  const lodHideTitle = false
  const lodBoostTitle = lodBodyHidden && lodKeepsTitle

  // Graph Interaction P1: Node dimming for path highlighting
  // Nodes not on the highlighted path are dimmed (opacity ~0.4)
  const isDimmed = useCanvasStore(s => s.dimmedNodeIds.has(id))

  // Graph Lens: lens-mode dimming (20% opacity for inactive nodes in option mode)
  // Uses primitive boolean selector (React #185 pattern) to avoid re-render loops
  const isLensDimmed = useCanvasStore(s =>
    isGraphLensEnabled() && s.lens._dimmedNodeIds.has(id)
  )

  /**
   * "Should THIS card show less?" — the canvas is below the legibility floor,
   * OR the reader's chosen lens has set this card aside while we are at `quiet`.
   * Bound here, once, so the three readers below cannot drift apart.
   */
  const bodyReduced = lodBodyHidden || (lensDetailActive && isLensDimmed)

  // Expanded lenses: hidden (causal), evidence classification, active mode
  // Defensive ?.has/?.get — test mocks may not include expanded lens fields
  const isLensHidden = useCanvasStore(s =>
    isGraphLensEnabled() && s.lens._hiddenNodeIds?.has(id) === true
  )
  const lensMode = useCanvasStore(s => isGraphLensEnabled() ? s.lens.active : 'full')
  const evidenceClass = useCanvasStore(s => {
    if (!isGraphLensEnabled() || s.lens.active !== 'evidence') return null
    return s.lens._evidenceNodeClass?.get(id) ?? null
  })

  // Layout-computed node width: when a layout has run, use its computed width
  // so the rendered node matches ELK's sizing assumptions.
  const layoutNodeWidth = useLayoutStore(s => s.layoutNodeWidth)
  /**
   * ⭐ THE PER-KIND WIDTH, PREFERRED OVER THE SINGLE ONE ABOVE.
   *
   * Paul, 15 Sep: *"They don't all have to be the same width."* He is right and
   * the measurement agrees — median characters per card on `pricing-model`:
   * option 250 · factor 141 · decision 122 · goal 102 · risk 86 · outcome 73.
   * One 336px box was serving all six.
   *
   * ⛔ THIS IS THE LINE THE PREVIOUS ATTEMPT WAS MISSING, and its absence is why
   * widening the ELK box changed nothing on screen: the layout allocated a wider
   * box, `BaseNode` kept rendering at one global width, and the extra space went
   * to the gap. Built, not plugged in — so the plug is here, reading the SAME
   * `tierBoxWidth` derivation the placement used.
   *
   * A kind absent from the record falls through to the single width unchanged;
   * absence is "no better information", never zero.
   */
  const layoutCardWidth = useLayoutStore(s =>
    nodeType ? s.layoutCardWidths?.[nodeType] ?? null : null
  )

  // Decision Graph Display v2: Get Results-mode display metadata
  const displayMetadata = useNodeDisplayMetadata(id, nodeType)

  /**
   * The ONE line a node still says when it is too small to say anything else.
   *
   * ⚠ THE SCOPE AND THE RULES LIVE IN `shared/lodMetricLine.ts`, NOT HERE — and
   * deliberately so. This file used to carry forty lines explaining why the
   * reduced line was FACTORS ONLY; that reasoning was sound and its outcome was
   * that 15 of 15 factor bodies on deployed `ec4cba73` rendered nothing,
   * because it asked each factor for a value most factors have never been
   * given. Leaving the old rationale here beside a resolver that no longer
   * obeys it would be the estate's most reliable defect: a confident comment
   * describing behaviour the code has stopped having.
   *
   * What stays true at this level: `BaseNode` decides only WHEN a reduced line
   * may appear — `lodBodyHidden`, i.e. below the legibility floor. It never decides
   * what the line says, and there is no formatter in this file.
   */
  // (declared below, once `lodFacts` is available — see `lodBodyLine`.)

  // Phase 2: Uncertain node styling
  const isUncertain = Number(data?.uncertainty ?? 0) > 0.4

  // B.I.10: Pre-run overlay — show dashed goal border for incomplete nodes
  const resultsStatus = useCanvasStore(s => s.results?.status)
  const goalThreshold = useCanvasStore(s => s.goalThreshold)
  const goalConstraints = useCanvasStore(s => s.goalConstraints)
  const edges = useCanvasStore(s => s.edges)
  const isPreRunMode = resultsStatus !== 'complete'
  const ceeAnalysisReady = useCanvasStore(s => s.ceeAnalysisReady)

  /**
   * ⚠ THE FACT THAT DOES NOT LIVE ON THE NODE, and whose absence was the
   * defect. An option's change count lives in `ceeAnalysisReady`;
   * `resolveLodMetricLine` receives `data` and `displayMetadata` and cannot see
   * it, which is why an option card could only ever speak after a run.
   *
   * ⭐ IT IS COMPUTED ONLY BELOW THE LEGIBILITY FLOOR AND ONLY FOR OPTIONS.
   * `BaseNode` hosts every card on the canvas, so this deliberately subscribes
   * to nothing new: `ceeAnalysisReady` is already selected above for the
   * pre-run overlay, and no `nodes`/`edges` traversal is added. Risk, outcome,
   * goal and decision need nothing here — each formats its own line and passes
   * it as `lodMetric` below.
   */
  const lodFacts = useMemo(() => {
    if (!bodyReduced || nodeType !== 'option') return undefined
    return resolveLodMetricFacts({
      nodeType,
      nodeId: id,
      data: data as Record<string, unknown> | undefined,
      ceeOptions: ceeAnalysisReady?.options,
    })
  }, [bodyReduced, nodeType, id, ceeAnalysisReady, data])

  const lodBodyLine = useMemo<string | null>(() => {
    if (!bodyReduced) return null
    /**
     * ⛔ THE OWNER'S OWN LINE WINS, AND AS OF 1 SEP 2026 THAT IS A SETTLED
     * OWNERSHIP SPLIT RATHER THAN A FALLBACK ORDER (see the map in
     * `shared/lodMetricLine.ts`).
     *
     * Four types format their own string and pass it here: risk and outcome
     * (#1074) and goal and decision (#1085), each because it reads a datum the
     * central resolver cannot see — an EDGE's strength, a user-stated
     * threshold, a leader-claim PERMISSION. Factor and option have no owner
     * line and are resolved centrally.
     *
     * ⚠ SO A `case` ADDED TO `resolveLodMetricLine` FOR ONE OF THOSE FOUR
     * TYPES IS DEAD CODE, AND ITS UNIT SPEC WILL STILL PASS. That is not
     * hypothetical: this branch is where four such arms were deleted, after a
     * mutant pair showed the resolver's risk arm could be neutered with the
     * component spec staying GREEN. If you are about to add one, add it to the
     * owning component instead.
     */
    if (lodMetric != null && lodMetric.length > 0) return lodMetric
    return resolveLodMetricLine({
      nodeType,
      data: data as Record<string, unknown> | undefined,
      label,
      displayMetadata,
      facts: lodFacts,
    })
  }, [bodyReduced, lodMetric, nodeType, data, label, displayMetadata, lodFacts])

  /**
   * ⛔ A CARD'S CONTENT IS NEVER REMOVED WITHOUT SOMETHING PUT IN ITS PLACE.
   *
   * `lodBodyHidden` answers "is the canvas at the line rung?" — unchanged, and
   * still what the kind tint, the quick actions and the reduced line itself
   * read. THIS answers the narrower question "may the body actually blank?",
   * and the answer is no unless a reduced line exists to take its place.
   *
   * ⭐ WHY A BOUND RATHER THAN A SIXTH ARM. Five rounds have each shipped one
   * more `lodBodyLine` resolver arm — #1069 the factor value, #1074 the
   * risk/outcome owner lines, #1085 goal/decision, the 1 Sep pre-analysis arms,
   * Z2 the action line — and `lodMetricLine.ts`'s own header records the defect
   * "REOPENED ANYWAY" after three of them. Every round needed a real browser to
   * discover the NEXT blank class and none of them bounded the class. That is
   * CLAUDE.md trap 22f: when the rounds oscillate, stop writing the next rule
   * and change the shape.
   *
   * ⭐⭐ AND THE RULING IS ALREADY IN THIS FILE, one level up. The founder ruled
   * the TITLE back on at the line rung on 30 Aug (:206-222): "Small text you can
   * squint at is strictly better than a box that says nothing, and a blank card
   * is indistinguishable from a broken render." This is that ruling applied to
   * the BODY, and only where there is no replacement to show.
   *
   * Reachable null arms at this tip, so this is not hypothetical: an external
   * factor on an ignorance prior (`factorPriorRange.ts` "if (isUnquantifiedPrior(prior)) return null"),
   * any factor that is not `external`, and an option whose intervention count is
   * unknown.
   */
  const lodBodyBlanked = bodyReduced && lodBodyLine !== null

  /**
   * ⭐ WILL THE RUN LEAVE THIS OPTION OUT? A DIFFERENT QUESTION FROM THE ONE
   * BELOW, AND THE REASON IT IS ASKED SEPARATELY.
   *
   * `isIncomplete` asks *"has the user set values on this?"*. This asks *"is
   * the analysis going to proceed without it?"*. They are related and they are
   * NOT the same fact — an option can need input and still be included, and CEE
   * can waive one for reasons this component cannot see. Deriving the second
   * from the first is the two-questions-one-name defect (trap 21), so the
   * answer is READ from the producer's stamp and never computed here.
   *
   * `null` = not excluded. A string = excluded, carrying CEE's own sentence
   * (possibly empty). Tested against `null`, never truthiness, because an
   * excluded option with no message is still excluded.
   *
   * The selector is memoised on `id` because it is a factory: a fresh closure
   * each render makes zustand treat every render as a new subscription.
   */
  const exclusionSelector = useMemo(() => selectOptionExclusionMessage(id), [id])
  const exclusionMessage = useReadinessStore(exclusionSelector)
  // Only options carry this claim. The selector matches on `option_id`, so a
  // factor whose id somehow collided would otherwise inherit an option's
  // exclusion — bound to the node type here rather than trusting id spaces.
  const isExcludedFromAnalysis = nodeType === 'option' && exclusionMessage !== null

  /**
   * ⭐⭐ DID THE CALCULATION COUNT THIS NODE? — A THIRD QUESTION, NAMED APART
   * FROM THE OTHER TWO RATHER THAN FOLDED INTO EITHER.
   *
   * The three above/below are genuinely distinct facts and this file already
   * pays for confusing two of them once:
   *   · `isIncomplete`            — *has the user set values on this?*
   *   · `isExcludedFromAnalysis`  — *will the RUN proceed without this OPTION?*
   *     (CEE's PRE-run readiness verdict, option-scoped, stale-gated)
   *   · this                      — *did the analysis you are looking at leave
   *     this node OUT of the calculation while keeping it in the model?*
   *     (CEE's stamp on the graph node itself, any node type)
   *
   * Reconciling them would be CLAUDE.md trap 21 — two authorities answering
   * different questions look like an inconsistency and aligning them is the
   * wrong fix. So each keeps its own predicate and they queue in one slot.
   *
   * ⛔ READ, NEVER DERIVED. There is no edge count, no connectivity test and no
   * completeness test in this line. *"Not connected"* and *"excluded from this
   * calculation"* are different facts and CEE owns the second; the canvas is
   * not entitled to infer it. `isRetainedExcludedFromAnalysis` is a positive
   * equality against the one licensed value — see that module's header for why
   * a `!== 'included'` negation would stamp this claim on all 182,015 unstamped
   * nodes.
   *
   * ⚠ INERT AT THIS TIP, DELIBERATELY. Nothing emits `analysis_participation`
   * yet (swept with a contrast control at `eb7211d7`), so this reads `false` on
   * every reachable node and the rendered output is byte-identical to before.
   * The consumer ships READY: the claim appears the day CEE's emitter lands,
   * with no further UI change. It is not gated on a flag, because a flag would
   * be a second thing to remember to turn on — the producer's stamp IS the gate.
   */
  const isRetainedExcluded = isRetainedExcludedFromAnalysis(data)

  const isIncomplete = (() => {
    /* ⭐ GATED ON THE GAP, NOT THE PHASE — for the two node types whose predicate
       is phase-independent BY CONSTRUCTION.

       WHAT THIS FIXES, and this file already confessed it ~650 lines below: a run
       completing used to clear `isPreRunMode` and this pill "vanishes with nothing
       set — the product silently retracted its own claim rather than ever being
       contradicted." An analysis does not resolve an unknown; it proceeds despite
       one. Hiding the marker on completion tells the user the gap closed.

       ⛔ SCOPE, DELIBERATELY NARROW — `goal` and `option` KEEP the phase gate.
       Their predicates are NOT phase-independent and un-gating them blind would
       ship a false claim:
         · `goal` — the producer synthesises `auto_goal_threshold` on a run, so
           `isGoalDefined` may read TRUE afterwards on a target the user never set.
           GoalNode already carries an honest post-run channel of its own, gated on
           `canCaptureTarget` (`GoalNode.tsx:690`/`:695`), so a second surface here
           risks two answers to one question (trap 21) rather than one more truth.
         · `option` — its arm turns on `ceeAnalysisReady`, whose licence semantics
           are argued at length in this file. Not derived here, so not changed here.
       Both are deferred to a follow-up that derives them, NOT judged unnecessary. */
    if (nodeType === 'factor') {
      // Single source of truth shared with FactorNode's in-body chip — see
      // isFactorNeedsInput in observedStateHelpers.ts.
      return isFactorNeedsInput(data)
    }
    if (nodeType === 'goal') {
      // Still phase-gated — see the scope note above.
      if (!isPreRunMode) return false
      return !isGoalDefined(goalThreshold, goalConstraints)
    }
    if (nodeType === 'decision') {
      // ⛔ NARROWED BACK TO PHASE-GATED, AND CI IS WHY. This arm was un-gated in
      // the first version of this change on the reasoning that `!hasOptions` is
      // structural and therefore phase-independent. That reasoning is sound and
      // the conclusion was still wrong, for a reason no amount of reading the
      // predicate would surface: a decision with NO options after a COMPLETED
      // analysis is not a reachable product state, because the readiness gate
      // will not admit a run without options. So un-gating bought no user-facing
      // truth, and it fired in `BaseNode.cornerStack.spec.tsx`, whose fixture
      // pairs `results.status: 'complete'` with `edges: []` — adding a fourth
      // child to a corner stack pinned at three.
      //
      // The evidence for this whole change is about FACTORS: a measured staging
      // witness, and this file's own confession ~650 lines below. Extending it
      // to a node type on structural symmetry alone was scope I could not
      // evidence. If a reachable optionless-post-run decision is ever
      // demonstrated, un-gate it THEN, with that case as the fixture.
      if (!isPreRunMode) return false
      /* ⭐⭐ BOUND TO WHAT THE PILL SAYS, NOT TO WHAT WAS EASY TO READ.
         This was `edges.some(e => e.source === id)` — "does this decision have
         any OUTGOING EDGE" — while the pill beneath it states that the decision
         has no OPTIONS. Two facts, one predicate, and they come apart in both
         directions:

         · `option → decision` is a permitted draw (`isValidConnection`,
           `ReactFlowGraph.tsx:2347`, applies no kind or direction rule) and is
           not an outgoing edge, so the card made a DEFINITE FALSE STATEMENT
           about the user's model — worse than the vague "Needs input" it
           replaced, which asserted nothing about the graph. This PR's own
           thesis, applied to this PR.
         · `decision → factor` IS outgoing, so ANY such edge suppressed the pill
           on a decision that genuinely has nothing to compare — the gap this
           arm exists to close, left open.

         `linkedOptionIds` is the same rule `DecisionPanel.tsx:66-77` already
         ruled for this exact state (review D3: an `option → decision` edge
         "fell through BOTH lists"), named once rather than re-spelled here —
         and it resolves kinds through `resolveNodeTypeLiteral`, the estate's
         one owner of that question, never a private predicate. */
      return linkedOptionIds(allNodes, edges, id).length === 0
    }
    if (nodeType === 'option') {
      // Still phase-gated — see the scope note above.
      if (!isPreRunMode) return false
      // Only mark incomplete if analysisReady exists AND contains this option with empty interventions.
      // When analysisReady is null (cleared as stale), don't flag options as incomplete.
      if (!ceeAnalysisReady) return false

      // ⛔ AND ONLY WHEN THE ANALYSIS ACTUALLY ASSESSED THEM.
      //
      // PRESENCE of `ceeAnalysisReady` used to be a sufficient licence for this
      // claim, because `normaliseV5AnalysisReady` rejected any payload with an
      // empty `goal_node_id` or empty `options` — and a blocked refusal was
      // exactly that shape. The guard WAS the status check.
      //
      // CEE now carries model identity on refusals, so a blocked payload
      // ADMITS: non-empty `options`, each unvalued one carrying
      // `interventions: {}`, with `status: 'blocked'`. Without this line every
      // unvalued option on a blocked run renders a dashed "incomplete" border —
      // a claim about the user's model that nothing established, because CEE
      // refused BEFORE projecting interventions.
      //
      // `optionsWereAssessed` is named for the QUESTION rather than this fix:
      // empty `interventions` means "assessed, changes nothing" OR "never
      // assessed", and the next consumer needs something to read rather than a
      // bare `status !== 'blocked'` here.
      if (!optionsWereAssessed(ceeAnalysisReady.status)) return false

      const ceeOption = ceeAnalysisReady.options?.find(opt => opt.id === id)
      if (!ceeOption) return false // Option not in analysisReady — not necessarily incomplete
      return !ceeOption.interventions || Object.keys(ceeOption.interventions).length === 0
    }
    return false
  })()

  // Decision Graph Display v2 Task 6 + P1 Hotfix: Controllability-based border style for factors
  // P1 Hotfix: Don't default factors to dashed — only show dashed when explicitly 'partial'
  // When controllability is undefined or 'unknown', use solid (we don't claim anything)
  const controllability = nodeType === 'factor' ? (data?.controllability as Controllability | undefined) : undefined
  const borderStyle = (() => {
    // Scope 5 (display-only): external factors — keyed ONLY on the explicit
    // `category` field — get the dashed "outside your control" treatment.
    // No inference/reclassification; the controllability-derived styling below
    // is untouched (its graphDisplayCalculations behaviour is unchanged).
    if (nodeType === 'factor' && data?.category === 'external') {
      return 'border-dashed'
    }
    if (nodeType === 'factor' && controllability) {
      return getControllabilityBorderStyle(controllability)
    }
    // Only uncertain non-factor nodes get dashed border
    // P1 Hotfix: Factors no longer default to dashed — solid is the default (no claim)
    if (isUncertain && nodeType !== 'factor') {
      return 'border-dashed'
    }
    return ''
  })()

  // Accessible name combines node type and label
  // ⚠ THE TYPE DESCRIPTION RIDES HERE BECAUSE ITS TOOLTIP IS GONE. Moving the
  // glyph onto the connector (below) deleted the only surface that told a user
  // what a "factor" or an "outcome" IS — a real affordance removed by a purely
  // visual change, which is the quiet kind of regression. The glyph itself
  // cannot carry it back: it is `pointer-events-none` so React Flow's Handle
  // keeps its clicks, and an element that cannot be hovered cannot hold a
  // tooltip. So the description goes where this PR already says the type
  // survives. ⚠ A VISUAL SURFACE IS STILL OWED — rowed in CANVAS-BACKLOG.md;
  // a sighted user currently has no way to ask what a node type means.
  const accessibleName = `${nodeType} node: ${label}. ${NODE_TYPE_DESCRIPTIONS[nodeType] ?? ''}`.trim()

  /*
   * ⭐⭐ REGISTER THIS NODE'S HANDLE BOUNDS ONCE, ON MOUNT — WITHOUT THIS THE
   * CANVAS DRAWS NO EDGES AT ALL.
   *
   * React Flow positions an edge from `node.internals.handleBounds`, which it
   * fills in when it measures a node. If the handles are not in the DOM at that
   * moment, `getHandleBounds` returns null, `handleBounds` stays undefined, and
   * `getEdgePosition` then returns null for every edge touching that node — so
   * `EdgeWrapper` renders NOTHING. Silently: no warning, no error, no fallback.
   * The node still measures fine, so `measured` is populated and everything
   * looks healthy.
   *
   * Measured on deployed `a0587e0d`, a guest's saved model: 14 nodes, 22 edges
   * handed to React Flow, `edgeLookup.size === 22`, `nodesInitialized === true`
   * — and `handleBounds` undefined on 14 of 14 nodes, `.react-flow__edge`
   * elements in the DOM: 0. Pushing `updateNodeInternals` for the 14 mounted
   * nodes populated 14 of 14 and all 22 edges appeared immediately. That is the
   * whole defect: a causal model rendered as disconnected boxes.
   *
   * The one existing call sat inside `handleExpandToggle`, so bounds were only
   * ever registered for a node whose chevron a user happened to click.
   *
   * ⚠ ONCE PER NODE, KEYED ON `id`, AND DELIBERATELY NOT ON EVERY RENDER.
   * `updateNodeInternals` driven from a ResizeObserver is a known starvation
   * source here (see `readinessStore.churnStarvation.spec.ts`). One rAF-deferred
   * call per mounted node is bounded by the node count; re-measurement after
   * that stays the ResizeObserver's job. The rAF lets the commit settle so the
   * handles are in the DOM and React Flow has adopted the node.
   */
  useEffect(() => {
    // `useEffect` already runs after the DOM commit, so the handles are in the
    // tree and React Flow's own `getBoundingClientRect` will force whatever
    // layout it needs. Measure straight away.
    updateNodeInternals(id)
    // Safety net for a node whose subtree commits after this effect.
    //
    // ⚠ `setTimeout`, DELIBERATELY NOT `requestAnimationFrame`. rAF does not
    // fire in a background tab, so an rAF-scheduled measurement leaves the
    // canvas with NO EDGES AT ALL until the tab is focused — and opening the
    // product in a background tab is an ordinary thing to do. Measured
    // directly: with `document.hidden === true`, a scheduled rAF callback did
    // not run within 2s, while `setTimeout` fired normally.
    //
    // That is also how the first version of this fix escaped its own
    // verification: it was rAF-scheduled and driven in a hidden pane, so the
    // deployed check reported "still no edges" about a fix that had never been
    // given a chance to run. A false negative from the instrument, not a
    // finding about the code.
    const t = setTimeout(() => updateNodeInternals(id), 0)
    return () => clearTimeout(t)
  }, [id, updateNodeInternals])

  // Toggle expand via chevron icon click
  const handleExpandToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()  // Prevent node selection/drag
    if (!description) return

    setIsExpanded(prev => !prev)

    // Update node internals after layout change (debounced to avoid thrash)
    setTimeout(() => {
      updateNodeInternals(id)
    }, 100)
  }, [id, description, updateNodeInternals])

  // Wireframes v4 hierarchy (display-only): decision/options 1px, factors 0.5px.
  // Risk/outcome/goal/constraint/action keep 2px. The isCausalLens / isIncomplete
  // width overrides in the className below still take precedence — e.g. an
  // unset "goal gap" renders 2px SOLID in the node's own KIND HUE via the
  // isIncomplete path.
  // ⚠ THIS SENTENCE HAS NOW BEEN WRONG TWICE, IN THE SAME PLACE, ABOUT THE SAME
  // BRANCH. It read "2px dashed warning" until 1 Sep 2026, when the dash was
  // removed as a false claim ("outside your control"); it then read "2px SOLID
  // amber" until 8 Sep 2026, when Paul ruled the kind hue stays and the state
  // moves to a badge. Both times the width note outlived the style it described.
  // See `borderColourClass` below for the current vocabulary — and note the
  // WIDTH override itself is untouched by that ruling and is flagged there as
  // sitting awkwardly against this hierarchy.
  const borderWidth = (() => {
    if (nodeType === 'factor') return 'border-[0.5px]'
    if (nodeType === 'decision' || nodeType === 'option') return 'border'
    return 'border-2'
  })()

  // Graph Editing Experience Task 5: Edit impact preview indicator
  const impactDirection = useEditPreviewStore(s => s.impactMap.get(id))

  // The width this card will actually render at — the same expression the
  // `maxWidth` style below uses, hoisted so the title's measure floor can be
  // bounded by it. Without the bound, a caller passing a `maxWidth` narrower
  // than the floor would have the title's own min-width force the card wider
  // than the box ELK placed it in.
  const renderedCardW = isExpanded
    ? Math.max(NODE_CARD_MAX_W, layoutCardWidth ?? 0)
    : (maxWidth ?? layoutCardWidth ?? layoutNodeWidth ?? NODE_CARD_MAX_W)
  const titleMinMeasurePx = Math.max(
    0,
    Math.min(NODE_TITLE_MIN_MEASURE_PX, renderedCardW - NODE_CARD_PADDING_X - NODE_HEADER_RESERVE_PX),
  )

  // Causal lens: hide organisational nodes entirely
  if (isLensHidden) return null

  // Evidence lens: node fill colour based on evidence classification
  const evidenceBgStyle = (() => {
    if (lensMode !== 'evidence' || !evidenceClass) return undefined
    switch (evidenceClass) {
      case 'grounded': return 'var(--success-light)'
      case 'assumed': return 'var(--warning-light)'
      case 'none': return 'var(--danger-light)'
      case 'na': return undefined
    }
  })()

  // Causal lens: strip all type-specific styling, render as neutral node
  const isCausalLens = lensMode === 'causal'
  // Evidence lens: suppress detail — show label + provenance pill only
  const isEvidenceLens = lensMode === 'evidence'
  const causalBorderClass = isCausalLens
    ? (nodeType === 'goal' ? 'border-text-light border-dashed' : 'border-text-light')
    : undefined

  // ⚠ ONE CONDITION, TWO READERS THAT DO NOT TRACK EACH OTHER.
  //
  // `showQuickActions` is read in exactly two places: the `NodeQuickActions`
  // mount below, which it governs ALONE; and the card's `padding:` entry, where
  // it is only the FIRST ARM of a disjunction whose second arm is a hand-listed
  // `factor | option` pair. So the two do not move together — below the
  // legibility floor the mount disappears while the padding survives on the
  // second arm, which is the divergence documented at `padding:`.
  //
  // ⚠ THIS LINE HAS NOW BEEN WRONG IN BOTH DIRECTIONS, and the pendulum is the
  // lesson. It first read "One condition, two consumers", which had the COUNT
  // right and the IMPLICATION wrong — a review found a PR had inherited "they
  // follow the same condition" from it instead of reading the expression
  // (CLAUDE.md trap 14). The correction on 4 Sep then over-swung to "ONE
  // CONSUMER", which fixed the implication by breaking the count. Both readers
  // are real; what differs is their ROLE. Naming them apart is the fix — trap
  // 21, two questions under one name.
  const showQuickActions = !lodBodyHidden && !isCausalLens && !isEvidenceLens

  /**
   * ⭐⭐⭐ THE KIND HUE STAYS. "NEEDS YOUR JUDGEMENT" IS A BADGE (Paul, 8 Sep 2026).
   *
   * `DESIGN_SYSTEM.md` §"Border vocabulary (ratified, wireframe v4)" named
   * exactly two border modifiers and said they must never be conflated:
   *
   *   · **DASHED = "outside your control"** (external factors)
   *   · **AMBER  = "needs your judgement"** (a controllable node missing its
   *     value; the goal missing its target)
   *
   * ⚠ THIS IS A DELIBERATE RE-RULING OF THE SECOND ONE, NOT A BUG FIX. The
   * previous note here recorded the amber as ratified-and-untouched with an
   * OPEN QUESTION beside it (`DESIGN_SYSTEM.md`, flagged 2026-07-16, "Paul to
   * rule"), and said changing the hue was not that lane's call. Paul has ruled.
   *
   * ⭐ AND THE MEASUREMENT THAT PROMPTED THE QUESTION NAMED THE WRONG COLLISION.
   * The July question was amber `#FFA656` against the risk border `#EA7B4B`.
   *
   * ⭐ RE-DERIVED 8 Sep 2026 THROUGH THE REPO'S OWN INSTRUMENT — `canvas/edges/
   * cvdContrast.ts` (`deltaE2000`), the module PR #282's follow-up built for
   * exactly this. The first cut of these figures came from an ad-hoc script
   * whose dichromat step nothing validated; quoting ΔE from unbacked prose is
   * the defect `cvdContrast` exists to end, and this table had reproduced it.
   * The instrument reproduces its own committed pins (`polarityContrast.spec`)
   * to three decimals — 11.739 / 13.773 / 28.295 against the pinned 11.7 /
   * 13.8 / 28.3 — so it is the authority here, and these cells are ITS output
   * rounded to 1dp. Five of the nine original cells were off by 0.1–0.2; the
   * ranking, and the ruling, are unchanged.
   *
   *     amber vs …        normal   deuteranopia   protanopia
   *     risk / danger      13.9         8.9          12.2
   *     GOAL               17.0         5.5           8.7     ← worst, both
   *     factor             22.0        20.6          17.5
   *     outcome / success  43.6        19.8          12.7
   *     option             42.9        53.7          50.5
   *
   * Now pinned by `polarityContrast.spec` so these numbers cannot drift from
   * the tokens again — and so any future badge/confidence colour decision is
   * measured through the same instrument rather than through fresh ad-hoc
   * maths. `cvdContrast` refuses tritan rather than returning an invalid
   * figure, which is the other reason to route such questions through it.
   *
   * The rule explicitly covers *"the goal missing its target"*, so the treatment
   * was least distinguishable precisely on the node class it most often applies
   * to. ⭐ And the deeper defect is not the pairing at all: amber REPLACING the
   * kind hue made COLOUR THE SOLE CHANNEL for this state, which the design
   * system's own Developer Checklist forbids.
   *
   * ── WHAT CHANGED HERE, EXACTLY ─────────────────────────────────────────────
   * ONE TOKEN. `'border-warning'` → `colors.border`, the node's own kind hue.
   * The state now travels on the amber `StatusPill` in the corner stack below,
   * which already carried it for factor and goal and is now gated on
   * `isIncomplete` alone — visible words plus an accessible name, so the state
   * survives with no colour perception at all.
   *
   * ⚠ THE STYLE CHANNEL IS LEFT EXACTLY AS FOUND, and that is why this arm still
   * exists rather than falling through. It emits a hue and NO style class, so an
   * incomplete node renders SOLID — same as before. Falling through to the final
   * branch would append `borderStyle`, which returns `border-dashed` for a factor
   * whose `controllability` is `observable` or `partial`: that would re-open the
   * false "outside your control" claim on incomplete cards, one PR after it was
   * closed. The ruling was about the HUE; nothing here touches the dash.
   *
   * ⚠ EXTERNAL FACTORS ARE UNAFFECTED, and the reason sits UPSTREAM of this line
   * rather than inside it: `isFactorNeedsInput` returns false for
   * `category === 'external'`, so an external factor never enters this arm and
   * its dash comes from `borderStyle` in the final branch. That is what keeps
   * "external factors NEVER get the treatment" true structurally — and it is what
   * carries the exemption over to the BADGE for free, since the badge reads the
   * same `isIncomplete`.
   *
   * ⚠ PRECEDENCE IS UNCHANGED and is NOT the same question. `isIncomplete` still
   * wins over `borderClassOverride`. That is a separate, pre-existing
   * disagreement between two authorities about the goal card (trap 21);
   * re-ordering them here would be an undeclared ruling on it. Left as found —
   * and note it is load-bearing in the other direction too: `GoalNode`'s
   * override returns `border-panel-border border-dashed` for a targetless goal,
   * so deleting this arm rather than re-pointing it would have put a grey DASH
   * on the most important node on the canvas.
   *
   * ⚠ THE WIDTH OVERRIDE BELOW IS ALSO LEFT AS FOUND (`isIncomplete` → 2px). It
   * is not the colour channel Paul ruled on, and changing it would be a second
   * undeclared ruling in the same commit. It does now sit slightly awkwardly
   * against the width HIERARCHY this file declares a few lines up (factor 0.5px ·
   * decision/option 1px · everything else 2px) — flagged for adjudication, not
   * silently decided here.
   *
   * Pinned in THREE directions by `BaseNode.incompleteBorderVocabulary.spec.tsx`
   * — the incomplete node must KEEP ITS KIND HUE and carry the badge, it must
   * still LOSE the dash, and the external factor must still KEEP it, in one file,
   * so a change that flattened any of those channels cannot pass.
   */
  /**
   * ⭐⭐ THE COLOURED SHAPE THE LEVEL-OF-DETAIL DESIGN ALWAYS PROMISED.
   *
   * The body comment below this component's children says a node at the LOD rung
   * "reads as its COLOURED SHAPE, PLUS the one reduced line". The box half was
   * built — the body hides via `visibility` so it keeps the dimensions ELK and
   * the edge anchors depend on — and the COLOUR half never was: the card painted
   * `var(--bg-panel)` at every rung, so a zoomed-out node was a WHITE box whose
   * interior is blank by construction. Measured on `b7c8c74e`: an option card at
   * scale 0.27 carried content across the top ~45% and nothing below.
   *
   * ⭐ NOTHING NEW IS INVENTED. `colors.bg` has sat beside `colors.border` in
   * `nodes/colors.ts` since it was written, resolving to a real `--*-light-rgb`
   * token. It was authored for this and never applied.
   *
   * ⛔ THE EVIDENCE LENS KEEPS THE CARD. `evidenceBgStyle` is a DATA channel; a
   * lens colouring by evidence must not be overpainted by kind, so this stands
   * down whenever that is present — the same precedence the inline paint already
   * had. Causal/evidence lenses render their own reduced card and are excluded
   * for the same reason.
   *
   * ⚠ LINE RUNG ONLY, deliberately. Tinting at reading zoom is a different
   * product decision and is not ruled on here.
   * Pinned by `BaseNode.lodShapeReadsAsItsKind.spec.tsx` as a RUNG PAIR: a
   * presence-only test would pass if this tinted at every rung.
   */
  const lodKindFillClass =
    lodBodyHidden && !isCausalLens && !isEvidenceLens && !evidenceBgStyle ? colors.bg : ''

  const borderColourClass = isCausalLens
    ? (causalBorderClass ?? '')
    : isIncomplete
      ? colors.border
      : borderClassOverride ?? `${colors.border} ${borderStyle}`

  return (
    <div
      role="group"
      aria-label={accessibleName}
      aria-expanded={description ? isExpanded : undefined}
      {...(isIncomplete ? { 'data-testid': nodeType === 'goal' ? 'overlay-missing-threshold-node' : 'overlay-missing-value' } : {})}
      {...(nodeType === 'factor' && data?.category === 'external' ? { title: 'Outside your control' } : {})}
      {...(isAnalysisDriver ? { 'data-analysis-driver': 'true' } : {})}
      {...(isAssistantFocused ? { 'data-assistant-focused': 'true' } : {})}
      // ⭐ `text-left` IS A DECLARATION, AND THE CARD PREVIOUSLY HAD NONE.
      //
      // Paul, 5 Sep 2026: node copy "should NEVER be centrally aligned". Two
      // components were centring text and both were deleted — but this root
      // declared no `text-align` at all, so the card's left alignment was
      // INHERITED from whatever mounts the canvas. Any ancestor, or any
      // third-party stylesheet, that centred text would have centred every node
      // title and nothing in these components would have resisted it.
      // `node_modules` is outside every grep this estate runs, so
      // `@xyflow/react`'s own stylesheet was an unaudited route in.
      //
      // Deleting two classes cannot enforce a rule; a declaration can. Pinned by
      // `__tests__/nodeCopyIsNeverCentred.spec.tsx`.
      className={`
        text-left
        group relative rounded-lg ${isCausalLens ? 'border' : isIncomplete ? 'border-2' : borderWidth} ${
          /* ⭐⭐ THE GOAL IS THE TERMINUS, AND IT RENDERED AS THE PALEST CARD.
             Every edge on the board converges on it and it carried the same
             elevation as a factor five rows above it — so the thing the whole
             argument is FOR was, visually, the least of it.
             ⚠ ELEVATION, NOT BORDER WIDTH, AND THAT IS THE WHOLE CONSTRAINT.
             A border change alters the card's measured box, which moves ELK's
             placement and every edge anchor with it — the geometry this lane
             has already repaired twice. A shadow paints outside the box and
             changes nothing measurable. */
          nodeType === 'goal' ? 'shadow-3' : 'shadow-1'
        }
        ${borderColourClass}
        ${lodKindFillClass}
        transition-all duration-200
        cursor-default
        ${selected && !isHighlighted ? `${colors.selected} ring-offset-2` : ''}
        ${isHighlighted && !isAttended ? 'ring-4 ring-info/60 ai-highlight-pulse' : ''}
        ${isAttended ? 'ring-4 ring-info olumi-attended' : ''}
        ${isAttentionDimmed ? 'opacity-30 saturate-50 transition-opacity duration-300' : ''}
        ${isLensDimmed ? 'opacity-20' : isDimmed ? 'opacity-60' : ''}
      `}
      style={{
        // Analysis-graph projection: an info RING around a viewed driver node.
        // outline is a separate CSS channel from box-shadow, so it composes with
        // the selection / hover rings and shadow-1 instead of clobbering them;
        // it wraps all four sides (never a one-sided accent) and uses the info
        // state token. Animates via the div's transition-all.
        outline: isAnalysisDriver ? '2px solid var(--semantic-info)' : undefined,
        outlineOffset: isAnalysisDriver ? '3px' : undefined,
        // ⚠ THE INLINE PAINT MUST STAND DOWN WHERE THE KIND FILL APPLIES, or the
        // class below is overridden by specificity and the fix is invisible.
        backgroundColor: evidenceBgStyle ?? (lodKindFillClass === '' ? 'var(--bg-panel)' : undefined),
        // ⚠ THIS IS A DISJUNCTION, AND THE COMMENT THAT USED TO SIT HERE
        // DENIED IT. It said the reservation "follows the SAME condition rather
        // than a hand-listed pair of node types". It does not: `4a337f70` OR'd
        // `showQuickActions` in FRONT of the legacy `factor | option` pair and
        // KEPT the pair. Both arms are live.
        //
        // WHERE THEY DIVERGE: exactly when `lodBodyHidden` is true — below the
        // 0.5 legibility floor. There `showQuickActions` is false and
        // `NodeQuickActions` is unmounted, yet a `factor` or `option` card
        // still reserves 24px of bottom band for it (dead space), while every
        // other node kind drops the reservation across the same threshold.
        //
        // ⛔ NO REACHABILITY CLAIM IS MADE HERE, DELIBERATELY.
        //
        // Three rounds of this PR tried to state where a user meets this
        // divergence, and all three were wrong: "the band the clamped default
        // camera operates in" (overstated), "only by a manual zoom-out"
        // (overcorrected), then a three-item route list — which round 6 showed
        // was SHORT, and short by a route this repo had already measured.
        //
        // The list was short because it was scoped to the wrong axis.
        // `LodSync.tsx` derives the rung from the LIVE VIEWPORT
        // (`resolveLodRung(s.transform[2])`), so EVERY writer of the main
        // canvas viewport is a route — not only fits that pass through
        // `fitBoundsFor`. Two families were missing, and one is decisive:
        // `useFitViewOnLayoutVersion.ts:360-366` already records that the
        // product's floored fit can fail to run at all, leaving xyflow's bare
        // mount `fitView` prop, which "parks at 0.4279 — BELOW
        // `LABEL_LEGIBLE_ZOOM`". So even "the clamped default camera is NOT a
        // route" was false.
        //
        // ⭐ A ROUTE LIST IN A COMMENT IS A HAND-MAINTAINED MIRROR, and this one
        // was found short within a single round. The fix for a claim nobody can
        // bound is NOT a better claim — it is no claim. If reachability must be
        // asserted, it belongs in a DERIVED GUARD that fails loudly when a new
        // viewport writer appears, not in prose someone must remember to update.
        //
        // What IS pinned here, and is all that this block needs: the divergence
        // condition above. It is unpinned by any test, and it is rowed.
        //
        // NOT changed here (4 Sep 2026, rowed): which way it should resolve —
        // drop the reservation below the floor, or keep one uniform card box —
        // is a design ruling, not a defect with a single obvious repair.
        //
        // ⭐⭐ THE BAND IS NOW DERIVED FROM THE ROW IT RESERVES FOR, ON THE ARM
        // THAT ACTUALLY HAS A ROW. The literal `24` was a hand-copy of
        // `NodeQuickActions`' `bottom-1.5 + h-5` (6 + 20 = 26, so 2px short from
        // the day it was written), and #1274 counter-scaled the box and the slop
        // without it: at the settle zoom the row occupied 50px against a
        // reservation of 24, and every one of 19 cards had its own controls
        // sitting over its own text (measured, `vendor-selection` @1440x900,
        // zoom 0.5000: 40 overlaps, 11,392.5px^2). `NODE_QUICK_ACTION_BAND_PX`
        // is that sum, computed from the row's own constants at
        // `MAX_LABEL_COUNTER_SCALE`; see its header for why it is a CONSTANT and
        // not a `calc(... * var(--canvas-label-scale))`.
        //
        // ⚠ THE LEGACY ARM KEEPS ITS 24px, DELIBERATELY AND UNCHANGED. The
        // divergence documented above — `factor`/`option` reserving a band below
        // the legibility floor where this layer is UNMOUNTED — is rowed, and how
        // it should resolve is called a design ruling rather than a defect. That
        // ruling is not this lane's to make. Feeding the new, larger band into
        // that arm would have made its dead space 50px instead of 24px on a card
        // carrying no row at all: a silent worsening of a known open question,
        // smuggled in as a side effect of fixing a different one. So the two arms
        // are named apart and only the one with a row to reserve for moves.
        padding: showQuickActions
          ? `12px 12px ${NODE_QUICK_ACTION_BAND_PX}px 12px`
          : (nodeType === 'factor' || nodeType === 'option') && !isCausalLens && !isEvidenceLens
            ? '12px 12px 24px 12px'
            : '12px',
        // The card's own floor is the LAYOUT floor, imported rather than
        // restated: this was a hardcoded `'140px'` that happened to equal
        // `NODE_LAYOUT_MIN_W`, i.e. two copies of one number with nothing to
        // go red when they stopped agreeing (CLAUDE.md trap 12). It is now one
        // number, and it carries the label counter-scale with it — see the
        // header of `nodeLayoutConstants.ts`.
        minWidth: `${NODE_LAYOUT_MIN_W}px`,
        // Width policy:
        //  - Non-expanded: use caller's maxWidth if given, else the last layout's
        //    width, else fall back to NODE_CARD_MAX_W so rendered width matches ELK.
        //  - Expanded: deliberately override both `maxWidth` and `layoutNodeWidth`
        //    with NODE_CARD_MAX_W. Expanded nodes show a description panel and need
        //    a readable width regardless of what a caller or layout computed.
        /**
         * ⭐⭐ `width`, NOT ONLY `maxWidth` — AND THIS IS THE LINE PAUL WAS
         * ACTUALLY ASKING FOR.
         *
         * A max lets every card shrink to its own content, so one row of
         * options measured **282 / 300 / 306** and the Question card **327**
         * while the layout had reserved 336 for each. Two consequences, both
         * visible in his 15 Sep manual test:
         *
         *   · *"There is a lack of consistency"* — neighbours in one row are
         *     three different widths, for no reason a reader can see.
         *   · *"You still haven't increased the width of the nodes"* — raising
         *     a CAP cannot widen a card that was never reaching the cap. Every
         *     widening upstream of here was invisible for that reason alone.
         *
         * ⭐ AND THE LAYOUT ALREADY ASSUMES IT. ELK was handed a box of exactly
         * this width and the positions are on that stride, so a card drawing
         * narrower is not saving anything — it is leaving a phantom gap inside
         * a slot the board has already paid for. Filling the slot is the
         * honest rendering of the geometry that exists.
         *
         * `maxWidth` is kept beside it so the expanded branch and any caller
         * passing an explicit `maxWidth` still bound the card.
         */
        width: `${renderedCardW}px`,
        maxWidth: `${renderedCardW}px`,
        minHeight: isExpanded ? '120px' : undefined,
      }}
    >
      {/* R5 contextual efficiency layer — quiet at rest, revealed on hover, on
          keyboard focus within the card, and while the node is selected. One
          home for it (here) rather than per-node-type, so every node speaks the
          same three shortcuts: Ask Olumi, Challenge, and More. Details is in
          More and also opens when the node is clicked.
          Bottom-RIGHT: the top-right corner is owned by node-corner-stack
          below, and this layer overlapped it by ~6px at a lower z until a
          review caught it. ⚠ `showQuickActions` gates THIS MOUNT ONLY. The
          older sentence here called it "the single source for both the mount
          and the footer padding"; that was false at these bytes — the padding
          above is a disjunction that also fires on `factor` and `option` below
          the legibility floor, where this layer is unmounted. */}
      {showQuickActions && (
        <NodeQuickActions
          nodeId={id}
          nodeType={nodeType}
          label={label}
          alwaysVisible={selected === true}
        />
      )}

      {isAssistantFocused && (
        <span
          aria-hidden="true"
          data-testid={`assistant-focus-node-halo-${id}`}
          className="pointer-events-none absolute -inset-1 z-[1] rounded-md border-2 border-info ring-2 ring-info/30 ring-offset-1"
        />
      )}

      {/* Context menu: Assumption flag badge (Hard rule 3 — UI-only annotation) */}
      {Boolean(data?.flagged_as_assumption) && (
        <div
          className="absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full bg-panel border border-warning shadow-1"
          title="Flagged as assumption"
          data-testid="assumption-badge"
        >
          <FlagIcon size={12} className="text-text-body" />
        </div>
      )}

      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Top}
        className={`${colors.border.replace('border-', 'bg-')}`}
        style={{
          width: 12,
          height: 12,
          border: '2px solid white',
        }}
        aria-label="Input connection"
      />
      
      {/* Graph Editing Experience Task 5: Impact preview indicator (top-left to avoid rank badge collision) */}
      {impactDirection && (
        <div
          className="absolute -top-3 -left-3 z-20 rounded-full w-5 h-5 flex items-center justify-center shadow-sm"
          style={{
            backgroundColor: impactDirection === 'increase' ? 'var(--semantic-success, #22c55e)'
              : impactDirection === 'decrease' ? 'var(--semantic-danger, #ef4444)'
              : 'var(--text-muted, #9ca3af)',
          }}
        >
          {impactDirection === 'increase' && <ArrowUp className="w-3 h-3 text-white" />}
          {impactDirection === 'decrease' && <ArrowDown className="w-3 h-3 text-white" />}
          {impactDirection === 'mixed' && <Minus className="w-3 h-3 text-white" />}
        </div>
      )}

      {/* Top-right corner STACK — a single absolutely-positioned flex row that
          OWNS this corner so the sensitivity-rank badge, the edited-since-run
          dot and the coaching marker never collide. All three previously
          rendered independently in this same corner (rank + coaching at
          `-top-2 -right-2 z-10`; the edited dot at `-top-1 -right-1`, default
          z), so the coaching marker fully covered the edited dot when both were
          present (Codex P2, browser-confirmed) — the same class of same-corner
          overlap the P1-5 rank/coaching fix addressed. They are now static flex
          siblings here, ordered smallest-in-the-middle for legibility: of those
          three, rank came first (it reads "key driver #N"), then the small 10px
          edited-since-run freshness dot, then the interactive coaching marker
          anchored at the corner (rightmost — the easiest click target). ⚠ That
          is the ORIGINAL three-member order and it is kept here as history:
          rank is no longer the container's first child, because two wider
          members have since joined ahead of it. The live order is the
          five-member contract below, which is the one to read. The row is anchored by
          its right edge and grows leftward, keeping all three inside the top
          band (no title overlap) and off the node's right side; siblings never
          overlap, so each stays visible and the coaching button stays
          clickable. Each child self-gates, so the container is empty (0×0,
          inert) when none applies.

          ⭐⭐ THE CONTRACT IS NOW FIVE MEMBERS, AND IT IS STATED ONCE HERE
          (reconciled 2026-09-04, when the fourth and fifth arrived one PR
          apart). Two independent migrations each closed the same defect class
          in this corner — the "Needs input" `StatusPill` (#1177, factor/goal at
          the time; every incomplete node type since Paul's 8 Sep badge ruling) and
          option's "Leading option" pill (#1176, via `cornerSlot`) — and each
          was written calling itself "the fourth occupant". Both cannot be, and
          a reader following either sentence literally would renumber the other
          out of the contract. The single contract, in DOM order:

              cornerSlot · StatusPill · rank · edited dot · coaching

          ⚠ AND THREE OF THE TEN PAIRS CAN NEVER CO-OCCUR, which is derived,
          not incidental — the contract is written total anyway so it stays
          correct if a gate ever changes, and each impossibility is PINNED by a
          spec that REDs on the change rather than silently overlapping:
          • `cornerSlot` vs `StatusPill` — still impossible, BY A DIFFERENT
            MECHANISM SINCE 8 Sep 2026, and the change is recorded here because a
            reason left in the wrong place is how a later session concludes the
            pair can overlap and re-measures nothing. It USED to be disjoint by
            NODE TYPE: `cornerSlot` has exactly one caller (`OptionNode.tsx`,
            `nodeType="option"`) and the pill was gated
            `isIncomplete && (nodeType === 'factor' || nodeType === 'goal')`.
            Paul's badge re-ruling deleted that node-type pair, so the pill now
            reaches option cards. They are disjoint on RESULTS MODE instead, and
            exactly: `cornerSlot`'s caller renders it under `isRecommended`,
            which returns false unless `displayMetadata.isResultsMode`
            (`resultsStatus === 'complete'`); the pill needs `isPreRunMode`
            (`resultsStatus !== 'complete'`). One store field, opposite tests —
            the same shape as the pill-vs-rank line below. Their relative order
            is therefore still UNOBSERVABLE at runtime; `cornerSlot` leads only
            because it is the caller's slot. Pinned, source-derived, in
            `BaseNode.needsJudgementBadge.spec.tsx`.
          • `StatusPill` vs `rank` — disjoint on ONE store field: the rank badge
            requires `results.status === 'complete'` (`isResultsMode`, declared
            in `useNodeDisplayMetadata.ts`) and the pill requires
            `results.status !== 'complete'` (`isPreRunMode`, declared in THIS
            file). Exact complements. Pinned by
            `BaseNode.statusPillCornerStack.spec.tsx` with the REAL hook.
            ⚠ THESE NAME SYMBOLS, NOT LINE OFFSETS, AND THAT IS THE POINT. This
            sentence carried `:256` — the right offset against the wrong file —
            and the correction that repaired the filename broke the number
            instead, landing on a line that was right nowhere. A neighbouring
            merge then moved the hook's own offsets again. A symbol survives
            both; an offset buys one merge of accuracy and misdirects after it.
          • `cornerSlot` vs `rank` — impossible too, and by a mechanism one
            layer up from the other two: it is not that two render gates here
            exclude each other, but that the DATUM is never produced.
            In `useNodeDisplayMetadata.ts`, `sensitivityRank` is declared
            `null` and REASSIGNED in exactly one place — inside that hook's
            `if (nodeType === 'factor')` branch. BaseNode passes its own
            `nodeType`, and OptionNode's is `"option"`, so on the only node type
            that can supply `cornerSlot` the rank badge can never render.
            Pinned by `OptionNode.leadingPillCornerStack.spec.tsx`.
          So the largest set reachable on ONE node is THREE: a wide pill (either
          one, per node type) · the edited dot · the coaching marker.

          ⚠ ORDER IS WIDEST-FIRST, and that is what puts a wide pill at the
          head: the row is anchored by its RIGHT edge and grows LEFTWARD, so the
          widest child must lead or it pushes the small badges away from the
          corner and displaces the coaching marker from the rightmost, easiest
          click target. The StatusPill measured 67.9px against the dot's 5px at
          the same zoom, so it leads by a wide margin.

          ⭐ HOW EACH ARRIVED, because the class is what matters more than the
          count. `StatusPill` hand-wrote `absolute -top-2 -right-1 z-10` — ONE
          pixel from this container's `-right-2` and at the SAME z. Measured in
          real Chromium before the move (`e2e/geometry/statusPillCorner.measure.ts`,
          1440x900, starters `vendor-selection` / `build-vs-buy`, with a prior
          run in history): it covered 15px² of the edited-since-run dot's 25px²
          — 60% of it, with a no-run-history control arm at zero, so the probe
          discriminated. OptionNode's "Leading option" pill hand-wrote this
          container's anchor and z BYTE-FOR-BYTE as an independent box outside
          it, and was simply never migrated when the rank badge, the edited dot
          and the coaching marker were; it now enters through `cornerSlot`. Each
          previous instance in this corner was closed the same way — by folding
          the new occupant in, never by adding another hand-written offset. */}
      <div
        data-testid={`node-corner-stack-${id}`}
        /**
         * ⛔⛔ ANCHORED BY ITS OWN HEIGHT, NOT BY A FIXED −8px — because the two
         * halves of this corner scale DIFFERENTLY and only one of them knew it.
         *
         * `-top-2` is 8 CSS px, unscaled. Everything INSIDE the stack carries
         * `--canvas-label-scale` (`typography.nodeLabel` is
         * `calc(12px * var(--canvas-label-scale, 1))`). At the settle zoom that
         * scale caps at 2, so the `Needs input` pill grows to ~34px tall while
         * its anchor stays at −8 — and the bottom ~12px of it lands on the ✨
         * provenance mark in the card header, which is `ml-auto` flush to the
         * same right edge. Paul's 15 Sep manual test caught it on four cards at
         * once. At zoom ≥ 1 it does not happen at all, which is why it survived.
         *
         * ⭐ `bottom-full` tracks the element's OWN box, so it is derived rather
         * than a second hand-written offset to keep in step with the first —
         * the stack now sits in a band above the card at every scale and can
         * never reach the header. Precedent in the same tree:
         * `FactorNode.tsx`'s hover-intervention annotation.
         *
         * ⚠ WHAT THIS DOES NOT ESTABLISH: that the band is clear of the card
         * ABOVE. Tier separation is `LAYOUT_LAYER_GAP` (72) against a ~34px
         * pill, so there is room by arithmetic — but arithmetic is not a
         * measurement, and the measurement is in the browser, not here.
         */
        className={CANVAS_CORNER_STACK_CLASSES}
      >
        {/* Caller-supplied corner member — first in DOM order. Today it has
            exactly one caller: OptionNode's "Leading option" pill, which used
            to hand-write this container's own `absolute -top-2 -right-2 z-10`
            as a separate box outside it. It enters here so the corner keeps
            exactly ONE positioning authority.

            ⚠ Its position relative to the `StatusPill` below is UNOBSERVABLE
            — but NOT for the reason this comment carried until 8 Sep 2026. It
            said the pill was gated to `factor`/`goal`; Paul's badge re-ruling
            DELETED that node-type pair, so the pill reaches option cards too and
            that reason is now false. They are disjoint on RESULTS MODE instead:
            `cornerSlot`'s caller renders under `isRecommended`, which needs
            `isResultsMode`; the pill needs `isPreRunMode`. One store field,
            opposite tests — derived in full in the five-member contract above and
            pinned by `BaseNode.needsJudgementBadge.spec.tsx`. Widest-first governs each of
            them against the three badges that follow, which is what keeps those
            at their existing distance from the corner and the coaching marker
            rightmost. See the `cornerSlot` prop. */}
        {cornerSlot}

        {/* Graph v1.1: "Needs input" StatusPill replaces the legacy "?" badge for
            factor (no value) and goal (no threshold). Wireframe v4 — FactorNeedsPre
            / GoalNoTargetPre.

            ⭐⭐⭐ IT IS NOW THE ONLY CARRIER OF THAT STATE, ON EVERY NODE TYPE
            `isIncomplete` ADMITS (Paul's re-ruling, 8 Sep 2026). This gate read
            `isIncomplete && (nodeType === 'factor' || nodeType === 'goal')`, and
            the sentence beside it read *"Decision/option keep the warning border
            only"* — which was true until that border stopped being amber. Paul
            ruled the kind hue stays and the state becomes a badge, so the
            hand-listed pair was DELETED rather than complemented: leaving it
            would have left `decision` and `option` with no channel at all, and
            adding a second, different marker for them would be two renderings of
            one state that nothing keeps in step (CLAUDE.md trap 12).

            ⚠ WHY NOT A DOT. The lane brief proposed reusing the edited-since-run
            dot's shape. A mute coloured dot moves the defect rather than closing
            it: for a sighted user its only channel is still a colour, and the
            ruling exists because colour was the sole channel. The pill says the
            words. It is also the affordance that already existed for this exact
            state, so this adds no new amber vocabulary.

            ⚠ NO NEW COPY WAS MINTED. Both strings below already shipped, and the
            non-goal arm — `'Missing required input'` — was already the default
            for anything that was not a goal. Extending the gate reaches it for
            the first time on `decision` and `option`; it is true of both (an
            option CEE assessed with no interventions, a decision with no option
            linked). Anything more specific would be a new claim needing its own
            derivation, and this commit is a re-ruling, not a copy change.

            ⚠ EXTERNAL FACTORS STILL NEVER GET IT, and for the same structural
            reason the border never gave it to them: `isFactorNeedsInput` returns
            false for `category === 'external'`, so they never reach
            `isIncomplete`. The exemption survived the move for free — asserted,
            not assumed, in `BaseNode.needsJudgementBadge.spec.tsx`.

            ⭐ THE GOAL SENTENCE STATES A CONSEQUENCE, NEVER A GATE (28 Aug 2026).
            It read "Set a success threshold to enable analysis" — and NOTHING gates
            analysis on a threshold.

            `isIncomplete`'s goal arm and `canRunAnalysis` answer DIFFERENT questions
            and are CORRECTLY different. This marker asks "before results exist, does
            this goal node carry a success target?" — completeness, one node. The run
            gate (`canRunAnalysis` → `readinessObjectsToRun`) asks "has an authority
            stated this model cannot be analysed now?" — admissibility, whole model,
            producer-decided; it never reads node data at all. Aligning them is banned
            by `readinessObjectsToRun`'s own header, which spends ~80 lines forbidding
            exactly the parallel UI-side rule a threshold check would create. The gate
            is right; this sentence was false.

            What actually happens with no target: the run SUCCEEDS. The producer
            synthesises `auto_goal_threshold` and returns a real analysis with goal-fit
            claims honestly suppressed (GoalNode.tsx, crownCompliance.ts,
            goalThresholdResolvers.ts). Then `results.status === 'complete'` clears
            `isPreRunMode` and this pill vanishes with nothing set — the product
            silently retracted its own claim rather than ever being contradicted.
            `StatusPill` reuses `title` as `aria-label`, so a screen-reader user
            received ONLY the false sentence: that is the path this fixes.

            The replacement is IMPORTED, not re-typed. It is the string the
            pre-analysis footer already ships for this exact state, and a re-typed
            variant is invisible to every runtime check (that module's copy is also
            scanned by the glossary guard). Both surfaces answer one question —
            "success is undefined, what follows?" — so a single string is correct
            here rather than a two-questions-one-name conflation.
            ⚠ THIS BLOCK ONCE READ that the ACTION is not duplicated "because
            GoalNode co-renders its `Target not captured — add one` chip … and that
            chip carries both the action and its own aria-label". BOTH HALVES WERE
            FALSE AT THIS HEAD, and they were written by an earlier round of THIS PR,
            then not re-synced when the same PR withdrew that copy — the exact defect
            class the final commit exists to correct, one file over.
            Derived: `GoalNode.tsx:160` `export const GOAL_NO_TARGET_STATE =
            'Target not captured'` — there is no "— add one", and after the
            withdrawal the co-rendered chip states the FACT and offers NO action.
            So the reason `StatusPill` needs no action here is NOT that a sibling
            supplies one. It is that there is no action to offer while the
            destination is inert.
            ⚠ AN EARLIER DRAFT OF THIS BLOCK ADDED "…the fact plus a route to the
            details, which is what both surfaces now give". THAT WAS FALSE, and it
            was written while correcting a false sentence four lines above — which
            is worth recording, because it is the same failure one round later.
            `StatusPill` is a `<span role="status">` (`StatusPill.tsx:45-46`) with
            NO handler: its channels are "Needs input" and the title sentence, and
            neither is a route. Only the sibling chip is a real
            `<button onClick={openNodeInspector}>` (`GoalNode.tsx:623`). So exactly
            ONE of the two surfaces offers a route, and this pill states the fact
            alone — which is the honest thing for an inert destination, and is the
            whole reason it needs no action. */}
        {/* ⭐ EXCLUSION OUTRANKS "NEEDS INPUT", AND IT REPLACES IT RATHER THAN
            STACKING BESIDE IT. Two reasons, one of them structural:

            · It states the CONSEQUENCE rather than the cause. "Needs input"
              tells a user something is missing; "Not in this analysis" tells
              them what that costs them, and carries the cause in its title —
              CEE's OWN sentence, not one this component composed.
            · The corner stack is pinned at three children by
              `BaseNode.cornerStack.spec.tsx`. A fourth child is a breaking
              change to a deliberate layout constraint, and this claim does not
              need one: the two pills answer questions in the same family and
              the stronger one subsumes the weaker.

            ⚠ The title falls back only when CEE sent an EMPTY message. It is
            never used to manufacture a reason — the pill states the exclusion,
            which CEE stamped, and nothing about why beyond what CEE said. */}
        {isExcludedFromAnalysis ? (
          <StatusPill
            testId="excluded-from-analysis-pill"
            label="Not in this analysis"
            title={exclusionMessage !== null && exclusionMessage !== ''
              ? exclusionMessage
              : 'The analysis will run without this option'}
          />
        ) : isRetainedExcluded ? (
          /* ⭐ A THIRD ARM OF THE SAME TERNARY — NOT A FOURTH CHILD OF THE STACK.
             `BaseNode.cornerStack.spec.tsx` pins this container at three
             children, and that pin is a deliberate layout constraint rather
             than an accident. Joining the existing chain REPLACES rather than
             stacks, so the child count is unchanged and no measurement anyone
             took in a browser is invalidated by this change.

             PRECEDENCE, and each position is argued rather than inherited:
             · BELOW the readiness exclusion, which is untouched. That pill is
               shipped, measured and reasoned about at length above; an inert
               new claim does not get to reorder a live one on the strength of
               an argument nobody has run the product against. On an option
               where both could fire, the user keeps exactly what they see today.
             · ABOVE `isIncomplete`, for the reason the block above already
               gives for the exclusion pill: it states the CONSEQUENCE rather
               than the cause. "Needs input" tells a user something is missing;
               this tells them what that cost them — the calculation went ahead
               without the node. The stronger claim subsumes the weaker, and it
               carries the weaker inside it ("Unfinished").

             ⚠ ONE STRING IN BOTH SLOTS, DELIBERATELY. `StatusPill` reuses
             `title` as `aria-label`, so label and title identical means the
             screen-reader user and the sighted user receive the SAME sentence —
             the founder's ruled wording, whole. A shortened label with the full
             sentence in the tooltip would give them different claims, and the
             shorter of the two would be one the UI authored. */
          <StatusPill
            testId={UNFINISHED_CONTRIBUTION_TEST_ID}
            label={UNFINISHED_CONTRIBUTION_COPY}
            title={UNFINISHED_CONTRIBUTION_COPY}
          />
        ) : isIncomplete ? (
          /* ⭐⭐ NOT MODELLED IS NOT NOT ESTIMATED — ONE PILL WAS SAYING BOTH.

             `isIncomplete` admits four node types, and until this change all
             four rendered the identical pill: `needs-input-pill`, label
             "Needs input", title "Missing required input". Three of the arms
             are quantitative — a factor with no value, a goal with no target,
             an option with no interventions. The DECISION arm is not, and this
             file's own spec had already written the distinction down:
             `BaseNode.needsJudgementBadge.spec.tsx` — *"a decision node's
             incompleteness is the ONLY one of the four that is a property of
             the GRAPH rather than of the node's own data"*. The difference was
             known, documented in the suite, and drawn the same way anyway.

             ⛔ THE COST IS THE NEXT STEP. "Missing required input" tells a
             reader to supply a value to this card. On an optionless decision
             there is no value to supply — what is absent is the alternatives
             themselves, and the repair is to create them. Pooling the two
             means a reader cannot tell "nobody estimated this" from "this was
             never modelled", so they take the wrong action or none.

             ⚠ THE CARD WAS ALREADY DISAGREEING WITH ITSELF. `DecisionNode`'s
             resting line has said `No options linked yet` with an `Add options`
             CTA for some time, on the SAME card, at the SAME moment this pill
             said "Needs input". Two surfaces, one fact, two vocabularies — and
             the one with no route was the one using the misleading word. Both
             now read `STRUCTURAL_UNSET`, one record, so they cannot drift back
             apart (CLAUDE.md trap 12). They read DIFFERENT MEMBERS of it on
             purpose: the pill states the CONSEQUENCE ("nothing to compare
             yet") and the body states the CAUSE. Giving both surfaces the
             identical string was the first cut of this change, and
             `DecisionNode.readinessSummary.spec.tsx` caught it — the card
             rendered one sentence twice.

             ⛔⛔ AND THE FIRST FIX ONLY MOVED THAT DUPLICATE ONTO THE CHANNEL
             NOBODY WAS LOOKING AT — NO `title` HERE, DELIBERATELY.

             This arm shipped `title={STRUCTURAL_UNSET.noOptions}`, and
             `StatusPill` composes `aria-label={title ?? label}` as well as the
             tooltip (`StatusPill.tsx` — the same reuse this file's goal-arm
             block above already records as load-bearing, naming the symbol
             rather than an offset for the reason the corner-stack block gives).
             So the pill ANNOUNCED the body line's sentence verbatim,
             `role="status"`, on a card whose body announces it too: the sighted
             user got two sentences and the screen-reader user got one sentence
             twice — the exact defect this block exists to remove, surviving in
             the accessibility tree.

             ⛔ AND THE GREEN CAME FROM THE INSTRUMENT, NOT FROM THE FIX. What
             caught the visible duplicate was `getByText`, which reads TEXT
             CONTENT and cannot see `aria-label`. Moving the string from `label`
             into `title` therefore turned that assertion green while leaving
             the duplication exactly where it was, one channel over
             (CLAUDE.md trap 13b — a guard that cannot observe the property it
             certifies).

             ⭐ THE FIX IS TO OMIT `title`, NOT TO PARAPHRASE IT. A third
             sentence about one fact, visible to no reviewer, is this defect one
             round later; a paraphrase still says the same sentence twice to
             AT. With `title` absent the component's documented fallback makes
             BOTH the accessible name and the tooltip the VISIBLE label, so the
             two channels agree by construction and there is no second string
             left to drift into the body's (WCAG 2.5.3 Label in Name, which the
             shipped arm also failed: name and visible label were different
             sentences).

             ⚠ NOTHING IS LOST ON THE UNNAMED ARM. The cause lives on the body
             line wherever that line renders; where it does not — an UNNAMED
             optionless decision, which renders `unnamedLine` — "Nothing to
             compare yet" is a complete statement of the structural absence and
             prescribes no act. That restraint is this file's own goal-arm rule:
             a `role="status"` span with no handler is not a route, so it states
             the fact and offers no action the card cannot perform.

             ⚠ ITS OWN TESTID, FOR THE REASON `StatusPill` ALREADY ARGUES in
             its own header: a second claim reusing `needs-input-pill` makes an
             assertion pass on a node that says no such thing (trap 19). The
             exclusion pill above set this precedent; this follows it.

             ⛔ STILL ONE CHILD, NOT TWO. This REPLACES the pill for decisions
             rather than adding beside it — the corner stack is pinned at three
             children, and these two arms answer the same question. No hue, no
             geometry and no other arm's copy changes. */
          nodeType === 'decision' ? (
            <StatusPill
              testId="no-options-linked-pill"
              label={STRUCTURAL_UNSET.nothingCompared}
            />
          ) : (
            <StatusPill
              label="Needs input"
              title={nodeType === 'goal' ? FOOTER_COPY.readySubSuccessUnset : 'Missing required input'}
            />
          )
        ) : null}

        {/* Sensitivity rank badge — Results mode, top 3 factors. */}
        {typeof displayMetadata.sensitivityRank === 'number' && (
          <span
            data-testid={`sensitivity-rank-${id}`}
            /* ⛔⛔ IT WAS A FIXED ROUND BOX HOLDING `#N`, AND IT CARRIED NO
               WORD AT ALL — `data-node-glyph`, `rounded-full`,
               `justify-center`, `minWidth: 20px`, `height: 20px`.

               Measured on deployed staging, 18 Sep 2026: factor cards read
               `#1`, `#2`, `#3`. **`#1` reads as BEST.** It means MOST
               SENSITIVE — the factor the result moves most on, which is
               usually the factor the team knows LEAST about and should be
               arguing with, not trusting. The badge inverted its own meaning
               on the cards where the inversion costs most.

               ⭐ THREE THINGS CHANGE TOGETHER AND NONE OF THEM IS COSMETIC:

               (1) THE WORD. `sensitivityRankBadgeLabel` renders
                   `Key driver 1` — the same builder the `aria-label` below is
                   composed from, so the card and the screen reader cannot be
                   given different words for one badge (which is precisely the
                   drift #1414 shipped; see `metricVocabulary.ts`).

               (2) THE GLYPH DECLARATION GOES, AND SO DOES THE CENTRING. This
                   span declared `data-node-glyph`, the exemption
                   `nodeCopyIsNeverCentred.spec.tsx` honours for copy that is
                   a glyph by construction. A numeral was. A NOUN IS NOT.
                   Keeping the attribute would have held an exemption open
                   over real copy — the hand-maintained-mirror shape one level
                   up from the one that guard exists to close — so the
                   exemption is surrendered and `justify-center` with it. The
                   words now sit where the reading order puts them, like the
                   `StatusPill` two lines above.

               (3) THE FIXED 20px BOX GOES, AND IT HAD TO. `typography.nodeLabel`
                   is `calc(12px * var(--canvas-label-scale))` and that scale
                   caps at 2, so at the settle zoom the type reaches ~24px
                   inside a 20px box. A two-character numeral survived that;
                   `Key driver 1` would have been clipped. Geometry is now
                   `StatusPill`'s — padding plus `lineHeight`, which counter-
                   scales with the type instead of fighting it.

               ⚠ WIDTH, WHICH THE BRIEF ASKED ABOUT, AND IT IS BOUNDED BY A
               DERIVATION RATHER THAN BY HOPE. This badge's only possible
               neighbours are the 10px edited-since-run dot and the coaching
               marker: the corner stack's five-member contract above records
               that `StatusPill` is disjoint from it on `results.status`, and
               `cornerSlot` cannot co-occur because `sensitivityRank` is
               assigned only on `nodeType === 'factor'`. So the widest thing
               this row ever holds is this badge — and `Key driver 1` is 12
               characters against the `Needs input` pill's 11, in the same
               font, in the same stack, measured at 67.9px in real Chromium.
               The envelope is one the row already carries in this badge's
               place. */
            className={`${typography.nodeLabel} shrink-0 whitespace-nowrap inline-flex items-center font-semibold text-text-body bg-panel-border rounded-[10px] shadow-sm`}
            style={{ padding: '2px 6px', lineHeight: 1.2, pointerEvents: 'none' }}
            /* ⚠⚠ THIS WAS A `title`, AND A `title` ON THIS ELEMENT CAN NEVER
               FIRE. `pointerEvents: 'none'` (the line above, load-bearing so the
               badge does not swallow drags aimed at the card) means the browser
               raises no hover on it, so the tooltip had no trigger — while
               reading, in source and in review, exactly like an explanation
               that was already provided. A dead affordance that looks like
               coverage is worse than none: it stops anyone asking the question
               again.

               `aria-label` needs no pointer, so it works where the title could
               not, and it is the half that was genuinely missing — a screen
               reader previously got the bare string "#1".

               ⚠ THE SIGHTED READER STILL HAS NO HOVER HERE, and that is stated
               rather than quietly left: the meaning lives in the canvas legend
               (`metricVocabulary.ts`, `SENSITIVITY_RANK_CLAUSE` and the row
               built from it), which mounts unconditionally. Giving this badge a
               real tooltip means removing `pointerEvents: 'none'` and
               re-measuring drag behaviour on the card — a separate change, not
               a comment.

               ⭐ WHAT THE WORD DOES AND DOES NOT CLOSE, SAID NARROWLY. The
               sighted reader now gets the NOUN without hovering, which is the
               half that was missing; they still do not get the ORDERING
               PRINCIPLE (ranked by sensitivity) without the legend. Half a
               fix, and the half that stops the badge asserting a placing.

               ⚠⚠ AND THE CITATION ABOVE USED TO BE THE WHOLE COUPLING, WHICH IS
               TO SAY THERE WAS NONE. This file imported nothing from
               `metricVocabulary`; the `aria-label` was a template literal that
               happened to repeat the legend's gloss, with a line number in a
               comment standing in for an import. That is the shape this estate
               calls a hand-maintained mirror (CLAUDE.md trap 12) — and the
               drift it admits is invisible, because the legend's only guard
               (`ORDINAL_ROW_MUST_STATE_MINT`) reads `row.gloss` and never the
               badge. A legend rewrite would have left a screen-reader user
               being told something a sighted reader is not.

               The record is kept rather than tidied away; what changes is that
               it is now TRUE BY IMPORT.
               `sensitivityRankBadgeAccessibleName` is built from
               `SENSITIVITY_RANK_CLAUSE`, the same constant the legend row is
               built from, so the two cannot say different things about this
               badge. The rendered string is unchanged. */
            aria-label={sensitivityRankBadgeAccessibleName(displayMetadata.sensitivityRank)}
          >
            {sensitivityRankBadgeLabel(displayMetadata.sensitivityRank)}
          </span>
        )}

        {/* N3 (graph-visuals): amber corner dot — this node was edited since the
            last analysis run (device-local diff vs the run snapshot; the
            freshness strip stays the single freshness owner, this is WHERE).
            Amber = the warning family per Paul's C2 hue ruling. A static flex
            child here (no absolute/offset of its own) so it sits beside — never
            under — the coaching marker. `shrink-0` keeps the 10px dot round. */}
        {isEditedSinceRun && (
          <span
            data-testid={`edited-since-run-${id}`}
            role="img"
            aria-label="Edited since the last analysis"
            title="Edited since the last analysis"
            className="shrink-0 h-2.5 w-2.5 rounded-full bg-warning border border-canvas"
          />
        )}

        {/* On-canvas coaching marker — renders ONLY when a live guidance item
            names this node (target_object.id). Replaces the permanently-empty
            CEE/ISL NodeBadge (23-Jul audit G3). Click opens the same guidance
            surface the inspector uses. */}
        <NodeCoachingMarker nodeId={id} />
      </div>

      {/* ⭐ THE TYPE GLYPH SITS ON THE TOP CONNECTOR, NOT IN THE TITLE ROW.
          
          It used to be the first item of the title's flex row, which cost the
          title `NODE_HEADER_RESERVE_PX` of measure on every card — a 20px
          column reserved on all twenty nodes so that one 14px mark could sit in
          it. That is width the title needs far more than the glyph does: it is
          what forced three-line wrapping, and the clamp above then ellipsised
          the third line.

          On the connector it is bigger (18px against 14px, so the shape is
          actually legible), it is the first thing the eye meets travelling down
          an edge into a node, and it costs the title nothing.

          ⚠ `pointer-events-none` IS LOAD-BEARING. React Flow's target `Handle`
          is at this exact position, and an element painted over it that also
          captured clicks would silently break edge interaction — a visual
          change taking a behaviour away with nothing to notice it. The type
          name stays reachable: it is already in the card's `aria-label`, and
          the tooltip that used to hang off this mark would have needed pointer
          events to work, so it moves rather than being kept at that price. */}
      <span
        aria-hidden="true"
        data-testid="node-type-glyph"
        className="pointer-events-none absolute -top-2.5 left-1/2 z-10 flex h-[22px] w-[22px] -translate-x-1/2 items-center justify-center rounded-md border-[1.5px] border-panel-border bg-panel"
      >
        <NodeShapeIndicator nodeKind={nodeType} size={NODE_TYPE_GLYPH_PX} />
      </span>

      {/* Node header — shape + title on same row (spec Section 3.2) */}
      {!isCausalLens && (

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          // Same source as the layout's header reservation, so the gap the card
          // is sized for is the gap it renders (NODE_HEADER_RESERVE_PX).
          gap: `${NODE_HEADER_GAP_PX}px`,
          marginBottom: '4px',
          // Let the header slot drop below the title rather than squeezing the
          // title's measure below NODE_TITLE_MIN_MEASURE_PX. At normal card
          // widths there is ample room and nothing wraps.
          flexWrap: 'wrap',
        }}
      >
        {/* Title + optional badges inline.
            `min-w-0` is deliberately NOT used here: it permits the flex item to
            collapse below its content, which at compressed card widths left a
            77px measure and made `break-words` split ordinary words mid-word.
            A real minimum measure keeps wrapping on word boundaries. */}
        <div className="flex-1" style={{ minWidth: `${titleMinMeasurePx}px` }}>
          {/* ⭐ TWO LINES, NOT THREE (1 Sep 2026). A third line was the single
              biggest source of visual noise on a full board: card heights
              varied by up to 50%, so nothing lined up and the eye had no
              baseline to scan along. Two lines is a firm measure — every card
              is one of two heights — and the glyph moving off the title row
              (below) gave the text back the width it needed to fit.

              The ellipsis is the point, not a regret: a title that cannot say
              itself in two lines is a title the user should shorten, and the
              full text stays reachable by `title` and `aria-label`.

              Original note, still true of the clamp itself: cap the title so ELK can
              rely on uniform-ish node heights. `break-words` preserved so
              long unbroken tokens still wrap before clamping.

              WHY `break-words` STAYS, now that the measure follows the label
              scale: it is a LAST-RESORT rule and, at the derived measure, the
              last resort is no longer reached by real content — measured 0
              mid-word breaks across all 174 titles the five shipped starters
              render at the settle zoom, against 59 before. Dropping it would
              not improve those 174 (measured: identical), and would let a
              pathological unbreakable token (an id, a URL) overflow the card
              and be CLIPPED by the clamp's `overflow: hidden` — a cut with no
              ellipsis, which is worse than a contained break. So ordinary text
              wraps and clamps at word boundaries, and the pathological case
              stays inside the card.

              `title` makes the full label reachable at a readable size
              whenever the clamp ellipsises it or the last resort fires (DS v5
              §2.4). The group's `aria-label` already carries it for assistive
              tech; this is the sighted-hover half.

              ⭐⭐ THE ANCHOR'S "BOOST" USED TO BE `text-lg`, AND THAT MADE IT THE
              SMALLEST TITLE ON THE CANVAS AT EVERY ZOOM IT APPLIED TO.
              Measured in a real browser across all five committed starter
              drafts at 1280x800 and 1440x900 (`e2e/geometry/zoomLadder.measure.ts`):
              after "Show whole model" the goal and decision titles rendered at
              **4.67px** while every ordinary card rendered **6.23px**, against
              the DS v5 §2.4 canvas floor of 10px.

              The derivation, and it holds for the whole domain rather than for
              the sample. Canvas type carries `--canvas-label-scale`, which is
              `labelCounterScale(zoom)` and is capped at `1/LABEL_LEGIBLE_ZOOM`
              = 2. `text-lg` is a PANEL size and carries no such variable, so:

                ordinary title   12px x 2 x zoom = 24 x zoom
                `text-lg` boost  18px x 1 x zoom = 18 x zoom

              and `18z < 24z` for every positive z. `lodBoostTitle` is only ever
              true when `lodBodyHidden`, i.e. only below the floor — so the boost
              was a flat 25% SHRINK on 100% of the cards it touched, 100% of the
              time. It read as an emphasis and behaved as its opposite.

              ⛔ THE FIX IS NOT A BIGGER NUMBER. DS v5 §2.3 fixes the canvas
              scale at 13/11/10 (12/11/10 since #1088) and §2.4 forbids
              inventing a fourth — `text-lg` was already outside that scale, so
              counter-scaling 18px would have kept the violation and merely made
              it louder. The anchor now uses the SAME `nodeTitle` token as every
              other card, and takes its emphasis from WEIGHT and COLOUR, which
              is what the design system says carries emphasis on the canvas.
              Measured effect at the same zooms: 4.67px -> 6.23px on the worst
              card, 7.78px -> 10.35px on the best (the first reading in the
              corpus to clear the 10px floor), and one fewer type size on the
              canvas. **+33.0% to +33.3%**, not a flat figure: the underlying
              ratio is exactly 24/18, and the readings that come in under it are
              precisely the three starters whose whole-model fit shifted by
              <= 0.25% when the anchor cards' rendered height changed.

              ⚠ COORDINATION WITH #1123, WHICH HAS NOW MERGED (`d0fa3821`).
              Stated at this level of detail because that lane's bound rests on
              row slack, and because it ships a guard
              (`__tests__/lodTitleBoostIsBounded.spec.ts`) that this change
              takes to ZERO SLACK. Read that file's header before touching
              either side.

              This adds and removes NO line — the clamp stays `line-clamp-2` for
              both branches. The declared size moves 18px -> 12px, so at the
              CANONICAL scale #1123 measures at (`--canvas-label-scale` = 1, i.e.
              zoom >= 1) these cards get SHORTER, never taller. And at zoom >= 1
              `lodBodyHidden` is false, so this branch is not even reached there:
              the height #1123 reserves is unchanged by this diff.

              What changes is the RENDERED height of two cards below the floor,
              and the LINE BOX is the quantity, not the font size — an earlier
              version of this note said "a 24px effective line box replaces an
              18px one", which confused the two. `text-lg` carried Tailwind's
              default 28px line-height (the old class set no `leading-*` at
              all); `typography.nodeTitle` carries `leading-tight`, so at the 2x
              cap it is 1.25 x 24 = 30px. **28px -> 30px per line**, not
              18 -> 24.

              Measured on #1123's own probe at this tip rather than argued
              (`e2e/geometry/heightVsZoom.measure.ts`, build-vs-buy @1280x800):
              because the title now declares the same size on BOTH sides of the
              threshold, the title term's LOD delta is now ZERO. The worst
              single-card LOD shrink went 16px -> 12px (`dec_billing` 333->321,
              `goal_billing` 173->161, now matching the outcome/risk cards
              exactly), `cardsThatGrew: 0`, against the same 45px sub-row slack.
              The direction that lane's argument rests on is unchanged and the
              margin is larger. The layout itself does not re-run in this band —
              it keys on `layoutVersion`, not on zoom. */}
          <div
            data-testid="node-title"
            title={label}
            className={
              lodBoostTitle
                ? `${typography.nodeTitle} font-semibold text-text-header break-words line-clamp-2`
                : `${typography.nodeTitle} text-text-body break-words line-clamp-2`
            }
            style={lodHideTitle ? { visibility: 'hidden' } : undefined}
          >
            {label}
          </div>
        </div>

        {/* S1-UNK: Warning chip for unknown backend kinds */}
        {Boolean(data?.unknownKind) && typeof data?.originalKind === 'string' && (
          <UnknownKindWarning originalKind={data.originalKind} />
        )}

        {/* ⭐⭐ WHO PUT THIS HERE — before any number the card goes on to state.
            One fixed position, every node type, from the ONE classifier
            (`domain/valueProvenance`). See `NodeProvenanceMark` for why this is
            a surfacing job rather than a new signal, and why an unrecognised
            provenance renders NOTHING rather than a default.

            ⚠ IT SITS IN THE HEADER, NOT THE BODY, AND THAT IS THE WHOLE POINT.
            The body hides below the legibility floor; the header does not. A
            provenance mark that vanished exactly when the user zoomed out to see
            their whole model would be absent at the moment "which of this did I
            write?" is the most useful question on screen. It is also why this is
            NOT inside the `headerSlot` group below — that group is gated on a
            caller passing science icons, so the mark would appear on some cards
            and not others for a reason that has nothing to do with provenance.

            `ml-auto` is on THIS element rather than the group, so it still
            pushes right when no header slot is present.

            ⚠ IT MAKES A KIND-APPROPRIATE CLAIM, AND THE FIRST VERSION DID NOT.
            `data.provenance` means "who owns this VALUE" on a factor and "who
            put this ELEMENT here" on an option — one field, two questions
            (CLAUDE.md trap 21) — so the value vocabulary was false on the 21 of
            25 captured non-factor nodes that carry no value at all. The mark now
            takes the KIND and the DATA and asks `nodeProvenanceClaim` which
            vocabulary it is entitled to; the reasoning and the corpus that
            forced it are recorded there. It is NOT suppressed on those kinds —
            "did Olumi suggest this option?" is exactly what a reviewer wants. */}
        {!isCausalLens && !isEvidenceLens && (
          <span className="inline-flex items-center shrink-0 ml-auto">
            <NodeProvenanceMark nodeType={nodeType} data={data} />
          </span>
        )}

        {/*
          ⭐⭐ THE EVIDENCE LENS SAID IT IN COLOUR ALONE.
          `evidenceBgStyle` paints the card `--success-light` / `--warning-light`
          / `--danger-light` by `evidenceClass`, and that fill was the ONLY
          carrier of the claim. A reader with a colour-vision deficiency saw
          three tinted cards and was told nothing — on the one lens whose entire
          purpose is "which of these numbers do we actually know?".

          ⚠ THIS REPO MEASURES THAT PROBLEM AND SHIPPED IT ANYWAY. The border
          vocabulary carries CIEDE2000 dichromat measurements (goal-vs-amber
          ΔE 5.5 under deuteranopia) precisely because colour alone is not a
          channel. The lens was added later and did not inherit the lesson.

          ⭐ A WORD RATHER THAN A SECOND GLYPH: the classes are already computed
          (`useLensFilter` → `_evidenceNodeClass`), mutually exclusive and few.
          Three short producer-derived words cost one line on a card this lens
          has already stripped to label-plus-pill, and they are the actual
          answer the reader came for.

          ⛔ THE WORDS RESTATE THE CLASS, THEY DO NOT GRADE IT. "Assumed" is what
          `evidenceClass` says — not a judgement about whether assuming was
          reasonable. `na` renders nothing: absence is a state, not a verdict.
        */}
        {isEvidenceLens && evidenceClass && evidenceClass !== 'na' && (
          <span
            className={`${typography.edgeLabel} shrink-0 ml-auto text-text-body`}
            data-testid="evidence-lens-class"
          >
            {evidenceClass === 'grounded' ? 'From your data' : evidenceClass === 'assumed' ? 'Assumed' : 'No data'}
          </span>
        )}

        {/* Graph v1.1 Task 5: header slot — science / state icons live top-right
            of the title row. Action icons remain in the footer (ActionIcons). */}
        {headerSlot && !isCausalLens && !isEvidenceLens && (
          <span className="inline-flex items-center gap-1 shrink-0 ml-auto">
            {headerSlot as ReactNode}
          </span>
        )}

        {/* Expand/collapse chevron for nodes with description */}
        {description && (
          <button
            onClick={handleExpandToggle}
            onPointerDown={(e) => e.stopPropagation()}
            className="nodrag nopan shrink-0 p-0.5 hover:bg-black/5 rounded transition-colors"
            aria-label={isExpanded ? 'Collapse description' : 'Expand description'}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronUp size={14} className="text-text-light" />
            ) : (
              <ChevronDown size={14} className="text-text-light" />
            )}
          </button>
        )}
      </div>
      )}

      {/* Causal lens: show label only (header hidden) */}
      {isCausalLens && (
        <div className={`${typography.nodeTitle} text-text-body break-words line-clamp-2`}>
          {label}
        </div>
      )}

      {/* Expanded description (markdown) — hidden in causal/evidence lens */}
      {!isCausalLens && !isEvidenceLens && isExpanded && description && (
        <div
          className={`${typography.nodeLabel} text-text-body opacity-85 mt-3 max-h-[200px] overflow-y-auto node-description`}
          // eslint-disable-next-line security/no-unsafe-innerhtml -- sanitised via safeRichText (sanitizeMarkdown shim)
          dangerouslySetInnerHTML={{
            __html: sanitizeMarkdown(description)
          }}
        />
      )}

      {/* Optional children (description, metrics, etc.) — hidden in causal/evidence lens.
          D2: at level-of-detail zoom the body hides — the node reads as its
          coloured shape, PLUS the one reduced line below.

          ⛔⛔ IT USED TO HIDE BY `visibility` ALONE, KEEPING ITS FULL HEIGHT, AND
          THAT IS WHAT PAUL WAS LOOKING AT ON 15 SEP: *"it looks an absolute
          mess … every design element on there looks just chucked on
          willy-nilly."* Measured on his board: option cards **~370px tall
          carrying two lines of text**, beside a baseline option at ~170px in
          the same row. The body was rendering at full height and invisible.

          ⚠ AND IT IS THE DEFAULT VIEW, NOT AN EDGE CASE. Three of the five
          shipped starters lay out 3080 units wide; the canvas pane is ~1520
          with the dock CLOSED and ~1080 with it open, so the fit zoom is
          **0.4935 closed and ~0.35 open** against `LABEL_LEGIBLE_ZOOM` 0.5.
          Every card body is blanked before the user touches anything. No width
          tuning reaches 0.5 from 0.35, so the blanked state has to be right
          rather than merely temporary.

          ⛔⛔ AND THE FIRST VERSION OF THIS PARAGRAPH ARGUED THE COLLAPSE WAS
          FREE TO THE LAYOUT. IT IS NOT, AND THE REFUTATION WAS TWO SENTENCES
          ABOVE IT. It read: *"the rungs do not overlap … below
          `LABEL_LEGIBLE_ZOOM` the reservation is unused by construction, so
          releasing it cannot overlap anything — a card only ever shrinks inside
          a row whose stride already fits it."*

          That holds only if the LAYOUT RAN at a zoom where the body was
          visible. **The paragraph directly above says the default is that it did
          not**: the fit zoom on three of five starters is 0.4935 / ~0.35, both
          BELOW 0.5, so a layout on a freshly-opened board measures COLLAPSED
          cards and reserves the short height. The reader then zooms in past the
          legibility floor and every card grows back into the row beneath it.
          MEASURED by `heightVsZoom.measure.ts` at this branch's tip: the worst
          per-card LOD delta went **16px -> 430px**, against **45px** of sub-row
          slack — i.e. an overlap, not a rounding.

          ⭐ THE COLLAPSE STAYS; WHAT CHANGED IS WHAT THE LAYOUT MEASURES.
          `measureNodeHeightsAtLabelBound` now RELEASES this wrapper's height for
          the duration of its read (it finds it by `LOD_BLANKED_BODY_ATTR`, the
          marker below), so the height ELK reserves is the height at the label
          bound in fact and not merely by intention. The blanked children stay
          mounted — `visibility: hidden` hides, it does not unmount — so the read
          is synchronous and costs no re-render. `heightVsZoom.measure.ts` is
          what REDs if this pairing is broken. */}
      {/* ⚠ `children || lodBodyLine`, AND THE SECOND HALF IS LOAD-BEARING. This
          wrapper hosts the reduced line, so gating it on `children` alone made
          the line unrenderable on precisely the cards that needed it most: one
          whose body branches all resolved to nothing is the emptiest box on the
          canvas, and it was the one card that could not be given a line. The
          wrapper contributes no height and the line is absolutely positioned,
          so admitting it with no children changes no geometry. */}
      {/* ⚠ THE MARKER BELOW IS SPREAD FROM `LOD_BLANKED_BODY_ATTR`, NOT TYPED AS
          A LITERAL. `measureNodeHeightsAtLabelBound` finds this element by that
          same constant in order to release the collapse while it reads; a
          literal at each end is the hand-maintained mirror CLAUDE.md trap 12
          names, and the drift would be SILENT — the measurer would simply stop
          finding anything and go back to reserving the short height, with every
          unit test still green. The rendered value stays `"true"`, which several
          specs assert. */}
      {!isCausalLens && !isEvidenceLens && (children || lodBodyLine || showConstraintLines) ? (
        <div
          className="relative text-left"
          style={lodBodyBlanked ? LOD_BLANKED_BODY_STYLE : undefined}
          {...(lodBodyBlanked ? { [LOD_BLANKED_BODY_ATTR]: 'true' } : {})}
        >
          {children as ReactNode}
          {/* ⭐ THE READER'S OWN LIMIT, ON THE CARD, IN BOTH PHASES.
              A constraint is a boundary the reader chose, so it is true before
              the analysis runs and after it — no phase gate, and no "detailed
              view" gate either, because a limit you have to go looking for is a
              limit you will forget you set.
              The target glyph is the one the constraint badge uses, so the two
              surfaces read as one idea rather than two. */}
          {showConstraintLines && (
            <div className="mt-1.5 space-y-0.5" data-testid="factor-constraint-lines">
              {constraintLines.map((text, i) => (
                <div key={i} className="flex items-start gap-1">
                  <Target size={9} className="text-info shrink-0 mt-[2px]" aria-hidden="true" />
                  <span className={`${typography.edgeLabel} text-text-body`}>
                    {/* "Limit" names what the number IS. The formatter supplies
                        the operator, the unit and any "· Inferred limit"
                        provenance; nothing here re-derives them. */}
                    Limit {text}
                  </span>
                </div>
              ))}
            </div>
          )}
          {/* The reduced line (see `lodBodyLine` above for what it is and why
              the scope is what it is).

              TWO PROPERTIES IT HAS TO KEEP, both load-bearing:
              · `visibility: 'visible'` overrides the hidden ancestor — a
                descendant may re-declare visibility, which is the whole reason
                the body can stay hidden while one line of it comes back;
              · absolutely positioned, so it contributes NO height of its own —
                the wrapper's collapsed height is what gives it its one line
                (see `LOD_BLANKED_BODY_STYLE`). Were it in the flow it would sit
                BELOW the hidden body it is standing in for.
              `title` carries the untruncated string, the same sighted-hover
              treatment the node title gets when its clamp ellipsises it. */}
          {lodBodyLine !== null && (
            <div
              data-testid="node-lod-line"
              title={lodBodyLine}
              className={`${typography.nodeLabel} text-text-body truncate absolute left-0 right-0 top-0`}
              style={{ visibility: 'visible' }}
            >
              {lodBodyLine}
            </div>
          )}
        </div>
      ) : null}

      {/* ⚠ OUTSIDE the body wrapper above ON PURPOSE. That wrapper is what the
          LOD rung blanks by `visibility`, and an invitation that disappears at
          the zoom the auto-fit parks at is the defect this change exists to
          remove, one level along. */}
      <TierInvitationRow
        invitations={myInvitations}
        nodeId={id}
        /* ⚠ THE SAME EXPRESSION THAT PAINTS THE TINT, not a second reading of
           the lens. `evidenceBgStyle` is `undefined` on an untinted card —
           including the `na` class, which the lens leaves alone — so the
           invitation's colour and the card's fill cannot disagree about which
           ground the text is standing on. */
        onTintedGround={evidenceBgStyle !== undefined}
      />

      <Handle
        type="source"
        position={Position.Bottom}
        className={`${colors.border.replace('border-', 'bg-')}`}
        style={{
          width: 12,
          height: 12,
          border: '2px solid white',
        }}
        aria-label="Output connection"
      />
    </div>
  )
})

BaseNode.displayName = 'BaseNode'
