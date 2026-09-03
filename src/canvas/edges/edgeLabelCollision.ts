/**
 * edgeLabelCollision — E3 (graph-visuals): keep persistent edge labels
 * readable when they land near each other (e.g. two labels at a crossing).
 *
 * Pure, deterministic resolver: given every persistent label's anchor point,
 * assign each a vertical offset so no two overlap. Labels are processed in
 * spatial order (top-to-bottom, then left-to-right, then id) so the topmost
 * label stays anchored and later ones are displaced — the same input set
 * always produces the same assignment, and every edge computes the SAME
 * global assignment (each edge feeds the same approximated anchor set in,
 * then applies its own offset).
 *
 * Collision box = a rendered label (160 graph units wide by the derived
 * height below): two anchors closer than the thresholds on BOTH axes overlap.
 * Every threshold and step here is DERIVED from that box — see defect 1 and
 * defect 4 below for what happened when they were written down beside it.
 *
 * E3 part 2 (C2): node cards are fixed obstacles too. React Flow paints the
 * node layer ABOVE the edge-label renderer (node wrappers carry inline
 * zIndex ≥ 0; `.react-flow__edgelabel-renderer` has none), so a label that
 * lands under a card is clipped invisibly rather than layered on top.
 * Callers pass every node's rect; a label whose box (the same half-extents
 * around the anchor) is displaced by whole STEPs until it clears both the node
 * rects AND the labels placed before it. With no node rects the resolver
 * behaves exactly as before.
 *
 * ── 31 Aug 2026: three defects, measured in real Chromium ────────────────────
 * Founder report — two persistent labels painted on top of each other near the
 * goal node, and a third stranded below the bottom card with nothing joining
 * it to its edge. Reproduced with `e2e/geometry/edgeLabelOverlap.measure.ts`
 * on the shipped starters (jsdom cannot see any of this — CLAUDE.md trap 3):
 *
 * 1. THE LABEL-VS-LABEL X THRESHOLD WAS 90 FOR A BOX 160 WIDE. Two anchors
 *    90..160px apart on x were judged non-colliding while their boxes overlap
 *    by up to 70px. Measured on `market-entry`: two converging labels 144px
 *    apart, boxes overlapping 16px, no dodge fired. The one that paints second
 *    covers the other's ellipsis, which is why the report reads "clipped
 *    mid-word, no ellipsis" — the ellipsis is there, underneath. The threshold
 *    is now DERIVED from the box half-extents rather than being a second,
 *    smaller number kept in step by hand (CLAUDE.md's hand-maintained mirror).
 *
 * 2. THE SEARCH WAS DOWNWARD-ONLY, so a label blocked by a card walked the
 *    whole height of that card instead of stepping the other way. Measured on
 *    `build-vs-buy`: 104px and 130px displacements where 104 and −104 were
 *    available. The search is now bidirectional, smallest displacement first,
 *    downward on ties — so the previously-pinned downward assignments are
 *    unchanged wherever downward is the nearer clear slot.
 *
 * 3. THE GUARD RETURNED THE WORST CANDIDATE IT HAD TRIED. When nothing cleared
 *    within MAX_STACK the old loop left `dy` at the last value it stepped to —
 *    the maximum displacement AND still colliding. Measured on `build-vs-buy`:
 *    a label at exactly 260px (10 × STEP), off the bottom of the viewport,
 *    with an invisible leader — the "detached, no visible edge" symptom
 *    exactly. Unplaceable labels now take the LEAST-VIOLATING slot instead,
 *    which is near the anchor, so a label that cannot be placed cleanly stays
 *    attributable to its own edge.
 *
 * 4. THE BOX WAS 22 TALL IN THIS FILE AND 33 TALL ON SCREEN. Measured in
 *    Chromium on all five starters: the rendered label box is 160 × 33 graph
 *    units, not the 160 × 22 assumed here. The cause is the one
 *    `nodeLayoutConstants.ts` documents at length for node widths — canvas
 *    text carries a counter-scale, so at the zoom the product's own auto-fit
 *    parks at (`LABEL_LEGIBLE_ZOOM`, scale `MAX_LABEL_COUNTER_SCALE`) a 10px
 *    label renders at 20px and the box grows with it. The WIDTH cap is an
 *    inline `maxWidth` in graph units and does not move; the HEIGHT is
 *    content-driven and does. Consequence: labels 24..33 apart on y scored
 *    clear and overlapped (measured on `vendor-selection`), and every card
 *    clearance was 6px short — the ORIGINAL truncated-behind-a-card bug this
 *    module exists to fix, still live at 6px. The height is now derived from
 *    the counter-scale, the way node geometry already is.
 */
