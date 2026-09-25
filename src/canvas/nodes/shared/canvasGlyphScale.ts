/**
 * ⭐⭐ THE COUNTER-SCALE, FOR GLYPHS AND TARGETS — the size half of what
 * `typography.ts` §canvas already does for TEXT.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECT THIS CLOSES, MEASURED ON THE DEPLOYED BUILD (7 Sep 2026)
 * ─────────────────────────────────────────────────────────────────────────────
 * **80 of 117 icon buttons on the canvas failed the 24px minimum at the default
 * zoom.** All 80 sat on NODES; all 32 that passed were chrome. Node DOM lives
 * inside React Flow's viewport transform, and a post-draft auto-fit parks at
 * `LABEL_LEGIBLE_ZOOM` (0.50) because `useFitViewOnLayoutVersion` passes it as
 * `minZoom` — so every declared px on a card reaches the user HALVED. Measured
 * at zoom 0.779 on a live board: quick-action icons **8.6px**, ScienceIcons
 * **9.3px**, EdgePills arrow **7.0px**, evidence-gap "?" **5.5px**.
 *
 * `#758` fixed this for TEXT and only for text: the counter-scale reaches a
 * label through the four canvas tokens in `typography.ts` and nothing else.
 * An icon's `w-3.5`, a button's `h-5` and a hit slop's `-inset-[2px]` are not
 * text, carry no token, and were therefore all still halved.
 *
 * ⭐ THIS FILE INVENTS NOTHING. `NodeProvenanceMark` already solved it once, for
 * one component, with `calc(14px * var(--canvas-label-scale, 1))`
 * (`domain/valueProvenanceIcon.ts` §`PROVENANCE_ICON_SIZE_CLASSES`). That is the
 * mechanism; this is that mechanism made reusable so the next glyph does not
 * have to re-derive it. **The two are pinned EQUAL by a guard** — see
 * `__tests__/canvasGlyphTargetScale.spec.tsx` — so a second authority on one
 * question cannot quietly appear (CLAUDE.md trap 12/21).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠⚠ WHY THESE ARE LITERAL STRINGS IN A MAP AND NOT A `(px) => string` BUILDER
 * ─────────────────────────────────────────────────────────────────────────────
 * **Tailwind's JIT scans source text with a regex; it cannot see a class that is
 * assembled at runtime.** A builder returning `` `w-[calc(${px}px*var(…))]` ``
 * would type-check, render, pass every jsdom assertion that reads `className` —
 * and emit NO CSS, so the user would get the unstyled default size with nothing
 * anywhere going red. That is the silent, green-looking failure this estate
 * keeps paying for, so the classes are spelled out where the scanner can read
 * them.
 *
 * The map is keyed by the px it encodes, so the mirror risk it introduces is
 * closed by derivation rather than by care: the guard asserts that **every key
 * N spells exactly N** in its value. A typo'd entry REDs; it cannot drift.
 *
 * ⚠ NO SPACES INSIDE THE ARBITRARY VALUE. Tailwind treats a space as a class
 * separator, so `calc(20px * var(…))` is three broken classes. Verified by
 * running the repo's own Tailwind against each string below and reading the
 * emitted CSS, with a bogus-class control asserting zero.
 *
 * ⚠ THE `var(…, 1)` FALLBACK IS LOAD-BEARING, for the same reason it is in
 * `valueProvenanceIcon.ts`: outside the React Flow subtree the property is
 * unset, so an off-canvas consumer of any of these components renders at the
 * plain declared px and is untouched by this file.
 */

import type { CSSProperties } from 'react'
import { MAX_LABEL_COUNTER_SCALE } from '../../utils/zoomLegibility'

/**
 * The px sizes the canvas node surfaces actually use. A size that is not here
 * is a TYPE ERROR at the call site rather than a silently missing class — which
 * is the whole reason this is a keyed map and not a free function.
 */
export type CanvasGlyphPx = 9 | 10 | 11 | 12 | 14 | 15 | 20 | 24 | 25

/**
 * `width` + `height` for a glyph or a button box, counter-scaled.
 *
 * ⚠ ON A LUCIDE ICON THIS MUST ACCOMPANY `size={N}`, NOT REPLACE IT. Lucide
 * renders `<svg width={size} height={size}>`; CSS beats the presentation
 * attribute, so the class wins where the stylesheet loaded and the attribute is
 * the honest fallback where it did not.
 */
export const CANVAS_GLYPH_SIZE_CLASSES: Readonly<Record<CanvasGlyphPx, string>> = Object.freeze({
  9: 'w-[calc(9px*var(--canvas-label-scale,1))] h-[calc(9px*var(--canvas-label-scale,1))]',
  10: 'w-[calc(10px*var(--canvas-label-scale,1))] h-[calc(10px*var(--canvas-label-scale,1))]',
  11: 'w-[calc(11px*var(--canvas-label-scale,1))] h-[calc(11px*var(--canvas-label-scale,1))]',
  12: 'w-[calc(12px*var(--canvas-label-scale,1))] h-[calc(12px*var(--canvas-label-scale,1))]',
  14: 'w-[calc(14px*var(--canvas-label-scale,1))] h-[calc(14px*var(--canvas-label-scale,1))]',
  15: 'w-[calc(15px*var(--canvas-label-scale,1))] h-[calc(15px*var(--canvas-label-scale,1))]',
  20: 'w-[calc(20px*var(--canvas-label-scale,1))] h-[calc(20px*var(--canvas-label-scale,1))]',
  24: 'w-[calc(24px*var(--canvas-label-scale,1))] h-[calc(24px*var(--canvas-label-scale,1))]',
  25: 'w-[calc(25px*var(--canvas-label-scale,1))] h-[calc(25px*var(--canvas-label-scale,1))]',
})

