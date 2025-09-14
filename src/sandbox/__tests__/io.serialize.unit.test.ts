// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { normalizeGraph, serializeGraph, countEntities } from '@/sandbox/state/graphIO'

describe('graphIO serialize/normalize', () => {
  it('round-trips preserving counts', () => {
    const g = {
      schemaVersion: 1,
      nodes: {
        a: { id: 'a', type: 'Action', title: 'A', view: { x: 10, y: 10, w: 100, h: 50 } },
        o: { id: 'o', type: 'Outcome', title: 'O', view: { x: 220, y: 10, w: 120, h: 60 } },
      },
      edges: {
        e1: { id: 'e1', from: 'a', to: 'o', kind: 'supports' },
      },
    }
    const payload = serializeGraph('demo', g as any)
    const norm = normalizeGraph(payload.graph)
    const { nodeCount, edgeCount } = countEntities(norm)
    expect(nodeCount).toBe(2)
    expect(edgeCount).toBe(1)
  })
})
