/**
 * ⭐⭐ S4 LAPTOP FIT — THE ARITHMETIC, THROUGH THE PRODUCT'S OWN FUNCTIONS.
 *
 * Experience Design, #63 5806207128 / 5806266691 (24 Sep 2026): "At 1280×800
 * with the Olumi/right dock open, the initial fit-to-model view must show the
 * entire graph inside the usable canvas at or above the existing legibility
 * floor … Also capture 1440×900 as the second witness." And: "That served
 * comparison, not the candidate arithmetic alone, proves the fit." So this file
 * is the CANDIDATE ARITHMETIC — the served screenshots are still owed.
 *
 * ## What is real here, and what is not
 * - LAYOUT: the real `layoutGraph` (ELK included) on the five shipped starters
 *   and a synthetic 6-factor / 3-option / 2-outcome / 2-risk model shaped like
 *   an OpenAI draft.
 * - PROMPTS: the real `withGhostTiers` placing the row-end prompts on the
 *   laid-out board, framed by the real `fitFrameNodes`.
 * - INSETS: the real `computeFitPadding`, reading chrome rects at the measured
 *   geometry (FIT-DIAGNOSIS-20260924 §1: sidebar 48 wide at x 12, top bar bottom
 *   57, dock `responsiveDockWidth` at `right: 12`, overlay band 64 at bottom 12).
 * - CAMERA: the hook's two exits, called directly — `topAnchoredViewportWhenClamped`
 *   when the fit clamps, else xyflow's `getViewportForBounds`, which is what
 *   `fitView` runs, under `fitBoundsFor('product')`.
 * - HEIGHTS: MEASURED AT THE S5 GEOMETRY (24 Sep): the landing-rung heights the
 *   layout now reserves (`starter-node-heights.browser-capture-2026-09-24-s5.json`
 *   — S3 anatomy, S4 widths, S5 stacked rows + rail only at Normal zoom), read
 *   in Chromium at the counter-scale bound. The pane was hidden, so the rung
 *   and scale were SET, not reached by a camera; the served screenshots are
 *   still the witness. (S4 ran on the 23 Sep PRE-S3 capture.) The HEIGHT
 *   ALLOWANCE — the tallest uniform card each board can carry and still fit —
 *   is still reported beside the verdicts.
 */
import { describe, it, expect, afterEach, afterAll, vi } from 'vitest'
import { getNodesBounds, getViewportForBounds, type Node, type Edge } from '@xyflow/react'
import { layoutGraph } from '../utils/layout'
import { withGhostTiers } from '../utils/ghostTiers'
import { fitFrameNodes, isGhostNode } from '../utils/fitTargets'
import { computeFitPadding, DOCK_SELECTOR, SIDEBAR_SELECTOR, TOP_BAR_SELECTOR, OVERLAY_BAND_SELECTOR } from '../utils/computeFitPadding'
import { paddingToInsets, topAnchoredViewportWhenClamped } from '../utils/cameraComfort'
import { LABEL_LEGIBLE_ZOOM, fitBoundsFor } from '../utils/zoomLegibility'
import { responsiveDockWidth } from '../components/dockWidth'
import { OVERLAY_BAND_HEIGHT, OVERLAY_BAND_BOTTOM } from '../components/CanvasOverlayBand'
import {
  LAYOUT_NODE_GAP,
  LAYOUT_PADDING_X,
  MAX_CARDS_PER_ROW,
  REPEATED_CARD_W,
  ROW_PROMPT_H,
  ROW_PROMPT_W,
} from '../utils/nodeLayoutConstants'
import capture from './__fixtures__/starter-node-heights.browser-capture-2026-09-24-s5.json'
import vendorSelection from '../starters/data/vendor-selection.draft.json'
import marketEntry from '../starters/data/market-entry.draft.json'
import buildVsBuy from '../starters/data/build-vs-buy.draft.json'
import headcountAllocation from '../starters/data/headcount-allocation.draft.json'
import pricingModel from '../starters/data/pricing-model.draft.json'

type Draft = { nodes: Array<{ id: string; kind: string; label: string }>; edges: Array<{ from?: string; to?: string; source?: string; target?: string }> }
const STARTERS: Record<string, Draft> = {
  'vendor-selection': vendorSelection as unknown as Draft,
  'market-entry': marketEntry as unknown as Draft,
  'build-vs-buy': buildVsBuy as unknown as Draft,
  'headcount-allocation': headcountAllocation as unknown as Draft,
  'pricing-model': pricingModel as unknown as Draft,
}
const HEIGHTS = (capture as { heights: Record<string, Record<string, number>> }).heights