import { MAX_LABEL_COUNTER_SCALE } from '../utils/zoomLegibility'

export interface LabelPoint {
  id: string
  x: number
  y: number
  /**
   * How many stacked rows this label's chip renders. Absent = one row, so
   * every caller written before the chip gained a second row is unchanged.
   */
  rows?: LabelRowCount
}

/** A placed chip renders at most a strength row and a fragility row. */
export type LabelRowCount = 1 | 2

export interface LabelOffset {
  dx: number
  dy: number
}

/** A node card's bounding box in graph coordinates. */
export interface NodeRect {
  x: number
  y: number
  width: number
  height: number
}

// Label box half-extents, in GRAPH units — the units every rect here is in.
//
// Exported because StyledEdge's rendered label must stay INSIDE this box for
// the assumption to hold, and it takes TWO halves to hold it: the label
// container is capped at `maxWidth: 2 × LABEL_HALF_WIDTH` and is a single
// non-wrapping flex line, while the label TEXT span inside it carries the
// nowrap + ellipsis (declared on the flex container that pair computed to a
// hard clip and cut labels mid-word). So however long the label text is, it
// shortens rather than exceeding the width the resolver clears for. A spec
// pins both halves against these constants — widening the label, or moving
// either half off its owner, would silently under-clear every dodge.
//
// WIDTH is a fixed inline `maxWidth: 160px` on the label container. Inline px
// on a React Flow child ARE graph units, so it does not move with zoom.
export const LABEL_HALF_WIDTH = 80

// HEIGHT is content-driven and therefore DOES move with zoom, which is the
// whole reason this is derived rather than written down. StyledEdge's label
// uses `typography.edgeLabel` — `calc(10px * var(--canvas-label-scale))` with
// Tailwind `leading-tight` — inside `padding: '3px 8px'` and a 1px border.
// The counter-scale is largest at LABEL_LEGIBLE_ZOOM, which is exactly where
// the product's post-layout auto-fit parks a freshly drafted model, so the
// MAXIMUM is the case that matters: it is the box a real user is looking at.
//
// ⚠ THIS WAS THE LITERAL `11` (a 22-tall box) and the rendered box measures
// 33 at that zoom — the resolver was clearing two thirds of its own label.
// Same defect, same cause and same remedy as `nodeLayoutConstants.ts`'s
// text-derived widths, whose docblock records `#758` shipping precisely this
// drift for node titles: scale the font, forget the geometry, and the two
// part company in one deploy. Half-extents round UP, so the box is never
// under-stated.
const LABEL_DECLARED_FONT_PX = 10 // typography.edgeLabel
const LABEL_LINE_HEIGHT_RATIO = 1.25 // Tailwind `leading-tight`
const LABEL_VERTICAL_CHROME_PX = 8 // 3px padding + 1px border, top and bottom
/** Measured in Chromium at zoom 0.5 across all five starters: 33.0. */
const LABEL_BOX_HEIGHT =
  LABEL_DECLARED_FONT_PX * LABEL_LINE_HEIGHT_RATIO * MAX_LABEL_COUNTER_SCALE +
  LABEL_VERTICAL_CHROME_PX
export const LABEL_HALF_HEIGHT = Math.ceil(LABEL_BOX_HEIGHT / 2)

// Gap between the two stacked rows inside one chip. Inline px on a React Flow
// child ARE graph units, so this does not move with zoom (unlike the TEXT
// above it, which carries the counter-scale) — which is exactly why it is
// added outside the scaled term below.
export const LABEL_ROW_GAP_PX = 2

