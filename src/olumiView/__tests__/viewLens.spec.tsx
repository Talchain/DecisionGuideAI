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
    // core a0e144f6's european golden: the six figures core offers to edit, now including `existing_market_acquisitions`, the figure the Run names as
    // what moves every option's chance most, drawn as its own card (it was folded into `customers`' badge; `customers` is worked out from others, no edit,
    // so it is no longer on the list), the four assumptions and conditions, and the two options whose badges fold the Run's what-ifs
    // (`broad_entry_acquisitions`, `pilot_acquisitions`): all in the View's card order, numbered from 1.
    const ids = ['starting_customers', 'customer_target', 'entry_delay', 'churn_rate', 'churn_danger_threshold', 'existing_market_acquisitions',
      'customer_flow_assumptions', 'investment_cap', 'target_interpretation', 'broader_entry', 'country_readiness', 'shared_churn_stress', 'single_country_test']
    expect([...items.values()].map((i) => [i.id, i.n])).toEqual(ids.map((id, i) => [id, i + 1]))
    expect([...items.values()].filter((i) => i.olumi).map((i) => i.id)).toEqual(['existing_market_acquisitions', 'customer_flow_assumptions', 'target_interpretation',
      'broader_entry', 'country_readiness', 'shared_churn_stress', 'single_country_test'])
    expect(olumi).toBe(7) // R3: the driver card `existing_market_acquisitions` is Olumi's (core's ◆) and on the list for its own edit
  })

  it('CONTRAST: a figure core works out from others (no edit), an option and the goal rest on nothing', () => {
    const { items } = restsOnOf(model)
    for (const id of ['no_new_european_entry', 'reach_customer_target']) expect(items.has(id), id).toBe(false)
    // `customers` (worked out from others, no edit) is on the list neither way now: the Run's basis figure is its own card, no longer folded into its badge.
    // The driver card `existing_market_acquisitions` is on the list for its own edit, with or without core's `rests_on`.
    const bare = { ...model, run: model.run == null ? model.run : { ...model.run, most_likely: model.run.most_likely == null ? model.run.most_likely : { ...model.run.most_likely, rests_on: undefined } },
      cards: model.cards.map((c) => ({ ...c, rows: c.rows.map((r) => (r.kind === 'chance' ? { ...r, rests_on: undefined } : r)) })) } as typeof model
    expect([items.has('customers'), restsOnOf(bare).items.has('customers')]).toEqual([false, false])
    expect([items.has('existing_market_acquisitions'), restsOnOf(bare).items.has('existing_market_acquisitions')]).toEqual([true, true])
    // Likewise an option is on the list only as the card whose badge folds a record the Run rests on (`broad_entry_acquisitions`).
    expect([items.has('broader_entry'), restsOnOf(bare).items.has('broader_entry')]).toEqual([true, false])
  })

  it('on a card: its number, in Olumi\'s blue with core\'s mark as its hover when Olumi\'s; a person\'s in the plain ink', () => {
    const { items } = restsOnOf(model)
    const mine = model.cards.find((c) => c.id === 'starting_customers')!, olumis = model.cards.find((c) => c.id === 'existing_market_acquisitions')!
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
  it('Model, Trade-offs and Rests on, Rests on counting Olumi\'s to check or set; a press switches the lens', () => {
    useViewStore.setState({ view })
    render(<ViewLensBar />)
    expect(screen.getAllByRole('radio').map((b) => b.textContent)).toEqual(['Model', 'Trade-offs', 'Rests on7', 'If it failed', 'What would change', 'What if'])
    // Trade-offs on this lane is core's option rows by aim, not the legacy routes along links: its hover is its label, never that hint.
    expect(screen.getByTestId('lens-bar-tradeoffs').getAttribute('title')).toBe('Trade-offs')
    expect(screen.getByTestId('lens-bar-rests_on').getAttribute('aria-label')).toBe('Rests on, 7 to check or set')
    expect(screen.getByTestId('lens-bar-full').getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByTestId('lens-bar-rests_on'))
    expect(useViewLens.getState().lens).toBe('rests_on')
    expect(screen.getByTestId('lens-bar-rests_on').getAttribute('aria-checked')).toBe('true')
  })
})

/** The european golden as core e16a497 serves it: each option's driver names its figure, `existing_market_acquisitions` (core's golden). */
const withFigures = (figure: string | null): View => ({ ...view, model: { ...model, cards: model.cards.map((c) => (c.driver ? { ...c, driver: { ...c.driver, figure } } : c)) } })

describe('What would change, from the View', () => {
  it('european: the figure all three options move most with is its own card (core a0e144f6), which carries them in the View\'s order; `customers`, which used to fold it, carries none', () => {
    const d = driversOf(withFigures('existing_market_acquisitions').model!)
    expect([...d].map(([id, os]) => [id, os.map((o) => o.id)])).toEqual([['existing_market_acquisitions', ['broader_entry', 'single_country_test', 'no_new_european_entry']]])
    expect(d.has('customers')).toBe(false) // CONTRAST: the card that used to fold the figure
  })
  it('a figure that is its own card is marked on it', () => {
    expect([...driversOf(withFigures('starting_customers').model!).keys()]).toEqual(['starting_customers'])
  })
  it('CONTRAST: no figure named, or one no card draws or folds: nothing is marked (never matched by its heading)', () => {
    // (Not the golden as vendored: from core e16a497 on it names its figures itself.)
    expect(driversOf(withFigures(null).model!).size).toBe(0)
    expect(driversOf(withFigures('New customers from existing markets').model!).size).toBe(0)
  })
  it('on the card: the card ringed, the options it moves and core\'s driver words on hover; no chip (DL 4 Nov: v10\'s badge is the one mark)', () => {
    const d = driversOf(withFigures('existing_market_acquisitions').model!)
    const card = model.cards.find((c) => c.id === 'existing_market_acquisitions')!
    const c = render(<ViewCard card={card} driverOf={d.get('existing_market_acquisitions')!} />).container
    const ringed = c.querySelector<HTMLElement>('[data-driver-of]')!
    expect(ringed.hasAttribute('data-view-card')).toBe(true)
    expect([ringed.dataset['driverOf'], ringed.title]).toEqual(['broader_entry single_country_test no_new_european_entry', d.get('existing_market_acquisitions')!.map((o) => o.driver!.title).join('\n')])
    expect(ringed.className).toContain('ring-[3px]')
    expect(c.querySelector('svg.lucide-activity')).toBeNull()
    // CONTRAST: the same card off the lens is neither ringed nor marked
    const off = render(<ViewCard card={card} />).container
    expect([off.querySelector('[data-driver-of]'), off.querySelector('[data-view-card]')!.className.includes('ring-[3px]')]).toEqual([null, false])
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
