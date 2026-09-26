/**
 * ⭐⭐ THE LANDING TEXT SCALE — the board fits like the prototype (canvas/landing-text-scale,
 * 26 Sep 2026; design audit §2 items 2, 9, 10, 15).
 *
 * SERVED EVIDENCE (`e34db126`, deploy 6ab81d55, audit harness `landing.mjs` + `z100.mjs`,
 * fail-closed guard, no chat turns, 5 saved examples × 1280×800 dock open and 1440×900):
 *   - every landing at zoom 0.5 with `--canvas-label-scale` = 2, titles 14px on screen,
 *     wrapping to 2–4 lines on a 130px card;
 *   - boards 1938–2281 world px tall; the Goal off-screen in 10/10 landings;
 *   - tier gaps at ~100%: pricing 187/368/216/264 (prototype 60/38/35/36) — each gap is the
 *     card's 2× landing height minus its 100% height, because the layout reserves every card
 *     at `MAX_LABEL_COUNTER_SCALE`.
 *
 * THE MECHANISM: `labelCounterScale` held rendered === declared down to the landing floor, so
 * its ceiling was `1 / LABEL_LEGIBLE_ZOOM` = 2, and that ceiling is also the height the layout
 * reserves. This spec pins the lowered ceiling, derived from the 11px landing title floor, and
 * that render and layout still read ONE bound.
 *
 * ⚠ jsdom has no text metrics: the on-screen sizes below are the module's own arithmetic
 * (`renderedLabelPx`), which is the honest claim available here. The browser numbers live in
 * the PR's measure table (`/private/tmp/canvas-textscale-work/MEASURE.md`).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CANVAS_TYPE_PX } from '../../styles/typography'
import {
  CANVAS_LABEL_SCALE_MARKER_TESTID,
  CANVAS_LABEL_SCALE_VAR,
  LABEL_LEGIBLE_ZOOM,
  LOD_BODY_HIDDEN_ZOOM,
  MAX_LABEL_COUNTER_SCALE,
  MAX_NORMAL_RUNG_LABEL_SCALE,
  labelCounterScale,
  renderedLabelPx,
  resolveLodRung,
} from '../utils/zoomLegibility'
import { measureNodeHeightsAtLabelBound } from '../utils/measureNodeHeightsAtLabelBound'
import {
  NODE_TITLE_MIN_MEASURE_PX,
  NODE_TITLE_RECLAIMED_PX,
  NODE_TITLE_WIDEST_WORD_PX,
} from '../utils/nodeLayoutConstants'

/** The brief's landing title floor, in on-screen CSS px. */
const LANDING_TITLE_FLOOR = 11
/** `CanvasLabelScaleSync` writes the scale on a two-decimal grid, rounded UP. */
const onSyncGrid = (s: number) => Math.ceil(s * 100) / 100

describe('the counter-scale ceiling is the 11px landing title floor, on the sync grid', () => {
  it('the ceiling is 1.58 — ceil(11 / (14 × 0.5), 0.01) — not the old 1 / LABEL_LEGIBLE_ZOOM = 2', () => {
    expect(MAX_LABEL_COUNTER_SCALE).toBe(1.58)
    expect(MAX_LABEL_COUNTER_SCALE).toBe(
      onSyncGrid(LANDING_TITLE_FLOOR / (CANVAS_TYPE_PX.nodeTitle * LABEL_LEGIBLE_ZOOM)),
    )
  })

  it('a landing title renders 11.06px on screen — at the floor, not the served 14px', () => {
    const px = renderedLabelPx(CANVAS_TYPE_PX.nodeTitle, LABEL_LEGIBLE_ZOOM)
    expect(px).toBeGreaterThanOrEqual(LANDING_TITLE_FLOOR)
    expect(px).toBeCloseTo(11.06, 10)
  })

  it('from 1 / ceiling (≈0.633) up to 1:1 text still renders at its DECLARED size — only the landing band changes', () => {
    for (const z of [0.64, 0.7, 0.8, 0.9, 1]) {
      expect(renderedLabelPx(CANVAS_TYPE_PX.nodeTitle, z)).toBeCloseTo(CANVAS_TYPE_PX.nodeTitle, 10)
    }
  })
})

describe('render and layout read ONE bound', () => {
  it('no zoom renders a label scale above the height the layout reserves', () => {
    for (let z = 0.05; z <= 2; z += 0.01) {
      expect(labelCounterScale(z)).toBeLessThanOrEqual(MAX_LABEL_COUNTER_SCALE)
    }
    expect(labelCounterScale(LABEL_LEGIBLE_ZOOM)).toBe(MAX_LABEL_COUNTER_SCALE)
  })

  it('the LIVE scale the sync writes at the landing equals the reserved scale exactly (no rounding past the bound)', () => {
    expect(onSyncGrid(labelCounterScale(LABEL_LEGIBLE_ZOOM))).toBe(MAX_LABEL_COUNTER_SCALE)
  })

  it('the Normal rung reserves at the same ceiling (landing counts as Normal)', () => {
    expect(MAX_NORMAL_RUNG_LABEL_SCALE).toBe(MAX_LABEL_COUNTER_SCALE)
  })

  it('the title measure is sized at the same ceiling', () => {
    expect(NODE_TITLE_MIN_MEASURE_PX).toBe(NODE_TITLE_WIDEST_WORD_PX * 1.58 + NODE_TITLE_RECLAIMED_PX)
  })
})

describe('layout heights are read at the landing ceiling', () => {
  beforeEach(() => { document.body.innerHTML = '' })
  afterEach(() => { document.body.innerHTML = '' })

  it('measureNodeHeightsAtLabelBound reads every card with --canvas-label-scale = "1.58"', () => {
    const root = document.createElement('div')
    root.className = 'react-flow'
    const marker = document.createElement('span')
    marker.dataset.testid = CANVAS_LABEL_SCALE_MARKER_TESTID
    root.appendChild(marker)
    const seen: string[] = []
    // Served ids and served landing heights (world px) from the pricing-model starter.
    for (const [id, h] of [['opt_hybrid', 500.2], ['goal_pricing_transition', 190]] as const) {
      const el = document.createElement('div')
      el.className = 'react-flow__node'
      el.dataset.id = id
      Object.defineProperty(el, 'offsetHeight', {
        get() { seen.push(root.style.getPropertyValue(CANVAS_LABEL_SCALE_VAR)); return h },
      })
      root.appendChild(el)
    }
    document.body.appendChild(root)

    const out = measureNodeHeightsAtLabelBound()

    expect(seen).toEqual(['1.58', '1.58'])
    expect(out.get('opt_hybrid')).toBe(500.2)
    expect(out.get('goal_pricing_transition')).toBe(190)
  })
})

describe('the landing stays on the Normal rung — the body cliff does NOT move with the ceiling', () => {
  it('a product landing at LABEL_LEGIBLE_ZOOM is `full`, and one toolbar step below it still shows the body', () => {
    expect(resolveLodRung(LABEL_LEGIBLE_ZOOM)).toBe('full')
    expect(resolveLodRung(LABEL_LEGIBLE_ZOOM / 1.2)).not.toBe('line')
  })

  it('the cliff keeps its value exactly: 10 / (12 / 0.5) = 0.41667', () => {
    expect(LOD_BODY_HIDDEN_ZOOM).toBe(10 / 24)
    expect(LOD_BODY_HIDDEN_ZOOM).toBeLessThan(LABEL_LEGIBLE_ZOOM)
  })
})
