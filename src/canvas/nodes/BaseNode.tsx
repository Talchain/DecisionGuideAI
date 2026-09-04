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

import { memo, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { optionsWereAssessed } from '../domain/optionAssessment'
import { Handle, Position, type NodeProps, useUpdateNodeInternals } from '@xyflow/react'
import type { NodeType, Controllability } from '../domain/nodes'
import { ChevronDown, ChevronUp, Flag as FlagIcon, ArrowUp, ArrowDown, Minus, type LucideIcon } from 'lucide-react'
import { useEditPreviewStore } from '../stores/editPreviewStore'
import { sanitizeMarkdown } from '../../lib/renderSafeRichText'
import { UnknownKindWarning } from '../components/UnknownKindWarning'
import { NodeCoachingMarker } from './shared/NodeCoachingMarker'
import { useCanvasStore } from '../store'
import { selectLodBodyHidden } from '../utils/zoomLegibility'
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
import { NodeQuickActions } from './shared/NodeQuickActions'
import { NodeProvenanceMark } from './shared/NodeProvenanceMark'
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
export const BaseNode = memo(({ id, nodeType, icon: _icon, data, selected, children, maxWidth, headerSlot, borderClassOverride, lodKeepLabel = false, lodMetric }: BaseNodeProps) => {
  const label = typeof data?.label === 'string' && data.label ? data.label : 'Untitled'
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
    if (!lodBodyHidden || nodeType !== 'option') return undefined
    return resolveLodMetricFacts({
      nodeType,
      nodeId: id,
      data: data as Record<string, unknown> | undefined,
      ceeOptions: ceeAnalysisReady?.options,
    })
  }, [lodBodyHidden, nodeType, id, ceeAnalysisReady, data])

  const lodBodyLine = useMemo<string | null>(() => {
    if (!lodBodyHidden) return null
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
  }, [lodBodyHidden, lodMetric, nodeType, data, label, displayMetadata, lodFacts])

  const isIncomplete = (() => {
    if (!isPreRunMode) return false
    if (nodeType === 'factor') {
      // Single source of truth shared with FactorNode's in-body chip — see
      // isFactorNeedsInput in observedStateHelpers.ts.
      return isFactorNeedsInput(data)
    }
    if (nodeType === 'goal') {
      return !isGoalDefined(goalThreshold, goalConstraints)
    }
    if (nodeType === 'decision') {
      const hasOptions = edges.some(e => e.source === id)
      return !hasOptions
    }
    if (nodeType === 'option') {
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
  // unset "goal gap" renders 2px SOLID amber via the isIncomplete path.
  // ⚠ It read "2px dashed warning" until 1 Sep 2026. The dash was removed as a
  // false claim ("outside your control") — see `borderColourClass` below for the
  // ratified vocabulary. A width note still describing the old style would be
  // the next reader's evidence for putting it back.
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
  const renderedCardW = isExpanded ? NODE_CARD_MAX_W : (maxWidth ?? layoutNodeWidth ?? NODE_CARD_MAX_W)
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
   * ⭐⭐ AMBER ONLY — THE DASH IS A DIFFERENT CLAIM, AND IT WAS FALSE.
   *
   * `DESIGN_SYSTEM.md` §"Border vocabulary (ratified, wireframe v4)" names
   * exactly two border modifiers and says they must never be conflated:
   *
   *   · **DASHED = "outside your control"** (external factors)
   *   · **AMBER  = "needs your judgement"** (a controllable node missing its
   *     value; the goal missing its target)
   *
   * This expression applied BOTH AT ONCE for `isIncomplete`, so every incomplete
   * node also claimed to be outside the user's control. On the founder's
   * pre-analysis screenshot four of five OPTIONS rendered that way — and an
   * option is the most within-the-user's-control object on the canvas. The
   * sentence the card was making is not clumsy, it is false.
   *
   * ⚠ THE AMBER IS UNTOUCHED, DELIBERATELY. Amber-on-incomplete is ratified, and
   * `DESIGN_SYSTEM.md` carries an OPEN QUESTION about the hue itself (flagged
   * 2026-07-16, "Paul to rule"). Changing the hue is not this lane's call;
   * removing a modifier that means something else is, because it needs no
   * re-ruling at all.
   *
   * ⚠ EXTERNAL FACTORS ARE UNAFFECTED, and the reason sits UPSTREAM of this line
   * rather than inside it: `isFactorNeedsInput` returns false for
   * `category === 'external'`, so an external factor never enters this arm and
   * its dash comes from `borderStyle` in the final branch. That is what keeps
   * "external factors NEVER get amber" true structurally.
   *
   * ⚠ PRECEDENCE IS UNCHANGED and is NOT the same question. `isIncomplete` still
   * wins over `borderClassOverride`. That is a separate, pre-existing
   * disagreement between two authorities about the goal card (trap 21);
   * re-ordering them here would be an undeclared ruling on it. Left as found.
   *
   * Pinned in BOTH directions by `BaseNode.incompleteBorderVocabulary.spec.tsx`
   * — the incomplete node must LOSE the dash and the external factor must KEEP
   * it, in one file, so a change that flattened the whole channel cannot pass.
   */
  const borderColourClass = isCausalLens
    ? (causalBorderClass ?? '')
    : isIncomplete
      ? 'border-warning'
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
      className={`
        group relative rounded-lg ${isCausalLens ? 'border' : isIncomplete ? 'border-2' : borderWidth} shadow-1
        ${borderColourClass}
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
        backgroundColor: evidenceBgStyle ?? 'var(--bg-panel)',
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
        padding: showQuickActions || ((nodeType === 'factor' || nodeType === 'option') && !isCausalLens && !isEvidenceLens)
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
        maxWidth: `${renderedCardW}px`,
        minHeight: isExpanded ? '120px' : undefined,
      }}
    >
      {/* R5 contextual efficiency layer — quiet at rest, revealed on hover, on
          keyboard focus within the card, and while the node is selected. One
          home for it (here) rather than per-node-type, so every node speaks the
          same two shortcuts: ask Olumi about this, open this node's details.
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
          className="absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full bg-panel shadow-1"
          title="Flagged as assumption"
          data-testid="assumption-badge"
        >
          <FlagIcon size={12} className="text-warning" />
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
          siblings here, ordered smallest-in-the-middle for legibility: rank
          FIRST (reads "key driver #N"), then the small 10px edited-since-run
          freshness dot, then the interactive coaching marker anchored at the
          corner (rightmost — the easiest click target). The row is anchored by
          its right edge and grows leftward, keeping all three inside the top
          band (no title overlap) and off the node's right side; siblings never
          overlap, so each stays visible and the coaching button stays
          clickable. Each child self-gates, so the container is empty (0×0,
          inert) when none applies.

          ⭐⭐ THE "NEEDS INPUT" PILL IS THE FOURTH OCCUPANT, AND IT JOINED THIS
          STACK RATHER THAN BEING NUDGED (2026-09-03). `StatusPill` hand-wrote
          `absolute -top-2 -right-1 z-10` — ONE PIXEL from this container's
          `-right-2` and at the SAME z — so it was a rival authority in the very
          corner this container exists to own, exactly like the three before it.
          Measured in real Chromium before the move
          (`e2e/geometry/statusPillCorner.measure.ts`, 1440x900, starters
          `vendor-selection` / `build-vs-buy`, with a prior run in history): the
          pill covered 15px² of the edited-since-run dot's 25px² — 60% of it.
          The control arm with no run history measured zero, so the probe
          discriminated.

          ⚠ ORDER IS WIDEST-FIRST, and that is what puts the pill at the head:
          the row is anchored by its RIGHT edge and grows LEFTWARD, so the widest
          child must lead or it pushes the small badges away from the corner and
          displaces the coaching marker from the rightmost, easiest click target.
          The pill measured 67.9px against the dot's 5px at the same zoom, so it
          leads by a wide margin. Order: pill · rank · edited-dot · coaching.

          ⚠ THE PILL AND THE RANK BADGE CANNOT ACTUALLY CO-OCCUR, and that is a
          derived fact, not an accident of ordering: the rank badge requires
          `results.status === 'complete'` (`useNodeDisplayMetadata.ts:226`) and the
          pill requires `results.status !== 'complete'` (`isPreRunMode`, :256) —
          exact complements on ONE store field. Both are placed here anyway so the
          contract stays total if either gate ever changes;
          `BaseNode.statusPillCornerStack.spec.tsx` PINS the impossibility with the
          REAL hook so a change that makes them co-occur fails loudly instead of
          silently overlapping. */}
      <div
        data-testid={`node-corner-stack-${id}`}
        className="absolute -top-2 -right-2 z-10 flex items-center gap-1"
      >
        {/* Graph v1.1: "Needs input" StatusPill replaces the legacy "?" badge for
            factor (no value) and goal (no threshold). Wireframe v4 — FactorNeedsPre
            / GoalNoTargetPre. Decision/option keep the warning border only.

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
            here rather than a two-questions-one-name conflation. The ACTION is not
            duplicated: GoalNode co-renders its "No target set" chip in exactly this
            state (GoalNode.tsx `{!hasThreshold && !isPostAnalysis && ...}`), and that
            chip carries both the action and its own aria-label. */}
        {isIncomplete && (nodeType === 'factor' || nodeType === 'goal') && (
          <StatusPill
            label="Needs input"
            title={nodeType === 'goal' ? FOOTER_COPY.readySubSuccessUnset : 'Missing required input'}
          />
        )}

        {/* Sensitivity rank badge — Results mode, top 3 factors. */}
        {typeof displayMetadata.sensitivityRank === 'number' && (
          <span
            data-testid={`sensitivity-rank-${id}`}
            className={`${typography.nodeLabel} font-semibold text-text-body bg-panel-border rounded-full flex items-center justify-center shadow-sm`}
            style={{ minWidth: '20px', height: '20px', padding: '0 4px', pointerEvents: 'none' }}
            title={`Key driver #${displayMetadata.sensitivityRank}: ranked by influence on the outcome`}
          >
            #{displayMetadata.sensitivityRank}
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
          D2: at level-of-detail zoom the body hides via visibility (box keeps
          its dimensions so ELK/edge anchors stay stable) — the node reads as
          its coloured shape, PLUS the one reduced line below. */}
      {/* ⚠ `children || lodBodyLine`, AND THE SECOND HALF IS LOAD-BEARING. This
          wrapper hosts the reduced line, so gating it on `children` alone made
          the line unrenderable on precisely the cards that needed it most: one
          whose body branches all resolved to nothing is the emptiest box on the
          canvas, and it was the one card that could not be given a line. The
          wrapper contributes no height and the line is absolutely positioned,
          so admitting it with no children changes no geometry. */}
      {!isCausalLens && !isEvidenceLens && (children || lodBodyLine) ? (
        <div className="relative text-left" style={lodBodyHidden ? { visibility: 'hidden' } : undefined} data-lod-hidden={lodBodyHidden || undefined}>
          {children as ReactNode}
          {/* The reduced line (see `lodBodyLine` above for what it is and why
              the scope is what it is).

              TWO PROPERTIES IT HAS TO KEEP, both load-bearing:
              · `visibility: 'visible'` overrides the hidden ancestor — a
                descendant may re-declare visibility, which is the whole reason
                the body can stay hidden while one line of it comes back;
              · absolutely positioned, so it contributes NO height. The card's
                box is byte-for-byte what it was before this change, which is
                what keeps ELK's placement and the edge anchors stable — the
                same reason the body hides by visibility rather than display.
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
