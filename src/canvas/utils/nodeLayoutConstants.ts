/**
 * Shared constants for the canvas layout pipeline.
 *
 * One source of truth for node dimensions, spacing, the canonical semantic
 * tier mapping, and the bounded measurement-failure fallback duration.
 * Imported by `layout.ts`, `BaseNode.tsx`, the lifecycle hook in
 * `ReactFlowGraph.tsx`, and the layout test suite.
 */

import { MAX_LABEL_COUNTER_SCALE } from './zoomLegibility'

// ─── Dimensions ──────────────────────────────────────────────────────────────

/**
 * ⭐⭐ NODE GEOMETRY AND THE CANVAS LABEL SCALE ARE ONE DECISION. Read this
 * before changing any width in this file, or `LABEL_LEGIBLE_ZOOM`.
 *
 * Canvas label text carries a counter-scale (`--canvas-label-scale`) so it
 * renders at its DECLARED size instead of `declared × zoom`. That scale is
 * bounded by `MAX_LABEL_COUNTER_SCALE`, and the bound is reached at exactly the
 * zoom a post-draft auto-fit parks at. So at the zoom the product itself
 * chooses, node title text is `MAX_LABEL_COUNTER_SCALE ×` larger than the
 * declared 13px — and any width tuned against 13px holds that much less text.
 *
 * `#758` scaled the font and not the geometry, and the two drifted apart in a
 * single deploy: measured at the settle zoom (0.5000, scale 2, title rendering
 * at 26px), 59 of 174 node titles across the five shipped starters broke
 * MID-WORD. The two text-derived widths below therefore carry the scale
 * explicitly, so the drift cannot recur silently — change `LABEL_LEGIBLE_ZOOM`
 * and both move.
 *
 * NOT EVERY WIDTH SCALES, AND THE ASYMMETRY IS DELIBERATE:
 *   - the FLOORS below are text-derived (they exist to hold a word) and MUST
 *     follow the scale;
 *   - `NODE_CARD_MAX_W` is a viewport constraint, not a text measure. Doubling
 *     it would double the laid-out graph, and since the auto-fit is already
 *     clamped at `LABEL_LEGIBLE_ZOOM` for a post-draft model, that buys no
 *     legibility and only crops the model — the same trade `zoomLegibility.ts`
 *     rejects for the zoom floor, and the trade a prior lane already paid for
 *     with panel width and got nothing. It stays fixed and is GUARDED instead:
 *     `nodeLabelFit.spec.ts` REDs if the cap ever stops affording the floor.
 */

/** Horizontal padding inside the rendered card (12px each side, see BaseNode). */
export const NODE_CARD_PADDING_X = 24

/**
 * Diameter of the type glyph, which now sits ON the top connector rather than
 * in the title's flex row. Bigger than the 14px it replaced because at 14px in
 * a corner the four shapes were not reliably distinguishable at canvas zoom.
 */
export const NODE_TYPE_GLYPH_PX = 18

/** Gap between the title and the right-hand header slot (see BaseNode). */
export const NODE_HEADER_GAP_PX = 6

/**
 * ⭐ ZERO SINCE THE GLYPH MOVED TO THE CONNECTOR (1 Sep 2026).
 *
 * This was `icon + gap` — 20px of measure surrendered by every title on the
 * board so a single 14px mark could sit to its left. That reservation is what
 * pushed real titles onto a third line, and the clamp then ellipsised them.
 *
 * Kept as a named constant rather than deleted: it still expresses "space the
 * title gives up before any text is laid out", it is consumed by
 * `NODE_LAYOUT_MIN_W` below and asserted by `nodeLabelFit.spec.ts`, and a
 * future header ornament should raise THIS rather than reintroduce a literal.
 */
export const NODE_HEADER_RESERVE_PX = 0

/**
 * Width of the widest single word the product's own content contains, at the
 * DECLARED node-title size (Design System v5 §2.3: Inter 600, 13px).
 *
 * MEASURED, not estimated — in Chromium against the LIVE font of a mounted node
 * title, over all 194 unbreakable runs in the five shipped starters
 * (`src/canvas/starters/data/`), i.e. a corpus from outside this change's
 * author. The widest is "Cannibalization" at **97.77px**; next are
 * "Concentration" 90.19 and "Improvement" 83.55. Rounded up to 100.
 *
 * ⚠ This supersedes a hand-set `96`, whose comment claimed "fits a
 * ~12-character word" — under-derived, not merely unscaled.
 *
 * ⚠ THE MARGIN IS 2.23px AND THAT IS DELIBERATE. Every pixel here is doubled by
 * the counter-scale and widens every compressed card, so headroom is not free.
 * Ordinary business words already exceed it — "Recommendation" 110.47px,
 * "Commoditisation" 107.81px — and are simply not in the product's content
 * today. `e2e/visual/nodeLabelFit.visual.spec.ts` MEASURES the corpus against
 * this bound and REDs if one arrives; it carries those words as a negative
 * control so it is shown to discriminate. Do not guard this by counting
 * characters: "Commoditisation" is exactly as long as "Cannibalization".
 */
/**
 * ⚠ RE-DERIVED WITH THE TYPE SCALE (1 Sep 2026): 100 → 85.
 *
 * This constant is a WIDTH AT A FONT SIZE, so it is not independent of that
 * size — it was measured at a declared 13px title and the title is now 12px.
 * Leaving it at 100 would have kept every card sized for type it no longer
 * renders, silently discarding the width the smaller font was changed to win.
 *
 * Scaled from the ORIGINAL MEASUREMENT rather than from the rounded constant,
 * so the rounding is not compounded: the widest run in the five shipped
 * starters is "Cannibalization" at 97.77px @13px → 90.25px @12px. Rounded up to
 * 93, which keeps ~2.75px of margin — the same headroom the 13px figure carried,
 * and deliberately no more, because every pixel here is doubled by the
 * counter-scale and widens every compressed card.
 *
 * `e2e/visual/nodeLabelFit.visual.spec.ts` measures the real corpus against
 * this bound in a real browser and REDs if a word arrives that exceeds it — so
 * this derivation is checked against the live font rather than trusted.
 */
