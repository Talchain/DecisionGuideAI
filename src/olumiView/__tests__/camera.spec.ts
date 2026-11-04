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
import { CORE_LANE_FIT_FLOOR, productFitFloor, READABLE_WHOLE_ZOOM, readableFirstViewport, WHOLE_FIT_ZOOM } from '../camera'
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
  it('Codex P1-3: four options (4 × 220 + 3 × 48 = 1024 units, 921.6px at 0.9) on a 1280 canvas wrap into two rows in the View\'s order, so the question and every option are inside the visible rect', async () => {
    const opts = model.cards.filter((c) => c.family === 'option'), src = opts[0]!
    const extra = { ...src, id: 'fourth_option', heading: 'A fourth option' }
    const links = model.links.flatMap((l) => (l.from === src.id ? [l, { ...l, from: extra.id }] : l.to === src.id ? [l, { ...l, to: extra.id }] : [l]))
    const four = { ...model, cards: [...model.cards, extra], links }
    const ids = [...opts.map((c) => c.id), extra.id]
    expect(ids.length, 'precondition: four options').toBe(4)
    const at = await causalPlaces(four, new Map(), q.width)
    const bs = [{ id: QUESTION, ...at.get(QUESTION)!, w: q.width, h: 85 }, ...four.cards.map((c) => ({ id: c.id, ...at.get(c.id)!, w: CARD_WIDTH, h: c.h }))]
    const head = rect(bs.filter((b) => b.id === QUESTION || ids.includes(b.id)))
    const v = readableFirstViewport(rect(bs), pane, insets, head)
    const vp = v ?? { zoom: READABLE_WHOLE_ZOOM, x: 0, y: 0 }
    for (const b of bs.filter((x) => x.id === QUESTION || ids.includes(x.id))) {
      const l = b.x * vp.zoom + vp.x, r = (b.x + b.w) * vp.zoom + vp.x, t = b.y * vp.zoom + vp.y
      expect([l >= insets.left - 1, r <= pane.width - insets.right + 1, t >= insets.top - 1], `${b.id} ${JSON.stringify({ l, r, t })}`).toEqual([true, true, true])
    }
    // Two rows, in the View's order: the first two above the last two; no card overlaps another.
    const ys = ids.map((id) => at.get(id)!.y)
    expect(ys[0]).toBe(ys[1]); expect(ys[2]).toBe(ys[3]); expect(ys[2]!).toBeGreaterThan(ys[0]!)
    for (const a of bs) for (const b of bs) if (a.id < b.id) expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h, `${a.id} overlaps ${b.id}`).toBe(false)
  })
  it('CONTRAST: three options (756 units) stay one row', async () => {
    const ids = model.cards.filter((c) => c.family === 'option').map((c) => c.id)
    expect(new Set(ids.map((id) => places.get(id)!.y)).size).toBe(1)
  })
  it('R3 (DL 4 Nov, Paul\'s original): a board that fits whole at 0.8 to 0.9 is shown whole (the product\'s fit, null here); just below 0.8 it opens at the 0.9 floor', () => {
    const freeW = pane.width - insets.left - insets.right, freeH = pane.height - insets.top - insets.bottom
    const at = (z: number) => ({ x: 0, y: 0, width: freeW / z, height: freeH / z })
    expect(readableFirstViewport(at(0.85), pane, insets)).toBeNull()
    expect(readableFirstViewport(at(WHOLE_FIT_ZOOM), pane, insets)).toBeNull()
    expect(readableFirstViewport(at(0.79), pane, insets)?.zoom).toBe(READABLE_WHOLE_ZOOM)
  })
  it('must not change: a board that fits whole at 0.9 or more is the product\'s own whole fit (null here)', () => {
    const small = [one[0]!, ...one.slice(1, 3)].map((b) => ({ ...b, x: b.x / 4, y: b.y / 4, w: b.w / 4, h: b.h / 4 }))
    expect(readableFirstViewport(rect(small), pane, insets)).toBeNull()
  })
})
