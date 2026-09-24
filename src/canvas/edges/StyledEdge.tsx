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

import { memo, useMemo, useState, useRef, useEffect, useLayoutEffect } from 'react'
import {
  edgeDoubleClickAffordance,
  EDGE_AFFORDANCE_EDITABLE,
  EDGE_AFFORDANCE_DIRECT_ACTION,
  EDGE_AFFORDANCE_CHAT_ALTERNATIVE,
} from './edgeAffordance'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, getStraightPath, Position, type EdgeProps, useReactFlow, useStore } from '@xyflow/react'
import { Lightbulb, Activity, Flag } from 'lucide-react'
import { NodeChip } from '../nodes/shared'
import { EstimateMarker, ESTIMATE_SUBJECT_TITLE } from '../nodes/shared/EstimateMarker'
import { CANVAS_GLYPH_SIZE_CLASSES } from '../nodes/shared/canvasGlyphScale'
import { strengthIsHumanSettled } from '../domain/edgeStrengthSettlement'
import { useShallow } from 'zustand/react/shallow'
import type { EdgeData, EdgePathType } from '../domain/edges'
import {
  shouldShowEdgeLabel,
  selectPersistentStrengthIds,
  viewShowsStrengthLabels,
  type RankedCausalEdge,
} from './edgeLabelVisibility'
import { computeDirectionStroke } from './directionStroke'
import { resolveSameRowRoute, routeBoxOf, type RouteBox, type SameRowRoute } from './sameRowRoute'
import {
  readContestedState,
  resolveEdgeStroke,
  resolveEdgeDash,
  resolveEdgeDirectionMarker,
  edgeArrowheadMarkerId,
  EDGE_ARROWHEAD_FLOW_LENGTH,
  EDGE_ARROWHEAD_FLOW_WIDTH,
  EDGE_ARROWHEAD_VIEWBOX,
  EDGE_ARROWHEAD_POLYGON_POINTS,
  type EdgePresentationState,
} from './edgePresentation'
import {
  resolvePersistentLabelPlacements,
  LABEL_DECLARED_HALF_WIDTH,
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
// GAP 2 fix (design-gap audit row 19): `useIsDark` is no longer imported —
// this component now forces `isDark = false` (see the constant's own comment
// below) rather than following the OS colour scheme. `../hooks/useTheme`
// still exports the hook for any future consumer; canvas edges just stop
// being the one.
import { getEdgeLabel, labelCarriesDirection } from '../domain/edgeLabels'
import { useEdgeLabelMode } from '../store/edgeLabelMode'
import { useCanvasStore } from '../store'
import { isGraphLensEnabled } from '../../flags'
import { isEdgeFragile as isEdgeFragileFn, getFragileEdgeSwitchProbability, isTopFragileEdge as isTopFragileEdgeFn, type FragileEdgeCandidate, type FragileEdgeMatchContext } from '../utils/fragileEdgeMatch'
import { resolveExistenceDash, calculateEdgeImportance, weightMagnitudeToStrokeWidth, UNSET_EDGE_STROKE_WIDTH, uncertaintyBandHalfWidth, UNCERTAINTY_BAND_STROKE, UNCERTAINTY_BAND_OPACITY } from '../utils/graphDisplayCalculations'
import { typography } from '../../styles/typography'
import { selectLodBodyHidden } from '../utils/zoomLegibility'
import {
  fragileEdgeSentence,
  DIRECTION_DISPUTED_SENTENCE,
  directionInUseSentence,
  linkStrengthCaption,
} from './connectorCopy'
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
 * contract v3.1 (E6): the opacity of a connection outside the selected
 * element's neighbourhood — line, ribbon, halo, arrowhead, polarity glyph and
 * chip together. DS v5 §7.4 ("dims unconnected nodes and edges to 20%"); the
 * lens dim already uses the same 0.2. Exported so specs bind to the identity.
 */
export const EDGE_SELECTION_DIM_OPACITY = 0.2

/**
 * ⭐ ONE GLOW RECIPE FOR EVERY TRANSIENT EDGE EMPHASIS (contract v3.1, E5/T09,
 * 24 Sep 2026).
 *
 * These were four FULL-alpha info drop-shadows — selected 5px, hover 3px,
 * flip-risk 4px, sensitivity 2px — with an off-palette `#3b82f6` fallback. A
 * 5px full-strength blue bloom on a green line reads as neon. The contract's
 * selected connection is `drop-shadow(0 0 2px #277A9D55)`: the served info hue
 * at about a third alpha, 2px. Every glow is now that recipe with its own
 * radius/alpha, the info token only (no fallback hex, no new colour), mixed the
 * way this file already mixes the dispute hue.
 *
 * The flip-risk glow stays a DIFFERENT string from the sensitivity glow on
 * purpose: both can apply to one edge and must compose as two signals
 * (`StyledEdge.filterCompose.spec.tsx`), and since E4 removed the flip-risk
 * width floor it is that edge's only transient viewing cue, so it is the
 * slightly stronger of the two.
 */
const edgeGlow = (px: number, pct: number): string =>
  `drop-shadow(0 0 ${px}px color-mix(in srgb, var(--semantic-info) ${pct}%, transparent))`

/**
 * ⭐ THE POLARITY GLYPH'S HALO (contract v3.1, E2/T09 — Paul 23 Sep point 12:
 * "Sign glyphs drawn in body text with a halo").
 *
 * The glyph sits `GLYPH_ANCHOR_RADIUS` back along the target→source axis, so on
 * a near-vertical edge it is drawn ON the 1.5-4px coloured line — and a `−`
 * crossing a vertical line reads as `+`, which inverts the one channel a
 * red-green dichromat relies on (`directionStroke.ts:23-32`). The contract
 * draws `.polarity{paint-order:stroke;stroke:var(--canvas);stroke-width:3px}`,
 * a 1.5px canvas-coloured knockout. This glyph is HTML, not SVG text, so the
 * portable equivalent is a stacked canvas-coloured `text-shadow` — the canvas
 * ground token only, no new colour, and no change to the glyph's box.
 *
 * The radius carries `--canvas-label-scale` exactly like the glyph's own font
 * (`typography.edgeLabel`), so the halo is the contract's 1.5px ON SCREEN at
 * every zoom instead of halving with the camera.
 */
const POLARITY_HALO_PX = 'calc(1.5px * var(--canvas-label-scale, 1))'
export const POLARITY_GLYPH_HALO =
  `0 0 ${POLARITY_HALO_PX} var(--bg-canvas), 0 0 ${POLARITY_HALO_PX} var(--bg-canvas), 0 0 ${POLARITY_HALO_PX} var(--bg-canvas)`

/**
 * contract v3.1 (E10): the fragility cue disc — the contract's `r="8"` circle,
 * 16px ON SCREEN because it carries the same counter-scale as the text beside
 * it. At the worst-case scale (`MAX_LABEL_COUNTER_SCALE` = 2) it is 32 graph
 * units, inside the 36-unit one-row box `labelHalfHeightForRows(1)` clears.
 */
const FRAGILE_CUE_DISC_SIZE = 'calc(16px * var(--canvas-label-scale, 1))'

export const EDGE_GLOW = Object.freeze({
  selected: edgeGlow(2, 35),
  hover: edgeGlow(1.5, 25),
  flipRisk: edgeGlow(3, 45),
  sensitivity: edgeGlow(2, 35),
})

/**
 * The robustness fragile-edge list, read through one typed accessor.
 * `ReportV1` does not declare `robustness`, so every inline `report.robustness`
 * read costs a diagnostic; this narrows once, in one place, and the callers
 * stay clean.
 */
/**
 * The ids of every live edge sharing these endpoints (this one included) — the
 * context the fragility matcher needs to withhold an id-less finding that could
 * belong to either of two parallel relationships (Codex #1919 5802926467).
 * Local rather than imported so the many specs that mock `fragileEdgeMatch`
 * with a fixed factory keep working; `fragileEdgeMatch.parallelEdgeIdsFor` is
 * the same rule, pinned by its own spec.
 */
function parallelEdgeIdsOf(
  edges: ReadonlyArray<{ id: string; source: string; target: string }> | undefined,
  edgeSource: string,
  edgeTarget: string,
): string[] {
  return (edges ?? []).filter(e => e.source === edgeSource && e.target === edgeTarget).map(e => e.id)
}

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
  // GAP 2 fix (design-gap audit row 19): the locked contract is light-only
  // (`:root{color-scheme:light}`, no dark tokens), and cards/ground have no
  // dark path at all — `useIsDark` was read ONLY here in the whole canvas
  // (`git grep -rl useIsDark src`, excluding specs). Following the OS colour
  // scheme therefore switched edges and chips to dark tints on the otherwise
  // permanently-light board. Every branch below keyed on `isDark` — the
  // direction stroke, the chip's `bg-gray-900`/`border-gray-600` classes, the
  // hover popover's strength-bar tone — is neutralised by fixing this one
  // constant rather than editing each branch; `directionStroke.ts`'s dark
  // tokens are left in place (unused from here), since owning the RULE that
  // nothing on canvas asks for them is a smaller, more reviewable change than
  // deleting a palette a future non-canvas surface may still want.
  const isDark = false
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
  // A13 (keyboard parity): the group this component renders, used only to reach
  // React Flow's own focusable edge element above it. See the focus effect.
  const edgeGroupRef = useRef<SVGGElement | null>(null)
  // Escape closed the popover; do not re-open it until the user leaves and
  // comes back. Mirrors `dismissed` in `hooks/usePopoverHover.ts`.
  const keyboardDismissedRef = useRef(false)
  // Whether the POINTER is currently over a surface THIS edge owns — the edge
  // itself or its own portalled popover. Read only by the focus handlers, so
  // losing focus cannot close a popover the mouse still owns.
  // ⚠ It covers the popover as well as the edge because the focus-out rule now
  // observes departure FROM the popover too: without that, a keyboard focus
  // leaving while the pointer rested on the popover would close it under the
  // mouse. The 100ms leave timer stays the mouse path's own authority.
  const pointerWithinRef = useRef(false)
  // The portalled popover element, so focus DEPARTURE from it can be observed.
  // `EdgeLabelRenderer` mounts it in a sibling subtree, so it cannot be reached
  // by a listener on the edge group — see the focus effect.
  const popoverElRef = useRef<HTMLDivElement | null>(null)
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
  const { ceeReview, resultsStatus, report, isHighlightedEdge, isAnalysisFragileEdge, isSelectionDimmed, viewMode, isLodBodyHidden } = useCanvasStore(
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
      // The far rung of the semantic-zoom ladder, read through THE shared
      // predicate the cards blank their bodies on (`selectLodBodyHidden`), so
      // the edge's exception cue and the cards agree on what "readable zoom"
      // is. A primitive boolean (React #185), and undefined-safe: a store
      // double with no rung slice reads as ORDINARY, never as far.
      isLodBodyHidden: selectLodBodyHidden(s),
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

  /**
   * ⭐ ONE RESOLVED IDENTITY FOR EVERY FRAGILITY READER ON THIS EDGE (Codex
   * #1919 5802926467). The edges that share this edge's endpoints are read from
   * the live graph once and handed to every matcher below — cue, probability,
   * top-edge, placement and the lens label — so a supplied `edge_id` is
   * exclusive everywhere and an id-less finding that could belong to either of
   * two parallel relationships is withheld everywhere, not just in a helper test.
   */
  const fragileMatchCtx = useMemo(
    (): FragileEdgeMatchContext => ({
      parallelEdgeIds: parallelEdgeIdsOf(typeof getEdges === 'function' ? getEdges() : undefined, String(source), String(target)),
    }),
    // `report` is a deliberate dependency: the graph can gain a parallel edge
    // between runs, and every reader here re-derives when the report changes.
    [getEdges, source, target, report],
  )

  // Graph Lens: alternative winner label for fragile edge hover — the SAME
  // resolved entry as the cue (never "id matches OR endpoints match").
  const lensFragileLabel = useMemo(() => {
    if (!isLensFragile || !report) return ''
    // The first entry the SAME matcher assigns to this edge (exclusive id,
    // withheld when ambiguous) — never "id matches OR endpoints match".
    const entry = fragileEdgesOf(report).find(fe =>
      isEdgeFragileFn(String(id), String(source), String(target), [fe], fragileMatchCtx),
    ) as (FragileEdgeCandidate & { alternative_winner_label?: string; alternativeWinnerLabel?: string }) | undefined
    if (!entry) return 'Sensitive'
    const altLabel = entry.alternative_winner_label ?? entry.alternativeWinnerLabel
    return altLabel ? `If wrong → ${altLabel}` : 'Sensitive'
  }, [isLensFragile, report, id, source, target, fragileMatchCtx])

  // Check if this edge is fragile (switch_probability > 0.3)
  // Uses shared utility for consistent matching across StyledEdge, useMenuItems, useLensFilter
  const isFragileEdge = useMemo(() => {
    if (!isResultsMode || !report?.robustness) return false
    const fragileEdges = report.robustness.fragile_edges || []
    return isEdgeFragileFn(id, source, target, fragileEdges, fragileMatchCtx)
  }, [isResultsMode, report, id, source, target, fragileMatchCtx])

  // T7: Switch probability for fragile edge badge tooltip + hover popover
  const fragileEdgeSwitchProb = useMemo(() => {
    if (!isFragileEdge || !report?.robustness) return null
    const fragileEdges = report.robustness.fragile_edges || []
    return getFragileEdgeSwitchProbability(id, source, target, fragileEdges, fragileMatchCtx)
  }, [isFragileEdge, report, id, source, target, fragileMatchCtx])

  // E4 (graph-visuals): the SINGLE most fragile relationship earns a fragility
  // badge in the default (standard) view too, so the top flip risk is visible
  // on the map without switching to Detailed. Every fragile edge still badges
  // in Detailed/Model view (below).
  const isTopFragileEdge = useMemo(() => {
    if (!isFragileEdge || !report?.robustness) return false
    const fragileEdges = report.robustness.fragile_edges || []
    return isTopFragileEdgeFn(id, source, target, fragileEdges, fragileMatchCtx)
  }, [isFragileEdge, report, id, source, target, fragileMatchCtx])

  /**
   * The fragility sentence — ONE owner (`connectorCopy.fragileEdgeSentence`,
   * moved there verbatim), three readers here: the cue's accessible name, the
   * cue's `title`, and the chip container's composed title and name. So the
   * figure is never stated without its noun on any of them.
   * Presence-branched on a MEASURED switch probability: absent means NOT
   * COMPUTED, and `marginal_switch_probability` is a different Monte Carlo,
   * never a fallback (pinned by StyledEdge.fragilePresence.spec).
   */
  const fragileSentence = fragileEdgeSentence(fragileEdgeSwitchProb)

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
    const allEdges = getEdges()
    for (const e of allEdges) {
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
      const ctx: FragileEdgeMatchContext = { parallelEdgeIds: parallelEdgeIdsOf(allEdges, e.source, e.target) }
      const match = viewMode !== 'standard'
        ? isEdgeFragileFn(e.id, e.source, e.target, fragileEdges, ctx)
        : isTopFragileEdgeFn(e.id, e.source, e.target, fragileEdges, ctx)
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
  // `edgeData.belief` (the v3 legacy scalar) is deliberately NOT read here any
  // more. It has no live writer, and reading it made the label contradict this
  // component's own popover — see `edgeLikelihood` below.
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
  // CEE edge whose strength nobody had set. An unset edge draws at
  // `UNSET_EDGE_STROKE_WIDTH` instead.
  //
  // ⭐ THAT WIDTH IS NOW STRICTLY BELOW EVERY MEASURED BAND (8 Sep 2026). It
  // used to EQUAL the weakest band (both 1.5), so this gate stopped thickness
  // claiming "strong" and left it claiming "weak" — an unset strength and a
  // stated `|mean| < 0.4` were pixel-identical on the one channel with a legend
  // key teaching people to read it. Width is now a total order that the reader
  // can follow in one look: unset < weak < moderate < strong. See
  // `graphDisplayCalculations.UNSET_EDGE_STROKE_WIDTH` for why the fix lands on
  // width rather than on a dash (dash belongs to existence certainty — since
  // 23 Sep 2026 to existence ALONE, by the locked connector grammar).
  //
  // Colour still carries the "no verdict" claim in the DEFAULT view
  // (`computeDirectionStroke` returns neutral on `!show`) — but NOT in the
  // causal lens, whose stroke rule reads `direction` alone and never magnitude.
  // There, width is the only discriminator there is.
  const edgeSignedStrength = useMemo(
    () => resolveEdgeSignedStrengthDisplay(edgeData as Record<string, unknown> | undefined),
    [edgeData]
  )

  /**
   * ⭐ IS THIS SPOKEN STRENGTH ONE A PERSON STOOD BEHIND?
   *
   * The line already tells row 1 apart — no figure at all draws thin and grey
   * and its label reads "Strength not set". It did NOT tell row 2 from row 3: a
   * producer's figure nobody has confirmed drew at magnitude in a polarity
   * colour and read "Moderate boost", BYTE-IDENTICAL to a strength the user
   * typed. Meanwhile the risk and outcome cards, for that same edge, refuse to
   * draw the figure and disclose it as `est.` — one edge, two verdicts, and the
   * louder channel carried the less honest one. `CanvasLegendPopover` already
   * describes this state in prose ("the line is drawn at its magnitude in a
   * POLARITY colour: thick and green or rose") without anything on the canvas
   * making it visible.
   *
   * ⛔ `strengthIsHumanSettled`, NOT `edgeValueSource(data,'weight')`. Two
   * questions (CLAUDE.md trap 21) that DIVERGE on a state a live affordance
   * produces: `ModelTabBody.handleResolveContested`'s `accepted_pass2` branch
   * stamps `weightSource: 'cee'` deliberately — the accepted number really is
   * the producer's — so an edge a human explicitly adjudicated reads
   * `weightSource !== 'user'` forever. Marking it "unconfirmed" would tell the
   * person who confirmed it that nobody had. That module is the ONE admission
   * every "nobody has set this" claim on the canvas consumes; this is a
   * consumer of it, not a second copy of the answer.
   *
   * ⛔ AND NOT A DASH, A COLOUR, A WIDTH OR AN OPACITY. Every geometric channel
   * on this path is already claimed by a reasoned rule — polarity
   * (`EDGE_STROKE_RULES`), existence certainty and nothing else
   * (`EDGE_DASH_RULES`, 23 Sep 2026), magnitude (`weightMagnitudeToStrokeWidth`), lens and
   * selection (the `opacity` note below). Two of them are fenced by a standing
   * ruling: `EDGE_DASH_RULES` removed `pre_run_incomplete` BECAUSE a marker
   * keyed on a predicate that is true of every edge on a fresh draft marks
   * nothing, and `!strengthIsHumanSettled` is exactly such a predicate. A word
   * is the one channel here with room, and it is legible without colour.
   *
   * ⚠ GATED ON `.show` SO ROW 1 IS NOT DOUBLE-DISCLOSED: an edge whose label
   * already reads "Strength not set" does not also need a marker saying so.
   * The marker therefore fires ONLY on the state that was undisclosed.
   */
  const strengthUnconfirmed = useMemo(
    () =>
      edgeSignedStrength.show &&
      !strengthIsHumanSettled(edgeData as Record<string, unknown> | undefined),
    [edgeSignedStrength, edgeData]
  )
  /**
   * ⭐⭐ THE LABEL'S LIKELIHOOD, FROM THE SAME OWNER THE HOVER POPOVER READS.
   *
   * The label used to be handed `belief` (:372) — the v3 legacy scalar, which
   * nothing on the live path writes (its only writer is the dead v1 edge
   * inspector). It was `undefined` on every CEE-drafted edge, so `describeEdge`
   * classified the confidence as "uncertain" and appended "(uncertain)" to
   * EVERY label on the canvas: 24 edges out of 24 on the 3 Sep 2026 capture.
   *
   * The popover below, in this same component, resolved `beliefExists` and
   * rendered "80% confident" for those very edges. One edge, two surfaces, two
   * answers to the one question "how likely is this relationship?" — and the
   * canvas told the founder the answer was "uncertain" while its own tooltip
   * knew it was 80%.
   *
   * Both now read `resolveEdgeValueDisplay(edgeData, 'beliefExists')`, so they
   * cannot disagree again. Do not reintroduce a second likelihood channel here
   * (CLAUDE.md trap 21).
   */
  const edgeLikelihood = useMemo(
    () => resolveEdgeValueDisplay(edgeData as Record<string, unknown> | undefined, 'beliefExists'),
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

  /**
   * ⭐⭐ THE EXISTENCE DASH, FROM THE SAME OWNER THE LABEL AND POPOVER READ.
   *
   * ⚠ THIS BLOCK USED TO BE THE SECOND LIKELIHOOD CHANNEL THE COMMENT ON
   * `edgeLikelihood` ABOVE FORBIDS — thirty lines below that instruction. It
   * read the RAW field:
   *
   *     const beliefExists = edgeData?.beliefExists ?? belief_exists ?? exists_probability
   *     existenceCertaintyToLineStyle(beliefExists)   // >= 0.7 → solid
   *
   * `USER_EDGE_DEFAULTS.beliefExists` is `0.8` with no source stamp, so a link
   * the user had just DRAWN cleared the threshold and drew SOLID — under a
   * legend reading "Solid connection: established". One edge, two surfaces, two
   * answers again: the panel (gated since #1677) said nobody had stated a
   * likelihood while the stroke asserted the relationship was established.
   *
   * It also read a DIFFERENT FIELD SET from the union (`belief_exists` /
   * `exists_probability` here; `beliefExists` / `belief` there), so the two
   * could disagree on WHICH number they were even describing. Both now resolve
   * through `resolveEdgeValueDisplay`. Do not reintroduce a raw read here
   * (CLAUDE.md trap 21).
   */
  const existenceDash = useMemo(
    () => resolveExistenceDash(edgeLikelihood),
    [edgeLikelihood]
  )

  // AI-review disagreement state — reduced to two named facts by the one
  // authority (`edgePresentation.readContestedState`). The gate itself is
  // unchanged: status contested AND user_action pending AND a divergence
  // actually supplied. Since 23 Sep 2026 (the locked connector grammar) it
  // reaches the line ONLY as the sign-dispute orange and never sets the dash;
  // the hover reads it too, so a disputed sign is not stated there as fact.
  const validation = edgeData?.validation
  const contested = useMemo(() => readContestedState(validation), [validation])
  /**
   * Olumi's two review passes disagree about the SIGN — the one disagreement
   * that reaches the line (amber stroke). Paul 23 Sep contract feedback point
   * 9: "AI sign-disagreement = Warning/amber + `±`" — so the polarity glyph
   * reads it too and draws `±` (shape + colour, not a new colour).
   */
  const isSignDisputed = contested.isContested && contested.directionDisputed

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

  /**
   * ⭐ A SAME-ROW LINK IS ROUTED BETWEEN THE CARDS (canvas polish #1, 24 Sep
   * 2026) — see `sameRowRoute.ts`. Bottom port → top handle with the target's
   * top at or above the source's bottom is the only geometry that loops; the
   * store is read only then. A SUBSCRIPTION (like the glyph's below), not an
   * imperative `getNode`, so a card moving into or out of the gap re-routes
   * the link. Returned as a string: `useStore` compares by reference.
   */
  const sameRowRouteKey = useStore((st) => {
    if (pathType === 'straight' || pathType === 'smoothstep') return ''
    if (sourcePosition !== Position.Bottom || targetPosition !== Position.Top || targetY > sourceY) return ''
    // Tolerate a partial store slice (see the glyph selector's note).
    const storeNodes = Array.isArray(st.nodes) ? st.nodes : []
    let src: RouteBox | null = null
    let tgt: RouteBox | null = null
    const others: RouteBox[] = []
    for (const n of storeNodes) {
      if (n.hidden || lensHiddenNodeIds.has(n.id)) continue
      const box = routeBoxOf(n as Parameters<typeof routeBoxOf>[0])
      if (!box) continue
      if (n.id === source) src = box
      else if (n.id === target) tgt = box
      else others.push(box)
    }
    if (!src || !tgt) return ''
    const route = resolveSameRowRoute(src, tgt, others)
    return route ? JSON.stringify(route) : ''
  })
  const sameRowRoute = useMemo<SameRowRoute | null>(
    () => (sameRowRouteKey === '' ? null : (JSON.parse(sameRowRouteKey) as SameRowRoute)),
    [sameRowRouteKey],
  )

  // Compute edge path based on pathType
  const [edgePath, labelX, labelY] = useMemo(() => {
    if (sameRowRoute) {
      // The label anchors ON the drawn path. `side` keeps the handle midpoint
      // (already on the connector for row-mates, so `labelAnchor` is null);
      // `under` anchors on its gutter run. The placement pass is fed the same
      // anchor below, so the chip's dodge and leader start where it sits.
      return [
        sameRowRoute.path,
        sameRowRoute.labelAnchor?.x ?? (sourceX + targetX) / 2,
        sameRowRoute.labelAnchor?.y ?? (sourceY + targetY) / 2,
      ] as [string, number, number]
    }
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
      default: {
        /*
         * ⭐ contract v3.1 (E9, 24 Sep 2026) — A LAYERED EDGE IS A NEAR-STRAIGHT
         * LINE WITH SHORT VERTICAL LEADS, NOT A FULL S-CURVE.
         *
         * For a bottom-handle → top-handle edge running DOWN the board, xyflow's
         * `getBezierPath` ignores `curvature` altogether: its control offset is
         * `0.5 × Δy` whenever the target is past the source
         * (`calculateControlOffset`, `distance >= 0`), so every layered edge was
         * a full S-curve and long cross-band edges swung wide — spaghetti at the
         * landing zoom. The contract's `renderEdges` draws
         * `bend = max(6, min(30, Δy/2))`: at most 30 graph units of vertical
         * lead-in and lead-out, otherwise straight.
         *
         * ⚠ WHAT DOES NOT MOVE. The label anchor is the cubic's t = 0.5 point,
         * which for control points (sx, sy+b) and (tx, ty−b) is exactly
         * ((sx+tx)/2, (sy+ty)/2) — byte-identical to xyflow's, so the chip
         * placement pass (which clears boxes around the handle midpoint) and
         * the leader line are unaffected. The end tangent is still vertical, so
         * the arrowhead (`orient="auto"`) still points straight into the card.
         * Every other orientation (an upward edge between rows, and every
         * non-default path type) keeps xyflow's own path; a SAME-ROW pair was
         * routed above (`sameRowRoute.ts`).
         */
        if (sourcePosition === Position.Bottom && targetPosition === Position.Top && targetY > sourceY) {
          const bend = Math.max(6, Math.min(30, (targetY - sourceY) / 2))
          return [
            `M${sourceX},${sourceY} C${sourceX},${sourceY + bend} ${targetX},${targetY - bend} ${targetX},${targetY}`,
            (sourceX + targetX) / 2,
            (sourceY + targetY) / 2,
            Math.abs(targetX - sourceX) / 2,
            Math.abs(targetY - sourceY) / 2,
          ] as [string, number, number, number, number]
        }
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
    }
  }, [sameRowRoute, pathType, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, visualProps.curvature])
  
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
  /**
   * The producer's stated spread on the weight, read through the SAME gate as
   * every other edge number. `resolveEdgeValueDisplay` cannot hand back a value
   * without naming its source, so an unset `strengthStd` — which
   * `USER_EDGE_DEFAULTS` pins at 0.15 for a hand-drawn edge — resolves
   * `{ show: false, reason: 'not_set' }` and explains nothing. That is the
   * whole safety argument for putting it back on this surface at all.
   */
  const edgeUncertainty = useMemo(
    () => resolveEdgeValueDisplay(edgeData as Record<string, unknown> | undefined, 'strengthStd'),
    [edgeData],
  )
  const edgeDescription = useMemo(
    () => getEdgeLabel(edgeSignedStrength, edgeLikelihood, directionDisplay, labelMode, edgeUncertainty),
    [edgeSignedStrength, edgeLikelihood, directionDisplay, labelMode, edgeUncertainty],
  )
  /**
   * ⛔⛔ AND THE DISCLOSURE TOO — `aria-label` REPLACES DESCENDANT TEXT, SO THE
   * VISIBLE MARKER IS ANNOUNCED NOWHERE UNLESS THE NAME CARRIES IT.
   *
   * The paragraph five lines above already records this exact rule, as a thing
   * that had been fixed. It recurred: the `est.` marker beside `desc.label`
   * went in, and the accessible name stayed built from `edgeDescription.label`
   * alone — so on the assistive channel a producer's unsettled strength and a
   * strength a human typed were BYTE-IDENTICAL, "Edge from n1 to n2, Moderate
   * boost (likelihood not set)", after the visible half of the fix had landed.
   * The marker carries no `aria-hidden`, so it was not deliberately hidden; it
   * was accidentally suppressed by the name on its own container.
   *
   * ⭐ ONE SENTENCE, ONE SOURCE, BOTH CHANNELS. This is the ratified estate
   * pattern from `NodeMetricRow` — `RiskNode`/`OutcomeNode` pass the SAME
   * `unconfirmedStrengthDisclosure(...)` string to `title` AND to the
   * screen-reader `phrase`, "why `phrase` carries the meaning for assistive
   * tech independently". The cards can use an `sr-only` span because their
   * container sets no name; this chip DOES set one, and a name overrides
   * descendants, so on this surface the same pattern is spelled by extending
   * the name. `ESTIMATE_SUBJECT_TITLE.strength` is the identical constant the
   * chip's `title` composition below consumes — IMPORTED, never re-typed, so a
   * reword of the sentence cannot leave the two channels telling different
   * stories (CLAUDE.md trap 12).
   *
   * Gated on `strengthUnconfirmed` alone rather than `showLabel && …`: this
   * name has exactly one consumer and that consumer already requires
   * `showLabel` (the chip's `aria-label`, which appends the fragility sentence
   * when the cue shares the chip).
   */
  /**
   * Can a double-click here actually change the model?
   *
   * ⭐ THE SAME DERIVATION THE PANEL FENCES ON, called rather than restated, so
   * the label and the control cannot drift into promising different things
   * (CLAUDE.md trap 12 — a second copy agrees on the day it is written).
   */
  const affordanceSentence = edgeDoubleClickAffordance(
    { id, source, target, data } as unknown as Parameters<typeof edgeDoubleClickAffordance>[0],
  )
  const strengthIsEditable = affordanceSentence === EDGE_AFFORDANCE_EDITABLE

  const ariaLabel =
    `Edge from ${srcTitle} to ${tgtTitle}${confText}, ${edgeDescription.label}` +
    (strengthUnconfirmed ? `. ${ESTIMATE_SUBJECT_TITLE.strength}` : '') +
    // ⭐ THE SAME PROMISE ON THE ASSISTIVE CHANNEL. A `title` is not reachable
    // by keyboard focus and is absent on touch, so a sighted keyboard user and
    // a screen-reader user would otherwise never learn the edge is editable at
    // all — the gap R13 records one level down, on the strength pills.
    (strengthIsEditable ? `. ${affordanceSentence}` : '')

  // Open the relationship's panel.
  //
  // ⚠⚠ THE COMMENT HERE READ *"Inspect the relationship… Inspector v2 owns the
  // visible READ-ONLY authority copy"* UNTIL 19 Sep 2026, AND IT HAD STOPPED
  // BEING TRUE. It was written when `InspectorRouter` wrapped the edge branch
  // in an unconditional `<fieldset disabled>` — the fence whose own removal
  // note records that "the strength slider rendered, and `setStrength` was
  // uncallable for every user". That fence is gone: the panel now edits the
  // strength on any edge the server has stated one for, and
  // `edgeStrengthEditIsAssertable` says which.
  //
  // ⛔ A STALE COMMENT IS CHEAP; THE WORD IT JUSTIFIED IS NOT. The hover text
  // below still said "Double-click to inspect", so the product's only standing
  // affordance for its edge editor described that editor as read-only.
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
    pointerWithinRef.current = true
    setIsHovered(true)
    if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null }
    if (isStructuralEdge) return
    // An Escape the user has just pressed outranks a pointer that never left.
    if (keyboardDismissedRef.current) return
    hoverPopoverTimerRef.current = setTimeout(() => setShowHoverPopover(true), 300)
  }
  const handleMouseLeave = () => {
    pointerWithinRef.current = false
    // Leaving the edge re-arms the popover: a dismissal applies to the visit it
    // was made in, not to the edge for ever.
    keyboardDismissedRef.current = false
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
    pointerWithinRef.current = true
    if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null }
  }
  const handlePopoverLeave = () => {
    pointerWithinRef.current = false
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

  /**
   * ⭐⭐ A13 — THE KEYBOARD PATH. This component had none, in any form.
   *
   * Swept at staging `99b46212`, target and contrast in the SAME sweep of this
   * SAME file, because a target reading zero is equally consistent with a
   * correct product and a blind probe (CLAUDE.md trap 13e):
   *
   *     grep -acE 'onFocus|onBlur|tabIndex|onKeyDown|focus-visible'  ->  0
   *     grep -acE 'onMouseEnter|onMouseLeave'                        ->  6
   *
   * Six mouse bindings, no keyboard binding. Everything this edge has to say —
   * direction, confidence, strength, fragility, and the two coaching chips that
   * dispatch turns to CEE — was reachable with a pointer and by nothing else.
   * WCAG 2.1 AA 1.4.13 (Content on Hover or Focus) is the standard, and a
   * keyboard user has no pointer to hover with.
   *
   * ── WHY THE LISTENER IS ON AN ANCESTOR AND NOT ON OUR OWN GROUP ────────────
   *
   * Derived at the bytes of the pinned library, `@xyflow/react@12.10.2`
   * (`dist/esm/index.mjs`, `EdgeWrapper`):
   *
   *     const isFocusable = !!(edge.focusable || (edgesFocusable && typeof edge.focusable === 'undefined'))
   *     tabIndex: isFocusable ? 0 : undefined,
   *
   * with `edgesFocusable: true` in the store defaults, and `ReactFlowGraph.tsx`
   * passing neither `edgesFocusable` nor `disableKeyboardA11y` — so the default
   * governs and **every edge is already a tab stop.** React Flow already owns
   * the focus target: `g.react-flow__edge`, an ANCESTOR of the group this
   * component renders. `focusin` bubbles UP, so a listener bound here could
   * only ever see a DESCENDANT take focus, never the ancestor that actually
   * receives it. Adding our own `tabIndex` instead would give every edge two
   * tab stops, which is a second defect, not a fix.
   *
   * This is the same structure, and the same resolution, as the node preview at
   * `hooks/usePopoverHover.ts:176-223` — only the class name differs.
   *
   * ── WHY `:focus-visible` AND NOT PLAIN FOCUS ──────────────────────────────
   *
   * A mouse click focuses the edge too (React Flow's own click handler runs on
   * this element). Opening on every click would bypass the 300ms hover intent
   * the pointer path exists to provide, and would change a behaviour nobody
   * asked to change. The pseudo-class is the browser's own answer to "was this
   * a keyboard focus", and it is already this repo's idiom.
   *
   * ⚠ THE FALLBACK DIRECTION IS DELIBERATE. A DOM implementation that does not
   * know the selector throws rather than answering false, so the call is
   * guarded — and the guard returns TRUE. Failing toward MORE recovery is
   * correct here: a popover that opens when it need not is a nuisance, one that
   * will not open is the defect this closes.
   *
   * ── NO DELAY ON THIS PATH ─────────────────────────────────────────────────
   *
   * The 300ms enter delay models a pointer PASSING OVER an edge on its way
   * somewhere else. A Tab is never accidental in that way, so making a keyboard
   * user wait is latency bought for no benefit.
   */
  useEffect(() => {
    const group = edgeGroupRef.current
    if (!group) return
    const rfEdge = group.closest('.react-flow__edge')
    if (!rfEdge) return

    const isKeyboardFocus = (el: Element): boolean => {
      try {
        return el.matches(':focus-visible')
      } catch {
        return true
      }
    }

    const focusIn = (event: FocusEvent) => {
      // ONLY the edge's own focus ring. A control that happens to sit inside
      // must not be treated as the edge being focused.
      if (event.target !== rfEdge) return
      if (!isKeyboardFocus(rfEdge)) return
      // A keyboard user arriving deliberately outranks an earlier Escape.
      keyboardDismissedRef.current = false
      if (hoverPopoverTimerRef.current) { clearTimeout(hoverPopoverTimerRef.current); hoverPopoverTimerRef.current = null }
      if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null }
      // The label, the thicker stroke and the fragility marker are all gated on
      // `isHovered`, so focus must set it too — otherwise "available on focus"
      // would mean the popover only, and a keyboard user would still be missing
      // what a pointer user sees. It also gives the edge a visible focus state.
      setIsHovered(true)
      // Structural edges have no causal popover in ANY modality; they carry a
      // native title on the hitbox instead. Matching the pointer path's own
      // exclusion, not exceeding it.
      if (isStructuralEdge) return
      setShowHoverPopover(true)
    }

    /**
     * Does focus REMAIN on a surface this edge owns?
     *
     * ⚠ `contains()` ALONE WOULD BE WRONG. `EdgeLabelRenderer` portals the
     * popover out of this edge's group, so the popover is NOT a DOM descendant
     * of the element losing focus — closing on containment would destroy the
     * popover the instant a keyboard user tabbed into the very content it was
     * opened to show, including both coaching chips.
     *
     * ⭐⭐ AND `[data-edge-popover]` ALONE IS ALSO WRONG — it is a predicate
     * ANOTHER OBJECT SATISFIES (CLAUDE.md trap 19). Every edge's popover
     * carries that attribute, so with two edges on the canvas this edge's
     * handler read the OTHER edge's popover as "inside mine" and held its own
     * popover open while focus was demonstrably elsewhere — the same stale
     * edge context, reached by a second route. The exception is therefore
     * granted BY IDENTITY: the attribute carries this edge's id, and only the
     * element stamped with THIS id qualifies.
     */
    const focusStaysWithinThisEdge = (next: EventTarget | null): boolean => {
      if (!(next instanceof Element)) return false
      if (rfEdge.contains(next)) return true
      const owner = next.closest('[data-edge-popover]')
      return owner !== null && owner.getAttribute('data-edge-popover') === edgeIdKey
    }

    const focusOut = (event: FocusEvent) => {
      if (focusStaysWithinThisEdge(event.relatedTarget)) return
      // The pointer still owns this edge or its popover; the mouse path's own
      // leave handler will close it.
      if (pointerWithinRef.current) return
      if (hoverPopoverTimerRef.current) { clearTimeout(hoverPopoverTimerRef.current); hoverPopoverTimerRef.current = null }
      setIsHovered(false)
      setShowHoverPopover(false)
    }

    /**
     * ⭐⭐ THE LISTENER IS BOUND TO BOTH SURFACES THIS EDGE OWNS.
     *
     * `focusout` bubbles, but only within its own tree. The popover is portalled
     * into a SIBLING subtree, so once focus is inside it, tabbing onward emits
     * `focusout` from the PORTAL — it never reaches the edge group, and a
     * listener bound to the edge alone is never called. Nothing then closed the
     * popover or the highlight, so stale edge context stayed on screen as the
     * user moved on. Observing departure from the popover as well is what closes
     * that leak, and it is why `showHoverPopover` is a dependency here: the
     * element does not exist until the popover has mounted.
     */
    const popoverEl = popoverElRef.current
    rfEdge.addEventListener('focusin', focusIn as EventListener)
    rfEdge.addEventListener('focusout', focusOut as EventListener)
    popoverEl?.addEventListener('focusout', focusOut as EventListener)
    return () => {
      rfEdge.removeEventListener('focusin', focusIn as EventListener)
      rfEdge.removeEventListener('focusout', focusOut as EventListener)
      popoverEl?.removeEventListener('focusout', focusOut as EventListener)
    }
  }, [isStructuralEdge, edgeIdKey, showHoverPopover])

  /**
   * ⭐ DISMISSIBLE — the second of WCAG 1.4.13's three obligations, and the one
   * this component failed in every modality: it had no key handler at all.
   *
   * The popover must be removable WITHOUT moving the pointer or the keyboard
   * focus, because a keyboard user who tabs to an edge and is shown a popover
   * they cannot close has had content forced on them. `keyboardDismissedRef`
   * then holds it shut until the user leaves and returns, so the dismissal is
   * not undone by the same visit that provoked it.
   */
  useEffect(() => {
    if (!showHoverPopover) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      keyboardDismissedRef.current = true
      if (hoverPopoverTimerRef.current) { clearTimeout(hoverPopoverTimerRef.current); hoverPopoverTimerRef.current = null }
      if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null }
      setShowHoverPopover(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [showHoverPopover])

  // Graph Editing Experience Task 9c: Persistent labels on top 3 edges
  // Pre-analysis: rank by |strength.mean|. Post-analysis: rank by composite importance.
  // Structural edges (decision→option) are excluded from ranking.
  // E3 refactor: the ranking now yields the persistent-label ID SET so both
  // the per-edge flag AND the label-collision pass share one computation.
  // contract v3.1 (U10): EMPTY in the default view, which paints no strength
  // label — so the placement pass clears no box for a label that cannot paint.
  const topStrengthIds = useMemo((): Set<string> => {
    if (!viewShowsStrengthLabels(viewMode)) return new Set()
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
  }, [getEdges, getNode, isResultsMode, report, viewMode])

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

  /**
   * ⭐ WHETHER THE CUE IS PAINTED — a different question from whether the edge
   * is a MEMBER (`showFragileRow`), and kept separate on purpose.
   *
   * Experience Design, 23 Sep 2026: fragility is a DISCREET EXCEPTION CUE, and
   * the spec's §5 "Exception markers" allows one "at readable zoom" only. The
   * far `line` rung is where the ladder itself says card text would paint below
   * the canvas floor (`lodBodyHiddenAt` — the cards blank their bodies there),
   * and a 12px triangle beside it would paint as a speck that says nothing. So
   * the cue is not painted at `line`. The fact is not lost: the hover still
   * names it ("NN% flip risk"), and zooming in brings the cue back.
   *
   * ⚠ MEMBERSHIP, AND THEREFORE PLACEMENT, DO NOT READ THE RUNG. The placement
   * pass (`isPersistentChipEdge`, `fragileLabelIds`) still clears this row's box
   * at every rung, so crossing the rung never moves a neighbouring chip — the
   * only zoom behaviour this adds is the cue's absence at `line`. No new
   * threshold: `line` is the ladder's own rung, written by `LodSync`.
   *
   * The BUDGET is unchanged and is not re-decided here: every sensitive
   * connection in Detailed view, the single top one in Standard (E4).
   */
  const paintFragileCue = showFragileRow && !isLodBodyHidden

  const isPersistentChipEdge = isTopStrengthEdge || showFragileRow

  // E3 part 2 (C2): subscribe to node geometry so a label re-dodges when ANY
  // node card moves onto it (this edge's own props only change when its own
  // endpoints move). Perf posture: only persistent-chip edges (top-strength,
  // max 3, plus the fragility cue's budget) compute a signature — every other
  // edge returns '' and never re-renders from node movement. contract v3.1
  // (U10): keyed on the CHIP, not the strength row, because the default view's
  // only persistent chip is now the fragility cue, and it must still re-dodge.
  // While a node is DRAGGING its position is quantised to a 10px
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
    if (!isPersistentChipEdge) return ''
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
    // The same boxes the same-row route above resolves against (visible,
    // measured cards), so every edge's placement anchor matches where that
    // edge actually renders its label (`sameRowRoute.ts` `labelAnchor`).
    const routeBoxes: RouteBox[] = []
    for (const n of getNodes()) {
      if (n.hidden || lensHiddenNodeIds.has(n.id)) continue
      const box = routeBoxOf(n as Parameters<typeof routeBoxOf>[0])
      if (box) routeBoxes.push(box)
    }
    const routeAnchorFor = (e: { id: string; source: string; target: string; data?: unknown }) => {
      // This edge: exactly the route it renders (its own handle positions
      // decide whether it routes at all — a Right→Left edge never does).
      if (e.id === id) return sameRowRoute?.labelAnchor ?? undefined
      const pt = (e.data as { pathType?: EdgePathType } | undefined)?.pathType ?? 'bezier'
      if (pt === 'straight' || pt === 'smoothstep') return undefined
      const src = routeBoxes.find((b) => b.id === e.source)
      const tgt = routeBoxes.find((b) => b.id === e.target)
      if (!src || !tgt) return undefined
      // Another edge: BaseNode and the ghost nodes declare one source handle
      // (Bottom) and one target handle (Top), so its render guard reduces to
      // the handle-height test — which the resolver's row-band overlap
      // already implies (target top above source bottom).
      const others = routeBoxes.filter((b) => b.id !== e.source && b.id !== e.target)
      return resolveSameRowRoute(src, tgt, others)?.labelAnchor ?? undefined
    }
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
      const anchor = routeAnchorFor(e)
      placementEdges.push({ id: e.id, sourceRect: rectOf(sn), targetRect: rectOf(tn), rows, ...(anchor ? { anchor } : {}) })
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
  }, [isPersistentChipEdge, topStrengthIds, fragileLabelIds, getEdges, getNode, getNodes, id, lensHiddenNodeIds, lensHiddenEdgeIds, nodeRectsSignature, sameRowRoute])

  // Total label displacement (Task 9c proximity nudge + collision stack),
  // relative to the rendered label anchor (labelX/labelY).
  const labelOffsetX = collisionOffset.dx
  const labelOffsetY = collisionOffset.dy

  // C1: label-visibility policy (see edgeLabelVisibility.ts). contract v3.1
  // (U10) withdrew E2: the default (standard) view paints no strength label;
  // Detailed/Model keeps its top-strength labels and interaction triggers.
  // Strength stays reachable in every view via the hover and the inspector.
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

  const showChip = showLabel || paintFragileCue

  /**
   * contract v3.1 (E10): the chip carries the fragility cue and NOTHING else —
   * the default view's normal case since U10 withdrew resting strength labels.
   * Then it is the contract's standalone cue disc, a focusable control, rather
   * than a white rectangle around one icon.
   */
  const fragileCueOnly = paintFragileCue && !showLabel
  const handleFragileCueActivate = (event: React.SyntheticEvent) => {
    event.stopPropagation()
    openEdgeStrengthEditor(edgeIdKey)
  }
  const handleFragileCueKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    // Space would otherwise scroll, and React Flow must not also see the key.
    event.preventDefault()
    handleFragileCueActivate(event)
  }

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
  /**
   * ⭐⭐ DOES THE LABEL ACTUALLY PAINT THE DIRECTION IT CLAIMS TO?
   *
   * `labelCarriesDirection` answers that about the STRING. At the whole-model
   * zoom the string is not what a reader sees: the chip is capped at
   * `LABEL_HALF_WIDTH * 2` GRAPH units while the font counter-scales UP for
   * legibility, so the text ellipsises. ⭐ THAT CAUSE IS CLOSED (14 Sep 2026 —
   * the cap now carries the counter-scale), and this measurement STAYS: it asks
   * the PAINT rather than the arithmetic, which is the only thing that can
   * catch the next way a label outgrows its box. Measured on deployed `e5a62322`:
   * `Moderate boost` needs 151px and gets 103px, `Moderate drag` needs 141px —
   * and BOTH paint `Moderat…`. `distinctPainted` across three chips was exactly
   * ONE string. Two opposite causal claims, identical on screen.
   *
   * ⛔ AND THE GLYPH THAT WOULD TELL THEM APART IS SUPPRESSED *BECAUSE OF* THAT
   * LABEL. `directionStroke.ts:23-32` measured this palette as separating WORSE
   * for a dichromat than the green/red it replaced (ΔE2000 11.7 vs 28.3 under
   * deuteranopia), which is why the block below says the shape "IS NEVER
   * DELETED" — yet on a truncated label polarity falls back to hue alone,
   * exactly the state that file forbids.
   *
   * ⚠ THIS FILE HAS ALREADY FIXED THIS SHAPE ONCE. The numeric arm of
   * `labelCarriesDirection` carries a clause added because "the predicate
   * asserted its own name rather than checking it". Truncation is the same
   * defect through a different door, and it is why this asks the PAINT rather
   * than widening the predicate again.
   *
   * ⭐ IT STARTS `true` — GLYPH SHOWN — AND THAT DIRECTION IS DELIBERATE. The
   * measurement can only run once the chip is in the document, so the first
   * frame has no answer. Assuming "not truncated" would suppress the glyph on a
   * guess; assuming truncated shows a redundant mark for one frame. Only one of
   * those two errors loses a channel a dichromat depends on.
   */
  const strengthLabelRef = useRef<HTMLSpanElement | null>(null)
  const [strengthLabelTruncated, setStrengthLabelTruncated] = useState(true)
  useLayoutEffect(() => {
    // No dependency array, deliberately: the overflow changes with ZOOM, which
    // moves the counter-scaled font size without changing any prop, any state or
    // the element's own box. A dep list keyed on the label text would go stale
    // the moment the user zoomed — which is the only time this matters.
    const el = strengthLabelRef.current
    // No element means no chip on screen; hold the fail-safe value rather than
    // reporting "not truncated" about something that is not rendered.
    if (!el) return
    const truncated = el.scrollWidth > el.clientWidth + 1
    // Guarded: an unconditional setState in an effect with no deps re-renders
    // for ever.
    setStrengthLabelTruncated((prev) => (prev === truncated ? prev : truncated))
  })

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
    labelCarriesDirection(edgeSignedStrength, directionDisplay, labelMode) &&
    // ⛔ AND IT MUST ACTUALLY BE LEGIBLE. See `strengthLabelTruncated`: a label
    // ellipsised to `Moderat…` states no direction to a reader, whatever the
    // string says.
    !strengthLabelTruncated

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
    if ((!statedDirection && !isSignDisputed) || isStructuralEdge) return ''
    // ⚠ TOLERATE A PARTIAL STORE SLICE. Eleven existing edge suites hand
    // `useStore` a hand-built object with `nodes` and no `edges`, and an
    // unguarded `for (const e of st.edges)` throws inside render — it took out
    // 82 tests. The product always supplies both; a mock need not, and a
    // component that crashes on a narrower slice than it expected is brittle
    // regardless of who supplied it.
    const storeNodes = Array.isArray(st.nodes) ? st.nodes : []
    const storeEdges = Array.isArray(st.edges) ? st.edges : []
    // ⚠ NOT A CLAIM ABOUT THESE VALUES — a local narrowing around a PRE-EXISTING
    // typing break in this file. `EdgeProps<EdgeData>` does not resolve here, so
    // `id`, `source` and `target` all arrive as `unknown` and several of this
    // file's 27 baseline type errors are exactly that. React Flow supplies them
    // as strings; narrowing locally keeps the ratchet honest instead of adding
    // four more errors to a file that already carries the problem.
    const selfId = id as string
    const selfSource = source as string
    const selfTarget = target as string
    const nodeById = new Map(storeNodes.map((n) => [n.id, n]))
    const centreOf = (nodeId: string): { x: number; y: number } | null => {
      const n = nodeById.get(nodeId)
      if (!n) return null
      const w = n.measured?.width ?? n.width ?? 200
      const h = n.measured?.height ?? n.height ?? 80
      // `position` is the parent-relative top-left; `internals.positionAbsolute`
      // is what React Flow itself uses to place the handles this offset is
      // applied at, so it is the basis that cannot disagree with `targetX/Y`.
      // Read structurally because the store types `nodes` as `Node`, which does
      // not carry `internals` — and `position` is the correct answer anyway
      // wherever nothing is parented, which is every node this app builds.
      const internals = (n as { internals?: { positionAbsolute?: { x: number; y: number } } }).internals
      const pos = internals?.positionAbsolute ?? n.position
      if (!pos) return null
      return { x: pos.x + w / 2, y: pos.y + h / 2 }
    }
    // ⚠ A MISSING TARGET NODE MUST NOT COLLAPSE BACK TO ONE POINT. An earlier
    // draft returned a single constant offset here, which is the ORIGINAL
    // DEFECT wearing a fallback's clothes — every edge into the node would
    // share it again. Instead the whole group is handed null directions, which
    // is the resolver's degraded branch: index-by-id radii, still pairwise
    // distinct. A fallback for an unreachable state is still a state.
    const targetCentre = centreOf(selfTarget)
    const siblings: GlyphSibling[] = []
    for (const e of storeEdges) {
      // Every edge into this target, INCLUDING structural ones and ones whose
      // glyph is suppressed. Deliberate: the assignment must not shift when a
      // neighbour's chip appears on hover, or the glyph would jump under the
      // pointer. A reserved-but-unused slot costs nothing.
      if (e.target !== selfTarget) continue
      siblings.push({ id: e.id, sourceCentre: targetCentre ? centreOf(e.source) : null })
    }
    // This edge is rendering, so it exists — even if the store slice handed to
    // the selector has not caught up. Without this the resolver takes its
    // caller-bug path and every such edge shares one offset.
    if (!siblings.some((sib) => sib.id === selfId)) {
      siblings.push({ id: selfId, sourceCentre: targetCentre ? centreOf(selfSource) : null })
    }
    const { dx, dy } = resolvePolarityGlyphOffset(selfId, targetCentre ?? { x: 0, y: 0 }, siblings)
    return `${Math.round(dx * 100) / 100},${Math.round(dy * 100) / 100}`
  })

  const glyphOffset = useMemo(() => {
    if (glyphOffsetKey === '') {
      // ⚠ REACHED ONLY WHERE NO GLYPH RENDERS. The selector returns '' from its
      // opening gate and nowhere else, and that gate is a subset of the render
      // predicate below (`statedDirection && !isStructuralEdge && ...`). So this
      // constant is never the placement of a PAINTED glyph — which matters,
      // because a constant here would be the original defect returning by the
      // back door. Kept non-zero anyway rather than left to imply the handle
      // anchor itself. If a future edit adds an early '' return on a path that
      // DOES render, that edit has to come back and change this.
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
    existence: existenceDash,
    // `visualPropsDash` is no longer passed: dash is existence certainty ONLY
    // (Paul 23 Sep contract feedback point 4; `EDGE_DASH_RULES`).
  }), [
    isStructuralEdge, lensMode, causalEdgeParams, evidenceEdgeClass, contested,
    isHighlightedEdge, directionStroke, existenceDash,
  ])
  const edgeStroke = useMemo(() => resolveEdgeStroke(presentationState), [presentationState])

  // ⭐ THE UNCERTAINTY RIBBON (see `uncertaintyBandHalfWidth`). `strengthStd`
  // reached the store, the inspector and the user's own edit control, and never
  // reached the board — so a team read every causal claim at equal confidence.
  //
  // Through the provenance gate, NOT off `edgeData.strengthStd`:
  // `USER_EDGE_DEFAULTS` writes 0.15 unstamped, so a raw read would paint a
  // ribbon on every hand-drawn edge announcing an uncertainty nobody stated.
  // Same refusal the stroke width makes at :455 for the same reason.
  //
  // Memoised on `edgeData` because the resolver returns a fresh object each
  // call — the identity discipline the direction and signed-strength memos
  // above already keep.
  const uncertaintyBand = useMemo(() => {
    const display = resolveEdgeValueDisplay(edgeData as Record<string, unknown> | undefined, 'strengthStd')
    return uncertaintyBandHalfWidth(display)
  }, [edgeData])
  const edgeDash = useMemo(() => resolveEdgeDash(presentationState), [presentationState])

  // ⭐ DIRECTION OF CAUSATION. Measured on deployed staging 7 Sep 2026: 39 edges,
  // zero arrowheads — the most basic thing a causal graph must state had no
  // channel. The rule (structural / non-directional type / causal) and the
  // arrowhead geometry live in `edgePresentation`, beside the stroke and dash
  // precedences, so all three of an edge's presentation decisions are reviewable
  // in one place and none of them is an early-return chain pasted in here.
  const directionMarker = useMemo(
    () => resolveEdgeDirectionMarker({
      isStructural: isStructuralEdge,
      edgeType: (data as Record<string, unknown> | undefined)?.edge_type,
    }),
    [isStructuralEdge, data],
  )
  const arrowheadId = useMemo(() => edgeArrowheadMarkerId(edgeIdKey), [edgeIdKey])

  // Causal lens: hide structural edges entirely
  if (isLensHidden) return null

  return (
    <>
      {/* Wrapper captures hover for the entire edge hit area. Hover handlers live
          here so they fire regardless of whether the pointer is over the custom
          hitbox path or BaseEdge's interaction path (which renders on top in SVG
          paint order). Both paths bubble mouseenter/mouseleave to this <g>. */}
      {/* ⭐ contract v3.1 (E6, 24 Sep 2026) — THE SELECTION DIM IS THE WHOLE
          CONNECTION'S, NOT THE LINE'S. It used to be a 0.25 on `BaseEdge` alone,
          so the ribbon, the assistant halo and the arrowhead's line dimmed
          unevenly and the portalled glyph and chip floated at full strength
          over a faded line. The contract dims `.edge-group` as one unit, and DS
          v5 §7.4 names 20%; the portalled marks below carry the same value. */}
      <g
        ref={edgeGroupRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        data-analysis-fragile={isAnalysisFragileEdge && !isStructuralEdge ? 'true' : undefined}
        data-assistant-focused={isAssistantFocused ? 'true' : undefined}
        data-selection-dimmed={isSelectionDimmed ? 'true' : undefined}
        data-same-row-route={sameRowRoute?.kind}
        style={{
          opacity: isSelectionDimmed ? EDGE_SELECTION_DIM_OPACITY : undefined,
          transition: prefersReducedMotion ? 'none' : 'opacity 300ms ease',
        }}
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
      {/* ⭐ THE UNCERTAINTY RIBBON. Drawn BEFORE `BaseEdge`, so SVG paint order
          puts it behind the line rather than over it — the line keeps its own
          width channel fully readable and the ribbon reads as spread around it.
          Structural edges are excluded: decision→option and option→factor are
          scaffolding, not causal claims, and have no strength to be uncertain
          about.

          Drawn in EVERY lens mode on purpose. The lenses repaint and re-width
          the LINE; this is a separate mark with one fixed meaning, so "how firm
          is this claim" survives switching lens — which is the question a lens
          most often raises.

          ⛔ CORRECTED 18 Sep 2026 — THIS COMMENT ARGUED THE OPPOSITE OF THE LINE'S
          OWN COMMENT, AND THE LINE'S IS RIGHT. It used to read: "No `vectorEffect`:
          the width is in GRAPH units and scales with zoom, exactly like
          `EDGE_STROKE_WIDTH_BANDS`. A non-scaling ribbon would hold constant screen
          width while the model shrank, and swamp it."

          `EDGE_STROKE_WIDTH_BANDS` is exactly what it does NOT do: the line is
          `non-scaling-stroke`, and the comment beside it states the principle —
          "thickness here is an ENCODING of strength, not a drawing property, so it
          should mean the same thing at every zoom rather than growing with the
          camera." Band width encodes UNCERTAINTY. The same sentence applies word for
          word, and the two decisions were simply made at different times and never
          put side by side (trap 21, inside one feature).

          MEASURED CONSEQUENCE on served 1212e2eb at the camera the board opens at
          (`output/canvas-witness-20260917/ribbon-occlusion.json`): camera 0.5 read
          off the viewport transform · line `non-scaling-stroke`, so 1/2/3/4px on
          screen · ribbon in graph units, halved · thinnest ribbon 4.28px against a
          4px line · margin 0.282px · 0.0565px once the 0.2 opacity applies. The
          floor of the uncertainty channel was INVISIBLE, hidden inside the line it
          wraps, so a tight well-measured uncertainty and one never assessed both
          rendered as a bare line. The acceptance witness that passed for this
          feature checked that the ribbon painted WHERE STAMPED and never asked
          whether it could be SEEN — this spec file's own header had already said
          visibility "only a browser can settle", and nobody went and settled it.

          The swamping worry is real and is answered by the bound that already
          exists, `UNCERTAINTY_BAND_MAX_HALF_WIDTH`, not by letting the encoding
          evaporate as the camera pulls back.

          `pointerEvents="none"` — the hit area is the transparent path above,
          which is already wider than anything drawn. A ribbon that grew the hit
          area would make uncertain edges easier to click than firm ones.

          ⭐⭐ contract v3.1 (E1/T08, 24 Sep 2026) — TRANSIENT, AND NEUTRAL.
          A resting connection is ONE stroke: colour = direction, width =
          strength, dash = existence doubt. Drawn at rest in the polarity hue,
          this ribbon read as a soft green or rose glow around every stamped
          edge — the "soft glow halo" on the v3.1 review — and spent the
          polarity colour on a second quantity. It now paints only while the
          connection is hovered, keyboard-focused (focus sets `isHovered`) or
          selected, in the neutral ink `UNCERTAINTY_BAND_STROKE` that the legend
          swatch also reads. The encoding above (screen-px width, floor,
          ceiling, provenance gate) is unchanged; only WHEN and in WHAT INK. */}
      {uncertaintyBand !== null && !isStructuralEdge && (selected || isHovered) && (
        <path
          d={edgePath}
          fill="none"
          stroke={UNCERTAINTY_BAND_STROKE}
          strokeWidth={uncertaintyBand * 2}
          strokeLinecap="round"
          opacity={UNCERTAINTY_BAND_OPACITY}
          pointerEvents="none"
          vectorEffect="non-scaling-stroke"
          data-testid={`edge-uncertainty-band-${edgeIdKey}`}
          data-uncertainty-half-width={uncertaintyBand}
        />
      )}
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
      {/* ⭐ THE DIRECTION MARK. One `<marker>` per marked edge, and the reason is
          COLOUR: stroke colour is decided by an ordered rule precedence
          (`EDGE_STROKE_RULES`) whose outputs include a `color-mix(…)`, two
          `var(…)` tokens and the polarity stroke. A single shared `<defs>` entry
          cannot know which rule won, so it would be a second copy of a decision
          that already has an authority — the hand-maintained mirror this estate
          keeps paying for. This reads `edgeStroke.value`: the SAME resolved
          decision that sets `stroke` two elements below. One quantity, two
          readers, so a new or reordered rule carries the arrow with it and no
          edit is needed here at all.

          SVG 2's `fill="context-stroke"` would do this in one shared marker.
          Deliberately not used: this lane has no browser witness, and a feature
          whose failure mode is a black arrowhead on every edge cannot be
          verified with the instruments in hand. An explicit fill can be.

          `markerUnits="userSpaceOnUse"` decouples the mark from stroke width.
          Under the default (`strokeWidth`) a selected edge — width 4 rather
          than 2 — would get a double-sized arrowhead, leaking the interaction
          channel into the direction channel.

          `refX` sits at the tip of the viewBox, so the point lands ON the path's
          end rather than overshooting into the node card. ⚠ THE NODE CARD IS NOT
          THE NEAREST NEIGHBOUR AT THIS END — the `+`/`−` polarity glyph is, 26
          graph units back on very nearly the same axis, and the first version of
          this mark abutted it at exactly 0.0px of clearance. That is why the
          mark's LENGTH is derived from the glyph rather than chosen; the
          derivation, the measurement and its honest limits are at
          `EDGE_ARROWHEAD_FLOW_LENGTH` in `edges/edgePresentation.ts`. Length and
          width are two different quantities here and the viewBox is derived from
          both, because a viewBox with a different aspect ratio would be
          LETTERBOXED by the default `preserveAspectRatio` rather than
          stretched. */}
      {directionMarker.show && (
        <marker
          id={arrowheadId}
          viewBox={EDGE_ARROWHEAD_VIEWBOX}
          markerWidth={EDGE_ARROWHEAD_FLOW_LENGTH}
          markerHeight={EDGE_ARROWHEAD_FLOW_WIDTH}
          refX={EDGE_ARROWHEAD_FLOW_LENGTH}
          refY={EDGE_ARROWHEAD_FLOW_WIDTH / 2}
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <polygon points={EDGE_ARROWHEAD_POLYGON_POINTS} fill={edgeStroke.value} />
        </marker>
      )}
      <BaseEdge
        id={id}
        path={edgePath}
        interactionWidth={EDGE_HIT_AREA_WIDTH}
        // Target end only. The mark states ONE direction of causation; a
        // marker-start as well would read as bidirectional, which is the claim
        // the `non_directional_type` rule exists to refuse.
        markerEnd={directionMarker.show ? `url(#${arrowheadId})` : undefined}
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
            //
            // ⭐ contract v3.1 (E4, 24 Sep 2026) — RELATIVE, NOT A FLOOR. These
            // were `Math.max(w, 4)` / `Math.max(w, 3)`: a slight edge that was
            // selected drew exactly as thick as a strong one, and hover flattened
            // slight and moderate to one width, so interaction ERASED the one
            // ordering the width key teaches ("Width = modelled strength. Same
            // meaning before and after analysis"). An offset keeps every rung in
            // order in every state; DS v5 §7.3's hover is "+1" (1.5px → 2.5px).
            if (selected) return edgeStrokeWidth + 2
            if (isHovered || isHighlightedEdge) return edgeStrokeWidth + 1
            return edgeStrokeWidth
            })()
            // Analysis-graph projection: a viewed flip-risk edge is marked by its
            // info glow in the `filter` below, and NO LONGER by a width floor
            // (contract v3.1, E4): `Math.max(base, 4)` drew a slight flip risk as
            // thick as a strong one, the same erasure as above. Colour is never
            // replaced; the glow is the transient viewing cue.
            return base
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
          // contract v3.1 (E13): `.edge-visual{stroke-linecap:round}` — but only
          // on a SOLID line. A round cap adds half the stroke width to each end
          // of every dash, so on a 3-4px line the contract's own `6 4` pattern
          // closes its gap and the existence-doubt dash stops reading as a dash.
          // Dashed lines keep butt caps so the one channel dash carries survives.
          strokeLinecap: edgeDash.value ? 'butt' : 'round',
          stroke: edgeStroke.value,
          // Opacity is a lens-only channel now. exists_probability is a SINGLE
          // encoding — the dash (existenceDash above), which stays
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
          // contract v3.1 (E6): a SELECTION-dimmed edge is dimmed on the
          // wrapping <g> (above), as one unit with its ribbon, halo and marks, so
          // the line adds nothing of its own there — a second factor here would
          // compound to 0.04. Lens dimming keeps its line-level 0.2 otherwise.
          opacity: isSelectionDimmed ? undefined
            : isLensDimmed ? 0.2
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
              shadows.push(EDGE_GLOW.sensitivity)
            if (isAnalysisFragileEdge && !isStructuralEdge)
              // R6: the fragility halo moves off the warning hue with the
              // fragility chips it accompanies — under the DEFAULT lens, orange
              // on an edge means Olumi's two review passes disagree about its
              // SIGN, and nothing else (23 Sep 2026). (The evidence LENS keeps its own
              // orange for 'assumed': a lens is an explicit alternative
              // encoding with its own key, not the default vocabulary.)
              shadows.push(EDGE_GLOW.flipRisk)
            // 6B: hover / selection emphasis for the WHOLE connection.
            // Deliberately a drop-shadow rather than a stroke colour: the stroke
            // already carries direction polarity (green/red) and the resolution
            // below lets directionStroke win, so a hover colour would either be
            // invisible on signed edges or would overwrite polarity — which is a
            // semantic change this lane must not make. A glow is a separate CSS
            // channel, so it composes with polarity exactly like the fragile
            // halo above. Not applied to a selection-dimmed edge.
            //
            // GAP 1 fix (design-gap audit row 13): a highlighted PATH edge
            // (a node's selection, not the edge's own `selected`) gets the
            // SAME soft glow recipe — the emphasis contract §03 asks for —
            // now that `resolveEdgeStroke` no longer recolours it to Info
            // blue (`edgePresentation.ts`, the `highlighted` rule). Checked
            // after `selected` so an edge that is BOTH keeps the plain
            // selected glow rather than composing two identical shadows.
            if (!isSelectionDimmed) {
              if (selected) shadows.push(EDGE_GLOW.selected)
              else if (isHighlightedEdge) shadows.push(EDGE_GLOW.selected)
              else if (isHovered) shadows.push(EDGE_GLOW.hover)
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
      {/* ⭐ Paul 23 Sep contract feedback point 9: a SIGN dispute draws `±`
          on the amber stroke, and it is drawn even when the strength row's
          words carry a direction — those words are the FIRST pass's sign, the
          disputed one, so they cannot stand in for the dispute cue. */}
      {(statedDirection || isSignDisputed) && lensMode !== 'causal' && !isStructuralEdge && (isSignDisputed || !strengthRowCarriesDirection) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              // A same-row route ends away from the top handle, so its glyph sits
              // where that route's arrow is (`sameRowRoute.ts`).
              transform: sameRowRoute
                ? `translate(-50%, -50%) translate(${sameRowRoute.glyphX}px,${sameRowRoute.glyphY}px)`
                : `translate(-50%, -50%) translate(${targetX + glyphOffset.dx}px,${targetY + glyphOffset.dy}px)`,
              pointerEvents: 'none',
              // contract v3.1 (E2/T09): the glyph knocks the line out behind it.
              textShadow: POLARITY_GLYPH_HALO,
              // contract v3.1 (E6): dims with its connection, never floats over it.
              opacity: isSelectionDimmed ? EDGE_SELECTION_DIM_OPACITY : undefined,
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
            //
            // ⭐ SEMIBOLD — Paul 23 Sep contract feedback point 12: "`+ / −`
            // must remain interpretable at readable zoom". At regular weight a
            // counter-scaled "−" is a hairline beside a 2px stroke; 600 is the
            // contract's own polarity weight. Size and ink are unchanged.
            className={`${typography.edgeLabel} font-semibold text-text-body`}
            aria-label={
              isSignDisputed
                ? `Effect direction: ${DIRECTION_DISPUTED_SENTENCE}`
                : `Effect direction: ${statedDirection}`
            }
            // ⭐ IDENTITY BINDING. Without it the only way to attribute a glyph
            // to an edge is its ORDER in the portal, and `EdgeLabelRenderer`
            // portals every edge's children into one flat layer — so the Nth
            // glyph is not the Nth edge whenever any edge renders no glyph.
            // CLAUDE.md trap 19: an assertion binds to its object by IDENTITY.
            // This is what lets the browser measure below count glyph-on-glyph
            // stacking BY EDGE rather than by a value predicate.
            data-edge-id={id}
          >
            {isSignDisputed ? '±' : statedDirection === 'positive' ? '+' : '−'}
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
              // contract v3.1 (E10): a cue-only chip is the contract's 16px
              // disc (`<circle class="cue-bg" r="8"/>`), counter-scaled like the
              // text so it is 16px ON SCREEN; with a strength row it keeps the
              // row form. The disc sits inside the one-row box the placement
              // pass already clears (`labelHalfHeightForRows(1)`), so no
              // neighbouring chip moves.
              ...(fragileCueOnly
                ? {
                    padding: 0,
                    width: FRAGILE_CUE_DISC_SIZE,
                    height: FRAGILE_CUE_DISC_SIZE,
                    borderRadius: 9999,
                    justifyContent: 'center',
                  }
                : { padding: '3px 8px', borderRadius: '4px' }),
              /* ⭐⭐ THE CAP CARRIES THE SAME COUNTER-SCALE AS ITS TEXT.
                 Without the `calc`, the box is in fixed graph units while the
                 text inside is `calc(11px * var(--canvas-label-scale))` — so at
                 the zoom the product's auto-fit parks at, the font doubles and
                 the box does not, and the chip holds half the characters it was
                 sized for. That is the founder's "Moder… est." and the far worse
                 "△Sens… · 32%", both still painting on `ab6ae8a6`, AFTER #1560.

                 ⚠ THE RESOLVER'S BOX AND THIS ONE ARE NOW DIFFERENT QUANTITIES,
                 deliberately (trap 21). This cap follows the LIVE scale, because
                 it is in the DOM and can read it. `LABEL_HALF_WIDTH` — what the
                 resolver clears — is the WORST case, because layout runs with no
                 zoom to read and must never under-clear. They agree exactly at
                 the parked zoom, which is the case that matters. */
              maxWidth: `calc(${LABEL_DECLARED_HALF_WIDTH * 2}px * var(--canvas-label-scale, 1))`,
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
              alignItems: fragileCueOnly ? 'center' : 'stretch',
              // Each ROW is still one line, always: the ellipsis that keeps
              // the text inside the cleared box lives on the spans below.
              flexWrap: 'nowrap',
              rowGap: `${LABEL_ROW_GAP_PX}px`,
              cursor: 'pointer',
              // C1: Smooth fade-in transition. contract v3.1 (E6): the chip
              // dims with its connection rather than floating over a faded line.
              opacity: isSelectionDimmed ? EDGE_SELECTION_DIM_OPACITY : 1,
              transition: 'opacity 150ms ease-in-out',
            }}
            className={`nodrag nopan border ${fragileCueOnly ? 'focus:outline-none focus-visible:ring-2 focus-visible:ring-info' : 'shadow-panel'} ${typography.edgeLabel} ${
              isDark ? 'bg-gray-900 text-gray-100' : fragileCueOnly ? 'bg-panel text-text-header' : 'bg-panel/95 text-text-header'
            } ${
              // (Formerly: "The fragility row brings the old badge's border with
              // it, so a fragile-only chip IS the badge".)
              // ⛔ NO SEMANTIC BORDER FOR FRAGILITY (Paul 23 Sep contract
              // feedback point 4: "one discreet fragility cue"). The chip used
              // to take `border-info/30` when it carried the cue — a second,
              // colour-only fragility signal, in the hue point 9 reserves for
              // attention. The mark below is the ONE cue.
              // contract v3.1 (E10): the cue disc's ring is the contract's
              // light neutral, taken as the muted-ink token at 40% rather
              // than a new hex. The chip form keeps the panel border.
              isDark
                ? 'border-gray-600'
                : fragileCueOnly ? 'border-text-light/40' : 'border-panel-border'
            } ${hasSuggestion ? 'ring-2 ring-info ring-offset-1' : ''} ${isFirstEdge && showEdgeHint ? 'edge-hint-active' : ''}`}
            // ⭐ contract v3.1 (E10; Paul 23 Sep point 12: "Icons need hover/focus
            // labels and inspector access"). A cue-only chip is a CONTROL: it
            // takes focus, names itself with the fragility sentence, and opens
            // the connection's inspector — the same route the chip's
            // double-click takes (`openEdgeStrengthEditor`). With a strength
            // row it stays a `note`, exactly as before. This is the contract's
            // `.edge-cue` (`tabindex="0" role="button"`), a tab stop only where
            // a cue is painted — the budgeted top flip risk in the default view.
            role={fragileCueOnly ? 'button' : 'note'}
            tabIndex={fragileCueOnly ? 0 : undefined}
            onClick={fragileCueOnly ? handleFragileCueActivate : undefined}
            onKeyDown={fragileCueOnly ? handleFragileCueKeyDown : undefined}
            data-fragile-cue={fragileCueOnly ? 'disc' : undefined}
            data-testid="edge-influence-label"
            // ⭐ THE CUE IS NAMED ON THE ASSISTIVE CHANNEL WHEN IT SHARES A CHIP.
            // `aria-label` REPLACES descendant text, so on a chip carrying BOTH
            // rows the fragility row was announced NOWHERE — the gap the `est.`
            // marker hit before it (see `ariaLabel` above). One sentence, one
            // owner, both channels.
            aria-label={
              showLabel
                ? `${ariaLabel}${paintFragileCue ? `. ${fragileSentence}` : ''}`
                : fragileSentence
            }
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
                // The `est.` marker's own sentence, on the container too: a
                // `title` on a 4-character span is a small hover target and is
                // absent on touch, so the chip that shows the marker also
                // carries what it means. Derived from `ESTIMATE_SUBJECT_TITLE`,
                // never re-typed — the cards say this in exactly one place.
                ...(showLabel && strengthUnconfirmed ? [ESTIMATE_SUBJECT_TITLE.strength] : []),
                ...(paintFragileCue ? [fragileSentence] : []),
              ]
              // ⭐⭐ SAY WHAT THE DOUBLE-CLICK ACTUALLY DOES.
              //
              // THE COST OF THE OLD WORD, measured on the founder's own
              // session (19 Sep 2026): 27 actions over 34 minutes, EVERY ONE a
              // chat message or a chip click, and not one direct edit — while
              // `edgeStrengthEditIsAssertable` returns true for 24 of his 26
              // edges. The control worked the whole time. The product's only
              // standing word for it was "inspect", which says read-only.
              //
              // ⚠ THE FIRST-RUN PULSE CANNOT CARRY THIS. `useEdgeEditHint`
              // shows a WORDLESS animation, on `isFirstEdge` ONLY, for five
              // seconds, and dismisses itself on a timer whether or not anyone
              // saw it — then persists `edgeEditShown` to localStorage, ONCE
              // EVER. For anyone who has opened this product before, that hint
              // was spent months ago and this sentence is all there is.
              //
              // ⛔ IT PROMISES ONLY WHERE THE EDIT CAN LAND. Same predicate the
              // panel fences on, so the two cannot disagree — an edge whose
              // strength the server states in a shape the contract cannot carry
              // (every risk -> goal edge today) keeps the honest older word.
              return `${parts.join('\n')}\n\n${affordanceSentence}`
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
                      size={12}
                      // contract v3.1 (ICON-07): counter-scaled like the label text.
                      className={`${CANVAS_GLYPH_SIZE_CLASSES[12]} text-info flex-shrink-0`}
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
                    ref={strengthLabelRef}
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
                  {/* ⭐ THE UNCONFIRMED-STRENGTH DISCLOSURE — see
                      `strengthUnconfirmed` for the predicate and why it is not
                      a dash, a colour or a width.

                      `flexShrink: 0` is load-bearing, not tidiness: the span
                      above ellipsises from the END under a fixed-width cap that
                      this text counter-scales against, so a shrinkable marker
                      would be the first thing cut — and the reader would be
                      left with the confident half of the claim and none of the
                      hedge. Same failure the fragility row was split to fix.

                      ⚠ THIS IS `subject="strength"`'s FIRST PRODUCTION CALL
                      SITE. The variant and its sentence were built and tested
                      and had ZERO production readers (EstimateMarker's header
                      says so and names itself as pinned only by tests). Nothing
                      new is minted here — an existing, reviewed disclosure is
                      being plugged in. */}
                  {strengthUnconfirmed && (
                    <span style={{ flexShrink: 0, display: 'inline-flex' }}>
                      <EstimateMarker subject="strength" />
                    </span>
                  )}
                  {provenance && (
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        flexShrink: 0,
                      }}
                      className={
                        // R6: orange on an edge means a SIGN disagreement between
                        // Olumi's review passes and nothing else (narrowed
                        // 23 Sep 2026). This dot used to paint `user` provenance in the
                        // warning hue — the semantic inverse, since a
                        // user-stated value is the most trustworthy kind. It is
                        // now the success hue, matching every other
                        // "you set this" signal on the canvas.
                        // contract v3.1 (T16): DS tokens, not the legacy
                        // `info-500` alias or Tailwind's default grey.
                        provenance === 'template' ? 'bg-info' :
                        provenance === 'user' ? 'bg-success' :
                        'bg-text-light'
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

            {/* ⭐ THE FRAGILITY CUE — DISCREET, AND IT PAINTS NO FIGURE.

                Experience Design, 23 Sep 2026: "fragility = a discreet
                exception cue, not a repurposed line style", and "labels must
                not be verbose". This row painted `△ Sensitive · 70%` — and the
                manual test on served `4c6ec07b` found the figure read as a
                STRENGTH, because it sat directly under "Strong boost est." with
                no noun of its own (MANUAL-TEST MT-15b). The figure is the flip
                figure (`getFragileEdgeSwitchProbability`), not a strength.

                So the cue is the icon alone, at the design reference's
                "consequential relationship" position in the chip, and the
                figure rides its NAME and TITLE inside the sentence that says
                what it is (`fragileEdgeSentence`: "NN% chance the result flips
                if this relationship changes"). The hover popover states it too,
                as "NN% flip risk". Nothing about WHICH figure is shown changed:
                measured only, never the marginal quantity.

                `role="img"` + `aria-label` because an icon-only mark must be
                named for assistive tech; `title` because a pointer user needs
                the same sentence on hover. The chip container's own title and
                name carry it as well (see `aria-label` above), which is the
                keyboard and touch route — a `title` alone is neither.

                ⚠ IT STAYS A ROW OF THIS CHIP, deliberately. It used to float at
                a hard-coded `labelX + 30` with no referent; the placement pass
                (`resolvePersistentLabelPlacements`) still clears a two-row box
                for it, so the geometry every label-collision spec pins is
                unchanged. The two truncation spans that lived here are gone
                with the text: there is no word to truncate and no number to
                protect. */}
            {paintFragileCue && (
              <div
                data-testid="edge-fragile-tag"
                role="img"
                aria-label={fragileSentence}
                title={fragileSentence}
                style={{
                  display: 'flex',
                  flexWrap: 'nowrap',
                  alignItems: 'center',
                  minWidth: 0,
                }}
                // contract v3.1 (ICON-07/E10): MUTED ink, not body ink — the
                // contract's `.edge-cue .cue-icon{stroke:#797871}`; `text-light`
                // is the nearest DS token (5.23:1 on panel) and adds no colour.
                className="text-text-light"
              >
                {/* ⭐ NOT A TRIANGLE — Paul 23 Sep contract feedback point 4
                    ("remove the warning-triangle … pile-up"). `AlertTriangle`
                    is the design system's WARNING icon (DS v5 §9.5) and the
                    RISK node's icon (§9.4), so on a connection it said
                    "warning" or "risk" about a relationship that is neither.
                    `Activity` is a neutral pulse mark, in muted ink, named by
                    its sentence — shape does the work, not a hue.

                    contract v3.1 (ICON-07): COUNTER-SCALED like the text beside
                    it, so its declared px is its screen px — a fixed 12 painted
                    at 6px at the 0.50 park. 10px inside the 16px disc, 12px as
                    a row beside a strength label. `size` stays as the honest
                    fallback where the class did not load. */}
                <Activity
                  size={fragileCueOnly ? 10 : 12}
                  strokeWidth={fragileCueOnly ? 2 : undefined}
                  className={`flex-shrink-0 ${CANVAS_GLYPH_SIZE_CLASSES[fragileCueOnly ? 10 : 12]}`}
                  aria-hidden="true"
                />
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
            {/* R6: not orange — this is a user annotation. Orange on an edge
                is reserved for a SIGN disagreement between Olumi's review
                passes (23 Sep 2026). */}
            {/* contract v3.1 (ICON-07): counter-scaled, so 12px on screen. */}
            <Flag size={12} className={`text-text-light ${CANVAS_GLYPH_SIZE_CLASSES[12]}`} />
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
        // The SAME resolution the label consumes (`edgeLikelihood`), not a
        // second call — so the popover and the label cannot drift apart again.
        const confidenceDisplay = edgeLikelihood
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
        /**
         * ⭐ A DISPUTED SIGN IS NOT A FACT, AND THIS POPOVER USED TO STATE IT AS ONE.
         *
         * On a live `sign_flip` the line is orange — the ONE disagreement the
         * locked grammar lets onto the canvas — while this popover printed a
         * bold "Positive" and a green bar: the first pass's sign, stated as
         * settled, on the very connection whose sign Olumi's own review
         * disputes (purpose audit of the banked draft, DRIFT-RISK). The
         * direction is still NAMED — it is what the model runs on for now
         * (`pass1`) — but inside a sentence that says so, and the bar goes to
         * the no-verdict grey.
         *
         * ⚠ It also stops the coaching chips below asserting that sign to the
         * model: their messages are dispatched to CEE verbatim as the user's
         * own words (see their LLM-FACING note).
         */
        const signDisputed = isSignDisputed
        const dirLabelForClaims = signDisputed ? null : dirLabel
        // Which half-colour the bar paints IS a direction claim, so it is gated
        // the same way. Grey is this canvas's stated NO-VERDICT colour for
        // exactly this case — `directionStroke.ts` calls it
        // "weight-set-but-no-direction" — and it is the same token the stroke
        // and the legend row already use, so no new vocabulary is introduced.
        const strengthBarTone = statedDirection === null || signDisputed
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
              /* A13: the identity handle the focus-out rule asks for. The
                 popover is portalled out of the edge's group, so `contains()`
                 cannot reach it and a containment test alone would close it the
                 moment focus entered it.
                 ⭐ IT CARRIES THIS EDGE'S ID, not a bare marker. A bare
                 `[data-edge-popover]` is satisfied by EVERY edge's popover, so
                 edge A's focus-out rule treated edge B's popover as its own
                 (trap 19). The value is what makes the exception identifiable.
                 `data-node-popover` on the node preview is the same idea and
                 still carries the bare form — out of this lane's fence. */
              data-edge-popover={edgeIdKey}
              ref={popoverElRef}
              role="tooltip"
              style={causalPopoverStyle}
              className="bg-panel border border-panel-border rounded-lg shadow-panel px-3 py-2.5 space-y-1.5 nodrag nopan nowheel"
              onMouseEnter={handlePopoverEnter}
              onMouseLeave={handlePopoverLeave}
            >
              {/* Direction — only when the producer or the user STATED one, and
                  never as a bare fact while Olumi's review passes dispute it. */}
              {signDisputed ? (
                <div data-testid="edge-hover-direction-disputed" className="space-y-0.5">
                  <div className={`${typography.edgeLabel} font-bold text-text-body`}>
                    {DIRECTION_DISPUTED_SENTENCE}
                  </div>
                  {dirLabel !== null && (
                    <div className={`${typography.edgeLabel} text-text-light`}>
                      {directionInUseSentence(dirLabel)}
                    </div>
                  )}
                </div>
              ) : dirLabel !== null && (
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
              {/* ⭐ THE STRENGTH ROW'S NOUN, AND WHETHER ANYONE STOOD BEHIND IT.
                  The bar and its percentage used to sit here with no noun at
                  all, so an unconfirmed producer's figure read exactly like one
                  the person typed — while the outcome card, for the SAME edge
                  and the SAME predicate (`strengthIsHumanSettled`), said
                  "Strength not set yet" (manual test MT-15b). The caption now
                  says it is a strength, and — when nobody has settled it —
                  whose estimate it is, named from the data
                  (`linkStrengthCaption`): "Link strength · Olumi's estimate",
                  the wording the node-card change puts on the card. The chip
                  keeps its short band word and `est.` marker. */}
              {signedVal !== null && strengthPct !== null && (
                <div
                  data-testid="edge-hover-strength-caption"
                  className={`${typography.edgeLabel} text-text-light`}
                >
                  {linkStrengthCaption(
                    strengthUnconfirmed,
                    edgeSignedStrength.show ? edgeSignedStrength.source : null,
                  )}
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
              {/* Fragility, WITH its noun ("NN% flip risk" — the name
                  `fragileEdgeMatch` gives this figure). Shown on every fragile
                  connection and at every zoom: the canvas cue is budgeted and
                  hidden at the far rung, the hover is where the fact is never
                  lost. */}
              {/* Paul 23 Sep contract feedback point 4: the SAME sentence and
                  the SAME neutral mark as the cue — no "Sensitive" label, no
                  warning triangle, no info hue. Every keyboard user reaches
                  this line too: focusing the edge opens this popover. */}
              {isFragileEdge && (
                <div
                  data-testid="edge-hover-fragility"
                  className={`${typography.edgeLabel} text-text-body flex items-start gap-1`}
                >
                  <Activity size={10} className={`flex-shrink-0 mt-0.5 ${CANVAS_GLYPH_SIZE_CLASSES[10]}`} aria-hidden="true" />
                  <span>{fragileEdgeSentence(fragileEdgeSwitchProb)}</span>
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
                    dirLabelForClaims !== null
                      ? `What evidence supports the ${dirLabelForClaims.toLowerCase()} relationship between ${srcTitle} and ${tgtTitle}?`
                      : `What evidence supports the relationship between ${srcTitle} and ${tgtTitle}?`
                  }
                />
                {/*
                  * ⭐⭐ THE ROUTE THAT WORKS, OFFERED FIRST.
                  *
                  * MEASURED on the founder's session (19 Sep 2026): the strength
                  * write was assertable on 24 of his 26 edges — it worked the whole
                  * time — and he spent 34 minutes and 27 actions in chat without
                  * one direct edit. This popover was open over those edges and its
                  * only action for the task was the chat chip below. The product
                  * was offering the slow route and hiding the fast one.
                  *
                  * ⛔ GATED ON `strengthIsEditable`, which is
                  * `edgeStrengthEditIsAssertable` CALLED — the same predicate the
                  * panel fences on and the accessible name reads — so the three
                  * cannot drift into offering different things. Where the write is
                  * refused this is absent and the chat chip below keeps its plain
                  * name, because there it is not the slow route, it is the only one.
                  *
                  * A native <button>, matching `NodeQuickActions`: this canvas's
                  * answer to "how does an object offer its own editing affordance"
                  * already exists for nodes and did not for edges.
                  */}
                {strengthIsEditable && (
                  <button
                    type="button"
                    data-testid="edge-direct-strength-edit"
                    onClick={(event) => {
                      event.stopPropagation()
                      openEdgeStrengthEditor(edgeIdKey)
                      if (showEdgeHint) dismissEdgeHint()
                    }}
                    aria-label={`Set the strength of the relationship between ${srcTitle} and ${tgtTitle}`}
                    className={`${typography.edgeLabel} w-full text-left px-2 py-1 rounded-md border border-info/40 bg-info/10 text-text-body hover:bg-info/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                  >
                    {EDGE_AFFORDANCE_DIRECT_ACTION}
                  </button>
                )}
                <NodeChip
                  chipId="edge_adjust_strength"
                  actionType="adjust_edge_strength"
                  label={strengthIsEditable ? EDGE_AFFORDANCE_CHAT_ALTERNATIVE : 'Adjust strength'}
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
