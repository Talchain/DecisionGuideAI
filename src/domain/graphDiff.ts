import type { Graph, Node, KrImpact } from '@/domain/graph'

export type GraphDiff = {
  nodes: { added: string[]; removed: string[]; changed: string[] }
  edges: { added: string[]; removed: string[]; changed: string[] }
}

function badgeSig(n: Node | undefined): string {
  if (!n || !n.krImpacts || n.krImpacts.length === 0) return 'none'
  let best: KrImpact | null = null
  for (const k of n.krImpacts) {
    if (!best) { best = k; continue }
    if (Math.abs(k.deltaP50) > Math.abs(best.deltaP50)) best = k
  }
  return `kr:${best!.krId}|d:${best!.deltaP50}|c:${best!.confidence}`
}

export function diffGraphs(a: Graph, b: Graph): GraphDiff {
  const aNodeIds = new Set(Object.keys(a.nodes))
  const bNodeIds = new Set(Object.keys(b.nodes))
  const aEdgeIds = new Set(Object.keys(a.edges))
  const bEdgeIds = new Set(Object.keys(b.edges))

  const addedNodes: string[] = []
  const removedNodes: string[] = []
  const changedNodes: string[] = []
  const addedEdges: string[] = []
  const removedEdges: string[] = []
  const changedEdges: string[] = []

  // Nodes
  for (const id of bNodeIds) if (!aNodeIds.has(id)) addedNodes.push(id)
  for (const id of aNodeIds) if (!bNodeIds.has(id)) removedNodes.push(id)
  for (const id of aNodeIds) {
    if (!bNodeIds.has(id)) continue
    const an = a.nodes[id]
    const bn = b.nodes[id]
    const changed = (an.type !== bn.type) || (an.title !== bn.title) || (badgeSig(an) !== badgeSig(bn))
    if (changed) changedNodes.push(id)
  }

  // Edges
  for (const id of bEdgeIds) if (!aEdgeIds.has(id)) addedEdges.push(id)
  for (const id of aEdgeIds) if (!bEdgeIds.has(id)) removedEdges.push(id)
  for (const id of aEdgeIds) {
    if (!bEdgeIds.has(id)) continue
    const ae = a.edges[id]
    const be = b.edges[id]
    const changed = (ae.kind !== be.kind) || (ae.from !== be.from) || (ae.to !== be.to)
    if (changed) changedEdges.push(id)
  }

  return {
    nodes: { added: addedNodes, removed: removedNodes, changed: changedNodes },
    edges: { added: addedEdges, removed: removedEdges, changed: changedEdges },
  }
}
