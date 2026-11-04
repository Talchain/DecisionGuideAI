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

describe('readable first, whole when it fits (DL 4 Nov: whole at 0.272 unreadable; then "max(fit, 0.9), anchored at the top centre")', () => {
  const insets = paddingToInsets(padding)
  const rect = (bs: typeof one) => { const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y))
    return { x, y, width: Math.max(...bs.map((b) => b.x + b.w)) - x, height: Math.max(...bs.map((b) => b.y + b.h)) - y } }
  it('a board that fits across at 0.9 but not down opens at 0.9, its top under the canvas top and centred across the free canvas', () => {
    const freeW = pane.width - insets.left - insets.right, r = { x: 40, y: -10, width: freeW, height: 5000 }
    const v = readableFirstViewport(r, pane, insets)!
    expect(v.zoom).toBe(READABLE_WHOLE_ZOOM)
    expect((r.x + r.width / 2) * v.zoom + v.x).toBeCloseTo(insets.left + freeW / 2)
    expect(r.y * v.zoom + v.y).toBeCloseTo(insets.top)
  })
  it('DL 17Z (readable first wins): a board wider than the visible rect at 0.9 opens at 0.9, never lower, with the question and options wholly inside the visible rect (never behind the dock)', () => {
    const r = rect(boxes), freeW = pane.width - insets.left - insets.right
    const head = rect(one.slice(0, 1 + model.cards.filter((c) => c.family === 'option').length).length ? [one[0]!, ...one.slice(1).filter((_, i) => model.cards[i]!.family === 'option')] : [one[0]!])
    expect(r.width * READABLE_WHOLE_ZOOM, 'precondition: wider than the visible rect at 0.9').toBeGreaterThan(freeW)
    const v = readableFirstViewport(r, pane, insets, head)!
    expect(v.zoom).toBe(READABLE_WHOLE_ZOOM)
    const l = head.x * v.zoom + v.x, rt = (head.x + head.width) * v.zoom + v.x, t = head.y * v.zoom + v.y
    expect([l >= insets.left - 1, rt <= pane.width - insets.right + 1, t >= insets.top - 1], JSON.stringify({ l, rt, t })).toEqual([true, true, true])
  })
  it('a board that fits across at 0.9 but is too tall: every card across the visible rect (none under the dock), the head as near the centre as that allows', () => {
    const freeW = pane.width - insets.left - insets.right
    const r = { x: 0, y: 0, width: (freeW - 10) / READABLE_WHOLE_ZOOM, height: 5000 }, head = { x: r.width - 300, y: 0, width: 300, height: 100 }
    const v = readableFirstViewport(r, pane, insets, head)!
    expect(v.zoom).toBe(READABLE_WHOLE_ZOOM)
    expect([r.x * v.zoom + v.x >= insets.left - 0.01, (r.x + r.width) * v.zoom + v.x <= pane.width - insets.right + 0.01]).toEqual([true, true])
  })
  it('must not change: a board that fits whole at 0.9 or more is the product\'s own whole fit (null here)', () => {
    const small = [one[0]!, ...one.slice(1, 3)].map((b) => ({ ...b, x: b.x / 4, y: b.y / 4, w: b.w / 4, h: b.h / 4 }))
    expect(readableFirstViewport(rect(small), pane, insets)).toBeNull()
  })
})
