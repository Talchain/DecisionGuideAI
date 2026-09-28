/**
 * `fragileCuePlacement.ts` — the rule, on shapes built to isolate each clause.
 * (The real-board proof is `fragileCuePlacement.realBoards.spec.ts`; these are
 * the clauses the real boards do not reach: a blocked midpoint, a window with no
 * clear point, two cues contending, and the path reader's own grammar.)
 */
import { describe, it, expect } from 'vitest'
import {
  arrivalGlyphRowSpan,
  flattenSvgPath,
  fragileCueSpotIsClear,
  pointAtFraction,
  resolveFragileCuePlacements,
  FRAGILE_CUE_MAX_SLIDE,
  FRAGILE_CUE_RADIUS_FLOW,
} from '../fragileCuePlacement'
import { resolvePolarityGlyphOffset } from '../../utils/edgeGlyphPlacement'

/** A straight vertical connection 1000 units long: fraction f is at y = 1000·f. */
const VERTICAL = 'M0,0 L0,1000'

describe('the path reader', () => {
  it('reads M/L/H/V/C/Q, absolute and relative, and measures arc length', () => {
    expect(flattenSvgPath('M0,0 L30,40')!.length).toBeCloseTo(50, 9)
    expect(flattenSvgPath('M0 0 h30 v40')!.length).toBeCloseTo(70, 9)
    expect(flattenSvgPath('M10,10 l30,40')!.length).toBeCloseTo(50, 9)
    // A straight cubic is its chord.
    expect(flattenSvgPath('M0,0 C0,10 0,20 0,30')!.length).toBeCloseTo(30, 6)
    expect(flattenSvgPath('M0,0 Q0,10 0,20')!.length).toBeCloseTo(20, 6)
  })

  it('refuses what it cannot read rather than guessing', () => {
    expect(flattenSvgPath('M0,0 A10,10 0 0 1 20,0')).toBeNull()
    expect(flattenSvgPath('')).toBeNull()
    expect(flattenSvgPath('M0,0')).toBeNull()
    expect(flattenSvgPath(null)).toBeNull()
  })

  it('pointAtFraction is by ARC LENGTH, not by parameter', () => {
    // Two legs of 100 and 300: half the length (200) is 100 into the second leg.
    const poly = flattenSvgPath('M0,0 L100,0 L100,300')!
    expect(pointAtFraction(poly, 0.5)).toEqual({ x: 100, y: 100 })
  })
})

describe('the rule: the midpoint, else the nearest clear point along the path, within a quarter', () => {
  it('a clear midpoint is taken as it is', () => {
    const out = resolveFragileCuePlacements([{ id: 'e1', path: VERTICAL }], [])
    expect(out.get('e1')).toEqual({ fraction: 0.5, clear: true })
  })

  it('a card over the midpoint moves the cue along its own path to the first clear point, towards the target on a tie', () => {
    const card = { id: 'c', x: -50, y: 480, width: 100, height: 40 } // y 480–520 over the midpoint
    const out = resolveFragileCuePlacements([{ id: 'e1', path: VERTICAL }], [card], 0, new Map([['c', null]]))
    const p = out.get('e1')!
    expect(p.clear).toBe(true)
    const y = p.fraction * 1000
    // Clear of the card by the disc's reach; the band above the card is its arrival row.
    expect(y > 520 || y < 480).toBe(true)
    expect(fragileCueSpotIsClear({ x: 0, y }, [card], [], 0, new Map([['c', null]]))).toBe(true)
    // …and it is the NEAREST such point: one step closer is not clear.
    const closer = y > 500 ? y - 10 : y + 10
    expect(fragileCueSpotIsClear({ x: 0, y: closer }, [card], [], 0, new Map([['c', null]]))).toBe(false)
  })

  it('with no clear point inside the window it stays at the midpoint and SAYS so (never slides past a quarter)', () => {
    const wall = { id: 'w', x: -50, y: 200, width: 100, height: 600 } // covers 0.2–0.8
    const out = resolveFragileCuePlacements([{ id: 'e1', path: VERTICAL }], [wall])
    expect(out.get('e1')).toEqual({ fraction: 0.5, clear: false })
    expect(FRAGILE_CUE_MAX_SLIDE).toBe(0.25)
  })

  it('two cues whose midpoints coincide do not stack: the second (by id) moves', () => {
    const out = resolveFragileCuePlacements(
      [{ id: 'b', path: 'M-500,500 L500,500' }, { id: 'a', path: VERTICAL }],
      [],
    )
    expect(out.get('a')).toEqual({ fraction: 0.5, clear: true })
    const b = out.get('b')!
    expect(b.clear).toBe(true)
    const pb = pointAtFraction(flattenSvgPath('M-500,500 L500,500')!, b.fraction)
    expect(Math.abs(pb.x)).toBeGreaterThanOrEqual(2 * FRAGILE_CUE_RADIUS_FLOW)
  })

  it('an unreadable path is left out (its edge keeps the midpoint of what it draws)', () => {
    const out = resolveFragileCuePlacements([{ id: 'e1', path: null }], [])
    expect(out.has('e1')).toBe(false)
  })
})

describe('the arrival band follows the glyph row the glyphs are placed in', () => {
  it('its span is the glyph resolver\'s own first and last slot', () => {
    const sib = (k: number) => ({ id: `s${k}`, sourceCentre: null })
    const four = [0, 1, 2, 3].map(sib)
    const span = arrivalGlyphRowSpan(4)!
    expect(span.dxMin).toBe(resolvePolarityGlyphOffset('s0', { x: 0, y: 0 }, four).dx)
    expect(span.dxMax).toBe(resolvePolarityGlyphOffset('s3', { x: 0, y: 0 }, four).dx)
    expect(arrivalGlyphRowSpan(0)).toBeNull()
  })

  it('a point above a card but beside its narrow row is clear; the same point with the whole-width fallback is not', () => {
    const card = { id: 'c', x: 0, y: 1000, width: 800, height: 100 }
    const beside = { x: 60, y: 1000 - 30 }
    const rows = new Map([['c', arrivalGlyphRowSpan(1)]])
    expect(fragileCueSpotIsClear(beside, [card], [], 0, rows)).toBe(true)
    expect(fragileCueSpotIsClear(beside, [card], [])).toBe(false)
    // Over the row itself: never clear.
    expect(fragileCueSpotIsClear({ x: 400 + 16 * 2, y: 1000 - 38 }, [card], [], 0, rows)).toBe(false)
  })
})
