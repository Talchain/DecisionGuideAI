/**
 * Probability validation utilities
 * Ensures outgoing edge probabilities sum to 1.0
 */

import type { Edge } from '@xyflow/react'
import type { EdgeData } from '../domain/edges'

export interface ValidationResult {
  valid: boolean
  sum: number
  message?: string
}

/**
 * Validate that outgoing edge probabilities from a node sum to 1.0
 * @param nodeId - Source node ID
 * @param edges - All edges in the graph
 * @param tolerance - Acceptable deviation from 1.0 (default: 0.01)
 */
export function validateOutgoingProbabilities(
  nodeId: string,
  edges: Edge<EdgeData>[],
  tolerance = 0.01
): ValidationResult {
  const outgoingEdges = edges.filter(e => e.source === nodeId)
  
  if (outgoingEdges.length === 0) {
    return { valid: true, sum: 0 }
  }
  
  const probabilities = outgoingEdges
    .map(e => e.data?.confidence ?? 0)
    .filter(p => p > 0)
  
  if (probabilities.length === 0) {
    return { valid: true, sum: 0 }
  }
  
  const sum = probabilities.reduce((a, b) => a + b, 0)
  const valid = Math.abs(sum - 1.0) <= tolerance
  
  if (!valid) {
    const percentage = Math.round(sum * 100)
    return {
      valid: false,
      sum,
      message: `Outgoing probabilities must sum to 100% (currently ${percentage}%). Adjust the values to continue.`
    }
  }
  
  return { valid: true, sum }
}

/**
 * Get all outgoing edges from a node with their probabilities
 */
export function getOutgoingEdgesWithProbabilities(
  nodeId: string,
  edges: Edge<EdgeData>[]
): Array<{ edgeId: string; targetId: string; probability: number }> {
  return edges
    .filter(e => e.source === nodeId)
    .map(e => ({
      edgeId: e.id,
      targetId: e.target,
      probability: e.data?.confidence ?? 0
    }))
}
