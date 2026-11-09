/**
 * Canvas craft pass (9 Nov, UI lane; noA 7297ffeb items 6, 9, 12, ported onto V11). Bound by identity on golden Views:
 * - a proposed question has one rule with the cards: a solid info border; dashes mean core's doubt or Olumi's authorship (item 6);
 * - nothing on a card is faded at rest: no alpha colour token on an added (ghost) card's box, nor on an Olumi-authored one (item 12);
 * - core's marks (◆, ↻) beside a value or title are plain weight, so each card has one bold figure (item 9).
 * V11 draws the kind shape inline at 14 px (J1 gate 2946366a), so noA's top-edge glyph row (item 10) is not ported.
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
  it('CC1 a proposed question is solid info-bordered, never dashed; a plain one keeps V11\'s rule and carries no alpha border', () => {
    const q = structuredClone(golden('pricing').model!.question)
    q.proposed = true
    const box = render(<ViewQuestion question={q} width={600} />).container.querySelector<HTMLElement>('[data-view-question]')!
    expect(box.className.split(/\s+/)).toContain('border-info')
    expect(box.className).not.toContain('border-dashed')
    cleanup()
    q.proposed = false
    const plain = render(<ViewQuestion question={q} width={600} />).container.querySelector<HTMLElement>('[data-view-question]')!
    expect(plain.className.split(/\s+/)).toContain('border-text-light')
    expect(plain.className).not.toMatch(ALPHA)
  })
})

describe('craft: a card', () => {
  const v = golden('bakery')
  const card = (id: string) => v.model!.cards.find((c) => c.id === id)!
  it('CC2 an added (ghost) card is opaque; contrast: a kept card is the same opaque panel', () => {
    const added = structuredClone(card('second_oven'))
    added.change = { kind: 'added', glyph: '+', title: 'Proposed addition' } as typeof added.change
    const box = render(<ViewCard card={added} />).container.querySelector<HTMLElement>('[data-view-card]')!
    expect(box.dataset['proposedCard']).toBe('true')
    expect(box.className.split(/\s+/)).toContain('bg-panel')
    expect(box.className).not.toMatch(ALPHA)
  })
  it('CC3 an Olumi-authored (inferred) card is opaque, dashed in Olumi\'s colour', () => {
    const c = card('extra_sold_per_oven')
    expect(c.author?.by).toBe('olumi')
    const box = render(<ViewCard card={c} />).container.querySelector<HTMLElement>('[data-view-card]')!
    expect(box.dataset['inferred']).toBe('true')
    expect(box.className.split(/\s+/)).toEqual(expect.arrayContaining(['bg-panel', 'border-dashed', 'border-info']))
    expect(box.className).not.toMatch(ALPHA)
  })
  it('CC4 core\'s marks beside a chance and a title are plain weight; the chance itself is not', () => {
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
