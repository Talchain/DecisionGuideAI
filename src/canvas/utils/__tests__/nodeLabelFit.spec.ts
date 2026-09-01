/**
 * Node geometry and the canvas label scale are ONE decision.
 *
 * THE DEFECT THIS CLOSES (shipped and reverted-forward the same day, 17 Aug
 * 2026). `#758` gave canvas label text a counter-scale so it renders at its
 * DECLARED size instead of `declared x zoom` — the right fix for a real
 * legibility defect. It changed the FONT and left node geometry alone. At the
 * settle zoom the counter-scale is 2, so a title measure sized for 13px text
 * was holding 26px text, and `overflow-wrap: break-word` did what it is
 * specified to do: it split words mid-character.
 *
 * Measured in Chromium at the settle zoom, over the five shipped starters at
 * both harness viewports — 174 rendered node titles:
 *
 *     BEFORE   59 titles broke mid-word     "Stripe | Middle | ware | Extensi | on"
 *                                           "Engineeri | ng | Overload | ..."
 *     AFTER     0 titles broke mid-word
 *
 * WHAT THIS FILE CAN AND CANNOT PROVE. jsdom has no line boxes and no text
 * metrics, so no assertion here can show a word fitting. What it pins is the
 * DERIVATION — that the widths which exist to hold text are computed from the
 * same authority as the font scale, and therefore cannot drift apart again.
 * The fit itself is measured in a real browser by
 * `e2e/visual/nodeLabelFit.visual.spec.ts`, which is where a claim about what
 * a user sees belongs.
 */
import { describe, it, expect } from 'vitest'
import { LABEL_LEGIBLE_ZOOM, MAX_LABEL_COUNTER_SCALE, labelCounterScale } from '../zoomLegibility'
import {
  NODE_CARD_MAX_W,
  NODE_CARD_PADDING_X,
  NODE_HEADER_RESERVE_PX,
  NODE_LAYOUT_MIN_W,
  NODE_SINGLE_ROW_FAIR_SHARE_W,
  NODE_TITLE_MIN_MEASURE_PX,
  NODE_TITLE_WIDEST_WORD_PX,
  NODE_TITLE_RECLAIMED_PX,
} from '../nodeLayoutConstants'

/**
 * MEASURED EVIDENCE, recorded here so the geometry is bound to a real
 * measurement rather than to itself.
 *
 * Chromium, at the DECLARED node-title size of 13px (DS v5 §2.3), measured
 * against the LIVE font of a mounted node title inside the running product —
 * all 194 unbreakable runs in the five shipped starters, i.e. a corpus from
 * outside this change's author:
 *
 *     Cannibalization  97.77px      Concentration  90.19px
 *     Improvement      83.55px      RudderStack    82.05px
 *     International    80.39px      Dependency     79.45px
 *
 * ⚠ CORRECTED. This recorded 96.06px, taken from a hand-built probe span rather
 * than from a real title element; the review re-measured at 97.77px and every
 * one of its figures reproduced here to 2dp. A probe that builds its own font
 * stack is not measuring the font the product resolves — take the computed
 * style off the mounted element. The margin above the widest real word is
 * therefore **2.23px, not 3.94px**: deliberately tight, because the bound feeds
 * the card floor and every pixel of it widens every compressed card.
 */
const WIDEST_WORD_PX_AT_13 = 97.77

/**
 * ⭐ THE SAME WORD AT THE NEW DECLARED SIZE (1 Sep 2026, title 13px → 11px).
 *
 * DERIVED FROM THE AUTHORITATIVE 13px FIGURE, NOT RE-PROBED — and the reason is
 * the correction recorded above this constant. A hand-built probe span does not
 * resolve the font the product resolves: measuring "Cannibalization" that way
 * gives 95.95px where the mounted element gives 97.77px, a consistent ~1.9%
 * under-read. The header already says take it off the mounted element, and a
 * lane that re-probed here would quietly re-introduce the very bias the review
 * removed.
 *
 * ⭐ WHAT THE PROBE *IS* GOOD FOR IS THE RATIO, because a multiplicative bias
 * CANCELS in a ratio. Measured across eight runs in the live font at both
 * sizes, 11px/13px came out at 0.8462 against the arithmetic 11/13 = 0.84615 —
 * i.e. this font scales linearly to 4 decimal places, so the conversion below
 * is a scaling and not an estimate.
 *
 *     97.77 × 11/13 = 82.72px
 *
 * `NODE_TITLE_WIDEST_WORD_PX` is 85, so the margin is 2.28px — deliberately the
 * SAME tight headroom the 13px bound carried (2.23px), for the same reason:
 * every pixel here is doubled by the counter-scale and widens every compressed
 * card. The negative controls hold their relationship too: "Recommendation" and
 * "Commoditisation" exceeded the bound at 13px and still exceed it at 11px.
 */
