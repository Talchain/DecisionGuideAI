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

describe('resolveLabelCollisionOffsets — E3 part 2: node cards as fixed obstacles', () => {
  // A standard node card ~200×80. The rendered label box is 160×22 (see the
  // module doc comment), i.e. half-extents 80×11 around the anchor point.
  // CARD is centred on the origin: x spans −100..100, y spans −40..40.
  const CARD = { x: -100, y: -40, width: 200, height: 80 }

  it('a label whose box overlaps a node card is displaced clear of it (dx stays 0)', () => {
    const out = resolveLabelCollisionOffsets([{ id: 'a', x: 0, y: 0 }], [CARD])
    const off = out.get('a')!
    expect(off.dx).toBe(0)
    // Clear below the card: label top edge (anchor + dy − 11) must reach the
    // card's bottom edge (y = 40), i.e. dy ≥ 51.
    expect(off.dy).toBeGreaterThanOrEqual(51)
  })

  it('labels clear of every node card are unmoved', () => {
    const out = resolveLabelCollisionOffsets(
      [
        { id: 'far', x: 400, y: 300 },
        { id: 'below', x: 0, y: 60 }, // label top edge 49 > card bottom 40
        { id: 'beside', x: 200, y: 0 }, // label left edge 120 > card right 100
      ],
      [CARD],
    )
    expect(out.get('far')).toEqual({ dx: 0, dy: 0 })
    expect(out.get('below')).toEqual({ dx: 0, dy: 0 })
    expect(out.get('beside')).toEqual({ dx: 0, dy: 0 })
  })

  it('compound: a card-displaced label must not land on another label', () => {
    const out = resolveLabelCollisionOffsets(
      [
        { id: 'a', x: 0, y: 0 }, // inside the card → must stack below it
        { id: 'b', x: 0, y: 55 }, // already clear of the card, sits where a lands
      ],
      [CARD],
    )
    const a = out.get('a')!
    const b = out.get('b')!
    // a cleared the card…
    expect(a.dy).toBeGreaterThanOrEqual(51)
    // …and the FINAL positions are label-vs-label clear (Y_THRESHOLD 24 at same x)
    expect(Math.abs(a.dy - (55 + b.dy))).toBeGreaterThanOrEqual(24)
    // b had to move — the pass accounts for card-displaced labels when placing later ones
    expect(b.dy).toBeGreaterThan(0)
  })

  it('deterministic with node rects: same input in any order → same assignment', () => {
    const pts = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 0, y: 55 },
      { id: 'c', x: 40, y: -10 },
    ]
    const rects = [CARD, { x: 300, y: 300, width: 200, height: 80 }]
    const forward = resolveLabelCollisionOffsets(pts, rects)
    const reversed = resolveLabelCollisionOffsets([...pts].reverse(), [...rects].reverse())
    for (const id of ['a', 'b', 'c']) {
      expect(forward.get(id)).toEqual(reversed.get(id))
    }
  })

  it('empty nodeRects (or omitted) is byte-identical to the pre-E3-part-2 behaviour', () => {
    // Pinned fixture: the crossing pair from the E3 suite stacks exactly 26px.
    const pts = [
      { id: 'lower', x: 10, y: 8 },
      { id: 'upper', x: 0, y: 0 },
    ]
    const omitted = resolveLabelCollisionOffsets(pts)
    const explicitEmpty = resolveLabelCollisionOffsets(pts, [])
    for (const out of [omitted, explicitEmpty]) {
      expect(out.get('upper')).toEqual({ dx: 0, dy: 0 })
      expect(out.get('lower')).toEqual({ dx: 0, dy: 26 })
    }
  })

  it('guard still bounds stacking when a label cannot clear a pathological rect', () => {
    // A 1000px-tall card cannot be cleared within MAX_STACK (10 × 26 = 260)
    const out = resolveLabelCollisionOffsets(
      [{ id: 'trapped', x: 0, y: 0 }],
      [{ x: -100, y: -500, width: 200, height: 1000 }],
    )
    expect(out.get('trapped')!.dy).toBeLessThanOrEqual(26 * 10)
  })
})
