/**
 * Option a2 (Paul's item 1, 6 Nov: his hiring board opened with 7 of 17 cards off screen at 0.9): (1) the previous PoC's family rows, so a
 * dense board is a few rows tall and its order under the options is kept; (2) the previous PoC's option face: the first aim's chance in
 * the big line, every other aim one line whole on hover, and the outcome band's words in the DOM and on hover rather than a face line.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../client'
import { causalPlaces, familyTierOf, questionPlace, QUESTION } from '../layout'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'
import { ViewOptionBand } from '../v10'

afterEach(cleanup)
const real = (n: string) => (JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', `${n}.view3.json`), 'utf8')) as View).model!
const rowsOf = async (m: NonNullable<View['model']>) => {
  const p = await causalPlaces(m, new Map(), questionPlace(m).width)
  return { p, ys: [...new Set([...p.values()].map((x) => Math.round(x.y)))].sort((a, b) => a - b) }
}

describe('family rows', () => {
  // A board shaped like Paul's 6 Nov hiring board (3 options, 8 factors and assumptions, worked-out figures, 2 aims and a limit): the real
  // dense hiring fixture with its last five factor cards (and their links) taken out. Depth rows drew his board 8 rows tall.
  const paulShaped = () => {
    const m = structuredClone(real('hiring')), drop = new Set(m.cards.filter((c) => familyTierOf(c, m) === 2).slice(8).map((c) => c.id))
    return { ...m, cards: m.cards.filter((c) => !drop.has(c.id)), links: m.links.filter((l) => !drop.has(l.from) && !drop.has(l.to)) }
  }
  it('catch: a board shaped like Paul\'s is at most six rows tall, each family below the one before', async () => {
    const m = paulShaped(), { p, ys } = await rowsOf(m)
    expect(m.cards.filter((c) => familyTierOf(c, m) === 2)).toHaveLength(8)
    expect(ys.length).toBeLessThanOrEqual(6)
    const tier = (id: string) => (id === QUESTION ? 0 : familyTierOf(m.cards.find((c) => c.id === id)!, m))
    for (const [a, pa] of p) for (const [b, pb] of p) if (tier(a) < tier(b)) expect(pa.y, `${a} above ${b}`).toBeLessThan(pb.y)
  })
  it('must not change: a small board (pricing, no family wider than four) has one row per family present, and nothing overlaps', async () => {
    const m = (JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'pricing.view.json'), 'utf8')) as View).model!, { p, ys } = await rowsOf(m)
    const tiers = new Set([0, ...m.cards.map((c) => familyTierOf(c, m))])
    expect([...tiers].every((t) => t === 0 || m.cards.filter((c) => familyTierOf(c, m) === t).length <= 4)).toBe(true)
    expect(ys.length).toBe(tiers.size)
    const boxes = [...p].map(([id, x]) => ({ id, ...x }))
    for (const a of boxes) for (const b of boxes) if (a.id < b.id && a.y === b.y) expect(Math.abs(a.x - b.x), `${a.id}/${b.id}`).toBeGreaterThanOrEqual(220)
  })
})

describe('the option face', () => {
  const m = real('hiring'), card = m.cards.find((c) => c.id === 'hire_tech_lead')!
  it('catch: the first aim is the big line (aim for readers and on hover); the second aim is one line, cut short, whole on hover', () => {
    const c = render(<ViewCard card={card} />).container
    const lead = c.querySelector<HTMLElement>(`[data-view-row="${card.id}.rows.0"]`)!, next = c.querySelector<HTMLElement>(`[data-view-row="${card.id}.rows.1"]`)!
    const r0 = card.rows[0] as { aim: string; title: string; value: string }, r1 = card.rows[1] as { aim: string; title: string; value: string }
    expect(lead.querySelector(`[data-row-value="${card.id}.rows.0"]`)!.className).toContain('text-[20px]')
    expect(lead.querySelector(`[data-view="${card.id}.rows.0.aim"]`)!.className).toContain('sr-only')
    expect(lead.getAttribute('title')).toBe(`${r0.aim} · ${r0.title}`)
    expect(next.querySelector(`[data-view="${card.id}.rows.1.aim"]`)!.className).toContain('truncate')
    expect(next.querySelector(`[data-row-value="${card.id}.rows.1"]`)!.className).not.toContain('text-[20px]')
    expect(next.getAttribute('title')).toBe(`${r1.aim} · ${r1.title}`)
    expect(c.textContent).toContain(r0.value); expect(c.textContent).toContain(r1.value) // core's words, verbatim
  })
  it('catch: the band\'s words are in the DOM for readers and on hover, not a line on the face', () => {
    const band = { leftPct: 10, widthPct: 50, medianPct: 30, text: 'between 89.7 and 110 tickets/week (middle 99.9)', title: 'the middle 80% of the draws', at: 'o1.rows.0.outcome.text', aim: null }
    const c = render(<ViewOptionBand id="o1" band={band} />).container
    const words = c.querySelector<HTMLElement>('[data-view="o1.rows.0.outcome.text"]')!
    expect(words.textContent).toBe(band.text)
    expect(words.className).toContain('sr-only')
    expect(c.querySelector('[role="img"]')!.getAttribute('aria-label')).toBe(band.text)
  })
})
