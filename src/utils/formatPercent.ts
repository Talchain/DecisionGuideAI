/**
 * Centralised formatter for percentage values in the Results panel.
 * Prevents inconsistent ~, +, ± symbols across components.
 *
 * @param value - Raw value (0-1 for probabilities, or already a percentage)
 * @param options.sign - Whether to include +/- prefix (default: false)
 * @param options.fromDecimal - If true, multiply by 100 first (default: false)
 * @param options.precision - Decimal places (default: 0)
 * @returns Formatted string e.g. "58%", "+10%", "-14%"
 */
export function formatPercent(
  value: number,
  options: { sign?: boolean; fromDecimal?: boolean; precision?: number } = {},
): string {
  const { sign = false, fromDecimal = false, precision = 0 } = options

  const pct = fromDecimal ? value * 100 : value
  const rounded = precision > 0 ? pct.toFixed(precision) : String(Math.round(pct))

  if (sign && pct > 0) return `+${rounded}%`
  return `${rounded}%`
}
