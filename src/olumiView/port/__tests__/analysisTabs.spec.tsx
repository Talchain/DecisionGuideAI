/**
 * The Analysis tab on the olumi-core lane (redesign, 18 Nov 2026): what the model implies, seen. Bound by identity on core's own Views: each
 * bar by its option id and row path, each mark by the row core puts it on, each press by the card id it focuses; every section has a
 * present/absent contrast, and the tab's state is read from the options' rows, never from run fields.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const focus = vi.hoisted(() => ({ node: vi.fn() }))
vi.mock('../../../canvas/utils/focusHelpers', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../canvas/utils/focusHelpers')>()), focusNodeById: focus.node }))

import type { View } from '../../client'
import { useViewStore } from '../../store'
import { useMe } from '../../../olumiCore/me'
import { optionCards } from '../../layout'
import { PortAnalysisTab } from '../PortAnalysisTab'
import { chartRowsOf, leadAimOf, moversOf, needsOf, tabStateOf, trackPct } from '../pick'
import { expectAllBound, viewOf } from './viewAt'
import { useUIStore } from '../../../stores/uiStore'

const ready = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
}
afterEach(() => { cleanup(); focus.node.mockReset(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })
const tab = () => screen.getByTestId('port-analysis-tab')

describe('the tab\'s state comes from the options\' rows', () => {
  it('bakery (chance rows) is "chance" and draws the chart; app-launch (every row "none") is "none" and draws no chart, no lead and no chance key, though its Run carries a sensitivity sentence', () => {
    const bakery = viewOf('golden/bakery'), launch = viewOf('golden/app-launch')
    expect([tabStateOf(bakery.model!), tabStateOf(launch.model!)]).toEqual(['chance', 'none'])
    expect(launch.model!.run!.sensitivity.text).not.toBe('')
    ready(bakery); render(<PortAnalysisTab />)
    expect(tab().dataset['analysisState']).toBe('chance')
    expect(screen.getByTestId('analysis-chance-chart')).toBeInTheDocument()
    cleanup()
    ready(launch); render(<PortAnalysisTab />)
    expect(tab().dataset['analysisState']).toBe('none')
    expect(screen.queryByTestId('analysis-chance-chart')).toBeNull()
    expect(document.querySelector('[data-view="run.lead"]')).toBeNull()
    expect(document.querySelector('[data-view="run.sensitivity.text"]')).toBeNull()
    expect(screen.queryByTestId('analysis-chart-key')).toBeNull()
  })

  it('limit rows only (bakery with its chance rows made limit rows): each option\'s state against the limit, by its row path; no chart', () => {
    const view = structuredClone(viewOf('golden/bakery'))
    for (const c of optionCards(view.model!)) c.rows = c.rows.map((r) => (r.kind === 'chance' ? { kind: 'limit', value: r.value, olumi: r.olumi, aim: r.aim, aim_id: r.aim_id, title: r.title, state_text: 'state words', estimate: null } as never : r))
    expect(tabStateOf(view.model!)).toBe('limit')
    ready(view); render(<PortAnalysisTab />)
    expect(screen.queryByTestId('analysis-chance-chart')).toBeNull()
    const limits = screen.getByTestId('analysis-limits')
    const ids = optionCards(view.model!).filter((c) => c.rows.some((r) => r.kind === 'limit')).map((c) => c.id)
    expect([...limits.querySelectorAll<HTMLElement>('[data-limit-option]')].map((e) => e.dataset['limitOption'])).toEqual(ids)
    expect(expectAllBound(view, limits, expect)).toBeGreaterThan(0)
  })
})

describe('the chance chart', () => {
  it('bakery: one bar per option with a chance for the lead aim, in core\'s order; each bar filled to its chance and its whisker at its driver\'s two chances; core\'s words under it', () => {
    const view = viewOf('golden/bakery'), rows = chartRowsOf(view.model!)
    expect(rows.length).toBe(3)
    expect(rows.every((r) => r.row.aim_id === leadAimOf(view.model!))).toBe(true)
    ready(view); render(<PortAnalysisTab />)
    const chart = screen.getByTestId('analysis-chance-chart')
    expect([...chart.querySelectorAll<HTMLElement>('[data-chart-option]')].map((e) => e.dataset['chartOption'])).toEqual(rows.map((r) => r.card.id))
    for (const { card, row, i } of rows) {
      const li = chart.querySelector(`[data-chart-option="${card.id}"]`)!
      expect(li.querySelector(`[data-view="${card.id}.rows.${i}.value"]`)!.textContent).toBe(row.value)
      expect(li.querySelector('[data-chance-bar]')!.getAttribute('data-chance-bar')).toBe(String(trackPct(row.chance!)))
      const range = li.querySelector('[data-chance-range]')
      if (row.driver == null) expect(range, card.id).toBeNull()
      else expect(range!.getAttribute('data-chance-range'), card.id).toBe(`${trackPct(row.driver.low)}:${trackPct(row.driver.high)}`)
    }
    expect(expectAllBound(view, chart, expect)).toBeGreaterThan(rows.length)
  })

  it('core\'s most-likely mark is on the one row core gives it; CONTRAST: the other rows carry none', () => {
    const view = viewOf('golden/bakery'), rows = chartRowsOf(view.model!)
    const likely = rows.filter((r) => r.row.likely != null)
    expect(likely.map((r) => r.card.id)).toEqual(['second_oven'])
    ready(view); render(<PortAnalysisTab />)
    const marks = [...document.querySelectorAll<HTMLElement>('[data-view$=".likely.glyph"]')]
    expect(marks.map((m) => m.closest<HTMLElement>('[data-chart-option]')!.dataset['chartOption'])).toEqual(['second_oven'])
    expect(marks[0]!.getAttribute('title')).toBe(likely[0]!.row.likely!.title)
  })

  it('a press on a bar focuses that option\'s card on the canvas, by its id', () => {
    const view = viewOf('golden/bakery')
    ready(view); render(<PortAnalysisTab />)
    fireEvent.click(document.querySelector('[data-chart-option="longer_hours"] button')!)
    expect(focus.node.mock.calls).toEqual([['longer_hours']])
  })

  it('the key is drawn only where some bar has a range: CONTRAST bakery with every driver removed draws bars and no key', () => {
    const view = structuredClone(viewOf('golden/bakery'))
    ready(view); render(<PortAnalysisTab />)
    expect(screen.getByTestId('analysis-chart-key').getAttribute('title')).toBe(view.model!.run!.sensitivity.title)
    cleanup()
    for (const c of optionCards(view.model!)) for (const r of c.rows) if (r.kind === 'chance') r.driver = null
    ready(view); render(<PortAnalysisTab />)
    expect(screen.getAllByTestId('analysis-chance-track').length).toBe(3)
    expect(screen.queryByTestId('analysis-chart-key')).toBeNull()
    expect(document.querySelectorAll('[data-chance-range]')).toHaveLength(0)
  })
})

describe('what would change it', () => {
  it('bakery: each figure the whiskers are drawn for, once, by its card id; core\'s lead line (`run.tipping` kind lead) with a try on its figure', () => {
    const view = viewOf('golden/bakery'), run = view.model!.run!
    ready(view); render(<PortAnalysisTab />)
    const movers = moversOf(view.model!).map((m) => m.card.id)
    expect(movers).toEqual(['extra_sold_per_oven', 'extra_hours_sold'])
    expect([...document.querySelectorAll<HTMLElement>('[data-mover]')].map((e) => e.dataset['mover'])).toEqual(movers)
    const t = run.tipping.findIndex((x) => x.kind === 'lead')
    const lead = screen.getByTestId('analysis-lead-change')
    expect(lead.dataset['leadChange']).toBe('tipping')
    expect(lead.querySelector(`[data-view="run.tipping.${t}.line"]`)!.textContent).toBe(run.tipping[t]!.line)
    expect(lead.querySelector(`[data-testid="analysis-lead-edit-${run.tipping[t]!.figure.id}"]`)).not.toBeNull()
    expect(expectAllBound(view, screen.getByTestId('analysis-what-moves'), expect)).toBeGreaterThan(0)
  })

  it('a figure core\'s find-out ranking gives a ✎ is not given a second ✎ beside its mover row; CONTRAST: without the ranking the mover row has it', () => {
    const view = structuredClone(viewOf('golden/bakery'))
    ready(view); render(<PortAnalysisTab />)
    const ranked = view.model!.run!.find_out!.flatMap((a) => a.figures.filter((f) => f.give != null).map((f) => f.id))
    expect(ranked).toContain('extra_sold_per_oven')
    expect(document.querySelector('[data-testid="analysis-mover-edit-extra_sold_per_oven"]')).toBeNull()
    expect(document.querySelectorAll('[data-testid="worth-edit-extra_sold_per_oven"]')).toHaveLength(1)
    cleanup()
    view.model!.run!.find_out = []
    view.model!.run!.science = []
    ready(view); render(<PortAnalysisTab />)
    expect(document.querySelector('[data-testid="analysis-mover-edit-extra_sold_per_oven"]')).not.toBeNull()
  })

  it('CONTRAST: app-launch (no chance) draws no "what would change it" at all', () => {
    ready(viewOf('golden/app-launch')); render(<PortAnalysisTab />)
    expect(screen.queryByTestId('analysis-what-moves')).toBeNull()
  })
})

describe('what a result needs', () => {
  it('app-launch (no chance yet): core\'s blockers first in core\'s order, then what the chances wait on, each card once; each row core\'s words at its path', () => {
    const view = viewOf('golden/app-launch'), run = view.model!.run!
    ready(view); render(<PortAnalysisTab />)
    const box = screen.getByTestId('analysis-needs')
    expect(box.dataset['needsUnder']).toBe('alone')
    const keys = [...box.querySelectorAll<HTMLElement>('[data-need]')].map((e) => e.dataset['need'])
    const blocks = run.shared_blockers!.map((_, i) => `blocks:${i}`)
    expect(keys.slice(0, blocks.length)).toEqual(blocks)
    // A card a blocker names is not listed again as a wait.
    const blocked = new Set(run.shared_blockers!.map((b) => b.aim_id))
    const waits = run.waits_on!.items.filter((it) => !blocked.has(it.id) && it.text !== '').map((it) => `waits:${it.id}`)
    expect(keys.slice(blocks.length, blocks.length + waits.length)).toEqual(waits.slice(0, Math.max(0, 5 - blocks.length)))
    expect(expectAllBound(view, box, expect)).toBe(keys.length)
  })

  it('more than five: five at rest, the rest one press away', () => {
    const view = viewOf('real/hosting'), all = needsOf(view.model!)
    expect(all.length, 'precondition: more than five').toBeGreaterThan(5)
    ready(view); render(<PortAnalysisTab />)
    expect(document.querySelectorAll('[data-need]')).toHaveLength(5)
    fireEvent.click(screen.getByTestId('analysis-needs-more'))
    expect(document.querySelectorAll('[data-need]')).toHaveLength(all.length)
    // CONTRAST: five or fewer draw no fold (app-launch).
    cleanup(); const few = viewOf('golden/app-launch'); expect(needsOf(few.model!).length).toBeLessThanOrEqual(5)
    ready(few); render(<PortAnalysisTab />)
    expect(screen.queryByTestId('analysis-needs-more')).toBeNull()
  })

  it('a press on a row focuses the card it is about, by id', () => {
    const view = viewOf('golden/app-launch'), first = needsOf(view.model!)[0]!
    ready(view); render(<PortAnalysisTab />)
    fireEvent.click(document.querySelector(`[data-need="${first.key}"] button`)!)
    expect(focus.node.mock.calls).toEqual([[first.card]])
  })

  it('a figure no one has given yet is listed with core\'s ✎ (its edit); CONTRAST: once it has words it is not listed', () => {
    const view = structuredClone(viewOf('golden/app-launch'))
    const c = view.model!.cards.find((k) => k.figure != null && k.figure.edit != null && k.status === null)
    expect(c, 'precondition: an editable figure').toBeDefined()
    c!.figure = { ...c!.figure!, text: '' }
    view.model!.run!.waits_on = null
    ready(view); render(<PortAnalysisTab />)
    expect(document.querySelector(`[data-need="size:${c!.id}"] [data-view="${c!.id}.heading"]`)!.textContent).toBe(c!.heading)
    if (needsOf(view.model!).findIndex((n) => n.key === `size:${c!.id}`) < 5) expect(document.querySelector(`[data-testid="analysis-need-edit-${c!.id}"]`)).not.toBeNull()
    cleanup()
    c!.figure = { ...c!.figure!, text: 'a figure' }
    ready(view); render(<PortAnalysisTab />)
    expect(document.querySelector(`[data-need="size:${c!.id}"]`)).toBeNull()
  })

  it('under a chance it is "not in the result yet": bakery\'s unchecked limit is listed once, though every option\'s row says it', () => {
    const view = viewOf('golden/bakery')
    const none = optionCards(view.model!).flatMap((c) => c.rows.filter((r) => r.kind === 'none').map((r) => r.text))
    expect(none.length).toBeGreaterThan(1)
    ready(view); render(<PortAnalysisTab />)
    const box = screen.getByTestId('analysis-needs')
    expect(box.dataset['needsUnder']).toBe('chart')
    for (const t of new Set(none)) expect([...box.querySelectorAll('[data-view]')].filter((e) => e.textContent === t), t).toHaveLength(1)
  })
})

describe('no chance yet: the questions that would move it on are one press away, on the Reasoning tab', () => {
  it('app-launch: one row with the count of core\'s coaching questions; a press fronts the Reasoning tab; CONTRAST: bakery (a chance) draws none', () => {
    const view = viewOf('golden/app-launch')
    useUIStore.setState({ activeOutputTab: 'results' } as never)
    ready(view); render(<PortAnalysisTab />)
    const row = screen.getByTestId('analysis-to-questions')
    expect(row.querySelector('[data-count]')!.textContent).toBe(String(view.model!.coaching_questions!.length))
    fireEvent.click(row)
    expect(useUIStore.getState().activeOutputTab).toBe('analysisNew')
    cleanup()
    ready(viewOf('golden/bakery')); render(<PortAnalysisTab />)
    expect(screen.queryByTestId('analysis-to-questions')).toBeNull()
  })
})

describe('why this reading: core\'s long reading, one press away', () => {
  it('bakery: the most-likely paragraph is not drawn at rest; opened, it is drawn once at its path with its ✎', () => {
    const view = viewOf('golden/bakery'), ml = view.model!.run!.most_likely!
    ready(view); render(<PortAnalysisTab />)
    expect(document.querySelector('[data-view="run.most_likely.text"]')).toBeNull()
    fireEvent.click(screen.getByTestId('analysis-why-toggle'))
    const said = document.querySelectorAll('[data-view="run.most_likely.text"]')
    expect(said).toHaveLength(1)
    expect(said[0]!.textContent).toBe(ml.text)
    expect(document.querySelector(`[data-testid="analysis-likely-edit-${ml.estimate}"]`)).not.toBeNull()
    expect(expectAllBound(view, tab(), expect)).toBeGreaterThan(0)
  })
})
