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
  isFromMapping: (shapeId: string) => boolean
  // exposed for tests/debug
  _flushNow?: () => void
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
  const lastNodeState = new Map<string, string>() // stringify of {x,y,w,h,text}
  const lastEdgeState = new Map<string, string>() // stringify of {from,to,kind}
  const outgoing = new Set<string>()
  let pending = false
  let rafId: number | null = null
  const queue: Array<() => void> = []

  const flush = () => {
    if (!pending) return
    pending = false
    const ops = queue.splice(0)
    for (const fn of ops) { try { fn() } catch {} }
  }

  const schedule = () => {
    if (pending) return
    pending = true
    try { rafId = requestAnimationFrame(() => { rafId = null; flush() }) } catch { /* non-browser */ }
    setTimeout(() => flush(), 0)
  }

  const createOrUpdate = (node: Node): string => {
    const id = node.id
    const existing = nodeToShape.get(id)
    const shapeId = existing ?? `node-${id}`
    const x = node.view?.x ?? 80 + (nodeToShape.size % 4) * 220
    const y = node.view?.y ?? 80 + Math.floor(nodeToShape.size / 4) * 180
    const w = node.view?.w ?? DEFAULT_W
    const h = node.view?.h ?? DEFAULT_H
    const badge = pickBadge(node)
    const text = node.title + (badge ? `\n${badge.text}` : '')
    const meta: any = { nodeId: id, type: node.type }
    if (badge) meta.krBadge = badge

    const sig = JSON.stringify({ x, y, w, h, text })
    const prevSig = lastNodeState.get(id)
    const isNew = !nodeToShape.has(id)
    if (!isNew && prevSig === sig) return shapeId // no-op

    queue.push(() => {
      try {
        outgoing.add(shapeId)
        if (isNew) {
          editor?.createShape?.({ id: shapeId, type: 'geo', x, y, props: { w, h, text }, meta })
          nodeToShape.set(id, shapeId)
          try { track('sandbox_graph_node_add', { decisionId, route: 'combined', sessionId, nodeId: id, type: node.type }) } catch {}
        } else {
          editor?.updateShape?.({ id: shapeId, type: 'geo', x, y, props: { w, h, text }, meta })
          try { track('sandbox_graph_node_update', { decisionId, route: 'combined', sessionId, nodeId: id, type: node.type }) } catch {}
        }
      } finally {
        // allow a tick for TL to propagate change before removing guard
        setTimeout(() => { outgoing.delete(shapeId) }, 0)
      }
    })
    lastNodeState.set(id, sig)
    schedule()
    return shapeId
  }

  const removeNodeShape = (nodeId: string) => {
    const shapeId = nodeToShape.get(nodeId)
    if (!shapeId) return
    queue.push(() => {
      try {
        outgoing.add(shapeId)
        editor?.deleteShape?.({ id: shapeId })
        try { track('sandbox_graph_node_delete', { decisionId, route: 'combined', sessionId, nodeId }) } catch {}
      } finally {
        setTimeout(() => { outgoing.delete(shapeId) }, 0)
      }
    })
    nodeToShape.delete(nodeId)
    lastNodeState.delete(nodeId)
    schedule()
  }

  const upsertConnectorFromEdge = (edge: Edge): string | null => {
    const existing = edgeToShape.get(edge.id)
    const shapeId = existing ?? `edge-${edge.id}`
    const fromShape = nodeToShape.get(edge.from)
    const toShape = nodeToShape.get(edge.to)
    if (!fromShape || !toShape) return null
    const meta: any = { edgeId: edge.id, kind: edge.kind }
    const props: any = {
      start: { type: 'binding', boundShapeId: fromShape },
      end: { type: 'binding', boundShapeId: toShape },
    }
    const sig = JSON.stringify({ from: fromShape, to: toShape, kind: edge.kind })
    const prev = lastEdgeState.get(edge.id)
    const isNew = !edgeToShape.has(edge.id)
    if (!isNew && prev === sig) return shapeId

    queue.push(() => {
      try {
        outgoing.add(shapeId)
        if (isNew) {
          editor?.createShape?.({ id: shapeId, type: 'arrow', props, meta })
          edgeToShape.set(edge.id, shapeId)
          try { track('sandbox_graph_edge_add', { decisionId, route: 'combined', sessionId, edgeId: edge.id, kind: edge.kind }) } catch {}
        } else {
          editor?.updateShape?.({ id: shapeId, type: 'arrow', props, meta })
          try { track('sandbox_graph_edge_update', { decisionId, route: 'combined', sessionId, edgeId: edge.id, kind: edge.kind }) } catch {}
        }
      } finally {
        setTimeout(() => { outgoing.delete(shapeId) }, 0)
      }
    })
    lastEdgeState.set(edge.id, sig)
    schedule()
    return shapeId
  }

  const removeEdgeConnector = (edgeId: string) => {
    const sid = edgeToShape.get(edgeId)
    if (!sid) return
    queue.push(() => {
      try {
        outgoing.add(sid)
        editor?.deleteShape?.({ id: sid })
        try { track('sandbox_graph_edge_delete', { decisionId, route: 'combined', sessionId, edgeId }) } catch {}
      } finally {
        setTimeout(() => { outgoing.delete(sid) }, 0)
      }
    })
    edgeToShape.delete(edgeId)
    lastEdgeState.delete(edgeId)
    schedule()
  }

  const onConnectorReattach = (edgeId: string, fromNodeId: string, toNodeId: string) => {
    if (!onEdgeChange) return
    const kind = undefined as unknown as Edge['kind']
    onEdgeChange({ id: edgeId, from: fromNodeId, to: toNodeId, kind: (kind ?? 'supports') })
  }

  const rebuildFromGraph = (graph: Graph) => {
    // Upsert all nodes first
    for (const n of Object.values(graph.nodes)) createOrUpdate(n)
    // Ensure node shapes exist before binding edges
    schedule()
    // direct flush for non-DOM env (tests)
    try { (flush as any)() } catch {}
    // Then upsert edges
    for (const e of Object.values(graph.edges)) upsertConnectorFromEdge(e)
  }

  const detach = () => {
    // Clean queues
    if (rafId != null) { try { cancelAnimationFrame(rafId) } catch {}; rafId = null }
    queue.splice(0)
    pending = false
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
    isFromMapping: (shapeId: string) => outgoing.has(shapeId),
    _flushNow: () => { flush() },
  }
}
