/**
 * P1 (DL 10 Nov): core's reading of an aim ("Olumi reads this at the end of 3 months; change it if you meant over the period or on
 * average.") is said once, on that aim's own card; the Analysis panel no longer repeats it. Two aims with the same sentence each keep
 * their own: each card says its own. Bound on the 04:35Z judged hiring View (fixtures/rehearsal, core 97f8c61a + ad57a105): two readings,
 * one per aim, by aim id.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../client'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'
import { AnalysisHeroPanel } from '../port/AnalysisHeroPanel'
import { readingOf } from '../layout'

const view = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/rehearsal', 'hiring-judged.core-97f8c61a+ad57a105.view3.json'), 'utf8')) as View
const model = view.model!, readings = model.run!.readings
afterEach(cleanup)

describe('an aim\'s reading is said once, on its own card', () => {
  it('AR1 precondition: two readings, one per aim, the same sentence', () => {
    expect(readings.map((r) => r.aim_id)).toEqual(['increase_productivity', 'maintaining_code_quality'])
    expect(readings[0]!.text).toBe(readings[1]!.text)
  })
  it('AR2 catch: the Analysis panel draws no reading, by path or by its words', () => {
    const c = render(<AnalysisHeroPanel model={model} chat={view.chat} />).container
    expect(c.querySelector('[data-view^="run.readings."]')).toBeNull()
    expect(c.textContent).not.toContain(readings[0]!.text)
  })
  it('AR3 must not change: each aim\'s card draws its own reading, once', () => {
    for (const r of readings) {
      const card = model.cards.find((x) => x.id === r.aim_id)!
      const c = render(<ViewCard card={card} reading={readingOf(model, card.id)} />).container
      const el = c.querySelectorAll(`[data-view="${card.id}.reading"]`)
      expect(el).toHaveLength(1)
      expect(el[0]!.textContent).toBe(r.text)
      cleanup()
    }
  })
})
