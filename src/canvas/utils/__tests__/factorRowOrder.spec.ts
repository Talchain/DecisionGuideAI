/**
 * THE DEFECT: the factor row does not read in the order its `#N` badges claim.
 *
 * Paul's screenshot complaint, one row down from where it was fixed for the
 * option cards. `canvas/nodes/BaseNode.tsx` prints "Key driver #N: ranked by
 * influence on the outcome" on a row whose left-to-right order is ELK's
 * edge-crossing pass, so `#1` can sit to the right of `#3`.
 *
 * ⚠ EVERY ASSERTION BINDS BY NODE ID. Not by x value, not by "the leftmost
 * card", not by array index — a value predicate another node could satisfy is
 * how a test comes to pass on the wrong object (CLAUDE.md trap 19). Where an
 * assertion is about reading ORDER it reads the ids out in x order and compares
 * the id sequence, so a permutation that happens to produce the right x values
 * on the wrong cards fails.
 *
 * SCOPE LIMIT OF THIS EVIDENCE. Everything here is STRUCTURAL: it pins the
 * position array these pure functions produce. It does NOT prove a browser
 * paints those cards in that order, that the badge and the seat agree on screen,
 * or that the row is legible at any zoom — those need a real browser and are
 * stated as not-done in the PR body.
 */
import { describe, it, expect } from 'vitest'
import {
  deriveDeterminedFactorOrder,
  seatNodesIntoRankedSlots,
  type RankableFactor,
} from '../factorRowOrder'
import { MAX_BADGED_RANK } from '../../../components/results/driverDisplayModel'

type TestNode = { id: string; position: { x: number; y: number }; data?: unknown }

const node = (id: string, x: number, y = 0): TestNode => ({ id, position: { x, y } })

/** Read the ids out in canvas reading order (row-major), by IDENTITY. */
function readingOrder(nodes: readonly TestNode[]): string[] {
  return [...nodes]
    .sort((a, b) =>
      a.position.y !== b.position.y
        ? a.position.y - b.position.y
        : a.position.x - b.position.x,
    )
    .map((n) => n.id)
}

const f = (key: string, value: number, elasticity = value): RankableFactor => ({
  key,
  value,
  elasticity,
})

describe('deriveDeterminedFactorOrder — it claims exactly as far as the badge claims', () => {
  it('returns the determined ordinals best-first, capped at the badge depth', () => {
    // Four factors, every gap wider than the tie epsilon, so all four ordinals
    // are individually clear — but the badge only prints three.
    const order = deriveDeterminedFactorOrder(
      [f('fac_b', 0.1), f('fac_c', 1.0), f('fac_a', 0.7), f('fac_d', 0.4)],
      MAX_BADGED_RANK,
    )
    expect(order).toEqual(['fac_c', 'fac_a', 'fac_d'])
  })

  it('WITHHOLDS the whole set when the top two are tied — no order to claim', () => {
    // The set the rank gate refuses to badge. Position must refuse it too:
    // position is the stronger channel and carries no tooltip to qualify it.
    const order = deriveDeterminedFactorOrder(
      [f('fac_a', 0.5), f('fac_b', 0.5), f('fac_c', 0.2)],
      MAX_BADGED_RANK,
    )
    expect(order).toEqual([])
  })

  it('claims nothing on a single determined ordinal — one card cannot be out of order', () => {
    const order = deriveDeterminedFactorOrder(
      [f('fac_a', 1.0), f('fac_b', 0.5), f('fac_c', 0.5)],
      MAX_BADGED_RANK,
    )
    expect(order).toEqual([])
  })

  it('counts a duplicated id ONCE — one factor does not consume two slots', () => {
    const order = deriveDeterminedFactorOrder(
      [f('fac_a', 1.0), f('fac_a', 1.0), f('fac_b', 0.6), f('fac_c', 0.2)],
      MAX_BADGED_RANK,
    )
    expect(order).toEqual(['fac_a', 'fac_b', 'fac_c'])
  })
})

