/**
 * POLARITY-GLYPH PLACEMENT — one glyph, one place, per edge.
 *
 * ⭐⭐ WHY THIS MODULE EXISTS: THE GLYPH WAS KEYED ON A VALUE THAT IS NOT
 * PER-EDGE, SO IT COLLAPSED.
 *
 * `StyledEdge` painted the +/− glyph at `translate(targetX - 18, targetY - 18)`.
 * `targetX/targetY` arrive from React Flow as
 * `getHandlePosition(targetNode, targetHandle, targetPosition)`
 * (`@xyflow/system@0.0.76` `dist/esm/index.mjs:1420-1438`) — a pure function of
 * the TARGET NODE and its HANDLE, taking **no edge input whatsoever**. Every
 * edge terminating at the same node therefore receives byte-identical
 * `targetX/targetY`, and a placement that is a pure function of those two
 * numbers gives every such edge byte-identical placement.
 *
 * Measured on the geometry harness at `a1fd39cc` (all five starters, real
 * Chromium): 14 glyphs at 5 distinct sites on `vendor-selection`, 18 at 6 on
 * `market-entry`, and **21 of 21 stacks resolved to exactly ONE target node** —
 * the discriminating prediction of this mechanism. A stack spanning two targets
 * would have refuted it; none did.
 *
 * ⛔ AND THE HARM IS A TRUST DEFECT, NOT CLUTTER. `directionStroke.ts:23-32`
 * carries the measurement: the stroke palette separates WORSE than green/red
 * for a dichromat (ΔE2000 11.7 vs 28.3 under deuteranopia), so "the +/− glyph,
 * not the colour, is what carries polarity for a red-green dichromat here."
 * Where two glyphs stack, the visible mark is whichever painted last — and on
 * EVERY ONE of the five starters at least two stacks contained BOTH a `+` and a
 * `−`. The canvas asserted a direction that could be the opposite of the
 * model's, on the one channel that exists for readers who cannot use the hue.
 *
 * ⭐ THE GUARANTEE THIS FUNCTION MAKES, and it is a guarantee rather than a
 * tendency: **for any two distinct edges sharing a target, the returned offsets
 * differ.** Proof, and it is why the placement is polar rather than cartesian:
 *
 *   A returned offset is `dir * radius` with `|dir| = 1` and `radius > 0`.
 *   If `dir_i * r_i === dir_j * r_j` then, taking magnitudes, `r_i === r_j`,
 *   and dividing through, `dir_i === dir_j`.
 *   So two offsets coincide ONLY when both direction and radius coincide.
 *   - Directions differ  → offsets differ, whatever the radii. Done.
 *   - Directions are EXACTLY equal → for `i < j` in id order, every earlier
 *     sibling within the tie angle of `i` is also within it of `j` (same
 *     direction), and `i` itself is within it of `j`. So `ring_j >= ring_i + 1`,
 *     the radii differ, and the offsets differ.
 *   Neither branch can produce a stack. ∎
 *
 * ⚠ BE PRECISE ABOUT WHAT `TIE_ANGLE_DEG` DOES, because it is easy to read this
 * proof as resting on it and it does not. The guarantee above turns on EXACT
 * direction equality; the tie angle is a LEGIBILITY rule, separating glyphs
 * whose approach directions are merely close enough that their painted boxes
 * would touch. Widening or narrowing it changes how tidy the result looks and
 * can never reintroduce a stack.
 *
 * ⚠ ONE BASIS FOR EVERY EDGE, INCLUDING SELF. Each `StyledEdge` instance runs
 * this for itself, so the resolution is only stable if every instance computes
 * the SAME picture. That is why directions come from NODE CENTRES for all
 * siblings — including the edge asking — rather than the asking edge using its
 * own (more accurate) bezier midpoint and its siblings a coarser proxy. Two
 * bases means two instances can each believe they are ring 0, which is CLAUDE.md
 * trap 21 (one name, two questions) reached through a geometry approximation.
 *
 * ⚠ AND THE DEGRADED CASE IS SAFE BY CONSTRUCTION. If any sibling's direction
 * is unresolvable (a node not yet measured, a source and target at the same
 * point), EVERY instance sees the same gap in the same shared store data and
 * every instance degrades the same way: ring index becomes the edge's position
 * in the id-sorted sibling list, which is unique per edge, so radii are pairwise
 * distinct and the guarantee holds without leaning on direction at all.
 */

/** A sibling edge into the same target. `sourceCentre` is null when unresolvable. */
export interface GlyphSibling {
  id: string
  /** Centre of the edge's SOURCE node, in graph units. */
  sourceCentre: { x: number; y: number } | null
}

