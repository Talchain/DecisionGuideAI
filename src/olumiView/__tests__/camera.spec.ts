/**
 * The core lane's landing camera (live olumi-core-v3, 4 Nov: a real model opened cut off on the left). The product fit frames the model
 * by the same two steps as `useFitViewOnLayoutVersion`'s fitNow: anchored to the top when the fit would clamp at its floor, else centred
 * in the free pane. Fixture: core's european golden as vendored at R5 (22 cards, a real drafted model; kept as fixtures/real/european-22cards.view3.json when the R17 vendor replaced the golden with a 17-card model), twice, placed as the canvas places it (DGAI's causal layout), on a 1280 × 900 canvas
 * with the dock on the right.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../client'
import { causalPlaces, CARD_WIDTH, QUESTION, questionPlace } from '../layout'
import { CORE_LANE_FIT_FLOOR, productFitFloor, READABLE_WHOLE_ZOOM, readableFirstViewport, WHOLE_FIT_ZOOM } from '../camera'
import { paddingToInsets, topAnchoredViewportWhenClamped } from '../../canvas/utils/cameraComfort'
import { viewportCentredInFreePane } from '../../canvas/utils/fitIntoFreePane'
import { LABEL_LEGIBLE_ZOOM } from '../../canvas/utils/zoomLegibility'

const model = (JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', 'european-22cards.view3.json'), 'utf8')) as View).model!
const q = questionPlace(model), places = await causalPlaces(model, new Map())
const one = [{ id: QUESTION, ...places.get(QUESTION)!, w: q.width, h: 85 }, ...model.cards.map((c) => ({ id: c.id, ...places.get(c.id)!, w: CARD_WIDTH, h: c.h }))]
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

describe('readable first, whole when it fits at the current floor', () => {
  const insets = paddingToInsets(padding)
  const rect = (bs: typeof one) => { const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y))
    return { x, y, width: Math.max(...bs.map((b) => b.x + b.w)) - x, height: Math.max(...bs.map((b) => b.y + b.h)) - y } }
  it('a board that fits across at the readable floor but not down opens at that floor, its top under the canvas top and centred across the free canvas', () => {
    const freeW = pane.width - insets.left - insets.right, r = { x: 40, y: -10, width: freeW, height: 5000 }
    const v = readableFirstViewport(r, pane, insets)!
    expect(v.zoom).toBe(READABLE_WHOLE_ZOOM)
    expect((r.x + r.width / 2) * v.zoom + v.x).toBeCloseTo(insets.left + freeW / 2)
    expect(r.y * v.zoom + v.y).toBeCloseTo(insets.top)
  })
  // UI restore stage 1 (DL ruling 10 Nov): a board too wide for the floor is drawn across its whole width (no card cut by the edge or under
  // the dock), never below the previous product's legibility floor; its top under the canvas top.
  it('a board wider than the visible rect at the readable floor is drawn across its whole width, top-aligned, never under the legibility floor', () => {
    const r = rect(boxes), freeW = pane.width - insets.left - insets.right
    expect(r.width * READABLE_WHOLE_ZOOM, 'precondition: wider than the visible rect at the floor').toBeGreaterThan(freeW)
    const v = readableFirstViewport(r, pane, insets)!
    expect(v.zoom).toBe(Math.max(LABEL_LEGIBLE_ZOOM, Math.min(READABLE_WHOLE_ZOOM, freeW / r.width)))
    expect(v.zoom, 'precondition: this board fits across above the legibility floor').toBeGreaterThan(LABEL_LEGIBLE_ZOOM)
    expect(r.x * v.zoom + v.x).toBeGreaterThanOrEqual(insets.left - 0.01)
    expect((r.x + r.width) * v.zoom + v.x).toBeLessThanOrEqual(insets.left + freeW + 0.01)
    expect(places.get(QUESTION)!.y * v.zoom + v.y, QUESTION).toBeCloseTo(insets.top)
  })
  it('a board that fits across at the readable floor but is too tall: every card across the visible rect (none under the dock), the head as near the centre as that allows', () => {
    const freeW = pane.width - insets.left - insets.right
    const r = { x: 0, y: 0, width: (freeW - 10) / READABLE_WHOLE_ZOOM, height: 5000 }, head = { x: r.width - 300, y: 0, width: 300, height: 100 }
    const v = readableFirstViewport(r, pane, insets, head)!
    expect(v.zoom).toBe(READABLE_WHOLE_ZOOM)
    expect([r.x * v.zoom + v.x >= insets.left - 0.01, (r.x + r.width) * v.zoom + v.x <= pane.width - insets.right + 0.01]).toEqual([true, true])
  })
  // UI restore stage 1 (DL ruling 10 Nov): four-card wrapping is retired; keep separation and a readable, top-aligned landing.
  it('four options stay below the question without overlaps; an oversized board is drawn across its width, between the two floors', async () => {
    const opts = model.cards.filter((c) => c.family === 'option'), src = opts[0]!
    const extra = { ...src, id: 'fourth_option', heading: 'A fourth option' }
    const links = model.links.flatMap((l) => (l.from === src.id ? [l, { ...l, from: extra.id }] : l.to === src.id ? [l, { ...l, to: extra.id }] : [l]))
    const four = { ...model, cards: [...model.cards, extra], links }
    const ids = [...opts.map((c) => c.id), extra.id]
    expect(ids.length, 'precondition: four options').toBe(4)
    const at = await causalPlaces(four, new Map()), qw = questionPlace(four).width
    const bs = [{ id: QUESTION, ...at.get(QUESTION)!, w: qw, h: 85 }, ...four.cards.map((c) => ({ id: c.id, ...at.get(c.id)!, w: CARD_WIDTH, h: c.h }))]
    const head = rect(bs.filter((b) => b.id === QUESTION || ids.includes(b.id)))
    const bounds = rect(bs), freeW = pane.width - insets.left - insets.right, freeH = pane.height - insets.top - insets.bottom
    expect(Math.min(freeW / bounds.width, freeH / bounds.height)).toBeLessThan(READABLE_WHOLE_ZOOM)
    const v = readableFirstViewport(bounds, pane, insets, head)!
    expect(v.zoom).toBe(Math.max(LABEL_LEGIBLE_ZOOM, Math.min(READABLE_WHOLE_ZOOM, freeW / bounds.width)))
    expect(at.get(QUESTION)!.y * v.zoom + v.y, QUESTION).toBeCloseTo(insets.top)
    for (const id of ids) expect(at.get(id)!.y, id).toBeGreaterThanOrEqual(at.get(QUESTION)!.y + 85)
    for (const a of bs) for (const b of bs) if (a.id < b.id) expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h, `${a.id} overlaps ${b.id}`).toBe(false)
  })
  it('CONTRAST: three options stay one row', async () => {
    const ids = model.cards.filter((c) => c.family === 'option').map((c) => c.id)
    expect(new Set(ids.map((id) => places.get(id)!.y)).size).toBe(1)
  })
  // UI restore stage 1 (DL ruling 10 Nov): use the current floor; whole at the boundary, top-aligned at the floor below it.
  it('a board fitting at or above the readable floor uses the whole fit; just below it is drawn across its width, top-aligned', () => {
    const freeW = pane.width - insets.left - insets.right, freeH = pane.height - insets.top - insets.bottom
    const at = (z: number) => ({ x: 40, y: -10, width: freeW / z, height: freeH / z })
    expect(WHOLE_FIT_ZOOM).toBe(READABLE_WHOLE_ZOOM)
    expect(readableFirstViewport(at(READABLE_WHOLE_ZOOM + 0.05), pane, insets)).toBeNull()
    expect(readableFirstViewport(at(READABLE_WHOLE_ZOOM), pane, insets)).toBeNull()
    // Just below: too wide and too tall for the floor, so it is drawn across its whole width (its own width fit), top-aligned.
    const bounds = at(READABLE_WHOLE_ZOOM - 0.05), v = readableFirstViewport(bounds, pane, insets)!
    expect(v.zoom).toBeCloseTo(READABLE_WHOLE_ZOOM - 0.05)
    expect(bounds.y * v.zoom + v.y).toBeCloseTo(insets.top)
  })
  it('must not change: a board that fits whole at the readable floor or more is the product\'s own whole fit (null here)', () => {
    const small = [one[0]!, ...one.slice(1, 3)].map((b) => ({ ...b, x: b.x / 4, y: b.y / 4, w: b.w / 4, h: b.h / 4 }))
    expect(readableFirstViewport(rect(small), pane, insets)).toBeNull()
  })
})

describe('J1 step 2: a board that fits whole is framed from the top of the free canvas, beside the dock', async () => {
  const { wholeAtTopViewport } = await import('../camera')
  // 1232 x 704 with the dock from x 885 and the top bar to y 52 (computeFitPadding: left 45, top 68, right 363, bottom 26).
  const pane = { width: 1232, height: 704 }, insets = { top: 68, right: 363, bottom: 26, left: 45 }
  const bookshop = { x: 0, y: 0, width: 820, height: 330 } // the bookshop board at Version 1 (three columns)
  it('its top sits under the free canvas’s top at zoom 1, centred across the space left of the dock', () => {
    const v = wholeAtTopViewport(bookshop, pane, insets)
    expect(v.zoom).toBe(1)
    expect(v.y).toBe(68)
    expect(v.x + (bookshop.width / 2) * v.zoom).toBeCloseTo(45 + (1232 - 45 - 363) / 2)
  })
  it('CONTRAST: a board taller than the free canvas is drawn smaller to fit whole, still from the top; never past 1', () => {
    const tall = { ...bookshop, height: 800 }
    const v = wholeAtTopViewport(tall, pane, insets)
    expect(v.zoom).toBeCloseTo((704 - 68 - 26) / 800)
    expect(v.y).toBe(68)
    expect(wholeAtTopViewport({ ...bookshop, width: 100, height: 100 }, pane, insets).zoom).toBe(1)
  })
})
