/**
 * ⭐⭐ WHERE A NEWLY ADDED NODE GOES — its own row, not the click point.
 *
 * ## The defect
 *
 * Founder, 21 Sep 2026: *"I added a new factor, but it was still put in the
 * wrong row. It moves it to the right row when I perform analysis."*
 *
 * Measured at the bytes. `store.addNode` sets
 * `position: pos || { x: 200, y: 200 }` and calls no layout; `addNodeWithEdge`
 * is the same. The two add affordances pass different things:
 *
 *   contextMenu/actions.ts:311   addNodeWithEdge(pos, 'factor', …)  <- the POINTER
 *   components/CommandPalette.tsx addNode(undefined, 'factor')      <- (200, 200)
 *
 * and nothing re-lays out afterwards: `useMeasureThenLayout` re-runs only when
 * measured heights GROW past a tolerance, so an added node is not a trigger.
 * The card therefore sits wherever it was dropped until something else runs
 * `applyLayout` — which analysis does, and which is exactly why the founder saw
 * it "move to the right row when I perform analysis".
 *
 * ⚠ AND THE ROW LABEL FOLLOWS IT, which is why the symptom looks like two bugs.
 * The lane bands are bounding boxes drawn around their members, so a factor
 * dropped level with the Question stretches the Factors band up to enclose it —
 * and the gutter then reads "Factors" beside the Question card.
 *
 * ## Why the click point is not worth honouring
 *
 * Nothing persists a node position server-side: a graph read carries none, and
 * `layoutGraph` re-derives every position from the model (founder ruling R1 —
 * *"establish ONE stable canonical layout"*). So a pointer position for a new
 * node is **transient by construction**: the product overwrites it at the next
 * layout, and the only thing it buys in the meantime is the wrong row.
 *
 * ## The rule, and where it comes from
 *
 * `ghostTiers.withGhostTiers` already settled this for the ghost doors:
 * *"THE DOOR STANDS AT THE END OF ITS ROW, NOT AT THE END OF ITS KIND"* — a
 * repair made after a door was painted on top of an outcome card when risks
 * joined the outcome tier. A new node needs the same rule, and needs to share
 * it, or the first factor added to a board lands on the "What else drives this?"
 * door.
 *
 * ⛔ BUT THAT HELPER GENERALISED ONLY HALF OF ITSELF, and this module must not
 * inherit the other half. `rowAnchorFor` finds the rightmost occupant of the row
 * **whatever its kind** (general) — while deriving the row's Y from
 * `siblingsOf(nodes, tier.siblingType)`, i.e. **same-type siblings only**
 * (special case). `factor`, `action` and `constraint` share tier 2, so a board
 * carrying actions and no factors yields no row for a new factor even though
 * the row plainly exists. This module keys the row on `TIER_BY_KIND`, which is
 * the general rule the comment argues for.
 */
import type { Node } from '@xyflow/react'
import {
  TIER_BY_KIND,
  LAYOUT_NODE_GAP,
  NODE_CARD_MAX_W,
  DEFAULT_NODE_HEIGHT,
  cardWidthCapForTier,
} from './nodeLayoutConstants'

/**
 * The FALLBACK column for an added node whose tier has no row yet: this far
 * right of the existing bounding box's rightmost left edge…
 *
 * Lives here, beside the rule it is the fallback for. `mergeAppliedGraph`
 * re-exports it under the same name for its existing importers — two placement
 * constants that must agree are a mirror, and mirrors drift.
 */
export const ADDED_COLUMN_X_GAP = 260
/** …and stacked this far apart, starting at the bounding box's top. */
export const ADDED_COLUMN_Y_STEP = 140

/** A node's tier, defaulting to the factor tier the way `layout.ts` does. */
function tierOf(node: Node): number {
  const kind = (node.type ?? (node.data as { kind?: string } | undefined)?.kind) as
    | string
    | undefined
  return kind !== undefined && TIER_BY_KIND[kind] !== undefined ? TIER_BY_KIND[kind] : 2
}

