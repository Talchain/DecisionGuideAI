/**
 * R25 (DL 7 Nov, a real fresh brief): a card line that can carry a whole Run sentence is three lines at most, with a real "Show all" /
 * "Show less" button (keyboard reachable, aria-expanded) that opens core's words in place; never hover only, never cut away. Bound to the
 * real row: the hosting board's `own_hosting` card, row 1, core's 789-character sentence (fixtures/real/README.md).
 */
import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render } from '@testing-library/react'
import type { View } from '../client'
import { ViewCard, SHOW_ALL, SHOW_LESS } from '../../canvas/nodes/ViewCardNode'

const view = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', 'hosting.view3.json'), 'utf8')) as View
const card = view.model!.cards.find((c) => c.id === 'own_hosting')!
const long = card.rows[1] as { kind: string; text: string }, short = card.rows[0] as { kind: string; title: string; text: string | null }

// jsdom lays nothing out: a clamped block is "over" when its words would run past three lines (here, past 200 characters).
const sh = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight'), ch = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get(this: HTMLElement) { return (this.textContent ?? '').length > 200 ? 300 : 40 } })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get() { return 60 } })
})
afterAll(() => { if (sh) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', sh); if (ch) Object.defineProperty(HTMLElement.prototype, 'clientHeight', ch) })
afterEach(cleanup)

describe('a whole Run sentence on a card: three lines, then Show all', () => {
  it('precondition: the real row is core\'s long none sentence, the row before it short', () => {
    expect([long.kind, long.text.length]).toEqual(['none', 789])
    expect(short.kind).toBe('none')
  })
  it('catch: clamped to three lines with a real button that opens it in place and closes it again; core\'s words whole in the DOM', () => {
    const c = render(<ViewCard card={card} />).container
    const at = `${card.id}.rows.1`
    const btn = c.querySelector<HTMLButtonElement>(`[data-show-all="${at}"]`)!
    expect(btn.tagName).toBe('BUTTON')
    expect([btn.textContent, btn.getAttribute('aria-expanded')]).toEqual([SHOW_ALL, 'false'])
    // 1232 polish (track 4 step 3): a plain control, never Olumi's blue (blue means Olumi only)
    expect(btn.className).toContain('text-text-light')
    expect(btn.className).not.toContain('text-info')
    const box = c.querySelector<HTMLElement>(`#${btn.getAttribute('aria-controls')}`)!
    expect(box.className).toContain('line-clamp-3')
    expect(box.querySelector(`[data-view="${at}.text"]`)!.textContent).toBe(long.text)
    fireEvent.click(btn)
    expect([btn.textContent, btn.getAttribute('aria-expanded')]).toEqual([SHOW_LESS, 'true'])
    expect(box.className).not.toContain('line-clamp')
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('false')
  })
  it('must not change: a short line has no control and no clamp to open', () => {
    const c = render(<ViewCard card={card} />).container
    expect(c.querySelector(`[data-show-all="${card.id}.rows.0"]`)).toBeNull()
    expect(c.querySelector(`[data-view="${card.id}.rows.0.${short.text == null ? 'title' : 'text'}"]`)!.textContent).toBe(short.text ?? short.title)
    expect(c.querySelector(`[data-view-row="${card.id}.rows.0"] [data-disclosure]`)).toBeNull()
  })
})
