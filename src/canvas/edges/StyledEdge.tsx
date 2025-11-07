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

import { memo, useMemo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps, useReactFlow } from '@xyflow/react'
import type { EdgeData } from '../domain/edges'
import { applyEdgeVisualProps } from '../theme/edges'
import { formatConfidence, shouldShowLabel } from '../domain/edges'
import { useIsDark } from '../hooks/useTheme'

/**
 * StyledEdge with semantic visual properties
 * Maps weight/style/curvature to SVG rendering
 */
export const StyledEdge = memo(({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, data }: EdgeProps<EdgeData>) => {
  const isDark = useIsDark()
  const { getNode, getEdges } = useReactFlow()

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
      
      {/* Edge label - always visible in v1.2 format (w • b) */}
      {(
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              fontSize: belief !== undefined ? '10px' : (labelVisibility.deEmphasize ? '10px' : '12px'),
              padding: '2px 6px',
              borderRadius: '4px',
              opacity: 0.9,
              maxWidth: '140px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            className={`nodrag nopan shadow-sm border ${
              isDark
                ? 'bg-gray-900 text-gray-100 border-gray-600'
                : 'bg-white text-gray-800 border-gray-200'
            }`}
            role="note"
            aria-label={ariaLabel}
            title={
              belief !== undefined
                ? `Weight: ${weight.toFixed(2)}, Belief: ${Math.round(belief * 100)}%${provenance ? `, Source: ${provenance}` : ''}`
                : labelVisibility.isCustom ? label : `Probability: ${formatConfidence(confidence)}`
            }
          >
            {/* v1.2: Compact format: w 0.60 • b 85% (or b — when undefined) */}
            {belief !== undefined ? (
              <>
                <span style={{ fontWeight: 500, fontFamily: 'ui-monospace, monospace' }}>
                  w {weight >= 0 ? '' : '−'}{Math.abs(weight).toFixed(2)} • b {Math.round(belief * 100)}%
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
            ) : (
              <>
                {/* v1.2: Placeholder when belief is missing */}
                <span style={{ fontWeight: 500, fontFamily: 'ui-monospace, monospace' }}>
                  w {weight >= 0 ? '' : '−'}{Math.abs(weight).toFixed(2)} • b —
                </span>
                <span className="text-xs text-gray-400 ml-1" title="Belief not set - edit in inspector">
                  (set in inspector)
                </span>
              </>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
})

StyledEdge.displayName = 'StyledEdge'
