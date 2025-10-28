/**
 * Map React Flow graph to PLoT v1 request format
 */

import type { V1RunRequest } from './types'
import { V1_LIMITS } from './types'

export interface ReactFlowNode {
  id: string
  data?: {
    label?: string
    body?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface ReactFlowEdge {
  id: string
  source: string
  target: string
  data?: {
    confidence?: number
    weight?: number
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface ReactFlowGraph {
  nodes: ReactFlowNode[]
  edges: ReactFlowEdge[]
}

/**
 * Validation error
 */
export interface ValidationError {
  code: 'LIMIT_EXCEEDED' | 'BAD_INPUT'
  message: string
  field?: string
  max?: number
}

/**
 * Validate graph against v1 limits
 */
export function validateGraphLimits(graph: ReactFlowGraph): ValidationError | null {
  if (graph.nodes.length > V1_LIMITS.MAX_NODES) {
    return {
      code: 'LIMIT_EXCEEDED',
      message: `Graph has ${graph.nodes.length} nodes, max is ${V1_LIMITS.MAX_NODES}`,
      field: 'nodes',
      max: V1_LIMITS.MAX_NODES,
    }
  }

  if (graph.edges.length > V1_LIMITS.MAX_EDGES) {
    return {
      code: 'LIMIT_EXCEEDED',
      message: `Graph has ${graph.edges.length} edges, max is ${V1_LIMITS.MAX_EDGES}`,
      field: 'edges',
      max: V1_LIMITS.MAX_EDGES,
    }
  }

  // Validate label/body lengths
  for (const node of graph.nodes) {
    const label = node.data?.label || ''
    const body = node.data?.body || ''

    if (label.length > V1_LIMITS.MAX_LABEL_LENGTH) {
      return {
        code: 'BAD_INPUT',
        message: `Node ${node.id} label exceeds ${V1_LIMITS.MAX_LABEL_LENGTH} characters`,
        field: 'label',
        max: V1_LIMITS.MAX_LABEL_LENGTH,
      }
    }

    if (body.length > V1_LIMITS.MAX_BODY_LENGTH) {
      return {
        code: 'BAD_INPUT',
        message: `Node ${node.id} body exceeds ${V1_LIMITS.MAX_BODY_LENGTH} characters`,
        field: 'body',
        max: V1_LIMITS.MAX_BODY_LENGTH,
      }
    }
  }

  // Validate outgoing connector totals ≈100% ±1%
  for (const node of graph.nodes) {
    const outgoingEdges = graph.edges.filter(e => e.source === node.id)

    // Skip nodes with no outgoing edges (leaf nodes)
    if (outgoingEdges.length === 0) continue

    // Calculate total confidence from outgoing edges
    let total = 0
    for (const edge of outgoingEdges) {
      const conf = edge.data?.confidence
      if (conf === undefined) {
        // If any outgoing edge lacks confidence, skip validation
        // (backend will handle defaults)
        total = -1
        break
      }
      // Normalize: if > 1, assume it's a percentage
      total += conf > 1 ? conf / 100 : conf
    }

    // Only validate if all edges have confidence values
    if (total >= 0) {
      const tolerance = 0.01 // ±1%
      if (Math.abs(total - 1.0) > tolerance) {
        return {
          code: 'BAD_INPUT',
          message: `Node "${node.data?.label || node.id}" outgoing probabilities sum to ${(total * 100).toFixed(1)}%, must be 100% ±1%`,
          field: 'confidence',
        }
      }
    }
  }

  return null
}

/**
 * Convert React Flow graph to V1 request format
 * Enforces limits and normalizes confidence to 0..1
 */
export function graphToV1Request(
  graph: ReactFlowGraph,
  seed?: number
): V1RunRequest {
  // Validate limits first
  const error = validateGraphLimits(graph)
  if (error) {
    throw error
  }

  return {
    graph: {
      nodes: graph.nodes.map((n) => ({
        id: n.id,
        label: n.data?.label?.substring(0, V1_LIMITS.MAX_LABEL_LENGTH),
        body: n.data?.body?.substring(0, V1_LIMITS.MAX_BODY_LENGTH),
      })),
      edges: graph.edges.map((e) => {
        const edge: any = {
          from: e.source,
          to: e.target,
        }

        // Normalize confidence: if > 1, assume it's a percentage
        if (e.data?.confidence !== undefined) {
          const conf = e.data.confidence
          edge.confidence = conf > 1 ? conf / 100 : conf
        }

        if (e.data?.weight !== undefined) {
          edge.weight = e.data.weight
        }

        return edge
      }),
    },
    seed,
  }
}

/**
 * Compute deterministic client hash for idempotency
 * Includes ALL fields that affect server behavior
 */
export function computeClientHash(graph: ReactFlowGraph, seed?: number): string {
  const canonical = JSON.stringify({
    nodes: graph.nodes
      .map((n) => ({
        id: n.id,
        label: n.data?.label,
        body: n.data?.body, // Include body - affects server computation
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    edges: graph.edges
      .map((e) => ({
        from: e.source,
        to: e.target,
        conf: e.data?.confidence,
        weight: e.data?.weight, // Include weight - affects server computation
      }))
      .sort((a, b) => `${a.from}-${a.to}`.localeCompare(`${b.from}-${b.to}`)),
    seed: seed || 0,
  })

  // Simple hash (djb2)
  let hash = 5381
  for (let i = 0; i < canonical.length; i++) {
    hash = ((hash << 5) + hash) + canonical.charCodeAt(i)
  }

  return (hash >>> 0).toString(16)
}
