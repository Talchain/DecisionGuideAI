import { describe, expect, it } from 'vitest'
import {
  resolveLabelCollisionOffsets,
  resolvePersistentLabelPlacements,
  labelHalfHeightForRows,
  LABEL_HALF_HEIGHT,
} from '../edgeLabelCollision'

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

  // ⚠ REPHRASED 31 Aug 2026, and the rephrasing is the point. This asserted
  // `0, +step, +2×step` — the DIRECTION the old downward-only loop happened to
  // take, not the property the resolver owes. The property is: every pair ends
  // at least Y_THRESHOLD apart, by the smallest displacement that achieves it.
  // The search is now bidirectional, so three coincident labels resolve to
  // {0, +step, −step} — one step of travel each instead of two for the last.
  it('three coincident labels separate by the SMALLEST displacements (0, ±step)', () => {
    const out = resolveLabelCollisionOffsets([
      { id: 'c', x: 0, y: 0 },
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 0, y: 0 },
    ])
    const dys = ['a', 'b', 'c'].map((id) => out.get(id)!.dy).sort((x, y) => x - y)
    // The property: pairwise separation clears the label box on y…
    for (let i = 0; i < dys.length; i++) {
      for (let j = i + 1; j < dys.length; j++) {
        expect(Math.abs(dys[i] - dys[j])).toBeGreaterThanOrEqual(34)
      }
    }
    // …at one STEP of travel each, never two. Written as literals, not as
    // `STEP`, so the constant and its pin cannot agree with each other.
    expect(dys).toEqual([-36, 0, 36])
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
      { id: 'b', x: 0, y: 40 }, // 40 > Y_THRESHOLD 36
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
  // A standard node card ~200×80. The rendered label box is 160×34 (see the
  // module doc comment), i.e. half-extents 80×17 around the anchor point.
  // CARD is centred on the origin: x spans −100..100, y spans −40..40.
  const CARD = { x: -100, y: -40, width: 200, height: 80 }

  it('a label whose box overlaps a node card is displaced clear of it (dx stays 0)', () => {
    const out = resolveLabelCollisionOffsets([{ id: 'a', x: 0, y: 0 }], [CARD])
    const off = out.get('a')!
    expect(off.dx).toBe(0)
    // Clear below the card: label top edge (anchor + dy − 17) must reach the
    // card's bottom edge (y = 40), i.e. dy ≥ 57.
    expect(off.dy).toBeGreaterThanOrEqual(57)
  })

  it('labels clear of every node card are unmoved', () => {
    const out = resolveLabelCollisionOffsets(
      [
        { id: 'far', x: 400, y: 300 },
        { id: 'below', x: 0, y: 60 }, // label top edge 43 > card bottom 40
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
    expect(a.dy).toBeGreaterThanOrEqual(57)
    // …and the FINAL positions are label-vs-label clear (Y_THRESHOLD 36 at same x)
    expect(Math.abs(a.dy - (55 + b.dy))).toBeGreaterThanOrEqual(36)
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
    // Pinned fixture: the crossing pair from the E3 suite is displaced by
    // exactly one STEP. The number moved 26 → 36 on 31 Aug 2026 when STEP was
    // derived from the (corrected) label-box height; what this case pins is
    // that OMITTING nodeRects and passing [] are the same call, which is
    // independent of the number.
    const pts = [
      { id: 'lower', x: 10, y: 8 },
      { id: 'upper', x: 0, y: 0 },
    ]
    const omitted = resolveLabelCollisionOffsets(pts)
    const explicitEmpty = resolveLabelCollisionOffsets(pts, [])
    for (const out of [omitted, explicitEmpty]) {
      expect(out.get('upper')).toEqual({ dx: 0, dy: 0 })
      expect(out.get('lower')).toEqual({ dx: 0, dy: 36 })
    }
  })

  it('guard still bounds stacking when a label cannot clear a pathological rect', () => {
    // A 1000px-tall card cannot be cleared within the displacement budget (260)
    const out = resolveLabelCollisionOffsets(
      [{ id: 'trapped', x: 0, y: 0 }],
      [{ x: -100, y: -500, width: 200, height: 1000 }],
    )
    expect(out.get('trapped')!.dy).toBeLessThanOrEqual(26 * 10)
  })
})

/**
 * 31 Aug 2026 — the three defects behind the founder's report, each pinned by
 * a case that REDs on the pristine resolver. Measured first in real Chromium
 * (`e2e/geometry/edgeLabelOverlap.measure.ts`); these are the unit pins for
 * the arithmetic underneath, not evidence about the rendered page — jsdom
 * cannot see geometry (CLAUDE.md trap 3) and this file mounts nothing.
 */
describe('resolveLabelCollisionOffsets — 31 Aug 2026 label-overlap defects', () => {
  it('separates two labels whose 160px boxes overlap on x (the reported overlap)', () => {
    // The measured case: two edges converging on the goal node, anchors 144px
    // apart. 144 < 160, so the boxes overlap by 16px — but the old x
    // threshold was 90, so the pair scored CLEAR and both painted at their
    // anchors, one over the other's ellipsis.
    const out = resolveLabelCollisionOffsets([
      { id: 'left', x: 0, y: 0 },
      { id: 'right', x: 144, y: 0 },
    ])
    const separation = Math.abs(out.get('left')!.dy - out.get('right')!.dy)
    expect(separation).toBeGreaterThanOrEqual(22) // clears the box on y
  })

  it('CONTRAST CONTROL: two labels further apart than the box width are NOT displaced', () => {
    // The discriminating twin of the case above. Without it, "separate more
    // eagerly" passes by displacing everything, and a threshold of any size
    // would look correct. 170 > 160 → the boxes genuinely do not meet.
    const out = resolveLabelCollisionOffsets([
      { id: 'left', x: 0, y: 0 },
      { id: 'right', x: 170, y: 0 },
    ])
    expect(out.get('left')).toEqual({ dx: 0, dy: 0 })
    expect(out.get('right')).toEqual({ dx: 0, dy: 0 })
  })

  it('takes the NEARER clear side of a blocking card, not always downward', () => {
    // Card spans y 0..200 with the anchor at 30, near its top edge.
    //   upward   : 30 + dy + 17 ≤ 0   → dy ≤ −47  → −72 (2 steps of 36)
    //   downward : 30 + dy − 17 ≥ 200 → dy ≥ 187 → +216 (6 steps of 36)
    // The old downward-only loop walked the full height of the card and left
    // the label 182px from its own edge, with a leader line that runs beneath
    // the node layer and is therefore invisible for most of its length.
    const out = resolveLabelCollisionOffsets(
      [{ id: 'a', x: 0, y: 30 }],
      [{ x: -100, y: 0, width: 200, height: 200 }],
    )
    expect(out.get('a')!.dy).toBe(-72)
  })

  it('an unplaceable label stays at its anchor, NOT at the guard ceiling', () => {
    // No slot inside the displacement budget clears a 1000px-tall card. The
    // old loop exited
    // its guard still holding the last value it had stepped to — the MAXIMUM
    // displacement AND still colliding: measured at 260px on `build-vs-buy`,
    // which put the label off the bottom of the viewport, joined to its edge
    // by an unpainted hairline. That is the "detached, no visible edge"
    // symptom. Staying put is recoverable; being stranded is not.
    const out = resolveLabelCollisionOffsets(
      [{ id: 'trapped', x: 0, y: 0 }],
      [{ x: -100, y: -500, width: 200, height: 1000 }],
    )
    expect(out.get('trapped')!.dy).toBe(0)
  })

  it('when no slot is clean, prefers overlapping a LABEL to hiding under a CARD', () => {
    // Nodes paint above the edge-label renderer, so a label under a card is
    // gone; a label over a label is merely crowded. Both are still on screen.
    //
    // Cards A (spans y −1000..1) and B (spans y 75..1075) leave exactly one
    // clear window for a label centre: 18 ≤ cy ≤ 58.
    //   b (0,−32) resolves first (lower y) and reaches the window at dy +72,
    //     i.e. cy 40.
    //   a (0, 0) then finds:
    //     dy   0 → cy  0 — under card A; b is 40 away, outside the threshold.
    //     dy +36 → cy 36 — clear of both cards, but 4px from b.
    //     everything else is under a card (and +72 is under B *and* near b).
    // So the only choice is "under a card" versus "beside another label".
    // Weighted, +36 wins. Unweighted the two score equally, dy 0 is reached
    // first, and the label disappears under card A.
    const cards = [
      { x: -100, y: -1000, width: 200, height: 1001 },
      { x: -100, y: 75, width: 200, height: 1000 },
    ]
    const out = resolveLabelCollisionOffsets(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 0, y: -32 },
      ],
      cards,
    )
    expect(out.get('b')!.dy).toBe(72) // the clean window
    expect(out.get('a')!.dy).toBe(36) // crowded, but visible
  })
})

