/**
 * Styled edge component with visual properties
 * Renders weight, style, curvature, label, and confidence
 * British English: visualisation, colour
 *
 * Path type implementation:
 * - bezier: Smooth curved lines (default, uses getBezierPath)
 * - smoothstep: Right-angle paths with rounded corners (uses getSmoothStepPath)
 * - straight: Direct diagonal lines (uses getStraightPath)
 *
 * For smoothstep, curvature range 0..0.5 maps to borderRadius 0..25px.
 *
 * Brief v2.2: Added visual styling for effect direction
 * - positive: Green stroke (increase → increase)
 * - negative: Red stroke (increase → decrease)
 */

import { memo, useMemo, useState, useRef, useEffect } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, getStraightPath, type EdgeProps, useReactFlow, useStore } from '@xyflow/react'
import { Lightbulb, AlertTriangle, Flag } from 'lucide-react'
import { NodeChip } from '../nodes/shared'
import { useShallow } from 'zustand/react/shallow'
import type { EdgeData, EdgePathType } from '../domain/edges'
import { shouldShowEdgeLabel } from './edgeLabelVisibility'
import { computeDirectionStroke } from './directionStroke'
import {
  readContestedState,
  resolveEdgeStroke,
  resolveEdgeDash,
  type EdgePresentationState,
} from './edgePresentation'
import { resolvePersistentLabelPlacements, type PlacementEdge } from './edgeLabelCollision'
import { applyEdgeVisualProps } from '../theme/edges'
import { shouldShowLabel, getEdgeConfidence } from '../domain/edges'
import {
  resolveEdgeValueDisplay,
  resolveEdgeSignedStrengthDisplay,
  resolveEdgeDirectionDisplay,
  compareEdgeValueDisplays,
  type EdgeValueDisplay,
  type CausalLensEdgeParams,
} from '../domain/edgeValueProvenance'
import { useIsDark } from '../hooks/useTheme'
import { getEdgeLabel } from '../domain/edgeLabels'
import { useEdgeLabelMode } from '../store/edgeLabelMode'
import { useCanvasStore } from '../store'
import { isGraphLensEnabled } from '../../flags'
import { isEdgeFragile as isEdgeFragileFn, getFragileEdgeSwitchProbability, isTopFragileEdge as isTopFragileEdgeFn } from '../utils/fragileEdgeMatch'
import { existenceCertaintyToLineStyle, calculateEdgeImportance, weightMagnitudeToStrokeWidth, UNSET_EDGE_STROKE_WIDTH } from '../utils/graphDisplayCalculations'
import { typography } from '../../styles/typography'
import { useEdgeEditHint } from '../hooks/useFirstTimeHints'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { useAssistantFocusStore } from '../stores/assistantFocusStore'
import { openEdgeStrengthEditor } from '../utils/openEdgeStrengthEditor'

/**
 * StyledEdge with semantic visual properties
 * Maps weight/style/curvature to SVG rendering
 * v1.2 + P1: Live edge label toggle (human ⇄ numeric)
 */
// Direction colours (green/red/grey) are pre-existing hex — not changed in this brief.
// All new styling uses design tokens.

// Structural edge grey — brief constant, not a theme token. Used for the
// thin 1px solid stroke on decision→option and option→factor edges so they
// recede visually next to causal edges. Re-exported so the many existing tests
// that import it from here keep working; it now LIVES in `edgePresentation`,
// beside the rule that applies it.
export { STRUCTURAL_EDGE_COLOUR } from './edgePresentation'

// Stable empty set for the lens-disabled branch of the store selector —
// a fresh Set per call would defeat useShallow's reference equality.
const EMPTY_ID_SET: ReadonlySet<string> = new Set<string>()

/**
 * 6B: width of the invisible pointer target along the edge path, in canvas
 * units (so it scales with zoom). Edges are 1–3px of visible stroke, which is
 * a very small thing to hit; this widens the grab area without changing what
 * is drawn. Exported so tests bind to the identity rather than to a literal.
 *
 * Also passed to BaseEdge's own interaction path so the two hit areas cannot
 * drift apart — React Flow defaults that path to 20, which would otherwise
 * silently cap the usable area at 20 wherever BaseEdge paints on top.
 */
export const EDGE_HIT_AREA_WIDTH = 28