/**
 * ⭐⭐ THE HIT SLOP — AND THE REASON COUNTER-SCALING IT IS NOT OPTIONAL.
 *
 * A `::before` overlay expanding a button's hit area is itself node DOM, so it
 * sits inside the same transform and is scaled by the same zoom. A sibling lane
 * measured the consequence: `20 + 2 x 2 = 24` satisfied a spec written in CSS
 * px while **the user got a 12px target**. Slop alone fails and counter-scale
 * alone fails; the target is 24px only when BOTH the box and the slop carry the
 * scale.
 *
 * `-inset-[calc(Npx*var(…))]` emits `inset: calc(calc(Npx * var(…)) * -1)` —
 * verified against the repo's own Tailwind, not assumed.
 */
export const CANVAS_HIT_SLOP_CLASSES: Readonly<Record<2, string>> = Object.freeze({
  2: "before:absolute before:-inset-[calc(2px*var(--canvas-label-scale,1))] before:content-['']",
})

/**
 * Row gap between adjacent targets, counter-scaled.
 *
 * ⚠ THE GAP MUST SCALE WITH THE SLOP OR THE SEPARATION INVARIANT INVERTS.
 * `NodeQuickActions.targetSize` requires `gap > 2 x slop`. Counter-scaling the
 * slop while leaving `gap-1.5` fixed would double each 2px expansion into a
 * still-6px gap — `2 x 4 = 8 > 6` — and two hit areas that must stay apart
 * would begin to overlap. Scaling both preserves the ratio at every zoom.
 */
export const CANVAS_GAP_CLASSES: Readonly<Record<6, string>> = Object.freeze({
  6: 'gap-[calc(6px*var(--canvas-label-scale,1))]',
})

/**
 * Negative `bottom`/`right` offsets, counter-scaled.
 *
 * A badge pinned at `-6px` over a box whose SIZE now scales would drift off its
 * anchor as the zoom moved: the offset that centres a 12px circle on a corner
 * is `-6px` only while the circle is 12px. Scaling the offset with the size
 * keeps the two concentric at every zoom, which is what
 * `EvidenceGapBadge`'s visual badge and its larger focus target require of each
 * other.
 */
export const CANVAS_CORNER_OFFSET_CLASSES: Readonly<Record<6 | 12, string>> = Object.freeze({
  6: 'bottom-[calc(-6px*var(--canvas-label-scale,1))] right-[calc(-6px*var(--canvas-label-scale,1))]',
  12: 'bottom-[calc(-12px*var(--canvas-label-scale,1))] right-[calc(-12px*var(--canvas-label-scale,1))]',
})

/**
 * The bottom-LEFT mirror of {@link CANVAS_CORNER_OFFSET_CLASSES}, and it exists
 * because `ConstraintBadge` was never migrated when `EvidenceGapBadge` was.
 *
 * ⛔ WHAT THAT COST, in numbers rather than in principle. It was written
 * `-bottom-1.5 -left-1.5 w-3 h-3` around a `size={7}` glyph — all four raw CSS
 * px inside a transformed viewport. At the settle zoom (0.5) the user got a
 * **6px circle holding a 3.5px glyph**, under this file's own 10px legibility
 * floor, and a **10px hit target** against the 24px WCAG 2.2 AA minimum this
 * file exports as `MIN_TARGET_RENDERED_PX`. Not a judgement call — a constant
 * that already lives here, unapplied to one badge.
 *
 * ⚠ SEPARATE LITERALS, NOT AN ASSEMBLED STRING. Tailwind scans source text; a
 * class built at runtime from a side and a number emits no CSS at all, which
 * is why this is a second frozen map rather than a `side` parameter.
 */
/**
 * ⭐⭐ THE TOP-RIGHT CORNER STACK'S OWN ANCHOR — exported so the component and
 * the three specs that pin it read ONE string instead of four copies.
 *
 * ⛔ IT WAS `-top-2 -right-2`, AND THE `-top-2` HALF WAS A DEFECT NOBODY COULD
 * SEE ABOVE ZOOM 1. Eight unscaled px anchoring content that carries
 * `--canvas-label-scale`: at the settle zoom the `Needs input` pill grows to
 * ~34px against a fixed −8px offset and its lower third lands on the card
 * header's provenance mark. Paul's 15 Sep manual test caught it on four cards.
 *
 * `bottom-full` then anchored it to the element's OWN height, above the card.
 * ⚠ SUPERSEDED (gap 11, below): the growing pill has left the stack, so the
 * stack now sits INSIDE the card at the contract's offsets and the collision
 * this paragraph closed cannot arise from the marks that remain (fixed boxes).
 *
 * ⚠ THREE SPECS PINNED THE OLD LITERAL (`BaseNode.cornerStack`, `FactorNode`,
 * `OptionNode.leadingPillCornerStack`). Each was asserting the MEASURING STICK,
 * not the property it names in its own title — that the stack owns the corner
 * and its children carry no positioning of their own. They now read this
 * constant, so the next legitimate move of this anchor is a one-line change
 * and the invariant they actually exist for keeps biting.
 */
