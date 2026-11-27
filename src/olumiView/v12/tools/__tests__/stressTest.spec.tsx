import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasStore } from '../../../../canvas/store'
import { call } from '../../../../olumiCore/team/api'
import type { View, ViewLink, ViewRow } from '../../../client'
import studio from '../../../fixtures/cardface/studio.view3.json'
import pricing from '../../../fixtures/core-d4729b77/pricing.view3.json'
import revealed from '../../../fixtures/disagree/x2-revealed.view3.json'
import capturedTrial from '../../../fixtures/v11/consulting-whatif-priya.json'
import mechanic from '../../../port/__tests__/fixtures/ui9-a6-since-v3.view3.json'
import { pressCard, ringFrom } from '../../../reasoning/tabRing'
import { useViewStore } from '../../../store'
import { clearWhatIf, useWhatIf, type WhatIfVariant } from '../../../whatif'
import bakery from '../../__tests__/fixtures/issue7-e499eff6-bakery-asked.view3.json'
import { useLaneInspector } from '../../edit/inspectorStore'
import { StressTest, StressTestTab, STRESS_STEPS, STRESS_WORDS } from '../StressTest'
import { useStressTrials } from '../stressTrials'
import { WHAT_IF_SLIDER_WORDS } from '../WhatIfSlider'
import { installCanvasFocus } from '../../../focus/canvas'
import { useStoredFocusSubject } from '../../../focus/state'

// The canvas mounts the shared focus subject in the app (ViewCanvas); these specs mount it the same way.
let uninstallFocus: () => void = () => {}
beforeEach(() => { useStoredFocusSubject.setState({ subject: null }); uninstallFocus = installCanvasFocus() })
afterEach(() => { uninstallFocus() })

vi.mock('../../../reasoning/tabRing', () => ({ pressCard: vi.fn(), ringFrom: vi.fn() }))
vi.mock('../../../../olumiCore/team/api', async (original) => ({
  ...await original<typeof import('../../../../olumiCore/team/api')>(), call: vi.fn(),
}))

type ChanceRow = Extract<ViewRow, { kind: 'chance' }>
const base = pricing as unknown as View
const revealedView = revealed as unknown as View
const cups = base.model!.cards.find((card) => card.id === 'cups_change')!
const target = base.model!.cards.find((card) => card.id === 'profit_target')!
const raise = base.model!.cards.find((card) => card.id === 'raise_price')!
const keep = base.model!.cards.find((card) => card.id === 'carry_on')!
const raiseRow = raise.rows.find((row): row is ChanceRow => row.kind === 'chance')!
const keepRow = keep.rows.find((row): row is ChanceRow => row.kind === 'chance')!
const secondAim = { aim_id: 'annual_profit', aim: 'Increase annual profit' }
const raiseSecond: ChanceRow = {
  ...raiseRow, ...secondAim, value: 'About a 60% chance', title: 'Annual profit basis',
  chance: 0.601, driver: { figure: cups.id, low: 0.22, high: 0.83 },
}
const keepFirst: ChanceRow = {
  ...keepRow, value: 'About a 30% chance', fixed: false, chance: 0.321,
  driver: { figure: target.id, low: 0.61, high: 0.13 },
}
const keepSecond: ChanceRow = { ...keepRow, ...secondAim, driver: null }
const view: View = {
  ...base,
  model: {
    ...base.model!,
    cards: base.model!.cards.map((card) => card.id === raise.id ? { ...card, rows: [raiseRow, raiseSecond] }
      : card.id === keep.id ? { ...card, rows: [keepFirst, keepSecond] }
      : card.id === target.id ? { ...card, figure: { ...target.figure!, range: undefined } } : card),
  },
}

const draw = (fixture = view) => render(<StressTest model={fixture.model!} view={fixture} />)
const radio = (step: keyof typeof STRESS_STEPS) => screen.getByRole('radio', { name: STRESS_STEPS[step] })
const picker = () => screen.getByRole('group', { name: STRESS_WORDS.figure })
const figureChoice = (name: string) => within(picker()).getByRole('button', { name })
const optionRows = (heading: string) => screen.getAllByRole('button', { name: (name) => name.startsWith(heading) })
const aimGroups = (name: string) => screen.getAllByRole('group', { name }).filter((group) => group.closest('details') === null)
const dashedTrack = (row: HTMLElement) => row.querySelector('.ok-face-mark.ok-face-mark-track')
const figureHeadings = (tool: HTMLElement) => within(tool).getAllByRole('listitem').map((row) => row.firstElementChild?.textContent)

