/**
 * Graph Shape Mapper
 *
 * Converts between UI (React Flow) and API (PLoT v1) graph formats.
 *
 * CRITICAL RULES:
 * 1. API edges use {from, to} - never send {source, target}
 * 2. API edges never include id field
 * 3. API edges never include data.confidence - only weight
 * 4. Weights are 0..1 (normalize if needed, preserve sign)
 * 5. Templates from /v1/templates/{id}/graph are already API shape - pass through
 */

import type { UiGraph, ApiGraph, ApiNode, ApiEdge } from '../../../types/plot'
import type { V1RunRequest } from './types'
import { V1_LIMITS } from './types'

// ============================================================================
// Legacy Types (for backward compatibility)
// ============================================================================

export interface ReactFlowGraph {
  nodes: Array<{
    id: string
    data?: {
      label?: string
      body?: string
      [key: string]: any
    }
  }>
  edges: Array<{
    id: string
    source: string
    target: string
    data?: {
      confidence?: number
      weight?: number
      [key: string]: any
    }
  }>
}

// ============================================================================
// New Clean API (recommended)
// ============================================================================

/**
 * Type guard: check if graph is already in API shape
 */
export function isApiGraph(g: any): g is ApiGraph {
  if (!g || !Array.isArray(g.nodes) || !Array.isArray(g.edges)) {
    return false
  }

  // API edges have 'from' field, UI edges have 'source'
  if (g.edges.length > 0) {
    const firstEdge = g.edges[0]
    return 'from' in firstEdge && !('source' in firstEdge)
  }

  // Empty edges array - check nodes structure
  return true
}

/**
 * Convert UI graph to API graph
 *
 * Maps:
 * - nodes: Extract id and label (prefer explicit node.label over node.data.label)
 * - edges: Convert source/target → from/to, extract weight, drop confidence
 *
 * Throws BAD_INPUT error for malformed graphs (missing/empty IDs)
 */
export function toApiGraph(ui: UiGraph): ApiGraph {
  // Validate nodes
  const nodes: ApiNode[] = ui.nodes.map((n, idx) => {
    if (!n.id || n.id.trim() === '') {
      throw {
        code: 'BAD_INPUT',
        message: `Node at index ${idx} has missing or empty id`,
        field: `nodes[${idx}].id`,
      }
    }

    const node: ApiNode = { id: n.id }

    // Prefer explicit label field, fall back to data.label
    const label = n.label ?? n.data?.label
    if (label) {
      node.label = label
    }

    return node
  })

  // Validate edges
  const edges: ApiEdge[] = ui.edges.map((e, idx) => {
    if (!e.source || e.source.trim() === '') {
      throw {
        code: 'BAD_INPUT',
        message: `Edge at index ${idx} has missing or empty source`,
        field: `edges[${idx}].source`,
      }
    }

    if (!e.target || e.target.trim() === '') {
      throw {
        code: 'BAD_INPUT',
        message: `Edge at index ${idx} has missing or empty target`,
        field: `edges[${idx}].target`,
      }
    }

    const edge: ApiEdge = {
      from: e.source,
      to: e.target,
    }

    // Add optional fields only if present
    if (e.data?.label) {
      edge.label = e.data.label
    }

    // Weight: prefer explicit weight, fall back to confidence
    // Normalize if needed (0..100 → 0..1), preserve sign
    const rawWeight = e.data?.weight ?? e.data?.confidence
    if (rawWeight != null) {
      try {
        edge.weight = normalizeWeight(rawWeight)
      } catch (err: any) {
        // Add edge context to error
        throw {
          ...err,
          message: `Edge ${idx} (${e.source} → ${e.target}): ${err.message}`,
          field: `edges[${idx}].weight`,
        }
      }
    }

    // Belief (0..1) - epistemic uncertainty about the edge relationship
    if (e.data?.belief != null) {
      edge.belief = Math.max(0, Math.min(1, e.data.belief))
    }

    // Provenance (≤100 chars) - source/rationale for the edge
    if (e.data?.provenance) {
      edge.provenance = e.data.provenance.slice(0, 100)
    }

    return edge
  })

  // DEV-ONLY: Validate output shape to catch regressions
  // Ensures we never accidentally send UI-only fields to backend
  if (import.meta.env.DEV) {
    validateApiGraphShape({ nodes, edges })
  }

  return { nodes, edges }
}

/**
 * Dev-only validation: ensure graph is in clean API shape
 * Catches regressions where UI-only fields leak through
 */
function validateApiGraphShape(graph: ApiGraph): void {
  const forbidden = {
    nodes: ['data', 'position', 'type', 'selected', 'dragging'],
    edges: ['source', 'target', 'id', 'data', 'selected']
  }

  // Check nodes for UI-only fields
  graph.nodes.forEach((node, idx) => {
    forbidden.nodes.forEach(field => {
      if (field in node) {
        console.error(
          `[DEV] toApiGraph() validation failed: node[${idx}] has UI-only field '${field}'`,
          node
        )
        throw new Error(
          `[DEV] API shape violation: node[${idx}] contains UI-only field '${field}'. ` +
          `Backend will reject this. Check toApiGraph() implementation.`
        )
      }
    })
  })

  // Check edges for UI-only fields
  graph.edges.forEach((edge, idx) => {
    forbidden.edges.forEach(field => {
      if (field in edge) {
        console.error(
          `[DEV] toApiGraph() validation failed: edge[${idx}] has UI-only field '${field}'`,
          edge
        )
        throw new Error(
          `[DEV] API shape violation: edge[${idx}] contains UI-only field '${field}'. ` +
          `Must use 'from'/'to', not 'source'/'target'. Check toApiGraph() implementation.`
        )
      }
    })

    // Validate weight range if present
    if ('weight' in edge && edge.weight != null) {
      if (!Number.isFinite(edge.weight)) {
        throw new Error(
          `[DEV] API shape violation: edge[${idx}] weight is not finite (got ${edge.weight})`
        )
      }
      if (Math.abs(edge.weight) > 1) {
        console.error(
          `[DEV] toApiGraph() validation failed: edge[${idx}] weight out of range`,
          edge
        )
        throw new Error(
          `[DEV] API shape violation: edge[${idx}] weight must be in range -1..1 (got ${edge.weight}). ` +
          `Check normalizeWeight() implementation.`
        )
      }
    }
  })
}

