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
 * label through the three canvas tokens in `typography.ts` and nothing else.
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

/**
 * The px sizes the canvas node surfaces actually use. A size that is not here
 * is a TYPE ERROR at the call site rather than a silently missing class — which
 * is the whole reason this is a keyed map and not a free function.
 */
export type CanvasGlyphPx = 9 | 10 | 11 | 12 | 14 | 20 | 24

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
  20: 'w-[calc(20px*var(--canvas-label-scale,1))] h-[calc(20px*var(--canvas-label-scale,1))]',
  24: 'w-[calc(24px*var(--canvas-label-scale,1))] h-[calc(24px*var(--canvas-label-scale,1))]',
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
 * WCAG 2.2 AA 2.5.8's minimum target, in the px a user actually gets.
 *
 * Exported so the components and the guard read ONE number. It is stated in
 * RENDERED px on purpose: the whole defect was a spec asserting 24 in units the
 * user never sees.
 */
export const MIN_TARGET_RENDERED_PX = 24