/**
 * ⭐ RE-DERIVED AT 14px (12 Sep 2026), from the ORIGINAL measurement rather than
 * the rounded constant, exactly as the 12px derivation above insists:
 * "Cannibalization" measured 97.77px @13px, so 97.77 x 14/13 = 105.29px @14px.
 * Rounded up to 108, preserving the same ~2.7px headroom the 93 carried — and
 * deliberately no more, because every pixel here is doubled by the counter-scale.
 *
 * `e2e/visual/nodeLabelFit.visual.spec.ts` measures the real corpus against this
 * bound in a real browser and REDs if a word exceeds it, so this is checked
 * against the live font rather than trusted.
 */
export const NODE_TITLE_WIDEST_WORD_PX = 108

/**
 * Minimum horizontal measure (px) reserved for a node's TITLE, at the largest
 * scale canvas label text can carry.
 *
 * `overflow-wrap: break-word` (Tailwind `break-words`) is a LAST-RESORT rule:
 * it splits a word mid-character as soon as that word cannot fit its line box.
 * It is therefore only as good as the measure it is given — which is why this
 * has to be a function of the font scale and not a constant tuned once.
 *
 * The header row is allowed to WRAP, so the header slot moves below the title
 * rather than the title being squeezed below a readable measure.
 */
/**
 * ⭐ THE COLUMN THE GLYPH GAVE BACK (1 Sep 2026) — 20px, the old
 * `icon + gap`. It does not disappear when the glyph moves to the connector; it
 * becomes TEXT MEASURE. Card geometry is therefore unchanged and the title is
 * 20px wider, which is the entire point of moving the mark: three-line titles
 * were a width problem, not a length problem.
 *
 * Named rather than folded into the sum below so the derivation still says
 * where the width came from.
 *
 * ⚠⚠ IT IS ADDED **UNSCALED**, AND THAT IS THE WHOLE CORRECTNESS OF THIS FILE.
 *
 * The first cut wrote `(WIDEST_WORD + RECLAIMED) * MAX_LABEL_COUNTER_SCALE`,
 * beneath a comment promising "card geometry is therefore unchanged". The
 * comment was the intent; the arithmetic was not. `MAX_LABEL_COUNTER_SCALE` is
 * 2, so multiplying the reclaimed column doubled it: `NODE_LAYOUT_MIN_W` went
 * 244 → 264, the lower packing cliff went 1132 → 1212, and at the pinned
 * budget of 1185 every tier of 7–10 siblings dropped from FOUR cards per row to
 * THREE.
 *
 * ⛔ WHICH IS THE OPPOSITE OF THIS PR'S PURPOSE. Fewer cards per row makes the
 * graph taller, a taller graph fits at a lower zoom, and a lower zoom is
 * precisely the "not fit for purpose on a normal laptop-sized screen" defect
 * this work exists to fix. A visual tidy-up would have shipped a layout
 * regression, and nothing on screen would have named it.
 *
 * The distinction the arithmetic missed: `MAX_LABEL_COUNTER_SCALE` exists to
 * keep TEXT legible at the zoom the product picks, so it scales things measured
 * in TEXT — the widest word. The reclaimed column is CHROME: a fixed 20px that
 * an icon used to occupy and no longer does. Chrome is not counter-scaled, and
 * scaling it counts a decision twice.
 *
 * Caught by `layoutViewportIndependence.guard.spec.ts` — five failures, three of
 * them "the canonical shape moved". The R1 viewport-independence half stayed
 * GREEN throughout, so the guard was not reporting a broken ruling; it was
 * reporting that the SHAPE changed, which is exactly the discrimination it was
 * built to make. With the scale removed the recorded hashes match again, with
 * no snapshot re-recorded — which is the evidence that the geometry really is
 * unchanged rather than merely re-pinned to whatever it became.
 */
export const NODE_TITLE_RECLAIMED_PX = 20

export const NODE_TITLE_MIN_MEASURE_PX =
  NODE_TITLE_WIDEST_WORD_PX * MAX_LABEL_COUNTER_SCALE + NODE_TITLE_RECLAIMED_PX

/**
 * Layout-algorithm lower bound: the narrowest ELK card width. Not a visual
 * preference — it is exactly the width needed to give the title its measure
 * without the shape indicator having to wrap. Reached when the widest tier
 * cannot fit in one row at any wider width and multi-row splitting is preferred.
 *
 * The same derivation at counter-scale 1 yields 144px, against the 140px this
 * constant held before the scale was wired in — so the change here is the
 * SCALE COUPLING plus the 4px the old value was under-derived by, and nothing
 * hand-tuned. `nodeLabelFit.spec.ts` pins that.
 */
export const NODE_LAYOUT_MIN_W =
  NODE_TITLE_MIN_MEASURE_PX + NODE_HEADER_RESERVE_PX + NODE_CARD_PADDING_X

/** Maximum rendered card width. Used by BaseNode and as the ELK pinned width. */
/**
 * ⭐⭐ 320 -> 400 (12 Sep 2026). Maximum rendered card width; also the ELK pinned
 * width.
 *
 * ⚠ THIS IS ONE DECISION WITH THE 14px TYPE RAMP, not an independent tidy-up.
 * The layout solves text at `MAX_LABEL_COUNTER_SCALE` (2), so a card's character
 * measure is `(W - NODE_CARD_PADDING_X) / (charWidth x 2)`. At 12px/320 that is
 * ~22 characters a line; at 14px/320 it would be ~19 — below the ~18 that
 * produced the measured clipping defect this file's history records. At 14px/400
 * it is ~24, which is MORE room than the product has today.
 *
 * 400 is on the 8pt grid and leaves 376px of text measure. It is affordable
 * because `CANONICAL_LAYOUT_WIDTH` moved with it; at the old 1185 budget a
 * three-wide tier of 400s (1336 units) would have split to two rows and made
 * the graph taller, which is the defect from the other end.
 */
export const NODE_CARD_MAX_W = 336