/** Per-kind median of the capture — the synthetic model's heights, derived, not typed. */
function medianHeightByKind(): Record<string, number> {
  const byKind: Record<string, number[]> = {}
  for (const [starter, draft] of Object.entries(STARTERS)) {
    for (const n of draft.nodes) {
      const h = HEIGHTS[starter]?.[n.id]
      if (typeof h === 'number') (byKind[n.kind] ??= []).push(h)
    }
  }
  const out: Record<string, number> = {}
  for (const [kind, hs] of Object.entries(byKind)) {
    const s = [...hs].sort((a, b) => a - b)
    out[kind] = s[Math.floor(s.length / 2)]
  }
  return out
}

/** The synthetic OpenAI-shaped draft: 1 decision, 3 options, 6 factors, 2 outcomes, 2 risks, 1 goal. */
function openAiShaped(): Draft {
  const nodes: Draft['nodes'] = [{ id: 'dec', kind: 'decision', label: 'Which pricing model should we launch with?' }]
  const edges: Draft['edges'] = []
  for (let i = 0; i < 3; i++) {
    nodes.push({ id: `opt_${i}`, kind: 'option', label: `Option ${i}` })
    edges.push({ from: 'dec', to: `opt_${i}` })
  }
  for (let i = 0; i < 6; i++) {
    nodes.push({ id: `fac_${i}`, kind: 'factor', label: `Factor ${i}` })
    for (let o = 0; o < 3; o++) edges.push({ from: `opt_${o}`, to: `fac_${i}` })
  }
  for (const k of ['outcome', 'risk'] as const) {
    for (let i = 0; i < 2; i++) {
      nodes.push({ id: `${k}_${i}`, kind: k, label: `${k} ${i}` })
      for (let f = 0; f < 6; f++) edges.push({ from: `fac_${f}`, to: `${k}_${i}` })
      edges.push({ from: `${k}_${i}`, to: 'goal' })
    }
  }
  nodes.push({ id: 'goal', kind: 'goal', label: 'Grow revenue' })
  return { nodes, edges }
}

const MODELS: Array<{ id: string; draft: Draft; heightOf: (id: string, kind: string) => number }> = [
  ...Object.entries(STARTERS).map(([id, draft]) => ({
    id,
    draft,
    heightOf: (nid: string) => HEIGHTS[id][nid],
  })),
  (() => {
    const med = medianHeightByKind()
    return { id: 'openai-6F3O2Out2Risk', draft: openAiShaped(), heightOf: (_: string, kind: string) => med[kind] }
  })(),
]

function buildGraph(draft: Draft, heightOf: (id: string, kind: string) => number, uniformH?: number): { nodes: Node[]; edges: Edge[] } {
  const nodes = draft.nodes.map((n) => ({
    id: n.id,
    type: n.kind,
    position: { x: 0, y: 0 },
    data: { label: n.label, kind: n.kind },
    measured: { width: REPEATED_CARD_W, height: uniformH ?? heightOf(n.id, n.kind) },
  })) as unknown as Node[]
  const edges = draft.edges.map((e, i) => ({
    id: `e${i}`,
    source: (e.from ?? e.source) as string,
    target: (e.to ?? e.target) as string,
  })) as Edge[]
  return { nodes, edges }
}

/** The board as the camera frames it: laid-out cards at their drawn width, plus the row-end prompts. */
async function framedBoard(draft: Draft, heightOf: (id: string, kind: string) => number, uniformH?: number) {
  const { nodes, edges } = buildGraph(draft, heightOf, uniformH)
  const out = await layoutGraph(nodes, edges, {})
  const drawn = out.nodes.map((n) => ({
    ...n,
    measured: { width: out.layoutCardWidths[n.type as string], height: (n as { measured: { height: number } }).measured.height },
  })) as Node[]
  const withPrompts = withGhostTiers(drawn).map((n) =>
    isGhostNode(n.id) ? ({ ...n, measured: { width: ROW_PROMPT_W, height: ROW_PROMPT_H } } as Node) : n,
  )
  const framed = fitFrameNodes(withPrompts)
  // `seen` is everything a user sees at landing — every card AND every prompt —
  // read independently of what the fit chose to frame, so "inside the frame"
  // cannot be satisfied by a fit that simply left the prompts out.
  return { framed, bounds: getNodesBounds(framed), seen: getNodesBounds(withPrompts), layout: out }
}

