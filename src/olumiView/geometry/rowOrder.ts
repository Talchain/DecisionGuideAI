/**
 * The ordering of packed board positions: geometry (x and y coordinates of cards already placed), never core's values. It lives in this
 * folder, outside the top level that contract.spec's lint reads, for the reason packRows.ts (src/canvas/utils) does: the lint keeps
 * `.sort(` out of the View render chain so that no View value is reordered, and nothing here is one. Native stable order: where two are equal
 * the earlier listed stays first.
 */

/** The numbers (row heights) smallest first. */
export const ascending = (ns: readonly number[]): number[] => [...ns].sort((a, b) => a - b)

/** The ids by their packed x, the leftmost first; where two share an x the earlier listed stays first. */
export const leftToRight = (ids: readonly string[], packed: ReadonlyMap<string, { x: number; y: number }>): string[] =>
  [...ids].sort((a, b) => packed.get(a)!.x - packed.get(b)!.x)