/**
 * Half-extent of a chip carrying `rows` stacked rows.
 *
 * ⛔ DERIVED FROM THE SAME QUANTITY AS `LABEL_BOX_HEIGHT` ABOVE, not written
 * beside it. The one-row case reproduces `LABEL_HALF_HEIGHT` exactly — pinned
 * in the spec — so the constant and this function cannot part company the way
 * the literal `11` parted company from the 33-tall box it was mirroring.
 * Only the TEXT stack multiplies: the 3px padding and 1px border are chrome
 * on the chip, paid once however many rows sit inside it.
 */
export function labelHalfHeightForRows(rows: LabelRowCount | undefined): number {
  const n = rows ?? 1
  const boxHeight =
    LABEL_DECLARED_FONT_PX * LABEL_LINE_HEIGHT_RATIO * MAX_LABEL_COUNTER_SCALE * n +
    LABEL_VERTICAL_CHROME_PX +
    LABEL_ROW_GAP_PX * (n - 1)
  return Math.ceil(boxHeight / 2)
}

// Breathing space kept between two label boxes. The ONLY reason the
// label-vs-label thresholds are not exactly the box extents.
const LABEL_GUTTER = 2

// ⛔ DERIVED FROM THE BOX, NOT WRITTEN BESIDE IT. Two anchors collide when
// their boxes do, so the thresholds ARE the box width/height (plus the
// gutter) — one quantity with two readers. Until 31 Aug 2026 BOTH thresholds
// were separate literals and BOTH had drifted from the box they mirrored: x
// was 90 for a box 160 wide (56%), and y was 24 for a box that renders 33
// tall (73%). Two labels inside either gap scored clear and painted on top of
// each other. Deriving them removes the mirror rather than re-copying it.
const X_THRESHOLD = LABEL_HALF_WIDTH * 2 + LABEL_GUTTER // 162
const Y_THRESHOLD = LABEL_HALF_HEIGHT * 2 + LABEL_GUTTER // 36

// One step must CLEAR a coincident pair, or the search burns two steps to do
// what one should — which is how displacements reached three figures. Derived
// for the same reason: a STEP smaller than the box it has to clear is the
// same drift one more time.
const STEP = Y_THRESHOLD

// Guard: never search unbounded on pathological input. Expressed as a
// DISTANCE budget, not a step count, so changing STEP cannot silently change
// how far a label may be flung from its edge. 260 graph units is the reach
// the pre-31-Aug resolver had (10 × its 26px step) — preserved deliberately,
// not re-chosen.
const MAX_DISPLACEMENT = 260
const MAX_STACK = Math.floor(MAX_DISPLACEMENT / STEP)

// A label painted under a node card is INVISIBLE (nodes paint above the
// edge-label renderer — verified in Chromium: `.react-flow__viewport`'s
// children are edges → edgelabel-renderer → nodes, all `z-index: auto`, so
// later siblings win). A label overlapping another label is merely crowded:
// both are still on screen. So when no slot is clean, prefer the one that
// keeps labels visible.
const LABEL_PENALTY = 1

// ⛔ STRICTLY WORSE THAN CROWDING. A label under a card has lost its TEXT; a
// label beside another label is crowded but still readable.
const CARD_PENALTY = LABEL_PENALTY + 1

