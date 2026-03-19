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
 *
 * UI-SEM-015: These thresholds (0.7 / 0.4) are heuristic — PLoT does not yet provide
 * canonical tier labels for sensitivity scores. Remove when PLoT provides tier thresholds.
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
 *
 * UI-SEM-015: These thresholds (0.7 / 0.4) are heuristic — PLoT does not yet provide
 * canonical tier labels for evidence/confidence scores. Remove when PLoT provides tier thresholds.
 */
export function evidenceTierLabel(score: number): string {
  if (score >= 0.7) return 'Strong'
  if (score >= 0.4) return 'Fair'
  return 'Weak'
}

/**
 * Factor types that use qualitative tier labels (no numeric meaning to users).
 * 'binary' is included: a binary factor encodes a yes/no state, and its 0/1
 * values map to 'Not used'/'Very high' via the FactorNode special case and
 * to 'Very low'/'Very high' in intervention chips via qualitativeTierLabel.
 */
export const QUALITATIVE_FACTOR_TYPES = new Set(['quality', 'demand', 'other', 'binary'])

/**
 * Internal CEE factor_type descriptor values that must never appear as display units.
 * If the `unit` field contains one of these values it is a data model error —
 * treat it as "no unit" rather than displaying the descriptor to the user.
 *
 * This is the explicit guard for Brief 1b Task 4 (factor_type leak fix).
 * Both `formatFactorValue` and `formatInterventionValue` pass `unit` through
 * `sanitiseUnit()` (which calls `isSuppressedUnit()`) before any formatting.
 * Any unit string present in this set is silently dropped and the no-unit
 * formatting path is used instead.
 */
const INTERNAL_FACTOR_TYPE_DESCRIPTORS = new Set([
  'binary', 'normalized', 'normalised', 'continuous', 'quality',
  'demand', 'cost', 'time', 'other',
])

/**
 * Map a 0–1 intervention value to a qualitative tier label.
 * Used when a factor has no unit and its type is qualitative.
 *
 * | Value     | Label      |
 * |-----------|------------|
 * | 0–0.20    | "Very low" |
 * | 0.21–0.40 | "Low"      |
 * | 0.41–0.60 | "Medium"   |
 * | 0.61–0.80 | "High"     |
 * | 0.81–1.0  | "Very high"|
 *
 * Note: FactorNode renders 'Not used' for binary value=0 via its own special
 * case before reaching this function. Intervention chips (OptionNode) show
 * 'Very low' for value=0 on qualitative factors.
 */
export function qualitativeTierLabel(value: number): string {
  if (value <= 0.2) return 'Very low'
  if (value <= 0.4) return 'Low'
  if (value <= 0.6) return 'Medium'
  if (value <= 0.8) return 'High'
  return 'Very high'
}

/** Currency symbols that prefix the number (J2). Used for both char-prefix checks and full-unit-string checks. */
export const CURRENCY_SYMBOLS = new Set([
  '£', '$', '€', '¥', '₹', '₩', '₽', '฿', '₫', '₪', '₴', '₸', '₺', '₼', '₾',
  'CHF', 'kr', 'R$',
])

/**
 * Returns true if the given unit string represents a currency symbol.
 * Checks the full string first (for multi-char symbols like 'CHF', 'kr', 'R$'),
 * then the first character (for single-char symbols like '£', '$', '€').
 */
export function isCurrencyUnit(unit: string): boolean {
  if (!unit) return false
  return CURRENCY_SYMBOLS.has(unit) || CURRENCY_SYMBOLS.has(unit[0])
}

/**
 * Returns true if the unit is an internal factor_type descriptor that must
 * never appear in user-facing display (e.g. "binary", "normalized").
 */
export function isSuppressedUnit(unit: string | undefined): boolean {
  if (!unit) return false
  return INTERNAL_FACTOR_TYPE_DESCRIPTORS.has(unit.toLowerCase().trim())
}

/**
 * Returns the unit string if it is safe for user-facing display, or undefined
 * if it is an internal factor_type descriptor that should never be shown.
 */