/**
 * ⭐⭐ S4 LAPTOP FIT — THE RESTING CARD WIDTHS (Experience Design, #63
 * 5806207128 + 5806266691, 24 Sep 2026: "Repeated cards target 248px: Option,
 * Factor, Outcome and Risk … Question and Goal ≤460px, wide and shallow").
 *
 * ## The unit
 * These are FLOW units — the unit `layoutGraph` places in and `BaseNode` draws
 * at, and the unit the contract's 248px is in at 100% zoom (the fixture's 1:1
 * frame). ED compared 248 against the measured 300–430 option widths, which
 * `FIT-MEASURE-20260924.md` records in flow units, and the approved L4
 * arithmetic spends 248 against a flow budget (1520 = 760px at the 0.5 floor).
 * Read as SCREEN px at the 0.5 landing it would be 496 flow — wider than the
 * 336 it replaces, the opposite of S4.
 *
 * ## ⚠ THE BOUNDED EXCEPTION: 260, NOT 248
 * ED: "248 is the target unless a specific title/legibility test proves a
 * bounded exception is necessary … existing layout legibility tests still win if
 * code proves a hard minimum." The code proves one: `NODE_LAYOUT_MIN_W` (260) is
 * the card's own CSS `minWidth` in `BaseNode`, pinned by `nodeLabelFit.spec.ts`,
 * and derived from the widest starter word at the counter-scale bound. A 248
 * layout slot would hold a 260 card and overlap its neighbour by 12. So the
 * rendered width is the target, raised to the floor — and it follows the floor
 * back down to 248 if `LABEL_LEGIBLE_ZOOM` or the type ramp ever moves it.
 */
export const REPEATED_CARD_TARGET_W = 248

/** The width Option, Factor, Outcome and Risk cards actually render at. */
export const REPEATED_CARD_W = Math.max(REPEATED_CARD_TARGET_W, NODE_LAYOUT_MIN_W)

/** The Question and the Goal: singletons, wide and shallow (ED S4: "≤460px"). */
export const ANCHOR_CARD_MAX_W = 460

/**
 * ⭐ ROWS ABOVE FOUR REAL CARDS WRAP into balanced sub-rows under ONE family
 * label: 5→3+2, 6→3+3, 7→4+3, 8→4+4, 9→3+3+3, 10→4+3+3. A COUNT, not a width
 * threshold, so the label scale can never move a tier between packings — the
 * property `NODE_SINGLE_ROW_FAIR_SHARE_W` (retired with S4) existed to protect,
 * now true by construction. Row-end prompts are not real cards and are not
 * counted.
 *
 * ⭐ GAP 7 (25 Sep 2026): FIVE → FOUR. ED S4 (#63 5806207128) ruled the wrap at
 * five; ED #63 5808428246 then made 1280×800 with the dock open the ACCEPTANCE
 * size, whose fit frame is 1520 flow units at the 0.5 floor. Five cards and the
 * 160 prompt need 1740 there (a 220-unit, 110px spill); four need 1424. The
 * Canvas lead's decide-and-flag call is to wrap at four, keeping S4's balanced
 * sub-rows, reading order and one family label — so every band fits the frame
 * on width (`laptopFit.arithmetic.spec.ts`, `laptopFit1280.bandRows.spec.ts`).
 */
export const MAX_CARDS_PER_ROW = 4

/**
 * ⭐ THE ROW-END REASONING PROMPT (ED S4: "160px is approved as the target width
 * and they count inside the row budget"). Flow units, like the cards.
 */
export const ROW_PROMPT_W = 160

/**
 * The prompt's height at the counter-scale bound — a FLOOR the layout reserves,
 * derived from the type the prompt renders, never hand-tuned.
 *
 * Three lines of `typography.edgeLabel` (11px, `leading-snug` 1.375) at
 * `MAX_LABEL_COUNTER_SCALE`, plus unscaled chrome (6px padding and a 1.5px
 * border, each side). Three because a 160 box leaves ~72 declared px of measure
 * and `GhostTierNode`'s 3 Sep browser measurement recorded that the risk and
 * outcome questions already spill to three lines at 80 declared px; the option
 * and factor questions need two or three.
 *
 * ⚠ JSDOM CANNOT PROVE THE LINE COUNT (no text metrics). The box uses
 * `min-height`, never a fixed height, so a fourth line costs height, not a
 * clipped word; the stacked outcome/risk pair is the case to witness in a real
 * browser (`e2e/geometry/ghostDoorVisibility.measure.ts`).
 */
export const ROW_PROMPT_LINES = 3
const ROW_PROMPT_LABEL_PX = 11
const ROW_PROMPT_LINE_HEIGHT = 1.375
export const ROW_PROMPT_PADDING_PX = 6
export const ROW_PROMPT_BORDER_PX = 1.5
export const ROW_PROMPT_H = Math.ceil(
  ROW_PROMPT_LINES * ROW_PROMPT_LABEL_PX * ROW_PROMPT_LINE_HEIGHT * MAX_LABEL_COUNTER_SCALE +
    ROW_PROMPT_PADDING_PX * 2 +
    ROW_PROMPT_BORDER_PX * 2,
)

/** Vertical gap between the two prompts of a shared Outcome + Risk column. */
export const ROW_PROMPT_STACK_GAP = 8

