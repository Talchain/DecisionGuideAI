/**
 * A "Rests on" number can always be seen (1280×800, MRR board, 19 Oct 2026: 3 of 13 numbers sat under the next card on
 * links leaving a card sideways, so they could not be seen or picked).
 */
import { describe, expect, it } from 'vitest'
import { resolveRestsOnMarkerOnPath, resolveSourceGlyphOnPath, type GlyphPath } from '../edgeGlyphPlacement'

/** A straight horizontal line from x 0 to x `len` at y 0. */
const line = (len: number): GlyphPath => ({ points: [{ x: 0, y: 0 }, { x: len, y: 0 }], cumulative: [0, len], length: len })
const HALF = { w: 16, h: 10 }

describe('resolveRestsOnMarkerOnPath', () => {
  it('with no card over the seat, it stands at the source mark\'s seat', () => {
    const p = line(400)
    expect(resolveRestsOnMarkerOnPath(p, HALF, [])).toEqual({ ...resolveSourceGlyphOnPath(p), clear: true })
  })

  it('a card over the seat: it slides along its line to the nearest clear spot', () => {
    // The seat is x 100; a card covers x 60–160.
    const r = resolveRestsOnMarkerOnPath(line(400), HALF, [{ x0: 60, y0: -40, x1: 160, y1: 40 }])
    expect(r.clear).toBe(true)
    expect(r.y).toBe(0)
    // Clear spots start at x 44 (box clears x 60) and x 176 (box clears x 160); x 44 is nearer the seat at x 100.
    expect(r.x).toBe(44)
  })

  it('CONTRAST: no clear spot on the line (cards with gaps narrower than the number) stands where it overlaps least', () => {
    // Cards every 40 units with 24-unit gaps: a 32-wide number never fits; the gap centres overlap least.
    const cards = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => ({ x0: i * 40, y0: -40, x1: i * 40 + 16, y1: 40 }))
    const r = resolveRestsOnMarkerOnPath(line(400), HALF, cards)
    expect(r.clear).toBe(false)
    const overlapAt = (x: number) => cards.reduce((sum, k) => sum + Math.max(0, Math.min(x + 16, k.x1) - Math.max(x - 16, k.x0)), 0)
    expect(overlapAt(r.x)).toBeCloseTo(Math.min(...Array.from({ length: 201 }, (_, i) => overlapAt(i * 2))), 6)
  })
})
