// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { scoreGraph } from '@/domain/kr'
import type { Graph } from '@/domain/graph'

function g(nodes: any, edges: any): Graph {
  return { schemaVersion: 1, nodes, edges }
}

describe('kr.rollup', () => {
  it('computes own + propagated scores with attenuation', () => {
    const graph = g(
      {
        n1: { id: 'n1', type: 'Problem', title: 'P1', krImpacts: [{ krId: 'kr', deltaP50: 0.2, confidence: 0.5 }] }, // own 10
        n2: { id: 'n2', type: 'Action', title: 'A1' }, // own 0
        n3: { id: 'n3', type: 'Outcome', title: 'O1', krImpacts: [{ krId: 'kr', deltaP50: 0.3, confidence: 0.5 }] }, // own 15
      },
      {
        e1: { id: 'e1', from: 'n1', to: 'n3', kind: 'supports' }, // + n1*0.7 = +7 to n3
        e2: { id: 'e2', from: 'n2', to: 'n1', kind: 'mitigates' }, // 0
      }
    )
    const res = scoreGraph(graph)
    expect(Math.round(res.perNode.n1)).toBe(10)
    expect(Math.round(res.perNode.n3)).toBe(33)
    expect(Math.round(res.scenarioScore)).toBe(33)
  })

  it('remains bounded and stable with simple cycle', () => {
    const graph = g(
      {
        a: { id: 'a', type: 'Outcome', title: 'A', krImpacts: [{ krId: 'kr', deltaP50: 0.2, confidence: 0.5 }] }, // own 10
        b: { id: 'b', type: 'Problem', title: 'B', krImpacts: [{ krId: 'kr', deltaP50: 0.1, confidence: 1 }] }, // own 10
      },
      {
        e1: { id: 'e1', from: 'a', to: 'b', kind: 'supports' },
        e2: { id: 'e2', from: 'b', to: 'a', kind: 'supports' },
      }
    )
    const res = scoreGraph(graph)
    // Should be finite, plausible, and > own-only baseline
    expect(Number.isFinite(res.scenarioScore)).toBe(true)
    expect(res.scenarioScore).toBeGreaterThan(10)
    expect(res.scenarioScore).toBeLessThanOrEqual(100)
  })
})
