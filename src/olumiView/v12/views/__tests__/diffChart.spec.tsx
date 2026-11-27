/**
 * A difference, drawn (overnight 18 Nov): who said what on one axis and each option's chance per person, every number the engine's own and
 * every label core's words, read by identity (the side's `view` id and the difference's `record`) and only where the View's figure is the one
 * the difference compares. Fixtures: core's own TM-04 round (fixtures/debate/tm04-cara.view3.json and tm04-differences.core.json, one round);
 * the chance rows use core's differences read (fixtures/debate/differences.core.json).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import type { View } from '../../../client'
import type { Difference } from '../../../../olumiCore/team/differences'
import { axisOf, ChanceBars, FigureSides, sideSpans } from '../DiffChart'

const fx: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/debate/tm04-cara.view3.json'), 'utf8'))
const tm: Difference = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/debate/tm04-differences.core.json'), 'utf8')).differences[0]
const r5: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/r5/effects.view3.json'), 'utf8'))
const core = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/debate/differences.core.json'), 'utf8'))
const d: Difference = core.differences[0]
afterEach(cleanup)

describe('who said what, on one axis', () => {
  it('each side\'s span is that person\'s own revealed figure for this card, found by view id and record, with its own words', () => {
    // Views 19 (Priya) and 20 (Tom) gave ranges for `diagnostic_time_to_contract`; the difference's own sides say the same figures.
    expect(tm.sides.map((s) => s.figure)).toEqual(['6 to 12 months', '1 to 3 months'])
    expect(sideSpans(fx, tm)).toEqual([{ lo: 6, hi: 12, text: '6 to 12 months', unit: 'month' }, { lo: 1, hi: 3, text: '1 to 3 months', unit: 'month' }])
    // Contrast: the same difference about a card neither view gave a figure for draws no axis (the words list stands instead).
    expect(sideSpans(fx, { ...tm, record: 'hold' })).toBeNull()
    // Contrast: a side whose view is not revealed to this viewer draws no axis at all, never a half chart.
    expect(sideSpans(fx, { ...tm, sides: [tm.sides[0]!, { ...tm.sides[1]!, view: 777 }] })).toBeNull()
    // Contrast: the same two figures in different units are never drawn on one axis.
    const other = { ...fx, collab: { ...fx.collab, shared: fx.collab.shared.map((v) => v.id !== 20 ? v : { ...v, figures: v.figures.map((f) => f.quantity === tm.record ? { ...f, unit: 'week' } : f) }) } } as View
    expect(sideSpans(other, tm)).toBeNull()
  })
  it('draws no marks when the reveal and the difference refer to different figures for the same person and record', () => {
    const { container } = render(<FigureSides view={r5} d={d} at="x" />)
    expect(container.querySelector('[data-range-mark]')).toBeNull()
  })
  it('the axis holds every span with a margin; one point alone still gets a width', () => {
    const a = axisOf([{ lo: 5, hi: 5 }, { lo: 20, hi: 40 }])
    expect(a.lo).toBeLessThan(5)
    expect(a.hi).toBeGreaterThan(40)
    const p = axisOf([{ lo: 3, hi: 3 }, { lo: 3, hi: 3 }])
    expect(p.hi).toBeGreaterThan(p.lo)
  })
  it('draws a tick for a single figure and a bar for a range, each labelled with that person\'s words, in core\'s order', () => {
    // Priya's figure given as one value (her view and the difference's side say the same); Tom's range as core sent it.
    const one = { ...fx, collab: { ...fx.collab, shared: fx.collab.shared.map((v) => v.id !== 19 ? v : { ...v, figures: v.figures.map((f) => f.quantity === tm.record ? { quantity: f.quantity, value: 9, text: '9 months', unit: 'month' } : f) }) } } as unknown as View
    const dd = { ...tm, sides: [{ ...tm.sides[0]!, figure: '9 months' }, tm.sides[1]!] }
    const { container } = render(<FigureSides view={one} d={dd} at="x" />)
    const rows = [...container.querySelectorAll('[data-difference-side]')]
    expect(rows.map((r) => r.getAttribute('data-difference-side'))).toEqual(['12', '14'])
    expect(rows.map((r) => r.querySelector('[data-range-text]')!.textContent)).toEqual(['9 months', '1 to 3 months'])
    expect(rows[0]!.querySelector('[data-range-mark]')!.getAttribute('data-range-mark')).toBe('point')
    expect(rows[1]!.querySelector('[data-range-mark]')!.getAttribute('data-range-mark')).toBe('span')
    // Tom's bar starts left of Priya's tick: the two are on one axis.
    const x = (r: Element) => Number(r.querySelector('[data-range-mark]')!.getAttribute('x'))
    expect(x(rows[1]!)).toBeLessThan(x(rows[0]!))
    // Nothing inline-styled: lengths are SVG attributes.
    expect(container.querySelector('[style]')).toBeNull()
  })
})

describe('each option\'s chance, per person', () => {
  it('one bar per holder whose length is core\'s chance, labelled with core\'s text; core\'s model figure as words', () => {
    const { container } = render(<ChanceBars d={d} heading={core.headings.options} modelHeading={core.headings.model} at="x" />)
    const add = container.querySelector('[data-difference-option="add_one"]')!
    const bar = (holder: string) => add.querySelector(`[data-difference-chance="${holder}"]`)!
    expect(bar('1').querySelector('svg')!.getAttribute('data-chance')).toBe('0.0706')
    expect(bar('2').querySelector('svg')!.getAttribute('data-chance')).toBe('0.9377')
    expect(bar('1').textContent).toContain('about 7%')
    expect(bar('2').textContent).toContain('about 94%')
    const fill = (holder: string) => Number(bar(holder).querySelectorAll('rect')[1]!.getAttribute('width'))
    expect(fill('2')).toBeGreaterThan(fill('1'))
    expect(add.querySelector('[data-difference-model]')!.textContent).toBe(`· ${core.headings.model} about 39%`)
    expect(screen.getByText(core.headings.options)).toBeTruthy()
  })
  it('a withheld chance draws no bar, only core\'s words for it', () => {
    const w: Difference = { ...d, options: [{ ...d.options[1]!, chances: [{ holder_id: '1', chance: null, text: 'Not given in version 1', withheld: { value: 'Not given', reason: 'The run withholds it' } }, d.options[1]!.chances[1]!] }] }
    const { container } = render(<ChanceBars d={w} heading="h" modelHeading="m" at="x" />)
    const one = container.querySelector('[data-difference-chance="1"]')!
    expect(one.querySelector('svg')).toBeNull()
    expect(one.textContent).toContain('Not given in version 1')
    expect(container.querySelector('[data-difference-chance="2"] svg')).not.toBeNull()
  })
  it('no options from core: nothing is drawn', () => {
    const { container } = render(<ChanceBars d={{ ...d, options: [] }} heading="h" modelHeading="m" at="x" />)
    expect(container.innerHTML).toBe('')
  })
})
