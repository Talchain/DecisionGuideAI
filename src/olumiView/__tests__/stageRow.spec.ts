/**
 * DL-538 priority 1 (14 Nov, the target screen): the options in one readable row. The board's card width and row gap are sized to the
 * free canvas, so the widest options row fits across at the readable floor (camera.ts READABLE_WHOLE_ZOOM). Real path: layout.ts causalPlaces
 * with the row stageRow gives (as canvas.ts causalFor calls it), on the served View of run 2 (five options) and run 1 (six options). Free
 * widths are the served builds' (cameraFaces.spec: 1128 less the dock from x 811 and the toolbar to x 45; 2000 less the dock from 1640).
 * Bound by card id.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../client'
import { READABLE_WHOLE_ZOOM } from '../camera'
import { aimsOf, allOptionCards, CARD_WIDTH, CARD_MIN_W, causalPlaces, QUESTION, questionBarWidth, ROW_GAP_X, simpleBand, simpleStageRow, stageRow } from '../layout'

const load = (f: string) => JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures', f), 'utf8')) as View
const BOARDS = { run2: load('live-v51-run2-approved.view.json'), run1: load('live-v51-run1-pending.view.json') }
const FREE_1128 = 1128 - (1128 - 811) - 45, FREE_2000 = 2000 - (2000 - 1640) - 45
const FREE_1440 = 1440 - 360 - 45

it.each(['Simple', 'Detailed'] as const)('%s spaces every neighbour and tier on the joined-board fixture at 1232', async (mode) => {
  const model = load('live-4352bfa3-copy-v5.view.json').model!
  const row = mode === 'Simple' ? simpleStageRow(840) : stageRow(model, 840)
  const size = new Map([
    [QUESTION, { width: questionBarWidth(model, row), height: 83 }] as const,
    ...model.cards.map((c, index) => [c.id, { width: row.cardW - index % 4, height: 127 + index % 5 * 12 }] as const),
  ])
  const places = await causalPlaces(model, size, { row })
  const rows = new Map<number, { x: number; width: number; height: number }[]>()
  for (const [id, p] of places) {
    const { width, height } = size.get(id)!
    rows.set(p.y, [...(rows.get(p.y) ?? []), { x: p.x, width: p.w ?? width, height }])
  }
  expect(rows.size).toBeGreaterThan(2)
  let previousBottom: number | undefined
  let neighbours = 0
  for (const [top, cards] of [...rows].sort(([a], [b]) => a - b)) {
    if (previousBottom !== undefined) expect(top - previousBottom).toBe(48)
    previousBottom = top + Math.max(...cards.map((c) => c.height))
    cards.sort((a, b) => a.x - b.x)
    for (let i = 1; i < cards.length; i++) {
      const previous = cards[i - 1]!
      expect(cards[i]!.x - (previous.x + previous.width)).toBeCloseTo(24, 10)
      neighbours++
    }
  }
  expect(neighbours).toBeGreaterThan(0)
})

describe('the options row is sized to the stage (DL-538)', () => {
  for (const [name, view] of Object.entries(BOARDS)) {
    const model = view.model!, ids = allOptionCards(model).map((c) => c.id)

    it(`${name} at 1128: the ${ids.length} options, packed at the stage's width and gap, span no more than the free canvas at the readable floor`, async () => {
      const row = stageRow(model, FREE_1128)
      expect(row.cardW, 'narrower than the full card').toBeLessThan(CARD_WIDTH)
      const size = new Map([[QUESTION, { width: questionBarWidth(model, row), height: 85 }], ...model.cards.map((c) => [c.id, { width: row.cardW, height: c.h }] as const)])
      const places = await causalPlaces(model, size, { row })
      // The options stand in one row, packed at the stage's width and gap, spanning no more than the free canvas at the readable floor.
      const xs = ids.map((id) => places.get(id)!)
      expect(new Set(xs.map((p) => p.y)).size, 'one row').toBe(1)
      const span = Math.max(...xs.map((p) => p.x)) + row.cardW - Math.min(...xs.map((p) => p.x))
      expect(span).toBe(ids.length * row.cardW + (ids.length - 1) * row.gapX)
      if (ids.length <= 5) expect(span * READABLE_WHOLE_ZOOM).toBeLessThanOrEqual(FREE_1128 + 0.5)
      // CHANGED BY DESIGN (DL-REQ-0020): the question bar starts where the options row starts.
      expect(places.get(QUESTION)!.x).toBe(Math.min(...xs.map((p) => p.x)))
      expect(questionBarWidth(model, row)).toBe(Math.min(span, 2 * row.cardW + row.gapX))
    })

    it(`${name} at 2000: the full card and gap where they fit (CONTRAST: the stage does not shrink a board that fits)`, () => {
      expect(stageRow(model, FREE_2000)).toMatchObject({ cardW: CARD_WIDTH, gapX: ROW_GAP_X })
    })
  }

  it('a stage too narrow for the row keeps the card at its floor (the rest pans)', () => {
    expect(stageRow(BOARDS.run1.model!, 300).cardW).toBe(CARD_MIN_W)
  })

  for (const [name, view] of Object.entries(BOARDS)) {
    it(`${name}: the goal closes the board beside the measure it is measured by (the target's last row); CONTRAST: the previous layout alone keeps it a row below`, async () => {
      const model = view.model!, row = stageRow(model, FREE_1128), goal = aimsOf(model)[0]!
      const size = new Map([[QUESTION, { width: questionBarWidth(model, row), height: 85 }], ...model.cards.map((c) => [c.id, { width: row.cardW, height: c.h }] as const)])
      const into = model.links.filter((l) => l.to === goal).map((l) => l.from)
      const staged = await causalPlaces(model, size, { row }), plain = await causalPlaces(model, size)
      const measure = into.map((id) => staged.get(id)!).filter((p) => p.y === staged.get(goal)!.y)
      expect(measure.length, 'a card linking into the goal shares its row').toBeGreaterThan(0)
      expect(staged.get(goal)!.x).toBeGreaterThan(Math.max(...measure.map((p) => p.x)))
      expect(Math.max(...[...staged.values()].map((p) => p.y)), 'one row shorter').toBeLessThan(Math.max(...[...plain.values()].map((p) => p.y)))
      expect(into.some((id) => plain.get(id)!.y === plain.get(goal)!.y), 'CONTRAST: without the stage, below it').toBe(false)
    })
  }

  for (const [name, view] of Object.entries(BOARDS)) {
    it(`${name} at 1128 (DL 1232 fault 3): every row but the options is no wider than the stage at the readable floor (it wraps at the count that fits)`, async () => {
      const model = view.model!, row = stageRow(model, FREE_1128), opts = new Set(allOptionCards(model).map((c) => c.id))
      const size = new Map([[QUESTION, { width: questionBarWidth(model, row), height: 85 }], ...model.cards.map((c) => [c.id, { width: row.cardW, height: c.h }] as const)])
      const places = await causalPlaces(model, size, { row })
      const rows = new Map<number, number[]>()
      for (const [id, p] of places) if (id !== QUESTION && !opts.has(id)) rows.set(p.y, [...(rows.get(p.y) ?? []), p.x])
      for (const [y, xs] of rows) expect((Math.max(...xs) + row.cardW - Math.min(...xs)) * READABLE_WHOLE_ZOOM, `row at y ${y}`).toBeLessThanOrEqual(FREE_1128 + 0.5)
    })
  }

  it('the joined run\'s copy at 1232 (4352bfa3, s_8ade64308cc5 v5; DL 1232 fault 3): its four options fit across, and so does every other row', async () => {
    const view = load('live-4352bfa3-copy-v5.view.json'), model = view.model!, FREE_1232 = 885 - 45 // the dock from x 885 at 1232 (4162-1232-a-open.png)
    const row = stageRow(model, FREE_1232), size = new Map([[QUESTION, { width: questionBarWidth(model, row), height: 85 }], ...model.cards.map((c) => [c.id, { width: row.cardW, height: c.h }] as const)])
    const places = await causalPlaces(model, size, { row })
    const rows = new Map<number, number[]>()
    for (const [id, p] of places) if (id !== QUESTION) rows.set(p.y, [...(rows.get(p.y) ?? []), p.x])
    for (const [y, xs] of rows) expect((Math.max(...xs) + row.cardW - Math.min(...xs)) * READABLE_WHOLE_ZOOM, `row at y ${y}`).toBeLessThanOrEqual(FREE_1232 + 0.5)
    // and the board as a whole (its rows start together), so nothing is cut at the panel's edge on open
    const xs = [...places].filter(([id]) => id !== QUESTION).map(([, p]) => p.x)
    expect((Math.max(...xs) + row.cardW - Math.min(...xs)) * READABLE_WHOLE_ZOOM, 'the whole board').toBeLessThanOrEqual(FREE_1232 + 0.5)
  })
})

describe('DL-REQ-0020 question bar', () => {
  const model = BOARDS.run2.model!
  const options = allOptionCards(model)
  const removedOptions = new Set(options.slice(1).map((c) => c.id))
  const single = {
    ...model,
    cards: model.cards.filter((c) => !removedOptions.has(c.id)),
    links: model.links.filter((l) => !removedOptions.has(l.from) && !removedOptions.has(l.to)),
  }
  const removedAfterTwo = new Set(options.slice(2).map((c) => c.id))
  const two = {
    ...model,
    cards: model.cards.filter((c) => !removedAfterTwo.has(c.id)),
    links: model.links.filter((l) => !removedAfterTwo.has(l.from) && !removedAfterTwo.has(l.to)),
  }

  for (const simple of [false, true]) {
    const mode = simple ? 'Simple' : 'Detailed'
    const rowAt = (roomW: number, board = model) => simple
      ? { ...simpleStageRow(roomW), questionGapX: undefined }
      : stageRow(board, roomW)

    it.each([[1440, FREE_1440], [2000, FREE_2000]])(`${mode} at %i with the dock open: five options, two-card question, at the options row start (Detailed) / centred over the first options row (Simple)`, async (_stageW, roomW) => {
      const row = rowAt(roomW)
      expect(options).toHaveLength(5)
      const cardW = simple ? simpleBand(row, options.length).w : row.cardW
      const cap = 2 * cardW + (row.questionGapX ?? row.gapX)
      const width = questionBarWidth(model, row)
      const size = new Map([[QUESTION, { width, height: 85 }], ...model.cards.map((c) => [c.id, { width: row.cardW, height: c.h }] as const)])
      const places = await causalPlaces(model, size, { row })
      const question = places.get(QUESTION)!
      expect(width).toBe(cap)
      expect(question.w ?? width).toBe(cap)
      const optionPlaces = options.map((c) => places.get(c.id)!)
      if (simple) {
        const firstY = Math.min(...optionPlaces.map((p) => p.y))
        const first = optionPlaces.filter((p) => p.y === firstY)
        const centre = (Math.min(...first.map((p) => p.x)) + Math.max(...first.map((p) => p.x + p.w!))) / 2
        expect(Math.abs(question.x + width / 2 - centre)).toBeLessThanOrEqual(1)
      } else {
        expect(question.x).toBe(Math.min(...optionPlaces.map((p) => p.x)))
      }
    })

    it(`${mode} with one option: the question keeps the card's width`, () => {
      const row = simple ? simpleStageRow(FREE_2000) : stageRow(single, FREE_2000)
      const cardW = simple ? simpleBand(row, 1).w : row.cardW
      expect(questionBarWidth(single, row)).toBe(cardW)
    })

    it(`${mode} with two options: the question keeps the two-card span`, () => {
      const row = rowAt(FREE_2000, two)
      const cardW = simple ? simpleBand(row, 2).w : row.cardW
      expect(questionBarWidth(two, row)).toBe(2 * cardW + (row.questionGapX ?? row.gapX))
    })
  }
})
