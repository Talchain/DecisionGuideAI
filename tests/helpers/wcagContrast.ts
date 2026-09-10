/**
 * WCAG 2.x relative luminance, contrast ratio, and alpha compositing — ONE
 * implementation, shared.
 *
 * WHY THIS MODULE EXISTS. Three copies of `luminance` + `contrast` were already
 * in the tree when the per-site guard was written:
 *   · tests/ci-guards/text-light-contrast.spec.ts
 *   · src/canvas/nodes/__tests__/GhostOptionNode.contrast.spec.ts
 *   · src/canvas/model-tab-v2/__tests__/groupHeadingCountsAreTwoNumbers.spec.tsx
 * The first of those says so in its own header — "Lifted verbatim ... so both
 * a11y guards measure with ONE implementation, not two that can drift" — which
 * is the intent, expressed by copying, which is the hand-maintained mirror at the
 * top of CLAUDE.md. A fourth copy for the per-site guard would have made four
 * chances to get the sRGB transfer function subtly different, and a contrast
 * guard that measures differently from the other contrast guards is worse than
 * none: two guards would disagree about the same pixel and nobody would know
 * which to believe. So the maths lives here and the guards import it.
 *
 * Every function is pure and total. The three spec anchors (#000/#FFF = 21,
 * #FFF/#FFF = 1, #767676/#FFF = 4.54) are asserted by each importing guard's own
 * positive control rather than here, so a guard cannot import this module without
 * also proving, in its own run, that the maths it just imported still measures.
 */

/** SC 1.4.3 — normal-size text (below 18.66px bold / 24px regular). */
export const WCAG_TEXT_MIN = 4.5

/**
 * SC 1.4.3 — LARGE text, and SC 1.4.11 — non-text contrast (icons, graphical
 * objects carrying information). Same number, two different success criteria;
 * they are kept as separate named constants because they are separate CLAIMS and
 * a future tightening of one must not silently move the other.
 */
export const WCAG_LARGE_TEXT_MIN = 3.0
export const WCAG_NON_TEXT_MIN = 3.0

/**
 * SC 1.4.3's large-text boundary, in CSS pixels.
 *
 * The spec is written in POINTS — 18pt, or 14pt bold — and 1pt = 4/3 CSS px, so
 * 18pt = 24px and 14pt = 18.66px. A site qualifies for the 3:1 floor only if it
 * is >= 24px, OR >= 18.66px AND bold (font-weight >= 700).
 */
export const LARGE_TEXT_PX = 24
export const LARGE_TEXT_BOLD_PX = 18.66
export const BOLD_WEIGHT = 700

/** Parse `#abc` / `#AABBCC` (and `#AABBCCDD`, alpha ignored) to 0-255 channels. */
export function channels(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number]
}

/** 0-255 channels back to an upper-case `#RRGGBB`. */
export function toHex(ch: readonly number[]): string {
  return (
    '#' +
    ch
      .slice(0, 3)
      .map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  )
}

/** WCAG 2.x relative luminance of an opaque sRGB colour. */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const v = c / 255
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2.x contrast ratio. Symmetric: order of the arguments does not matter. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * `fg` painted at opacity `alpha` over an opaque `bg` — simple source-over
 * compositing in sRGB space, which is what a browser does for `rgb(… / α)`.
 *
 * ⚠ WHY A CONTRAST GUARD NEEDS THIS AND WHY IT IS NOT AN ESCAPE HATCH. A tinted
 * pill (`bg-warning/10 text-warning`) is often assumed to rescue a failing text
 * colour by "changing the ground". It does the opposite: the tint moves the
 * ground TOWARDS the text colour, so the ratio falls monotonically with alpha.
 * Measured on this palette, `text-warning` is 1.92:1 bare on `--bg-panel` and
 * 1.80:1 inside `bg-warning/10`; `text-info` is the sharper case, passing at
 * 4.78:1 bare and FAILING at 4.21:1 inside `bg-info/10`. A tint can only ever
 * make a same-hue pairing worse. This function exists so the guard measures that
 * rather than assuming it in either direction.
 */
export function compositeOver(fg: string, bg: string, alpha: number): string {
  const f = channels(fg)
  const b = channels(bg)
  return toHex(f.map((v, i) => alpha * v + (1 - alpha) * b[i]))
}

/**
 * Does text at `px` and `weight` qualify for SC 1.4.3's large-text 3:1 floor?
 * Returns false for anything it cannot establish, so an unknown size is held to
 * the stricter 4.5:1 rather than quietly exempted.
 */
export function isLargeText(px: number | null, weight: number | null): boolean {
  if (px == null) return false
  if (px >= LARGE_TEXT_PX) return true
  return px >= LARGE_TEXT_BOLD_PX && weight != null && weight >= BOLD_WEIGHT
}
