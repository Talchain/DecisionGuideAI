/**
 * Core's option face (core wip/card-face bdc126c4, 8 Nov: core owns the dedupe; strategy lane): an option card with core's `headline`
 * draws `headline.text` on its face, one line, with `headline.title` on hover; its rows are drawn only in the opened card. Core's own
 * goldens from candidate 2a283a4f merged with card-face (fixtures/cardface/README.md). A View without a headline keeps its rows.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../client'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'

const face = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/cardface', `${n}.view3.json`), 'utf8'))
const older = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', 'bakery-r5.view3.json'), 'utf8')) as View
afterEach(cleanup)

describe('the option card face is core\'s headline line', () => {
  for (const n of ['bakery', 'studio']) {
    it(`${n}: every option's face is headline.text whole at its path, its hover headline.title; the rows sit in the opened card only`, () => {
      const options = face(n).model!.cards.filter((c) => c.family === 'option' && c.headline != null)
      expect(options.length).toBeGreaterThan(1)
      for (const card of options) {
        const { container } = render(<ViewCard card={card} />)
        const line = container.querySelectorAll(`[data-view="${card.id}.headline.text"]`)
        expect(line).toHaveLength(1)
        expect([line[0]!.textContent, line[0]!.getAttribute('title')]).toEqual([card.headline!.text, card.headline!.title])
        expect(line[0]!.className).not.toMatch(/line-clamp|truncate/)
        // Each row core sends is in the opened card, which is hidden at rest; none is on the face.
        const panel = container.querySelector(`[data-view-more="${card.id}"]`)!
        expect(panel).not.toBeNull()
        expect(panel.hasAttribute('hidden')).toBe(true)
        const drawn = [...Array(card.rows.length).keys()].map((i) => container.querySelector(`[data-view-row="${card.id}.rows.${i}"], [data-view^="${card.id}.rows.${i}."]`)).filter((e) => e !== null)
        expect(drawn.length).toBeGreaterThan(0)
        for (const at of drawn) expect(panel.contains(at)).toBe(true)
        cleanup()
        // Opened: the rows are shown.
        const open = render(<ViewCard card={card} selected />).container
        expect(open.querySelector(`[data-view-more="${card.id}"]`)!.hasAttribute('hidden')).toBe(false)
        cleanup()
      }
    })
  }

  it('contrast: a View from an older core (no headline) keeps its rows on the face', () => {
    const card = older.model!.cards.find((c) => c.family === 'option' && c.rows.some((r) => r.kind === 'chance'))!
    expect(card.headline ?? null).toBeNull()
    const { container } = render(<ViewCard card={card} />)
    expect(container.querySelector('[data-option-face]')).toBeNull()
    const row = container.querySelector(`[data-view-row="${card.id}.rows.0"], [data-view^="${card.id}.rows.0."]`)!
    expect(row).not.toBeNull()
    expect(row.closest('[data-view-more]')).toBeNull()
  })
})
