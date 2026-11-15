/**
 * Old look, the stage's width (DL-support 15 Nov 00:40Z: "the third and fourth options behind the side panel"; measured in the gallery on
 * core 652ef452's eight Views at 1232x704: cards cut by or behind the panel in 8 of 8). The board's rows wrap at the count of cards that
 * stand across the free canvas (canvas.ts roomOf), the head (the question and the aims) wraps at the same width, and every row below it
 * stands inside [0, roomW]. Bound by card id; geometry only, no word of core's is read.
 *
 * The catch rows fail on the layout before this change (it had no room input: rows were the previous layout's five across, centred each on
 * its own centre, and the head ran on in one line); each has a contrast row showing the fault is there without the room.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../client'
import { currentModel } from '../store'
import { CARD_WIDTH, QUESTION, aimsOf, causalPlaces, headLines, perRowOf, rowsInRoom } from '../layout'

const core = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/core-652ef452', `${n}.view3.json`), 'utf8'))
/** The free canvas at Paul's two narrower sizes, as the gallery measured it (pane less the left tools and the side panel), at full size. */
const ROOM_1232 = 821, ROOM_1500 = 1070

describe('the old look\'s rows wrap at the stage\'s width', () => {
  it('perRowOf: the cards of the old look\'s width that stand across, a row gap apart; at least one', () => {
    expect(CARD_WIDTH).toBe(248)
    expect([perRowOf(ROOM_1232), perRowOf(ROOM_1500), perRowOf(1580), perRowOf(100)]).toEqual([2, 3, 5, 1])
  })
  it('headLines: the question and the aims in order, a new line where the next would pass the room; one line where the room is unknown', () => {
    const w = (id: string) => (id === 'q' ? 272 : 248)
    expect(headLines(['q', 'a1', 'a2', 'a3'], w, ROOM_1232)).toEqual([['q', 'a1', 'a2'], ['a3']])
    expect(headLines(['q', 'a1', 'a2', 'a3'], w, 0)).toEqual([['q', 'a1', 'a2', 'a3']])
    expect(headLines(['q'], w, 100)).toEqual([['q']]) // a card wider than the room still stands, alone on its line
  })
  it('rowsInRoom: a row past the right edge moves left only as far as it must, a row left of 0 moves right, order kept; a row in the room stays', () => {
    const packed = new Map([['r1', { x: 600, y: 10 }], ['r2', { x: 896, y: 10 }], ['l1', { x: -100, y: 20 }], ['ok', { x: 100, y: 30 }]])
    rowsInRoom(packed, ['r1', 'r2', 'l1', 'ok'], ROOM_1232)
    expect(packed.get('r2')!.x + CARD_WIDTH).toBe(ROOM_1232)
    expect(packed.get('r2')!.x - packed.get('r1')!.x).toBe(296)
    expect(packed.get('l1')!.x).toBe(0)
    expect(packed.get('ok')!.x).toBe(100)
  })
})

describe('core 652ef452\'s own Views, laid out for the stage', () => {
  const NAMES = ['app-launch', 'bakery', 'bakery-asked', 'european', 'pricing', 'proposal', 's_ce285b3617bb', 'studio']
  const outside = (places: Map<string, { x: number; y: number }>, ids: readonly string[], roomW: number, widthOf: (id: string) => number) =>
    ids.filter((id) => { const p = places.get(id)!; return p.x < 0 || p.x + widthOf(id) > roomW + 0.5 })

  for (const roomW of [ROOM_1232, ROOM_1500]) {
    it(`catch at ${roomW}: on every View, every card and the question stand inside the free canvas (none under the side panel)`, async () => {
      for (const n of NAMES) {
        const model = currentModel({ view: core(n), error: null, stale: false })!
        const places = await causalPlaces(model, new Map(), { roomW })
        const ids = [QUESTION, ...model.cards.map((c) => c.id)]
        expect(ids.every((id) => places.has(id)), n).toBe(true)
        expect(outside(places, ids, roomW, (id) => (id === QUESTION ? 272 : CARD_WIDTH)), `${n} at ${roomW}`).toEqual([])
      }
    })
  }
  it('contrast: without the room (the layout before this change), the same Views run past the 1232 stage', async () => {
    let past = 0
    for (const n of NAMES) {
      const model = currentModel({ view: core(n), error: null, stale: false })!
      const places = await causalPlaces(model, new Map())
      past += outside(places, [QUESTION, ...model.cards.map((c) => c.id)], ROOM_1232, (id) => (id === QUESTION ? 272 : CARD_WIDTH)).length
    }
    expect(past).toBeGreaterThan(0)
  })
  it('must not change: the question first at the top left, the aims after it in the View\'s order, and the options below the head', async () => {
    const model = currentModel({ view: core('app-launch'), error: null, stale: false })!
    const places = await causalPlaces(model, new Map(), { roomW: ROOM_1232 })
    expect(places.get(QUESTION)).toEqual({ x: 0, y: 0 })
    const aims = aimsOf(model), headFoot = Math.max(...[QUESTION, ...aims].map((id) => places.get(id)!.y))
    const reading = aims.map((id) => [places.get(id)!.y, places.get(id)!.x])
    for (let i = 1; i < reading.length; i++) expect(reading[i]![0]! > reading[i - 1]![0]! || (reading[i]![0] === reading[i - 1]![0] && reading[i]![1]! > reading[i - 1]![1]!)).toBe(true)
    for (const c of model.cards) if (c.family === 'option') expect(places.get(c.id)!.y, c.id).toBeGreaterThan(headFoot)
  })
})
