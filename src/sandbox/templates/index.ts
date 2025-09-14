import type { Graph } from '@/domain/graph'

export type Template = { id: string; title: string; graph: Graph }

const g = (nodes: Graph['nodes'], edges: Graph['edges']): Graph => ({ schemaVersion: 1, nodes, edges })

export const templates: Template[] = [
  {
    id: 'starter-outcomes',
    title: 'Starter: Outcomes Trio',
    graph: g(
      {
        o1: { id: 'o1', type: 'Outcome', title: 'Delight users', view: { x: 80, y: 80, w: 160, h: 80 } },
        o2: { id: 'o2', type: 'Outcome', title: 'Grow revenue', view: { x: 320, y: 80, w: 160, h: 80 } },
        o3: { id: 'o3', type: 'Outcome', title: 'Reduce churn', view: { x: 200, y: 220, w: 160, h: 80 } },
      },
      {
        e1: { id: 'e1', from: 'o1', to: 'o2', kind: 'supports' },
        e2: { id: 'e2', from: 'o1', to: 'o3', kind: 'supports' },
      }
    ),
  },
  {
    id: 'decision-options',
    title: 'Decision with Options',
    graph: g(
      {
        d1: { id: 'd1', type: 'Decision', title: 'Pick analytics tool', view: { x: 160, y: 60, w: 180, h: 80 } },
        a1: { id: 'a1', type: 'Option', title: 'Tool A', view: { x: 40, y: 200, w: 160, h: 80 } },
        a2: { id: 'a2', type: 'Option', title: 'Tool B', view: { x: 200, y: 200, w: 160, h: 80 } },
        a3: { id: 'a3', type: 'Option', title: 'Tool C', view: { x: 360, y: 200, w: 160, h: 80 } },
      },
      {
        e1: { id: 'e1', from: 'a1', to: 'd1', kind: 'supports' },
        e2: { id: 'e2', from: 'a2', to: 'd1', kind: 'supports' },
        e3: { id: 'e3', from: 'a3', to: 'd1', kind: 'supports' },
      }
    ),
  },
  {
    id: 'kr-impact',
    title: 'KR Impacts Example',
    graph: g(
      {
        o1: { id: 'o1', type: 'Outcome', title: 'Improve NPS', krImpacts: [{ krId: 'kr', deltaP50: 0.2, confidence: 0.6 }], view: { x: 80, y: 100, w: 160, h: 80 } },
        ac1: { id: 'ac1', type: 'Action', title: 'Faster support', view: { x: 320, y: 100, w: 160, h: 80 } },
      },
      {
        e1: { id: 'e1', from: 'ac1', to: 'o1', kind: 'supports' },
      }
    ),
  },
]
