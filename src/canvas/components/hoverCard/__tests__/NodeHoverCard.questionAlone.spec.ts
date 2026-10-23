/**
 * Vision spec §3 / §2: never "Decision:" as a UI label. The question card's hover card (seen on staging: "Decision: I
 * want at least 480 customers…") names the question alone, as the card does; Another kind's label is never touched.
 */
import { describe, expect, it } from 'vitest'
import { nodeHoverFacts } from '../NodeHoverCard'

const NODES = [
  { id: 'dec', type: 'decision', data: { label: 'Decision: I want at least 480 customers' } },
  { id: 'opt', type: 'option', data: { label: 'Start a loyalty card' } },
  { id: 'fac', type: 'factor', data: { label: 'Decision: who signs off' } },
]
const EDGES = [{ source: 'dec', target: 'opt' }, { source: 'fac', target: 'opt' }]

describe('the question card is named by its question alone', () => {
  it('its own hover card title has no "Decision:" prefix', () => {
    const facts = nodeHoverFacts('dec', 'decision', NODES[0].data, NODES, EDGES)
    expect(facts.title).toBe('I want at least 480 customers')
  })
  it('CONTRAST: another kind keeps its own words, even one that starts "Decision:"', () => {
    const own = nodeHoverFacts('fac', 'factor', NODES[2].data, NODES, EDGES)
    expect(own.title).toBe('Decision: who signs off')
  })
})
