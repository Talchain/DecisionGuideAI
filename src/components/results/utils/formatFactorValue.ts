/**
 * formatFactorValue — priority-based factor-value display helper.
 *
 * Brief 4 Task 7. Single source of truth for "what string should we show for
 * this factor's value?" across Analysis-tab surfaces. Consumers should pass
 * the intervention record (if any) alongside the observed state; the helper
 * picks the richest available representation.
 *
 * Priority:
 *   1. intervention_details[factor_id].display_value (already pre-formatted
 *      by CEE / PLoT — use verbatim).
 *   2. raw_value + unit via formatValueWithUnit (real-world value on a
 *      meaningful unit).
 *   3. "Not set" placeholder when the factor is an inferred zero with no
 *      unit and the factor type is not a cost (cost=0 is a legitimate
 *      meaningful value; silencing it would hide real zero-cost options).
 *
 * The normalised 0–1 `value` alone is NEVER the user-facing display unless
 * the caller explicitly asks for expert / technical mode. "0" or "0 scale"
 * is always wrong in the standard view.
 */

import { formatValueWithUnit } from '@/canvas/utils/formatValueWithUnit'

export interface FactorValueSource {
  /** Pre-formatted display value from intervention_details (preferred). */
  displayValue?: string | null
  /** Denormalised real-world number with a meaningful unit. */
  rawValue?: number | null
  /** Unit string (currency symbol, ISO code, "%", "months", etc.). */
  unit?: string | null
  /** Normalised 0–1 value (last-resort, expert mode only). */
  normalisedValue?: number | null
  /** Whether this factor's value was inferred (not user-supplied). */
  extractionType?: 'inferred' | 'user' | 'brief' | string | null
  /** Factor type — cost factors are never "Not set" at value=0. */
  factorType?: string | null
  /** Expert mode: falls back to normalisedValue when nothing richer exists. */
  expertMode?: boolean
}

export interface FormattedFactorValue {
  /** The string to render (may be a placeholder). */
  text: string
  /** True when text is a placeholder ("Not set") — consumers can swap in an empty input with placeholder copy. */
  isPlaceholder: boolean
}

export function formatFactorValue(source: FactorValueSource): FormattedFactorValue {
  const { displayValue, rawValue, unit, normalisedValue, extractionType, factorType, expertMode } = source

  // 1 — pre-formatted display value
  if (typeof displayValue === 'string' && displayValue.trim().length > 0) {
    return { text: displayValue.trim(), isPlaceholder: false }
  }

  // 2 — raw value + unit
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    // Inferred-zero factors (not cost): show placeholder instead of "0"
    const looksInferredZero = rawValue === 0 && extractionType === 'inferred' && factorType !== 'cost'
    if (looksInferredZero) {
      return { text: 'Not set', isPlaceholder: true }
    }
    return { text: formatValueWithUnit(rawValue, unit), isPlaceholder: false }
  }

  // 3 — expert-only normalised fallback
  if (expertMode && typeof normalisedValue === 'number' && Number.isFinite(normalisedValue)) {
    return { text: formatValueWithUnit(normalisedValue, unit), isPlaceholder: false }
  }

  return { text: 'Not set', isPlaceholder: true }
}
