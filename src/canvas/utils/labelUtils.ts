/**
 * Canvas node label utilities
 * Display-only transforms — never mutate underlying data
 */

/**
 * Strip normalisation scale metadata from factor labels.
 * Patterns like "(0–1 scale)", "(0–1)", "(0/1)" are technical artefacts
 * from the CEE pipeline and should not be shown to users.
 *
 * @param label - Raw factor label
 * @returns Cleaned label with scale metadata removed
 */
export function cleanFactorLabel(label: string): string {
  if (!label) return label

  // Strip any parenthetical starting with "0" followed by –, -, or /
  // Covers: (0–1 scale), (0–1 qualitative scale), (0–1, share of N), (0/1), (0-1), etc.
  return label
    .replace(/\s*\(0[–\-/].*?\)\s*/g, '')
    .trim()
}

/**
 * Map a sensitivity score (0–1) to a descriptive tier label.
 * Used for the Sensitivity bar on factor nodes (T6).
 *
 * | Score   | Label  |
 * |---------|--------|
 * | ≥ 0.7   | "High" |
 * | 0.4–0.69| "Med"  |
 * | < 0.4   | "Low"  |
 */
export function sensitivityTierLabel(score: number): string {
  if (score >= 0.7) return 'High'
  if (score >= 0.4) return 'Med'
  return 'Low'
}

/**
 * Map an evidence score (0–1) to a descriptive tier label.
 * Used for the Evidence bar on factor nodes (T6).
 *
 * | Score   | Label    |
 * |---------|----------|
 * | ≥ 0.7   | "Strong" |
 * | 0.4–0.69| "Fair"   |
 * | < 0.4   | "Weak"   |
 */
export function evidenceTierLabel(score: number): string {
  if (score >= 0.7) return 'Strong'
  if (score >= 0.4) return 'Fair'
  return 'Weak'
}

/** Factor types that use qualitative tier labels (no numeric meaning to users) */
const QUALITATIVE_FACTOR_TYPES = new Set(['quality', 'demand', 'other'])

/**
 * Map a 0–1 intervention value to a qualitative tier label.
 * Used when a factor has no unit and its type is qualitative.
 *
 * | Value      | Label     |
 * |------------|-----------|
 * | 0          | "None"    |
 * | 0.01–0.30  | "Low"     |
 * | 0.31–0.60  | "Medium"  |
 * | 0.61–0.89  | "High"    |
 * | 0.90–1.0   | "Very high"|
 */
export function qualitativeTierLabel(value: number): string {
  if (value === 0) return 'None'
  if (value <= 0.3) return 'Low'
  if (value <= 0.6) return 'Medium'
  if (value < 0.9) return 'High'
  return 'Very high'
}

/** Currency symbols that prefix the number (J2). Used for both char-prefix checks and full-unit-string checks. */
export const CURRENCY_SYMBOLS = new Set([
  '£', '$', '€', '¥', '₹', '₩', '₽', '฿', '₫', '₪', '₴', '₸', '₺', '₼', '₾',
  'CHF', 'kr', 'R$',
])

/**
 * Denormalise a 0–1 intervention value using the factor's cap.
 * When cap > 1, the CEE normalised the value to [0, 1] — multiply back.
 * Returns the raw value unchanged when cap is absent or ≤ 1.
 *
 * @param value - Normalised 0–1 value
 * @param cap   - Factor cap (the ceiling of the original scale)
 * @returns Denormalised value
 */
export function denormaliseInterventionValue(value: number, cap: number | null | undefined): number {
  return (cap != null && cap > 1) ? value * cap : value
}

/**
 * Format an intervention value for display as a human-readable chip.
 * Used in OptionNode intervention chips (T8/J1).
 *
 * When a factor has a cap, the normalised 0–1 value is first denormalised
 * (value × cap), then formatted using the unit. Capped values are rounded
 * to whole numbers.
 *
 * @param value      - Normalised intervention value (0–1 for binary/fraction, or raw)
 * @param unit       - Optional unit hint (e.g. '%', 'fraction', '£', 'engineers')
 * @param factorType - Optional CEE factor_type (e.g. 'quality', 'demand') — triggers tier labels
 * @param cap        - Optional factor cap for denormalisation (J1)
 * @returns Human-readable string
 */
export function formatInterventionValue(value: number, unit?: string, factorType?: string, cap?: number): string {
  // J1: Denormalise using cap before any formatting
  const v = denormaliseInterventionValue(value, cap)
  const hasCap = cap != null && cap > 1

  if (unit === 'fraction' || unit === 'proportion') {
    // Fraction/proportion: always treat as 0–1 scale (cap doesn't apply — already a ratio)
    return `${Math.round(value * 100)}%`
  }
  if (unit === '%') {
    const display = Math.abs(value) <= 1 ? Math.round(value * 100) : Math.round(value)
    return `${display}%`
  }
  // J2: Currency symbols prefix the number
  if (unit && CURRENCY_SYMBOLS.has(unit[0])) {
    const rounded = hasCap ? Math.round(v) : v
    return `${unit}${rounded.toLocaleString('en-GB')}`
  }
  if (unit) {
    // J1: Round to integer when cap was applied; otherwise preserve existing precision
    const display = hasCap ? Math.round(v) : v
    return `${display} ${unit}`
  }
  // No unit — check if this is a qualitative factor type (case-insensitive)
  const ft = factorType?.toLowerCase().trim()
  const isQualitative = !ft || QUALITATIVE_FACTOR_TYPES.has(ft)
  if (isQualitative) {
    // Qualitative: use original normalised value for tier labels (0–1 scale)
    return qualitativeTierLabel(value)
  }
  // Continuous without unit, non-qualitative — show as number (max 2 dp)
  return v % 1 === 0 ? String(v) : v.toFixed(2).replace(/\.?0+$/, '')
}
