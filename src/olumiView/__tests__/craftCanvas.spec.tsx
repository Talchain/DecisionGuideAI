/**
 * Canvas craft pass (9 Nov, UI lane; plan items 6, 9, 10, 12). Bound by identity on golden Views:
 * - a proposed question has one rule with the cards: a solid info border; dashes mean core's doubt only (item 6);
 * - nothing on a card or the question is faded at rest: no alpha colour token on the box (item 12);
 * - the kind glyph on the top edge is 12px, so it no longer outshouts the words (item 10);
 * - core's marks (◆, ↻) beside a value or title are plain weight, so each card has one bold figure (item 9).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../client'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'
import { ViewQuestion } from '../../canvas/nodes/ViewQuestionNode'

const golden = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', `${n}.view.json`), 'utf8'))
const ALPHA = /(^|\s)(bg|border|text)-[\w-]+\/\d+(\s|$)/
afterEach(cleanup)

describe('craft: the question', () => {
  it('a proposed question is solid info-bordered, never dashed; a plain one carries no alpha border', () => {
    const q = structuredClone(golden('pricing').model!.question)
    q.proposed = true
    const box = render(<ViewQuestion question={q} width={600} />).container.querySelector<HTMLElement>('[data-view-question]')!
    expect(box.className.split(/\s+/)).toContain('border-info')
    expect(box.className).not.toContain('border-dashed')
    cleanup()
    q.proposed = false
    const plain = render(<ViewQuestion question={q} width={600} />).container.querySelector<HTMLElement>('[data-view-question]')!
    expect(plain.className.split(/\s+/)).toContain('border-border')
    expect(plain.className).not.toMatch(ALPHA)
  })
  it('its kind glyph is 12px', () => {
    const q = golden('pricing').model!.question
    const svg = render(<ViewQuestion question={q} width={600} />).container.querySelector('[data-kind-glyph="question"] svg')!
    expect([svg.getAttribute('width'), svg.getAttribute('height')]).toEqual(['12', '12'])
  })
})

describe('craft: a card', () => {
  const v = golden('bakery')
  const card = (id: string) => v.model!.cards.find((c) => c.id === id)!
  it('its kind glyph is 12px, and an added (ghost) card is opaque', () => {
    const c = card('second_oven')
    const r = render(<ViewCard card={c} />).container
    const svg = r.querySelector(`[data-kind-glyph="${c.id}"] svg`)!
    expect([svg.getAttribute('width'), svg.getAttribute('height')]).toEqual(['12', '12'])
    cleanup()
    const added = structuredClone(c)
    added.change = { kind: 'added', glyph: '+', title: 'Proposed addition' } as typeof added.change
    const box = render(<ViewCard card={added} />).container.querySelector<HTMLElement>('[data-view-card]')!
    expect(box.dataset['proposedCard']).toBe('true')
    expect(box.className).not.toMatch(ALPHA)
  })
  it('core\'s marks beside a chance and a title are plain weight; the chance itself is not', () => {
    const c = card('second_oven')
    const r = render(<ViewCard card={c} />).container
    const i = c.rows.findIndex((row) => row.kind === 'chance' && row.olumi !== null)
    expect(i).toBeGreaterThanOrEqual(0)
    const mark = r.querySelector<HTMLElement>(`[data-view="${c.id}.rows.${i}.olumi.glyph"]`)!
    expect(mark.className.split(/\s+/)).toContain('font-normal')
    expect(r.querySelector<HTMLElement>(`[data-row-value="${c.id}.rows.${i}"]`)!.className).not.toContain('font-normal')
    cleanup()
    const titled = card('extra_sold_per_oven')
    const t = render(<ViewCard card={titled} />).container.querySelector<HTMLElement>(`[data-view="${titled.id}.olumi.glyph"]`)!
    expect(t.className.split(/\s+/)).toContain('font-normal')
  })
})
