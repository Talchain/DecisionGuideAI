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
import { nodeTitleChannels } from './shared/nodeRenameAffordance'
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
import { selectRestingGlyphsShown } from './shared/restingGlyphRung'
import { selectLodBodyHidden, selectLensDetailActive, LOD_BLANKED_BODY_ATTR, NODE_RUNG_PADDING_ATTR } from '../utils/zoomLegibility'
import { useLayoutStore } from '../layoutStore'
import {
  NODE_CARD_MAX_W,
  NODE_CARD_PADDING_X,
  NODE_HEADER_GAP_PX,
  NODE_HEADER_RESERVE_PX,
  NODE_LAYOUT_MIN_W,
  NODE_TITLE_MIN_MEASURE_PX,
  restingCardWidthForKind,
} from '../utils/nodeLayoutConstants'
import { nodeColors } from './colors'
import { typography } from '../../styles/typography'
import { getControllabilityBorderStyle } from '../utils/graphDisplayCalculations'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { isFactorNeedsInput } from '../utils/observedStateHelpers'
import { resolveLodMetricLineDetail } from './shared/lodMetricLine'
import { driverRankFor, useInfluenceRank } from '../hooks/useInfluenceRank'
import { ESTIMATE_SUBJECT_TITLE } from './shared/EstimateMarker'
import { UNCONFIRMED_ESTIMATE_TOKEN } from '../domain/vocabulary'
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
import { resolveOptionInterventionCount } from './shared/optionInterventionCount'
import { openNodeInspector } from './shared/openNodeInspector'
import { openOptionValueInput } from '../utils/openOptionValueInput'

/** One sentence per clause, so a joined accessible name never runs two together. */
const asSentence = (text: string): string => {
  const t = text.trim()
  return /[.!?…]$/.test(t) ? t : `${t}.`
}

/**
 * The route the "Not in this analysis" pill names for an option with no values.
 * #1911 gave the option a DIRECT input ("Set what this option changes:" in the
 * Model tab's option detail), so the pill now names that route instead of a
 * chat draft ("Tell Olumi what it changes"). Model surface = user-facing "Model".
 */
const NOT_ANALYSED_ACTION_LABEL = 'Set what it changes in the Model tab'
import {
  NODE_QUICK_ACTION_BAND_CSS,
  CANVAS_CORNER_STACK_CLASSES,
  CANVAS_HEADER_GLYPH_GROUP_CLASSES,
  CANVAS_GLYPH_SIZE_CLASSES,
  anchorRailButtonsKey,
  anchorRailReservePx,
  CANVAS_QUICK_ACTION_INSET_PX,
} from './shared/canvasGlyphScale'
import Tooltip from '../../components/Tooltip'
import { NODE_TOOLTIP_DELAY_MS } from './shared/nodeTooltip'
import { NodeProvenanceMark, useProvenanceDefaultKind } from './shared/NodeProvenanceMark'
import { STRUCTURAL_UNSET } from './shared/metricVocabulary'
import { useNodeAttention } from './shared/useNodeAttention'
import { attentionCueSentence } from './shared/nodeAttention'
import { NodeAttentionMarker } from './shared/NodeAttentionMarker'
import { NodeSignalRailIcons } from './shared/NodeRailIcons'
import type { ResolvedCoaching } from './coaching/resolveNodeCoaching'
import { factorValueIsUnconfirmedEstimate } from '../domain/valueProvenance'
import { useAssistantFocusStore } from '../stores/assistantFocusStore'

/** Contract `.node h3{font-weight:610}` — the one card-title weight. */
const NODE_TITLE_WEIGHT = 610

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
   * derived once, on the stack's contract below, and note there that the phase
   * gate doing the work is `isIncomplete`'s OPTION arm, which is the only arm
   * this slot can ever meet); against the edited dot and
   * the coaching marker it is widest-first and load-bearing.
   */
  cornerSlot?: ReactNode
  /** Override border colour + style classes (e.g. 'border-info border-dashed'). Replaces entity colour. */
  borderClassOverride?: string
  /**
   * The card's own body already states the `isIncomplete` gap in its own words
   * (the goal's "Target not captured" chip), so the corner "Needs input" pill
   * would say it twice. Withholds the PILL only — `isIncomplete` still drives the
   * border and the overlay testid. Contract v3.1: one state, once (gap U4).
   */
  incompleteStatedOnCard?: boolean
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
  /**
   * ⭐ THE CARD RAIL'S RESTING DATA ICONS (locked Canvas design, 23 Sep 2026).
   * A caller adds only icons its own data says apply; the grounded evidence and
   * behaviour icons are added HERE for every kind, from the same plan the
   * "Worth reviewing" marker reads, so no card can forget them or invent them.
   */
  railIcons?: ReactNode
  /**
   * The card's coaching resolution — the rail's ONE coaching icon asks its first
   * question (ED 02:31Z D4). `null`/absent renders no icon, and the hover-only
   * "Ask Olumi" quick action stays in its place.
   */
  coaching?: ResolvedCoaching
  /**
   * The option card's result caption by run currency (`runCurrency.ts`) — the
   * SAME caption the card shows at full zoom, handed down so the reduced line
   * says it too. Owned by `OptionNode`, which already reads the currency;
   * absent on every other kind.
   */
  resultCaption?: string | null
  /**
   * ⭐ THE MODEL HAS CHANGED SINCE THE RUN THIS CARD'S FIGURES CAME FROM — the
   * owner's `useModelChangedSinceRun()`, passed in already answered.
   *
   * Read by the one run-derived factor figure this component draws: the
   * driver arm of the reduced line ("Driver N of M analysed"), which keeps
   * its rank and opens with `LAST_RUN_PREFIX` (Paul's Ruling 3, ROADMAP 2.651:
   * "out-of-date results are labelled, not withheld"). The `Key driver N`
   * badge #1891 also labelled is retired by the locked design (ED 02:31Z D1a);
   * its rank now lives on the driver line, which carries the same label.
   *
   * ⚠ A PROP, NOT A HOOK HERE, deliberately. `BaseNode` hosts every card on the
   * canvas and `sensitivityRank` is assigned to FACTORS ONLY
   * (`useNodeDisplayMetadata`, inside its `nodeType === 'factor'` branch), so
   * the one card that can carry the figure computes the answer once and its
   * own driver line and turning point read the same local. Absent means the
   * owner has no run-derived factor figure to label — never "current".
   */
  resultsFromLastRun?: boolean
  /**
   * ⭐ DISPLAY-ONLY TITLE TEXT (contract v3.1 ANC-11). Replaces ONLY the visible
   * words of the title — the card's `title` attribute and accessible name keep
   * the real label through `titleChannels`, so nothing a screen reader or a
   * rename reads is changed. Exists for a card whose real label is a TYPE
   * DEFAULT that would read as the user's own words: an unnamed Question renders
   * "Question" in full title styling, as if that were the question. The caller
   * supplies the words and owns the honesty of them.
   */
  titleOverride?: string
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
/**
 * ⭐ THE CONNECTOR GLYPH FILLS ITS 22px BOX (contract v3.1 FRAME-03). It used to
 * be an 18px shape (`NODE_TYPE_GLYPH_PX`) inside a 22px white tile; the tile is
 * gone, so the shape takes the tile's box and the outline separates it from the
 * border instead. Local because nothing else sizes against it — it is painted
 * out of flow and reserves no layout width.
 */
