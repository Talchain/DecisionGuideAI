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
import { optionCards, outcomePlace } from '../../layout'
import { OUTCOME_WORDS } from '../LikelyOutcome'
import { CHART_WORDS } from '../ChanceChart'
import { PortAnalysisTab } from '../PortAnalysisTab'
import { chartGroupsOf, chartRowsOf, leadAimOf, moversOf, needsOf, tabStateOf, trackPct } from '../pick'
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
    // Nor core's reading of the chances, though its Run carries notes: nothing is offered about chances that are not shown.
    expect((launch.model!.run!.notes ?? []).length).toBeGreaterThan(0)
    expect(screen.queryByTestId('analysis-why')).toBeNull()
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
    // Core's line for each state is drawn, with any condition it carries, never only on hover.
    for (const c of optionCards(view.model!)) c.rows.forEach((r, i) => { if (r.kind === 'limit') expect(limits.querySelector(`[data-view="${c.id}.rows.${i}.value"]`)!.textContent, c.id).toBe(r.value) })
  })
})

describe('every option\'s line for every aim is drawn somewhere, never dropped', () => {
  for (const n of ['real/hiring', 'golden/s_ce285b3617bb', 'core/an01-european-otheraims', 'core/an01-studio-otheraims', 'core/an01-studio', 'golden/bakery', 'golden/european', 'golden/app-launch'] as const) {
    it(`${n}: a chance in its aim's chart, a limit under its limit, and anything else in what a result needs (or its aim's shared blocker)`, () => {
      const view = viewOf(n), m = view.model!, needs = new Set(needsOf(m).map((x) => x.key))
      const blocked = new Set((m.run?.shared_blockers ?? []).map((b) => b.aim_id))
      ready(view); render(<PortAnalysisTab />)
      let charted = 0
      for (const c of optionCards(m)) c.rows.forEach((r, i) => {
        const where = `${c.id}.rows.${i}`
        if (r.kind === 'chance' && typeof r.chance === 'number') { charted++; expect(document.querySelector(`[data-chart-aim="${r.aim_id}"] [data-chart-option="${c.id}"]`), where).not.toBeNull() }
        else if (r.kind === 'limit') expect(document.querySelector(`[data-limit-aim="${r.aim_id}"] [data-limit-option="${c.id}"]`), where).not.toBeNull()
        else if (r.kind === 'chance') expect(needs.has(`held:${where}`), where).toBe(true)
        else expect(needs.has(`none:${where}`) || (r.aim_id !== null && blocked.has(r.aim_id)) || [...needsOf(m)].some((x) => x.text === r.text), where).toBe(true)
      })
      // CONTRAST: the charts hold exactly the numeric chances, no more.
      expect(document.querySelectorAll('[data-chart-option]').length).toBe(charted)
    })
  }
  it('an aim other than the lead keeps its own chart, titled by core\'s aim words; the lead aim\'s is first, under core\'s lead (real/hiring)', () => {
    const view = viewOf('real/hiring'), groups = chartGroupsOf(view.model!)
    expect(groups.length).toBeGreaterThan(1)
    ready(view); render(<PortAnalysisTab />)
    const drawn = [...document.querySelectorAll<HTMLElement>('[data-chart-aim]')]
    expect(drawn.map((e) => e.dataset['chartAim'])).toEqual(groups.map((g) => g.aimId))
    expect(drawn[0]!.querySelector('[data-view="run.lead"]')).not.toBeNull()
    expect(drawn[1]!.querySelector(`[data-view="${groups[1]!.aim.at}"]`)!.textContent).toBe(groups[1]!.aim.text)
  })
})

