import type { PlcImport } from './validate'

export type PlcNode = { id: string; x: number; y: number; label?: string }
export type PlcEdge = { from: string; to: string; label?: string }
export type PlcState = { nodes: PlcNode[]; edges: PlcEdge[] }

export type PlcImportDiff = {
  addNodes: PlcNode[]
  removeNodes: string[]
  moves: Array<{ id: string; to: { x: number; y: number } }>
  addEdges: PlcEdge[]
  removeEdges: Array<{ from: string; to: string }>
}

export function normalizeImport(data: PlcImport): PlcState {
  const nodes: PlcNode[] = data.nodes.map(n => ({ id: String(n.id), x: Number(n.x), y: Number(n.y), label: n.label?.trim() ?? undefined }))
  const edges: PlcEdge[] = data.edges.map(e => ({ from: String(e.from), to: String(e.to), label: e.label?.trim() ?? undefined }))
  return { nodes, edges }
}

const nearEq = (a: number, b: number) => Math.abs(a - b) < 0.5

export function diffImport(current: PlcState, incoming: PlcState): PlcImportDiff {
  const curNodeMap = new Map(current.nodes.map(n => [n.id, n]))
  const inNodeMap = new Map(incoming.nodes.map(n => [n.id, n]))

  const removeNodeIds = current.nodes.filter(n => !inNodeMap.has(n.id)).map(n => n.id)
  const addNodes = incoming.nodes.filter(n => !curNodeMap.has(n.id))

  const moves: PlcImportDiff['moves'] = []
  for (const n of incoming.nodes) {
    if (!curNodeMap.has(n.id)) continue
    if (removeNodeIds.includes(n.id)) continue
    const c = curNodeMap.get(n.id)!
    const to = { x: n.x, y: n.y }
    const cx = c.x
    const cy = c.y
    if (!nearEq(cx, to.x) || !nearEq(cy, to.y)) moves.push({ id: n.id, to })
  }

  const keyE = (e: { from: string; to: string; label?: string }) => `${e.from}|${e.to}|${e.label ?? ''}`
  const curEdgeSet = new Set(current.edges.map(keyE))
  const inEdgeSet = new Set(incoming.edges.map(keyE))
  const removedSet = new Set(removeNodeIds)

  const removeEdges = current.edges
    .filter(e => removedSet.has(e.from) || removedSet.has(e.to) || !inEdgeSet.has(keyE(e)))
    .map(e => ({ from: e.from, to: e.to }))

  const addEdges = incoming.edges.filter(e => !curEdgeSet.has(keyE(e)))

  return { addNodes, removeNodes: removeNodeIds, moves, addEdges, removeEdges }
}

export function summarize(diff: PlcImportDiff) {
  const addCount = diff.addNodes.length + diff.addEdges.length
  const removeCount = diff.removeNodes.length + diff.removeEdges.length
  const moveCount = diff.moves.length
  const label = `Import Apply: +${addCount}/-${removeCount}/Δ${moveCount}`
  return { addCount, removeCount, moveCount, label }
}
