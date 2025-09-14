import type { Graph, Node, Edge } from '@/domain/graph'
import { SCHEMA_VERSION, normalizeNode } from '@/domain/graph'

export type ExportPayload = {
  version: number
  decisionId: string
  graph: Graph
}

export function normalizeGraph(input: any): Graph {
  try {
    const nodes: Record<string, Node> = {}
    const edges: Record<string, Edge> = {}
    const inNodes = (input?.graph?.nodes ?? input?.nodes ?? {}) as Record<string, any>
    const inEdges = (input?.graph?.edges ?? input?.edges ?? {}) as Record<string, any>
    for (const [id, n] of Object.entries(inNodes)) {
      if (!n || typeof n !== 'object') continue
      const node: Node = normalizeNode({ id, type: n.type, title: n.title ?? '', notes: n.notes, krImpacts: n.krImpacts, view: n.view, meta: n.meta })
      nodes[id] = node
    }
    for (const [id, e] of Object.entries(inEdges)) {
      if (!e || typeof e !== 'object') continue
      const from = String(e.from || '')
      const to = String(e.to || '')
      const kind = (e.kind as Edge['kind']) ?? 'supports'
      if (!from || !to) continue
      edges[id] = { id, from, to, kind, notes: e.notes, meta: e.meta }
    }
    return { schemaVersion: SCHEMA_VERSION, nodes, edges }
  } catch {
    return { schemaVersion: SCHEMA_VERSION, nodes: {}, edges: {} }
  }
}

export function serializeGraph(decisionId: string, graph: Graph): ExportPayload {
  // Ensure normalized output
  const norm = normalizeGraph(graph)
  return { version: SCHEMA_VERSION, decisionId, graph: norm }
}

export function countEntities(g: Graph): { nodeCount: number; edgeCount: number } {
  return { nodeCount: Object.keys(g.nodes).length, edgeCount: Object.keys(g.edges).length }
}

// --- Import validation & sanitization ---

export type ImportErrorReason = 'too_large' | 'invalid_schema' | 'too_many_nodes' | 'too_many_edges' | 'unknown'

export type ValidateOptions = {
  maxBytes?: number // default 2MB
  maxNodes?: number // default 500
  maxEdges?: number // default 1000
}

export function sanitizeString(input: unknown, max = 200): string {
  const s = String(input ?? '')
  // Trim and collapse whitespace; limit length
  return s.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max)
}

function sanitizeGraphStrings(g: Graph): Graph {
  const nodes: Record<string, Node> = {}
  for (const [id, n] of Object.entries(g.nodes)) {
    nodes[id] = normalizeNode({
      ...n,
      title: sanitizeString(n.title, 200),
      notes: n.notes ? sanitizeString(n.notes, 2000) : undefined,
    })
  }
  const edges: Record<string, Edge> = {}
  for (const [id, e] of Object.entries(g.edges)) {
    edges[id] = { ...e, notes: e.notes ? sanitizeString(e.notes, 2000) : undefined }
  }
  return { schemaVersion: g.schemaVersion, nodes, edges }
}

export function validateAndNormalizeImport(rawText: string, opts?: ValidateOptions): { graph: Graph; counts: { nodeCount: number; edgeCount: number } } {
  const maxBytes = opts?.maxBytes ?? 2 * 1024 * 1024
  if (rawText && rawText.length > maxBytes) {
    const err: any = new Error('File too large')
    err.reason = 'too_large'
    throw err
  }
  let parsed: any
  try {
    parsed = JSON.parse(rawText)
  } catch (e) {
    const err: any = new Error('Invalid JSON')
    err.reason = 'invalid_schema'
    throw err
  }
  // Version check (allow number 1 or SCHEMA_VERSION)
  const v = parsed?.version ?? parsed?.schemaVersion ?? parsed?.graph?.schemaVersion
  if (typeof v !== 'number') {
    const err: any = new Error('Missing version')
    err.reason = 'invalid_schema'
    throw err
  }
  // Normalize and sanitize
  const g = sanitizeGraphStrings(normalizeGraph(parsed))
  const { nodeCount, edgeCount } = countEntities(g)
  const maxNodes = opts?.maxNodes ?? 500
  const maxEdges = opts?.maxEdges ?? 1000
  if (nodeCount > maxNodes) {
    const err: any = new Error(`Too many nodes: ${nodeCount}`)
    err.reason = 'too_many_nodes'
    throw err
  }
  if (edgeCount > maxEdges) {
    const err: any = new Error(`Too many edges: ${edgeCount}`)
    err.reason = 'too_many_edges'
    throw err
  }
  return { graph: g, counts: { nodeCount, edgeCount } }
}