/**
 * ⭐⭐ HOW MANY CHARACTERS OF A FACTOR NAME FIT ON ONE ROW — DERIVED, NOT GUESSED.
 *
 * Three places on this canvas cut text by CHARACTER COUNT inside a card sized in
 * PIXELS, and every one of them was a hand-set number chosen against a card
 * width that has since moved (`NODE_CARD_MAX_W` 320 -> 336 at #1527):
 *
 *     ConnRow                   30 chars   -> replaced by CSS width (#1531)
 *     edge-label half-width     80 px      -> derived from type (#1560)
 *     compactFactorLabel        22 / 20    -> THIS
 *
 * ⚠ THE COUNT IS NOT CONSTANT ACROSS ZOOM, which is the part a hand-set number
 * cannot express. The card is sized in LAYOUT px and does not change; the type
 * is counter-scaled, so at the legibility floor an 12px label renders at 24px
 * and the SAME row holds half as many characters. `MAX_LABEL_COUNTER_SCALE` is
 * the ceiling of that scale, so sizing against it is the WORST CASE and the
 * result is safe at every zoom the product can reach.
 *
 * ⭐ MEASURED, in real Chromium, at 1600x1000 on the `pricing-model` starter
 * (`e2e/geometry/labelBudget.measure.ts`, which stays in the tree so this can be
 * re-derived rather than re-argued):
 *
 *     card layout width   336 px          (NODE_CARD_MAX_W, confirmed)
 *     row text block      296 px          (the min-w-0 flex child)
 *     rendered type        24 px          (12 declared x counter-scale 2)
 *     capacity            25 characters
 *     rendered            "Usage-based pricing…"   <- cut at 22
 *
 * So the option row threw away 3 characters of every long label and the
 * differentiator threw away 5 — on a canvas whose owner had asked why content
 * is lost inside the nodes.
 *
 * ⚠ `getBoundingClientRect()` WOULD HAVE GIVEN 168 AND 68, because it applies
 * the canvas transform. The first run of that probe did exactly that and
 * reported a row a quarter of its real width. `offsetWidth` is the layout box,
 * which is the frame this budget is spent in.
 *
 * ⛔ WHY NOT CSS WIDTH TRUNCATION, WHICH IS WHAT #1531 CORRECTLY DID FOR
 * `ConnRow`: a CSS ellipsis inside a canvas node REDs
 * `nodeTextClipping.visual.spec.ts`, which exempts JS-shortened strings BY
 * DESIGN. So this budget stays a character count; what changes is that it can
 * no longer go stale, because it now moves with the card and the type.
 *
 * ⚠ CONSERVATIVE ON PURPOSE. A character budget can never be exactly right —
 * "Illinois" and "WWWWWWWW" are the same count and not the same width, and that
 * imprecision IS the defect class. `AVG_CHAR_EM` is taken from the measured
 * capacity rather than from a font table, so it already carries the real
 * mixed-case width of this typeface; rounding DOWN keeps a long label on one
 * line, because a wrap costs a whole row of card height.
 */
const ROW_LABEL_INSET_PX = NODE_CARD_MAX_W - 296

/** Measured: 296px of 24px type held 25 characters of a real mixed-case label. */
const AVG_CHAR_EM = 296 / 25 / 24

/** The declared size of `typography.nodeLabel`, which these rows use. */
const ROW_LABEL_DECLARED_PX = 12

/**
 * ⭐ S4: THE BUDGET FOLLOWS THE CARD IT IS SPENT IN. The option rows now render
 * in a `REPEATED_CARD_W` card, not a `NODE_CARD_MAX_W` one, so the budget is
 * derived from that width — at 336 it was 25, at 260 it is 18. Leaving it on
 * 336 would hand a 260 card a label ~76 flow units wider than its row, which is
 * horizontal overflow `nodeTextClipping.visual.spec.ts` exists to catch.
 * `ROW_LABEL_INSET_PX` is chrome (padding and gutter), so it stays the measured
 * 40 whatever the card width.
 */
export const NODE_ROW_LABEL_MAX_CHARS = Math.floor(
  (REPEATED_CARD_W - ROW_LABEL_INSET_PX) /
    (ROW_LABEL_DECLARED_PX * MAX_LABEL_COUNTER_SCALE * AVG_CHAR_EM),
)


/**
 * ⛔ `NODE_SINGLE_ROW_FAIR_SHARE_W` (140) AND `MIN_GAP` (15) ARE RETIRED (S4,
 * 24 Sep 2026). Together they were the single-row GATE: a tier stayed on one row
 * while `floor((budget − (T−1)·MIN_GAP) / T) ≥ 140 + LAYOUT_PADDING_X`, which at
 * the 1482 budget kept up to EIGHT cards on one row (a 2544-unit factor row).
 * Experience Design replaced that policy with a COUNT — rows above
 * `MAX_CARDS_PER_ROW` wrap — so neither number is read by the layout any more,
 * and a constant nothing reads is how the next lane re-wires the old policy by
 * accident. Their derivations, measurements and retractions are in git history
 * at `4b04b733`; the property they protected ("the label scale must not move a
 * tier between packings") now holds by construction, because a count cannot
 * move with the type ramp.
 */

