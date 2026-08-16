import type { Edge, Node } from '@xyflow/react'

import { canonicalJson } from '../../lib/canonical-hash'
import {
  ANALYTICAL_EDGE_FIELDS,
  ANALYTICAL_NODE_DATA_FIELDS,
  deepEqual,
} from '../domain/analyticalChange'
import type { EdgeData } from '../domain/edges'
import { useCanvasStore } from '../store'
import { autosaveSourceFromStore, projectAutosaveData } from '../store/autosaveProjection'
import { saveAutosave } from '../store/scenarios'
import { pulseAppliedTargets } from '../utils/appliedEditPulse'
import { mapDraftEdgeToCanvas, mapDraftNodeToCanvas } from '../utils/applyDraftResult'
import type { CEEGoalConstraint } from '../../adapters/cee/types'
import { logger } from '../../lib/logger'

// The generic staleness registry intentionally covers live editor fields, but
// a full GraphV3 receipt must also retire canonical wire optionals and legacy
// aliases that can change a downstream request. `strength_mean` is especially
// load-bearing: the legacy ISL adapter prefers it over weight + direction.
const CANONICAL_NODE_ANALYTICAL_FIELDS = [
  ...new Set([
    ...ANALYTICAL_NODE_DATA_FIELDS,
    'category',
    'categories',
    'state_space',
    'goal_threshold_frame',
  ]),
] as const
const CANONICAL_EDGE_ANALYTICAL_FIELDS = [
  ...new Set([
    ...ANALYTICAL_EDGE_FIELDS,
    'strength_mean',
    'effect_direction',
    'edge_type',
  ]),
] as const

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

function edgePair(from: string, to: string): string {
  return `${from}\u0000${to}`
}

function replaceFields(
  target: Record<string, unknown>,
  source: Record<string, unknown> | undefined,
  fields: Iterable<string>,
): void {
  for (const field of fields) {
    if (source && field in source) target[field] = source[field]
    else delete target[field]
  }
}

export interface CanonicalNodeFieldProtection {
  nodeId: string
  fields: readonly string[]
  data: Record<string, unknown>
}

export interface CanonicalEdgeFieldProtection {
  from: string
  to: string
  fields: readonly string[]
  data: Record<string, unknown>
}

export interface CanonicalGraphFieldProtections {
  nodes?: readonly CanonicalNodeFieldProtection[]
  edges?: readonly CanonicalEdgeFieldProtection[]
}

export interface CanonicalGraphReconciliationResult {
  ok: boolean
  changed: boolean
  hasProtections: boolean
  reason?:
    | 'canonical_graph_invalid'
    | 'live_graph_ambiguous'
    | 'protected_element_missing'
    | 'analytical_projection_mismatch'
}

interface FieldSnapshot {
  data: Record<string, unknown>
  fields: Set<string>
}

function mergeNodeProtections(
  protections: readonly CanonicalNodeFieldProtection[],
): Map<string, FieldSnapshot> {
  const merged = new Map<string, FieldSnapshot>()
  for (const protection of protections) {
    const current = merged.get(protection.nodeId) ?? {
      data: protection.data,
      fields: new Set<string>(),
    }
    for (const field of protection.fields) current.fields.add(field)
    merged.set(protection.nodeId, current)
  }
  return merged
}

function mergeEdgeProtections(
  protections: readonly CanonicalEdgeFieldProtection[],
): Map<string, FieldSnapshot> {
  const merged = new Map<string, FieldSnapshot>()
  for (const protection of protections) {
    const key = edgePair(protection.from, protection.to)
    const current = merged.get(key) ?? {
      data: protection.data,
      fields: new Set<string>(),
    }
    for (const field of protection.fields) current.fields.add(field)
    merged.set(key, current)
  }
  return merged
}

