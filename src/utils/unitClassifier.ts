/**
 * Unit classification — single source of truth.
 *
 * Moved here from `src/canvas/utils/labelUtils.ts` in Brief 5.7 close-out
 * follow-up so shared components (ScientificEditor, TriageCard) can consume
 * it without importing from the canvas layer. The canvas labelUtils.ts
 * re-exports these symbols for backward compatibility, keeping every
 * existing canvas import path stable while reversing the dependency
 * direction (canvas now depends on this neutral util, not the other way
 * round).
 *
 * Used by every value formatter that renders a numeric value with a unit:
 * canvas FactorNode/OptionNode, model-tab utils, shared ScientificEditor
 * and TriageCard, results ConfidenceSection, and `formatFactorDisplayValue`.
 */

/**
 * Generic placeholder units that should render as "scale" / "index" /
 * "score" labels rather than concrete units. Drives the qualitative-tier
 * branch in formatters.
 */
export const GENERIC_PLACEHOLDER_UNITS: ReadonlySet<string> = new Set([
  'scale', 'index', 'score', 'normalised', 'normalized', 'norm', 'unit', 'units',
])

/**
 * Currency glyphs that prefix the number with NO space (e.g. "£49", "$500").
 * Single-char symbols only. Multi-char ISO codes live in ISO_CURRENCY_CODES.
 */
export const CURRENCY_SYMBOLS: ReadonlySet<string> = new Set([
  '£', '$', '€', '¥', '₹', '₩', '₽', '฿', '₫', '₪', '₴', '₸', '₺', '₼', '₾',
])

/**
 * ISO currency codes that prefix the number WITH a space (e.g. "CHF 500",
 * "USD 1,200"). Single source of truth for both labelUtils and model-tab/utils.
 */
export const ISO_CURRENCY_CODES: ReadonlySet<string> = new Set([
  'USD', 'GBP', 'EUR', 'JPY', 'INR', 'KRW', 'RUB', 'TRY', 'UAH', 'NGN', 'VND', 'BTC',
  'CHF', 'CAD', 'AUD', 'NZD', 'HKD', 'SGD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK',
  'HUF', 'RON', 'BGN', 'HRK', 'MXN', 'BRL', 'ARS', 'CLP', 'COP', 'PEN', 'ZAR',
  'EGP', 'AED', 'SAR', 'QAR', 'ILS', 'THB', 'MYR', 'IDR', 'PHP', 'PKR', 'BDT', 'LKR',
  // Non-standard labels that behave like ISO codes for display purposes.
  'kr', 'R$',
])

export type UnitClass = 'none' | 'symbol' | 'iso' | 'percent' | 'placeholder' | 'other'

/**
 * Unit classification used by every value formatter.
 *
 * Returns:
 *   - 'none'        — unit is null / undefined / empty after trim
 *   - 'symbol'      — single-char currency glyph (£, $, €, …)
 *   - 'iso'         — multi-char ISO code or ISO-ish label (CHF, USD, kr, R$)
 *   - 'percent'     — '%'
 *   - 'placeholder' — generic placeholder (scale, index, score, …)
 *   - 'other'       — a real unit that should render as a trailing suffix
 *                     (engineers, months, FTE, …)
 *
 * Lookup order: none → symbol (exact) → iso (case-insensitive for 3-letter
 * ISO codes; exact for non-ISO labels like 'kr' / 'R$') → percent →
 * placeholder → other.
 */
export function classifyUnit(unit: string | null | undefined): { kind: UnitClass; canonical: string } {
  if (unit == null) return { kind: 'none', canonical: '' }
  const trimmed = unit.trim()
  if (!trimmed) return { kind: 'none', canonical: '' }

  // Symbol match first — single-char glyphs are case-sensitive (£/$/€ don't
  // have "upper/lowercase" versions anyway).
  if (CURRENCY_SYMBOLS.has(trimmed)) return { kind: 'symbol', canonical: trimmed }

  // ISO code match — try the raw form first (preserves 'kr' / 'R$' labels),
  // then the uppercase form (so 'chf' / 'usd' work too).
  if (ISO_CURRENCY_CODES.has(trimmed)) return { kind: 'iso', canonical: trimmed }
  const upper = trimmed.toUpperCase()
  if (ISO_CURRENCY_CODES.has(upper)) return { kind: 'iso', canonical: upper }

  if (trimmed === '%') return { kind: 'percent', canonical: '%' }

  if (GENERIC_PLACEHOLDER_UNITS.has(trimmed.toLowerCase())) {
    return { kind: 'placeholder', canonical: trimmed }
  }

  return { kind: 'other', canonical: trimmed }
}
