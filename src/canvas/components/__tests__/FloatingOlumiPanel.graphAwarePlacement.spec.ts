/**
 * FIT-THEN-PLACE — the floating panel's DEFAULT placement is taken off the model.
 *
 * THE DEFECT THIS PINS (measured in real Chromium, 49 `elementFromPoint` probes
 * per cell, the five committed starter drafts, 1200-1600px): a user could not
 * click the Decision node of their own model. Decision-node hittable probes on
 * the as-shipped placement: 1200 → 0/49 · 1250 → 0/49 · 1300 → 14 · 1350 → 28 ·
 * 1400 → 42 · clear only at ≥1450. The panel is a FIXED-SIZE, FIXED-ORIGIN
 * window while the graph's fit box SCALES.
 *
 * ⚠ WHAT THIS SPEC CAN AND CANNOT SETTLE. jsdom cannot prove visibility or
 * hit-testing (CLAUDE.md trap 3), so the ACCEPTANCE evidence is the geometry
 * instrument `e2e/geometry/decisionNodeHittest.measure.ts`, run in real
 * Chromium. What this spec pins is the RULE the instrument measures the effect
 * of — as a pure function, at the exact geometry the browser produced.
 *
 * ⭐ THE FIXTURES ARE BROWSER CAPTURES, NOT NUMBERS FROM MY HEAD (trap 16-inverse:
 * a fixture you wrote yourself is not evidence about the product). Every rect
 * below was read with `getBoundingClientRect` from Chromium at the stated
 * viewport, seeding the committed starter draft through the product's own
 * `applyDraftResult` via `e2e/visual/harness.ts`, on 2026-08-19 at staging
 * `3f59325a`. The three cells are the worst measured (0/49), the reopen-path
 * cell the earlier brief wrongly believed was healthy (0/49), and a mid-table
 * cell.
 *
 * ⭐⭐ EVERY PLACEMENT TEST PINS ITS OWN PRECONDITION (trap 13b). Each asserts
 * FIRST that the pristine centred default really does bury the anchor at that
 * geometry. Without that, a fixture that stopped reproducing the collision would
 * leave the test passing while proving nothing — a guard agreeing with itself.
 */

import { describe, it, expect, vi } from 'vitest'

// FloatingOlumiPanel's transitive imports pull in supabase and the markdown
// renderer — stub both ahead of the import below (mirrors the clamp spec).
vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
  isSupabaseAvailable: () => false,
}))
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }))
vi.mock('../../utils/markdown', () => ({
  renderMarkdown: (s: string) => s,
  sanitiseMarkdown: (s: string) => s,
}))

import {
  clampPositionToViewport,
  graphAwareDefaultPosition,
  panelOccluderBox,
  readModelBoxes,
  type ModelBoxes,
} from '../FloatingOlumiPanel'
import { COMFORT_OCCLUSION_GAP, type Box } from '../../utils/cameraComfort'

const SIZE = { width: 400, height: 550 }
const MARGIN = 16
const SIDE_TAB_WIDTH = 36

const box = (l: number, t: number, r: number, b: number): Box => ({ left: l, top: t, right: r, bottom: b })

/** A captured cell: viewport, measured chrome insets, and the model's rects. */
interface Cell {
  name: string
  vw: number
  vh: number
  dockInset: number
  topInset: number
  anchor: Box
  nodes: Box[]
}

/* ── Browser captures (Chromium, 2026-08-19, staging 3f59325a) ────────────── */

/** pricing-model @1250x800 — 0/49 hittable probes as shipped. */
const PRICING_1250: Cell = {
  name: 'pricing-model @1250x800',
  vw: 1250,
  vh: 800,
  dockInset: 418,
  topInset: 57 + MARGIN,
  anchor: box(292, 125.5, 452, 210),
  nodes: [
    box(292, 125.5, 452, 210), // dec_pricing (the anchor)
    box(-72, 314, 88, 453.3),
    box(474, 314, 634, 428.3),
    box(110, 314, 270, 437.5),
    box(656, 314, 816, 425),
    box(292, 314, 452, 428.3),
    box(292, 571.5, 452, 674.5),
    box(19, 209, 179, 356),
    box(201, 209, 361, 356),
    box(383, 209, 543, 383),
    box(565, 209, 725, 275),
    box(201, 411, 361, 481.3),
    box(383, 411, 542, 465),
    box(383, 489, 543, 559.3),
    box(201, 489, 361, 575.5),
    box(755, 209, 835, 259.5),
  ],
}

