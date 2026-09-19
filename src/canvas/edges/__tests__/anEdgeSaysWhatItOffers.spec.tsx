/**
 * ⭐⭐ THE PRODUCT'S ONLY STANDING WORD FOR ITS EDGE EDITOR SAID "INSPECT".
 *
 * MEASURED ON THE FOUNDER'S SESSION, 19 Sep 2026 (`olumi-debug-12928b8c`):
 * 27 actions over 34 minutes, EVERY ONE a chat message or a chip click, and not
 * one direct edit — while `edgeStrengthEditIsAssertable` returns true for 24 of
 * his 26 edges. **The control worked the whole time.**
 *
 * ⚠ AND THE FIRST-RUN HINT CANNOT CARRY THE DISCOVERY. `useEdgeEditHint` shows
 * a WORDLESS pulse, on `isFirstEdge` only, for five seconds, dismissing itself
 * on a timer whether or not anyone saw it — then persists `edgeEditShown` to
 * localStorage ONCE EVER. For anyone who has opened this product before, that
 * hint was spent long ago and the hover sentence is all that remains.
 *
 * ⛔ THE WORD WAS STALE, NOT WRONG WHEN WRITTEN. Its comment cited a panel that
 * was read-only behind an unconditional `<fieldset disabled>`. That fence was
 * removed; the word was not. Same defect class as the `techMode` JSDoc that
 * caused a misdiagnosis earlier the same day — but user-facing.
 *
 * ⚠ BOTH DIRECTIONS ARE ASSERTED. Promising an edit where the write cannot land
 * is the worse failure of the two: every risk -> goal edge is refused today,
 * and a label offering to set a strength there would send a person to a fenced
 * control with no explanation.
 */
import { describe, it, expect } from 'vitest'
import { edgeStrengthEditIsAssertable } from '../../conversation/edgeStrengthEdit'
import { edgeDoubleClickAffordance, EDGE_AFFORDANCE_EDITABLE, EDGE_AFFORDANCE_READ_ONLY } from '../edgeAffordance'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SOURCE = readFileSync(resolve(process.cwd(), 'src/canvas/edges/StyledEdge.tsx'), 'utf8')

/** Verbatim from the capture — an edge that CAN take an edit. */
const CARRIABLE = {
  id: 'e-0', source: '0e4043a0', target: 'b1d7d19a',
  data: { strength_mean: 1, effect_direction: 'positive' },
}
/** Verbatim from the capture — a risk -> goal edge, refused by the contract. */
const REFUSED = {
  id: 'e-10', source: '0bcb0dd7', target: 'f4ab20b2',
  data: { strength_mean: 0.35, effect_direction: 'negative' },
}

describe('an edge says what it offers', () => {
  it('⭐ PRECONDITION: the two fixtures genuinely divide, or every claim below is vacuous', () => {
    expect(edgeStrengthEditIsAssertable(CARRIABLE as never)).toBe(true)
    expect(edgeStrengthEditIsAssertable(REFUSED as never)).toBe(false)
  })

  it('⭐ BY EXECUTION: a carriable edge is offered the EDIT, a refused one is not', () => {
    // ⚠ THIS ASSERTION EXISTS BECAUSE THE SOURCE SCAN BELOW COULD NOT SEE THE
    // WORSE FAILURE. A mutant forcing the predicate to `true` — promising an
    // edit on every edge, including those whose write cannot land — left the
    // source text unchanged and every scan GREEN.
    expect(edgeDoubleClickAffordance(CARRIABLE as never)).toBe(EDGE_AFFORDANCE_EDITABLE)
    expect(edgeDoubleClickAffordance(REFUSED as never)).toBe(EDGE_AFFORDANCE_READ_ONLY)
    // And they must genuinely differ, or the pair proves nothing.
    expect(EDGE_AFFORDANCE_EDITABLE).not.toBe(EDGE_AFFORDANCE_READ_ONLY)
  })

  it('⛔ an absent or malformed edge never gets the promise', () => {
    for (const bad of [undefined, null, {}, { id: 'x' }]) {
      expect(edgeDoubleClickAffordance(bad as never)).toBe(EDGE_AFFORDANCE_READ_ONLY)
    }
  })

  it('the affordance sentence is CONDITIONAL on the same predicate the panel fences on', () => {
    // Bound to the derivation, not to a second copy of its conditions: a
    // restated rule agrees on the day it is written and drifts after.
    expect(SOURCE).toContain('edgeDoubleClickAffordance')
  })

  it('⛔ "inspect" is no longer the UNCONDITIONAL word', () => {
    // The exact shape that shipped: one template literal ending in the old
    // sentence for every edge, editable or not.
    expect(SOURCE, 'the unconditional "inspect" sentence is back')
      .not.toMatch(/\\n\\nDouble-click to inspect`/)
  })

  it('⭐ the promise reaches the ASSISTIVE channel too, not just hover', () => {
    // A `title` is not keyboard-reachable and is absent on touch. Without this
    // a sighted keyboard user and a screen-reader user never learn the edge is
    // editable — the gap R13 records one level down on the strength pills.
    expect(SOURCE).toMatch(/strengthIsEditable \? `\. \$\{affordanceSentence\}` : ''/)
  })

  it('⛔ the stale read-only comment is gone, and its replacement says why', () => {
    expect(SOURCE, 'the stale "read-only authority copy" justification survives')
      .not.toMatch(/Inspector v2 owns the visible read-only authority copy\./)
    expect(SOURCE).toContain('HAD STOPPED')
  })
})
