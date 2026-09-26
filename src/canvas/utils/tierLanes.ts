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
import { KIND_GLYPH_PX, TIER_BY_KIND } from './nodeLayoutConstants'
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
 * The clearance, in flow units, between a band's title and what stands directly
 * below it: its band's card tops, or — when the title rises clear of them — the
 * tops of those cards' kind shapes. The title is bottom-anchored so a
 * counter-scaled label grows UP into the row gap, never down over a card. The
 * row gap budgets the same clearance again above the title
 * (`LAYOUT_LAYER_GAP`). (Lives here so `TierLanes`, the glyph keep-outs below
 * and the guard read one number.)
 */
export const LANE_TITLE_GAP = 8

/** Declared label type: `.layer-label{font-size:10px;letter-spacing:.5px}`, line-height 1.2. */
const LANE_TITLE_PX = 10
const LANE_TITLE_TRACKING_PX = 0.5
const LANE_TITLE_LINE_HEIGHT = 1.2
/** The title's one line box, unscaled (10px × 1.2). */
export const LANE_TITLE_LINE_PX = LANE_TITLE_PX * LANE_TITLE_LINE_HEIGHT
/**
 * A capital's advance at 10px, generous (Inter caps average ~0.66em; W/M run
 * wider). The keep-out only has to CONTAIN the label, so over-estimating costs
 * a glyph a ring step, and under-estimating is the defect.
 */
const LANE_TITLE_CAP_ADVANCE_PX = 7.4

export interface FlowBox {
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
}

/** Positive-area intersection: boxes that only touch do not collide. */
function overlaps(a: FlowBox, b: FlowBox): boolean {
  return Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0) && Math.min(a.y1, b.y1) > Math.max(a.y0, b.y0)
}

/**
 * The flow-space box of a card's kind shape at label scale `scale` — the box
 * `BaseNode` draws (`KIND_GLYPH_PX × scale` square, centred on the card's top
 * border, horizontally centred on the card).
 */
export function kindGlyphBoxOf(n: Node, scale: number): FlowBox {
  const size = KIND_GLYPH_PX * scale
  const cx = (n.position?.x ?? 0) + boxOf(n).w / 2
  const top = (n.position?.y ?? 0) - size / 2
  return { x0: cx - size / 2, y0: top, x1: cx + size / 2, y1: top + size }
}

export interface LaneTitlePlacement {
  readonly tier: number
  readonly title: string
  /** The one left column every title shares: the board's leftmost card edge. */
  readonly x: number
  /** Its band's top — the first course's card tops. */
  readonly laneY: number
  /**
   * The title stands clear ABOVE its band's kind shapes rather than just above
   * its cards, because at the bound its run would otherwise cross one.
   */
  readonly clearsKindGlyphs: boolean
  /** The box the title occupies at the counter-scale bound. */
  readonly boxAtBound: FlowBox
}

/**
 * ⭐⭐ WHERE EACH BAND TITLE STANDS — the one answer `TierLanes` renders and the
 * polarity-glyph keep-out (`tierLaneTitleBoxFor`) reads.
 *
 * ## The kind shape keep-out (26 Sep 2026, review of #2074, Blocker 1)
 *
 * WS1 #15 counter-scaled each card's kind shape to the contract's 24px, so at
 * the landing bound it stands 24 units above its card, and WS1 #26's band words
 * run 158–198 units there. A title bottom-anchored `LANE_TITLE_GAP` above its
 * cards sat in that strip, and on four of the five starters the leftmost
 * card's shape covered it: ALTERNATIVES under the first option's square,
 * OUTCOMES / RISKS under the first risk's triangle (served, 1280×800: 24.0×7.5px
 * each, none at the base).
 *
 * The v3.1 prototype never puts a `.layer-label` under a `.node .shape`. Over
 * the bands that start at the label column (ALTERNATIVES, FACTORS, OUTCOMES /
 * RISKS) the label's line box ends 2.5–5.5px above the shape tops, and its top
 * clears the row above by 3–8px; EXPLORATION and GOAL sit level with their
 * centred anchors' shapes, which stand far to the right of the run. At the
 * bound the run is twice as long against cards that are not, so the columns
 * cannot keep them apart here — only height can. A title whose run would cross
 * a kind shape therefore rises by the shape's overhang and keeps
 * `LANE_TITLE_GAP` (4px on screen at landing) above it; one whose run is clear
 * stays on its cards, as the prototype's EXPLORATION and GOAL do.
 *
 * ⚠ DECIDED AT THE BOUND, APPLIED AT EVERY ZOOM. Below the bound the run and
 * the shape both shrink and move apart, so a run clear at the bound is clear
 * everywhere; deciding once keeps a title from hopping as the camera moves.
 * ⚠ The first band's title is the one that must NOT rise without cause: the
 * landing top-anchors the board under the top bar with 16px to spare, which
 * holds the title on its cards, not 24 units higher.
 */
export function deriveLaneTitles(nodes: readonly Node[]): LaneTitlePlacement[] {
  const lanes = deriveTierLanes(nodes)
  if (lanes.length === 0) return []
  const columnX = lanes.reduce((min, l) => Math.min(min, l.x), Number.POSITIVE_INFINITY)
  const s = MAX_LABEL_COUNTER_SCALE
  const height = LANE_TITLE_LINE_PX * s
  const glyphs = nodes
    .filter((n) => !isGhostNode(n.id))
    .filter((n) => {
      const kind = kindOf(n)
      return kind !== undefined && TIER_BY_KIND[kind] !== undefined
    })
    .map((n) => kindGlyphBoxOf(n, s))
  const overhang = (KIND_GLYPH_PX / 2) * s
  return lanes.map((lane) => {
    const width = lane.title.length * (LANE_TITLE_CAP_ADVANCE_PX + LANE_TITLE_TRACKING_PX) * s
    const boxWithBottom = (bottom: number): FlowBox => ({ x0: columnX, y0: bottom - height, x1: columnX + width, y1: bottom })
    const onCards = boxWithBottom(lane.y - LANE_TITLE_GAP)
    const clearsKindGlyphs = glyphs.some((g) => overlaps(onCards, g))
    return {
      tier: lane.tier,
      title: lane.title,
      x: columnX,
      laneY: lane.y,
      clearsKindGlyphs,
      boxAtBound: clearsKindGlyphs ? boxWithBottom(lane.y - overhang - LANE_TITLE_GAP) : onCards,
    }
  })
}

/**
 * ⭐ v3.1 WS1 #28: the flow-space box the band title of `nodeId`'s row occupies
 * at the counter-scale BOUND (the landing rung, where it is largest relative to
 * the cards; at every higher zoom it is smaller, so the box still contains it).
 * `undefined` when the node is in no titled lane.
 */
export function tierLaneTitleBoxFor(
  nodes: readonly Node[],
  nodeId: string,
): FlowBox | undefined {
  const target = nodes.find((n) => n.id === nodeId)
  if (!target) return undefined
  const kind = kindOf(target)
  const tier = kind !== undefined ? TIER_BY_KIND[kind] : undefined
  if (tier === undefined) return undefined
  return deriveLaneTitles(nodes).find((t) => t.tier === tier)?.boxAtBound
}
