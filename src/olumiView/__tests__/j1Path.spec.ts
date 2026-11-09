/**
 * J1 step 1 (DL 8 Nov, Codex's order: "one readable path"): on the real View core 5d8a009b served for the prototype's bookshop brief
 * (fixtures/j1), a relation card that explains a drawn link is drawn as that link; the story reads left to right, the options, then the
 * causes, then the figure they move. (The first look no longer opens folds, DL ruling 9 Nov (ii): foldsStartClosed.spec.ts.)
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../client'
import { causalColumns, drawnModelOf, linkCards, QUESTION, questionPlace } from '../layout'

const load = (f: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/j1', f), 'utf8'))
const open = load('bookshop-v1-open.core-5d8a009b.view3.json')
describe('a relation card that explains a drawn link is that link', () => {
  const model = open.model!
  it('"Visits revenue", "Spend revenue" and "Reminded" are drawn as their links; the cards they join and the links between them stay', () => {
    expect([...linkCards(model)].sort()).toEqual(['reminded', 'spend_revenue', 'visits_revenue'])
    const drawn = drawnModelOf(model)
    expect(drawn.cards.map((c) => c.id)).toEqual(model.cards.filter((c) => c.family !== 'relation').map((c) => c.id))
    expect(drawn.links.map((l) => `${l.from}>${l.to}`)).toEqual(expect.arrayContaining(['visits>monthly_revenue', 'spend_per_visit>monthly_revenue', 'newsletter>visits']))
    expect(drawn.links.some((l) => l.kind === 'reason')).toBe(false)
  })
  it('CONTRAST: a relation card whose link is not drawn stays a card, so no dependency is lost', () => {
    const without = { ...model, links: model.links.filter((l) => !(l.from === 'visits' && l.to === 'monthly_revenue')) }
    expect(linkCards(without).has('visits_revenue')).toBe(false)
    expect(drawnModelOf(without).cards.some((c) => c.id === 'visits_revenue')).toBe(true)
  })
})

describe('left to right: the options, the causes, the figure they move', () => {
  const drawn = drawnModelOf(open.model!)
  const places = causalColumns(drawn, new Map(), questionPlace(drawn).width)
  const xs = [...new Set([...places.values()].map((p) => p.x))].sort((a, b) => a - b)
  const col = (id: string) => xs.indexOf(places.get(id)!.x)
  it('with no aim yet, the figure every link leads to ends the story on the right; its drivers and the risk are in the middle', () => {
    expect([col(QUESTION), col('newsletter'), col('price_cut')]).toEqual([0, 0, 0])
    expect([col('rival_sales'), col('visits'), col('spend_per_visit')]).toEqual([1, 1, 1])
    expect(col('monthly_revenue')).toBe(2)
  })
  it('the middle column reads down toward the figure: the rival (two links away) above the drivers (one link)', () => {
    expect(places.get('rival_sales')!.y).toBeLessThan(places.get('visits')!.y)
  })
})
