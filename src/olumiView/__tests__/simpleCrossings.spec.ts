import { describe, expect, it } from 'vitest'
import type { View } from '../client'
import european from '../fixtures/real/european-22cards.view3.json'
import hiring from '../fixtures/real/hiring.view3.json'
import capacity from '../fixtures/real/capacity.view3.json'
import bakery from '../fixtures/real/bakery-r5.view3.json'
import together from '../fixtures/real/together.view3.json'
import paLike from '../fixtures/pa-like.view3.json'
import { boardOf } from '../canvas'
import { causalPlaces, QUESTION, simpleStageRow } from '../layout'
import { useViewStore } from '../store'
import { BAND_ORDER, bandOf } from '../v12/bands/bands'
import { showSimple } from '../v12/simpleStore'
import { boardCrossings } from './support/boardCrossings'

const fixtures = { 'european-22cards': european, hiring, capacity, 'bakery-r5': bakery, together, 'PA-like': paLike }
const WIDTHS = [700, 1232, 2000] as const

/** [curved crossings, links through a non-end card], using fixture heights and the renderer's beziers with 256-segment sampling.
 * Re-measured 8693c5a8 at 700, 1232 and 2000 px, respectively:
 * european: [36,43], [58,47], [58,47]; hiring: [27,33], [38,29], [38,29];
 * capacity: [21,20], [14,13], [14,13]; bakery: [9,15], [7,16], [7,16];
 * together: [1,5], [0,1], [0,1]; PA-like: [2,10], [2,10], [2,10].
 * The single-sequence layout lowers the capacity ceilings. Future changes may only lower these counts.
 */
const BASE: Record<keyof typeof fixtures, Record<(typeof WIDTHS)[number], readonly [crossings: number, cardHits: number]>> = {
  'european-22cards': { 700: [36, 43], 1232: [58, 47], 2000: [58, 47] },
  hiring: { 700: [27, 33], 1232: [38, 29], 2000: [38, 29] },
  capacity: { 700: [13, 20], 1232: [9, 12], 2000: [9, 12] },
  'bakery-r5': { 700: [9, 15], 1232: [7, 16], 2000: [7, 16] },
  together: { 700: [1, 5], 1232: [0, 1], 2000: [0, 1] },
  'PA-like': { 700: [2, 10], 1232: [2, 10], 2000: [2, 10] },
}

describe('Simple layout crossings (card links and grouped-card connectors, three widths)', () => {
  it.each(Object.keys(fixtures) as (keyof typeof fixtures)[])('%s', async (name) => {
    const view = fixtures[name] as unknown as View
    showSimple(view.id)
    useViewStore.setState({ sid: view.id, view })
    const { model, extras, links: groupLinks } = boardOf(view.model!, {})
    const bandIds = new Map([
      ...model.cards.map((card) => [card.id, bandOf(card, model)] as const),
      ...extras.map(({ id, band }) => [id, band] as const),
    ])
    const bands = [[QUESTION], ...BAND_ORDER.map((band) => [...bandIds.keys()].filter((id) => bandIds.get(id) === band))]
    let firstOrder: string[][] | undefined
    for (const w of WIDTHS) {
      const places = await causalPlaces(model, new Map(), { row: simpleStageRow(w), extras, groupLinks })
      const order = bands.map((ids) => [...ids].sort((a, b) => {
        const left = places.get(a)!, right = places.get(b)!
        return left.y - right.y || left.x - right.x
      }))
      firstOrder ??= order
      expect(order, `${name} at ${w}px: band order`).toEqual(firstOrder)
      const count = await boardCrossings(view, w)
      console.log(`CROSSINGS ${name} ${w} ${JSON.stringify(count)}`)
      expect.soft(count.crossings, `${name} at ${w}px: crossings`).toBeLessThanOrEqual(BASE[name][w][0])
      expect.soft(count.cardHits, `${name} at ${w}px: links through a card`).toBeLessThanOrEqual(BASE[name][w][1])
    }
  })
})