// ── The chrome, at the measured geometry, read through the real computeFitPadding ──
const VIEWPORTS = [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1440x900', width: 1440, height: 900 },
] as const

function rect(r: { left: number; top: number; right: number; bottom: number }): HTMLElement {
  const full = { ...r, x: r.left, y: r.top, width: r.right - r.left, height: r.bottom - r.top, toJSON: () => ({}) }
  return { getBoundingClientRect: () => full } as unknown as HTMLElement
}

function chromeAt(vp: { width: number; height: number }) {
  const W = vp.width
  const H = vp.height
  const dockW = responsiveDockWidth(W)
  const pane = rect({ left: 0, top: 0, right: W, bottom: H })
  const map: Record<string, HTMLElement> = {
    // The contract's FLUSH panel (26 Sep 2026): right edge 0, from the 51px top
    // bar to the viewport bottom — measured on the local build at 1280x800 as
    // (961, 51, 319×749). It was a floating card at `right: 12`, 12px down.
    [DOCK_SELECTOR]: rect({ left: W - dockW, top: 51, right: W, bottom: H }),
    [SIDEBAR_SELECTOR]: rect({ left: 12, top: 300, right: 60, bottom: 491 }),
    [TOP_BAR_SELECTOR]: rect({ left: 12, top: 12, right: W - 12, bottom: 57 }),
    [OVERLAY_BAND_SELECTOR]: rect({ left: 0, top: H - OVERLAY_BAND_BOTTOM - OVERLAY_BAND_HEIGHT, right: W, bottom: H - OVERLAY_BAND_BOTTOM }),
    '.react-flow': pane,
  }
  vi.spyOn(document, 'querySelector').mockImplementation((sel: string) => (map[sel] ?? null) as Element | null)
  const padding = computeFitPadding(pane as unknown as Element)
  return { padding, insets: paddingToInsets(padding), W, H }
}

afterEach(() => {
  vi.restoreAllMocks()
})

/** The landing camera: the hook's clamped exit, else what `fitView` computes. */
type Box = { x: number; y: number; width: number; height: number }
function landing(bounds: Box, vp: { width: number; height: number }, seen: Box = bounds) {
  const { padding, insets, W, H } = chromeAt(vp)
  const anchored = topAnchoredViewportWhenClamped(bounds, W, H, insets, LABEL_LEGIBLE_ZOOM)
  const { minZoom, maxZoom } = fitBoundsFor('product')
  const v = anchored ?? getViewportForBounds(bounds, W, H, minZoom!, maxZoom!, padding)
  const frame = { left: insets.left, top: insets.top, right: W - insets.right, bottom: H - insets.bottom }
  const screen = {
    left: v.x + seen.x * v.zoom,
    top: v.y + seen.y * v.zoom,
    right: v.x + (seen.x + seen.width) * v.zoom,
    bottom: v.y + (seen.y + seen.height) * v.zoom,
  }
  // xyflow floors its padding to whole px; allow that one pixel and no more.
  const inside =
    screen.left >= frame.left - 1 && screen.top >= frame.top - 1 &&
    screen.right <= frame.right + 1 && screen.bottom <= frame.bottom + 1
  const frameW = frame.right - frame.left
  const frameH = frame.bottom - frame.top
  return {
    zoom: v.zoom,
    clamped: anchored !== null,
    inside,
    /** Screen x of the family-label column: `TierLanes` puts it at the board's
     *  leftmost card edge, which is the framed box's left edge (a prompt only
     *  ever stands at a row's END). */
    labelColumnX: screen.left,
    insets,
    frameFlowAtFloor: { w: frameW / LABEL_LEGIBLE_ZOOM, h: frameH / LABEL_LEGIBLE_ZOOM },
    zoomToFit: Math.min(frameW / bounds.width, frameH / bounds.height),
  }
}

/** The widest row the layout can build, visible edge to visible edge, prompt included. */
const WIDEST_ROW_WITH_PROMPT =
  MAX_CARDS_PER_ROW * (REPEATED_CARD_W + LAYOUT_PADDING_X + LAYOUT_NODE_GAP) + ROW_PROMPT_W

