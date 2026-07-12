/**
 * Pure identity-anchored option numbering — Wave F-A.
 *
 * Standalone (no store import) so the canvas store can use it without an
 * import cycle; the selector module re-exports it for consumers.
 */

/**
 * Merge new option ids into an ordinal map. Existing assignments are kept
 * verbatim; unseen ids get the next ordinal in the given order; removed
 * options keep their historical assignment so ordinals are never recycled.
 * Pure — never mutates `previous`.
 */
export function assignStableOptionNumbers(
  previous: Readonly<Record<string, number>>,
  optionIds: readonly string[],
): Record<string, number> {
  const next: Record<string, number> = { ...previous }
  let ordinal = Object.values(next).reduce((max, n) => Math.max(max, n), 0)
  for (const id of optionIds) {
    if (!(id in next)) {
      ordinal += 1
      next[id] = ordinal
    }
  }
  return next
}
