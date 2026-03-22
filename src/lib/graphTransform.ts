/**
 * Graph Transform
 *
 * Transforms canvas state to CEE graph format (WorkingSetRequest.graph_snapshot).
 *
 * Key distinction:
 * - graph_schema_version in WorkingSetRequest = "2.2" (CEE CONTRACT version)
 * - graph.version = internal graph format version (typically "1")
 *
 * Used by:
 * - useAsk to build graph_snapshot for /assist/v1/ask
 * - Any other CEE endpoint requiring graph data
 */

import type { Node, Edge } from '@xyflow/react'

// =============================================================================
// Types
// =============================================================================

/**
 * Graph structure matching CEE's expected schema
 */
export interface Graph {
  version: string // Internal graph format, typically "1"
  default_seed?: number
  nodes: GraphNode[]
  edges: GraphEdge[]
  meta: GraphMeta
}

export interface GraphNode {
  id: string
  kind: string
  label: string
  body?: string // Max 200 chars per CEE spec
  evidence?: unknown
}

export interface GraphEdge {
  from: string
  to: string
  belief: number
  effect_direction?: 'positive' | 'negative' | 'unknown'
  strength_std?: number
  edge_type?: string
}

export interface GraphMeta {
  roots: string[]
  leaves: string[]
  suggested_positions: Record<string, { x: number; y: number }>
  source: 'ui' | 'import' | 'api'
}

// =============================================================================
// Transform Functions
// =============================================================================

/**
 * Transform canvas Node to CEE GraphNode
 */
function transformNode(node: Node): GraphNode {
  const data = node.data as Record<string, unknown>

  const graphNode: GraphNode = {
    id: node.id,
    kind: (data.kind as string) ?? (node.type as string) ?? 'factor',
    label: (data.label as string) ?? node.id,
  }

  // Include body with CEE limit (200 chars)
  const body = data.body as string | undefined
  if (body) {
    graphNode.body = body.slice(0, 200)
  }

  // Include v2.2 fields if present
  if (data.evidence !== undefined) {
    graphNode.evidence = data.evidence
  }

  return graphNode
}

/**
 * Transform canvas Edge to CEE GraphEdge
 */
function transformEdge(edge: Edge): GraphEdge {
  const data = edge.data as Record<string, unknown> | undefined

  const graphEdge: GraphEdge = {
    from: edge.source,
    to: edge.target,
    belief: (data?.confidence as number) ?? (data?.weight as number) ?? 0.5,
  }

  // Include v2.2 fields if present (CEE schema 2.2 expects these when available)
  if (data?.effect_direction !== undefined) {
    graphEdge.effect_direction = data.effect_direction as GraphEdge['effect_direction']
  }
  if (data?.strength_std !== undefined) {
    graphEdge.strength_std = data.strength_std as number
  }

  // Preserve edge_type (e.g. 'directed', 'bidirected'); default to 'directed' when absent
  const rawEdgeType = data?.edge_type
  graphEdge.edge_type = typeof rawEdgeType === 'string' ? rawEdgeType : 'directed'

  return graphEdge
}

/**
 * Compute graph topology (roots and leaves)
 */
function computeTopology(nodes: GraphNode[], edges: GraphEdge[]): { roots: string[]; leaves: string[] } {
  const nodeIds = new Set(nodes.map(n => n.id))
  const hasIncoming = new Set<string>()
  const hasOutgoing = new Set<string>()

  for (const edge of edges) {
    hasIncoming.add(edge.to)
    hasOutgoing.add(edge.from)
  }

  const roots: string[] = []
  const leaves: string[] = []

  for (const id of nodeIds) {
    if (!hasIncoming.has(id)) roots.push(id)
    if (!hasOutgoing.has(id)) leaves.push(id)
  }

  return { roots, leaves }
}

/**
 * Build suggested positions from canvas positions
 */
function buildPositions(nodes: Node[]): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {}

  for (const node of nodes) {
    if (node.position) {
      positions[node.id] = {
        x: Math.round(node.position.x),
        y: Math.round(node.position.y),
      }
    }
  }

  return positions
}

