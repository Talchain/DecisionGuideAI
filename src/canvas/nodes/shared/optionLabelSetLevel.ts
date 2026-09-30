/**
 * ⭐ AN OPTION LABEL WHOSE FIGURE ITS SET LEVEL NO LONGER MATCHES (AIQ rulings 5908802422 + 5908832064).
 *
 * "Raise to £59" while the option sets £60 claims, wherever the label stands ALONE (results rows, the leader line,
 * the hero), a result for £59 that was computed at £60. The label is the user's words and is NEVER rewritten; the
 * surface says the level beside it: "Raise to £59 (set to £60)". True whether or not an edit happened.
 *
 * Conservative by construction — every other shape returns the label unchanged (an under-claim, never a false one):
 *   · the option sets exactly ONE target with a reading, and that reading holds exactly ONE currency figure;
 *   · the label names at least one figure in that currency ("Raise Pro from £49 to £59" names two), and NONE of them
 *     is the set level. The suffix is true either way; the predicate only decides when it is worth saying.
 */
const CURRENCY_FIGURE = /([£$€])\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?\s?([kKmM])?(?![a-zA-Z])/g

interface Figure { readonly currency: string; readonly value: number }

function currencyFigures(text: string): Figure[] {
  const out: Figure[] = []
  for (const m of text.matchAll(CURRENCY_FIGURE)) {
    const whole = Number(m[2].replace(/,/g, ''))
    const frac = m[3] ? Number(`0.${m[3]}`) : 0
    const scale = m[4] ? (m[4].toLowerCase() === 'k' ? 1e3 : 1e6) : 1
    out.push({ currency: m[1], value: Math.round((whole + frac) * scale * 100) / 100 })
  }
  return out
}

export function optionLabelWithSetLevel(label: string, setReadings: readonly string[]): string {
  if (setReadings.length !== 1) return label
  const inReading = currencyFigures(setReadings[0])
  if (inReading.length !== 1) return label
  const level = inReading[0]
  const inLabel = currencyFigures(label).filter((f) => f.currency === level.currency)
  if (inLabel.length === 0 || inLabel.some((f) => f.value === level.value)) return label
  return `${label} (set to ${setReadings[0].trim()})`
}
