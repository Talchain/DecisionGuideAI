/**
 * Semantic layout helpers for goal-first, outcome-last ordering
 */

import type { LayoutNode, LayoutEdge } from './types'

/**
 * Pre-order nodes semantically: goals first, outcomes last, others in middle
 * Returns sorted array without mutating input
 */
export function semanticPreOrder(nodes: LayoutNode[]): LayoutNode[] {
  const goals: LayoutNode[] = []
  const outcomes: LayoutNode[] = []
  const middle: LayoutNode[] = []
  
  for (const node of nodes) {
    if (node.kind === 'goal') {
      goals.push(node)
    } else if (node.kind === 'outcome') {
      outcomes.push(node)
    } else {
      middle.push(node)
    }
  }
  
  // Stable sort by id within each group
  const sortById = (a: LayoutNode, b: LayoutNode) => a.id.localeCompare(b.id)
  goals.sort(sortById)
  middle.sort(sortById)
  outcomes.sort(sortById)
  
  return [...goals, ...middle, ...outcomes]
}

/**
 * Post-adjust risk nodes to be adjacent to their source
 * Modifies positions in place for risks with single edge
 */
export function adjustRiskPositions(
  positions: Record<string, { x: number; y: number }>,
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  spacingY: number
): void {
  const riskNodes = nodes.filter(n => n.kind === 'risk' && !n.locked)
  
  for (const risk of riskNodes) {
    // Find edges connected to this risk
    const connected = edges.filter(e => e.source === risk.id || e.target === risk.id)
    
    // Only adjust if single connection
    if (connected.length === 1) {
      const edge = connected[0]
      const sourceId = edge.source === risk.id ? edge.target : edge.source
      const sourcePos = positions[sourceId]
      const riskPos = positions[risk.id]
      
      if (sourcePos && riskPos) {
        // Nudge risk to be adjacent (offset by half spacing)
        positions[risk.id] = {
          x: riskPos.x,
          y: sourcePos.y + spacingY * 0.5
        }
      }
    }
  }
}
