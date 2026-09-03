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
import {
  shouldShowEdgeLabel,
  selectPersistentStrengthIds,
  type RankedCausalEdge,
} from './edgeLabelVisibility'
import { computeDirectionStroke } from './directionStroke'
import {
  readContestedState,
  resolveEdgeStroke,
  resolveEdgeDash,
  type EdgePresentationState,
} from './edgePresentation'
import {
  resolvePersistentLabelPlacements,
  LABEL_HALF_WIDTH,
  type PlacementEdge,
  type LabelRowCount,
  LABEL_ROW_GAP_PX,
} from './edgeLabelCollision'
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
import { getEdgeLabel, labelCarriesDirection } from '../domain/edgeLabels'
import { useEdgeLabelMode } from '../store/edgeLabelMode'
import { useCanvasStore } from '../store'
import { isGraphLensEnabled } from '../../flags'
import { isEdgeFragile as isEdgeFragileFn, getFragileEdgeSwitchProbability, isTopFragileEdge as isTopFragileEdgeFn, type FragileEdgeCandidate } from '../utils/fragileEdgeMatch'
import { existenceCertaintyToLineStyle, calculateEdgeImportance, weightMagnitudeToStrokeWidth, UNSET_EDGE_STROKE_WIDTH } from '../utils/graphDisplayCalculations'
import { typography } from '../../styles/typography'
import { useEdgeEditHint } from '../hooks/useFirstTimeHints'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { useAssistantFocusStore } from '../stores/assistantFocusStore'
import { openEdgeStrengthEditor } from '../utils/openEdgeStrengthEditor'
import { resolvePolarityGlyphOffset, GLYPH_ANCHOR_RADIUS, type GlyphSibling } from '../utils/edgeGlyphPlacement'

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

/**
 * The robustness fragile-edge list, read through one typed accessor.
 * `ReportV1` does not declare `robustness`, so every inline `report.robustness`
 * read costs a diagnostic; this narrows once, in one place, and the callers
 * stay clean.
 */
function fragileEdgesOf(report: unknown): FragileEdgeCandidate[] {
  const robustness = (report as { robustness?: { fragile_edges?: unknown } } | null | undefined)
    ?.robustness
  return (robustness?.fragile_edges as FragileEdgeCandidate[] | undefined) ?? []
}

/**
 * Rank-order two causal edges for the persistent-label set by the strength a
 * label is ENTITLED to speak about: a sourced strength outranks an unset one,
 * larger magnitude outranks smaller, and the caller breaks the remaining ties
 * by id. Returns a comparator result, so `|| a.id.localeCompare(b.id)` reads
 * naturally at every call site.
 *
 * ⛔ ELIGIBILITY IS NOT DECIDED HERE. This orders; it never drops. The
 * provenance gate that DROPS unsourced edges lives on the pre-analysis branch
 * alone and is unchanged — a "3 or fewer" graph still labels edges whose
 * strength nobody set, exactly as before.
 */
function compareEdgesByLabelStrength(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined,
): number {
  const da = resolveEdgeSignedStrengthDisplay(a)
  const db = resolveEdgeSignedStrengthDisplay(b)
  if (da.show !== db.show) return da.show ? -1 : 1
  if (!da.show || !db.show) return 0
  return compareEdgeValueDisplays(
    { ...da, value: Math.abs(da.value) },
    { ...db, value: Math.abs(db.value) },
    'desc',
  )
}