function tierForKind(kind: string): number {
  return TIER_BY_KIND[kind] !== undefined ? TIER_BY_KIND[kind] : 2
}

/** Rendered width, falling back the way `ghostTiers` does. */
function widthOf(n: Node): number {
  const m = n as { measured?: { width?: number }; width?: number }
  return m.measured?.width ?? m.width ?? NODE_CARD_MAX_W
}

/**
 * The position a new node of `kind` should take: the end of its tier's row.
 *
 * Returns `null` when the tier has no occupants yet — there is no row to join,
 * and inventing a Y would be a guess. The caller keeps its existing fallback,
 * so an empty tier behaves exactly as it does today and this change cannot
 * regress the first-node-on-a-blank-canvas case.
 *
 * ⚠ GHOST DOORS COUNT AS OCCUPANTS. They are real nodes in the array with real
 * positions (`type: 'ghost-tier'`), and they stand at the end of their row — so
 * a new node that ignored them would be placed exactly on top of one. This is
 * the same hazard `withGhostTiers` fixed for a second door, reached by a
 * different route.
 */
export function rowEndPositionForNewNode(
  nodes: Node[],
  kind: string,
): { x: number; y: number } | null {
  const tier = tierForKind(kind)
  const inTier = nodes.filter((n) => tierOf(n) === tier && n.position !== undefined)
  if (inTier.length === 0) return null

  // The row's Y, taken as the MAX so a tier split across sub-rows joins the
  // lowest — matching `rowAnchorFor`, whose `anchorY` is also a max.
  const rowY = Math.round(
    inTier.reduce<number>((acc, n) => Math.max(acc, n.position?.y ?? 0), Number.NEGATIVE_INFINITY),
  )

  // Every occupant of that row, of ANY kind and including ghost doors.
  const occupants = nodes.filter((n) => Math.round(n.position?.y ?? 0) === rowY)
  if (occupants.length === 0) return null

  const rightmost = occupants.reduce((best, n) =>
    (n.position?.x ?? 0) > (best.position?.x ?? 0) ? n : best,
  )
  return {
    x: Math.round((rightmost.position?.x ?? 0) + widthOf(rightmost) + LAYOUT_NODE_GAP),
    y: rowY,
  }
}

// ---------------------------------------------------------------------------
// Nodes the PRODUCER added to a canvas that already has an arrangement
// ---------------------------------------------------------------------------

/**
 * ⭐⭐ WHERE A NODE THE AI ADDED GOES — its own row, the same rule as a local add.
 *
 * Founder, 23 Sep 2026: *"Every time I add an option, it appears in the wrong
 * row. When I run the analysis, it is put into the correct row."*
 *
 * The Add-option panel does not place a node. It sends an `add_option` chip to
 * CEE, and the option arrives in the applied receipt's `draft_graph`, which
 * `reconcileAppliedGraph` ingests (and, after a reload, `mergeServerGraphOnHydrate`).
 * Both placed every added node in ONE column right of the bounding box starting
 * at `min(y)` — the Question's row — until analysis ran `layoutGraph`, which
 * keys rows on `TIER_BY_KIND`. That is the "wrong row, then the right one".
 *
 * This is `rowEndPositionForNewNode` — the rule `store.addNode` already uses —
 * applied to a BATCH, plus the two things a batch needs that a single local
 * add did not:
 *
 *  1. **Each added node joins the row its tier gives it**, right of that row's
 *     rightmost card, so an option and a factor in one receipt land in two
 *     different rows.
 *  2. **An overlap guard.** The row end is a point, and a card the user dragged
 *     can already be standing on it without being IN the row (a different y, a
 *     different tier), so the row rule cannot see it. The candidate slides right,
 *     along its row, past anything it would cover. It never changes row. Nodes
 *     placed earlier in the same batch are obstacles too, which is what puts two
 *     options added together side by side rather than on top of each other.
 *
 * A tier with no row yet keeps the previous fallback — the column right of the
 * bounding box — because inventing a y for a row that does not exist would be
 * a guess, and the canonical layout reserves no gap for an empty tier. The
 * overlap guard applies to that column too.
 *
 * ⛔ IT NEVER MOVES AN EXISTING NODE. It returns positions for `addedNodes`
 * only; `existingNodes` are read, never written. The callers' invariant — "never
 * re-layouts the user's existing nodes" — holds by construction.
 *
 * ⚠ AN ADDED NODE IS NOT MEASURED YET, so it is sized conservatively: its tier's
 * card-width CAP (`cardWidthCapForTier` — `layoutGraph` never draws a card wider)
 * and its row's tallest card. Over-estimating costs a little extra space at the
 * end of a row; under-estimating would paint one card over another.
 *
 * @returns one position per entry of `addedNodes`, in the same order.
 */
