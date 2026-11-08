/**
 * J1 step 1 (DL 8 Nov, Codex's order: "one readable path"): on the real View core 5d8a009b served for the prototype's bookshop brief
 * (fixtures/j1), the board's first look opens the cards' folds so Olumi's inferred route is on the board; a relation card that explains a
 * drawn link is drawn as that link; the story reads left to right, the options, then the causes, then the figure they move.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../client'
import { causalColumns, drawnModelOf, firstLookOpen, linkCards, QUESTION, questionPlace } from '../layout'

const load = (f: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/j1', f), 'utf8'))
const shut = load('bookshop-v1.core-5d8a009b.view3.json'), open = load('bookshop-v1-open.core-5d8a009b.view3.json')
const NONE = { open: new Map<string, readonly string[]>(), all: false }

describe('the first look opens what core folded into the cards, never the question’s fold', () => {
  it('version 1: the revenue card’s fold (Olumi’s reading of what drives it) and the newsletter’s are opened, by core’s record ids', () => {
    const o = firstLookOpen(shut, NONE)
    expect([...o.keys()].sort()).toEqual(['monthly_revenue', 'newsletter'])
    expect(o.get('monthly_revenue')).toEqual(shut.model!.cards.find((c) => c.id === 'monthly_revenue')!.badge!.records)
    expect(o.has(QUESTION)).toBe(false)
  })
  it('CONTRAST: a later version, or a fold the person already opened or shut, opens nothing', () => {
    expect(firstLookOpen({ ...shut, version: { ...shut.version!, n: 2 } }, NONE).size).toBe(0)
    expect(firstLookOpen(shut, { open: new Map([['newsletter', ['reminded']]]), all: false }).size).toBe(0)
    expect(firstLookOpen(shut, { open: new Map(), all: true }).size).toBe(0)
  })
})

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
