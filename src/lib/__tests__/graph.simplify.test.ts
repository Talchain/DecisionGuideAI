import { describe, it, expect } from 'vitest'
import { simplifyEdges, srSummary } from '../../lib/graph.simplify'

describe('graph.simplify', () => {
  it('simplifyEdges filters below threshold', () => {
    const edges = [
      { id: 'a', weight: 0.1 },
      { id: 'b', weight: 0.2 },
      { id: 'c', weight: 0.35 },
    ]
    const on = true
    const filtered = simplifyEdges(edges, on, 0.2)
    expect(filtered.map((e) => e.id)).toEqual(['b', 'c'])
  })

  it('srSummary formats counts and threshold', () => {
    expect(srSummary(6, 0.3)).toBe('Simplify on. 6 links hidden (threshold 0.3).')
  })
})
