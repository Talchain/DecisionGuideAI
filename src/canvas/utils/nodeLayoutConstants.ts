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
export const NODE_CARD_MAX_W = 400

/**
 * Fair share of a row, per node in the widest tier, below which `layout.ts`
 * abandons the single-row plan and splits the tier across multiple rows.
 *
 * ⚠ POLICY, NOT A TEXT MEASURE — and deliberately NOT `NODE_LAYOUT_MIN_W`,
 * which it merely USED to equal, back when the card floor was also 140.
 *
 * Keeping them fused would have made this lane a layout change it is not
 * licensed to be. Measured (17 Aug 2026, five shipped starters × two
 * viewports): with the threshold fused to the scaled floor, two starters'
 * factor tiers flipped from the single-row branch into multi-row splitting,
 * and the pre-existing same-row overlap defect went with them — overlapping
 * node-pair AREA rose from 4,554 to 115,988 px² (headcount-allocation) and
 * 5,589 to 140,396 px² (pricing-model), while two more titles began to
 * ellipsise. Decoupled, both keep the branch they already had and neither
 * number moves.
 *
 * So this holds the shipped value: when the tier splits is unchanged by the
 * label scale; only HOW WIDE the cards are once it splits follows the scale.
 * `layout.spec.ts`'s branch regression-locks pin that this did not move.
 *
 * ⚠ RE-DERIVED 18 Aug 2026 at 6524caed — THE OVERLAP FIGURES ABOVE DO NOT
 * REPRODUCE, and the sentence they support ("the pre-existing multi-row overlap
 * defect") is not observable at this tip. The 17 Aug numbers are left standing
 * as the dated record of what was measured then; this note is APPENDED rather
 * than substituted, because a measurement is evidence and evidence is
 * append-only (CLAUDE.md trap 14b).
 *
 * What was measured, and how: `layoutGraph` driven with BROWSER-REAL node
 * heights (Chromium, `e2e/visual/harness.ts` seeding at 1280x800, captured to
 * `__tests__/__fixtures__/starter-node-heights.browser-capture-2026-08-18.json`)
 * over all five shipped starters x eight canvas widths x three node-spacing
 * settings — 120 cells spanning BOTH packing branches, including the forced
 * multi-row packings. Same-row overlap was 0 px² in every cell and the minimum
 * same-row neighbour gap was 44 px in every cell.
 *
 * Decisively: deleting the `applyCollisionGuard` call from `layoutGraph`
 * produced a BYTE-IDENTICAL node-position signature across 25 cells
 * (sha256/16 = a36fe11f1762b6b5 both before and after). `centreRowsOnSpine`
 * runs immediately before the guard and re-snaps every row to a uniform
 * `elkBoxW + gap` stride, so on every reachable input the guard's precondition
 * is already satisfied and it moves nothing.
 *
 * The guard is NOT dead, and that was shown by execution rather than asserted:
 * shrinking the stride by 30 px with the guard removed REDs 15 of the 22 cases
 * in `__tests__/layout.sameRowGap.spec.ts`, and the same shrink WITH the guard
 * in place stays fully green — the guard fires and restores the 44 px gap.
 * It is a working net that has never had to catch anything.
 *
 * Consequence for anyone briefed off the 17 Aug numbers: a spec written to
 * "assert the multi-row flip no longer overlaps" would pass at pristine and its
 * prescribed mutant ("disable the guard for one row → must RED") CANNOT BITE,
 * because removing an inert call changes nothing. Pin the PROPERTY and the
 * AUTHORITY instead — which is what `layout.sameRowGap.spec.ts` does.
 */