const WIDEST_WORD_PX_AT_11 = +(WIDEST_WORD_PX_AT_13 * (11 / 13)).toFixed(2)

describe('the label scale is the geometry authority', () => {
  it('the maximum counter-scale is DERIVED from the legibility floor, not restated', () => {
    // Not a tautology: it asserts the bound is the value AT the floor, which is
    // what makes the settle zoom the worst case. A cap moved off the floor
    // (e.g. hardcoded 2 while the floor became 0.4) fails here.
    expect(MAX_LABEL_COUNTER_SCALE).toBe(labelCounterScale(LABEL_LEGIBLE_ZOOM))
    expect(MAX_LABEL_COUNTER_SCALE).toBe(1 / LABEL_LEGIBLE_ZOOM)
  })

  it('no zoom in the legible band asks for more counter-scale than the geometry is built for', () => {
    for (let zoom = LABEL_LEGIBLE_ZOOM; zoom <= 2; zoom += 0.01) {
      expect(labelCounterScale(zoom)).toBeLessThanOrEqual(MAX_LABEL_COUNTER_SCALE)
    }
    // …including below the floor, where the scale is capped rather than growing.
    expect(labelCounterScale(0.05)).toBeLessThanOrEqual(MAX_LABEL_COUNTER_SCALE)
  })

  it('the title measure carries the scale — this is the coupling #758 was missing', () => {
    // Still the #758 coupling — the measure carries the scale — with the glyph's
    // reclaimed 20px now inside the text term rather than in the header reserve.
    //
    // ⚠ THE RECLAIMED COLUMN IS ADDED OUTSIDE THE MULTIPLICATION. It is chrome,
    // not text: a fixed 20px an icon used to sit in. Inside the brackets it gets
    // counter-scaled, which silently widened every card by 20px and cost the
    // board a whole card per row — see `nodeLayoutConstants.ts` for the measured
    // consequence. Only the WIDEST WORD is text, so only the widest word scales.
    expect(NODE_TITLE_MIN_MEASURE_PX).toBe(
      NODE_TITLE_WIDEST_WORD_PX * MAX_LABEL_COUNTER_SCALE + NODE_TITLE_RECLAIMED_PX,
    )
    // ⚠ AND THE COUPLING ITSELF, ASSERTED SEPARATELY. The line above would pass
    // for a hand-set constant that happened to equal today's product; this fails
    // if the scale ever stops multiplying the measure, which is the property
    // #758 was actually missing.
    expect(NODE_TITLE_MIN_MEASURE_PX).toBeGreaterThan(
      NODE_TITLE_WIDEST_WORD_PX + NODE_TITLE_RECLAIMED_PX,
    )
  })

  it('the card floor is the title measure plus what the header row takes first', () => {
    // The glyph moved out of the title row onto the top connector (1 Sep 2026),
    // so the title surrenders nothing before layout. Asserted as an exact value
    // rather than deleted: this constant still gates `NODE_LAYOUT_MIN_W`, and a
    // future header ornament must raise it deliberately and fail here first.
    expect(NODE_HEADER_RESERVE_PX).toBe(0)
    expect(NODE_LAYOUT_MIN_W).toBe(
      NODE_TITLE_MIN_MEASURE_PX + NODE_HEADER_RESERVE_PX + NODE_CARD_PADDING_X,
    )
  })
})

