import { describe, it, expect, beforeEach } from 'vitest'
import { list, save, get, type Snapshot } from '../../lib/snapshots'

const KEY = 'snapshots.v1'

describe('snapshots.store', () => {
  beforeEach(() => {
    try { localStorage.removeItem(KEY) } catch {}
  })

  it('save/list/get round-trip and immutability', () => {
    const s: Snapshot = { id: 's1', at: new Date(0).toISOString(), seed: 'abc', model: 'local-sim', data: { edges: [{ id: 'e1' }] } }
    save(s)
    const xs1 = list()
    expect(xs1.length).toBe(1)
    expect(xs1[0].id).toBe('s1')
    // Returned object should not be same ref as input
    expect(xs1[0]).not.toBe(s)

    // Mutating returned list should not affect storage
    xs1.push({ id: 's2', at: new Date(1).toISOString(), seed: 'x', model: 'm', data: {} })
    const xs2 = list()
    expect(xs2.length).toBe(1)

    // get retrieves by id
    const g = get('s1')!
    expect(g.id).toBe('s1')
  })
})