// ⚠⚠ WHAT THIS RANKING DELIBERATELY DOES **NOT** DO, and the measurement
// behind the decision — read before adding a term to it.
//
// A displaced label is joined to its edge by a hairline leader that StyledEdge
// draws as an SVG sibling of the edge path — the LOWEST of the three layers —
// so a leader passing behind a node card is never painted and its label reads
// as belonging to nothing. Measured on the five starters: 7 of 9 leaders run
// behind a card. It is tempting to price that in here, and it was tried:
// adding a LEADER_PENALTY so a nearby crowded slot beats a distant clean one
// cut the worst displacement from 252 to 144 graph units and cleared every
// card overlap — AND TOOK LABEL-ON-LABEL OVERLAPS FROM 2 TO 3, deepening two
// of them from 2px to 11px of a 22px-tall painted box. That is the founder's
// headline symptom, traded for the other one.
//
// The finding underneath both attempts: with ONE degree of freedom (vertical)
// and a fixed 160-wide box, three labels converging on a goal card have no
// clean assignment, and no weighting invents one — it only chooses which harm
// to take. Closing the residual needs the resolver to be able to move a label
// SIDEWAYS, or the product to stop pinning three labels in a space that fits
// two. Both are design changes, deliberately not made here. Do not re-tune
// these weights hoping for a different answer; the two arms have been
// measured and the trade is real.

/**
 * Candidate displacements, nearest first, DOWNWARD BEFORE UPWARD at equal
 * magnitude. Order is the whole specification of the search: it makes the
 * result deterministic, keeps every previously-pinned downward assignment
 * intact wherever downward is the nearer clear slot, and means a blocked
 * label steps the short way past a card instead of walking its full height.
 */
const CANDIDATE_DYS: readonly number[] = (() => {
  const out = [0]
  for (let k = 1; k <= MAX_STACK; k++) out.push(k * STEP, -k * STEP)
  return out
})()

function labelIntersectsRect(
  cx: number,
  cy: number,
  r: NodeRect,
  halfHeight: number = LABEL_HALF_HEIGHT,
): boolean {
  return (
    cx + LABEL_HALF_WIDTH > r.x &&
    cx - LABEL_HALF_WIDTH < r.x + r.width &&
    cy + halfHeight > r.y &&
    cy - halfHeight < r.y + r.height
  )
}

/** An edge whose persistent label participates in the placement pass. */
export interface PlacementEdge {
  id: string
  sourceRect: NodeRect
  targetRect: NodeRect
  /** Rows in this edge's chip (strength and/or fragility). Absent = one. */
  rows?: LabelRowCount
}

// Task 9c proximity nudge: when a label anchor sits within NODE_PROXIMITY px
// of either endpoint card's centre, nudge it NUDGE_DISTANCE px perpendicular
// to the edge direction before resolution.
const NODE_PROXIMITY = 40
const NUDGE_DISTANCE = 20

/**
 * C2 review (findings 3 + 4): one deterministic pass from node rects to each
 * persistent label's TOTAL offset (proximity nudge + collision stack).
 *
 * Anchor basis (finding 3): every node component places its source handle at
 * bottom-centre and its target handle at top-centre, so the bezier label
 * point (labelX/labelY — where StyledEdge renders the label) is the midpoint
 * of those two HANDLE points. The previous basis — midpoint of the node
 * CENTRES — diverges from the render anchor by (sourceHeight −
 * targetHeight)/4, so unequal-height cards were collision-tested at a point
 * the label does not occupy. Deriving the anchor from node rects (rather
 * than each edge's own props) keeps the pass consistent: every edge computes
 * the SAME anchor for every label and therefore the same global assignment.
 *
 * Nudge order (finding 4): the Task 9c ±NUDGE_DISTANCE perpendicular nudge
 * is applied BEFORE resolution — the resolver sees nudged anchors — so it
 * can never push a card-cleared label back under a card. The nudge survives
 * in the returned total offset.
 */
