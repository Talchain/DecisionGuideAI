import type { Node, Edge, NodeType, EdgeKind } from '@/domain/graph'

// Simple seedable PRNG (LCG)
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

function hashPrompt(p: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < p.length; i++) {
    h ^= p.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const TYPES: NodeType[] = ['Problem', 'Option', 'Action', 'Outcome']
const KINDS: EdgeKind[] = ['supports', 'causes', 'mitigates', 'impactsKR']

export function draftScenario({ prompt, seed }: { prompt: string; seed?: number }): { nodes: Node[]; edges: Edge[] } {
  const sd = seed ?? hashPrompt(prompt || 'default')
  const rnd = rng(sd)
  const words = (prompt || 'Generated Scenario').split(/\s+/).filter(Boolean)
  const pickWord = (i: number) => words[i % words.length] || `Item${i+1}`

  const nCount = 4 + Math.floor(rnd() * 5) // 4..8
  const eCount = 4 + Math.floor(rnd() * 7) // 4..10

  const nodes: Node[] = []
  for (let i = 0; i < nCount; i++) {
    const t = TYPES[Math.floor(rnd() * TYPES.length)]
    const title = `${t} ${pickWord(i)}`
    const x = 120 + (i % 4) * 220
    const y = 100 + Math.floor(i / 4) * 180
    const kr = rnd() < 0.5 ? [{ krId: `kr${(i%3)+1}`, deltaP50: Math.round(((rnd()*2-1) * 100))/100, confidence: Math.round((rnd()*1) * 100)/100 }] : undefined
    nodes.push({ id: `n${i}`, type: t, title, krImpacts: kr, view: { x, y, w: 160, h: 80 }, meta: { generated: true } })
  }

  const edges: Edge[] = []
  for (let i = 0; i < eCount; i++) {
    const a = Math.floor(rnd() * nCount)
    let b = Math.floor(rnd() * nCount)
    if (b === a) b = (b + 1) % nCount
    const kind = KINDS[Math.floor(rnd() * KINDS.length)]
    edges.push({ id: `e${i}`, from: nodes[a].id, to: nodes[b].id, kind, meta: { generated: true } })
  }

  return { nodes, edges }
}
