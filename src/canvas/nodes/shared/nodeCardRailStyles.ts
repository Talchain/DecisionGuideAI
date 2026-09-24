/**
 * The card rail's one button geometry, shared by every rail member (coaching,
 * evidence, behaviour, provenance, and the hover-only quick actions) so the rail
 * reads as ONE row of equal targets — the quick actions' own 20px box and 2px
 * hit slop, counter-scaled with `--canvas-label-scale` like every canvas glyph.
 *
 * ⭐ ONE ICON-BUTTON LANGUAGE — contract v3.1 (`.icon-btn`, `.icon-btn:hover`,
 * `.icon-btn svg`; deltas ICON-01 / ICON-02 / OPT-13 / F12 / FRAME-11). Every
 * member is muted at rest (its caller's tone class), and on hover AND keyboard
 * focus the glyph goes Info on an info-soft ground: `bg-info/10` over the panel
 * composites to ~#E9F1F4, the contract's `--info-soft` #EAF2F5, from an existing
 * token at alpha (no new colour). The hover used to be `bg-panel-hover`
 * (#FEF9F3), which cannot be seen on the #FEFEFE card, and the colour change
 * differed by member (coaching went Info, the data icons did not change, the
 * quick actions went to text-body) — one row, three hover languages.
 *
 * The focus ring keeps an offset (contract `outline-offset`, DS v5 §6.3) so it
 * separates from the info-soft ground it now sits on. Box, slop and gap are
 * unchanged, so `NODE_QUICK_ACTION_BAND_PX` — and every card height — is too.
 */
import {
  CANVAS_GLYPH_SIZE_CLASSES,
  CANVAS_HIT_SLOP_CLASSES,
  CANVAS_QUICK_ACTION_BOX_PX,
  CANVAS_QUICK_ACTION_SLOP_PX,
} from './canvasGlyphScale'

export const NODE_RAIL_BUTTON_CLASSES =
  'nodrag nopan relative inline-flex shrink-0 ' +
  CANVAS_GLYPH_SIZE_CLASSES[CANVAS_QUICK_ACTION_BOX_PX] +
  ' items-center justify-center rounded bg-panel/90 ' +
  'hover:bg-info/10 hover:text-info focus-visible:bg-info/10 focus-visible:text-info ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1 ' +
  CANVAS_HIT_SLOP_CLASSES[CANVAS_QUICK_ACTION_SLOP_PX]

/**
 * The glyph inside EVERY rail button — the resting members and the hover quick
 * actions alike (contract v3.1 `.icon-btn svg`, one size for the row; ICON-02).
 * 14px, counter-scaled: DS v5 §9.1 "Canvas node badge 14px", the size the
 * header provenance glyph on the same card already uses, and the nearest map
 * size to the contract's 15px. Lucide's 2/24 stroke then renders 1.17px, the
 * contract's 1.8/24 at 15px (1.125px). The 20px box is unchanged.
 *
 * ⚠ On a Lucide icon pass `size={NODE_RAIL_GLYPH_PX}` WITH the class (see
 * `CANVAS_GLYPH_SIZE_CLASSES`): the attribute is the fallback where the
 * stylesheet did not load.
 */
export const NODE_RAIL_GLYPH_PX = 14
export const NODE_RAIL_GLYPH_CLASSES = CANVAS_GLYPH_SIZE_CLASSES[NODE_RAIL_GLYPH_PX]
