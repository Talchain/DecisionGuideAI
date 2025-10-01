import { describe, it, expect } from 'vitest'
import { bandEdgesByWeight } from '../summary'

describe('summary.banding', () => {
  it('bands edges deterministically by weight', () => {
    const edges = [
      { id: 'e1', from: 'n1', to: 'n2', weight: 0.05 }, // conservative
      { id: 'e2', from: 'n2', to: 'n3', weight: 0.20 }, // conservative (<=0.2)
      { id: 'e3', from: 'n3', to: 'n4', weight: 0.21 }, // likely (<=0.5)
      { id: 'e4', from: 'n4', to: 'n5', weight: 0.50 }, // likely
      { id: 'e5', from: 'n1', to: 'n5', weight: 0.75 }, // optimistic
    ] as any
    const bands = bandEdgesByWeight(edges)
    expect(bands).toEqual({ conservative: 2, likely: 2, optimistic: 1 })
  })
})
