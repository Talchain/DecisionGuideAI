/**
 * Shared utilities for the model-tab component suite.
 */

import type { ObservedState } from './types'

// ── Value formatting ──────────────────────────────────────────────────────────

const CURRENCY_SYMBOLS = new Set(['£', '$', '€', '¥', '₹', '₩', '₽', '₺', '₴', '₦', '₫', '₿'])

/** Smart number: integers stay integer, decimals use minimal precision (max 2dp, no trailing zeros) */
export function formatSmartNumber(n: number): string {
  if (Number.isInteger(n)) return String(n)
  const fixed = n.toFixed(2)
  return fixed.replace(/\.?0+$/, '')
}

/** Format value+unit: currency symbols prefix ("£49"), everything else suffixes ("9 months") */
export function formatValueWithUnit(rawValue: number, unit: string): string {
  const trimmedUnit = unit.trim()
  if (CURRENCY_SYMBOLS.has(trimmedUnit) || /^[A-Z]{3}$/.test(trimmedUnit)) {
    return `${trimmedUnit}${formatSmartNumber(rawValue)}`
  }
  return `${formatSmartNumber(rawValue)} ${trimmedUnit}`
}

/** Derive primary human-readable value from observed state */
export function getPrimaryValue(obs: ObservedState): string | null {
  if (obs.raw_value !== undefined && obs.unit) {
    return formatValueWithUnit(obs.raw_value, obs.unit)
  }
  if (obs.raw_value !== undefined) {
    return formatSmartNumber(obs.raw_value)
  }
  return null
}

// ── Source mapping ────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  brief_extraction: 'From brief',
  cee_inference: 'AI estimate',
  user: 'User edited',
}

const SOURCE_TOOLTIPS: Record<string, string> = {
  brief_extraction: 'Source: brief_extraction',
  cee_inference: 'Source: cee_inference',
  user: 'Source: user',
}

export function mapSourceToDisplay(source: string | undefined): string | null {
  if (!source) return null
  return SOURCE_LABELS[source] ?? source
}

export function mapSourceToTooltip(source: string | undefined): string | undefined {
  if (!source) return undefined
  return SOURCE_TOOLTIPS[source] ?? `Source: ${source}`
}

// ── Strength semantic labels ──────────────────────────────────────────────────
// Re-export from strengthBands.ts (canonical thresholds from validation_ui_data_contract_v1.1).
export { getStrengthLabel as strengthSemanticLabel } from './strengthBands'
