/**
 * Array utility functions for handling truncated/wrapped array formats.
 *
 * CEE/payload redaction may return arrays in a wrapped format:
 * { __truncated: true, items: [...], totalCount: N }
 *
 * These utilities safely handle both plain arrays and truncated wrappers.
 */

/**
 * Truncated array wrapper format used by payload redaction.
 */
export interface TruncatedArray<T = unknown> {
  __truncated: boolean
  items?: T[]
  totalCount?: number
}

/**
 * Safely extracts an array from data that may be wrapped in a truncated format.
 * Handles both direct arrays and { __truncated: true, items: [...] } wrappers.
 *
 * @param data - Plain array, truncated wrapper, or any other value
 * @returns The unwrapped array, or empty array if data is not array-like
 *
 * @example
 * safeArray([1, 2, 3]) // => [1, 2, 3]
 * safeArray({ __truncated: true, items: [1, 2] }) // => [1, 2]
 * safeArray(null) // => []
 * safeArray({ foo: 'bar' }) // => []
 */
export function safeArray<T = unknown>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object' && '__truncated' in data) {
    const truncated = data as TruncatedArray<T>
    return Array.isArray(truncated.items) ? truncated.items : []
  }
  return []
}

/**
 * Checks if data contains array content (either plain or truncated wrapper).
 * More efficient than `safeArray(data).length > 0` when you only need existence check.
 *
 * @param data - Plain array, truncated wrapper, or any other value
 * @returns true if data contains at least one element
 */
export function hasArrayContent(data: unknown): boolean {
  if (Array.isArray(data)) return data.length > 0
  if (data && typeof data === 'object' && '__truncated' in data) {
    const truncated = data as TruncatedArray
    return Array.isArray(truncated.items) && truncated.items.length > 0
  }
  return false
}
