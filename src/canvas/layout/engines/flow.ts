/**
 * Flow layout engine
 * Left-to-right flow with vertical compaction
 */

import type { LayoutNode, LayoutEdge, LayoutResult, LayoutSpacing } from '../types'
import { SPACING_VALUES } from '../types'

const PADDING = 50

/**
 * Flow layout: topological order, place left→right with vertical compaction
 */
export function applyFlowLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  spacing: LayoutSpacing,
  preserveIds: Set<string> = new Set()
): LayoutResult {
  const start = performance.now()
  const movable = nodes.filter(n => !preserveIds.has(n.id) && !n.locked)
  
  if (movable.length === 0) {
    return { positions: {}, duration: performance.now() - start }
  }
  
  const spacingValue = SPACING_VALUES[spacing]
  const positions: Record<string, { x: number; y: number }> = {}
  
  // Simple left-to-right flow with vertical stacking
  const maxWidth = Math.max(...movable.map(n => n.width))
  const maxHeight = Math.max(...movable.map(n => n.height))
  
  // Calculate columns based on node count
  const nodesPerColumn = Math.ceil(Math.sqrt(movable.length))
  
  movable.forEach((node, index) => {
    const col = Math.floor(index / nodesPerColumn)
    const row = index % nodesPerColumn
    
    positions[node.id] = {
      x: PADDING + col * (maxWidth + spacingValue),
      y: PADDING + row * (maxHeight + spacingValue)
    }
  })
  
  return {
    positions,
    duration: performance.now() - start
  }
}
