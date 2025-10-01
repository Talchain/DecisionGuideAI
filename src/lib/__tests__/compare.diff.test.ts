import { describe, it, expect } from 'vitest'
import { diff } from '../../lib/compare'

describe('compare.diff', () => {
  it('deterministic added/removed/changed ordering', () => {
    const A = [
      { id: 'e1', val: 1 },
      { id: 'e2', val: 2 },
      { id: 'e3', val: 3 },
    ]
    const B = [
      { id: 'e1', val: 10 }, // changed
      { id: 'e3', val: 3 },  // same
      { id: 'e4', val: 4 },  // added
    ]
    const out = diff(A, B)
    expect(out.added).toEqual(['e4'])
    expect(out.removed).toEqual(['e2'])
    expect(out.changed).toEqual(['e1'])
  })
})