/**
 * ⛔⛔ 140 STANDS, AND I TRIED TO DERIVE IT AWAY. THE RETRACTION IS THE COMMENT.
 *
 * On 12 Sep 2026 this was changed to `NODE_LAYOUT_MIN_W` on the reasoning that a
 * second hand-tuned number beside a derived one is the estate's hand-maintained
 * mirror (CLAUDE.md trap 12). **That reasoning was wrong here, and `layout.ts`
 * said so in the branch itself before the edit was made:**
 *
 * > "WHEN the tier splits is a row-packing policy and is deliberately NOT the
 * > (label-scale-derived) card floor... Fusing the two moved tiers between
 * > branches when the label scale changed, which dragged the pre-existing
 * > multi-row overlap defect onto graphs that did not have it."
 *
 * The two constants answer DIFFERENT QUESTIONS (CLAUDE.md trap 21), which is
 * exactly why they must not share a value:
 *
 *   NODE_LAYOUT_MIN_W            "how narrow may a CARD be and still hold its
 *                                 title?"   -> a RENDERING floor, and it MUST
 *                                 track the type ramp.
 *   NODE_SINGLE_ROW_FAIR_SHARE_W "is this tier worth trying on ONE ROW?"
 *                                 -> a PACKING policy, and it MUST NOT track
 *                                 the type ramp, or raising the font silently
 *                                 re-shapes every shared model.
 *
 * ⛔ AND THE MEASUREMENT THAT JUSTIFIED THE CHANGE WAS A MISREADING OF THE
 * BRANCH. The retracted comment claimed a seven-wide tier "packed into a SINGLE
 * ROW of ~168-unit cards - about nine characters a line". `planLayoutBox` never
 * lays a card out at the fair share: on the single-row branch it returns
 * `NODE_CARD_MAX_W + LAYOUT_PADDING_X`, full width. The fair share is a GATE,
 * never a width. No card was ever going to render at 168.
 *
 * WHAT THE PAIR ACTUALLY DID, derived over T = 2..12:
 *
 *   1185 / 140  (this file, before and after)  single-row to T=6, widest row 2544u
 *   1920 / 260  (the 12 Sep pair)              single-row to T=6, widest row 2544u
 *   1920 / 140  (budget raised, fair share not) single-row to T=10, widest row 4240u
 *
 * The first two rows are IDENTICAL in every output. Raising the budget pushes
 * the cliff out; raising the fair share pulls it back; together they cancel. The
 * third row is why they had to be changed together: 4240u needs zoom 0.41 to fit
 * a 1730px pane, under `LABEL_LEGIBLE_ZOOM`. So the pair bought no behaviour at
 * all and cost a documented decoupling - both halves are reverted.
 *
 * ⭐ The cards still got wider. That came from `NODE_CARD_MAX_W` (320 -> 400)
 * and `NODE_LAYOUT_MIN_W` (230 -> 260), which is where card width is actually
 * decided. The budget only ever chose the BRANCH.
 */
export const NODE_SINGLE_ROW_FAIR_SHARE_W = 140

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
 *                          at 1185            at 1482          aspect
 *   vendor-selection     1142 x 1937   ->   3592 x 1811     0.59 -> 1.98
 *   market-entry         1142 x 1959   ->   3592 x 1825     0.58 -> 1.97
 *   build-vs-buy         1142 x 2653   ->   3592 x 2411     0.43 -> 1.49
 *   headcount-allocation 1776 x 1377   ->   2224 x 1587     1.29 -> 1.40
 *   pricing-model        1776 x 1440   ->   2224 x 1650     1.23 -> 1.35
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
export const LAYOUT_LAYER_GAP = 72

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
 * Width-calc safety reserve used in `floor((availableWidth - (N-1)*MIN_GAP) / N)`
 * to decide whether a tier renders at NODE_CARD_MAX_W or compresses to
 * NODE_LAYOUT_MIN_W with multi-row splitting. NOT a visual floor on the
 * rendered gap — the actual rendered gap is `effectiveNodeSpacing` in
 * `layout.ts`, clamped by `Math.max(20, spacing)` and the post-layout
 * `applyCollisionGuard` (COLLISION_GAP). Lowering this value relaxes the
 * width-calc threshold (more tiers render at MAX_W).
 */
export const MIN_GAP = 15

/**
 * Post-layout safety gap. Fires when ELK / multi-row splitting leaves two
 * same-row nodes closer than this threshold (rare; rounding-induced).
 *
 * Note: now larger than `MIN_GAP` (15) after the MIN_GAP 30 → 15 change.
 * The historical `COLLISION_GAP < MIN_GAP` relation no longer holds and
 * is not required — the two constants serve unrelated concerns. MIN_GAP
 * is a width-calc safety reserve only; COLLISION_GAP matches the
 * rendered node-node gap (`Math.max(20, spacing)` in layout.ts).
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
 * traversal. Outcomes, risks, and goals occupy distinct tiers so they
 * never share a row.
 */
export const TIER_BY_KIND: Record<string, number> = {
  decision:   0,
  option:     1,
  factor:     2,
  action:     2,
  constraint: 2,
  outcome:    3,
  risk:       4,
  goal:       5,
}
