/**
 * Each option's reasoning in the Reasoning tab (Paul 11 Nov, PL-252), on two REAL models copied unedited:
 *   a7-reveal: the A7 workshop journey after two people revealed (run 20261111-journey-ec692296, PL-reveal-view.json, version 3);
 *   european-loop9: the European brief's first model, held proposal (first-model loop 9, e33447b1 r1, european/view3.json);
 *   a7-sci10: the same A7 store (a .backup copy) read through core SCI-10 FINAL wip/science-join fd672840 (zero calls; 4d0c3634 read it byte for byte but the commit stamp), which adds the
 *   option cards' `sets` and labelled `rests_on`.
 * Bound by IDENTITY: each option and each row by its card id, each word by its View path (`expectAllBound`).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { View } from '../../client'
import { useViewStore } from '../../store'
import { useMe } from '../../../olumiCore/me'
import { useCanvasStore } from '../../../canvas/store'
import { registerFocusHelpers } from '../../../canvas/utils/focusHelpers'
import { Rack, throughId, throughOf } from '../Rack'
import { ViewReasoning } from '../../ViewReasoning'
import { expectAllBound } from '../../port/__tests__/viewAt'

const read = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/reasoning/__tests__/fixtures', `${n}.view3.json`), 'utf8'))
const A7 = read('a7-reveal'), EU = read('european-loop9'), A7S = read('a7-sci10')
const ready = (view: View, tab = false) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  return render(tab ? <ViewReasoning model={view.model!} /> : <Rack model={view.model!} view={view} />)
}
const rack = () => screen.getByTestId('view-reasoning-rack')
const option = (id: string) => rack().querySelector<HTMLElement>(`[data-rack-option="${id}"]`)!
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }); useCanvasStore.getState().clearSelection() })

describe('each option\'s reasoning, from the real model, every word core\'s', () => {
  for (const [name, view] of [['a7-reveal', A7], ['european-loop9', EU], ['a7-sci10', A7S]] as const) {
    it(`${name}: options in core's order; each row its card by id, in core's order; every drawn string is the View's string at its path`, () => {
      ready(view)
      const m = view.model!, options = m.cards.filter((c) => c.family === 'option')
      expect([...rack().querySelectorAll<HTMLElement>('[data-rack-option]')].map((e) => e.dataset['rackOption'])).toEqual(options.map((o) => o.id))
      for (const o of options) {
        // Independently: the option's own settings (`sets`); every card linked to or from it but by a reason link, in link order; what core
        // says it rests on (`rests_on`, a card or a labelled entry); then each card its chance rows name.
        const want: string[] = []
        for (const st of o.sets ?? []) if (!want.includes(st.id)) want.push(st.id)
        m.links.forEach((l) => { if (l.kind === 'reason') return; const x = l.from === o.id ? l.to : l.to === o.id ? l.from : null; if (x !== null && m.cards.some((c) => c.id === x) && !want.includes(x)) want.push(x) })
        for (const r of o.rests_on ?? []) if ((m.cards.some((c) => c.id === r.id) || (r.label ?? '') !== '') && !want.includes(r.id)) want.push(r.id)
        for (const r of o.rows) for (const id of [...((r as { rests_on?: { what_ifs?: string[]; estimates?: string[]; approx?: string[] } | null }).rests_on?.what_ifs ?? []), ...((r as { rests_on?: { estimates?: string[] } | null }).rests_on?.estimates ?? []), ...((r as { rests_on?: { approx?: string[] } | null }).rests_on?.approx ?? [])])
          if (m.cards.some((c) => c.id === id) && !want.includes(id)) want.push(id)
        expect([...option(o.id).querySelectorAll<HTMLElement>('[data-rack-through]')].map((e) => e.dataset['rackThrough']), o.id).toEqual(want)
        expect(throughOf(m, o).map(throughId)).toEqual(want)
        // Each own premise, except one in a challenged card's words (drawn as that challenge in the tab's challenge zone).
        const challenged = new Set(m.cards.flatMap((c) => (c.challenged === true && c.reason !== null ? [c.reason] : [])))
        expect([...option(o.id).querySelectorAll<HTMLElement>('[data-rack-premise]')].map((e) => e.dataset['rackPremise'])).toEqual((o.premises ?? []).flatMap((p) => (challenged.has(p.text) ? [] : [p.id])))
      }
      expect(expectAllBound(view, rack(), expect)).toBeGreaterThan(10)
      // The chances stay in Analysis (DL ruling 9 Nov): no chance row's words here.
      for (const o of options) for (const r of o.rows) if (r.kind === 'chance' && 'value' in r) expect(rack().textContent).not.toContain(String((r as { value: string }).value))
    })
  }

  it('A7 hire: its inputs are the person\'s figures, named whose by core (Dana\'s 6 hours; Tomasz\'s figure, Olumi\'s range)', () => {
    ready(A7)
    const hire = option('hire_a_part_time_mechanic')
    for (const id of ['mechanic_hours_available_for_repairs_changed_hire_a_part_time_me', 'extra_monthly_spend_on_the_workshop_changed_hire_a_part_time_mec', 'current_average_wait_for_a_repair']) {
      const card = A7.model!.cards.find((c) => c.id === id)!
      const row = hire.querySelector<HTMLElement>(`[data-rack-through="${id}"]`)!
      expect(row.querySelector('[data-rack-whose]')!.textContent).toBe(card.author!.text)
      expect(within(row).getByText(card.figure!.text)).toHaveAttribute('data-view', `${id}.figure.text`)
    }
  })

  it('an outcome the option works through to: core\'s link words and THIS option\'s own worked-out value, never the other options\' (A7 Open on Sundays)', () => {
    ready(A7)
    const l = A7.model!.links.find((x) => x.from === 'open_on_sundays' && x.kind === 'through')!
    const row = option('open_on_sundays').querySelector<HTMLElement>(`[data-rack-through="${l.to}"]`)!
    const card = A7.model!.cards.find((c) => c.id === l.to)!, k = card.values!.findIndex((v) => v.option === 'open_on_sundays')
    expect(row.querySelector(`[data-view="${l.to}.figure.text"]`)).toBeNull()
    expect(row.querySelector('[data-rack-own-value]')).toHaveAttribute('data-view', `${l.to}.values.${k}.text`)
    expect(row.querySelector('[data-rack-own-value]')!.textContent).toBe(card.values![k]!.text)
    for (const v of card.values!) if (v.option !== 'open_on_sundays') expect(row.textContent).not.toContain(v.text)
    expect(row.textContent).toContain(l.title)
  })

  it('European: a figure core has not got says core\'s own words for the gap; nothing is filled', () => {
    ready(EU)
    const card = EU.model!.cards.find((c) => c.id === 'monthly_churn_2')!
    expect(card.figure!.text).toMatch(/^waits on: /)
    const row = option('expand_into_the_european_market_in_the_next_6_12_months').querySelector<HTMLElement>('[data-rack-through="monthly_churn_2"]')!
    expect(within(row).getByText(card.figure!.text)).toHaveAttribute('data-view', 'monthly_churn_2.figure.text')
    // An option core gives nothing to: its name and whose idea it is, and no section.
    const stay = option('leave_things_as_they_are_stay_in_current_markets')
    expect(stay.querySelectorAll('[data-rack-section]')).toHaveLength(0)
  })

  it('PL-273 counter-row: Jo\'s dissent (a reason link to Open on Sundays) is not something it works through; it is said once, as the challenge', () => {
    const jo = 'jo_thinks_sunday_opening_would_only_spread_the_same_work_over_mo'
    const l = A7.model!.links.find((x) => x.from === jo && x.to === 'open_on_sundays')!
    expect(l.kind).toBe('reason')
    ready(A7, true)
    expect(option('open_on_sundays').querySelector(`[data-rack-through="${jo}"]`)).toBeNull()
    expect(document.querySelector(`[data-reasoning-challenge="${jo}"]`)).not.toBeNull()
    expect(rack().textContent).not.toContain(l.title)
  })

  it('PL-273: a person\'s own input, with no Olumi reliance mark: Dana\'s 6 hours under Hire, whose by core, not Olumi\'s colour or glyph', () => {
    ready(A7)
    const id = 'mechanic_hours_available_for_repairs_changed_hire_a_part_time_me', card = A7.model!.cards.find((c) => c.id === id)!
    expect([card.author!.by, card.olumi]).toEqual(['person', null])
    const row = option('hire_a_part_time_mechanic').querySelector<HTMLElement>(`[data-rack-through="${id}"]`)!
    expect(row.querySelector('[data-rack-whose]')).toHaveAttribute('data-rack-whose', 'person')
    expect(row.querySelector('[data-rack-whose]')!.className).not.toContain('text-info')
    expect(row.querySelector('.text-info, [data-view$=".olumi.glyph"]')).toBeNull()
  })

  it('PL-273: what core says an option rests on (`cards[].rests_on`) is read by id, even where its chance rows name nothing', () => {
    // core wip/science-cards cb742d07's own rests_on for A7 Hire (SCI-9 payload), its { id, whose } keys only; the rows' own list emptied.
    const m = structuredClone(A7.model!), hire = m.cards.find((c) => c.id === 'hire_a_part_time_mechanic')!
    hire.rests_on = [{ id: 'average_wait_for_a_repair_per_hours_week', whose: 'olumi' }, { id: 'current_average_wait_for_a_repair', whose: 'mixed' }]
    for (const r of hire.rows) if ((r as { rests_on?: unknown }).rests_on) (r as { rests_on?: unknown }).rests_on = { reading: false, target: false, what_ifs: [], estimates: [], approx: [] }
    ready({ ...A7, model: m })
    const rows = [...option('hire_a_part_time_mechanic').querySelectorAll<HTMLElement>('[data-rack-through]')].map((e) => e.dataset['rackThrough'])
    expect(rows).toContain('current_average_wait_for_a_repair')
    // An id no card draws has no heading to name it by here (that needs core's `label`, SCI-10): not drawn.
    expect(rows).not.toContain('average_wait_for_a_repair_per_hours_week')
  })

  it('SCI-10: an option\'s own settings are drawn from core\'s `sets`, whose by core\'s words; one no card draws is not pressable (A7 Open on Sundays)', () => {
    ready(A7S)
    const o = A7S.model!.cards.find((c) => c.id === 'open_on_sundays')!, sets = o.sets!
    expect(sets.length).toBeGreaterThan(0)
    sets.forEach((st, k) => {
      const row = option('open_on_sundays').querySelector<HTMLElement>(`[data-rack-set="${k}"]`)!
      expect(row.dataset['rackThrough']).toBe(st.id)
      expect(row.querySelector(`[data-view="open_on_sundays.sets.${k}.figure.text"]`)!.textContent).toBe(st.figure.text)
      expect(row.querySelector(`[data-view="open_on_sundays.sets.${k}.author"]`)!.textContent).toBe(st.author)
      expect(row.querySelector('[data-rack-press]') !== null, st.id).toBe(A7S.model!.cards.some((c) => c.id === st.id))
    })
  })

  it('SCI-10: a setting with no value says core\'s gap words, never filled (A7 Stop taking e-bike jobs: "not given yet")', () => {
    ready(A7S)
    const st = A7S.model!.cards.find((c) => c.id === 'stop_taking_e_bike_jobs')!.sets![0]!
    expect(st.figure.text).toBe('not given yet')
    expect(option('stop_taking_e_bike_jobs').querySelector('[data-view="stop_taking_e_bike_jobs.sets.0.figure.text"]')!.textContent).toBe('not given yet')
  })

  it('SCI-10: what Hire rests on that no card draws (Olumi\'s per-hour effect) is named by core\'s label and whose, and is not pressable', () => {
    ready(A7S)
    const hire = A7S.model!.cards.find((c) => c.id === 'hire_a_part_time_mechanic')!
    const k = hire.rests_on.findIndex((r) => r.id === 'average_wait_for_a_repair_per_hours_week'), r = hire.rests_on[k]!
    expect(A7S.model!.cards.some((c) => c.id === r.id)).toBe(false)
    const row = option('hire_a_part_time_mechanic').querySelector<HTMLElement>(`[data-rack-through="${r.id}"]`)!
    expect(row).toHaveAttribute('data-rack-rest-only')
    expect(row.querySelector(`[data-view="hire_a_part_time_mechanic.rests_on.${k}.label"]`)!.textContent).toBe(r.label)
    expect(row.querySelector('[data-rack-whose]')).toHaveAttribute('data-rack-whose', 'olumi')
    expect(row.querySelector('[data-rack-whose]')!.textContent).toBe(r.author)
    expect(row.querySelector('button')).toBeNull()
  })

  it('what matters next is drawn only under the option core ties it to by id (A7: the coach\'s step about Jo\'s dissent, under Open on Sundays)', () => {
    ready(A7)
    expect([...rack().querySelectorAll<HTMLElement>('[data-rack-next="step"]')].map((e) => e.closest<HTMLElement>('[data-rack-option]')!.dataset['rackOption'])).toEqual(['open_on_sundays'])
  })

  it('a press on a row asks the canvas to focus that card; while it is selected the row shows pressed, and a second press lets it go', () => {
    const focused: string[] = [], unregister = registerFocusHelpers((id) => { focused.push(id) }, () => {})
    try {
      ready(A7)
      const id = 'mechanic_hours_available_for_repairs_changed_hire_a_part_time_me'
      const press = option('hire_a_part_time_mechanic').querySelector<HTMLButtonElement>(`[data-rack-through="${id}"] [data-rack-press="${id}"]`)!
      fireEvent.click(press)
      expect(focused).toEqual([id])
      act(() => { useCanvasStore.setState({ selection: { nodeIds: new Set([id]), edgeIds: new Set<string>(), anchorPosition: null } } as never) })
      expect(press.getAttribute('aria-pressed')).toBe('true')
      fireEvent.click(press)
      expect(useCanvasStore.getState().selection.nodeIds.size).toBe(0)
    } finally { unregister() }
  })

  it('one home: an option\'s premises are said in its row and not again in the tab\'s door', () => {
    ready(A7, true)
    const words = A7.model!.cards.filter((c) => c.family === 'option').flatMap((o) => (o.premises ?? []).map((p) => p.text))
    expect(words.length).toBeGreaterThan(0)
    // Each said once in the whole tab: in its option's row, or (one in a challenged card's words) in the challenge zone.
    for (const w of words) expect(screen.getAllByText(w), w).toHaveLength(1)
  })
})

// The critical review of 11 Nov (Paul: "high-performance, bug-free … pixel-perfect"): each row below failed on the code it replaced.
describe('review fixes, 11 Nov', () => {
  const openDoors = () => { for (const b of document.querySelectorAll<HTMLElement>('[data-testid^="view-reasoning-"][data-testid$="-toggle"][aria-expanded="false"]')) fireEvent.click(b) }

  it('RV1: a row\'s press is named by its own words (heading, figure, whose, core\'s link words), so a screen reader hears what is drawn', () => {
    ready(A7S)
    const rows = [...rack().querySelectorAll<HTMLElement>('[data-rack-through]')].filter((li) => li.querySelector('[data-rack-press] [data-rack-link]') !== null)
    expect(rows.length).toBeGreaterThan(0)
    for (const li of rows) {
      const words = [...li.querySelectorAll<HTMLElement>('[data-view]')].map((e) => e.textContent!).filter((t) => t !== '')
      const press = within(li).getByRole('button', { name: (name) => words.every((w) => name.includes(w)) })
      expect(press).not.toHaveAttribute('aria-label')
    }
  })

  it('RV2: premises core sends with no id (AN-01 European, 12 of them, the key absent) are drawn once each at their View path, with no duplicate React key', () => {
    const view = JSON.parse(readFileSync(path.resolve('src/olumiView/port/__tests__/fixtures', 'an01-european-otheraims.view3.json'), 'utf8')) as View
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      ready(view)
      expect(err.mock.calls.map((c) => String(c[0])).filter((t) => /key/i.test(t))).toEqual([])
    } finally { err.mockRestore() }
    const options = view.model!.cards.filter((c) => c.family === 'option' && c.status === null)
    // Core's earlier View sends them with no `id` key at all (the type says `string | null`): either way, nothing to key by.
    expect(options.flatMap((o) => o.premises ?? []).filter((p) => p.id == null).length).toBe(12)
    for (const o of options) (o.premises ?? []).forEach((p, j) => {
      expect([...option(o.id).querySelectorAll(`[data-view="${o.id}.premises.${j}.text"]`)].map((e) => e.textContent), `${o.id}.${j}`).toEqual([p.text])
    })
  })

  it('RV3: a premise is not a second press of its option (one pressed state per card), and Olumi\'s mark follows its words as in the door', () => {
    ready(A7S)
    const o = A7S.model!.cards.find((c) => c.id === 'hire_a_part_time_mechanic')!, j = o.premises.findIndex((p) => p.olumi != null)
    expect(j).toBeGreaterThanOrEqual(0)
    const li = option(o.id).querySelector<HTMLElement>(`[data-rack-premise="${o.premises[j]!.id}"]`)!
    expect(li.querySelector('[data-rack-press]')).toBeNull()
    const text = li.querySelector(`[data-view="${o.id}.premises.${j}.text"]`)!, mark = li.querySelector(`[data-view="${o.id}.premises.${j}.olumi.glyph"]`)!
    expect(mark.parentElement).toBe(text.parentElement)
    // CONTRAST: the option's heading presses its card, once.
    expect(option(o.id).querySelectorAll(`[data-rack-press="${o.id}"]`)).toHaveLength(1)
  })

  it('RV4 (derived; no served View yet sends a setting with no figure): a setting with no figure says core\'s words for the gap, as a card does', () => {
    const view = structuredClone(A7S), o = view.model!.cards.find((c) => c.id === 'stop_taking_e_bike_jobs')!
    o.sets![0]!.figure = { text: '', title: 'not given yet: give it with ✎' }
    ready(view)
    const li = option(o.id).querySelector<HTMLElement>(`[data-rack-set="0"]`)!
    expect(li.querySelector('[data-view="stop_taking_e_bike_jobs.sets.0.figure.title"]')?.textContent).toBe('not given yet: give it with ✎')
    expect(li.querySelector('[data-view="stop_taking_e_bike_jobs.sets.0.figure.text"]')).toBeNull()
    cleanup()
    ready(A7S)
    expect(option(o.id).querySelector('[data-view="stop_taking_e_bike_jobs.sets.0.figure.text"]')?.textContent).toBe(A7S.model!.cards.find((c) => c.id === o.id)!.sets![0]!.figure.text)
  })

  it('RV5 (derived; no served View yet has a ruled-out option with a premise): the rack does not draw it, so the tab\'s door says it', () => {
    const view = structuredClone(A7S), o = view.model!.cards.find((c) => c.id === 'hire_a_part_time_mechanic')!
    const w = o.premises[0]!.text
    ready(A7S, true); openDoors()
    expect(document.querySelector('[data-testid="view-reasoning-rack"]')!.textContent, 'CONTRAST: live, it is said in its row').toContain(w)
    cleanup()
    o.status = 'ruled out'
    ready(view, true); openDoors()
    expect(document.querySelector('[data-testid="view-reasoning-rack"]')!.textContent).not.toContain(w)
    expect(screen.getAllByText(w)).toHaveLength(1)
    expect(screen.getByText(w).closest('[data-reasoning-premise]')).not.toBeNull()
  })
})