/**
 * ⭐⭐ THE CANONICAL LAYOUT WIDTH — the ONE budget the canonical model is packed
 * against, and the reason it is a CONSTANT and not a measurement.
 *
 * FOUNDER RULING R1 (18 Aug 2026, `ARCHITECTURE-BOARD.md` §0-RULINGS):
 *
 * > "Stable model, adaptive attention. The canonical graph layout must not
 * > change because viewport width changes. Therefore: remove viewport width as
 * > an authority over canonical row packing; establish ONE stable canonical
 * > layout; responsive behaviour happens through camera/focus/disclosure, not
 * > persisted re-layout."
 *
 * WHAT WAS WRONG. `layout.ts` solved `availableWidth = canvasSize.width * 0.85`,
 * where `canvasSize` was the live `.react-flow` pane rect. Two of that solver's
 * outputs — WHETHER the widest tier splits into rows, and HOW MANY nodes go in
 * each row — were therefore functions of the viewport. Measured at `06f745ba`,
 * RED-first, with named position digests: **three of the five shipped starters
 * produce THREE DIFFERENT canonical layouts across 1280 / 1440 / 1512 / 1920.**
 * The instability is INSIDE the laptop band, not below it. Two teammates on two
 * laptops were looking at two different shapes of the same shared model.
 *
 * ⭐ HOW THIS VALUE WAS DERIVED — it is not a taste call, and it was NOT the
 * first value tried. The first candidate was measured, found wanting, and
 * replaced; the measurement is below because R1 asks for the derivation, not
 * just the number.
 *
 * The packing branch is a step function of the budget, re-derived here from the
 * constants in this file (`availableWidth` = AW):
 *
 *   single-row iff floor((AW - (T-1)*MIN_GAP) / T) >= NODE_SINGLE_ROW_FAIR_SHARE_W
 *                                                     + LAYOUT_PADDING_X
 *              iff AW >= 179*T - 15                      (T = widest tier count)
 *   otherwise  nodesPerRow = floor((AW + 20) / (NODE_LAYOUT_MIN_W + LAYOUT_PADDING_X + 20))
 *
 * So the budget only ever selects a (single-row cap, nodes-per-row) PAIR, and
 * near laptop widths the reachable pairs are few:
 *
 *   AW in [1059, 1132)  cap T=6   3 per row (820 units)
 *   AW in [1132, 1238)  cap T=6   4 per row (1108 units)   <- HERE
 *   AW in [1238, 1417)  cap T=7   4 per row
 *   AW in [1420, 1596)  cap T=8   5 per row
 *
 * The shipped product's own values landed in three different rows of that table
 * — 1280*0.85 = 1088, 1440*0.85 = 1224, 1512*0.85 = 1285, 1920*0.85 = 1632.
 * That IS the defect.
 *
 * ⭐ THE TWO CLIFFS, AND WHY THIS BAND. The lower cliff is exactly the width of
 * a four-card row: 4*(NODE_LAYOUT_MIN_W + LAYOUT_PADDING_X) + 3*20 = 1132. The
 * upper cliff, 179*7 - 15 = 1238, is the budget at which a SEVEN-wide tier stops
 * splitting and becomes a 2504-unit single row. Four is therefore the LARGEST
 * per-row count still compatible with splitting a 7-wide tier at all: five needs
 * AW >= 1420, which also single-rows an 8-wide tier at 2868 units. **1185 is the
 * midpoint of [1132, 1238)** — 53 units of margin to each cliff, which is
 * deliberate: a constant sitting on a cliff edge is a defect waiting for a
 * rounding change.
 *
 * ⭐⭐ AND THE MEASUREMENT THAT ACTUALLY DECIDED IT, in a real browser (trap 3 —
 * jsdom cannot prove a rendered size), five shipped starters x 1280/1440/1512,
 * reading the SETTLED camera transform rather than deriving it. The first
 * candidate was 1105 (= 1300 x 0.85, `layout.ts`'s old FALLBACK_CANVAS, chosen
 * because it reproduces the shape shipped at 1280 byte-for-byte and so preserved
 * every measurement taken at 1280). It is STABLE and it is WORSE: three-per-row
 * makes these models taller, and they are HEIGHT-bound, so the camera lands
 * lower.
 *
 *   settled zoom, dock expanded      1280      1440      1512
 *   vendor-selection  shipped      0.5139    0.7202    0.6873   (3 shapes)
 *                     pin 1105     0.5000    0.5549    0.5292   (1 shape)
 *                     pin 1185     0.6613    0.7202    0.6873   (1 shape)
 *   build-vs-buy      shipped      0.5000    0.6337    0.6045   (3 shapes)
 *                     pin 1105     0.5000    0.5000    0.5000   (1 shape)
 *                     pin 1185     0.5587    0.6567    0.6283   (1 shape)
 *
 * 1185 is stable AND at least as legible as the shipped build in every measured
 * cell. Stated precisely, because the tempting summary overstates it: at 1440
 * and 1512 this pin reproduces the shipped shape, so those columns do not
 * improve — they were already 5 of 5 clearing the floor and they stay there.
 * **The gain is at 1280, where models clearing the 0.50 floor go from 2 of 5 to
 * 3 of 5** (build-vs-buy 0.5000 clamped → 0.5587), and the cost is zero
 * everywhere else. That is the whole measured effect; choosing on it rather
 * than on evidence-continuity is the point of R1's instruction that deriving
 * this constant IS the work.
 *
 * ⚠ Instrument noise, so the table is not over-read: node HEIGHTS vary by a few
 * px between runs even at byte-identical node positions (build-vs-buy measured
 * 1320 then 1316 at 1440, moving the zoom 0.6337 → 0.6567). Treat differences
 * below ~0.03 as jitter, not as signal.
 *
 * ⚠ WHAT THIS DOES NOT FIX, and it is the honest half. The two five-wide
 * starters pack to a 1776-unit single row and still clamp at 0.50 in the 760px
 * fit box at 1280 — unchanged by this pin in either direction, because a 5-wide
 * tier is single-row at every budget above 880. R1 rules that the answer to a
 * constrained screen is "readable subset + explicit 'showing X of Y' + obvious
 * whole-model access" — a PRESENTATION change — never a re-pack. Do not fix it
 * here.
 *
 * ⚠⚠ FORBIDDEN, and this is the whole point of the constant: nothing may make
 * this budget a function of anything that varies at runtime — not the viewport,
 * not the pane rect, not the fit box, not panel state, not zoom, not node count.
 * That is not a stylistic preference: it is the difference between a shared model
 * and a per-screen rendering of one. Enforced at the bytes by
 * `layoutViewportIndependence.guard.spec.ts`.
 */