describe('the derived geometry actually holds the product’s own words', () => {
  it('the measure fits the widest word in the shipped starters at the largest scale', () => {
    // The load-bearing assertion. Everything above proves the numbers agree
    // with each other; this one proves they agree with a MEASUREMENT.
    expect(NODE_TITLE_MIN_MEASURE_PX).toBeGreaterThanOrEqual(
      WIDEST_WORD_PX_AT_11 * MAX_LABEL_COUNTER_SCALE,
    )
  })

  /*
   * ⚠ THE COMPLETENESS CHECK IS NOT HERE, AND MUST NOT BE RE-ADDED HERE.
   *
   * A guard asking "does the bound still cover the corpus?" is a question about
   * PIXEL WIDTH, and jsdom has no text metrics. The first version of this file
   * substituted CHARACTER COUNT, which is a proxy that fails in the direction of
   * SILENCE — an adversarial review proved it by measurement:
   *
   *     Commoditisation  107.81px  15 chars — same length as the widest real
   *                                word, 7.81px over the bound, guard GREEN
   *     Recommendation   110.47px  14 chars — SHORTER and WIDER still
   *     Communications   106.39px  ·  Mismanagement 104.78px · Accommodation 102.91px
   *
   * Five ordinary business words with fewer characters and more pixels than the
   * bound. Any of them entering a starter re-opens mid-word breaking while the
   * guard reports success — the same defect class as the truncation it protects.
   *
   * It now lives in `e2e/visual/nodeLabelFit.visual.spec.ts`, where it measures
   * every corpus word against the live font of a mounted title, and carries the
   * five words above as a NEGATIVE CONTROL that must measure OVER the bound — so
   * the check is shown to discriminate rather than merely to pass.
   */

  it('the maximum card still affords the measure — the cap does not scale, so it is GUARDED', () => {
    // `NODE_CARD_MAX_W` is a viewport constraint, not a text measure, so it
    // deliberately does not follow the scale. That is only safe while it still
    // affords the floor. Lower `LABEL_LEGIBLE_ZOOM` far enough and this REDs
    // instead of silently reproducing #758's defect on wide cards.
    expect(NODE_CARD_MAX_W - NODE_CARD_PADDING_X - NODE_HEADER_RESERVE_PX).toBeGreaterThanOrEqual(
      NODE_TITLE_MIN_MEASURE_PX,
    )
  })
})

