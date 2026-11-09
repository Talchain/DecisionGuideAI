/**
 * R25 (Paul 7 Nov: the aims in view at 1232; PL 7 Nov: rails cross cards): an outcome's link into its aim beside the question runs
 * along the gap under its row, up a rail of its own outside the board on the aim's side, and into the aim's outer side. No segment passes
 * through any card but its two ends; every other link keeps its curve.
 */
import { describe, expect, it } from 'vitest'
import { downSlots, goesDown, RAIL_GAP, RAIL_STEP, railOf, railSlots, railWordsAt, type Box } from '../linkRail'

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
  it('the rail is outside the board on the aim\'s side', () => {
    const right = Math.max(...cards.map((c) => c.x + c.w)), r = railOf(outcomeR, aimR, cards)!
    expect(r.x).toBe(right + RAIL_GAP)
  })
  // PL 7 Nov: the words' measured box, not a point, must clear every card (a box wider than the rail's room reached the edge cards).
  const overlaps = (p: { x: number; y: number }, s: { w: number; h: number }, c: Box) =>
    p.x - s.w / 2 < c.x + c.w && p.x + s.w / 2 > c.x && p.y - s.h / 2 < c.y + c.h && p.y + s.h / 2 > c.y
  it('catch: on every rail, in its first two slots, a wide two-line label\'s box intersects no card', () => {
    const size = { w: 120, h: 36 }
    for (const [from, to] of [[outcomeR, aimR], [outcomeL, aimL], [riskB, aimR]] as const) for (const slot of [0, 1]) {
      const r = railOf(from, to, cards, slot)!, p = railWordsAt(r, size, cards)
      for (const c of cards) expect(overlaps(p, size, c), `slot ${slot} ${JSON.stringify(p)} over ${JSON.stringify(c)}`).toBe(false)
    }
  })
  it('catch: a wide label with a clear gap on its climb sits on its rail in that gap, nearest the middle (not moved off the rail)', () => {
    // outcomeR's climb on the right rail (x 1151) passes driverB (624-928) and outcomeR (1221-1568); the nearest clear gap to the middle
    // (800) for a 36-high box is just under driverB.
    const r = railOf(outcomeR, aimR, cards)!
    expect(railWordsAt(r, { w: 120, h: 36 }, cards)).toEqual({ x: r.x, y: 952 })
  })
  it('catch: where cards line the board\'s edge the whole way up, the box moves out past the edge, still across its rail', () => {
    // A column at the right edge with no gap from the aims' row down to the outcome row: no point of the climb is clear.
    const wall = [{ x: 1000, y: 0, w: 127, h: 630 }, { x: 907, y: 630, w: 220, h: 600 }]
    const low = { ...outcomeR, y: 1230 }, board = [aimL, question, aimR, option, outcomeL, riskB, ...wall, low]
    const size = { w: 120, h: 36 }, r = railOf(low, aimR, board)!, p = railWordsAt(r, size, board)
    expect(p.x).not.toBe(r.x)
    for (const c of board) expect(overlaps(p, size, c), `${JSON.stringify(p)} over ${JSON.stringify(c)}`).toBe(false)
    expect(p.x - size.w / 2 < r.x && r.x < p.x + size.w / 2).toBe(true)
  })
  it('catch (line chip): past the edge, a chip already out there is stepped past: the link\'s words and its chip never sit on each other', () => {
    // As above, no point of the climb is clear, so the link's chip (placed first) goes out past the board's edge; then its words, kept clear of
    // the cards and that chip, step on outward past the chip rather than land on it at the same spot.
    const wall = [{ x: 1000, y: 0, w: 127, h: 630 }, { x: 907, y: 630, w: 220, h: 600 }]
    const low = { ...outcomeR, y: 1230 }, board = [aimL, question, aimR, option, outcomeL, riskB, ...wall, low]
    const r = railOf(low, aimR, board)!, chipSize = { w: 150, h: 24 }, wordsSize = { w: 56, h: 18 }
    const chip = railWordsAt(r, chipSize, board)
    const chipBox = { x: chip.x - chipSize.w / 2, y: chip.y - chipSize.h / 2, w: chipSize.w, h: chipSize.h }
    const words = railWordsAt(r, wordsSize, [...board, chipBox], board)
    // CONTRAST: kept clear of the cards alone, the words land on the chip.
    expect(overlaps(railWordsAt(r, wordsSize, board), wordsSize, chipBox)).toBe(true)
    expect(overlaps(words, wordsSize, chipBox)).toBe(false)
    for (const c of board) expect(overlaps(words, wordsSize, c)).toBe(false)
    expect(words.y).toBe(r.y)
  })
  it('must not change: a small label stays on its rail at the middle of the climb', () => {
    const r = railOf(outcomeR, aimR, cards)!
    expect(railWordsAt(r, { w: 20, h: 20 }, cards)).toEqual({ x: r.x, y: r.y })
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

describe('craft 8: a link into a card wholly below its source runs down the gap, its ends spread so siblings never cross', () => {
  const at = (id: string, b: Box) => ({ id, ...b })
  // Paul's board shape: the option over the two drivers (624, below its foot at 554); outcomeL and riskA in the row below them.
  const opt = at('option', option), dA = at('driverA', driverA), dB = at('driverB', driverB), oL = at('outcomeL', outcomeL), rA = at('riskA', riskA)

  it('HIGH: from the source\'s bottom edge to the target\'s top edge, at the edges\' middles when it is the only link there', () => {
    expect(downSlots([{ id: 'e1', from: opt, to: dA }]).get('e1')).toEqual({ sx: option.x + option.w / 2, sy: option.y + option.h, tx: driverA.x + driverA.w / 2, ty: driverA.y })
  })

  it('HIGH: two links leaving one card never cross: each leaves at the k-th of n in the order of its target across the board; swapping the targets swaps the slots', () => {
    const slot = (n: number) => option.x + (option.w * n) / 3
    const two = downSlots([{ id: 'a', from: opt, to: dA }, { id: 'b', from: opt, to: dB }])
    expect([two.get('a')!.sx, two.get('b')!.sx]).toEqual([slot(1), slot(2)]) // driverA (left) first, driverB second
    const swapped = downSlots([{ id: 'a', from: opt, to: dB }, { id: 'b', from: opt, to: dA }])
    expect([swapped.get('a')!.sx, swapped.get('b')!.sx]).toEqual([slot(2), slot(1)])
    // Likewise the links arriving at one card's top, by their sources across the board; ties on the edge id.
    const into = downSlots([{ id: 'z', from: dB, to: oL }, { id: 'y', from: dA, to: oL }])
    expect([into.get('y')!.tx, into.get('z')!.tx]).toEqual([outcomeL.x + outcomeL.w / 3, outcomeL.x + (outcomeL.w * 2) / 3])
    const tie = downSlots([{ id: 'q', from: opt, to: dA }, { id: 'p', from: opt, to: { ...dA, id: 'driverA2' } }])
    expect([tie.get('p')!.sx, tie.get('q')!.sx]).toEqual([slot(1), slot(2)])
  })

  it('HIGH: a link in its source\'s row, or into a card above it, or between cards not yet measured, is not routed down (it keeps its handles)', () => {
    expect(downSlots([{ id: 'row', from: oL, to: rA }, { id: 'up', from: dA, to: opt }, { id: 'unmeasured', from: { ...opt, h: 0 }, to: dA }]).size).toBe(0)
    expect([goesDown(option, driverA), goesDown(outcomeL, riskA), goesDown(driverA, option)]).toEqual([true, false, false])
  })
})
