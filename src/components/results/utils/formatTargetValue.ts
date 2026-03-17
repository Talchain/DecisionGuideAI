/**
 * Format a goal threshold value with its unit for user-facing display.
 *
 * @param value - The raw threshold value
 * @param unit - Outcome unit type (currency, percent, count)
 * @param symbol - Currency symbol (e.g., '$', '£') when unit is 'currency'
 * @returns Formatted string (e.g., "$1,200", "85%", "42")
 */
export function formatTargetValue(
  value: number,
  unit?: 'currency' | 'percent' | 'count',
  symbol?: string,
): string {
  if (unit === 'currency' && symbol) return `${symbol}${value.toLocaleString()}`
  if (unit === 'percent') return `${value}%`
  return value.toLocaleString()
}