/**
 * ⭐⭐ THE CORNER MARKS SIT INSIDE THE CARD, AT THE CONTRACT'S OFFSETS (gap 11;
 * Visual Contract §02 `.node .attention{position:absolute;right:7px;top:5px;
 * width:25px;height:25px}`, "Only meaningful signals appear").
 *
 * ⛔ WHAT IT REPLACES. The stack was `absolute bottom-full right-3` with a scaled
 * `mb-`: it floated ABOVE the top border, in the row gap between tiers, where it
 * sat on the edges arriving at the card. That anchor was chosen to stop a
 * growing `Needs input` pill landing on the header's provenance mark; the pills
 * have since left this stack (they are worded STATE, and now sit in the card's
 * own in-flow state row — `BaseNode`), so the stack holds only fixed-size MARKS
 * (the attention cue and the coaching / structural marker, each one
 * `CANVAS_QUICK_ACTION_BOX_PX` box) and can take the contract's corner.
 *
 * · The offsets are the contract's, and they are NOT counter-scaled, for the
 *   reason `CANVAS_CORNER_INSET_CLASSES` gives for the rail's inset: an inset is
 *   breathing room from the frame, not a thing the user must see or hit. The
 *   members and the gap between them DO scale.
 * · The stack stays OUT OF FLOW, so no card box changes; the title's clearance
 *   is reserved by `cornerMarksHeaderReserveCss` / `cornerMarksTitleSpacerCss`
 *   below, only while a mark is actually present.
 * ⚠ No spaces inside the arbitrary values — Tailwind would split the class.
 */
export const CANVAS_CORNER_MARK_TOP_PX = 5 as const
export const CANVAS_CORNER_MARK_RIGHT_PX = 7 as const
/** The scaled gap between two marks in the stack (the class below spells it). */
export const CANVAS_CORNER_MARK_GAP_PX = 4 as const
/**
 * The clearance between text and a mark: the contract's `.node h3{padding-right:
 * 21px}` beside 12px of card padding puts the title's edge at 33px from the
 * frame's inner edge, one pixel clear of the 25px mark at 7px (7 + 25 + 1).
 */
export const CANVAS_CORNER_MARK_CLEARANCE_PX = 1 as const
/** The card's frame (`.node{border:1px}`, Tailwind `border` on the card root). */
export const CANVAS_CARD_FRAME_PX = 1 as const

export const CANVAS_CORNER_STACK_CLASSES =
  'absolute top-[5px] right-[7px] z-10 flex items-center gap-[calc(4px*var(--canvas-label-scale,1))]'

/** The run of `count` corner marks at scale 1: the boxes and the gaps between them. */
export function cornerMarksRunPx(count: number): number {
  const n = Math.max(0, Math.floor(count))
  return n === 0 ? 0 : n * CANVAS_QUICK_ACTION_BOX_PX + (n - 1) * CANVAS_CORNER_MARK_GAP_PX
}

/**
 * How far in from the card's inner (padding-box) right edge text must stop so it
 * never runs under `count` marks — at the LIVE scale, because the marks grow
 * with it while their inset does not.
 */
function cornerMarksClearanceCss(count: number): string {
  return `calc(${CANVAS_CORNER_MARK_RIGHT_PX + CANVAS_CORNER_MARK_CLEARANCE_PX}px + ${cornerMarksRunPx(count)}px * var(--canvas-label-scale, 1))`
}

/**
 * ⭐ THE HEADER ROW'S RIGHT RESERVE — for a card whose title SHARES its line with
 * header glyphs (the wide Question and Goal cards). The card's own right padding
 * already provides part of the clearance, so only the rest is reserved, and never
 * a negative amount (an anchor whose rail sits beside it already reserves more
 * than the marks need). `undefined` when there is no mark: no reserve at all.
 *
 * At 100% beside 12px of padding it is exactly the contract's 21px.
 */
export function cornerMarksHeaderReserveCss(count: number, cardPaddingRight: string): string | undefined {
  if (cornerMarksRunPx(count) === 0) return undefined
  return `max(0px, ${cornerMarksClearanceCss(count)} - ${cardPaddingRight})`
}

/**
 * ⭐⭐ THE TITLE'S FIRST-LINE SPACER — for a card whose title has its line to
 * itself (every repeated card: its title's minimum measure IS the card's text
 * measure, so the title box reaches the corner).
 *
 * It is the width of a right float one title line tall, so ONLY THE FIRST LINE
 * is shortened. ⛔ That is the point, and it was chosen over the contract's
 * all-lines `padding-right` on a measurement rather than a preference: the
 * title's minimum measure is derived so the widest word the product's content
 * holds fits at the counter-scale bound (`NODE_TITLE_MIN_MEASURE_PX`), and a
 * 46px all-lines reserve at the bound takes "Concentration" (pricing starter,
 * a card a behavioural finding marks) under it — a mid-word break, which
 * `e2e/visual/nodeLabelFit.visual.spec.ts` forbids at the settle zoom. With the
 * reserve on line 1 only, lines 2+ keep the full measure the bound was derived
 * for. Verified in headless Chromium (static harness, not the app): a float
 * inside the `-webkit-line-clamp` title box shortens line 1 and leaves line 2.
 *
 * `titleRightToFramePx` is the distance from the title box's right edge to the
 * card's inner right edge when the title box is at its minimum measure; the
 * `max(0px, …)` makes the spacer vanish wherever the title box already stops
 * short of the marks (a header reserve is doing the work, or the card is wide).
 */
export function cornerMarksTitleSpacerCss(count: number, titleRightToFramePx: number): string | undefined {
  if (cornerMarksRunPx(count) === 0) return undefined
  return `max(0px, ${cornerMarksClearanceCss(count)} - ${titleRightToFramePx}px)`
}

