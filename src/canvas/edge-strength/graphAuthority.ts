import type { Edge, Node } from '@xyflow/react'

import { canonicalJson } from '../../lib/canonical-hash'
import {
  ANALYTICAL_EDGE_FIELDS,
  ANALYTICAL_NODE_DATA_FIELDS,
  deepEqual,
} from '../domain/analyticalChange'
import { useCanvasStore } from '../store'
import { mapDraftEdgeToCanvas, mapDraftNodeToCanvas } from '../utils/applyDraftResult'

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function projectFields(
  data: Record<string, unknown> | undefined,
  fields: readonly string[],
): Record<string, unknown> {
  const projected: Record<string, unknown> = {}
  for (const field of fields) {
    if (data && field in data) projected[field] = data[field]
  }
  return projected
}

/**
 * Snapshot every canvas input that can change canonical analysis. This is used
 * as a read fence around the asynchronous server-graph fetch; a late boot read
 * may not overwrite a factor/node/edge edit made while it was in flight.
 */
export function captureCanvasAnalyticalFingerprint(): string {
  const state = useCanvasStore.getState()
  const nodes = state.nodes.map((node) => ({
    id: node.id,
    type: node.type ?? '',
    fields: projectFields(
      node.data as Record<string, unknown> | undefined,
      ANALYTICAL_NODE_DATA_FIELDS,
    ),
  })).sort((a, b) => a.id.localeCompare(b.id))
  const edges = state.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    fields: projectFields(
      edge.data as Record<string, unknown> | undefined,
      ANALYTICAL_EDGE_FIELDS,
    ),
  })).sort((a, b) => a.id.localeCompare(b.id))
  return canonicalJson({ nodes, edges })
}

function fieldsEqual(
  actualData: Record<string, unknown> | undefined,
  expectedData: Record<string, unknown> | undefined,
  fields: readonly string[],
): boolean {
  for (const field of fields) {
    const actualHas = actualData ? field in actualData : false
    const expectedHas = expectedData ? field in expectedData : false
    if (actualHas !== expectedHas) return false
    if (actualHas && !deepEqual(actualData?.[field], expectedData?.[field])) return false
  }
  return true
}

function canonicalEdgeIsUsable(edge: Record<string, unknown>): boolean {
  const strength = record(edge.strength)
  const mean = strength?.mean
  const std = strength?.std
  const exists = edge.exists_probability
  const direction = edge.effect_direction
  return typeof edge.from === 'string' && edge.from.trim().length > 0 &&
    typeof edge.to === 'string' && edge.to.trim().length > 0 &&
    typeof mean === 'number' && Number.isFinite(mean) && mean >= -1 && mean <= 1 &&
    typeof std === 'number' && Number.isFinite(std) && std > 0 &&
    typeof exists === 'number' && Number.isFinite(exists) && exists >= 0 && exists <= 1 &&
    (direction === 'positive' || direction === 'negative') &&
    !(mean > 0 && direction !== 'positive') &&
    !(mean < 0 && direction !== 'negative')
}

/**
 * Prove that the visible analytical graph is exactly the full GraphV3 the
 * server returned. ReactFlow edge ids are intentionally ignored: CEE identity
 * is the unique canonical (from,to) pair.
 */
