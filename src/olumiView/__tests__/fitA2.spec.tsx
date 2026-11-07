/**
 * Option a2 (Paul's item 1, 6 Nov: his hiring board opened with 7 of 17 cards off screen at 0.9): (1) the previous PoC's family rows, so a
 * dense board is a few rows tall and its order under the options is kept; (2) the previous PoC's option face: the first aim's chance in
 * the big line, every other aim small and whole (R25: no cut text), and the outcome band's words in the DOM and on hover rather than a face line.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { typography } from '../../styles/typography'
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
  it('catch: the first aim is the big line (aim for readers and on hover); the second aim is small and whole (R25: no cut text)', () => {
    const c = render(<ViewCard card={card} />).container
    const lead = c.querySelector<HTMLElement>(`[data-view-row="${card.id}.rows.0"]`)!, next = c.querySelector<HTMLElement>(`[data-view-row="${card.id}.rows.1"]`)!
    const r0 = card.rows[0] as { aim: string; title: string; value: string }, r1 = card.rows[1] as { aim: string; title: string; value: string }
    // The 17px variant (coordinator, 6 Nov: measure whether "about 46% chance" fits one line on a 220 px card; at 20px it wrapped): was 20px.
    expect(lead.querySelector(`[data-row-value="${card.id}.rows.0"]`)!.className).toContain(typography.viewHeadline) // R25 scale A (Paul 7 Nov): the headline role, 18px; was 17px
    expect(lead.querySelector(`[data-view="${card.id}.rows.0.aim"]`)!.className).toContain('sr-only')
    expect(lead.getAttribute('title')).toBe(`${r0.aim} · ${r0.title}`)
    expect(next.querySelector(`[data-view="${card.id}.rows.1.aim"]`)!.className).not.toMatch(/line-clamp|truncate/) // R25 (Paul's finish line: no cut text): whole
    expect(next.querySelector(`[data-row-value="${card.id}.rows.1"]`)!.className).not.toContain(typography.viewHeadline) // the second aim stays small
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
    // On hover (Codex fit-a2 r1: the hover held only core's explanation, so the range's numbers were nowhere on screen): the words first.
    expect(c.querySelector('[data-testid="view-option-band-o1"]')!.getAttribute('title')).toBe(`${band.text}\n${band.title}`)
  })
  it('catch: a long second chance (core\'s conditional wording) is held inside the card, whole, its marks beside it', () => {
    // Codex fit-a2 r1: a one-line second chance could not shrink or wrap, so a long one ran past the 220 px card and pushed its marks out.
    // The wording is core's own, from the capacity board (add_specialist), set on the hiring card's second aim.
    const words = real('capacity').cards.find((c) => c.id === 'add_specialist')!.rows[0] as { value: string }
    const long = { ...card, rows: card.rows.map((r, i) => (i === 1 ? { ...r, value: words.value } : r)) } as typeof card
    const c = render(<ViewCard card={long} />).container
    const value = c.querySelector<HTMLElement>(`[data-row-value="${card.id}.rows.1"]`)!
    expect(value.textContent).toBe(words.value)
    expect(value.className).not.toContain('whitespace-nowrap')
    expect(value.className).not.toMatch(/line-clamp|truncate/); expect(value.className).toContain('max-w-[65%]') // R25 (Paul's finish line: no cut text): whole, wrapping inside the card
    expect(value.querySelector('[data-row-marks]')).toBeNull() // the marks in their own column, never inside the clamped value
    expect(value.parentElement!.querySelector(`[data-row-marks="${card.id}.rows.1"]`)).not.toBeNull()
  })
})

describe('worked-out values, a row per option, whole (R25)', () => {
  it('catch: the ↻ mark keeps its own column, so a long line wrapping never hides it', () => {
    // Codex fit-a2 r1: the whole row was cut short, and on the proposal golden the ↻ after add_one's long value was cut off with it.
    const pending = JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'proposal.view.json'), 'utf8')) as View
    const worked = pending.model!.cards.find((c) => c.figure !== null && (c.values?.length ?? 0) > 1)!
    const c = render(<ViewCard card={worked} ifApproved={{ glyph: '↻', title: 'If approved', i: 0 }} />).container
    const rows = [...c.querySelectorAll<HTMLElement>('[data-value-row]')]
    expect(rows.length).toBe(worked.values!.length)
    rows.forEach((r, i) => {
      const text = r.querySelector<HTMLElement>(`[data-view="${worked.id}.values.${i}.text"]`)!
      expect(text.textContent).toBe(worked.values![i]!.text)
      expect(text.className).not.toMatch(/line-clamp|truncate/) // R25 (Paul's finish line: no cut text): whole, and on hover
      expect(r.getAttribute('title')).toBe(worked.values![i]!.text)
      const mark = r.querySelector<HTMLElement>('[data-if-approved]')
      if (mark !== null) expect(mark.closest('.truncate, [class*="line-clamp"]'), `${worked.id} row ${i}`).toBeNull()
    })
    expect(rows.some((r) => r.querySelector('[data-if-approved]') !== null)).toBe(true) // core's own ↻ on add_one's value
  })
})
