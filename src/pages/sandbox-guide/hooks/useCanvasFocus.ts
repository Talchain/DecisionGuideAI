/**
 * Canvas Focus Hook
 *
 * Provides utilities for temporarily focusing on specific nodes:
 * - Click driver in panel → zoom + temporary solo highlight (2s)
 * - Smooth animations
 * - Auto-clear after timeout
 */

import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { focusOnDriver, clearHighlighting } from '../utils/canvasHighlighting'

export function useCanvasFocus() {
  const reactFlowInstance = useReactFlow()

  const highlightDriver = useCallback(
    (nodeId: string) => {
      const nodes = reactFlowInstance.getNodes()
      const edges = reactFlowInstance.getEdges()
      const node = reactFlowInstance.getNode(nodeId)

      if (!node) return

      // Apply temporary focus
      const { nodes: focusedNodes, edges: focusedEdges } = focusOnDriver(
        nodes,
        edges,
        nodeId
      )

      reactFlowInstance.setNodes(focusedNodes)
      reactFlowInstance.setEdges(focusedEdges)

      // Zoom to node with smooth animation
      reactFlowInstance.setCenter(
        node.position.x + (node.width || 0) / 2,
        node.position.y + (node.height || 0) / 2,
        { zoom: 1.2, duration: 500 }
      )

      // Clear focus after 2 seconds
      setTimeout(() => {
        const currentNodes = reactFlowInstance.getNodes()
        const currentEdges = reactFlowInstance.getEdges()

        const { nodes: clearedNodes, edges: clearedEdges } = clearHighlighting(
          currentNodes,
          currentEdges
        )

        reactFlowInstance.setNodes(clearedNodes)
        reactFlowInstance.setEdges(clearedEdges)
      }, 2000)
    },
    [reactFlowInstance]
  )

  return { highlightDriver }
}
