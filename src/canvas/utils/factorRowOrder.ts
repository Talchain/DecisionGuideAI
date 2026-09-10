/**
 * ⭐⭐ THE FACTOR ROW READS IN THE ORDER ITS BADGES CLAIM.
 *
 * Paul's screenshot complaint, one row down from where it was fixed. The option
 * cards were badged `1, 2, 4, 5, 3` left to right; the factor cards carry
 * `#1 #2 #3` ("Key driver #N: ranked by influence on the outcome",
 * `nodes/BaseNode.tsx`) printed on a row whose left-to-right order is ELK's
 * (`elk.layered.crossingMinimization.strategy: LAYER_SWEEP`, `utils/layout.ts`;
 * `considerModelOrder` is only a tie-break). The two agree by coincidence.
 *
 * ⚠⚠ THE OPTION FIX CANNOT BE REPEATED HERE, AND THE REASON DECIDES THE REMEDY.
 *
 * `store/stableOptionNumbers.ts` fixed the options by REDEFINING THE NUMBER:
 * `Option N` became "the Nth option card in canvas reading order". That was
 * available because `Option N` is a LABEL — it asserts nothing beyond identity,
 * so its meaning was free to move, and rank went to the hero rows' `index`
 * where it can re-rank every run.
 *
 * `#N` on a factor is NOT a label. It is a MEASUREMENT, and a guarded one:
 * `useNodeDisplayMetadata.ts` sets `sensitivityRank` only where
 * `determinedRankDepth` (`components/results/driverDisplayModel.ts`) says the
 * ordinal is clear of its runner-up, and WITHHOLDS the whole set otherwise —
 * roughly forty lines of that hook exist to stop `#2` and `#3` being handed out
 * on `key.localeCompare`. Minting `#N` from canvas position, the way the
 * options were fixed, would turn that measurement into a fiction and reopen by
 * hand exactly the defect the rank gate was written to close.
 *
 * And the shortlist's second remedy — take the numbers off — is wrong for the
 * mirror reason: the number is TRUE and it is the most decision-relevant thing
 * on the card. A row that cannot be ordered should lose its numbers; this row
 * can be.
 *
 * ⭐ SO THE REMEDY IS INVERTED, NOT COPIED. Options: the number was free, so the
 * NUMBER moved to the position. Factors: the number is the true thing, so the
 * POSITION moves to the number. Same defect, opposite fix, for a reason that is
 * derivable from what each numeral claims rather than from taste.
 *
 * ⭐ WHY IT IS WORTH DOING AT ALL. Horizontal order within a row is currently
 * whatever the edge-crossing pass produced — it sorts on its own output, so
 * position, one of the two strongest channels in any diagram, encodes NOTHING.
 * Ordering by influence costs no new pixels and no new rows.
 *
 * ⚠⚠ IT CLAIMS EXACTLY AS FAR AS THE BADGE CLAIMS, AND NOT ONE CARD FURTHER.
 * Only the ids inside the DETERMINED depth are reordered. Ordering the whole
 * row by influence value would reproduce the alphabetical-tie-break defect in
 * POSITION — a stronger channel than the numeral, and one with no tooltip to
 * qualify it. Where the analysis cannot separate two factors, this module
 * declines to separate them: the honest way to draw a withholding is equal
 * standing, and the nearest thing a single row affords is *not moving them*.
 *
 * ⚠ THE ROW MODEL IS NOT RE-IMPLEMENTED HERE. `groupByYRow` supplies the row
 * grouping AND its y-tolerance, for the same reason `stableOptionNumbers.ts`
 * imports it: a hand-copied tolerance constant is this estate's dominant defect
 * class (CLAUDE.md trap 12), and its only symptom would be a row out of order
 * again. `layout.ts` holds ELK behind `await import('elkjs/...')`, so nothing
 * heavy follows the import in.
 *
 * Pure. No store import, no React, no side effects.
 */
import type { Node } from '@xyflow/react'
import { groupByYRow } from './layout'
import {
  compareByDisplayModel,
  determinedRankDepth,
} from '../../components/results/driverDisplayModel'

