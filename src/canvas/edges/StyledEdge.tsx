/**
 * Styled edge component with visual properties
 * Renders weight, style, curvature, label, and confidence
 * British English: visualisation, colour
 * 
 * Curvature implementation (Option A - SmoothStep with corner radius):
 * Uses getSmoothStepPath with borderRadius parameter.
 * Curvature range 0..0.5 maps to borderRadius 0..25px.
 * This maintains visual parity with existing smoothstep edges.
 */

import { memo, useMemo, useState } from 'react'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps, useReactFlow } from '@xyflow/react'
import type { EdgeData } from '../domain/edges'
import { applyEdgeVisualProps } from '../theme/edges'
import { formatConfidence, shouldShowLabel } from '../domain/edges'
import { useIsDark } from '../hooks/useTheme'
import { getEdgeLabel } from '../domain/edgeLabels'
import { useEdgeLabelMode } from '../store/edgeLabelMode'
import { EdgeEditPopover } from './EdgeEditPopover'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'

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

  // P0-9: Inline edit popover state
  const [showEditPopover, setShowEditPopover] = useState(false)
  const [editPopoverPosition, setEditPopoverPosition] = useState({ x: 0, y: 0 })
  const updateEdgeData = useCanvasStore(state => state.updateEdgeData)

  // Extract edge data with defaults
  const edgeData = data as EdgeData | undefined
  const weight = edgeData?.weight ?? 1.0
  const style = edgeData?.style ?? 'solid'
  const curvature = edgeData?.curvature ?? 0.15
  const kind = edgeData?.kind ?? 'decision-probability'
  const label = edgeData?.label
  const confidence = edgeData?.confidence
  const belief = edgeData?.belief      // v1.2
  const provenance = edgeData?.provenance  // v1.2

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

  // Determine label visibility and styling
  const labelVisibility = useMemo(
    () => shouldShowLabel(label, confidence, outgoingEdgeCount, kind),
    [label, confidence, outgoingEdgeCount, kind]
  )

  // Compute edge path
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: visualProps.curvature * 50, // Map 0-0.5 to 0-25px
  })
  
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
          }`}
          role="note"
          aria-label={ariaLabel}
          title={(() => {
            const desc = getEdgeLabel(weight, belief, labelMode)
            return provenance ? `${desc.tooltip} • Source: ${provenance}` : desc.tooltip
          })()}
          onDoubleClick={handleLabelDoubleClick}
        >
          {(() => {
            const desc = getEdgeLabel(weight, belief, labelMode)
            return (
              <>
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
