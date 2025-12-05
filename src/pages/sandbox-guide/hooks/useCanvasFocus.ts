/**
 * Canvas Focus Hook
 *
 * Provides utilities for temporarily focusing on specific nodes and edges:
 * - Click node reference in panel → zoom + temporary solo highlight (2s)
 * - Click edge reference in panel → zoom + temporary edge highlight (2s)
 * - Smooth animations
 * - Auto-clear after timeout
 */

import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { focusOnDriver, focusOnEdge, clearHighlighting } from '../utils/canvasHighlighting'

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

  const highlightEdge = useCallback(
    (edgeId: string) => {
      const nodes = reactFlowInstance.getNodes()
      const edges = reactFlowInstance.getEdges()
      const edge = edges.find((e) => e.id === edgeId)

      if (!edge) return

      // Apply temporary focus
      const { nodes: focusedNodes, edges: focusedEdges } = focusOnEdge(
        nodes,
        edges,
        edgeId
      )

      reactFlowInstance.setNodes(focusedNodes)
      reactFlowInstance.setEdges(focusedEdges)

      // Zoom to edge midpoint with smooth animation
      const sourceNode = reactFlowInstance.getNode(edge.source)
      const targetNode = reactFlowInstance.getNode(edge.target)

      if (sourceNode && targetNode) {
        const midX = (sourceNode.position.x + targetNode.position.x) / 2
        const midY = (sourceNode.position.y + targetNode.position.y) / 2
        reactFlowInstance.setCenter(midX, midY, { zoom: 1.2, duration: 500 })
      }

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

  return { highlightDriver, highlightEdge }
}
