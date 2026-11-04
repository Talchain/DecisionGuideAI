/**
 * The core lane's landing camera (live olumi-core-v3, 4 Nov: a real model opened cut off on the left). The product fit frames the model
 * by the same two steps as `useFitViewOnLayoutVersion`'s fitNow: anchored to the top when the fit would clamp at its floor, else centred
 * in the free pane. Fixture: core's european golden (22 cards, a real drafted model), twice, placed by core's own layout, on a 1280 × 900 canvas
 * with the dock on the right.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../client'
import { cardPlaces, CARD_WIDTH, questionPlace } from '../layout'
import { CORE_LANE_FIT_FLOOR, productFitFloor } from '../camera'
import { paddingToInsets, topAnchoredViewportWhenClamped } from '../../canvas/utils/cameraComfort'
import { viewportCentredInFreePane } from '../../canvas/utils/fitIntoFreePane'
import { LABEL_LEGIBLE_ZOOM } from '../../canvas/utils/zoomLegibility'

const model = (JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'european.view.json'), 'utf8')) as View).model!
const places = cardPlaces(model), q = questionPlace(model)
const one = [{ x: q.x, y: q.y, w: q.width, h: 85 }, ...model.cards.map((c) => ({ ...places.get(c.id)!, w: CARD_WIDTH, h: c.h }))]
// A board larger than the canvas holds at 0.5: the european model, and the same again below it (44 cards).
const tall = Math.max(...one.map((b) => b.y + b.h)) + 40
const boxes = [...one, ...one.map((b) => ({ ...b, y: b.y + tall }))]
const x0 = Math.min(...boxes.map((b) => b.x)), y0 = Math.min(...boxes.map((b) => b.y))
const bounds = { x: x0, y: y0, width: Math.max(...boxes.map((b) => b.x + b.w)) - x0, height: Math.max(...boxes.map((b) => b.y + b.h)) - y0 }
const pane = { width: 1280, height: 900 }
const padding = { top: '72px', right: '384px', bottom: '24px', left: '72px' } as never
// fitNow's two steps, with the floor it is given.
const landing = (floor: number) => topAnchoredViewportWhenClamped(bounds, pane.width, pane.height, paddingToInsets(padding), floor)
  ?? viewportCentredInFreePane({ bounds, pane, padding, minZoom: Math.min(LABEL_LEGIBLE_ZOOM, floor), maxZoom: LABEL_LEGIBLE_ZOOM })
/** Every card and the question inside the canvas left of the dock. */
const whole = (v: { x: number; y: number; zoom: number }) => boxes.every((b) => {
  const l = b.x * v.zoom + v.x, t = b.y * v.zoom + v.y
  return l >= 0 && t >= 0 && l + b.w * v.zoom <= pane.width - 384 && t + b.h * v.zoom <= pane.height
})

describe('the core lane frames the whole of core\'s model at landing', () => {
  it('a board too large for the legibility floor (two 22-card models) is cropped at 0.5, and whole at the lane\'s floor', () => {
    expect(boxes.length).toBe(46)
    expect(whole(landing(LABEL_LEGIBLE_ZOOM)), 'precondition: at 0.5 it is cut off').toBe(false)
    expect(whole(landing(productFitFloor(true, LABEL_LEGIBLE_ZOOM)))).toBe(true)
  })
  it('must not change: every other lane keeps the legibility floor; the lane never raises it', () => {
    expect(productFitFloor(false, LABEL_LEGIBLE_ZOOM)).toBe(LABEL_LEGIBLE_ZOOM)
    expect(productFitFloor(true, LABEL_LEGIBLE_ZOOM)).toBe(CORE_LANE_FIT_FLOOR)
    expect(productFitFloor(true, 0.1)).toBe(0.1)
  })
})
