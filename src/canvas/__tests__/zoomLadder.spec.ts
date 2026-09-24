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
 *
 * ⛔ THE SECOND BOUNDARY MOVED (gap-audit row 3, `canvas/gap-landing-normal`,
 * 24 Sep 2026: "the landing view counts as Normal zoom"). `ICON_LEGIBLE_ZOOM`'s
 * derivation above is still true and still pinned — it is a real design-system
 * fact — but it stopped being the question `resolveLodRung` asks, because every
 * glyph the `full`/`quiet` boundary gates (the coaching icon, the rail's data
 * icons, the driver cue) is counter-scaled, and "a 14px mark rendered at zoom z
 * occupies 14z screen pixels" describes an UNSCALED mark. The boundary
 * `resolveLodRung` now uses is `LABEL_LEGIBLE_ZOOM` — the same floor the
 * landing fit is clamped to, so a fresh model's first sight is always `full`.
 * See `zoomLegibility.ts`'s `resolveLodRung` header for the full argument.
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
  LOD_BODY_HIDDEN_ZOOM,
  LOD_BODY_RESTORED_ZOOM,
  fitBoundsFor,
  labelCounterScale,
} from '../utils/zoomLegibility'
import { isLodZoom } from '../components/LodSync'
import { CANVAS_TYPE_PX } from '../../styles/typography'

