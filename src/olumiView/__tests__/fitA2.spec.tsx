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
import type { View, ViewModel } from '../client'
import { CARD_WIDTH, causalPlaces, drawKindOf, familyTierOf, QUESTION_FLANKED_W, questionPlace, QUESTION } from '../layout'
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
    const m = structuredClone(real('hiring')), drop = new Set(m.cards.filter((c) => familyTierOf(c, m) === 3).slice(8).map((c) => c.id))
    return { ...m, cards: m.cards.filter((c) => !drop.has(c.id)), links: m.links.filter((l) => !drop.has(l.from) && !drop.has(l.to)) }
  }
  it('catch: a board shaped like Paul\'s is at most six rows tall, each family below the one before', async () => {
    const m = paulShaped(), { p, ys } = await rowsOf(m)
    expect(m.cards.filter((c) => familyTierOf(c, m) === 3)).toHaveLength(8)
    expect(ys.length).toBeLessThanOrEqual(6)
    // R25: the aims and the limit (row 5) are the head of the board, beside the question; every other family below the one before.
    const tier = (id: string) => (id === QUESTION ? 0 : familyTierOf(m.cards.find((c) => c.id === id)!, m))
    const aims = [...p.keys()].filter((id) => tier(id) === 5)
    expect(aims.length).toBe(2) // its two aims (the limit is a row on its aim card)
    for (const id of aims) expect(p.get(id)!.y, id).toBeLessThan(p.get(QUESTION)!.y + 300)
    for (const [a, pa] of p) for (const [b, pb] of p) if (tier(a) < tier(b) && tier(b) < 5) expect(pa.y, `${a} above ${b}`).toBeLessThan(pb.y)
  })
  it('must not change: a small board (pricing, no family wider than four) has one row per family present, and nothing overlaps', async () => {
    const m = (JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'pricing.view.json'), 'utf8')) as View).model!, { p, ys } = await rowsOf(m)
    const tiers = new Set([0, ...m.cards.map((c) => familyTierOf(c, m))])
    expect([...tiers].every((t) => t === 0 || m.cards.filter((c) => familyTierOf(c, m) === t).length <= 4)).toBe(true)
    expect(ys.length).toBe(tiers.size - (tiers.has(5) ? 1 : 0)) // R25: the aims share the question's row
    const boxes = [...p].map(([id, x]) => ({ id, ...x }))
    for (const a of boxes) for (const b of boxes) if (a.id < b.id && a.y === b.y) expect(Math.abs(a.x - b.x), `${a.id}/${b.id}`).toBeGreaterThanOrEqual(220)
  })
})

