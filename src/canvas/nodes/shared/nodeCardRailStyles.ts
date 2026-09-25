/**
 * The card rail's one button geometry, shared by every rail member (coaching,
 * evidence, behaviour, provenance, and the hover-only quick actions) so the rail
 * reads as ONE row of equal targets — the contract's 25px `.icon-btn` box
 * (`CANVAS_QUICK_ACTION_BOX_PX`, 20 until gap 34) and a 2px hit slop,
 * counter-scaled with `--canvas-label-scale` like every canvas glyph.
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
 * separates from the info-soft ground it now sits on. (That change moved no
 * box; gap 34's 20 → 25 box does, and `NODE_QUICK_ACTION_BAND_PX` is derived
 * from it, so the band a card reserves moves with the rail rather than apart.)
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
 * actions alike (contract `.icon-btn svg{width:15px;height:15px}`, one size for
 * the row; ICON-02). 15px, counter-scaled, in the contract's 25px box (gap 34;
 * it was 14 in a 20px box — the nearest map size then, before the map carried
 * 15). Lucide's 2/24 stroke renders 1.25px here.
 *
 * ⚠ On a Lucide icon pass `size={NODE_RAIL_GLYPH_PX}` WITH the class (see
 * `CANVAS_GLYPH_SIZE_CLASSES`): the attribute is the fallback where the
 * stylesheet did not load.
 */
export const NODE_RAIL_GLYPH_PX = 15
export const NODE_RAIL_GLYPH_CLASSES = CANVAS_GLYPH_SIZE_CLASSES[NODE_RAIL_GLYPH_PX]

/**
 * ⭐ THE RAIL'S RESTING COLOURS (gap 34; contract `.icon-btn{color:#777B77}`,
 * `.icon-btn.behaviour{color:#736DA0}`), each from a `brand.css` channel token,
 * so the value lives in the token file and nowhere else.
 *
 *   · REST — every data icon, the hover quick actions and the coaching icon.
 *     ⚠ The coaching icon stays in this grey at rest (Paul 23 Sep pt 6 overrides
 *     the contract's `.icon-btn.coaching{color:var(--info)}`); it goes Info only
 *     on hover/focus, like every member (`NODE_RAIL_BUTTON_CLASSES`).
 *   · BEHAVIOUR — the one behavioural-finding icon. It was body ink, which read
 *     as the loudest glyph on the card; the contract gives it its own muted
 *     violet.
 *
 * Contrast on the card fill (#FEFEFE), for a non-text glyph (SC 1.4.11, 3:1):
 * #777B77 ≈ 4.3:1, #736DA0 ≈ 4.7:1.
 *
 * ⚠ ARBITRARY-VALUE CLASSES OVER A TOKEN, NOT `theme.colors` ENTRIES, and on
 * purpose: a `colors` key generates `text-*`/`bg-*`/`border-*` for the whole app,
 * and #777B77 sits in the 3:1–4.5:1 band that
 * `tests/ci-guards/reasoning-model-text-contrast-per-site.spec.ts` pins for
 * config colours, because it must never be painted as body TEXT. These classes
 * are glyph colours for the rail only. Literal strings, no spaces, so the
 * Tailwind scanner emits them.
 */
export const NODE_RAIL_REST_TONE_CLASS = 'text-[color:rgb(var(--rail-icon-rgb))]'
export const NODE_RAIL_BEHAVIOUR_TONE_CLASS = 'text-[color:rgb(var(--behaviour-icon-rgb))]'
