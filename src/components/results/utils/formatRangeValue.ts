/**
 * Magnitude-tiered numeric display shared by OptionCards' range labels and
 * formatThreshold's user-unit percent branch. ONE implementation so the hero
 * readouts and the option cards below can never drift onto different
 * precision rules — the tier boundaries changing in one surface but not the
 * other would reintroduce the cross-surface scale mismatch the staging trust
 * review caught.
 *
 * No decimal places above 100, 1 dp above 10, 2 dp otherwise. Host-locale
 * rendering is deliberate (long-standing OptionCards behaviour). Tiny
 * negatives that round to zero normalise to '0' — never the negative-zero
 * string '-0'.
 */
export function formatRangeValue(v: number): string {
  const abs = Math.abs(v)
  const decimals = abs > 100 ? 0 : abs > 10 ? 1 : 2
  const rendered = v.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: 0 })
  return rendered === '-0' ? '0' : rendered
}
