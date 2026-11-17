/**
 * v11 item A: each option's chance of meeting the goal is the Analysis tab's figure (large, with a small gauge at core's typed chance); an
 * option with no chance draws core's words for why and no figure or gauge. Bound by option id.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { TYPE } from '../type'
import { optionCards } from '../../layout'
import { viewOf } from './viewAt'

afterEach(cleanup)

const real = viewOf('real/bakery-r5')

describe('the chance is the headline figure', () => {
  it('second_oven: the figure is core\'s chance words at the figure size, its gauge is filled to the typed chance, the lead is body size', () => {
    const model = real.model!
    const { container } = render(<AnalysisHeroPanel model={model} />)
    const row = container.querySelector<HTMLElement>('[data-option-id="second_oven"][data-view-row="second_oven.rows.1"]')!
    const figure = row.querySelector<HTMLElement>('[data-testid="port-row-readout"]')!
    expect(figure.dataset['figure']).toBe('true')
    expect(figure.className).toContain(TYPE.figure)
    expect(figure.querySelector('[data-view="second_oven.rows.1.value"]')!.textContent).toBe('about 72% chance')
    const card = model.cards.find((c) => c.id === 'second_oven')!
    const chance = (card.rows[1] as { chance: number }).chance
    const fill = row.querySelector<HTMLElement>('[data-testid="port-row-gauge"][data-for="second_oven"] [data-testid="port-row-gauge-fill"]')!
    expect(fill.style.width).toBe(`${chance * 100}%`)
    // core's uncertainty words stay with the figure
    expect(row.querySelector('[data-testid="port-row-headline-range"]') !== null || card.headline?.range == null || card.headline.range === '').toBe(true)
    expect(container.querySelector('[data-view="run.lead"]')!.className).not.toContain(TYPE.figure)
  })

  it('contrast: an option with no chance draws core\'s words for why, no figure and no gauge', () => {
    const model = structuredClone(real.model!)
    const card = optionCards(model).find((c) => c.id === 'carry_on')!
    card.rows = card.rows.map((r) => ({ kind: 'none', aim_id: r.aim_id, title: 'Core says why.', text: 'No chance yet: it waits on a figure.' }) as never)
    if (card.headline != null) card.headline = { ...card.headline, state: 'none' } as never
    const { container } = render(<AnalysisHeroPanel model={model} />)
    const row = container.querySelector<HTMLElement>('[data-option-id="carry_on"]')!
    expect(row.querySelector('[data-testid="port-row-readout"]')!.textContent).toBe('No chance yet: it waits on a figure.')
    expect(row.querySelector('[data-figure]')).toBeNull()
    expect(row.querySelector('[data-testid="port-row-gauge"]')).toBeNull()
    expect(container.querySelector('[data-option-id="second_oven"] [data-figure="true"]')).not.toBeNull()
  })
})
