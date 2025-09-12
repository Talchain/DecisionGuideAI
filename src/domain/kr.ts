import type { Graph, Node, Edge } from '@/domain/graph'

export type ScoreResult = {
  scenarioScore: number // -100 .. +100
  perNode: Record<string, number> // nodeId -> -100 .. +100
  explain?: Record<string, { own: number; fromChildren: number }>
}

function clampScore(x: number): number {
  if (!Number.isFinite(x)) return 0
  return Math.max(-100, Math.min(100, x))
}

function ownScore(n: Node): number {
  const list = n.krImpacts || []
  let s = 0
  for (const k of list) {
    const delta = Number.isFinite(k.deltaP50 as number) ? k.deltaP50 : 0
    const conf = Number.isFinite(k.confidence as number) ? k.confidence : 0
    s += delta * conf * 100
  }
  return clampScore(s)
}

function edgeMultiplier(e: Edge): number {
  switch (e.kind) {
    case 'supports': return 1
    case 'causes': return 1
    case 'mitigates': return -1
    case 'impactsKR': return 1
    default: return 1
  }
}

export function scoreGraph(graph: Graph, opts?: { decay?: number; maxDepth?: number }): ScoreResult {
  const decay = (opts?.decay ?? 0.7)
  const maxDepth = (opts?.maxDepth ?? 4)
  const nodeIds = Object.keys(graph.nodes)
  const own: Record<string, number> = {}
  const fromChildren: Record<string, number> = {}

  for (const id of nodeIds) { own[id] = ownScore(graph.nodes[id]); fromChildren[id] = 0 }

  const edges = Object.values(graph.edges)

  for (let d = 1; d <= maxDepth; d++) {
    // compute current child total scores (previous depth)
    const childScore: Record<string, number> = {}
    for (const id of nodeIds) {
      childScore[id] = clampScore(own[id] + fromChildren[id])
    }
    const atten = Math.pow(decay, d)
    for (const e of edges) {
      const c = e.from
      const p = e.to
      if (!graph.nodes[c] || !graph.nodes[p]) continue
      const mult = edgeMultiplier(e)
      const contrib = childScore[c] * mult * atten
      if (!Number.isFinite(contrib)) continue
      fromChildren[p] = (fromChildren[p] ?? 0) + contrib
    }
  }

  const perNode: Record<string, number> = {}
  for (const id of nodeIds) perNode[id] = clampScore(own[id] + fromChildren[id])

  // Scenario score: average Outcomes if present, else average nodes with any KR
  const outcomes = nodeIds.filter(id => graph.nodes[id]?.type === 'Outcome')
  let scenario = 0
  if (outcomes.length > 0) {
    scenario = clampScore(outcomes.reduce((acc, id) => acc + perNode[id], 0) / outcomes.length)
  } else {
    const withKR = nodeIds.filter(id => (graph.nodes[id]?.krImpacts || []).length > 0)
    if (withKR.length > 0) scenario = clampScore(withKR.reduce((acc, id) => acc + perNode[id], 0) / withKR.length)
    else scenario = 0
  }

  const explain: Record<string, { own: number; fromChildren: number }> = {}
  for (const id of nodeIds) explain[id] = { own: clampScore(own[id]), fromChildren: clampScore(fromChildren[id]) }

  return { scenarioScore: scenario, perNode, explain }
}
