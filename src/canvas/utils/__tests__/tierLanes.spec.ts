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
import { deriveTierLanes, TIER_LANE_TITLES, OUTLINE_GROUP_TITLE_BY_TIER } from '../tierLanes'
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

  it('⛔ ghosts are not members — a lane never claims the model reaches further than it does', () => {
    const withGhost = [...BOARD, n('__ghost-risk__', 'ghost-tier', 5000, 1600, 187, 121)]
    const a = deriveTierLanes(BOARD)
    const b = deriveTierLanes(withGhost)
    expect(b.map(l => l.width)).toEqual(a.map(l => l.width))
  })

  it('⛔ an empty board gets no lanes — a lane on nothing would be a judgement', () => {
    expect(deriveTierLanes([])).toEqual([])
  })

  it('the titles are the contract v3.1 band words (WS1 #26), and the outline keeps its own names beside them', () => {
    const lanes = deriveTierLanes(BOARD)
    expect(lanes.find(l => l.tier === 1)!.title).toBe('ALTERNATIVES')
    expect(lanes.find(l => l.tier === 3)!.title).toBe('OUTCOMES / RISKS')
    expect(lanes.find(l => l.tier === 5)!.title).toBe('GOAL')
    // The Model outline's names are kept, visibly different, in one table.
    expect(OUTLINE_GROUP_TITLE_BY_TIER[1]).toBe(MODEL_GROUP_TITLE.options)
    expect(OUTLINE_GROUP_TITLE_BY_TIER[3]).toBe(MODEL_GROUP_TITLE.outcomesRisks)
    expect(OUTLINE_GROUP_TITLE_BY_TIER[5]).toBe(MODEL_GROUP_TITLE.goal)
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
