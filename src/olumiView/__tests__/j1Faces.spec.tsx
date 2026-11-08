/**
 * J1 step 3 (DL 8 Nov, Codex's order: "card faces"): on the real bookshop View (fixtures/j1, core 5d8a009b), each card shows who or what
 * it is from in core's words (author.text), its source on hover (author.title); a card Olumi inferred is dashed in Olumi's colour; nothing
 * is said twice: while no option has a chance, no option card repeats "No chance can be worked out for this option yet".
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render } from '@testing-library/react'
import type { View } from '../client'
import { optionsNotYet } from '../layout'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'

const view: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/j1/bookshop-v1-open.core-5d8a009b.view3.json'), 'utf8'))
const card = (id: string) => view.model!.cards.find((c) => c.id === id)!

describe('provenance on the face, in core’s words', () => {
  it('Tom’s option says "Stated by Tom", its source on hover; Olumi’s inferred figure says "Olumi’s estimate" and is dashed in Olumi’s colour', () => {
    const tom = render(<ViewCard card={card('price_cut')} />).container
    const label = tom.querySelector('[data-provenance="price_cut"]')!
    expect([label.textContent, label.getAttribute('title')]).toEqual([card('price_cut').author!.text, card('price_cut').author!.title])
    expect(tom.querySelector('[data-view-card]')!.className).not.toContain('border-dashed')
    const visits = render(<ViewCard card={card('visits')} />).container
    expect(visits.querySelector('[data-provenance="visits"]')!.textContent).toBe(card('visits').author!.text)
    expect(visits.querySelector('[data-view-card]')!.className).toContain('border-dashed')
    expect(visits.querySelector('[data-view-card]')!.className).toContain('border-info')
  })
})

describe('the author at rest only on Olumi’s cards (design owner, 8 Nov)', () => {
  it('Olumi’s estimate is on the face at rest; Tom’s option keeps "Stated by Tom" for hover and the opened card, not at rest', () => {
    const visits = render(<ViewCard card={card('visits')} />).container.querySelector('[data-provenance="visits"]')!
    expect(visits.className).not.toMatch(/(^| )hidden( |$)/)
    expect(visits.getAttribute('data-provenance-at-rest')).toBe('true')
    const tom = render(<ViewCard card={card('price_cut')} />).container.querySelector('[data-provenance="price_cut"]')!
    expect(tom.className).toMatch(/(^| )hidden( |$)/)
    expect(tom.className).toContain('group-hover:inline-block')
    expect(tom.getAttribute('data-provenance-at-rest')).toBeNull()
  })
  it('CONTRAST: opened, a person’s card says who it is from', () => {
    const tom = render(<ViewCard card={card('price_cut')} selected />).container.querySelector('[data-provenance="price_cut"]')!
    expect(tom.className).not.toMatch(/(^| )hidden( |$)/)
    expect(tom.textContent).toBe(card('price_cut').author!.text)
  })
})

describe('nothing said twice', () => {
  it('no option has a chance yet: each option card leaves its "none" row to the panel', () => {
    expect(optionsNotYet(view.model)).toBe(true)
    const row = card('newsletter').rows.findIndex((r) => r.kind === 'none')
    const c = render(<ViewCard card={card('newsletter')} notYet />).container
    expect(c.querySelector(`[data-view^="newsletter.rows.${row}."]`)).toBeNull()
  })
  it('CONTRAST: an option with a chance keeps its rows, and so does every option on that board', () => {
    const withChance = { ...view.model!, cards: view.model!.cards.map((c) => (c.id === 'price_cut' ? { ...c, rows: [{ ...c.rows[0]!, kind: 'chance' }] as never } : c)) }
    expect(optionsNotYet(withChance)).toBe(false)
    const c = render(<ViewCard card={card('newsletter')} />).container
    expect(c.querySelector(`[data-view^="newsletter.rows.0."]`)).not.toBeNull()
  })
})
