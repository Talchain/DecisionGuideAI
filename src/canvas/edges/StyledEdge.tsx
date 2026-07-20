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
import { useGuidanceStore } from '../stores/guidanceStore'
import { useShallow } from 'zustand/react/shallow'
import type { EdgeData, EdgePathType } from '../domain/edges'
import { shouldShowEdgeLabel } from './edgeLabelVisibility'
import { computeDirectionStroke } from './directionStroke'
import { resolvePersistentLabelPlacements, type PlacementEdge } from './edgeLabelCollision'
import { applyEdgeVisualProps } from '../theme/edges'
import { formatConfidence, shouldShowLabel, getEdgeConfidence, computeSignedMean } from '../domain/edges'
import { useIsDark } from '../hooks/useTheme'
import { getEdgeLabel } from '../domain/edgeLabels'
import { useEdgeLabelMode } from '../store/edgeLabelMode'
import { EdgeEditPopover } from './EdgeEditPopover'
import { useCanvasStore } from '../store'
import { isGraphLensEnabled } from '../../flags'
import { isEdgeFragile as isEdgeFragileFn, getFragileEdgeSwitchProbability, isTopFragileEdge as isTopFragileEdgeFn } from '../utils/fragileEdgeMatch'
import { existenceCertaintyToLineStyle, calculateEdgeImportance, importanceToStrokeWidth, weightMagnitudeToStrokeWidth } from '../utils/graphDisplayCalculations'
import { typography } from '../../styles/typography'
import { getStrengthDescription, getProvenanceLabel } from '../ui/inspector-v2/inspectorStrings'
import { useEdgeEditHint } from '../hooks/useFirstTimeHints'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

/**
 * StyledEdge with semantic visual properties
 * Maps weight/style/curvature to SVG rendering
 * v1.2 + P1: Live edge label toggle (human ⇄ numeric)
 */
// Direction colours (green/red/grey) are pre-existing hex — not changed in this brief.
// All new styling uses design tokens.

// Structural edge grey — brief constant, not a theme token. Used for the
// thin 1px solid stroke on decision→option and option→factor edges so they
// recede visually next to causal edges. Exported so tests track the colour
// via the constant rather than a hard-coded literal.
export const STRUCTURAL_EDGE_COLOUR = '#B8B8B8'

// Stable empty set for the lens-disabled branch of the store selector —
// a fresh Set per call would defeat useShallow's reference equality.
const EMPTY_ID_SET: ReadonlySet<string> = new Set<string>()