const CONNECTOR_GLYPH_PX = 22

// ⭐ S5 (24 Sep): a MAX-height, not a height. The box is "at most the one line
// the card still shows" — a body already shorter than that line keeps its own
// height. A fixed 16px × scale made the anchors' one-line body (~15px × scale)
// TALLER below the floor than above it (Canvas Browser Gate `heightVsZoom`,
// build-vs-buy 1280×800: decision 126 → 128), against the layout's reservation.
// `measureNodeHeightsAtLabelBound` lifts the cap while it reads.
const LOD_BLANKED_BODY_STYLE: CSSProperties = {
  visibility: 'hidden',
  // One BODY line (the 11px `edgeLabel` line box, 15px × scale) — the height the
  // shortest body a card shows above the floor already has. At 16px the reduced
  // line's box made the Question and the baseline option 2 units taller below
  // the floor than at landing; the reduced line is absolutely positioned inside
  // this box, and its 12px glyphs sit inside 15px × scale with the half-leading
  // to spare (only the empty bottom of its line box is clipped).
  maxHeight: 'calc(15px * var(--canvas-label-scale, 1))',
  overflow: 'hidden',
}

export const BaseNode = memo(({ id, nodeType, icon: _icon, data, selected, children, maxWidth, headerSlot, cornerSlot, borderClassOverride, incompleteStatedOnCard = false, lodKeepLabel = false, lodMetric, railIcons, coaching = null, resultCaption = null, resultsFromLastRun = false, titleOverride }: BaseNodeProps) => {
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
  // NODE-ANATOMY v3.2, Factor "Never on the card: a limit line (the boundary
  // lives on the Goal)" — the factor card no longer repeats the Goal's boundary.
  const showConstraintLines = nodeType !== 'goal' && nodeType !== 'factor' && constraintLines.length > 0
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
  const allNodes = useCanvasStore(s => s.nodes)
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
  const atNormalZoom = useCanvasStore(selectRestingGlyphsShown)
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
   * ⭐ THE ONE "WORTH REVIEWING" CUE and the rail's grounded data icons, from
   * ONE board-wide plan (`shared/nodeAttention.ts`). Run-derived reasons are in
   * the plan only while the analysis is current (spec §8), and "AI-generated"
   * alone never qualifies (spec §2).
   */
  const attention = useNodeAttention(id)
  /**
   * Provenance at rest = EXCEPTIONS to the board's default (spec §6; ED 11:52Z
   * point 8). Detailed shows every mark ("Detailed adds information").
   */
  const isDetailedView = useCanvasStore(s => s.viewMode === 'expert')
  const provenanceDefault = useProvenanceDefaultKind()
  // Row 23: a known-changed model keeps the last run's cue, labelled (`attentionCueSentence`).
  const attentionText = attentionCueSentence(attention, nodeType === 'factor' && factorValueIsUnconfirmedEstimate(data))

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
  /**
   * ⭐ THE RANK IS A FACT THE RESOLVER CANNOT SEE, exactly as an option's
   * change count is. It depends on analysis FRESHNESS — a store question — so
   * a pure function handed `data` and `displayMetadata` can never answer it,
   * and the reduced line therefore always fell through to the bare percentage
   * while the card beside it named a rank.
   *
   * ⚠ CALLED UNCONDITIONALLY BECAUSE IT IS A HOOK. It resolves to `null` for
   * every non-factor card and for every card at full zoom, and it adds no
   * traversal — `useAnalysisResultsAreCurrent` reads three scalars.
   */
  const influenceRank = useInfluenceRank(
    displayMetadata.sensitivityRank,
    displayMetadata.influenceSetSize,
  )

  const lodFacts = useMemo(() => {
    if (!bodyReduced) return undefined
    if (nodeType === 'factor') {
      // One rank wording on every rung: "Driver N of M ranked in this run"
      // (contract v3.1 pt 5, M = the ranked count), from the
      // SAME rule the card's driver line reads (`driverRankFor`): a current run,
      // or a known-changed model's last run labelled `Last run · ` (#1891's rule,
      // Paul's Ruling 3). Never-run / cannot-confirm → null.
      const driverRank = driverRankFor(
        influenceRank,
        displayMetadata.sensitivityRank,
        displayMetadata.influenceSetSize,
        resultsFromLastRun,
        displayMetadata.influenceRankedCount,
      )
      return { influenceRank, driverRank, influenceFromLastRun: resultsFromLastRun }
    }
    if (nodeType !== 'option') return undefined
    return {
      ...resolveLodMetricFacts({
        nodeType,
        nodeId: id,
        data: data as Record<string, unknown> | undefined,
        ceeOptions: ceeAnalysisReady?.options,
      }),
      optionResultCaption: resultCaption ?? null,
    }
  }, [bodyReduced, nodeType, id, ceeAnalysisReady, data, influenceRank, displayMetadata.sensitivityRank, displayMetadata.influenceSetSize, displayMetadata.influenceRankedCount, resultCaption, resultsFromLastRun])

  const lodBody = useMemo<{ text: string | null; unconfirmedEstimate: boolean }>(() => {
    if (!bodyReduced) return { text: null, unconfirmedEstimate: false }
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
    /**
     * ⚠ AN OWNER'S OWN LINE CARRIES NO `est.` MARK, AND THAT IS NOT AN
     * OVERSIGHT. The four owners are risk, outcome, goal and decision; the
     * mark speaks about a FACTOR'S VALUE, and risk/outcome already carry
     * their own unconfirmed-strength disclosure through `METRIC_UNSET`. A
     * mark added here would name an object these lines are not about.
     */
    if (lodMetric != null && lodMetric.length > 0) {
      return { text: lodMetric, unconfirmedEstimate: false }
    }
    return resolveLodMetricLineDetail({
      nodeType,
      data: data as Record<string, unknown> | undefined,
      label,
      displayMetadata,
      facts: lodFacts,
    })
  }, [bodyReduced, lodMetric, nodeType, data, label, displayMetadata, lodFacts])
  const lodBodyLine = lodBody.text

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
   * ⭐⭐ MT-21 — "Not in this analysis" WAS INERT (manual test on served
   * `4c6ec07b`). The pill stated a gap and offered no way to close it, while
   * the results panel already carried the route (`NotAnalysedOptionCard`:
   * "Tell Olumi what it changes" → `openAskOlumi` with CEE's own sentence,
   * `resolveOptionPrompt`). The canvas now reuses THAT action — no second
   * route, no second wording.
   * ⚠ SUPERSEDED FOR THE NO-VALUES ARM (23 Sep 2026): #1911 merged a direct
   * input, so `tellOlumi` now opens `openOptionValueInput(id)` and the name
   * reads "Set what it changes in the Model tab" (see the pill's `onActivate`).
   * The field keeps its old name; it means "the no-values arm".
   *
   * KEYED ON THE PRODUCER'S BLOCKER when present: CEE's
   * `analysis_ready.blockers[]` entry for this option with `blocker_type:
   * 'missing_value'` names the factor it lacks (`factor_label`), and the pill's
   * accessible name says so. Absent that entry, an option with NO intervention
   * values is recognised directly (`resolveOptionInterventionCount === 0`) —
   * the same fact the panel's `no_interventions` reason reports. An exclusion
   * for any other reason opens the option's inspector: still a route, never a
   * claim the action fits.
   */
  const exclusionAction = useMemo(() => {
    if (!isExcludedFromAnalysis) return null
    const blocker = ceeAnalysisReady?.blockers?.find(
      b => b.option_id === id && b.blocker_type === 'missing_value',
    ) ?? null
    const valueCount = resolveOptionInterventionCount(id, {
      ceeOptions: ceeAnalysisReady?.options,
      nodeInterventions: (data as { interventions?: unknown } | undefined)?.interventions,
    })
    const tellOlumi = blocker !== null || valueCount === 0
    return {
      tellOlumi,
      missingFactor: blocker?.factor_label?.trim() || null,
    }
  }, [isExcludedFromAnalysis, ceeAnalysisReady, id, data])

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
    // ⛔ NO DASHED FRAME FOR AN "UNCERTAIN" NON-FACTOR (contract v3.1 FRAME-06).
    // `data.uncertainty > 0.4` used to dash any goal, outcome, risk, option or
    // question card — the dashed amber goal Paul saw. A dash means EXISTENCE
    // doubt, on a connection only (Paul pt 4); a card's uncertainty is carried
    // in words where it is known, never as a frame channel. The factor arms
    // above (external / controllability) are a different claim and stay.
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
  const accessibleNameWithoutAffordance = `${nodeType} node: ${label}. ${NODE_TYPE_DESCRIPTIONS[nodeType] ?? ''}`.trim()
  /**
   * ⭐⭐⭐ AND THE ONE EDIT EVERY KIND SUPPORTS IS NOW SAID OUT LOUD — on all
   * six, from here, because here is the only place all six pass through.
   *
   * Measured on served `1f77130d`: 9 of 15 nodes on the canonical board offered
   * no affordance and no reason, and a geometry-free destination probe found a
   * live editor behind the factor cards only (4/5) and none behind the other
   * five kinds. A second witness then double-clicked all 15 and found a seeded,
   * focused rename field on every one — `15/15`, six kinds, fabricated-label
   * control discriminating. The capability was complete; the advertising was
   * absent. See `shared/nodeRenameAffordance.ts` for why it is the LABEL and
   * why it promises the interaction only.
   */
  const titleChannels = nodeTitleChannels({
    label,
    accessibleName: accessibleNameWithoutAffordance,
  })
  const accessibleName = titleChannels.accessibleName

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

  // HISTORY — the hierarchy this block used to render, kept so the numbers in
  // `legacyBorderPx` below can be read against it (superseded, see ⭐⭐ below):
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
  //
  // ⭐⭐ SUPERSEDED BY CONTRACT v3.1 (FRAME-02 / OR-01 / T11 / ANC-08): ONE 1px
  // FRAME ON EVERY FAMILY AND EVERY STATE. `.node{border:1px solid …}` is a
  // single rule for every data-kind. The hierarchy above drew four widths —
  // factor 0.5px (≈0.33 screen px at the landing zoom, so factor cards read as
  // frameless), decision/option 1px, the rest 2px (the loud orange risk frame
  // Paul flagged), and `isIncomplete` forced 2px on anything needing input, so a
  // factor's box jumped 3px when it lost its value.
  //
  // ⚠ THE OLD WIDTH IS KEPT AS A NUMBER, ONLY TO KEEP EVERY BOX BYTE-IDENTICAL.
  // Changing a border moves the content box, which reflows text and changes the
  // height ELK reserved — the geometry this lane has repaired twice. So the
  // padding below absorbs the difference (`padAdj`): the OUTER box and the
  // CONTENT box are exactly what they were, and only the painted stroke
  // changes. A factor gives back half a pixel of padding (never grows); a 2px
  // card takes one back. Retiring the compensation is a separate, NOT-LOW-RISK
  // step that re-records the Canvas Browser Gate baseline.
  const legacyBorderPx = (() => {
    if (lensMode === 'causal') return 1
    if (isIncomplete) return 2
    if (nodeType === 'factor') return 0.5
    if (nodeType === 'decision' || nodeType === 'option') return 1
    return 2
  })()
  const padAdj = legacyBorderPx - 1

  // Graph Editing Experience Task 5: Edit impact preview indicator
  const impactDirection = useEditPreviewStore(s => s.impactMap.get(id))

  // The width this card will actually render at — the same expression the
  // `maxWidth` style below uses, hoisted so the title's measure floor can be
  // bounded by it. Without the bound, a caller passing a `maxWidth` narrower
  // than the floor would have the title's own min-width force the card wider
  // than the box ELK placed it in.
  //
  // ⭐ S4: before any layout has published a width, a card rests at its KIND's
  // width (`restingCardWidthForKind`: 260 for a repeated card, 460 for the
  // Question and Goal), not at `NODE_CARD_MAX_W`. The first layout measures
  // card heights at whatever width the card is drawn at, so a card drawn at 336
  // and laid out at 260 would be measured too short, grow past the stride, and
  // force a second layout — the stale-height path, on every fresh draft.
  const renderedCardW = isExpanded
    ? Math.max(NODE_CARD_MAX_W, layoutCardWidth ?? 0)
    : (maxWidth ?? layoutCardWidth ?? layoutNodeWidth ?? restingCardWidthForKind(nodeType))
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
  //
  // ⭐ S5 (24 Sep): THE BAND IS RESERVED ONLY AT NORMAL ZOOM. Below it
  // (`quiet`, where every laptop lands — the fit floors at 0.5) the contract's
  // far-zoom rung is "readable identity and a simple attention cue", the
  // coaching icon and resting glyphs are already off the card (v3.1 pt 6,
  // `selectRestingGlyphsShown`), and what remains is the HOVER row — point 6's
  // landing-rung ask door, which must stay. So at `quiet` the row is drawn
  // BELOW the card, over the row gap (`placement="below"`), and the card no
  // longer reserves 22px × scale + 6px for it. MEASURED on the S3+S4 build at
  // the landing scale: that band was 50 units under EVERY repeated card, the
  // largest single term in the graph's height at 1280×800 and 1440×900 with
  // the panel open. Height safety: at `full` the band returns at ≤ 22px ×
  // 1.51 + 6px while the content shrinks from scale 2 to ≤ 1.51 — captured per
  // node on all five starters, no card is taller at Normal zoom than at the
  // landing rung. The anchors (Question, Goal) keep their rail BESIDE the last
  // row at Normal zoom only; below it they follow the same rule (see
  // `anchorRailBeside`).
  // → applied in `cardPaddingAt` (`bandReservedAtRung`), for the live rung AND
  //   declared for both rungs on the root for the layout measurer.

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
   * ⚠ THE WIDTH OVERRIDE BELOW WAS LEFT AS FOUND (`isIncomplete` → 2px) and
   * flagged for adjudication against the width hierarchy. ⭐ ADJUDICATED BY
   * CONTRACT v3.1 (FRAME-02): one 1px frame on every family and state, so an
   * incomplete card no longer changes stroke at all — the StatusPill says the
   * state in words. See `legacyBorderPx` for how the box stays byte-identical.
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

  // ⭐ `colors.frame`, NOT `colors.border` (contract v3.1 FRAME-08 / OR-03 /
  // T10): the frame is the kind hue at 76% toward the warm neutral, from two
  // existing tokens — see `nodes/colors.ts`. Both arms move together so an
  // incomplete card keeps exactly the hue of its complete siblings (Paul's 8 Sep
  // ruling: the kind hue stays; the state is words).
  const borderColourClass = isCausalLens
    ? (causalBorderClass ?? '')
    : isIncomplete
      ? colors.frame
      : borderClassOverride ?? `${colors.frame} ${borderStyle}`

  /**
   * ⭐⭐ THE QUESTION AND GOAL ARE WIDE AND SHALLOW, AND THEIR RAIL SITS BESIDE
   * THE LAST ROW, NOT IN A BAND UNDER IT (contract v3.1 ANC-02 / RHY-02; Paul:
   * "Question + Goal geometry: APPROVE").
   *
   * The contract: `.node.wide{min-height:65px;padding:11px 13px 9px}` with
   * `.node.wide .rail{position:absolute;right:6px;bottom:6px}` and the rows
   * given `padding-right` so their text clears it. Served, every anchor carried
   * the 50px quick-action band BELOW its one resting row — title, one row, then
   * an empty strip with the coaching icon alone at its right: ~110px at 100%.
   *
   * Horizontal padding stays 12px so `NODE_CARD_PADDING_X` still describes the
   * card. The height can only SHRINK: the band goes (−41px at the bound) and at
   * worst the last row wraps once more against its narrower measure.
   *
   * ⚠ THE RESERVE IS THE RAIL'S REACHABLE WIDTH ON THIS CARD, COUNTED FROM THE
   * SAME INPUTS THE RAIL IS MOUNTED WITH: Challenge + More (hover), one of
   * coaching-icon / Ask (they are mutually exclusive in `NodeQuickActions`), the
   * caller's `railIcons` (one icon — the Question's run action), and the
   * grounded evidence / behaviour icons `NodeSignalRailIcons` draws from
   * `attention.reasons`. Counted here because `NodeQuickActions` exports no
   * count; if the rail gains a member this must learn it too.
   */
  const isAnchorCard = nodeType === 'decision' || nodeType === 'goal'
  const anchorRailButtons =
    3 +
    (railIcons ? 1 : 0) +
    (attention.reasons.some(r => r.kind === 'evidence_gap') ? 1 : 0) +
    (attention.reasons.some(r => r.kind === 'behavioural') ? 1 : 0)
  // ⭐ S5 (24 Sep): BESIDE ONLY AT NORMAL ZOOM. At the landing rung the rail is
  // counter-scaled to twice its size and outgrew the fixed right-hand reserve —
  // MEASURED on the Canvas Browser Gate (#1932, `nodeControlOcclusion`,
  // vendor-selection 1440×900): the Question's Ask/Challenge/More covered its
  // own title and "Top gap" line. Below Normal the anchors take the repeated
  // cards' rule instead: the hover row is drawn BELOW the card and the text keeps
  // the full width.
  const anchorRailBeside = isAnchorCard && showQuickActions && atNormalZoom
  /**
   * The card's padding AT A RUNG — `normal` is the Normal (`full`) rung, where the
   * rail is beside an anchor and the band is reserved under every other card.
   * Rendered at the live rung (`cardPadding`), and declared for BOTH rungs on the
   * root (`NODE_RUNG_PADDING_ATTR`) so the layout measurer can reserve the larger
   * of the two boxes whatever rung it runs at. `showQuickActions` at Normal is
   * exactly the lens condition: the body is never hidden at `full`.
   */
  const cardPaddingAt = (normal: boolean): CSSProperties => {
    const px = (n: number) => `${n + padAdj}px`
    const side = px(12)
    const actionsAtRung = normal ? !isCausalLens && !isEvidenceLens : showQuickActions
    const railBesideAtRung = isAnchorCard && actionsAtRung && normal
    const bandReservedAtRung = actionsAtRung && normal
    if (railBesideAtRung) {
      // ⭐ S5 (24 Sep; Codex CHANGES_REQUIRED 5809540479): the rail's footprint is
      // reserved on the WHOLE anchor, title included — not only the body's last
      // row. On a shallow anchor the rail (20px × scale + its inset) is taller
      // than that last row and reached up into the title: on vendor-selection
      // the Question's Ask/Challenge/More covered "Customer Data Platform
      // Selection" and its "Top gap" line. Same counter-scaled run the reserve
      // classes derive (`anchorRailReservePx`), so the text clears the rail at
      // every scale the Normal rung reaches.
      const reserve = anchorRailReservePx(anchorRailButtonsKey(anchorRailButtons))
      return {
        paddingTop: '11px',
        paddingRight: `calc(${CANVAS_QUICK_ACTION_INSET_PX}px + ${reserve}px * var(--canvas-label-scale, 1))`,
        paddingBottom: '9px',
        paddingLeft: side,
      }
    }
    if (bandReservedAtRung) {
      const band = padAdj === 0
        ? NODE_QUICK_ACTION_BAND_CSS
        : `calc(${NODE_QUICK_ACTION_BAND_CSS} ${padAdj < 0 ? '-' : '+'} ${Math.abs(padAdj)}px)`
      return { paddingTop: side, paddingRight: side, paddingBottom: band, paddingLeft: side }
    }
    // ⭐ BOUNDED ANATOMY (ED #63 5809278282, 24 Sep): the legacy 24px band that
    // factor/option cards reserved below Normal is GONE. Since S5 the hover row
    // is drawn below the card at those rungs, so the band held nothing, and it
    // cost ~12 units on every factor and option row at the landing floor. ED's
    // "fixed fit-safe box" resolves the rowed question below ("drop the
    // reservation below the floor, or keep one uniform card box").
    // ⭐ S5 (24 Sep): an anchor keeps its `11 / 9` vertical rhythm at EVERY rung,
    // rail beside or not. It used to fall back to 12 / 12 wherever the rail was
    // not beside it — below the legibility floor, where the layout reserves the
    // landing height — so the Question and Goal drew TALLER below the floor than
    // anywhere above it (Canvas Browser Gate `heightVsZoom`, build-vs-buy
    // 1280×800: decision 126 → 132, goal 131 → 134).
    if (isAnchorCard) {
      return { paddingTop: '11px', paddingRight: side, paddingBottom: '9px', paddingLeft: side }
    }
    return { paddingTop: side, paddingRight: side, paddingBottom: side, paddingLeft: side }
  }
  const cardPadding = (): CSSProperties => cardPaddingAt(atNormalZoom)
  const rungPadding = JSON.stringify({ landing: cardPaddingAt(false), normal: cardPaddingAt(true) })

  return (
    <div
      role="group"
      aria-label={accessibleName}
      aria-expanded={description ? isExpanded : undefined}
      {...(isIncomplete ? { 'data-testid': nodeType === 'goal' ? 'overlay-missing-threshold-node' : 'overlay-missing-value' } : {})}
      {...(nodeType === 'factor' && data?.category === 'external' ? { title: 'Outside your control' } : {})}
      {...(isAnalysisDriver ? { 'data-analysis-driver': 'true' } : {})}
      {...(isAssistantFocused ? { 'data-assistant-focused': 'true' } : {})}
      {...{ [NODE_RUNG_PADDING_ATTR]: rungPadding }}
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
        group relative rounded-sm border ${
          /* ⭐ ONE RESTING ELEVATION ON EVERY FAMILY, THE GOAL INCLUDED (contract
             v3.1 FRAME-05 / ANC-08: `.node{box-shadow:0 2px 4px #25252005}`,
             no per-kind override). The goal carried `shadow-3` — DS v5 §5's
             MODAL/OVERLAY elevation — so at the landing zoom it floated above
             the board. It is set apart by geometry (wide, alone in its row) and
             by its semibold title, never by depth. `rounded-sm` is DS v5 §6.2
             `sm` = 8px, the contract's `border-radius:8px` (FRAME-01 / OR-04);
             `rounded-lg` rendered 14px through the index.css override.
             Selection lifts one step (`shadow-2`) with its ring (FRAME-09). */
          selected && !isHighlighted ? 'shadow-2' : 'shadow-1'
        }
        ${borderColourClass}
        ${lodKindFillClass}
        transition-[opacity,box-shadow,border-color,background-color,outline-color,filter] duration-200
        cursor-default
        ${selected && !isHighlighted ? colors.selected : ''}
        ${isHighlighted && !isAttended ? 'ring-4 ring-info/60 ai-highlight-pulse' : ''}
        ${isAttended ? 'ring-4 ring-info olumi-attended' : ''}
        ${isAttentionDimmed ? 'opacity-30 saturate-50 transition-opacity duration-300' : ''}
        ${isLensDimmed ? 'opacity-20' : isDimmed ? 'opacity-25' : ''}
      `}
      style={{
        // Analysis-graph projection: an info RING around a viewed driver node.
        // outline is a separate CSS channel from box-shadow, so it composes with
        // the selection / hover rings and shadow-1 instead of clobbering them;
        // it wraps all four sides (never a one-sided accent) and uses the info
        // state token. Animates via the root's transition list, which names
        // `outline-color` for exactly this (contract v3.1 FRAME-14: the root
        // transitions its VISUAL channels only — it was `transition-all`, which
        // also eased the inline width / padding, so on a relayout a card slid to
        // its new ELK width over 200ms while its edges snapped).
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
        // ✅ RESOLVED 24 Sep (bounded anatomy, ED 5809278282): the legacy arm
        // below is REMOVED — see `cardPadding`. Kept for provenance:
        // ⚠ THE LEGACY ARM KEEPS ITS 24px, DELIBERATELY AND UNCHANGED. The
        // divergence documented above — `factor`/`option` reserving a band below
        // the legibility floor where this layer is UNMOUNTED — is rowed, and how
        // it should resolve is called a design ruling rather than a defect. That
        // ruling is not this lane's to make. Feeding the new, larger band into
        // that arm would have made its dead space 50px instead of 24px on a card
        // carrying no row at all: a silent worsening of a known open question,
        // smuggled in as a side effect of fixing a different one. So the two arms
        // are named apart and only the one with a row to reserve for moves.
        //
        // ⭐⭐ CONTRACT v3.1, THREE CHANGES IN THIS ENTRY, EACH ARGUED WHERE IT
        // LIVES:
        //   · the band RENDERS as `NODE_QUICK_ACTION_BAND_CSS` (RHY-01) — equal
        //     to `NODE_QUICK_ACTION_BAND_PX` whenever the layout measures, and
        //     only shorter between reads; see that constant's header;
        //   · the Question and Goal take the WIDE anchor arm (ANC-02 / RHY-02):
        //     `11 / 12 / 9`, the rail beside their last row (`anchorRailBeside`);
        //   · every term carries `padAdj`, the border-width compensation that
        //     keeps each box byte-identical under the single 1px frame
        //     (FRAME-02 — see `legacyBorderPx`).
        // Written as four longhands, not the shorthand, so a `calc()` one engine
        // declines cannot take the other three sides down with it.
        ...cardPadding(),
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
          placement={atNormalZoom ? 'inset' : 'below'}
          alwaysVisible={selected === true}
          coaching={coaching}
          restingIcons={
            railIcons || attention.reasons.length > 0 ? (
              <>
                {railIcons}
                <NodeSignalRailIcons nodeId={id} label={label} reasons={attention.reasons} />
              </>
            ) : undefined
          }
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
          /* ⭐ NEUTRAL RING, NOT AMBER (contract v3.1 ICON-10). This is the
             USER's own annotation; amber on the canvas means an AI sign
             disagreement (Paul pt 9), and the edge's twin of this badge already
             refuses orange for exactly that reason ("R6: not orange — this is a
             user annotation"). The words carry it: role + accessible name. The
             box stays unscaled on purpose — at `-top-2 -left-2` a counter-scaled
             box would push into the title. */
          className="absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full bg-panel border border-panel-border shadow-1"
          title="Flagged as assumption"
          /* Paul 23 Sep contract feedback point 12: an icon needs a name a
             screen reader can read, not a `title` alone — the same pattern as
             the edited-since-run dot in the corner stack. */
          role="img"
          aria-label="Flagged as assumption"
          data-testid="assumption-badge"
        >
          <FlagIcon size={12} aria-hidden="true" className="text-text-body" />
        </div>
      )}

      {/* Connection handles */}
      {/* ⭐ THE TARGET HANDLE IS UNPAINTED; THE TYPE SHAPE ABOVE IT IS THE
          CONNECTOR (contract v3.1 FRAME-03). It was a 12px kind disc with a 2px
          white ring, hidden behind the glyph's white tile. With the tile gone
          the disc would peek out around the triangle and diamond apexes, so it
          paints nothing. Its box, its hit slop (index.css) and the edge anchor
          are unchanged — React Flow hit-tests it exactly as before. */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          width: 12,
          height: 12,
          border: 0,
          background: 'transparent',
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

          ⚠ AND TWO OF THE TEN PAIRS CAN NEVER CO-OCCUR, which is derived,
          not incidental — the contract is written total anyway so it stays
          correct if a gate ever changes, and each impossibility is PINNED by a
          spec that REDs on the change rather than silently overlapping.
          ⛔⛔ IT SAID **THREE** UNTIL 18 Sep 2026, AND THE THIRD ONE WAS ALREADY
          FALSE AT THIS PR'S BASE (`5824c05b`) — the un-gating that falsified it
          landed earlier and touched neither this comment nor the derivation
          that went on to rest on it. See the `StatusPill` vs `rank` bullet.
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
            (`resultsStatus !== 'complete'`). One store field, opposite tests.
            ⚠ AND THE PHASE GATE IN THAT SENTENCE IS THE **OPTION** ARM'S, WHICH
            IS THE ONLY REASON THIS PAIR SURVIVED THE CHANGE THAT KILLED THE
            NEXT BULLET: `cornerSlot`'s one caller is an option card, and
            `isIncomplete`'s option arm still opens `if (!isPreRunMode) return
            false`. Read the pill's gate as one predicate PER NODE TYPE, never
            as a single `isPreRunMode` — reading it as one is precisely how the
            pill-vs-rank line below survived the change that falsified it, and
            then got inherited by a width derivation. Their relative order
            is therefore still UNOBSERVABLE at runtime; `cornerSlot` leads only
            because it is the caller's slot. Pinned, source-derived, in
            `BaseNode.needsJudgementBadge.spec.tsx`.
          ⛔⛔ `StatusPill` vs `rank` — **NOT A DISJOINT PAIR. THEY CO-OCCUR ON A
            FACTOR, AND THAT IS THE COMMONEST POST-RUN FACTOR CARD THERE IS.**
            This bullet read *"the pill requires `results.status !== 'complete'`
            (`isPreRunMode`) … Exact complements"* until 18 Sep 2026. That
            sentence describes a gate this file HAD ALREADY DELETED for factors:
            `isIncomplete`'s factor arm returns `isFactorNeedsInput(data)` with
            NO phase check (see its ⛔ SCOPE note above — `goal` and `option`
            KEEP the phase gate, `factor` deliberately does not, because an
            analysis does not resolve an unknown, it proceeds despite one).
            `BaseNode.needsInputSurvivesTheRun.spec.tsx` pins exactly that, and
            its CASE 1 renders the pill at `results.status: 'complete'`.
            The other half is the datum: `sensitivityRank` is assigned in
            `useNodeDisplayMetadata.ts`'s `if (nodeType === 'factor')` branch
            from the driver feed's ranking, gated only on rank DETERMINACY
            (`rank > 0 && rank <= determinedRankDepth(...)`) — never on whether
            the user valued the factor. **The two predicates read disjoint
            inputs — the pill reads NODE DATA, the rank reads the RESULTS
            REPORT — so neither can exclude the other.**
            ⭐ AND THE CO-OCCURRENCE IS NOT AN EDGE CASE: an unvalued factor
            carries the widest uncertainty, so it is the likeliest factor for
            the result to swing on and therefore the likeliest to be badged.
            Suppressing either marker there would retract a true claim, so BOTH
            render and the row must carry both. Pinned at the render in
            `BaseNode.rankedFactorStillNeedsInput.spec.tsx`.
            ⚠ WHY THE OLD PIN STAYED GREEN ON A FALSE CLAIM, because that is the
            reusable half: `BaseNode.statusPillCornerStack.spec.tsx`'s
            "IMPOSSIBILITY PIN" asserted that the two DECLARATIONS
            (`const isPreRunMode = …`, `const isResultsMode = …`) exist. Both
            still do. It never asserted that the pill's factor arm CONSUMES
            `isPreRunMode` — and that is the line that went. A guard that pins a
            declaration rather than its consumption cannot see a consumer
            leaving (CLAUDE.md trap 13b). It has been re-pointed at the arm.
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
          So the largest set reachable on ONE node is FOUR, and it is reachable
          only on a FACTOR: `StatusPill` · `rank` · the edited dot · the
          coaching marker — a ranked factor the user never valued, edited since
          the run, with a live guidance item naming it. On `goal`, `option` and
          `decision` the maximum is still THREE, because those arms keep the
          phase gate and `rank` is factor-only. ⛔ THIS SAID THREE UNIVERSALLY
          until 18 Sep 2026, on the strength of the pill-vs-rank "exact
          complements" sentence above; `BaseNode.cornerStack.spec.tsx` pins
          three children on a DECISION fixture, which is correct for that node
          type and is not evidence about a factor.

          ⚠ ORDER IS WIDEST-FIRST, and that is what puts a wide pill at the
          head: the row is anchored by its RIGHT edge and grows LEFTWARD, so the
          widest child must lead or it pushes the small badges away from the
          corner and displaces the coaching marker from the rightmost, easiest
          click target. The StatusPill measured 67.9px against the dot's 5px at
          the same zoom, so it leads by a wide margin.
          ⭐ THE INVARIANT SURVIVES TWO WIDE MEMBERS, AND IT IS WORTH SAYING WHY
          RATHER THAN LEAVING IT TO BE RE-DERIVED: DOM order is `StatusPill` ·
          `rank` · dot · coaching, which is still descending width, so on the
          four-member factor set the dot and the coaching marker keep exactly
          the places they hold on the three-member sets. Nothing is displaced
          from the corner.
          ⛔⛔ WHAT IS **NOT** ESTABLISHED, AND IT IS THE HALF THE ENVELOPE IS
          ABOUT: the row's TOTAL WIDTH roughly doubles in that state. Both wide
          members are `typography.nodeLabel` (`calc(12px *
          var(--canvas-label-scale))`) with the same padding and `lineHeight`,
          so `Key driver 1` (12 characters) sits within a few px of `Needs
          input` (11) — call the pair ~140px plus two 4px gaps at the reference
          zoom the 67.9px was measured at, against a `DEFAULT_NODE_WIDTH` of
          200 (`cameraComfort.ts`) and a layout that has shipped cards at 180.
          At the settle zoom the counter-scale caps at 2 and BOTH double while
          the card does not, so the row extends well past the card's left edge
          into the band above the tier. That is ARITHMETIC, NOT A MEASUREMENT —
          the same caveat this file already carries about the band's clearance
          below — and the measurement is in the browser. Nothing here licenses a
          claim that the four-member row fits; what this contract now licenses
          is that it is REACHABLE and must be measured.

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
            `isResultsMode`; the pill's OPTION arm — the only arm reachable on
            an option card, and the qualification matters, see the contract
            above — needs `isPreRunMode`. One store field,
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
            title={[
              asSentence(exclusionMessage !== null && exclusionMessage !== ''
                ? exclusionMessage
                : 'The analysis will run without this option'),
              exclusionAction?.missingFactor ? `Missing: ${exclusionAction.missingFactor}.` : null,
              exclusionAction?.tellOlumi
                ? `${NOT_ANALYSED_ACTION_LABEL}.`
                : 'Open its details.',
            ].filter(Boolean).join(' ')}
            onActivate={() => {
              /* ⭐ #1911 IS MERGED (826e69c39), so the "no values yet" arm opens
                 the option's OWN value input — `openOptionValueInput` (Model tab
                 → options section → this option's first empty effect input) —
                 rather than a chat draft (Experience Design, #63 5796039276
                 priority 2; design-integration checklist). This replaces #1915's
                 MT-21 route (the results panel's `openAskOlumi` prefill). It is
                 navigation, not a mutation: the input's own authority decides
                 what saves. An option linked to no factor still lands on its
                 detail, whose notice says to link it first. */
              if (exclusionAction?.tellOlumi) {
                openOptionValueInput(id)
                return
              }
              openNodeInspector(id)
            }}
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
        ) : isIncomplete && !incompleteStatedOnCard ? (
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

        {/* ⭐ THE KEY-DRIVER BADGE IS RETIRED (ED 02:31Z, D1a: "RETIRE the
            Key-driver badge once the body driver line is present"). One rank is
            stated once, in one vocabulary — the factor card's driver line
            ("Driver N of M analysed") and its reduced line — and never in
            a corner badge a stale run could keep alive (the badge was not
            freshness-gated; the driver line is).

            ⭐ ITS SLOT NOW HOLDS THE ONE "WORTH REVIEWING" CUE (spec §2), an
            info-tinted ring — never the warning family (ED 02:31Z D1b) — with
            its reasons in a focusable tooltip and as its accessible name. */}
        {attentionText !== null && <NodeAttentionMarker nodeId={id} sentence={attentionText} />}

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
      {/* ⭐ A BARE KIND-FILLED SHAPE ON THE BORDER, NO TILE (contract v3.1
          FRAME-03 / OR-05: `.node .shape{position:absolute;top:-12px;…}` with
          `stroke:#FEFEFE;stroke-width:1.2` and `filter:drop-shadow(0 0 1px
          white)`). It sat in a 22px white tile whose `rounded-md` made it a
          circle with a grey ring — a pale disc interrupting the border, with
          the type shape shrunk inside it, and on outcome vs risk the only
          non-colour channel between ▲ and ▼ was the smallest mark on the card.
          The panel-coloured outline and halo now separate the shape from the
          border line it sits on; the shape itself fills the box.
          ⚠ 22px CENTRED ON THE BORDER, NOT THE CONTRACT'S 24px AT −12px: served
          edges end at the handle top (~−6px), so a 24px glyph would cover ~6px
          of every inbound arrowhead. The 24px move belongs with the edge
          endpoint change (edge dimension), not here. */}
      <span
        aria-hidden="true"
        data-testid="node-type-glyph"
        className="pointer-events-none absolute -top-[11px] left-1/2 z-10 flex h-[22px] w-[22px] -translate-x-1/2 items-center justify-center"
        style={{ filter: 'drop-shadow(0 0 1px var(--bg-panel))' }}
      >
        <NodeShapeIndicator nodeKind={nodeType} size={CONNECTOR_GLYPH_PX} stroke="var(--bg-panel)" strokeWidth={0.6} />
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
            /* ⚠ COMPOSED, NOT REPLACED: this element is `line-clamp-2`, so the
               attribute is also the reader's only route back to a clipped
               name. Label first, affordance after. */
            title={titleChannels.title}
            className={
              lodBoostTitle
                ? `${typography.nodeTitle} font-semibold text-text-header break-words line-clamp-2`
                /* ⭐ THE ANCHORS TAKE THEIR EMPHASIS AT EVERY ZOOM, NOT ONLY BELOW
                   THE FLOOR (contract v3.1 ANC-04: `.node h3{font-weight:610}`,
                   the wide card's title one step above the others). The note
                   above said the anchors "take their emphasis from WEIGHT and
                   COLOUR" — true only while `lodBoostTitle` held, i.e. where the
                   body is hidden; at reading zoom the Question and Goal titles
                   were set exactly like a factor's. Same size token (DS v5 §2.3
                   forbids a fourth canvas size), so hierarchy is weight + ink. */
                : isAnchorCard
                  ? `${typography.nodeTitle} font-semibold text-text-header break-words line-clamp-2`
                  : `${typography.nodeTitle} text-text-body break-words line-clamp-2`
            }
            /* ⭐ CONTRACT `.node h3{font-weight:610}` — EVERY card's title, set
               inline so it cannot lose a cascade race with the size token's
               `font-medium`. Measured before landing (24 Sep, local dev build,
               all five starters, 87 titles): 0 card-height changes, 0 title
               line-count changes, 0 titles cut. Anchors keep their ink
               (`text-text-header`) as the hierarchy step. */
            style={lodHideTitle ? { visibility: 'hidden', fontWeight: NODE_TITLE_WEIGHT } : { fontWeight: NODE_TITLE_WEIGHT }}
          >
            {titleOverride ?? label}
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
        {/* ⚠ THIS GROUP CAN HOLD TWO GLYPHS, AND IT SHIPPED WITH NO GAP.
            `NodeProvenanceMark` renders a SECOND mark where node authorship and
            value basis disagree; this span was `inline-flex items-center
            shrink-0 ml-auto`, so the pair rendered flush at 0px — at up to 28px
            each under the counter-scale. The class string now comes from
            `CANVAS_HEADER_GLYPH_GROUP_CLASSES`, which the `headerSlot` group
            below also reads, so the header's two right-hand groups cannot drift
            apart on spacing. The testid exists so the guard binds to THIS group
            by identity rather than by walking up from a mark (trap 19). */}
        {!isCausalLens && !isEvidenceLens && (
          <span
            data-testid="node-provenance-mark-group"
            className={CANVAS_HEADER_GLYPH_GROUP_CLASSES}
          >
            <NodeProvenanceMark nodeType={nodeType} data={data} hideKind={isDetailedView ? null : provenanceDefault} />
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
        {/* Reads the SAME string as the provenance group above — byte-identical
            to the `inline-flex items-center gap-1 shrink-0 ml-auto` it spelled
            by hand, so this is a de-duplication and not a style change.

            ⚠ THE TESTID IS LOAD-BEARING, AND IT IS WHY THIS COMMENT EXISTS.
            Sharing the class string with the provenance group above made the
            two header groups INDISTINGUISHABLE TO A CSS SELECTOR. A guard in
            `render-matrix.spec.tsx` asked *"is the headerSlot wrapper gone?"*
            by querying `.inline-flex.items-center.gap-1` — and once the
            provenance group started spelling `gap-1` too, that selector began
            matching the OTHER group and the guard RED'd on an element it was
            never written about (trap 19: bind by identity, never by a predicate
            another object can satisfy). Both groups now carry their own testid
            so the question each guard asks stays attached to its own object,
            and a future shared class cannot silently re-point either one. */}
        {headerSlot && !isCausalLens && !isEvidenceLens && (
          <span
            data-testid="node-header-slot-group"
            className={CANVAS_HEADER_GLYPH_GROUP_CLASSES}
          >
            {headerSlot as ReactNode}
          </span>
        )}

        {/* Expand/collapse chevron for nodes with description */}
        {/* ⭐ ONE HEADER ICON GRAMMAR (contract v3.1 OR-11 / ICON-12). The
            chevron was a fixed 14px (≈9px on screen at the landing zoom) beside
            header glyphs that carry `--canvas-label-scale`, hovered with an
            off-token `bg-black/5`, labelled by a native `title` only. It now
            takes the canvas glyph scale, the `.icon-btn:hover` info-soft wash,
            a visible focus ring and the shared hover/focus Tooltip. The box
            (14 × scale + p-0.5) stays inside the title's line box at every
            scale, so the header height does not move. */}
        {description && (
          <Tooltip asChild delay={NODE_TOOLTIP_DELAY_MS} content={isExpanded ? 'Collapse description' : 'Expand description'}>
            <button
              type="button"
              onClick={handleExpandToggle}
              onPointerDown={(e) => e.stopPropagation()}
              className="nodrag nopan shrink-0 p-0.5 rounded text-text-light hover:bg-info/10 hover:text-info focus:outline-none focus-visible:ring-2 focus-visible:ring-info transition-colors"
              aria-label={isExpanded ? 'Collapse description' : 'Expand description'}
              data-testid="node-description-toggle"
            >
              {isExpanded ? (
                <ChevronUp size={14} aria-hidden="true" className={CANVAS_GLYPH_SIZE_CLASSES[14]} />
              ) : (
                <ChevronDown size={14} aria-hidden="true" className={CANVAS_GLYPH_SIZE_CLASSES[14]} />
              )}
            </button>
          </Tooltip>
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
          /* ⭐ THE ANCHOR'S LAST ROW KEEPS ITS TEXT CLEAR OF THE RAIL BESIDE IT
             (contract v3.1 ANC-02 / RHY-02: `.node.wide .target-row,
             .node.wide .row-meta{padding-right:58px}`). Only the LAST row sits
             beside the rail, so only it gives up measure — the rows above keep
             the card's full width and cannot wrap more than they did. The
             width is the rail's reachable extent on this card
             (`anchorRailButtons`), counter-scaled like the rail itself. */
          className="relative text-left"
          data-testid={anchorRailBeside ? 'anchor-body-rail-beside' : undefined}
          data-anchor-rail-buttons={anchorRailBeside ? anchorRailButtonsKey(anchorRailButtons) : undefined}
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
                  {/* Declared = delivered (contract v3.1 ICON-11): the glyph
                      carries `--canvas-label-scale` like the `edgeLabel` text
                      beside it; a bare `size={9}` reached the user at ~5.9px
                      at the landing zoom. */}
                  <Target size={9} className={`text-info shrink-0 mt-[2px] ${CANVAS_GLYPH_SIZE_CLASSES[9]}`} aria-hidden="true" />
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
              /*
               * ⚠⚠ THE TESTID AND THE VISIBILITY STAY ON THE OUTER ELEMENT, and
               * two specs outside this file are why. `BaseNode.lodBodyLine`
               * asserts that `node-lod-line`'s PARENT is the hidden body and
               * that the element itself re-declares `visibility: visible`;
               * `DecisionNode.optionCount` asserts the same override. Moving
               * the id onto the inner text span — which a first cut did —
               * breaks both, because the id's parent becomes this wrapper
               * rather than the body.
               *
               * ⭐ AND IT IS THE RIGHT SHAPE ANYWAY: this element IS the
               * reduced line. The truncation belongs to the TEXT inside it, not
               * to the line, which is exactly why the mark beside it can escape
               * the ellipsis.
               */
              className="absolute left-0 right-0 top-0 flex items-baseline gap-1"
              style={{ visibility: 'visible' }}
            >
              <span
                data-testid="node-lod-line-text"
                // `!leading-tight`: one line whose box fits the blanked body's
                // one-body-line height exactly (see `LOD_BLANKED_BODY_STYLE`).
                className={`${typography.nodeLabel} !leading-tight text-text-body truncate`}
              >
                {lodBodyLine}
              </span>
              {/* ⭐⭐ THE MARK IS `shrink-0`, AND THAT IS THE WHOLE POINT OF
                  PUTTING IT IN ITS OWN ELEMENT RATHER THAN IN THE STRING.
                  This line is `truncate`d, so a marker appended to the text
                  is the FIRST thing an ellipsis eats — the number survives
                  and the disclosure does not, which is the exact defect being
                  closed, rebuilt by its own fix. Here the number is what
                  gives way and the mark cannot.
                  ⚠ `est.` keeps the card's word order (value, then mark) so
                  the two zoom rungs read as one sentence rather than two. */}
              {lodBody.unconfirmedEstimate && (
                <span
                  data-testid="node-lod-estimate-mark"
                  title={ESTIMATE_SUBJECT_TITLE.value}
                  /* ⭐ Text ≥ 4.5:1 ON ITS ACTUAL GROUND (contract v3.1 T15). At
                     the line rung the card takes its kind fill, where
                     `text-light` measures 3.05–4.26:1; `text-body` clears
                     6.09–8.51:1 on every light fill. Unfilled, unchanged. */
                  className={`${typography.nodeLabel} !leading-tight ${lodKindFillClass ? 'text-text-body' : 'text-text-light'} italic shrink-0`}
                >
                  {UNCONFIRMED_ESTIMATE_TOKEN}
                </span>
              )}
            </div>
          )}
        </div>
      ) : null}

      {/* ⛔ NO IN-CARD FRONTIER QUESTION (S4, Experience Design #63
          5806207128 / 5806266691: "Do not also restore in-card prompt links";
          NODE-ANATOMY-v32 principle 3, "No link text inside a card"). The
          factor / outcome / risk questions stand at the END of their row again
          as prompt cards (`withGhostTiers`, mounted by `ReactFlowGraph`), beside
          the option card that always did — one entry point per question. The
          `TierInvitationRow` that carried them here from 15 Sep (#1606) is
          unmounted, not hidden: a second door for the same question is the
          duplicate Paul's screenshot B showed. */}

      {/* ⭐ A 3px DARK PORT, NOT A 12px KIND DISC (contract v3.1 FRAME-04:
          `.node .bottom-port{width:3px;height:3px;background:#51554F}` centred
          on the bottom border). Fifteen to nineteen coloured discs on a board
          read as developer artefacts. The HANDLE keeps its 12px box, its
          `::before` hit slop and its edge anchor; only the paint shrinks to a
          3px dot, drawn by `.olumi-node-port` in index.css — a class rather than
          an inline background so the hover / selected rule there can re-light
          it as the drag-to-connect affordance. */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="olumi-node-port"
        style={{
          width: 12,
          height: 12,
        }}
        aria-label="Output connection"
      />
    </div>
  )
})

BaseNode.displayName = 'BaseNode'