describe('S4 laptop fit — the chrome the fit subtracts (verify and keep)', () => {
  // ⚠ RE-PINNED 26 Sep 2026 — the design contract's flush 319px panel. The
  // right inset was 444 (a 416 card at `right: 12`, + the 16px gap); it is now
  // 319 + 16 = 335. The other three sides are unchanged, and so is every
  // landing-camera arm below: the frame widens by 109px and the fit still
  // parks at the 0.5 floor (measured: landing zoom 0.5 on all five starters at
  // both sizes, before and after).
  it('the insets are 76 / 335 / 73 / 92 at 1280x800 with the dock open', () => {
    expect(chromeAt(VIEWPORTS[0]).insets).toEqual({ left: 76, right: 335, top: 73, bottom: 92 })
  })
  it('…and the same at 1440x900 (the dock is 319 at both widths)', () => {
    expect(chromeAt(VIEWPORTS[1]).insets).toEqual({ left: 76, right: 335, top: 73, bottom: 92 })
  })
})

describe('S4 laptop fit — WIDTH, which this lane owns exactly', () => {
  it.each(MODELS.map((m) => [m.id, m] as const))('%s: no framed row is wider than the widest row the layout builds (cards and a prompt)', async (_id, m) => {
    const { bounds } = await framedBoard(m.draft, m.heightOf)
    expect(bounds.width).toBeLessThanOrEqual(WIDEST_ROW_WITH_PROMPT)
  })

  // ⭐ GAP 7 (ED #63 5808428246: 1280x800 with the dock open is the ACCEPTANCE
  // size). Until the row cap moved to four, this arm was the stated gap: every
  // starter framed 1740 units against the 1520 frame, a 220-unit (110px) spill.
  it.each(MODELS.map((m) => [m.id, m] as const))('%s: at 1280x800, dock open, the board fits the frame on WIDTH at the floor', async (_id, m) => {
    const { bounds } = await framedBoard(m.draft, m.heightOf)
    const { frameFlowAtFloor } = landing(bounds, VIEWPORTS[0])
    expect(bounds.width).toBeLessThanOrEqual(frameFlowAtFloor.w)
  })

  it.each(MODELS.map((m) => [m.id, m] as const))('%s: at 1440x900, dock open, the board fits the frame on WIDTH at the floor', async (_id, m) => {
    const { bounds } = await framedBoard(m.draft, m.heightOf)
    const { frameFlowAtFloor } = landing(bounds, VIEWPORTS[1])
    expect(bounds.width).toBeLessThanOrEqual(frameFlowAtFloor.w)
  })

  // ⭐ FLIPPED BY GAP 7 (25 Sep 2026). This arm used to assert the spill as a
  // KNOWN gap — "a five-card row with its prompt is the one row that does not
  // fit on WIDTH, by exactly 220 units (110px)" — and named a row cap of four as
  // the smallest further lever. The Canvas lead took that lever (decide-and-flag,
  // on ED 5808428246), so the arm now asserts the fit, and keeps the five-card
  // arithmetic as the contrast that says why the cap is four and not five.
  it('at 1280x800 the widest row the layout can build — four cards and its prompt, 1424 units — fits on WIDTH at the floor', () => {
    const { frameFlowAtFloor } = landing({ x: 0, y: 0, width: 1, height: 1 }, VIEWPORTS[0])
    // RE-PINNED 26 Sep 2026 (flush 319px panel): the frame at the floor is
    // (1280 − 76 − 335) / 0.5 = 1738 units; it was 1520 with the 416 card.
    expect(frameFlowAtFloor.w).toBe(1738)
    expect(WIDEST_ROW_WITH_PROMPT).toBe(1424)
    expect(WIDEST_ROW_WITH_PROMPT).toBeLessThanOrEqual(frameFlowAtFloor.w)
    // CONTRAST: one more card per row would still spill — now by 2 units, where
    // the 416 card made it 220. The row cap of four still holds at 1280, by a
    // hair; it is no longer the dock that decides it.
    const oneMoreCard = WIDEST_ROW_WITH_PROMPT + (REPEATED_CARD_W + LAYOUT_PADDING_X + LAYOUT_NODE_GAP)
    expect(oneMoreCard - frameFlowAtFloor.w).toBe(2)
  })
})

