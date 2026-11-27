/**
 * The Analysis tab on the olumi-core lane (redesign, 18 Nov 2026): what the model implies, seen. Bound by identity on core's own Views: each
 * bar by its option id and row path, each mark by the row core puts it on, each press by the card id it focuses; every section has a
 * present/absent contrast, and the tab's state is read from the options' rows, never from run fields.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const focus = vi.hoisted(() => ({ node: vi.fn() }))
vi.mock('../../../canvas/utils/focusHelpers', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../canvas/utils/focusHelpers')>()), focusNodeById: focus.node }))

import type { View } from '../../client'
import { useViewStore } from '../../store'
import { ICONS } from '../../look/icons'
import { useMe } from '../../../olumiCore/me'
import { optionCards, outcomePlace } from '../../layout'
import { OUTCOME_WORDS } from '../LikelyOutcome'
import { CHART_WORDS } from '../ChanceChart'
import { PortAnalysisTab } from '../PortAnalysisTab'
import { REASONING_LABELS, ViewReasoningBlock } from '../../ViewReasoning'
import { SimpleFace } from '../../v12/SimpleFace'
import { COMMITMENT_WORDS } from '../../reasoning/TowardsCommitment'
import { useReasoningFocus } from '../../reasoning/focusRequest'
import { checkItemsOf, checkNeedsOf } from '../../check/items'
import { TIPPING_FIGURE } from '../AnalysisReaders'
import { chartGroupsOf, chartRowsOf, leadAimOf, moversOf, rangeOf, tabStateOf, trackPct } from '../pick'
import { expectAllBound, viewOf } from './viewAt'
import { tipOf } from '../../__tests__/tipHelpers'
import { installCanvasFocus } from '../../focus/canvas'
import { setFocusSubject } from '../../focus/subject'
import { useCanvasStore } from '../../../canvas/store'
import { useStoredFocusSubject } from '../../focus/state'
import { useViewChat } from '../../ViewChat'
import { useUIStore } from '../../../stores/uiStore'

const ready = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
}
let stopCanvasFocus: (() => void) | undefined
afterEach(() => { cleanup(); stopCanvasFocus?.(); stopCanvasFocus = undefined; vi.unstubAllEnvs(); setFocusSubject(null); useCanvasStore.getState().clearSelection(); useViewChat.setState({ text: '', prefilled: null }); focus.node.mockReset(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })
const tab = () => screen.getByTestId('port-analysis-tab')
/** The chart's one control for what folds: each option's tail, the low/high key, the marks' legend. */
const more = () => fireEvent.click(screen.getByTestId('analysis-chart-more'))
const why = () => fireEvent.click(screen.getByTestId('analysis-why-toggle'))

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
    const notes = (launch.model!.run!.notes ?? []).filter((n) => n.text !== '')
    expect(notes.length).toBeGreaterThan(0)
    expect(screen.queryByTestId('analysis-leaves-out')).toBeNull()
    why()
    expect([...screen.getByTestId('analysis-leaves-out').querySelectorAll('li')].map((e) => e.textContent)).toEqual(notes.map((n) => n.text))
  })

  it('limit rows only (bakery with its chance rows made limit rows): each option\'s state against the limit, by its row path, with the condition on hover; no chart', async () => {
    const view = structuredClone(viewOf('golden/bakery'))
    for (const c of optionCards(view.model!)) c.rows = c.rows.map((r) => (r.kind === 'chance' ? { kind: 'limit', value: r.value, olumi: r.olumi, aim: r.aim, aim_id: r.aim_id, title: r.title, state_text: 'state words', estimate: null } as never : r))
    expect(tabStateOf(view.model!)).toBe('limit')
    ready(view); render(<PortAnalysisTab />)
    expect(screen.queryByTestId('analysis-chance-chart')).toBeNull()
    const limits = screen.getByTestId('analysis-limits')
    const ids = optionCards(view.model!).filter((c) => c.rows.some((r) => r.kind === 'limit')).map((c) => c.id)
    expect([...limits.querySelectorAll<HTMLElement>('[data-limit-option]')].map((e) => e.dataset['limitOption'])).toEqual(ids)
    expect(expectAllBound(view, limits, expect)).toBeGreaterThan(0)
    expect(limits.querySelector('[data-view$=".value"]')).toBeNull()
    for (const card of optionCards(view.model!)) for (const [i, row] of card.rows.entries()) {
      if (row.kind !== 'limit') continue
      const button = limits.querySelector<HTMLElement>(`[data-limit-option="${card.id}"]`)!
      expect(button.querySelector(`[data-view="${card.id}.rows.${i}.state_text"]`)).toHaveTextContent(row.state_text!)
      fireEvent.pointerEnter(button)
      const tip = await screen.findByRole('tooltip')
      expect(tip.querySelector(`[data-view="${card.id}.rows.${i}.value"]`)?.textContent).toBe(row.value)
      expect(tip.querySelector(`[data-view="${card.id}.rows.${i}.title"]`)?.textContent).toBe(row.title)
      fireEvent.pointerLeave(button)
    }
  })
})