/**
 * ⭐⭐ 1185 → 1482 (12 Sep 2026), AND THIS IS THE CONSTANT THAT WAS CAUSING THE
 * SQUASH. Founder Ruling R1 is untouched: it is still a CONSTANT, still
 * viewport-independent, and still enforced by
 * `layoutViewportIndependence.guard.spec.ts`. Only the VALUE moved.
 *
 * ⛔ THE DEFECT, MEASURED ON THE FIVE SHIPPED STARTERS RATHER THAN REASONED
 * ABOUT. At 1185 an eight-wide tier does not clear the single-row gate, so it
 * splits — and three of the five starters came out PORTRAIT in a LANDSCAPE
 * viewport:
 *
 *                          BEFORE             AFTER          aspect
 *   vendor-selection     1142 x 1937   ->   3080 x 1811     0.59 -> 1.70
 *   market-entry         1142 x 1959   ->   3080 x 1825     0.58 -> 1.69
 *   build-vs-buy         1142 x 2653   ->   3080 x 2411     0.43 -> 1.28
 *   headcount-allocation 1776 x 1377   ->   1904 x 1587     1.29 -> 1.20
 *   pricing-model        1776 x 1440   ->   1904 x 1650     1.23 -> 1.15
 *
 * ⚠ Read the FIRST THREE ROWS as the result. Those are the starters with an
 * eight-wide tier, and they are the ones that were portrait. The last two were
 * already landscape and already single-row at 1185; they get slightly taller
 * from the wider gaps and the 14px ramp, which is a cost, not a win. Reporting
 * the mean across all five would flatter this change.
 *
 * A canvas pane is landscape (roughly 1.9:1). A model at 0.43 in a pane at 1.9
 * is fitted on its HEIGHT, so the camera is forced down and the horizontal
 * space is simply dead — the model used about 30% of the available width. That
 * is the reported symptom, and no camera change can repair it, because the
 * camera is already doing the only thing it can with a portrait box.
 *
 * ⭐ HOW 1482 WAS DERIVED — by this file's own rule, not by taste. Every cliff
 * within reach, enumerated from the constants rather than recalled:
 *
 *     1232   split tiers reach 4 per row
 *     1238   7-wide tier starts single-rowing
 *     1417   8-wide tier starts single-rowing      <- lower bound
 *     1548   split tiers reach 5 per row           <- upper bound
 *     1596   9-wide tier starts single-rowing
 *
 * `[1417, 1548)` is the interval over which behaviour is constant — every tier
 * up to eight on one row, and anything wider splitting four to a row. 1482 is
 * its midpoint: 65 units above one cliff and 66 below the other, the furthest
 * any value can sit from both. This file's standing rule is that "a constant
 * sitting on a cliff edge is a defect waiting for a rounding change", and 1482
 * is the value that rule selects.
 *
 * ⚠ TWO EARLIER ATTEMPTS AT THIS SAME LINE WERE WRONG, recorded so the reasoning
 * is not repeated:
 *
 *   · 1920 PAIRED WITH A DERIVED `NODE_SINGLE_ROW_FAIR_SHARE_W`. The pair was
 *     INERT — raising the budget pushes the cliff out and raising the fair share
 *     pulls it back by the same amount, so the packing table was byte-identical
 *     to 1185/140. It also reversed a decision `layout.ts` states in the branch
 *     itself (the fair share must NOT track the type ramp). Both halves reverted.
 *
 *   · 1440 "REFUTED BY THE GEOMETRY GUARD". That refutation was measured with
 *     the fair share at 260 and does not survive its revert: at a fair share of
 *     140 the boundary at 1440 is 8/9, not 4/5. A measurement is only valid
 *     under the constants it was taken at (CLAUDE.md trap 16 — a capture proves
 *     what it was pointed at). 1440 is in fact inside the chosen band; 1482 is
 *     preferred only because it is the midpoint and 1440 sits 23 units off a
 *     cliff.
 *
 * ⚠ WHAT THIS DOES NOT FIX, and it is the honest half. `build-vs-buy` is still
 * fitted on its height and still clamps at `LABEL_LEGIBLE_ZOOM`; it is 9%
 * shorter and 3.1x wider than before, not made to fit. R1 rules that the answer
 * to a constrained screen is "readable subset + explicit 'showing X of Y' +
 * obvious whole-model access" — a PRESENTATION change — never a re-pack. Do not
 * fix it here.
 *
 * ⚠⚠ FORBIDDEN, and this is the whole point of the constant: nothing may make
 * this budget a function of anything that varies at runtime — not the viewport,
 * not the pane rect, not the fit box, not panel state, not zoom, not node count.
 * That is not a stylistic preference: it is the difference between a shared
 * model and a per-screen rendering of one.
 */
/**
 * ⭐⭐ S4 (24 Sep 2026): THE VALUE STANDS; ITS JOB CHANGED. READ THIS FIRST.
 *
 * Everything above describes the budget as the single-row GATE's input — the
 * cliffs, the band and the midpoint are all cliffs of that retired policy. Under
 * S4 the packing is a count (`MAX_CARDS_PER_ROW`), so this budget no longer
 * decides WHETHER a tier wraps. It is now the ROW BUDGET a card's width is a
 * fair share of (ED S4: "a card is never wider than its row's fair share"):
 *
 *     cardW = clamp( floor((BUDGET − promptSlot − (k−1)·gap) / k) − padding,
 *                    NODE_LAYOUT_MIN_W,  tier cap )
 *
 * for the widest sub-row of k cards. With today's floor (260) and caps (260 /
 * 460) the share never binds on a repeated tier — the floor and the cap are the
 * same number. A five-card row with its 160 prompt (1740 units visible) overran
 * this budget; since gap 7 caps a row at four cards (1424 units with its
 * prompt), no row does. `laptopFit.arithmetic.spec.ts` states both numbers.
 *
 * R1 is untouched: it is still a constant, still viewport-independent, and
 * `layoutViewportIndependence.guard.spec.ts` still enforces that at the bytes.
 */
export const CANONICAL_LAYOUT_WIDTH = 1482

/** Horizontal padding added around the rendered card to form the ELK box. */
/**
 * ⭐⭐ THE TWO SPACING FLOORS, NAMED HERE SO THERE IS ONE SOURCE (12 Sep 2026).
 *
 * They were literals inside `layout.ts` (`Math.max(20, …)` and `Math.max(30, …)`)
 * and `layoutViewportIndependence.guard.spec.ts` mirrored the 20 BY HAND in its
 * own packing derivation. That is the hand-maintained mirror this estate pays
 * for repeatedly: raising the floor in `layout.ts` left the guard computing a
 * band from the old gap, so the guard would have certified a packing table the
 * product no longer produces.
 *
 * `LAYOUT_NODE_GAP` is the horizontal gap between siblings in a row;
 * `LAYOUT_LAYER_GAP` is the vertical gap between tiers. Both are multiples of
 * the 8pt grid the rest of the product uses.
 *
 * ⚠ `COLLISION_GAP` (20) is deliberately LEFT BELOW `LAYOUT_NODE_GAP`. It is the
 * last-resort overlap repair, not a spacing preference — keeping it lower means
 * it still only fires when something has genuinely gone wrong, rather than
 * becoming a second spacing authority that competes with this one.
 */
export const LAYOUT_NODE_GAP = 32
export const LAYOUT_LAYER_GAP = 48

export const LAYOUT_PADDING_X = 24

/** Vertical padding added around the rendered card to form the ELK box. */
export const LAYOUT_PADDING_Y = 16

/** Maximum ELK box width (card + horizontal padding). */
export const LAYOUT_BOX_MAX_W = NODE_CARD_MAX_W + LAYOUT_PADDING_X

/** Minimum ELK box width (card + horizontal padding). */
export const LAYOUT_BOX_MIN_W = NODE_LAYOUT_MIN_W + LAYOUT_PADDING_X