/** headcount-allocation @1440x900 — 0/49 on the reopen (design-default) path. */
const HEADCOUNT_1440: Cell = {
  name: 'headcount-allocation @1440x900',
  vw: 1440,
  vh: 900,
  dockInset: 428,
  topInset: 57 + MARGIN,
  anchor: box(453.1, 185.3, 618.9, 270.7),
  nodes: [
    box(453.1, 185.3, 618.9, 270.7), // dec_hiring (the anchor)
    box(641.7, 369.2, 807.4, 484.7),
    box(76, 369.2, 241.8, 493.7),
    box(264.6, 369.2, 430.3, 525.8),
    box(453.1, 369.2, 618.9, 452.6),
    box(830.2, 369.2, 996, 481.2),
    box(453.1, 641.7, 618.9, 714.6),
    box(170.3, 271.8, 336, 356.6),
    box(736, 271.8, 901.7, 356.6),
    box(358.8, 271.8, 524.6, 415.3),
    box(547.4, 271.8, 713.2, 338.5),
    box(547.4, 480, 692.3, 535.1),
    box(358.8, 480, 524.6, 551.4),
    box(453.1, 560.9, 618.9, 632.2),
    box(264.6, 560.9, 430.3, 632.2),
    box(641.7, 560.9, 807.4, 632.2),
    box(932.8, 271.8, 1015.7, 322.7),
  ],
}

/** vendor-selection @1200x800 — the anchor sits high; the cheapest clearance is
 *  a different side from the two cells above, so this cell discriminates the
 *  rule from a hard-coded direction. */
const VENDOR_1200: Cell = {
  name: 'vendor-selection @1200x800',
  vw: 1200,
  vh: 800,
  dockInset: 402,
  topInset: 57 + MARGIN,
  anchor: box(379.5, 74, 524.5, 161.7),
  nodes: [
    box(379.5, 74, 524.5, 161.7), // dec_cdp (the anchor)
    box(122.6, 257.7, 267.7, 373.8),
    box(465.1, 257.7, 610.1, 358.9),
    box(293.9, 257.7, 438.9, 406.3),
    box(122.6, 350.5, 267.7, 509.5),
    box(636.3, 257.7, 781.4, 395.6),
    box(636.3, 350.5, 781.4, 472.1),
    box(293.9, 350.5, 438.9, 501.2),
    box(465.1, 350.5, 610.1, 542.8),
    box(379.5, 663.2, 524.5, 774.3),
    box(293.9, 159, 438.9, 276.4),
    box(122.6, 159, 267.7, 276.4),
    box(465.1, 159, 610.1, 292.6),
    box(636.3, 159, 781.4, 263),
    box(293.9, 477.7, 438.9, 570.8),
    box(465.1, 477.7, 610.1, 570.8),
    box(208.2, 570.4, 353.3, 663.6),
    box(550.7, 570.4, 695.8, 663.6),
    box(379.5, 570.4, 524.5, 663.6),
    box(817.1, 159, 912.2, 199.4),
  ],
}

const CELLS = [PRICING_1250, HEADCOUNT_1440, VENDOR_1200]

/* ── Helpers that restate NOTHING from the implementation ─────────────────── */

function overlap(a: Box, b: Box): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  return w > 0 && h > 0 ? w * h : 0
}

/** The placement the panel used BEFORE this rule: the clamped centred default. */
function pristineCentredDefault(cell: Cell) {
  return clampPositionToViewport(
    {
      x: Math.max(MARGIN, Math.floor((cell.vw - cell.dockInset - SIZE.width) / 2)),
      y: Math.max(MARGIN, Math.floor((cell.vh - SIZE.height) / 2)),
    },
    SIZE,
    cell.vw,
    cell.vh,
    cell.dockInset,
    cell.topInset,
  )
}

const place = (cell: Cell, model: ModelBoxes) =>
  graphAwareDefaultPosition(SIZE, cell.vw, cell.vh, cell.dockInset, cell.topInset, model)

