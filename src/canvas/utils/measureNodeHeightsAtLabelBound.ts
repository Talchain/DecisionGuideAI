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
 * ⭐⭐ WHAT THIS ACTUALLY ACHIEVES, MEASURED — because "the layout ignores zoom"
 * and "the number we feed the layout ignores zoom" are DIFFERENT CLAIMS, and
 * only the first is provable in jsdom (review note 1). Driven in real Chromium
 * over ten zooms from 1.2 to 0.4, each one asserted to have been REACHED AND
 * HELD, with two agreeing reads per sample:
 *
 *   live Σ card height  3030 → 6211 px  (×2.05, seven distinct answers)
 *   this module's answer   ONE answer across 1.2 · 1.0 · 0.9 · 0.8 · 0.7 ·
 *                          0.6 · 0.5 — six distinct label scales
 *
 * ⚠ AND IT IS NOT PERFECTLY INVARIANT. THERE ARE TWO ANSWERS, NOT ONE, AND THE
 * SECOND IS WORTH NAMING RATHER THAN ROUNDING AWAY. Below `LABEL_LEGIBLE_ZOOM`
 * the store rung `lodRung` changes (`LodSync`), and this module pins the SCALE,
 * not that FLAG — it cannot pin the flag itself, because it is read by React
 * components and a re-render is not available inside a synchronous measurement.
 * So:
 *
 *   zoom ≥ 0.5 (LOD off)  Σ 6211    zoom < 0.5 (LOD on)  Σ 6119
 *   difference: −92 px total (−1.48%), on 7 of 23 cards, worst −16 px
 *
 * ⭐ BOUNDED, AND IN THE SAFE DIRECTION — the worst single card was 16 px against
 * a designed row slack of `LAYOUT_PADDING_Y + effectiveLayerSpacing` = 64 px
 * (45 px for a sub-row). The direction is pinned by
 * `lodTitleBoostIsBounded.spec.ts`, which REDs if the boosted title ever grows
 * past the size the layout reserves.
 *
 * ⛔⛔ AND THAT MARGIN WAS SPENT ON 16 SEP 2026, WHICH IS WHY THIS MODULE NOW
 * UNDOES ONE LIMB OF LOD RATHER THAN ONLY THE SCALE.
 *
 * `LOD_BLANKED_BODY_STYLE` made the blanked card body COLLAPSE to one line
 * instead of keeping its full height under `visibility: hidden` — correctly, and
 * at the founder's request: cards were rendering ~370px tall carrying two lines
 * of text. But it turned the LOD term from a 16 px rounding into a **430 px**
 * one, MEASURED by `heightVsZoom.measure.ts` at this branch's tip:
 *
 *   worst per-card LOD delta   16 px  ->  430 px      against 45 px of sub-row slack
 *
 * ⚠ AND THE "IT CANNOT OVERLAP ANYTHING" ARGUMENT FOR IT WAS FALSE, in the same
 * paragraph that stated it: it read *"below `LABEL_LEGIBLE_ZOOM` the reservation
 * is unused by construction, so releasing it cannot overlap anything"*, which
 * holds ONLY if the layout ran at a zoom where the body was visible. **It is the
 * DEFAULT that it did not** — three of the five shipped starters lay out 3080
 * units wide and fit at 0.4935 closed / ~0.35 open, both BELOW 0.5, so a layout
 * run on a freshly-opened board reserves the COLLAPSED height, and the first
 * time the reader zooms in past the legibility floor every card grows by up to
 * 430 px into the row beneath it. The paragraph carried its own refutation two
 * sentences further down.
 *
 * ⭐ SO THE FIX IS NOT TO REVERT THE COLLAPSE AND NOT TO WIDEN A THRESHOLD. It is
 * that this module's CONTRACT — "the height this card has at the label bound" —
 * was never satisfied for that limb. The bound is the scale at
 * `LABEL_LEGIBLE_ZOOM`, a zoom at which the body is VISIBLE AND FULL HEIGHT.
 * Measuring a collapsed body and calling the answer "the height at the bound" is
 * not an approximation of the contract; it is a different number.
 *
 * ⭐ AND IT IS NEUTRALISABLE FOR EXACTLY THE REASON THE SCALE IS. The collapse is
 * a CSS effect on an element the writer MARKS (`LOD_BLANKED_BODY_ATTR`), and the
 * blanked children stay MOUNTED — `visibility: hidden` hides them, it does not
 * unmount them — so releasing the wrapper's height re-measures the real body
 * synchronously, inside the same no-paint window as the scale pin. What stays
 * un-neutralisable is only the genuinely React-gated LOD content, which is the
 * ±16 px this module already named and which is what the 45 px slack is for.
 *
 * ⚠ WHY A DOM READ AND NOT ARITHMETIC. Height is not linear in the scale — only
 * the text runs scale, and how many LINES a title wraps to is a step function of
 * the font size. There is no closed form from `h(zoom)` to `h(bound)`; the
 * browser is the only oracle. The read is synchronous and no paint can occur
 * inside it: set the property, read `offsetHeight` (which forces layout),
 * restore the property, all without yielding to the event loop.
 *
 * ⚠ WHY IT MAY RETURN AN EMPTY MAP, AND WHY THAT IS NOT A FAILURE. jsdom has no
 * layout; a headless/SSR context has no React Flow root; and COMPARISON MODE
 * unmounts the main canvas entirely. Callers must treat an absent entry as "no
 * better information than `measured.height`" and fall through — never as zero.
 * A missing key must NEVER become a height.
 *
 * ⚠ AND THAT SAFETY IS WEAKER THAN IT LOOKS, WHICH IS WHY ROOT SELECTION IS
 * LOAD-BEARING: `getNodeDimensions` PREFERS a supplied bound over
 * `measured.height`, so "fall through" only protects against a MISSING id. An
 * id that is present and wrong — a mini-map's height under the real node's id —
 * is taken. Absence is safe; a wrong instance is not.
 */
