/**
 * Canvas Highlighting Utilities
 *
 * Provides visual highlighting for post-run analysis:
 * - Emphasize top driver nodes and their paths
 * - Fade non-critical elements
 * - Temporary focus on individual drivers
 */

import type { Edge, Node } from '@xyflow/react'

export interface HighlightingResult {
  nodes: Node[]
  edges: Edge[]
}

export interface TopDriver {
  node_id: string
  contribution: number
  node_label?: string
  explanation?: string
}

/**
 * Apply post-run highlighting to emphasize top drivers
 *
 * - Top 3 driver nodes: Full opacity + glow
 * - Driver paths (edges to/from drivers): Full opacity + animated
 * - Non-driver nodes: 40% opacity
 * - Non-driver edges: 20% opacity
 */
export function applyPostRunHighlighting(
  nodes: Node[],
  edges: Edge[],
  topDrivers: TopDriver[]
): HighlightingResult {
  // Get IDs of top 3 driver nodes
  const topDriverIds = new Set(topDrivers.slice(0, 3).map((d) => d.node_id))

  // Find all edges in driver paths
  const driverEdgeIds = new Set<string>()
  edges.forEach((edge) => {
    if (topDriverIds.has(edge.target) || topDriverIds.has(edge.source)) {
      driverEdgeIds.add(edge.id)
    }
  })

  // Apply highlighting to nodes
  const highlightedNodes = nodes.map((node) => {
    const isDriver = topDriverIds.has(node.id)

    return {
      ...node,
      style: {
        ...node.style,
        opacity: isDriver ? 1 : 0.4,
      },
      className: [node.className, isDriver ? 'driver-node' : 'faded-node']
        .filter(Boolean)
        .join(' '),
      data: {
        ...node.data,
        // Add glow effect to drivers
        style: isDriver
          ? {
              ...node.data?.style,
              boxShadow: '0 0 0 3px rgba(66, 153, 225, 0.4)',
            }
          : node.data?.style,
      },
    }
  })

  // Apply highlighting to edges
  const highlightedEdges = edges.map((edge) => {
    const isDriverPath = driverEdgeIds.has(edge.id)

    return {
      ...edge,
      style: {
        ...edge.style,
        opacity: isDriverPath ? 1 : 0.2,
      },
      className: [edge.className, isDriverPath ? 'driver-edge' : 'faded-edge']
        .filter(Boolean)
        .join(' '),
      animated: isDriverPath, // Animate driver paths
    }
  })

  return {
    nodes: highlightedNodes,
    edges: highlightedEdges,
  }
}

/**
 * Clear all highlighting (return to normal state)
 */
export function clearHighlighting(
  nodes: Node[],
  edges: Edge[]
): HighlightingResult {
  const clearedNodes = nodes.map((node) => ({
    ...node,
    style: {
      ...node.style,
      opacity: 1,
    },
    className: node.className
      ?.replace(/\b(driver-node|faded-node|focused-node|super-faded-node)\b/g, '')
      .trim(),
    data: {
      ...node.data,
      style: {
        ...node.data?.style,
        boxShadow: undefined,
      },
    },
  }))

  const clearedEdges = edges.map((edge) => ({
    ...edge,
    style: {
      ...edge.style,
      opacity: 1,
    },
    className: edge.className
      ?.replace(/\b(driver-edge|faded-edge|focused-edge|super-faded-edge)\b/g, '')
      .trim(),
    animated: false,
  }))

  return {
    nodes: clearedNodes,
    edges: clearedEdges,
  }
}

/**
 * Temporarily focus on a single driver (2s highlight)
 *
 * Fades everything except the focused driver and its connections
 */
export function focusOnDriver(
  nodes: Node[],
  edges: Edge[],
  driverId: string
): HighlightingResult {
  // Fade everything except this driver and its connections
  const focusedNodes = nodes.map((node) => ({
    ...node,
    style: {
      ...node.style,
      opacity: node.id === driverId ? 1 : 0.2,
    },
    className:
      node.id === driverId
        ? 'focused-node'
        : node.className?.replace(/\b(driver-node|faded-node)\b/g, 'super-faded-node'),
  }))

  // Find edges connected to this driver
  const connectedEdgeIds = new Set(
    edges
      .filter((e) => e.source === driverId || e.target === driverId)
      .map((e) => e.id)
  )

  const focusedEdges = edges.map((edge) => ({
    ...edge,
    style: {
      ...edge.style,
      opacity: connectedEdgeIds.has(edge.id) ? 1 : 0.1,
    },
    className: connectedEdgeIds.has(edge.id)
      ? 'focused-edge'
      : edge.className?.replace(/\b(driver-edge|faded-edge)\b/g, 'super-faded-edge'),
  }))

  return {
    nodes: focusedNodes,
    edges: focusedEdges,
  }
}

/**
 * Temporarily focus on a single edge (2s highlight)
 *
 * Fades everything except the focused edge and its source/target nodes
 */
export function focusOnEdge(
  nodes: Node[],
  edges: Edge[],
  edgeId: string
): HighlightingResult {
  const targetEdge = edges.find((e) => e.id === edgeId)

  if (!targetEdge) {
    // Edge not found, return unchanged
    return { nodes, edges }
  }

  // Get source and target nodes for this edge
  const relevantNodeIds = new Set([targetEdge.source, targetEdge.target])

  // Highlight source and target nodes, fade others
  const focusedNodes = nodes.map((node) => ({
    ...node,
    style: {
      ...node.style,
      opacity: relevantNodeIds.has(node.id) ? 1 : 0.2,
    },
    className: relevantNodeIds.has(node.id)
      ? 'focused-node'
      : node.className?.replace(/\b(driver-node|faded-node)\b/g, 'super-faded-node'),
  }))

  // Highlight target edge, fade others
  const focusedEdges = edges.map((edge) => ({
    ...edge,
    style: {
      ...edge.style,
      opacity: edge.id === edgeId ? 1 : 0.1,
      strokeWidth: edge.id === edgeId ? 3 : undefined,
    },
    className: edge.id === edgeId
      ? 'focused-edge'
      : edge.className?.replace(/\b(driver-edge|faded-edge)\b/g, 'super-faded-edge'),
    animated: edge.id === edgeId,
  }))

  return {
    nodes: focusedNodes,
    edges: focusedEdges,
  }
}