export function placeAddedNodes(
  existingNodes: readonly Node[],
  addedNodes: readonly Node[],
): Array<{ x: number; y: number }> {
  // Rows are defined by the cards the user can see. A node placed by this batch
  // defines no row of its own (the column fallback's y is not a tier's); it
  // only becomes an obstacle for the next.
  const rows: Node[] = [...existingNodes]
  const obstacles: Box[] = existingNodes.map(boxOf)

  const xs = existingNodes.map((n) => n.position?.x ?? 0)
  const ys = existingNodes.map((n) => n.position?.y ?? 0)
  const columnX = (xs.length ? Math.max(...xs) : 0) + ADDED_COLUMN_X_GAP
  const columnY = ys.length ? Math.min(...ys) : 0
  let columnIndex = 0

  return addedNodes.map((node) => {
    const kind = kindOf(node) ?? ''
    const width = footprintWidth(node)
    const rowEnd = rowEndPositionForNewNode(rows, kind)

    let candidate: Box
    if (rowEnd !== null) {
      // Sized at its row's tallest card — the band the layout reserved for it —
      // so a card standing lower in that band is still seen as covered.
      const rowHeight = rows
        .filter((n) => Math.round(n.position?.y ?? 0) === rowEnd.y)
        .reduce((acc, n) => Math.max(acc, footprintHeight(n)), footprintHeight(node))
      candidate = { x: rowEnd.x, y: rowEnd.y, w: width, h: rowHeight }
    } else {
      candidate = {
        x: columnX,
        y: columnY + columnIndex * ADDED_COLUMN_Y_STEP,
        w: width,
        h: footprintHeight(node),
      }
      columnIndex += 1
    }

    const x = firstClearX(candidate, obstacles)
    obstacles.push({ ...candidate, x })
    return { x, y: candidate.y }
  })
}

type Box = { x: number; y: number; w: number; h: number }

function kindOf(node: Node): string | undefined {
  return (node.type ?? (node.data as { kind?: string } | undefined)?.kind) as string | undefined
}

/** The width a card occupies: its measurement, else the most its tier draws at. */
function footprintWidth(n: Node): number {
  const m = n as { measured?: { width?: number }; width?: number }
  return m.measured?.width ?? m.width ?? cardWidthCapForTier(tierOf(n))
}

function footprintHeight(n: Node): number {
  const m = n as { measured?: { height?: number }; height?: number }
  return m.measured?.height ?? m.height ?? DEFAULT_NODE_HEIGHT
}

function boxOf(n: Node): Box {
  return { x: n.position?.x ?? 0, y: n.position?.y ?? 0, w: footprintWidth(n), h: footprintHeight(n) }
}

function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

/**
 * The first x, at or right of the candidate's, where it covers nothing.
 *
 * Terminates: every hit moves x past that obstacle's right edge, and an
 * obstacle once passed can never be hit again, so there are at most
 * `obstacles.length` hits before a clear check.
 */
function firstClearX(candidate: Box, obstacles: readonly Box[]): number {
  let x = candidate.x
  for (let i = 0; i <= obstacles.length; i += 1) {
    const at = { ...candidate, x }
    const hit = obstacles.find((o) => intersects(at, o))
    if (hit === undefined) return x
    x = hit.x + hit.w + LAYOUT_NODE_GAP
  }
  return x
}
