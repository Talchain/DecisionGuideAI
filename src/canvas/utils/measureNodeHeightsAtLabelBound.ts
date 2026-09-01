/**
 * ⭐⭐ THE HEIGHT THE LAYOUT MUST RESERVE IS THE HEIGHT AT THE COUNTER-SCALE
 * BOUND — NOT THE HEIGHT THE CARD HAPPENS TO HAVE AT TODAY'S ZOOM.
 *
 * THE DEFECT. `layoutGraph`'s `getNodeDimensions` reads `node.measured.height`,
 * which is the card's height AT THE CURRENT VIEWPORT ZOOM — because canvas card
 * height is a function of zoom. `CanvasLabelScaleSync` writes
 * `--canvas-label-scale` = `labelCounterScale(zoom)` = `1 / min(1, max(zoom,
 * LABEL_LEGIBLE_ZOOM))` onto the React Flow root, and the canvas type tokens
 * multiply by it: `typography.nodeTitle` is
 * `calc(12px * var(--canvas-label-scale,1))`, `nodeLabel` `calc(11px * …)`.
 * So every wrapped title and every body line grows as the user zooms out, and
 * the card grows with them.
 *
 * MEASURED (real Chromium, `build-vs-buy` @1280x800, one page, camera driven
 * through React Flow's own store, nothing else touched):
 *
 *   zoom   1.0    0.9    0.8    0.7    0.6    0.5   0.45   0.434
 *   scale  1      1.12   1.25   1.43   1.67   2     2      2
 *   Σ h    3030   3226   3611   4177   4890   6211  6195   6195
 *
 * ×2.05 across the band, 45–315 px on individual cards. Controls: an element
 * OUTSIDE the React Flow subtree held 16px at every sample, and the ghost
 * nodes — which carry no counter-scaled label text — held 64px at every
 * sample, so the probe is discriminating and not reporting a re-render
 * (CLAUDE.md trap 20: a per-item probe that answers the same for every item is
 * reporting on itself).
 *
 * The layout carries NO zoom term. `normaliseTierRows` sizes each row as
 * (tallest card in the row + LAYOUT_PADDING_Y) + effectiveLayerSpacing, once,
 * from whatever heights were on screen when it ran. So a stride computed at one
 * zoom is wrong at every other zoom in the band, and the error is unbounded
 * upward: a layout run at zoom 0.9 is 88% short at zoom 0.5.
 *
 * WITNESSED END TO END (`e2e/geometry/restoreHeightDelta.measure.ts`):
 * converge a fresh draft, zoom to 0.9, then Auto-arrange — which is a DIRECT
 * `applyLayout()` (`contextMenu/useMenuItems.ts:268`), so it never enters
 * `useMeasureThenLayout`'s gate and never records `laidOutHeightsRef`. The
 * post-layout fit floors the camera back to 0.5, the scale returns to 2, and
 * the graph goes to **13 overlapping pairs in the same session**. Flush through
 * the product's own autosave and reload: **13 pairs, constant across 20 samples
 * over 30 s, `layoutVersion` 0** — permanent, because all three of
 * `useMeasureThenLayout`'s corrective branches are unreachable on a restore.
 * Forcing one re-layout at the restore heights returns **0**.
 *
 * ⭐ THIS IS THE HEIGHT ANALOGUE OF A RULE THE PRODUCT ALREADY HAS FOR WIDTH.
 * `zoomLegibility.ts` states it explicitly: *"Geometry cannot simply track
 * `labelCounterScale(zoom)` … Sizing for the BOUND is stable, needs no
 * relayout, and is correct at the only zoom the product ever chooses for the
 * user."* `MAX_LABEL_COUNTER_SCALE` exists for exactly that, and
 * `nodeLayoutConstants.ts` consumes it for `NODE_TITLE_MIN_MEASURE_PX` and
 * `NODE_LAYOUT_MIN_W`. Width was bound to the constant; height was left tracking
 * the live scale. This module closes that asymmetry — it does not invent a rule.
 *
 * ⭐ AND IT STRENGTHENS FOUNDER RULING R1 RATHER THAN BENDING IT. `applyLayout`
 * says *"No canvas/viewport argument, deliberately: the canonical layout has no
 * runtime input."* Today it HAS one, smuggled in through `measured.height` — the
 * live zoom. Measuring at a CONSTANT scale removes it: two layouts of the same
 * graph at different zooms become identical, which is what R1 asks for and what
 * `layoutIsZoomInvariant` in the spec pins.
 *
 * ⚠ WHY A DOM READ AND NOT ARITHMETIC. Height is not linear in the scale — only
 * the text runs scale, and how many LINES a title wraps to is a step function of
 * the font size. There is no closed form from `h(zoom)` to `h(bound)`; the
 * browser is the only oracle. The read is synchronous and no paint can occur
 * inside it: set the property, read `offsetHeight` (which forces layout),
 * restore the property, all without yielding to the event loop.
 *
 * ⚠ WHY IT MAY RETURN AN EMPTY MAP, AND WHY THAT IS NOT A FAILURE. jsdom has no
 * layout, and a headless/SSR context has no React Flow root. Callers must treat
 * an absent entry as "no better information than `measured.height`" and fall
 * through — never as zero. A missing key must NEVER become a height.
 */
import { CANVAS_LABEL_SCALE_VAR, MAX_LABEL_COUNTER_SCALE } from './zoomLegibility'

/**
 * Rendered height, in model px, of every mounted canvas node, measured with the
 * label counter-scale pinned to `MAX_LABEL_COUNTER_SCALE`.
 *
 * Returns an EMPTY map where there is nothing to measure (no DOM, no React Flow
 * root, no mounted nodes). Never throws: a layout that cannot be improved must
 * still run.
 */
export function measureNodeHeightsAtLabelBound(): Map<string, number> {
  const out = new Map<string, number>()
  if (typeof document === 'undefined') return out

  const root = document.querySelector('.react-flow') as HTMLElement | null
  if (root === null) return out

  const nodes = root.querySelectorAll('.react-flow__node[data-id]')
  if (nodes.length === 0) return out

  // Restore EXACTLY what was there, including "no inline value at all".
  // `CanvasLabelScaleSync` writes this property in an effect keyed on the
  // quantised scale, so it will not re-write it unless the zoom moves — leaving
  // a value behind would silently mis-size every later render.
  const previous = root.style.getPropertyValue(CANVAS_LABEL_SCALE_VAR)
  try {
    root.style.setProperty(CANVAS_LABEL_SCALE_VAR, String(MAX_LABEL_COUNTER_SCALE))
    for (const el of nodes) {
      const e = el as HTMLElement
      const id = e.dataset.id
      // `offsetHeight` forces synchronous layout, which is the point: it is what
      // makes the value above take effect before the read.
      const h = e.offsetHeight
      if (id !== undefined && id !== '' && h > 0) out.set(id, h)
    }
  } finally {
    if (previous === '') root.style.removeProperty(CANVAS_LABEL_SCALE_VAR)
    else root.style.setProperty(CANVAS_LABEL_SCALE_VAR, previous)
  }

  return out
}
