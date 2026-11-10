/**
 * "Your options" on the olumi-core lane (UI recovery row 15, DL 10 Nov 2026): the previous product's `OptionCards`, fed by core's View.
 * Bound by identity: each card is found by its option's id and must say that option's own headline (core's words) and no other's; the
 * bar's length is that option's own chance. Fixtures are core's own captures.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { optionCards } from '../../layout'
import { legacyOptionsOf } from '../legacyAnalysis'
import { YourOptions } from '../YourOptions'
import { viewOf } from './viewAt'

afterEach(cleanup)
const card = (id: string) => screen.getByTestId(`option-card-${id}`)

describe('Your options: the previous cards on core\'s View', () => {
  it('YO1: one card per compared option, every one shown, in core\'s card order (no top-two cut, no rank)', () => {
    const m = viewOf('golden/bakery').model!
    render(<YourOptions model={m} />)
    const ids = [...screen.getByTestId('option-cards').querySelectorAll('[data-option-id]')].map((e) => e.getAttribute('data-option-id'))
    expect(ids).toEqual(optionCards(m).map((c) => c.id))
    expect(ids.length).toBeGreaterThan(2)
    expect(screen.queryByTestId('option-cards-toggle')).toBeNull()
    expect(document.querySelector('[data-testid^="rank-marker-"], [data-testid^="win-pct-"]')).toBeNull()
  })

  it('YO2: each card says its own option\'s headline in core\'s words, and its bar is that option\'s own chance', () => {
    const m = viewOf('golden/bakery').model!
    render(<YourOptions model={m} />)
    const seen = new Set<string>()
    for (const c of optionCards(m)) {
      const head = c.headline!, row = c.rows.find((r) => r.kind === 'chance' && r.aim_id === head.aim_id)!
      if (row.kind !== 'chance') throw new Error('fixture')
      expect(within(card(c.id)).getByTestId(`goal-readout-${c.id}`)).toHaveTextContent(head.text)
      expect(within(card(c.id)).getByTestId(`goal-chance-face-${c.id}`)).toHaveTextContent(row.aim)
      expect(within(card(c.id)).getByText(c.heading)).toBeInTheDocument()
      const bar = card(c.id).querySelector<HTMLElement>('.h-2.rounded-full.transition-all')!
      expect(bar.style.width).toBe(`${Math.max(2, Math.round(row.chance! * 100))}%`)
      seen.add(head.text)
    }
    // The discriminator: the options' headlines differ, so a card showing another option's words fails above.
    expect(seen.size).toBe(optionCards(m).length)
  })

  it('YO3: a headline that is fixed by the figures is said in core\'s words with no bar; nothing is called a chance that is not one', () => {
    const m = viewOf('golden/studio').model!
    render(<YourOptions model={m} />)
    const fixed = optionCards(m).filter((c) => c.headline!.state === 'fixed'), chance = optionCards(m).filter((c) => c.headline!.state === 'chance')
    expect(fixed.length * chance.length).toBeGreaterThan(0)
    for (const c of fixed) {
      expect(within(card(c.id)).getByTestId(`goal-readout-${c.id}`)).toHaveTextContent(c.headline!.text)
      expect(card(c.id).querySelector('.h-2.rounded-full.transition-all')).toBeNull()
    }
    for (const c of chance) expect(card(c.id).querySelector('.h-2.rounded-full.transition-all')).not.toBeNull()
  })

  it('YO4: with no headline from core (an older View), the readout is the option\'s row for the aim core\'s lead speaks of', () => {
    const m = viewOf('real/hiring').model!
    expect(optionCards(m).every((c) => c.headline == null)).toBe(true)
    render(<YourOptions model={m} />)
    for (const c of optionCards(m)) {
      const row = c.rows.find((r) => r.kind === 'chance')!
      if (row.kind !== 'chance') throw new Error('fixture')
      expect(within(card(c.id)).getByTestId(`goal-readout-${c.id}`)).toHaveTextContent(row.value)
    }
  })

  it('YO5: no leader, win share or outcome figure reaches the cards, and one option alone draws no section', () => {
    const m = viewOf('golden/bakery').model!
    for (const o of legacyOptionsOf(m).options) expect(o).toMatchObject({ isRecommended: false, expected: null, p10: null, p50: null, p90: null })
    expect(legacyOptionsOf(m).options.every((o) => o.winProbability === undefined && o.rank === undefined)).toBe(true)
    const one = structuredClone(m)
    one.cards = one.cards.filter((c) => c.family !== 'option' || c.id === optionCards(m)[0]!.id)
    const { container } = render(<YourOptions model={one} />)
    expect(container).toBeEmptyDOMElement()
  })
})
