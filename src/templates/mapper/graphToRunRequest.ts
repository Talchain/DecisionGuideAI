// Map React Flow graph to adapter RunRequest

import type { RunRequest } from '../../adapters/plot/types'
import type { Blueprint } from '../blueprints/types'

export interface GraphNode {
  id: string
  data: {
    label: string
    kind?: string
    [key: string]: unknown
  }
  position: { x: number; y: number }
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  data?: {
    probability?: number
    weight?: number
    [key: string]: unknown
  }
}

export interface GraphState {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface MapperOptions {
  templateId: string
  seed?: number
  inputs?: Record<string, unknown>
}

/**
 * Convert React Flow graph to adapter RunRequest
 * Uses deterministic seed based on template ID if not provided
 */
export function graphToRunRequest(
  _graph: GraphState,
  options: MapperOptions
): RunRequest {
  const { templateId, seed, inputs } = options
  
  // Generate deterministic seed from template ID if not provided
  const finalSeed = seed ?? generateSeedFromTemplateId(templateId)
  
  return {
    template_id: templateId,
    seed: finalSeed,
    mode: 'strict',
    inputs: inputs || {}
  }
}

/**
 * Generate deterministic seed from template ID
 * Simple hash function for consistency
 */
function generateSeedFromTemplateId(templateId: string): number {
  let hash = 0
  for (let i = 0; i < templateId.length; i++) {
    const char = templateId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash) % 10000 + 1 // Keep in range 1-10000
}

/**
 * Validate graph structure
 */
export function validateGraph(graph: GraphState): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (!graph.nodes || graph.nodes.length === 0) {
    errors.push('Graph must have at least one node')
  }
  
  // Validate edge references
  if (graph.edges) {
    const nodeIds = new Set(graph.nodes.map(n => n.id))
    for (const edge of graph.edges) {
      if (!nodeIds.has(edge.source)) {
        errors.push(`Edge ${edge.id} references non-existent source node ${edge.source}`)
      }
      if (!nodeIds.has(edge.target)) {
        errors.push(`Edge ${edge.id} references non-existent target node ${edge.target}`)
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Validate probabilities sum to 1 for each source node
 */
export function validateProbabilities(graph: GraphState): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  // Group edges by source
  const edgesBySource = new Map<string, GraphEdge[]>()
  for (const edge of graph.edges) {
    if (!edgesBySource.has(edge.source)) {
      edgesBySource.set(edge.source, [])
    }
    edgesBySource.get(edge.source)!.push(edge)
  }
  
  // Check each source node's outgoing edges
  for (const [sourceId, edges] of edgesBySource) {
    const probabilities = edges
      .map(e => e.data?.probability ?? 0)
      .filter(p => p > 0)
    
    if (probabilities.length > 0) {
      const sum = probabilities.reduce((a, b) => a + b, 0)
      const tolerance = 0.001
      
      if (Math.abs(sum - 1.0) > tolerance) {
        errors.push(
          `Node ${sourceId}: probabilities sum to ${sum.toFixed(3)}, expected 1.0`
        )
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Convert blueprint to initial graph state
 */
export function blueprintToGraph(blueprint: Blueprint): GraphState {
  return {
    nodes: blueprint.nodes.map(node => ({
      id: node.id,
      data: {
        label: node.label,
        kind: node.kind
      },
      position: node.position || { x: 0, y: 0 }
    })),
    edges: blueprint.edges.map(edge => ({
      id: edge.id,
      source: edge.from,
      target: edge.to,
      data: {
        probability: edge.probability,
        weight: edge.weight
      }
    }))
  }
}
