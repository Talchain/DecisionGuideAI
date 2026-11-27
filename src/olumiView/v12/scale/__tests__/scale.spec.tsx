/** V12 scale components on the in-repo bakery fixture with contract fields added in the test. Bound by test id and element data. */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import type { View, ViewCard, ViewModel } from '../../../client'
import { ConditionalBar, RangeBar } from '..'

const load = (n: string): ViewModel => (JSON.parse(readFileSync(path.resolve(`src/olumiView/fixtures/core-38eebca9/${n}.view3.json`), 'utf8')) as View).model!
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
const card = (m: ViewModel, id: string): ViewCard => m.cards.find((c) => c.id === id)!

describe('RangeBar', () => {
  const m = load('bakery')
  const withRange = (by: 'olumi' | 'person', unit = 'loaf/week') => {
    const mm = clone(m), c = card(mm, 'extra_sold_per_oven')
    ;(c as { figure: unknown }).figure = { ...(c.figure ?? { text: '', title: '', edit: null }), range: { low: 20, likely: 40, high: 100, unit } }
    ;(c as { author: unknown }).author = { by, text: 't', title: 't' }
    return { mm, c }
  }
  it('R1 draws a dotted band for an Olumi estimate, a solid band for a person\'s figure and a likely dot', () => {
    let r = withRange('olumi'); const a = render(<RangeBar card={r.c} view={r.mm} />)
    expect(screen.getByTestId('range-band').getAttribute('data-style')).toBe('dotted')
    expect(screen.getByTestId('range-likely')).toBeTruthy()
    expect(screen.queryByTestId('range-min')).toBeNull()
    expect(screen.queryByTestId('range-max')).toBeNull()
    a.unmount(); r = withRange('person'); render(<RangeBar card={r.c} view={r.mm} />)
    expect(screen.getByTestId('range-band').getAttribute('data-style')).toBe('solid')
  })
  it('R4 draws one point for a flat range and preserves the older Simple look', () => {
    const { mm, c } = withRange('person')
    ;(c.figure as { range: unknown }).range = { low: 2, likely: null, high: 2, unit: 'months' }
    const a = render(<RangeBar card={c} view={mm} showFlat />)
    expect(screen.getByTestId('range-bar')).toContainElement(screen.getByTestId('range-point'))
    expect(screen.queryByTestId('range-band')).toBeNull()
    expect(screen.queryByTestId('range-likely')).toBeNull()
    a.rerender(<RangeBar card={c} view={mm} showFlat={false} />)
    expect(a.container.firstChild).toBeNull()
    a.unmount()
    render(<RangeBar card={c} view={mm} tried={3} showFlat={false} />)
    expect(screen.getByTestId('range-tried'), 'CONTRAST: a tried mark keeps the track').toBeTruthy()
    cleanup()
    const w = withRange('person'), band = render(<RangeBar card={w.c} view={w.mm} />).getByTestId('range-band')
    expect(band.getAttribute('data-style')).toBe('solid')
    expect(band).toHaveClass('ok-scale-range-band')
    const css = readFileSync(path.resolve('src/olumiView/look/olumiLook.css'), 'utf8')
    const recipe = /\.ok-scale-range-band \{([^}]*height:[^}]*)\}/.exec(css)?.[1]
    expect(recipe).toContain('height: 6px;')
    expect(recipe).toContain('background: color-mix(in srgb, var(--text-body) 55%, transparent);')
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
    expect(screen.getByTestId('conditional-low-label').textContent).toBe('low about 53%')
    expect(screen.getByTestId('conditional-high-label').textContent).toBe('high about 81%')
  })
  it('C2 a sampled end never reads as certain: "under 1%" and "over 99%", never "0%" or "100%" (core\'s rule)', () => {
    const c = clone(card(m, 'second_oven')); c.driver = { ...c.driver!, low: 0.004, high: 1 }
    render(<ConditionalBar card={c} view={m} />)
    expect([screen.getByTestId('conditional-low-label').textContent, screen.getByTestId('conditional-high-label').textContent]).toEqual(['low under 1%', 'high over 99%'])
  })
  it('C3 draws nothing when core sends no numbers', () => {
    const c = clone(card(m, 'second_oven')); c.driver = null; c.rows = c.rows.map((r) => ({ ...r, driver: null })) as never
    const { container } = render(<ConditionalBar card={c} view={m} />)
    expect(container.firstChild).toBeNull()
  })
})