export const StyledEdge = memo(({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, data }: EdgeProps<EdgeData>) => {
  const isDark = useIsDark()
  const prefersReducedMotion = usePrefersReducedMotion()
  const { getNode, getEdges, getNodes } = useReactFlow()

  // P1 Polish: Edge label mode from Zustand store (live updates, cross-tab sync)
  const labelMode = useEdgeLabelMode(state => state.mode)

  // P1.6: First-time edge edit hint
  const { showHint: showEdgeHint, dismissHint: dismissEdgeHint } = useEdgeEditHint()
  const edges = getEdges()
  const isFirstEdge = edges.length > 0 && edges[0].id === id

  // P0-9: Inline edit popover state
  const [showEditPopover, setShowEditPopover] = useState(false)
  const [editPopoverPosition, setEditPopoverPosition] = useState({ x: 0, y: 0 })

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
  // ── Consolidated store selectors (2 subscriptions instead of 13) ──
  // Group 1: Core store data (results, review, actions)
  const { updateEdgeData, ceeReview, resultsStatus, report, isHighlightedEdge, viewMode } = useCanvasStore(
    useShallow(s => ({
      updateEdgeData: s.updateEdgeData,
      ceeReview: s.runMeta.ceeReview,
      resultsStatus: s.results.status,
      report: s.results.report,
      isHighlightedEdge: s.highlightedEdges.has(id),
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
          causalEdgeParams: null as { mean: number; std: number | null; existsProb: number | null } | null,
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
  const direction = edgeData?.direction as 'positive' | 'negative' | undefined  // v2.2

  // Count outgoing edges from source node for visibility logic
  const outgoingEdgeCount = useMemo(() => {
    const edges = getEdges()
    return edges.filter(e => e.source === source).length
  }, [source, getEdges])

  // Apply visual properties (O(1), pure function)
  const visualProps = useMemo(
    () => applyEdgeVisualProps(weight, style, curvature, selected || false, false, isDark),
    [weight, style, curvature, selected, isDark]
  )

  // Task A: Edge thickness based on importance (Results) or weight magnitude (Edit)
  const edgeStrokeWidth = useMemo(() => {
    if (!isResultsMode || !report) {
      // D.1: Pre-run mode — stroke width encodes weight magnitude
      return weightMagnitudeToStrokeWidth(computeSignedMean(edgeData as Record<string, unknown> | undefined))
    }

    // Get factor_sensitivity data
    const factorSensitivity = report.enrichment?.sensitivity_analysis?.factors ||
                             report.factor_sensitivity ||
                             []

    if (factorSensitivity.length === 0) {
      return visualProps.strokeWidth // Fallback: no sensitivity data
    }

    // Find the source node's elasticity (goal_sensitivity)
    // Fix 4: For edges from non-factor nodes (Outcome/Risk/Goal), use elasticity=1.0 fallback
    const sourceFactor = factorSensitivity.find((f: any) => {
      const factorId = f.factor_id || f.factorId || f.node_id || f.nodeId
      return factorId === source
    })
    const goalSensitivity = sourceFactor ?
      Math.abs(sourceFactor.elasticity ?? sourceFactor.sensitivity_score ?? sourceFactor.importance_score ?? 0) :
      1.0 // Fallback for non-factor nodes: use 1.0 to provide meaningful variation based on belief×strength

    // Calculate importance for this edge
    const belief = edgeData?.beliefExists
    const strength = weight // edge weight represents causal strength
    const importance = calculateEdgeImportance(belief, strength, goalSensitivity)

    // Get all edges to find max importance
    const allEdges = getEdges()
    const importances = allEdges.map(edge => {
      const edgeSource = edge.source
      const edgeData = edge.data as EdgeData | undefined
      const sourceFactor = factorSensitivity.find((f: any) => {
        const factorId = f.factor_id || f.factorId || f.node_id || f.nodeId
        return factorId === edgeSource
      })
      const goalSens = sourceFactor ?
        Math.abs(sourceFactor.elasticity ?? sourceFactor.sensitivity_score ?? sourceFactor.importance_score ?? 0) :
        1.0 // Fix 4: Fallback for non-factor edges
      const belief = edgeData?.beliefExists
      const strength = edgeData?.weight ?? 0.5 // Aligned with DEFAULT_EDGE_DATA.weight
      return calculateEdgeImportance(belief, strength, goalSens)
    })
    const maxImportance = Math.max(...importances, 0)

    // Map to stroke width (1-8px range)
    return importanceToStrokeWidth(importance, maxImportance)
  }, [isResultsMode, report, source, edgeData?.beliefExists, weight, getEdges, edgeData?.direction])

  // F.2 + E1: direction-based stroke colour (see directionStroke.ts for the
  // CVD-aware polarity palette and the ΔE rationale). Applies pre-run and
  // post-run; one source of truth shared with directionColour.spec.
  const directionStroke = useMemo(
    () => computeDirectionStroke(direction, weight, edgeData?.weight, isDark),
    [direction, weight, edgeData?.weight, isDark],
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

  // Contested edge styling — dashed info-colour stroke scaled by max_divergence
  // Resolved or absent validation: revert to normal rendering.
  // If max_divergence is absent, treat as non-contested (no inferred divergence).
  const validation = edgeData?.validation
  const isContested = validation?.status === 'contested'
    && validation?.user_action === 'pending'
    && validation?.max_divergence !== undefined
    && validation?.max_divergence !== null
  const needsUserInput = isContested && (validation?.pass2?.needs_user_input === true)

  // Contested dash: gap scales with max_divergence (0→1 maps to 4→8px gap)
  // needs_user_input gets a tighter dash for stronger visual signal
  const contestedDashArray = isContested
    ? (() => {
        const divergence = validation!.max_divergence
        const gap = needsUserInput ? 3 : Math.round(4 + divergence * 4)
        // Dash width scales between 1.5px and 3px: 1.5 + divergence * 1.5
        const dashWidth = Number((1.5 + divergence * 1.5).toFixed(1))
        return `${dashWidth} ${gap}`
      })()
    : null

  // Fix 1: Line style encodes existence certainty ONLY, not direction
  // Direction is already encoded via color (green/red) and sign (+/−)

  // D.1: Unified confidence check via getEdgeConfidence (returns null when missing)
  const edgeConfidenceValue = getEdgeConfidence(edgeData as Record<string, unknown> | undefined)

  // B.I.10: Pre-run overlay — dashed stroke for edges with NO confidence set.
  // F.2: Controls dash pattern only; colour is derived from direction.
  // A confidence of 0 is a valid user choice (low), not "missing".
  const isPreRunIncompleteEdge = !isResultsMode && edgeConfidenceValue === null

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
  const ariaLabel = `Edge from ${srcTitle} to ${tgtTitle}${confText}`

  // P0-9: Handle double-click to open inline editor
  const handleLabelDoubleClick = (event: React.MouseEvent) => {
    event.stopPropagation()
    setEditPopoverPosition({ x: event.clientX, y: event.clientY })
    setShowEditPopover(true)
    // Dismiss first-time hint when user discovers edge editing
    if (showEdgeHint) dismissEdgeHint()
  }

  // P0-9: Handle edge data update from popover
  const handleEdgeUpdate = (edgeId: string, updatedData: { weight: number; belief: number }) => {
    updateEdgeData(edgeId, updatedData)
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

    // Pre-analysis: rank by |strength.mean|
    const strengths = causalEdges.map(e => ({
      id: e.id,
      strength: Math.abs(computeSignedMean(e.data as Record<string, unknown> | undefined)),
    }))
    strengths.sort((a, b) => b.strength - a.strength)
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

  // Causal lens: hide structural edges entirely
  if (isLensHidden) return null

  return (
    <>
      {/* Wrapper captures hover for the entire edge hit area. Hover handlers live
          here so they fire regardless of whether the pointer is over the custom
          hitbox path or BaseEdge's interaction path (which renders on top in SVG
          paint order). Both paths bubble mouseenter/mouseleave to this <g>. */}
      <g onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {/* Invisible hitbox — wider than visual stroke; carries test-id and
          structural tooltip. pointer-events:stroke so the <g> receives events
          from this area even when no visual fill is present. */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
        {...(isPreRunIncompleteEdge ? { 'data-testid': 'overlay-missing-confidence' } : {})}
      >
        {isStructuralEdge && structuralTooltip && <title>{structuralTooltip}</title>}
      </path>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          // Graph Interaction P1: Highlighted edges get thicker stroke
          strokeWidth: (() => {
            // Structural edges: fixed 1px regardless of lens / hover / highlight
            if (isStructuralEdge) return 1
            // Causal lens: thickness encodes |strength.mean|
            if (lensMode === 'causal' && causalEdgeParams) {
              return weightMagnitudeToStrokeWidth(causalEdgeParams.mean)
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
            // Hover thickening: 2px to 3px on hover
            if (isHovered) return Math.max(edgeStrokeWidth, 3)
            return isHighlightedEdge ? Math.max(edgeStrokeWidth, 3) : edgeStrokeWidth
          })(),
          // Fix 1: Use existence certainty for line style, fallback to visual props
          // B.I.10: Pre-run incomplete edges get dashed stroke to indicate "needs attention"
          // Priority: structural (solid) > contested dash > pre-run incomplete dash > existence certainty > visual props
          strokeDasharray: (() => {
            if (isStructuralEdge) return undefined
            if (isContested) return contestedDashArray
            if (isPreRunIncompleteEdge) return '6 3'
            return existenceCertaintyDash ?? visualProps.strokeDasharray
          })(),
          // Graph Interaction P1: Highlighted edges get brighter color
          // F.2: Direction colour always applies — yellow only for truly uninitialised edges
          // Pre-run overlay controls dash pattern only, not colour
          stroke: (() => {
            // Structural edges: fixed grey regardless of lens / highlight
            if (isStructuralEdge) return STRUCTURAL_EDGE_COLOUR
            // Causal lens: neutral colour, danger for negative edges
            if (lensMode === 'causal' && causalEdgeParams) {
              return causalEdgeParams.mean < 0 ? 'var(--semantic-danger, #ef4444)' : 'var(--text-body, #3F3F3E)'
            }
            // Evidence lens: colour by provenance classification
            if (lensMode === 'evidence' && evidenceEdgeClass) {
              switch (evidenceEdgeClass) {
                case 'evidence': return 'var(--semantic-success, #22c55e)'
                case 'assumed': return 'var(--semantic-warning, #eab308)'
                case 'unknown': return 'var(--semantic-danger, #ef4444)'
              }
            }
            if (isContested) {
              return needsUserInput ? 'var(--semantic-warning)' : 'color-mix(in srgb, var(--semantic-warning) 70%, transparent)'
            }
            return isHighlightedEdge ? 'var(--semantic-info)' : (directionStroke ?? visualProps.stroke)
          })(),
          // Graph Lens: opacity for dimmed edges
          // Graph Editing Experience Task 9b: Confidence opacity layered on top
          // Structural edges always full opacity (no exists_probability gating).
          opacity: isStructuralEdge ? undefined
            : isLensDimmed ? 0.2
            : (lensMode === 'sensitivity' && lensSensWeight !== null && lensQ25 !== null && lensSensWeight <= lensQ25) ? 0.4
            : (() => {
                // Task 9b: Encode exists_probability as opacity
                const ep = beliefExists
                if (ep === undefined || ep === null) return undefined
                if (ep >= 0.8) return undefined // full opacity (1.0)
                if (ep >= 0.5) return 0.7
                return 0.4
              })(),
          // Graph Lens: subtle glow for high-sensitivity edges
          filter: (lensMode === 'sensitivity' && lensSensWeight !== null && lensQ75 !== null && lensSensWeight >= lensQ75)
            ? 'drop-shadow(0 0 2px var(--semantic-info, #3b82f6))'
            : undefined,
          // Performance: use will-change for frequent updates
          willChange: selected || isHighlightedEdge ? 'stroke, stroke-width, stroke-dasharray' : undefined,
          // D.1: Smooth transitions for live styling; respect prefers-reduced-motion (§7.4)
          transition: prefersReducedMotion
            ? 'none'
            : 'stroke 200ms ease, stroke-width 200ms ease, stroke-dasharray 300ms ease-out, opacity 300ms ease',
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
              fontSize: '11px',
              fontWeight: 500,
              fontFamily: 'ui-monospace, monospace',
              whiteSpace: 'nowrap',
            }}
            className="bg-panel text-text-body border border-panel-border shadow-sm"
            data-testid="causal-edge-label"
          >
            {causalEdgeParams.mean >= 0 ? '+' : ''}{causalEdgeParams.mean.toFixed(2)}
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
              fontSize: '10px',
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
            className="bg-panel text-text-body border border-panel-border shadow-sm"
            data-testid="evidence-edge-label"
          >
            {evidenceEdgeClass === 'evidence' ? 'Evidence-backed' : evidenceEdgeClass === 'assumed' ? 'Assumed' : 'Unknown basis'}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Direction sign indicator: Detailed view, post-analysis only.
          Structural edges have no semantic direction — exclude defensively. */}
      {viewMode !== 'standard' && isResultsMode && direction && lensMode !== 'causal' && !isStructuralEdge && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${targetX - 18}px,${targetY - 18}px)`,
              pointerEvents: 'none',
              fontSize: '16px',
              fontWeight: 700,
              color: direction === 'positive' ? '#059669' : '#dc2626',
              backgroundColor: '#F4F0EA',
              padding: '0 3px',
              borderRadius: '2px',
            }}
            aria-label={`Effect direction: ${direction}`}
          >
            {direction === 'positive' ? '+' : '−'}
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
            className="bg-panel text-text-body border border-warning/30 shadow-sm"
            title={fragileEdgeSwitchProb !== null
              ? `Sensitive assumption: ${Math.round(fragileEdgeSwitchProb * 100)}% chance the result flips if this relationship changes`
              : 'Sensitive assumption: outcome may flip if this relationship changes'}
          >
            <AlertTriangle size={12} />
            <span style={{ fontSize: '10px', fontWeight: 600 }}>
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
              fontSize: '11px',
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
            className="bg-panel text-text-body border border-warning/30 shadow-sm"
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
          stroke="var(--border-default, #d4d4d8)"
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
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'flex',
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
            aria-label={ariaLabel}
            title={(() => {
              const desc = getEdgeLabel(weight, belief, labelMode)
              const baseTooltip = provenance ? `${desc.tooltip} • Source: ${provenance}` : desc.tooltip
              return `${baseTooltip}\n\nDouble-click to edit`
            })()}
            onDoubleClick={handleLabelDoubleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {(() => {
              const desc = getEdgeLabel(weight, belief, labelMode)
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
                  <span style={{
                    fontWeight: 500,
                    fontFamily: labelMode === 'numeric' ? 'ui-monospace, monospace' : undefined
                  }}>
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
                        provenance === 'template' ? 'bg-info-500' :
                        provenance === 'user' ? 'bg-warning' :
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
            <Flag size={12} className="text-warning" />
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
        const signedVal = direction === 'negative' ? -weight : weight
        const strengthPct = Math.round(Math.abs(signedVal) * 100)
        const confidencePct = Math.round((beliefExists ?? 0.8) * 100)
        const dirLabel = signedVal >= 0 ? 'Positive' : 'Negative'
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
              {/* Direction */}
              <div className={`${typography.edgeLabel} font-bold text-text-body`}>
                {dirLabel}
              </div>
              {/* Confidence */}
              <div className={`${typography.edgeLabel} text-text-light`}>
                {confidencePct}% confident
              </div>
              {/* Strength bar */}
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-1 bg-panel-border rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${signedVal >= 0 ? 'bg-success' : 'bg-danger'}`}
                    style={{ width: `${Math.max(4, strengthPct)}%` }}
                  />
                </div>
                <span className={`${typography.edgeLabel} text-text-light w-7 text-right shrink-0`}>{strengthPct}%</span>
              </div>
              {/* Fragile warning with switch probability */}
              {isFragileEdge && (
                <div className={`${typography.edgeLabel} text-warning flex items-center gap-1`}>
                  <AlertTriangle size={10} />
                  Sensitive{fragileEdgeSwitchProb !== null ? `: ${Math.round(fragileEdgeSwitchProb * 100)}% flip risk` : ''}
                </div>
              )}
              {/* Coaching chips */}
              <div className="flex flex-col gap-1 mt-2 pt-1.5 border-t border-panel-border">
                <NodeChip chipId="edge_evidence_supports" actionType={null} label="What evidence supports this?" message={`What evidence supports the ${dirLabel.toLowerCase()} relationship between ${srcTitle} and ${tgtTitle}?`} />
                <NodeChip chipId="edge_adjust_strength" actionType="adjust_edge_strength" label="Adjust strength" message={`I want to adjust the strength of the relationship between ${srcTitle} and ${tgtTitle}. Current strength is ${strengthPct}%.`} />
              </div>
            </div>
          </EdgeLabelRenderer>
        )
      })()}

      {/* P0-9: Inline edge edit popover */}
      {showEditPopover && (
        <EdgeEditPopover
          edge={{ id, data: { weight, belief: belief ?? 0.5 } }}
          position={editPopoverPosition}
          onUpdate={handleEdgeUpdate}
          onClose={() => setShowEditPopover(false)}
        />
      )}
    </>
  )
})

StyledEdge.displayName = 'StyledEdge'
