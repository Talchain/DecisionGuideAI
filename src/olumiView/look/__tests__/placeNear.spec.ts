import { describe, expect, it } from 'vitest'
import { placeNear } from '../placeNear'

const rect = (left: number, top: number, width: number, height: number) => ({
  left, top, right: left + width, bottom: top + height,
})
const anchor = rect(100, 80, 40, 20)
const size = { width: 40, height: 20 }
const clear = { region: rect(0, 0, 300, 200), open: [], cards: [], limit: 8 }
const at = (left: number, top: number, near = true, maxHeight: number | null = null) => ({ left, top, maxHeight, near })

describe('placeNear', () => {
  it('keeps a dock tip inside the dock and a canvas tip on the canvas side of the dock', () => {
    const dock = rect(300, 0, 200, 200)
    const canvas = rect(0, 0, 300, 200)
    const wide = { width: 60, height: 30 }
    const dockTip = placeNear(rect(304, 70, 20, 20), wide, { ...clear, region: dock, open: [rect(332, 60, 60, 30)] })
    const canvasTip = placeNear(rect(270, 70, 20, 20), wide, { ...clear, region: canvas })
    expect(dockTip).toEqual(at(304, 98))
    expect(dockTip.left).toBeGreaterThanOrEqual(dock.left)
    expect(canvasTip).toEqual(at(202, 70))
    expect(canvasTip.left + wide.width).toBeLessThanOrEqual(dock.left)
  })

  it('uses the first clear side at the gap, trying start, end and slid alignment in order', () => {
    const tall = rect(100, 80, 40, 60)
    expect(placeNear(tall, size, clear)).toEqual(at(148, 80))
    expect(placeNear(tall, size, { ...clear, open: [rect(148, 80, 40, 20)] })).toEqual(at(148, 120))
    expect(placeNear(rect(100, 185, 40, 40), size, clear)).toEqual(at(148, 180))
  })

  it('refuses a kept corner on the anchor and accepts one that shares its edge', () => {
    expect(placeNear(anchor, size, { ...clear, keep: { left: 102, top: 80 } })).toEqual(at(148, 80))
    expect(placeNear(anchor, size, { ...clear, keep: { left: 140, top: 80 } })).toEqual(at(140, 80))
  })

  it('takes another side when an open box would overlap and keeps the first side when the boxes only touch', () => {
    expect(placeNear(anchor, size, { ...clear, open: [rect(148, 80, 40, 20)] })).toEqual(at(52, 80))
    expect(placeNear(anchor, size, { ...clear, open: [rect(188, 80, 40, 20)] })).toEqual(at(148, 80))
  })

  it('prefers less total card area and uses candidate order when the areas tie', () => {
    const region = rect(0, 70, 300, 40)
    const cards = [rect(148, 80, 30, 20), rect(52, 80, 8, 20), rect(64, 80, 8, 20)]
    expect(placeNear(anchor, size, { ...clear, region, cards })).toEqual(at(52, 80))
    expect(placeNear(anchor, size, { ...clear, region })).toEqual(at(148, 80))
  })

  it('keeps an allowed corner even with card overlap and drops it when an open box occupies it', () => {
    const keep = { left: 100, top: 108 }
    const occupied = rect(keep.left, keep.top, size.width, size.height)
    expect(placeNear(anchor, size, { ...clear, keep, cards: [occupied] })).toEqual(at(100, 108))
    expect(placeNear(anchor, size, { ...clear, keep, open: [occupied] })).toEqual(at(148, 80))
  })

  it('refuses a corner beyond the limit and finds the nearest clear place with near false', () => {
    const offscreen = rect(60, 60, 40, 20)
    const region = rect(120, 0, 180, 200)
    const open = [rect(120, 0, 25, 200)]
    const keep = { left: 145, top: 60 }
    expect(placeNear(offscreen, size, { ...clear, region, open, keep })).toEqual(at(145, 40, false))
    expect(placeNear(offscreen, size, { ...clear, region, open, keep, limit: 45 })).toEqual(at(145, 60))
  })

  it('uses the least anchor overlap when every fit overlaps and leaves the anchor clear when a fit exists', () => {
    const region = rect(0, 0, 100, 100)
    const large = rect(0, 0, 80, 80)
    expect(placeNear(large, { width: 70, height: 70 }, { ...clear, region })).toEqual(at(30, 30, false))
    expect(placeNear(large, { width: 20, height: 20 }, { ...clear, region, limit: 0 })).toEqual(at(0, 80, false))
  })

  it('shrinks to the available height above or below and refuses a cut below minShown', () => {
    const region = rect(0, 0, 100, 100)
    const tall = { width: 80, height: 70 }
    const upper = rect(0, 0, 100, 50)
    const lower = rect(0, 50, 100, 50)
    const options = { ...clear, region, shrink: true, minShown: 42 }
    expect(placeNear(upper, tall, options)).toEqual(at(0, 58, true, 42))
    expect(placeNear(lower, tall, options)).toEqual(at(0, 0, true, 42))
    expect(placeNear(upper, tall, { ...options, minShown: 43 })).toEqual(at(0, 50, false, 50))
    expect(placeNear(upper, tall, { ...options, shrink: false })).toEqual(at(0, 30, false))
  })
})