describe('what is likely to happen (core\'s outcome lens, rows[].outcome)', () => {
  it('bakery: under the chart, one likely range per option with an outcome, in core\'s order; each band at outcomePlace and core\'s line under it; heading is core\'s lens label', () => {
    const view = viewOf('golden/bakery'), m = view.model!, lead = leadAimOf(m)
    const rows = chartRowsOf(m).filter((r) => r.row.outcome != null)
    expect(rows.map((r) => r.card.id)).toEqual(['second_oven', 'longer_hours', 'carry_on'])
    ready(view); render(<PortAnalysisTab />)
    const sec = screen.getByTestId('analysis-likely-outcome')
    const li = m.run!.lenses!.findIndex((l) => l.id === 'outcome')
    expect(sec.querySelector(`[data-view="run.lenses.${li}.label"]`)!.textContent).toBe(m.run!.lenses![li]!.label)
    expect([...sec.querySelectorAll<HTMLElement>('[data-outcome-option]')].map((e) => e.dataset['outcomeOption'])).toEqual(rows.map((r) => r.card.id))
    for (const { card, row, i } of rows) {
      const el = sec.querySelector(`[data-outcome-option="${card.id}"]`)!, p = outcomePlace(m, lead!, row.outcome!)
      expect(el.querySelector(`[data-view="${card.id}.rows.${i}.outcome.text"]`)!.textContent).toBe(row.outcome!.text)
      expect(el.querySelector('button')!.getAttribute('title')).toBe(row.outcome!.title)
      if (p.width < 0.5) expect(el.querySelector('[data-outcome-point]'), card.id).not.toBeNull()
      else expect(el.querySelector('[data-outcome-band]')!.getAttribute('data-outcome-band'), card.id).toBe(`${p.left}:${p.left + p.width}`)
    }
    // carry_on's one value is a point; the two ranged options are bands with a middle tick.
    expect(sec.querySelector('[data-outcome-option="carry_on"] [data-outcome-point]')).not.toBeNull()
    expect(sec.querySelector('[data-outcome-option="second_oven"] [data-outcome-mid]')).not.toBeNull()
    // It sits after the chance chart.
    const chart = screen.getByTestId('analysis-chance-chart')
    expect(chart.compareDocumentPosition(sec) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(expectAllBound(view, sec, expect)).toBeGreaterThan(rows.length)
  })

  it('the likely-outcome axis starts at zero where no outcome is below it: 80 is not at 0% (audit analysis-likely-outcome-axis-unlabelled)', () => {
    const view = structuredClone(viewOf('golden/bakery')), m = view.model!, lead = leadAimOf(m)!
    const set = (id: string, low: number, median: number, high: number) => {
      const row = m.cards.find((c) => c.id === id)!.rows.find((r) => r.kind === 'chance' && r.aim_id === lead) as { outcome: { low: number; median: number; high: number } }
      Object.assign(row.outcome, { low, median, high })
    }
    set('carry_on', 80, 80, 80); set('second_oven', 94.8, 100, 105); set('longer_hours', 85, 90, 95)
    const at = (id: string) => outcomePlace(m, lead, (m.cards.find((c) => c.id === id)!.rows.find((r) => r.kind === 'chance' && r.aim_id === lead) as { outcome: Parameters<typeof outcomePlace>[2] }).outcome)
    expect(at('carry_on').left, '80 is not at 0%').toBeCloseTo((80 / 105) * 100, 6)
    expect([at('second_oven').left + at('second_oven').width]).toEqual([100]) // the axis ends at the greatest high
    expect(at('second_oven').mid).toBeCloseTo((100 / 105) * 100, 6) // the middle tick is kept
    ready(view); render(<PortAnalysisTab />)
    expect(Number(document.querySelector('[data-outcome-option="carry_on"] [data-outcome-point]')!.getAttribute('data-outcome-point'))).toBeCloseTo((80 / 105) * 100, 6)
    // CONTRAST: an outcome that goes below zero keeps the axis from the least low (the old rule).
    set('carry_on', -10, 0, 10)
    expect(at('carry_on').left).toBe(0)
  })

  it('a View with outcomes but no outcome lens (real/hiring) keeps the section under the tab\'s own heading; CONTRAST app-launch (no chance) and bakery with every outcome removed draw none', () => {
    const hiring = viewOf('real/hiring')
    expect(hiring.model!.run!.lenses ?? []).toEqual([])
    ready(hiring); render(<PortAnalysisTab />)
    expect(screen.getByTestId('analysis-likely-outcome').querySelector('h3')!.textContent).toBe(OUTCOME_WORDS.heading)
    cleanup()
    ready(viewOf('core/an01-app-launch')); render(<PortAnalysisTab />)
    expect(screen.queryByTestId('analysis-likely-outcome')).toBeNull()
    cleanup()
    const bare = structuredClone(viewOf('golden/bakery'))
    for (const c of bare.model!.cards) for (const r of c.rows) if (r.kind === 'chance') (r as { outcome: unknown }).outcome = null
    ready(bare); render(<PortAnalysisTab />)
    expect(screen.getByTestId('analysis-chance-chart')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-likely-outcome')).toBeNull()
  })

  it('a press on a likely range focuses that option\'s card on the canvas, by its id', () => {
    ready(viewOf('golden/bakery')); render(<PortAnalysisTab />)
    fireEvent.click(screen.getByTestId('analysis-likely-outcome').querySelector('[data-outcome-option="longer_hours"] button')!)
    expect(focus.node.mock.calls).toEqual([['longer_hours']])
  })
})

describe('the chance chart', () => {
  it('R7 tail (core 4e411e82, `rows[].tail` on a chance row): core\'s finished sentence is drawn verbatim under THAT option\'s bar, as supporting detail; CONTRAST: an option whose row carries no tail draws none', () => {
    const view = structuredClone(viewOf('golden/bakery')), rows = chartRowsOf(view.model!)
    const [a, b] = rows as [typeof rows[0], typeof rows[0]]
    const words = "In the worst tenth of the runs for 'A', 'B' comes to about 3 a week, in this model on current information, not a forecast."
    ;(view.model!.cards.find((c) => c.id === a.card.id)!.rows[a.i] as { tail?: unknown }).tail = { text: words, mean: 3, unit: null, share: 0.1 }
    ready(view); render(<PortAnalysisTab />)
    const chart = screen.getByTestId('analysis-chance-chart')
    expect(chart.querySelector(`[data-chart-option="${a.card.id}"] [data-view="${a.card.id}.rows.${a.i}.tail.text"]`)?.textContent).toBe(words)
    expect(chart.querySelector(`[data-chart-option="${b.card.id}"] [data-view$=".tail.text"]`)).toBeNull()
    expect(chart.querySelectorAll('[data-view$=".tail.text"]')).toHaveLength(1)
  })
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
      if (row.driver == null) { expect(range, card.id).toBeNull(); expect(li.querySelector('[data-chart-figure]'), card.id).toBeNull() }
      else {
        expect(range!.getAttribute('data-chance-range'), card.id).toBe(`${trackPct(row.driver.low)}:${trackPct(row.driver.high)}`)
        // The whisker names its figure at rest, by core's card id.
        expect(li.querySelector('[data-chart-figure]')!.getAttribute('data-chart-figure'), card.id).toBe(row.driver.figure)
      }
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
    // What the two ends ARE is core's sentence, once, OPEN at rest (Codex 008 item 3: folded, the ends could read as a confidence interval); only the marks' legend folds.
    expect(document.querySelectorAll('[data-view="run.sensitivity.text"]')).toHaveLength(1)
    const ends = document.querySelector('[data-view="run.sensitivity.text"]')!
    expect(ends.textContent).toBe(view.model!.run!.sensitivity.text)
    expect(ends.closest('details'), 'not inside any fold').toBeNull()
    expect(screen.getByTestId('analysis-chart-key').contains(ends)).toBe(true)
    cleanup()
    for (const c of optionCards(view.model!)) for (const r of c.rows) if (r.kind === 'chance') r.driver = null
    ready(view); render(<PortAnalysisTab />)
    expect(screen.getAllByTestId('analysis-chance-track').length).toBe(3)
    expect(screen.queryByTestId('analysis-chart-key')).toBeNull()
    expect(screen.queryByTestId('analysis-chart-marks'), 'CONTRAST: the mark\'s own meaning is still offered, in the marks key and not the range key').not.toBeNull()
    expect(document.querySelectorAll('[data-chance-range]')).toHaveLength(0)
    expect(document.querySelector('[data-view="run.sensitivity.text"]')).toBeNull()
  })
})

