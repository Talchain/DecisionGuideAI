/**
 * THE ROW STRIDE MUST CLEAR THE CARD AT THE COUNTER-SCALE BOUND.
 *
 * Canvas card height is a FUNCTION OF THE VIEWPORT ZOOM: `CanvasLabelScaleSync`
 * writes `--canvas-label-scale` = `labelCounterScale(zoom)` onto the React Flow
 * root and the canvas type tokens multiply by it (`typography.nodeTitle` is
 * `calc(12px * var(--canvas-label-scale,1))`). Measured in real Chromium on
 * `build-vs-buy` @1280x800: total card height 3030 px at zoom 1.0 → 6211 px at
 * zoom 0.5, ×2.05, with 45–315 px on individual cards.
 *
 * `layoutGraph` carried no zoom term, so it sized every row from the height the
 * cards happened to have when it ran. Witnessed end to end
 * (`e2e/geometry/restoreHeightDelta.measure.ts`): Auto-arrange at zoom 0.9,
 * camera floors back to 0.5, **13 overlapping pairs**, constant for 30 s across
 * a reload.
 *
 * ⭐ THE INVARIANTS BELOW ARE WRITTEN AGAINST THE SPEC, NOT AGAINST THAT
 * FAILURE MODE (CLAUDE.md trap 13d). The spec is (a) the row beneath clears the
 * card at the tallest it can ever be, and (b) the canonical layout has no
 * viewport input (founder ruling R1) — so the same graph laid out at two
 * different zooms must produce IDENTICAL positions. Writing "…clears it at zoom
 * 0.9" would encode the direction this was found from and miss the other half.
 */
import { describe, it, expect } from 'vitest'
import { layoutGraph } from '../utils/layout'
import { LAYOUT_PADDING_Y } from '../utils/nodeLayoutConstants'
import type { Node, Edge } from '@xyflow/react'

/** Default `layerSpacing` when the caller passes none: `max(30, 15 * 1.5)`. */
const EFFECTIVE_LAYER_SPACING = 30

/** A node carrying the height it renders at ONE PARTICULAR zoom. */
function nodeAt(id: string, type: string, measuredHeight: number): Node {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { label: id },
    measured: { width: 230, height: measuredHeight },
  } as unknown as Node
}

function edge(id: string, source: string, target: string): Edge {
  return { id, source, target }
}

/**
 * Vertical gap between the BOTTOM of `above` at height `hAbove` and the TOP of
 * `below`. Derived from the returned positions, never from a fixed box — the
 * hardcoded-box mistake `checkNoOverlap` shipped for months.
 */
function gapBetween(
  laid: Node[],
  above: string,
  hAbove: number,
  below: string,
): number {
  const a = laid.find((n) => n.id === above)!
  const b = laid.find((n) => n.id === below)!
  return b.position.y - (a.position.y + hAbove)
}

/** decision → option → goal, one node per tier, so the stride is unambiguous. */
const EDGES: Edge[] = [edge('e1', 'd', 'o'), edge('e2', 'o', 'g')]