/**
 * ⭐⭐ THE RIGHT-HAND GROUP OF THE CARD HEADER — one string, every group that
 * sits there, because the header now holds groups that can carry MORE THAN ONE
 * GLYPH and one of them shipped without a gap.
 *
 * ⛔ THE DEFECT, MEASURED ON THIS BRANCH AT `dfa351cb`. The provenance group was
 * `inline-flex items-center shrink-0 ml-auto` — NO gap — and the two-mark branch
 * (`NodeProvenanceMark`, when node authorship and value basis disagree) mounts
 * two bare lucide svgs inside it, each `w-[calc(14px*var(--canvas-label-scale,1))]`
 * with no margin of its own. **They abut at 0px, at up to 28px each under the 2x
 * counter-scale.**
 *
 * ⚠ IT IS NOT COSMETIC HERE, AND `NodeProvenanceMark`'s OWN HEADER SAYS WHY. The
 * hue was taken off these glyphs on a measurement — `text-warning` is 1.92:1
 * against the card fill, under SC 1.4.11's 3:1 — on the explicit ground that
 * **"the SHAPE carries the meaning"**. Two touching 14px shapes at the fit zoom
 * degrade the one channel the design says is load-bearing, so a gap is the
 * cheapest defence of a decision already made.
 *
 * ⭐ THE FIX IS A SHARED OWNER, NOT A COPIED HABIT. `gap-1` was already the
 * convention for adjacent header glyphs — the `headerSlot` group in `BaseNode`
 * and the ScienceIcons group in `FactorNode` both spell it — and the provenance
 * group was the only one without it. Copying the token a third time is the
 * hand-maintained mirror this file exists to avoid (CLAUDE.md trap 12), so the
 * two `BaseNode` groups now read THIS string and cannot drift apart.
 * `FactorNode`'s group is nested INSIDE the `headerSlot` one and is deliberately
 * left alone: it is not an `ml-auto` header group, and folding it in here would
 * give it positioning it must not have.
 *
 * ⚠⚠ THE GAP IS NOT COUNTER-SCALED, AND THAT IS A KNOWN ASYMMETRY RATHER THAN AN
 * OVERSIGHT. The glyphs carry `--canvas-label-scale` and this 4px does not, so at
 * the settle zoom (0.5) the user gets two 14px glyphs separated by 2px instead of
 * 4px. Stated, not smuggled, and NOT resolved here for two reasons: (1) the
 * sibling groups this matches are in exactly the same position, so scaling only
 * this one would create the second authority the whole file argues against — the
 * question is owed by the header row as a whole; (2) a scaled gap costs 8px of
 * header measure at the bound instead of 4px, which widens the wrap band derived
 * in `BaseNode.twoMarksNeedAGap.spec.tsx` from `[294, 326)` to `[294, 330)`
 * against a `NODE_CARD_MAX_W` of 336. The cheap, consistent 4px is taken now; the
 * scaling question is named for whoever owns the header row next.
 */
export const CANVAS_HEADER_GLYPH_GROUP_CLASSES = 'inline-flex items-center gap-1 shrink-0 ml-auto'

/**
 * The px `gap-1` above resolves to — Tailwind spacing `1` = `0.25rem` = **4px**
 * at this app's 16px root.
 *
 * Exported as a NUMBER so the header-fit arithmetic can be computed rather than
 * restated: a card fits its title and its header glyphs on ONE row only when
 * `NODE_TITLE_MIN_MEASURE_PX + NODE_HEADER_GAP_PX + glyphs + gaps <= cardW -
 * NODE_CARD_PADDING_X`, and that sum needs this as a number, not as a class.
 *
 * ⚠ THE PAIR IS GUARDED, because a number beside a class string IS a mirror:
 * `BaseNode.twoMarksNeedAGap.spec.tsx` asserts the group string actually spells
 * `gap-1`, so changing one without the other REDs instead of silently
 * invalidating every width derived from it.
 */
export const CANVAS_HEADER_GLYPH_GAP_PX = 4

export const CANVAS_CORNER_OFFSET_CLASSES_LEFT: Readonly<Record<6 | 12, string>> = Object.freeze({
  6: 'bottom-[calc(-6px*var(--canvas-label-scale,1))] left-[calc(-6px*var(--canvas-label-scale,1))]',
  12: 'bottom-[calc(-12px*var(--canvas-label-scale,1))] left-[calc(-12px*var(--canvas-label-scale,1))]',
})

/**
 * Positive `bottom`/`right` insets for a control pinned inside a card corner.
 *
 * ⚠ THESE DO **NOT** CARRY THE COUNTER-SCALE, AND THAT ASYMMETRY IS THE POINT.
 * Everything else in this file scales because it is a THING THE USER MUST SEE
 * OR HIT at a declared size. An inset is neither: it is the breathing room
 * between a control and the card edge, and at the settle zoom a scaled 6px
 * would render at 6 px while the unscaled one renders at 3 px — a difference
 * nobody is trying to make, bought with model-space height on every card.
 *
 * It is a keyed map rather than the bare Tailwind `bottom-1.5` it replaces so
 * that the px is a NUMBER the band reservation below can be derived from. The
 * literal `6` used to live only as a Tailwind fraction in `NodeQuickActions`,
 * where `NODE_QUICK_ACTION_BAND_PX` could not read it — which is precisely how
 * a reservation and the thing it reserves for drift apart.
 */
export const CANVAS_CORNER_INSET_CLASSES: Readonly<Record<6, string>> = Object.freeze({
  6: 'bottom-[6px] right-[6px]',
})

