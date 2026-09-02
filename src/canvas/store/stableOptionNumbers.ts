/**
 * Pure identity-anchored option numbering — Wave F-A.
 *
 * Standalone with respect to the STORE (no store import) so the canvas store
 * can use it without an import cycle; the selector module re-exports it for
 * consumers. It does import the layout module's `groupByYRow`, which is itself
 * store-free and keeps ELK behind a runtime dynamic import — see
 * `orderOptionIdsByCanvasPosition`.
 */
import { groupByYRow } from '../utils/layout'

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

/** The shape `orderOptionIdsByCanvasPosition` reads off a canvas node. */
interface PositionedNode {
  id: string
  position?: { x: number; y: number } | null
}

/**
 * ⭐ CANVAS READING ORDER — what `Option N` MEANS (Paul, 31 Aug 2026).
 *
 * From a screenshot of the canvas: the option cards carried badges reading
 * `1, 2, 4, 5, 3` left to right. "Either order the row by rank or stop putting
 * ordinals on a non-ordered row."
 *
 * The badges were minted in the results panel's PROBABILITY sort, frozen on
 * the first run, and then printed on a row whose left-to-right order is ELK's
 * (`crossingMinimization: LAYER_SWEEP`; `considerModelOrder` is only a
 * tie-break). Two different orders on one row of numbers, agreeing only by
 * coincidence — and a rank frozen at run 1 is a claim about run 1 that the
 * canvas has no way to express.
 *
 * So `Option N` is POSITIONAL IDENTITY: the Nth option card in canvas reading
 * order (row-major — y-row, then x) at the moment the numbers are first
 * minted. RANK stays where it belongs, on the hero rows' `index`, free to
 * re-rank every run.
 *
 * ⚠ THE ROW MODEL IS NOT RE-IMPLEMENTED HERE. `groupByYRow` supplies the row
 * grouping AND its y-tolerance, because a hand-copied tolerance constant is
 * this estate's dominant defect class (CLAUDE.md trap 12 — the hand-maintained
 * mirror): it would drift from the layout silently, and the only symptom would
 * be badges out of order again. The import is safe for the store's bundle —
 * `layout.ts` holds ELK behind `await import('elkjs/...')`, so nothing heavy
 * follows it in.
 *
 * ONE DELIBERATE REFINEMENT over `groupByYRow`'s own within-row sort: it
 * breaks an exact-x tie LEXICOGRAPHICALLY by node id; this breaks it by CALLER
 * ORDER. That makes the contract a single rule — *position decides where it
 * can, caller order breaks every tie* — the same rule that puts position-less
 * ids last, instead of two different tiebreaks depending on why position was
 * silent. Both directions are pinned in
 * `__tests__/stableOptionNumbers.canvasOrder.spec.ts`.
 *
 * Pure. Returns a new array; never mutates its arguments.
 */
export function orderOptionIdsByCanvasPosition(
  optionIds: readonly string[],
  nodes: readonly PositionedNode[] | undefined | null,
): string[] {
  if (!nodes || nodes.length === 0 || optionIds.length === 0) return [...optionIds]

  // Only finite coordinates count as a position. A NaN would sort arbitrarily
  // and silently scramble the row — treat it as "unplaced" and let the caller's
  // order decide, which is the honest answer rather than a fabricated one.
  const positionMap = new Map<string, { x: number; y: number }>()
  for (const node of nodes) {
    const p = node?.position
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    positionMap.set(node.id, { x: p.x, y: p.y })
  }

  // First occurrence wins, so a duplicated id cannot reorder its own group.
  const callerIndex = new Map<string, number>()
  optionIds.forEach((id, i) => {
    if (!callerIndex.has(id)) callerIndex.set(id, i)
  })

  const placed: string[] = []
  const unplaced: string[] = []
  for (const id of optionIds) {
    if (positionMap.has(id)) placed.push(id)
    else unplaced.push(id)
  }
  if (placed.length === 0) return [...optionIds]

  // `groupByYRow` returns rows keyed by anchor Y, already sorted top-to-bottom.
  const rows = groupByYRow(placed, positionMap)
  const ordered: string[] = []
  for (const rowIds of rows.values()) {
    const byPosition = [...rowIds].sort((a, b) => {
      const ax = positionMap.get(a)!.x
      const bx = positionMap.get(b)!.x
      if (ax !== bx) return ax - bx
      return callerIndex.get(a)! - callerIndex.get(b)!
    })
    ordered.push(...byPosition)
  }

  // Position-less ids keep the caller's order and go last: "last" is not a
  // position, it is "the canvas cannot place this".
  return [...ordered, ...unplaced]
}
