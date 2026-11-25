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
 * GEOMETRY (Paul, 16 Nov, R1; the lead's D3, 17 Nov): production's. Cards share their row and grow to its fair share of the row budget, never under
 * production's repeated-card width (a lone card takes the share of two; was capped at 400, so short rows stood as a cluster at the centre); cards are
 * 24 apart and rows 48 apart; the camera fits down to production's 0.5. Bound by card id.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Node } from '@xyflow/react'
import type { View } from '../../client'
import { SIMPLE_FIT_FLOOR } from '../../camera'
import { FOOT_GUTTER } from '../../footClear'
import { allOptionCards, causalPlaces, QUESTION, questionBarWidth, SIMPLE_CARD_MAX_W, simpleCardW, simpleScaleOf, simpleStageRow, stageRow } from '../../layout'
import { labelCounterScale, LABEL_COUNTER_SCALE_CAP } from '../../../canvas/utils/zoomLegibility'
import { REPEATED_CARD_W } from '../../../canvas/utils/nodeLayoutConstants'
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
  // Each card and the question use the width from their places.
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

/**
 * THE FIT PREDICATE ON HEIGHTS MEASURED IN THE BROWSER (D3, 17 Nov), not invented ones: the flow boxes the l1 build drew at 1232 x 704 with the panel open
 * (the fit probe: each node's place and its measured size, the board's type scale 1.64), ids invented (the scenarios are private). The free canvas is
 * the real one: the lens bar's foot at 98 plus 16, the tool column's edge at 54 plus 16, the panel from 885 plus 16, the foot gutter below.
 *  - A seeded first draft, after D1 to D3 (8 nodes): it fits whole, its 12 px type drawn at 11 px or more.
 *  - The owner's approved 19-card model, after D1 to D3 (14 nodes, five card rows, 1300 flow units tall): it does NOT fit; its outcome and both aims
 *    stay below (the lead's priority not met on this model; recorded, never asserted as met).
 */
const DRAFT_MEASURED: [string, number, number, number, number][] = [['q', 0, 0, 1392, 78], ['c1', 0, 126, 448, 105], ['c2', 472, 126, 448, 135], ['c3', 944, 126, 448, 144], ['c4', 0, 318, 684, 122], ['c5', 708, 318, 684, 44], ['c6', 348, 488, 696, 44], ['c7', 348, 580, 696, 180]]
const APPROVED_MEASURED: [string, number, number, number, number][] = [['q', 0, 0, 1392, 105], ['c1', 0, 153, 684, 222], ['c2', 708, 153, 684, 135], ['c3', 0, 423, 330, 194], ['c4', 354, 423, 330, 194], ['c5', 708, 423, 330, 194], ['c6', 1062, 423, 330, 135], ['c7', 0, 665, 330, 139], ['c8', 354, 665, 330, 194], ['c9', 708, 665, 330, 194], ['c10', 1062, 665, 330, 44], ['c11', 348, 907, 696, 168], ['c12', 0, 1123, 684, 177], ['c13', 708, 1123, 684, 177]]
const MEASURED_SCALE = 1.64
describe('D3: the fit predicate on heights measured from the real faces (1232 x 704, panel open)', () => {
  const free = { top: 98 + 16, right: 1232 - 885 + 16, bottom: 0, left: 54 + 16 }
  const boxesOf = (rows: typeof DRAFT_MEASURED): Box[] => rows.map(([id, x, y, w, h]) => ({ id, x, y, w, h }))
  it('F1 the first draft fits whole, nothing under the foot controls, its 12 px type at 11 px or more on screen', () => {
    const { v, outside } = framed(boxesOf(DRAFT_MEASURED), { width: 1232, height: 704 }, free)
    expect([outside, 12 * MEASURED_SCALE * v.zoom >= 11]).toEqual([[], true])
  })
  it('F1 CONTRAST: the approved 19-card model (five card rows) does not: its outcome and both aims are below, at the 11 px zoom', () => {
    const { v, outside } = framed(boxesOf(APPROVED_MEASURED), { width: 1232, height: 704 }, free)
    expect([outside, 12 * MEASURED_SCALE * v.zoom >= 11]).toEqual([['c11', 'c12', 'c13'], true])
  })
})

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

  // CHANGED BY DESIGN (the lead's D3, 17 Nov: rows spread, cards up to their fair-share width): no 400 cap; was "260 to 400".
  it('R1 CHANGED BY DESIGN (Paul 17 Nov, reverses D3): cards share their row at its fair share, never under the repeated-card width and never over SIMPLE_CARD_MAX_W; rows are centred, not spread to the budget; 24 apart across and 48 apart down; the question spans the options\' first row', async () => {
    const { boxes, row } = await laidOut(880, COMPACT)
    const q = boxes.find((b) => b.id === QUESTION)!, cards = boxes.filter((b) => b.id !== QUESTION)
    for (const r of rowsOf(cards)) {
      expect(new Set(r.map((b) => b.w)).size, 'one width in a row').toBe(1)
      expect(r[0]!.w).toBeGreaterThanOrEqual(REPEATED_CARD_W)
      expect(r[0]!.w, 'never stretched past the max width to fill the room').toBeLessThanOrEqual(SIMPLE_CARD_MAX_W)
      // Every row is centred on the board: a short row stands compact in the middle, never spread to the budget's edges.
      const mid = (b: { x: number; w: number }[]) => (Math.min(...b.map((x) => x.x)) + Math.max(...b.map((x) => x.x + x.w))) / 2
      expect(Math.abs(mid(r) - (q.x + q.w / 2)), 'the row is centred under the question').toBeLessThanOrEqual(1)
      const xs = [...r].sort((a, b) => a.x - b.x)
      for (let i = 1; i < xs.length; i += 1) expect(xs[i]!.x - (xs[i - 1]!.x + xs[i - 1]!.w), 'cards are 24 apart').toBe(24)
    }
    const rows = rowsOf(cards)
    for (let i = 1; i < rows.length; i += 1) expect(rows[i]![0]!.y - Math.max(...rows[i - 1]!.map((b) => b.y + b.h)), 'rows are 48 apart').toBe(48)
    expect(rows[0]![0]!.y - (q.y + q.h), 'the first band is 48 under the question').toBe(48)
    const first = rows[0]!
    // CHANGED BY DESIGN (DL-REQ-0020): the question uses at most two cards' width.
    const span = Math.max(...first.map((b) => b.x + b.w)) - Math.min(...first.map((b) => b.x))
    expect(q.w).toBe(Math.min(span, 2 * first[0]!.w + row.gapX))
    expect(row.budget).toBe(1536)
  })

  it('R1b the width rule by its ends: a small graph in a wide room is capped at SIMPLE_CARD_MAX_W; a big graph in a narrow room keeps the repeated-card width', () => {
    expect([simpleCardW(1656, 2), simpleCardW(1656, 1), simpleCardW(600, 5)]).toEqual([SIMPLE_CARD_MAX_W, SIMPLE_CARD_MAX_W, REPEATED_CARD_W])
    expect(SIMPLE_CARD_MAX_W).toBeGreaterThan(REPEATED_CARD_W)
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
    expect([...places].filter(([id]) => id !== QUESTION).every(([, p]) => p.w !== undefined && p.w >= REPEATED_CARD_W), 'cards: their row\'s fair share, never under the repeated-card width (D3; was 260 to 400)').toBe(true)
  })
})
