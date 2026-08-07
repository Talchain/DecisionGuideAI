import { describe, expect, it } from 'vitest'
import { resolveLabelCollisionOffsets, resolvePersistentLabelPlacements } from '../edgeLabelCollision'

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

describe('resolvePersistentLabelPlacements — C2 review: anchor basis + pre-resolution nudge', () => {
  const rect = (x: number, y: number, width = 200, height = 80) => ({ x, y, width, height })

  /** True when a 160×22 label box centred on (cx, cy) is clear of the rect. */
  const clearOf = (cx: number, cy: number, r: { x: number; y: number; width: number; height: number }) =>
    cx + 80 <= r.x || cx - 80 >= r.x + r.width || cy + 11 <= r.y || cy - 11 >= r.y + r.height

  // Finding 3 fixture: unequal-height endpoints.
  //  - source (−400, 0) 200×80 → bottom handle (−300, 80)
  //  - target (200, 200) 200×160 → top handle (300, 200)
  //  - handle-midpoint anchor (0, 140) — where the bezier label actually
  //    renders; the node-CENTRE midpoint (0, 160) diverges by
  //    (sourceHeight − targetHeight)/4 = −20.
  const source = rect(-400, 0)
  const target = rect(200, 200, 200, 160)

  it('anchors at the handle midpoint: a card over the render anchor is dodged clear', () => {
    const blocker = rect(-100, 65) // bottom edge 145 — hits the 140 box (129..151), misses the 160 box
    const out = resolvePersistentLabelPlacements(
      [{ id: 'e', sourceRect: source, targetRect: target }],
      [blocker],
    )
    const off = out.get('e')!
    expect(off.dx).toBe(0)
    expect(off.dy).toBeGreaterThanOrEqual(16) // label top (140 + dy − 11) must pass 145
    expect(clearOf(0 + off.dx, 140 + off.dy, blocker)).toBe(true)
  })

  it('a card over the node-centre midpoint (clear of the render anchor) is NOT dodged', () => {
    const phantom = rect(-100, 155) // hits the 160 box (149..171), misses the 140 box
    const out = resolvePersistentLabelPlacements(
      [{ id: 'e', sourceRect: source, targetRect: target }],
      [phantom],
    )
    expect(out.get('e')).toEqual({ dx: 0, dy: 0 })
  })

  it('finding 4: the proximity nudge is applied BEFORE resolution and still clears every card', () => {
    // n1 (0,0) 200×80 (centre (100,40)), n2 (0,40) 200×160 (top handle
    // (100,40)) → anchor (100,60), within 40px of n1's centre → nudge fires
    // perpendicular to the vertical handle direction: dx +20. The (nudged)
    // anchor sits inside both cards, so the resolver must stack it clear.
    const n1 = rect(0, 0)
    const n2 = rect(0, 40, 200, 160)
    const out = resolvePersistentLabelPlacements(
      [{ id: 'e', sourceRect: n1, targetRect: n2 }],
      [n1, n2],
    )
    const off = out.get('e')!
    expect(off.dx).toBe(20) // nudge survives in the total offset
    expect(off.dy).toBeGreaterThanOrEqual(151) // clears n2's bottom edge (200) from cy 60
    expect(clearOf(100 + off.dx, 60 + off.dy, n1)).toBe(true)
    expect(clearOf(100 + off.dx, 60 + off.dy, n2)).toBe(true)
  })

  // The discriminating finding-4 pin. The pins above happen to survive a
  // post-resolution nudge (their nudge is horizontal and their cards are wide
  // enough that ±20px never changes the intersection verdict), so they do not
  // actually distinguish the two orderings. This fixture does: the UN-nudged
  // anchor is clear of every card, so a post-resolution nudge resolves to
  // dy 0 and then slides the label sideways INTO a card — precisely the bug.
  //
  //  - source (90, 0) 20×10   → bottom handle (100, 10), centre (100, 5)
  //  - target (90, 60) 20×10  → top handle   (100, 60), centre (100, 65)
  //  - anchor (100, 35): within 40px of the source centre → nudge fires,
  //    perpendicular to the (vertical) handle direction → dx −20.
  //  - blocker (−100, 20) 110×30 spans x −100..10, y 20..50: the un-nudged
  //    label box (x 20..180) clears it by 10px; the nudged box (x 0..160)
  //    overlaps it.
  it('finding 4: a nudge that moves the label INTO a card is resolved, not applied after clearance', () => {
    const src = rect(90, 0, 20, 10)
    const tgt = rect(90, 60, 20, 10)
    const blocker = rect(-100, 20, 110, 30)
    const out = resolvePersistentLabelPlacements(
      [{ id: 'e', sourceRect: src, targetRect: tgt }],
      [src, tgt, blocker],
    )
    const off = out.get('e')!
    // The nudge itself is unchanged by the fix — it still fires and survives.
    expect(off.dx).toBe(-20)
    // Post-resolution ordering would leave dy 0 (the un-nudged anchor is
    // clear) and park the label at (80, 35) — inside the blocker.
    expect(off.dy).toBeGreaterThan(0)
    // The FINAL box (nudge + stack applied) clears every card.
    for (const r of [src, tgt, blocker]) {
      expect(clearOf(100 + off.dx, 35 + off.dy, r)).toBe(true)
    }
  })

  it('no nudge and no obstacles → zero total offset', () => {
    const out = resolvePersistentLabelPlacements(
      [{ id: 'e', sourceRect: rect(-400, -40), targetRect: rect(200, -40) }],
      [],
    )
    expect(out.get('e')).toEqual({ dx: 0, dy: 0 })
  })

  it('label-vs-label stacking still applies between persistent labels', () => {
    // Two edges with coincident anchors (0, 0): the deterministic winner
    // stays, the other stacks a step below.
    const a = { id: 'a', sourceRect: rect(-400, -40), targetRect: rect(200, -40) }
    const b = { id: 'b', sourceRect: rect(-400, -120, 200, 240), targetRect: rect(200, -120, 200, 240) }
    const out = resolvePersistentLabelPlacements([a, b], [])
    const dys = [out.get('a')!.dy, out.get('b')!.dy].sort((x, y) => x - y)
    expect(dys[0]).toBe(0)
    expect(dys[1]).toBeGreaterThanOrEqual(24)
  })

  it('deterministic: permuted edges and rects produce the identical assignment', () => {
    const edges = [
      { id: 'a', sourceRect: rect(-400, -40), targetRect: rect(200, -40) },
      { id: 'b', sourceRect: rect(-400, -20), targetRect: rect(200, -20) },
      { id: 'c', sourceRect: rect(-400, 300), targetRect: rect(200, 300) },
    ]
    const rects = [rect(-100, -40), rect(300, 300)]
    const forward = resolvePersistentLabelPlacements(edges, rects)
    const reversed = resolvePersistentLabelPlacements([...edges].reverse(), [...rects].reverse())
    for (const id of ['a', 'b', 'c']) {
      expect(forward.get(id)).toEqual(reversed.get(id))
    }
  })

  it('empty edge set → empty map', () => {
    expect(resolvePersistentLabelPlacements([], [rect(0, 0)]).size).toBe(0)
  })
})