const modelOf = (cell: Cell): ModelBoxes => ({ nodes: cell.nodes, anchor: cell.anchor })

/* ── The rule ─────────────────────────────────────────────────────────────── */

describe('graphAwareDefaultPosition — the Decision node stays clickable', () => {
  for (const cell of CELLS) {
    it(`clears the Decision node at ${cell.name}`, () => {
      // PRECONDITION, PINNED IN-TEST: the placement this replaces really does
      // bury the anchor at this geometry. If a future fixture stops reproducing
      // the collision, this REDs rather than passing vacuously.
      const pristine = pristineCentredDefault(cell)
      expect(
        overlap(cell.anchor, panelOccluderBox(pristine, SIZE)),
        'PRECONDITION: the pristine centred default must bury the anchor at this cell',
      ).toBeGreaterThan(0)

      const placed = place(cell, modelOf(cell))
      expect(
        overlap(cell.anchor, panelOccluderBox(placed, SIZE)),
        'the placed panel must not cover ANY of the Decision node',
      ).toBe(0)
    })

    it(`keeps the placement inside the clamp bounds at ${cell.name}`, () => {
      const placed = place(cell, modelOf(cell))
      expect(
        clampPositionToViewport(placed, SIZE, cell.vw, cell.vh, cell.dockInset, cell.topInset),
        'the rule must never return a position the clamp would move',
      ).toEqual(placed)
      const occ = panelOccluderBox(placed, SIZE)
      expect(occ.left, 'side tab stays on screen').toBeGreaterThanOrEqual(MARGIN)
      expect(occ.top, 'panel stays below the top bar').toBeGreaterThanOrEqual(cell.topInset)
      expect(occ.right, 'panel stays clear of the dock').toBeLessThanOrEqual(cell.vw - cell.dockInset - MARGIN)
      expect(occ.bottom, 'panel stays on screen').toBeLessThanOrEqual(cell.vh - MARGIN)
    })

    it(`picks the LEXICOGRAPHIC minimum (anchor first, then model) at ${cell.name}`, () => {
      // Derive the candidate set independently — base plus the four clearance
      // translations — and assert the function chose the lexicographic minimum
      // over it. This binds the RULE, not a coordinate: a placement that happens
      // to clear the anchor but hides more of the model than a sibling candidate
      // fails here.
      const base = pristineCentredDefault(cell)
      const occ = panelOccluderBox(base, SIZE)
      // Clearances carry the canonical breathing gap — imported from its owner,
      // not restated here, so the two cannot drift.
      const g = COMFORT_OCCLUSION_GAP
      const moves = [
        { dx: cell.anchor.right - occ.left + g, dy: 0 },
        { dx: -(occ.right - cell.anchor.left + g), dy: 0 },
        { dx: 0, dy: cell.anchor.bottom - occ.top + g },
        { dx: 0, dy: -(occ.bottom - cell.anchor.top + g) },
      ]
      const candidates = [base, ...moves.map((m) =>
        clampPositionToViewport(
          { x: base.x + m.dx, y: base.y + m.dy },
          SIZE,
          cell.vw,
          cell.vh,
          cell.dockInset,
          cell.topInset,
        ),
      )]
      const score = (p: { x: number; y: number }) => {
        const b = panelOccluderBox(p, SIZE)
        return [overlap(cell.anchor, b), cell.nodes.reduce((a, n) => a + overlap(n, b), 0)] as const
      }
      const expected = candidates.reduce((best, p) => {
        const s = score(p)
        const bs = score(best)
        return s[0] < bs[0] || (s[0] === bs[0] && s[1] < bs[1]) ? p : best
      }, candidates[0])

      const placed = place(cell, modelOf(cell))
      expect(score(placed), `chosen placement must score the candidate minimum`).toEqual(score(expected))
    })
  }

  it('hides no more of the model than the placement it replaces, at every cell', () => {
    // The secondary objective, stated as a "does no harm" claim that CAN fail:
    // each cell's pristine default genuinely covers model area (asserted), so a
    // regression that traded model coverage for anchor clearance would show.
    for (const cell of CELLS) {
      const pristine = panelOccluderBox(pristineCentredDefault(cell), SIZE)
      const placed = panelOccluderBox(place(cell, modelOf(cell)), SIZE)
      const cover = (b: Box) => cell.nodes.reduce((a, n) => a + overlap(n, b), 0)
      expect(cover(pristine), `PRECONDITION: ${cell.name} pristine default covers model area`).toBeGreaterThan(0)
      expect(cover(placed), `${cell.name}: placed panel hides no more of the model`).toBeLessThanOrEqual(cover(pristine))
    }
  })
})

