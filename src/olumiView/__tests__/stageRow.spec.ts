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
import { aimsOf, allOptionCards, CARD_WIDTH, CARD_MIN_W, causalPlaces, QUESTION, questionBarWidth, ROW_GAP_X, stageRow } from '../layout'

const load = (f: string) => JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures', f), 'utf8')) as View
const BOARDS = { run2: load('live-v51-run2-approved.view.json'), run1: load('live-v51-run1-pending.view.json') }
const FREE_1128 = 1128 - (1128 - 811) - 45, FREE_2000 = 2000 - (2000 - 1640) - 45

describe('the options row is sized to the stage (DL-538)', () => {
  for (const [name, view] of Object.entries(BOARDS)) {
    const model = view.model!, ids = allOptionCards(model).map((c) => c.id)

    it(`${name} at 1128: options stay in one readable row, overflow pans and the question stays within the stage`, async () => {
      const row = stageRow(model, FREE_1128)
      expect(row.cardW, 'narrower than the full card').toBeLessThan(CARD_WIDTH)
      const size = new Map([[QUESTION, { width: questionBarWidth(model, row), height: 85 }], ...model.cards.map((c) => [c.id, { width: row.cardW, height: c.h }] as const)])
      const places = await causalPlaces(model, size, { row })
      // The options stand in one row, packed at the stage's width and gap, spanning no more than the free canvas at the readable floor.
      const xs = ids.map((id) => places.get(id)!)
      expect(new Set(xs.map((p) => p.y)).size, 'one row').toBe(1)
      const span = Math.max(...xs.map((p) => p.x)) + row.cardW - Math.min(...xs.map((p) => p.x))
      expect(span).toBe(ids.length * row.cardW + (ids.length - 1) * row.gapX)
      expect(row.cardW).toBeGreaterThanOrEqual(224)
      // the question bar starts where the options row starts and spans it
      expect(places.get(QUESTION)!.x).toBe(Math.min(...xs.map((p) => p.x)))
      expect(questionBarWidth(model, row) * READABLE_WHOLE_ZOOM).toBeLessThanOrEqual(FREE_1128 + 0.5)
      expect(questionBarWidth(model, row)).toBeLessThan(span)
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
    it(`${name} at 1128: lower rows align with the options and remain within the same bounded pan span`, async () => {
      const model = view.model!, row = stageRow(model, FREE_1128), opts = new Set(allOptionCards(model).map((c) => c.id))
      const size = new Map([[QUESTION, { width: questionBarWidth(model, row), height: 85 }], ...model.cards.map((c) => [c.id, { width: row.cardW, height: c.h }] as const)])
      const places = await causalPlaces(model, size, { row })
      const rows = new Map<number, number[]>()
      for (const [id, p] of places) if (id !== QUESTION && !opts.has(id)) rows.set(p.y, [...(rows.get(p.y) ?? []), p.x])
      const left = Math.min(...[...opts].map(id => places.get(id)!.x))
      const span = Math.max(...[...opts].map(id => places.get(id)!.x)) + row.cardW - left
      for (const [y, xs] of rows) {
        expect(Math.min(...xs), `aligned row at y ${y}`).toBe(left)
        expect(Math.max(...xs) + row.cardW - left, `bounded row at y ${y}`).toBeLessThanOrEqual(span)
      }
    })
  }

  it('the joined copy at 1232 keeps readable cards aligned within one bounded horizontal pan span', async () => {
    const view = load('live-4352bfa3-copy-v5.view.json'), model = view.model!, FREE_1232 = 885 - 45 // the dock from x 885 at 1232 (4162-1232-a-open.png)
    const row = stageRow(model, FREE_1232), size = new Map([[QUESTION, { width: questionBarWidth(model, row), height: 85 }], ...model.cards.map((c) => [c.id, { width: row.cardW, height: c.h }] as const)])
    const places = await causalPlaces(model, size, { row })
    const rows = new Map<number, number[]>()
    const opts = new Set(allOptionCards(model).map(c => c.id))
    for (const [id, p] of places) if (id !== QUESTION && !opts.has(id)) rows.set(p.y, [...(rows.get(p.y) ?? []), p.x])
    const left = Math.min(...[...opts].map(id => places.get(id)!.x))
    const span = Math.max(...[...opts].map(id => places.get(id)!.x)) + row.cardW - left
    for (const [y, xs] of rows) {
      expect(Math.min(...xs), `aligned row at y ${y}`).toBe(left)
      expect(Math.max(...xs) + row.cardW - left, `bounded row at y ${y}`).toBeLessThanOrEqual(span)
    }
    expect(new Set([...opts].map(id => places.get(id)!.y)).size).toBe(1)
    expect(row.cardW).toBeGreaterThanOrEqual(224)
    expect(questionBarWidth(model, row) * READABLE_WHOLE_ZOOM).toBeLessThanOrEqual(FREE_1232 + 0.5)
  })
})
