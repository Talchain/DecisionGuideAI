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

import { memo, useMemo, useState } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, getStraightPath, type EdgeProps, useReactFlow } from '@xyflow/react'
import { Lightbulb, AlertTriangle } from 'lucide-react'
import type { EdgeData, EdgePathType } from '../domain/edges'
import { applyEdgeVisualProps } from '../theme/edges'
import { formatConfidence, shouldShowLabel } from '../domain/edges'
import { useIsDark } from '../hooks/useTheme'
import { getEdgeLabel } from '../domain/edgeLabels'
import { useEdgeLabelMode } from '../store/edgeLabelMode'
import { EdgeEditPopover } from './EdgeEditPopover'
import { useCanvasStore } from '../store'
import { existenceCertaintyToLineStyle, calculateEdgeImportance, importanceToStrokeWidth } from '../utils/graphDisplayCalculations'
import { typography } from '../../styles/typography'
import { useEdgeEditHint } from '../hooks/useFirstTimeHints'

/**
 * StyledEdge with semantic visual properties
 * Maps weight/style/curvature to SVG rendering
 * v1.2 + P1: Live edge label toggle (human ⇄ numeric)
 */
export const StyledEdge = memo(({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, data }: EdgeProps<EdgeData>) => {
  const isDark = useIsDark()
  const { getNode, getEdges } = useReactFlow()

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
  const updateEdgeData = useCanvasStore(state => state.updateEdgeData)
  const ceeReview = useCanvasStore(state => state.runMeta.ceeReview)

  // Decision Graph Display v2 Task 4: Get fragile edges from results (Results mode only)
  const resultsStatus = useCanvasStore(state => state.results.status)
  const isResultsMode = resultsStatus === 'complete'
  const report = useCanvasStore(state => state.results.report)

  // Graph Interaction P1: Path highlighting for selected node
  // React #185 FIX: Use primitive boolean selector to prevent infinite re-renders
  const isHighlightedEdge = useCanvasStore(state => state.highlightedEdges.has(id))

  // Check if this edge is fragile (switch_probability > 0.3)
  // P0 Fix: Match by from_id/to_id (source/target) OR edge_id
  // API returns from_id/to_id pairs, not edge_id in most cases
  const isFragileEdge = useMemo(() => {
    if (!isResultsMode || !report?.robustness) return false
    const fragileEdges = report.robustness.fragile_edges || []
    return fragileEdges.some((fe: any) => {
      const switchProb = fe.switch_probability ?? fe.switchProbability ?? fe.marginal_switch_probability ?? fe.marginalSwitchProbability
      if (typeof switchProb !== 'number' || switchProb <= 0.3) return false

      // Try matching by edge_id first
      const edgeId = fe.edge_id || fe.edgeId
      if (edgeId === id) return true

      // P0 Fix: Match by from_id/to_id (source/target) - primary matching method
      const fromId = fe.from_id ?? fe.fromId ?? fe.source
      const toId = fe.to_id ?? fe.toId ?? fe.target
      return fromId === source && toId === target
    })
  }, [isResultsMode, report, id, source, target])

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
  const weight = edgeData?.weight ?? 1.0
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

  // Task A: Edge thickness based on importance (Results mode only)
  const edgeStrokeWidth = useMemo(() => {
    if (!isResultsMode || !report) {
      return visualProps.strokeWidth // Edit mode: uniform thickness
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
      const strength = edgeData?.weight ?? 1.0
      return calculateEdgeImportance(belief, strength, goalSens)
    })
    const maxImportance = Math.max(...importances, 0)

    // Map to stroke width (1-8px range)
    return importanceToStrokeWidth(importance, maxImportance)
  }, [isResultsMode, report, source, edgeData?.beliefExists, weight, getEdges, visualProps.strokeWidth])

  // Decision Graph Display v2: Direction-based stroke colour
  // positive: green, negative: red (risk color), unknown: grey
  const directionStroke = useMemo(() => {
    if (!direction) return isDark ? '#a1a1aa' : '#d4d4d8' // Zinc-400/300 for unknown
    if (direction === 'positive') {
      return isDark ? '#bbf7d0' : '#a7f3d0' // Pastel green-200/emerald-200
    }
    if (direction === 'negative') {
      return isDark ? '#FF6B6B' : '#ef4444' // Risk red (matches risk node border)
    }
    return isDark ? '#a1a1aa' : '#d4d4d8' // Zinc fallback
  }, [direction, isDark])

  // Decision Graph Display v2: Existence certainty line style
  // Solid: >70%, Dashed: 30-70%, Dotted: <30%
  // Use utility function to ensure single source of truth
  // Issue #1 fix: Add fallback for snake_case field names from raw API data
  const beliefExists = edgeData?.beliefExists ??
                       (edgeData as any)?.belief_exists ??
                       (edgeData as any)?.exists_probability
  const existenceCertaintyDash = useMemo(() =>
    existenceCertaintyToLineStyle(beliefExists),
    [beliefExists]
  )

  // Fix 1: Line style encodes existence certainty ONLY, not direction
  // Direction is already encoded via color (green/red) and sign (+/−)
  const dashArray = existenceCertaintyDash

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

  // C1: Handle hover for edge label visibility
  const handleMouseEnter = () => setIsHovered(true)
  const handleMouseLeave = () => setIsHovered(false)

  // C1: Only show label when selected, hovered, has suggestion, or is first edge with hint
  const showLabel = selected || isHovered || hasSuggestion || (isFirstEdge && showEdgeHint)

  return (
    <>
      {/* Invisible hitbox for hover detection - wider than visual edge */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ pointerEvents: 'stroke' }}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          // Graph Interaction P1: Highlighted edges get thicker stroke
          strokeWidth: isHighlightedEdge ? Math.max(edgeStrokeWidth, 3) : edgeStrokeWidth,
          // Fix 1: Use existence certainty for line style, fallback to visual props
          strokeDasharray: dashArray ?? visualProps.strokeDasharray,
          // Graph Interaction P1: Highlighted edges get brighter color
          // Brief v2.2: Use direction-based colour (always applies - grey for unknown)
          // Use semantic-info token (sky-500) to avoid conflict with fragile edge badges
          stroke: isHighlightedEdge ? 'var(--semantic-info)' : (directionStroke ?? visualProps.stroke),
          // Performance: use will-change for frequent updates
          willChange: selected || isHighlightedEdge ? 'stroke, stroke-width' : undefined,
          // Graph Interaction P1: Smooth transition for highlighting
          transition: 'stroke 200ms, stroke-width 200ms',
        }}
      />
      
      {/* Decision Graph Display v2 Task 3 + Task D: Direction sign indicator (single, near target) */}
      {direction && (
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

      {/* Decision Graph Display v2 Task 4: Fragile edge warning badge (Results mode only) */}
      {isFragileEdge && (
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
            className={`${isDark ? 'bg-orange-900/90 text-orange-200' : 'bg-orange-100 text-orange-900'} border border-orange-400 shadow-sm`}
            title="Sensitive assumption - outcome may flip if this relationship changes"
          >
            <AlertTriangle size={12} />
            <span style={{ fontSize: '10px', fontWeight: 600 }}>
              Fragile
            </span>
          </div>
        </EdgeLabelRenderer>
      )}

      {/* C1: Edge label - only show when selected, hovered, or has pending suggestions */}
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
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
                : 'bg-paper-50/95 text-ink-900 border-sand-200'
            } ${hasSuggestion ? 'ring-2 ring-sky-400 ring-offset-1' : ''} ${isFirstEdge && showEdgeHint ? 'edge-hint-active' : ''}`}
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
                      className="w-3 h-3 text-sky-500 flex-shrink-0"
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
                        provenance === 'user' ? 'bg-orange-500' :
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
