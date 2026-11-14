/**
 * DL 07:48Z (3), OLD look (as the new look's 105f267b), by layout: at rest no card's label or figure line is under the foot controls; (camera) after the first approval the
 * primary aim is in view. Boxes are the served twin's (engine 4352bfa3, cut13, approved) as drawn at 1232x704 (14 Nov): cards 248 x 180 in
 * rows 285 px apart, the foot controls' gutter the bottom 88 px of the 704 px window.
 */
import { describe, expect, it } from 'vitest'
import type { Node } from '@xyflow/react'
import { FOOT_GUTTER, LABEL_FIGURE_H, restClearOfFoot } from '../footClear'

const box = (id: string, x: number, y: number, h = 180): Node => ({ id, position: { x, y }, data: {}, measured: { width: 248, height: h } })
const H = 704, TOP = 104, G = H - FOOT_GUTTER
const board = [box('page:question', 0, 0, 90), ...[0, 1, 2, 3].map((i) => box(`opt${i}`, i * 300, 150)), ...[0, 1, 2, 3].map((i) => box(`fig${i}`, i * 300, 435)), ...[0, 1, 2, 3].map((i) => box(`low${i}`, i * 300, 720)), box('aim', 300, 1005)]
const drawn = (v: { y: number; zoom: number }) => board.map((n) => ({ id: n.id, top: n.position.y * v.zoom + v.y, lf: Math.min(n.measured!.height!, LABEL_FIGURE_H) * v.zoom, h: n.measured!.height! * v.zoom }))
const clearOfGutter = (v: { y: number; zoom: number }) => drawn(v).every((c) => c.top >= H || c.top + c.lf <= G)

describe('at rest the board keeps every card\'s label and figure clear of the foot controls', () => {
  it('FC1 a row whose label and figure would fall in the gutter moves the least it must (here: wholly below the fold), the board\'s top kept', () => {
    const v0 = { x: 0, y: TOP, zoom: 1 }
    expect(clearOfGutter(v0), 'precondition: the "fig" row\'s labels sit in the gutter at rest').toBe(false)
    const v = restClearOfFoot(v0, board, H, TOP)
    expect([clearOfGutter(v), v.y >= TOP]).toEqual([true, true])
    expect(v.y - TOP).toBe(H - (435 + TOP)) // the fig row pushed just below the fold: 165 px
  })
  it('FC1 CONTRAST: a board with nothing near the foot (the question and the options) does not move', () => {
    const top = board.slice(0, 5)
    expect(restClearOfFoot({ x: 0, y: TOP, zoom: 1 }, top, H, TOP)).toEqual({ x: 0, y: TOP, zoom: 1 })
  })
  it('FC2 after the first approval the anchor (the primary aim) is wholly in view above the gutter, and the rest still clear', () => {
    const v = restClearOfFoot({ x: 0, y: TOP, zoom: 1 }, board, H, TOP, 'aim')
    const a = drawn(v).find((c) => c.id === 'aim')!
    expect([a.top >= TOP, a.top + a.h <= G, clearOfGutter(v)]).toEqual([true, true, true])
  })
})