describe('graphAwareDefaultPosition — fail-open and fallbacks', () => {
  it('returns exactly the clamped centred default when nothing is rendered', () => {
    const cell = PRICING_1250
    expect(place(cell, { nodes: [], anchor: null })).toEqual(pristineCentredDefault(cell))
  })

  it('returns the base placement unchanged when the base already clears the anchor', () => {
    // A one-node model parked in the far corner: no clearance is needed, and the
    // rule must not move the panel "just in case".
    const cell = PRICING_1250
    const far = box(cell.vw - cell.dockInset - 60, cell.vh - 40, cell.vw - cell.dockInset - 10, cell.vh - 10)
    const base = pristineCentredDefault(cell)
    expect(overlap(far, panelOccluderBox(base, SIZE)), 'PRECONDITION: no overlap to solve').toBe(0)
    expect(place(cell, { nodes: [far], anchor: far })).toEqual(base)
  })

  it('takes a DEARER clearance when the cheapest one is clamped away', () => {
    // ⭐ WHY THE RULE READS ALL FOUR CLEARANCES AND NOT JUST `cheapestClearance`.
    // Constructed against 1200x800 with the measured dock/top insets so every
    // number below is a real bound: the panel has 52px of room upward, 109px
    // downward, 147px leftward, 183px rightward from its centred default.
    //
    // This anchor's CHEAPEST clearance is `top` at 60px — more than the 52px of
    // upward room — so the clamp swallows it and the anchor stays buried. The
    // `left` clearance costs twice as much (120px) and fits in the 147px
    // available. A rule that stopped at the cheapest candidate would ship the
    // defect here; the assertion is that this one does not.
    const cell: Cell = { ...PRICING_1250, name: 'clamp-blocked cheapest', vw: 1200, dockInset: 402 }
    const anchor = box(479, 615, 639, 700)
    const base = pristineCentredDefault(cell)
    expect(base, 'PRECONDITION: the constructed base placement').toEqual({ x: 199, y: 125 })

    const occ = panelOccluderBox(base, SIZE)
    expect(overlap(anchor, occ), 'PRECONDITION: the base placement buries this anchor').toBeGreaterThan(0)

    // PRECONDITION: the cheapest clearance really is `top`, and it really is
    // unreachable. Both halves matter — if either drifts, the case stops testing
    // what it says it tests.
    const cheapestTop = occ.bottom - anchor.top
    expect(cheapestTop, 'PRECONDITION: `top` is the cheapest clearance here').toBe(60)
    expect(
      Math.min(occ.right - anchor.left, anchor.right - occ.left, anchor.bottom - occ.top),
      'PRECONDITION: no other clearance is cheaper than `top`',
    ).toBeGreaterThan(cheapestTop)
    const afterCheapest = clampPositionToViewport(
      { x: base.x, y: base.y - (cheapestTop + COMFORT_OCCLUSION_GAP) },
      SIZE,
      cell.vw,
      cell.vh,
      cell.dockInset,
      cell.topInset,
    )
    expect(
      overlap(anchor, panelOccluderBox(afterCheapest, SIZE)),
      'PRECONDITION: the cheapest clearance is clamped away and leaves the anchor buried',
    ).toBeGreaterThan(0)

    const placed = place(cell, { nodes: [anchor], anchor })
    expect(overlap(anchor, panelOccluderBox(placed, SIZE)), 'a dearer, reachable clearance must be taken').toBe(0)
  })

  it('falls back to the whole model when the graph has no Decision node', () => {
    // An imported/partial graph has no anchor. The rule must still return a
    // legal placement and must still respond to the model rather than ignoring
    // it — proven by discrimination: two different models give two different
    // answers.
    const cell = PRICING_1250
    const leftHeavy = [box(60, 100, 500, 700)]
    const rightHeavy = [box(cell.vw - cell.dockInset - 460, 100, cell.vw - cell.dockInset - 20, 700)]
    const a = place(cell, { nodes: leftHeavy, anchor: null })
    const b = place(cell, { nodes: rightHeavy, anchor: null })
    expect(a, 'a no-anchor model must still steer the placement').not.toEqual(b)
    for (const p of [a, b]) {
      expect(clampPositionToViewport(p, SIZE, cell.vw, cell.vh, cell.dockInset, cell.topInset)).toEqual(p)
    }
  })
})

