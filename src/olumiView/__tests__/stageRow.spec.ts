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
import { allOptionCards, CARD_WIDTH, CARD_MIN_W, causalPlaces, QUESTION, questionBarWidth, ROW_GAP_X, stageRow } from '../layout'

const load = (f: string) => JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures', f), 'utf8')) as View
const BOARDS = { run2: load('live-v51-run2-approved.view.json'), run1: load('live-v51-run1-pending.view.json') }
const FREE_1128 = 1128 - (1128 - 811) - 45, FREE_2000 = 2000 - (2000 - 1640) - 45

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
      // the question bar starts where the options row starts and spans it
      expect(places.get(QUESTION)!.x).toBe(Math.min(...xs.map((p) => p.x)))
      expect(questionBarWidth(model, row)).toBe(ids.length * row.cardW + (ids.length - 1) * row.gapX)
    })

    it(`${name} at 2000: the full card and gap where they fit (CONTRAST: the stage does not shrink a board that fits)`, () => {
      expect(stageRow(model, FREE_2000)).toEqual({ cardW: CARD_WIDTH, gapX: ROW_GAP_X })
    })
  }

  it('a stage too narrow for the row keeps the card at its floor (the rest pans)', () => {
    expect(stageRow(BOARDS.run1.model!, 300).cardW).toBe(CARD_MIN_W)
  })
})
