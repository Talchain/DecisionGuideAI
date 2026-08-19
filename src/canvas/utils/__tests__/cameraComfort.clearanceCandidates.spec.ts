/**
 * `clearanceCandidates` — the four ways to hold a frame clear of the floating
 * companion, and the proof that `cheapestClearance` is still exactly `min` over
 * them.
 *
 * WHY THIS SPEC EXISTS (19 Aug 2026). The fit-then-place placement rule
 * (`FloatingOlumiPanel.graphAwareDefaultPosition`) needs all four clearances,
 * not just the cheapest: after `clampPositionToViewport` the cheapest move is
 * frequently unreachable and a dearer one is not. The obvious way to give it
 * four amounts is to write the four expressions again next to the placement
 * code — which is the hand-maintained mirror this estate keeps paying for
 * (CLAUDE.md trap 12). So `cheapestClearance` was REFACTORED to fold over this
 * list rather than build its own, and the two can no longer disagree.
 *
 * ⭐ THE LOAD-BEARING TEST IS THE DERIVED-AGREEMENT ONE, and it is deliberately
 * NOT a hand-written table of expected minima: it asserts, over an enumerated
 * grid of overlapping boxes, that `cheapestClearance` returns the smallest
 * member of `clearanceCandidates` FOR THE SAME INPUTS. A table would only prove
 * the cases I thought of; this proves the fold. The hand-written cases below
 * are the completeness half that derivation cannot supply (trap 12d): they pin
 * the ORDER and the four EXPRESSIONS, which a derived agreement test is
 * structurally blind to.
 */

import { describe, it, expect } from 'vitest'
import { cheapestClearance, clearanceCandidates, type Box } from '../cameraComfort'

const box = (left: number, top: number, right: number, bottom: number): Box => ({ left, top, right, bottom })

describe('clearanceCandidates', () => {
  it('returns null when the occluder does not overlap the frame at all', () => {
    const frame = box(0, 0, 100, 100)
    expect(clearanceCandidates(frame, box(200, 0, 300, 100)), 'clear to the right').toBeNull()
    expect(clearanceCandidates(frame, box(0, 200, 100, 300)), 'clear below').toBeNull()
    // Touching edges are not an overlap: the predicate is strict on both axes.
    expect(clearanceCandidates(frame, box(100, 0, 200, 100)), 'edge-to-edge').toBeNull()
  })

  it('returns exactly four clearances, in the documented order, with the documented amounts', () => {
    // frame 0,0 → 100,100 ; occluder 60,70 → 200,300 (overlaps the bottom-right)
    const frame = box(0, 0, 100, 100)
    const occ = box(60, 70, 200, 300)
    expect(clearanceCandidates(frame, occ)).toEqual([
      { side: 'right', amount: 40 }, //  frame.right(100) - occ.left(60)
      { side: 'left', amount: 200 }, //  occ.right(200)   - frame.left(0)
      { side: 'bottom', amount: 30 }, // frame.bottom(100)- occ.top(70)
      { side: 'top', amount: 300 }, //   occ.bottom(300)  - frame.top(0)
    ])
  })

  it('makes every amount strictly positive whenever there is an overlap', () => {
    // Overlap on an axis makes BOTH of that axis's expressions positive, so a
    // consumer may translate by any of the four and know it moved.
    for (let ox = -80; ox <= 80; ox += 20) {
      for (let oy = -80; oy <= 80; oy += 20) {
        const candidates = clearanceCandidates(box(0, 0, 100, 100), box(ox, oy, ox + 100, oy + 100))
        if (!candidates) continue
        for (const c of candidates) expect(c.amount, `${c.side} at (${ox},${oy})`).toBeGreaterThan(0)
      }
    }
  })
})

describe('cheapestClearance is derived from clearanceCandidates, not mirrored', () => {
  it('returns the smallest candidate for the same inputs, across an enumerated grid', () => {
    const frame = box(0, 0, 100, 100)
    let overlapping = 0
    for (let ox = -140; ox <= 140; ox += 7) {
      for (let oy = -140; oy <= 140; oy += 11) {
        for (const [w, h] of [
          [50, 50],
          [100, 30],
          [30, 100],
          [220, 220],
        ]) {
          const occ = box(ox, oy, ox + w, oy + h)
          const candidates = clearanceCandidates(frame, occ)
          const cheapest = cheapestClearance(frame, occ)
          if (!candidates) {
            expect(cheapest, `no overlap at (${ox},${oy},${w}x${h})`).toBeNull()
            continue
          }
          overlapping++
          const min = Math.min(...candidates.map((c) => c.amount))
          expect(cheapest, `overlap at (${ox},${oy},${w}x${h})`).not.toBeNull()
          expect(cheapest!.amount, `amount at (${ox},${oy},${w}x${h})`).toBe(Math.max(0, min))
          expect(
            candidates.find((c) => c.side === cheapest!.side)!.amount,
            `side ${cheapest!.side} must BE the minimum, not merely tie the number`,
          ).toBe(min)
        }
      }
    }
    // POSITIVE CONTROL on the enumeration itself: a grid that produced no
    // overlapping cell would have asserted nothing about the fold at all
    // (CLAUDE.md trap 13 — an absence probe needs a presence).
    expect(overlapping, 'the grid must actually produce overlapping cells').toBeGreaterThan(100)
  })

  it('breaks exact ties in right, left, bottom, top order', () => {
    // A frame and occluder arranged so `right` and `bottom` tie at exactly 50.
    const frame = box(0, 0, 100, 100)
    const occ = box(50, 50, 150, 150)
    const candidates = clearanceCandidates(frame, occ)!
    expect(candidates.map((c) => c.amount)).toEqual([50, 150, 50, 150])
    expect(cheapestClearance(frame, occ)).toEqual({ side: 'right', amount: 50 })
  })
})
