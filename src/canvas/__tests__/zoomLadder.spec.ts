/**
 * The semantic-zoom LADDER — three rungs, two boundaries, both derived.
 *
 * WHY A THIRD RUNG EXISTS. `lodActive` was a BOOLEAN, so the canvas had exactly
 * two states: full card, or blanked body. Paul, 1 Sep 2026, on the deployed
 * build: *"the canvas gets LESS readable as the model gets bigger."* "Show whole
 * model" parks every shipped starter between 0.26 and 0.38 — measured, all ten
 * starter × viewport combinations — so the whole-model gesture lands in the
 * BLANKED half every time, and the least informative view the product can render
 * is the one a user asks for to see the shape of their model.
 *
 * A boolean has nowhere to put "smaller, but not blank". This file pins the
 * enum that makes a middle rung EXIST. It does not yet spend it: `quiet` behaves
 * exactly as `full` does at this tip, and `BaseNode.lodQuietIsNoOp.spec.tsx`
 * proves that byte-for-byte. Creating the rung and spending it are deliberately
 * two changes, because the second one is visible and needs a veto.
 *
 * WHERE THE SECOND BOUNDARY COMES FROM, AND WHY IT IS NOT A TASTE JUDGEMENT.
 * `ICON_LEGIBLE_ZOOM` is not a number anyone chose. A canvas node badge is 14px
 * (`DESIGN_SYSTEM.md` § Iconography → Sizing: *"Canvas node badge / panel inline
 * | 14px | w-3.5 h-3.5"*) and the canvas text floor is 10px (§ Typography →
 * Canvas Nodes, `edgeLabel` 10px — the smallest canvas token — and § Typography
 * → Rules, *"Panel and canvas contexts use 10–12px for information density"*).
 * A 14px mark rendered at zoom z occupies 14z screen pixels; it reaches the
 * floor at exactly 10/14. The constant is that quotient, written as that
 * quotient, so the number cannot drift from its reason.
 *
 * ⚠ NOTE WHAT THAT MAKES THIS FILE RESPONSIBLE FOR. Because the value is
 * derived, a test asserting `ICON_LEGIBLE_ZOOM === 0.714…` would be a tautology
 * dressed as a check (CLAUDE.md trap 13b — a guard agreeing with itself). What
 * is worth pinning is the ARITHMETIC IDENTITY the derivation claims, the ORDER
 * of the three rungs, and the BOUNDARY BEHAVIOUR either side of both thresholds.
 * All three are below, and each is written as a PAIR, so a boundary that moves
 * in either direction reds.
 */
import { describe, it, expect } from 'vitest'
import {
  AUTO_FIT_MAX_ZOOM,
  CANVAS_BADGE_ICON_PX,
  CANVAS_TEXT_FLOOR_PX,
  ICON_LEGIBLE_ZOOM,
  LABEL_LEGIBLE_ZOOM,
  resolveLodRung,
  lodBodyHiddenAt,
  cardControlsVisibleAt,
  selectLodBodyHidden,
} from '../utils/zoomLegibility'
import { isLodZoom } from '../components/LodSync'

describe('the ladder is ordered, and the order is the whole design', () => {
  it('runs floor → icon floor → magnification ceiling, strictly', () => {
    // If these ever transpose, `quiet` becomes an empty interval and the middle
    // rung silently stops existing — with every other test in this file still
    // green, because they would each be asserting about a band of width zero.
    expect(LABEL_LEGIBLE_ZOOM).toBeLessThan(ICON_LEGIBLE_ZOOM)
    expect(ICON_LEGIBLE_ZOOM).toBeLessThanOrEqual(AUTO_FIT_MAX_ZOOM)
  })

  it('the `quiet` band is a real, non-empty interval', () => {
    // The positive control for the assertion above: an ordering can hold while
    // the band is too narrow to contain a single reachable zoom.
    expect(ICON_LEGIBLE_ZOOM - LABEL_LEGIBLE_ZOOM).toBeGreaterThan(0.1)
  })
})

describe('ICON_LEGIBLE_ZOOM states its own derivation', () => {
  it('is exactly the zoom at which a canvas badge reaches the canvas text floor', () => {
    // THE IDENTITY, not the value. A 14px mark at zoom z is 14z screen pixels;
    // at ICON_LEGIBLE_ZOOM that is CANVAS_TEXT_FLOOR_PX, by construction. This
    // reds if anyone replaces the quotient with a rounded literal — which is the
    // realistic way this constant would rot.
    expect(CANVAS_BADGE_ICON_PX * ICON_LEGIBLE_ZOOM).toBe(CANVAS_TEXT_FLOOR_PX)
  })

  it('carries the design-system sizes it was derived from, not a copy of the answer', () => {
    expect(CANVAS_TEXT_FLOOR_PX).toBe(10)
    expect(CANVAS_BADGE_ICON_PX).toBe(14)
  })
})

