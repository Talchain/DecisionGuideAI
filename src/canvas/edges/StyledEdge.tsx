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
import { formatConfidence } from '../domain/edges'
import { useIsDark } from '../hooks/useTheme'

/**
 * StyledEdge with semantic visual properties
 * Maps weight/style/curvature to SVG rendering
 */
export const StyledEdge = memo(({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, data }: EdgeProps<EdgeData>) => {
  const isDark = useIsDark()
  const { getNode } = useReactFlow()

  // Extract edge data with defaults
  const edgeData = data as EdgeData | undefined
  const weight = edgeData?.weight ?? 1.0
  const style = edgeData?.style ?? 'solid'
  const curvature = edgeData?.curvature ?? 0.15
  const label = edgeData?.label
  const confidence = edgeData?.confidence

  // Apply visual properties (O(1), pure function)
  const visualProps = useMemo(
    () => applyEdgeVisualProps(weight, style, curvature, selected || false, false, isDark),
    [weight, style, curvature, selected, isDark]
  )

  // Get edge theme for labels
  const edgeTheme = useMemo(() => {
    // This ensures we use CSS variables when available
    if (typeof window !== 'undefined') {
      const styles = getComputedStyle(document.documentElement)
      return {
        labelBg: isDark ? styles.getPropertyValue('--edge-label-bg')?.trim() || '#0E1116' : '#FFFFFF',
        labelText: isDark ? styles.getPropertyValue('--edge-label-text')?.trim() || '#E8ECF5' : '#1E293B',
        labelBorder: isDark ? '#64748B' : '#E2E8F0'
      }
    }
    return {
      labelBg: isDark ? '#0E1116' : '#FFFFFF',
      labelText: isDark ? '#E8ECF5' : '#1E293B',
      labelBorder: isDark ? '#64748B' : '#E2E8F0'
    }
  }, [isDark])
  
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
        markerEnd="url(#arrowhead)"
      />
      
      {/* Edge label */}
      {(label || confidence !== undefined) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              fontSize: '12px',
              background: edgeTheme.labelBg,
              color: edgeTheme.labelText,
              padding: '2px 8px',
              borderRadius: '4px',
              border: `1px solid ${edgeTheme.labelBorder}`,
              boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
              maxWidth: '120px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            className="nodrag nopan"
            role="note"
            aria-label={ariaLabel}
          >
            {label && <span style={{ marginRight: confidence !== undefined ? '6px' : 0 }}>{label}</span>}
            {confidence !== undefined && (
              <span
                style={{
                  fontSize: '10px',
                  opacity: 0.7,
                }}
                aria-label={`Confidence: ${formatConfidence(confidence)}`}
              >
                {formatConfidence(confidence)}
              </span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
})

StyledEdge.displayName = 'StyledEdge'
