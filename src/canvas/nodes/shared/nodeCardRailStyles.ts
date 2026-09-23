/**
 * The card rail's one button geometry, shared by every rail member (coaching,
 * evidence, behaviour, provenance, and the hover-only quick actions) so the rail
 * reads as ONE row of equal targets — the quick actions' own 20px box and 2px
 * hit slop, counter-scaled with `--canvas-label-scale` like every canvas glyph.
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
  ' items-center justify-center rounded bg-panel/90 hover:bg-panel-hover ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-info ' +
  CANVAS_HIT_SLOP_CLASSES[CANVAS_QUICK_ACTION_SLOP_PX]

/** The glyph inside a rail button — 12px, counter-scaled. */
export const NODE_RAIL_GLYPH_CLASSES = CANVAS_GLYPH_SIZE_CLASSES[12]
