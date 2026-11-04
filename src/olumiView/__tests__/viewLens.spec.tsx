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
import { driversOf, restsOnOf } from '../layout'
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
    expect(screen.getAllByRole('radio').map((b) => b.textContent)).toEqual(['Model', 'Rests on10', 'What would change'])
    expect(screen.getByTestId('lens-bar-rests_on').getAttribute('aria-label')).toBe('Rests on, 10 to check or set')
    expect(screen.getByTestId('lens-bar-full').getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByTestId('lens-bar-rests_on'))
    expect(useViewLens.getState().lens).toBe('rests_on')
    expect(screen.getByTestId('lens-bar-rests_on').getAttribute('aria-checked')).toBe('true')
  })
})

/** The european golden as core e16a497 serves it: each option's driver names its figure, `existing_market_acquisitions` (core's golden). */
const withFigures = (figure: string | null): View => ({ ...view, model: { ...model, cards: model.cards.map((c) => (c.driver ? { ...c, driver: { ...c.driver, figure } } : c)) } })

describe('What would change, from the View', () => {
  it('european: the figure all three options move most with is folded into the customers card, which carries them in the View\'s order', () => {
    const d = driversOf(withFigures('existing_market_acquisitions').model!)
    expect([...d].map(([id, os]) => [id, os.map((o) => o.id)])).toEqual([['customers', ['broader_entry', 'single_country_test', 'no_new_european_entry']]])
  })
  it('a figure that is its own card is marked on it', () => {
    expect([...driversOf(withFigures('starting_customers').model!).keys()]).toEqual(['starting_customers'])
  })
  it('CONTRAST: no figure named, or one no card draws or folds: nothing is marked (never matched by its heading)', () => {
    // (Not the golden as vendored: from core e16a497 on it names its figures itself.)
    expect(driversOf(withFigures(null).model!).size).toBe(0)
    expect(driversOf(withFigures('New customers from existing markets').model!).size).toBe(0)
  })
  it('on the card: how many options it moves, core\'s driver words on hover, the card ringed', () => {
    const d = driversOf(withFigures('existing_market_acquisitions').model!)
    const card = model.cards.find((c) => c.id === 'customers')!
    const c = render(<ViewCard card={card} driverOf={d.get('customers')!} />).container
    const chip = c.querySelector<HTMLElement>('[data-driver-of]')!
    expect([chip.textContent, chip.dataset['driverOf'], chip.title]).toEqual(['3', 'broader_entry single_country_test no_new_european_entry', d.get('customers')!.map((o) => o.driver!.title).join('\n')])
    expect(c.querySelector('[data-view-card]')!.className).toContain('ring-[3px]')
  })
  it('the bar: before a Run names a driver the lens is shown but cannot be chosen, and says how to get one; with one it switches', () => {
    useViewStore.setState({ view: withFigures(null) })
    const { unmount } = render(<ViewLensBar />)
    const lens = screen.getByTestId('lens-bar-what_changes')
    expect([lens.getAttribute('aria-disabled'), lens.title]).toEqual(['true', 'Run the analysis to see what would change it.'])
    fireEvent.click(lens)
    expect(useViewLens.getState().lens).toBe('full')
    unmount()
    useViewStore.setState({ view: withFigures('existing_market_acquisitions') })
    render(<ViewLensBar />)
    fireEvent.click(screen.getByTestId('lens-bar-what_changes'))
    expect(useViewLens.getState().lens).toBe('what_changes')
  })
})