function projectionMatches(
  expectedNodes: readonly Node[],
  expectedEdges: readonly Edge[],
  nodeProtections: ReadonlyMap<string, FieldSnapshot>,
  edgeProtections: ReadonlyMap<string, FieldSnapshot>,
): boolean {
  const state = useCanvasStore.getState()
  if (state.nodes.length !== expectedNodes.length || state.edges.length !== expectedEdges.length) {
    return false
  }

  const expectedNodeById = new Map(expectedNodes.map((node) => [node.id, node]))
  for (const liveNode of state.nodes) {
    const expected = expectedNodeById.get(liveNode.id)
    if (!expected || (liveNode.type ?? '') !== (expected.type ?? '')) return false
    const fields = new Set(CANONICAL_NODE_ANALYTICAL_FIELDS)
    for (const field of nodeProtections.get(liveNode.id)?.fields ?? []) fields.add(field)
    if (!fieldsEqual(
      liveNode.data as Record<string, unknown> | undefined,
      expected.data as Record<string, unknown> | undefined,
      [...fields],
    )) return false
  }

  const expectedEdgeByPair = new Map(
    expectedEdges.map((edge) => [edgePair(edge.source, edge.target), edge]),
  )
  const seenPairs = new Set<string>()
  for (const liveEdge of state.edges) {
    const key = edgePair(liveEdge.source, liveEdge.target)
    if (seenPairs.has(key)) return false
    seenPairs.add(key)
    const expected = expectedEdgeByPair.get(key)
    if (!expected) return false
    const fields = new Set(CANONICAL_EDGE_ANALYTICAL_FIELDS)
    for (const field of edgeProtections.get(key)?.fields ?? []) fields.add(field)
    if (!fieldsEqual(
      liveEdge.data as Record<string, unknown> | undefined,
      expected.data as Record<string, unknown> | undefined,
      [...fields],
    )) return false
  }
  return true
}

/**
 * Apply one validated full GraphV3 receipt as the canonical analytical graph.
 *
 * Presence is authoritative, including values equal to mapper defaults and
 * absent optional fields. The only permitted overlays are explicit snapshots
 * of local work that the in-flight receipt cannot contain (a queued writer or
 * a newer unsupported edit). The return value is a read-after-write proof of
 * the exact canonical-plus-declared-protections projection; callers must not
 * settle a transaction or publish freshness when `ok` is false.
 */
