/**
 * Core's card face (FL1, #20; DL 9 Nov): a card draws core's `face.title` in place of its heading when they differ (the heading stays whole,
 * on hover and for a screen reader), and `face.line` under it, whole, each marked with whose words it is. Fixture: core's own viewOf for the
 * V11 J1 bookshop gate board (fixtures/face/README.md). A card whose face title is its heading draws as before.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../client'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'

const view = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/face', 'bookshop-gate.view3.json'), 'utf8')) as View
const cardOf = (id: string) => view.model!.cards.find((c) => c.id === id)!
afterEach(cleanup)

describe('the card face is core\'s title and line, with whose words', () => {
  it('their own words (monthly_revenue): the title is theirs, whole, the heading kept on hover and for a reader', () => {
    const card = cardOf('monthly_revenue'), t = card.face!.title!
    expect([t.words, t.text === card.heading]).toEqual(['theirs', false])
    const c = render(<ViewCard card={card} />).container
    const title = c.querySelectorAll(`[data-view="${card.id}.face.title.text"]`)
    expect(title).toHaveLength(1)
    expect([title[0]!.textContent, title[0]!.getAttribute('data-face-words')]).toEqual([t.text, 'theirs'])
    expect(title[0]!.getAttribute('title')!.startsWith(card.heading)).toBe(true)
    const heading = c.querySelector(`[data-view="${card.id}.heading"]`)!
    expect([heading.textContent, heading.className]).toEqual([card.heading, 'sr-only'])
  })

  it('Olumi\'s words (visits, spend_per_visit, rival_keep): title and line, both whole, both marked Olumi\'s', () => {
    for (const id of ['visits', 'spend_per_visit', 'rival_keep']) {
      const card = cardOf(id), f = card.face!
      expect([f.title!.words, f.line!.words]).toEqual(['olumi', 'olumi'])
      const c = render(<ViewCard card={card} />).container
      const title = c.querySelector(`[data-view="${id}.face.title.text"]`)!, line = c.querySelectorAll(`[data-view="${id}.face.line.text"]`)
      expect([title.textContent, title.getAttribute('data-face-words')]).toEqual([f.title!.text, 'olumi'])
      expect(line).toHaveLength(1)
      expect([line[0]!.textContent, line[0]!.getAttribute('data-face-words')]).toEqual([f.line!.text, 'olumi'])
      expect(line[0]!.className).not.toMatch(/line-clamp|truncate|(^|\s)hidden(\s|$)/)
      cleanup()
    }
  })

  it('contrast: a card whose face title is its own heading draws its heading as before, no face title', () => {
    const card = view.model!.cards.find((c) => c.face?.title != null && c.face.title.text === c.heading)!
    const c = render(<ViewCard card={card} />).container
    expect(c.querySelector(`[data-view="${card.id}.face.title.text"]`)).toBeNull()
    expect(c.querySelector(`[data-view="${card.id}.heading"]`)!.className).not.toBe('sr-only')
  })
})
