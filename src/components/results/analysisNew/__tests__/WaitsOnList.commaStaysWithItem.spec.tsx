/**
 * UI-SURGICAL 5/6 (Paul's screenshots, 28 Oct): "Waits on:" drew ", " alone on a line. The separator was its own text in
 * front of the next item, so a wrap could leave it stranded between two items. Each comma now sits inside a no-wrap span
 * with the item before it, and the last item has none.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { WaitsOnList } from '../ViewOnlyRunChances'

afterEach(cleanup)

const items = [
  { id: 'w1', label: 'Remaining implementation time under the selected route', code: 'missing' },
  { id: 'w2', label: 'Additional route setup delay', code: 'missing' },
  { id: 'w3', label: 'Additional time for testing and release approval', code: 'missing' },
] as any

describe('"Waits on:" keeps each comma with the item before it', () => {
  it('every comma sits in its item’s no-wrap span; the last item has none', () => {
    const { container } = render(<p>{'Waits on: '}<WaitsOnList items={items} testIdPrefix="t" /></p>)
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
    const commas: Node[] = []
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if ((n.textContent ?? '').includes(',')) commas.push(n)
    expect(commas).toHaveLength(2)
    for (const c of commas) expect((c.parentElement as HTMLElement).classList.contains('whitespace-nowrap')).toBe(true)
    for (const id of ['w1', 'w2']) {
      const held = screen.getByTestId(`t-${id}`).closest('.whitespace-nowrap')
      expect(held?.textContent).toMatch(/’,$/)
    }
    expect(screen.getByTestId('t-w3').closest('.whitespace-nowrap')?.textContent).toMatch(/’$/)
  })

  it('CONTRAST: the words read as before', () => {
    const { container } = render(<p>{'Waits on: '}<WaitsOnList items={items} testIdPrefix="t" /></p>)
    expect(container.textContent).toBe('Waits on: ‘Remaining implementation time under the selected route’, ‘Additional route setup delay’, ‘Additional time for testing and release approval’')
  })
})
