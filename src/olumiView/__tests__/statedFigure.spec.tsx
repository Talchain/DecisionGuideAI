/**
 * Paul's acceptance step 2 (9 Nov witness on core f28da2b4): a typed figure each option overrides is still drawn on its card, whole, in
 * core's words, above the options' rows. Bound by card id ('sales', the bakery golden's one per-option figure card).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../client'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'

const v = JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'bakery.view.json'), 'utf8')) as View
const base = v.model!.cards.find((c) => c.id === 'sales')!
const typed = () => {
  const c = structuredClone(base)
  c.figure = { ...c.figure!, text: '410 loaves/week', title: '410 loaves/week' }
  c.author = { by: 'person', text: 'The team’s figure', title: 'Theirs: “410 loaves a week”' }
  return c
}
const figureOf = (c: typeof base) => render(<ViewCard card={c} />).container.querySelector<HTMLElement>(`[data-view="${c.id}.figure.text"]`)
afterEach(cleanup)

describe('a person\'s figure that each option overrides', () => {
  it('precondition: sales is a per-option card whose figure is Olumi\'s, worked out from others', () => {
    expect(base.values!.length).toBeGreaterThan(1)
    expect(base.author?.by).toBe('olumi')
  })
  it('SF1 catch: the typed figure, said by no option row, is drawn whole above the rows, in ink, every row kept', () => {
    const c = typed()
    const r = render(<ViewCard card={c} />).container
    const el = r.querySelector<HTMLElement>(`[data-view="sales.figure.text"]`)
    expect(el?.textContent).toBe('410 loaves/week')
    expect(el!.getAttribute('data-stated-figure')).toBe('sales')
    expect(el!.className).toContain('text-text-header')
    expect(el!.className).not.toContain('text-info')
    const rows = r.querySelectorAll(`[data-view^="sales.values."][data-view$=".text"]`)
    expect(rows.length).toBe(c.values!.length)
    expect(el!.compareDocumentPosition(rows[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
  it('SF2 must not change: a figure equal to an option\'s row is not said twice', () => {
    const c = typed()
    c.figure = { ...c.figure!, text: c.values![0]!.text }
    expect(figureOf(c)).toBeNull()
  })
  it('SF3 must not change: Olumi\'s worked-out figure keeps its run-on sentence off the face (R3)', () => {
    expect(figureOf(base)).toBeNull()
  })
})