export function resolvePersistentLabelPlacements(
  edges: readonly PlacementEdge[],
  nodeRects: readonly NodeRect[] = [],
): Map<string, LabelOffset> {
  const nudges = new Map<string, LabelOffset>()
  const points: LabelPoint[] = []
  for (const e of edges) {
    // Handle points: source bottom-centre → target top-centre
    const shx = e.sourceRect.x + e.sourceRect.width / 2
    const shy = e.sourceRect.y + e.sourceRect.height
    const thx = e.targetRect.x + e.targetRect.width / 2
    const thy = e.targetRect.y
    // Render anchor = midpoint of the handle points
    const ax = (shx + thx) / 2
    const ay = (shy + thy) / 2
    // Task 9c proximity nudge, keyed off the true anchor
    const scy = e.sourceRect.y + e.sourceRect.height / 2
    const tcy = e.targetRect.y + e.targetRect.height / 2
    let ndx = 0
    let ndy = 0
    if (
      Math.hypot(ax - shx, ay - scy) < NODE_PROXIMITY ||
      Math.hypot(ax - thx, ay - tcy) < NODE_PROXIMITY
    ) {
      const ex = thx - shx
      const ey = thy - shy
      const len = Math.hypot(ex, ey) || 1
      ndx = (-ey / len) * NUDGE_DISTANCE
      ndy = (ex / len) * NUDGE_DISTANCE
    }
    nudges.set(e.id, { dx: ndx, dy: ndy })
    points.push({ id: e.id, x: ax + ndx, y: ay + ndy, rows: e.rows })
  }
  const resolved = resolveLabelCollisionOffsets(points, nodeRects)
  const out = new Map<string, LabelOffset>()
  for (const e of edges) {
    const nudge = nudges.get(e.id)!
    const stack = resolved.get(e.id)!
    // (+ 0 is unnecessary: −0 from the perpendicular maths normalises to +0
    // through the addition below)
    out.set(e.id, { dx: nudge.dx + stack.dx, dy: nudge.dy + stack.dy })
  }
  return out
}

export function resolveLabelCollisionOffsets(
  points: readonly LabelPoint[],
  nodeRects: readonly NodeRect[] = [],
): Map<string, LabelOffset> {
  const sorted = [...points].sort(
    (a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id),
  )
  const placed: Array<{ x: number; y: number; halfHeight: number }> = []
  const out = new Map<string, LabelOffset>()
  for (const p of sorted) {
    // ⛔ THE PAIR TEST IS NOW SYMMETRIC IN BOTH BOXES. Two chips overlap when
    // the gap between their centres is less than the SUM of their half-
    // heights (plus the gutter) — one quantity with two contributors, not one
    // box's extent applied to both. For two one-row labels this is
    // 17 + 17 + 2 = 36, i.e. exactly the `Y_THRESHOLD` the suite pins, so no
    // existing displacement moves.
    const pHalf = labelHalfHeightForRows(p.rows)
    // Nearest-clear-slot search over CANDIDATE_DYS. `penalty` is 0 for a slot
    // that collides with nothing; the first such slot wins, so the assignment
    // is the smallest displacement that resolves every collision.
    let bestDy = 0
    let bestPenalty = Infinity
    for (const dy of CANDIDATE_DYS) {
      const cy = p.y + dy
      let penalty = 0
      for (const q of placed) {
        const yThreshold = pHalf + q.halfHeight + LABEL_GUTTER
        if (Math.abs(q.x - p.x) < X_THRESHOLD && Math.abs(q.y - cy) < yThreshold) penalty += LABEL_PENALTY
      }
      for (const r of nodeRects) {
        if (labelIntersectsRect(p.x, cy, r, pHalf)) penalty += CARD_PENALTY
      }
      if (penalty === 0) {
        bestDy = dy
        bestPenalty = 0
        break
      }
      // Strictly-less-than, so the earlier (nearer, then downward) candidate
      // keeps the slot on a tie — the search order is the tie-break, and that
      // is what keeps this deterministic.
      if (penalty < bestPenalty) {
        bestPenalty = penalty
        bestDy = dy
      }
    }
    // NOTE the fallback when nothing clears: `bestDy` is the LEAST-VIOLATING
    // slot, not the last one tried. The old loop exited its guard holding the
    // maximum displacement AND a collision — the worst of both — which is how
    // a label ended 260px from its own edge, off-viewport, joined to it by a
    // leader line that runs underneath the node layer and is therefore never
    // painted. A crowded label at its own anchor is recoverable; a stranded
    // one reads as belonging to a different part of the graph.
    placed.push({ x: p.x, y: p.y + bestDy, halfHeight: pHalf })
    out.set(p.id, { dx: 0, dy: bestDy })
  }
  return out
}