/**
 * Default node height used when measurement has not yet completed.
 * Matches `NODE_REGISTRY.factor.defaultSize.height`.
 */
export const DEFAULT_NODE_HEIGHT = 100

// ─── Spacing ─────────────────────────────────────────────────────────────────

/**
 * Post-layout safety gap. Fires when ELK / multi-row splitting leaves two
 * same-row nodes closer than this threshold (rare; rounding-induced). It is a
 * last-resort repair, deliberately below `LAYOUT_NODE_GAP`, never a second
 * spacing authority. (`MIN_GAP`, the width-calc reserve it used to be compared
 * with, is retired — see the S4 note above `CANONICAL_LAYOUT_WIDTH`.)
 */
export const COLLISION_GAP = 20

/**
 * Minimum px from graph edge to canvas origin after global translation.
 * Prevents the laid-out graph from drifting into negative coordinates.
 */
export const CANVAS_MARGIN = 24

/**
 * Bounded measurement-failure safety fallback (ms). After this many ms,
 * the measure-then-layout effect proceeds with `DEFAULT_NODE_HEIGHT` for
 * any still-unmeasured node. The single timer in the layout flow.
 */
export const LAYOUT_MEASUREMENT_FALLBACK_MS = 500

/**
 * How much taller a card must become, against the height the committed layout
 * was computed for, before that layout is treated as stale.
 *
 * Sub-pixel and single-pixel drift is ordinary: fonts settle, scrollbars
 * appear, `measured.height` is rounded. A threshold of 0 would re-lay out the
 * model on that noise, moving it under a reader for no reason. 4px is below
 * anything a user notices as overlap (the smallest real overlap measured on an
 * analysed model was 54px) and far above measurement jitter.
 *
 * ⚠ GROWTH ONLY. A card that shrank leaves whitespace and harms nobody; a card
 * that grew overflows its row band and covers the row beneath. The two are not
 * symmetric and must not share one threshold.
 */
export const HEIGHT_GROWTH_TOLERANCE_PX = 4

// ─── Semantic tiers ──────────────────────────────────────────────────────────

/**
 * Canonical tier assignment for Olumi decision graphs.
 *
 * Y position is determined by tier order, not by ELK's longest-path DAG
 * traversal.
 *
 * ⭐⭐⭐ RISKS AND OUTCOMES SHARE TIER 3 — THE CONSEQUENCE LAYER.
 *
 * Ruled by the founder, 14 Sep 2026, on a causal argument rather than a spatial
 * one. This table previously read `outcome: 3, risk: 4` under the comment
 * *"Outcomes, risks, and goals occupy distinct tiers so they never share a
 * row"* — which restates the decision instead of giving a reason for it. It
 * arrived 7 May as a line item in the commit that replaced ELK's Y assignment,
 * and no product argument for the separation is recorded anywhere.
 *
 * ⭐ THE ARGUMENT FOR MERGING IS THAT `risk` IS NOT A CAUSAL CLASS.
 *
 * In decision analysis there are decisions, chance nodes, consequences and a
 * utility. "Risk" is not one of them — it is one of three other things: an
 * uncertain EVENT (which belongs upstream, with the factors, because it CAUSES
 * consequences), an adverse CONSEQUENCE (which belongs here), or the adverse
 * TAIL of a consequence's distribution (which is computed, not authored).
 *
 * Measured across all five committed starters — 87 nodes, 163 edges — risks and
 * outcomes have IDENTICAL STRUCTURAL SIGNATURES: both are fed only by factors,
 * both feed only the goal, and `risk→outcome` and `outcome→risk` are **0 and
 * 0**. The complete edge grammar is six kind-pairs: decision→option 19,
 * option→factor 58, factor→risk 33, factor→outcome 29, risk→goal 14,
 * outcome→goal 10. They are one layer wearing two labels, and the label carries
 * VALENCE — which the per-kind card fills already show — not causal position.
 *
 * ⭐ SHARING A TIER WAS ALREADY NORMAL: `factor`, `action` and `constraint` have
 * always shared tier 2. Distinctness was never the table's rule.
 *
 * ⚠ WHAT THIS IS NOT. It is not a claim that risks and outcomes are the same
 * THING, and it does not merge the kinds, the colours or the copy. It places
 * them on one row because that is where the causal graph puts them.
 *
 * ⚠ AND THE ONE THING THAT WOULD MAKE IT WRONG, checked rather than assumed: an
 * `outcome→risk` edge would become an intra-row edge, which reads badly. ZERO
 * exist in the five shipped starters (87 nodes, 163 edges, swept at the bytes),
 * and nothing in the product forbids one — the drag validator blocks self-loops,
 * duplicates, cycles and limits, and has NO kind-pair rule at all.
 *
 * ⛔ AN EARLIER VERSION OF THIS PARAGRAPH SAID "the only such edge in the
 * repository is a synthetic fixture inside `layout.semantic.spec.ts`". THAT WAS
 * FALSE and is corrected here rather than quietly rewritten, because a confident
 * count in a comment is exactly the kind of claim nobody re-checks. Swept with
 * `rg -a` against a contrast control (`makeEdge(` = 63 in one of the same
 * files, so the probe plainly sees edges): there are FIVE, across TWO files —
 * `layout.spec.ts:566,595,650` and `layout.semantic.spec.ts:302,619`.
 *
 * ⭐ ALL FIVE STILL PASS ON THE MERGED TIER, which is the fact that matters and
 * was measured rather than hoped: the full affected suite is green, and those
 * three `layout.spec.ts` cases are overlap guards that care about spacing rather
 * than row ORDER. So the intra-row case is exercised today and handled. If it
 * ever becomes real in a SHIPPED model, this is still the line to revisit.
 *
 * ⚠ TIER 4 IS NOW EMPTY AND THAT COSTS NOTHING — verified, not assumed.
 * `normaliseTierRows` iterates `[...tierAssignments.keys()]`, i.e. OCCUPIED
 * tiers only, and accumulates Y across them, so a gap produces no phantom row.
 * `layout.semantic.spec.ts` pins exactly that ("skips empty tiers — no phantom
 * gap"). `goal` therefore stays at 5 rather than being renumbered, which keeps
 * the diff to the one line that carries the decision.
 */
