/**
 * V12 Simple fits the whole model in view on arrival (Paul, 16 Nov: Simple keeps the scenario's whole structure as a visual you take in at once; it
 * cuts text, not cards). Real path: layout.ts causalPlaces with the row simpleStageRow gives (as canvas.ts causalFor calls it) on the in-repo
 * bakery fixture (model/fixtures/bakery-author: 16 cards and the question; Paul's own scenarios are private and never committed to this public
 * repository), then the camera's own frame (ViewCanvas cameraFrame, Simple).
 *
 * jsdom measures no node, so heights are given. Two sets:
 *  - MEASURED: the heights the lead read in the browser from the first Simple build (1232 x 704, funding): 84, 87, 101 (x7), 108, 118, 118, 151 and
 *    the question 114. They are the old faces' and are kept as the worst case: nothing may overlap on them, and they say what the old faces cost.
 *  - COMPACT: one clamped title line and one visual row, 6 px padding, 13 px type: 60 px, the question 44 (the lead's target, 56 to 64 and about 40).
 * Bound by card id.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Node } from '@xyflow/react'
import type { View } from '../../client'
import { SIMPLE_FIT_FLOOR } from '../../camera'
import { FOOT_GUTTER } from '../../footClear'
import { allOptionCards, causalPlaces, QUESTION, questionBarWidth, simpleStageRow, stageRow } from '../../layout'
import { cameraFrame } from '../../ViewCanvas'

const view = JSON.parse(readFileSync(path.resolve('src/olumiView/model/fixtures/bakery-author.core-a62f0899.view3.json'), 'utf8')) as View
const model = view.model!

const MEASURED_CARDS = [84, 87, 101, 101, 101, 101, 101, 101, 101, 108, 118, 118, 151], MEASURED_QUESTION = 114
const COMPACT_CARD = 60, COMPACT_QUESTION = 44
type Box = { id: string; x: number; y: number; w: number; h: number }
type Heights = { card: (i: number) => number; question: number }
const MEASURED: Heights = { card: (i) => MEASURED_CARDS[i % MEASURED_CARDS.length]!, question: MEASURED_QUESTION }
const COMPACT: Heights = { card: () => COMPACT_CARD, question: COMPACT_QUESTION }

async function laidOut(roomW: number, h: Heights): Promise<{ boxes: Box[]; row: ReturnType<typeof simpleStageRow> }> {
  const row = simpleStageRow(roomW)
  const size = new Map([[QUESTION, { width: questionBarWidth(model, row), height: h.question }], ...model.cards.map((c, i) => [c.id, { width: row.cardW, height: h.card(i) }] as const)])
  const places = await causalPlaces(model, size, { row })
  return { row, boxes: [...size].map(([id, s]) => ({ id, x: places.get(id)!.x, y: places.get(id)!.y, w: s.width, h: s.height })) }
}
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const rowsOf = (boxes: Box[]) => [...new Set(boxes.map((b) => b.y))].sort((a, b) => a - b).map((y) => boxes.filter((b) => b.y === y))
const noOverlap = (boxes: Box[]) => { for (let i = 0; i < boxes.length; i += 1) for (let j = i + 1; j < boxes.length; j += 1) expect(overlaps(boxes[i]!, boxes[j]!), `${boxes[i]!.id} / ${boxes[j]!.id}`).toBe(false) }
type Free = { top: number; right: number; bottom: number; left: number }
function framed(boxes: Box[], pane: { width: number; height: number }, free: Free) {
  const nodes: Node[] = boxes.map((b) => ({ id: b.id, position: { x: b.x, y: b.y }, data: {}, measured: { width: b.w, height: b.h } }))
  const v = cameraFrame({ full: { zoom: 1, nodes } }, pane, free, null, true)!
  const outside = boxes.filter((b) => b.x * v.zoom + v.x < free.left - 0.5 || b.y * v.zoom + v.y < free.top - 0.5 || (b.x + b.w) * v.zoom + v.x > pane.width - free.right + 0.5 || (b.y + b.h) * v.zoom + v.y > pane.height - Math.max(free.bottom, FOOT_GUTTER) + 0.5)
  return { v, outside: outside.map((b) => b.id) }
}
const report = (name: string, boxes: Box[], v: { zoom: number }) =>
  // eslint-disable-next-line no-console
  console.log('SIMPLE-FIT', name, JSON.stringify({ perBand: rowsOf(boxes).map((r) => r.length), rows: rowsOf(boxes).length, zoom: +v.zoom.toFixed(3), boardW: Math.max(...boxes.map((b) => b.x + b.w)), boardH: Math.max(...boxes.map((b) => b.y + b.h)) }))

describe('Simple: the whole scenario in view', () => {
  it('880 x 560, compact faces: 5 across, every card inside the fitted viewport, zoom >= 0.8, none overlap', async () => {
    const { boxes, row } = await laidOut(880, COMPACT)
    expect(boxes.length, 'the question and every card').toBe(model.cards.length + 1)
    expect(row, '5 cards of 200 px with 16 px gaps across 880 at 0.8').toMatchObject({ perRow: 5, cardW: 200, gapX: 16 })
    const { v, outside } = framed(boxes, { width: 880, height: 560 }, { top: 0, right: 0, bottom: 0, left: 0 })
    report('880x560 compact', boxes, v)
    expect(v.zoom).toBeGreaterThanOrEqual(SIMPLE_FIT_FLOOR)
    expect(outside, 'every card inside the fitted viewport, above the foot controls').toEqual([])
    noOverlap(boxes)
  })

  it('1232 x 704 (pane 880 wide beside the dock, top 114, left 45), compact faces: every card in view with nothing below', async () => {
    const { boxes } = await laidOut(880, COMPACT)
    const free = { top: 114, right: 1232 - 45 - 880, bottom: 0, left: 45 }
    const { v, outside } = framed(boxes, { width: 1232, height: 704 }, free)
    report('1232x704 compact', boxes, v)
    expect(v.zoom).toBeGreaterThanOrEqual(SIMPLE_FIT_FLOOR)
    expect(outside).toEqual([])
  })

  it('the lead\'s MEASURED heights (the old faces): no overlap, the same bands; they do not fit 1232 x 704 whole at 0.8, which is why the faces were cut', async () => {
    const { boxes } = await laidOut(880, MEASURED)
    noOverlap(boxes)
    const { v, outside } = framed(boxes, { width: 1232, height: 704 }, { top: 114, right: 1232 - 45 - 880, bottom: 0, left: 45 })
    report('1232x704 measured-old', boxes, v)
    expect(v.zoom, 'never below Simple\'s floor').toBeGreaterThanOrEqual(SIMPLE_FIT_FLOOR)
    expect(outside.length, 'CONTRAST: the old faces leave cards below').toBeGreaterThan(0)
  })

  it('1650: more cards across (9), the board no taller than at 880', async () => {
    const narrow = await laidOut(880, COMPACT), wide = await laidOut(1650, COMPACT)
    expect(wide.row.perRow).toBeGreaterThanOrEqual(6)
    expect(Math.max(...wide.boxes.map((b) => b.y + b.h))).toBeLessThanOrEqual(Math.max(...narrow.boxes.map((b) => b.y + b.h)))
    expect(rowsOf(wide.boxes).length).toBeLessThanOrEqual(rowsOf(narrow.boxes).length)
  })

  it('causal order: options right under the question, an aim closing the board; Detailed\'s stage row is untouched', async () => {
    const { boxes } = await laidOut(880, COMPACT)
    const rows = rowsOf(boxes.filter((b) => b.id !== QUESTION)), y = (id: string) => boxes.find((b) => b.id === id)!.y
    const q = boxes.find((b) => b.id === QUESTION)!
    for (const o of allOptionCards(model)) expect(y(o.id), `${o.id} is in the band right under the question`).toBe(rows[0]![0]!.y)
    expect(rows[0]![0]!.y).toBeGreaterThanOrEqual(q.y + q.h)
    const aims = model.cards.filter((c) => c.family === 'goal').map((c) => c.id)
    expect(aims.some((a) => rows[rows.length - 1]!.map((b) => b.id).includes(a)), 'an aim closes the board').toBe(true)
    expect(Math.min(...aims.map(y)), 'no aim above an option').toBeGreaterThan(y(allOptionCards(model)[0]!.id))
    expect(stageRow(model, 880), 'Detailed\'s row is the stage row, not the Simple one').not.toHaveProperty('simple')
  })
})
