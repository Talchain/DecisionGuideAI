/**
 * DL 07:48Z (3), by layout: at rest no card's label or figure line is under the foot controls; (camera) after the first approval the
 * primary aim is in view. Boxes are the served twin's (engine 4352bfa3, cut13, approved) as drawn at 1232x704 (14 Nov): cards 248 x 180 in
 * rows 285 px apart, the foot controls' gutter the bottom 88 px of the 704 px window.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Node } from '@xyflow/react'
import { FOOT_GUTTER, LABEL_FIGURE_H, restClearOfFoot } from '../footClear'
import { aimAfterFirstApproval, boardSeenOf, primaryAimOf } from '../ViewCanvas'
import type { View } from '../client'

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

describe('the primary aim is the goal the options are read against', () => {
  const V = JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures/live-4352bfa3-twin-cut13-v1.view.json'), 'utf8')) as View
  it('FC3 on the served twin it is the aim the options\' headlines name (core\'s aim_id), a goal card', () => {
    const id = primaryAimOf(V)
    const named = V.model!.cards.filter((c) => c.family === 'option').map((c) => c.headline?.aim_id).filter(Boolean)
    expect([V.model!.cards.find((c) => c.id === id)?.family, named.includes(id!)]).toEqual(['goal', true])
  })
})

describe('a fractional card top (zoom 0.92, as at 1232 after an edit, 14 Nov) still lets the row go wholly below the fold', () => {
  it('FC6 the row at 567.6 px is pushed to the fold, not half a pixel short of it', () => {
    const z = 0.920507, rows = [box('q', 0, 0, 98), ...[0, 1, 2, 3].map((i) => box(`o${i}`, i * 223, 162, 267)), ...[0, 1, 2, 3].map((i) => box(`f${i}}`, i * 223, 493.6, 177))]
    const v = restClearOfFoot({ x: 0, y: 113.2, zoom: z }, rows, H, TOP)
    expect(rows.every((n) => n.position.y * z + v.y >= H - 0.5 || n.position.y * z + v.y + Math.min(n.measured!.height!, LABEL_FIGURE_H) * z <= G + 0.5)).toBe(true)
    expect(v.y).toBeGreaterThan(113.2)
  })
})

describe('at rest nothing is pushed out of view to pass the rule', () => {
  it('FC5 where only a big move would clear the foot, the frame is left as the fit made it; the board never empties', () => {
    // A board whose rows are 60 px apart: every move that clears one row puts the next in the gutter, until all are below the fold.
    const dense = Array.from({ length: 12 }, (_, i) => box(`r${i}`, 0, i * 60, 180))
    const v0 = { x: 0, y: TOP, zoom: 1 }
    const v = restClearOfFoot(v0, dense, H, TOP)
    expect(Math.abs(v.y - v0.y)).toBeLessThanOrEqual(FOOT_GUTTER + LABEL_FIGURE_H)
    expect(dense.some((n) => n.position.y + v.y < G)).toBe(true)
  })
})

describe('(camera, PL-1040) only the first approval brings the aim into view', () => {
  const V0 = JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures/live-4352bfa3-twin-cut13-v1.view.json'), 'utf8')) as View
  const at = (n: number | null, held: boolean) => ({ ...V0, version: n === null ? null : { ...(V0.version ?? {}), n }, proposal: held ? ({ id: 1 } as never) : null }) as View
  it('FC4 a held first model, then version 1 with nothing held: the primary aim', () => {
    expect(aimAfterFirstApproval(boardSeenOf(at(null, true)), at(1, false))).toBe(primaryAimOf(V0))
  })
  it('FC4 CONTRAST: on version 1 the camera framing again (a badge opened or closed re-keys it) does not bring the aim back', () => {
    expect(aimAfterFirstApproval(boardSeenOf(at(1, false)), at(1, false))).toBeNull()
  })
  it('FC4 CONTRAST: a later approval, a reload (nothing seen before) and a first model still held bring nothing', () => {
    expect([aimAfterFirstApproval(boardSeenOf(at(1, true)), at(2, false)), aimAfterFirstApproval(null, at(1, false)), aimAfterFirstApproval(boardSeenOf(at(null, true)), at(null, true))]).toEqual([null, null, null])
  })
})
