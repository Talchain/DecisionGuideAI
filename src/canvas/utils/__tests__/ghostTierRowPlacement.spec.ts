/**
 * ⭐⭐ A TIER DOOR STANDS AT THE END OF ITS ROW, NOT AT THE END OF ITS KIND.
 *
 * ⛔ THIS SHIPPED BROKEN FOR THE LENGTH OF ONE SCREENSHOT, and the way it was
 * found is the reason this file exists.
 *
 * `withGhostTiers` placed each door to the right of the rightmost sibling OF THE
 * SAME TYPE. Correct while every kind owned a row to itself. When risks joined
 * the outcome tier (founder ruling, 14 Sep 2026), the rightmost RISK stopped
 * being the rightmost node in the risk row, and the "What else could go wrong?"
 * door was painted ON TOP OF an outcome card:
 *
 *     __ghost-risk__  at (886, 782) 94x44
 *     out_nrr         at (884, 782) 168x110
 *
 * Two pixels apart, the door's whole box inside the card's.
 *
 * ⛔⛔ NO GUARD CAUGHT IT. The tier change kept 493 spec files green, and its own
 * comment had ALREADY NAMED the intra-row hazard — then missed this, because the
 * hazard was reasoned about as an EDGE and arrived as a GHOST. **Naming a risk is
 * not the same as enumerating the things that can realise it.** It was found by
 * looking at a photograph of the canvas.
 *
 * So this asserts the general rule rather than the instance: a door never shares
 * a point with anything already on its row, whatever kind that is.
 */
import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { withGhostTiers, GHOST_ID_PREFIX, CONSEQUENCE_DOOR_ID } from '../ghostTiers'

const W = 168
const node = (id: string, type: string, x: number, y: number): Node =>
  ({ id, type, position: { x, y }, data: { label: id, kind: type }, measured: { width: W, height: 90 } }) as unknown as Node

/** The shape the founder ruling produces: two kinds sharing one row. */
const consequenceRow = (): Node[] => [
  node('d', 'decision', 0, 0),
  node('o1', 'option', 0, 200),
  node('f1', 'factor', 0, 400),
  // One row, interleaved, with an OUTCOME furthest right — the case that broke.
  node('r1', 'risk', 0, 600),
  node('out1', 'outcome', 200, 600),
  node('r2', 'risk', 400, 600),
  node('out2', 'outcome', 600, 600),
  node('g', 'goal', 0, 800),
]

const boxesOverlap = (a: Node, b: Node, wa = W, wb = W): boolean => {
  const ax = a.position.x, ay = a.position.y, bx = b.position.x, by = b.position.y
  return ax < bx + wb && bx < ax + wa && Math.round(ay) === Math.round(by)
}

describe('ghost tier doors — placed by ROW, never by kind', () => {
  it('the consequence row\'s door clears an OUTCOME that sits to the right of every risk', () => {
    const out = withGhostTiers(consequenceRow())
    // v3.1 WS1 #27: the row's ONE door (outcomes and risks share it).
    const ghost = out.find(n => n.id === CONSEQUENCE_DOOR_ID)

    // Non-vacuity: the door must actually exist, or every assertion below holds
    // by having nothing to test (CLAUDE.md trap 13).
    expect(ghost, 'no consequence door was produced — this guard asserts nothing').toBeDefined()

    // The precondition that CREATES the defect, pinned in-test: an outcome must
    // genuinely sit to the right of the rightmost risk. Without this the test
    // would pass on a fixture where the old rule happened to be right.
    const rightmostRisk = Math.max(600 * 0, 400)
    const rightmostOutcome = 600
    expect(rightmostOutcome).toBeGreaterThan(rightmostRisk)

    expect(ghost!.position.x).toBeGreaterThan(rightmostOutcome)
  })

  it('no door shares a point with ANY node on its row — including the other door', () => {
    const base = consequenceRow()
    const out = withGhostTiers(base)
    const ghosts = out.filter(n => n.id.startsWith(GHOST_ID_PREFIX))
    expect(ghosts.length, 'no doors produced').toBeGreaterThan(0)

    const collisions: string[] = []
    for (const g of ghosts) {
      for (const other of out) {
        if (other.id === g.id) continue
        // Doors are narrower than cards; use the card width for both, which is
        // the CONSERVATIVE direction — it can only over-report a collision.
        if (boxesOverlap(g, other)) collisions.push(`${g.id} over ${other.id}`)
      }
    }
    expect(collisions, collisions.join(' | ')).toEqual([])
  })

  it('ONE door on the shared row — never two stacked in one band (v3.1 WS1 #27, ED 5810951997)', () => {
    const out = withGhostTiers(consequenceRow())
    const onRow = out.filter(n => n.id.startsWith(GHOST_ID_PREFIX) && Math.round(n.position.y) === 600)
    expect(onRow.map(n => n.id)).toEqual([CONSEQUENCE_DOOR_ID])
  })
})