function sanitiseUnit(unit: string | undefined): string | undefined {
  if (!unit) return undefined
  return isSuppressedUnit(unit) ? undefined : unit
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export function inferInterventionScaleBase(
  cap: number | null | undefined,
  observedValue?: number | null,
  observedRawValue?: string | number | null,
): number | null {
  const capScale = cap != null && cap > 1 ? cap : null
  const raw = toFiniteNumber(observedRawValue)
  const normalised = typeof observedValue === 'number' && Number.isFinite(observedValue) && observedValue > 0
    ? observedValue
    : null

  if (raw != null && normalised != null) {
    const inferredScale = raw / normalised
    if (Number.isFinite(inferredScale) && inferredScale > 1) {
      if (capScale == null) return inferredScale
      const drift = Math.abs(inferredScale - capScale) / Math.max(inferredScale, capScale)
      return drift > 0.15 ? inferredScale : capScale
    }
  }

  return capScale
}

/**
 * Denormalise a 0–1 intervention value using the factor's cap.
 * When cap > 1, the CEE normalised the value to [0, 1] — multiply back.
 * Returns the raw value unchanged when cap is absent or ≤ 1.
 *
 * @param value - Normalised 0–1 value
 * @param cap   - Factor cap (the ceiling of the original scale)
 * @returns Denormalised value
 */
export function denormaliseInterventionValue(
  value: number,
  cap: number | null | undefined,
  observedValue?: number | null,
  observedRawValue?: string | number | null,
): number {
  const scaleBase = inferInterventionScaleBase(cap, observedValue, observedRawValue)
  if (scaleBase == null) return value
  // Guard: if value is an integer > 1 and within the scale, it's likely already denormalised.
  // Values ≤ 1 (including 0 and 1.0) are always treated as normalised — note Number.isInteger(1.0) === true in JS.
  if (Number.isInteger(value) && value > 1 && value <= scaleBase) return value
  return value * scaleBase
}

/**
 * Format a factor's observed state value for display on the factor node card.
 *
 * Priority order:
 *  1. `raw_value` + `unit` — user-stated baseline (e.g. "£49/mo", "12 engineers")
 *  2. Denormalisation via `cap` — when raw_value absent but value + cap present
 *  3. Qualitative tier label — last resort when no unit or cap available
 *
 * @param observedState - The factor's observed state object
 * @returns Human-readable value string, or null if no data
 */
export function formatFactorValue(observedState: {
  value?: number
  raw_value?: string | number
  unit?: string
  cap?: number
  factor_type?: string
} | undefined | null): string | null {
  if (!observedState) return null

  const { raw_value, value, cap, factor_type } = observedState
  const unit = sanitiseUnit(observedState.unit)

  // 1. raw_value present — preferred path
  if (raw_value !== undefined && raw_value !== null && String(raw_value).trim() !== '') {
    const rawStr = String(raw_value).trim()
    if (!unit) return rawStr
    const numericRaw = Number(rawStr)
    if (isCurrencyUnit(unit)) {
      if (!isNaN(numericRaw) && rawStr !== '') {
        return formatInterventionValue(numericRaw, unit, factor_type)
      }
      return `${unit}${rawStr}`
    }
    // % unit: no space between value and symbol (e.g. "0%" not "0 %")
    if (unit === '%') {
      return `${rawStr}%`
    }
    return `${rawStr} ${unit}`
  }

  if (value === undefined) return null

  // 2. Denormalise via cap when available
  if (cap != null && cap > 1) {
    const denormed = denormaliseInterventionValue(value, cap)
    if (unit) {
      if (isCurrencyUnit(unit)) {
        return `${unit}${Math.round(denormed).toLocaleString('en-GB')}`
      }
      if (unit === '%') {
        const pct = Math.abs(value) <= 1 ? Math.round(value * 100) : Math.round(value)
        return `${pct}%`
      }
      return `${Math.round(denormed)} ${unit}`
    }
  }

  // 3. Qualitative fallback (no unit) or percentage of unit-bearing but cap-less value
  if (!unit) return qualitativeTierLabel(value)
  // Unit present but no cap — format as percentage of unit scale (e.g. 0.85 = "85%")
  if (unit === '%') return `${Math.round(value * 100)}%`
  return null
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
export function formatInterventionValue(
  value: number,
  unit?: string,
  factorType?: string,
  cap?: number,
  observedValue?: number | null,
  observedRawValue?: string | number | null,
): string {
  // Sanitise unit — never display internal factor_type descriptor strings as units
  unit = sanitiseUnit(unit)
  // J1: Denormalise using cap before any formatting
  const v = denormaliseInterventionValue(value, cap, observedValue, observedRawValue)
  const scaleBase = inferInterventionScaleBase(cap, observedValue, observedRawValue)
  const hasScaleBase = scaleBase != null && scaleBase > 1

  if (unit === 'fraction' || unit === 'proportion') {
    // Fraction/proportion: always treat as 0–1 scale (cap doesn't apply — already a ratio)
    return `${Math.round(value * 100)}%`
  }
  if (unit === '%') {
    const display = Math.abs(value) <= 1 ? Math.round(value * 100) : Math.round(value)
    return `${display}%`
  }
  // J2: Currency symbols prefix the number
  if (unit && isCurrencyUnit(unit)) {
    const rounded = hasScaleBase ? Math.round(v) : v
    return `${unit}${rounded.toLocaleString('en-GB')}`
  }
  if (unit) {
    // J1: Round to integer when cap was applied; otherwise preserve existing precision
    const display = hasScaleBase ? Math.round(v) : v
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
