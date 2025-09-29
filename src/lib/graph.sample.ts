// src/lib/graph.sample.ts
// Deterministic sample graph used by Simplify and List View features
export type Node = { id: string; title: string }
export type Edge = { id: string; from: string; to: string; weight: number }

export function getSampleGraph(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    { id: 'n1', title: 'Pricing change' },
    { id: 'n2', title: 'Feature launch' },
    { id: 'n3', title: 'Build vs Buy' },
    { id: 'n4', title: 'Marketing plan' },
    { id: 'n5', title: 'Support load' },
  ]
  const edges: Edge[] = [
    { id: 'e1', from: 'n1', to: 'n2', weight: 0.35 },
    { id: 'e2', from: 'n2', to: 'n3', weight: 0.12 }, // below TAU
    { id: 'e3', from: 'n3', to: 'n4', weight: 0.75 },
    { id: 'e4', from: 'n4', to: 'n5', weight: 0.18 }, // below TAU
    { id: 'e5', from: 'n1', to: 'n5', weight: 0.50 },
  ]
  return { nodes, edges }
}
