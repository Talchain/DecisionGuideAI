/**
 * J1 re-gate (9 Nov): the three core fields the gate rows waited on, bound by identity on core's OWN Views (fixtures/j1, served by a
 * olumi-core candidate 261df1d4 (FL1 face + PR #22 + PR #24); zero calls; the Reveal board seeded in split shape by FL1's
 * seed-split.mts (olumi-core wip/fl1-reveal-seed e8502ecf) with Priya's view, the reveal and one link doubt replayed):
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
import { routeRailAtRest } from '../layout'

const load = (f: string): View => JSON.parse(readFileSync(path.resolve(`src/olumiView/fixtures/j1/${f}`), 'utf8'))
const bookshop = load('bookshop-v1-open.core-261df1d4.view3.json'), strategy = load('strategy-reveal-split.core-261df1d4.view3.json')
const card = (id: string) => bookshop.model!.cards.find((c) => c.id === id)!
const route = (id: string) => strategy.model!.cards.find((c) => c.id === id)!

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

describe('the routes stay whole at 1232: what each says once', () => {
  it('a "no chance yet" core shares across the routes is not on each route card (the panel says it once)', () => {
    const c = route('product_team_beachhead')
    expect([c.headline?.text, c.headline?.shared]).toEqual(['No chance yet', true])
    const el = render(<ViewCard card={c} />).container
    expect(el.querySelector('[data-option-face="product_team_beachhead"]')).toBeNull()
  })
  it('while no option has a chance, an option’s own "no chance yet" is folded too (J1)', () => {
    const c = card('price_cut')
    expect(c.headline?.state).toBe('none')
    expect(render(<ViewCard card={c} notYet />).container.querySelector('[data-option-face="price_cut"]')).toBeNull()
    expect(render(<ViewCard card={c} />).container.querySelector('[data-option-face="price_cut"]')).not.toBeNull()
  })
  it('a route’s own quote is on its card when opened, not at rest; a factor’s line is always on its face', () => {
    const c = route('product_team_beachhead'), rest = render(<ViewCard card={c} />).container.querySelector('[data-view="product_team_beachhead.face.line.text"]')!
    expect([rest.textContent, rest.className.includes('group-hover:block')]).toEqual(['start inside product teams as a beachhead', true])
    expect(rest.className).toMatch(/(^| )hidden( |$)/)
    const open = render(<ViewCard card={c} selected />).container.querySelector('[data-view="product_team_beachhead.face.line.text"]')!
    expect(open.className).not.toMatch(/(^| )hidden( |$)/)
    const factor = render(<ViewCard card={route('cross_team_adoption')} />).container.querySelector('[data-view="cross_team_adoption.face.line.text"]')!
    expect(factor.className).not.toMatch(/(^| )hidden( |$)/)
  })
  it('a route’s rail into a factor waits for either card to be active; a story link and a non-rail route link do not', () => {
    const l = strategy.model!.links.find((x) => x.from === 'top_down_enterprise_sale' && x.to === 'cross_team_adoption')!
    expect(routeRailAtRest(l, true, true, new Set())).toBe(false)
    expect(routeRailAtRest(l, true, true, new Set(['cross_team_adoption']))).toBe(true)
    expect(routeRailAtRest(l, true, false, new Set())).toBe(true)
    const story = strategy.model!.links.find((x) => x.from === 'speed_to_value' && x.to === 'pilot_conversion')!
    expect(routeRailAtRest(story, false, true, new Set())).toBe(true)
  })
})
