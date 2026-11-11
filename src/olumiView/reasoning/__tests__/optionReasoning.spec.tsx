/**
 * Each option's reasoning in the Reasoning tab (Paul 11 Nov, PL-252), on two REAL models copied unedited:
 *   a7-reveal: the A7 workshop journey after two people revealed (run 20261111-journey-ec692296, PL-reveal-view.json, version 3);
 *   european-loop9: the European brief's first model, held proposal (first-model loop 9, e33447b1 r1, european/view3.json).
 * Bound by IDENTITY: each option and each row by its card id, each word by its View path (`expectAllBound`).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { View } from '../../client'
import { useViewStore } from '../../store'
import { useMe } from '../../../olumiCore/me'
import { useCanvasStore } from '../../../canvas/store'
import { registerFocusHelpers } from '../../../canvas/utils/focusHelpers'
import { Rack, throughOf } from '../Rack'
import { ViewReasoning } from '../../ViewReasoning'
import { expectAllBound } from '../../port/__tests__/viewAt'

const read = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/reasoning/__tests__/fixtures', `${n}.view3.json`), 'utf8'))
const A7 = read('a7-reveal'), EU = read('european-loop9')
const ready = (view: View, tab = false) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  return render(tab ? <ViewReasoning model={view.model!} /> : <Rack model={view.model!} view={view} />)
}
const rack = () => screen.getByTestId('view-reasoning-rack')
const option = (id: string) => rack().querySelector<HTMLElement>(`[data-rack-option="${id}"]`)!
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }); useCanvasStore.getState().clearSelection() })

describe('each option\'s reasoning, from the real model, every word core\'s', () => {
  for (const [name, view] of [['a7-reveal', A7], ['european-loop9', EU]] as const) {
    it(`${name}: options in core's order; each row its card by id, in core's order; every drawn string is the View's string at its path`, () => {
      ready(view)
      const m = view.model!, options = m.cards.filter((c) => c.family === 'option')
      expect([...rack().querySelectorAll<HTMLElement>('[data-rack-option]')].map((e) => e.dataset['rackOption'])).toEqual(options.map((o) => o.id))
      for (const o of options) {
        // Independently: every card linked to or from the option, in link order, then each card its chance rows rest on.
        const want: string[] = []
        m.links.forEach((l) => { const x = l.from === o.id ? l.to : l.to === o.id ? l.from : null; if (x !== null && m.cards.some((c) => c.id === x) && !want.includes(x)) want.push(x) })
        for (const r of o.rows) for (const id of [...((r as { rests_on?: { what_ifs?: string[]; estimates?: string[]; approx?: string[] } | null }).rests_on?.what_ifs ?? []), ...((r as { rests_on?: { estimates?: string[] } | null }).rests_on?.estimates ?? []), ...((r as { rests_on?: { approx?: string[] } | null }).rests_on?.approx ?? [])])
          if (m.cards.some((c) => c.id === id) && !want.includes(id)) want.push(id)
        expect([...option(o.id).querySelectorAll<HTMLElement>('[data-rack-through]')].map((e) => e.dataset['rackThrough']), o.id).toEqual(want)
        expect(throughOf(m, o).map((t) => t.card.id)).toEqual(want)
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
