import { describe, expect, it } from 'vitest'
import { neighbourhoodNodeIds } from '../focusNeighbourhood'

const edges = [
  { source: 'a', target: 'g' },
  { source: 'b', target: 'g' },
  { source: 'c', target: 'a' },
  { source: 'd', target: 'e' },
]

describe('neighbourhoodNodeIds — F2 focus neighbourhood', () => {
  it('includes the node itself plus every directly connected node (either direction)', () => {
    // a → g (out), c → a (in) ⇒ {a, g, c}
    expect([...neighbourhoodNodeIds('a', edges)].sort()).toEqual(['a', 'c', 'g'])
  })

  it('collects neighbours across multiple incident edges', () => {
    // g receives a and b ⇒ {g, a, b}
    expect([...neighbourhoodNodeIds('g', edges)].sort()).toEqual(['a', 'b', 'g'])
  })

  it('returns just the node when it has no incident edges', () => {
    expect([...neighbourhoodNodeIds('lonely', edges)]).toEqual(['lonely'])
  })

  it('handles an empty graph', () => {
    expect([...neighbourhoodNodeIds('x', [])]).toEqual(['x'])
  })
})