describe('the twin: nothing was widened by hand, and the layout policy did not move', () => {
  it('at counter-scale 1 the same derivation reproduces the shipped geometry', () => {
    // The opposite-direction twin. It is not enough that long labels now fit;
    // the change must be the SCALE COUPLING and nothing else. Evaluate the same
    // formula at scale 1 and it must land on the pre-#758 geometry (140px),
    // give or take the 4px the old hand-set measure was under-derived by.
    // The glyph's 20px column moved from the header reserve INTO the text
    // measure, so the card lands on exactly the same geometry as before while
    // the title is 20px wider. Both halves are asserted: the sum is unchanged
    // (below), and the reserve is now zero (earlier in this file). Testing only
    // one of the two would let the width silently leave the card altogether.
    const measureAt1x = NODE_TITLE_WIDEST_WORD_PX * 1 + NODE_TITLE_RECLAIMED_PX
    const cardAt1x = measureAt1x + NODE_HEADER_RESERVE_PX + NODE_CARD_PADDING_X
    // ⚠ THE BAND MOVED WITH THE FONT, AND IT HAD TO. It was [140, 145] — the
    // pre-#758 geometry at a DECLARED 13px title. The title is now 11px, so a
    // card built for it is legitimately narrower and holding the old band would
    // assert that a smaller font must produce the same card, which is the whole
    // change denied. Re-derived at the same ratio the type moved by:
    // the card does NOT scale uniformly, because only part of it is text:
    // 44px of it (20 reclaimed chrome + 24 padding) is fixed, so 144 → 129 is
    // the text half moving 100 → 85 with the chrome standing still. Asserting a
    // scaled version of the OLD CARD band would have been wrong arithmetic
    // dressed as a derivation — I wrote that first and it failed here, which is
    // the guard doing its job on the person changing it.
    // The TEXT half tracks the font: 100px @13px × 11/13 = 84.6, shipped at 85.
    // Stated as a band around the derivation so a hand-tuned value cannot creep
    // back in, and deliberately NOT as `toBe(85)`, which would agree with any
    // number this file and the source happen to share.
    const textHalfAt1x = NODE_TITLE_WIDEST_WORD_PX
    const derivedTextHalf = 100 * (11 / 13)
    expect(textHalfAt1x).toBeGreaterThanOrEqual(derivedTextHalf)
    expect(textHalfAt1x).toBeLessThanOrEqual(derivedTextHalf + 3)
    expect(cardAt1x).toBe(
      NODE_TITLE_WIDEST_WORD_PX + NODE_TITLE_RECLAIMED_PX + NODE_HEADER_RESERVE_PX + NODE_CARD_PADDING_X,
    )

    // ⭐⭐ AND THE SAME CLAIM AT THE SCALE THE PRODUCT ACTUALLY SHIPS, WHICH IS
    // THE ASSERTION THAT WAS MISSING.
    //
    // Everything above evaluates at scale 1 — and at scale 1 the defect this
    // block was written to prevent is INVISIBLE. Counter-scaling the reclaimed
    // column is a no-op when the scale is 1, so the first cut of this file
    // passed all of it while shipping a 20px-wider card at the real scale of 2.
    // A control evaluated at the one value where the fault cannot appear is not
    // a control; it is the fault's alibi.
    //
    // 244 is the SHIPPED PRE-MOVE GEOMETRY (100*2 + 20 reserve + 24 padding),
    // written as a literal on purpose: re-deriving it from the same constants
    // the product uses would make this agree with any arithmetic they happen to
    // express. The whole promise of moving the glyph is that the card does not
    // change size — so the number is pinned from BEFORE the move, and if the
    // card ever legitimately resizes this fails and someone states why.
    // ⚠ 244 → 214. The pin is re-stated, not removed: its job is to make a card
    // resize a DELIBERATE act that someone has to come here and defend, and
    // that job is done by it going red — which is exactly what happened when
    // the type scale changed. 214 = 85 (widest word @11px, rounded) × 2
    // (counter-scale) + 20 (chrome the glyph vacated) + 24 (card padding).
    // The card is 30px narrower, which is the point: more cards fit a row, so
    // the graph is shorter and more of it fits a laptop screen.
    expect(NODE_LAYOUT_MIN_W).toBe(214)
    expect(MAX_LABEL_COUNTER_SCALE).toBeGreaterThan(1)

    // …and only the TEXT measure carries the scale. The icon, its gap and the
    // card padding are not text and must NOT be inflated: doing so would widen
    // every card for no legibility gain. No hand-added slack anywhere else.
    //
    // ⚠ THE GLYPH'S RECLAIMED COLUMN JOINED THAT LIST ON 1 Sep 2026, and this
    // line is where it had to be said out loud. `measureAt1x` now carries two
    // things of different kinds — the widest WORD, which scales, and the 20px
    // the icon vacated, which does not — so the sum can no longer be written as
    // one multiplication. Spelling the two terms apart is the point: it is the
    // distinction the shipped constant got wrong.
    expect(NODE_LAYOUT_MIN_W).toBe(
      NODE_TITLE_WIDEST_WORD_PX * MAX_LABEL_COUNTER_SCALE +
        NODE_TITLE_RECLAIMED_PX +
        NODE_HEADER_RESERVE_PX +
        NODE_CARD_PADDING_X,
    )
  })

  it('the row-split policy is NOT the card floor, so the label scale cannot move a tier between branches', () => {
    // Measured 17 Aug 2026: fusing these two flipped two starters' factor tiers
    // into multi-row splitting and dragged the pre-existing same-row overlap
    // defect with them (overlap area 4,554 -> 115,988 px² on
    // headcount-allocation, 5,589 -> 140,396 px² on pricing-model). Decoupled,
    // both are byte-identical to before. This asserts they stay decoupled.
    // ⚠ RE-DERIVED 18 Aug 2026 at 6524caed: the overlap figures quoted above
    // do NOT reproduce — same-row overlap measures 0 px² in all 120 cells with
    // browser-real node heights, and removing `applyCollisionGuard` altogether
    // leaves node positions byte-identical. The 17 Aug numbers stay as the
    // dated record; see the appended note in `nodeLayoutConstants.ts` and the
    // derived invariant in `src/canvas/__tests__/layout.sameRowGap.spec.ts`.
    // The DECOUPLING this test pins is unaffected and still correct.
    expect(NODE_SINGLE_ROW_FAIR_SHARE_W).toBe(140)
    expect(NODE_SINGLE_ROW_FAIR_SHARE_W).not.toBe(NODE_LAYOUT_MIN_W)
  })

  it('a short label cannot be made to occupy the maximum card', () => {
    // Density twin: the floor grew, the CAP did not, so a graph whose tier
    // compresses still packs at the floor rather than being promoted to 320px
    // cards full of whitespace.
    expect(NODE_LAYOUT_MIN_W).toBeLessThan(NODE_CARD_MAX_W)
  })
})
