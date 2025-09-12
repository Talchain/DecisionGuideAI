// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { diffGraphs } from '@/domain/graphDiff'
import type { Graph } from '@/domain/graph'

function g(nodes: any, edges: any): Graph {
  return { schemaVersion: 1, nodes, edges }
}

describe('graphDiff', () => {
  it('detects added/removed/changed nodes and edges (ignore view)', () => {
    const A = g({
      A: { id: 'A', type: 'Problem', title: 'A', krImpacts: [{ krId: 'kr1', deltaP50: 0.1, confidence: 0.5 }] },
      B: { id: 'B', type: 'Option', title: 'B' },
    }, {
      E1: { id: 'E1', from: 'A', to: 'B', kind: 'supports' }
    })

    const B = g({
      A: { id: 'A', type: 'Problem', title: 'A changed', krImpacts: [{ krId: 'kr1', deltaP50: 0.2, confidence: 0.5 }] },
      C: { id: 'C', type: 'Outcome', title: 'C' },
    }, {
      E1: { id: 'E1', from: 'A', to: 'C', kind: 'causes' },
      E2: { id: 'E2', from: 'A', to: 'C', kind: 'supports' },
    })

    const d = diffGraphs(A, B)

    expect(new Set(d.nodes.added)).toEqual(new Set(['C']))
    expect(new Set(d.nodes.removed)).toEqual(new Set(['B']))
    expect(new Set(d.nodes.changed)).toEqual(new Set(['A']))

    expect(new Set(d.edges.added)).toEqual(new Set(['E2']))
    expect(new Set(d.edges.removed)).toEqual(new Set([]))
    expect(new Set(d.edges.changed)).toEqual(new Set(['E1']))
  })
})