describe('R24 drivers and the head row (R25, Paul 7 Nov: drivers in their own row, the aims in view at 1232)', () => {
  // The R24 shape (core 0a5f8e69): options set levers (`through`), the levers feed the outcomes, the outcomes are what the aims read.
  const card = (id: string, family: string, h = 120) => ({ id, family, h }) as unknown as ViewModel['cards'][number]
  const link = (from: string, to: string, kind = 'plain') => ({ from, to, kind, label: '', doubt: false, alert: false, proposed: false, title: '', effect: null }) as unknown as ViewModel['links'][number]
  const r24 = {
    cards: [card('aim_cash', 'goal'), card('aim_deals', 'goal'), card('o1', 'option'), card('o2', 'option'), card('lever_a', 'quantity'), card('lever_b', 'quantity'), card('cash', 'quantity'), card('deals', 'quantity'), card('slip', 'risk')],
    links: [link('o1', 'lever_a', 'through'), link('o2', 'lever_a', 'through'), link('o1', 'lever_b', 'through'), link('o2', 'lever_b', 'through'),
      link('lever_a', 'cash'), link('lever_b', 'deals'), link('slip', 'cash'), link('cash', 'aim_cash'), link('deals', 'aim_deals')],
  } as unknown as ViewModel
  const kind = (id: string) => drawKindOf(r24.cards.find((c) => c.id === id)!, r24), tier = (id: string) => familyTierOf(r24.cards.find((c) => c.id === id)!, r24)
  it('catch: the levers the options set are drivers (F, a row of their own under the options); what they feed are the outcomes (OC)', () => {
    expect(['lever_a', 'lever_b'].map((id) => [kind(id), tier(id)])).toEqual([['factor', 2], ['factor', 2]])
    expect(['cash', 'deals'].map((id) => [kind(id), tier(id)])).toEqual([['outcome', 4], ['outcome', 4]])
  })
  it('catch: the aims sit beside the question, one each side, and the rows go options, drivers, outcomes', async () => {
    const p = await causalPlaces(r24, new Map(), questionPlace(r24).width), q = p.get(QUESTION)!
    expect(questionPlace(r24).width).toBe(QUESTION_FLANKED_W)
    expect([p.get('aim_cash')!.y, p.get('aim_deals')!.y]).toEqual([q.y, q.y])
    expect(p.get('aim_cash')!.x + CARD_WIDTH).toBeLessThanOrEqual(q.x)
    expect(p.get('aim_deals')!.x).toBeGreaterThanOrEqual(q.x + QUESTION_FLANKED_W)
    expect(p.get('o1')!.y).toBeLessThan(p.get('lever_a')!.y)
    expect(p.get('lever_a')!.y).toBeLessThan(p.get('cash')!.y)
  })
  it('catch (DL 7 Nov: an aim, then O3 and O4 of a four-option board, ran under the dock at 1232): on every golden and real board the head (the question, the aims beside it and every options row) is at most 760 wide, inside the visible canvas at 1232 at 1.0', async () => {
    const goldens = ['bakery', 'european', 'pricing', 'studio', 's_ce285b3617bb', 'app-launch', 'proposal', 'whatif'].map((n) => (JSON.parse(readFileSync(path.resolve('src/olumiView/golden', `${n}.view.json`), 'utf8')) as View).model!)
    const hosting = real('hosting')
    expect(hosting.cards.filter((c) => c.family === 'option')).toHaveLength(4) // precondition: the four-option real board
    for (const m of [...goldens, ...['hiring', 'capacity', 'european-22cards', 'bakery-r5', 'together'].map(real), hosting, r24]) {
      const qw = questionPlace(m).width, p = await causalPlaces(m, new Map(), qw)
      const head = [QUESTION, ...m.cards.filter((c) => { const t = familyTierOf(c, m); return t === 1 || t === 5 }).map((c) => c.id)]
      const left = Math.min(...head.map((id) => p.get(id)!.x)), right = Math.max(...head.map((id) => p.get(id)!.x + (id === QUESTION ? qw : CARD_WIDTH)))
      expect(right - left, `${head.length} head cards`).toBeLessThanOrEqual(760)
    }
  })
  it('CONTRAST: a driver is only a figure the options set that feeds another figure and no aim; every golden and real fixture is pinned by card id', () => {
    const goldens = ['bakery', 'european', 'pricing', 'studio', 's_ce285b3617bb', 'app-launch', 'proposal', 'whatif'].map((n) => [n, (JSON.parse(readFileSync(path.resolve('src/olumiView/golden', `${n}.view.json`), 'utf8')) as View).model!] as const)
    const boards = [...goldens, ...['hiring', 'capacity', 'european-22cards', 'bakery-r5', 'together'].map((n) => [n, real(n)] as const)]
    // core 6192ad6b's app-launch golden has an option (option_delay) set a figure (release_offset) that feeds another figure (readiness_margin):
    // its one driver. Monthly churn (european) is set by two options but is measured by a limit, an aim, so it is no driver: it feeds an aim directly.
    const want: Record<string, string[]> = { 'app-launch': ['release_offset'] }
    for (const [n, m] of boards) expect(m.cards.filter((c) => familyTierOf(c, m) === 2).map((c) => c.id), n).toEqual(want[n] ?? [])
  })
})

describe('the option face', () => {
  const m = real('hiring'), card = m.cards.find((c) => c.id === 'hire_tech_lead')!
  it('catch: the first aim is the big line (aim for readers and on hover); the second aim is small and whole (R25: no cut text)', () => {
    const c = render(<ViewCard card={card} />).container
    const lead = c.querySelector<HTMLElement>(`[data-view-row="${card.id}.rows.0"]`)!, next = c.querySelector<HTMLElement>(`[data-view-row="${card.id}.rows.1"]`)!
    const r0 = card.rows[0] as { aim: string; title: string; value: string }, r1 = card.rows[1] as { aim: string; title: string; value: string }
    // The 17px variant (coordinator, 6 Nov: measure whether "about 46% chance" fits one line on a 220 px card; at 20px it wrapped): was 20px.
    // R25 scale A (Paul 7 Nov): core's value is the headline role, 18px (was 17px); its qualifier is reading size so it fits one line (C1).
    expect(lead.querySelector(`[data-view="${card.id}.rows.0.value"]`)!.className).toContain(typography.viewHeadline)
    const approx = lead.querySelector(`[data-view="${card.id}.rows.0.approx"]`)
    if (approx !== null) expect(approx.className).toContain(typography.viewValue)
    // DL/PL ruling 7 Nov (Paul: "can't tell which aim a chance is for"): with more than one aim, as here, the lead chance names its aim on the
    // face; a one-aim board keeps it for readers and on hover (cardReadable.spec.tsx).
    expect(lead.querySelector(`[data-view="${card.id}.rows.0.aim"]`)!.className).not.toContain('sr-only')
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
    expect(value.className).not.toMatch(/line-clamp|truncate/); expect(value.className).toContain('min-w-0') // R25 (Paul's finish line: no cut text): whole, on its own line, wrapping inside the card
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
