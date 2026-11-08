/**
 * J1 re-gate (9 Nov): the three core fields the gate rows waited on, bound by identity on core's OWN Views (fixtures/j1, served by a
 * olumi-core wip/fl1-short eee8278e, on candidate 6f6b2b0e which holds PR #22 41765715; zero calls, a store copy):
 * - FL1 `cards[].face`: the face's title and line, said once, core's words whole; the whole label stays the heading for a screen reader.
 * - PR #22 `collab.link_marks`: one chip on the line it is about, found by the line's `holds`, never by its two ends.
 * - PR #22 `collab.marks[].question`: the open chip's own closing question at the dock's foot, before the round's `collab.next`.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render } from '@testing-library/react'
import type { View } from '../client'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'
import { linkMarkOf } from '../LinkMarkChip'
import { revealOf } from '../reveal'

const load = (f: string): View => JSON.parse(readFileSync(path.resolve(`src/olumiView/fixtures/j1/${f}`), 'utf8'))
const bookshop = load('bookshop-v1-open.core-eee8278e.view3.json'), strategy = load('strategy-reveal.core-eee8278e.view3.json')
const card = (id: string) => bookshop.model!.cards.find((c) => c.id === id)!

describe('FL1: the card face in core’s words', () => {
  it('revenue’s title is Maya’s own words; the whole label is still read', () => {
    const c = card('monthly_revenue'), el = render(<ViewCard card={c} />).container
    expect(c.face.title).toEqual({ text: 'Revenue’s been flat since May, about £4,300 a month', whole: false, words: 'theirs' })
    const title = el.querySelector(`[data-view="monthly_revenue.face.title.text"]`)!
    expect([title.textContent, title.getAttribute('data-face-words')]).toEqual([c.face.title!.text, 'theirs'])
    expect(el.querySelector('[data-view="monthly_revenue.heading"]')!.className).toContain('sr-only')
    expect(el.querySelector('[data-view="monthly_revenue.heading"]')!.textContent).toBe('Monthly revenue')
  })
  it('an inferred driver says its explanation and its one line, both Olumi’s, whole', () => {
    const c = card('spend_per_visit'), el = render(<ViewCard card={c} />).container
    expect(el.querySelector('[data-view="spend_per_visit.face.title.text"]')!.textContent).toBe('Each visit buys less')
    const line = el.querySelector('[data-view="spend_per_visit.face.line.text"]')!
    expect([line.textContent, line.getAttribute('data-face-words')]).toEqual(['Same visits, smaller baskets.', 'olumi'])
  })
  it('CONTRAST: a card whose title is its own name draws the heading once, with no line', () => {
    const el = render(<ViewCard card={card('price_cut')} />).container
    expect(el.querySelector('[data-view="price_cut.heading"]')!.className).not.toContain('sr-only')
    expect(el.querySelector('[data-view="price_cut.face.title.text"]')).toBeNull()
    expect(el.querySelector('[data-view="price_cut.face.line.text"]')).toBeNull()
  })
})

describe('PR #22: a link chip, found by what the line holds', () => {
  const lines = strategy.model!.links
  const effort = lines.find((l) => l.holds?.record === 'i_effort_pilot')!
  it('the doubted line carries core’s chip: "Priya doubts this link", her words as its hover', () => {
    const m = linkMarkOf(strategy, effort)!
    expect([m.text, m.title, m.stances.map((s) => [s.by, s.stance])]).toEqual(['Priya doubts this link', strategy.collab.link_marks![0]!.title, [['Priya', 'doubt']]])
  })
  it('CONTRAST: a line between the same two cards that holds another record gets no chip (never keyed on its ends)', () => {
    expect(linkMarkOf(strategy, { ...effort, holds: { record: 'i_speed_pilot', part: null } })).toBeNull()
    expect(linkMarkOf(strategy, { ...effort, holds: null })).toBeNull()
  })
})

describe('PR #22: each chip’s own closing question', () => {
  it('the Cross-team adoption chip carries core’s question, not the round’s', () => {
    const chip = revealOf(strategy)!.cardChips.get('cross_team_adoption')!.find((c) => c.kind === 'shared')!
    expect(chip.question).toBe('Do Tom, Maya and Priya mean the same thing by \'Cross-team adoption\'?')
    expect(chip.question).not.toBe(strategy.collab.next?.text ?? null)
  })
})
