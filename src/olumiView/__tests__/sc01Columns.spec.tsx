/**
 * SC-01 PREVIEW (option A, Paul 8 Nov): the cause-to-aim story in three columns, read left to right, and option cards that leave a reason
 * every option shares to the panel. Bound by identity on the REAL View core 5d8a009b served for the 16-card growth board (fixtures/sc01).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render } from '@testing-library/react'
import type { View } from '../client'
import { causalColumns, drawnModelOf, QUESTION, questionPlace, sharedAimsOf, CARD_WIDTH } from '../layout'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'

const view: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/sc01/growth16.core-5d8a009b.view3.json'), 'utf8'))
const model = view.model!
const colOf = (places: Map<string, { x: number }>) => { const xs = [...new Set([...places.values()].map((p) => p.x))].sort((a, b) => a - b); return (id: string) => xs.indexOf(places.get(id)!.x) }

describe('three columns, cause to aim, left to right (real 16-card View)', () => {
  // J1 step 1: the board draws the model less the relation cards that are their link (drawnModelOf), and the right column takes the aim
  // and each next layer while it stays no taller than the middle one.
  const drawn = drawnModelOf(model)
  const places = causalColumns(drawn, new Map(), questionPlace(drawn).width)
  const col = colOf(places)
  it('the question and the options on the left; the causes in the middle; what feeds the aim and the aim on the right', () => {
    expect(col(QUESTION)).toBe(0)
    for (const id of ['product_team_beachhead', 'top_down_enterprise_sale', 'partner_led_pilots', 'self_serve_platform']) expect(col(id), id).toBe(0)
    for (const id of ['speed_to_value', 'cross_team_adoption', 'implementation_effort', 'pilot_conversion', 'execution_complexity']) expect(col(id), id).toBe(1)
    for (const id of ['arr_2027', 'arr_target', 'sustainable_enterprise_growth']) expect(col(id), id).toBe(2)
    for (const id of ['i_speed_pilot', 'i_adoption_pilot', 'i_effort_pilot', 'i_pilot_arr']) expect(places.has(id), `${id} is drawn as its link`).toBe(false)
  })
  it('every card is placed once, and no two overlap', () => {
    expect(places.size).toBe(drawn.cards.length + 1)
    const box = (id: string) => ({ ...places.get(id)!, w: id === QUESTION ? questionPlace(model).width : CARD_WIDTH, h: id === QUESTION ? 85 : model.cards.find((c) => c.id === id)!.h })
    const ids = [...places.keys()]
    for (const a of ids) for (const b of ids) if (a < b) { const p = box(a), q = box(b); expect(p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h, `${a} on ${b}`).toBe(false) }
  })
  it('the right column reads down to the aim: what feeds it first, the aim last', () => {
    const y = (id: string) => places.get(id)!.y
    expect(y('arr_2027')).toBeLessThan(y('sustainable_enterprise_growth'))
    expect(Math.max(...[...places].filter(([id]) => col(id) === 2).map(([id]) => y(id)))).toBe(y('sustainable_enterprise_growth'))
  })
  // UI restore stage 1 (DL ruling 10 Nov): three-column width and 1232 fit retired; restoreLayout.spec.ts pins their replacement.
})

describe('an option card leaves a reason every option shares to the panel (core run.shared_blockers, by aim id and option id)', () => {
  const option = model.cards.find((c) => c.id === 'product_team_beachhead')!
  const shared = sharedAimsOf(model.run, option.id)
  const reason = option.rows.findIndex((r) => r.kind === 'none')
  it('core covers this option for its aim, and its card draws no repeat of the reason', () => {
    expect(shared).toEqual(['sustainable_enterprise_growth'])
    expect(reason).toBeGreaterThanOrEqual(0)
    const c = render(<ViewCard card={option} shared={shared} />).container
    expect(c.querySelector(`[data-view^="${option.id}.rows.${reason}."]`)).toBeNull()
    expect(c.querySelector(`[data-view="${option.id}.heading"]`)?.textContent).toBe(option.heading)
  })
  it('CONTRAST: an option core does not cover keeps its row', () => {
    expect(sharedAimsOf({ ...model.run!, shared_blockers: [] }, option.id)).toEqual([])
    const c = render(<ViewCard card={option} />).container
    expect(c.querySelector(`[data-view="${option.id}.rows.${reason}.text"]`)?.textContent).toBe((option.rows[reason] as { text?: string | null }).text)
  })
})