import {
  CANVAS_FAR_TITLE_SCALE_VAR,
  CANVAS_LABEL_SCALE_VAR,
  CANVAS_LABEL_SCALE_MARKER_SELECTOR,
  LOD_BLANKED_BODY_SELECTOR,
  LOD_FAR_TITLE_SELECTOR,
  MAX_LABEL_COUNTER_SCALE,
  MAX_NORMAL_RUNG_LABEL_SCALE,
  NODE_RUNG_PADDING_ATTR,
} from './zoomLegibility'

/**
 * Rendered height, in model px, of every mounted canvas node, measured with the
 * label counter-scale pinned to `MAX_LABEL_COUNTER_SCALE`.
 *
 * Returns an EMPTY map where there is nothing to measure (no DOM, no React Flow
 * root, no mounted nodes). Never throws: a layout that cannot be improved must
 * still run.
 */
const PADDING_SIDES = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const
type PaddingBox = Partial<Record<(typeof PADDING_SIDES)[number], string>>
interface RungPadding { landing: PaddingBox; normal: PaddingBox }

function parseRungPadding(raw: string | null): RungPadding | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as Partial<RungPadding>
    return v && typeof v.landing === 'object' && typeof v.normal === 'object' ? (v as RungPadding) : null
  } catch {
    return null
  }
}

function applyPadding(card: HTMLElement, box: PaddingBox): void {
  for (const side of PADDING_SIDES) {
    const value = box[side]
    if (typeof value === 'string') card.style[side] = value
  }
}

