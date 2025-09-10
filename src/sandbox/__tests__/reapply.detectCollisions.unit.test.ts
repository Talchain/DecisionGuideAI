// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { detectCollisions, type Op } from '@/sandbox/state/reapply'

describe('reapply.detectCollisions (pure)', () => {
  it('detects cross-client collisions and returns winner/prev/next', () => {
    const ops: Op[] = [
      { id: 'n1', field: 'label', value: 'A', clientId: 'c1' },
      { id: 'n1', field: 'label', value: 'B', clientId: 'c2' },
      { id: 'n1', field: 'label', value: 'C', clientId: 'c1' },
      { id: 'n2', field: 'x', value: 10, clientId: 'c1' },
      { id: 'n2', field: 'x', value: 12, clientId: 'c1' }, // same client only → no collision
    ]
    const res = detectCollisions(ops)
    // Only n1:label should collide (multi-client)
    expect(res.length).toBe(1)
    const c = res[0]
    expect(c.nodeId).toBe('n1')
    expect(c.field).toBe('label')
    expect(c.prev).toBe('B') // second last
    expect(c.next).toBe('C') // last
    expect(c.winnerClientId).toBe('c1')
  })

  it('returns empty when no multi-client overlaps for a field', () => {
    const ops: Op[] = [
      { id: 'n1', field: 'label', value: 'A', clientId: 'c1' },
      { id: 'n1', field: 'label', value: 'B', clientId: 'c1' },
      { id: 'n1', field: 'x', value: 1, clientId: 'c1' },
      { id: 'n1', field: 'x', value: 2, clientId: 'c1' },
    ]
    expect(detectCollisions(ops)).toEqual([])
  })
})
