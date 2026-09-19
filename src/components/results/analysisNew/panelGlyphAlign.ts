/**
 * WHERE A GLYPH SITS ON THE LINE BESIDE IT — DERIVED ONCE, NOT TYPED PER SITE.
 *
 * `ICON_SCALE` named the icon's SIZE. This names the other half of the same
 * relationship: how far down it must start so the line looks level. Both were
 * hand-typed at every call site; only one of them has had a name until now.
 *
 * ## The drift, measured 2026-09-19 across `analysisNew`
 *
 * Eight sites nudge a glyph to centre it on the first line of adjacent text.
 * **Four are right and four are a pixel out** — and the four that are right are
 * right because someone happened to pick the correct pair, not because anything
 * checked:
 *
 * ```
 *   site                       glyph          text scale     correct  shipped
 *   TrustLine:88               section 16px   panelHeader     2px      2px   ok
 *   RobustnessCaveat:157       section 16px   panelHeader     2px      1px   1 out
 *   ModelHeldUp:162            section 16px   panelHeader     2px      1px   1 out
 *   DecisionRecorded:236       section 16px   panelHeader     2px      1px   1 out
 *   AtAGlance:620              inline  12px   panelMeta       2px      3px   1 out
 *   AtAGlance:1182             row     14px   panelBody       3px      3px   ok
 *   AtAGlance:1074             bullet   4px   panelMeta       6px      6px   ok
 *   AtAGlance:1118             bullet   4px   panelMeta       6px      6px   ok
 * ```
 *
 * ⭐ THE FOUR AGREEMENTS ARE THE CONTROL. A derivation that disagreed with
 * every shipped value would be evidence about the derivation, not about the
 * code. This one reproduces every value a human got right, across three
 * different glyph sizes and three different text scales, and differs only where
 * the same relationship was given two answers.
 *
 * ## ⚠ WHY A HAND-TYPED NUDGE IS NOT MERELY UNTIDY
 *
 * The number is a function of two things it does not name — the glyph's height
 * and the line box of the text beside it. When either moves, the literal stays
 * exactly where it is and is simply wrong, with **no red anywhere, because no
 * test in this estate can see one pixel**. `ICON_SCALE` moved the first of
 * those two in this very PR.
 *
 * ## The derivation
 *
 * A Tailwind line box is `fontSize x lineHeight`; centring a glyph of height
 * `g` on it is `(box - g) / 2`, rounded.
 *
 * ⚠ VERIFIED, NOT ASSUMED: `tailwind.config.js` overrides neither `fontSize`
 * nor `lineHeight`, so Tailwind's defaults apply — `leading-snug` 1.375,
 * `leading-relaxed` 1.625. The spec re-derives the box from `typography`'s own
 * class strings rather than trusting this sentence.
 *
 * ## ⛔ WHAT THIS IS NOT
 *
 * Not a spacing scale. It says nothing about `space-y`, `gap`, or the distance
 * between blocks — those are design decisions about how far apart things sit.
 * This is arithmetic about one line looking level, which is why an arbitrary
 * pixel value is the honest spelling here and a scale step would not be: the
 * right answer is 2px in five of the eight pairs below, and no 4px scale can
 * say 2.
 *
 * It also does not govern an icon in INLINE flow (`inline` + `-mt-px`). That is
 * baseline alignment, a different mechanism with a different correct answer.
 */

/**
 * Line box in px per panel text scale, from its own two factors.
 *
 * ⚠ The panel renders exactly three sizes and `typography` is the authority for
 * them; these entries exist to name the LINE BOX, which no other module does.
 */
const LINE_BOX_PX = {
  /** `text-sm` 14px x `leading-snug` 1.375 */
  panelHeader: 14 * 1.375,
  /** `text-xs` 12px x `leading-relaxed` 1.625 */
  panelBody: 12 * 1.625,
  /** `text-[11px]` x `leading-snug` 1.375 */
  panelMeta: 11 * 1.375,
} as const

export type PanelTextScale = keyof typeof LINE_BOX_PX

/**
 * Glyph heights in px.
 *
 * ⚠ These are SIZES, not tiers. `ICON_SCALE` decides which size a given depth
 * gets; this module only needs the resulting height — and `bullet` has no tier
 * at all, which is why the two maps are not one.
 */
export const GLYPH_PX = {
  /** `w-4 h-4` — matches `ICON_SCALE.section` */
  section: 16,
  /** `w-3.5 h-3.5` — matches `ICON_SCALE.row` */
  row: 14,
  /** `w-3 h-3` — matches `ICON_SCALE.inline` */
  inline: 12,
  /** `h-1 w-1` — a list bullet, which no icon tier covers */
  bullet: 4,
} as const

export type GlyphName = keyof typeof GLYPH_PX

/**
 * The top nudge in px that centres `glyph` on the first line of `scale`.
 *
 * Returns 0 rather than a negative: a glyph taller than the line box already
 * overhangs, and pulling it up would deepen the overhang instead of levelling
 * anything.
 */
export function glyphNudgePx(glyph: GlyphName, scale: PanelTextScale): number {
  const slack = LINE_BOX_PX[scale] - GLYPH_PX[glyph]
  return slack <= 0 ? 0 : Math.round(slack / 2)
}

/** The class that levels `glyph` against the first line of `scale`. */
export function glyphAlign(glyph: GlyphName, scale: PanelTextScale): string {
  const px = glyphNudgePx(glyph, scale)
  return px === 0 ? '' : `mt-[${px}px]`
}
