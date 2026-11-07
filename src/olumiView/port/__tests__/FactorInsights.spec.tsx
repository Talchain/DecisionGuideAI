/**
 * The ported insights disclosure draws one card's reason and premises in core's words, each premise group under core's key word for its
 * mark, closed at first; nothing for a card with neither. Fixtures: the real capacity board, core's european golden.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { FactorInsights } from '../FactorInsights'
import { expectAllBound, viewOf } from './viewAt'

afterEach(cleanup)
const capacity = viewOf('real/capacity')
const european = viewOf('golden/european')

describe('the ported insights disclosure', () => {
  it('catch: closed at first; open, every premise of the card at its path, its sentence on hover, grouped under core\'s key word', () => {
    const m = european.model!, card = m.cards.find((c) => c.id === 'broader_entry')!
    const c = render(<FactorInsights model={m} card={card} />).container
    expect(c.querySelector('[data-view$=".premises.0.text"]')).toBeNull()
    fireEvent.click(c.querySelector('[data-testid="port-factor-insights-toggle"]')!)
    card.premises.forEach((p, j) => {
      const el = c.querySelector(`[data-view="broader_entry.premises.${j}.text"]`)!
      expect(el.textContent).toBe(p.text)
      expect(el.closest('li')!.getAttribute('title')).toBe(p.title)
      const group = el.closest<HTMLElement>('[data-testid="port-factor-premises"]')!
      expect(group.dataset['glyph']).toBe(p.glyph)
      expect(group.querySelector('[data-view^="key."]')!.textContent).toBe(m.key.find((k) => k.glyph === p.glyph)!.text)
    })
    expect(expectAllBound(european, c, expect)).toBe(card.premises.length * 2 + new Set(card.premises.map((p) => p.glyph)).size)
  })

  it('a card\'s reason is drawn in core\'s words', () => {
    const m = capacity.model!, card = m.cards.find((c) => c.id === 'productive_week')!
    const c = render(<FactorInsights model={m} card={card} defaultOpen />).container
    expect(c.querySelector('[data-view="productive_week.reason"]')!.textContent).toBe(card.reason)
    expectAllBound(capacity, c, expect)
  })

  it('identity: one card\'s disclosure draws none of another card\'s premises', () => {
    const m = capacity.model!
    const add = m.cards.find((c) => c.id === 'add_specialist')!, share = m.cards.find((c) => c.id === 'share_specialist')!
    const c = render(<FactorInsights model={m} card={add} defaultOpen />).container
    expect(c.querySelectorAll('[data-view^="share_specialist."]').length).toBe(0)
    expect(c.querySelectorAll('[data-view^="add_specialist.premises."][data-view$=".text"]').length).toBe(add.premises.length)
    expect(share.premises.length).toBeGreaterThan(0)
  })

  it('negative: a card with no reason and no premise draws nothing', () => {
    const m = capacity.model!, card = m.cards.find((c) => c.id === 'keep_staffing')!
    expect([card.reason, card.premises.length]).toEqual([null, 0])
    expect(render(<FactorInsights model={m} card={card} />).container.innerHTML).toBe('')
  })
})