describe('seatNodesIntoRankedSlots — the row reads in the order the badges claim', () => {
  it('THE DEFECT: #1 seats left of #2 seats left of #3, by id', () => {
    // ELK's order, left to right: fac_a, fac_b, fac_c, fac_d.
    const nodes = [node('fac_a', 0), node('fac_b', 300), node('fac_c', 600), node('fac_d', 900)]
    // Determined influence order: fac_c #1, fac_a #2, fac_d #3. fac_b unranked.
    const seated = seatNodesIntoRankedSlots(nodes, ['fac_c', 'fac_a', 'fac_d'])

    // The three badged cards read #1, #2, #3 left to right — asserted as an ID
    // SEQUENCE, so seating the right x on the wrong card fails here.
    const badgedInReadingOrder = readingOrder(seated).filter((id) => id !== 'fac_b')
    expect(badgedInReadingOrder).toEqual(['fac_c', 'fac_a', 'fac_d'])
  })

  it('the UNRANKED card does not move, and may sit between two badged cards', () => {
    const nodes = [node('fac_a', 0), node('fac_b', 300), node('fac_c', 600), node('fac_d', 900)]
    const seated = seatNodesIntoRankedSlots(nodes, ['fac_c', 'fac_a', 'fac_d'])

    // Bound by identity: THIS node, at THIS position. Moving a card the
    // analysis cannot rank would be exactly the claim the gate refuses.
    expect(seated.find((n) => n.id === 'fac_b')!.position).toEqual({ x: 300, y: 0 })
    // And the full reading order, so the interleave is pinned rather than implied.
    expect(readingOrder(seated)).toEqual(['fac_c', 'fac_b', 'fac_a', 'fac_d'])
  })

  it('is a PERMUTATION: the multiset of positions the badged cards occupy is unchanged', () => {
    // This is the whole safety argument — no new pixels, no new rows, nothing
    // for the collision guard to find that was not already there.
    const nodes = [node('fac_a', 0), node('fac_b', 300), node('fac_c', 600), node('fac_d', 900)]
    const before = JSON.stringify(nodes.map((n) => n.position).sort((a, b) => a.x - b.x))
    const seated = seatNodesIntoRankedSlots(nodes, ['fac_c', 'fac_a', 'fac_d'])
    const after = JSON.stringify(seated.map((n) => n.position).sort((a, b) => a.x - b.x))
    expect(after).toBe(before)
  })

  it('seats row-major across a SPLIT tier row — #1 on the top row, by id', () => {
    // fac_d sits alone on the second row at ELK's answer. #1 must reach the
    // top-left slot, so the whole position travels, not x alone.
    const nodes = [node('fac_a', 0, 0), node('fac_b', 300, 0), node('fac_d', 0, 400)]
    const seated = seatNodesIntoRankedSlots(nodes, ['fac_d', 'fac_a', 'fac_b'])
    expect(readingOrder(seated)).toEqual(['fac_d', 'fac_a', 'fac_b'])
    expect(seated.find((n) => n.id === 'fac_d')!.position).toEqual({ x: 0, y: 0 })
  })

  it('moves NOTHING and returns the same array when the row already reads in order', () => {
    const nodes = [node('fac_a', 0), node('fac_b', 300), node('fac_c', 600)]
    expect(seatNodesIntoRankedSlots(nodes, ['fac_a', 'fac_b', 'fac_c'])).toBe(nodes)
  })

  it('moves NOTHING on an empty claim — a withheld order must not reorder the row', () => {
    const nodes = [node('fac_c', 0), node('fac_a', 300), node('fac_b', 600)]
    expect(seatNodesIntoRankedSlots(nodes, [])).toBe(nodes)
  })

  it('leaves a node with a non-finite position alone rather than sorting it arbitrarily', () => {
    const nodes = [
      node('fac_a', 0),
      { id: 'fac_nan', position: { x: Number.NaN, y: 0 } },
      node('fac_c', 600),
    ]
    const seated = seatNodesIntoRankedSlots(nodes, ['fac_c', 'fac_nan', 'fac_a'])
    expect(seated.find((n) => n.id === 'fac_nan')!.position.x).toBeNaN()
    // The two placeable cards still swap into rank order.
    expect(seated.find((n) => n.id === 'fac_c')!.position).toEqual({ x: 0, y: 0 })
    expect(seated.find((n) => n.id === 'fac_a')!.position).toEqual({ x: 600, y: 0 })
  })

  it('leaves a LOCKED card pinned, and lets nothing else take its slot', () => {
    // The user pinned fac_a. A claim they cannot see must not override a pin
    // they can — the same answer `layoutGraph` gives for `data.locked`.
    const nodes: TestNode[] = [
      { id: 'fac_a', position: { x: 0, y: 0 }, data: { locked: true } },
      node('fac_b', 300),
      node('fac_c', 600),
    ]
    const seated = seatNodesIntoRankedSlots(nodes, ['fac_c', 'fac_a', 'fac_b'])
    expect(seated.find((n) => n.id === 'fac_a')!.position).toEqual({ x: 0, y: 0 })
    // fac_c and fac_b are still seated in rank order among their OWN two slots.
    expect(seated.find((n) => n.id === 'fac_c')!.position).toEqual({ x: 300, y: 0 })
    expect(seated.find((n) => n.id === 'fac_b')!.position).toEqual({ x: 600, y: 0 })
  })

  it('declines to seat a DUPLICATED id — same answer layoutGraph gives', () => {
    const nodes = [node('fac_a', 0), node('fac_a', 300), node('fac_c', 600)]
    const seated = seatNodesIntoRankedSlots(nodes, ['fac_c', 'fac_a'])
    // Only one placeable ranked id survives the duplicate exclusion, so there is
    // nothing to permute and no card is stacked on another.
    expect(seated).toBe(nodes)
  })
})

describe('the badge depth has ONE declaration', () => {
  it('is re-exported from the hook under the name its importers already use', async () => {
    const hook = await import('../../hooks/useNodeDisplayMetadata')
    expect(hook.MAX_BADGED_RANK).toBe(MAX_BADGED_RANK)
    expect(MAX_BADGED_RANK).toBe(3)
  })
})