// =============================================================================
// Main Export
// =============================================================================

/**
 * Prepare graph snapshot for CEE from canvas state
 *
 * @param nodes - Canvas nodes from @xyflow/react
 * @param edges - Canvas edges from @xyflow/react
 * @returns Graph object ready for WorkingSetRequest.graph_snapshot
 *
 * @example
 * const graphSnapshot = prepareGraphSnapshot(canvasNodes, canvasEdges)
 * const payload: WorkingSetRequest = {
 *   graph_schema_version: '2.2',  // CEE contract version
 *   graph_snapshot: graphSnapshot,
 *   // ...other fields
 * }
 */
export function prepareGraphSnapshot(nodes: Node[], edges: Edge[]): Graph {
  const graphNodes = nodes.map(transformNode)
  const graphEdges = edges.map(transformEdge)
  const topology = computeTopology(graphNodes, graphEdges)

  const graph: Graph = {
    version: '1',
    default_seed: 42,
    nodes: graphNodes,
    edges: graphEdges,
    meta: {
      roots: topology.roots,
      leaves: topology.leaves,
      suggested_positions: buildPositions(nodes),
      source: 'ui',
    },
  }

  // Dev-only validation against CEE's expected schema
  if (import.meta.env.DEV) {
    validateGraphSchema(graph)
  }

  return graph
}

/**
 * Ensures graph snapshot is v2.2 compatible.
 * Currently identity transform - add actual v1→v2.2 conversion if needed.
 *
 * @param graph - Graph to validate/transform
 * @returns v2.2 compatible graph
 */
export function ensureSchemaV22(graph: Graph): Graph {
  // Validate required v2.2 fields exist
  const hasV22EdgeFields = graph.edges.every(
    e => 'belief' in e || ('effect_direction' in e && 'strength_std' in e)
  )

  if (!hasV22EdgeFields && import.meta.env.DEV) {
    console.warn('[GraphTransform] Graph may not be fully v2.2 compatible - edges should have belief field')
  }

  // TODO: Add actual v1 → v2.2 transform if canvas state is v1
  // For now, assume canvas produces v2.2-compatible output

  return graph
}

// =============================================================================
// Validation (Dev Only)
// =============================================================================

/**
 * Dev-only validation to catch schema mismatches before they hit CEE.
 */
function validateGraphSchema(graph: Graph): void {
  const errors: string[] = []

  // Check required node fields
  graph.nodes.forEach((node, i) => {
    if (!node.id) errors.push(`Node ${i} missing id`)
    if (!node.kind) errors.push(`Node ${i} missing kind`)
    if (!node.label) errors.push(`Node ${i} missing label`)
    if (node.body && node.body.length > 200) errors.push(`Node ${i} body exceeds 200 chars`)
  })

  // Check required edge fields
  graph.edges.forEach((edge, i) => {
    if (!edge.from) errors.push(`Edge ${i} missing from`)
    if (!edge.to) errors.push(`Edge ${i} missing to`)
    if (typeof edge.belief !== 'number') errors.push(`Edge ${i} missing belief`)
  })

  // Check for dangling edges
  const nodeIds = new Set(graph.nodes.map(n => n.id))
  graph.edges.forEach((edge, i) => {
    if (!nodeIds.has(edge.from)) errors.push(`Edge ${i} references unknown node: ${edge.from}`)
    if (!nodeIds.has(edge.to)) errors.push(`Edge ${i} references unknown node: ${edge.to}`)
  })

  // Check for duplicate node IDs
  const seenIds = new Set<string>()
  graph.nodes.forEach((node, i) => {
    if (seenIds.has(node.id)) {
      errors.push(`Duplicate node ID at index ${i}: ${node.id}`)
    }
    seenIds.add(node.id)
  })

  if (errors.length > 0) {
    console.error('[GraphTransform] Schema validation errors:', errors)
  }
}

/**
 * Check if graph has required minimum structure for CEE
 */
export function hasMinimumStructure(graph: Graph): boolean {
  return graph.nodes.length >= 1 && graph.edges.length >= 0
}
