/**
 * V12 Simple fits the whole model in view on arrival (Paul, 16 Nov: Simple keeps the scenario's whole structure as a visual you take in at once; it
 * cuts text, not cards). Real path: layout.ts causalPlaces with the row simpleStageRow gives (as canvas.ts causalFor calls it) on the in-repo
 * bakery fixture (model/fixtures/bakery-author: 16 cards and the question; Paul's own scenarios are private and never committed to this public
 * repository), then the camera's own frame (ViewCanvas cameraFrame, Simple).
 *
 * jsdom measures no node, so heights are given. Two sets:
 *  - MEASURED: the heights the lead read in the browser from the first Simple build (1232 x 704, funding): 84, 87, 101 (x7), 108, 118, 118, 151 and
 *    the question 114. They are the old faces' and are kept as the worst case: nothing may overlap on them.
 *  - COMPACT: one title line and one visual row: 60 px, the question 44 (the lead's target, 56 to 64 and about 40).
 * GEOMETRY (Paul, 16 Nov, R1): production's. Cards share their row and grow to its fair share of the row budget, between 260 and 400; cards are
 * 24 apart and rows 48 apart; the camera fits down to production's 0.5. Bound by card id.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Node } from '@xyflow/react'
import type { View } from '../../client'
import { SIMPLE_FIT_FLOOR } from '../../camera'
import { FOOT_GUTTER } from '../../footClear'
import { allOptionCards, causalPlaces, QUESTION, questionBarWidth, simpleScaleOf, simpleStageRow, stageRow } from '../../layout'
import { labelCounterScale, LABEL_COUNTER_SCALE_CAP } from '../../../canvas/utils/zoomLegibility'
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
  // Each card is as wide as its band gives it (the place's `w`), the question as wide as the options' first row.
  return { row, boxes: [...size].map(([id, s]) => ({ id, x: places.get(id)!.x, y: places.get(id)!.y, w: places.get(id)!.w ?? s.width, h: s.height })) }
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
  it('880 x 560, compact faces: 5 across, every card inside the fitted viewport, zoom >= 0.5, none overlap', async () => {
    const { boxes, row } = await laidOut(880, COMPACT)
    expect(boxes.length, 'the question and every card').toBe(model.cards.length + 1)
    // The budget is 880 over the zoom at which 12 px type at production's counter-scale cap draws 11 px (0.56), to 48: 1536; five across share it.
    expect(row, 'five cards share a 1536 row budget with 24 gaps: 288 each').toMatchObject({ perRow: 5, cardW: 288, gapX: 24, budget: 1536, simple: true })
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

  it('the lead\'s MEASURED heights (the old faces): no overlap, the same bands, never below the floor; the wider cards and the lower floor let them fit 1232 x 704', async () => {
    const { boxes } = await laidOut(880, MEASURED)
    noOverlap(boxes)
    const { v, outside } = framed(boxes, { width: 1232, height: 704 }, { top: 114, right: 1232 - 45 - 880, bottom: 0, left: 45 })
    report('1232x704 measured-old', boxes, v)
    expect(v.zoom, 'never below Simple\'s floor').toBeGreaterThanOrEqual(SIMPLE_FIT_FLOOR)
    expect(outside, 'R1 priority 2: the whole model in view').toEqual([])
  })

  it('1650: production\'s own budget (1656), five across at most; cards no narrower and the board no taller than at 880', async () => {
    const narrow = await laidOut(880, COMPACT), wide = await laidOut(1650, COMPACT)
    expect(wide.row).toMatchObject({ budget: 1656, perRow: 5 })
    expect(wide.row.cardW).toBeGreaterThanOrEqual(narrow.row.cardW)
    expect(Math.max(...wide.boxes.map((b) => b.y + b.h))).toBeLessThanOrEqual(Math.max(...narrow.boxes.map((b) => b.y + b.h)))
    expect(rowsOf(wide.boxes).length).toBeLessThanOrEqual(rowsOf(narrow.boxes).length)
  })

  it('R1: cards share their row at its fair share (260 to 400), 24 apart across and 48 apart down; the question spans the options\' first row', async () => {
    const { boxes, row } = await laidOut(880, COMPACT)
    const q = boxes.find((b) => b.id === QUESTION)!, cards = boxes.filter((b) => b.id !== QUESTION)
    for (const r of rowsOf(cards)) {
      expect(new Set(r.map((b) => b.w)).size, 'one width in a row').toBe(1)
      expect(r[0]!.w).toBeGreaterThanOrEqual(260); expect(r[0]!.w).toBeLessThanOrEqual(400)
      const xs = [...r].sort((a, b) => a.x - b.x)
      for (let i = 1; i < xs.length; i += 1) expect(xs[i]!.x - (xs[i - 1]!.x + xs[i - 1]!.w), 'cards are 24 apart').toBe(24)
    }
    const rows = rowsOf(cards)
    for (let i = 1; i < rows.length; i += 1) expect(rows[i]![0]!.y - Math.max(...rows[i - 1]!.map((b) => b.y + b.h)), 'rows are 48 apart').toBe(48)
    expect(rows[0]![0]!.y - (q.y + q.h), 'the first band is 48 under the question').toBe(48)
    const first = rows[0]!
    expect(q.w, 'the question is as wide as the options\' first row').toBe(Math.max(...first.map((b) => b.x + b.w)) - Math.min(...first.map((b) => b.x)))
    expect(row.budget).toBe(1536)
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

describe('Simple type scale (R1 priority 3, 16 Nov): production\'s counter-scale, fixed per board', () => {
  it('a board that fits its room draws at 12 px (scale 1); one twice the room\'s width at production\'s cap (1.64, 9.8 px at 0.5); in between, 1 over its zoom', () => {
    expect(simpleScaleOf(800, 1000)).toBe(1)
    expect(simpleScaleOf(2000, 1000)).toBe(LABEL_COUNTER_SCALE_CAP)
    expect(simpleScaleOf(1250, 1000)).toBeCloseTo(labelCounterScale(0.8), 5)
    expect(simpleScaleOf(1250, 1000)).toBeCloseTo(1.25, 5)
    expect(simpleScaleOf(1000, undefined), 'no room known: the declared size').toBe(1)
  })
  it('every card and the question carry the one scale and the width their band gave them, so nothing re-flows as the camera zooms', async () => {
    const { row } = await laidOut(880, COMPACT)
    const size = new Map([[QUESTION, { width: 0, height: 44 }], ...model.cards.map((c) => [c.id, { width: row.cardW, height: 60 }] as const)])
    const places = await causalPlaces(model, size, { row })
    const scales = new Set([...places.values()].map((p) => p.s))
    expect(scales.size, 'one scale for the whole board').toBe(1)
    expect([...scales][0]).toBeGreaterThanOrEqual(1)
    expect([...places].filter(([id]) => id !== QUESTION).every(([, p]) => p.w !== undefined && p.w >= 260 && p.w <= 400), 'cards: 260 to 400 (the question spans its row)').toBe(true)
  })
})
