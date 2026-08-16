/**
 * R6 (Paul, 16 Aug 2026) — "placeholder wall collapses to one subtle `est.`
 * marker at rest, detail on hover/inspector."
 *
 * S17's wall was largely one string repeated down the canvas: `Moderate (0.5)`
 * on every factor and outcome. The qualitative word carries the meaning; the
 * parenthesised number is the raw default showing through, and it is what made
 * a drafted model read as unfinished.
 *
 * At REST this drops the parenthesised number and lets the caller add ONE
 * `est.` marker. Detailed view, the hover popover and the inspector keep the
 * full string. DISPLAY ONLY: the value, its provenance and everything the
 * analysis does with it are untouched.
 *
 * Deliberately conservative. It strips only a trailing parenthetical that is
 * ENTIRELY a number — `Moderate (0.5)`, `High (0.82)`, `Low (0)`. Anything
 * else is left exactly as the producer wrote it: `Moderate (per Q3 board
 * pack)` keeps its parenthetical, because that is content, not a default
 * leaking through. Writing the rule around "what the producer meant" rather
 * than "what my one failing example looked like" is the point — the corpus
 * below is drawn from the shipped starter data, not from memory.
 */
const TRAILING_NUMERIC_PARENTHETICAL = /^(.*\S)\s*\(\s*-?\d+(?:\.\d+)?\s*%?\s*\)$/

export function collapseEstimateDisplay(display: string | null | undefined): string | null {
  if (display == null) return null
  const trimmed = display.trim()
  if (trimmed === '') return display
  const m = TRAILING_NUMERIC_PARENTHETICAL.exec(trimmed)
  return m ? m[1] : display
}
