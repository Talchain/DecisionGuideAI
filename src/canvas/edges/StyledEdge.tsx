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
  edgeClickAffordance,
  EDGE_AFFORDANCE_EDITABLE,
} from './edgeAffordance'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, getStraightPath, Position, type EdgeProps, useReactFlow, useStore } from '@xyflow/react'
import { Lightbulb, Activity, Flag } from 'lucide-react'
import { LinkHoverCard } from '../components/hoverCard/LinkHoverCard'
import { edgeSizePhrase } from './edgeSizePhrase'
import { HOVER_CARD_OPEN_DELAY_MS } from '../components/hoverCard/hoverCardPlacement'
import { EstimateMarker, ESTIMATE_SUBJECT_TITLE } from '../nodes/shared/EstimateMarker'
import { CANVAS_GLYPH_SIZE_CLASSES, CANVAS_INLINE_TEXT_GLYPH_SIZE_CLASSES } from '../nodes/shared/canvasGlyphScale'
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
import { resolveCardEdgeRoute, routeBoxOf, resolveLayeredEdgeLeads, layeredLeadPath, layeredRouteBoxes, contractLayeredPath, type RouteBox, type SameRowRoute, type LayeredEdgeLeads } from './sameRowRoute'
import { arrivalMarkBoxes, cardEdgeLabelAnchorFromBoxes, cardEdgePathFromBoxes, flattenSvgPath, pointAtFraction, resolveFragileCuePlacements, FRAGILE_CUE_DISC_PX } from './fragileCuePlacement'
import { TIER_BY_KIND } from '../utils/nodeLayoutConstants'
import { isGhostNode } from '../utils/fitTargets'
import {
  readContestedState,
  resolveEdgeStroke,
  resolveEdgeDash,
  resolveEdgeDirectionMarker,
  edgeArrowheadMarkerId,
  edgeArrowheadSize,
  edgeArrowheadViewBox,
  edgeArrowheadPolygonPoints,
  EDGE_ARROWHEAD_COUNTER_SCALE_STYLE,
  type EdgePresentationState,
} from './edgePresentation'
import {
  resolvePersistentLabelPlacements,
  labelHalfHeightForRows,
  LABEL_DECLARED_HALF_WIDTH,
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
// GAP 2 fix (design-gap audit row 19): `useIsDark` is no longer imported —
// this component now forces `isDark = false` (see the constant's own comment
// below) rather than following the OS colour scheme. `../hooks/useTheme`
// still exports the hook for any future consumer; canvas edges just stop
// being the one.
import { getEdgeLabel, labelCarriesDirection } from '../domain/edgeLabels'
import { useEdgeLabelMode } from '../store/edgeLabelMode'
import { useCanvasStore } from '../store'
import { useModelChangedSinceRunLight } from '../hooks/useModelChangedSinceRun'
import { useSupportShareRunWideAbsent } from '../hooks/useSupportShareRunWideAbsent'
import { LAST_RUN_PREFIX } from '../nodes/shared/metricVocabulary'
import { isGraphLensEnabled } from '../../flags'
import { lensFragileEdgeLabel } from '../../components/results/utils/fragileEdgeCopy'
import { isEdgeFragile as isEdgeFragileFn, getFragileEdgeSwitchProbability, isTopFragileEdge as isTopFragileEdgeFn, type FragileEdgeCandidate, type FragileEdgeMatchContext } from '../utils/fragileEdgeMatch'
import { resolveExistenceDash, calculateEdgeImportance, weightMagnitudeToStrokeWidth, UNSET_EDGE_STROKE_WIDTH, uncertaintyBandHalfWidth, UNCERTAINTY_BAND_STROKE, UNCERTAINTY_BAND_OPACITY } from '../utils/graphDisplayCalculations'
import { typography } from '../../styles/typography'
import { selectLodBodyHidden, glyphCounterScale, labelCounterScale } from '../utils/zoomLegibility'
import {
  fragileEdgeSentence,
  DIRECTION_DISPUTED_SENTENCE,
  directionInUseSentence,
  edgeArrowSentence,
  EDGE_EXISTENCE_DOUBT_SENTENCE,
  EDGE_STRENGTH_PLACEHOLDER_SENTENCE,
} from './connectorCopy'
import { isStrengthPlaceholder } from '../domain/strengthPlaceholder'
import { isStrengthDefinitional } from '../domain/strengthDefinitional'
import { registerEdgeHover, routeEdgeHover, routeEdgeHoverOnMove, endEdgeHover, claimEdgeHover, type EdgeHoverBehaviour, type EdgeHoverSeat } from './edgeHoverArbiter'
import { useEdgeEditHint } from '../hooks/useFirstTimeHints'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { useAssistantFocusStore } from '../stores/assistantFocusStore'
import { useCanvasNodeHoverStore } from '../stores/canvasNodeHoverStore'
import { openEdgeStrengthEditor } from '../utils/openEdgeStrengthEditor'
import {
  resolveArrivalSlotOnBoard,
  resolvePolarityGlyphOnPath,
  glyphMetricsAt,
  arrivalHeadKeepOut,
  polarityGlyphTransform,
  GLYPH_PAINTED_BOX_FLOW,
  type ArrivalBox,
  type ArrivalSlot,
  type GlyphKeepOut,
} from '../utils/edgeGlyphPlacement'
import { CANVAS_ONLY_LINK_MARK, isCanvasOnlyLink } from '../utils/canvasOnlyLink'
import { tierLaneTitleBoxFor } from '../utils/tierLanes'
import { selectRunChangesRouteLit } from '../graphChanges/routeFocus'

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
 * chip together. The locked visual contract §03 paints this exact state as
 * `.edge-group.dimmed{opacity:.18}`; it was DS v5 §7.4's 20% until 25 Sep
 * 2026. The lens dim (a different producer) keeps its own 0.2. Exported so
 * specs bind to the identity.
 */
export const EDGE_SELECTION_DIM_OPACITY = 0.18

/**
 * SI-4 — the keyboard focus ring's visible band, in screen px on EACH side of
 * whatever the edge draws widest (the contract's `outline: 2px solid
 * var(--info)`).
 */
export const EDGE_FOCUS_RING_WIDTH = 2

/** Half-size of the focus ring mask's user-space region: far past any board. */
const FOCUS_RING_MASK_EXTENT = 1e5

/**
 * The focus ring's geometry, in screen px. `cutWidth` is the wider of the
 * drawn LINE and the drawn uncertainty RIBBON (0 when no ribbon paints): the
 * band the ring must leave untouched. `strokeWidth` adds the ring's band on
 * both sides. The ring is drawn at `strokeWidth` and masked out along
 * `cutWidth`, so it is an OUTLINE around the line and ribbon and never paints
 * a pixel of either (review, 28 Sep 2026: drawn over them at the line's width
 * + 4, it swallowed the 7px floor ribbon on a 2px link).
 */
export function edgeFocusRingGeometry(
  lineStrokeWidth: number,
  ribbonStrokeWidth: number,
): { cutWidth: number; strokeWidth: number } {
  const cutWidth = Math.max(lineStrokeWidth, ribbonStrokeWidth)
  return { cutWidth, strokeWidth: cutWidth + 2 * EDGE_FOCUS_RING_WIDTH }
}

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
 * The glyph row stands just above the arrival point, beside the converging
 * lines (`edgeGlyphPlacement.ts`); where a line or an arrowhead still passes
 * behind a glyph, a `−` crossing a vertical line reads as `+`, which inverts
 * the one channel a red-green dichromat relies on (`directionStroke.ts:23-32`). The contract
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
 * it. Its place is the connection's own midpoint (`fragileCuePlacement.ts`),
 * which sizes its clearances from the same `FRAGILE_CUE_DISC_PX`.
 */
const FRAGILE_CUE_DISC_SIZE = `calc(${FRAGILE_CUE_DISC_PX}px * var(--canvas-label-scale, 1))`

export const EDGE_GLOW = Object.freeze({
  selected: edgeGlow(2, 35),
  hover: edgeGlow(1.5, 25),
  flipRisk: edgeGlow(3, 45),
  sensitivity: edgeGlow(2, 35),
  /**
   * A changed link (Compare open) that its row is pointing at RIGHT NOW (hover / keyboard focus). The changed link
   * already wears `selected`, so the row's highlight must say something MORE, or the hover is a no-op (audit
   * 5942900903 (a2), served `d48cd152`: identical computed style before and after). Same info hue, a step stronger.
   */
  lit: edgeGlow(3.5, 60),
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

/**
 * Is a link STRUCTURAL (no arrowhead, no sign)? The same resolution order as
 * this component's own `isStructuralEdge` memo: an explicit `edge_type` wins
 * ('structural' → yes; any other value → no), else decision → option and
 * option → factor are. Read by the fragile-cue pass for every OTHER link.
 */
function linkIsStructural(srcKind: unknown, tgtKind: unknown, data: unknown): boolean {
  const explicit = (data as Record<string, unknown> | undefined)?.edge_type
  if (explicit === 'structural') return true
  if (explicit != null && explicit !== '') return false
  return (srcKind === 'decision' && tgtKind === 'option') || (srcKind === 'option' && tgtKind === 'factor')
}

/**
 * The `carriesSign` test `resolveArrivalSlotOnBoard` takes, over these nodes: a
 * link carries a sign unless it is structural (`linkIsStructural`).
 */
function signCarrierOver(
  nodes: ReadonlyArray<{ id: string; type?: string; data?: unknown }>,
): (e: { source: string; target: string; data?: unknown }) => boolean {
  const kindById = new Map<string, unknown>()
  for (const n of nodes) kindById.set(n.id, n.type ?? (n.data as Record<string, unknown> | undefined)?.kind)
  return (e) => !linkIsStructural(kindById.get(e.source), kindById.get(e.target), e.data)
}

/** A per-target cache for one pass: each card's band title is derived once. */
function memoByTarget<T>(compute: (targetId: string) => T): (targetId: string) => T {
  const cache = new Map<string, T>()
  return (targetId) => {
    if (!cache.has(targetId)) cache.set(targetId, compute(targetId))
    return cache.get(targetId) as T
  }
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
  // SI-4 (audit, 27 Sep 2026): KEYBOARD focus on this link, for its focus ring.
  // Separate from `isHovered` (which focus also sets): a pointer passing over a
  // link must not draw a focus ring.
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false)
  // The hover card is counter-scaled to screen size (and the glyph metrics read it).
  const edgeTooltipZoom = useStore((st) => st.transform?.[2] ?? 1)
  // T1: Hover popover — delayed (HOVER_CARD_OPEN_DELAY_MS) so a pass-through pointer opens nothing
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
  const { ceeReview, resultsStatus, report, isHighlightedEdge, isAnalysisFragileEdge, isRunChangedEdge, isRunChangeSubduedEdge, isSelectionDimmed, viewMode, isLodBodyHidden, canvasOnlyLink } = useCanvasStore(
    useShallow(s => ({
      ceeReview: s.runMeta.ceeReview,
      resultsStatus: s.results.status,
      report: s.results.report,
      isHighlightedEdge: s.highlightedEdges.has(id),
      // Analysis-graph projection: this edge is a flip risk being viewed in the
      // V7 evidence disclosure. Optional-chained so store doubles without the
      // slice stay safe (same pattern as editedSinceRunNodeIds).
      isAnalysisFragileEdge: s.analysisHighlight?.source === 'flip_risks' && s.analysisHighlight?.edgeIds?.has(id) === true,
      // The Changes view (row E, `graphChanges/`): a link whose input differed between the two Runs on screen, and —
      // while anything is marked — every other link subdued. A projection that marks nothing subdues nothing.
      isRunChangedEdge: s.analysisHighlight?.source === 'run_changes' && s.analysisHighlight?.edgeIds?.has(edgeIdKey) === true,
      isRunChangeSubduedEdge:
        s.analysisHighlight?.source === 'run_changes' &&
        (s.analysisHighlight.edgeIds?.size ?? 0) + (s.analysisHighlight.nodeIds?.size ?? 0) > 0 &&
        s.analysisHighlight.edgeIds?.has(edgeIdKey) !== true &&
        // WHERE THIS CHANGE FLOWS: while a C1 row's element is selected, its route focus owns prominence.
        !selectRunChangesRouteLit(s),
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
      // edit-structure/F3: "Not saved" on a link that stood down and whose pair
      // the server does not hold (review r06 blocker 2), by the one predicate.
      // A primitive boolean; a store double without the field reads as "no
      // pair held", i.e. the receipt alone.
      canvasOnlyLink: isCanvasOnlyLink({ source, target, data }, s.lastAuthoritativeGraph),
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
    // The alternative's name in the register's withheld form — never "If wrong
    // → {alt}", which named a winner the run may have withheld.
    return lensFragileEdgeLabel(entry.alternative_winner_label ?? entry.alternativeWinnerLabel)
  }, [isLensFragile, report, id, source, target, fragileMatchCtx])

  /**
   * ⭐ THE CUE CITES THE COMPARISON, SO IT NEEDS A SHOWN ONE (post-run DIFF
   * item 7; contract v3.1: the fragile cue appears only alongside a shown
   * comparison). Its sentence says "the current model comparison could
   * change", and on a run whose comparison was withheld (Paul's `mrr-17d1cd3a`:
   * no win probabilities, `unrequested_analysis_withheld`) no option card shows
   * a share — yet the cue painted "64% flip risk" beside them. The gate is the
   * option cards' OWN run-wide answer (`useSupportShareRunWideAbsent`), never a
   * second spelling of "is there a comparison". Membership (`isFragileEdge`)
   * and placement (`fragileLabelIds`) both read it, so no slot is reserved for
   * a cue that cannot paint.
   */
  const comparisonShown = !useSupportShareRunWideAbsent()

  // Check if this edge is fragile (switch_probability > 0.3)
  // Uses shared utility for consistent matching across StyledEdge, useMenuItems, useLensFilter
  const isFragileEdge = useMemo(() => {
    if (!isResultsMode || !comparisonShown || !report?.robustness) return false
    const fragileEdges = report.robustness.fragile_edges || []
    return isEdgeFragileFn(id, source, target, fragileEdges, fragileMatchCtx)
  }, [isResultsMode, comparisonShown, report, id, source, target, fragileMatchCtx])

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
   * ⭐ ROW 38 — A STALE FIGURE IS LABELLED "LAST RUN", NEVER PRESENTED AS
   * CURRENT. `paintFragileCue` (below) gates on `isResultsMode`
   * (`results.status === 'complete'`) alone — and a completed run's report
   * stays ON SCREEN after the user edits the model (`store.ts` never resets
   * `results.status` on an edit), so this cue kept painting from a report the
   * model has since outgrown, with no word saying so.
   *
   * `useModelChangedSinceRunLight` reads the SAME composed freshness verdict
   * (`composeAnalysisState`) the factor cards' `LAST_RUN_PREFIX` already keys
   * on — never a second "is this stale" rule (CLAUDE.md trap 12) — and the
   * `Light` variant exists only to skip the one input
   * (`useAnalysisStateSource`'s flag-gated `source`) that its own docblock
   * proves cannot change a `'changed'` verdict, which matters here because
   * this hook mounts once PER EDGE on the canvas.
   *
   * Paul's Ruling 3 (ROADMAP 2.651): "out-of-date results are labelled, not
   * withheld" — the same choice `sensitivityRankBadgeLabel`'s `fromLastRun`
   * already makes for the card's `Key driver N` badge, so this cue and that
   * badge cannot tell a reader two different stories about staleness.
   */
  const modelChangedSinceRun = useModelChangedSinceRunLight()

  /**
   * The fragility sentence — ONE owner (`connectorCopy.fragileEdgeSentence`,
   * moved there verbatim), three readers here: the cue's accessible name, the
   * cue's `title`, and the chip container's composed title and name — PLUS
   * the popover's fragility line below, which reads this SAME variable rather
   * than recomputing (it used to call `fragileEdgeSentence` a second time,
   * which would have painted the cue as "Last run" while the popover stayed
   * silent about it — one sentence, one call site, never two). So the figure
   * is never stated without its noun, and the staleness label never appears
   * on only one of the two surfaces that speak it.
   * Presence-branched on a MEASURED switch probability: absent means NOT
   * COMPUTED, and `marginal_switch_probability` is a different Monte Carlo,
   * never a fallback (pinned by StyledEdge.fragilePresence.spec).
   */
  const fragileSentence =
    (modelChangedSinceRun ? LAST_RUN_PREFIX : '') + fragileEdgeSentence(fragileEdgeSwitchProb)

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
    // The same comparison gate as `isFragileEdge`: no shown comparison, no cue,
    // so no fragility row reserves a placement slot anywhere on the graph.
    if (!isResultsMode || !comparisonShown) return new Set()
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
  }, [isResultsMode, comparisonShown, report, viewMode, getEdges, getNode])

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
   * MG 0ebb952a: a link that holds BY DEFINITION (`domain/strengthDefinitional`)
   * is nobody's estimate and there is nothing to confirm, so it carries no `est.`
   * marker and its hover says "By definition".
   */
  const strengthIsDefinitional = useMemo(
    () => isStrengthDefinitional(edgeData as Record<string, unknown> | undefined),
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
      !strengthIsDefinitional &&
      !strengthIsHumanSettled(edgeData as Record<string, unknown> | undefined),
    [edgeSignedStrength, edgeData, strengthIsDefinitional]
  )
  /**
   * ⭐ BEAT 1 (Canvas lane, 4 Oct 2026): the link's stored size and WHOSE it is (`edgeSizePhrase`) — said in the hover
   * card. When the size is the USER's own figure (journey 4: four links the brief stated, `magnitude: user_stated`),
   * the β beside it was sized from that figure: it is not "Olumi's estimate", so it carries no `est.` marker. Only
   * the marker narrows; `strengthUnconfirmed` keeps its meaning (nobody confirmed the β) for every other reader.
   */
  const edgeSize = useMemo(() => edgeSizePhrase(edgeData as Record<string, unknown> | undefined), [edgeData])
  const strengthMarkedEstimate = strengthUnconfirmed && edgeSize?.usersFigure !== true
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
  /**
   * ⭐ POM-8 (27 Sep 2026): CEE's PLACEHOLDER strength is not an estimate, so it
   * does not earn a band width. Paul's MRR board drew "Pro plan price → MRR"
   * (a 0.5 placeholder) at the Strong band's 4px, the heaviest link into his
   * goal. Owner decision: it draws at the NOT-SET width, the hover says it is a
   * placeholder, and the inspector stops calling it an estimate. Colour keeps
   * the stated direction — the label covers the magnitude only.
   * `isStrengthPlaceholder` holds the staleness rule (see its module).
   */
  const strengthIsPlaceholder = useMemo(
    () => isStrengthPlaceholder(edgeData as Record<string, unknown> | undefined),
    [edgeData]
  )
  const edgeStrokeWidth = useMemo(
    () => edgeSignedStrength.show && !strengthIsPlaceholder
      ? weightMagnitudeToStrokeWidth(edgeSignedStrength.value)
      : UNSET_EDGE_STROKE_WIDTH,
    [edgeSignedStrength, strengthIsPlaceholder]
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
   *
   * ⭐⭐ The same subscription routes an UPWARD link (target wholly above the
   * source) from the source's top into the target's bottom — `resolveRisingRoute`
   * (26 Sep 2026) — where xyflow's bezier drew an S-loop over the target.
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
    const route = resolveCardEdgeRoute(src, tgt, others)
    return route ? JSON.stringify(route) : ''
  })
  const sameRowRoute = useMemo<SameRowRoute | null>(
    () => (sameRowRouteKey === '' ? null : (JSON.parse(sameRowRouteKey) as SameRowRoute)),
    [sameRowRouteKey],
  )

  /**
   * ⭐⭐ THIS LINK'S ARRIVAL SLOT (Paul's staging test, 28 Sep 2026 — Canvas
   * lead's ruling; `edgeGlyphPlacement.ts` rule A). Links entering one card from
   * above no longer all end at its kind apex: each takes its own slot along the
   * card's top, ordered by where its source sits, so six links into a goal are
   * six arrowheads, not one pile. The ONE owner is `resolveArrivalSlotOnBoard`;
   * the fragile-cue and label passes read the same function for every other
   * link, so no two readers draw one connection two ways.
   *
   * A SUBSCRIPTION for the reason the glyph's used to be: a sibling's SOURCE
   * moving changes MY slot without moving my endpoints, and every instance must
   * read one snapshot or two can take one slot. Returned as a string: `useStore`
   * compares by reference. '' — no slot (a single arrival keeps the apex, and
   * any non-layered geometry keeps xyflow's handle).
   */
  const arrivalKey = useStore((st) => {
    if (pathType === 'straight' || pathType === 'smoothstep') return ''
    if (sourcePosition !== Position.Bottom || targetPosition !== Position.Top || !(targetY > sourceY)) return ''
    // Tolerate a partial store slice (see the fragile pass's note on specs).
    const storeNodes = Array.isArray(st.nodes) ? st.nodes : []
    const storeEdges = Array.isArray(st.edges) ? st.edges : []
    // `id as string` etc.: the file's pre-existing `EdgeProps` typing break —
    // React Flow supplies them as strings.
    const selfId = id as string
    const boxes = new Map<string, ArrivalBox>()
    for (const n of storeNodes) {
      const box = routeBoxOf(n as Parameters<typeof routeBoxOf>[0])
      if (box) boxes.set(n.id, box)
    }
    const tgt = boxes.get(target as string)
    if (!tgt) return ''
    // This edge is rendering, so it exists — even if the slice has not caught up.
    const edges = storeEdges.some((e) => e.id === selfId)
      ? storeEdges
      : [...storeEdges, { id: selfId, source: source as string, target: target as string, data }]
    // The row's band title takes no signed arrival (WS1 #28's keep-out, on the arrival).
    const title = tierLaneTitleBoxFor(storeNodes, target as string)
    const slot = resolveArrivalSlotOnBoard(selfId, target as string, boxes, edges, title, signCarrierOver(storeNodes))
    if (slot.dx === 0 && slot.onKindShape) return ''
    const r2 = (v: number) => Math.round(v * 100) / 100
    return `${r2(slot.dx)},${slot.onKindShape ? 1 : 0},${r2(tgt.y)}`
  })
  /** The link's END: its arrival slot, else xyflow's handle (the kind apex). */
  const [endX, endY] = useMemo((): [number, number] => {
    if (arrivalKey === '') return [targetX, targetY]
    const [dx, onKind, cardTop] = arrivalKey.split(',').map(Number)
    return [targetX + dx, onKind === 1 ? targetY : cardTop]
  }, [arrivalKey, targetX, targetY])

  /**
   * v3.1 WS1 #10 — the layered edge's vertical leads (see `resolveLayeredEdgeLeads`):
   * out past the lowest card of its source's row, in from above its target's
   * row. A subscription for the same reason as the same-row route above.
   */
  const layeredLeadsKey = useStore((st) => {
    if (pathType === 'straight' || pathType === 'smoothstep') return ''
    if (sourcePosition !== Position.Bottom || targetPosition !== Position.Top || !(targetY > sourceY)) return ''
    const storeNodes = Array.isArray(st.nodes) ? st.nodes : []
    // POM-6: the row-end prompts are obstacles too (`layeredRouteBoxes`).
    const boxes = layeredRouteBoxes(
      storeNodes as Parameters<typeof layeredRouteBoxes>[0],
      (nodeId) => lensHiddenNodeIds.has(nodeId),
    )
    // `route`, not `leads`: the no-contest copy sweep reads a bare "leads" on a
    // line with a template literal as a ranking verb (noContestFraming.canvas).
    const route = resolveLayeredEdgeLeads(source as string, target as string, sourceX, sourceY, endX, endY, boxes)
    if (!route) return ''
    const r2 = (v: number) => Math.round(v * 100) / 100
    // POM-6: a detour's column rides in the same key, so the path re-derives when it moves.
    const via = route.via ? `,${r2(route.via.x)},${r2(route.via.top)},${r2(route.via.bottom)}` : ''
    return `${r2(route.outY)},${r2(route.inY)}${via}`
  })
  const layeredLeads = useMemo<LayeredEdgeLeads | null>(() => {
    if (layeredLeadsKey === '') return null
    const [outY, inY, viaX, viaTop, viaBottom] = layeredLeadsKey.split(',').map(Number)
    return viaX !== undefined && viaTop !== undefined && viaBottom !== undefined
      ? { outY, inY, via: { x: viaX, top: viaTop, bottom: viaBottom } }
      : { outY, inY }
  }, [layeredLeadsKey])

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
         * Every other orientation (every non-default path type, an
         * unmeasured pair) keeps xyflow's own path; a SAME-ROW pair and an
         * UPWARD pair were routed above (`sameRowRoute.ts`).
         */
        if (sourcePosition === Position.Bottom && targetPosition === Position.Top && targetY > sourceY) {
          // 28 Sep 2026: to this link's ARRIVAL SLOT (`endX`/`endY`, above),
          // not the shared handle — see `edgeGlyphPlacement.ts` rule A.
          if (layeredLeads) {
            const [path, lx, ly] = layeredLeadPath(sourceX, sourceY, endX, endY, layeredLeads)
            return [path, lx, ly, Math.abs(endX - sourceX) / 2, Math.abs(endY - sourceY) / 2] as [string, number, number, number, number]
          }
          return [
            contractLayeredPath(sourceX, sourceY, endX, endY),
            (sourceX + endX) / 2,
            (sourceY + endY) / 2,
            Math.abs(endX - sourceX) / 2,
            Math.abs(endY - sourceY) / 2,
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
  }, [sameRowRoute, layeredLeads, pathType, sourceX, sourceY, sourcePosition, targetX, targetY, endX, endY, targetPosition, visualProps.curvature])
  
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
  const affordanceSentence = edgeClickAffordance(
    { id, source, target, data } as unknown as Parameters<typeof edgeClickAffordance>[0],
  )
  const strengthIsEditable = affordanceSentence === EDGE_AFFORDANCE_EDITABLE

  const ariaLabel =
    `Edge from ${srcTitle} to ${tgtTitle}${confText}, ${edgeDescription.label}` +
    (canvasOnlyLink ? `. ${CANVAS_ONLY_LINK_MARK.word}` : '') +
    (strengthMarkedEstimate ? `. ${ESTIMATE_SUBJECT_TITLE.strength}` : '') +
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

  // ⭐ S.1 FOR LINKS (Paul, 4 Oct 2026): ONE click on the chip opens the link's inspector, as one click on the line
  // does (`edgeClickOpensInspector`). The chip sits at the midpoint — exactly where people click a link — and lives in
  // the label portal, outside the edge's `<g>`, so a click on it never reaches xyflow's `onEdgeClick`. With only a
  // double-click handler it swallowed every single click (journey 4: "the link inspector needs a double click").
  // The camera stays put: the link is already under the pointer.
  const handleChipClick = (event: React.MouseEvent) => {
    event.stopPropagation()
    openEdgeStrengthEditor(edgeIdKey, { centre: false })
    if (showEdgeHint) dismissEdgeHint()
  }

  // C1: Handle hover for edge label visibility + T1: delayed hover popover
  // Leave timer allows mouse to transition from edge path to popover without closing
  // Structural edges skip the popover timer entirely — they show a native
  // browser tooltip via the <title> child on the hitbox path instead.
  const hoverEnter = () => {
    pointerWithinRef.current = true
    setIsHovered(true)
    if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null }
    if (isStructuralEdge) return
    // An Escape the user has just pressed outranks a pointer that never left.
    if (keyboardDismissedRef.current) return
    hoverPopoverTimerRef.current = setTimeout(() => setShowHoverPopover(true), HOVER_CARD_OPEN_DELAY_MS)
  }
  const hoverLeave = () => {
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
  // ⭐ F8 (27 Sep 2026): the pointer events arrive at the TOPMOST hit area, which
  // at the landing is often a neighbouring link's. The arbiter hands the hover
  // to the link whose drawn line is nearest the pointer — the rule a click now
  // follows too — and runs that link's own enter/leave above
  // (`edges/edgeHoverArbiter.ts`). Where geometry cannot be measured it resolves
  // to this edge, which is exactly the per-edge behaviour it replaced. The seat
  // is THIS mounted copy (its element names its canvas), never the id alone:
  // a comparison view mounts one edge id once per scenario.
  const hoverBehaviourRef = useRef<EdgeHoverBehaviour>({ enter: hoverEnter, leave: hoverLeave })
  hoverBehaviourRef.current = { enter: hoverEnter, leave: hoverLeave }
  const hoverSeat = useMemo<EdgeHoverSeat>(
    () => ({ id: edgeIdKey, behaviour: hoverBehaviourRef, element: edgeGroupRef }),
    [edgeIdKey],
  )
  useEffect(() => registerEdgeHover(hoverSeat), [hoverSeat])
  const handleMouseEnter = (event: React.MouseEvent) => routeEdgeHover(hoverSeat, event.clientX, event.clientY)
  const handleMouseMove = (event: React.MouseEvent) => routeEdgeHoverOnMove(hoverSeat, event.clientX, event.clientY)
  const handleMouseLeave = () => endEdgeHover()
  // The label chip names its own edge; no nearest-line resolution there.
  const handleChipMouseEnter = () => claimEdgeHover(hoverSeat)
  // v3.1 row 12: the hover surface is a non-interactive tooltip
  // (`pointer-events: none`), so there is no "pointer moved into the popover"
  // arm to keep it open — the two handlers that did are gone with it.

  // Detect structural (non-causal) edges. Covers decision→option (organisational
  // wiring) and option→factor (intervention edges). Resolution order:
  //   1. Any explicit data.edge_type wins over node-kind inference
  //      - 'structural' → structural
  //      - any other recognised value (causal/directed/bidirected/confounder) → not structural
  //   2. Otherwise infer from source / target node kinds
  // Returns the tooltip text differentiated by sub-type so the hitbox can
  // attach a native browser tooltip.
  const { isStructuralEdge, structuralTooltip, isOptionFactorLink } = useMemo(() => {
    const explicit = (data as Record<string, unknown> | undefined)?.edge_type as string | undefined
    const srcKind = sourceNode?.type || (sourceNode?.data as Record<string, unknown>)?.kind
    const tgtKind = targetNode?.type || (targetNode?.data as Record<string, unknown>)?.kind
    if (explicit === 'structural') {
      // Use sub-type for tooltip text where possible
      if (srcKind === 'decision' && tgtKind === 'option') {
        return { isStructuralEdge: true, structuralTooltip: 'Option of this decision', isOptionFactorLink: false }
      }
      if (srcKind === 'option' && tgtKind === 'factor') {
        return { isStructuralEdge: true, structuralTooltip: 'This option affects this factor', isOptionFactorLink: true }
      }
      return { isStructuralEdge: true, structuralTooltip: 'Structural link (not analysed)', isOptionFactorLink: false }
    }
    // Any other explicit edge_type disables structural inference. This means a
    // graph that has tagged option→factor edges as 'causal' (overriding the
    // default intervention semantics) keeps full causal styling.
    if (explicit != null && explicit !== '') {
      return { isStructuralEdge: false, structuralTooltip: null, isOptionFactorLink: false }
    }
    // No explicit value — infer from node kinds.
    if (srcKind === 'decision' && tgtKind === 'option') {
      return { isStructuralEdge: true, structuralTooltip: 'Option of this decision', isOptionFactorLink: false }
    }
    if (srcKind === 'option' && tgtKind === 'factor') {
      return { isStructuralEdge: true, structuralTooltip: 'This option affects this factor', isOptionFactorLink: true }
    }
    return { isStructuralEdge: false, structuralTooltip: null, isOptionFactorLink: false }
  }, [data, sourceNode, targetNode])

  /**
   * ⭐⭐ AN OPTION → FACTOR LINK RESTS AT LOW EMPHASIS (Canvas lead's ruling,
   * Paul's staging test 28 Sep 2026). On `pa_vs_ai` four options × three
   * factors drew twelve thin grey links that crossed into a web between the
   * ALTERNATIVES and FACTORS rows — and each option card already lists the
   * changes it makes. At rest the link draws at the canvas's existing DIM
   * (`EDGE_SELECTION_DIM_OPACITY`, the contract's `.edge-group.dimmed`), on the
   * wrapping group, so its hit area is untouched and it stays hoverable and
   * clickable. It returns to full emphasis while its option or its factor is
   * hovered (`canvasNodeHoverStore`) or selected, or while the link itself is.
   *
   * ⚠ THIS DEPARTS FROM CONTRACT v3.1, which draws option links always on.
   * Why: a 4 × 3 web of always-on links hides the causal links below it, and
   * the option cards' rows already carry the changes those links stand for.
   * Question → option links are unchanged.
   */
  const optionLinkEndpointHovered = useCanvasNodeHoverStore((s) =>
    isOptionFactorLink && s.hoveredNodeId !== null && (s.hoveredNodeId === source || s.hoveredNodeId === target),
  )
  const optionLinkEndpointSelected = useCanvasStore((s) =>
    isOptionFactorLink &&
    (s.selection?.nodeIds?.has(source as string) === true || s.selection?.nodeIds?.has(target as string) === true),
  )
  const isOptionLinkAtRest =
    isOptionFactorLink && !optionLinkEndpointHovered && !optionLinkEndpointSelected && !isHovered && !selected

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
      setIsKeyboardFocused(true)
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
      // The ring marks the LINK's own focus: gone the moment focus leaves the
      // link itself, even for its own popover (which has its own focus ring).
      if (event.target === rfEdge) setIsKeyboardFocused(false)
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
   * ⭐⭐ ROW 35 — ENTER/SPACE OPENS WHAT A CLICK OPENS.
   *
   * React Flow's OWN `onKeyDown` is already bound to this same ancestor
   * (`elementSelectionKeys = ['Enter', ' ', 'Escape']`, `@xyflow/system@0.0.76`
   * `dist/esm/index.mjs:27`, consumed at `@xyflow/react@12.10.2`
   * `dist/esm/index.mjs:2895-2907`) — but it only ever calls
   * `addSelectedEdges([id])`. It never calls the `onClick` prop, so the click
   * path this app actually wires — `ReactFlowGraph.tsx`'s `handleEdgeClick`,
   * bound as `onEdgeClick={handleEdgeClick}` → `setShowFullInspector(true)` —
   * stays a MOUSE-ONLY route. A keyboard user who presses Enter on a focused
   * edge gets a SELECTED edge and nothing else: not what a click gets them,
   * and — worse — selection then SUPPRESSES this edge's own hover popover
   * (`showHoverPopover && !selected`, read at the popover's own gate below),
   * so the one thing focus had JUST opened closes under the very key meant to
   * act on the edge.
   *
   * The fix re-uses the SAME click path a mouse already drives, rather than
   * inventing a second one: dispatching a real `click` on the ancestor
   * `.react-flow__edge` reaches React Flow's own `onEdgeClick` — bound via
   * its synthetic listener on that element — which both selects the edge AND
   * calls the app's `onClick`, so a keyboard activation and a mouse click
   * become the SAME event once it lands. No new "what does Enter do" rule is
   * written here; Enter just triggers the click that already has one.
   *
   * Bound to the ANCESTOR for the same reason the focus listener above is:
   * `onKeyDown` in the library's own render (`dist/esm/index.mjs:2911`) is
   * wired to `g.react-flow__edge`, an ancestor of the group THIS component
   * renders, so a listener on our own group would never see a key React Flow
   * had already consumed on that ancestor — `focusin`/`focusout` bubble UP
   * from a descendant; this is the mirror case, a listener that must sit
   * WHERE the key lands rather than try to catch it on the way there.
   *
   * ⚠ ONLY WHEN THE EVENT TARGET IS THE EDGE ITSELF. A descendant control —
   * the fragile-cue-only glyph (`handleFragileCueKeyDown`, its own
   * `tabIndex`/`onKeyDown`) — has its OWN Enter/Space behaviour and its own
   * `stopPropagation`-free keydown, which BUBBLES to this same ancestor; the
   * `event.target !== rfEdge` guard (the identical check `focusIn` above
   * uses) stops this listener from ALSO dispatching a click for that
   * keystroke and opening the full inspector on top of the glyph's own
   * editor. Space is prevented for the same reason
   * `handleFragileCueKeyDown` prevents it: unprevented, it scrolls the page.
   */
  useEffect(() => {
    const group = edgeGroupRef.current
    if (!group) return
    const rfEdge = group.closest('.react-flow__edge')
    if (!rfEdge) return

    const onEdgeKeyDown = (event: KeyboardEvent) => {
      if (event.target !== rfEdge) return
      // A modified Enter belongs to the canvas shortcuts (Cmd/Ctrl+Enter runs),
      // never to "open this link" (review 5823365172 N1).
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      rfEdge.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    }

    rfEdge.addEventListener('keydown', onEdgeKeyDown as EventListener)
    return () => rfEdge.removeEventListener('keydown', onEdgeKeyDown as EventListener)
  }, [])

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
  const labelPlacements = useMemo((): ReadonlyMap<string, { dx: number; dy: number }> => {
    if (!isPersistentChipEdge) return new Map()
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
    // 28 Sep 2026: every link's ARRIVAL SLOT (`edgeGlyphPlacement.ts` rule A),
    // over every measured card — the boxes the slot selector reads.
    const slotBoxes = new Map<string, ArrivalBox>()
    for (const n of getNodes()) {
      const box = routeBoxOf(n as Parameters<typeof routeBoxOf>[0])
      if (box) slotBoxes.set(n.id, box)
    }
    const allEdgesNow = getEdges()
    const nodesForTitles = getNodes()
    const titleOf = memoByTarget((t) => tierLaneTitleBoxFor(nodesForTitles, t))
    const carriesSignNow = signCarrierOver(nodesForTitles)
    /**
     * A layered link that arrives off the apex draws its label at the midpoint
     * of its source port and its SLOT, not the shared handle — so its anchor is
     * that point for every instance, on the same rect basis the resolver uses
     * (source bottom-centre; the slot on the target's top border, `dx` along).
     */
    const slotAnchorFor = (src: RouteBox, tgt: RouteBox, e: { id: string; target: string }) => {
      if (!(src.y + src.height < tgt.y)) return undefined
      const slot = resolveArrivalSlotOnBoard(e.id, e.target, slotBoxes, allEdgesNow, titleOf(e.target), carriesSignNow)
      if (slot.dx === 0) return undefined
      return { x: (src.x + src.width / 2 + tgt.x + tgt.width / 2 + slot.dx) / 2, y: (src.y + src.height + tgt.y) / 2 }
    }
    const routeAnchorFor = (e: { id: string; source: string; target: string; data?: unknown }) => {
      const pt = (e.data as { pathType?: EdgePathType } | undefined)?.pathType ?? 'bezier'
      const src = routeBoxes.find((b) => b.id === e.source)
      const tgt = routeBoxes.find((b) => b.id === e.target)
      // This edge: exactly the route it renders (its own handle positions
      // decide whether it routes at all — a Right→Left edge never does).
      if (e.id === id) {
        if (sameRowRoute) return sameRowRoute.labelAnchor ?? undefined
        return arrivalKey !== '' && src && tgt ? slotAnchorFor(src, tgt, e) : undefined
      }
      if (pt === 'straight' || pt === 'smoothstep') return undefined
      if (!src || !tgt) return undefined
      // Another edge: BaseNode and the ghost nodes declare one source handle
      // (Bottom) and one target handle (Top), so its render guard reduces to
      // the handle-height test — which both resolvers already imply (a shared
      // row band, or a target wholly above: target top above source bottom).
      const others = routeBoxes.filter((b) => b.id !== e.source && b.id !== e.target)
      return resolveCardEdgeRoute(src, tgt, others)?.labelAnchor ?? slotAnchorFor(src, tgt, e)
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
    // The WHOLE assignment: this edge takes its own offset below, and the
    // fragile-cue pass reads where every pinned strength chip landed.
    return resolvePersistentLabelPlacements(placementEdges, nodeRects)
    // nodeRectsSignature is the recompute trigger for node movement (the
    // whole placement is derived from node geometry, so it covers this
    // edge's own endpoints too).
  }, [isPersistentChipEdge, topStrengthIds, fragileLabelIds, getEdges, getNode, getNodes, id, lensHiddenNodeIds, lensHiddenEdgeIds, nodeRectsSignature, sameRowRoute, arrivalKey])
  const collisionOffset = labelPlacements.get(id as string) ?? { dx: 0, dy: 0 }

  // Total label displacement (Task 9c proximity nudge + collision stack),
  // relative to the rendered label anchor (labelX/labelY).
  const labelOffsetX = collisionOffset.dx
  const labelOffsetY = collisionOffset.dy

  /**
   * ⭐ THE CUE DISC SITS AT ITS CONNECTION'S MIDPOINT (post-run DIFF item 12;
   * contract v3.1 `renderEdges`: the `edge-cue` at `(ax+bx)/2, (ay+by)/2`) — see
   * `fragileCuePlacement.ts`. It used to ride the LABEL placement above: the
   * label anchor moved by a resolver clearing a strength-chip box 22× the
   * disc's width, which on `mrr-90b8f080` put the disc on the Goal card beside
   * its arrival glyphs, 0.95 of the way along "Pro plan price → MRR".
   *
   * Which edges are DISCS at rest: every member of the fragile set
   * (`fragileLabelIds`, the budget — unchanged) except one that also carries a
   * pinned strength row, whose fragility row stays inside that two-row chip
   * (Detailed view only: `topStrengthIds` is empty in Standard). One pass over
   * every disc from the same store snapshot, so each edge takes its own
   * answer; the fraction it returns is then read off THIS edge's drawn path.
   * The label placement pass is untouched, so no strength chip moves.
   */
  const fragileCuePlacement = useMemo(() => {
    if (!showFragileRow) return null
    const discIds = [...fragileLabelIds].filter((eid) => !topStrengthIds.has(eid) && !lensHiddenEdgeIds.has(eid))
    // `id as string`: the file's pre-existing `EdgeProps` typing break (see the
    // glyph selector's note) — React Flow supplies it as a string.
    if (!discIds.includes(id as string)) return null
    const routeBoxes: RouteBox[] = []
    const tieredBoxes: Array<RouteBox & { tier: number }> = []
    for (const n of getNodes()) {
      if (n.hidden || lensHiddenNodeIds.has(n.id)) continue
      const box = routeBoxOf(n as Parameters<typeof routeBoxOf>[0])
      if (!box) continue
      routeBoxes.push(box)
      const tier = typeof n.type === 'string' ? TIER_BY_KIND[n.type] : undefined
      if (tier !== undefined && !isGhostNode(n.id)) tieredBoxes.push({ ...box, tier })
    }
    // Where the handles stand against the boxes, read off THIS edge's own
    // endpoints (the target handle is on the kind shape, which stands above the
    // card by an amount that scales with the zoom) and applied to every cue's
    // path, so each is drawn from the points xyflow gives it.
    const ownSrc = routeBoxes.find((b) => b.id === source)
    const ownTgt = routeBoxes.find((b) => b.id === target)
    const ends = ownSrc && ownTgt && sourcePosition === Position.Bottom && targetPosition === Position.Top
      ? { sourceDy: sourceY - (ownSrc.y + ownSrc.height), targetDy: targetY - ownTgt.y }
      : { sourceDy: 0, targetDy: 0 }
    const allEdges = getEdges()
    const nodesNow = getNodes()
    // Every link's ARRIVAL SLOT, exactly as each `StyledEdge` draws its own
    // (`edgeGlyphPlacement.ts` rule A): the same function over the same boxes
    // (every measured card, as the slot selector reads them).
    const slotBoxes = new Map<string, ArrivalBox>()
    const kindById = new Map<string, unknown>()
    for (const n of nodesNow) {
      kindById.set(n.id, n.type ?? (n.data as Record<string, unknown> | undefined)?.kind)
      const box = routeBoxOf(n as Parameters<typeof routeBoxOf>[0])
      if (box) slotBoxes.set(n.id, box)
    }
    const titleOf = memoByTarget((t) => tierLaneTitleBoxFor(nodesNow, t))
    const carriesSign = signCarrierOver(nodesNow)
    const slotOf = (e: { id: string; target: string }): ArrivalSlot =>
      resolveArrivalSlotOnBoard(e.id, e.target, slotBoxes, allEdges, titleOf(e.target), carriesSign)
    // Each card keeps its kind-shape column (an apex arrival's head and sign);
    // every causal link's head and sign are marks on the last stretch of its
    // own path, wherever its slot put its end (rule B).
    const rows = new Map<string, { dxMin: number; dxMax: number } | null>(routeBoxes.map((c) => [c.id, null]))
    const arrivalMarks = arrivalMarkBoxes(
      allEdges
        .filter((e) => !lensHiddenEdgeIds.has(e.id) && !linkIsStructural(kindById.get(e.source), kindById.get(e.target), e.data))
        .map((e) => cardEdgePathFromBoxes(e.source, e.target, routeBoxes, tieredBoxes, ends, slotOf(e))),
    )
    // Every strength chip the label pass PINNED (Detailed view only — none in
    // Standard), as the box it clears: its rendered anchor plus its offset.
    const chips: RouteBox[] = [...arrivalMarks]
    for (const e of allEdges) {
      if (!topStrengthIds.has(e.id) || lensHiddenEdgeIds.has(e.id)) continue
      const off = labelPlacements.get(e.id)
      const at = off ? cardEdgeLabelAnchorFromBoxes(e.source, e.target, routeBoxes, tieredBoxes, ends, slotOf(e)) : null
      if (!off || !at) continue
      const halfH = labelHalfHeightForRows(fragileLabelIds.has(e.id) ? 2 : 1)
      chips.push({ id: e.id, x: at.x + off.dx - LABEL_HALF_WIDTH, y: at.y + off.dy - halfH, width: 2 * LABEL_HALF_WIDTH, height: 2 * halfH })
    }
    const cues = allEdges
      .filter((e) => discIds.includes(e.id))
      .map((e) => ({ id: e.id, path: cardEdgePathFromBoxes(e.source, e.target, routeBoxes, tieredBoxes, ends, slotOf(e)) }))
    return resolveFragileCuePlacements(cues, routeBoxes, ends.targetDy, rows, chips).get(id as string) ?? null
    // nodeRectsSignature: re-place when any card moves (the same trigger the label pass uses);
    // the endpoints: the handles move with the zoom.
  }, [showFragileRow, fragileLabelIds, topStrengthIds, lensHiddenEdgeIds, lensHiddenNodeIds, id, source, target, sourceY, targetY, sourcePosition, targetPosition, getNodes, getEdges, nodeRectsSignature, labelPlacements])

  /**
   * The disc's point on THIS edge's drawn path; the midpoint when the pass had
   * no answer for it. To 0.01 graph units, as the route keys are, so the
   * flattening's float noise never reaches the transform.
   */
  const fragileCuePoint = useMemo(() => {
    if (!showFragileRow) return null
    const poly = flattenSvgPath(edgePath)
    if (!poly) return null
    const p = pointAtFraction(poly, fragileCuePlacement?.fraction ?? 0.5)
    return { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 }
  }, [showFragileRow, edgePath, fragileCuePlacement])

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
   * ⭐⭐ WHERE THE POLARITY GLYPH SITS — ON ITS OWN LINE, just above its own
   * arrowhead (Paul's staging test, 28 Sep 2026; `edgeGlyphPlacement.ts` rule
   * B). The row this replaces stood every sign of a card in one row above a
   * shared arrival point, and a band-title keep-out could shift the whole row:
   * on `pa_vs_ai` a `+` sat ~65px from its own arrowhead, on no line at all.
   *
   * Read off THIS edge's drawn path (so it follows the arrival slot above and
   * any lead or detour), at the zoom it paints at: the head and the mark gap
   * carry the glyph counter-scale, the sign's box the text scale. It slides
   * along its own line — never off it — to clear every card and the target
   * row's band title, and never rises past the tier gap's bound.
   *
   * ⭐ STILL P0-SAFE: two edges into one card end at distinct arrival slots
   * (`resolveArrivalSlot`'s one total order), so two signs on their own paths
   * cannot share a spot at that card — the stack this module once existed for
   * (21 of 21 at `a1fd39cc`) needs two paths to share an end.
   */
  const glyphPlacement = useMemo(() => {
    // Only where a sign can render (the render predicate below is a subset).
    if ((!statedDirection && !isSignDisputed) || isStructuralEdge) return null
    const poly = flattenSvgPath(edgePath)
    if (!poly) return null
    const glyphScale = glyphCounterScale(edgeTooltipZoom)
    const keepOuts: GlyphKeepOut[] = []
    let cardTop = endY
    const nodesNow = getNodes()
    const slotBoxes = new Map<string, ArrivalBox>()
    const kindById = new Map<string, unknown>()
    for (const n of nodesNow) {
      kindById.set(n.id, n.type ?? (n.data as Record<string, unknown> | undefined)?.kind)
      const box = routeBoxOf(n as Parameters<typeof routeBoxOf>[0])
      if (!box) continue
      slotBoxes.set(n.id, box)
      if (n.hidden || lensHiddenNodeIds.has(n.id)) continue
      if (n.id === target) cardTop = box.y
      keepOuts.push({ x0: box.x, y0: box.y, x1: box.x + box.width, y1: box.y + box.height })
    }
    // v3.1 WS1 #28: keep the sign off the target row's band title.
    const titleBox = tierLaneTitleBoxFor(nodesNow, target as string)
    if (titleBox) keepOuts.push(titleBox)
    // A layered arrival: keep the sign off every OTHER arrowhead at this card,
    // each at its own slot (the same function the slot selector runs).
    if (!sameRowRoute && sourcePosition === Position.Bottom && targetPosition === Position.Top && targetY > sourceY) {
      const allEdges = getEdges()
      const carriesSign = signCarrierOver(nodesNow)
      for (const e of allEdges) {
        if (e.target !== target || e.id === id || lensHiddenEdgeIds.has(e.id)) continue
        const src = slotBoxes.get(e.source)
        if (!src || !(src.y + src.height < cardTop)) continue
        if (linkIsStructural(kindById.get(e.source), kindById.get(e.target), e.data)) continue
        const slot = resolveArrivalSlotOnBoard(e.id, e.target, slotBoxes, allEdges, titleBox, carriesSign)
        keepOuts.push(arrivalHeadKeepOut({ x: targetX + slot.dx, y: slot.onKindShape ? targetY : cardTop }, glyphScale))
      }
    }
    const metrics = glyphMetricsAt(edgeStrokeWidth, glyphScale, labelCounterScale(edgeTooltipZoom))
    return resolvePolarityGlyphOnPath(poly, cardTop, metrics, keepOuts)
    // nodeRectsSignature: re-place when any card moves.
  }, [statedDirection, isSignDisputed, isStructuralEdge, sameRowRoute, edgePath, endY, getNodes, getEdges, lensHiddenNodeIds, lensHiddenEdgeIds, id, target, sourcePosition, targetPosition, sourceY, targetX, targetY, edgeStrokeWidth, edgeTooltipZoom, nodeRectsSignature])

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
  const arrowheadSize = edgeArrowheadSize(edgeStrokeWidth)

  // THE LINE'S DRAWN WIDTH, in every lens and interaction state — ONE value,
  // read by `BaseEdge` below and by the keyboard focus ring (SI-4), which must
  // stand clear of it. Hoisted out of `BaseEdge`'s style unchanged, so the ring
  // cannot size itself from a second copy of this ladder.
  // Interaction widths: selected +2, hovered +1 (a highlighted path adds none)
  const lineStrokeWidth = (() => {
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
    // A highlighted PATH edge (another node's selection) is NOT here:
    // contract §03 marks it with the soft glow in `BaseEdge`'s `filter` and no
    // width rule, because width is the strength channel and a +1 made a
    // slight link on the path read as a moderate one while selected.
    if (isHovered) return edgeStrokeWidth + 1
    return edgeStrokeWidth
    })()
    // Analysis-graph projection: a viewed flip-risk edge is marked by its
    // info glow in `BaseEdge`'s `filter`, and NO LONGER by a width floor
    // (contract v3.1, E4): `Math.max(base, 4)` drew a slight flip risk as
    // thick as a strong one, the same erasure as above. Colour is never
    // replaced; the glow is the transient viewing cue.
    return base
  })()

  // The ribbon's gate, ONE copy: the ribbon below paints on it, and the keyboard
  // focus ring reads it to stand clear of the ribbon (SI-4).
  const showUncertaintyRibbon = uncertaintyBand !== null && !isStructuralEdge && (selected || isHovered)
  const focusRing = edgeFocusRingGeometry(
    lineStrokeWidth,
    showUncertaintyRibbon && uncertaintyBand !== null ? uncertaintyBand * 2 : 0,
  )
  // Built on the arrowhead's id, which is already escaped for `url(#…)`.
  const focusRingMaskId = `${arrowheadId}-focus-ring-cut`

  // Causal lens: hide structural edges entirely
  if (isLensHidden) return null

  return (
    <>
      {/* ⭐ SI-4 (audit, 27 Sep 2026) — THE KEYBOARD FOCUS RING, SHAPED TO THE
          LINK. Tabbing onto a structural link changed nothing a person could
          see: React Flow's `.react-flow__edge:focus-visible{outline:none}` and
          its focus stroke loses to this component's inline `stroke`, and a
          structural line is fixed at 1px with a 1.5px 25% hover glow — 0
          changed pixels at 1x. The contract's ring is a 2px Info outline
          (`[tabindex]:focus-visible`); an outline box around a diagonal link
          would enclose unrelated cards, so the ring follows the path instead.
          Keyboard focus only; drawn in every lens.

          ⛔ FIRST IN PAINT ORDER, AND WIDER THAN EVERYTHING IT SURROUNDS
          (review, 28 Sep 2026). It used to paint AFTER the uncertainty ribbon,
          opaque, at the line's width + 4: on a 2px link that covered the 7px
          floor ribbon entirely, so under keyboard focus a stated uncertainty
          and an unassessed link looked the same — the invisible-floor defect
          the ribbon's own comment records fixing, re-opened by a second mark.
          Now it is an OUTLINE: `edgeFocusRingGeometry` draws it
          `EDGE_FOCUS_RING_WIDTH` wider than the wider of the drawn line and
          the drawn ribbon on each side, and a mask cuts the band those two
          occupy back out. So the ring is 2px of Info OUTSIDE the ribbon's outer
          edge (or the line's, when there is no ribbon) and never paints a pixel
          inside it: the ribbon composites over the canvas exactly as it does on
          hover. A ring painted UNDER the ribbon without the cut was tried
          first and is not enough — the ribbon is 0.2-opacity ink, so over
          Info its contrast with what is behind it fell from 1.40:1 to 1.17:1
          and, in the browser, it read as one thick blue band. It is still the
          FIRST visible paint of the edge, so where anti-aliasing overlaps, the
          ribbon and the line win.

          ⛔ OUTSIDE THE SELECTION-DIM GROUP (review note, 28 Sep 2026). Inside
          the `<g>` below, a focused link off the selected path wore its ring at
          `EDGE_SELECTION_DIM_OPACITY` (0.18): a focus indicator a keyboard user
          cannot see. The dim is the connection's attention channel and still
          applies to everything the connection draws; the ring marks React
          Flow's focusable wrapper, which is never dimmed, so it sits BESIDE the
          group — and before it, so it still paints under the ribbon and the
          line. */}
      {isKeyboardFocused && (
        <>
          {/* The CUT: everything shows except a band `cutWidth` wide along the
              path — the line and the ribbon. Same `non-scaling-stroke` as they
              use, so the cut and what it protects stay the same screen width
              at every zoom. User-space region, not the bounding-box default:
              a horizontal link has a zero-height box, which would mask the
              whole ring away. */}
          <mask
            id={focusRingMaskId}
            maskUnits="userSpaceOnUse"
            x={-FOCUS_RING_MASK_EXTENT}
            y={-FOCUS_RING_MASK_EXTENT}
            width={2 * FOCUS_RING_MASK_EXTENT}
            height={2 * FOCUS_RING_MASK_EXTENT}
          >
            <rect
              x={-FOCUS_RING_MASK_EXTENT}
              y={-FOCUS_RING_MASK_EXTENT}
              width={2 * FOCUS_RING_MASK_EXTENT}
              height={2 * FOCUS_RING_MASK_EXTENT}
              fill="white"
            />
            <path
              d={edgePath}
              data-edge-focus-ring-cut=""
              fill="none"
              stroke="black"
              strokeWidth={focusRing.cutWidth}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </mask>
          <path
            d={edgePath}
            data-edge-focus-ring=""
            fill="none"
            strokeLinecap="round"
            aria-hidden="true"
            mask={`url(#${focusRingMaskId})`}
            style={{
              // A style, not the `stroke` attribute: `var()` in an SVG
              // presentation attribute is not reliably resolved.
              stroke: 'var(--info)',
              strokeWidth: focusRing.strokeWidth,
              vectorEffect: 'non-scaling-stroke',
              pointerEvents: 'none',
            }}
          />
        </>
      )}
      {/* Wrapper captures hover for the entire edge hit area. Hover handlers live
          here so they fire regardless of whether the pointer is over the custom
          hitbox path or BaseEdge's interaction path (which renders on top in SVG
          paint order). Both paths bubble mouseenter/mouseleave to this <g>. */}
      {/* ⭐ contract v3.1 (E6, 24 Sep 2026) — THE SELECTION DIM IS THE WHOLE
          CONNECTION'S, NOT THE LINE'S. It used to be a 0.25 on `BaseEdge` alone,
          so the ribbon, the assistant halo and the arrowhead's line dimmed
          unevenly and the portalled glyph and chip floated at full strength
          over a faded line. The contract dims `.edge-group` as one unit, at
          .18 (§03); the portalled marks below carry the same value. */}
      <g
        ref={edgeGroupRef}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        data-analysis-fragile={isAnalysisFragileEdge && !isStructuralEdge ? 'true' : undefined}
        data-assistant-focused={isAssistantFocused ? 'true' : undefined}
        data-selection-dimmed={isSelectionDimmed ? 'true' : undefined}
        data-run-change={isRunChangedEdge ? 'changed' : undefined}
        data-run-change-subdued={isRunChangeSubduedEdge ? 'true' : undefined}
        data-option-link-rest={isOptionLinkAtRest ? 'true' : undefined}
        data-same-row-route={sameRowRoute?.kind}
        style={{
          // An option → factor link at rest takes the same dim (see
          // `isOptionLinkAtRest`); one value, never compounded.
          opacity: isSelectionDimmed || isOptionLinkAtRest || isRunChangeSubduedEdge ? EDGE_SELECTION_DIM_OPACITY : undefined,
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
          ceiling, provenance gate) is unchanged; only WHEN and in WHAT INK.

          ⛔ KEYBOARD FOCUS MUST NOT HIDE IT (review, 28 Sep 2026). The SI-4
          focus ring (above) paints BEFORE this ribbon, is sized from
          `showUncertaintyRibbon` and this width, and is masked out along it,
          so it is an outline around the ribbon and never paints over it;
          `StyledEdge.keyboardFocusRing.si4.spec.tsx` pins all three. */}
      {showUncertaintyRibbon && uncertaintyBand !== null && (
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

          ⭐ contract v3.1 (DIFF item 13, 27 Sep 2026): the head is 4× the
          line's STRENGTH width (`edgeArrowheadSize`) — the contract's
          `markerWidth="4"` in stroke-width units — read from `edgeStrokeWidth`,
          the resting width, so hover and selection (which widen the line) never
          grow the head. The tip is the viewBox origin and `refX/refY` point at
          it, so the point lands ON the path's end; the polygon is counter-scaled
          about that tip by `--canvas-glyph-scale`, because the line is
          `non-scaling-stroke` and the head must keep its 4:1 against it at every
          zoom. `overflow="visible"` lets the scaled head paint past the marker
          box. Derivation and witness: `edgeArrowheadSize` in
          `edges/edgePresentation.ts`. */}
      {directionMarker.show && (
        <marker
          id={arrowheadId}
          viewBox={edgeArrowheadViewBox(arrowheadSize)}
          markerWidth={arrowheadSize}
          markerHeight={arrowheadSize}
          refX={0}
          refY={0}
          orient="auto"
          markerUnits="userSpaceOnUse"
          overflow="visible"
        >
          <polygon
            points={edgeArrowheadPolygonPoints(arrowheadSize)}
            fill={edgeStroke.value}
            style={EDGE_ARROWHEAD_COUNTER_SCALE_STYLE}
          />
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
          // `lineStrokeWidth` (above the `return`): the ladder, hoisted so the
          // keyboard focus ring reads the same width.
          strokeWidth: lineStrokeWidth,
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
            // The Changes view: a changed link takes the SAME emphasis glow as a selected one — the canvas's one
            // "look here" recipe, never a new colour on a stroke that already carries direction.
            if (isRunChangedEdge && !selected && !isHighlightedEdge) shadows.push(EDGE_GLOW.selected)
            if (!isSelectionDimmed) {
              if (selected) shadows.push(EDGE_GLOW.selected)
              else if (isHighlightedEdge) shadows.push(isRunChangedEdge ? EDGE_GLOW.lit : EDGE_GLOW.selected)
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
              // On its own drawn line, whichever route drew it (a same-row or
              // rising route ends away from the top handle; the sign follows).
              transform: glyphPlacement
                ? polarityGlyphTransform(glyphPlacement.x, glyphPlacement.y)
                // An unreadable path (never one this canvas draws): just above its end.
                : polarityGlyphTransform(endX, endY - GLYPH_PAINTED_BOX_FLOW),
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
              // A cue-only disc sits ON its connection at the midpoint
              // (`fragileCuePoint`); a chip with a strength row keeps the label
              // placement.
              transform: fragileCueOnly && fragileCuePoint
                ? `translate(-50%, -50%) translate(${fragileCuePoint.x}px,${fragileCuePoint.y}px)`
                : `translate(-50%, -50%) translate(${labelX + labelOffsetX}px,${labelY + labelOffsetY}px)`,
              pointerEvents: 'all',
              // contract v3.1 (E10): a cue-only chip is the contract's 16px
              // disc (`<circle class="cue-bg" r="8"/>`), counter-scaled like the
              // text so it is 16px ON SCREEN; with a strength row it keeps the
              // row form. The disc is placed on its connection
              // (`fragileCuePoint`), and the label pass still reserves the
              // one-row slot it always reserved, so no neighbouring chip moves.
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
            onClick={fragileCueOnly ? handleFragileCueActivate : handleChipClick}
            onKeyDown={fragileCueOnly ? handleFragileCueKeyDown : undefined}
            data-fragile-cue={fragileCueOnly ? 'disc' : undefined}
            // Identity binding, as the polarity glyph's `data-edge-id`: which
            // connection this chip belongs to, without reading portal order
            // (trap 19). Its own name, so a `[data-edge-id]` glyph query never
            // meets a chip.
            data-cue-edge-id={id}
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
                ...(showLabel && strengthMarkedEstimate ? [ESTIMATE_SUBJECT_TITLE.strength] : []),
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
            onMouseEnter={handleChipMouseEnter}
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
                      className={`${CANVAS_INLINE_TEXT_GLYPH_SIZE_CLASSES[12]} text-info flex-shrink-0`}
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
                  {strengthMarkedEstimate && (
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
                  className={`flex-shrink-0 ${CANVAS_INLINE_TEXT_GLYPH_SIZE_CLASSES[fragileCueOnly ? 10 : 12]}`}
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

      {/* ⭐ "NOT SAVED · SET STRENGTH" — THE EDIT-STATE WORD ON A CANVAS-ONLY
          LINK (canvas audit edit-structure/F3, 27 Sep 2026; contract v3.1 §02
          "Edit-state words stay visible … Not saved", `.state-word`).

          A drawn link with no stated strength stands down and is never sent
          (`utils/canvasOnlyLink.ts`). It used to look identical to a saved
          link once the toast faded — measured 1px grey, solid, no label — and
          vanished on reload. This word stays until a strength is stated (the
          capture then clears the receipt), and it is the way in: one click
          opens the link panel whose add-control sends it.

          ⛔ WORDS, NOT A DASH: dash is existence certainty only (Paul, 23 Sep
          point 4). 10px via the canvas mark token, so it counter-scales; sits
          just ABOVE the midpoint, clear of the line and of a hover/selection
          label on it (a long horizontal route runs along the top of the next
          row of cards, so below would sit on a card — measured on
          pricing-model). */}
      {canvasOnlyLink && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className={`nodrag nopan ${typography.nodeMark} inline-flex items-center gap-[calc(4px*var(--canvas-label-scale,1))] whitespace-nowrap rounded-full border border-panel-border bg-panel text-text-body px-[calc(6px*var(--canvas-label-scale,1))] py-[calc(2px*var(--canvas-label-scale,1))] hover:text-info-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-info`}
            style={{
              position: 'absolute',
              transform: `translate(${labelX}px,${labelY}px) translate(-50%, calc(-100% - 8px * var(--canvas-label-scale, 1)))`,
              pointerEvents: 'all',
              // contract v3.1 (E6): dims with its connection, never floats over it.
              opacity: isSelectionDimmed ? EDGE_SELECTION_DIM_OPACITY : undefined,
            }}
            title={CANVAS_ONLY_LINK_MARK.title}
            aria-label={`${CANVAS_ONLY_LINK_MARK.word}: ${CANVAS_ONLY_LINK_MARK.action} for the connection from ${srcTitle} to ${tgtTitle}`}
            data-testid={`edge-canvas-only-${edgeIdKey}`}
            onPointerDown={(event) => { event.stopPropagation() }}
            onClick={(event) => {
              event.stopPropagation()
              openEdgeStrengthEditor(edgeIdKey)
            }}
          >
            <span>{CANVAS_ONLY_LINK_MARK.word}</span>
            <span aria-hidden="true">·</span>
            <span>{CANVAS_ONLY_LINK_MARK.action}</span>
          </button>
        </EdgeLabelRenderer>
      )}

      {/* ⭐ THE CONNECTION HOVER IS A LIGHT PANEL AGAIN (Paul, 29 Sep 2026: bring
          the pop-up back, in the graph design system, server data only). It
          replaced v3.1's one-line dark tooltip (DESIGN-GAP-v31 row 12), which
          had itself replaced a popover that carried percentages, a strength
          bar, a duplicate "Positive" and buttons. `LinkHoverCard` keeps the
          one-line tooltip's sentences (arrow + doubt clause, disputed sign,
          flip risk, placeholder) and adds Direction and Strength with WHO
          stated each — read from the resolvers above, never re-derived.
          Non-interactive, counter-scaled, placed clear of the cards, keyed by
          this edge's id (`data-edge-popover`) for the focus-out rule.
          Structural links keep their native `<title>` on the hit path. */}
      {showHoverPopover && !selected && !isStructuralEdge && (() => {
        // The WORD comes from the resolver, never from the sign of a number
        // whose direction may have been defaulted.
        const dirLabel = statedDirection === null
          ? null
          : statedDirection === 'positive' ? 'Positive' : 'Negative'
        return (
          <EdgeLabelRenderer>
            <LinkHoverCard
              edgeId={edgeIdKey}
              labelX={labelX}
              labelY={labelY}
              zoom={edgeTooltipZoom}
              surfaceRef={popoverElRef}
              arrowSentence={edgeArrowSentence(String(srcTitle), String(tgtTitle), dirLabel, { signDisputed: isSignDisputed })}
              doubtSentence={existenceDash.kind === 'stated' && existenceDash.dash !== undefined ? EDGE_EXISTENCE_DOUBT_SENTENCE : null}
              direction={directionDisplay}
              disputedSentence={isSignDisputed
                ? `${DIRECTION_DISPUTED_SENTENCE}${dirLabel !== null ? ` ${directionInUseSentence(dirLabel)}` : ''}`
                : null}
              strength={edgeSignedStrength}
              strengthSettled={!strengthUnconfirmed}
              strengthDefinitional={strengthIsDefinitional}
              placeholderSentence={strengthIsPlaceholder ? EDGE_STRENGTH_PLACEHOLDER_SENTENCE : null}
              fragileSentence={isFragileEdge ? fragileSentence : null}
              size={edgeSize}
            />
          </EdgeLabelRenderer>
        )
      })()}

    </>
  )
})

StyledEdge.displayName = 'StyledEdge'
