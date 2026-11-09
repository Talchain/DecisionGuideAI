/**
 * Nothing cut (Paul's visual gate, 8 Nov; supersedes R25's three-line clamp): a card line that carries a whole Run sentence is drawn
 * whole, with no clamp, no "Show all" control and no ellipsis. Bound to the real row: the hosting board's `own_hosting` card, row 1,
 * core's 789-character sentence (fixtures/real/README.md); its reason line is the same.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../client'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'

const view = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', 'hosting.view3.json'), 'utf8')) as View
const card = view.model!.cards.find((c) => c.id === 'own_hosting')!
const long = card.rows[1] as { kind: string; text: string }, short = card.rows[0] as { kind: string; title: string; text: string | null }
const CUT = /line-clamp|truncate|text-ellipsis/
afterEach(cleanup)

describe('a whole Run sentence on a card is drawn whole', () => {
  it('precondition: the real row is core\'s long none sentence, the row before it short', () => {
    expect([long.kind, long.text.length]).toEqual(['none', 789])
    expect(short.kind).toBe('none')
  })
  it('catch: the 789-character row is whole, with no clamp class on it or any ancestor in the card, and no Show all control', () => {
    const c = render(<ViewCard card={card} />).container
    const at = `${card.id}.rows.1`
    const words = c.querySelector<HTMLElement>(`[data-view="${at}.text"]`)!
    expect(words.textContent).toBe(long.text)
    for (let el: HTMLElement | null = words; el !== null && el !== c; el = el.parentElement) expect(el.className, `${el.tagName} around ${at}`).not.toMatch(CUT)
    expect(c.querySelector('[data-show-all]')).toBeNull()
    expect([...c.querySelectorAll('button')].map((b) => b.textContent)).not.toContain('Show all')
  })
  it('must not change: the short row is whole too, with core\'s words and the row binding kept', () => {
    const c = render(<ViewCard card={card} />).container
    expect(c.querySelector(`[data-view-row="${card.id}.rows.0"]`)).not.toBeNull()
    expect(c.querySelector(`[data-view="${card.id}.rows.0.${short.text == null ? 'title' : 'text'}"]`)!.textContent).toBe(short.text ?? short.title)
  })
})
