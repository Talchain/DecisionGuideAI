/**
 * Blueprint to Graph Transformer
 * Ensures every template is "goal-first" with exactly one root goal node
 */

import type { Blueprint, BlueprintNode, BlueprintEdge } from '../blueprints/types'

export interface GraphNode {
  id: string
  kind: 'goal' | 'decision' | 'option' | 'risk' | 'outcome'
  label: string
  position?: { x: number; y: number }
}

export interface GraphEdge {
  from: string
  to: string
  probability?: number
  weight?: number
  belief?: number              // v1.2: epistemic confidence (0-1)
  provenance?: 'template' | 'user' | 'inferred'  // v1.2: source tracking
}

export interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

/**
 * Transform blueprint to graph, ensuring goal-first structure
 */
export function blueprintToGraph(blueprint: Blueprint): Graph {
  const nodes = [...blueprint.nodes]
  const edges = [...blueprint.edges]
  
  // Find existing goals
  const goals = nodes.filter(n => n.kind === 'goal')
  const decisions = nodes.filter(n => n.kind === 'decision')
  
  // Goal-first enforcement
  if (goals.length === 0 && decisions.length > 0) {
    // No goal exists - create one and link to first decision
    const goalNode: BlueprintNode = {
      id: 'auto-goal',
      kind: 'goal',
      label: 'Goal',
      position: {
        x: decisions[0].position?.x ?? 0,
        y: (decisions[0].position?.y ?? 0) - 150
      }
    }
    
    const goalEdge: BlueprintEdge = {
      from: 'auto-goal',
      to: decisions[0].id,
      probability: 1.0
    }
    
    nodes.unshift(goalNode)
    edges.unshift(goalEdge)
    
    if (import.meta.env.DEV) {
      console.log(`[blueprintToGraph] Added goal node to ${blueprint.id}`)
    }
  } else if (goals.length > 1) {
    // Multiple goals - use first as root
    if (import.meta.env.DEV) {
      console.warn(`[blueprintToGraph] ${blueprint.id} has ${goals.length} goals, using first as root`)
    }
  }
  
  return {
    nodes: nodes.map(n => ({
      id: n.id,
      kind: n.kind,
      label: n.label,
      position: n.position
    })),
    edges: edges.map(e => ({
      from: e.from,
      to: e.to,
      probability: e.probability,
      weight: e.weight,
      belief: e.belief,              // v1.2: preserve epistemic confidence
      provenance: e.provenance       // v1.2: preserve source tracking
    }))
  }
}
