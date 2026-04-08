/**
 * formatFactorDisplayValue — contextual display text for factor values.
 *
 * TEMPORARY: display_value should come from CEE. This heuristic bridges
 * until schema v0.3.0. This utility is the single location for the
 * heuristic so it can be replaced with a one-line passthrough later.
 *
 * Returns null when no meaningful text can be produced (node renders
 * no body text). Never returns generic placeholders.
 */

const KNOWN_SUFFIXES = /\s*(Presence|Capacity|Level|Status|State|Added|Rate)\s*$/i

function stripSuffixes(label: string): string {
  return label.replace(KNOWN_SUFFIXES, '').trim()
}

/**
 * Graph v1.1 polish 4 Task 1: a unit is "meaningless" when it's the bare
 * "scale" descriptor produced by CEE for normalised factors with no
 * real-world calibration. Such values (0, 0.1, 0.5 etc.) imply
 * "measured-at-zero/half" but actually mean "no concrete data". Currency,
 * %, count and named units (engineers, hours, …) are all kept.
 */
function isMeaninglessUnit(unit: string | null | undefined): boolean {
  if (unit == null) return true
  const u = unit.toLowerCase().trim()
  return u === '' || u === 'scale'
}

function formatNumber(value: number): string {
  return Math.abs(value) >= 1000
    ? value.toLocaleString('en-GB')
    : String(value)
}

interface FactorDisplayInput {
  label: string
  value?: number | null
  raw_value?: number | string | null
  unit?: string | null
  factor_type?: string | null
  cap?: number | null
  category?: string | null
  /** CEE-provided display text. When present, returned verbatim (no heuristic). */
  display_value?: string | null
}

export function formatFactorDisplayValue(input: FactorDisplayInput): string | null {
  const { label, value, raw_value, unit, factor_type, category, display_value } = input

  // CEE-provided display_value takes absolute priority — render verbatim
  if (display_value != null && display_value !== '') {
    return display_value
  }

  // External factors with no data: no body text (dashed border is the signal)
  if (category === 'external' && (value == null && raw_value == null)) {
    return null
  }

  // Pattern 1: raw_value + unit → formatted display
  if (raw_value != null && unit) {
    const numericRaw = typeof raw_value === 'number' ? raw_value : Number(raw_value)
    if (!isNaN(numericRaw)) {
      // Cost factor at zero → contextual
      if (numericRaw === 0 && factor_type?.toLowerCase() === 'cost') {
        return 'No cost allocated'
      }
      // Currency prefix
      if (['£', '$', '€', '¥'].includes(unit)) {
        return `${unit}${formatNumber(numericRaw)}`
      }
      // Percentage
      if (unit === '%') {
        return `${Math.round(numericRaw)}%`
      }
      // Unit suffix
      return `${formatNumber(numericRaw)} ${unit}`
    }
    // raw_value is a non-numeric string with unit
    return `${raw_value} ${unit}`
  }

  // raw_value without unit
  if (raw_value != null && !unit) {
    const numericRaw = typeof raw_value === 'number' ? raw_value : Number(raw_value)
    if (!isNaN(numericRaw)) {
      return formatNumber(numericRaw)
    }
    return String(raw_value)
  }

  // Pattern 2: value only (no raw_value) → binary heuristic
  if (value != null && raw_value == null) {
    // Graph v1.1 polish 4 Task 1: a fractional value (strictly between 0 and
    // 1) with a meaningless unit ("scale" or undefined) is a normalised
    // placeholder with no real-world calibration. Suppress to avoid the
    // misleading "0.1" / "0.5" body text. Binary 0/1 values still flow
    // through the contextual heuristic below because they convey real meaning.
    if (value > 0 && value < 1 && isMeaninglessUnit(unit)) {
      return null
    }
    const stripped = stripSuffixes(label).toLowerCase()
    if (value === 0) {
      return `No ${stripped} in place`
    }
    if (value === 1) {
      return `${stripped.charAt(0).toUpperCase()}${stripped.slice(1)} active`
    }
    // Non-binary numeric value (e.g. 0.42) with a real unit but no raw_value:
    // return null (no meaningful display).
    return null
  }

  // Pattern 3: no value at all → no body text
  return null
}
