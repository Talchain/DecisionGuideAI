/** V12 scale components on the in-repo fixtures (bakery, european) with contract fields added in the test. Bound by test id and element data. */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import type { View, ViewCard, ViewModel } from '../../../client'
import { ConditionalBar, OutcomeStrips, RangeBar } from '..'

const load = (n: string): ViewModel => (JSON.parse(readFileSync(path.resolve(`src/olumiView/fixtures/core-38eebca9/${n}.view3.json`), 'utf8')) as View).model!
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
const card = (m: ViewModel, id: string): ViewCard => m.cards.find((c) => c.id === id)!
const letters = new Map([['broader_entry', 'A'], ['single_country_test', 'B'], ['no_new_european_entry', 'C']])

describe('OutcomeStrips', () => {
  const m = load('european')
  const c = card(m, 'customers')
  it('O1 draws one strip and median per option on one shared 0-based axis, with the letter, ticks, unit, deadline and legend', () => {
    render(<OutcomeStrips card={c} view={m} letters={letters} />)
    for (const v of c.values!) {
      expect(screen.getByTestId(`strip-letter-${v.option}`).textContent).toBe(letters.get(v.option))
      expect(screen.getByTestId(`strip-range-${v.option}`).getAttribute('data-p90')).toBe(String(v.p90))
    }
    const left = (id: string) => parseFloat(/([\d.]+)%/.exec((screen.getByTestId(id) as HTMLElement).style.left)![1]!)
    // true scale: 663 sits right of 511 in the ratio of the values on one 0-based axis
    expect(left('strip-median-broader_entry') / left('strip-median-single_country_test')).toBeCloseTo(663.0754988387507 / 510.98840023662854, 2)
    expect(screen.getAllByTestId('outcome-tick')[0]!.textContent).toBe('0')
    expect(screen.getByTestId('outcome-unit').textContent).toBe('customer')
    expect(screen.getByTestId('outcome-deadline').textContent).toBe('800 customer deadline')
    expect(screen.getByTestId('outcome-legend').textContent).toBe('middle 80% · median')
    expect(screen.getByTestId('outcome-legend').getAttribute('title')).toBe(c.figure!.title)
  })
  it('O2 draws no deadline when the card is not the aim quantity, and no unit it was not told', () => {
    const other = card(m, 'churn_rate')
    render(<OutcomeStrips card={other} view={m} letters={letters} />)
    expect(screen.queryByTestId('outcome-deadline')).toBeNull()
    expect(screen.queryByTestId('outcome-unit')).toBeNull()
  })
  it('O3 draws a row per withheld option with core\'s reason, and not a strip', () => {
    const mm = clone(m), cc = card(mm, 'customers')
    const [kept, dropped] = [cc.values![0]!, cc.values![1]!]
    // Core's own field: values[] holds only the real band; the option it could not calculate is in `values_withheld` with its reason.
    cc.values = [kept]
    ;(cc as unknown as { values_withheld: unknown }).values_withheld = [{ option: dropped.option, text: '170 samples gave a time below zero' }]
    render(<OutcomeStrips card={cc} view={mm} letters={letters} />)
    expect(screen.getByTestId('strip-withheld-single_country_test').textContent).toContain('not calculated: 170 samples gave a time below zero')
    expect(screen.queryByTestId('strip-range-single_country_test')).toBeNull()
    expect(screen.getByTestId('strip-range-broader_entry')).toBeTruthy()
  })
  it('O4 draws the pending state, and no strips, when the figure waits', () => {
    const mm = clone(m), cc = card(mm, 'customers')
    cc.figure = { ...cc.figure!, state: 'waits', title: 'one input is not given yet' }
    render(<OutcomeStrips card={cc} view={mm} letters={letters} />)
    expect(screen.getByTestId('outcome-pending').textContent).toContain('one input is not given yet')
    expect(screen.queryByTestId('outcome-strips')).toBeNull()
  })
  it('O5 draws nothing for a card with no values', () => {
    const { container } = render(<OutcomeStrips card={card(m, 'broader_entry')} view={m} letters={letters} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('RangeBar', () => {
  const m = load('bakery')
  const withRange = (by: 'olumi' | 'person', unit = 'loaf/week') => {
    const mm = clone(m), c = card(mm, 'extra_sold_per_oven')
    ;(c as { figure: unknown }).figure = { ...(c.figure ?? { text: '', title: '', edit: null }), range: { low: 20, likely: 40, high: 100, unit } }
    ;(c as { author: unknown }).author = { by, text: 't', title: 't' }
    return { mm, c }
  }
  it('R1 an Olumi estimate is a dotted band; a person\'s figure is solid; likely dot and end labels with unit', () => {
    let r = withRange('olumi'); const a = render(<RangeBar card={r.c} view={r.mm} />)
    expect(screen.getByTestId('range-band').getAttribute('data-style')).toBe('dotted')
    expect(screen.getByTestId('range-likely')).toBeTruthy()
    expect(screen.getByTestId('range-max').textContent).toBe('100 loaf/week')
    a.unmount(); r = withRange('person'); render(<RangeBar card={r.c} view={r.mm} />)
    expect(screen.getByTestId('range-band').getAttribute('data-style')).toBe('solid')
  })
  it('R2 draws nothing with no range', () => {
    const { container } = render(<RangeBar card={card(m, 'extra_sold_per_oven')} view={m} />)
    expect(container.firstChild).toBeNull()
  })
  it('R3 the deadline tick needs the aim unit AND an input link to the aim quantity; the tried marker shows at its value', () => {
    const { mm, c } = withRange('person')
    const aim = mm.aim!
    const a = render(<RangeBar card={c} view={mm} tried={60} />)
    expect(screen.queryByTestId('range-deadline'), 'no input link yet').toBeNull()
    expect(screen.getByTestId('range-tried').getAttribute('data-at')).toBe('60')
    a.unmount()
    mm.links.push({ ...mm.links[0]!, from: c.id, to: aim.quantity, role: 'input' } as never)
    const b = render(<RangeBar card={c} view={mm} />)
    expect(screen.getByTestId('range-deadline')).toBeTruthy()
    b.unmount()
    const other = withRange('person', 'GBP')
    other.mm.links.push({ ...other.mm.links[0]!, from: c.id, to: aim.quantity, role: 'input' } as never)
    render(<RangeBar card={other.c} view={other.mm} />)
    expect(screen.queryByTestId('range-deadline'), 'different unit').toBeNull()
  })
})

describe('ConditionalBar', () => {
  const m = load('bakery')
  it('C1 draws the chance if the driver is low and high from core\'s numbers', () => {
    render(<ConditionalBar card={card(m, 'second_oven')} view={m} />)
    expect(screen.getByTestId('conditional-low-label').textContent).toBe('low 53%')
    expect(screen.getByTestId('conditional-high-label').textContent).toBe('high 81%')
  })
  it('C2 labels a tiny chance "<1%"', () => {
    const c = clone(card(m, 'second_oven')); c.driver = { ...c.driver!, low: 0.004, high: 0.7 }
    render(<ConditionalBar card={c} view={m} />)
    expect(screen.getByTestId('conditional-low-label').textContent).toBe('low <1%')
  })
  it('C3 draws nothing when core sends no numbers', () => {
    const c = clone(card(m, 'second_oven')); c.driver = null; c.rows = c.rows.map((r) => ({ ...r, driver: null })) as never
    const { container } = render(<ConditionalBar card={c} view={m} />)
    expect(container.firstChild).toBeNull()
  })
})
