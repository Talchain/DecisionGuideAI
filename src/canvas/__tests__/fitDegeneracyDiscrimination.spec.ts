/**
 * ⭐⭐ THE FIT CEILING ANSWERS ONE QUESTION, AND THE MECHANISM IS INERT UNTIL
 * SOMETHING ELSE IS FIXED — both halves pinned here.
 *
 * `AUTO_FIT_MAX_ZOOM` was a blanket cap on every product fit, doing two jobs
 * under one name (CLAUDE.md trap 21): *"do not magnify a DEGENERATE box"*
 * (correct, load-bearing, stops a witnessed 328%) and *"do not scale a VALID box
 * up to a wide pane"* (wrong — the measured cause of a model occupying ~61% of a
 * 1730px screen while Founder Ruling R1 names the camera as the answer to
 * viewport width).
 *
 * ⛔ THE CALLER DOES NOT PASS THE VERDICT YET, ON PURPOSE. Flipping it exposes a
 * defect that lives in the ReactFlow ELEMENT's own bare `fitView` prop
 * (`maxZoom={4}`), which fires while the box is still degenerate — measured at
 * 313% on a local dev build against 100% for the same starter on staging. The
 * blanket cap has been silently acting as a NET for that over-magnification, so
 * removing it EXPOSES the defect rather than causing it. See
 * `useFitViewOnLayoutVersion.ts` for the three-arm measurement.
 *
 * These cases therefore pin the mechanism AND its inertness, so the day the
 * element fit is repaired the flip is a one-line change with its behaviour
 * already guarded.
 */
import { describe, it, expect } from 'vitest'
import {
  fitBoundsFor,
  layoutBoxIsDegenerate,
  LABEL_LEGIBLE_ZOOM,
  AUTO_FIT_MAX_ZOOM,
  MAX_LABEL_COUNTER_SCALE,
} from '../utils/zoomLegibility'

/** Every drafted node arrives at the origin — `applyDraftResult.ts:50`. */
const STACKED_AT_ORIGIN = [
  { position: { x: 0, y: 0 } },
  { position: { x: 0, y: 0 } },
  { position: { x: 0, y: 0 } },
]

/** The same graph once ELK has placed it. */
const LAID_OUT = [
  { position: { x: 0, y: 0 } },
  { position: { x: 424, y: 0 } },
  { position: { x: 212, y: 188 } },
]

describe('layoutBoxIsDegenerate — positional, because the cause is positional', () => {
  it('⛔ nodes stacked at the origin are degenerate, even though each is measurable', () => {
    /**
     * ⚠ THIS IS THE CASE A MEASUREMENT-BASED TEST CANNOT SEE. At the instant the
     * element fit fires, nodes can be fully measured and still all sit at
     * {0,0} — so `nodesInitialized` and node dimensions both read healthy while
     * the bounding box has no extent. Only position discriminates it.
     */
    expect(layoutBoxIsDegenerate(STACKED_AT_ORIGIN)).toBe(true)
  })

  it('a laid-out graph is not degenerate', () => {
    expect(layoutBoxIsDegenerate(LAID_OUT)).toBe(false)
  })

  it('⚠ fewer than two nodes is degenerate — one card carries no extent to fit against', () => {
    expect(layoutBoxIsDegenerate([])).toBe(true)
    expect(layoutBoxIsDegenerate([{ position: { x: 10, y: 10 } }])).toBe(true)
  })

  it('CONTRAST CONTROL: two distinct positions is the whole difference', () => {
    /**
     * ⭐ The pair differs by ONE coordinate. Without this, every case above
     * would be consistent with a predicate that always returned `true` for
     * short arrays and `false` for long ones, i.e. counting rather than
     * discriminating (CLAUDE.md trap 20).
     */
    expect(layoutBoxIsDegenerate([{ position: { x: 5, y: 5 } }, { position: { x: 5, y: 5 } }])).toBe(true)
    expect(layoutBoxIsDegenerate([{ position: { x: 5, y: 5 } }, { position: { x: 6, y: 5 } }])).toBe(false)
  })

  it('unusable coordinates are ignored rather than counted as distinct', () => {
    // A node with no readable position must not make a degenerate box look valid.
    expect(
      layoutBoxIsDegenerate([
        { position: { x: 0, y: 0 } },
        { position: { x: Number.NaN, y: 0 } },
        { position: null },
      ] as never),
    ).toBe(true)
  })
})

describe('fitBoundsFor — the ceiling, and the fail-closed default that keeps it inert', () => {
  it('⛔ THE DEFAULT IS TODAY’S BEHAVIOUR, BYTE FOR BYTE', () => {
    /**
     * ⭐⭐ THE LOAD-BEARING CASE WHILE THE MECHANISM IS DORMANT. Every existing
     * caller omits the second argument, so this is what actually ships. If this
     * ever stops equalling the explicit-degenerate call, the mechanism has
     * turned itself on without anyone deciding to.
     */
    expect(fitBoundsFor('product')).toEqual({
      minZoom: LABEL_LEGIBLE_ZOOM,
      maxZoom: AUTO_FIT_MAX_ZOOM,
    })
    expect(fitBoundsFor('product')).toEqual(fitBoundsFor('product', true))
  })

  it('a DEGENERATE box keeps the hard clamp', () => {
    expect(fitBoundsFor('product', true).maxZoom).toBe(AUTO_FIT_MAX_ZOOM)
  })

  it('a VALID box may fill the pane, bounded by the counter-scale rather than a new literal', () => {
    /**
     * ⚠ THE BOUND IS DERIVED. `MAX_LABEL_COUNTER_SCALE` is already the product's
     * statement of how far rendered text may deviate from its declared size, so
     * using it above 1 makes the bound symmetric — text may be magnified as far
     * up as the ladder magnifies it down. A third zoom literal is forbidden
     * outright by `zoomLegibilitySingleSource.spec.ts`.
     */
    expect(fitBoundsFor('product', false).maxZoom).toBe(MAX_LABEL_COUNTER_SCALE)
    expect(fitBoundsFor('product', false).maxZoom).toBeGreaterThan(AUTO_FIT_MAX_ZOOM)
  })

  it('a USER fit is unchanged and still carries NEITHER bound', () => {
    // The absence is the opinion — the only limits on a view the user asked for
    // are the canvas instance's own. The degeneracy argument does not reach it.
    expect(fitBoundsFor('user')).toEqual({})
    expect(fitBoundsFor('user', false)).toEqual({})
    expect(fitBoundsFor('user', true)).toEqual({})
  })
})
