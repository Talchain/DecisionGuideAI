/**
 * The width channel must be READABLE AT THE ZOOM THE PRODUCT ITSELF CHOOSES.
 *
 * ⭐ WHY THIS TEST EXISTS, MEASURED RATHER THAN REASONED. Driven on the served
 * build (`b7c8c74e`, 1680x1050, own model, isolated context): the settled camera
 * transform was `scale(0.5)` — the graph is height-bound, so the fit clamps onto
 * `LABEL_LEGIBLE_ZOOM`. At that scale the three MEASURED bands rendered at
 * 0.75px / 1px / 1.5px and the DOM carried only two distinct widths across 14
 * edges. Paul's report was "why are all the connectors the same width"; they are
 * not the same, they are 0.25px apart, which is the same thing to an eye.
 *
 * ⛔ THE BANDS ARE NOT A TASTE CHOICE AND THIS TEST IS NOT A SNAPSHOT. It pins
 * the PROPERTY — adjacent bands separable at the product's own fit zoom — so the
 * numbers may move freely as long as the channel still carries information.
 * A snapshot of `{1.5, 2, 3}` would have been green all along.
 *
 * The threshold is one DEVICE pixel on a 2x display, i.e. 0.5 CSS px, at
 * `LABEL_LEGIBLE_ZOOM`. Both terms are IMPORTED, never restated (trap 12).
 */
import { describe, it, expect } from 'vitest'
import {
  EDGE_STROKE_WIDTH_BANDS,
  UNSET_EDGE_STROKE_WIDTH,
  MEASURED_EDGE_STROKE_WIDTH_FLOOR,
} from '../graphDisplayCalculations'
import { LABEL_LEGIBLE_ZOOM } from '../zoomLegibility'

/** One device pixel on a 2x display. */
const MIN_SEPARATION_CSS_PX = 0.5

describe('the width channel survives the zoom the product renders at', () => {
  it('PRECONDITION: the ladder is the unset floor followed by every measured band, ascending', () => {
    const measured = Object.values(EDGE_STROKE_WIDTH_BANDS).slice().sort((a, b) => a - b)
    expect(measured.length).toBeGreaterThanOrEqual(3)
    // the invariant this file must never break (8 Sep 2026)
    expect(UNSET_EDGE_STROKE_WIDTH).toBeLessThan(MEASURED_EDGE_STROKE_WIDTH_FLOOR)
  })

  it('every adjacent pair is separable by at least one device pixel at the fit zoom', () => {
    const ladder = [UNSET_EDGE_STROKE_WIDTH, ...Object.values(EDGE_STROKE_WIDTH_BANDS)]
      .slice()
      .sort((a, b) => a - b)
    const tooClose: string[] = []
    for (let i = 1; i < ladder.length; i++) {
      const onScreen = (ladder[i] - ladder[i - 1]) * LABEL_LEGIBLE_ZOOM
      if (onScreen < MIN_SEPARATION_CSS_PX) {
        tooClose.push(`${ladder[i - 1]}->${ladder[i]} = ${onScreen}px at zoom ${LABEL_LEGIBLE_ZOOM}`)
      }
    }
    expect(tooClose).toEqual([])
  })

  it('the thinnest MEASURED band still draws at a whole CSS pixel at the fit zoom', () => {
    expect(MEASURED_EDGE_STROKE_WIDTH_FLOOR * LABEL_LEGIBLE_ZOOM).toBeGreaterThanOrEqual(1)
  })
})