describe('S4 laptop fit — the landing camera never goes below the floor, and frames the whole board when it fits', () => {
  const report: string[] = []
  afterAll(() => {
    console.log(['[laptopFit] model | viewport | board WxH (flow) | zoom-to-fit | landing zoom | inside frame | label column', ...report].join('\n'))
  })

  for (const vp of VIEWPORTS) {
    it.each(MODELS.map((m) => [m.id, m] as const))(`%s @ ${vp.name}: landing zoom >= LABEL_LEGIBLE_ZOOM; inside the inset frame whenever it fits`, async (id, m) => {
      const { bounds, seen } = await framedBoard(m.draft, m.heightOf)
      const l = landing(bounds, vp, seen)
      report.push(`${id} | ${vp.name} | ${Math.round(bounds.width)}x${Math.round(bounds.height)} | ${l.zoomToFit.toFixed(3)} | ${l.zoom.toFixed(3)} | ${l.inside} | label column x ${Math.round(l.labelColumnX)}px`)
      expect(l.zoom).toBeGreaterThanOrEqual(LABEL_LEGIBLE_ZOOM)
      if (l.zoomToFit >= LABEL_LEGIBLE_ZOOM) {
        expect(l.clamped).toBe(false)
        expect(l.inside, `${id} fits at ${l.zoomToFit.toFixed(3)} but lands outside the frame`).toBe(true)
        // Item 5: the left label column sits inside the usable canvas — right of
        // the left-inset line, which is itself right of the toolbar (48 at x 12).
        expect(l.labelColumnX).toBeGreaterThanOrEqual(l.insets.left - 1)
      } else {
        // It does not fit legibly: the camera holds the floor (never lower), pinned to the top.
        expect(l.clamped).toBe(true)
        expect(l.zoom).toBe(LABEL_LEGIBLE_ZOOM)
      }
    })
  }
})

describe('S4 laptop fit — HEIGHT ALLOWANCE: the tallest uniform card each board can carry and still fit at the floor', () => {
  const report: string[] = []
  afterAll(() => {
    console.log(['[laptopFit] model | viewport | allowance (flow, per card) | measured tallest card', ...report].join('\n'))
  })

  for (const vp of VIEWPORTS) {
    it.each(MODELS.map((m) => [m.id, m] as const))(`%s @ ${vp.name}`, async (id, m) => {
      const fits = async (h: number) => {
        const { bounds } = await framedBoard(m.draft, m.heightOf, h)
        return landing(bounds, vp).zoomToFit >= LABEL_LEGIBLE_ZOOM
      }
      const { bounds } = await framedBoard(m.draft, m.heightOf)
      const widthBound = bounds.width > landing(bounds, vp).frameFlowAtFloor.w
      if (widthBound) {
        // A board wider than the frame cannot fit at ANY card height: the
        // allowance is empty, and the reason is width, not the cards.
        expect(await fits(40), `${id} is wider than the frame yet fits`).toBe(false)
        report.push(`${id} | ${vp.name} | none — width-bound (${Math.round(bounds.width)} > ${landing(bounds, vp).frameFlowAtFloor.w}) | -`)
        return
      }
      expect(await fits(40), `${id} is narrow enough yet cannot fit even 40-unit cards`).toBe(true)
      let lo = 40
      let hi = 600
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2)
        if (await fits(mid)) lo = mid
        else hi = mid
      }
      const tallest = Math.max(...m.draft.nodes.map((n) => m.heightOf(n.id, n.kind)))
      report.push(`${id} | ${vp.name} | ${lo} | ${tallest}`)
      // Monotone by construction: one unit more than the allowance does not fit.
      expect(await fits(lo + 1)).toBe(false)
      // ⭐ AND AT THE ALLOWANCE THE BOARD REALLY FITS — the non-vacuous arm of the
      // landing assertions above (no captured-height board fits, so there they
      // only ever take the clamped branch): unclamped, at or above the floor,
      // wholly inside the inset frame, with the family-label column right of
      // the left inset (item 5: never under the toolbar at landing).
      const board = await framedBoard(m.draft, m.heightOf, lo)
      const atAllowance = landing(board.bounds, vp, board.seen)
      expect(atAllowance.clamped).toBe(false)
      expect(atAllowance.zoom).toBeGreaterThanOrEqual(LABEL_LEGIBLE_ZOOM)
      expect(atAllowance.inside, `${id} @ ${vp.name}: fits at the allowance but lands outside the frame`).toBe(true)
      expect(atAllowance.labelColumnX).toBeGreaterThanOrEqual(atAllowance.insets.left - 1)
    })
  }
})