export const StyledEdge = memo(({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, data }: EdgeProps<EdgeData>) => {
  const isDark = useIsDark()
  const prefersReducedMotion = usePrefersReducedMotion()
  const { getNode, getEdges, getNodes } = useReactFlow()

  // P1 Polish: Edge label mode from Zustand store (live updates, cross-tab sync)
  const labelMode = useEdgeLabelMode(state => state.mode)

  // P1.6: First-time edge-details hint
  const { showHint: showEdgeHint, dismissHint: dismissEdgeHint } = useEdgeEditHint()
  const edges = getEdges()
  const isFirstEdge = edges.length > 0 && edges[0].id === id

  // C1: Hover state for edge label visibility
  const [isHovered, setIsHovered] = useState(false)
  // T1: Hover popover — delayed 300ms to avoid flicker on pass-through mouse movements
  const [showHoverPopover, setShowHoverPopover] = useState(false)
  const hoverPopoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (hoverPopoverTimerRef.current) clearTimeout(hoverPopoverTimerRef.current)
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
  }, [])
  // `id` reaches this component as `unknown` through EdgeProps<EdgeData> in the
  // current TS setup (the two neighbouring `.has(id)` selectors below carry
  // baseline diagnostics for exactly that). The canvas contract is that edge
  // ids are strings — every id Set in the store is Set<string> — so narrow once
  // here for the new selector rather than adding a third baselined error.
  // Fixing the pre-existing two is a typing change outside this lane's fence.
  const edgeIdKey = String(id)
  const isAssistantFocused = useAssistantFocusStore(
    (state) => state.target?.kind === 'edge' && state.target.id === edgeIdKey,
  )

  // ── Consolidated store selectors (2 subscriptions instead of 13) ──
  // Group 1: Core store data (results, review, actions)
  const { ceeReview, resultsStatus, report, isHighlightedEdge, isAnalysisFragileEdge, isSelectionDimmed, viewMode } = useCanvasStore(
    useShallow(s => ({
      ceeReview: s.runMeta.ceeReview,
      resultsStatus: s.results.status,
      report: s.results.report,
      isHighlightedEdge: s.highlightedEdges.has(id),
      // Analysis-graph projection: this edge is a flip risk being viewed in the
      // V7 evidence disclosure. Optional-chained so store doubles without the
      // slice stay safe (same pattern as editedSinceRunNodeIds).
      isAnalysisFragileEdge: s.analysisHighlight?.source === 'flip_risks' && s.analysisHighlight?.edgeIds?.has(id) === true,
      // 6A (selection focus): this edge is outside the selected element's
      // neighbourhood. Primitive boolean (React #185) and optional-chained so
      // store doubles without the slice stay safe.
      isSelectionDimmed: s.dimmedEdgeIds?.has(edgeIdKey) === true,
      viewMode: s.viewMode,
    })),
  )
  const isResultsMode = resultsStatus === 'complete'

  // Group 2: Lens data — all 8 lens selectors collapsed into one subscription
  const lensEnabled = isGraphLensEnabled()
  const {
    isLensDimmed, lensMode, lensSensWeight, lensQ25, lensQ75,
    isLensFragile, isLensHidden, causalEdgeParams, evidenceEdgeClass,
    lensHiddenNodeIds, lensHiddenEdgeIds,
  } = useCanvasStore(
    useShallow(s => {
      if (!lensEnabled) {
        return {
          isLensDimmed: false, lensMode: 'full' as const,
          lensSensWeight: null as number | null,
          lensQ25: null as number | null, lensQ75: null as number | null,
          isLensFragile: false, isLensHidden: false,
          causalEdgeParams: null as CausalLensEdgeParams | null,
          evidenceEdgeClass: null as string | null,
          lensHiddenNodeIds: EMPTY_ID_SET,
          lensHiddenEdgeIds: EMPTY_ID_SET,
        }
      }
      const active = s.lens.active
      return {
        isLensDimmed: s.lens._dimmedEdgeIds.has(id),
        lensMode: active,
        lensSensWeight: active === 'sensitivity' ? (s.lens._sensitivityWeights.get(id) ?? null) : null,
        lensQ25: active === 'sensitivity' ? (s.lens._sensitivityQuartiles?.q25 ?? null) : null,
        lensQ75: active === 'sensitivity' ? (s.lens._sensitivityQuartiles?.q75 ?? null) : null,
        isLensFragile: (active === 'fragile' || active === 'robustness') && s.lens._fragileEdgeIds.has(id),
        isLensHidden: s.lens._hiddenEdgeIds?.has(id) === true,
        causalEdgeParams: active === 'causal' ? (s.lens._causalEdgeParams?.get(id) ?? null) : null,
        evidenceEdgeClass: active === 'evidence' ? (s.lens._evidenceEdgeClass?.get(id) ?? null) : null,
        // C2 review fix 1: the label-collision pass needs the full hidden
        // sets — lens hiding is the app's ONLY node-hiding mechanism
        // (BaseNode returns null; React Flow's `hidden` flag is never set).
        lensHiddenNodeIds: (s.lens._hiddenNodeIds ?? EMPTY_ID_SET) as ReadonlySet<string>,
        lensHiddenEdgeIds: (s.lens._hiddenEdgeIds ?? EMPTY_ID_SET) as ReadonlySet<string>,
      }
    }),
  )

  // Graph Lens: alternative winner label for fragile edge hover
  const lensFragileLabel = useMemo(() => {
    if (!isLensFragile || !report) return ''
    const reportAny = report as Record<string, unknown>
    const robustness = reportAny.robustness as Record<string, unknown> | undefined
    const fragileEdges = (robustness?.fragile_edges ?? []) as Array<Record<string, unknown>>
    for (const fe of fragileEdges) {
      const feEdgeId = (fe.edge_id ?? fe.edgeId) as string | undefined
      const fromId = (fe.from_id ?? fe.fromId ?? fe.source) as string | undefined
      const toId = (fe.to_id ?? fe.toId ?? fe.target) as string | undefined
      if (feEdgeId === id || (fromId === source && toId === target)) {
        const altLabel = (fe.alternative_winner_label ?? fe.alternativeWinnerLabel) as string | undefined
        return altLabel ? `If wrong → ${altLabel}` : 'Sensitive'
      }
    }
    return 'Sensitive'
  }, [isLensFragile, report, id, source, target])

  // Check if this edge is fragile (switch_probability > 0.3)
  // Uses shared utility for consistent matching across StyledEdge, useMenuItems, useLensFilter
  const isFragileEdge = useMemo(() => {
    if (!isResultsMode || !report?.robustness) return false
    const fragileEdges = report.robustness.fragile_edges || []
    return isEdgeFragileFn(id, source, target, fragileEdges)
  }, [isResultsMode, report, id, source, target])

  // T7: Switch probability for fragile edge badge tooltip + hover popover
  const fragileEdgeSwitchProb = useMemo(() => {
    if (!isFragileEdge || !report?.robustness) return null
    const fragileEdges = report.robustness.fragile_edges || []
    return getFragileEdgeSwitchProbability(id, source, target, fragileEdges)
  }, [isFragileEdge, report, id, source, target])

  // E4 (graph-visuals): the SINGLE most fragile relationship earns a fragility
  // badge in the default (standard) view too, so the top flip risk is visible
  // on the map without switching to Detailed. Every fragile edge still badges
  // in Detailed/Model view (below).
  const isTopFragileEdge = useMemo(() => {
    if (!isFragileEdge || !report?.robustness) return false
    const fragileEdges = report.robustness.fragile_edges || []
    return isTopFragileEdgeFn(id, source, target, fragileEdges)
  }, [isFragileEdge, report, id, source, target])

  // Extract edge data with defaults
  const edgeData = data as EdgeData | undefined

  // Check if this edge has a pending weight suggestion (not yet applied)
  // Treat provenance='ai-suggested' as "already applied" to clear the highlight
  const hasSuggestion = useMemo(() => {
    if (!ceeReview?.weight_suggestions) return false
    const suggestion = ceeReview.weight_suggestions.find(s => s.edge_id === id)
    if (!suggestion || suggestion.auto_applied) return false
    // If user already applied via EdgeInspector, provenance will be 'ai-suggested'
    if (edgeData?.provenance === 'ai-suggested') return false
    return true
  }, [ceeReview?.weight_suggestions, id, edgeData?.provenance])
  const weight = edgeData?.weight ?? 0.5 // Aligned with DEFAULT_EDGE_DATA.weight and computeSignedMean default
  const style = edgeData?.style ?? 'solid'
  const curvature = edgeData?.curvature ?? 0.15
  const pathType: EdgePathType = edgeData?.pathType ?? 'bezier'
  const kind = edgeData?.kind ?? 'decision-probability'
  const label = edgeData?.label
  const confidence = edgeData?.confidence
  const belief = edgeData?.belief      // v1.2
  const provenance = edgeData?.provenance  // v1.2
  // ⭐ ROADMAP 2.580 member 2 — THE POLARITY GLYPH'S OWN, GATED, DIRECTION.
  //
  // ⭐⭐ ROADMAP 2.928 member b — AND THE STROKE'S. The raw read that used to
  // sit here (`const direction = edgeData?.direction`) is GONE: after the
  // stroke moved onto the resolver it had no remaining reader on this surface,
  // and leaving it would be an invitation to wire a third channel to the
  // fabricated default. Outbound adapters and persistence still read
  // `edge.data.direction` from the store; nothing on screen does.
  //
  // The RAW field defaults: `USER_EDGE_DEFAULTS`
  // writes `'positive'` with no source stamp, and the template/blueprint/CEE
  // -apply paths build from `DEFAULT_EDGE_DATA`, which has no `direction` key
  // at all. Reading it raw made the canvas draw a green "+" — a positive
  // causal claim — on edges whose direction nobody ever stated.
  //
  // `resolveEdgeDirectionDisplay` is the one owner of that answer (rule 4 of
  // its module header, ROADMAP 2.263). It was applied to the three Model-tab
  // consumers and not to this file, so the Model tab said "direction not
  // stated" while the graph beside it drew a "+". The hover popover below
  // (:1010) was already gated and its comment names this exact hazard.
  //
  // ⚠ CORRECTED 2026-08-08 (ROADMAP 2.928 member b). This comment used to say
  // the constant was "kept SEPARATE from `direction` deliberately: the raw
  // field still drives the stroke colour". That separation was the DEFECT, not
  // a design: it left the green polarity STROKE on edges whose glyph this very
  // resolver had just suppressed. The raw `direction` still drives the outbound
  // ADAPTERS and the persisted bytes — that part stands, and is why ingestion
  // is untouched — but it no longer drives anything on screen.
  //
  // Memoised on `edgeData` for the same reason `edgeSignedStrength` below is:
  // the resolver returns a fresh object each call, and the stroke memo now
  // depends on this one. Same identity discipline, same dependency.
  const directionDisplay = useMemo(
    () => resolveEdgeDirectionDisplay(edgeData as Record<string, unknown> | undefined),
    [edgeData],
  )
  const statedDirection = directionDisplay.show ? directionDisplay.direction : null

  // Count outgoing edges from source node for visibility logic
  const outgoingEdgeCount = useMemo(() => {
    const edges = getEdges()
    return edges.filter(e => e.source === source).length
  }, [source, getEdges])

  // Apply visual properties (O(1), pure function)
  const visualProps = useMemo(
    () => applyEdgeVisualProps(weight, style, curvature, selected || false, isDark),
    [weight, style, curvature, selected, isDark]
  )

  // P2.9: Stroke width encodes WEIGHT MAGNITUDE in BOTH phases. Previously it
  // switched meaning — |strength.mean| pre-run, composite importance
  // (belief × strength × goal_sensitivity) post-run — so the one visual a user
  // learns pre-run silently re-scaled the moment results arrived. Width is now
  // the stable, learnable channel; post-run importance is already surfaced via
  // the edge label, the top-3 auto-labels, and the #451 projection halo, so it
  // no longer needs to hijack thickness. (Deliberate, Paul-approved encoding
  // change — see PR body.)
  // ⛔ Provenance gate. `computeSignedMean` falls back to `weight`, which the
  // edge defaults always define, so thickness — the channel the UI explicitly
  // TEACHES the user to read as strength — reported 2px ("Strong") for every
  // CEE edge whose strength nobody had set. An unset edge now draws at the
  // floor width: it still has to be drawn, and the minimum is the only width
  // that cannot be mistaken for a measurement. Colour (grey, above) carries
  // the "no verdict" claim; width simply stops asserting one.
  const edgeSignedStrength = useMemo(
    () => resolveEdgeSignedStrengthDisplay(edgeData as Record<string, unknown> | undefined),
    [edgeData]
  )
  const edgeStrokeWidth = useMemo(
    () => edgeSignedStrength.show
      ? weightMagnitudeToStrokeWidth(edgeSignedStrength.value)
      : UNSET_EDGE_STROKE_WIDTH,
    [edgeSignedStrength]
  )

  // F.2 + E1: direction-based stroke colour (see directionStroke.ts for the
  // CVD-aware polarity palette and the ΔE rationale). Applies pre-run and
  // post-run; one source of truth shared with directionColour.spec.
  //
  // ⭐ ROADMAP 2.928 member b — this takes `directionDisplay`, the SAME resolved
  // value the glyph reads, not the raw `direction` field. The glyph and the
  // stroke are now two renderings of one answer; there is no second read of the
  // fabricated default left on this surface.
  const directionStroke = useMemo(
    () => computeDirectionStroke(directionDisplay, edgeSignedStrength, isDark),
    [directionDisplay, edgeSignedStrength, isDark],
  )

  // Decision Graph Display v2: Existence certainty line style
  // Solid: >70%, Dashed: 40-70%, Dotted: <40%
  // Use utility function to ensure single source of truth
  // Issue #1 fix: Add fallback for snake_case field names from raw API data
  const beliefExists = edgeData?.beliefExists ??
                       (edgeData as any)?.belief_exists ??
                       (edgeData as any)?.exists_probability
  // Both views: dashed when exists_probability < 0.7 (existence certainty styling)
  const existenceCertaintyDash = useMemo(() =>
    existenceCertaintyToLineStyle(beliefExists),
    [beliefExists]
  )

  // Contested edge state — reduced to four named facts by the one authority
  // (`edgePresentation.readContestedState`), which also owns the
  // divergence-scaled dash. The gate itself is unchanged: status contested AND
  // user_action pending AND a divergence actually supplied.
  const validation = edgeData?.validation
  const contested = useMemo(() => readContestedState(validation), [validation])

  // Fix 1: Line style encodes existence certainty ONLY, not direction
  // Direction is already encoded via color (green/red) and sign (+/−)

  // D.1: Unified confidence check via getEdgeConfidence (returns null when missing)
  const edgeConfidenceValue = getEdgeConfidence(edgeData as Record<string, unknown> | undefined)

  // B.I.10 (SUPERSEDED as a STYLE, retained as a MARKER — 17 Aug 2026).
  //
  // This used to be `!isResultsMode && edgeConfidenceValue === null` and it
  // dashed the edge, commented "needs attention". Both halves were defects:
  //   • On a fresh AI draft NO edge has a confidence, so "needs attention"
  //     marked the entire graph — Paul's ruling that exception styling must not
  //     become the default. `edgePresentation.EDGE_DASH_RULES` no longer carries
  //     a `pre_run_incomplete` rule.
  //   • `!isResultsMode` is an APP PHASE (`results.status === 'complete'`), so
  //     completing an analysis restyled edges the user had not touched. That is
  //     the flip Paul witnessed on the Analysis tab, and it is why the term is
  //     gone from the predicate rather than merely unused: an edge's resting
  //     appearance is a function of the edge.
  // A confidence of 0 is a valid user choice (low), not "missing".
  const isMissingConfidenceEdge = edgeConfidenceValue === null

  // Determine label visibility and styling
  const labelVisibility = useMemo(
    () => shouldShowLabel(label, confidence, outgoingEdgeCount, kind),
    [label, confidence, outgoingEdgeCount, kind]
  )

  // Compute edge path based on pathType
  const [edgePath, labelX, labelY] = useMemo(() => {
    switch (pathType) {
      case 'straight':
        return getStraightPath({ sourceX, sourceY, targetX, targetY })
      case 'smoothstep':
        return getSmoothStepPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
          borderRadius: visualProps.curvature * 50, // Map 0-0.5 to 0-25px
        })
      case 'bezier':
      default:
        return getBezierPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
          curvature: 0.25, // Bezier curve intensity
        })
    }
  }, [pathType, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, visualProps.curvature])
  
  // Improved accessible name using node titles
  const sourceNode = getNode(source)
  const targetNode = getNode(target)
  const srcTitle = sourceNode?.data?.label || source
  const tgtTitle = targetNode?.data?.label || target
  const confText = confidence !== undefined ? `, confidence ${Math.round(confidence * 100)}%` : ''

  // ⭐ ROADMAP 2.935 (Codex MF5) — THE LABEL'S DIRECTION WORD, FROM THE SAME
  // RESOLVED VALUE THE GLYPH AND THE STROKE READ.
  //
  // `weight` (:209) is an UNSIGNED MAGNITUDE — both ingestion paths store
  // `Math.abs(rawWeight)` beside a separate `direction` field (UI-SEM-023). It
  // was passed straight into `getEdgeLabel`, which picked "boost" or "drag" from
  // `weight >= 0`, so every causal edge on the canvas read "boost" — including
  // the ones CEE sent a negative `strength.mean` for. The glyph beside it was
  // already announcing "Effect direction: negative" at the time.
  //
  // ⭐ ROADMAP 2.950 — AND THE LABEL'S STRENGTH ADJECTIVE, FROM THE SAME
  // RESOLVED VALUE THE STROKE WIDTH READS. `weight` (:209) falls through to
  // `0.5` — `DEFAULT_EDGE_DATA.weight`, a UI constant — so the label asserted
  // "Moderate" for edges whose strength nobody set, directly beside the
  // direction clause that had just learned to refuse. `edgeSignedStrength`
  // (:283) is the one owner of "may this surface speak a strength?", already
  // consulted by the stroke width; the label now reads the same answer.
  //
  // Computed ONCE here rather than twice inline in the JSX below, because the
  // accessible name is built from it: `aria-label` REPLACES descendant text for
  // assistive tech, so a name that omitted the description announced something
  // different from what was on screen.
  const edgeDescription = useMemo(
    () => getEdgeLabel(edgeSignedStrength, belief, directionDisplay, labelMode),
    [edgeSignedStrength, belief, directionDisplay, labelMode],
  )
  const ariaLabel = `Edge from ${srcTitle} to ${tgtTitle}${confText}, ${edgeDescription.label}`

  // Inspect the relationship without claiming a local React-Flow write is a
  // shared-model edit. Inspector v2 owns the visible read-only authority copy.
  const handleLabelDoubleClick = (event: React.MouseEvent) => {
    event.stopPropagation()
    openEdgeStrengthEditor(edgeIdKey)
    // Dismiss the first-time hint once the details route is discovered.
    if (showEdgeHint) dismissEdgeHint()
  }

  // C1: Handle hover for edge label visibility + T1: delayed hover popover
  // Leave timer allows mouse to transition from edge path to popover without closing
  // Structural edges skip the popover timer entirely — they show a native
  // browser tooltip via the <title> child on the hitbox path instead.
  const handleMouseEnter = () => {
    setIsHovered(true)
    if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null }
    if (isStructuralEdge) return
    hoverPopoverTimerRef.current = setTimeout(() => setShowHoverPopover(true), 300)
  }
  const handleMouseLeave = () => {
    setIsHovered(false)
    if (hoverPopoverTimerRef.current) {
      clearTimeout(hoverPopoverTimerRef.current)
      hoverPopoverTimerRef.current = null
    }
    // Delay closing so mouse can reach the popover
    leaveTimerRef.current = setTimeout(() => {
      setShowHoverPopover(false)
      leaveTimerRef.current = null
    }, 100)
  }
  const handlePopoverEnter = () => {
    if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null }
  }
  const handlePopoverLeave = () => {
    leaveTimerRef.current = setTimeout(() => {
      setShowHoverPopover(false)
      setIsHovered(false)
      leaveTimerRef.current = null
    }, 100)
  }

  // Detect structural (non-causal) edges. Covers decision→option (organisational
  // wiring) and option→factor (intervention edges). Resolution order:
  //   1. Any explicit data.edge_type wins over node-kind inference
  //      - 'structural' → structural
  //      - any other recognised value (causal/directed/bidirected/confounder) → not structural
  //   2. Otherwise infer from source / target node kinds
  // Returns the tooltip text differentiated by sub-type so the hitbox can
  // attach a native browser tooltip.
  const { isStructuralEdge, structuralTooltip } = useMemo(() => {
    const explicit = (data as Record<string, unknown> | undefined)?.edge_type as string | undefined
    const srcKind = sourceNode?.type || (sourceNode?.data as Record<string, unknown>)?.kind
    const tgtKind = targetNode?.type || (targetNode?.data as Record<string, unknown>)?.kind
    if (explicit === 'structural') {
      // Use sub-type for tooltip text where possible
      if (srcKind === 'decision' && tgtKind === 'option') {
        return { isStructuralEdge: true, structuralTooltip: 'Option of this decision' }
      }
      if (srcKind === 'option' && tgtKind === 'factor') {
        return { isStructuralEdge: true, structuralTooltip: 'This option affects this factor' }
      }
      return { isStructuralEdge: true, structuralTooltip: 'Structural link (not analysed)' }
    }
    // Any other explicit edge_type disables structural inference. This means a
    // graph that has tagged option→factor edges as 'causal' (overriding the
    // default intervention semantics) keeps full causal styling.
    if (explicit != null && explicit !== '') {
      return { isStructuralEdge: false, structuralTooltip: null }
    }
    // No explicit value — infer from node kinds.
    if (srcKind === 'decision' && tgtKind === 'option') {
      return { isStructuralEdge: true, structuralTooltip: 'Option of this decision' }
    }
    if (srcKind === 'option' && tgtKind === 'factor') {
      return { isStructuralEdge: true, structuralTooltip: 'This option affects this factor' }
    }
    return { isStructuralEdge: false, structuralTooltip: null }
  }, [data, sourceNode, targetNode])

  // Graph Editing Experience Task 9c: Persistent labels on top 3 edges
  // Pre-analysis: rank by |strength.mean|. Post-analysis: rank by composite importance.
  // Structural edges (decision→option) are excluded from ranking.
  // E3 refactor: the ranking now yields the persistent-label ID SET so both
  // the per-edge flag AND the label-collision pass share one computation.
  const topStrengthIds = useMemo((): Set<string> => {
    const allEdges = getEdges()
    // Filter out non-causal edges (structural + intervention) before ranking
    const causalEdges = allEdges.filter(e => {
      const sn = getNode(e.source)
      const tn = getNode(e.target)
      const sk = sn?.type || (sn?.data as Record<string, unknown>)?.kind
      const tk = tn?.type || (tn?.data as Record<string, unknown>)?.kind
      if (sk === 'decision' && tk === 'option') return false // structural
      if (sk === 'option' && tk === 'factor') return false   // intervention
      return true
    })
    if (causalEdges.length <= 3) return new Set(causalEdges.map(e => e.id)) // all labelled when 3 or fewer

    if (isResultsMode && report) {
      // Post-analysis: use composite importance (same formula as stroke width)
      const factorSensitivity = (report as any).enrichment?.sensitivity_analysis?.factors ||
                                (report as any).factor_sensitivity || []
      const scores = causalEdges.map(e => {
        const ed = e.data as EdgeData | undefined
        const src = factorSensitivity.find((f: any) =>
          (f.factor_id || f.factorId || f.node_id || f.nodeId) === e.source)
        const goalSens = src ? Math.abs(src.elasticity ?? src.sensitivity_score ?? src.importance_score ?? 0) : 1.0
        return {
          id: e.id,
          score: calculateEdgeImportance(ed?.beliefExists, ed?.weight ?? 0.5, goalSens),
        }
      })
      scores.sort((a, b) => b.score - a.score)
      return new Set(scores.slice(0, 3).map(s => s.id))
    }

    // Pre-analysis: rank by |strength.mean|.
    //
    // ⛔ Provenance gate on the ORDER. `computeSignedMean` falls back to
    // `weight`, which the edge defaults always supply, so on an unset graph
    // every edge scored 0.3/0.5 and the three edges granted a PERMANENT
    // on-canvas label were chosen by iteration order and presented as the
    // strongest three. An edge whose strength nobody set is not a candidate:
    // unset sorts last and is then dropped, so when fewer than three edges
    // have a sourced strength fewer than three labels are pinned — rather
    // than filling the quota from edges we know nothing about.
    const strengths: Array<{ id: string; magnitude: EdgeValueDisplay }> = []
    for (const e of causalEdges) {
      const display = resolveEdgeSignedStrengthDisplay(e.data as Record<string, unknown> | undefined)
      if (!display.show) continue
      strengths.push({ id: e.id, magnitude: { ...display, value: Math.abs(display.value) } })
    }
    strengths.sort((a, b) => compareEdgeValueDisplays(a.magnitude, b.magnitude, 'desc'))
    return new Set(strengths.slice(0, 3).map(s => s.id))
  }, [getEdges, getNode, isResultsMode, report])

  const isTopStrengthEdge = !isStructuralEdge && topStrengthIds.has(id)

  // E3 part 2 (C2): subscribe to node geometry so a label re-dodges when ANY
  // node card moves onto it (this edge's own props only change when its own
  // endpoints move). Perf posture: only top-strength edges (max 3) compute a
  // signature — every other edge returns '' and never re-renders from node
  // movement. While a node is DRAGGING its position is quantised to a 10px
  // grid, so a drag triggers a recompute roughly once per 10px of travel
  // instead of every frame; 10px is well inside the 26px dodge STEP, so the
  // quantisation is never visible mid-drag.
  //
  // C2 review fix 2: settled positions (and dimensions) feed through EXACTLY.
  // Quantising at rest meant the final sub-bucket movement of a drag could
  // leave a permanently stale offset — up to ~10px of clip or spurious dodge
  // that no later event would ever fix. Settling flips `dragging` off, which
  // changes the signature from the quantised to the exact form and costs
  // exactly one extra recompute per drag; non-drag position/dimension changes
  // are discrete one-off events (layout runs, measurement), so exact values
  // add no meaningful recompute traffic there either.
  const nodeRectsSignature = useStore((s) => {
    if (!isTopStrengthEdge) return ''
    let sig = ''
    for (const n of s.nodes) {
      // C2 review fix 1: the app hides nodes via the lens (BaseNode returns
      // null for ids in lens._hiddenNodeIds) — those cards are invisible and
      // must not be obstacles. React Flow's `hidden` flag is never set by
      // this app; the filter stays as belt-and-braces.
      if (n.hidden || lensHiddenNodeIds.has(n.id)) continue
      const w = n.measured?.width ?? n.width ?? 200
      const h = n.measured?.height ?? n.height ?? 80
      const x = n.dragging ? Math.round(n.position.x / 10) * 10 : n.position.x
      const y = n.dragging ? Math.round(n.position.y / 10) * 10 : n.position.y
      sig += `${n.id}:${x},${y},${w},${h};`
    }
    return sig
  })

  // E3: label collision avoidance. Every persistent-label edge feeds the SAME
  // anchor basis into the shared deterministic resolver, so all edges agree
  // on the global assignment and each applies its own offset. Only persistent
  // (top-strength) labels participate — hover/selection labels are transient.
  // E3 part 2: node cards are fixed obstacles in the same pass — a label must
  // not sit under ANY card, because React Flow paints the node layer above
  // the edge-label renderer and the overlapped label is clipped invisibly.
  //
  // C2 review fixes 3 + 4 (see resolvePersistentLabelPlacements): the anchor
  // basis is the midpoint of the HANDLE points (bottom-centre → top-centre),
  // matching where the bezier label actually renders — the node-centre
  // midpoint diverged by (sourceHeight − targetHeight)/4 — and the Task 9c
  // proximity nudge feeds the resolver rather than being summed afterwards,
  // so it can never push a cleared label back under a card. The returned
  // offset is the TOTAL displacement (nudge + collision stack).
  const collisionOffset = useMemo(() => {
    if (!isTopStrengthEdge) return { dx: 0, dy: 0 }
    const rectOf = (n: {
      position: { x: number; y: number }
      measured?: { width?: number; height?: number }
      width?: number
      height?: number
    }) => ({
      x: n.position.x,
      y: n.position.y,
      width: n.measured?.width ?? n.width ?? 200,
      height: n.measured?.height ?? n.height ?? 80,
    })
    const placementEdges: PlacementEdge[] = []
    for (const e of getEdges()) {
      if (!topStrengthIds.has(e.id)) continue
      // C2 review fix 1: a lens-hidden edge renders no label (the component
      // returns null below), so it must not occupy a label slot either.
      if (lensHiddenEdgeIds.has(e.id)) continue
      const sn = getNode(e.source)
      const tn = getNode(e.target)
      if (!sn || !tn) continue
      placementEdges.push({ id: e.id, sourceRect: rectOf(sn), targetRect: rectOf(tn) })
    }
    const nodeRects = getNodes()
      // C2 review fix 1: lens-hidden cards are invisible — not obstacles.
      // RF `hidden` kept as belt-and-braces (never set by this app).
      .filter((n) => !n.hidden && !lensHiddenNodeIds.has(n.id))
      .map(rectOf)
    return resolvePersistentLabelPlacements(placementEdges, nodeRects).get(id) ?? { dx: 0, dy: 0 }
    // nodeRectsSignature is the recompute trigger for node movement (the
    // whole placement is derived from node geometry, so it covers this
    // edge's own endpoints too).
  }, [isTopStrengthEdge, topStrengthIds, getEdges, getNode, getNodes, id, lensHiddenNodeIds, lensHiddenEdgeIds, nodeRectsSignature])

  // Total label displacement (Task 9c proximity nudge + collision stack),
  // relative to the rendered label anchor (labelX/labelY).
  const labelOffsetX = collisionOffset.dx
  const labelOffsetY = collisionOffset.dy

  // C1 + E2: label-visibility policy (see edgeLabelVisibility.ts). Top-strength
  // labels surface in the default (standard) view once results exist; the
  // interaction-driven triggers stay Detailed/Model-only.
  const showLabel = shouldShowEdgeLabel({
    viewMode,
    isResultsMode,
    isStructuralEdge,
    isTopStrengthEdge,
    selected: Boolean(selected),
    isHovered,
    hasSuggestion,
    isFirstEdge,
    showEdgeHint: Boolean(showEdgeHint),
  })

  // ── Stroke + dash, from the one authority ────────────────────────────────
  //
  // NOTE WHAT IS NOT IN THIS STATE: `isResultsMode`. An edge's resting colour
  // and dash are a function of the EDGE. Interaction states (hover, selection,
  // highlight, lens) are transient and user-driven and stay; analysis
  // completion is neither, and used to restyle a graph nobody had edited.
  const presentationState: EdgePresentationState = useMemo(() => ({
    isStructural: isStructuralEdge,
    lensMode,
    causalParams: causalEdgeParams,
    evidenceClass: evidenceEdgeClass,
    contested,
    isHighlighted: isHighlightedEdge,
    polarityStroke: directionStroke,
    existenceDash: existenceCertaintyDash,
    visualPropsDash: visualProps.strokeDasharray,
  }), [
    isStructuralEdge, lensMode, causalEdgeParams, evidenceEdgeClass, contested,
    isHighlightedEdge, directionStroke, existenceCertaintyDash, visualProps.strokeDasharray,
  ])
  const edgeStroke = useMemo(() => resolveEdgeStroke(presentationState), [presentationState])
  const edgeDash = useMemo(() => resolveEdgeDash(presentationState), [presentationState])

  // Causal lens: hide structural edges entirely
  if (isLensHidden) return null

  return (
    <>
      {/* Wrapper captures hover for the entire edge hit area. Hover handlers live
          here so they fire regardless of whether the pointer is over the custom
          hitbox path or BaseEdge's interaction path (which renders on top in SVG
          paint order). Both paths bubble mouseenter/mouseleave to this <g>. */}
      <g
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        data-analysis-fragile={isAnalysisFragileEdge && !isStructuralEdge ? 'true' : undefined}
        data-assistant-focused={isAssistantFocused ? 'true' : undefined}
      >
      {/* Invisible hitbox — wider than visual stroke; carries test-id and
          structural tooltip. pointer-events:stroke so the <g> receives events
          from this area even when no visual fill is present. */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={EDGE_HIT_AREA_WIDTH}
        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
        {...(isMissingConfidenceEdge ? { 'data-testid': 'overlay-missing-confidence' } : {})}
      >
        {isStructuralEdge && structuralTooltip && <title>{structuralTooltip}</title>}
      </path>
      {isAssistantFocused && (
        <path
          d={edgePath}
          fill="none"
          stroke="var(--semantic-info)"
          strokeWidth={8}
          opacity={0.32}
          pointerEvents="none"
          vectorEffect="non-scaling-stroke"
          data-testid={`assistant-focus-edge-halo-${edgeIdKey}`}
        />
      )}
      <BaseEdge
        id={id}
        path={edgePath}
        interactionWidth={EDGE_HIT_AREA_WIDTH}
        style={{
          // Graph Interaction P1: Highlighted edges get thicker stroke
          strokeWidth: (() => {
            const base = (() => {
            // Structural edges: fixed 1px regardless of lens / hover / highlight
            if (isStructuralEdge) return 1
            // Causal lens: thickness encodes the PROVENANCE-SET strength
            // magnitude (ROADMAP 2.954). An unset strength draws at the floor
            // width — the same refusal the non-lens stroke (:286) makes — so
            // thickness never reports the `weight` default as a measurement.
            if (lensMode === 'causal' && causalEdgeParams) {
              return causalEdgeParams.magnitude !== null
                ? weightMagnitudeToStrokeWidth(causalEdgeParams.magnitude)
                : UNSET_EDGE_STROKE_WIDTH
            }
            // Evidence lens: uniform thickness (not importance-weighted)
            if (lensMode === 'evidence') return 1.5
            // Robustness lens: thicken fragile, thin non-fragile
            if (lensMode === 'robustness') {
              return isLensFragile ? 3 : 1
            }
            // Graph Lens: sensitivity mode adjusts stroke width by quartile
            if (lensMode === 'sensitivity' && lensSensWeight !== null && lensQ25 !== null && lensQ75 !== null) {
              if (lensSensWeight >= lensQ75) return 3
              if (lensSensWeight <= lensQ25) return 1
              return 1.5
            }
            // Graph Lens: fragile mode thickens fragile edges
            if (isLensFragile) return 3
            // 6B: the SELECTED connection is the thickest interaction state, so
            // it stays unmistakable even while hovering a neighbouring edge.
            // Transient interaction feedback only — resting weight is untouched,
            // so this does not encode influence or strength as thickness.
            if (selected) return Math.max(edgeStrokeWidth, 4)
            // Hover thickening: 2px to 3px on hover
            if (isHovered) return Math.max(edgeStrokeWidth, 3)
            return isHighlightedEdge ? Math.max(edgeStrokeWidth, 3) : edgeStrokeWidth
            })()
            // Analysis-graph projection: a viewed flip-risk edge thickens so the
            // warning halo below reads clearly. Composes with the direction
            // stroke (colour is never replaced). Structural edges are never
            // fragile-badged, so they never bump.
            return isAnalysisFragileEdge && !isStructuralEdge ? Math.max(base, 4) : base
          })(),
          // ⭐ ONE AUTHORITY, ONE STATED PRECEDENCE (17 Aug 2026).
          //
          // Both channels used to be ordered early-return chains written inline
          // here. Nobody had ever chosen that order — it was the sequence the
          // branches were added in, and it silently made polarity unreachable on
          // every contested edge. `edgePresentation` owns the decision now:
          // `EDGE_STROKE_RULES` / `EDGE_DASH_RULES` are ordered arrays, the
          // resolvers return the NAMED rule that fired, and both orderings are
          // asserted against those arrays in `edgePresentation.spec.ts`. Adding
          // a branch here again — rather than a rule there — is the regression
          // this refactor exists to make impossible to do quietly.
          strokeDasharray: edgeDash.value,
          stroke: edgeStroke.value,
          // Opacity is a lens-only channel now. exists_probability is a SINGLE
          // encoding — the dash (existenceCertaintyDash above), which stays
          // legible at every zoom level and doesn't fight the analysis halo.
          // The former Task 9b belief→opacity coupling was dropped (P2.9): two
          // channels for one variable is exactly the encoding overload the
          // audit flags, and a dimmed edge collided with lens dimming and the
          // projection halo. Opacity therefore returns to a constant except for
          // the lens's own dim/sensitivity states. Structural edges: full opacity.
          // 6A adds ONE more opacity producer: the selection focus dim. It is an
          // attention channel, not a data encoding, so it does not reintroduce
          // the encoding overload the note above warns about — it applies only
          // while something is selected and clears on deselect. Structural edges
          // dim too (they are part of "unrelated"), which is why the selection
          // dim is checked BEFORE the structural early-out; lens dimming still
          // wins when both apply, so the lens keeps its stronger statement.
          opacity: isLensDimmed ? 0.2
            : isSelectionDimmed ? 0.25
            : isStructuralEdge ? undefined
            : (lensMode === 'sensitivity' && lensSensWeight !== null && lensQ25 !== null && lensSensWeight <= lensQ25) ? 0.4
            : undefined,
          // Graph Lens: subtle glow for high-sensitivity edges.
          // Analysis-graph projection: a viewed flip-risk edge gets a WARNING
          // halo (drop-shadow, a separate CSS channel) so the marker composes
          // with the green/red direction stroke instead of replacing it — the
          // DS "colour = state" rule, without colliding with polarity colour.
          filter: (() => {
            // Two independent drop-shadow signals can BOTH apply to one edge: a
            // top-sensitivity lens edge (info glow) that is ALSO a viewed
            // flip-risk (warning halo). CSS `filter` takes a space-separated
            // list, so compose them rather than letting the first branch win and
            // silently drop the flip-risk halo. Order preserved: sensitivity
            // glow first, fragile halo second.
            const shadows: string[] = []
            if (lensMode === 'sensitivity' && lensSensWeight !== null && lensQ75 !== null && lensSensWeight >= lensQ75)
              shadows.push('drop-shadow(0 0 2px var(--semantic-info, #3b82f6))')
            if (isAnalysisFragileEdge && !isStructuralEdge)
              // R6: the fragility halo moves off the warning hue with the
              // fragility chips it accompanies — under the DEFAULT lens, orange
              // on an edge means contested. (The evidence LENS keeps its own
              // orange for 'assumed': a lens is an explicit alternative
              // encoding with its own key, not the default vocabulary.)
              shadows.push('drop-shadow(0 0 4px var(--semantic-info, #3b82f6))')
            // 6B: hover / selection emphasis for the WHOLE connection.
            // Deliberately a drop-shadow rather than a stroke colour: the stroke
            // already carries direction polarity (green/red) and the resolution
            // below lets directionStroke win, so a hover colour would either be
            // invisible on signed edges or would overwrite polarity — which is a
            // semantic change this lane must not make. A glow is a separate CSS
            // channel, so it composes with polarity exactly like the fragile
            // halo above. Not applied to a selection-dimmed edge.
            if (!isSelectionDimmed) {
              if (selected) shadows.push('drop-shadow(0 0 5px var(--semantic-info, #3b82f6))')
              else if (isHovered) shadows.push('drop-shadow(0 0 3px var(--semantic-info, #3b82f6))')
            }
            return shadows.length > 0 ? shadows.join(' ') : undefined
          })(),
          // Performance: use will-change for frequent updates
          willChange: selected || isHighlightedEdge || isAnalysisFragileEdge ? 'stroke, stroke-width, stroke-dasharray, filter' : undefined,
          // D.1: Smooth transitions for live styling; respect prefers-reduced-motion (§7.4)
          transition: prefersReducedMotion
            ? 'none'
            : 'stroke 200ms ease, stroke-width 200ms ease, stroke-dasharray 300ms ease-out, opacity 300ms ease, filter 200ms ease',
        }}
      />
      </g>

      {/* Causal lens: numeric parameter label (strength.mean + exists_probability).
          Structural edges have no causal parameters to show. */}
      {lensMode === 'causal' && causalEdgeParams && !isStructuralEdge && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
              padding: '2px 6px',
              borderRadius: '4px',
              fontWeight: 500,
              fontFamily: 'ui-monospace, monospace',
              whiteSpace: 'nowrap',
            }}
            // 11px, unchanged — declared by the canvas token rather than inline
            // so it can see `--canvas-label-scale`. An inline fontSize cannot,
            // and rendered this label at 5.5px at the 0.50 auto-fit floor.
            // The inline fontFamily still wins over the token's `font-sans`.
            className={`${typography.nodeLabel} bg-panel text-text-body border border-panel-border shadow-sm`}
            data-testid="causal-edge-label"
          >
            {/* ROADMAP 2.954 — the number is a strength claim, the sign a
                direction claim, and each renders only from its own resolved
                channel. Unset strength: the numeric channel's ratified "not
                set" (#629), never the `+0.50` default this label used to
                print. Unstated direction: bare magnitude, no sign character.
                '−' is U+2212, matching `formatNumericLabel`'s sign. */}
            {causalEdgeParams.magnitude !== null
              ? `${causalEdgeParams.direction === 'positive' ? '+' : causalEdgeParams.direction === 'negative' ? '−' : ''}${causalEdgeParams.magnitude.toFixed(2)}`
              : 'not set'}
            {causalEdgeParams.existsProb !== null && (
              <span style={{ color: 'var(--text-light, #6E6B6B)' }}>
                {' '}({Math.round(causalEdgeParams.existsProb * 100)}%)
              </span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Evidence lens: provenance label.
          Structural edges aren't evidence-classified. */}
      {lensMode === 'evidence' && evidenceEdgeClass && !isStructuralEdge && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
              padding: '2px 6px',
              borderRadius: '4px',
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
            // 10px, unchanged — see the causal label above. Rendered at 5.0px.
            className={`${typography.edgeLabel} bg-panel text-text-body border border-panel-border shadow-sm`}
            data-testid="evidence-edge-label"
          >
            {evidenceEdgeClass === 'evidence' ? 'Evidence-backed' : evidenceEdgeClass === 'assumed' ? 'Assumed' : 'Unknown basis'}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Polarity glyph (+/−): rendered whenever a non-structural edge has a
          direction — in Standard view AND pre-run, not only Expert+results.
          directionStroke.ts's docblock is explicit that the glyph, not the
          green/rose colour, is what carries polarity for a red-green dichromat
          (the palette separates WORSE than green/red under deuteranopia), so
          colour-alone polarity pre-run/Standard was a legibility gap. Positioned
          at the target end (targetX/Y − 18), away from the mid-path label, so it
          collision-avoids labels exactly as before. Causal lens shows its own
          numeric parameter label instead. Structural edges have no semantic
          direction — excluded defensively. */}
      {/* ⭐ ROADMAP 2.580 member 2: gated on `statedDirection`, not on the raw
          `direction` field — see the derivation at the top of this component.
          An unstated / declined / unrecognised direction renders NOTHING here;
          the graph says less rather than something it was never told. */}
      {statedDirection && lensMode !== 'causal' && !isStructuralEdge && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${targetX - 18}px,${targetY - 18}px)`,
              pointerEvents: 'none',
              // ⚠ NOT counter-scaled, and DELIBERATELY so — the one site #771
              // left alone, pinned in `canvasTextCounterScale.census.spec.ts`'s
              // KNOWN_FIXED so it is a visible gap rather than an invisible one.
              //
              // This glyph renders at 8.0px at the 0.50 auto-fit floor, and it
              // is on the DEFAULT lens, so it is the worst-placed of the five
              // inline sizes in this file. It is still not this lane's to fix:
              // 16px is five px above the top of the DS v5 §2.3 canvas scale
              // (13/11/10) and four above §2.4's 10-12px canvas band, so no
              // canvas token declares it. `nodeTitle` would shrink the glyph
              // 16 -> 13 at zoom 1 — a silent resize — and minting a fourth
              // canvas size is a design-system change, not a legibility fix.
              // ⭐ NEEDS A SIZE RULING. Once ruled, route it through a token.
              fontSize: '16px',
              fontWeight: 700,
              color: statedDirection === 'positive' ? '#059669' : '#dc2626',
              // Chip surface = the panel token, matching the sibling edge-label
              // chips (bg-panel) so it no longer glares on a dark canvas. Inline
              // CSS-var idiom mirrors the other token refs in this file
              // (e.g. the leader line's var(--border-default, #EEE6D8)); the
              // hex is only a var() fallback, not a live literal.
              backgroundColor: 'var(--bg-panel, #FEFEFE)',
              padding: '0 3px',
              borderRadius: '2px',
            }}
            aria-label={`Effect direction: ${statedDirection}`}
          >
            {statedDirection === 'positive' ? '+' : '−'}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Fragile edge warning badge. Detailed/Model view: every fragile edge.
          E4 (graph-visuals): the default (standard) view shows the SINGLE top
          fragile relationship so the key flip risk is on the map by default,
          uncluttered. Structural edges are not analysed — never badged. */}
      {(viewMode !== 'standard' ? isFragileEdge : isTopFragileEdge) && !isStructuralEdge && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX + 30}px,${labelY}px)`,
              pointerEvents: 'all',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
            className="bg-panel text-text-body border border-info/30 shadow-sm"
            title={fragileEdgeSwitchProb !== null
              ? `Sensitive assumption: ${Math.round(fragileEdgeSwitchProb * 100)}% chance the result flips if this relationship changes`
              : 'Sensitive assumption: outcome may flip if this relationship changes'}
          >
            <AlertTriangle size={12} />
            {/* 10px, unchanged — via the canvas token so it sees the
                counter-scale; inline it rendered at 5.0px. */}
            <span className={typography.edgeLabel} style={{ fontWeight: 600 }}>
              Sensitive{fragileEdgeSwitchProb !== null ? ` · ${Math.round(fragileEdgeSwitchProb * 100)}%` : ''}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Graph Lens: Alternative winner label on fragile edges (hover/selection only) */}
      {/* Correction #2: component-local state, no store update, no rerender of other edges */}
      {/* Structural edges are not part of the fragility lens. */}
      {isLensFragile && (isHovered || selected) && !isStructuralEdge && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY + 20}px)`,
              pointerEvents: 'none',
              padding: '2px 8px',
              borderRadius: '4px',
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
            // 11px, unchanged — see the causal label above. Rendered at 5.5px.
            className={`${typography.nodeLabel} bg-panel text-text-body border border-info/30 shadow-sm`}
          >
            {lensFragileLabel}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* E3: hairline leader from the edge midpoint to a displaced label so a
          dodged label still reads as belonging to its edge. SVG sibling of the
          edge path (EdgeLabelRenderer portals to HTML, so the line lives here). */}
      {showLabel && (Math.abs(labelOffsetX) + Math.abs(labelOffsetY)) > 12 && (
        <line
          x1={labelX}
          y1={labelY}
          x2={labelX + labelOffsetX}
          y2={labelY + labelOffsetY}
          stroke="var(--border-default, #EEE6D8)"
          strokeWidth={1}
          data-testid="edge-label-leader"
        />
      )}

      {/* C1: Edge label - only show when selected, hovered, or has pending suggestions */}
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX + labelOffsetX}px,${labelY + labelOffsetY}px)`,
              pointerEvents: 'all',
              padding: '3px 8px',
              borderRadius: '4px',
              maxWidth: '160px',
              overflow: 'hidden',
              display: 'flex',
              // One line, always. The resolver clears a fixed 160x22 box, so
              // the row may never wrap to a second line; the ellipsis that
              // keeps the TEXT inside that box lives on the span below.
              flexWrap: 'nowrap',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              // C1: Smooth fade-in transition
              opacity: 1,
              transition: 'opacity 150ms ease-in-out',
            }}
            className={`nodrag nopan border shadow-panel ${typography.edgeLabel} ${
              isDark
                ? 'bg-gray-900 text-gray-100 border-gray-600'
                : 'bg-panel/95 text-text-header border-panel-border'
            } ${hasSuggestion ? 'ring-2 ring-info ring-offset-1' : ''} ${isFirstEdge && showEdgeHint ? 'edge-hint-active' : ''}`}
            role="note"
            data-testid="edge-influence-label"
            aria-label={ariaLabel}
            title={(() => {
              const baseTooltip = provenance
                ? `${edgeDescription.tooltip} • Source: ${provenance}`
                : edgeDescription.tooltip
              return `${baseTooltip}\n\nDouble-click to inspect`
            })()}
            onDoubleClick={handleLabelDoubleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {(() => {
              const desc = edgeDescription
              return (
                <>
                  {/* Weight suggestion indicator */}
                  {hasSuggestion && (
                    <Lightbulb
                      className="w-3 h-3 text-info flex-shrink-0"
                      aria-label="Weight suggestion available"
                      data-testid="edge-suggestion-indicator"
                    />
                  )}
                  {/* The single-line ellipsis lives HERE, not on the flex
                      container above. text-overflow only acts on a box that
                      lays out inline content; the container's children are
                      flex items, so there it computed to a hard clip and cut
                      labels mid-word ("Moderate drag (unc"). minWidth 0
                      releases this flex item's automatic minimum so it may
                      shrink below its own text and ellipsise, instead of
                      pushing the row past the 160px cap the dodge resolver
                      assumes. The full string stays recoverable: the
                      container's aria-label and title both carry it.
                      CSS ellipsis is safe here ONLY because
                      EdgeLabelRenderer portals this outside
                      .react-flow__node — inside a node card the
                      no-clipped-text visual gate requires shortening in JS. */}
                  <span
                    data-testid="edge-influence-label-text"
                    style={{
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontWeight: 500,
                      fontFamily: labelMode === 'numeric' ? 'ui-monospace, monospace' : undefined
                    }}
                  >
                    {desc.label}
                  </span>
                  {provenance && (
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        flexShrink: 0,
                      }}
                      className={
                        // R6: orange on an edge means CONTESTED and nothing
                        // else. This dot used to paint `user` provenance in the
                        // warning hue — the semantic inverse, since a
                        // user-stated value is the most trustworthy kind. It is
                        // now the success hue, matching every other
                        // "you set this" signal on the canvas.
                        provenance === 'template' ? 'bg-info-500' :
                        provenance === 'user' ? 'bg-success' :
                        'bg-gray-400'
                      }
                      title={`Provenance: ${provenance}`}
                      aria-label={`Provenance: ${provenance}`}
                    />
                  )}
                </>
              )
            })()}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Context menu: Assumption flag badge on edge.
          Structural edges aren't user assumptions — exclude defensively. */}
      {data?.flagged_as_assumption && !isStructuralEdge && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX + 20}px,${labelY - 14}px)`,
              pointerEvents: 'none',
            }}
            title="Flagged as assumption"
            data-testid="edge-assumption-badge"
          >
            {/* R6: not orange — this is a user annotation, not a contested
                verdict. Orange on an edge is reserved for contested. */}
            <Flag size={12} className="text-text-light" />
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Edge hover popover: causal edges only — structural edges use a
          native browser <title> tooltip on the hitbox path. */}
      {showHoverPopover && !selected && !isStructuralEdge && (() => {
        const popoverStyle: React.CSSProperties = {
          position: 'absolute',
          transform: `translate(-50%, calc(-100% - 8px)) translate(${labelX}px,${labelY}px)`,
          pointerEvents: 'none',
          zIndex: 9999,
          minWidth: '140px',
          maxWidth: '220px',
        }
        // PROVENANCE-GATED. `weight` (:202) and `beliefExists` (:250) both fall
        // through to UI defaults, and the old `(beliefExists ?? 0.8)` here was a
        // SECOND literal copy of the fabricated constant — removing the default
        // from the schema would not have silenced this line.
        //
        // The direction is gated with the strength deliberately: `direction`
        // defaults to 'positive', so "Positive" is itself a fabrication on an
        // edge nobody characterised.
        const strengthDisplay = resolveEdgeSignedStrengthDisplay(
          edgeData as Record<string, unknown> | undefined,
        )
        const confidenceDisplay = resolveEdgeValueDisplay(
          edgeData as Record<string, unknown> | undefined,
          'beliefExists',
        )
        const signedVal = strengthDisplay.show ? strengthDisplay.value : null
        const strengthPct = signedVal !== null ? Math.round(Math.abs(signedVal) * 100) : null
        const confidencePct = confidenceDisplay.show
          ? Math.round(confidenceDisplay.value * 100)
          : null
        const dirLabel = signedVal !== null ? (signedVal >= 0 ? 'Positive' : 'Negative') : null
        const causalPopoverStyle: React.CSSProperties = {
          ...popoverStyle,
          pointerEvents: 'all',
        }
        return (
          <EdgeLabelRenderer>
            <div
              data-testid="edge-hover-popover"
              role="tooltip"
              style={causalPopoverStyle}
              className="bg-panel border border-panel-border rounded-lg shadow-panel px-3 py-2.5 space-y-1.5 nodrag nopan nowheel"
              onMouseEnter={handlePopoverEnter}
              onMouseLeave={handlePopoverLeave}
            >
              {/* Direction — only when the strength that gives it its sign was set */}
              {dirLabel !== null && (
                <div className={`${typography.edgeLabel} font-bold text-text-body`}>
                  {dirLabel}
                </div>
              )}
              {/* Confidence */}
              {confidencePct !== null && (
                <div className={`${typography.edgeLabel} text-text-light`}>
                  {confidencePct}% confident
                </div>
              )}
              {/* Strength bar */}
              {signedVal !== null && strengthPct !== null && (
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-1 bg-panel-border rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${signedVal >= 0 ? 'bg-success' : 'bg-danger'}`}
                      style={{ width: `${Math.max(4, strengthPct)}%` }}
                    />
                  </div>
                  <span className={`${typography.edgeLabel} text-text-light w-7 text-right shrink-0`}>{strengthPct}%</span>
                </div>
              )}
              {/* Nothing characterised yet — say that, rather than a number */}
              {dirLabel === null && confidencePct === null && (
                <div
                  className={`${typography.edgeLabel} text-text-light`}
                  data-testid="edge-hover-popover-unset"
                >
                  Strength and likelihood not set
                </div>
              )}
              {/* Fragile warning with switch probability */}
              {isFragileEdge && (
                <div className={`${typography.edgeLabel} text-info flex items-center gap-1`}>
                  <AlertTriangle size={10} />
                  Sensitive{fragileEdgeSwitchProb !== null ? `: ${Math.round(fragileEdgeSwitchProb * 100)}% flip risk` : ''}
                </div>
              )}
              {/* Coaching chips */}
              <div className="flex flex-col gap-1 mt-2 pt-1.5 border-t border-panel-border">
                {/*
                  * LLM-FACING. These messages are dispatched to CEE verbatim via
                  * `useGuidanceStore._dispatchAction`, so a fabricated number here
                  * is asserted to the model as the user's own statement about
                  * their model — worse than one on screen, because the model
                  * cannot see the canvas to catch it.
                  *
                  * When nothing was set the chips still appear (the user still
                  * wants to act) but claim nothing: no direction adjective, no
                  * percentage.
                  */}
                <NodeChip
                  chipId="edge_evidence_supports"
                  actionType={null}
                  label="What evidence supports this?"
                  message={
                    dirLabel !== null
                      ? `What evidence supports the ${dirLabel.toLowerCase()} relationship between ${srcTitle} and ${tgtTitle}?`
                      : `What evidence supports the relationship between ${srcTitle} and ${tgtTitle}?`
                  }
                />
                <NodeChip
                  chipId="edge_adjust_strength"
                  actionType="adjust_edge_strength"
                  label="Adjust strength"
                  message={
                    strengthPct !== null
                      ? `I want to adjust the strength of the relationship between ${srcTitle} and ${tgtTitle}. Current strength is ${strengthPct}%.`
                      : `I want to set the strength of the relationship between ${srcTitle} and ${tgtTitle}. It has not been set yet.`
                  }
                />
              </div>
            </div>
          </EdgeLabelRenderer>
        )
      })()}

    </>
  )
})

StyledEdge.displayName = 'StyledEdge'