describe('layoutGraph — the stride reserves the height at the label bound', () => {
  it('the row beneath clears the card at its BOUND height, not the height it has at the current zoom', async () => {
    // The card renders 120 px at the zoom the layout runs at, and 300 px at the
    // counter-scale bound — the shape measured in Chromium (×2.05 across the
    // band). Only the bound is a property of the model; 120 is a property of
    // where the camera happened to be.
    const bound = new Map<string, number>([
      ['d', 300],
      ['o', 300],
      ['g', 300],
    ])
    const { nodes } = await layoutGraph(
      [nodeAt('d', 'decision', 120), nodeAt('o', 'option', 120), nodeAt('g', 'goal', 120)],
      EDGES,
      { heightAtLabelBound: bound },
    )

    // The row beneath must clear a 300 px card by at least the layer spacing.
    expect(gapBetween(nodes, 'd', 300, 'o')).toBeGreaterThanOrEqual(EFFECTIVE_LAYER_SPACING)
    expect(gapBetween(nodes, 'o', 300, 'g')).toBeGreaterThanOrEqual(EFFECTIVE_LAYER_SPACING)
  })

  it('the same graph laid out at two different zooms produces IDENTICAL positions (founder ruling R1)', async () => {
    const bound = new Map<string, number>([
      ['d', 300],
      ['o', 300],
      ['g', 300],
    ])
    // Same three cards; the only difference is where the camera was, which is
    // exactly what `measured.height` carries.
    const atZoomPoint9 = [nodeAt('d', 'decision', 140), nodeAt('o', 'option', 150), nodeAt('g', 'goal', 130)]
    const atZoomPoint5 = [nodeAt('d', 'decision', 300), nodeAt('o', 'option', 300), nodeAt('g', 'goal', 300)]

    const a = await layoutGraph(atZoomPoint9, EDGES, { heightAtLabelBound: bound })
    const b = await layoutGraph(atZoomPoint5, EDGES, { heightAtLabelBound: bound })

    const posOf = (r: { nodes: Node[] }) =>
      Object.fromEntries(r.nodes.map((n) => [n.id, [Math.round(n.position.x), Math.round(n.position.y)]]))
    expect(posOf(a)).toEqual(posOf(b))
  })

  // ── OPPOSITE-DIRECTION TWINS ────────────────────────────────────────────
  // Every changed predicate ships its twin. These two must be GREEN at pristine
  // and stay green: they pin that the new precedence level is INERT wherever it
  // carries no information, which is jsdom, SSR, and every unmounted node.

  it('a node ABSENT from the bound map keeps the existing precedence, unchanged', async () => {
    const nodes = [nodeAt('d', 'decision', 220), nodeAt('o', 'option', 220), nodeAt('g', 'goal', 220)]
    // 'o' is deliberately absent — the map must not be read as "0 for o".
    const partial = new Map<string, number>([['d', 220], ['g', 220]])

    const withPartial = await layoutGraph(nodes, EDGES, { heightAtLabelBound: partial })
    const withNone = await layoutGraph(nodes, EDGES, {})

    const posOf = (r: { nodes: Node[] }) =>
      Object.fromEntries(r.nodes.map((n) => [n.id, [Math.round(n.position.x), Math.round(n.position.y)]]))
    // Every bound value equals the measured value here, so the two runs must
    // agree exactly — and 'o' must NOT collapse to a 40 px floor.
    expect(posOf(withPartial)).toEqual(posOf(withNone))
    expect(gapBetween(withPartial.nodes, 'o', 220, 'g')).toBeGreaterThanOrEqual(EFFECTIVE_LAYER_SPACING)
  })

  it('an EMPTY bound map is the same layout as no map at all', async () => {
    const nodes = [nodeAt('d', 'decision', 180), nodeAt('o', 'option', 210), nodeAt('g', 'goal', 160)]
    const withEmpty = await layoutGraph(nodes, EDGES, { heightAtLabelBound: new Map() })
    const withNone = await layoutGraph(nodes, EDGES, {})
    const posOf = (r: { nodes: Node[] }) =>
      Object.fromEntries(r.nodes.map((n) => [n.id, [Math.round(n.position.x), Math.round(n.position.y)]]))
    expect(posOf(withEmpty)).toEqual(posOf(withNone))
  })

  it('the ELK padding is still added on top of the bound height', async () => {
    // Guards the arithmetic the two invariants above share: a fix that satisfied
    // them by dropping LAYOUT_PADDING_Y would leave the rendered gap short.
    const bound = new Map<string, number>([['d', 300], ['o', 300], ['g', 300]])
    const { nodes } = await layoutGraph(
      [nodeAt('d', 'decision', 120), nodeAt('o', 'option', 120), nodeAt('g', 'goal', 120)],
      EDGES,
      { heightAtLabelBound: bound },
    )
    expect(gapBetween(nodes, 'd', 300, 'o')).toBe(LAYOUT_PADDING_Y + EFFECTIVE_LAYER_SPACING)
  })
})
