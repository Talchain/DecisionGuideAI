import type { Node } from '@xyflow/react'
import { graphNeedsInitialLayout, STACKED_SPREAD_PX } from './graphNeedsInitialLayout'
import { NODE_CARD_MAX_W, LAYOUT_PADDING_X, LAYOUT_PADDING_Y } from './nodeLayoutConstants'

/**
 * ⭐⭐ DETERMINISTIC FALLBACK PLACEMENT — what the canvas looks like when the
 * layout engine could not run.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * `applyDraftResult` seeds every drafted node at `{x:0, y:0}` — that is its
 * sole `position` write — and the layout engine is what turns that seed into a
 * readable graph. When the engine throws, nothing else touches a coordinate, so
 * the user is left with EVERY NODE STACKED AT ONE POINT under a "Layout failed"
 * banner: not a degraded model, an unreadable one. Witnessed on a fresh
 * fundraising brief.
 *
 * This function is the floor under that: a plain grid, computed from the node
 * list alone, that always beats "all at the origin". **Simple and predictable
 * beats clever** — this runs precisely when the sophisticated thing has already
 * failed, so it must have no dependency that can fail with it (no ELK, no
 * dynamic import, no measurement, no viewport).
 *
 * ── IT IS NOT A LAYOUT, AND THE PRODUCT MUST NOT CLAIM IT IS ────────────────
 * Callers must NOT bump `layoutVersion` for a fallback. That counter means "the
 * product laid this graph out and owns the camera for it"; a grid is a rescue,
 * not a layout, and saying otherwise would make the error path lie about its
 * own quality. The error is still surfaced and the call still rejects.
 *
 * ── WHY A GRID IS ENOUGH TO FIX THE CAMERA TOO ─────────────────────────────
 * `useFitViewOnLayoutVersion`'s restore trigger already fits a graph with real
 * positions and nothing pending; it refuses an origin stack through
 * `graphNeedsInitialLayout`. So breaking the stack is what lets the product's
 * own panel-aware fit run — no camera guard has to be weakened, and the
 * pathological bare-mount zoom never gets the chance.
 *
 * ── DERIVED, NOT MIRRORED (trap 12) ────────────────────────────────────────
 * The gaps are `max(card box, STACKED_SPREAD_PX + 1)`, IMPORTING the same
 * threshold `graphNeedsInitialLayout` tests against. A hardcoded `120` here
 * would keep compiling if that threshold were ever raised above it, and the
 * fallback would silently start producing arrangements the product still reads
 * as a stack — the failure would look identical to no fix at all.
 */

/** Horizontal step. Wide enough to read, and provably above the stack threshold. */
const COL_GAP = Math.max(NODE_CARD_MAX_W + LAYOUT_PADDING_X, STACKED_SPREAD_PX + 1)
/** Vertical step. Same derivation, so neither axis can drift under the threshold. */
const ROW_GAP = Math.max(NODE_CARD_MAX_W / 2 + LAYOUT_PADDING_Y, STACKED_SPREAD_PX + 1)

function isLocked(node: Node): boolean {
  return (node.data as Record<string, unknown> | undefined)?.locked === true
}

/**
 * Arrange `nodes` on a deterministic grid, in array order.
 *
 * - Returns the ORIGINAL array by reference when the graph does not need it, so
 *   a healthy arrangement is never disturbed and callers can compare identity.
 * - Locked nodes keep their positions, the same exemption `layout.ts`'s own
 *   write-back applies. A user who pinned a node keeps it pinned, failure or
 *   not; the rule lives in one place because it is one question.
 * - Pure and total: no I/O, no imports that can reject, no viewport input.
 */
export function placeNodesDeterministically(nodes: Node[]): Node[] {
  if (!graphNeedsInitialLayout(nodes)) return nodes

  const movable = nodes.filter((n) => !isLocked(n))
  if (movable.length === 0) return nodes

  // ⚠ SORTED BY ID, NOT LEFT IN ARRAY ORDER. "Deterministic" has to mean the
  // same graph lands the same way, and array order is not a property of the
  // graph — it is a property of however the nodes were assembled. Measured
  // before this line existed: the same node set `{a,b,c,d}` fed forward and
  // reversed moved EVERY id, `a` going {0,0} → {344,176}. A user who reloads
  // into a different insertion order would see the rescue rearrange itself.
  // The original `is DETERMINISTIC` test re-ran the SAME array twice, so it
  // proved reproducibility and was structurally incapable of seeing this.
  const ordered = [...movable].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

  // Square-ish grid: the widest arrangement that still fits a normal viewport
  // without a long horizontal scroll, and a pure function of the count.
  const columns = Math.max(1, Math.ceil(Math.sqrt(ordered.length)))

  // ⚠ KEYED BY NODE IDENTITY, NOT BY `node.id`. A Map keyed on the id gives
  // every node sharing an id the SAME slot — so duplicates land on one point,
  // which is the exact pile this whole change exists to abolish. Not
  // hypothetical: `utils/layout.ts` in this same change set detects duplicate
  // ids and records that the store keeps both. Building the detector and the
  // pile in one PR is precisely the kind of thing a property test over unique
  // ids cannot see.
  const positionByNode = new Map<Node, { x: number; y: number }>()
  ordered.forEach((node, index) => {
    positionByNode.set(node, {
      x: (index % columns) * COL_GAP,
      y: Math.floor(index / columns) * ROW_GAP,
    })
  })

  return nodes.map((node) => {
    const next = positionByNode.get(node)
    return next ? { ...node, position: next } : node
  })
}