export function canvasAnalyticallyMatchesCanonicalGraph(graphValue: unknown): boolean {
  const graph = record(graphValue)
  const rawNodes = Array.isArray(graph?.nodes) ? graph.nodes : null
  const rawEdges = Array.isArray(graph?.edges) ? graph.edges : null
  if (!rawNodes || !rawEdges || rawNodes.length === 0) return false

  const serverNodes = new Map<string, Node>()
  for (const rawNode of rawNodes) {
    const node = record(rawNode)
    if (!node || typeof node.id !== 'string' || node.id.trim().length === 0) return false
    if (serverNodes.has(node.id)) return false
    serverNodes.set(node.id, mapDraftNodeToCanvas(node) as Node)
  }

  const serverEdges = new Map<string, Edge>()
  for (const [index, rawEdge] of rawEdges.entries()) {
    const edge = record(rawEdge)
    if (!edge || !canonicalEdgeIsUsable(edge)) return false
    const key = `${String(edge.from)}\u0000${String(edge.to)}`
    if (serverEdges.has(key)) return false
    serverEdges.set(key, mapDraftEdgeToCanvas(edge, index) as Edge)
  }

  const state = useCanvasStore.getState()
  if (state.nodes.length !== serverNodes.size || state.edges.length !== serverEdges.size) return false

  for (const liveNode of state.nodes) {
    const expected = serverNodes.get(liveNode.id)
    if (!expected || (liveNode.type ?? '') !== (expected.type ?? '')) return false
    if (!fieldsEqual(
      liveNode.data as Record<string, unknown> | undefined,
      expected.data as Record<string, unknown> | undefined,
      ANALYTICAL_NODE_DATA_FIELDS,
    )) return false
  }

  const seenLivePairs = new Set<string>()
  for (const liveEdge of state.edges) {
    const key = `${liveEdge.source}\u0000${liveEdge.target}`
    if (seenLivePairs.has(key)) return false
    seenLivePairs.add(key)
    const expected = serverEdges.get(key)
    if (!expected) return false
    if (!fieldsEqual(
      liveEdge.data as Record<string, unknown> | undefined,
      expected.data as Record<string, unknown> | undefined,
      ANALYTICAL_EDGE_FIELDS,
    )) return false
  }

  return true
}

/**
 * Explicit recovery only: replace local analytical structure with the fetched
 * shared graph while retaining ReactFlow layout and opaque local edge ids where
 * endpoint identity still matches. The caller must make this a deliberate user
 * action; boot hydration remains additive so it never silently deletes work.
 */
export function replaceCanvasWithCanonicalGraph(graphValue: unknown): boolean {
  const graph = record(graphValue)
  const rawNodes = Array.isArray(graph?.nodes) ? graph.nodes : null
  const rawEdges = Array.isArray(graph?.edges) ? graph.edges : null
  if (!rawNodes || !rawEdges || rawNodes.length === 0) return false

  const state = useCanvasStore.getState()
  const existingNodeById = new Map(state.nodes.map((node) => [node.id, node]))
  const existingEdgeByPair = new Map(
    state.edges.map((edge) => [`${edge.source}\u0000${edge.target}`, edge]),
  )
  const nodeIds = new Set<string>()
  const nodes: typeof state.nodes = []
  for (const [index, rawNode] of rawNodes.entries()) {
    const node = record(rawNode)
    if (!node || typeof node.id !== 'string' || node.id.trim().length === 0 || nodeIds.has(node.id)) {
      return false
    }
    nodeIds.add(node.id)
    const mapped = mapDraftNodeToCanvas(node) as Node
    const existing = existingNodeById.get(node.id)
    nodes.push({
      ...mapped,
      position: existing?.position ?? {
        x: 120 + (index % 4) * 240,
        y: 100 + Math.floor(index / 4) * 160,
      },
    })
  }

  const pairs = new Set<string>()
  const edges: typeof state.edges = []
  for (const [index, rawEdge] of rawEdges.entries()) {
    const edge = record(rawEdge)
    if (!edge || !canonicalEdgeIsUsable(edge)) return false
    if (!nodeIds.has(String(edge.from)) || !nodeIds.has(String(edge.to))) return false
    const key = `${String(edge.from)}\u0000${String(edge.to)}`
    if (pairs.has(key)) return false
    pairs.add(key)
    const mapped = mapDraftEdgeToCanvas(edge, index) as typeof state.edges[number]
    const existing = existingEdgeByPair.get(key)
    edges.push(existing ? { ...mapped, id: existing.id } : mapped)
  }

  state.pushHistory()
  state.beginExternalGraphMutation('hydrate')
  try {
    useCanvasStore.setState({ nodes, edges })
    useCanvasStore.getState().reseedIds(nodes, edges)
    useCanvasStore.getState().setLastAuthoritativeGraph({
      nodeIds: [...nodeIds],
      edgePairs: [...pairs],
    })
  } finally {
    useCanvasStore.getState().endExternalGraphMutation()
  }
  return canvasAnalyticallyMatchesCanonicalGraph(graphValue)
}
