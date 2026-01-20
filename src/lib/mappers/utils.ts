/**
 * Results Pipeline Mapper Utilities
 *
 * Boundary parse functions for safely extracting typed values from unknown input.
 * These prevent the "0 blocks fallback" regression class by explicitly handling
 * real zeros vs missing values.
 *
 * Key contracts:
 * - asOptionalNumber(0) === 0 — real zero preserved, never collapsed to undefined
 * - asOptionalNumber(undefined) === undefined — missing stays missing
 * - asOptionalNumber(NaN) === undefined — invalid becomes undefined
 */

/**
 * Safely extract a number from unknown input.
 *
 * Returns undefined for: undefined, null, NaN, Infinity, non-numeric values
 * Returns the number when input is a valid finite number (including 0)
 *
 * CRITICAL: asOptionalNumber(0) === 0, NOT undefined
 * This prevents the "0 blocks fallback" regression.
 *
 * @example
 * asOptionalNumber(0) // 0
 * asOptionalNumber(0.5) // 0.5
 * asOptionalNumber(undefined) // undefined
 * asOptionalNumber(null) // undefined
 * asOptionalNumber(NaN) // undefined
 * asOptionalNumber('42') // undefined (strings not coerced)
 * asOptionalNumber(Infinity) // undefined
 */
export function asOptionalNumber(value: unknown): number | undefined {
  if (typeof value !== 'number') return undefined
  if (!Number.isFinite(value)) return undefined
  return value
}

/**
 * Safely extract a string from unknown input.
 *
 * Returns undefined for: undefined, null, non-strings
 * Returns the string when input is a string (including empty string '')
 *
 * Note: Empty string '' is preserved if intentional — caller decides if empty
 * should become undefined for their use case.
 *
 * @example
 * asOptionalString('hello') // 'hello'
 * asOptionalString('') // ''
 * asOptionalString(undefined) // undefined
 * asOptionalString(null) // undefined
 * asOptionalString(42) // undefined
 */
export function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return value
}

/**
 * Safely extract a boolean from unknown input.
 *
 * Returns undefined for: undefined, null, non-booleans
 * Returns the boolean when input is a boolean
 *
 * @example
 * asOptionalBoolean(true) // true
 * asOptionalBoolean(false) // false
 * asOptionalBoolean(undefined) // undefined
 * asOptionalBoolean(1) // undefined (numbers not coerced)
 */
export function asOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value !== 'boolean') return undefined
  return value
}

/**
 * Safely extract an array from unknown input.
 *
 * Returns empty array for: undefined, null, non-arrays
 * Returns the array when input is an array
 *
 * @example
 * asArray([1, 2, 3]) // [1, 2, 3]
 * asArray([]) // []
 * asArray(undefined) // []
 * asArray(null) // []
 * asArray('not array') // []
 */
export function asArray<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return []
  return value as T[]
}

/**
 * Safely extract an object from unknown input.
 *
 * Returns undefined for: undefined, null, non-objects, arrays
 * Returns the object when input is a plain object
 *
 * @example
 * asObject({ foo: 1 }) // { foo: 1 }
 * asObject(undefined) // undefined
 * asObject(null) // undefined
 * asObject([1, 2]) // undefined (arrays excluded)
 */
export function asObject(value: unknown): Record<string, unknown> | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value !== 'object') return undefined
  if (Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

/**
 * Convert empty string to undefined for display purposes.
 * Use when an empty string should be treated as "no value".
 *
 * @example
 * emptyToUndefined('hello') // 'hello'
 * emptyToUndefined('') // undefined
 * emptyToUndefined('  ') // undefined (whitespace-only)
 */
export function emptyToUndefined(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  if (value.trim().length === 0) return undefined
  return value
}

/**
 * Get first defined value from a list of fallback values.
 * Useful for handling multiple field name aliases.
 *
 * @example
 * firstDefined(undefined, null, 'value') // 'value'
 * firstDefined(0, 1, 2) // 0 (zero is defined!)
 * firstDefined(undefined, undefined) // undefined
 */
export function firstDefined<T>(...values: (T | undefined | null)[]): T | undefined {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value
    }
  }
  return undefined
}

/**
 * Normalise direction string to canonical 'positive' | 'negative'.
 * Handles various formats from different data sources.
 *
 * @example
 * normaliseDirection('positive') // 'positive'
 * normaliseDirection('POSITIVE') // 'positive'
 * normaliseDirection('+') // 'positive'
 * normaliseDirection('neg') // 'negative'
 * normaliseDirection('unknown') // undefined
 */
export function normaliseDirection(
  direction: string | undefined
): 'positive' | 'negative' | undefined {
  if (!direction) return undefined

  const lower = direction.toLowerCase().trim()

  // Positive variants
  if (
    lower === 'positive' ||
    lower === 'pos' ||
    lower === '+' ||
    lower === 'increase' ||
    lower === 'up'
  ) {
    return 'positive'
  }

  // Negative variants
  if (
    lower === 'negative' ||
    lower === 'neg' ||
    lower === '-' ||
    lower === 'decrease' ||
    lower === 'down'
  ) {
    return 'negative'
  }

  return undefined
}

/**
 * Normalise robustness level string to canonical type.
 *
 * @example
 * normaliseRobustnessLevel('high') // 'high'
 * normaliseRobustnessLevel('HIGH') // 'high'
 * normaliseRobustnessLevel('very-low') // 'very_low'
 */
export function normaliseRobustnessLevel(
  level: string | undefined
): 'high' | 'moderate' | 'low' | 'very_low' | undefined {
  if (!level) return undefined

  const lower = level.toLowerCase().trim().replace(/-/g, '_')

  if (lower === 'high') return 'high'
  if (lower === 'moderate' || lower === 'medium') return 'moderate'
  if (lower === 'low') return 'low'
  if (lower === 'very_low' || lower === 'verylow') return 'very_low'

  return undefined
}

/**
 * Normalise label to key format (lowercase, underscores).
 * Used for generating factor IDs from labels.
 *
 * @example
 * normaliseLabel('Pro Plan Price') // 'pro_plan_price'
 * normaliseLabel('Market  Competition') // 'market_competition'
 */
export function normaliseLabel(label: string | undefined): string {
  if (!label) return 'unknown'
  return label.toLowerCase().replace(/\s+/g, '_')
}

/**
 * Check if running in development mode.
 * Used to gate debug logging.
 */
export function isDevMode(): boolean {
  return (
    typeof import.meta !== 'undefined' &&
    import.meta.env?.DEV === true
  )
}

/**
 * Check if debug mode is enabled.
 * Requires both DEV mode and __OLUMI_DEBUG flag.
 */
export function isDebugMode(): boolean {
  return (
    isDevMode() &&
    typeof window !== 'undefined' &&
    (window as Record<string, unknown>).__OLUMI_DEBUG === true
  )
}

/**
 * Log debug message if debug mode is enabled.
 */
export function debugLog(tag: string, data: unknown): void {
  if (isDebugMode()) {
    console.log(`[${tag}]`, data)
  }
}