describe('the ladder is ordered, and the order is the whole design', () => {
  /**
   * ⛔ THIS PAIR NO LONGER DESCRIBES `resolveLodRung`'S OWN BOUNDARIES
   * (gap-audit row 3, `canvas/gap-landing-normal`, 24 Sep 2026: "the landing
   * view counts as Normal zoom"). `ICON_LEGIBLE_ZOOM` and `LABEL_LEGIBLE_ZOOM`
   * are still real, ordered, derived constants — that fact is worth keeping
   * pinned, so a future edit cannot silently invert or collapse them — but the
   * rung's own `full` floor moved to `LABEL_LEGIBLE_ZOOM` itself. The
   * boundary-pair tests below now pin the boundary `resolveLodRung` actually
   * uses; the real ladder order (`LOD_BODY_HIDDEN_ZOOM < LABEL_LEGIBLE_ZOOM`)
   * is pinned in `'the margin is non-empty'`, further down this file.
   */
  it('ICON_LEGIBLE_ZOOM and LABEL_LEGIBLE_ZOOM stay ordered, even though only one of them is a rung boundary now', () => {
    expect(LABEL_LEGIBLE_ZOOM).toBeLessThan(ICON_LEGIBLE_ZOOM)
    expect(ICON_LEGIBLE_ZOOM).toBeLessThanOrEqual(AUTO_FIT_MAX_ZOOM)
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
  it('the BODY cliff: below is `line`, at is `quiet` — and it is no longer the legibility floor', () => {
    // ⚠ THIS PAIR MOVED, DELIBERATELY. It straddled LABEL_LEGIBLE_ZOOM while the
    // presentation cliff and the counter-scale floor were one number. They are
    // now two (see the separation test below), so the pair straddles the cliff
    // it actually names. `0.4999` is no longer `line`: that value sits in the
    // new margin, which is the entire point of the change — the camera the
    // product parks at 0.5 must have somewhere to go before the board collapses.
    expect(resolveLodRung(LOD_BODY_HIDDEN_ZOOM * 0.999)).toBe('line')
    expect(resolveLodRung(LOD_BODY_HIDDEN_ZOOM)).toBe('quiet')
    expect(resolveLodRung(0.4999), 'the old cliff value now sits inside the margin').toBe('quiet')
  })

  /**
   * ⛔ THIS WAS THE ICON FLOOR (`ICON_LEGIBLE_ZOOM`, 10/14 ≈ 0.714). Gap-audit
   * row 3 moved the `full` boundary to `LABEL_LEGIBLE_ZOOM` — the same floor
   * the landing fit is clamped to — so a fresh model's first-sight zoom
   * (~0.5–0.53) is `full`, not `quiet`. See `zoomLegibility.ts`'s
   * `resolveLodRung` header for the full argument: every glyph this rung gates
   * is counter-scaled, so the old derivation ("an UNSCALED 14px mark") never
   * described what it was gating.
   */
  it('the Normal-rung floor: below is `quiet`, at is `full` — and it is the landing floor', () => {
    // 0.4999 / 0.5001 straddle LABEL_LEGIBLE_ZOOM, so this pair bites a
    // one-ten-thousandth move in either direction.
    expect(resolveLodRung(0.4999)).toBe('quiet')
    expect(resolveLodRung(0.5001)).toBe('full')
    expect(resolveLodRung(LABEL_LEGIBLE_ZOOM)).toBe('full')
    // ICON_LEGIBLE_ZOOM is comfortably inside `full` now — it did not become
    // `quiet`'s boundary moving the other way, it simply stopped being a
    // boundary at all.
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

  /**
   * ⭐⭐⭐ THIS ASSERTION IS DELIBERATELY INVERTED, AND THE OLD ONE DID ITS JOB.
   *
   * It read: "If the rung resolver ever grows a second opinion about the FLOOR,
   * this reds — the floor is not this PR's to move." It was right to pin that,
   * and it is the reason this change had to be argued rather than slipped in.
   *
   * ⛔ THIS IS THE PR WHOSE JOB IT IS TO MOVE IT, on measured evidence. While
   * the LOD cliff and the legibility floor were ONE number, the product's own
   * auto-fit — floored at `LABEL_LEGIBLE_ZOOM` by `fitBoundsFor('product')` —
   * PARKED THE CAMERA EXACTLY ON THE CLIFF, measured 0.5 in 10 of 10 committed
   * starter x viewport rows. Downward travel to the flip was nil, and the
   * founder hit it immediately in manual testing on 19 Sep: "you only have to
   * zoom in a little bit for the graph to change to the small coloured option."
   *
   * They are now two questions with two names (CLAUDE.md trap 21):
   *   `isLodZoom` / `labelsRenderedAtZoom`  → the COUNTER-SCALE floor, unmoved
   *   `resolveLodRung`                      → the PRESENTATION cliff, lowered
   *
   * So the sweep now pins the SEPARATION, with the band where they deliberately
   * disagree asserted by name. Agreement is no longer the property; a correct
   * and stated disagreement is.
   */
  it('is SEPARATE from `isLodZoom` — and the separation is exactly the new margin', () => {
    // Above the legibility floor the two still agree: labels render, body shows.
    for (const z of [0.5, 0.6, 0.7139, 0.7143, 0.9, 1, 2, 4]) {
      expect(resolveLodRung(z) === 'line', `rung and isLodZoom should agree at ${z}`).toBe(isLodZoom(z))
    }

    // ⭐ THE MARGIN ITSELF. In [LOD_BODY_HIDDEN_ZOOM, LABEL_LEGIBLE_ZOOM) the
    // counter-scale has stopped compensating (isLodZoom true) but the card still
    // shows its body (rung is NOT 'line'). That band IS the fix — it is the
    // travel the founder had none of.
    for (const z of [LOD_BODY_HIDDEN_ZOOM, 0.45, 0.49, 0.4999]) {
      expect(isLodZoom(z), `isLodZoom should be true below the legibility floor at ${z}`).toBe(true)
      expect(resolveLodRung(z), `the body must still be shown at ${z} — this is the margin`).not.toBe('line')
    }

    // Below the new cliff they agree again.
    for (const z of [0.1, 0.25, 0.4]) {
      expect(resolveLodRung(z), `body must be hidden at ${z}`).toBe('line')
      expect(isLodZoom(z)).toBe(true)
    }
  })

  it('the margin is non-empty — a zero-width band would make the fix a no-op', () => {
    // Without this, a cliff drifting up to the floor would silently restore the
    // old behaviour with every other assertion here still green.
    expect(LOD_BODY_HIDDEN_ZOOM).toBeLessThan(LABEL_LEGIBLE_ZOOM)
    expect(LOD_BODY_RESTORED_ZOOM).toBeGreaterThan(LOD_BODY_HIDDEN_ZOOM)
  })

  /**
   * ⚠ THE DEAD-BAND HAS AN UPPER BOUND TOO, AND THE FIRST VERSION HAD NONE.
   * Review mutated `LOD_REENTRY_MARGIN` to 1.45 and the whole suite stayed GREEN
   * — which would push the re-entry point ABOVE the legibility floor. A body
   * hidden below 0.4167 would then refuse to come back until 0.604, so a user
   * zooming back in would pass the floor, see text at full declared size, and
   * still be looking at reduced cards. A dead-band bounded on one side only is
   * half a guard.
   */
  it('the re-entry point stays BELOW the legibility floor', () => {
    expect(
      LOD_BODY_RESTORED_ZOOM,
      'the hysteresis re-entry is above the legibility floor — a card would stay reduced at a zoom where its text is already at full size',
    ).toBeLessThan(LABEL_LEGIBLE_ZOOM)
  })

  /**
   * ⭐ THE CLIFF IS DERIVED, AND THIS IS WHAT MAKES THAT CLAIM CHECKABLE.
   * It must equal the zoom at which body text reaches the DS floor — not a
   * ratio someone liked. The first version was `LABEL_LEGIBLE_ZOOM * 0.75`, a
   * picked number in a module whose argument is that thresholds are derived.
   */
  it('the cliff IS the DS text floor, not a chosen ratio', () => {
    const renderedBodyPxAtCliff =
      CANVAS_TYPE_PX.nodeLabel * labelCounterScale(LOD_BODY_HIDDEN_ZOOM) * LOD_BODY_HIDDEN_ZOOM
    expect(
      renderedBodyPxAtCliff,
      'the body cliff is no longer the point where body text hits CANVAS_TEXT_FLOOR_PX — it has become a picked number again',
    ).toBeCloseTo(CANVAS_TEXT_FLOOR_PX, 6)
  })

  it('⭐ the auto-fit parking zoom is INSIDE the shown-body band, not on its edge', () => {
    // The whole defect in one assertion. `fitBoundsFor('product')` floors the
    // product's own fit at LABEL_LEGIBLE_ZOOM, so this is where the camera lands
    // on any model too large to fit above it. It must not be the flip point.
    const parked = fitBoundsFor('product').minZoom
    expect(parked, 'the product fit must declare a floor').toBeTypeOf('number')
    expect(resolveLodRung(parked as number), 'the parked camera must show card bodies').not.toBe('line')
    expect(parked as number, 'the parked camera must sit strictly above the cliff, not on it').toBeGreaterThan(
      LOD_BODY_HIDDEN_ZOOM,
    )
  })

  /**
   * Derived from the two exported boundaries rather than restated: the re-entry
   * margin itself is module-private by design, and a second copy of the number
   * here would be the mirror this file exists to prevent.
   */
  const LOD_REENTRY_MARGIN_FOR_TEST = LOD_BODY_RESTORED_ZOOM / LOD_BODY_HIDDEN_ZOOM

  describe('hysteresis — the rung must not flap on a camera resting at the boundary', () => {
    it('holds `line` until the zoom clears the re-entry point', () => {
      // Coming UP from a hidden body, a zoom just above the cliff must NOT
      // restore it — that is the dead-band. Without it, sub-pixel jitter on a
      // trackpad pinch alternates the entire board.
      const justAbove = LOD_BODY_HIDDEN_ZOOM * 1.01
      expect(justAbove).toBeLessThan(LOD_BODY_RESTORED_ZOOM)
      expect(resolveLodRung(justAbove, 'line'), 'should still be line inside the dead-band').toBe('line')
      expect(resolveLodRung(LOD_BODY_RESTORED_ZOOM, 'line'), 'should restore at the re-entry point').not.toBe('line')
    })

    it('an alternating camera produces a STABLE rung — the founder-facing property', () => {
      // A camera resting on the old boundary produced a genuine alternation, and
      // the store's skip-if-same cannot suppress an alternation, only a repeat.
      let rung = resolveLodRung(LOD_BODY_HIDDEN_ZOOM * 1.02, 'line')
      const seen = new Set([rung])
      for (const z of [LOD_BODY_HIDDEN_ZOOM * 0.999, LOD_BODY_HIDDEN_ZOOM * 1.02, LOD_BODY_HIDDEN_ZOOM * 1.001]) {
        rung = resolveLodRung(z, rung)
        seen.add(rung)
      }
      expect(seen.size, `the rung flapped across ${[...seen].join(' -> ')} on a jittering camera`).toBe(1)
    })

    /**
     * ⚠ THE UPPER DEAD-BAND HAD ZERO COVERAGE AND THE CODE WAS CORRECT ANYWAY —
     * which is the worst combination, because nothing would have noticed it
     * going. Review deleted the branch outright and the suite came back
     * IDENTICAL to the control: `resolveLodRung(…, 'full')` appeared 0 times in
     * the whole suite against a contrast of 4 for `(…, 'line')`.
     *
     * "Both boundaries now hold" was true of the code and false of the tests.
     */
    // ⛔ "THE ICON RE-ENTRY POINT" IS NOW THE NORMAL/LANDING RE-ENTRY POINT
    // (gap-audit row 3, 24 Sep 2026). The dead-band this pair pins still hangs
    // off the SAME `previous === 'full'` branch in `resolveLodRung`; only the
    // boundary it defends moved, from `ICON_LEGIBLE_ZOOM` to
    // `LABEL_LEGIBLE_ZOOM`.
    it('holds `full` until the zoom drops clear of the Normal-rung re-entry point', () => {
      // ⚠ PRECONDITION PINNED IN-TEST, matching the lower trio this mirrors. If
      // the re-entry margin ever narrowed past this probe, `justBelow` would sit
      // OUTSIDE the dead-band and the assertion would pass by testing nothing —
      // a discriminator whose discrimination depends on an unpinned fixture
      // (CLAUDE.md trap 13b).
      const justBelow = LABEL_LEGIBLE_ZOOM * 0.999
      expect(
        justBelow,
        'the probe is outside the dead-band, so this test would pass without discriminating',
      ).toBeGreaterThan(LABEL_LEGIBLE_ZOOM / LOD_REENTRY_MARGIN_FOR_TEST)
      expect(
        resolveLodRung(justBelow, 'full'),
        'coming down from `full`, a zoom just below the landing floor must NOT drop to `quiet` — that is the dead-band',
      ).toBe('full')
      expect(
        resolveLodRung(LABEL_LEGIBLE_ZOOM * 0.9, 'full'),
        'past the re-entry margin it must drop',
      ).toBe('quiet')
    })

    it('the chips do not flap on a camera resting at the Normal-rung (landing) floor', () => {
      // The founder-facing property, at the boundary `quiet` now actually
      // spends: the action chips unmount there, so an alternation is visible.
      let rung = resolveLodRung(LABEL_LEGIBLE_ZOOM * 1.001, 'full')
      const seen = new Set([rung])
      for (const z of [LABEL_LEGIBLE_ZOOM * 0.999, LABEL_LEGIBLE_ZOOM * 1.001, LABEL_LEGIBLE_ZOOM * 0.9995]) {
        rung = resolveLodRung(z, rung)
        seen.add(rung)
      }
      expect(seen.size, `the rung flapped across ${[...seen].join(' -> ')} at the landing floor`).toBe(1)
    })

    it('stateless callers are unaffected — the dead-band needs a previous rung', () => {
      // A spec or selector asking "what rung is this zoom?" must get the plain
      // answer, never a stale opinion from a render it did not perform.
      const inBand = LOD_BODY_HIDDEN_ZOOM * 1.01
      expect(resolveLodRung(inBand)).not.toBe('line')
      expect(resolveLodRung(inBand, 'line')).toBe('line')
    })
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
