/**
 * AN-01 (core wip/an01-headline e179f7c6, `cards[].headline`; contract: strategy lane AN-01-headline-field-contract.md): each option's
 * headline on the MOUNTED Analysis tab (PortAnalysisTab → AnalysisHeroPanel → HeroOptionRow). Every headline keeps the dock's aim, so it
 * sits on the option's row for that aim, else on its option-wide reason, else on its own in that aim's group (never dropped). On a row its
 * line is the aim heading and the readout already drawn there, so what it adds is drawn: `range` (core's short phrase, its own `title` on
 * hover) and `add`. A shared reason is said once, above the rows.
 *
 * Fixtures are core e179f7c6's own output: studio, app-launch and bakery-asked are its goldens byte for byte; the two `-otheraims` are its
 * `viewOf` on its golden inputs with the option's facts for the dock's aim removed (as its headline.test "no line for the dock's aim" does):
 *  - studio-otheraims 'evening_classes': only another aim's row;
 *  - european-otheraims 'broader_entry': only its option-wide reason, with no aim.
 * Core cannot send `add` for an option with no line for the dock's aim (a reason that leaves no line is `once`, only on a deadline limit).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { View } from '../../client'
import { useViewStore } from '../../store'
import { optionCards } from '../../layout'
import { PortAnalysisTab } from '../PortAnalysisTab'
import { viewOf } from './viewAt'

const NO_CHANCE = 'No chance can be worked out for this option yet'
const put = (view: View) => useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
const mount = (view: View) => { put(view); return render(<PortAnalysisTab />).container }
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never) })
const at = (p: string) => document.querySelectorAll(`[data-view="${p}"]`)
const group = (aim: string) => document.querySelector<HTMLElement>(`[data-testid="port-aim-group"][data-aim="${aim}"]`)!
const leaves = (root: Element, text: string) => [...root.querySelectorAll<HTMLElement>('*')].filter((e) => e.children.length === 0 && e.textContent === text)
const openEach = () => { for (const b of [...document.querySelectorAll<HTMLElement>('[data-testid="port-option-row"] > button[aria-expanded="false"]')]) fireEvent.click(b) }
const openRow = (el: Element) => fireEvent.click(el.closest('[data-testid="port-option-row"]')!.querySelector<HTMLElement>(':scope > button[aria-expanded]')!)

describe('AN-01: each option\'s headline on the mounted Analysis row', () => {
  it('chance (studio evening_classes): core\'s range under its row, once, with the headline\'s own title on hover; the driver\'s sentence is said once, whole, in the detail', () => {
    const view = viewOf('core/an01-studio'), c = view.model!.cards.find((x) => x.id === 'evening_classes')!, h = c.headline!
    expect([h.state, typeof h.range, h.title === c.driver!.text]).toEqual(['chance', 'string', false])
    mount(view)
    const range = at(`${c.id}.headline.range`)
    expect(range).toHaveLength(1)
    expect([range[0]!.textContent, range[0]!.getAttribute('title')]).toEqual([h.range, h.title])
    // On the row it is about: the row of the headline's aim.
    const k = c.rows.findIndex((r) => r.aim_id === h.aim_id)
    expect(range[0]!.closest('[data-testid="port-option-row"]')!.getAttribute('data-view-row')).toBe(`${c.id}.rows.${k}`)
    // At rest the sentence is not drawn; its own row opened, the detail draws core's driver sentence once, whole (SC-02: said once,
    // still said). The range is core's short phrase, never the sentence (integration on the paired goldens, 8 Nov).
    expect(at(`${c.id}.driver.text`)).toHaveLength(0)
    openRow(range[0]!)
    const detail = screen.getByTestId('port-option-detail')
    expect(at(`${c.id}.driver.text`)).toHaveLength(1)
    expect([at(`${c.id}.driver.text`)[0]!.textContent, detail.contains(at(`${c.id}.driver.text`)[0]!)]).toEqual([c.driver!.text, true])
    // Contrast: its chance is still said once, as the readout.
    expect(at(`${c.id}.rows.${k}.value`)).toHaveLength(1)
  })

  it('Likely outcome lens (studio): no range, and the driver\'s sentence is drawn again in the row\'s detail', () => {
    const view = viewOf('core/an01-studio'), c = view.model!.cards.find((x) => x.id === 'evening_classes')!
    mount(view)
    fireEvent.click(screen.getByRole('tab', { name: view.model!.run!.lenses.find((l) => l.id === 'outcome')!.label }))
    expect(at(`${c.id}.headline.range`)).toHaveLength(0)
    const k = c.rows.findIndex((r) => r.aim_id === c.headline!.aim_id)
    openRow(document.querySelector(`[data-view-row="${c.id}.rows.${k}"]`)!)
    expect([...at(`${c.id}.driver.text`)].map((e) => e.textContent)).toEqual([c.driver!.text])
  })

  it('fixed (studio weekend_workshops): its result only, never a range or an add', () => {
    const view = viewOf('core/an01-studio'), c = view.model!.cards.find((x) => x.id === 'weekend_workshops')!, h = c.headline!
    expect(h.state).toBe('fixed')
    mount(view)
    expect([at(`${c.id}.headline.range`).length, at(`${c.id}.headline.add`).length]).toEqual([0, 0])
    const k = c.rows.findIndex((r) => r.aim_id === h.aim_id)
    expect(at(`${c.id}.rows.${k}.value`)).toHaveLength(1)
  })

  it('no line for the dock\'s aim (studio-otheraims evening_classes): its headline is drawn in that aim\'s group, with its reason, once', () => {
    const view = viewOf('core/an01-studio-otheraims'), c = view.model!.cards.find((x) => x.id === 'evening_classes')!, h = c.headline!
    expect([h.aim_id, h.state, h.why, c.rows.some((r) => r.aim_id === h.aim_id)]).toEqual(['takings_goal', 'none', NO_CHANCE, false])
    mount(view)
    const g = group('takings_goal')
    expect(g.querySelectorAll(`[data-view-row="${c.id}.headline"] [data-view="${c.id}.heading"]`)).toHaveLength(1)
    expect([...g.querySelectorAll(`[data-view="${c.id}.headline.why"]`)].map((e) => e.textContent)).toEqual([NO_CHANCE])
    // Said once on the tab, and the aim is named by the group's heading, not again by the headline.
    expect(leaves(screen.getByTestId('port-analysis-tab'), NO_CHANCE)).toHaveLength(1)
    expect(at(`${c.id}.headline.text`)).toHaveLength(0)
    // In core's card order, among the other options' rows for the aim (drawn as before, in the same group).
    expect([...g.querySelectorAll('[data-testid="port-option-row"]')].map((e) => e.getAttribute('data-option-id'))).toEqual(optionCards(view.model!).map((o) => o.id))
    for (const o of optionCards(view.model!).filter((x) => x.id !== c.id)) expect(g.querySelectorAll(`[data-option-id="${o.id}"]`), o.id).toHaveLength(1)
  })

  it('only an option-wide reason (european-otheraims broader_entry): that row is the headline\'s line, in the dock aim\'s group, said once', () => {
    const view = viewOf('core/an01-european-otheraims'), c = view.model!.cards.find((x) => x.id === 'broader_entry')!, h = c.headline!
    const k = c.rows.findIndex((r) => r.aim_id === null)
    expect([h.aim_id, h.state, c.rows[k]!.kind, c.rows.some((r) => r.aim_id === h.aim_id)]).toEqual(['reach_customer_target', 'none', 'none', false])
    mount(view)
    expect(group('reach_customer_target').querySelectorAll(`[data-view-row="${c.id}.rows.${k}"]`)).toHaveLength(1)
    expect(document.querySelectorAll(`[data-view-row="${c.id}.headline"]`)).toHaveLength(0)
    const row = c.rows[k]!
    expect(row.kind === 'none' ? leaves(screen.getByTestId('port-analysis-tab'), row.text!) : []).toHaveLength(1)
  })

  it('none, shared (app-launch): the Run\'s shared reason is said once, above the rows, whether or not the headline carries it as `why`', () => {
    const base = viewOf('core/an01-app-launch')
    // The contract's form (why null when shared) and core e179f7c6's (why = the shared reason): both draw it once.
    const contract = structuredClone(base)
    for (const c of optionCards(contract.model!)) if (c.headline?.shared) c.headline.why = null
    for (const view of [base, contract]) {
      const m = view.model!, shared = optionCards(m).map((c) => c.headline!).filter((h) => h.state === 'none' && h.shared)
      expect(shared.length).toBeGreaterThan(0)
      const text = m.run!.shared_blockers!.find((b) => b.aim_id === shared[0]!.aim_id)!.text
      mount(view)
      openEach()
      expect(leaves(screen.getByTestId('port-analysis-hero'), text)).toHaveLength(1)
      for (const c of optionCards(m)) expect(at(`${c.id}.headline.add`), c.id).toHaveLength(c.headline?.add == null ? 0 : 1)
      cleanup()
    }
  })

  it('none, with what to give (bakery-asked): each option\'s row says core\'s add once, under its refusal', () => {
    const view = viewOf('core/an01-bakery-asked'), m = view.model!
    const withAdd = optionCards(m).filter((c) => c.headline?.state === 'none' && c.headline.add !== null)
    expect(withAdd.map((c) => c.id)).toContain('second_oven')
    mount(view)
    for (const c of withAdd) {
      const add = at(`${c.id}.headline.add`)
      expect(add, c.id).toHaveLength(1)
      expect(add[0]!.textContent).toBe(c.headline!.add)
      const k = c.rows.findIndex((r) => r.aim_id === c.headline!.aim_id)
      expect(add[0]!.closest('[data-testid="port-option-row"]')!.getAttribute('data-view-row')).toBe(`${c.id}.rows.${k}`)
    }
    const text = withAdd[0]!.headline!.add!
    expect(leaves(screen.getByTestId('port-analysis-tab'), text)).toHaveLength(withAdd.filter((c) => c.headline!.add === text).length)
  })

  it('a mounted tab follows its View: a chance, then no line for the aim, then another scenario\'s refusals, then back, with no figure left behind', () => {
    const studio = viewOf('core/an01-studio'), other = viewOf('core/an01-studio-otheraims'), bakery = viewOf('core/an01-bakery-asked')
    const range = studio.model!.cards.find((x) => x.id === 'evening_classes')!.headline!.range!
    const adds = optionCards(bakery.model!).flatMap((c) => (c.headline?.add == null ? [] : [c.headline.add]))
    mount(studio)
    const drawn = () => ({
      range: [...document.querySelectorAll('[data-testid="port-row-headline-range"]')].map((e) => [e.closest('[data-option-id]')!.getAttribute('data-option-id'), e.textContent]),
      alone: [...document.querySelectorAll('[data-view$=".headline.why"]')].map((e) => e.getAttribute('data-view')),
      add: [...document.querySelectorAll('[data-testid="port-row-headline-add"]')].map((e) => e.textContent),
    })
    expect(drawn()).toEqual({ range: [['evening_classes', range]], alone: [], add: [] })
    act(() => put(other))
    expect(drawn()).toEqual({ range: [], alone: ['evening_classes.headline.why'], add: [] })
    act(() => put(bakery))
    expect(drawn()).toEqual({ range: [], alone: [], add: adds })
    act(() => put(studio))
    expect(drawn()).toEqual({ range: [['evening_classes', range]], alone: [], add: [] })
  })

  it('negative: a View from a core before AN-01 (no headline) draws exactly as before: no range, no add line, no headline of its own', () => {
    // The golden is re-read from the paired core, which carries headlines; a core before AN-01 sent none.
    const golden = viewOf('golden/studio'), before = structuredClone(golden)
    for (const c of before.model!.cards) c.headline = null
    const drawnOf = '[data-testid="port-row-headline-range"], [data-testid="port-row-headline-add"], [data-view-row$=".headline"]'
    mount(before)
    expect(document.querySelectorAll(drawnOf)).toHaveLength(0)
    // Contrast: the same View with core's headlines draws them.
    cleanup(); mount(golden)
    expect(document.querySelectorAll(drawnOf).length).toBeGreaterThan(0)
  })
})
