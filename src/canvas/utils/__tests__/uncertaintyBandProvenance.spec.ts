/**
 * THE UNCERTAINTY RIBBON MAY ONLY SPEAK FOR A STATED UNCERTAINTY.
 *
 * ⭐ WHY THIS EXISTS. `strengthStd` is carried on 79/79 edges of the measured
 * census, stored, user-editable (`useInspectorMutations.ts:791`) and rendered in
 * the inspector (`EdgeInspector.tsx:511`, `EdgePanel.tsx:253`) — and until this
 * change it reached the BOARD nowhere at all. A team read every causal claim on
 * the graph at equal confidence, with the firm ones and the guesses drawn
 * identically. That is the "we build more than we plug in" failure with the
 * finish line's own words on it: *better-understood uncertainty*.
 *
 * ⛔ AND THE TRAP THAT COMES WITH PLUGGING IT IN. `USER_EDGE_DEFAULTS` writes
 * `strengthStd: 0.15` with NO source stamp, so every hand-drawn edge carries a
 * fabricated uncertainty. `EdgeDataSchema`'s own docblock records that
 * `KeyRelationships` once rendered exactly that default as a "Moderate
 * confidence" dot. A ribbon read off the raw field would repeat that defect on
 * a far louder channel — a mark stretched along the whole edge, read
 * pre-attentively, on the surface the product is named for.
 *
 * So the binding asserted here is not "the number is drawn correctly". It is
 * that the FABRICATED DEFAULT CANNOT REACH THE RIBBON AT ALL, by the shape of
 * the signature rather than by the diligence of a caller.
 */
import { describe, it, expect } from 'vitest'
import {
  uncertaintyBandHalfWidth,
  UNCERTAINTY_BAND_SCALE,
  UNCERTAINTY_BAND_MIN_HALF_WIDTH,
  UNCERTAINTY_BAND_MAX_HALF_WIDTH,
  EDGE_STROKE_WIDTH_BANDS,
} from '../graphDisplayCalculations'
import { USER_EDGE_DEFAULTS } from '../../domain/edges'
import { resolveEdgeValueDisplay } from '../../domain/edgeValueProvenance'
import { LABEL_LEGIBLE_ZOOM } from '../zoomLegibility'

/** DPR 2, named rather than assumed — the sibling stroke-band spec's convention. */
const DEVICE_PIXEL_RATIO = 2
const devicePx = (graphUnits: number) => graphUnits * LABEL_LEGIBLE_ZOOM * DEVICE_PIXEL_RATIO

describe('the ribbon refuses a number nobody stated', () => {
  it('draws nothing when no source proves anyone set the uncertainty', () => {
    expect(uncertaintyBandHalfWidth({ show: false, reason: 'not_set' })).toBeNull()
  })

  it('draws nothing when there is no uncertainty on the edge at all', () => {
    expect(uncertaintyBandHalfWidth({ show: false, reason: 'absent' })).toBeNull()
  })

  /**
   * ⭐ THE LOAD-BEARING CASE, bound to the REAL default object rather than to a
   * literal `0.15` — so if `USER_EDGE_DEFAULTS` changes its number this test
   * still asks the question it was written to ask. It goes through the SAME
   * read gate the component uses; nothing here is a hand-built display.
   */
  it('draws nothing for a user-drawn edge carrying the unstamped UI default', () => {
    const display = resolveEdgeValueDisplay(
      { ...USER_EDGE_DEFAULTS } as Record<string, unknown>,
      'strengthStd',
    )
    expect(display.show).toBe(false)
    expect(uncertaintyBandHalfWidth(display)).toBeNull()
  })

  /** Contrast control: the same edge WITH a stamp must draw, or the test above
   *  is proving only that the probe is blind. */
  it('draws once a source stamps that same value', () => {
    const display = resolveEdgeValueDisplay(
      { ...USER_EDGE_DEFAULTS, strengthStdSource: 'user' } as Record<string, unknown>,
      'strengthStd',
    )
    expect(display.show).toBe(true)
    expect(uncertaintyBandHalfWidth(display)).toBeGreaterThan(0)
  })

  /** A standard deviation cannot be negative; `EDGE_VALUE_DOMAINS.strengthStd`
   *  is declared OPEN, so the read gate does not catch this one. */
  it('draws nothing for a negative spread', () => {
    expect(uncertaintyBandHalfWidth({ show: true, value: -0.2, source: 'cee' })).toBeNull()
  })
})

describe('the ribbon carries information across the measured census', () => {
  // The 79-edge census measured `strengthStd` spanning 0.01 to 0.22.
  const CENSUS_MIN = 0.01
  const CENSUS_MAX = 0.22
  const at = (value: number) => uncertaintyBandHalfWidth({ show: true, value, source: 'cee' })!

  it('separates the tightest and widest measured edges by more than a device pixel', () => {
    expect(devicePx(at(CENSUS_MAX) - at(CENSUS_MIN))).toBeGreaterThan(1)
  })

  it('is monotonic — more doubt is never drawn tighter', () => {
    const steps = [0.02, 0.05, 0.1, 0.15, 0.2, 0.25]
    for (let i = 1; i < steps.length; i++) {
      expect(at(steps[i])).toBeGreaterThanOrEqual(at(steps[i - 1]))
    }
  })

  /**
   * ⛔ THE HONEST LIMIT, PINNED SO IT CANNOT BE FORGOTTEN RATHER THAN HIDDEN.
   * Below the floor every stated uncertainty draws the same width. The trade is
   * deliberate: a sub-pixel ribbon would make "tight" pixel-identical to
   * "nobody said", which is the collision `UNSET_EDGE_STROKE_WIDTH` was widened
   * to fix on the neighbouring channel. Presence answers *did anyone say?*;
   * width answers *how much?*, and only above this point.
   */
  it('compresses below the floor, and the floor is where the doc says it is', () => {
    const floorTop = UNCERTAINTY_BAND_MIN_HALF_WIDTH / UNCERTAINTY_BAND_SCALE
    expect(at(floorTop / 2)).toBe(UNCERTAINTY_BAND_MIN_HALF_WIDTH)
    expect(at(floorTop * 2)).toBeGreaterThan(UNCERTAINTY_BAND_MIN_HALF_WIDTH)
  })

  it('clamps a pathological spread rather than painting over the model', () => {
    expect(at(99)).toBe(UNCERTAINTY_BAND_MAX_HALF_WIDTH)
  })
})

describe('the floor is DERIVED from the stroke ladder, not chosen beside it', () => {
  /**
   * ⭐ PINS THE RELATIONSHIP, NOT THE NUMBER (the sibling spec's rule). The
   * ribbon must clear the thickest line the width channel can draw, so it
   * always reads as spread AROUND the line and never as the line having got
   * fatter — the two would then be one confused channel. Widening
   * `EDGE_STROKE_WIDTH_BANDS` must carry the floor with it; a literal here
   * would have gone quietly wrong the next time those bands moved, which they
   * already have once.
   */
  it('always clears the widest stroke band', () => {
    const widestStrokeHalfWidth = Math.max(...Object.values(EDGE_STROKE_WIDTH_BANDS)) / 2
    expect(UNCERTAINTY_BAND_MIN_HALF_WIDTH).toBeGreaterThan(widestStrokeHalfWidth)
  })

  it('leaves the ceiling above the floor, so the channel has a range at all', () => {
    expect(UNCERTAINTY_BAND_MAX_HALF_WIDTH).toBeGreaterThan(UNCERTAINTY_BAND_MIN_HALF_WIDTH)
  })
})
