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
