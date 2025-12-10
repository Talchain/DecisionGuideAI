/**
 * MiniCanvas - Lightweight read-only ReactFlow canvas for comparisons
 *
 * Used in side-by-side scenario comparison views.
 * Renders the same node/edge types as the main canvas but in read-only mode.
 */

import { memo, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  type Node,
  type Edge,
  type ReactFlowInstance,
  type OnMoveEnd,
  type Viewport,
} from '@xyflow/react'
import { nodeTypes } from '../nodes/registry'
import { StyledEdge } from '../edges/StyledEdge'

interface MiniCanvasProps {
  /** Nodes to render */
  nodes: Node[]
  /** Edges to render */
  edges: Edge[]
  /** Callback when ReactFlow instance is ready */
  onInit?: (instance: ReactFlowInstance) => void
  /** Callback when viewport changes (for sync) */
  onMoveEnd?: OnMoveEnd
  /** Initial viewport (optional, defaults to fitView) */
  defaultViewport?: Viewport
  /** Whether to show controls (default: true) */
  showControls?: boolean
  /** Whether to show background grid (default: true) */
  showBackground?: boolean
  /** Additional className for container */
  className?: string
  /** Label for accessibility */
  ariaLabel?: string
}

// Memoized edge types to prevent recreation
const edgeTypes = { styled: StyledEdge as any }

// Default edge options
const defaultEdgeOptions = { type: 'styled' as const, animated: false }

/**
 * Lightweight read-only canvas for snapshot/comparison display
 */
export const MiniCanvas = memo(function MiniCanvas({
  nodes,
  edges,
  onInit,
  onMoveEnd,
  defaultViewport,
  showControls = true,
  showBackground = true,
  className = '',
  ariaLabel = 'Comparison canvas',
}: MiniCanvasProps) {
  // Handle init with optional callback
  const handleInit = useCallback(
    (instance: ReactFlowInstance) => {
      // Fit view on init if no default viewport
      if (!defaultViewport) {
        instance.fitView({ padding: 0.1, duration: 0 })
      }
      onInit?.(instance)
    },
    [defaultViewport, onInit]
  )

  return (
    <div
      className={`h-full w-full ${className}`}
      role="region"
      aria-label={ariaLabel}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        defaultViewport={defaultViewport}
        onInit={handleInit}
        onMoveEnd={onMoveEnd}
        fitView={!defaultViewport}
        fitViewOptions={{ padding: 0.1 }}
        // Read-only mode settings
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        minZoom={0.1}
        maxZoom={2}
        // Performance
        proOptions={{ hideAttribution: true }}
      >
        {showBackground && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="rgba(0,0,0,0.1)"
          />
        )}
        {showControls && (
          <Controls
            showInteractive={false}
            position="bottom-right"
            style={{ marginBottom: 8, marginRight: 8 }}
          />
        )}
      </ReactFlow>
    </div>
  )
})
