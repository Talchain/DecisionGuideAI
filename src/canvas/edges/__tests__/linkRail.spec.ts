/**
 * R25 (Paul 7 Nov: the aims in view at 1232; PL 7 Nov: rails cross cards): an outcome's link into its aim beside the question runs
 * along the gap under its row, up a rail of its own outside the board on the aim's side, and into the aim's outer side. No segment passes
 * through any card but its two ends; every other link keeps its curve.
 */
import { describe, expect, it } from 'vitest'
import { RAIL_GAP, RAIL_STEP, railOf, railSlots, type Box } from '../linkRail'

// Paul's board shape at 1.0: two aims beside the question; options; drivers; outcomes and risks in one row (the outcome row).
const aimL = { x: 243, y: 0, w: 220, h: 115 }, question = { x: 479, y: 0, w: 272, h: 145 }, aimR = { x: 767, y: 0, w: 220, h: 192 }
const option = { x: 261, y: 224, w: 220, h: 330 }
const driverA = { x: 151, y: 624, w: 220, h: 213 }, driverB = { x: 907, y: 624, w: 220, h: 304 }
const outcomeL = { x: 151, y: 1221, w: 220, h: 272 }, riskA = { x: 403, y: 1221, w: 220, h: 70 }, riskB = { x: 655, y: 1221, w: 220, h: 89 }
const outcomeR = { x: 907, y: 1221, w: 220, h: 347 }, outcomeR2 = { x: 655, y: 1600, w: 220, h: 100 }
const cards: Box[] = [aimL, question, aimR, option, driverA, driverB, outcomeL, riskA, riskB, outcomeR]

/** Every point along the path's straight segments, every 4 units. */
function points(path: string): { x: number; y: number }[] {
  const v = [...path.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }))
  const out: { x: number; y: number }[] = []
  for (let i = 1; i < v.length; i++) {
    const a = v[i - 1]!, b = v[i]!, n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4))
    for (let k = 0; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n })
  }
  return out
}
const inside = (p: { x: number; y: number }, c: Box) => p.x > c.x + 1 && p.x < c.x + c.w - 1 && p.y > c.y + 1 && p.y < c.y + c.h - 1

describe('a link into an aim beside the question runs round the board, through no card', () => {
  it('catch: from each source, the outermost of its row or mid-row, no point of the path lies inside any card but its own two ends', () => {
    // riskB sits mid-row: its old exit (out of its side along the row) ran through outcomeR on its way to the right rail.
    for (const [from, to] of [[outcomeR, aimR], [outcomeL, aimL], [riskB, aimR]] as const) {
      const r = railOf(from, to, cards)!
      expect(r).not.toBeNull()
      const others = cards.filter((c) => c !== from && c !== to)
      for (const p of points(r.path)) for (const c of others) expect(inside(p, c), `${JSON.stringify(p)} in ${JSON.stringify(c)}`).toBe(false)
    }
  })
  it('the rail is outside the board on the aim\'s side, and its words sit on it, off every card', () => {
    const right = Math.max(...cards.map((c) => c.x + c.w)), r = railOf(outcomeR, aimR, cards)!
    expect(r.x).toBe(right + RAIL_GAP)
    expect(cards.some((c) => inside({ x: r.x, y: r.y }, c))).toBe(false)
  })
  it('catch: two links into the same side get their own rails, in the order of their sources across the board', () => {
    const links = [{ id: 'a', from: outcomeR, to: aimR }, { id: 'b', from: outcomeR2, to: aimR }]
    const slots = railSlots(links, [...cards, outcomeR2])
    expect([slots.get('a'), slots.get('b')]).toEqual([0, 1])
    const ra = railOf(outcomeR, aimR, [...cards, outcomeR2], slots.get('a'))!, rb = railOf(outcomeR2, aimR, [...cards, outcomeR2], slots.get('b'))!
    expect(rb.x - ra.x).toBe(RAIL_STEP)
  })
  it('must not change: a downward link, and an upward link into a middle row, keep their curve', () => {
    expect(railOf(option, outcomeL, cards)).toBeNull()
    expect(railOf(riskA, driverA, cards)).toBeNull()
  })
})