export function measureNodeHeightsAtLabelBound(): Map<string, number> {
  const out = new Map<string, number>()
  if (typeof document === 'undefined') return out

  // ⭐⭐ UP FROM THE SYNC'S OWN MARKER — NEVER `document.querySelector('.react-flow')`.
  //
  // That is the exact form this module's partner bans BY NAME
  // (`CanvasLabelScaleSync`: *"never `document.querySelector`, which would reach
  // the Compare-tab mini-maps"*), and here the harm is worse than a stray style
  // write. `ReactFlowGraph` renders comparison mode as a TERNARY, so while it is
  // on the main canvas is UNMOUNTED and the only roots on the page are two
  // `<MiniCanvas>` instances rendering THE SAME node ids, un-re-keyed. A
  // document-rooted lookup would return a mini-map's heights under the real
  // nodes' ids — and `getNodeDimensions` PREFERS a supplied bound, so this
  // module's "absent ⇒ fall through" safety would never engage: the ids are
  // present and wrong. Probed: one root → `{n1:300, n2:280}`; two roots →
  // `{n1:90, n2:84}`, the first root's.
  //
  // Asking the marker degrades to the DESIGNED inert path instead: no main
  // canvas, no marker, no root, empty map, `measured.height` as before. The
  // selector is DERIVED from the constant the marker itself is rendered with, so
  // the writer and this reader cannot drift on which instance they mean.
  const marker = document.querySelector(CANVAS_LABEL_SCALE_MARKER_SELECTOR)
  if (marker === null) return out
  const root = marker.closest('.react-flow') as HTMLElement | null
  if (root === null) return out

  const nodes = root.querySelectorAll('.react-flow__node[data-id]')
  if (nodes.length === 0) return out

  // Restore EXACTLY what was there, including "no inline value at all".
  // `CanvasLabelScaleSync` writes this property in an effect keyed on the
  // quantised scale, so it will not re-write it unless the zoom moves — leaving
  // a value behind would silently mis-size every later render.
  const previous = root.style.getPropertyValue(CANVAS_LABEL_SCALE_VAR)

  /**
   * ⭐ THE SECOND THING PINNED TO THE BOUND: the LOD body collapse, RELEASED.
   *
   * At the label bound the body is visible and at full height (see the header),
   * so the height this module owes its caller is the UNCOLLAPSED one. `auto`
   * rather than a stored literal because the whole point is to let the mounted
   * children state their own height — the collapsed value is a one-line
   * constant and re-deriving it here would be a third copy of it.
   *
   * ⚠ RESTORED INDIVIDUALLY, INCLUDING "no inline height at all". React owns
   * this inline style and will not re-write it unless `lodBodyBlanked` flips, so
   * a value left behind would silently un-collapse a card until the next rung
   * change — the same failure mode as leaving the scale property behind.
   */
  const blanked = root.querySelectorAll(LOD_BLANKED_BODY_SELECTOR)
  const previousBodyHeights: string[] = []
  // S5 (24 Sep): the collapse is a MAX-height now (a short body is never made
  // taller by blanking it), so the release lifts that cap too; `height` is still
  // released for any caller that sets it inline.
  const previousBodyMaxHeights: string[] = []
  const paddedCards: Array<HTMLElement | null> = []
  const previousPadding: Array<string[] | null> = []
  const rungPadding: Array<RungPadding | null> = []

  // ⭐ v3.1 WS1 #25: a far-rung title is clamped at its own far scale; at the
  // bound it is an ordinary, unclamped title at `MAX_LABEL_COUNTER_SCALE`.
  const farTitles = root.querySelectorAll(LOD_FAR_TITLE_SELECTOR)
  const previousFarTitleStyles: Array<[string, string, string]> = []
  const previousFarScale = root.style.getPropertyValue(CANVAS_FAR_TITLE_SCALE_VAR)

  try {
    root.style.setProperty(CANVAS_LABEL_SCALE_VAR, String(MAX_LABEL_COUNTER_SCALE))
    root.style.setProperty(CANVAS_FAR_TITLE_SCALE_VAR, String(MAX_LABEL_COUNTER_SCALE))
    for (const el of farTitles) {
      const e = el as HTMLElement
      previousFarTitleStyles.push([e.style.display, e.style.getPropertyValue('-webkit-line-clamp'), e.style.overflow])
      e.style.display = 'block'
      e.style.setProperty('-webkit-line-clamp', 'unset')
      e.style.overflow = 'visible'
    }
    for (const el of blanked) {
      const e = el as HTMLElement
      previousBodyHeights.push(e.style.height)
      previousBodyMaxHeights.push(e.style.maxHeight)
      e.style.height = 'auto'
      e.style.maxHeight = 'none'
    }
    // ⭐ EACH RUNG AT ITS OWN BOUND (24 Sep, bounded anatomy). A card that
    // declares its padding per rung (`NODE_RUNG_PADDING_ATTR`, written by
    // `BaseNode`) is read TWICE: at `MAX_LABEL_COUNTER_SCALE` with its LANDING
    // padding, and at `MAX_NORMAL_RUNG_LABEL_SCALE` with its NORMAL padding; the
    // reservation is the larger. Before this the card was read with whatever
    // padding the LIVE rung had — and the landing layout runs at xyflow's mount
    // zoom (Normal), so every card reserved the Normal band at scale 2, a state
    // no zoom ever draws (Normal never reaches scale 2).
    for (const el of nodes) {
      const e = el as HTMLElement
      const card = e.querySelector<HTMLElement>(`[${NODE_RUNG_PADDING_ATTR}]`)
      const rungs = card ? parseRungPadding(card.getAttribute(NODE_RUNG_PADDING_ATTR)) : null
      if (card && rungs) {
        paddedCards.push(card)
        previousPadding.push(PADDING_SIDES.map(side => card.style[side]))
        rungPadding.push(rungs)
        applyPadding(card, rungs.landing)
      } else {
        paddedCards.push(null)
        previousPadding.push(null)
        rungPadding.push(null)
      }
    }
    for (const el of nodes) {
      const e = el as HTMLElement
      const id = e.dataset.id
      // `offsetHeight` forces synchronous layout, which is the point: it is what
      // makes the values above take effect before the read.
      const h = e.offsetHeight
      if (id !== undefined && id !== '' && h > 0) out.set(id, h)
    }
    if (rungPadding.some(r => r !== null)) {
      root.style.setProperty(CANVAS_LABEL_SCALE_VAR, String(MAX_NORMAL_RUNG_LABEL_SCALE))
      nodes.forEach((_, i) => { const r = rungPadding[i]; if (r) applyPadding(paddedCards[i]!, r.normal) })
      nodes.forEach((el, i) => {
        if (rungPadding[i] === null) return
        const e = el as HTMLElement
        const id = e.dataset.id
        const h = e.offsetHeight
        if (id !== undefined && id !== '' && h > (out.get(id) ?? 0)) out.set(id, h)
      })
    }
  } finally {
    // Padding first, index-paired like the body restore below and bounded by
    // what was RECORDED: a card never touched is never "restored".
    for (let i = 0; i < previousPadding.length; i++) {
      const was = previousPadding[i]
      const card = paddedCards[i]
      if (!was || !card) continue
      PADDING_SIDES.forEach((side, j) => { card.style[side] = was[j] })
    }
    if (previous === '') root.style.removeProperty(CANVAS_LABEL_SCALE_VAR)
    else root.style.setProperty(CANVAS_LABEL_SCALE_VAR, previous)
    if (previousFarScale === '') root.style.removeProperty(CANVAS_FAR_TITLE_SCALE_VAR)
    else root.style.setProperty(CANVAS_FAR_TITLE_SCALE_VAR, previousFarScale)
    for (let i = 0; i < previousFarTitleStyles.length; i++) {
      const e = farTitles[i] as HTMLElement
      const [display, clamp, overflow] = previousFarTitleStyles[i]!
      e.style.display = display
      if (clamp === '') e.style.removeProperty('-webkit-line-clamp')
      else e.style.setProperty('-webkit-line-clamp', clamp)
      e.style.overflow = overflow
    }
    // Index-paired with the NodeList above, which is static (`querySelectorAll`),
    // so the pairing cannot be disturbed by anything the read did.
    //
    // ⚠ BOUNDED BY WHAT WAS RECORDED, NOT BY THE NODE LIST. If the loop above
    // threw part-way, the elements past that point were never touched — and
    // "restoring" one of those by removing its height would UN-COLLAPSE a card
    // permanently, turning a failed measurement into a live rendering defect.
    for (let i = 0; i < previousBodyHeights.length; i++) {
      const e = blanked[i] as HTMLElement
      const was = previousBodyHeights[i]
      if (was === '') e.style.removeProperty('height')
      else e.style.height = was
      const wasMax = previousBodyMaxHeights[i]
      if (wasMax === '') e.style.removeProperty('max-height')
      else e.style.maxHeight = wasMax
    }
  }

  return out
}
