/**
 * SC-01, option C (today's family rows): a short row under a wrapped one stays under what it hangs from. Real path: the View core 5d8a009b
 * served for the 16-card growth board (fixtures/sc01). The factor row (10 cards) wraps into staggered lines and moves; the risk row below it
 * (one card, "Execution complexity", linked to "Annual recurring revenue in 2027") kept the place it had under the UNWRAPPED row, so it sat
 * past the board's right edge (x 1594 at 1232 x 704, 7 Nov run class: 12 of 16 off screen).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../client'
import { causalPlaces, QUESTION, questionPlace } from '../layout'

const view: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/sc01/growth16.core-5d8a009b.view3.json'), 'utf8'))
const model = view.model!
const W = 220

describe('a short row stays under what it hangs from after the row above wraps (real 16-card View)', () => {
  it('the risk card sits under the card it feeds, inside the board, not past its right edge', async () => {
    const places = await causalPlaces(model, new Map(), questionPlace(model).width)
    const risk = places.get('execution_complexity')!, fed = places.get('arr_2027')!
    expect(risk.x + W / 2).toBeCloseTo(fed.x + W / 2)
    const others = [...places].filter(([id]) => id !== 'execution_complexity' && id !== QUESTION)
    expect(risk.x + W).toBeLessThanOrEqual(Math.max(...others.map(([, p]) => p.x + W)))
  })
  it('CONTRAST: the wrapped factor row keeps its staggered lines (the rows that wrap are not re-aligned)', async () => {
    const places = await causalPlaces(model, new Map(), questionPlace(model).width)
    const factors = ['speed_to_value', 'i_speed_pilot', 'pilot_conversion', 'i_pilot_arr', 'arr_target', 'implementation_effort', 'i_effort_pilot', 'cross_team_adoption', 'i_adoption_pilot', 'arr_2027']
    expect(new Set(factors.map((id) => places.get(id)!.y)).size).toBeGreaterThan(1)
  })
})
