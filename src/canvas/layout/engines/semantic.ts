/**
 * Semantic layout engine with BFS layering
 * Respects node kinds: goal (first), outcome (last), risk (adjacent)
 */

import type { LayoutNode, LayoutEdge, LayoutResult, LayoutSpacing } from '../types'
import type { LayoutPolicy, RiskPlacement } from '../policy'
import { SPACING_VALUES } from '../types'
import { snapToGrid } from '../policy'

/**
 * Build adjacency lists for BFS
 */
function buildGraph(nodes: LayoutNode[], edges: LayoutEdge[]): {
  outgoing: Map<string, string[]>
  incoming: Map<string, string[]>
} {
  const outgoing = new Map<string, string[]>()
  const incoming = new Map<string, string[]>()
  
  nodes.forEach(n => {
    outgoing.set(n.id, [])
    incoming.set(n.id, [])
  })
  
  edges.forEach(e => {
    outgoing.get(e.source)?.push(e.target)
    incoming.get(e.target)?.push(e.source)
  })
  
  return { outgoing, incoming }
}

/**
 * Compute layers using BFS from goal nodes (roots)
 */
function computeLayers(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  policy: LayoutPolicy
): Map<string, number> {
  const { outgoing, incoming } = buildGraph(nodes, edges)
  const layers = new Map<string, number>()
  
  // Find roots: goals or nodes with no incoming edges
  const roots = nodes.filter(n => 
    n.kind === 'goal' || (incoming.get(n.id)?.length === 0)
  )
  
  // BFS to assign layers
  const queue: Array<{ id: string; depth: number }> = []
  const visited = new Set<string>()
  
  roots.forEach(root => {
    queue.push({ id: root.id, depth: 0 })
    visited.add(root.id)
    layers.set(root.id, 0)
  })
  
  while (queue.length > 0) {
    const { id, depth } = queue.shift()!
    const children = outgoing.get(id) || []
    
    for (const childId of children) {
      if (!visited.has(childId)) {
        visited.add(childId)
        const childDepth = depth + 1
        layers.set(childId, childDepth)
        queue.push({ id: childId, depth: childDepth })
      } else {
        // Update to max depth if already visited
        const currentDepth = layers.get(childId) || 0
        layers.set(childId, Math.max(currentDepth, depth + 1))
      }
    }
  }
  
  // Assign remaining nodes (disconnected) to layer 0
  nodes.forEach(n => {
    if (!layers.has(n.id)) {
      layers.set(n.id, 0)
    }
  })
  
  // Force outcomes to last layer
  const maxLayer = Math.max(...Array.from(layers.values()), 0)
  nodes.forEach(n => {
    if (n.kind === 'outcome' && policy.layers.outcome === 'last') {
      layers.set(n.id, maxLayer + 1)
    }
  })
  
  return layers
}

/**
 * Order nodes within each layer using median heuristic
 */
function orderWithinLayers(
  layeredNodes: Map<number, LayoutNode[]>,
  edges: LayoutEdge[],
  layers: Map<string, number>
): Map<number, LayoutNode[]> {
  const { incoming } = buildGraph(Array.from(layeredNodes.values()).flat(), edges)
  const ordered = new Map<number, LayoutNode[]>()
  
  layeredNodes.forEach((nodesInLayer, layer) => {
    // Calculate median of parent indices for each node
    const withMedian = nodesInLayer.map(node => {
      const parents = incoming.get(node.id) || []
      const parentIndices = parents
        .map(pid => {
          const parentLayer = layers.get(pid)
          if (parentLayer === undefined || parentLayer >= layer) return -1
          const parentLayerNodes = layeredNodes.get(parentLayer) || []
          return parentLayerNodes.findIndex(n => n.id === pid)
        })
        .filter(idx => idx >= 0)
      
      const median = parentIndices.length > 0
        ? parentIndices.sort((a, b) => a - b)[Math.floor(parentIndices.length / 2)]
        : 0
      
      return { node, median }
    })
    
    // Sort by median, then by id for stability
    withMedian.sort((a, b) => {
      if (a.median !== b.median) return a.median - b.median
      return a.node.id.localeCompare(b.node.id)
    })
    
    ordered.set(layer, withMedian.map(x => x.node))
  })
  
  return ordered
}