/**
 * ⭐⭐ THE QUICK-ACTION ROW'S GEOMETRY, AS NUMBERS — so the card that must make
 * room for it can DERIVE that room instead of restating it.
 *
 * These three are not documentation. Each is USED at the row's own call site
 * (`NodeQuickActions.tsx`) to index the class maps above, and used again by
 * `NODE_QUICK_ACTION_BAND_PX` below. A mirror needs two independent copies of a
 * fact; there is one copy here, read twice.
 *
 * ⭐ 25, THE CONTRACT'S `.icon-btn{width:25px;height:25px}` (gap 34; it was 20).
 * The rail, the corner marks and every rail member read this one number, so the
 * band below, the anchor reserve and the marks' title clearance all move with
 * it — derived, not restated. The hit area grows with it (25 + 2 x 2 = 29 from
 * 24), so no target shrinks. At 100% the band is now 6 + 27 = 33px, against the
 * contract's `.node{padding-bottom:32px}` (rail at bottom 5 + 25 + 2).
 */
export const CANVAS_QUICK_ACTION_BOX_PX = 25 as const
export const CANVAS_QUICK_ACTION_INSET_PX = 6 as const
export const CANVAS_QUICK_ACTION_SLOP_PX = 2 as const

/**
 * ⭐⭐⭐ THE BOTTOM BAND A CARD MUST RESERVE SO ITS OWN CONTROLS NEVER COVER ITS
 * OWN CONTENT.
 *
 * ─── THE DEFECT THIS REPLACES ────────────────────────────────────────────────
 *
 * `BaseNode` reserved this band with a LITERAL: `padding: '12px 12px 24px 12px'`.
 * That `24` was a hand-copy of `bottom-1.5 + h-5` (6 + 20 = 26, so it was
 * already 2px short), and nothing derived one from the other or went red when
 * they disagreed — the hand-maintained mirror this estate keeps paying for.
 *
 * Counter-scaling the row (#1274) moved one half of that pair. The row's box
 * became `20 x scale` and its hit slop `2 x scale`, so at the settle zoom the
 * row occupied 6 + (20 + 2) x 2 = 50px while the reservation stayed 24 — and
 * the controls sat 26px INSIDE the content box, over the value a user hovers
 * the card in order to act on. Measured in a real browser, `vendor-selection`
 * at 1440x900, zoom 0.5000.
 *
 * ─── WHY IT IS SIZED AT THE BOUND AND IS NOT ITSELF A `calc(... * var(...))` ──
 *
 * ⚠ READ THIS SECTION AS THE LAYOUT'S RULE, NOT THE RENDERED CARD'S (contract
 * v3.1 RHY-01). This constant is still what the layout reserves, and it is
 * still sized at the bound. The card itself now renders
 * `NODE_QUICK_ACTION_BAND_CSS` below, which EQUALS this constant whenever the
 * layout measures (the measurer pins the scale to the bound) — so the drift
 * argued against here cannot arise from it. See that constant's header.
 *
 * The obvious repair is to make the reservation track the live scale, exactly
 * as the row does. **That is measurably wrong here, and the measurement already
 * exists in this repo.**
 *
 * Card height in MODEL px is what the layout reserves rows against, and
 * `zoomLegibility.ts` states the rule outright: *"Geometry cannot simply track
 * `labelCounterScale(zoom)` … Sizing for the BOUND is stable, needs no
 * relayout, and is correct at the only zoom the product ever chooses for the
 * user."* `measureNodeHeightsAtLabelBound.ts` carries what happens when
 * geometry ignores that — a layout run at one zoom and viewed at another goes
 * to **13 overlapping node pairs, constant across 20 samples over 30 s and
 * surviving a reload**, because the stride carries no zoom term. A reservation
 * that grew by 26px as the user zoomed out would add exactly that class of
 * drift to every card, to save a band nobody sees.
 *
 * So this is a CONSTANT, at `MAX_LABEL_COUNTER_SCALE` — the worst case, reached
 * at precisely the zoom a post-draft auto-fit parks at. It is correct where the
 * product puts the user, stable everywhere else, and invisible to the layout's
 * zoom-invariance because it does not move.
 *
 * ─── WHY THE SLOP IS IN THE SUM ─────────────────────────────────────────────
 *
 * The `::before` hit slop is not painted, so it covers nothing a user can SEE.
 * It does intercept the CLICK, which is the same harm one layer down: a
 * user aiming at a value and hitting "Open details" instead. Reserving for the
 * hit area rather than the visual box costs 4px at the bound and closes both.
 */
export const NODE_QUICK_ACTION_BAND_PX =
  CANVAS_QUICK_ACTION_INSET_PX +
  (CANVAS_QUICK_ACTION_BOX_PX + CANVAS_QUICK_ACTION_SLOP_PX) * MAX_LABEL_COUNTER_SCALE

/**
 * ⭐⭐ THE BAND AS THE CARD RENDERS IT — `calc()` over the live scale, which is
 * EXACTLY `NODE_QUICK_ACTION_BAND_PX` at the bound (contract v3.1 RHY-01, Paul
 * pt 13 "don't create empty space").
 *
 * ⚠ THIS SUPERSEDES THE "WHY IT IS SIZED AT THE BOUND" ARGUMENT ABOVE FOR THE
 * RENDERED CARD, AND NOT FOR THE LAYOUT — the distinction that argument did not
 * draw. Its premise was that a reservation tracking the live scale would make
 * the LAYOUT's heights depend on the zoom it happened to run at. That premise
 * no longer holds: `measureNodeHeightsAtLabelBound` pins
 * `--canvas-label-scale` to `MAX_LABEL_COUNTER_SCALE` on the React Flow root
 * before it reads `offsetHeight`, so this `calc()` resolves to exactly
 * `NODE_QUICK_ACTION_BAND_PX` during every layout read. Rows are therefore
 * reserved against the SAME height as before, and the only change is what the
 * user sees between reads: a card at a zoom above the settle zoom now draws
 * the band its rail actually needs (6 + 22 × scale) instead of 50px. At 100%
 * that was 22px of dead space under the last row of every card. (Those figures
 * are for the 20px box; with the contract's 25px box, gap 34, the band is
 * 6 + 27 × scale, i.e. 60 at the bound.)
 *
 * The rendered card can only be SHORTER than its reservation, never taller —
 * `--canvas-label-scale` never exceeds its bound — so the bbox cannot grow.
 * The gate that must stay green is `e2e/geometry/heightVsZoom.measure.ts`
 * (`cardsThatGrew: 0`).
 */