export interface GlyphOffset {
  dx: number
  dy: number
}

/**
 * Distance from the target handle anchor to the glyph, in graph units.
 * The superseded placement sat at (-18, -18) — a diagonal ~25 units long — so
 * this keeps the glyph's distance from the node it terminates at essentially
 * unchanged, and spends the change entirely on DIRECTION.
 */
export const GLYPH_ANCHOR_RADIUS = 26

/**
 * Extra radius per ring, for siblings whose approach directions are too close
 * to separate on angle alone. 24 graph units clears the glyph's own painted box
 * (~20 units wide at the 0.50 auto-fit zoom the product parks a fresh model at).
 */
export const GLYPH_RING_STEP = 24

/**
 * Two approach directions closer than this are treated as coincident and are
 * separated by radius instead. At `GLYPH_ANCHOR_RADIUS` the chord subtended by
 * 45° is 2*26*sin(22.5°) ≈ 19.9 units — about one glyph box — so below this
 * angle the boxes would touch even though the points differ.
 */
export const GLYPH_TIE_ANGLE_DEG = 45

const TIE_COS = Math.cos((GLYPH_TIE_ANGLE_DEG * Math.PI) / 180)

/**
 * Deterministic fallback direction for ring `k`, used only where no geometric
 * direction exists at all. The golden angle keeps successive rings far apart
 * instead of doubling back on each other.
 */
function fallbackDirection(k: number): { x: number; y: number } {
  const a = k * 2.39996323 - Math.PI / 2
  return { x: Math.cos(a), y: Math.sin(a) }
}

function unitFrom(
  targetCentre: { x: number; y: number },
  sourceCentre: { x: number; y: number } | null,
): { x: number; y: number } | null {
  if (!sourceCentre) return null
  const dx = sourceCentre.x - targetCentre.x
  const dy = sourceCentre.y - targetCentre.y
  const len = Math.hypot(dx, dy)
  // A source and target at the same point give no direction. Not an error —
  // just a case the ring rule has to carry instead of the angle rule.
  if (!Number.isFinite(len) || len < 1e-6) return null
  return { x: dx / len, y: dy / len }
}

/**
 * Where this edge's polarity glyph sits, as an offset from the TARGET HANDLE
 * ANCHOR (`targetX`/`targetY`).
 *
 * `siblings` is every edge sharing this target, INCLUDING the one asking. Order
 * is irrelevant — the function sorts by id — so a caller may pass the store's
 * edge list filtered by `target` without further work.
 *
 * Returns `{ dx: 0, dy: 0 }`-free output: the offset always has a positive
 * magnitude, so the glyph never lands on the handle anchor itself.
 */
export function resolvePolarityGlyphOffset(
  edgeId: string,
  targetCentre: { x: number; y: number },
  siblings: GlyphSibling[],
): GlyphOffset {
  const ordered = [...siblings].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const self = ordered.findIndex((s) => s.id === edgeId)
  // An edge absent from its own sibling list is a caller bug, not a geometry
  // case. Fall back to the lone-edge placement rather than throwing inside a
  // render: a missing glyph is worse than a crudely placed one, and a thrown
  // error here would take the whole canvas down.
  if (self === -1) {
    const dir = fallbackDirection(0)
    return { dx: dir.x * GLYPH_ANCHOR_RADIUS, dy: dir.y * GLYPH_ANCHOR_RADIUS }
  }

  const dirs = ordered.map((s) => unitFrom(targetCentre, s.sourceCentre))

  // ⭐ THE DEGRADED BRANCH. If ANY sibling's direction is unresolvable the whole
  // group falls back to index-by-id, because a group where some members are
  // separated by angle and others by index is a group where two bases decide
  // one question. Every instance reads the same store, so every instance takes
  // this branch together.
  const anyMissing = dirs.some((d) => d === null)
  if (anyMissing) {
    const dir = dirs[self] ?? fallbackDirection(self)
    const radius = GLYPH_ANCHOR_RADIUS + self * GLYPH_RING_STEP
    return { dx: dir.x * radius, dy: dir.y * radius }
  }

  const mine = dirs[self]!
  // Ring index: how many EARLIER siblings approach from within the tie angle.
  // Counting only earlier siblings is what makes the assignment a total order —
  // every member of a coincident run gets a distinct ring, in id order.
  let ring = 0
  for (let i = 0; i < self; i++) {
    const other = dirs[i]!
    if (mine.x * other.x + mine.y * other.y >= TIE_COS) ring++
  }
  const radius = GLYPH_ANCHOR_RADIUS + ring * GLYPH_RING_STEP
  return { dx: mine.x * radius, dy: mine.y * radius }
}
