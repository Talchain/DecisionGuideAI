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
import { TIER_BY_KIND, LAYOUT_NODE_GAP, NODE_CARD_MAX_W } from './nodeLayoutConstants'

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
