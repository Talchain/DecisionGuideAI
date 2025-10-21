/**
 * Grid layout engine
 * Arranges nodes in a stable grid with configurable spacing
 */

import type { LayoutNode, LayoutResult, LayoutSpacing } from '../types'
import { SPACING_VALUES } from '../types'

const PADDING = 50

/**
 * Calculate grid dimensions for optimal layout
 */
function calculateGridDimensions(nodeCount: number): { cols: number; rows: number } {
  if (nodeCount === 0) return { cols: 0, rows: 0 }
  if (nodeCount === 1) return { cols: 1, rows: 1 }
  
  // Aim for roughly square grid, slightly wider than tall
  const cols = Math.ceil(Math.sqrt(nodeCount * 1.2))
  const rows = Math.ceil(nodeCount / cols)
  
  return { cols, rows }
}

/**
 * Grid layout: stable sort by x/y, place in rows/cols with spacing
 */
export function applyGridLayout(
  nodes: LayoutNode[],
  spacing: LayoutSpacing,
  preserveIds: Set<string> = new Set()
): LayoutResult {
  const startTime = performance.now()
  
  // Filter out preserved nodes
  const movableNodes = nodes.filter(n => !preserveIds.has(n.id) && !n.locked)
  
  if (movableNodes.length === 0) {
    return { positions: {}, duration: performance.now() - startTime }
  }
  
  const spacingValue = SPACING_VALUES[spacing]
  const { cols } = calculateGridDimensions(movableNodes.length)
  
  // Stable sort by current position (top-to-bottom, left-to-right)
  const sorted = [...movableNodes].sort((a, b) => {
    // Use id as tiebreaker for stability
    return a.id.localeCompare(b.id)
  })
  
  const positions: Record<string, { x: number; y: number }> = {}
  
  // Find max node dimensions for uniform grid cells
  const maxWidth = Math.max(...movableNodes.map(n => n.width))
  const maxHeight = Math.max(...movableNodes.map(n => n.height))
  
  sorted.forEach((node, index) => {
    const col = index % cols
    const row = Math.floor(index / cols)
    
    // Center node in its grid cell
    const cellX = PADDING + col * (maxWidth + spacingValue)
    const cellY = PADDING + row * (maxHeight + spacingValue)
    
    positions[node.id] = {
      x: cellX + (maxWidth - node.width) / 2,
      y: cellY + (maxHeight - node.height) / 2,
    }
  })
  
  return {
    positions,
    duration: performance.now() - startTime,
  }
}