function expectChart(row: HTMLElement, chance: number) {
  expect(row).toHaveAttribute('data-stress-computed', 'true')
  expect(row).toHaveAttribute('data-stress-chance', String(chance))
  const current = row.querySelector('[data-stress-reading="step"]')!
  expect(current.querySelectorAll('[data-chance-dot="filled"]')).toHaveLength(Math.round(chance * 10))
  expect(current.querySelectorAll('[data-chance-dot]')).toHaveLength(10)
}

function expectSavedPair(row: HTMLElement, saved: number) {
  const [before, after] = row.querySelectorAll('[data-stress-reading]')
  expect(before).toHaveAttribute('data-stress-reading', 'saved')
  expect(after).toHaveAttribute('data-stress-reading', 'step')
  expect(before.querySelectorAll('[data-chance-dot="filled"]')).toHaveLength(Math.round(saved * 10))
  expect(within(row).getByText(STRESS_WORDS.savedLabel)).toBeVisible()
}

beforeEach(() => { vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unexpected network request'))) })
afterEach(() => {
  cleanup()
  useViewStore.setState({ view: null, sid: null, status: 'none', stale: false, error: null })
  useCanvasStore.setState({ selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null } })
  useLaneInspector.setState({ current: null })
  useStressTrials.setState({ histories: new Map() })
  clearWhatIf()
  expect(fetch).not.toHaveBeenCalled()
  vi.unstubAllGlobals()
  vi.mocked(call).mockReset()
  vi.clearAllMocks()
})

describe('Stress-test', () => {
  it('moves only the selected record’s rows across the three readings with a single range track', () => {
    draw()
    expect(screen.getByTestId('tool-stress')).toHaveAttribute('data-form', 'TT-stress')
    expect(screen.getByTestId('tool-stress')).toHaveAttribute('data-stress-unlabelled', '0')
    expect(figureChoice(cups.heading)).toHaveAttribute('aria-pressed', 'true')
    expect(within(picker()).getAllByRole('button').map((option) => option.textContent)).toEqual([cups.heading, target.heading])
    for (const name of [raiseRow.aim, secondAim.aim]) {
      const [group] = aimGroups(name)
      expect(group).toHaveAttribute('aria-labelledby', within(group).getByRole('heading', { name }).id)
      expect(within(group).getAllByRole('button')).toHaveLength(2)
    }
    expect(screen.getByText(cups.figure!.text)).toBeVisible()

    const [raiseProfit, raiseAnnual] = optionRows(raise.heading)
    const [keepProfit, keepAnnual] = optionRows(keep.heading)
    expect(raiseProfit.querySelector('[data-letter-chip]')).toHaveTextContent('A')
    expect(raiseProfit.querySelector('[data-letter-chip]')?.closest('.olumi-look.contents')).toBeInTheDocument()
    expect(keepProfit.querySelector('[data-letter-chip]')).toHaveTextContent('B')
    const slider = screen.getByRole('slider', { name: WHAT_IF_SLIDER_WORDS.label })
    const { low, high } = cups.figure!.range!
    expect(screen.queryByTestId('range-band')).toBeNull()
    expect(radio('saved')).toBeChecked()
    for (const step of ['saved', 'low', 'high'] as const) {
      fireEvent.click(radio(step))
      expectChart(raiseProfit, step === 'saved' ? raiseRow.chance! : raiseRow.driver![step])
      expectChart(raiseAnnual, step === 'saved' ? raiseSecond.chance! : raiseSecond.driver![step])
      if (step !== 'saved') {
        expectSavedPair(raiseProfit, raiseRow.chance!)
        expectSavedPair(raiseAnnual, raiseSecond.chance!)
      } else expect(raiseProfit.querySelectorAll('[data-chance-dots]')).toHaveLength(1)
      expect(slider).toHaveAttribute('min', String(low))
      expect(slider).toHaveAttribute('max', String(high))
      expect(screen.queryByTestId('range-tried')).toBeNull()
      for (const [row, value, kind] of [[keepProfit, keepFirst.value, 'other'], [keepAnnual, keepSecond.value, 'none']] as const) {
        expect(row).toHaveAttribute('data-stress-computed', kind)
        expect(row).not.toHaveAttribute('data-stress-chance')
        expect(row.querySelector('[data-chance-dots]')).toBeNull()
        expect(within(row).getByText(value)).toHaveClass('text-text-light')
      }
    }

    fireEvent.click(figureChoice(target.heading))
    expect(screen.getByText(target.figure!.text)).toBeVisible()
    expect(screen.queryByTestId('range-bar')).toBeNull()
    for (const step of ['low', 'saved', 'high'] as const) {
      fireEvent.click(radio(step))
      expectChart(keepProfit, step === 'saved' ? keepFirst.chance! : keepFirst.driver![step])
      if (step !== 'saved') expect(within(keepProfit).queryByText(keepFirst.value)).toBeNull()
    }
    expect(raiseProfit).toHaveAttribute('data-stress-computed', 'other')
    expect(raiseAnnual).toHaveAttribute('data-stress-computed', 'other')
    expect(raiseProfit.querySelector('[data-chance-dots]')).toBeNull()
  })

  it('uses Core’s words at rest, and puts the saved words in the fold for the conditional steps', async () => {
    draw()
    const [row, annualRow] = optionRows(raise.heading)
    expect(within(row).getByText(raiseRow.value)).toBeVisible()
    const details = screen.getByText(STRESS_WORDS.details).closest('details')!
    expect(details).not.toHaveAttribute('open')

    fireEvent.click(radio('low'))
    expect(within(row).queryByText(raiseRow.value)).toBeNull()
    expect(row).toHaveTextContent(raise.heading)
    expect(within(details).getByText(raiseRow.value)).not.toBeVisible()
    fireEvent.click(screen.getByText(STRESS_WORDS.details))
    expect(within(details).getByText(raiseRow.value)).toBeVisible()
    expect(within(details).getAllByText(STRESS_WORDS.savedLabel)).toHaveLength(2)
    expect(within(details).getAllByText(cups.heading)).toHaveLength(2)
    expect(within(details).getByText(raiseRow.title)).toBeVisible()
    expect(within(details).getByText(raiseSecond.title)).toBeVisible()
    for (const reading of [raiseRow, raiseSecond]) {
      const group = within(details).getByRole('group', { name: reading.aim })
      expect(within(group).getByRole('heading', { name: reading.aim })).toBeVisible()
      expect(within(group).getByRole('listitem')).toHaveTextContent(reading.title)
    }

    const words = new Set([
      ...Object.values(STRESS_STEPS), ...Object.values(STRESS_WORDS), ...Object.values(WHAT_IF_SLIDER_WORDS),
      cups.heading, target.heading, cups.figure!.text, cups.author!.title, raise.heading, keep.heading,
      raiseRow.aim, secondAim.aim, raiseRow.value, raiseSecond.value, keepFirst.value, keepSecond.value,
      raiseRow.title, raiseSecond.title, 'A', 'B',
    ])
    function expectOnlyViewAndChrome() {
      const walker = document.createTreeWalker(screen.getByTestId('tool-stress'), NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) expect(words).toContain(walker.currentNode.textContent)
    }
    for (const step of ['low', 'saved', 'high'] as const) {
      fireEvent.click(radio(step))
      expect(details).toHaveAttribute('open')
      if (step !== 'saved') {
        expect(within(row).queryByText(raiseRow.value)).toBeNull()
        expect(within(annualRow).queryByText(raiseSecond.value)).toBeNull()
        expect(within(details).getByText(raiseRow.value)).toBeVisible()
        expect(within(details).getByText(raiseSecond.value)).toBeVisible()
      }
      expectOnlyViewAndChrome()
      fireEvent.click(screen.getByText(STRESS_WORDS.details))
      expect(details).not.toHaveAttribute('open')
      expectOnlyViewAndChrome()
      fireEvent.click(screen.getByText(STRESS_WORDS.details))
    }

    const [other, none] = optionRows(keep.heading)
    act(() => other.focus())
    expect((await screen.findByRole('tooltip')).textContent).toBe(STRESS_WORDS.other)
    act(() => none.focus())
    expect(STRESS_WORDS.none).toBe('Olumi names no figure for this option here')
    expect((await screen.findByRole('tooltip')).textContent).toBe(STRESS_WORDS.none)
    act(() => screen.getByText(cups.figure!.text).focus())
    expect((await screen.findByRole('tooltip')).textContent).toBe(cups.figure!.title)
  })

  it('moves keyboard focus with the step, points at the figure and moving options, and clears its ring', () => {
    const { unmount } = draw()
    expect(ringFrom).toHaveBeenLastCalledWith('tool-stress', [cups.id, raise.id])
    const saved = radio('saved')
    act(() => saved.focus())
    fireEvent.keyDown(saved, { key: 'ArrowLeft' })
    expect(radio('low')).toHaveFocus()
    expect(radio('low')).toBeChecked()
    expect(saved).toHaveAttribute('tabindex', '-1')
    fireEvent.keyDown(radio('low'), { key: 'ArrowUp' })
    expect(radio('high')).toHaveFocus()
    expect(radio('high')).toBeChecked()
    expectChart(optionRows(raise.heading)[0], raiseRow.driver!.high)

    fireEvent.click(figureChoice(target.heading))
    expect(ringFrom).toHaveBeenLastCalledWith('tool-stress', [target.id, keep.id])
    fireEvent.click(optionRows(keep.heading)[0])
    expect(pressCard).toHaveBeenCalledWith(keep.id)
    unmount()
    expect(ringFrom).toHaveBeenLastCalledWith('tool-stress', [])
  })

  it('offers every resolved folded driver and distinguishes records sharing a heading by ordinal', () => {
    const firstRecord = 'folded_cups'
    const secondRecord = 'folded_target'
    const rest = view.model!.run!.rests[0]
    const firstFigure = { ...rest.figures![0], id: firstRecord, label: 'Cups lost after the price change' }
    const folded: View = {
      ...view,
      model: {
        ...view.model!,
        run: { ...view.model!.run!, rests: [] },
        cards: view.model!.cards.map((card) => {
          if (card.id === cups.id) return {
            ...card,
            badge: { records: [secondRecord, firstRecord], text: '', title: '', label: '', open: false, proposed: false, change: '', words: '', face: '', icon: '' },
          }
          if (card.id === raise.id) return {
            ...card,
            rows: [
              { ...raiseRow, driver: { ...raiseRow.driver!, figure: firstRecord } },
              { ...raiseSecond, aim: raiseRow.aim, driver: { ...raiseSecond.driver!, figure: secondRecord } },
            ],
          }
          if (card.id === keep.id) return { ...card, rows: [{ ...keepFirst, driver: { ...keepFirst.driver!, figure: secondRecord } }] }
          return card
        }),
      },
    }
    const { rerender } = draw(folded)
    const firstChoice = figureChoice(`${cups.heading} 1`)
    const secondChoice = figureChoice(`${cups.heading} 2`)
    expect(within(picker()).getAllByRole('button')).toEqual([firstChoice, secondChoice])
    for (const [choice, ordinal] of [[firstChoice, '1'], [secondChoice, '2']] as const) {
      expect(within(choice).getByText(cups.heading).textContent).toBe(cups.heading)
      expect(choice.querySelector('[data-stress-ordinal]')?.textContent).toBe(ordinal)
    }
    expect(screen.getByTestId('tool-stress')).toHaveAttribute('data-stress-unlabelled', '2')
    const groups = aimGroups(raiseRow.aim)
    expect(new Set(groups.map((group) => group.getAttribute('aria-labelledby'))).size).toBe(2)
    expect(screen.queryByText(cups.figure!.text)).toBeNull()
    expect(screen.queryByTestId('range-bar')).toBeNull()
    const [first, second] = optionRows(raise.heading)
    const [keepProfit] = optionRows(keep.heading)
    expect(firstChoice).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(radio('low'))
    expect(first).toHaveAttribute('data-stress-computed', 'other')
    expectChart(second, raiseSecond.driver!.low)
    expectChart(keepProfit, keepFirst.driver!.low)
    expect(ringFrom).toHaveBeenLastCalledWith('tool-stress', [cups.id, keep.id, raise.id])

    fireEvent.click(secondChoice)
    expectChart(first, raiseRow.driver!.low)
    expect(second).toHaveAttribute('data-stress-computed', 'other')
    expect(keepProfit).toHaveAttribute('data-stress-computed', 'other')
    expect(ringFrom).toHaveBeenLastCalledWith('tool-stress', [cups.id, raise.id])

    const labelled = { ...folded.model!, run: { ...folded.model!.run!, rests: [{ ...rest, figures: [firstFigure] }] } }
    rerender(<StressTest model={labelled} view={{ ...folded, model: labelled }} />)
    expect(figureChoice(`${cups.heading} 1`)).toBeVisible()
    expect(figureChoice(`${firstFigure.label} 2`)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('tool-stress')).toHaveAttribute('data-stress-unlabelled', '1')
    fireEvent.click(screen.getByText(STRESS_WORDS.details))
    const details = screen.getByText(STRESS_WORDS.details).closest('details')!
    expect(within(details).getByText(firstFigure.label)).toBeVisible()
    expect(within(details).queryByText(cups.heading)).toBeNull()
  })

  it.each([
    { removed: cups, fallback: target, option: keep, row: keepFirst },
    { removed: target, fallback: cups, option: raise, row: raiseRow },
  ])('keeps the fallback selection when $removed.heading returns on a later refresh', ({ removed, fallback, option, row }) => {
    const { rerender } = draw()
    fireEvent.click(figureChoice(removed.heading))
    const refreshed = {
      ...view.model!,
      cards: view.model!.cards.map((card) => ({
        ...card,
        rows: card.rows.map((row) => row.kind === 'chance' && row.driver?.figure === removed.id
          ? { ...row, driver: null } : row),
      })),
    }
    rerender(<StressTest model={refreshed} view={{ ...view, model: refreshed }} />)
    expect(figureChoice(fallback.heading)).toHaveAttribute('aria-pressed', 'true')
    rerender(<StressTest model={view.model!} view={view} />)
    expect(figureChoice(removed.heading)).toHaveAttribute('aria-pressed', 'false')
    expect(figureChoice(fallback.heading)).toHaveAttribute('aria-pressed', 'true')
    expectChart(optionRows(option.heading)[0], row.chance!)
  })

  it('offers a fill action for the mechanic-time figure that Results needs', () => {
    const fixture = mechanic as unknown as View
    useViewStore.setState({ view: fixture, sid: fixture.id, status: 'ready' })
    render(<StressTestTab />)
    const tool = screen.getByTestId('tool-stress')
    const row = within(tool).getByText('Stop taking e-bike jobs: how many Average mechanic time per job taken').closest('li')!
    expect(dashedTrack(row)).toBeEmptyDOMElement()
    fireEvent.click(within(row).getByRole('button', { name: STRESS_WORDS.fill }))
    expect(useLaneInspector.getState().current).toMatchObject({
      kind: 'details', edit: 'value', target: { kind: 'card', id: 'average_mechanic_time_per_job_taken_changed_stop_taking_e_bike_j' },
    })
  })

  it('draws a typed flat range with empty text and offers a fill action only for the unsized figure', () => {
    const model = revealedView.model!
    const ids = ['existing_capacity', 'per_specialist', 'total_capacity']
    const mixed: View = {
      ...revealedView,
      model: {
        ...model,
        cards: model.cards.filter((card) => ids.includes(card.id)).map((card) => {
          if (card.id === 'existing_capacity') return { ...card, figure: { ...card.figure!, text: '' } }
          if (card.id === 'per_specialist') return { ...card, figure: { ...card.figure!, text: '', range: { low: 20, likely: 20, high: 20, unit: 'ticket/week/specialist' } } }
          return card
        }),
        links: model.links.filter((link) => ids.includes(link.from) && ids.includes(link.to)).map((link) => ({ ...link, role: 'input' })),
      },
    }
    useViewStore.setState({ view: mixed, sid: mixed.id, status: 'ready' })
    render(<StressTestTab />)
    const tool = screen.getByTestId('tool-stress')
    expect(figureHeadings(tool)).toEqual(['existing capacity', 'per specialist'])
    const [unsized, sized] = within(tool).getAllByRole('listitem')
    expect(within(sized).getByTestId('range-point')).toBeVisible()
    expect(dashedTrack(sized)).toBeNull()
    expect(within(sized).queryByRole('button', { name: STRESS_WORDS.fill })).toBeNull()

    expect(dashedTrack(unsized)).toBeEmptyDOMElement()
    expect(within(unsized).queryByTestId('range-bar')).toBeNull()
    const fill = within(unsized).getByRole('button', { name: STRESS_WORDS.fill })
    act(() => fill.focus())
    expect(ringFrom).toHaveBeenLastCalledWith('tool-stress', ['existing_capacity'])
    fireEvent.click(fill)
    expect(useLaneInspector.getState().current).toMatchObject({ kind: 'details', edit: 'value', target: { kind: 'card', id: 'existing_capacity' } })
  })

  it('excludes calculated Spend and keeps the dashed waiting state when Core declares it an input', () => {
    const fixture = bakery as unknown as View
    const { rerender } = draw(fixture)
    const tool = screen.getByTestId('tool-stress')
    expect(within(tool).queryByText('Spend', { exact: true })).toBeNull()
    const model = {
      ...fixture.model!,
      cards: fixture.model!.cards.map((card) => card.id === 'spend' ? { ...card, kind: 'driver' as const } : card),
    }
    rerender(<StressTest view={{ ...fixture, model }} model={model} />)
    const spend = within(tool).getByText('Spend', { exact: true }).closest('li')!
    expect(dashedTrack(spend)).toBeEmptyDOMElement()
    expect(within(spend).queryByText('waits on: oven price')).toBeNull()
    expect(within(spend).queryByRole('button', { name: STRESS_WORDS.fill })).toBeNull()
    fireEvent.click(within(spend).getByRole('button', { name: 'Spend' }))
    expect(tool).toHaveTextContent(WHAT_IF_SLIDER_WORDS.ineligible)
  })

  it('keeps the held proposal’s linked figures visible with their edits withdrawn', async () => {
    const model = revealedView.model!
    const roles: Record<string, ViewLink['role']> = {
      existing_capacity: 'reason', per_specialist: 'input', one_specialist: 'input', total_capacity: 'measures', capacity_target: 'target',
    }
    const held: View = {
      ...revealedView,
      proposal: { id: 1, base: revealedView.version!.id, heading: 'Proposed model', on: '', removed: null, problem: null, marks: [], changes: [], groups: null, from: null },
      model: {
        ...model,
        edit_base: null,
        cards: model.cards.map((card) => {
          if (card.id === 'one_specialist') return { ...card, figure: null }
          return card.figure == null ? card : { ...card, figure: { ...card.figure, edit: null } }
        }),
        links: model.links.map((link) => ({ ...link, role: roles[link.from] })),
      },
    }
    useViewStore.setState({ view: held, sid: held.id, status: 'ready' })
    render(<StressTestTab />)
    const tool = screen.getByTestId('tool-stress')
    expect(figureHeadings(tool)).toEqual(['per specialist', 'one specialist', 'capacity target'])
    const [sized, unsized] = within(tool).getAllByRole('listitem')
    const value = within(sized).getByText('10 to 30 tickets/week/specialist')
    act(() => value.focus())
    expect((await screen.findByRole('tooltip')).textContent).toBe('Plausible range: 10 to 30 tickets/week/specialist, most likely 20 tickets/week/specialist')
    expect(dashedTrack(unsized)).toBeEmptyDOMElement()
    expect(within(tool).queryByRole('button')).toBeNull()
    expect(tool).not.toHaveTextContent(STRESS_WORDS.empty)
  })

  it('draws x2’s figures once Core types the inputs, even with a chance and no driver', () => {
    const model = revealedView.model!
    const roles: Record<string, ViewLink['role']> = {
      existing_capacity: 'input', per_specialist: 'input', one_specialist: 'input', capacity_target: 'target',
    }
    draw({ ...revealedView, model: { ...model, links: model.links.map((link) => ({ ...link, role: roles[link.from] })) } })
    const tool = screen.getByTestId('tool-stress')
    expect(figureHeadings(tool)).toEqual(['existing capacity', 'per specialist', 'one specialist', 'capacity target'])
    expect(within(tool).getByText('10 to 30 tickets/week/specialist')).toBeVisible()
    expect(tool).not.toHaveTextContent(STRESS_WORDS.empty)
    expect(within(tool).queryByRole('radiogroup')).toBeNull()
  })

  it('draws the figures Results names in Studio when there is no driver', () => {
    draw(studio as unknown as View)
    const tool = screen.getByTestId('tool-stress')
    expect(figureHeadings(tool)).toContain('How members feel')
    expect(tool).not.toHaveTextContent(STRESS_WORDS.empty)
    expect(within(tool).queryByRole('radiogroup')).toBeNull()
  })

  it('draws each figure named by a row basis or run rest, including records folded into cards', () => {
    const model = base.model!
    const rest = model.run!.rests[0]!
    const margin = model.cards.find((card) => card.id === 'margin')!
    const raised = model.cards.find((card) => card.id === 'margin_raised')!
    const folded = 'folded-margin'
    draw({
      ...base,
      model: {
        ...model,
        links: [],
        run: { ...model.run!, rests: [rest] },
        cards: model.cards.map((card) => {
          if (card.id === cups.id) return { ...card, worth_checking: [] }
          if (card.id === raised.id) return {
            ...card,
            badge: { records: [folded], text: '', title: '', label: '', open: false, proposed: false, change: '', words: '', face: '', icon: '' },
          }
          if (card.id === raise.id) return { ...card, rows: [{
            ...raiseRow, driver: null,
            rests_on: { reading: false, target: false, estimates: [folded], approx: [margin.id], what_ifs: [target.id] },
          }] }
          return card
        }),
      },
    })
    const tool = screen.getByTestId('tool-stress')
    expect(figureHeadings(tool)).toEqual([margin.heading, raised.heading, cups.heading, target.heading])
    expect(tool).not.toHaveTextContent(STRESS_WORDS.empty)
  })

  it('shows the empty line when the capture has only untyped links and no other typed figure source', () => {
    draw(revealedView)
    expect(screen.getByTestId('tool-stress').textContent).toBe(STRESS_WORDS.empty)
  })

  it('retargets to the selected canvas figure and returns keyboard focus to the computed points', () => {
    // The focus subject (lane B's signature) belongs to the open scenario and its shown model.
    useViewStore.setState({ sid: view.id, view, status: 'ready', stale: false, error: null })
    draw()
    fireEvent.click(radio('high'))
    act(() => useCanvasStore.setState({ selection: { nodeIds: new Set([target.id]), edgeIds: new Set(), anchorPosition: null } }))
    expect(figureChoice(target.heading)).toHaveAttribute('aria-pressed', 'true')
    expect(radio('saved')).toBeChecked()
    expect(radio('saved')).toHaveFocus()
    expect(ringFrom).toHaveBeenLastCalledWith('tool-stress', [target.id, keep.id])
    fireEvent.click(figureChoice(cups.heading))
    expect(figureChoice(cups.heading)).toHaveAttribute('aria-pressed', 'true')
  })

  it('steps through answered trials and uses only Core’s point and matching option-and-goal chances', async () => {
    const capture = capturedTrial.variants[0]
    const input = capture.facts.find((fact) => fact.about?.kind === 'input')!
    const fact = capture.facts.find((fact) => fact.about?.kind === 'chance')!
    const pointWords = 'Set cups change to about five hundred fewer cups.'
    const rangeWords = 'Set cups change to a range.'
    const variant = {
      ...capture, edits: [{ quantity: cups.id, label: cups.heading, words: pointWords }],
      facts: [
        { ...input, about: { kind: 'input', quantity: target.id, olumi: false, likely: 326 } },
        { ...input, about: { kind: 'input', quantity: cups.id, olumi: false, likely: -500 } },
        { ...fact, about: { kind: 'chance', option: keep.id, goal: raiseRow.aim_id, chance: 0.99 } },
        { ...fact, about: { kind: 'chance', option: raise.id, goal: raiseSecond.aim_id, chance: 0.22 } },
        { ...fact, about: { kind: 'chance', option: raise.id, goal: raiseRow.aim_id, chance: 0.77 } },
      ],
    }
    vi.mocked(call).mockResolvedValueOnce({ ...capturedTrial, variants: [variant] }).mockResolvedValueOnce({
      ...capturedTrial,
      variants: [{ ...variant, edits: [{ ...variant.edits[0], words: rangeWords }],
        facts: [
          { ...input, about: { kind: 'input', quantity: cups.id, olumi: false, low: -800, high: -200 } },
          { ...fact, about: { kind: 'chance', option: raise.id, goal: raiseRow.aim_id, chance: 0.31 } },
        ],
      }],
    })
    const { rerender } = draw()
    const [profit, annual] = optionRows(raise.heading)
    const [other] = optionRows(keep.heading)
    const field = screen.getByRole('textbox', { name: STRESS_WORDS.tryValue })
    const submit = () => fireEvent.click(screen.getByRole('button', { name: STRESS_WORDS.try }))
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    const typed = '  500 fewer cups  '
    fireEvent.change(field, { target: { value: typed } })
    submit()
    const point = await screen.findByRole('radio', { name: pointWords })
    expect(call).toHaveBeenNthCalledWith(1, 'POST', `/api/scenarios/${view.id}/whatif`, {
      base: view.model!.edit_base, variants: [{ edits: [{ quantity: cups.id, typed }] }],
    })
    expect(point).toBeChecked()
    expect(screen.queryByTestId('range-bar')).toBeNull()
    expectChart(profit, 0.77)
    expectChart(annual, 0.22)
    expectSavedPair(profit, raiseRow.chance!)
    expect(other.querySelector('[data-chance-dots]')).toBeNull()
    expect(within(profit).queryByText(raiseRow.value)).toBeNull()

    fireEvent.change(field, { target: { value: '-800 to -200' } })
    submit()
    const range = await screen.findByRole('radio', { name: rangeWords })
    expect(range).toBeChecked()
    expect(screen.getAllByRole('radio').slice(-2)).toEqual([point, range])
    expect(screen.queryByTestId('range-tried')).toBeNull()
    expectChart(profit, 0.31)
    expectSavedPair(annual, raiseSecond.chance!)
    expect(annual.querySelector('[data-stress-reading="step"] [data-chance-dots]')).toBeNull()
    fireEvent.keyDown(range, { key: 'ArrowLeft' })
    expect(point).toBeChecked()
    expect(point).toHaveFocus()
    expect(screen.queryByTestId('range-bar')).toBeNull()

    fireEvent.click(figureChoice(target.heading))
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    fireEvent.click(figureChoice(cups.heading))
    expect(screen.getAllByRole('radio')).toHaveLength(5)
    const revised = { ...view.model!, edit_base: view.model!.edit_base! + 1 }
    rerender(<StressTest model={revised} view={{ ...view, model: revised }} />)
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.queryByTestId('range-tried')).toBeNull()
    rerender(<StressTest model={view.model!} view={{ ...view, id: 's_000000000002' }} />)
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    const past = { ...view.model!, edit_base: null }
    rerender(<StressTest model={past} view={{ ...view, model: past }} />)
    expect(screen.getAllByRole('radio')).toHaveLength(5)
    expect(screen.queryByRole('textbox', { name: STRESS_WORDS.tryValue })).toBeNull()
  })

  it('ignores an out-of-order answer for a former figure and leaves the shared lens untouched', async () => {
    const capture = capturedTrial.variants[0]
    const shown = { sid: view.id, base: view.model!.edit_base!, quantity: cups.id, typed: '-600',
      variant: capture as unknown as WhatIfVariant }
    useWhatIf.setState({ shown })
    const lensChanged = vi.fn()
    const unsubscribe = useWhatIf.subscribe(lensChanged)
    const wordsA = 'First figure edit'
    const wordsB = 'Second figure edit'
    const answer = (quantity: string, label: string, words: string) => ({
      ...capturedTrial, variants: [{ ...capture, edits: [{ quantity, label, words }] }],
    })
    let finishA!: (value: unknown) => void
    let finishB!: (value: unknown) => void
    vi.mocked(call).mockImplementationOnce(() => new Promise((resolve) => { finishA = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { finishB = resolve }))
    draw()
    const tryWords = (value: string) => {
      fireEvent.change(screen.getByRole('textbox', { name: STRESS_WORDS.tryValue }), { target: { value } })
      fireEvent.click(screen.getByRole('button', { name: STRESS_WORDS.try }))
    }
    tryWords('-500')
    fireEvent.click(figureChoice(target.heading))
    tryWords('7200')
    await act(async () => finishB(answer(target.id, target.heading, wordsB)))
    await act(async () => finishA(answer(cups.id, cups.heading, wordsA)))
    unsubscribe()
    expect(lensChanged).not.toHaveBeenCalled()
    expect(useWhatIf.getState().shown).toBe(shown)
    expect(screen.getByRole('radio', { name: wordsB })).toBeChecked()
    expect(screen.queryByRole('radio', { name: wordsA })).toBeNull()
    fireEvent.click(figureChoice(cups.heading))
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.queryByRole('radio', { name: wordsA })).toBeNull()
    expect(screen.queryByRole('radio', { name: wordsB })).toBeNull()
  })

  it('adds an answered trial without replacing a step chosen while the request was pending', async () => {
    const words = 'Set cups change to five hundred fewer cups.'
    let finish!: (value: unknown) => void
    vi.mocked(call).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    draw()
    fireEvent.change(screen.getByRole('textbox', { name: STRESS_WORDS.tryValue }), { target: { value: '-500' } })
    fireEvent.click(screen.getByRole('button', { name: STRESS_WORDS.try }))
    fireEvent.click(radio('high'))
    await act(async () => finish({ ...capturedTrial, variants: [{
      ...capturedTrial.variants[0], edits: [{ quantity: cups.id, label: cups.heading, words }],
    }] }))
    const trial = screen.getByRole('radio', { name: words })
    expect(trial).not.toBeChecked()
    expect(radio('high')).toBeChecked()
    expectChart(optionRows(raise.heading)[0], raiseRow.driver!.high)
    fireEvent.click(trial)
    expect(trial).toBeChecked()
  })

  it('distinguishes held proposals, stale or failed reads, and current approved results', () => {
    const proposal: NonNullable<View['proposal']> = {
      id: 1, base: null, heading: 'Proposed model', on: '', removed: null,
      problem: null, marks: [], changes: [], groups: null, from: null,
    }
    render(<StressTestTab />)
    const tab = screen.getByTestId('core-stress-tab')
    expect(tab).toHaveTextContent(STRESS_WORDS.empty)
    act(() => useViewStore.setState({ status: 'error' }))
    expect(tab.textContent).toBe(STRESS_WORDS.unavailable)
    act(() => useViewStore.setState({ status: 'ready', error: 'Fixture read failed' }))
    expect(tab.textContent).toBe(STRESS_WORDS.unavailable)
    act(() => useViewStore.setState({ error: null }))
    act(() => useViewStore.setState({ view: { ...view, proposal } }))
    expect(tab).toHaveTextContent(STRESS_WORDS.held)
    expect(within(tab).queryByRole('radio')).toBeNull()
    act(() => useViewStore.setState({ view }))
    expect(within(tab).getByRole('radiogroup')).toBeVisible()
    act(() => useViewStore.setState({ stale: true }))
    expect(tab.textContent).toBe(STRESS_WORDS.unavailable)
    expect(within(tab).queryByRole('radiogroup')).toBeNull()
    expect(ringFrom).toHaveBeenLastCalledWith('tool-stress', [])
    act(() => useViewStore.setState({ stale: false, error: 'Fixture read failed' }))
    expect(tab.textContent).toBe(STRESS_WORDS.unavailable)
    expect(within(tab).queryByRole('radiogroup')).toBeNull()
    act(() => useViewStore.setState({ error: null }))
    expect(within(tab).getByRole('radiogroup')).toBeVisible()
    act(() => useViewStore.setState({ status: 'error' }))
    expect(tab.textContent).toBe(STRESS_WORDS.unavailable)
    act(() => useViewStore.setState({ status: 'ready' }))
    act(() => useViewStore.setState({ view: { ...view, proposal }, stale: true }))
    expect(tab.textContent).toBe(STRESS_WORDS.held)
    act(() => useViewStore.setState({ error: 'Fixture read failed' }))
    expect(tab.textContent).toBe(STRESS_WORDS.unavailable)
  })
})
