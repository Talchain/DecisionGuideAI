import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasStore } from '../../../../canvas/store'
import { call } from '../../../../olumiCore/team/api'
import type { View, ViewRow } from '../../../client'
import pricing from '../../../fixtures/core-d4729b77/pricing.view3.json'
import capturedTrial from '../../../fixtures/v11/consulting-whatif-priya.json'
import { pressCard, ringFrom } from '../../../reasoning/tabRing'
import { useViewStore } from '../../../store'
import { clearWhatIf } from '../../../whatif'
import { useLaneInspector } from '../../edit/inspectorStore'
import { StressTest, StressTestTab, STRESS_STEPS, STRESS_WORDS } from '../StressTest'
import { useStressTrials } from '../stressTrials'

vi.mock('../../../reasoning/tabRing', () => ({ pressCard: vi.fn(), ringFrom: vi.fn() }))
vi.mock('../../../../olumiCore/team/api', async (original) => ({
  ...await original<typeof import('../../../../olumiCore/team/api')>(), call: vi.fn(),
}))

type ChanceRow = Extract<ViewRow, { kind: 'chance' }>
const base = pricing as unknown as View
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

beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unexpected network request'))))
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
  it('moves only the selected record’s rows across the three readings and keeps the figure range static', () => {
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
    const originalBand = screen.getByTestId('range-band').getAttribute('style')
    expect(radio('saved')).toBeChecked()
    for (const step of ['saved', 'low', 'high'] as const) {
      fireEvent.click(radio(step))
      expectChart(raiseProfit, step === 'saved' ? raiseRow.chance! : raiseRow.driver![step])
      expectChart(raiseAnnual, step === 'saved' ? raiseSecond.chance! : raiseSecond.driver![step])
      if (step !== 'saved') {
        expectSavedPair(raiseProfit, raiseRow.chance!)
        expectSavedPair(raiseAnnual, raiseSecond.chance!)
      } else expect(raiseProfit.querySelectorAll('[data-chance-dots]')).toHaveLength(1)
      expect(screen.getByTestId('range-band')).toHaveAttribute('style', originalBand)
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
      ...Object.values(STRESS_STEPS), ...Object.values(STRESS_WORDS),
      cups.heading, target.heading, cups.figure!.text, raise.heading, keep.heading,
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

  it('offers Core’s unsized editable figures in card order when no chance row has a driver', () => {
    const model = { ...base.model!, cards: base.model!.cards.map((card) => {
      if (card.id === raise.id) return { ...card, rows: [{ ...raiseRow, driver: null }] }
      if (card.id === cups.id || card.id === target.id) return { ...card, figure: { ...card.figure!, text: '' } }
      if (card.id === 'margin') return { ...card, figure: { ...card.figure!, text: '', edit: null } }
      return card
    }) }
    const unsized = { ...base, model }
    useViewStore.setState({ view: unsized, sid: base.id, status: 'ready' })
    draw(unsized)
    const tool = screen.getByTestId('tool-stress')
    const tracks = [...tool.querySelectorAll('.ok-face-mark.ok-face-mark-track')]
    expect(tracks.map((track) => track.previousElementSibling?.textContent)).toEqual([cups.heading, target.heading])
    expect(tool).not.toHaveTextContent(STRESS_WORDS.empty)
    const [fill] = within(tool).getAllByRole('button', { name: STRESS_WORDS.fill })
    fireEvent.click(fill)
    expect(useLaneInspector.getState().current).toMatchObject({ kind: 'details', edit: 'value', target: { kind: 'card', id: cups.id } })
    expect(screen.queryByRole('group', { name: STRESS_WORDS.figure })).toBeNull()
    expect(screen.queryByRole('radio')).toBeNull()
  })

  it('retargets to the selected canvas figure and returns keyboard focus to the computed points', () => {
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
    expect(screen.getByTestId('range-tried')).toHaveAttribute('data-at', '-500')
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
    expect(screen.getByTestId('range-tried')).toHaveAttribute('data-at', '-500')

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

  it('keeps overlapping answers with the figures they were tried on', async () => {
    const capture = capturedTrial.variants[0]
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
    await act(async () => {
      finishA(answer(cups.id, cups.heading, wordsA))
      finishB(answer(target.id, target.heading, wordsB))
    })
    expect(screen.getByRole('radio', { name: wordsB })).toBeChecked()
    expect(screen.queryByRole('radio', { name: wordsA })).toBeNull()
    fireEvent.click(figureChoice(cups.heading))
    expect(screen.getByRole('radio', { name: wordsA })).toBeVisible()
    expect(screen.queryByRole('radio', { name: wordsB })).toBeNull()
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
