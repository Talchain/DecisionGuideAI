/**
 * ⭐⭐ THE BOARD'S GRAMMAR, DRAWN — the structure the geometry already asserts.
 *
 * ## What was measured, and why this exists
 *
 * Paul, 15 Sep 2026: *"it looks an absolute mess … every design element looks
 * just chucked on willy-nilly and not designed at all."*
 *
 * Measured on the five shipped starters: **every card sits exactly on its tier's
 * y**, five bands, no exceptions — `pricing-model` reads
 * `150 decision · 500 options · 1150 factors · 1600 consequences · 2000 goal`.
 * The argument's structure is already perfect in the geometry, and **nothing on
 * screen draws it**. A reader has to infer the grammar from position alone.
 *
 * ⚠ THIS ADDS NO INFORMATION AND MAKES NO JUDGEMENT. A lane is
 * `TIER_BY_KIND[kind]`, which is the same table that PLACED the node. It grades
 * nothing, ranks nothing and cannot be wrong about the model — it can only be
 * wrong about where the cards are, which is why it is derived from the cards.
 *
 * ## ⛔ DERIVED FROM THE RENDERED NODES, NEVER FROM A TABLE OF Y-VALUES
 *
 * The tempting implementation is a list of band positions. It would be wrong
 * within a week: `normaliseTierRows` accumulates Y across OCCUPIED tiers only, so
 * band positions move as tiers empty and fill, and a lane that can disagree with
 * where the cards are is this estate's dominant defect wearing a new coat. Each
 * lane's extent is therefore `min(y) … max(y + height)` over its own members.
 *
 * ⚠ GHOSTS ARE NOT MEMBERS. They are excluded from the fit and from every model
 * count by the `__ghost-` prefix, and a lane sized to include one would claim the
 * model extends further than it does.
 *
 * ⚠ BUT A GHOST STILL STANDS IN A ROW, SO THE ROWS REACH IT — to the right, and
 * horizontally only (contract v3.1, CHR-10). The option door is placed past the
 * rightmost option (`rowRightCard.x + width + 60`), so whenever the option row
 * is the board's widest the dashed door landed on bare canvas past every
 * band's right end: a door that belongs to a row, drawn outside it. The door
 * now widens the board's RIGHT edge and nothing else — not a lane's top or
 * bottom, not its membership, not `contentLeft`, and not the left edge, which
 * is the card column the fit parks at the sidebar's gap and the titles align to.
 */
import type { Node } from '@xyflow/react'
import { TIER_BY_KIND } from './nodeLayoutConstants'
import { isGhostNode } from './fitTargets'
import { DECISION_NODE_LABEL, MODEL_GROUP_TITLE } from '../domain/vocabulary'

export interface TierLane {
  /** `TIER_BY_KIND`'s own number, carried so a render site binds to the tier
   *  rather than to its title text. */
  readonly tier: number
  /** The product's own name for this group — the SAME string the Model outline
   *  heads it with. Never a second spelling. */
  readonly title: string
  /** The board's left edge — every lane shares it, so the bands align. */
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  /**
   * The left edge of THIS tier's own cards (min x over its members). Differs
   * from `x` when the row is narrower than the board — the Question row, whose
   * one card is centred, is the case a title placement reads it for.
   */
  readonly contentLeft: number
}

/**
 * ⚠ A STATED MIRROR OF `TIER_BY_KIND`'s VALUE SET, AND IT FAILS LOUD.
 *
 * There is no derivation available: a tier holds several kinds (outcome AND
 * risk), so no kind's own name can title it — the consequence row is neither
 * "Outcomes" nor "Risks". Stated rather than disguised (trap 12), and
 * `tierLanes.spec.ts` derives the required key set FROM `TIER_BY_KIND` and REDs
 * if a tier ever gains members with no name here. A lane with no title would
 * render an untitled band, which is the defect the outline's own `GROUP_TITLE`
 * doc was written to prevent.
 */
const TITLE_BY_TIER: Readonly<Record<number, string>> = {
  0: DECISION_NODE_LABEL,
  1: MODEL_GROUP_TITLE.options,
  2: MODEL_GROUP_TITLE.factors,
  3: MODEL_GROUP_TITLE.outcomesRisks,
  5: MODEL_GROUP_TITLE.goal,
}

/** Exported for the completeness guard, which must read the real thing. */
export const TIER_LANE_TITLES = TITLE_BY_TIER

function kindOf(n: Node): string | undefined {
  const t = n.type
  if (typeof t === 'string' && TIER_BY_KIND[t] !== undefined) return t
  const d = (n.data as { type?: unknown } | undefined)?.type
  return typeof d === 'string' ? d : undefined
}

/** Measured first, declared second, estimate last — the same precedence
 *  `ghostTiers` uses for width, so two readers of a node's box agree. */
function boxOf(n: Node): { w: number; h: number } {
  const m = n as { measured?: { width?: number; height?: number }; width?: number; height?: number }
  return {
    w: m.measured?.width ?? m.width ?? 200,
    h: m.measured?.height ?? m.height ?? 120,
  }
}

/**
 * One lane per OCCUPIED tier, spanning the board's full width so the bands read
 * as rows of one argument rather than as five separate boxes.
 *
 * Returns `[]` for an empty board — a lane with no members would assert that the
 * tier ought to have some, which is the judgement line the canvas does not cross
 * (the same refusal `withGhostTiers` makes).
 */
export function deriveTierLanes(nodes: readonly Node[]): TierLane[] {
  const members = new Map<number, Node[]>()
  const ghosts: Node[] = []
  for (const n of nodes) {
    if (isGhostNode(n.id)) {
      ghosts.push(n)
      continue
    }
    const kind = kindOf(n)
    if (kind === undefined) continue
    const tier = TIER_BY_KIND[kind]
    if (tier === undefined) continue
    const list = members.get(tier)
    if (list) list.push(n)
    else members.set(tier, [n])
  }
  if (members.size === 0) return []

  // Board extent — every lane spans it, so the bands align into rows.
  let boardLeft = Number.POSITIVE_INFINITY
  let boardRight = Number.NEGATIVE_INFINITY
  for (const list of members.values()) {
    for (const n of list) {
      const { w } = boxOf(n)
      const x = n.position?.x ?? 0
      if (x < boardLeft) boardLeft = x
      if (x + w > boardRight) boardRight = x + w
    }
  }
  // A door stands in its row: the rows reach it (right edge only — see header).
  for (const g of ghosts) {
    const right = (g.position?.x ?? 0) + boxOf(g).w
    if (right > boardRight) boardRight = right
  }

  const lanes: TierLane[] = []
  for (const [tier, list] of [...members.entries()].sort((a, b) => a[0] - b[0])) {
    const title = TITLE_BY_TIER[tier]
    if (title === undefined) continue
    let top = Number.POSITIVE_INFINITY
    let bottom = Number.NEGATIVE_INFINITY
    let contentLeft = Number.POSITIVE_INFINITY
    for (const n of list) {
      const { h } = boxOf(n)
      const y = n.position?.y ?? 0
      if (y < top) top = y
      if (y + h > bottom) bottom = y + h
      const x = n.position?.x ?? 0
      if (x < contentLeft) contentLeft = x
    }
    lanes.push({
      tier,
      title,
      x: boardLeft,
      y: top,
      width: boardRight - boardLeft,
      height: bottom - top,
      contentLeft,
    })
  }
  return lanes
}