describe('every option’s line is reachable from Results or Check', () => {
  for (const n of ['real/hiring', 'golden/s_ce285b3617bb', 'core/an01-european-otheraims', 'core/an01-studio-otheraims', 'core/an01-studio', 'golden/bakery', 'golden/european', 'golden/app-launch'] as const) {
    it(`${n}: charts numeric chances by aim, shows limits and retains missing results in Check`, () => {
      const view = viewOf(n), model = view.model!, groups = chartGroupsOf(model)
      const needs = new Set(checkNeedsOf(model).map((x) => x.at))
      ready(view); render(<PortAnalysisTab />)
      const switches = screen.queryAllByRole('group', { name: 'Aim' }).flatMap((group) => within(group).getAllByRole('button'))
      for (const [i, group] of groups.entries()) {
        if (switches[i] !== undefined) fireEvent.click(switches[i]!)
        const chart = document.querySelector(`[data-chart-aim="${group.aimId}"]`)!
        expect(chart).not.toBeNull()
        expect(document.querySelectorAll('[data-chart-aim]')).toHaveLength(1)
        const numeric = optionCards(model).filter((c) => c.rows.some((row) => row.aim_id === group.aimId && row.kind === 'chance' && Number.isFinite(row.chance)))
        expect([...chart.querySelectorAll('[data-chart-option]')].map((el) => el.getAttribute('data-chart-option'))).toEqual(numeric.map((c) => c.id))
      }
      for (const c of optionCards(model)) c.rows.forEach((r, i) => {
        const where = `${c.id}.rows.${i}`
        if (r.kind === 'limit') expect(document.querySelector(`[data-limit-aim="${r.aim_id}"] [data-limit-option="${c.id}"]`), where).not.toBeNull()
        else if (r.kind === 'chance' && !Number.isFinite(r.chance) && r.value !== '') expect(needs.has(`${where}.value`), where).toBe(true)
        else if (r.kind === 'none' && r.aim_role !== 'reference' && r.text !== '') {
          const covered = (model.run?.shared_blockers ?? []).some((b) => b.aim_id === r.aim_id && (b.options ?? []).includes(c.id))
          expect(needs.has(`${where}.text`) || covered, where).toBe(true)
        }
      })
    })
  }

  it('switches both pictures by keyboard, defaulting to the lead aim with Core’s words at each path', async () => {
    const view = viewOf('real/hiring'), groups = chartGroupsOf(view.model!)
    expect(groups.length).toBeGreaterThan(1)
    ready(view); render(<PortAnalysisTab />)
    const control = screen.getByRole('group', { name: 'Aim' })
    const segments = within(control).getAllByRole('button')
    expect(segments.map((segment) => [segment.textContent, segment.getAttribute('data-view')])).toEqual(groups.map(({ aim }) => [aim.text, aim.at]))
    expect(segments[0]).toHaveAttribute('aria-pressed', 'true')
    const lead = tab().querySelector('[data-view="run.lead"]')!
    expect(lead.textContent).toBe(view.model!.run!.lead)
    expect(lead.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const user = userEvent.setup()
    for (const [i, group] of groups.entries()) {
      segments[i]!.focus()
      await user.keyboard('{Enter}')
      expect(segments.map((segment) => segment.getAttribute('aria-pressed'))).toEqual(groups.map((_, j) => String(i === j)))
      expect([...tab().querySelectorAll('[data-chart-aim]')].map((el) => el.getAttribute('data-chart-aim'))).toEqual([group.aimId])
      const expected = group.rows.filter(({ row }) => row.outcome != null)
      expect([...tab().querySelectorAll('[data-outcome-aim]')].map((el) => el.getAttribute('data-outcome-aim'))).toEqual(expected.length ? [group.aimId] : [])
      expect([...tab().querySelectorAll('[data-outcome-option]')].map((el) => el.getAttribute('data-outcome-option'))).toEqual(expected.map(({ card }) => card.id))
      expect(lead.textContent).toBe(view.model!.run!.lead)
    }
  })

  it('offers one Ask Olumi press after the picture and appends Core’s lead to the draft', () => {
    const view = viewOf('golden/bakery')
    ready(view)
    vi.stubEnv('VITE_FEATURE_AI_PANEL_V2', 'true')
    useUIStore.setState({ activeOutputTab: 'results' })
    useViewChat.setState({ text: 'Existing draft' })
    render(<PortAnalysisTab />)
    expect(screen.queryByRole('group', { name: 'Aim' })).toBeNull()
    const ask = screen.getByRole('button', { name: 'Ask Olumi about this' })
    for (const id of ['analysis-chance-chart', 'analysis-likely-outcome', 'analysis-what-moves', 'analysis-tipping']) {
      expect(screen.getByTestId(id).compareDocumentPosition(ask) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    fireEvent.click(ask)
    expect(useViewChat.getState().text).toBe(`Existing draft\n${view.model!.run!.lead}`)
    expect(useUIStore.getState().activeOutputTab).toBe('olumi')
  })

  it('marks the canvas option in both pictures and publishes a panel subject when a row is pressed', () => {
    const view = viewOf('golden/bakery'), [first, second] = chartRowsOf(view.model!)
    ready(view); render(<PortAnalysisTab />)
    stopCanvasFocus = installCanvasFocus()
    act(() => useCanvasStore.getState().selectNodes([first!.card.id]))
    for (const selector of ['chart', 'outcome']) {
      const current = tab().querySelector(`[data-${selector}-option="${first!.card.id}"] button`)
      expect(current).toHaveAttribute('aria-current', 'true')
      expect(current).toHaveClass('aria-[current=true]:bg-panel-hover')
      const summary = current!.querySelector('[data-option-summary]')
      const track = current!.querySelector('[data-option-track]')
      expect(summary).toHaveClass('grid-cols-2')
      expect(summary!.querySelector('[data-option-value]')).toHaveClass('text-right')
      expect(track).toHaveClass('w-full')
      expect(summary!.nextElementSibling).toBe(track)
    }
    const button = tab().querySelector(`[data-outcome-option="${second!.card.id}"] button`)!
    expect(button).not.toHaveAttribute('aria-current')
    fireEvent.click(button)
    expect(useStoredFocusSubject.getState().subject).toEqual({ sid: view.id, kind: 'option', id: second!.card.id, cards: [second!.card.id], source: 'panel' })
    expect(focus.node).toHaveBeenCalledWith(second!.card.id)
  })
})

describe('what is likely to happen (core\'s outcome lens, rows[].outcome)', () => {
  it('bakery: under the chart, one likely range per option with an outcome, in core\'s order; each band at outcomePlace and core\'s line under it; heading is core\'s lens label; the option\'s longer words are the one Tip, never a native title', async () => {
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
      expect([el.querySelector('button')!.getAttribute('title'), await tipOf(el.querySelector('button')!)], card.id).toEqual([null, row.outcome!.title])
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
    expect(screen.queryByTestId('analysis-likely-outcome')).toBeNull()
    const secondAim = chartGroupsOf(hiring.model!)[1]!
    fireEvent.click(within(screen.getByRole('group', { name: 'Aim' })).getByRole('button', { name: secondAim.aim.text }))
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
  it('R7 tail (core 4e411e82, `rows[].tail` on a chance row): core\'s finished sentence is drawn verbatim under THAT option\'s bar AT REST (A1), not folded; CONTRAST: an option whose row carries no tail draws none', () => {
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
  it('tail note (core s3-tail-once 7e6add3d, `run.tail_note`): core\'s one note for the short worst-tenth lines is drawn ONCE, before the lines it explains, for the aims it lists; CONTRAST: no note, or one for an aim with no line, draws nothing', () => {
    const NOTE = "Worst tenth: the mean of what the aim measures in the worst tenth of that option's runs, in this model on current information, not a forecast."
    const build = (aims: (ids: string[]) => string[]) => {
      const view = structuredClone(viewOf('golden/bakery')), rows = chartRowsOf(view.model!)
      for (const r of rows) (view.model!.cards.find((c) => c.id === r.card.id)!.rows[r.i] as { tail?: unknown }).tail = { text: 'Worst tenth: about 3 a week', mean: 3, unit: null, share: 0.1 }
      ;(view.model!.run as unknown as { tail_note?: unknown }).tail_note = { text: NOTE, aims: aims(rows.map((r) => r.row.aim_id ?? '')) }
      return view
    }
    ready(build((ids) => [...new Set(ids)])); render(<PortAnalysisTab />)
    const chart = screen.getByTestId('analysis-chance-chart')
    const notes = chart.querySelectorAll('[data-view="run.tail_note.text"]'), lines = chart.querySelectorAll('[data-view$=".tail.text"]')
    expect([notes.length, notes[0]?.textContent, lines.length > 1]).toEqual([1, NOTE, true])
    expect(notes[0]!.compareDocumentPosition(lines[0]!) & Node.DOCUMENT_POSITION_FOLLOWING, 'read before the lines').toBeTruthy()
    cleanup()
    ready(build(() => ['some_other_aim'])); render(<PortAnalysisTab />)
    expect(screen.getByTestId('analysis-chance-chart').querySelector('[data-view="run.tail_note.text"]')).toBeNull()
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

  it('core\'s most-likely mark is on the one row core gives it, named by its title (inside the pressable row, which carries its own words); CONTRAST: the other rows carry none', () => {
    const view = viewOf('golden/bakery'), rows = chartRowsOf(view.model!)
    const likely = rows.filter((r) => r.row.likely != null)
    expect(likely.map((r) => r.card.id)).toEqual(['second_oven'])
    ready(view); render(<PortAnalysisTab />)
    const marks = [...document.querySelectorAll<HTMLElement>('[data-view$=".likely.glyph"]')]
    expect(marks.map((m) => m.closest<HTMLElement>('[data-chart-option]')!.dataset['chartOption'])).toEqual(['second_oven'])
    expect([marks[0]!.getAttribute('title'), marks[0]!.getAttribute('aria-label'), marks[0]!.getAttribute('role')]).toEqual([null, likely[0]!.row.likely!.title, 'img'])
  })

  it('a press on a bar focuses that option\'s card on the canvas, by its id', () => {
    const view = viewOf('golden/bakery')
    ready(view); render(<PortAnalysisTab />)
    fireEvent.click(document.querySelector('[data-chart-option="longer_hours"] button')!)
    expect(focus.node.mock.calls).toEqual([['longer_hours']])
  })

  it('the key is drawn only where some bar has a range: CONTRAST bakery with every driver removed draws bars and no key; core\'s title for the ends is the one Tip on the ends\' sentence', async () => {
    const view = structuredClone(viewOf('golden/bakery'))
    ready(view); render(<PortAnalysisTab />)
    expect(screen.getByTestId('analysis-chart-key').hasAttribute('title'), 'no native title on the key').toBe(false)
    // What the two ends ARE is core's sentence, once, OPEN at rest (Codex 008 item 3: folded, the ends could read as a confidence interval); only the marks' legend folds.
    expect(document.querySelectorAll('[data-view="run.sensitivity.text"]')).toHaveLength(1)
    const ends = document.querySelector('[data-view="run.sensitivity.text"]')!
    expect(ends.textContent).toBe(view.model!.run!.sensitivity.text)
    expect(ends.closest('details'), 'not inside any fold').toBeNull()
    expect([ends.getAttribute('title'), await tipOf(ends as HTMLElement)]).toEqual([null, view.model!.run!.sensitivity.title])
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
  it('Core’s chance text leads the dots and the expert axis stands over the first track; the whisker is a 2px body-colour line; core\'s ◉ is explained in core\'s own title, behind the key\'s one control', () => {
    const view = viewOf('golden/bakery'), rows = chartRowsOf(view.model!)
    ready(view); render(<PortAnalysisTab />)
    const chart = screen.getByTestId('analysis-chance-chart')
    expect(chart.querySelectorAll('[data-testid="analysis-chart-axis"]')).toHaveLength(1)
    const first = chart.querySelector(`[data-chart-option="${rows[0]!.card.id}"]`)!
    const axis = chart.querySelector('[data-testid="analysis-chart-axis"]')!
    expect(first.contains(axis), 'in the first option, over its track').toBe(true)
    const { card, row, i } = rows[0]!
    const words = first.querySelector(`[data-view="${card.id}.rows.${i}.value"]`)!
    const dots = first.querySelector('[data-chance-dots]')!
    expect(words.textContent).toBe(row.value)
    expect(words.compareDocumentPosition(dots) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(axis.compareDocumentPosition(words) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(dots.querySelectorAll('[data-chance-dot="filled"]')).toHaveLength(Math.round(row.chance! * 10))
    expect(first.querySelector('[data-testid="analysis-chance-track"]')!.compareDocumentPosition(axis) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    expect([...axis.children].map((e) => e.textContent)).toEqual(['0%', '50%', '100%'])
    const w = chart.querySelector('[data-chance-whisker]')!
    expect([w.getAttribute('stroke-width'), w.getAttribute('class')]).toEqual(['2', 'stroke-text-body'])
    const likely = rows.find((r) => r.row.likely != null)!.row.likely!
    more()
    const mark = screen.getByTestId('analysis-chart-fold').querySelector(`[data-chart-mark="${likely.glyph}"]`)!
    expect(mark.textContent).toBe(`${likely.glyph}${likely.title}`)
  })
  it('only the low/high key, the marks\' legend and the tails fold, behind ONE real button with its state said (never hover alone, never a <details> whose closed body is still drawn); the ends\' meaning stays open beside the chart', () => {
    const view = viewOf('golden/bakery')
    ready(view); render(<PortAnalysisTab />)
    const button = screen.getByTestId('analysis-chart-more'), key = screen.getByTestId('analysis-chart-key')
    expect([button.tagName, button.textContent, button.getAttribute('aria-expanded'), key.contains(button)]).toEqual(['BUTTON', CHART_WORDS.more, 'false', true])
    expect(screen.getByTestId('analysis-chance-chart').querySelector('details')).toBeNull()
    expect([screen.queryByTestId('analysis-chart-fold'), document.querySelectorAll('[data-chart-mark]').length, screen.queryByTestId('analysis-chart-ends-key')]).toEqual([null, 0, null])
    more()
    const fold = screen.getByTestId('analysis-chart-fold')
    expect([screen.getByTestId('analysis-chart-more').getAttribute('aria-expanded'), fold.querySelectorAll('[data-chart-mark]').length > 0, fold.contains(screen.getByTestId('analysis-chart-ends-key'))]).toEqual(['true', true, true])
    expect(fold.contains(key.querySelector('[data-view="run.sensitivity.text"]'))).toBe(false)
    more()
    expect([screen.getByTestId('analysis-chart-more').getAttribute('aria-expanded'), screen.queryByTestId('analysis-chart-fold')]).toEqual(['false', null])
  })
})

describe('Analysis fits at rest (UI lead, 19 Nov: 279 px over the panel at 1232; ruling 19 Nov: the chance keeps its uncertainty at rest)', () => {
  const drawnNow = () => ({
    whiskers: document.querySelectorAll('[data-chance-range]').length, figures: document.querySelectorAll('[data-chart-figure]').length,
    ends: document.querySelectorAll('[data-view="run.sensitivity.text"]').length,
    endsKey: document.querySelectorAll('[data-testid="analysis-chart-ends-key"]').length, marks: document.querySelectorAll('[data-chart-mark]').length,
    tails: document.querySelectorAll('[data-view$=".tail.text"]').length,
  })
  for (const n of ['golden/bakery', 'real/hiring'] as const) {
    it(`${n}: at rest every option’s chance row for the active aim (bar, core's words, its whisker where core gives a range), core's lead, the figure and core's sentence for the ends, and every likely outcome row are drawn; and each option's tail (A1) are drawn; the low/high key and the marks' legend are not. CONTRAST: one press draws them`, () => {
      const view = structuredClone(viewOf(n)), m = view.model!, groups = chartGroupsOf(m)
      const { card, i } = groups[0]!.rows[0]!
      ;(m.cards.find((c) => c.id === card.id)!.rows[i] as { tail?: unknown }).tail = { text: 'core tail words', mean: 3, unit: null, share: 0.1 }
      const firstAim = groups[0]!
      const outcomes = firstAim.rows.filter((r) => r.row.outcome != null).map((r) => `${firstAim.aimId}:${r.card.id}`)
      // bakery's chances carry ranges (whiskers); hiring's do not, so there nothing about ranges is drawn in either state.
      const ranged = groups.some((g) => g.rows.some((r) => rangeOf(r.row) !== null))
      expect([groups.length > 0, outcomes.length > 0, ranged], 'fixture').toEqual([true, n === 'golden/bakery', n === 'golden/bakery'])
      ready(view); render(<PortAnalysisTab />)
      const chart = screen.getByTestId('analysis-chance-chart')
      for (const r of firstAim.rows) {
        const g = firstAim
        const li = chart.querySelector(`[data-chart-aim="${g.aimId}"] [data-chart-option="${r.card.id}"]`), at = `${g.aimId}:${r.card.id}`
        expect(li?.querySelector('[data-chance-bar]'), at).not.toBeNull()
        expect(li?.querySelector(`[data-view="${r.card.id}.rows.${r.i}.value"]`)?.textContent, at).toBe(r.row.value)
        expect(li?.querySelector('[data-chance-range]') != null, `${at}: its whisker at rest`).toBe(rangeOf(r.row) !== null)
      }
      expect(tab().querySelector('[data-view="run.lead"]')?.textContent).toBe(m.run!.lead)
      const likely = screen.queryByTestId('analysis-likely-outcome')
      expect(likely !== null).toBe(outcomes.length > 0)
      expect(outcomes.filter((k) => { const [a, c] = k.split(':'); return likely?.querySelector(`[data-outcome-aim="${a}"] [data-outcome-option="${c}"]`) == null })).toEqual([])
      const rest = drawnNow()
      expect(rest, 'at rest').toEqual({ whiskers: rest.whiskers, figures: rest.figures, ends: ranged ? 1 : 0, endsKey: 0, marks: 0, tails: 1 })
      expect([rest.whiskers > 0, rest.figures > 0], 'a whisker at rest has its figure').toEqual([ranged, ranged])
      more()
      const open = drawnNow()
      expect({ ...open, marks: 0 }, 'one press: the folded detail too, and nothing drawn at rest goes').toEqual({ ...rest, endsKey: ranged ? 1 : 0, tails: 1 })
      expect(open.marks, 'the marks\' legend').toBeGreaterThan(0)
      expect(chart.querySelector(`[data-chart-option="${card.id}"] [data-view="${card.id}.rows.${i}.tail.text"]`)?.textContent).toBe('core tail words')
    })
  }
  it('a chart with only a tail (no range, no mark): the tail is drawn at rest and there is nothing to fold, so no control (A1); CONTRAST: no tail, no control either', () => {
    const view = structuredClone(viewOf('golden/bakery')), rows = chartRowsOf(view.model!)
    for (const c of optionCards(view.model!)) for (const r of c.rows) if (r.kind === 'chance') { r.driver = null; r.likely = null; r.olumi = null }
    ready(view); render(<PortAnalysisTab />)
    expect(screen.queryByTestId('analysis-chart-more')).toBeNull()
    cleanup()
    ;(view.model!.cards.find((c) => c.id === rows[0]!.card.id)!.rows[rows[0]!.i] as { tail?: unknown }).tail = { text: 'core tail words', mean: 3, unit: null, share: 0.1 }
    ready(view); render(<PortAnalysisTab />)
    expect(document.querySelector(`[data-chart-option="${rows[0]!.card.id}"] [data-view$=".tail.text"]`)?.textContent).toBe('core tail words')
    expect(screen.queryByTestId('analysis-chart-more')).toBeNull()
  })
})

const withoutCheckItems = () => {
  const view = structuredClone(viewOf('golden/app-launch'))
  view.model_words = null as never
  Object.assign(view.model!, { questions: [], coaching_questions: [], sharpen: [] })
  Object.assign(view.model!.run!, { shared_blockers: [], waits_on: null, find_out: [] })
  for (const card of view.model!.cards) {
    card.challenged = false
    card.worth_checking = []
    card.rows = card.rows.filter((row) => row.kind !== 'none' && row.kind !== 'chance')
    if (card.figure != null) card.figure.edit = null
  }
  view.collab.dissent = []
  return view
}

describe('no chance yet: a link to Reasoning before what a result needs', () => {
  it('app-launch: one row with the full list count, while Check keeps the item words', () => {
    const launch = viewOf('golden/app-launch'), model = launch.model!
    const items = checkItemsOf(model, launch).flatMap((group) => group.blocks.flatMap((block) => block.items))
    const first = items[0]
    expect([tabStateOf(model), first !== undefined]).toEqual(['none', true])
    ready(launch); render(<PortAnalysisTab />)
    const link = screen.getByTestId('analysis-to-reasoning')
    expect(tab().contains(link)).toBe(true)
    expect(within(tab()).getAllByTestId('analysis-to-reasoning')).toHaveLength(1)
    expect(link).toHaveTextContent(REASONING_LABELS.examine)
    expect(link.querySelector('[data-count]')?.textContent).toBe(String(items.length))
    expect(screen.queryByTestId('analysis-needs')).toBeNull()
    expect(link.compareDocumentPosition(screen.getByTestId('analysis-why')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const w = first!.short
    expect(link.textContent).not.toContain(w)
    expect(link.textContent).not.toContain('Start here')
    expect(screen.queryByTestId('reasoning-focus')).toBeNull()
    fireEvent.click(link)
    cleanup()
    ready(launch); render(<ViewReasoningBlock />)
    expect(screen.queryByTestId('reasoning-focus')).toBeNull()
    const item = document.querySelector(`[data-check-item="${first!.key}"]`)
    expect(item).toHaveFocus()
    expect(item?.closest('li')).toHaveTextContent(w)
  })

  it('a challenge alone opens Reasoning and focuses its row when activated with Enter', async () => {
    const user = userEvent.setup()
    const view = withoutCheckItems(), card = view.model!.cards[0]!
    card.challenged = true
    ready(view)
    useUIStore.setState({ activeOutputTab: 'results' })
    render(<PortAnalysisTab />)
    const link = screen.getByTestId('analysis-to-reasoning')
    expect(link).toHaveTextContent(REASONING_LABELS.examine)
    expect(link.querySelector('[data-count]')).toHaveTextContent('1')
    link.focus()
    await user.keyboard('{Enter}')
    expect(useReasoningFocus.getState().request).toEqual({ sid: view.id, key: `c:${card.id}` })
    expect(useUIStore.getState().activeOutputTab).toBe('analysisNew')
    cleanup()
    render(<ViewReasoningBlock />)
    const challenge = document.querySelector(`[data-check-item="c:${card.id}"]`)
    expect(challenge).toHaveTextContent(card.heading)
    expect(challenge).toHaveFocus()
    expect(challenge).toHaveAttribute('tabindex', '0')
    expect(challenge).toHaveAttribute('aria-expanded', 'true')
    expect(useReasoningFocus.getState().request).toBeNull()
  })

  it('dissent alone opens Reasoning and focuses Towards commitment', () => {
    const view = withoutCheckItems(), card = view.model!.cards[0]!
    card.challenged = true
    view.collab.dissent = [{ id: card.id, holder: 'Sarah', position: 'Keep this risk open.', holder_id: null, confirmed: null }]
    ready(view)
    useUIStore.setState({ activeOutputTab: 'results' })
    render(<PortAnalysisTab />)
    const link = screen.getByTestId('analysis-to-reasoning')
    expect(link).toHaveTextContent(COMMITMENT_WORDS.heading)
    expect(link.querySelector('[data-count]')).toBeNull()
    fireEvent.click(link)
    expect(useReasoningFocus.getState().request).toEqual({ sid: view.id, key: 'commitment' })
    expect(useUIStore.getState().activeOutputTab).toBe('analysisNew')
    cleanup()
    render(<ViewReasoningBlock />)
    expect(screen.getByTestId('reasoning-commitment')).toHaveFocus()
    expect(useReasoningFocus.getState().request).toBeNull()
  })

  it('an empty Check keeps the link with a zero count and requests no row focus', () => {
    ready(withoutCheckItems()); render(<PortAnalysisTab />)
    const link = screen.getByTestId('analysis-to-reasoning')
    expect(link.querySelector('[data-count]')).toHaveTextContent('0')
    fireEvent.click(link)
    expect(useReasoningFocus.getState().request).toBeNull()
    expect(screen.queryByTestId('reasoning-focus')).toBeNull()
    expect(screen.queryByTestId('analysis-needs')).toBeNull()
  })

  it('a typed question on the current saved view has its AnswerBox in Reasoning only', () => {
    const view = withoutCheckItems()
    const question = { id: 'release-date', text: 'When is the release?', about: null, role: null, unit: null }
    view.model!.questions = [question]
    ready(view); render(<><PortAnalysisTab /><ViewReasoningBlock /></>)
    expect(within(tab()).queryByText(question.text)).toBeNull()
    expect(within(tab()).queryByTestId('reasoning-answer-input')).toBeNull()
    expect(screen.queryByTestId('reasoning-answer-input')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: question.text }))
    expect(within(screen.getByTestId('view-reasoning')).getByTestId('reasoning-answer-input').closest('form')).toHaveAttribute('data-answer-for', question.id)
  })

  it('Enter on the waiting goal measure line reveals and focuses the folded question', async () => {
    const user = userEvent.setup()
    const view = withoutCheckItems(), model = view.model!
    const goal = model.cards.find((card) => card.id === 'protect_user_trust')!
    goal.bound = { ...goal.bound!, measured: false }
    goal.doubt = true
    for (const card of model.cards.filter((card) => card !== goal).slice(0, 4)) card.challenged = true
    const question = { id: 'goal-measure', text: 'What should we count to track user trust?', about: goal.id, role: 'measure' as const, unit: null }
    model.questions = [question]
    ready(view)
    render(<><SimpleFace card={goal} model={model} noted={false} /><ViewReasoningBlock /></>)
    const examined = document.querySelector('[data-check-group="examine"]')!
    const row = () => examined.querySelector(`[data-check-item="q:${question.id}"]`)
    const more = examined.querySelector('[data-check-more="examine"]')!
    const line = screen.getByRole('button', { name: 'Not counted yet' })

    expect(examined.querySelectorAll('[data-check-item^="c:"]')).toHaveLength(1)
    expect(row()).toBeNull()
    expect(more).toHaveAttribute('aria-expanded', 'false')
    line.focus()
    await user.keyboard('{Enter}')

    expect(row()).toBeInTheDocument()
    expect(row()).toHaveFocus()
    expect(more).toHaveAttribute('aria-expanded', 'true')
    expect(more).toHaveTextContent(REASONING_LABELS.fewer)
    expect(useReasoningFocus.getState().request).toBeNull()
  })

  it('leaves another scenario’s request alone until the scenario changes', () => {
    const view = withoutCheckItems(), card = view.model!.cards[0]!
    card.challenged = true
    ready(view)
    const request = { sid: 's_other', key: `c:${card.id}` }
    useReasoningFocus.setState({ request })
    render(<ViewReasoningBlock />)
    expect(document.querySelector(`[data-check-item="c:${card.id}"]`)).not.toHaveFocus()
    expect(useReasoningFocus.getState().request).toEqual(request)
    act(() => { useViewStore.setState({ sid: request.sid }) })
    expect(useReasoningFocus.getState().request).toBeNull()
    expect(document.querySelector(`[data-check-item="c:${card.id}"]`)).not.toHaveFocus()
  })

  it('clears a request for an item that is no longer present', () => {
    const view = withoutCheckItems()
    ready(view)
    useReasoningFocus.setState({ request: { sid: view.id, key: 'c:missing' } })
    render(<ViewReasoningBlock />)
    expect(useReasoningFocus.getState().request).toBeNull()
    expect(document.querySelector('[data-check-item][data-selected="true"]')).toBeNull()
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

describe('Check is the single home for gaps and uncertainty shares', () => {
  for (const name of ['golden/app-launch', 'golden/bakery'] as const) {
    it(`${name}: Results keeps the link and reading fold, and Check keeps the gaps`, () => {
      const view = viewOf(name)
      ready(view); render(<><PortAnalysisTab /><ViewReasoningBlock /></>)
      expect(within(tab()).queryByTestId('analysis-needs')).toBeNull()
      expect(within(tab()).queryByTestId('reasoning-rests')).toBeNull()
      expect(within(tab()).getAllByTestId('analysis-to-reasoning')).toHaveLength(1)
      expect(document.querySelectorAll('[data-check-group="needs"]')).toHaveLength(1)
      expect(within(tab()).queryByTestId('analysis-leaves-out')).toBeNull()
      why()
      expect(within(tab()).getAllByTestId('analysis-leaves-out')).toHaveLength(1)
    })
  }
})

describe('the Analysis link to Reasoning', () => {
  it('opens Check from the item count both before and after chances', () => {
    const view = viewOf('golden/app-launch')
    useUIStore.setState({ activeOutputTab: 'results' })
    ready(view); render(<PortAnalysisTab />)
    const row = screen.getByTestId('analysis-to-reasoning')
    const items = checkItemsOf(view.model!, view).flatMap((group) => group.blocks.flatMap((block) => block.items))
    expect(row.querySelector('[data-count]')?.textContent).toBe(String(items.length))
    fireEvent.click(row)
    expect(useUIStore.getState().activeOutputTab).toBe('analysisNew')
    cleanup()
    ready(viewOf('golden/bakery')); render(<PortAnalysisTab />)
    expect(tab().dataset['analysisState']).toBe('chance')
    expect(screen.queryByTestId('reasoning-focus')).toBeNull()
    const chanceLink = screen.getByTestId('analysis-to-reasoning')
    expect(Number(chanceLink.querySelector('[data-count]')?.textContent)).toBeGreaterThan(0)
    fireEvent.click(chanceLink)
    expect(useUIStore.getState().activeOutputTab).toBe('analysisNew')
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

describe('the tab draws only a current View of the model (ported from the deleted ViewChancesBlock spec)', () => {
  it('a read that failed, or a View marked stale, draws no tab: older lines are never shown as current. CONTRAST: the same View ready draws it', () => {
    const view = viewOf('golden/bakery')
    for (const state of [{ error: 'Olumi could not be read just now. Try again in a moment.', stale: false }, { error: null, stale: true }]) {
      ready(view); useViewStore.setState(state as never)
      expect(render(<PortAnalysisTab />).container.querySelector('[data-testid="port-analysis-tab"]')).toBeNull(); cleanup()
    }
    ready(view)
    expect(render(<PortAnalysisTab />).container.querySelector('[data-testid="port-analysis-tab"]')).not.toBeNull()
  })
})

describe('why this reading: core\'s long reading, one press away', () => {
  it.each(['chance', 'limit', 'none'] as const)('keeps one closed fold in the %s state, ordered notes and timing, most likely, comparisons', (state) => {
    const view = viewOf('golden/bakery'), model = view.model!, run = model.run!
    if (state !== 'chance') for (const card of optionCards(model)) {
      card.rows = state === 'none' ? [] : card.rows.map((row) => row.kind === 'chance'
        ? { ...row, kind: 'limit', state_text: 'Core limit state' } as never
        : row)
    }
    run.notes = [{ text: 'Core note', title: 'Core note title' }] as typeof run.notes
    run.timing = [{ quantity: 'timing-figure', text: 'Core timing' }] as typeof run.timing
    run.compared = [{ id: 'contrast', kind: 'better', line: 'Core comparison', hover: '', olumi: null }] as never
    run.compared_headings = { ...run.compared_headings, better: 'Core comparisons' }
    expect(tabStateOf(model)).toBe(state)
    ready(view); render(<PortAnalysisTab />)
    const toggle = screen.getByTestId('analysis-why-toggle')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('analysis-why-region')).toBeNull()
    why()
    const region = screen.getByTestId('analysis-why-region')
    const sections = [...region.querySelectorAll('[data-testid="analysis-leaves-out"], [data-testid="analysis-why-most-likely"], [data-testid="view-run-compared"]')]
    expect(sections.map((section) => section.getAttribute('data-testid'))).toEqual(['analysis-leaves-out', 'analysis-why-most-likely', 'view-run-compared'])
    expect(sections[0]).toHaveTextContent('Core note')
    expect(sections[0]).toHaveTextContent('Core timing')
    expect(sections[1]).toHaveTextContent(run.most_likely!.text)
    expect(sections[2]).toHaveTextContent('Core comparison')
    why()
    expect(screen.queryByTestId('analysis-why-region')).toBeNull()
  })

  it('omits the fold when Core has no visible reading', () => {
    const view = viewOf('golden/bakery')
    Object.assign(view.model!.run!, { notes: [], timing: [], most_likely: null, compared: [] })
    ready(view); render(<PortAnalysisTab />)
    expect(screen.queryByTestId('analysis-why-toggle')).toBeNull()
  })

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
  it('bakery: the per-option crossing is drawn verbatim with its hover as the one Tip, and the lead crossing is drawn once (WhatMovesIt\'s), not twice', async () => {
    const view = viewOf('golden/bakery'), run = view.model!.run!
    const opt = run.tipping.find((t) => t.kind !== 'lead')!, lead = run.tipping.find((t) => t.kind === 'lead')!
    ready(view); render(<PortAnalysisTab />)
    const box = screen.getByTestId('analysis-tipping')
    const p = box.querySelector<HTMLElement>(`[data-view-fact="${opt.id}"]`)!
    expect(p.querySelector('[data-view^="run.tipping."]')!.textContent).toBe(opt.line)
    expect([p.getAttribute('title'), await tipOf(p.querySelector<HTMLElement>('[data-view^="run.tipping."]')!)]).toEqual([null, opt.hover])
    expect(box.querySelector(`[data-view-fact="${lead.id}"]`)).toBeNull()
    expect([...document.querySelectorAll('span')].filter((e) => e.textContent === lead.line)).toHaveLength(1)
    // Seen at rest (DL 14:0xZ): core's heading is a section heading, not a quiet caption; the figure press is named, never a bare card heading.
    const fig = box.querySelector<HTMLElement>(`[data-tipping-figure="${opt.figure!.id}"]`)!
    expect([box.querySelector('[data-view="run.tipping_heading"]')!.tagName, (fig.getAttribute('aria-label') ?? '').startsWith(`${TIPPING_FIGURE}: `), fig.hasAttribute('title'), fig.querySelectorAll('svg').length]).toEqual(['H3', true, false, 1])
    fireEvent.click(box.querySelector<HTMLElement>(`[data-tipping-figure="${opt.figure!.id}"]`)!)
    expect(focus.node).toHaveBeenCalled()
  })

  it('the figure pencil ends its row\'s own line: inside the same row element as the words, after an inline (never block) figure press', () => {
    const view = viewOf('golden/bakery'), opt = view.model!.run!.tipping.find((t) => t.kind !== 'lead')!
    ready(view); render(<PortAnalysisTab />)
    const row = screen.getByTestId('analysis-tipping').querySelector<HTMLElement>(`[data-view-fact="${opt.id}"]`)!
    const words = row.querySelector<HTMLElement>('[data-view^="run.tipping."]')!, fig = row.querySelector<HTMLElement>('[data-tipping-figure]')!
    const pencil = row.querySelector<HTMLElement>('[data-testid^="analysis-tip-give-"]')!
    expect(pencil, 'the pencil is drawn for this figure').not.toBeNull()
    expect(pencil.closest('[data-view-fact]')).toBe(row)
    expect([words.closest('[data-view-fact]'), fig.closest('[data-view-fact]')]).toEqual([row, row])
    expect(fig.compareDocumentPosition(pencil) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // A block-level press (flex, not inline-flex) would break the row before the pencil: the press is inline-level.
    expect(fig.className.split(/\s+/)).toContain('inline-flex')
    expect(fig.className.split(/\s+/)).not.toContain('flex')
  })

  it('failure: none before the person\'s own reasons (CONTRAST), core\'s lines verbatim after', () => {
    const view = structuredClone(viewOf('golden/bakery'))
    view.model!.run!.failure = [{ id: 'F90', line: 'Core\'s failure sentence.', hover: 'Core\'s failure hover.' }] as never
    const gated = (state: 'closed' | 'chose' | 'wrote') => { const v = structuredClone(view); v.session = { ...v.session, pre_mortem: { ...(v.session.pre_mortem ?? {}), state } } as never; return v }
    for (const s of ['closed', 'chose'] as const) { ready(gated(s)); render(<PortAnalysisTab />); expect(screen.queryByTestId('analysis-failure'), s).toBeNull(); cleanup() }
    ready(gated('wrote')); render(<PortAnalysisTab />)
    const p = screen.getByTestId('analysis-failure').querySelector<HTMLElement>('[data-view-fact="F90"]')!
    // Core's hover carries the count and the limit ("an association only…"): drawn at rest, whole, never hover-only (science lead, 18 Nov).
    expect([p.textContent, p.getAttribute('title'), p.querySelector('[data-view="run.failure.0.hover"]') !== null]).toEqual(['Core\'s failure hover.', null, true])
    // CONTRAST: a line core sends no hover for keeps its line.
    cleanup()
    const bare = gated('wrote'); bare.model!.run!.failure = [{ id: 'F90', line: 'Core\'s failure sentence.', hover: '' }] as never
    ready(bare); render(<PortAnalysisTab />)
    expect(screen.getByTestId('analysis-failure').querySelector('[data-view="run.failure.0.line"]')!.textContent).toBe('Core\'s failure sentence.')
  })

  it('silent reasons: core\'s reason about an aim stands where a lead crossing would; its reason about one option stands under the tipping heading, with core\'s nearest group', () => {
    const view = structuredClone(viewOf('golden/bakery')), run = view.model!.run!
    const AIM = 'Olumi tests no lead on this aim.', OPT = 'Nothing tested takes this option across.', BEST = 'The nearest group reached 40%.'
    run.tipping = []
    run.tipping_aims = [{ aim: 'aim_x', lines: [], silent: [
      { crossing: 'chance', reason: 'never_above', text: 't', line: OPT, option: 'opt_x', best_group: { figure: { id: 'f', label: 'F', whose: 'olumi' }, share: 0.4, text: 't', end: null, line: BEST } },
      { crossing: null, reason: 'not_separated', text: 'Aim hover.', line: AIM },
      { crossing: null, reason: 'unclear', text: 't', line: 'A second aim reason, not drawn: one per aim.' },
    ] }] as never
    ready(view); render(<PortAnalysisTab />)
    const aim = screen.getAllByTestId('analysis-aim-silent')
    expect(aim.map((e) => [e.dataset['silentAim'], e.textContent, e.querySelector('[data-view="run.tipping_aims.0.silent.1.line"]') !== null])).toEqual([['aim_x', AIM, true]])
    // No crossing lines at all, and the option's reason is still drawn, under core's heading, verbatim, with no figure press.
    const box = screen.getByTestId('analysis-tipping'), row = box.querySelector<HTMLElement>('[data-tipping-silent="opt_x"]')!
    expect(box.querySelector('[data-view="run.tipping_heading"]')!.textContent).toBe(run.tipping_heading)
    expect([row.querySelector('[data-view="run.tipping_aims.0.silent.0.line"]')!.textContent, row.querySelector('[data-view="run.tipping_aims.0.silent.0.best_group.line"]')!.textContent, row.querySelectorAll('button').length]).toEqual([OPT, BEST, 0])
    expect(document.body.textContent).not.toContain('A second aim reason')
    // CONTRAST: with no silent reason, neither place is drawn.
    cleanup()
    const none = structuredClone(view); none.model!.run!.tipping_aims = [{ aim: 'aim_x', lines: [], silent: [] }] as never
    ready(none); render(<PortAnalysisTab />)
    expect([screen.queryAllByTestId('analysis-aim-silent').length, screen.queryByTestId('analysis-tipping')]).toEqual([0, null])
  })

  it('silent reasons, the pairs core can send for one aim: a lead reason is drawn once; the leader\'s own chance reason (no option named) is a row; an aim whose lead crossing is drawn gets no aim reason', () => {
    const base = viewOf('golden/bakery'), LEAD = 'None put A clearly ahead of B.', OWN = 'None made it less likely than not that B meets the aim.', BARE = 'No figure can turn this one.'
    // (1) lead + chance on ONE aim (science lead\'s fifth board): the lead reason once, in the lead slot only; the chance reason under the tipping heading.
    const one = structuredClone(base); one.model!.run!.tipping = []
    one.model!.run!.tipping_aims = [{ aim: 'aim_x', lines: [], silent: [
      { crossing: 'lead', reason: 'holds', text: 't', line: LEAD },
      { crossing: 'chance', reason: 'holds', text: 't', line: OWN },
      { crossing: 'chance', reason: 'no_figure', text: 't', line: BARE, option: 'opt_y' },
      { crossing: 'lead', reason: 'holds', text: 't', line: 'A lead reason that names an option is not an option\'s row.', option: 'opt_z' },
    ] }] as never
    ready(one); render(<PortAnalysisTab />)
    const slot = screen.getByTestId('analysis-lead-change')
    expect([slot.dataset['leadChange'], slot.querySelector('[data-view="run.tipping_aims.0.silent.0.line"]')!.textContent, screen.queryAllByTestId('analysis-aim-silent').length]).toEqual(['silent', LEAD, 0])
    expect([...document.querySelectorAll('span')].filter((e) => e.textContent === LEAD)).toHaveLength(1)
    const rows = [...screen.getByTestId('analysis-tipping').querySelectorAll<HTMLElement>('[data-tipping-silent]')]
    // Exactly core\'s two chance reasons, in core\'s order; one with no best group draws its line alone.
    expect(rows.map((r) => [r.dataset['tippingSilent'], r.textContent, r.querySelectorAll('span').length])).toEqual([['', OWN, 1], ['opt_y', BARE, 1]])
    cleanup()
    // (2) an aim WITH a crossing line still gets its other option\'s reason; and the aim whose lead crossing is drawn gets no aim reason beside it.
    const two = structuredClone(base), run = two.model!.run!, lead = run.tipping.find((t) => t.kind === 'lead')!, opt = run.tipping.find((t) => t.kind !== 'lead')!
    run.tipping_aims = [{ aim: lead.aim, lines: [opt.line], silent: [
      { crossing: 'chance', reason: 'never_above', text: 't', line: BARE, option: 'opt_y' },
      { crossing: null, reason: 'unclear', text: 't', line: 'An aim reason beside a drawn lead crossing.' },
    ] }] as never
    ready(two); render(<PortAnalysisTab />)
    const box = screen.getByTestId('analysis-tipping')
    expect([box.querySelector(`[data-view-fact="${opt.id}"]`) !== null, box.querySelector('[data-tipping-silent="opt_y"]')!.textContent]).toEqual([true, BARE])
    expect([screen.getByTestId('analysis-lead-change').dataset['leadChange'], screen.queryAllByTestId('analysis-aim-silent').length]).toEqual(['tipping', 0])
    cleanup()
    // CONTRAST for (2): the same aim reason on ANOTHER aim is drawn.
    const three = structuredClone(two); three.model!.run!.tipping_aims[0]!.aim = 'another_aim'
    ready(three); render(<PortAnalysisTab />)
    expect(screen.getAllByTestId('analysis-aim-silent').map((e) => e.dataset['silentAim'])).toEqual(['another_aim'])
  })

  it('rests: core\'s full sentence is visible text on the tab, once per group, not only a hover', () => {
    const view = viewOf('golden/bakery'), r = view.model!.run!.rests[0]!
    ready(view); render(<ViewReasoningBlock />)
    expect(screen.queryByTestId('reasoning-rests')).toBeNull()
    fireEvent.click(screen.getByTestId('view-reasoning-rests-toggle'))
    const box = screen.getByTestId('reasoning-rests')
    // Core's hover is its line plus what the people's ranges carry and the limit ("not a prediction"): it is the visible sentence, whole.
    expect(r.hover.startsWith(r.line) && r.hover.length > r.line.length, 'fixture: the hover says more than the line').toBe(true)
    expect(box.querySelector(`[data-rest="${r.id}"] [data-view="run.rests.0.hover"]`)!.textContent).toBe(r.hover)
    expect(box.querySelectorAll(`[data-rest="${r.id}"] [data-testid="rests-sentence"]`)).toHaveLength(1)
  })
})

describe('data core sends that the tab drew only as a title or in a fold (A2, A3)', () => {
  it('A3 bakery: each ranking draws core\'s qualification sentence verbatim at its path, at rest, and none of the bare scope lists (core sends no word for which list is which); each figure\'s estimate size is in its row, not only a title', () => {
    const view = structuredClone(viewOf('golden/bakery')), run = view.model!.run!, aims = run.find_out!.filter((a) => a.figures.length > 0)
    expect(aims.length).toBeGreaterThan(0)
    aims.forEach((aim, n) => { aim.line = `Core's qualification ${n}.`; aim.not_compared = [{ id: 'x1', label: 'Opening a second shop' }]; aim.within = [{ id: 'l1', label: 'Rent limit' }] })
    ready(view); render(<PortAnalysisTab />)
    for (const aim of aims) {
      const i = run.find_out!.indexOf(aim)
      const box = document.querySelector(`[data-find-out-aim="${aim.aim}"]`)!
      const scope = box.querySelector('[data-testid="find-out-scope"]')!
      expect([scope.textContent, scope.getAttribute('data-view')]).toEqual([aim.line, `run.find_out.${i}.line`])
      expect(box.querySelector('[data-find-out-scope]'), 'no scope list is drawn: no invented word says which list it is').toBeNull()
      expect(box.textContent!.includes('Opening a second shop') || box.textContent!.includes('Rent limit')).toBe(false)
      for (const f of aim.figures) expect(box.querySelector(`[data-find-out-figure="${f.id}"]`)!.textContent).toContain(f.estimate_text)
    }
  })
  it('A3 the registry holds no scope icon and the tab names none: "Compared", "Not compared" and "Held within" are not words of the UI', () => {
    const view = viewOf('golden/bakery')
    ready(view); render(<PortAnalysisTab />)
    expect(Object.keys(ICONS).filter((k) => k.startsWith('scope-'))).toEqual([])
    const said = tab().textContent ?? ''
    for (const w of ['Not compared', 'Held within']) expect(said.includes(w), w).toBe(false)
  })
  it('A3 CONTRAST: a ranking with no qualification draws no scope line at all', () => {
    const view = structuredClone(viewOf('golden/bakery')), aim = view.model!.run!.find_out!.find((a) => a.figures.length > 0)!
    aim.compared = []; aim.not_compared = []; aim.within = []; aim.line = ''
    ready(view); render(<PortAnalysisTab />)
    expect(document.querySelector(`[data-find-out-aim="${aim.aim}"] [data-testid="find-out-scope"]`)).toBeNull()
  })
  it('A3 science: a worth line\'s estimate size (`science[].hover`) is drawn whole in its row, bound to its path, and no native title carries it', () => {
    const view = structuredClone(viewOf('golden/bakery')), run = view.model!.run!
    const worth = (run.science ?? []).findIndex((l) => (l.hover ?? '') !== '')
    expect(worth, 'fixture: a science line with a hover').toBeGreaterThanOrEqual(0)
    run.find_out = []                       // so the ranking does not already name it
    ready(view); render(<PortAnalysisTab />)
    const el = document.querySelector(`[data-view="run.science.${worth}.hover"]`)
    expect(el?.textContent).toBe(run.science![worth]!.hover)
    expect(el!.closest('li')!.getAttribute('title')).toBeNull()
  })
  it('A2 bakery (a chance; the none state is pinned in the no-chance test above): core\'s notes are one quiet list in the fold, each verbatim at its path; under the chart when there is one', () => {
    const view = viewOf('golden/bakery'), notes = (view.model!.run!.notes ?? []).filter((n) => n.text !== '')
    expect(notes.length).toBeGreaterThan(0)
    ready(view); render(<PortAnalysisTab />)
    expect(screen.queryByTestId('analysis-leaves-out')).toBeNull()
    why()
    const list = screen.getByTestId('analysis-leaves-out')
    expect([...list.querySelectorAll('li')].map((e) => e.textContent)).toEqual(notes.map((n) => n.text))
    expect(screen.getByTestId('analysis-chance-chart').compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING, 'under the chart').toBeTruthy()
    expect(document.querySelectorAll('[data-view^="run.notes."]'), 'notes are drawn once').toHaveLength(notes.length)
  })
  it('A2 a note\'s longer words (its title) reach the one Tip by REAL keyboard focus, never a native title; a note whose title is its text is not a focus stop; no heading is written here', () => {
    vi.useFakeTimers()
    try {
      const view = structuredClone(viewOf('golden/bakery')), run = view.model!.run!
      run.notes = [{ text: 'It leaves out rent.', title: 'It leaves out rent, which core could not size.' }, { text: 'It assumes a steady summer.', title: 'It assumes a steady summer.' }] as typeof run.notes
      ready(view); render(<PortAnalysisTab />)
      why()
      const [first, second] = [...screen.getByTestId('analysis-leaves-out').querySelectorAll<HTMLElement>('li')] as [HTMLElement, HTMLElement]
      expect([first.getAttribute('title'), second.getAttribute('title'), first.tabIndex, second.hasAttribute('tabindex')]).toEqual([null, null, 0, false])
      act(() => { first.focus() })
      expect(document.activeElement, 'the note itself is the keyboard stop').toBe(first)
      act(() => { vi.advanceTimersByTime(200) })
      expect(screen.getByTestId('lane-tip').textContent).toBe(run.notes[0]!.title)
      expect(screen.getByTestId('analysis-leaves-out').querySelector('h3'), 'no invented heading').toBeNull()
    } finally { vi.useRealTimers() }
  })
})
