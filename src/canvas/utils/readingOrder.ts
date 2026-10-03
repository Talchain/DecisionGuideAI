/**
 * THE BOARD'S READING ORDER — the order a keyboard user meets the cards.
 *
 * ## The defect this closes (audit SI-6, 27 Sep 2026)
 *
 * React Flow renders its nodes, and therefore tabs through them, in ARRAY
 * order, and nothing re-sorted the array: every starter (and so the store)
 * holds its nodes sorted by id. On pricing the Tab walk went Question, the
 * five factors in id order (x 70, 522, 221, 672, 371 — zig-zagging across the
 * row), the GOAL, then the options, then outcomes and risks. The contract's
 * prototype walks the board as it reads: the Question, the options left to
 * right, the factors left to right, the outcomes and the risk left to right,
 * and the goal last.
 *
 * ## The order
 *
 * By the layout's own row (`TIER_BY_KIND` — the table the canonical layout
 * places rows by, so the two cannot disagree about which row a kind is in);
 * within a row, by sub-row (a row that wraps), then left to right. A frontier
 * door (`__ghost-…`) belongs to the row it ends (`data.tier`), and stands at its
 * right-hand end, so it is the last stop of its row.
 *
 * ## What it deliberately does not do
 *
 * It does not move links: React Flow renders every link before any card, and
 * the contract's prototype does the same (its edge layer precedes its cards —
 * measured, 17 connections before the first card). Moving links after the
 * cards needs a roving-tabindex design, not a sort.
 *
 * Paint order is unaffected in practice: laid-out cards do not overlap
 * (measured on pricing, headcount and vendor: no two card rects intersect), and
 * a selected card is lifted above the rest by React Flow's own z-index. A card
 * dragged past a neighbour in its row takes its new place in the order; a card
 * dragged into another row's band is still read with its own family.
 */
import { TIER_BY_KIND } from './nodeLayoutConstants'
import { isGhostNode } from './fitTargets'

/** The row a frontier door of this `data.tier` ends. `consequence` is the outcome/risk row. */
function doorRow(tier: unknown): number | undefined {
  if (tier === 'consequence') return TIER_BY_KIND.outcome
  return typeof tier === 'string' ? TIER_BY_KIND[tier] : undefined
}

interface OrderableNode {
  id: string
  type?: string
  position: { x: number; y: number }
  data?: unknown
}

/**
 * The layout row of a node. Unknown kinds take the layout's own fallback row
 * (2), the one `ghostTiers.rowOf` and `newNodePlacement` use.
 */
export function readingRow(node: OrderableNode): number {
  if (isGhostNode(node.id)) {
    const row = doorRow((node.data as { tier?: unknown } | undefined)?.tier)
    if (row !== undefined) return row
  }
  const row = node.type !== undefined ? TIER_BY_KIND[node.type] : undefined
  return row !== undefined ? row : 2
}

/**
 * Two cards whose tops differ by no more than this are on the same line of a
 * row. Laid-out cards in one row share their top exactly; a wrapped row's next
 * line is at least a card's height lower.
 */
const SAME_LINE_TOLERANCE = 24

/**
 * The nodes, stably sorted into reading order. Returns the SAME array when it
 * is already in order, so a memo downstream sees no change.
 */
export function sortNodesInReadingOrder<T extends OrderableNode>(nodes: readonly T[]): T[] {
  const byRow = new Map<number, T[]>()
  for (const n of nodes) {
    const row = readingRow(n)
    const list = byRow.get(row)
    if (list) list.push(n)
    else byRow.set(row, [n])
  }
  const ordered: T[] = []
  for (const row of [...byRow.keys()].sort((a, b) => a - b)) {
    // Lines within the row: cluster by top, then left to right within a line.
    const members = [...byRow.get(row)!].sort((a, b) => a.position.y - b.position.y)
    const lines: T[][] = []
    for (const n of members) {
      const line = lines[lines.length - 1]
      if (line && n.position.y - line[0].position.y <= SAME_LINE_TOLERANCE) line.push(n)
      else lines.push([n])
    }
    for (const line of lines) ordered.push(...line.sort((a, b) => a.position.x - b.position.x))
  }
  return ordered.every((n, i) => n === nodes[i]) ? (nodes as T[]) : ordered
}
