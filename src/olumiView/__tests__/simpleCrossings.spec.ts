import { describe, expect, it } from 'vitest'
import type { View } from '../client'
import european from '../fixtures/real/european-22cards.view3.json'
import hiring from '../fixtures/real/hiring.view3.json'
import capacity from '../fixtures/real/capacity.view3.json'
import bakery from '../fixtures/real/bakery-r5.view3.json'
import together from '../fixtures/real/together.view3.json'
import paLike from '../fixtures/pa-like.view3.json'
import { boardCrossings } from './support/boardCrossings'

const fixtures = { 'european-22cards': european, hiring, capacity, 'bakery-r5': bakery, together, 'PA-like': paLike }
const WIDTHS = [700, 1232, 2000] as const

/** [curved crossings, links through a non-end card], measured at 8693c5a8 (S4 lane E, 27 Nov; re-measured after review e2-r1: group connectors never take the upward path, 256-segment sampling) with the renderer's beziers, card links plus
 *  grouped-card connectors, fixture heights. A layout change may lower a count, never raise one; lower the table when it does. */
const BASE: Record<keyof typeof fixtures, Record<(typeof WIDTHS)[number], readonly [crossings: number, cardHits: number]>> = {
  'european-22cards': { 700: [36, 43], 1232: [58, 47], 2000: [58, 47] },
  hiring: { 700: [27, 33], 1232: [38, 29], 2000: [38, 29] },
  capacity: { 700: [21, 20], 1232: [14, 13], 2000: [14, 13] },
  'bakery-r5': { 700: [9, 15], 1232: [7, 16], 2000: [7, 16] },
  together: { 700: [1, 5], 1232: [0, 1], 2000: [0, 1] },
  'PA-like': { 700: [2, 10], 1232: [2, 10], 2000: [2, 10] },
}

describe('Simple layout crossings (card links and grouped-card connectors, three widths)', () => {
  it.each(Object.keys(fixtures) as (keyof typeof fixtures)[])('%s', async (name) => {
    for (const w of WIDTHS) {
      const count = await boardCrossings(fixtures[name] as unknown as View, w)
      console.log(`CROSSINGS ${name} ${w} ${JSON.stringify(count)}`)
      expect.soft(count.crossings, `${name} at ${w}px: crossings`).toBeLessThanOrEqual(BASE[name][w][0])
      expect.soft(count.cardHits, `${name} at ${w}px: links through a card`).toBeLessThanOrEqual(BASE[name][w][1])
    }
  })
})
