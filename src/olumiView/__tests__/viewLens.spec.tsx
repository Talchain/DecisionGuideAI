/**
 * The lenses back on the core lane (DL 4 Nov), fed from core's View only: a lens bar on the lane's own canvas with Model and Rests on.
 * Rests on numbers every figure a person can set and every assumption and condition, in the View's order; Olumi's (core's mark) are the
 * ones to check or set, drawn in Olumi's blue and counted on the bar. Nothing is dimmed, and a lens writes nothing.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { View } from '../client'
import { restsOnOf } from '../layout'
import { useViewLens } from '../lens'
import { useViewStore } from '../store'
import { ViewLensBar } from '../ViewLensBar'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'

const view: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/european.view.json'), 'utf8'))
const model = view.model!
afterEach(() => { cleanup(); useViewLens.setState({ lens: 'full' }); useViewStore.setState({ view: null }) })

describe('Rests on, from the View', () => {
  it('european: every figure core offers to edit and every assumption and condition, numbered in the View\'s order', () => {
    const { items, olumi } = restsOnOf(model)
    expect([...items.values()].map((i) => [i.id, i.n])).toEqual(['starting_customers', 'customer_target', 'entry_delay', 'entry_interpretation',
      'churn_danger_threshold', 'broad_entry_acquisitions', 'pilot_acquisitions', 'expansion_churn', 'shared_churn_stress', 'investment_cap',
      'broad_entry_investment', 'pilot_investment', 'target_interpretation', 'customer_flow_assumptions', 'country_readiness'].map((id, i) => [id, i + 1]))
    expect([...items.values()].filter((i) => i.olumi).map((i) => i.id)).toEqual(['entry_interpretation', 'broad_entry_acquisitions', 'pilot_acquisitions',
      'expansion_churn', 'shared_churn_stress', 'broad_entry_investment', 'pilot_investment', 'target_interpretation', 'customer_flow_assumptions', 'country_readiness'])
    expect(olumi).toBe(10)
  })

  it('CONTRAST: a figure core works out from others (no edit), an option and the goal rest on nothing', () => {
    const { items } = restsOnOf(model)
    for (const id of ['customers', 'broader_entry', 'reach_customer_target']) expect(items.has(id), id).toBe(false)
  })

  it('on a card: its number, in Olumi\'s blue with core\'s mark as its hover when Olumi\'s; a person\'s in the plain ink', () => {
    const { items } = restsOnOf(model)
    const mine = model.cards.find((c) => c.id === 'starting_customers')!, olumis = model.cards.find((c) => c.id === 'broad_entry_acquisitions')!
    const a = render(<ViewCard card={mine} restsOn={items.get(mine.id)!} />).container.querySelector<HTMLElement>('[data-rests-on]')!
    expect([a.textContent, a.dataset['restsOnOlumi'], a.className.includes('text-info')]).toEqual(['1', undefined, false])
    const b = render(<ViewCard card={olumis} restsOn={items.get(olumis.id)!} />).container.querySelector<HTMLElement>('[data-rests-on]')!
    expect([b.textContent, b.dataset['restsOnOlumi'], b.className.includes('text-info'), b.title]).toEqual(['6', 'true', true, olumis.olumi!.title])
  })

  it('must not change: with no lens on, a card draws no number', () => {
    expect(render(<ViewCard card={model.cards[0]!} />).container.querySelector('[data-rests-on]')).toBeNull()
  })
})

describe('the lane\'s lens bar', () => {
  it('Model and Rests on, Rests on counting Olumi\'s to check or set; a press switches the lens', () => {
    useViewStore.setState({ view })
    render(<ViewLensBar />)
    expect(screen.getAllByRole('radio').map((b) => b.textContent)).toEqual(['Model', 'Rests on10'])
    expect(screen.getByTestId('lens-bar-rests_on').getAttribute('aria-label')).toBe('Rests on, 10 to check or set')
    expect(screen.getByTestId('lens-bar-full').getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByTestId('lens-bar-rests_on'))
    expect(useViewLens.getState().lens).toBe('rests_on')
    expect(screen.getByTestId('lens-bar-rests_on').getAttribute('aria-checked')).toBe('true')
  })
})