describe('the chance chart reads at a glance (audit ChanceChart group, 18 Nov)', () => {
  it('the axis stands OVER the FIRST track (once, not at the foot, never between a bar and core\'s words for it); the whisker is a 2px body-colour line; core\'s ◉ is explained in core\'s own title, in the key\'s disclosure', () => {
    const view = viewOf('golden/bakery'), rows = chartRowsOf(view.model!)
    ready(view); render(<PortAnalysisTab />)
    const chart = screen.getByTestId('analysis-chance-chart')
    expect(chart.querySelectorAll('[data-testid="analysis-chart-axis"]')).toHaveLength(1)
    const first = chart.querySelector(`[data-chart-option="${rows[0]!.card.id}"]`)!
    const axis = chart.querySelector('[data-testid="analysis-chart-axis"]')!
    expect(first.contains(axis), 'in the first option, over its track').toBe(true)
    expect(first.querySelector('[data-testid="analysis-chance-track"]')!.compareDocumentPosition(axis) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    expect([...axis.children].map((e) => e.textContent)).toEqual(['0%', '50%', '100%'])
    const w = chart.querySelector('[data-chance-whisker]')!
    expect([w.getAttribute('stroke-width'), w.getAttribute('class')]).toEqual(['2', 'stroke-text-body'])
    const likely = rows.find((r) => r.row.likely != null)!.row.likely!
    const mark = screen.getByTestId('analysis-chart-meaning').querySelector(`[data-chart-mark="${likely.glyph}"]`)!
    expect(mark.textContent).toBe(`${likely.glyph}${likely.title}`)
  })
  it('only the marks\' legend folds, behind ONE real summary control (never hover alone); the ends\' meaning stays open beside the chart', () => {
    const view = viewOf('golden/bakery')
    ready(view); render(<PortAnalysisTab />)
    const fold = screen.getByTestId('analysis-chart-meaning')
    expect(fold.querySelector('summary')!.textContent).toBe(CHART_WORDS.meaning)
    const key = screen.getByTestId('analysis-chart-key')
    expect([...key.querySelectorAll('[data-chart-mark]')].every((e) => fold.contains(e))).toBe(true)
    expect(fold.contains(key.querySelector('[data-view="run.sensitivity.text"]'))).toBe(false)
  })
})

describe('what would change it', () => {
  it('bakery: each figure the whiskers are drawn for is named once, at its bar, by its card id; core\'s lead line (`run.tipping` kind lead) with a try on its figure', () => {
    const view = viewOf('golden/bakery'), run = view.model!.run!
    ready(view); render(<PortAnalysisTab />)
    const movers = moversOf(view.model!).map((m) => m.card.id)
    expect(movers).toEqual(['extra_sold_per_oven', 'extra_hours_sold'])
    expect([...document.querySelectorAll<HTMLElement>('[data-chart-figure]')].map((e) => e.dataset['chartFigure'])).toEqual(movers)
    for (const id of movers) expect(document.querySelectorAll(`[data-view="${id}.heading"]`), id).toHaveLength(1)
    // "What would change" names no figure of its own beside core's lines.
    expect(screen.getByTestId('analysis-what-moves').querySelectorAll('[data-chart-figure], [data-mover]')).toHaveLength(0)
    const t = run.tipping.findIndex((x) => x.kind === 'lead')
    const lead = screen.getByTestId('analysis-lead-change')
    expect(lead.dataset['leadChange']).toBe('tipping')
    expect(lead.querySelector(`[data-view="run.tipping.${t}.line"]`)!.textContent).toBe(run.tipping[t]!.line)
    expect(lead.querySelector(`[data-testid="analysis-lead-edit-${run.tipping[t]!.figure.id}"]`)).not.toBeNull()
    expect(expectAllBound(view, screen.getByTestId('analysis-what-moves'), expect)).toBeGreaterThan(0)
  })

  it('every whisker for one figure: it is named once, beside the key, never under each bar; CONTRAST two figures are named at their bars', () => {
    const view = structuredClone(viewOf('golden/bakery'))
    for (const c of optionCards(view.model!)) for (const r of c.rows) if (r.kind === 'chance' && r.driver != null) r.driver.figure = 'extra_sold_per_oven'
    ready(view); render(<PortAnalysisTab />)
    const labels = [...document.querySelectorAll<HTMLElement>('[data-chart-figure]')]
    expect(labels.map((e) => e.dataset['chartFigure'])).toEqual(['extra_sold_per_oven'])
    expect(screen.getByTestId('analysis-chart-key').contains(labels[0]!)).toBe(true)
    expect(document.querySelectorAll('[data-chart-option] [data-chart-figure]')).toHaveLength(0)
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

  it('a shared blocker covers only the options it names for its aim: CONTRAST, an option it does not name keeps its own line', () => {
    const view = structuredClone(viewOf('golden/app-launch')), m = view.model!
    const b = m.run!.shared_blockers![0]!
    const own = optionCards(m).flatMap((c) => c.rows.map((r, i) => ({ c, r, i }))).find(({ r, c }) => r.kind === 'none' && r.aim_id === b.aim_id && b.options.includes(c.id))
    expect(own, 'precondition: an option row the blocker covers').toBeDefined()
    expect(needsOf(m).some((n) => n.key === `none:${own!.c.id}.${own!.i}`)).toBe(false)
    b.options = b.options.filter((o) => o !== own!.c.id)
    const keys = needsOf(m).map((n) => n.key)
    expect(keys.includes(`none:${own!.c.id}.${own!.i}`) || needsOf(m).some((n) => n.text === (own!.r as { text: string }).text)).toBe(true)
  })

  it('R1 (core candidate 14): an option row core marks `aim_role: "reference"` is the comparison baseline, not a missing result: it leaves "What a result needs"; CONTRAST: another none row without the role stays', () => {
    const view = structuredClone(viewOf('golden/app-launch')), m = view.model!
    m.run!.shared_blockers = [] // every option's none row then speaks for itself
    const keyed = new Set(needsOf(m).map((n) => n.key))
    const rows = optionCards(m).flatMap((c) => c.rows.map((r, i) => ({ c, r, i }))).filter(({ c, i }) => keyed.has(`none:${c.id}.${i}`))
    // CONTRAST (the same row, the same model): without the role it is listed, as a contender with a missing mechanism must be.
    expect(rows.length, 'precondition: an uncovered none row listed as a need').toBeGreaterThanOrEqual(1)
    const ref = rows[0]!
    ;(ref.r as { aim_role?: string }).aim_role = 'reference'
    expect(needsOf(m).map((n) => n.key)).not.toContain(`none:${ref.c.id}.${ref.i}`)
    ;(ref.r as { aim_role?: string }).aim_role = 'contender' // any other value is not the reference
    expect(needsOf(m).map((n) => n.key)).toContain(`none:${ref.c.id}.${ref.i}`)
  })

  it('more than five: five at rest, the rest one press away', () => {
    const view = viewOf('real/hosting'), all = needsOf(view.model!)
    expect(all.length, 'precondition: more than five').toBeGreaterThan(5)
    ready(view); render(<PortAnalysisTab />)
    expect(document.querySelectorAll('[data-need]')).toHaveLength(5)
    fireEvent.click(screen.getByTestId('analysis-needs-more'))
    expect(document.querySelectorAll('[data-need]')).toHaveLength(all.length)
    expect(screen.getByTestId('analysis-needs-more').querySelector('[data-fold-chevron="open"]'), 'polish 13: the chevron turns when open').not.toBeNull()
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

  it('a result core works out (kind result, with its own values) is never listed as a figure to give; CONTRAST: the same card as a plain factor is', () => {
    const view = structuredClone(viewOf('golden/app-launch'))
    const c = view.model!.cards.find((k) => k.figure != null && k.figure.edit != null && k.status === null)!
    view.model!.run!.waits_on = null
    c.figure = { ...c.figure!, text: '' }
    Object.assign(c, { kind: 'result', values: [{ option: 'x', text: 'v', p10: 1, p50: 2, p90: 3, if_absent: [], olumi: false, if_approved: null }] })
    expect(needsOf(view.model!).some((n) => n.key === `size:${c.id}`)).toBe(false)
    Object.assign(c, { kind: 'driver', values: null })
    expect(needsOf(view.model!).some((n) => n.key === `size:${c.id}`)).toBe(true)
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

describe('the model\'s state is said once, above the tab, in the same strip as Reasoning\'s', () => {
  it('a held proposal: core\'s heading and version in the strip, once; CONTRAST: the approved model at rest draws no strip', () => {
    const held = viewOf('golden/proposal')
    expect(held.proposal).not.toBeNull()
    ready(held); render(<PortAnalysisTab />)
    const strip = screen.getByTestId('view-reasoning-state')
    expect(strip.dataset['state']).toBe('proposal')
    expect(strip.querySelector('[data-view-proposal="heading"]')!.textContent).toBe(held.proposal!.heading)
    expect(document.querySelectorAll('[data-view-proposal="heading"]')).toHaveLength(1)
    cleanup()
    ready(viewOf('golden/bakery')); render(<PortAnalysisTab />)
    expect(screen.queryByTestId('view-reasoning-state')).toBeNull()
  })
})

describe('why this reading: core\'s long reading, one press away', () => {
  it('bakery: the most-likely paragraph is not drawn at rest; opened, it is drawn once at its path with its ✎', () => {
    const view = viewOf('golden/bakery'), ml = view.model!.run!.most_likely!
    ready(view); render(<PortAnalysisTab />)
    expect(document.querySelector('[data-view="run.most_likely.text"]')).toBeNull()
    expect(screen.getByTestId('analysis-why-toggle').querySelector('[data-fold-chevron="closed"]'), 'polish 13: a chevron, pointing right while closed').not.toBeNull()
    fireEvent.click(screen.getByTestId('analysis-why-toggle'))
    expect(screen.getByTestId('analysis-why-toggle').querySelector('[data-fold-chevron="open"]')).not.toBeNull()
    const said = document.querySelectorAll('[data-view="run.most_likely.text"]')
    expect(said).toHaveLength(1)
    expect(said[0]!.textContent).toBe(ml.text)
    expect(document.querySelector(`[data-testid="analysis-likely-edit-${ml.estimate}"]`)).not.toBeNull()
    expect(expectAllBound(view, tab(), expect)).toBeGreaterThan(0)
  })
})

describe('what would have to be true, what could go wrong, what rests on Olumi\'s guesses: core\'s words, on the tab', () => {
  it('bakery: the per-option crossing is drawn verbatim with its hover, and the lead crossing is drawn once (WhatMovesIt\'s), not twice', () => {
    const view = viewOf('golden/bakery'), run = view.model!.run!
    const opt = run.tipping.find((t) => t.kind !== 'lead')!, lead = run.tipping.find((t) => t.kind === 'lead')!
    ready(view); render(<PortAnalysisTab />)
    const box = screen.getByTestId('analysis-tipping')
    const p = box.querySelector<HTMLElement>(`[data-view-fact="${opt.id}"]`)!
    expect(p.querySelector('[data-view^="run.tipping."]')!.textContent).toBe(opt.line)
    expect(p.getAttribute('title')).toBe(opt.hover)
    expect(box.querySelector(`[data-view-fact="${lead.id}"]`)).toBeNull()
    expect([...document.querySelectorAll('span')].filter((e) => e.textContent === lead.line)).toHaveLength(1)
    fireEvent.click(box.querySelector<HTMLElement>(`[data-tipping-figure="${opt.figure!.id}"]`)!)
    expect(focus.node).toHaveBeenCalled()
  })

  it('failure: none before the person\'s own reasons (CONTRAST), core\'s lines verbatim after', () => {
    const view = structuredClone(viewOf('golden/bakery'))
    view.model!.run!.failure = [{ id: 'F90', line: 'Core\'s failure sentence.', hover: 'Core\'s failure hover.' }] as never
    const gated = (state: 'closed' | 'chose' | 'wrote') => { const v = structuredClone(view); v.session = { ...v.session, pre_mortem: { ...(v.session.pre_mortem ?? {}), state } } as never; return v }
    for (const s of ['closed', 'chose'] as const) { ready(gated(s)); render(<PortAnalysisTab />); expect(screen.queryByTestId('analysis-failure'), s).toBeNull(); cleanup() }
    ready(gated('wrote')); render(<PortAnalysisTab />)
    const p = screen.getByTestId('analysis-failure').querySelector<HTMLElement>('[data-view-fact="F90"]')!
    expect(p.textContent).toBe('Core\'s failure sentence.')
    expect(p.getAttribute('title')).toBe('Core\'s failure hover.')
  })

  it('rests: core\'s full sentence is visible text on the tab, once per group, not only a hover', () => {
    const view = viewOf('golden/bakery'), r = view.model!.run!.rests[0]!
    ready(view); render(<PortAnalysisTab />)
    const box = screen.getByTestId('reasoning-rests')
    expect([...box.querySelectorAll<HTMLElement>('[data-testid="rests-sentence"]')].map((e) => e.textContent)).toContain(r.line)
    expect(box.querySelectorAll(`[data-rest="${r.id}"] [data-testid="rests-sentence"]`)).toHaveLength(1)
  })
})