describe('resolvePersistentLabelPlacements — C2 review: anchor basis + pre-resolution nudge', () => {
  const rect = (x: number, y: number, width = 200, height = 80) => ({ x, y, width, height })

  // True when the label box centred on (cx, cy) is clear of the rect. The
  // half-extents are written as INDEPENDENT literals, never imported from the
  // module under test — a helper that reads the same constants as the code
  // agrees with the code by construction and can never contradict it.
  // 160 × 34: the width cap, and the height at the maximum counter-scale
  // (measured 33.0 in Chromium; the module rounds its half-extent up to 17).
  const clearOf = (cx: number, cy: number, r: { x: number; y: number; width: number; height: number }) =>
    cx + 80 <= r.x || cx - 80 >= r.x + r.width || cy + 17 <= r.y || cy - 17 >= r.y + r.height

  // Finding 3 fixture: unequal-height endpoints.
  //  - source (−400, 0) 200×80 → bottom handle (−300, 80)
  //  - target (200, 200) 200×160 → top handle (300, 200)
  //  - handle-midpoint anchor (0, 140) — where the bezier label actually
  //    renders; the node-CENTRE midpoint (0, 160) diverges by
  //    (sourceHeight − targetHeight)/4 = −20.
  //
  // ⚠ The two blocker fixtures below were RE-SITED on 31 Aug 2026. They were
  // placed to sit in the 20px gap between the two candidate anchors using a
  // ±11 label box; the box is really ±17, so the old sites overlapped BOTH
  // anchors and the pair stopped discriminating anything. The property is
  // unchanged — a card over the render anchor is dodged, one over the phantom
  // anchor is not — and it is the fixture's job to keep that observable.
  const source = rect(-400, 0)
  const target = rect(200, 200, 200, 160)

  it('anchors at the handle midpoint: a card over the render anchor is dodged clear', () => {
    const blocker = rect(-100, 60) // bottom edge 140 — hits the 140 box (123..157), misses the 160 box (143..177)
    const out = resolvePersistentLabelPlacements(
      [{ id: 'e', sourceRect: source, targetRect: target }],
      [blocker],
    )
    const off = out.get('e')!
    expect(off.dx).toBe(0)
    expect(off.dy).toBeGreaterThanOrEqual(17) // label top (140 + dy − 17) must pass 140
    expect(clearOf(0 + off.dx, 140 + off.dy, blocker)).toBe(true)
  })

  it('a card over the node-centre midpoint (clear of the render anchor) is NOT dodged', () => {
    const phantom = rect(-100, 160) // hits the 160 box (143..177), misses the 140 box (123..157)
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
    // anchor sits inside both cards, so the resolver must displace it clear.
    //
    // ⚠ REPHRASED 31 Aug 2026 with the bidirectional search. This pinned
    // `dy >= 151` — downward past n2's bottom edge — which was never the
    // property, only the direction the old loop could travel. Clearing UPWARD
    // past n1's top edge costs 78px against 156px, so the resolver now takes
    // it. The clearance assertions below are the property and are unchanged;
    // the magnitude assertion is now direction-agnostic and BOUNDED, so it
    // still bites (a resolver that stopped displacing at all would RED on
    // `clearOf`, and one that travelled the long way round REDs on the bound).
    const n1 = rect(0, 0)
    const n2 = rect(0, 40, 200, 160)
    const out = resolvePersistentLabelPlacements(
      [{ id: 'e', sourceRect: n1, targetRect: n2 }],
      [n1, n2],
    )
    const off = out.get('e')!
    expect(off.dx).toBe(20) // nudge survives in the total offset
    expect(clearOf(100 + off.dx, 60 + off.dy, n1)).toBe(true)
    expect(clearOf(100 + off.dx, 60 + off.dy, n2)).toBe(true)
    // Clearing n1's top edge (0) from cy 60 needs |dy| ≥ 77 upward; clearing
    // n2's bottom edge (200) needs ≥ 157 downward. Nearest wins.
    expect(Math.abs(off.dy)).toBeGreaterThanOrEqual(77)
    expect(Math.abs(off.dy)).toBeLessThan(157)
    expect(off.dy).toBeLessThan(0) // the nearer side is up, from this anchor
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

/**
 * TWO-ROW LABELS (one chip per edge).
 *
 * The fragility badge used to render as a free-floating sibling at a
 * hard-coded `labelX + 30` — outside this resolver entirely, which is why the
 * founder saw "Sensitive · 49%" floating with no visible referent. It is now a
 * ROW inside the placed chip, so a chip carrying both a strength row and a
 * fragile row is TALLER and the resolver has to know that.
 *
 * ⛔ WHAT DELIBERATELY DOES NOT MOVE: `STEP`. Every displacement literal in
 * the suite above (±36, ±72, 216) is pinned against a one-row step, and those
 * pins are the record of the 31 Aug re-derivation. Only the PAIR TEST and the
 * CARD TEST consult per-label half-heights; the search grid is unchanged, so a
 * two-row label simply takes two steps where one would not clear.
 */
describe('two-row labels — the pair test uses BOTH half-heights', () => {
  it('LABEL_HALF_HEIGHT is the one-row half-extent and stays the exported default', () => {
    expect(labelHalfHeightForRows(1)).toBe(LABEL_HALF_HEIGHT)
  })

  it('a two-row label is taller than a one-row label', () => {
    expect(labelHalfHeightForRows(2)).toBeGreaterThan(labelHalfHeightForRows(1))
  })

  it('an undefined row count is treated as one row — every existing caller is unchanged', () => {
    expect(labelHalfHeightForRows(undefined)).toBe(labelHalfHeightForRows(1))
  })

  it('CONTROL: two ONE-ROW labels 36 apart still clear — the pinned threshold is untouched', () => {
    const out = resolveLabelCollisionOffsets([
      { id: 'upper', x: 0, y: 0, rows: 1 },
      { id: 'lower', x: 0, y: 36 , rows: 1 },
    ])
    expect(out.get('upper')).toEqual({ dx: 0, dy: 0 })
    expect(out.get('lower')).toEqual({ dx: 0, dy: 0 })
  })

  it('THE POINT: the same 36 gap does NOT clear once the upper label carries two rows', () => {
    const out = resolveLabelCollisionOffsets([
      { id: 'upper', x: 0, y: 0, rows: 2 },
      { id: 'lower', x: 0, y: 36, rows: 1 },
    ])
    expect(out.get('upper')).toEqual({ dx: 0, dy: 0 })
    // The taller box overlaps the one below, so the lower label must move.
    expect(out.get('lower')!.dy).not.toBe(0)
    // …and it must end up genuinely clear of the two-row box.
    const gap = Math.abs(36 + out.get('lower')!.dy - 0)
    expect(gap).toBeGreaterThanOrEqual(labelHalfHeightForRows(2) + labelHalfHeightForRows(1))
  })

  it('a two-row label clears a node card by its OWN half-height, not the one-row one', () => {
    // Card spans y 0..40 at x 0..200; anchor sits just below it. A one-row box
    // clears where a two-row box still overlaps.
    const card = { x: 0, y: 0, width: 200, height: 40 }
    const oneRow = resolveLabelCollisionOffsets(
      [{ id: 'a', x: 100, y: 40 + labelHalfHeightForRows(1), rows: 1 }],
      [card],
    )
    expect(oneRow.get('a')).toEqual({ dx: 0, dy: 0 })
    const twoRow = resolveLabelCollisionOffsets(
      [{ id: 'a', x: 100, y: 40 + labelHalfHeightForRows(1), rows: 2 }],
      [card],
    )
    expect(twoRow.get('a')!.dy).not.toBe(0)
  })

  it('resolvePersistentLabelPlacements carries a row count through to the resolver', () => {
    const src = { x: 0, y: 0, width: 100, height: 40 }
    const tgt = { x: 0, y: 300, width: 100, height: 40 }
    // Two edges with an identical anchor: they must separate, and the
    // separation must respect the two-row box.
    const out = resolvePersistentLabelPlacements([
      { id: 'a', sourceRect: src, targetRect: tgt, rows: 2 },
      { id: 'b', sourceRect: src, targetRect: tgt, rows: 1 },
    ])
    expect(out.size).toBe(2)
    const separation = Math.abs(out.get('a')!.dy - out.get('b')!.dy)
    expect(separation).toBeGreaterThanOrEqual(
      labelHalfHeightForRows(2) + labelHalfHeightForRows(1),
    )
  })

  it('is deterministic under input reordering with mixed row counts', () => {
    const pts = [
      { id: 'a', x: 0, y: 0, rows: 2 as const },
      { id: 'b', x: 0, y: 20, rows: 1 as const },
      { id: 'c', x: 0, y: 40, rows: 2 as const },
    ]
    const forward = resolveLabelCollisionOffsets(pts)
    const reversed = resolveLabelCollisionOffsets([...pts].reverse())
    for (const id of ['a', 'b', 'c']) {
      expect(forward.get(id)).toEqual(reversed.get(id))
    }
  })
})
