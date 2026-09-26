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
 */
import type { Node } from '@xyflow/react'
import { TIER_BY_KIND } from './nodeLayoutConstants'
import { MAX_LABEL_COUNTER_SCALE } from './zoomLegibility'
import { isGhostNode } from './fitTargets'
import { DECISION_NODE_LABEL, MODEL_GROUP_TITLE } from '../domain/vocabulary'

export interface TierLane {
  /** `TIER_BY_KIND`'s own number, carried so a render site binds to the tier
   *  rather than to its title text. */
  readonly tier: number
  /** The product's own name for this group — the SAME string the Model outline
   *  heads it with. Never a second spelling. */
  readonly title: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
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
/**
 * ⭐⭐ v3.1 WS1 #26 (26 Sep 2026): THE CONTRACT'S BAND WORDS — `.layer-label`
 * reads EXPLORATION / ALTERNATIVES / FACTORS / OUTCOMES / RISKS / GOAL
 * (contract v3.1 §01, the connected-graph reference), and the Canvas lead's
 * WS1 brief rules that v3.1 wins over the Model outline's sentence-case group
 * names here. Written as CONTENT, not produced by `text-transform`.
 *
 * ⚠ OPEN CONFLICT, STATED RATHER THAN HIDDEN: DS v5 §2 requires sentence case,
 * and review 5824187641 (DGAI) blocked an earlier all-caps tier label on that
 * rule, asking for an explicit owner ruling. This table is the ONE place the
 * case lives; reverting to the outline's words is this table and nothing else.
 *
 * The consequence row's words follow what it holds: OUTCOMES, RISKS, or both.
 */
const TITLE_BY_TIER: Readonly<Record<number, string>> = {
  0: 'EXPLORATION',
  1: 'ALTERNATIVES',
  2: 'FACTORS',
  3: 'OUTCOMES / RISKS',
  5: 'GOAL',
}

/** The consequence row's title for the kinds it actually holds. */
const CONSEQUENCE_TITLE_BY_KINDS: Readonly<Record<string, string>> = {
  outcome: 'OUTCOMES',
  risk: 'RISKS',
}

/** Exported for the completeness guard, which must read the real thing. */
export const TIER_LANE_TITLES = TITLE_BY_TIER

/**
 * The Model outline's own group names, kept beside the band words so the
 * difference is visible in one file (the outline still heads its groups with
 * these; the canvas band takes the contract's).
 */
export const OUTLINE_GROUP_TITLE_BY_TIER: Readonly<Record<number, string>> = {
  0: DECISION_NODE_LABEL,
  1: MODEL_GROUP_TITLE.options,
  2: MODEL_GROUP_TITLE.factors,
  3: MODEL_GROUP_TITLE.outcomesRisks,
  5: MODEL_GROUP_TITLE.goal,
}

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
  for (const n of nodes) {
    if (isGhostNode(n.id)) continue
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

  const lanes: TierLane[] = []
  for (const [tier, list] of [...members.entries()].sort((a, b) => a[0] - b[0])) {
    let title = TITLE_BY_TIER[tier]
    if (title === undefined) continue
    const kinds = new Set(list.map(kindOf).filter((k): k is string => k !== undefined))
    if (kinds.size === 1) title = CONSEQUENCE_TITLE_BY_KINDS[[...kinds][0]!] ?? title
    let top = Number.POSITIVE_INFINITY
    let bottom = Number.NEGATIVE_INFINITY
    for (const n of list) {
      const { h } = boxOf(n)
      const y = n.position?.y ?? 0
      if (y < top) top = y
      if (y + h > bottom) bottom = y + h
    }
    lanes.push({
      tier,
      title,
      x: boardLeft,
      y: top,
      width: boardRight - boardLeft,
      height: bottom - top,
    })
  }
  return lanes
}

/**
 * The gap between a band's title and its first card, in flow units. The title
 * is bottom-anchored this far above the band so a counter-scaled label grows UP
 * into the row gap, never down over a card. (Lives here so the glyph keep-out
 * below and `TierLanes` read one number.)
 */
export const LANE_TITLE_GAP = 8

/** Declared label type: `.layer-label{font-size:10px;letter-spacing:.5px}`, line-height 1.2. */
const LANE_TITLE_PX = 10
const LANE_TITLE_TRACKING_PX = 0.5
const LANE_TITLE_LINE_HEIGHT = 1.2
/**
 * A capital's advance at 10px, generous (Inter caps average ~0.66em; W/M run
 * wider). The keep-out only has to CONTAIN the label, so over-estimating costs
 * a glyph a ring step, and under-estimating is the defect.
 */
const LANE_TITLE_CAP_ADVANCE_PX = 7.4

/**
 * ⭐ v3.1 WS1 #28: the flow-space box the band title of `nodeId`'s row occupies
 * at the counter-scale BOUND (the landing rung, where it is largest relative to
 * the cards; at every higher zoom it is smaller, so the box still contains it).
 * `undefined` when the node is in no titled lane.
 */
export function tierLaneTitleBoxFor(
  nodes: readonly Node[],
  nodeId: string,
): { x0: number; y0: number; x1: number; y1: number } | undefined {
  const target = nodes.find((n) => n.id === nodeId)
  if (!target) return undefined
  const kind = kindOf(target)
  const tier = kind !== undefined ? TIER_BY_KIND[kind] : undefined
  if (tier === undefined) return undefined
  const lanes = deriveTierLanes(nodes)
  const lane = lanes.find((l) => l.tier === tier)
  if (!lane) return undefined
  const columnX = lanes.reduce((min, l) => Math.min(min, l.x), Number.POSITIVE_INFINITY)
  const s = MAX_LABEL_COUNTER_SCALE
  const width = lane.title.length * (LANE_TITLE_CAP_ADVANCE_PX + LANE_TITLE_TRACKING_PX) * s
  const height = LANE_TITLE_PX * LANE_TITLE_LINE_HEIGHT * s
  const bottom = lane.y - LANE_TITLE_GAP
  return { x0: columnX, y0: bottom - height, x1: columnX + width, y1: bottom }
}
