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
 */

import { memo, useMemo, useState } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, getStraightPath, type EdgeProps, useReactFlow } from '@xyflow/react'
import { Lightbulb } from 'lucide-react'
import type { EdgeData, EdgePathType } from '../domain/edges'
import { FORM_DISPLAY_NAMES } from '../domain/edges'
import { applyEdgeVisualProps } from '../theme/edges'
import { formatConfidence, shouldShowLabel } from '../domain/edges'
import { useIsDark } from '../hooks/useTheme'
import { getEdgeLabel } from '../domain/edgeLabels'
import { useEdgeLabelMode } from '../store/edgeLabelMode'
import { EdgeEditPopover } from './EdgeEditPopover'
import { useCanvasStore } from '../store'
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
  const updateEdgeData = useCanvasStore(state => state.updateEdgeData)
  const ceeReview = useCanvasStore(state => state.runMeta.ceeReview)

  // Phase 4: Edge highlighting from results panel (drivers, conditions, etc.)
  const highlightedEdges = useCanvasStore(state => state.highlightedEdges)
  const isHighlighted = highlightedEdges.has(id)

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

  // Brief 11.5: Functional form type and provenance for visual indicator
  const functionType = edgeData?.functionType ?? 'linear'
  const formProvenance = edgeData?.formProvenance
  const formInfo = functionType !== 'linear' ? FORM_DISPLAY_NAMES[functionType] : null

  // Count outgoing edges from source node for visibility logic
  const outgoingEdgeCount = useMemo(() => {
    const edges = getEdges()
    return edges.filter(e => e.source === source).length
  }, [source, getEdges])

  // Apply visual properties (O(1), pure function)
  // isHighlighted passed to applyEdgeVisualProps for driver/condition click highlighting
  const visualProps = useMemo(
    () => applyEdgeVisualProps(weight, style, curvature, selected || false, isHighlighted, isDark),
    [weight, style, curvature, selected, isHighlighted, isDark]
  )

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

  // Determine arrowhead marker based on state
  const markerEnd = selected
    ? 'url(#arrowhead-selected)'
    : 'url(#arrowhead-default)'

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

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          strokeWidth: visualProps.strokeWidth,
          strokeDasharray: visualProps.strokeDasharray,
          stroke: visualProps.stroke,
          // Performance: use will-change for frequent updates
          willChange: selected ? 'stroke, stroke-width' : undefined,
        }}
        markerEnd={markerEnd}
      />
      
      {/* Edge label - v1.2: Always show human-readable label */}
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
                {/* Brief 11.5: Functional form indicator */}
                {formInfo && (
                  <span
                    data-testid="edge-form-indicator"
                    style={{
                      fontSize: '10px',
                      fontFamily: 'ui-monospace, monospace',
                      padding: '1px 4px',
                      borderRadius: '3px',
                      flexShrink: 0,
                    }}
                    className={
                      formProvenance === 'cee_recommended'
                        ? isDark ? 'bg-teal-800 text-teal-200' : 'bg-teal-100 text-teal-700'
                        : formProvenance === 'user_selected'
                          ? isDark ? 'bg-amber-800 text-amber-200' : 'bg-amber-100 text-amber-700'
                          : isDark ? 'bg-gray-700 text-gray-300' : 'bg-sand-100 text-sand-600'
                    }
                    title={`Form: ${formInfo.name}\n${formInfo.shortDescription}`}
                    aria-label={`Functional form: ${formInfo.name}`}
                  >
                    {formInfo.icon}
                  </span>
                )}
              </>
            )
          })()}
        </div>
      </EdgeLabelRenderer>

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