export const NODE_QUICK_ACTION_BAND_CSS =
  `calc(${CANVAS_QUICK_ACTION_INSET_PX}px + ${CANVAS_QUICK_ACTION_BOX_PX + CANVAS_QUICK_ACTION_SLOP_PX}px * var(--canvas-label-scale, 1))`

/**
 * ⭐ THE WIDTH THE ANCHOR RAIL NEEDS BESIDE ITS LAST ROW (contract v3.1 ANC-02 /
 * RHY-02: `.node.wide .target-row,.node.wide .row-meta{padding-right:58px}`,
 * `.node.wide .rail{position:absolute;right:6px;bottom:6px}`).
 *
 * The Question and Goal cards no longer reserve a band BELOW their last row;
 * the rail sits BESIDE it, so that row keeps its text clear of the rail. The
 * reserve is the rail's own run — `buttons` boxes of `CANVAS_QUICK_ACTION_BOX_PX`
 * with the scaled 6px gap between them — plus one more gap so text never
 * touches a button, all counter-scaled like the rail, plus the rail's unscaled
 * corner inset.
 *
 * ⚠ LITERAL CLASS STRINGS, ONE PER REACHABLE COUNT (3–6), NOT A FUNCTION AND
 * NOT A CUSTOM PROPERTY. Tailwind emits CSS only for class text it can SEE, so
 * a template-built class renders nothing; and an inline `--anchor-rail-w`
 * definition is invisible to `scripts/css-var-census.mjs`, which reported the
 * first cut of this as an undefined reference (the required
 * `css-var-resolution` guard). `anchorRailReservePx` below is the derivation,
 * and `canvasGlyphScale.contractV31.spec.ts` parses every literal back
 * and asserts it equals it, so the numbers are hand-typed once and checked
 * forever. The `[&>:last-child]` variant targets the body wrapper's LAST row
 * only: the rows above keep the card's full measure.
 *
 * Reachable counts: Challenge + More + one of Ask / coaching icon (mutually
 * exclusive in `NodeQuickActions`) = 3, plus the caller's `railIcons` and the
 * evidence / behaviour icons `NodeSignalRailIcons` draws — at most 6.
 */
export const ANCHOR_RAIL_MIN_BUTTONS = 3 as const
export const ANCHOR_RAIL_MAX_BUTTONS = 6 as const
export type AnchorRailButtons = 3 | 4 | 5 | 6

/** The scaled run the reserve covers, in px at scale 1 (see the classes). */
export function anchorRailReservePx(buttons: AnchorRailButtons): number {
  return buttons * CANVAS_QUICK_ACTION_BOX_PX + buttons * 6
}

export const ANCHOR_RAIL_RESERVE_CLASSES: Readonly<Record<AnchorRailButtons, string>> = Object.freeze({
  3: '[&>:last-child]:pr-[calc(6px+93px*var(--canvas-label-scale,1))]',
  4: '[&>:last-child]:pr-[calc(6px+124px*var(--canvas-label-scale,1))]',
  5: '[&>:last-child]:pr-[calc(6px+155px*var(--canvas-label-scale,1))]',
  6: '[&>:last-child]:pr-[calc(6px+186px*var(--canvas-label-scale,1))]',
})

/** Clamp a counted rail to a key of `ANCHOR_RAIL_RESERVE_CLASSES`. */
export function anchorRailButtonsKey(count: number): AnchorRailButtons {
  const n = Math.floor(count)
  if (n <= ANCHOR_RAIL_MIN_BUTTONS) return ANCHOR_RAIL_MIN_BUTTONS
  if (n >= ANCHOR_RAIL_MAX_BUTTONS) return ANCHOR_RAIL_MAX_BUTTONS
  return n as AnchorRailButtons
}

/**
 * WCAG 2.2 AA 2.5.8's minimum target, in the px a user actually gets.
 *
 * Exported so the components and the guard read ONE number. It is stated in
 * RENDERED px on purpose: the whole defect was a spec asserting 24 in units the
 * user never sees.
 */
export const MIN_TARGET_RENDERED_PX = 24