/** Narrow a ranked edge to what the per-target cap needs. */
const toRanked = (e: { id: string; target: string }): RankedCausalEdge => ({
  id: e.id,
  target: e.target,
})

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

  /**
   * The fragility sentence — ONE owner, two readers (the row's own `title`
   * and the chip container's composed one), so the two cannot drift apart.
   * Presence-branched on a MEASURED switch probability: absent means NOT
   * COMPUTED, and `marginal_switch_probability` is a different Monte Carlo,
   * never a fallback (pinned by StyledEdge.fragilePresence.spec).
   */
  const fragileSentence = fragileEdgeSwitchProb !== null
    ? `Sensitive assumption: ${Math.round(fragileEdgeSwitchProb * 100)}% chance the result flips if this relationship changes`
    : 'Sensitive assumption: outcome may flip if this relationship changes'

  /**
   * Every edge whose chip will carry a fragility ROW, graph-wide.
   *
   * ⚠ THIS IS NEW STATE, AND IT EXISTS FOR ONE REASON: the fragility badge
   * used to render as a free-floating sibling at a hard-coded `labelX + 30`,
   * outside `resolvePersistentLabelPlacements` entirely. That is why the
   * founder saw "Sensitive · 49%" with no visible referent — and why
   * DESIGN_SYSTEM.md's claim that "stacking is spaced by
   * edgeLabelCollision.ts" was FALSE for this one signal. The resolver is a
   * GLOBAL pass, so it needs every participant's id, not just this edge's.
   *
   * The membership rule is the badge's own, unchanged: every fragile edge in
   * Detailed/Model, the single top fragile edge in the default view.
   */
  const fragileLabelIds = useMemo((): Set<string> => {
    if (!isResultsMode) return new Set()
    const fragileEdges = fragileEdgesOf(report)
    if (fragileEdges.length === 0) return new Set()
    const out = new Set<string>()
    for (const e of getEdges()) {
      // Exclude structural edges, so one cannot reserve a placement slot for a
      // chip it will never render.
      //
      // ⚠ THIS IS NODE-KIND-ONLY, AND IT IS **NOT** THE RENDER GATE'S RULE.
      // An earlier version of this comment claimed it was "the same exclusion,
      // kept in step"; that was false. `isStructuralEdge` (above) consults
      // `data.edge_type` FIRST: `'structural'` forces structural whatever the
      // node kinds say, and ANY other non-empty value disables kind inference
      // entirely. So the two can disagree in both directions:
      //
      //   · `edge_type: 'directed'` on a decision->option pair — and CEE emits
      //     `"directed"` on every edge in the golden-path fixture — is NOT
      //     structural to the render gate, so it may badge, while this filter
      //     drops it: a chip that renders without a reserved slot.
      //   · `edge_type: 'structural'` on a pair whose kinds do not match IS
      //     structural to the render gate, while this filter keeps it: a slot
      //     reserved for a chip that never renders.
      //
      // Both are placement-quality residuals, not correctness defects: the
      // render gate alone decides what is drawn. Left as-is deliberately —
      // sharing one predicate is a real fix and a different change.
      //
      // ⛔ AND THE PART NOT TO CLOSE BY ASSERTION: whether ISL's
      // `fragile_edges` can contain a structural edge at all is UNDERIVED. If
      // it cannot, both residuals are unreachable and this filter is redundant
      // rather than wrong. Derive it before acting on either branch above.
      const sn = getNode(e.source)
      const tn = getNode(e.target)
      const sk = sn?.type || (sn?.data as Record<string, unknown>)?.kind
      const tk = tn?.type || (tn?.data as Record<string, unknown>)?.kind
      if (sk === 'decision' && tk === 'option') continue
      if (sk === 'option' && tk === 'factor') continue
      const match = viewMode !== 'standard'
        ? isEdgeFragileFn(e.id, e.source, e.target, fragileEdges)
        : isTopFragileEdgeFn(e.id, e.source, e.target, fragileEdges)
      if (match) out.add(e.id)
    }
    return out
  }, [isResultsMode, report, viewMode, getEdges, getNode])

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
    // ⭐ ONE LABEL PER TARGET (see selectPersistentStrengthIds). Applied to
    // EVERY branch below, this one included — and this branch is the founder's
    // screenshot: three edges converging on one goal card took the "3 or
    // fewer, label them all" path and pinned all three into a space that fits
    // two. Eligibility here is deliberately UNCHANGED (no provenance gate on
    // this branch); the sort only decides WHICH edge wins a shared target, so
    // a graph whose targets are all distinct keeps exactly the set it had.
    if (causalEdges.length <= 3) {
      const ordered = [...causalEdges].sort(
        (a, b) =>
          compareEdgesByLabelStrength(a.data as Record<string, unknown> | undefined, b.data as Record<string, unknown> | undefined) ||
          a.id.localeCompare(b.id),
      )
      return selectPersistentStrengthIds(ordered.map(toRanked))
    }

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
          target: e.target,
          score: calculateEdgeImportance(ed?.beliefExists, ed?.weight ?? 0.5, goalSens),
        }
      })
      // Tie-break by id so a tie cannot be resolved by iteration order —
      // the per-target cap makes the winner USER-VISIBLE, so "whichever came
      // first" is no longer good enough.
      scores.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      return selectPersistentStrengthIds(scores)
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
    const strengths: Array<{ id: string; target: string; magnitude: EdgeValueDisplay }> = []
    for (const e of causalEdges) {
      const display = resolveEdgeSignedStrengthDisplay(e.data as Record<string, unknown> | undefined)
      if (!display.show) continue
      strengths.push({ id: e.id, target: e.target, magnitude: { ...display, value: Math.abs(display.value) } })
    }
    strengths.sort(
      (a, b) =>
        compareEdgeValueDisplays(a.magnitude, b.magnitude, 'desc') || a.id.localeCompare(b.id),
    )
    return selectPersistentStrengthIds(strengths)
  }, [getEdges, getNode, isResultsMode, report])

  const isTopStrengthEdge = !isStructuralEdge && topStrengthIds.has(id)

  /**
   * This edge renders a PERSISTENT chip — one pinned to the map rather than
   * summoned by hover or selection — so it takes part in the global placement
   * pass. A fragility row alone is enough: the badge is persistent too, and
   * always was; it simply never told the resolver.
   */
  /**
   * ONE CHIP PER EDGE. `showLabel` (below) is the STRENGTH ROW's gate, not the
   * chip's: the chip is a CONTAINER and renders when EITHER row is admitted,
   * so a fragile-but-not-top-strength edge gets a one-row chip that IS the old
   * badge — same copy, same title, now placed by the resolver instead of
   * floating at a hard-coded `labelX + 30`.
   *
   * The fragility gate is the badge's own, moved verbatim. It is declared HERE,
   * above the placement pass, because `isPersistentChipEdge` reads it: this
   * edge's membership of the fragile set and its render gate are ONE question
   * with one answer, and asking the set again with `.has(id)` would be a second
   * spelling of the same rule.
   */
  const showFragileRow =
    (viewMode !== 'standard' ? isFragileEdge : isTopFragileEdge) && !isStructuralEdge

  const isPersistentChipEdge = isTopStrengthEdge || showFragileRow

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
    if (!isPersistentChipEdge) return { dx: 0, dy: 0 }
    // How many stacked rows a given edge's chip renders. A chip with both a
    // strength row and a fragility row is TALLER, and the resolver clears the
    // box it is actually given.
    const rowsFor = (edgeId: string): LabelRowCount | 0 => {
      const n = (topStrengthIds.has(edgeId) ? 1 : 0) + (fragileLabelIds.has(edgeId) ? 1 : 0)
      return n === 0 ? 0 : (n as LabelRowCount)
    }
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
      const rows = rowsFor(e.id)
      if (rows === 0) continue
      // C2 review fix 1: a lens-hidden edge renders no label (the component
      // returns null below), so it must not occupy a label slot either.
      if (lensHiddenEdgeIds.has(e.id)) continue
      const sn = getNode(e.source)
      const tn = getNode(e.target)
      if (!sn || !tn) continue
      placementEdges.push({ id: e.id, sourceRect: rectOf(sn), targetRect: rectOf(tn), rows })
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
  }, [isPersistentChipEdge, topStrengthIds, fragileLabelIds, getEdges, getNode, getNodes, id, lensHiddenNodeIds, lensHiddenEdgeIds, nodeRectsSignature])

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

  const showChip = showLabel || showFragileRow

  /**
   * The word beside the glyph. Where a PERSISTENT strength row is on screen,
   * its text already names the direction ("Moderate boost" / "Strong drag"),
   * so the +/− glyph would be the same datum on a second channel — the
   * clutter the founder reported. It is suppressed THERE and nowhere else:
   * beside a transient hover/selection chip, and on every other
   * stated-direction edge, the glyph stays.
   *
   * ⛔ IT IS NEVER DELETED. `directionStroke.ts:23-32` measured this palette
   * as separating WORSE for a dichromat than the green/red it replaced
   * (ΔE2000 11.7 vs 28.3 under deuteranopia): the SHAPE, not the colour, is
   * what carries polarity for a red-green dichromat here.
   */
  const strengthRowCarriesDirection =
    showLabel &&
    isTopStrengthEdge &&
    // ⛔ AND THE LABEL MUST ACTUALLY SAY IT. Without this clause the predicate
    // asserted its own name rather than checking it: in NUMERIC mode a stated
    // POSITIVE renders `w 0.60 • b 85%` — no word, no sign, no direction — and
    // the glyph was suppressed anyway, leaving polarity on hue alone. That is
    // what `directionStroke.ts:23-32` forbids on a measurement. Asked of
    // `edgeLabels.ts`, which owns both emitters, rather than re-derived from
    // `labelMode` here.
    labelCarriesDirection(edgeSignedStrength, directionDisplay, labelMode)

  /**
   * ⭐⭐ WHERE THE POLARITY GLYPH SITS — P0, AND THE ONE STATE THIS COMPONENT
   * MUST NOT GET WRONG.
   *
   * It used to sit at `translate(targetX - 18, targetY - 18)`. `targetX/targetY`
   * are `getHandlePosition(targetNode, targetHandle, targetPosition)` and take
   * NO EDGE INPUT (`@xyflow/system@0.0.76` `dist/esm/index.mjs:1420-1438`), so
   * every edge into a node painted its glyph at the same point. Measured on the
   * geometry harness at `a1fd39cc`: 14 glyphs at 5 sites (`vendor-selection`),
   * 18 at 6 (`market-entry`), 21 of 21 stacks resolving to exactly one target —
   * and on every starter at least two stacks held BOTH a `+` and a `−`, so the
   * visible mark was whichever painted last. See `edgeGlyphPlacement.ts`.
   *
   * ⚠ THIS SUBSCRIBES TO THE STORE RATHER THAN READING `getNode` IMPERATIVELY,
   * AND THAT IS LOAD-BEARING, NOT TIDINESS. The resolution is only stable if
   * every sibling instance computes it from the SAME node snapshot. A sibling's
   * SOURCE node moving changes MY direction, but does not move MY endpoints and
   * so would not re-render me: two instances on two snapshots can each conclude
   * they are ring 0, and the stack comes back. The subscription is what keeps
   * one snapshot under all of them.
   *
   * Returned as a STRING, not an object — `useStore` compares by reference, and
   * a fresh `{dx, dy}` per store event would re-render every edge on every
   * pointer move.
   */
  const glyphOffsetKey = useStore((st) => {
    // Cheap gate: the two conditions knowable inside a store selector. The
    // render below applies the full predicate; this only avoids paying for a
    // computation whose result is thrown away.
    if (!statedDirection || isStructuralEdge) return ''
    // ⚠ TOLERATE A PARTIAL STORE SLICE. Eleven existing edge suites hand
    // `useStore` a hand-built object with `nodes` and no `edges`, and an
    // unguarded `for (const e of st.edges)` throws inside render — it took out
    // 82 tests. The product always supplies both; a mock need not, and a
    // component that crashes on a narrower slice than it expected is brittle
    // regardless of who supplied it.
    const storeNodes = Array.isArray(st.nodes) ? st.nodes : []
    const storeEdges = Array.isArray(st.edges) ? st.edges : []
    const nodeById = new Map(storeNodes.map((n) => [n.id, n]))
    const centreOf = (nodeId: string): { x: number; y: number } | null => {
      const n = nodeById.get(nodeId)
      if (!n) return null
      const w = n.measured?.width ?? n.width ?? 200
      const h = n.measured?.height ?? n.height ?? 80
      // `position` is the parent-relative top-left; `internals.positionAbsolute`
      // is what React Flow itself uses to place the handles this offset is
      // applied at, so it is the basis that cannot disagree with `targetX/Y`.
      const p = n.internals?.positionAbsolute ?? n.position
      if (!p) return null
      return { x: p.x + w / 2, y: p.y + h / 2 }
    }
    // ⚠ A MISSING TARGET NODE MUST NOT COLLAPSE BACK TO ONE POINT. An earlier
    // draft returned a single constant offset here, which is the ORIGINAL
    // DEFECT wearing a fallback's clothes — every edge into the node would
    // share it again. Instead the whole group is handed null directions, which
    // is the resolver's degraded branch: index-by-id radii, still pairwise
    // distinct. A fallback for an unreachable state is still a state.
    const targetCentre = centreOf(target)
    const siblings: GlyphSibling[] = []
    for (const e of storeEdges) {
      // Every edge into this target, INCLUDING structural ones and ones whose
      // glyph is suppressed. Deliberate: the assignment must not shift when a
      // neighbour's chip appears on hover, or the glyph would jump under the
      // pointer. A reserved-but-unused slot costs nothing.
      if (e.target !== target) continue
      siblings.push({ id: e.id, sourceCentre: targetCentre ? centreOf(e.source) : null })
    }
    // This edge is rendering, so it exists — even if the store slice handed to
    // the selector has not caught up. Without this the resolver takes its
    // caller-bug path and every such edge shares one offset.
    if (!siblings.some((sib) => sib.id === id)) {
      siblings.push({ id, sourceCentre: targetCentre ? centreOf(source) : null })
    }
    const { dx, dy } = resolvePolarityGlyphOffset(id, targetCentre ?? { x: 0, y: 0 }, siblings)
    return `${Math.round(dx * 100) / 100},${Math.round(dy * 100) / 100}`
  })

  const glyphOffset = useMemo(() => {
    if (glyphOffsetKey === '') {
      // No node geometry at all (nodes not yet measured, or a unit test that
      // mocks the store empty). Still never (0,0): the glyph keeps a definite
      // place at the target end rather than landing on the handle itself.
      return { dx: 0, dy: -GLYPH_ANCHOR_RADIUS }
    }
    const [dx, dy] = glyphOffsetKey.split(',').map(Number)
    return { dx, dy }
  }, [glyphOffsetKey])

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
          /*
           * ⭐ THE WIDTHS ABOVE ARE FLOW-SPACE UNTIL THIS LINE, AND THE CANVAS
           * SPENDS MOST OF ITS LIFE ZOOMED OUT.
           *
           * Every width chosen above is multiplied by the viewport scale before
           * it reaches a pixel. Measured on the deployed build, a guest's saved
           * model auto-fitted to `scale(0.322946)`:
           *
           *   declared 1px   -> rendered 0.32px
           *   declared 2px   -> rendered 0.65px
           *
           * So every connection was a sub-pixel hairline, and the whole
           * thickness encoding — the one channel that says which relationships
           * carry the result — collapsed to nothing. The gap between "weak" and
           * "strong" was a third of a pixel. It is not that the encoding was
           * badly chosen; it never reached the screen.
           *
           * `non-scaling-stroke` makes the declared width a SCREEN width at any
           * zoom, so 1.5 / 2 / 3 stay 1.5 / 2 / 3 and stay distinguishable. The
           * dash pattern beside it was already reasoned about this way — its own
           * comment says it "stays legible at every zoom level" — and width was
           * simply never given the same treatment.
           *
           * ⚠ The trade is that edges no longer thicken as you zoom IN. That is
           * the right way round for a diagram: thickness here is an ENCODING of
           * strength, not a drawing property, so it should mean the same thing
           * at every zoom rather than growing with the camera.
           */
          vectorEffect: 'non-scaling-stroke',
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
          at the target end, away from the mid-path label, so it collision-avoids
          labels exactly as before — but NOT at a fixed (targetX/Y − 18) any
          more, because that point is shared by every edge into the node and the
          glyphs stacked on it. `edgeGlyphPlacement.ts` carries the mechanism,
          the measurement and the distinctness proof. Causal lens shows its own
          numeric parameter label instead. Structural edges have no semantic
          direction — excluded defensively. */}
      {/* ⭐ ROADMAP 2.580 member 2: gated on `statedDirection`, not on the raw
          `direction` field — see the derivation at the top of this component.
          An unstated / declined / unrecognised direction renders NOTHING here;
          the graph says less rather than something it was never told. */}
      {statedDirection && lensMode !== 'causal' && !isStructuralEdge && !strengthRowCarriesDirection && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${targetX + glyphOffset.dx}px,${targetY + glyphOffset.dy}px)`,
              pointerEvents: 'none',
            }}
            // ⭐ THE SIZE RULING THIS SITE ASKED FOR, MADE.
            //
            // What stood here: `fontSize: '16px'` with `fontWeight: 700`, a
            // hard-coded #059669/#dc2626 and a `--bg-panel` chip — the ONE
            // canvas text site #771 deliberately left un-counter-scaled,
            // pinned in `canvasTextCounterScale.census.spec.ts`'s KNOWN_FIXED
            // so it stayed a VISIBLE gap, with the note "⭐ NEEDS A SIZE
            // RULING. Once ruled, route it through a token."
            //
            // Ruled: `typography.edgeLabel` — the canvas token its four
            // sibling edge-label sites already use, so no fourth canvas size
            // is minted and DS v5 §2.4's 10-12px band is respected. The
            // apparent size goes 8.0px -> 10px at the 0.50 auto-fit floor
            // (where the product's own post-layout fit parks a fresh model)
            // and 16px -> 10px at zoom 1: it stops being the largest text on
            // the canvas at rest AND stops being the smallest when zoomed out.
            //
            // The chip surface, the bold and the hard-coded hues go with it.
            // Colour was never the load-bearing channel here — see
            // `directionStroke.ts:23-32` — so the glyph reads as body text and
            // the SHAPE does the work, which is what a dichromat relies on.
            className={`${typography.edgeLabel} text-text-body`}
            aria-label={`Effect direction: ${statedDirection}`}
            // ⭐ IDENTITY BINDING. Without it the only way to attribute a glyph
            // to an edge is its ORDER in the portal, and `EdgeLabelRenderer`
            // portals every edge's children into one flat layer — so the Nth
            // glyph is not the Nth edge whenever any edge renders no glyph.
            // CLAUDE.md trap 19: an assertion binds to its object by IDENTITY.
            // This is what lets the browser measure below count glyph-on-glyph
            // stacking BY EDGE rather than by a value predicate.
            data-edge-id={id}
          >
            {statedDirection === 'positive' ? '+' : '−'}
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
          edge path (EdgeLabelRenderer portals to HTML, so the line lives here).

          ⭐ 31 Aug 2026 — THIS IS THE ONLY THING THAT SAYS WHICH EDGE A
          DISPLACED LABEL BELONGS TO, AND IT WAS DRAWN TOO FAINT TO SEE. The
          founder reported a label "floated detached below the bottom node with
          no visible edge"; the leader was being drawn, in two senses too
          quietly to count:

           1. `--border-default` is #EEE6D8 — a pale cream, chosen for panel
              EDGES against a panel FILL. On the canvas ground it is very
              nearly the background. It now uses the muted TEXT token, the same
              one the causal-lens label beside it uses for secondary content:
              a connector the reader is meant to follow is content, not chrome.
           2. `strokeWidth={1}` is 1 GRAPH unit, and the canvas sits at zoom
              0.50 the moment a drafted model is auto-fitted — so the leader
              rendered at HALF a device pixel exactly when it was needed most.
              `vector-effect: non-scaling-stroke` is the SVG mechanism for
              "this width is a screen width", so the leader is 1px at every
              zoom. This is the same failure canvas TEXT already solves with
              `--canvas-label-scale`; strokes need their own answer because a
              counter-scale variable cannot reach a stroke width.

          Neither change moves any geometry, so neither can affect the dodge
          resolver's assumptions — the trade-off-free half of the fix. */}
      {showLabel && (Math.abs(labelOffsetX) + Math.abs(labelOffsetY)) > 12 && (
        <line
          x1={labelX}
          y1={labelY}
          x2={labelX + labelOffsetX}
          y2={labelY + labelOffsetY}
          stroke="var(--text-light, #6E6B6B)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          data-testid="edge-label-leader"
        />
      )}

      {/* C1: Edge label - only show when selected, hovered, or has pending suggestions */}
      {showChip && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX + labelOffsetX}px,${labelY + labelOffsetY}px)`,
              pointerEvents: 'all',
              padding: '3px 8px',
              borderRadius: '4px',
              // Derived, not mirrored: the resolver clears a box of exactly
              // this width around the anchor, so the cap and the cleared box
              // are one quantity with two readers, not two numbers kept in
              // step by hand. The spec pins the resolved value against an
              // independently-written literal so the number stays observable.
              maxWidth: `${LABEL_HALF_WIDTH * 2}px`,
              overflow: 'hidden',
              // ⭐ A COLUMN OF UP TO TWO ROWS — the strength row and the
              // fragility row. The chip is a CONTAINER, not a fourth signal:
              // each row keeps its own text, owner and title. The resolver is
              // told the row count and clears the taller box (see
              // `labelHalfHeightForRows`), which is what makes
              // DESIGN_SYSTEM.md's "stacking is spaced by
              // edgeLabelCollision.ts" true for the fragility signal — it was
              // FALSE for as long as that badge painted at `labelX + 30`.
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              // Each ROW is still one line, always: the ellipsis that keeps
              // the text inside the cleared box lives on the spans below.
              flexWrap: 'nowrap',
              rowGap: `${LABEL_ROW_GAP_PX}px`,
              cursor: 'pointer',
              // C1: Smooth fade-in transition
              opacity: 1,
              transition: 'opacity 150ms ease-in-out',
            }}
            className={`nodrag nopan border shadow-panel ${typography.edgeLabel} ${
              isDark ? 'bg-gray-900 text-gray-100' : 'bg-panel/95 text-text-header'
            } ${
              // The fragility row brings the old badge's border with it, so a
              // fragile-only chip IS the badge — same copy, same surface, now
              // placed by the resolver. Selected as ONE class rather than
              // appended after another border colour: Tailwind resolves by
              // stylesheet order, not by the order classes appear here.
              showFragileRow
                ? 'border-info/30'
                : isDark
                  ? 'border-gray-600'
                  : 'border-panel-border'
            } ${hasSuggestion ? 'ring-2 ring-info ring-offset-1' : ''} ${isFirstEdge && showEdgeHint ? 'edge-hint-active' : ''}`}
            role="note"
            data-testid="edge-influence-label"
            aria-label={showLabel ? ariaLabel : fragileSentence}
            title={(() => {
              // ⭐ CANVAS-BACKLOG S1 — THE SENTENCE THE PLATE CUTS OFF LIVES HERE NOW.
              //
              // The label text below is ellipsised by CSS, and structurally has
              // to be: the plate is capped at the box `resolvePersistentLabelPlacements`
              // clears, that cap is in GRAPH units, and graph units shrink with
              // zoom while the label FONT does not (it carries `labelCounterScale`
              // so its rendered size stays on the Design System floor). At
              // `LABEL_LEGIBLE_ZOOM` — where the product's own auto-fit parks —
              // roughly a dozen glyphs survive, against a vocabulary that runs to
              // "Moderate effect, direction not stated (uncertain)".
              //
              // ⚠ THE COMMENT BESIDE THE ELLIPSIS USED TO SAY THE FULL STRING WAS
              // ALREADY RECOVERABLE FROM "aria-label AND title". Half true, and the
              // false half was the half a sighted user needs: `title` carried
              // `tooltip` — the NUMBERS — and never the sentence. So did the hover
              // popover. The words the user could see two thirds of were reachable
              // by assistive technology and by nobody else, which is why this defect
              // was re-reported three times.
              //
              // The sentence is READ from `edgeDescription`, never re-derived:
              // `getEdgeLabel` is the one owner of this vocabulary and one datum
              // must not get two spellings (CLAUDE.md trap 21).
              const { label, tooltip } = edgeDescription
              // In NUMERIC mode `getEdgeLabel` returns the SAME string for both
              // channels — the sentence IS the numbers — so joining them
              // unconditionally would print "w −0.35 • b 70%" twice in one tooltip.
              const sentence = label === tooltip ? tooltip : `${label}\n${tooltip}`
              const baseTooltip = provenance
                ? `${sentence} • Source: ${provenance}`
                : sentence
              // Each ROW keeps its own title (below); the CONTAINER carries
              // every sentence the chip is currently showing, and only those —
              // a fragile-only chip must not describe a strength it is not
              // displaying.
              const parts = [
                ...(showLabel ? [baseTooltip] : []),
                ...(showFragileRow ? [fragileSentence] : []),
              ]
              return `${parts.join('\n')}\n\nDouble-click to inspect`
            })()}
            onDoubleClick={handleLabelDoubleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {showLabel && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'nowrap',
                  alignItems: 'center',
                  gap: '4px',
                  minWidth: 0,
                  overflow: 'hidden',
                }}
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
                      assumes.

                      ⚠⚠ THIS SENTENCE READ "The full string stays recoverable:
                      the container's aria-label and title both carry it", AND
                      THE `title` HALF WAS FALSE FOR AS LONG AS IT WAS WRITTEN
                      (settled at the bytes, CANVAS-BACKLOG S1). The title
                      carried `edgeDescription.tooltip` — "Weight: −0.60,
                      Belief: 85%" — so the only channel with the sentence was
                      the accessible name, and the sighted user hovering the
                      thing they could not read got the numbers back. The
                      claim is now TRUE, and it is true because the title
                      composition above makes it true; a spec
                      (`StyledEdge.labelRecoverable.spec.tsx`) asserts the
                      painted text is contained in the hover text so the two
                      cannot drift apart again. Corrected rather than deleted:
                      a comment asserting a guarantee reads as already
                      audited, so nobody re-checks it.

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
            )}

            {/* THE FRAGILITY ROW — the former standalone badge, verbatim.
                It kept its own copy, its own `title` and its own owner
                (`getFragileEdgeSwitchProbability`); all it lost is the
                hard-coded `labelX + 30` that put it outside the placement
                pass and left it floating with no visible referent. */}
            {showFragileRow && (
              <div
                data-testid="edge-fragile-tag"
                style={{
                  display: 'flex',
                  flexWrap: 'nowrap',
                  alignItems: 'center',
                  gap: '4px',
                  minWidth: 0,
                  overflow: 'hidden',
                }}
                className="text-text-body"
                title={fragileSentence}
              >
                <AlertTriangle size={12} className="flex-shrink-0" />
                {/* 10px via the canvas token so it sees the counter-scale;
                    inline it rendered at 5.0px. */}
                <span
                  className={typography.edgeLabel}
                  style={{
                    fontWeight: 600,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Sensitive{fragileEdgeSwitchProb !== null ? ` · ${Math.round(fragileEdgeSwitchProb * 100)}%` : ''}
                </span>
              </div>
            )}
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
        // ⚠⚠ THE DIRECTION USED TO BE GATED WITH THE STRENGTH, AND THAT WAS THE
        // WRONG GATE — the note below is the original, and it diagnosed the
        // fabrication correctly while fixing it against the wrong predicate.
        //
        // ORIGINAL: "The direction is gated with the strength deliberately:
        // `direction` defaults to 'positive', so 'Positive' is itself a
        // fabrication on an edge nobody characterised."
        //
        // True, and insufficient. "Was the STRENGTH set?" and "was the DIRECTION
        // stated?" are two questions, and this asked the first while answering
        // the second. An edge with a user-set strength and a defaulted direction
        // clears the strength gate — and then the sign of that defaulted
        // `direction` printed a bold "Positive" and a green bar, on the SAME
        // edge whose stroke this component draws GREY a thousand lines above,
        // from `resolveEdgeDirectionDisplay`, for "direction not set yet".
        // One component, two verdicts, one edge.
        //
        // Both now read the one resolver. `statedDirection` (:283) is
        // `directionDisplay.show ? directionDisplay.direction : null` — the same
        // ratified owner `computeDirectionStroke` consumes, so the popover and
        // the stroke cannot disagree again.
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
        // The WORD comes from the resolver, never from the sign of a number
        // whose direction may have been defaulted.
        const dirLabel = statedDirection === null
          ? null
          : statedDirection === 'positive' ? 'Positive' : 'Negative'
        // Which half-colour the bar paints IS a direction claim, so it is gated
        // the same way. Grey is this canvas's stated NO-VERDICT colour for
        // exactly this case — `directionStroke.ts` calls it
        // "weight-set-but-no-direction" — and it is the same token the stroke
        // and the legend row already use, so no new vocabulary is introduced.
        const strengthBarTone = statedDirection === null
          ? (isDark ? 'var(--edge-neutral-dark)' : 'var(--edge-neutral)')
          : null
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
              {/* Direction — only when the producer or the user STATED one. */}
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
                      className={`h-full rounded-full ${
                        strengthBarTone !== null
                          ? ''
                          : statedDirection === 'positive' ? 'bg-success' : 'bg-danger'
                      }`}
                      style={{
                        width: `${Math.max(4, strengthPct)}%`,
                        ...(strengthBarTone !== null ? { backgroundColor: strengthBarTone } : {}),
                      }}
                    />
                  </div>
                  <span className={`${typography.edgeLabel} text-text-light w-7 text-right shrink-0`}>{strengthPct}%</span>
                </div>
              )}
              {/* Nothing characterised yet — say that, rather than a number.
                  ⚠ GATED ON `signedVal`, NOT ON `dirLabel`, AND THAT IS A
                  CONSEQUENCE OF THE FIX ABOVE. They used to be equivalent:
                  `dirLabel` was derived from `signedVal`, so `dirLabel === null`
                  implied no strength. Binding the word to `statedDirection`
                  DECOUPLED them — and an edge with a set strength and no stated
                  direction would then have rendered the strength bar AND
                  "Strength and likelihood not set" in the same popover, which is
                  a NEW contradiction bought with the old one's fix. The empty
                  state is a claim about the NUMBERS, so it reads the numbers. */}
              {signedVal === null && confidencePct === null && (
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
