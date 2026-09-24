/**
 * ⭐ THE LANES CANNOT DISAGREE WITH WHERE THE CARDS ARE.
 *
 * Every assertion here binds a lane to the extents of its OWN members, because
 * the only way this feature can be wrong is by drifting from the geometry — and
 * a band drawn 200 units off is worse than no band at all: it asserts a
 * structure the cards contradict.
 */
import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { deriveTierLanes, TIER_LANE_TITLES } from '../tierLanes'
import { TIER_BY_KIND } from '../nodeLayoutConstants'
import { MODEL_GROUP_TITLE } from '../../domain/vocabulary'

function n(id: string, type: string, x: number, y: number, w = 200, h = 100): Node {
  return { id, type, position: { x, y }, data: { label: id }, width: w, height: h } as unknown as Node
}

/** The shape the five shipped starters actually have. */
const BOARD: Node[] = [
  n('dec', 'decision', 1064, 150, 336, 290),
  n('o1', 'option', 100, 500, 336, 515),
  n('o2', 'option', 600, 500, 336, 515),
  n('f1', 'factor', 200, 1150, 187, 360),
  n('f2', 'factor', 900, 1150, 187, 360),
  n('r1', 'risk', 300, 1600, 187, 219),
  n('out1', 'outcome', 800, 1600, 187, 219),
  n('goal', 'goal', 500, 2000, 336, 264),
]

describe('the board’s grammar, drawn', () => {
  it('⭐ one lane per OCCUPIED tier, in tier order', () => {
    expect(deriveTierLanes(BOARD).map(l => l.tier)).toEqual([0, 1, 2, 3, 5])
  })

  it('⭐ a lane’s vertical extent is its OWN members’ extent — not a table', () => {
    const consequences = deriveTierLanes(BOARD).find(l => l.tier === 3)!
    expect(consequences.y).toBe(1600)              // min y of risk+outcome
    expect(consequences.height).toBe(219)          // to max(y + height)
  })

  /**
   * ⛔ THE DISCRIMINATING TWIN. Move one card and the lane must follow. Without
   * this, a hardcoded band passes every assertion above — which is precisely the
   * failure this module's docblock forbids.
   */
  it('⛔ CONTRAST: moving a card moves its lane', () => {
    const moved = BOARD.map(x => (x.id === 'r1' ? n('r1', 'risk', 300, 1700, 187, 219) : x))
    const before = deriveTierLanes(BOARD).find(l => l.tier === 3)!
    const after = deriveTierLanes(moved).find(l => l.tier === 3)!
    expect(after.height).toBeGreaterThan(before.height)
    expect(after.y).toBe(1600)                     // the outcome still sets the top
  })

  it('every lane spans the same board width, so the bands read as rows', () => {
    const lanes = deriveTierLanes(BOARD)
    const xs = new Set(lanes.map(l => l.x))
    const ws = new Set(lanes.map(l => l.width))
    expect(xs.size).toBe(1)
    expect(ws.size).toBe(1)
    expect(lanes[0].x).toBe(100)                   // leftmost card
    expect(lanes[0].width).toBe(1400 - 100)        // to the rightmost card's right edge
  })

  /**
   * contract v3.1 CHR-10 — superseded the old "ghost changes no width" pin. A
   * ghost is still NOT a member (no tier, no top/bottom, no count), but the
   * option door stands at the end of its row, and a row that stops short of
   * its own door draws the door on bare canvas. So the rows reach it — right
   * edge only.
   */
  it('⛔ ghosts are not members — a lane never claims the model is taller or holds more than it does', () => {
    const withGhost = [...BOARD, n('__ghost-option__', 'ghost-option', 5000, 500, 160, 56)]
    const a = deriveTierLanes(BOARD)
    const b = deriveTierLanes(withGhost)
    expect(b.map(l => l.tier)).toEqual(a.map(l => l.tier))
    expect(b.map(l => l.y)).toEqual(a.map(l => l.y))
    expect(b.map(l => l.height)).toEqual(a.map(l => l.height))
    expect(b.map(l => l.contentLeft)).toEqual(a.map(l => l.contentLeft))
    expect(b.map(l => l.x)).toEqual(a.map(l => l.x))
  })

  it('⭐ CHR-10: the rows reach the door that stands in them — every lane’s right edge covers the ghost', () => {
    const withGhost = [...BOARD, n('__ghost-option__', 'ghost-option', 5000, 500, 160, 56)]
    for (const lane of deriveTierLanes(withGhost)) {
      expect(lane.x + lane.width).toBe(5000 + 160)
    }
  })

  it('⛔ CHR-10 CONTRAST: a door inside the board changes nothing, and a door never moves the left edge', () => {
    const inside = [...BOARD, n('__ghost-option__', 'ghost-option', 900, 500, 160, 56)]
    expect(deriveTierLanes(inside)).toEqual(deriveTierLanes(BOARD))
    const left = [...BOARD, n('__ghost-option__', 'ghost-option', -900, 500, 160, 56)]
    expect(deriveTierLanes(left).map(l => l.x)).toEqual(deriveTierLanes(BOARD).map(l => l.x))
  })

  it('CHR-3: a lane carries its OWN cards’ left edge, distinct from the board’s', () => {
    const lanes = deriveTierLanes(BOARD)
    expect(lanes.find(l => l.tier === 0)!.contentLeft).toBe(1064)   // the centred Question
    expect(lanes.find(l => l.tier === 1)!.contentLeft).toBe(100)    // board-left
    expect(lanes.find(l => l.tier === 3)!.contentLeft).toBe(300)    // min over risk + outcome
    expect(lanes.every(l => l.x === 100)).toBe(true)
  })

  it('⛔ an empty board gets no lanes — a lane on nothing would be a judgement', () => {
    expect(deriveTierLanes([])).toEqual([])
  })

  it('the titles are the Model outline’s own words, not a second spelling', () => {
    const lanes = deriveTierLanes(BOARD)
    expect(lanes.find(l => l.tier === 1)!.title).toBe(MODEL_GROUP_TITLE.options)
    expect(lanes.find(l => l.tier === 3)!.title).toBe(MODEL_GROUP_TITLE.outcomesRisks)
    expect(lanes.find(l => l.tier === 5)!.title).toBe(MODEL_GROUP_TITLE.goal)
  })

  /**
   * ⭐⭐ THE COMPLETENESS GUARD, DERIVED FROM `TIER_BY_KIND` ITSELF.
   *
   * `TITLE_BY_TIER` is a stated mirror — no derivation is available, because a
   * tier holds several kinds and none of their names titles it. The mitigation
   * is that this reads the REAL table: add a kind at a tier with no title and
   * this REDs, instead of shipping an untitled band.
   */
  it('⭐ every tier a kind can occupy has a name', () => {
    const occupied = [...new Set(Object.values(TIER_BY_KIND))].sort((a, b) => a - b)
    const named = Object.keys(TIER_LANE_TITLES).map(Number).sort((a, b) => a - b)
    expect(named).toEqual(occupied)
  })
})
