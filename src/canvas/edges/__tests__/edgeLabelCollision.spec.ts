import { describe, expect, it } from 'vitest'
import { resolveLabelCollisionOffsets } from '../edgeLabelCollision'

describe('resolveLabelCollisionOffsets — E3 label collision avoidance', () => {
  it('far-apart labels get no offset', () => {
    const out = resolveLabelCollisionOffsets([
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 400, y: 300 },
    ])
    expect(out.get('a')).toEqual({ dx: 0, dy: 0 })
    expect(out.get('b')).toEqual({ dx: 0, dy: 0 })
  })

  it('two labels at a crossing: the topmost stays, the second stacks below', () => {
    const out = resolveLabelCollisionOffsets([
      { id: 'lower', x: 10, y: 8 },
      { id: 'upper', x: 0, y: 0 },
    ])
    expect(out.get('upper')).toEqual({ dx: 0, dy: 0 })
    expect(out.get('lower')!.dy).toBeGreaterThanOrEqual(16) // pushed clear
  })

  it('three coincident labels stack deterministically (0, step, 2×step spacing)', () => {
    const out = resolveLabelCollisionOffsets([
      { id: 'c', x: 0, y: 0 },
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 0, y: 0 },
    ])
    const dys = ['a', 'b', 'c'].map((id) => out.get(id)!.dy).sort((x, y) => x - y)
    expect(dys[0]).toBe(0)
    expect(dys[1]).toBeGreaterThan(0)
    expect(dys[2]).toBeGreaterThan(dys[1])
  })

  it('is deterministic regardless of input order (every edge computes the same assignment)', () => {
    const pts = [
      { id: 'a', x: 5, y: 2 },
      { id: 'b', x: 0, y: 0 },
      { id: 'c', x: 60, y: 10 },
    ]
    const forward = resolveLabelCollisionOffsets(pts)
    const reversed = resolveLabelCollisionOffsets([...pts].reverse())
    for (const id of ['a', 'b', 'c']) {
      expect(forward.get(id)).toEqual(reversed.get(id))
    }
  })

  it('vertical near-misses outside the y-threshold do not offset', () => {
    const out = resolveLabelCollisionOffsets([
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 0, y: 40 }, // 40 > Y_THRESHOLD 24
    ])
    expect(out.get('b')).toEqual({ dx: 0, dy: 0 })
  })

  it('bounded stacking on pathological coincident input (never unbounded)', () => {
    const pts = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, x: 0, y: 0 }))
    const out = resolveLabelCollisionOffsets(pts)
    for (const { id } of pts) {
      expect(out.get(id)!.dy).toBeLessThanOrEqual(26 * 10)
    }
  })
})
