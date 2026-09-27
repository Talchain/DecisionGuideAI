/**
 * ⭐⭐ THE LANDING TEXT SCALE — the board fits like the prototype (canvas/landing-text-scale,
 * 26–27 Sep 2026; design audit §2 items 2, 9, 10, 15).
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
 * reserves. This spec pins the lowered TEXT ceiling (1.39, chosen by measurement, never under the
 * brief's 9.5px landing title floor), that text render and text layout still read ONE bound, and
 * that GLYPHS and TARGETS keep the old uncapped bound (WCAG 2.5.8's 24px at the landing).
 *
 * ⚠ jsdom has no text metrics: the on-screen sizes below are the module's own arithmetic
 * (`renderedLabelPx`), which is the honest claim available here. The browser numbers live in
 * #2137's measure table (harness `/private/tmp/canvas-r1-witness/`).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CANVAS_TYPE_PX } from '../../styles/typography'
import {
  CANVAS_GLYPH_SCALE_VAR,
  CANVAS_LABEL_SCALE_MARKER_TESTID,
  CANVAS_LABEL_SCALE_VAR,
  LABEL_COUNTER_SCALE_CAP,
  LABEL_LEGIBLE_ZOOM,
  LABEL_SCALE_QUANTUM,
  LANDING_TITLE_FLOOR_PX,
  LOD_BODY_HIDDEN_ZOOM,
  MAX_GLYPH_COUNTER_SCALE,
  MAX_LABEL_COUNTER_SCALE,
  MAX_NORMAL_RUNG_LABEL_SCALE,
  glyphCounterScale,
  labelCounterScale,
  renderedGlyphPx,
  renderedLabelPx,
  resolveLodRung,
} from '../utils/zoomLegibility'
import { measureNodeHeightsAtLabelBound } from '../utils/measureNodeHeightsAtLabelBound'
import {
  NODE_TITLE_MIN_MEASURE_PX,
  NODE_TITLE_RECLAIMED_PX,
  NODE_TITLE_WIDEST_WORD_PX,
} from '../utils/nodeLayoutConstants'
import {
  CANVAS_QUICK_ACTION_BOX_PX,
  CANVAS_QUICK_ACTION_SLOP_PX,
  MIN_TARGET_RENDERED_PX,
  NODE_QUICK_ACTION_BAND_PX,
  CANVAS_QUICK_ACTION_INSET_PX,
} from '../nodes/shared/canvasGlyphScale'

/** The brief's landing title floor (27 Sep 2026), in on-screen CSS px. */
const LANDING_TITLE_FLOOR = 9.5
/** `CanvasLabelScaleSync` writes the scale on a two-decimal grid, rounded UP. */
const onSyncGrid = (s: number) => Math.ceil(s * 100) / 100

describe('the TEXT ceiling is 1.39 — measured, on the sync grid, never under the 9.5px landing title floor', () => {
  it('the ceiling is 1.39, not the old 1 / LABEL_LEGIBLE_ZOOM = 2 (nor the first cut\'s 1.58)', () => {
    expect(MAX_LABEL_COUNTER_SCALE).toBe(1.39)
    expect(LABEL_COUNTER_SCALE_CAP).toBe(1.39)
  })

  it('it sits ON the sync grid, so the live scale at the landing is exactly the reserved one', () => {
    expect(LABEL_SCALE_QUANTUM).toBe(100)
    expect(onSyncGrid(LABEL_COUNTER_SCALE_CAP)).toBe(LABEL_COUNTER_SCALE_CAP)
    expect(onSyncGrid(labelCounterScale(LABEL_LEGIBLE_ZOOM))).toBe(MAX_LABEL_COUNTER_SCALE)
  })

  it('a landing title renders 9.73px — at or above the 9.5px floor, and the floor is the brief\'s', () => {
    expect(LANDING_TITLE_FLOOR_PX).toBe(LANDING_TITLE_FLOOR)
    const px = renderedLabelPx(CANVAS_TYPE_PX.nodeTitle, LABEL_LEGIBLE_ZOOM)
    expect(px).toBeGreaterThanOrEqual(LANDING_TITLE_FLOOR)
    expect(px).toBeCloseTo(9.73, 10)
    // CONTRAST: the floor discriminates — it admits 1.36 (9.52px) but not 1.35 (9.45px).
    // 1.39 is the measured choice above it (Goal 4/5 at 1280×800 for 1.36–1.39, 3/5 at 1.40).
    expect(renderedLabelPx(CANVAS_TYPE_PX.nodeTitle, LABEL_LEGIBLE_ZOOM) * (1.35 / 1.39)).toBeLessThan(LANDING_TITLE_FLOOR)
  })

  it('from 1 / ceiling (≈0.72) up to 1:1 text still renders at its DECLARED size — only the landing band changes', () => {
    for (const z of [0.72, 0.8, 0.9, 1]) {
      expect(renderedLabelPx(CANVAS_TYPE_PX.nodeTitle, z)).toBeCloseTo(CANVAS_TYPE_PX.nodeTitle, 10)
    }
  })
})

