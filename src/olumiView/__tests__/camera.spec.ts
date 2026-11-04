/**
 * The core lane's landing camera (live olumi-core-v3, 4 Nov: a real model opened cut off on the left). The product fit frames the model
 * by the same two steps as `useFitViewOnLayoutVersion`'s fitNow: anchored to the top when the fit would clamp at its floor, else centred
 * in the free pane. Fixture: core's european golden (22 cards, a real drafted model), twice, placed as the canvas places it (DGAI's causal layout), on a 1280 × 900 canvas
 * with the dock on the right.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../client'
import { causalPlaces, CARD_WIDTH, QUESTION, questionPlace } from '../layout'
import { CORE_LANE_FIT_FLOOR, productFitFloor, READABLE_WHOLE_ZOOM, readableFirstViewport } from '../camera'
import { paddingToInsets, topAnchoredViewportWhenClamped } from '../../canvas/utils/cameraComfort'
import { viewportCentredInFreePane } from '../../canvas/utils/fitIntoFreePane'
import { LABEL_LEGIBLE_ZOOM } from '../../canvas/utils/zoomLegibility'

const model = (JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'european.view.json'), 'utf8')) as View).model!
const q = questionPlace(model), places = await causalPlaces(model, new Map(), q.width)
const one = [{ ...places.get(QUESTION)!, w: q.width, h: 85 }, ...model.cards.map((c) => ({ ...places.get(c.id)!, w: CARD_WIDTH, h: c.h }))]
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

describe('readable first, whole when it fits (DL 4 Nov: whole at 0.272 was tall, narrow and unreadable)', () => {
  const insets = paddingToInsets(padding)
  const rect = (bs: typeof one) => { const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y))
    return { x, y, width: Math.max(...bs.map((b) => b.x + b.w)) - x, height: Math.max(...bs.map((b) => b.y + b.h)) - y } }
  it('a board that fits whole only below 0.5 is framed by its width, top-aligned: the question and every column\'s first card in view', () => {
    const v = readableFirstViewport(rect(boxes), pane, insets)!
    expect(v).not.toBeNull()
    expect(v.zoom).toBeGreaterThanOrEqual(READABLE_WHOLE_ZOOM)
    expect(v.zoom).toBeLessThanOrEqual(1)
    const top = [one[0]!, ...[...new Set(model.cards.map((c) => c.col))].map((col) => { const c = model.cards.find((k) => k.col === col)!; return { ...places.get(c.id)!, w: CARD_WIDTH, h: c.h } })]
    for (const b of top) {
      const l = b.x * v.zoom + v.x, t = b.y * v.zoom + v.y
      expect(l >= insets.left - 1 && l + b.w * v.zoom <= pane.width - insets.right + 1 && t >= insets.top - 1 && t + b.h * v.zoom <= pane.height, JSON.stringify(b)).toBe(true)
    }
  })
  it('must not change: a board that fits whole at 0.5 or more is the product\'s own whole fit (null here)', () => {
    expect(readableFirstViewport(rect(one), pane, insets)).toBeNull()
  })
})
