/**
 * Option a2: the restored layout keeps cards separate and aims last; the option face keeps the first aim's chance in
 * the big line, every other aim small and whole (R25: no cut text), and the outcome band's words in the DOM and on hover rather than a face line.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { typography } from '../../styles/typography'
import { cleanup, render } from '@testing-library/react'
import type { View, ViewModel } from '../client'
import { CARD_WIDTH, causalPlaces, drawKindOf, familyTierOf, questionPlace, QUESTION } from '../layout'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'
import { ViewOptionBand } from '../v10'

afterEach(cleanup)
const real = (n: string) => (JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', `${n}.view3.json`), 'utf8')) as View).model!
describe('the restored small board', () => {
  // UI restore stage 1 (DL ruling 10 Nov): the at-most-six family rows rule retired; restoreLayout.spec.ts pins its replacement.
  // UI restore stage 1 (DL ruling 10 Nov): family wrapping is retired; keep separation at each card's drawn width and height.
  it('pricing: no two cards overlap, including the question', async () => {
    const m = (JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'pricing.view.json'), 'utf8')) as View).model!
    const p = await causalPlaces(m, new Map())
    const boxes = [{ id: QUESTION, ...p.get(QUESTION)!, w: questionPlace(m).width, h: 85 }, ...m.cards.map((c) => ({ id: c.id, ...p.get(c.id)!, w: CARD_WIDTH, h: c.h }))]
    for (const a of boxes) for (const b of boxes) if (a.id < b.id) expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h, `${a.id} overlaps ${b.id}`).toBe(false)
  })
})

describe('R24 drivers and the restored top-to-bottom layout', () => {
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
  // UI restore stage 1 (DL ruling 10 Nov): aims follow the outcomes; options, drivers and outcomes retain their top-to-bottom order.
  it('the question heads the options, then drivers, then outcomes, with both aims last', async () => {
    const p = await causalPlaces(r24, new Map()), y = (id: string) => p.get(id)!.y
    for (const id of ['o1', 'o2']) expect(y(id), id).toBeGreaterThan(y(QUESTION))
    for (const driver of ['lever_a', 'lever_b']) {
      for (const option of ['o1', 'o2']) expect(y(driver), `${driver} below ${option}`).toBeGreaterThan(y(option))
      for (const outcome of ['cash', 'deals']) expect(y(outcome), `${outcome} below ${driver}`).toBeGreaterThan(y(driver))
    }
    for (const aim of ['aim_cash', 'aim_deals']) {
      for (const c of r24.cards.filter((c) => c.family !== 'goal')) expect(y(aim), `${aim} below ${c.id}`).toBeGreaterThan(y(c.id))
    }
  })
  // UI restore stage 1 (DL ruling 10 Nov): the 760-wide head with flanking aims rule retired; restoreLayout.spec.ts pins its replacement.
  it('CONTRAST: the drivers on every golden and real fixture are exactly these, pinned by card id', () => {
    const goldens = ['bakery', 'european', 'pricing', 'studio', 's_ce285b3617bb', 'app-launch', 'proposal', 'whatif'].map((n) => [n, (JSON.parse(readFileSync(path.resolve('src/olumiView/golden', `${n}.view.json`), 'utf8')) as View).model!] as const)
    const boards = [...goldens, ...['hiring', 'capacity', 'european-22cards', 'bakery-r5', 'together'].map((n) => [n, real(n)] as const)]
    // Drivers by structure (layout.isDriver): core 6192ad6b's app-launch has option_delay set release_offset, which feeds readiness_margin; its
    // european has two options set the person-stated monthly churn (`churn_rate`, editable), which feeds `customers`. A figure core works out
    // from others stays an outcome in the viewKinds contrast; these two are set by the options, so they sit in the drivers' own row.
    const want: Record<string, string[]> = { 'app-launch': ['release_offset'], european: ['churn_rate'] }
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