describe('GLYPHS and TARGETS keep the uncapped bound — the text ceiling does not shrink what a user must hit', () => {
  it('the glyph scale is 1 / zoom down to the landing floor, so its bound is still 2', () => {
    expect(MAX_GLYPH_COUNTER_SCALE).toBe(1 / LABEL_LEGIBLE_ZOOM)
    expect(glyphCounterScale(LABEL_LEGIBLE_ZOOM)).toBe(2)
    expect(glyphCounterScale(0.6)).toBeCloseTo(1 / 0.6, 10)
  })

  it('a quick-action target (box + slop) renders >= 24px at the landing — WCAG 2.2 AA 2.5.8', () => {
    const rendered = renderedGlyphPx(CANVAS_QUICK_ACTION_BOX_PX + 2 * CANVAS_QUICK_ACTION_SLOP_PX, LABEL_LEGIBLE_ZOOM)
    expect(rendered).toBeGreaterThanOrEqual(MIN_TARGET_RENDERED_PX)
    // CONTRAST: on the TEXT scale (the first cut) the same target was 22.91px — short.
    expect(renderedLabelPx(CANVAS_QUICK_ACTION_BOX_PX + 2 * CANVAS_QUICK_ACTION_SLOP_PX, LABEL_LEGIBLE_ZOOM)).toBeLessThan(MIN_TARGET_RENDERED_PX)
  })

  it('the quick-action band the layout reserves is sized at the GLYPH bound', () => {
    expect(NODE_QUICK_ACTION_BAND_PX).toBe(
      CANVAS_QUICK_ACTION_INSET_PX + (CANVAS_QUICK_ACTION_BOX_PX + CANVAS_QUICK_ACTION_SLOP_PX) * MAX_GLYPH_COUNTER_SCALE,
    )
  })
})

describe('TEXT render and TEXT layout read ONE bound', () => {
  it('no zoom renders a text scale above the height the layout reserves', () => {
    for (let z = 0.05; z <= 2; z += 0.01) {
      expect(labelCounterScale(z)).toBeLessThanOrEqual(MAX_LABEL_COUNTER_SCALE)
      expect(glyphCounterScale(z)).toBeLessThanOrEqual(MAX_GLYPH_COUNTER_SCALE)
    }
    expect(labelCounterScale(LABEL_LEGIBLE_ZOOM)).toBe(MAX_LABEL_COUNTER_SCALE)
  })

  it('the Normal rung reserves at the same ceiling (landing counts as Normal)', () => {
    expect(MAX_NORMAL_RUNG_LABEL_SCALE).toBe(MAX_LABEL_COUNTER_SCALE)
  })

  it('the title measure is sized at the same ceiling', () => {
    expect(NODE_TITLE_MIN_MEASURE_PX).toBe(NODE_TITLE_WIDEST_WORD_PX * 1.39 + NODE_TITLE_RECLAIMED_PX)
  })
})

describe('layout heights are read at BOTH bounds', () => {
  beforeEach(() => { document.body.innerHTML = '' })
  afterEach(() => { document.body.innerHTML = '' })

  it('measureNodeHeightsAtLabelBound reads every card with --canvas-label-scale = "1.39" and --canvas-glyph-scale = "2", then restores both', () => {
    const root = document.createElement('div')
    root.className = 'react-flow'
    root.style.setProperty(CANVAS_GLYPH_SCALE_VAR, '1.23')
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
        get() {
          seen.push(`${root.style.getPropertyValue(CANVAS_LABEL_SCALE_VAR)}|${root.style.getPropertyValue(CANVAS_GLYPH_SCALE_VAR)}`)
          return h
        },
      })
      root.appendChild(el)
    }
    document.body.appendChild(root)

    const out = measureNodeHeightsAtLabelBound()

    expect(seen).toEqual(['1.39|2', '1.39|2'])
    expect(out.get('opt_hybrid')).toBe(500.2)
    expect(out.get('goal_pricing_transition')).toBe(190)
    // Restored exactly: the label scale was unset, the glyph scale was 1.23.
    expect(root.style.getPropertyValue(CANVAS_LABEL_SCALE_VAR)).toBe('')
    expect(root.style.getPropertyValue(CANVAS_GLYPH_SCALE_VAR)).toBe('1.23')
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
