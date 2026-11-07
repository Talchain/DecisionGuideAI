/**
 * R25 (Paul 7 Nov: the aims in view at 1232): an outcome's link into its aim, drawn beside the question at the head of the board, runs
 * round the board on the aim's side, never through the rows between them; every other link keeps its curve.
 */
import { describe, expect, it } from 'vitest'
import { RAIL_GAP, railOf } from '../linkRail'

// Paul's board shape at 1.0: two aims beside the question, three options, an outcome row below.
const aimL = { x: 243, y: 0, w: 220, h: 115 }, question = { x: 479, y: 0, w: 320, h: 145 }, aimR = { x: 815, y: 0, w: 220, h: 192 }
const option = { x: 261, y: 224, w: 220, h: 330 }, outcomeL = { x: 151, y: 1221, w: 220, h: 272 }, outcomeR = { x: 907, y: 1221, w: 220, h: 347 }
const premise = { x: 449, y: 960, w: 220, h: 187 }
const cards = [aimL, question, aimR, option, outcomeL, outcomeR, premise]

describe('a link into an aim beside the question runs round the board', () => {
  it('catch: outcome into the right aim: out of its right side, up a rail right of every card, into the aim\'s right side', () => {
    const r = railOf(outcomeR, aimR, cards)!
    const right = Math.max(...cards.map((c) => c.x + c.w))
    expect(r.path).toBe(`M 1127,1241 L ${right + RAIL_GAP},1241 L ${right + RAIL_GAP},20 L 1035,20`)
    expect(r.x).toBe(right + RAIL_GAP) // its words on the rail, off every card
  })
  it('catch: outcome into the left aim: the rail left of every card', () => {
    const r = railOf(outcomeL, aimL, cards)!
    expect(r.path).toBe(`M 151,1241 L ${151 - RAIL_GAP},1241 L ${151 - RAIL_GAP},20 L 243,20`)
  })
  it('must not change: a downward link, and an upward link into a middle row (a premise on an option), keep their curve', () => {
    expect(railOf(option, outcomeL, cards)).toBeNull()
    expect(railOf(premise, option, cards)).toBeNull()
  })
})
