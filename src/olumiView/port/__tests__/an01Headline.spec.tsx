/**
 * AN-01 (core wip/an01-headline c69a5413, `cards[].headline`; contract: strategy lane AN-01-headline-field-contract.md): each option's
 * headline on the MOUNTED Analysis tab (PortAnalysisTab → AnalysisHeroPanel → HeroOptionRow), one golden per state, core's own. On that
 * row the headline's line is the aim heading and the readout already drawn there, so what it adds is drawn: `range` (the driver's short
 * phrase, the whole sentence on hover) and `add` (what to give to get a chance). Its `why` is the Run's shared reason (said once above the
 * rows) or the row's own refusal (the readout), so it is never drawn again. Each row also states what is still said once.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { View } from '../../client'
import { useViewStore } from '../../store'
import { optionCards } from '../../layout'
import { PortAnalysisTab } from '../PortAnalysisTab'
import { viewOf } from './viewAt'

const mount = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  return render(<PortAnalysisTab />).container
}
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never) })
const at = (p: string) => document.querySelectorAll(`[data-view="${p}"]`)
const openEach = () => { for (const b of [...document.querySelectorAll<HTMLElement>('[data-testid="port-option-row"] > button[aria-expanded="false"]')]) fireEvent.click(b) }

describe('AN-01: each option\'s headline on the mounted Analysis row', () => {
  it('chance (studio evening_classes): core\'s range under its row, once, with the driver\'s whole sentence on hover; that sentence is never drawn as words', () => {
    const view = viewOf('core/an01-studio'), c = view.model!.cards.find((x) => x.id === 'evening_classes')!, h = c.headline!
    expect([h.state, typeof h.range]).toEqual(['chance', 'string'])
    mount(view)
    const range = at(`${c.id}.headline.range`)
    expect(range).toHaveLength(1)
    expect([range[0]!.textContent, range[0]!.getAttribute('title')]).toEqual([h.range, c.driver!.text])
    // On the row it is about: the row of the headline's aim.
    const k = c.rows.findIndex((r) => r.aim_id === h.aim_id)
    expect(range[0]!.closest('[data-testid="port-option-row"]')!.getAttribute('data-view-row')).toBe(`${c.id}.rows.${k}`)
    // Its own row opened (one detail at a time): the detail does not say the driver's sentence either.
    fireEvent.click(range[0]!.closest('[data-testid="port-option-row"]')!.querySelector<HTMLElement>(':scope > button[aria-expanded]')!)
    expect(screen.getByTestId('port-option-detail')).toBeInTheDocument()
    expect(at(`${c.id}.driver.text`)).toHaveLength(0)
    // Contrast: its chance is still said once, as the readout.
    expect(at(`${c.id}.rows.${k}.value`)).toHaveLength(1)
  })

  it('fixed (studio weekend_workshops): its result only, never a range or an add', () => {
    const view = viewOf('core/an01-studio'), c = view.model!.cards.find((x) => x.id === 'weekend_workshops')!, h = c.headline!
    expect(h.state).toBe('fixed')
    mount(view)
    expect([at(`${c.id}.headline.range`).length, at(`${c.id}.headline.add`).length]).toEqual([0, 0])
    const k = c.rows.findIndex((r) => r.aim_id === h.aim_id)
    expect(at(`${c.id}.rows.${k}.value`)).toHaveLength(1)
  })

  it('none, shared (app-launch): the Run\'s shared reason is said once, above the rows; no row says it again, and none offers an add it does not have', () => {
    const view = viewOf('core/an01-app-launch'), m = view.model!
    const shared = optionCards(m).map((c) => c.headline!).filter((h) => h.state === 'none' && h.shared)
    expect(shared.length).toBeGreaterThan(0)
    mount(view)
    openEach()
    const why = shared[0]!.why!
    const said = [...document.querySelectorAll<HTMLElement>('[data-testid="port-analysis-hero"] *')].filter((e) => e.children.length === 0 && e.textContent === why)
    expect(said).toHaveLength(1)
    for (const c of optionCards(m)) expect(at(`${c.id}.headline.add`), c.id).toHaveLength(c.headline?.add == null ? 0 : 1)
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
    // Contrast: the add is not said anywhere else on the tab.
    const text = withAdd[0]!.headline!.add!
    expect([...document.querySelectorAll<HTMLElement>('[data-testid="port-analysis-tab"] *')].filter((e) => e.children.length === 0 && e.textContent === text)).toHaveLength(withAdd.filter((c) => c.headline!.add === text).length)
    expect(screen.getByTestId('port-analysis-hero')).toBeInTheDocument()
  })

  it('negative: a View from a core before AN-01 (no headline) draws exactly as before: no range, no add line', () => {
    const view = viewOf('golden/studio')
    mount(view)
    expect(document.querySelectorAll('[data-testid="port-row-headline-range"], [data-testid="port-row-headline-add"]')).toHaveLength(0)
  })
})