/** One factor as the ranking authority sees it: an identity and its display value. */
export interface RankableFactor {
  /** The factor's canvas node id — the identity the badge and the node share. */
  key: string
  /** THE resolved display value every surface ranks from. */
  value: number
  /**
   * Raw elasticity, the comparator's second key.
   *
   * ⚠ UNSIGNED MAGNITUDE, per `compareByDisplayModel`'s stated precondition —
   * it does not abs, deliberately, so that a signed input surfaces the
   * producer-side contract break instead of being masked here.
   */
  elasticity: number
}

/**
 * The factor ids whose ordinal the product is entitled to assert, best first.
 *
 * ⚠ IT ASKS THE BADGE'S OWN QUESTION AT THE BADGE'S OWN OWNER. The sort is
 * `compareByDisplayModel` and the cut is `determinedRankDepth(…, maxDepth)` —
 * byte-for-byte the pair `useNodeDisplayMetadata.ts` uses to decide whether to
 * print `#N` at all. A private notion of "clear enough to order" here would be
 * a second authority on one question, and the two would drift into a row whose
 * position order and printed ordinals disagree — which is the defect.
 *
 * Returns `[]` whenever the set is tied, empty, or magnitude-less. An empty
 * result means "make no claim", and the caller must move nothing.
 */
export function deriveDeterminedFactorOrder(
  factors: readonly RankableFactor[],
  maxDepth: number,
): string[] {
  if (factors.length === 0 || maxDepth < 1) return []

  const ranked = [...factors].sort(compareByDisplayModel)
  const depth = determinedRankDepth(
    ranked.map((f) => ({ id: f.key, value: f.value })),
    maxDepth,
  )
  if (depth < 2) return []

  // ⭐ THE ORDER IS READ OFF THE BADGE'S OWN EXPRESSION, NOT A PARALLEL ONE.
  //
  // This previously de-duplicated first and took the first `depth` DISTINCT
  // keys. That is a second, independent way of counting, and on a reachable
  // input the two disagreed — which is the whole property this module exists to
  // assert. `useNodeDisplayMetadata` computes a card's numeral as
  // `ranked.findIndex(f => f.key === nodeId) + 1`, a POSITIONAL index into the
  // array that still contains the duplicate, then badges it only while
  // `rank <= determinedDepth`.
  //
  // Worked example, all three cards on screen left to right:
  // `[fac_a 0.9, fac_a 0.9, fac_b 0.5, fac_c 0.2]` with `depth = 3` badged
  // `#1`, `#3`, and NOTHING (fac_c's positional rank is 4, past the depth), while
  // the de-duplicated list seated all three. The row then read `#1, #3, unbadged`
  // — the exact claim the title makes false, and it seated a card whose ordinal
  // the product had deliberately WITHHELD, through the position channel, which
  // this file's own header calls "a stronger channel than the numeral, and one
  // with no tooltip to qualify it".
  //
  // So: take the positional prefix, and REFUSE if that prefix repeats a key. A
  // duplicated key inside the badged depth means the ordinals are not a clean
  // 1..N, so there is no determined order to claim and the honest answer is to
  // move nothing. Refusing is safe by construction — an empty result seats no
  // card — whereas guessing asserts an ordinal in geometry that no numeral backs.
  const prefix = ranked.slice(0, depth).map((f) => f.key)
  if (new Set(prefix).size !== prefix.length) return []
  return prefix
}

/** The shape this module reads off a canvas node. */
type PositionedNode = Pick<Node, 'id' | 'position'> & { data?: unknown }

/**
 * A card the user has pinned. Read the same way `layoutGraph`'s `isUnlocked`
 * reads it — one predicate, so a lock cannot hold against the layout and yield
 * to this.
 */
function isLocked(node: PositionedNode): boolean {
  return (node.data as Record<string, unknown> | undefined)?.locked === true
}

