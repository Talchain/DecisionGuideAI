/**
 * A risk's chance, as the percentage the card shows: a whole percentage as before, but never rounded onto a figure that says
 * something else. `Math.round(p * 100)` turned a stated 0.4% into "0%", which reads as impossible (and 99.6% into "100%", which
 * reads as certain). A chance that is not exactly 0 or 100 keeps its decimals when whole-percent rounding would land on 0% or 100%
 * ("0.4%", "99.6%"); below 0.01% it says so. Everything else rounds exactly as the card always has (0.376 reads "38%"; the
 * inspector's editor keeps the unrounded figure). The card's description carries the chance exactly, as `percent` in
 * scripts/olumi-core/lib/words.mjs words it.
 */
export function chancePercentText(probability: number): string {
  const v = probability * 100
  const whole = Math.round(v)
  if (whole > 0 && whole < 100) return `${whole}%`
  if (v === 0) return '0%'
  if (v === 100) return '100%'
  if (v < 0.01) return 'under 0.01%'
  if (v > 99.99) return 'over 99.99%'
  return `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2, useGrouping: false }).format(v)}%`
}
