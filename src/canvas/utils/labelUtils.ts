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

/**
 * Format an intervention value for display as a human-readable chip.
 * Used in OptionNode intervention chips (T8).
 *
 * @param value - Normalised intervention value (0–1 for binary/fraction, or raw)
 * @param unit  - Optional unit hint (e.g. '%', 'fraction', '£')
 * @returns Human-readable string
 */
export function formatInterventionValue(value: number, unit?: string): string {
  if (unit === 'fraction' || unit === 'proportion') {
    return `${Math.round(value * 100)}%`
  }
  if (unit === '%') {
    const display = Math.abs(value) <= 1 ? Math.round(value * 100) : Math.round(value)
    return `${display}%`
  }
  if (unit && (unit.startsWith('£') || unit.startsWith('$') || unit.startsWith('€'))) {
    return `${unit}${value.toLocaleString('en-GB')}`
  }
  if (unit) {
    return `${value} ${unit}`
  }
  // Binary 0/1 without unit
  if (value === 0) return 'None'
  if (value === 1) return 'Full'
  // Continuous without unit — show as number (max 2 dp)
  return value % 1 === 0 ? String(value) : value.toFixed(2).replace(/\.?0+$/, '')
}
