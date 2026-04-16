/**
 * formatValueWithUnit — shared raw-value formatting utility.
 *
 * Single source of truth for displaying a raw numeric value with its unit
 * across triage cards, expertise rows, and option preview current-state display.
 *
 * Rules (unified spec §2.4):
 * - Currency symbol (£, $, €) prefix without space: £5,000
 * - ISO currency code (GBP, USD, CHF) prefix with space: GBP 5,000
 * - Percentage suffix: 4.5% not % 4.5
 * - Time/generic units suffix with a space: 3 months, 500 users
 * - Numbers ≥ 1000 get thousand separators (en-GB locale)
 * - Placeholder units (scale/score/index/norm/normalised/unit/units) + 0–1
 *   value → qualitative label. Outside that range, the unit is suppressed
 *   and the bare number is rendered — placeholder units carry no real-world
 *   scale, so "0 score" / "50 index" are misleading.
 *
 * This utility handles ALREADY-DENORMALISED (raw) values only. For intervention
 * values that require cap-based denormalisation, see OptionPreview.tsx
 * formatInterventionDisplay which has its own discrete/cap logic.
 */

import { classifyUnit } from './labelUtils'

/** Qualitative label for 0–1 scale values (exclusive upper boundary). */
export function qualitativeLabel(v: number): string {
  if (v < 0.2) return 'very low'
  if (v < 0.4) return 'low'
  if (v < 0.6) return 'moderate'
  if (v < 0.8) return 'high'
  return 'very high'
}

/** Locale-aware number formatter with thousand separators for values ≥ 1000. */
const NUMBER_FMT = new Intl.NumberFormat('en-GB')
export function formatNumber(n: number): string {
  if (Math.abs(n) >= 1000) return NUMBER_FMT.format(n)
  return String(n)
}

/**
 * Format a raw value with its unit for panel display.
 *
 * @param rawValue - The denormalised real-world value (not a 0–1 normalised value,
 *                   unless the factor genuinely lives on a 0–1 scale).
 * @param unit     - Optional unit string (e.g. "£", "%", "months", "GBP", "scale").
 */
export function formatValueWithUnit(rawValue: number, unit: string | undefined | null): string {
  const { kind, canonical } = classifyUnit(unit ?? null)

  if ((kind === 'none' || kind === 'placeholder') && rawValue >= 0 && rawValue <= 1) {
    return qualitativeLabel(rawValue)
  }
  if (kind === 'none' || kind === 'placeholder') return formatNumber(rawValue)
  if (kind === 'symbol') return `${canonical}${formatNumber(rawValue)}`
  if (kind === 'iso') return `${canonical} ${formatNumber(rawValue)}`
  if (kind === 'percent') return `${formatNumber(rawValue)}%`
  // kind === 'other' — generic unit (months, users, etc.)
  return `${formatNumber(rawValue)} ${canonical}`
}