/* ── Identity binding ─────────────────────────────────────────────────────── */

describe('readModelBoxes binds the anchor by IDENTITY, never by position', () => {
  function mountNodes(specs: Array<{ id: string; rect: [number, number, number, number] }>): () => void {
    const host = document.createElement('div')
    for (const s of specs) {
      const el = document.createElement('div')
      el.className = 'react-flow__node'
      el.dataset.id = s.id
      const [left, top, right, bottom] = s.rect
      el.getBoundingClientRect = () =>
        ({ left, top, right, bottom, width: right - left, height: bottom - top, x: left, y: top, toJSON: () => ({}) }) as DOMRect
      host.appendChild(el)
    }
    document.body.appendChild(host)
    return () => host.remove()
  }

  const SPECS: Array<{ id: string; rect: [number, number, number, number] }> = [
    { id: 'dec_pricing', rect: [292, 125, 452, 210] },
    // A DIFFERENT node with the IDENTICAL rect. A rule that found the anchor by
    // geometry could not tell these apart; one that binds by id must.
    { id: 'opt_hybrid', rect: [292, 125, 452, 210] },
    { id: 'goal_pricing', rect: [292, 571, 452, 674] },
  ]

  it('returns the node whose data-id matches, and a DIFFERENT one for a different id', () => {
    const unmount = mountNodes(SPECS)
    try {
      const first = readModelBoxes('dec_pricing')
      const second = readModelBoxes('goal_pricing')
      expect(first.nodes, 'every rendered node is measured').toHaveLength(3)
      expect(first.anchor).toEqual(box(292, 125, 452, 210))
      // DISCRIMINATING PAIR: same DOM, different id, different anchor. Neither
      // reading alone proves the binding; the pair does (trap 19).
      expect(second.anchor).toEqual(box(292, 571, 452, 674))
      expect(second.anchor).not.toEqual(first.anchor)
    } finally {
      unmount()
    }
  })

  it('returns a null anchor for an id that is not on screen, and for no id at all', () => {
    const unmount = mountNodes(SPECS)
    try {
      expect(readModelBoxes('dec_not_rendered').anchor).toBeNull()
      expect(readModelBoxes(null).anchor).toBeNull()
      expect(readModelBoxes(null).nodes, 'nodes are still measured without an anchor').toHaveLength(3)
    } finally {
      unmount()
    }
  })

  it('drops zero-size rects so an unmeasured node cannot drag the model box to the origin', () => {
    const unmount = mountNodes([
      { id: 'dec_pricing', rect: [292, 125, 452, 210] },
      { id: 'not_yet_measured', rect: [0, 0, 0, 0] },
    ])
    try {
      const read = readModelBoxes('dec_pricing')
      expect(read.nodes).toHaveLength(1)
      expect(read.nodes[0]).toEqual(box(292, 125, 452, 210))
    } finally {
      unmount()
    }
  })
})

/* ── The occluder box ─────────────────────────────────────────────────────── */

describe('panelOccluderBox', () => {
  it('includes the side tab that sits OUTSIDE the panel’s left edge', () => {
    // The side tab is a sibling at `left: -SIDE_TAB_WIDTH` with the panel
    // `overflow: visible`, so it is not part of the panel's own rect. Omitting it
    // makes the occluder 36px narrower than what the user sees and can click.
    expect(panelOccluderBox({ x: 200, y: 100 }, SIZE)).toEqual({
      left: 200 - SIDE_TAB_WIDTH,
      top: 100,
      right: 600,
      bottom: 650,
    })
  })
})
