/**
 * THE ANALYSIS WITHOUT THE WALL (DL 4 Nov, R3, approved shape; core's side follows): each chance finding is at most two sentences in
 * core's `text`, and what it rests on is core's structured `rests_on` plus core's one line `rests_on_text` (standin.ts). Fixture: the
 * bakery View from the wire, with the stand-in fields written in by hand in their approved shape: a what-if on a figure a person sets
 * (repair_chance), an estimate on a record a card's badge folds (extra_sold_per_oven, on `sales`, which offers no edit) and an
 * approximation on a risk (oven_repair), so each kind reaches a card the lens would not otherwise mark.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View, ViewModel } from '../client'
import { restsOnOf } from '../layout'
import { ViewChances } from '../ViewChances'

const golden: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/bakery.view.json'), 'utf8'))
afterEach(cleanup)

const basis = { reading: true, target: false, what_ifs: ['repair_chance'], estimates: ['extra_sold_per_oven'], approx: ['oven_repair'] }
const finding = (id: string) => ({ text: `Finding for ${id}, in this model. The chance could move by a few points either way.`, rests_on: basis, rests_on_text: `Rests on Olumi's estimates for ${id}.` })
const model: ViewModel = {
  ...golden.model!,
  cards: golden.model!.cards.map((c) => (c.family !== 'option' ? c : { ...c, rows: c.rows.map((r) => (r.kind === 'chance' ? { ...r, ...finding(c.id) } : r)) as typeof c.rows })),
  run: { ...golden.model!.run!, most_likely: { ...golden.model!.run!.most_likely!, rests_on: basis, rests_on_text: 'Rests on Olumi\'s reading of the aim.' } as NonNullable<NonNullable<ViewModel['run']>['most_likely']> },
}
const chanceRows = model.cards.flatMap((c) => c.rows.flatMap((r, i) => (r.kind === 'chance' ? [{ card: c, i, row: r as typeof r & ReturnType<typeof finding> }] : [])))
const occurrences = (hay: string, needle: string) => hay.split(needle).length - 1

describe('each option\'s finding, not the wall', () => {
  it('each option draws its finding in core\'s words, at most two sentences, and never the whole fact (the wall, still its hover)', () => {
    expect(chanceRows.length).toBe(3)
    const c = render(<ViewChances model={model} />).container
    for (const { card, i, row } of chanceRows) {
      const drawn = c.querySelector(`[data-view="${card.id}.rows.${i}.text"]`)?.textContent ?? ''
      expect(drawn, card.id).toBe(row.text)
      expect(drawn.match(/[.!?](\s|$)/g)?.length ?? 0, `${card.id}: sentences`).toBeLessThanOrEqual(2)
      expect(c.textContent?.includes(row.title), `${card.id}: the wall is not drawn as text`).toBe(false)
      expect(c.querySelector(`[data-view-row="${card.id}.rows.${i}"]`)?.getAttribute('title')).toBe(row.title)
    }
  })
  it('core\'s rests_on_text is drawn verbatim, once each, under its finding (and under the most likely line)', () => {
    const c = render(<ViewChances model={model} />).container, all = c.textContent ?? ''
    for (const { card, i, row } of chanceRows) {
      expect(c.querySelector(`[data-view="${card.id}.rows.${i}.rests_on_text"]`)?.textContent, card.id).toBe(row.rests_on_text)
      expect(occurrences(all, row.rests_on_text), card.id).toBe(1)
    }
    expect(c.querySelector('[data-view="run.most_likely.rests_on_text"]')?.textContent).toBe('Rests on Olumi\'s reading of the aim.')
    expect(occurrences(all, 'Rests on Olumi\'s reading of the aim.')).toBe(1)
  })
  it('every card a finding rests on is marked on the Rests on lens: a what-if, an estimate folded into a badge, an approximation', () => {
    const { items } = restsOnOf(model)
    for (const id of ['repair_chance', 'sales', 'oven_repair']) expect(items.has(id), id).toBe(true)
    // CONTRAST: without the stand-in, the risk and the worked-out figure are not on the lens.
    const plain = restsOnOf(golden.model!).items
    expect([plain.has('sales'), plain.has('oven_repair')]).toEqual([false, false])
  })
  it('must not change: a View without the stand-in draws exactly as before (no finding, no footnote)', () => {
    const c = render(<ViewChances model={golden.model!} />).container
    expect(c.querySelectorAll('[data-view$=".rests_on_text"], [data-view$=".rows.1.text"]').length).toBe(0)
  })
})
