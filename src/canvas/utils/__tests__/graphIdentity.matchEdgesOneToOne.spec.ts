/**
 * `matchEdgesOneToOne` (DET-HARM D225/D227): exact candidates are indexed by PAIR AND ID, so a repeated id on another
 * pair never hides a link's own same-pair counterpart (independent read of d23dd992: indexed by id alone, the first
 * `x` on P→Q hid `x` on U→V, the local link took `x` and canvas `x` fell back to `y`, taking its negative direction).
 * A repeated id within one pair is taken in wire order, and no wire link is ever matched twice.
 */
import { describe, expect, it } from 'vitest'
import { matchEdgesOneToOne } from '../graphIdentity'

const ids = (m: Map<{ id: string }, { id: string; effect_direction?: string }>) =>
  [...m].map(([c, w]) => [c.id, w.id, w.effect_direction ?? null])

describe('matchEdgesOneToOne', () => {
  it('the review sequence: a repeated id on another pair does not hide the same-pair exact counterpart', () => {
    const canvas = [
      { id: 'local', source: 'U', target: 'V' },
      { id: 'x', source: 'U', target: 'V' },
    ]
    const wire = [
      { id: 'x', from: 'P', to: 'Q' },
      { id: 'x', from: 'U', to: 'V', effect_direction: 'positive' },
      { id: 'y', from: 'U', to: 'V', effect_direction: 'negative' },
    ]
    // Canvas x is its own exact counterpart (positive); the local link takes what is left on the pair (y).
    expect(ids(matchEdgesOneToOne(canvas, wire)).sort()).toEqual([['local', 'y', 'negative'], ['x', 'x', 'positive']])
  })

  it('a repeated id within one pair is taken in wire order, and each wire link is matched once', () => {
    const canvas = [
      { id: 'x', source: 'U', target: 'V' },
      { id: 'e-0', source: 'U', target: 'V' },
      { id: 'e-1', source: 'U', target: 'V' },
    ]
    const first = { id: 'x', from: 'U', to: 'V', effect_direction: 'positive' }
    const again = { id: 'x', from: 'U', to: 'V', effect_direction: 'negative' }
    const m = matchEdgesOneToOne(canvas, [first, again])
    expect(m.get(canvas[0])).toBe(first)
    expect(m.get(canvas[1])).toBe(again)
    expect(m.has(canvas[2])).toBe(false)
    expect(new Set(m.values()).size).toBe(m.size)
  })
})
