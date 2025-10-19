/**
 * Structural sharing utilities for preventing no-op store updates
 * Used in store.ts to compare values before calling set()
 */

/**
 * Compare two Sets by value (not reference)
 * @returns true if Sets contain the same values
 */
export function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false
  for (const x of a) {
    if (!b.has(x)) return false
  }
  return true
}

/**
 * Compare two arrays by value (shallow comparison)
 * @returns true if arrays have same length and same values in same order
 */
export function arraysEqual<T>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
}
