/**
 * panelIcons — the icon scale for the AI panel, and the one stroke weight.
 * British English: standardise, colour, behaviour.
 *
 * ── WHAT WAS THERE ───────────────────────────────────────────────────────────
 * Measured on `5b932c28`, on ELEMENTS THAT ARE ACTUALLY ICONS (an `<svg>` or a
 * component imported from `lucide-react` — container `div`s excluded, which is
 * what made an earlier count read 13):
 *
 *     10px × 2 · 11px × 5 · 12px × 33 · 14px × 16 · 15px × 1 · 16px × 22 · 18px × 1
 *
 * Seven sizes, written five different ways: `size={12}`, `w-3 h-3`, `w-3.5 h-3.5`,
 * `w-[18px] h-[18px]`, and raw `width="16" height="16"`. Three of those spellings
 * say the same thing as another one, so the same 14px icon appears as `size={14}`
 * in one file and `w-3.5 h-3.5` in the next.
 *
 * ── WHY THREE SIZES AND NOT TWO ──────────────────────────────────────────────
 * ⚠ A two-size scale (12 dense / 16 standalone) was proposed before the design
 * system had been read properly. DS v5 USES 14px, twice and specifically:
 * §8.3 gives inline validation icons as `AlertTriangle` / `Check` at 14px, and
 * §17 gives the notice anatomy a 16px leading icon. Collapsing 14 into 12 or 16
 * would have made the panel violate the DS in order to tidy it.
 *
 * So the scale is the three sizes the DS and the code already agree on, and they
 * are also the three that carry 71 of the 80 icons: 12, 14, 16.
 * The strays — 10, 11, 15 and 18 — go to their nearest neighbour.
 *
 * ── STROKE WEIGHT IS NOT A TASTE CALL ────────────────────────────────────────
 * DS v5 §17 states the library contract: *"Lucide (`lucide-react@0.263.1`)…
 * 24px grid, 2px stroke weight."* The panel shipped FIVE weights — 1, 1.5, 1.8,
 * 2, 2.2 — and the commonest (1.8, ten uses) is not the specified one. `Play`
 * appears at 1.8 in one place and 2 in another: the same glyph, two weights,
 * inside one panel. This is conformance, not preference.
 *
 * ── NOT FIXED HERE, AND DELIBERATELY ─────────────────────────────────────────
 * Five hand-drawn glyphs turned out to be copies of Lucide's own path data and
 * were swapped for the components themselves — no visual delta. THREE raw `<svg>`
 * remain and are not drift: the panel's chrome shape, and two bespoke dashed
 * connector arrows Lucide has no equivalent for.
 */

/** Dense rows, inline chips, chevrons. The panel default — 33 of 80 icons. */
export const ICON_DENSE = 12

/** Inline status and validation icons. DS v5 §8.3 states this size. */
export const ICON_STATUS = 14

/** Standalone controls and notice leading icons. DS v5 §17 states this size. */
export const ICON_STANDALONE = 16

/** DS v5 §17: Lucide's own grid is 24px at 2px stroke. One weight, no exceptions. */
export const ICON_STROKE = 2

/** The scale, for guards and for anything that needs to validate a size. */
export const ICON_SIZES = [ICON_DENSE, ICON_STATUS, ICON_STANDALONE] as const