describe('resolveLodRung — boundary PAIRS, either side of both thresholds', () => {
  it('the legibility floor: below is `line`, at is `quiet`', () => {
    expect(resolveLodRung(0.4999)).toBe('line')
    expect(resolveLodRung(LABEL_LEGIBLE_ZOOM)).toBe('quiet')
  })

  it('the icon floor: below is `quiet`, at is `full`', () => {
    // 0.7139 / 0.7143 straddle 10/14 = 0.71428…, so this pair bites a
    // one-ten-thousandth move in either direction.
    expect(resolveLodRung(0.7139)).toBe('quiet')
    expect(resolveLodRung(0.7143)).toBe('full')
    expect(resolveLodRung(ICON_LEGIBLE_ZOOM)).toBe('full')
  })

  it('the far ends resolve as the ends', () => {
    expect(resolveLodRung(0.1)).toBe('line')
    expect(resolveLodRung(1)).toBe('full')
    expect(resolveLodRung(4)).toBe('full')
  })

  it('NaN resolves exactly as `isLodZoom` did — the pre-existing behaviour, unchanged', () => {
    // ⚠ THIS IS A PORT, NOT A NEW OPINION. `isLodZoom` is `!(zoom >= 0.5)`, and
    // `NaN >= 0.5` is false, so a torn-down or not-yet-measured viewport read as
    // LOD-active. Asserting the two agree — rather than asserting `'line'`
    // outright — is what makes this a proof that nothing moved, and it reds if
    // either side changes independently of the other.
    expect(resolveLodRung(Number.NaN)).toBe('line')
    expect(isLodZoom(Number.NaN)).toBe(true)
    expect(resolveLodRung(Number.NaN) === 'line').toBe(isLodZoom(Number.NaN))
  })

  it('agrees with `isLodZoom` across the whole reachable zoom range', () => {
    // The anti-mirror assertion, as a sweep rather than at two points: `line` is
    // the rung the old boolean named, everywhere. If the rung resolver ever
    // grows a second opinion about the FLOOR, this reds — the floor is not this
    // PR's to move.
    const zooms = [0.1, 0.25, 0.38, 0.4999, 0.5, 0.6, 0.7139, 0.7143, 0.9, 1, 2, 4]
    for (const z of zooms) {
      expect(resolveLodRung(z) === 'line', `rung and isLodZoom disagree at ${z}`).toBe(isLodZoom(z))
    }
  })
})

describe('the two rung predicates the surfaces consume', () => {
  it('`lodBodyHiddenAt` is true at `line` only', () => {
    expect(lodBodyHiddenAt('line')).toBe(true)
    expect(lodBodyHiddenAt('quiet')).toBe(false)
    expect(lodBodyHiddenAt('full')).toBe(false)
  })

  it('`selectLodBodyHidden` defaults an absent rung to `full`, i.e. NOT hidden', () => {
    // Store doubles across ~ten spec files set the slice by hand; a double that
    // omits it must render an ordinary card, never a blanked one.
    expect(selectLodBodyHidden({ lodRung: 'line' })).toBe(true)
    expect(selectLodBodyHidden({ lodRung: 'quiet' })).toBe(false)
    expect(selectLodBodyHidden({})).toBe(false)
  })

  it('`cardControlsVisibleAt` is true at `full` only — DECLARED, and mounted by nothing yet', () => {
    // ⛔ READ THIS BEFORE TREATING THE TEST BELOW AS EVIDENCE ABOUT THE PRODUCT.
    // Nothing renders from this predicate at this tip. It is the named place the
    // veto-gated PR hangs the quiet-rung card controls on, and it is pinned here
    // so that PR starts from a definition rather than inventing one. A green
    // test about an unmounted predicate says the predicate is correct; it says
    // NOTHING about any screen (CLAUDE.md trap 13b), and this comment exists so
    // no later reader mistakes the one for the other.
    expect(cardControlsVisibleAt('full')).toBe(true)
    expect(cardControlsVisibleAt('quiet')).toBe(false)
    expect(cardControlsVisibleAt('line')).toBe(false)
  })
})
