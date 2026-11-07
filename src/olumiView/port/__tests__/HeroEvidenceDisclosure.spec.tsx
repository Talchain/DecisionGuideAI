/**
 * The ported evidence disclosure: closed at first; open, one chip per view core sends (drivers, what would have to be true, D8, D5, compared,
 * worth checking first), each line verbatim at its View path with core's hover; a view core does not send has no chip; nothing at all
 * when core sends none. Fixtures: core's bakery golden (it carries all but D5) and european golden (seven D8 lines).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import type { View } from '../../client'
import { optionCards } from '../../layout'
import { HeroEvidenceDisclosure } from '../HeroEvidenceDisclosure'
import { expectAllBound, viewOf } from './viewAt'

afterEach(cleanup)
const bakery = viewOf('golden/bakery')
const european = viewOf('golden/european')
const chips = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[data-testid^="port-evidence-tab-"]')].map((e) => e.dataset['testid']!.replace('port-evidence-tab-', ''))

describe('the ported evidence disclosure', () => {
  it('closed at first; open shows a chip for each view core sends, the tipping chip in core\'s heading', () => {
    const c = render(<HeroEvidenceDisclosure model={bakery.model!} />).container
    expect(c.querySelector('[data-testid="port-evidence-drivers"]')).toBeNull()
    fireEvent.click(c.querySelector('[data-testid="port-evidence-toggle"]')!)
    expect(chips(c)).toEqual(['drivers', 'tipping', 'rests', 'compared', 'worth'])
    expect(c.querySelector('[data-testid="port-evidence-tab-tipping"]')!.textContent).toBe(bakery.model!.run!.tipping_heading)
  })

  it('each view draws core\'s lines at their paths, with core\'s hover', () => {
    const m = bakery.model!, run = m.run!
    const c = render(<HeroEvidenceDisclosure model={m} defaultOpen />).container
    const drivers = optionCards(m).filter((x) => x.driver != null).map((x) => x.id)
    expect([...c.querySelectorAll<HTMLElement>('[data-testid="port-evidence-driver"]')].map((e) => e.dataset['optionId'])).toEqual(drivers)
    for (const id of drivers) expect(c.querySelector(`[data-view="${id}.driver.text"]`)!.closest('[title]')!.getAttribute('title')).toBe(m.cards.find((x) => x.id === id)!.driver!.title)
    expect(expectAllBound(bakery, c, expect)).toBeGreaterThan(3)
    fireEvent.click(c.querySelector('[data-testid="port-evidence-tab-tipping"]')!)
    expect([...c.querySelectorAll<HTMLElement>('[data-view^="run.tipping."]')].map((e) => e.textContent)).toEqual(run.tipping.map((t) => t.line))
    expectAllBound(bakery, c, expect)
    fireEvent.click(c.querySelector('[data-testid="port-evidence-tab-compared"]')!)
    expect(c.querySelectorAll('[data-view^="run.compared."][data-view$=".line"]').length).toBe(run.compared.length)
    expectAllBound(bakery, c, expect)
    fireEvent.click(c.querySelector('[data-testid="port-evidence-tab-worth"]')!)
    expect(c.querySelector('[data-view="run.science.0.line"]')!.textContent).toBe(run.science[0]!.line)
    expect(c.querySelector('[data-view="run.science.0.line"]')!.closest('[title]')!.getAttribute('title')).toBe(run.science[0]!.hover)
    expectAllBound(bakery, c, expect)
  })

  it('negative: a view core does not send has no chip (no tipping, no compared)', () => {
    const v: View = structuredClone(bakery)
    v.model!.run!.tipping = []
    v.model!.run!.tipping_aims = []
    v.model!.run!.compared = []
    const c = render(<HeroEvidenceDisclosure model={v.model!} defaultOpen />).container
    expect(chips(c)).toEqual(['drivers', 'rests', 'worth'])
  })

  it('D8: "How much rests on Olumi\'s guesses" chip in core\'s heading; each line verbatim at its path with core\'s hover', () => {
    for (const v of [bakery, european]) {
      cleanup()
      const run = v.model!.run!
      const c = render(<HeroEvidenceDisclosure model={v.model!} defaultOpen />).container
      expect(c.querySelector('[data-testid="port-evidence-tab-rests"]')!.textContent).toBe(run.rests_heading)
      fireEvent.click(c.querySelector('[data-testid="port-evidence-tab-rests"]')!)
      const lines = [...c.querySelectorAll<HTMLElement>('[data-view^="run.rests."]')]
      expect(lines.map((e) => e.dataset['view'])).toEqual(run.rests.map((_, i) => `run.rests.${i}.line`))
      lines.forEach((e, i) => expect(e.closest('[title]')!.getAttribute('title')).toBe(run.rests[i]!.hover))
      expect(c.textContent).not.toMatch(/0\.\d{2,}/) // the shares place nothing and are never drawn as numbers
      expectAllBound(v, c, expect)
    }
  })

  it('D5: "What could go wrong" only once core fills it (after a commitment); before that no chip and no heading', () => {
    const run = bakery.model!.run!
    expect(run.failure).toEqual([])
    const before = render(<HeroEvidenceDisclosure model={bakery.model!} defaultOpen />).container
    expect(before.querySelector('[data-testid="port-evidence-tab-failure"]')).toBeNull()
    expect(before.textContent).not.toContain(run.failure_heading)
    cleanup()
    // core-science's committed bakery fact (core-science-D5-D6-D8-20261107.md), in core's run.failure shape
    const v: View = structuredClone(bakery)
    const line = "'extra sold per oven' was in its low third in 55% of misses, against 25% of the draws that meet"
    v.model!.run!.failure = [{ id: 'F90', line, hover: line, aim: 'sell_360', option: 'second_oven', figures: [{ id: 'extra_sold_per_oven', label: 'extra sold per oven', whose: 'olumi', third: 'low' }] }]
    const c = render(<HeroEvidenceDisclosure model={v.model!} defaultOpen />).container
    expect(c.querySelector('[data-testid="port-evidence-tab-failure"]')!.textContent).toBe(run.failure_heading)
    fireEvent.click(c.querySelector('[data-testid="port-evidence-tab-failure"]')!)
    expect(c.querySelector('[data-view="run.failure.0.line"]')!.textContent).toBe(line)
    expectAllBound(v, c, expect)
  })

  it('negative: nothing at all when core sends none of the views', () => {
    const v: View = structuredClone(bakery), m = v.model!
    m.run!.tipping = []; m.run!.tipping_aims = []; m.run!.compared = []; m.run!.science = []; m.run!.rests = []; m.run!.failure = []
    for (const card of m.cards) card.driver = null
    expect(render(<HeroEvidenceDisclosure model={m} />).container.innerHTML).toBe('')
  })
})
