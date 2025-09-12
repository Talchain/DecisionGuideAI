import { Graph, Node, Edge } from '@/domain/graph'

export type DomainMapping = {
  nodeToShape: Map<string, string>
  edgeToShape: Map<string, string>
  upsertShapeFromNode: (node: Node) => string
  removeNodeShape: (nodeId: string) => void
  upsertConnectorFromEdge: (edge: Edge) => string | null
  removeEdgeConnector: (edgeId: string) => void
  onConnectorReattach: (edgeId: string, fromNodeId: string, toNodeId: string) => void
  rebuildFromGraph: (graph: Graph) => void
  detach: () => void
}

export type DomainMappingOptions = {
  editor: any
  decisionId: string
  sessionId: string
  track: (name: string, props?: Record<string, unknown>) => void
  onEdgeChange?: (edge: Edge) => void
}

const DEFAULT_W = 160
const DEFAULT_H = 80

function pickBadge(node: Node): { text: string; title: string } | null {
  const list = node.krImpacts || []
  if (!list.length) return null
  let best = list[0]
  for (const k of list) {
    if (Math.abs(k.deltaP50) > Math.abs(best.deltaP50)) best = k
  }
  const arrow = best.deltaP50 > 0 ? '↑' : best.deltaP50 < 0 ? '↓' : '→'
  const sign = best.deltaP50 > 0 ? '+' : ''
  const pct = Math.round(best.deltaP50 * 100) / 100
  const text = `KR ${best.krId}: ${sign}${pct} ${arrow}`
  const title = `KR ${best.krId}: deltaP50=${best.deltaP50}, confidence=${best.confidence}`
  return { text, title }
}

export function createDomainMapping(opts: DomainMappingOptions): DomainMapping {
  const { editor, decisionId, sessionId, track, onEdgeChange } = opts
  const nodeToShape = new Map<string, string>()
  const edgeToShape = new Map<string, string>()

  const createOrUpdate = (node: Node): string => {
    const id = node.id
    const shapeId = `node-${id}`
    const x = node.view?.x ?? 80 + (nodeToShape.size % 4) * 220
    const y = node.view?.y ?? 80 + Math.floor(nodeToShape.size / 4) * 180
    const w = node.view?.w ?? DEFAULT_W
    const h = node.view?.h ?? DEFAULT_H
    const badge = pickBadge(node)
    const text = node.title + (badge ? `\n${badge.text}` : '')
    const meta: any = { nodeId: id, type: node.type }
    if (badge) meta.krBadge = badge

    try {
      const isNew = !nodeToShape.has(id)
      if (isNew) {
        editor?.createShape?.({ id: shapeId, type: 'geo', x, y, props: { w, h, text }, meta })
        nodeToShape.set(id, shapeId)
        try { track('sandbox_graph_node_add', { decisionId, route: 'combined', sessionId, nodeId: id, type: node.type }) } catch {}
      } else {
        editor?.updateShape?.({ id: shapeId, type: 'geo', x, y, props: { w, h, text }, meta })
        try { track('sandbox_graph_node_update', { decisionId, route: 'combined', sessionId, nodeId: id, type: node.type }) } catch {}
      }
    } catch {}
    return shapeId
  }

  const removeNodeShape = (nodeId: string) => {
    const shapeId = nodeToShape.get(nodeId)
    if (!shapeId) return
    try { editor?.deleteShape?.({ id: shapeId }) } catch {}
    nodeToShape.delete(nodeId)
  }

  const upsertConnectorFromEdge = (edge: Edge): string | null => {
    const shapeId = `edge-${edge.id}`
    const fromShape = nodeToShape.get(edge.from)
    const toShape = nodeToShape.get(edge.to)
    if (!fromShape || !toShape) return null
    const meta: any = { edgeId: edge.id, kind: edge.kind }
    const props: any = {
      start: { type: 'binding', boundShapeId: fromShape },
      end: { type: 'binding', boundShapeId: toShape },
    }
    try {
      const isNew = !edgeToShape.has(edge.id)
      if (isNew) {
        editor?.createShape?.({ id: shapeId, type: 'arrow', props, meta })
        edgeToShape.set(edge.id, shapeId)
        try { track('sandbox_graph_edge_add', { decisionId, route: 'combined', sessionId, edgeId: edge.id, kind: edge.kind }) } catch {}
      } else {
        editor?.updateShape?.({ id: shapeId, type: 'arrow', props, meta })
        try { track('sandbox_graph_edge_update', { decisionId, route: 'combined', sessionId, edgeId: edge.id, kind: edge.kind }) } catch {}
      }
      return shapeId
    } catch {
      return null
    }
  }

  const removeEdgeConnector = (edgeId: string) => {
    const sid = edgeToShape.get(edgeId)
    if (!sid) return
    try { editor?.deleteShape?.({ id: sid }) } catch {}
    edgeToShape.delete(edgeId)
  }

  const onConnectorReattach = (edgeId: string, fromNodeId: string, toNodeId: string) => {
    if (!onEdgeChange) return
    const kind = undefined as unknown as Edge['kind']
    onEdgeChange({ id: edgeId, from: fromNodeId, to: toNodeId, kind: (kind ?? 'supports') })
  }

  const rebuildFromGraph = (graph: Graph) => {
    // Upsert all nodes first
    for (const n of Object.values(graph.nodes)) createOrUpdate(n)
    // Then upsert edges
    for (const e of Object.values(graph.edges)) upsertConnectorFromEdge(e)
  }

  const detach = () => {
    // No-op; events will be registered in a later commit when needed
  }

  return {
    nodeToShape,
    edgeToShape,
    upsertShapeFromNode: createOrUpdate,
    removeNodeShape,
    upsertConnectorFromEdge,
    removeEdgeConnector,
    onConnectorReattach,
    rebuildFromGraph,
    detach,
  }
}