/**
 * Seat `orderedIds` into the canvas slots those very nodes already occupy, in
 * canvas reading order (row-major: y-row top to bottom, then x ascending).
 *
 * ⭐⭐ IT IS A PERMUTATION, AND THAT IS THE WHOLE SAFETY ARGUMENT. The set of
 * positions handed out is exactly the set of positions the same nodes arrived
 * on, so the geometry is bit-identical: no new pixels, no new rows, no change
 * to the layout budget, and nothing for the collision guard to find that was
 * not already there. Founder ruling R1 ("the canonical layout must not change
 * because viewport width changes… adapt the presentation, never the model") is
 * untouched — which SLOTS exist is still ELK's answer and still has no runtime
 * input. Only which card sits in which slot changes, and it changes on a
 * property of the model rather than of the screen.
 *
 * ⚠ A LOCKED CARD IS EXCLUDED, NOT RE-SEATED. `layoutGraph` leaves
 * `data.locked` nodes exactly where the user put them, and so does this: the
 * predicate is read the same way (`isLocked` below mirrors `isUnlocked` there).
 * Its slot leaves the pool with it, so nothing else lands on top of it either.
 * A pin the user can see must not be overridden by a claim they cannot.
 *
 * ⚠ A NODE NOT IN `orderedIds` NEVER MOVES. Unranked factors, and every other
 * kind sharing tier 2 (`action`, `constraint` — `nodeLayoutConstants.ts`
 * `TIER_BY_KIND`), keep their positions exactly. So an unranked card can sit
 * between `#1` and `#2`; the badges still read in order, and no claim is made
 * about the card between them. Interleaving is the honest outcome, not a
 * shortfall — moving a card we cannot rank would be the claim we are refusing.
 *
 * ⚠ THE WHOLE POSITION TRAVELS, x AND y TOGETHER. Taking x alone would strand a
 * node on its old row's y when the ordering crosses a split tier row, and would
 * break the multiset invariant that makes collisions impossible. Rows are
 * normalised by `normaliseTierRows` before this runs, so same-row y is already
 * uniform; `groupByYRow`'s tolerance covers the incidental variation that is
 * left.
 *
 * Returns the SAME array reference when nothing needs to move, so a caller can
 * skip its write.
 */
export function seatNodesIntoRankedSlots<T extends PositionedNode>(
  nodes: T[],
  orderedIds: readonly string[],
): T[] {
  if (orderedIds.length < 2 || nodes.length === 0) return nodes

  // Only finite coordinates count as a position. A NaN would sort arbitrarily
  // and scramble the row — treat it as unplaced and leave the node alone, which
  // is the honest answer rather than a fabricated one.
  // ⚠ A DUPLICATED ID IS EXCLUDED, NOT RESOLVED. `layoutGraph` reports duplicate
  // ids and pointedly declines to reposition them — "which node should win is an
  // identity question this layer does not own, and guessing would move a node
  // the user can see for reasons they cannot". Same answer here, for the same
  // reason: seating both copies on one slot would stack two cards.
  const positionMap = new Map<string, { x: number; y: number }>()
  const duplicated = new Set<string>()
  const locked = new Set<string>()
  const seenNodeIds = new Set<string>()
  for (const node of nodes) {
    if (seenNodeIds.has(node.id)) duplicated.add(node.id)
    seenNodeIds.add(node.id)
    if (isLocked(node)) locked.add(node.id)
    const p = node?.position
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    if (!positionMap.has(node.id)) positionMap.set(node.id, { x: p.x, y: p.y })
  }

  const movable = orderedIds.filter(
    (id) => positionMap.has(id) && !duplicated.has(id) && !locked.has(id),
  )
  if (movable.length < 2) return nodes

  // Row-major reading order over ONLY the ranked nodes' own slots. `groupByYRow`
  // returns rows sorted top-to-bottom with each row's ids sorted by x, so
  // concatenating them is canvas reading order by construction.
  const slots: Array<{ x: number; y: number }> = []
  for (const rowIds of groupByYRow(movable, positionMap).values()) {
    for (const id of rowIds) slots.push(positionMap.get(id)!)
  }

  // `orderedIds` is best-first; `slots` is reading order. Pair them.
  const seating = new Map<string, { x: number; y: number }>()
  movable.forEach((id, i) => {
    seating.set(id, slots[i])
  })

  let moved = false
  for (const [id, target] of seating) {
    const current = positionMap.get(id)!
    if (current.x !== target.x || current.y !== target.y) {
      moved = true
      break
    }
  }
  if (!moved) return nodes

  return nodes.map((node) => {
    const target = seating.get(node.id)
    if (!target) return node
    if (node.position.x === target.x && node.position.y === target.y) return node
    return { ...node, position: { x: target.x, y: target.y } }
  })
}
