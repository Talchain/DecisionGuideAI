/**
 * `orderOptionIdsByCanvasPosition` — canvas reading order for option ordinals.
 *
 * Paul, 31 Aug 2026, from a screenshot of the canvas: the option cards carried
 * badges reading `1, 2, 4, 5, 3` left to right. "Either order the row by rank
 * or stop putting ordinals on a non-ordered row."
 *
 * Root cause: the ordinals were minted in a PROBABILITY sort (the results
 * panel's display order) while the cards' left-to-right position is ELK's
 * layout order. Two different orders on one row of numbers, agreeing only by
 * coincidence. `Option N` is now POSITIONAL IDENTITY — the Nth option card in
 * canvas reading order (row-major: y-row, then x) at the moment the numbers
 * are first minted — so the badges read left to right by construction.
 *
 * The row model is NOT re-implemented here: `groupByYRow` (canvas/utils/
 * layout.ts) supplies the row grouping AND the y-tolerance, because a
 * hand-copied tolerance constant is this estate's dominant defect class
 * (CLAUDE.md trap 12 — the hand-maintained mirror). The tolerance BOUNDARY is
 * pinned behaviourally below, so a drift in the shared constant REDs here
 * rather than silently renumbering the canvas.
 *
 * One deliberate refinement over `groupByYRow`'s own within-row sort: it
 * breaks an exact-x tie LEXICOGRAPHICALLY by node id, and this function breaks
 * it by CALLER ORDER instead. That makes the whole contract one rule —
 * "position decides where it can, caller order breaks every tie" — the same
 * rule that puts position-less ids last, rather than two different tiebreaks
 * depending on why position was silent. Pinned in both directions below.
 */

import { describe, it, expect } from 'vitest'

import { orderOptionIdsByCanvasPosition } from '../stableOptionNumbers'

/** A node carrying only what the ordering reads. */
function at(id: string, x: number, y: number) {
  return { id, position: { x, y } }
}

describe('orderOptionIdsByCanvasPosition', () => {
  it('orders row-major — top row left-to-right, then the next row down', () => {
    const nodes = [
      at('opt_b', 300, 100),
      at('opt_a', 100, 100),
      at('opt_d', 200, 400),
      at('opt_c', 50, 400),
    ]

    // PRECONDITION (trap 13b — a discriminator must pin its own precondition):
    // the caller order below is the exact REVERSE of the expected result, so a
    // function that ignored position entirely could not produce it by accident.
    const callerOrder = ['opt_d', 'opt_c', 'opt_b', 'opt_a']
    expect([...callerOrder].reverse()).toEqual(['opt_a', 'opt_b', 'opt_c', 'opt_d'])

    expect(orderOptionIdsByCanvasPosition(callerOrder, nodes)).toEqual([
      'opt_a',
      'opt_b',
      'opt_c',
      'opt_d',
    ])
  })

  it('⭐ CONTROL: position beats caller order — the same nodes, either caller order, one result', () => {
    const nodes = [at('opt_left', 0, 0), at('opt_right', 500, 0)]

    const forwards = orderOptionIdsByCanvasPosition(['opt_left', 'opt_right'], nodes)
    const backwards = orderOptionIdsByCanvasPosition(['opt_right', 'opt_left'], nodes)

    expect(forwards).toEqual(['opt_left', 'opt_right'])
    expect(backwards).toEqual(['opt_left', 'opt_right'])
    // The pair is the point: one alone would pass for a function that simply
    // echoed its input, the other for one that simply reversed it.
    expect(backwards).toEqual(forwards)
  })

  it('treats nodes within the shared y-tolerance as ONE row, ordered by x', () => {
    // 8px apart vertically — the same visual row, so x decides.
    const nodes = [at('opt_p', 200, 100), at('opt_q', 50, 108)]

    expect(orderOptionIdsByCanvasPosition(['opt_p', 'opt_q'], nodes)).toEqual(['opt_q', 'opt_p'])
  })

  it('pins the tolerance BOUNDARY inherited from groupByYRow (10px): 10 is one row, 11 is two', () => {
    // AT the tolerance: one row, so the LEFT node (x=100) comes first.
    const sameRow = [at('opt_s', 500, 0), at('opt_t', 100, 10)]
    expect(orderOptionIdsByCanvasPosition(['opt_s', 'opt_t'], sameRow)).toEqual([
      'opt_t',
      'opt_s',
    ])

    // ONE PIXEL OVER: two rows, so the HIGHER node comes first and x is
    // irrelevant — the opposite answer from the same caller order and
    // near-identical geometry. A hand-copied or drifted tolerance flips this.
    const twoRows = [at('opt_s', 500, 0), at('opt_t', 100, 11)]
    expect(orderOptionIdsByCanvasPosition(['opt_s', 'opt_t'], twoRows)).toEqual([
      'opt_s',
      'opt_t',
    ])
  })

  it('breaks an exact-position tie by CALLER order, not by node id', () => {
    // Both cards at the same point: the canvas cannot distinguish them, so the
    // caller's membership order survives. Asserted in BOTH directions — a
    // lexicographic-by-id tiebreak would return ['opt_a','opt_z'] every time.
    const nodes = [at('opt_z', 0, 0), at('opt_a', 0, 0)]

    expect(orderOptionIdsByCanvasPosition(['opt_z', 'opt_a'], nodes)).toEqual(['opt_z', 'opt_a'])
    expect(orderOptionIdsByCanvasPosition(['opt_a', 'opt_z'], nodes)).toEqual(['opt_a', 'opt_z'])
  })

  it('puts ids with no matching node LAST, in caller order', () => {
    const nodes = [at('opt_placed', 100, 100)]

    expect(
      orderOptionIdsByCanvasPosition(['opt_ghost', 'opt_placed', 'opt_phantom'], nodes),
    ).toEqual(['opt_placed', 'opt_ghost', 'opt_phantom'])
  })

  it('treats a node with no usable position as position-less (last, caller order)', () => {
    const nodes = [
      at('opt_placed', 100, 100),
      { id: 'opt_nopos' } as { id: string; position?: { x: number; y: number } },
      { id: 'opt_nan', position: { x: Number.NaN, y: 0 } },
    ]

    expect(
      orderOptionIdsByCanvasPosition(['opt_nan', 'opt_nopos', 'opt_placed'], nodes),
    ).toEqual(['opt_placed', 'opt_nan', 'opt_nopos'])
  })

  it('returns the caller order unchanged when no option has a position', () => {
    expect(orderOptionIdsByCanvasPosition(['opt_b', 'opt_a'], [])).toEqual(['opt_b', 'opt_a'])
    expect(orderOptionIdsByCanvasPosition(['opt_b', 'opt_a'], undefined)).toEqual([
      'opt_b',
      'opt_a',
    ])
  })

  it('ignores nodes that are not in the id list', () => {
    // Factors, the goal node and every other kind sit in the same `nodes`
    // array. Only the ids the caller named may take an ordinal.
    const nodes = [
      at('factor_1', 0, 0),
      at('goal', 10, 0),
      at('opt_b', 300, 500),
      at('opt_a', 100, 500),
    ]

    expect(orderOptionIdsByCanvasPosition(['opt_b', 'opt_a'], nodes)).toEqual(['opt_a', 'opt_b'])
  })
})
