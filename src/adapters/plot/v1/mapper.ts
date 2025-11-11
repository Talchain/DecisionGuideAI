/**
 * Map React Flow graph to PLoT v1 request format
 */

import type { V1RunRequest } from './types'
import { V1_LIMITS } from './types'
import type { CanonicalRun } from '../types'

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
    belief?: number              // v1.2: epistemic confidence (0-1)
    provenance?: string          // v1.2: source tracking
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
      nodes: graph.nodes.map((n) => {
        // Ensure label always has a value (backend requirement)
        const label = n.data?.label || n.id
        const node: any = {
          id: n.id,
          label: label.substring(0, V1_LIMITS.MAX_LABEL_LENGTH),
          body: n.data?.body?.substring(0, V1_LIMITS.MAX_BODY_LENGTH),
        }

        // v1.2: preserve optional fields
        if (n.data?.kind) {
          node.kind = n.data.kind
        }
        if (n.data?.prior !== undefined) {
          // Clamp to 0-1 range
          node.prior = Math.max(0, Math.min(1, n.data.prior))
        }
        if (n.data?.utility !== undefined) {
          // Clamp to -1..+1 range
          node.utility = Math.max(-1, Math.min(1, n.data.utility))
        }

        return node
      }),
      edges: graph.edges.map((e) => {
        const edge: any = {
          from: e.source,
          to: e.target,
        }

        // v1.2: preserve server-assigned stable ID
        if (e.id) {
          edge.id = e.id
        }

        // Normalize confidence: if > 1, assume it's a percentage
        if (e.data?.confidence !== undefined) {
          const conf = e.data.confidence
          edge.confidence = conf > 1 ? conf / 100 : conf
        }

        if (e.data?.weight !== undefined) {
          edge.weight = e.data.weight
        }

        // v1.2: belief and provenance
        if (e.data?.belief !== undefined) {
          // Clamp to 0-1 range
          edge.belief = Math.max(0, Math.min(1, e.data.belief))
        }

        if (e.data?.provenance) {
          // Trim to max 100 chars
          edge.provenance = e.data.provenance.slice(0, 100)
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

/**
 * Normalize v1.2 run response to canonical format
 * Handles both legacy (results.*.outcome) and v1.2 (result.summary.*) formats
 */
export function toCanonicalRun(res: any): CanonicalRun {
  // Extract bands - prefer v1.2 format, fallback to legacy
  const p10 = res?.result?.summary?.p10 ?? res?.results?.conservative?.outcome ?? null
  const p50 = res?.result?.summary?.p50 ?? res?.results?.most_likely?.outcome ?? null
  const p90 = res?.result?.summary?.p90 ?? res?.results?.optimistic?.outcome ?? null

  // Extract response hash - prefer v1.2 location
  const responseHash = res?.result?.response_hash ?? res?.model_card?.response_hash ?? ''

  // Extract confidence if present
  const confidence = res?.confidence
    ? {
        level: res.confidence.level,
        reason: res.confidence.reason ?? res.confidence.why,
        score: res.confidence.score,
      }
    : undefined

  // Extract critique if present (skip empty arrays)
  const critique = Array.isArray(res?.critique) && res.critique.length > 0
    ? res.critique.map((c: any) => ({
        severity: c.severity as 'INFO' | 'WARNING' | 'BLOCKER',
        message: c.message,
      }))
    : undefined

  const canonicalRun: CanonicalRun = {
    responseHash,
    bands: { p10, p50, p90 },
    confidence,
    critique,
  }

  // Dev-only diagnostic logging
  if (import.meta.env.DEV) {
    console.debug('[Run] canonical', canonicalRun)
  }

  return canonicalRun
}