export const TIER_BY_KIND: Record<string, number> = {
  decision:   0,
  option:     1,
  factor:     2,
  action:     2,
  constraint: 2,
  // ── tier 3: THE CONSEQUENCE LAYER. Valence differs; causal position does not.
  outcome:    3,
  risk:       3,
  goal:       5,
}

/**
 * ⭐⭐ A CARD'S WIDTH CAP, BY TIER — because the tiers do not carry equal content.
 *
 * Paul, 15 Sep 2026: *"They don't all have to be the same width. There are
 * always less options, and there's more in it, so making them wider would make
 * sense. I also think the question or initial node and the nodes can be a lot
 * wider, so we can fit more content in."*
 *
 * ## The measurement, not an impression
 *
 * Median characters per card, counted on the `pricing-model` starter:
 *
 *     option 250 · factor 141 · decision 122 · goal 102 · risk 86 · outcome 73
 *
 * An option carries **3.4x an outcome's content** and both were drawn in the
 * same 336px box. That is the defect: one number was serving six populations.
 *
 * ## ⭐ WHY WIDENING THESE COSTS THE BOARD NOTHING — the bound is DERIVED
 *
 * These are CAPS, not widths. `layoutGraph` clamps each tier to the widest row
 * the board ALREADY has (`maxTierCount * elkBoxW + gaps`), so a tier may only
 * grow into width the board is already paying for. On `pricing-model` that
 * resolves to Question 560, options ~431, factors 336, outcomes 336, goal 480 —
 * and the board's overall width does not move by a single pixel. A tier that is
 * crowded enough to be at the bound keeps exactly today's width.
 *
 * ⛔ NOTHING HERE IS BELOW {@link NODE_CARD_MAX_W}, DELIBERATELY. Three places
 * on this canvas cut text by CHARACTER COUNT inside a box sized in PIXELS (see
 * `MAX_CHARS_PER_FACTOR_ROW` above). Those budgets were derived against 336; a
 * cap *below* 336 would silently re-open the truncation they exist to close.
 * Widening is safe in that direction — a character budget derived for a
 * narrower box merely under-uses a wider one.
 *
 * ⚠ KEYED BY TIER, NOT BY KIND, AND THAT IS LOAD-BEARING. Cards in one row must
 * share a width or the row's stride arithmetic has no single answer, and a row
 * IS a tier (`TIER_BY_KIND`). `factor`/`action`/`constraint` share tier 2 and
 * `outcome`/`risk` share tier 3, so they necessarily share a cap.
 */
/**
 * ⭐⭐ S4 SUPERSEDES THE WIDENING ABOVE (Experience Design, #63 5806207128 /
 * 5806266691, 24 Sep 2026): *"Paul's earlier 'they don't all have to be the same
 * width' was permission, not a requirement to keep Options at ~300–430px. 248 is
 * the target"* for Option, Factor, Outcome and Risk; *"Question and Goal ≤460px,
 * wide and shallow."* The measurement and the reasoning above stay as the record
 * of why the tiers were widened; the laptop-fit measurement
 * (`FIT-MEASURE-20260924.md`: a 1904-unit board, 22% over the 1280 frame at the
 * floor) is why they are narrowed.
 *
 * ⚠ THE "NOTHING BELOW 336" RULE ABOVE IS DISCHARGED, NOT IGNORED. It held
 * because character budgets were derived against 336; the one that cuts option
 * rows (`NODE_ROW_LABEL_MAX_CHARS`) is now derived from `REPEATED_CARD_W`, so it
 * shrinks with the card instead of overflowing it.
 *
 * Keyed by tier for the reason the note above gives: a row is a tier.
 */
export const CARD_W_CAP_BY_TIER: Readonly<Record<number, number>> = {
  0: ANCHOR_CARD_MAX_W, // decision — the Question: one card, wide and shallow.
  1: REPEATED_CARD_W, // option
  2: REPEATED_CARD_W, // factor / action / constraint
  3: REPEATED_CARD_W, // outcome / risk
  5: ANCHOR_CARD_MAX_W, // goal: one card, wide and shallow.
}

/** The cap for a tier, defaulting to the repeated-card width for any tier absent
 *  from the map — the width `tierOf` gives an unknown kind (tier 2). */
export function cardWidthCapForTier(tier: number): number {
  return CARD_W_CAP_BY_TIER[tier] ?? REPEATED_CARD_W
}

/**
 * The width a card of this kind rests at before any layout has published one —
 * the fallback `BaseNode` draws at on a first render, so the heights the first
 * layout measures are heights at the width it will actually lay out.
 */
export function restingCardWidthForKind(kind: string | undefined): number {
  const tier = kind !== undefined ? TIER_BY_KIND[kind] : undefined
  return cardWidthCapForTier(tier ?? 2)
}

/**
 * ⭐ WHICH ROWS END IN A REASONING PROMPT, AND IN WHAT ORDER (ED S4). Keyed by
 * layout tier, because the prompt stands at the end of a ROW, and a row is a
 * tier: options → "What else could you do?", factors → "What else drives
 * this?", and the consequence row's ONE frontier column holding outcomes'
 * "Where else could this lead?" above risks' "What else could go wrong?".
 * A kind with no members contributes no prompt — the column holds only what the
 * row has.
 */
export const ROW_PROMPT_KINDS_BY_TIER: Readonly<Record<number, readonly string[]>> = {
  1: ['option'],
  2: ['factor'],
  3: ['outcome', 'risk'],
}

/**
 * The prompt kinds a tier's final sub-row carries, given the kinds present in
 * the tier — the ONE answer the layout (which reserves the slot) and the render
 * layer (which places the prompts) both read.
 */
export function rowPromptKindsFor(tier: number, kindsPresent: ReadonlySet<string>): string[] {
  return (ROW_PROMPT_KINDS_BY_TIER[tier] ?? []).filter((k) => kindsPresent.has(k))
}

/** Height of the frontier column that holds `count` stacked prompts. */
export function rowPromptColumnHeight(count: number): number {
  if (count <= 0) return 0
  return count * ROW_PROMPT_H + (count - 1) * ROW_PROMPT_STACK_GAP
}
