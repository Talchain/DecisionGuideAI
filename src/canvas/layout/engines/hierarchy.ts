import type { LayoutNode, LayoutEdge, LayoutResult, LayoutSpacing } from '../types'
import { SPACING_VALUES } from '../types'

export function applyHierarchyLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  spacing: LayoutSpacing,
  preserveIds: Set<string> = new Set()
): LayoutResult {
  const start = performance.now()
  const movable = nodes.filter(n => !preserveIds.has(n.id) && !n.locked)
  const positions: Record<string, { x: number; y: number }> = {}
  const spacingValue = SPACING_VALUES[spacing]
  
  movable.forEach((node, i) => {
    const row = Math.floor(i / 4)
    const col = i % 4
    positions[node.id] = {
      x: 50 + col * (node.width + spacingValue),
      y: 50 + row * (node.height + spacingValue)
    }
  })
  
  return { positions, duration: performance.now() - start }
}