/**
 * Place risk nodes adjacent to their source
 */
function placeRisks(
  positions: Record<string, { x: number; y: number }>,
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  riskPlacement: RiskPlacement,
  spacingValue: number,
  direction: 'LR' | 'TB'
): void {
  const risks = nodes.filter(n => n.kind === 'risk' && !n.locked)
  const { incoming, outgoing } = buildGraph(nodes, edges)
  
  for (const risk of risks) {
    const connected = [
      ...(incoming.get(risk.id) || []),
      ...(outgoing.get(risk.id) || [])
    ]
    
    if (connected.length === 0) continue
    
    // Use first connected node as reference
    const sourceId = connected[0]
    const sourcePos = positions[sourceId]
    const riskPos = positions[risk.id]
    
    if (!sourcePos || !riskPos) continue
    
    if (riskPlacement === 'adjacent') {
      // Place adjacent with orthogonal offset
      if (direction === 'LR') {
        positions[risk.id] = {
          x: riskPos.x,
          y: sourcePos.y + spacingValue * 0.5
        }
      } else {
        positions[risk.id] = {
          x: sourcePos.x + spacingValue * 0.5,
          y: riskPos.y
        }
      }
    } else if (riskPlacement === 'sameColumn') {
      // Share column/row with source
      if (direction === 'LR') {
        positions[risk.id] = {
          x: sourcePos.x,
          y: riskPos.y
        }
      } else {
        positions[risk.id] = {
          x: riskPos.x,
          y: sourcePos.y
        }
      }
    }
  }
}

/**
 * Apply semantic layout with BFS layering
 */
export function applySemanticLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  spacing: LayoutSpacing,
  policy: LayoutPolicy,
  preserveIds: Set<string> = new Set()
): LayoutResult {
  const start = performance.now()
  const movable = nodes.filter(n => !preserveIds.has(n.id) && !n.locked)
  const locked = nodes.filter(n => preserveIds.has(n.id) || n.locked)
  
  if (movable.length === 0) {
    return { positions: {}, duration: performance.now() - start }
  }
  
  const spacingValue = SPACING_VALUES[spacing]
  const positions: Record<string, { x: number; y: number }> = {}
  
  // Preserve locked positions
  locked.forEach(node => {
    const rfNode = nodes.find(n => n.id === node.id)
    if (rfNode) {
      positions[node.id] = { x: 0, y: 0 } // Will be filled from RF node position
    }
  })
  
  // Compute layers
  const layerMap = computeLayers(movable, edges, policy)
  const maxLayer = Math.max(...Array.from(layerMap.values()), 0)
  
  // Group by layer
  const layeredNodes = new Map<number, LayoutNode[]>()
  for (let i = 0; i <= maxLayer; i++) {
    layeredNodes.set(i, [])
  }
  
  movable.forEach(node => {
    const layer = layerMap.get(node.id) || 0
    layeredNodes.get(layer)!.push(node)
  })
  
  // Order within layers
  const orderedLayers = orderWithinLayers(layeredNodes, edges, layerMap)
  
  // Calculate positions
  const PADDING = 50
  const isLR = policy.direction === 'LR'
  
  orderedLayers.forEach((nodesInLayer, layer) => {
    nodesInLayer.forEach((node, indexInLayer) => {
      const primaryAxis = PADDING + layer * (200 + spacingValue) // Approximate node width
      const secondaryAxis = PADDING + indexInLayer * (100 + spacingValue) // Approximate node height
      
      if (isLR) {
        positions[node.id] = { x: primaryAxis, y: secondaryAxis }
      } else {
        positions[node.id] = { x: secondaryAxis, y: primaryAxis }
      }
    })
  })
  
  // Place risks
  placeRisks(
    positions,
    movable,
    edges,
    policy.layers.risk,
    spacingValue,
    policy.direction
  )
  
  // Snap to grid
  Object.keys(positions).forEach(id => {
    const pos = positions[id]
    positions[id] = {
      x: snapToGrid(pos.x, policy.grid),
      y: snapToGrid(pos.y, policy.grid)
    }
  })
  
  return {
    positions,
    duration: performance.now() - start
  }
}
