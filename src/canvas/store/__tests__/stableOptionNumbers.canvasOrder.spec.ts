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

import { orderOptionIdsByCanvasPosition, assignStableOptionNumbers } from '../stableOptionNumbers'

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

  it('⭐ CONTROL: position beats caller order WHEN THE ROW ANCHORS AGREE', () => {
    // ⚠ SCOPED, because the unqualified claim is FALSE and a review measured it.
    // `groupByYRow` seeds each row's anchor in INPUT order, so three nodes at
    // y=100/108/116 — all inside the shared tolerance, but no two exactly equal —
    // can group differently depending on the order they arrive in. Reachable
    // after a manual drag, though not from a laid-out graph, whose rows share an
    // exact y. This fixture uses one row at a single y, where the claim holds.
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

describe('⚠ THE BOUNDARY: ordinals freeze at mint, and a re-layout can desynchronise them', () => {
  // ⭐ THIS IS NOT A BUG REPORT DISGUISED AS A TEST. It pins the actual contract
  // so the next reader does not have to discover it from a screenshot.
  //
  // `Option N` is POSITIONAL IDENTITY AT MINT, and identity is the whole point:
  // the numbers are append-only and are never recomputed, so a card keeps its
  // number across a re-run, a rename, and a reload. That is what makes "Option 3"
  // mean the same card in the panel and on the canvas.
  //
  // The price is that a LATER re-layout — the ordinary conversational edit loop
  // re-runs one — can move a card without moving its number, so reading order and
  // ordinal drift apart. A review measured exactly that: a re-layout produced
  // `1, 3, 4, 2`, and inserting an option mid-row produced `1, 5, 2, 3, 4` — the
  // same SHAPE as the `1, 2, 4, 5, 3` originally reported.
  //
  // ⚠ So this change makes the badges correct AT FIRST RENDER, where they were
  // previously wrong from the first render. It does not make them correct
  // forever, and claiming otherwise would be the overclaim this file exists to
  // avoid. Re-sorting on every layout is NOT the fix — it would destroy the one
  // property identity exists to provide, and the no-renumber contract is pinned
  // elsewhere. The open product question — whether a canvas card should carry a
  // numeral at all, given the panel already owns identity — is the founder's,
  // and is rowed rather than answered here.

  it('a re-layout does NOT renumber — the freeze holds, and the drift is the price', () => {
    // ⚠ THIS TEST WAS WRONG IN ITS FIRST FORM AND A REVIEW MEASURED IT. Both
    // calls passed `{}` as `previous`, so the keep-existing branch never ran:
    // deleting the freeze entirely left it GREEN while its own title claimed to
    // be about why cards are not renumbered. It re-proved position-sensitivity,
    // which this file already pins five times over.
    //
    // Repaired by passing the minted map back in, so the assertion is now ABOUT
    // the freeze rather than beside it.
    const atMint = [at('opt_a', 0, 0), at('opt_b', 300, 0), at('opt_c', 600, 0)]
    const minted = assignStableOptionNumbers(
      {},
      orderOptionIdsByCanvasPosition(['opt_a', 'opt_b', 'opt_c'], atMint),
    )
    expect(minted).toEqual({ opt_a: 1, opt_b: 2, opt_c: 3 })

    // A re-layout permutes the row. The ordinals are handed back in, as the
    // store hands them back in, and must not move.
    const afterRelayout = [at('opt_c', 0, 0), at('opt_a', 300, 0), at('opt_b', 600, 0)]
    const afterFreeze = assignStableOptionNumbers(
      minted,
      orderOptionIdsByCanvasPosition(['opt_a', 'opt_b', 'opt_c'], afterRelayout),
    )
    expect(afterFreeze, 'a re-layout must not renumber an existing card').toEqual(minted)

    // THE PRECONDITION, pinned in-test: a fresh mint at the new positions gives a
    // DIFFERENT answer. Without this the freeze assertion above would also pass
    // if the two layouts happened to agree, and would prove nothing.
    const ifReminted = assignStableOptionNumbers(
      {},
      orderOptionIdsByCanvasPosition(['opt_a', 'opt_b', 'opt_c'], afterRelayout),
    )
    expect(ifReminted).toEqual({ opt_c: 1, opt_a: 2, opt_b: 3 })
    expect(
      ifReminted,
      'the two layouts must genuinely disagree, or the freeze proves nothing',
    ).not.toEqual(minted)

    // ⭐ And that difference IS the drift, stated rather than hidden: after this
    // re-layout the cards read 2, 3, 1 left to right. Correct at first render,
    // not correct forever. Re-sorting would destroy identity, which is the one
    // property these numbers exist to provide.
    const leftToRight = ['opt_c', 'opt_a', 'opt_b'].map((id) => afterFreeze[id])
    expect(leftToRight).toEqual([3, 1, 2])
  })

  it('append-only: a new id takes max+1 wherever it lands, it does not renumber the row', () => {
    const existing = { opt_a: 1, opt_b: 2, opt_c: 3 }
    // The new card lands in the MIDDLE of the row by position...
    const nodes = [at('opt_a', 0, 0), at('opt_new', 150, 0), at('opt_b', 300, 0), at('opt_c', 600, 0)]
    const next = assignStableOptionNumbers(
      existing,
      orderOptionIdsByCanvasPosition(['opt_a', 'opt_new', 'opt_b', 'opt_c'], nodes),
    )
    // ...and still takes 4, leaving every existing card's number untouched.
    expect(next).toEqual({ opt_a: 1, opt_new: 4, opt_b: 2, opt_c: 3 })
    for (const [id, n] of Object.entries(existing)) {
      expect(next[id], `${id} must keep its identity`).toBe(n)
    }
  })
})