/**
 * Normalize weight to -1..1 range with strict validation
 *
 * - If already in range (-1..1), pass through
 * - If looks like percentage (>1 or <-1), divide by 100
 * - Preserve sign (allow negative weights for directionality)
 * - Undefined stays undefined
 * - Throws BAD_INPUT for invalid values (NaN, Infinity, out of range after normalization)
 */
function normalizeWeight(v: number | undefined): number | undefined {
  if (v == null) return undefined

  // Strict validation: reject NaN and Infinity
  if (!Number.isFinite(v)) {
    throw {
      code: 'BAD_INPUT',
      message: `Edge weight must be a finite number, got ${v}`,
      field: 'edge.weight',
    }
  }

  // Already normalized
  if (Math.abs(v) <= 1) {
    return v
  }

  // Looks like percentage - normalize
  const normalized = v / 100

  // Validate normalized value is within valid range
  if (Math.abs(normalized) > 1) {
    throw {
      code: 'BAD_INPUT',
      message: `Edge weight out of range: ${v} (normalized: ${normalized}). Must be between -100 and 100 (or -1 to 1).`,
      field: 'edge.weight',
    }
  }

  return normalized
}

// ============================================================================
// Legacy API (for backward compatibility - will be deprecated)
// ============================================================================

/**
 * @deprecated Use toApiGraph instead
 */
export function validateGraphLimits(graph: ReactFlowGraph): {
  code: string
  message: string
  field?: string
  max?: number
} | null {
  if (import.meta.env.DEV) {
    console.warn('validateGraphLimits() is deprecated. Use toApiGraph() instead (it throws BAD_INPUT on malformed graphs).')
  }

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

  for (const node of graph.nodes) {
    const label = node.data?.label
    if (label && label.length > V1_LIMITS.MAX_LABEL_LENGTH) {
      return {
        code: 'BAD_INPUT',
        message: `Node ${node.id} label exceeds ${V1_LIMITS.MAX_LABEL_LENGTH} characters`,
        field: 'label',
        max: V1_LIMITS.MAX_LABEL_LENGTH,
      }
    }

    const body = node.data?.body
    if (body && body.length > V1_LIMITS.MAX_BODY_LENGTH) {
      return {
        code: 'BAD_INPUT',
        message: `Node ${node.id} body exceeds ${V1_LIMITS.MAX_BODY_LENGTH} characters`,
        field: 'body',
        max: V1_LIMITS.MAX_BODY_LENGTH,
      }
    }
  }

  return null
}

/**
 * @deprecated Use toApiGraph + manual request building instead
 */
export function graphToV1Request(graph: ReactFlowGraph, seed?: number): V1RunRequest {
  if (import.meta.env.DEV) {
    console.warn('graphToV1Request() is deprecated. Use toApiGraph() + build request manually instead.')
  }

  const error = validateGraphLimits(graph)
  if (error) {
    throw error
  }

  return {
    graph: {
      nodes: graph.nodes.map(n => ({
        id: n.id,
        label: n.data?.label,
        body: n.data?.body,
      })),
      edges: graph.edges.map(e => {
        const edge: any = {
          from: e.source,
          to: e.target,
        }

        // Normalize confidence if present
        if (e.data?.confidence != null) {
          edge.confidence = normalizeWeight(e.data.confidence)
        }

        // Include weight if present
        if (e.data?.weight != null) {
          edge.weight = e.data.weight
        }

        return edge
      }),
    },
    seed,
  }
}

/**
 * @deprecated Response hash from server is preferred
 */
export function computeClientHash(graph: ReactFlowGraph, seed?: number): string {
  if (import.meta.env.DEV) {
    console.warn('computeClientHash() is deprecated. Server-provided response_hash is preferred.')
  }

  // Create deterministic string representation
  const sortedNodes = [...graph.nodes].sort((a, b) => a.id.localeCompare(b.id))
  const sortedEdges = [...graph.edges].sort((a, b) => {
    const cmp = a.source.localeCompare(b.source)
    return cmp !== 0 ? cmp : a.target.localeCompare(b.target)
  })

  const str = JSON.stringify({
    nodes: sortedNodes.map(n => ({ id: n.id, label: n.data?.label, body: n.data?.body })),
    edges: sortedEdges.map(e => ({
      from: e.source,
      to: e.target,
      weight: e.data?.weight,
      confidence: e.data?.confidence,
    })),
    seed,
  })

  // Simple hash function (not cryptographic, just for cache keys)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }

  return Math.abs(hash).toString(16)
}