export function reconcileCanvasWithCanonicalGraph(
  graphValue: unknown,
  protections: CanonicalGraphFieldProtections = {},
): CanonicalGraphReconciliationResult {
  const graph = record(graphValue)
  const rawNodes = Array.isArray(graph?.nodes) ? graph.nodes : null
  const rawEdges = Array.isArray(graph?.edges) ? graph.edges : null
  const hasProtections = (protections.nodes?.length ?? 0) > 0 ||
    (protections.edges?.length ?? 0) > 0
  const invalid = (reason: CanonicalGraphReconciliationResult['reason']) => ({
    ok: false,
    changed: false,
    hasProtections,
    reason,
  })
  if (!graph || !rawNodes || !rawEdges || rawNodes.length === 0) {
    return invalid('canonical_graph_invalid')
  }

  const state = useCanvasStore.getState()
  const existingNodeById = new Map<string, Node>()
  for (const node of state.nodes) {
    if (existingNodeById.has(node.id)) return invalid('live_graph_ambiguous')
    existingNodeById.set(node.id, node)
  }
  const existingEdgeByPair = new Map<string, Edge<EdgeData>>()
  for (const edge of state.edges) {
    const key = edgePair(edge.source, edge.target)
    if (existingEdgeByPair.has(key)) return invalid('live_graph_ambiguous')
    existingEdgeByPair.set(key, edge)
  }

  const nodeProtections = mergeNodeProtections(protections.nodes ?? [])
  const edgeProtections = mergeEdgeProtections(protections.edges ?? [])
  const nodeIds = new Set<string>()
  const nodes: Node[] = []
  const changedNodeIds: string[] = []
  for (const [index, rawNode] of rawNodes.entries()) {
    const node = record(rawNode)
    if (!node || typeof node.id !== 'string' || node.id.trim().length === 0 || nodeIds.has(node.id)) {
      return invalid('canonical_graph_invalid')
    }
    nodeIds.add(node.id)
    const mapped = mapDraftNodeToCanvas(node) as Node
    const existing = existingNodeById.get(node.id)
    const mappedData = mapped.data as Record<string, unknown> | undefined
    const data = {
      ...((existing?.data as Record<string, unknown> | undefined) ?? {}),
      ...(mappedData ?? {}),
    }
    replaceFields(data, mappedData, CANONICAL_NODE_ANALYTICAL_FIELDS)
    const protection = nodeProtections.get(node.id)
    if (protection) replaceFields(data, protection.data, protection.fields)
    const next: Node = existing ? {
      ...existing,
      type: mapped.type,
      data,
    } : {
      ...mapped,
      position: {
        x: 120 + (index % 4) * 240,
        y: 100 + Math.floor(index / 4) * 160,
      },
      data,
    }
    nodes.push(next)
    if (!existing || !deepEqual(existing, next)) changedNodeIds.push(next.id)
  }

  const pairs = new Set<string>()
  const usedEdgeIds = new Set(state.edges.map((edge) => edge.id))
  const edges: Edge<EdgeData>[] = []
  const changedEdgeIds: string[] = []
  for (const [index, rawEdge] of rawEdges.entries()) {
    const edge = record(rawEdge)
    if (!edge || !canonicalEdgeIsUsable(edge)) return invalid('canonical_graph_invalid')
    const from = String(edge.from)
    const to = String(edge.to)
    if (!nodeIds.has(from) || !nodeIds.has(to)) return invalid('canonical_graph_invalid')
    const key = edgePair(from, to)
    if (pairs.has(key)) return invalid('canonical_graph_invalid')
    pairs.add(key)
    const mapped = mapDraftEdgeToCanvas(edge, index) as Edge<EdgeData>
    const existing = existingEdgeByPair.get(key)
    const mappedData = mapped.data as Record<string, unknown> | undefined
    const data = {
      ...((existing?.data as Record<string, unknown> | undefined) ?? {}),
      ...(mappedData ?? {}),
    }
    replaceFields(data, mappedData, CANONICAL_EDGE_ANALYTICAL_FIELDS)
    const protection = edgeProtections.get(key)
    if (protection) replaceFields(data, protection.data, protection.fields)
    let id = existing?.id ?? mapped.id
    if (!existing) {
      while (usedEdgeIds.has(id)) id = `${id}-a`
      usedEdgeIds.add(id)
    }
    const next: Edge<EdgeData> = existing ? {
      ...existing,
      source: from,
      target: to,
      type: mapped.type,
      data: data as EdgeData,
    } : {
      ...mapped,
      id,
      source: from,
      target: to,
      data: data as EdgeData,
    }
    edges.push(next)
    if (!existing || !deepEqual(existing, next)) changedEdgeIds.push(next.id)
  }

  for (const nodeId of nodeProtections.keys()) {
    if (!existingNodeById.has(nodeId) || !nodeIds.has(nodeId)) {
      return invalid('protected_element_missing')
    }
  }
  for (const key of edgeProtections.keys()) {
    if (!existingEdgeByPair.has(key) || !pairs.has(key)) {
      return invalid('protected_element_missing')
    }
  }

  const changed = !deepEqual(state.nodes, nodes) || !deepEqual(state.edges, edges)
  if (changed) state.pushHistory()
  state.beginExternalGraphMutation('patch_apply')
  try {
    if (changed) useCanvasStore.setState({ nodes, edges })
    useCanvasStore.getState().reseedIds(nodes, edges)
    useCanvasStore.getState().setLastAuthoritativeGraph({
      nodeIds: [...nodeIds],
      edgePairs: [...pairs],
    })
    if (changed) useCanvasStore.getState().markGraphStructurallyEdited?.()
  } finally {
    useCanvasStore.getState().endExternalGraphMutation()
  }

  if (!projectionMatches(nodes, edges, nodeProtections, edgeProtections)) {
    return {
      ok: false,
      changed,
      hasProtections,
      reason: 'analytical_projection_mismatch',
    }
  }

  if (changed) {
    pulseAppliedTargets({ nodeIds: changedNodeIds, edgeIds: changedEdgeIds })
  }

  const receiptGoalConstraints = graph.goal_constraints
  if (Array.isArray(receiptGoalConstraints) && receiptGoalConstraints.length > 0) {
    const constraints = receiptGoalConstraints as CEEGoalConstraint[]
    useCanvasStore.getState().setGoalConstraints(constraints, { fromProducerSync: true })
    logger.info('[constraint-trace] store-write', {
      source: 'reconcileCanvasWithCanonicalGraph',
      count: constraints.length,
      constraint_ids: constraints.map((constraint) => constraint.constraint_id),
    })
  }

  if (changed || (Array.isArray(receiptGoalConstraints) && receiptGoalConstraints.length > 0)) {
    try {
      saveAutosave(projectAutosaveData(autosaveSourceFromStore(useCanvasStore.getState())))
    } catch {
      // Persistence failure cannot turn an exact in-memory receipt into a lie.
    }
  }

  return { ok: true, changed, hasProtections }
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
      CANONICAL_NODE_ANALYTICAL_FIELDS,
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
      CANONICAL_EDGE_ANALYTICAL_FIELDS,
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