/**
 * ⭐⭐⭐ THE TARGET FLOOR FOR A **TEXT-BEARING** CONTROL — carried by the BOX,
 * not by a hit slop, and applied as an INLINE STYLE rather than a class. Both
 * choices are the finding, and both were arrived at by refusing the obvious fix.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IS SHORT, DERIVED AT THIS TIP RATHER THAN MEASURED IN A BROWSER
 * ─────────────────────────────────────────────────────────────────────────────
 * The maps above closed the ICON targets. They could not reach the controls
 * whose whole job is to make a team interrogate the model — the critical-
 * thinking prompts — because those carry TEXT, and the guard beside this file
 * excludes text-bearing controls by design (`canvasGlyphTargetScale.spec.tsx`:
 * *"a labelled control takes its target size from its TEXT box, which jsdom
 * cannot measure"*). That exclusion is correct about the question IT asks — did
 * the viewport transform halve an icon? — and it is silent about a different
 * one: does a text control meet 2.5.8 at all? Two questions, named apart
 * (CLAUDE.md trap 21); this constant answers the second and does not touch the
 * first.
 *
 * `typography.edgeLabel` is `calc(11px*var(--canvas-label-scale,1))` with
 * `leading-snug` (1.375), so its line box is `15.125 x scale` DECLARED. Across
 * the legible band `scale = 1/zoom`, so `declared x scale x zoom` collapses to
 * **15.125 rendered px at every zoom in the band** — the counter-scale is
 * working exactly as designed, and the box is still 8.875px short on its own.
 *
 *   `TierInvitation` button   no padding, no border, no slop
 *                             → **15.125px rendered**, at every zoom in the band
 *   `NodeChip` button         + `py-0.5` (4px) + 1px border, both UNSCALED
 *                             → painted `15.125 + 6 x zoom` = **18.125px** at
 *                               the settle zoom;
 *                             its `before:-inset-y-[3px]` is unscaled AND is
 *                             measured from the PADDING box, so it clears the
 *                             border by only 2px per side:
 *                             hit `15.125 + 10 x zoom` = **20.125px**.
 *
 * Both are under `MIN_TARGET_RENDERED_PX`, and the settle zoom is where the
 * product parks the user (`useFitViewOnLayoutVersion` floors at
 * `LABEL_LEGIBLE_ZOOM`). The rung there is `quiet`, not `line`, so the card body
 * — and every chip in it — is rendered: this is not a shortfall on a surface
 * nobody sees.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⛔ WHY NOT MORE HIT SLOP, WHICH IS THE OBVIOUS FIX
 * ─────────────────────────────────────────────────────────────────────────────
 * Because `CANVAS_GAP_CLASSES` states the price: the separation invariant is
 * `gap > 2 x slop`, and every container these controls sit in is BELOW it
 * already. `TierInvitationRow` is `flex-col gap-0.5` — **2px, unscaled, so 1px
 * rendered at the settle zoom**. The fifteen `flex gap-1 flex-wrap` chip rows
 * across eight node components give **4px unscaled**, i.e. 2px rendered between
 * WRAPPED lines. Any slop worth having overlaps its neighbour, and these
 * neighbours are DIFFERENT QUESTIONS — a near miss sends the wrong one to the
 * model, which is a worse product defect than a small target, not a smaller one.
 *
 * **A painted box cannot overlap its flex neighbours.** Sizing the BOX to the
 * minimum therefore discharges 2.5.8 and leaves the separation invariant
 * untouched — no new gap constant, no edit to fifteen containers, and nothing
 * for a sixteenth call site to forget. Where a control already carries slop
 * (`NodeChip`), that slop becomes surplus rather than load-bearing, so it is
 * left exactly as it is.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ WHY AN INLINE STYLE, WHEN EVERYTHING ABOVE IS A CLASS
 * ─────────────────────────────────────────────────────────────────────────────
 * The maps above are literal strings because **Tailwind's JIT scans source text
 * and emits no CSS for a class it cannot see** — the silent, green-looking
 * failure this file's header is about. An inline style is not scanned, so that
 * failure mode does not exist for it, and `BaseNode`'s `LOD_BLANKED_BODY_STYLE`
 * already carries `calc(16px * var(--canvas-label-scale, 1))` this way. The px
 * is READ from `MIN_TARGET_RENDERED_PX`, so this is still the one value in this
 * file with **no hand-copied number in it at all**.
 *
 * ⚠⚠ THE PROPERTY NAME IS SPELLED LITERALLY, AND THAT IS A CORRECTION, NOT AN
 * OVERSIGHT. It was `var(${CANVAS_LABEL_SCALE_VAR}, 1)`, which reads better and
 * cost a required check: `scripts/css-var-census.mjs` assembles a template
 * literal with sentinels, so an interpolation INSIDE the `var()` name region
 * makes the reference DYNAMIC — and `tests/ci-guards/css-var-resolution.spec.ts`
 * pins the dynamic sites by FILE, exactly and bidirectionally. This file joined
 * that set and the pin RED. Measured, not inferred: run 35366431899, shard 2,
 * `expected [ …(2) ] to deeply equal [ 'src/styles/evaluative.ts' ]`.
 *
 * ⭐ Spelling the name is also the STRONGER arm of that guard, not an evasion of
 * it. A static reference is checked against the real definitions and against
 * fallback drift; a dynamic one is only expanded and registered. It is what the
 * nine class entries above already do, and what the registry spec beside this
 * file already asserts against. The mirror it introduces is closed by
 * `theThinkingPromptsAreHittable.spec.tsx`, which parses the property name back
 * out of BOTH this constant and the two rendered call sites and asserts it
 * equals `CANVAS_LABEL_SCALE_VAR` — an assertion that was circular while the
 * name was interpolated and bites now that it is not.
 *
 * Frozen and module-level, so every consumer shares one object and a `memo`'d
 * button is not re-rendered by a fresh style literal each pass.
 *
 * ⚠ IT IS A FLOOR, NOT A HEIGHT. Tailwind Preflight sets `box-sizing:
 * border-box`, so this bounds padding and border too, and a control whose text
 * wraps to two lines simply grows past it. Consumers need `items-center` (or a
 * button's UA centring) for the text to sit in the middle of the taller box.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐⭐ WHY BOTH AXES — THE NAME SAID `BOX` WHILE ONE DIMENSION WAS FLOORED
 * ─────────────────────────────────────────────────────────────────────────────
 * This shipped as `minHeight` alone, under a header that said it *"floors the
 * BOX"* and a name ending `_BOX_STYLE`. WCAG 2.2 AA 2.5.8 asks for **24 x 24**
 * CSS px (or the spacing alternative), so one dimension is not the criterion,
 * and the review that caught it was right that the gap was the CLAIM rather
 * than the pixels.
 *
 * ⚠ AND THE HONEST HALF: on today's two call sites `minWidth` is very probably
 * inert, because both carry multi-word copy — `GHOST_TIERS` labels are whole
 * questions (*"What else could you do?"*) and `NodeChip` adds `px-2` on top of
 * its label. **That is exactly why it is added rather than argued away.** The
 * alternative was to keep one axis and defend it with a claim about label
 * content — a claim nothing in this file can enforce, that a future one-word
 * chip would falsify silently, and that would leave the constant's own NAME
 * carrying it. A floor that is inert today and true by construction tomorrow
 * costs nothing: it can only ever fire where the criterion is already failed,
 * and it fires by making a flex item wider, never by overlapping a neighbour.
 *
 * ⛔ IT STILL DOES NOT MEASURE THE PAINTED BOX, AND NOR CAN ANY GUARD HERE.
 * `min-height`/`min-width` are what this module DECLARES; what the user is
 * handed is decided by layout, in a browser. The claim this constant supports
 * is *"the floor is declared, in the units the user gets"* — not *"24 painted
 * pixels were observed"*. `theThinkingPromptsAreHittable.spec.tsx` states the
 * same boundary at the top of the file rather than letting a green suite imply
 * the stronger claim (CLAUDE.md trap 3: jsdom cannot prove visibility).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⛔⛔ TWO BOUNDED LIMITS, RECORDED BECAUSE NEITHER IS CLOSED BY THIS CONSTANT
 * ─────────────────────────────────────────────────────────────────────────────
 * Both are pinned EXACTLY in `theThinkingPromptsAreHittable.spec.tsx`, so the
 * suite REDs if either set grows or shrinks (CLAUDE.md trap 22f). A gap
 * recorded in the suite is honest; a gap invisible to it is how the shortfall
 * this constant closes reached the board in the first place.
 *
 * **L1 — BELOW `LABEL_LEGIBLE_ZOOM` THE FLOOR IS NOT MET.** `labelCounterScale`
 * caps at `1 / LABEL_LEGIBLE_ZOOM`, so under the floor the rendered target is
 * `MIN_TARGET_RENDERED_PX x MAX_LABEL_COUNTER_SCALE x zoom` — 19.2px at 0.4,
 * 12px at 0.25. The auto-fit cannot park there (`useFitViewOnLayoutVersion`
 * passes the floor as `minZoom`), but the canvas itself is `minZoom={0.1}`
 * (`ReactFlowGraph.tsx:988`), so a USER zoom-out reaches it.
 *
 * ⚠⚠ THE OBVIOUS DEFENCE IS *"level-of-detail has dropped the text there"*, AND
 * IT DOES NOT HOLD FOR EITHER CALL SITE. Derived at `BaseNode.tsx`, not assumed:
 *   · `TierInvitationRow` is rendered **OUTSIDE** the body wrapper LOD blanks,
 *     deliberately and with a comment saying so (`BaseNode.tsx:1878-1881`:
 *     *"an invitation that disappears at the zoom the auto-fit parks at is the
 *     defect this change exists to remove"*). It is visible below the floor by
 *     design.
 *   · `NodeChip` IS inside that wrapper — but blanking is
 *     `lodBodyBlanked = bodyReduced && lodBodyLine !== null`
 *     (`BaseNode.tsx:486`), and that declaration's own doc names REACHABLE null
 *     arms (a factor that is not `external`, an external factor on an ignorance
 *     prior, an option whose intervention count is unknown). On those cards the
 *     body is NOT blanked and the chips render.
 * So L1 is a real, reachable shortfall at user-chosen zooms below the floor —
 * stated at the `line` rung by name rather than waved at. Closing it needs the
 * counter-scale cap raised or the target sized off `zoom` directly, which moves
 * `MAX_LABEL_COUNTER_SCALE` and therefore node GEOMETRY with it — out of this
 * seam, and not a change to make from a comment.
 *
 * **L2 — THE `var()` FALLBACK FAILS OPEN, SILENTLY.** `CANVAS_LABEL_SCALE_VAR`
 * is set only on the MAIN React Flow root (`CanvasLabelScaleSync`). Rendered in
 * any second instance — the Compare-tab mini-maps are the named example in that
 * module's own header — the fallback `1` applies and the floor resolves to
 * `MIN_TARGET_RENDERED_PX` DECLARED px, i.e. `24 x zoom` rendered. Nothing
 * errors and nothing looks wrong. ⚠ The mitigating fact, stated rather than
 * used as an excuse: `typography.edgeLabel` reads the SAME var with the SAME
 * fallback, so in that instance the whole card is uniformly unscaled rather
 * than this control being singled out — a smaller surface, not a broken one.
 *
 * ⭐ ROWED, NOT BUILT: the registry beside this file
 * (`canvasGlyphTargetScale.spec.tsx`) cannot see either call site, twice over —
 * `targetsIn` filters to `textContent.trim() === ''` and `sizeFromClass` reads
 * heights from CLASSES only, so an inline style is invisible even if the filter
 * were widened. Widening it is a real job: it needs a text-bearing branch, an
 * inline-style reader, and a re-derivation of `KNOWN_SHORT_TARGETS` across all
 * five registered surfaces. Doing half of it would produce a registry that
 * LOOKS fleet-wide and is not — which is the defect that file's own header was
 * written about. Left alone deliberately; this constant is guarded by its own
 * spec instead.
 */
export const CANVAS_MIN_TARGET_BOX_STYLE: Readonly<CSSProperties> = Object.freeze({
  minHeight: `calc(${MIN_TARGET_RENDERED_PX}px * var(--canvas-label-scale, 1))`,
  minWidth: `calc(${MIN_TARGET_RENDERED_PX}px * var(--canvas-label-scale, 1))`,
})
