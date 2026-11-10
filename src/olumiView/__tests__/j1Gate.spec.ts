/**
 * J1 GATE (UI session 8 Nov, Paul: "the prototypes look beautiful and the built UI looks terrible"): the route board (layout.ts routeTree).
 * The question heads a left column with the routes (options) under it; the story reads top down beside them, where it ends at the bottom;
 * and the 16-card growth board is whole at full size beside the 300 px dock at 1232 x 704. Bound by identity on the REAL Views core
 * 5d8a009b served (fixtures/sc01 growth board, fixtures/j1 bookshop first look).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../client'
import { causalPlaces, drawnModelOf, QUESTION, questionPlace, routeTree, TREE_GAP_Y } from '../layout'

const load = (f: string): View => JSON.parse(readFileSync(path.resolve(f), 'utf8'))
const growth = drawnModelOf(load('src/olumiView/fixtures/sc01/growth16.core-5d8a009b.view3.json').model!)
const bookshop = drawnModelOf(load('src/olumiView/fixtures/j1/bookshop-v1-open.core-5d8a009b.view3.json').model!)

describe('the route board (real 16-card growth View)', () => {
  const places = routeTree(growth, new Map(), questionPlace(growth).width)
  const at = (id: string) => places.get(id)!
  it('the question heads the left column and the four routes stand under it', () => {
    expect(at(QUESTION)).toEqual({ x: 0, y: 0 })
    let last = 0
    for (const id of ['product_team_beachhead', 'top_down_enterprise_sale', 'partner_led_pilots', 'self_serve_platform']) {
      expect(at(id).x, id).toBe(0)
      expect(at(id).y, id).toBeGreaterThan(last)
      last = at(id).y
    }
  })
  it('the story reads top down beside them: every link runs from a higher row to a lower one, the aim at the bottom', () => {
    for (const l of growth.links) {
      if (l.kind === 'reason' || !places.has(l.from) || !places.has(l.to) || at(l.from).x === 0) continue
      expect(at(l.from).y, `${l.from} -> ${l.to}`).toBeLessThan(at(l.to).y)
    }
    const lowest = Math.max(...[...places.values()].filter((p) => p.x > 0).map((p) => p.y)) // the story's rows, beside the routes
    expect(at('sustainable_enterprise_growth').y).toBe(lowest)
    expect([at('speed_to_value').y, at('cross_team_adoption').y, at('implementation_effort').y]).toEqual([0, 0, 0])
  })
  // UI restore stage 1 (DL ruling 10 Nov): the route-width limit is retired; keep every drawn card and leave relation cards as links.
  it('the restored growth board places each drawn card once, and relation cards stay links', async () => {
    const restored = await causalPlaces(growth, new Map())
    expect([...restored.keys()].sort()).toEqual([QUESTION, ...growth.cards.map((c) => c.id)].sort())
    for (const id of ['i_speed_pilot', 'i_adoption_pilot', 'i_effort_pilot', 'i_pilot_arr']) expect(restored.has(id), `${id} is drawn as its link`).toBe(false)
  })
  it('the rows share the room they are given, never closer than TREE_GAP_Y', () => {
    const tight = routeTree(growth, new Map(), questionPlace(growth).width, new Set(), 0)
    const roomy = routeTree(growth, new Map(), questionPlace(growth).width, new Set(), 2000)
    const row1 = (p: Map<string, { y: number }>) => p.get('pilot_conversion')!.y - p.get('speed_to_value')!.y
    expect(row1(roomy)).toBeGreaterThan(row1(tight))
    expect(row1(tight)).toBe(growth.cards.find((c) => c.id === 'speed_to_value')!.h + TREE_GAP_Y)
  })
})

describe('the route board (real bookshop first look)', () => {
  const places = routeTree(bookshop, new Map(), questionPlace(bookshop).width)
  it('the two ideas under the question; the rival above the drivers it moves; revenue, where the story ends, at the bottom', () => {
    expect(places.get('newsletter')!.x).toBe(0)
    expect(places.get('price_cut')!.x).toBe(0)
    expect(places.get('rival_sales')!.y).toBeLessThan(places.get('visits')!.y)
    expect(places.get('visits')!.y).toBe(places.get('spend_per_visit')!.y)
    expect(places.get('monthly_revenue')!.y).toBeGreaterThan(places.get('visits')!.y)
  })
})
