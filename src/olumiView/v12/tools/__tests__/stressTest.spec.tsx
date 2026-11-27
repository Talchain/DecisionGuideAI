import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { View, ViewRow } from '../../../client'
import pricing from '../../../fixtures/core-d4729b77/pricing.view3.json'
import { pressCard, ringFrom } from '../../../reasoning/tabRing'
import { useViewStore } from '../../../store'
import { StressTest, StressTestTab, STRESS_STEPS, STRESS_WORDS } from '../StressTest'

vi.mock('../../../reasoning/tabRing', () => ({ pressCard: vi.fn(), ringFrom: vi.fn() }))

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
const picker = () => screen.getByRole('combobox', { name: STRESS_WORDS.figure })
const optionRows = (heading: string) => screen.getAllByRole('button', { name: (name) => name.startsWith(heading) })

function expectChart(row: HTMLElement, chance: number) {
  expect(row).toHaveAttribute('data-stress-computed', 'true')
  expect(row).toHaveAttribute('data-stress-chance', String(chance))
  expect(row.querySelectorAll('[data-chance-dot="filled"]')).toHaveLength(Math.round(chance * 10))
  expect(row.querySelectorAll('[data-chance-dot]')).toHaveLength(10)
}

beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unexpected network request'))))
afterEach(() => {
  cleanup()
  useViewStore.setState({ view: null, stale: false, error: null })
  expect(fetch).not.toHaveBeenCalled()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('Stress-test', () => {
  it('moves only the selected record’s rows across the three readings and keeps the figure range static', () => {
    draw()
    expect(screen.getByTestId('tool-stress')).toHaveAttribute('data-form', 'TT-stress')
    expect(picker()).toHaveValue(cups.id)
    expect(within(picker()).getAllByRole('option').map((option) => option.textContent)).toEqual([cups.heading, target.heading])
    expect(screen.getByRole('heading', { name: raiseRow.aim })).toBeVisible()
    expect(screen.getByRole('heading', { name: secondAim.aim })).toBeVisible()
    expect(screen.getByText(cups.figure!.text)).toBeVisible()

    const [raiseProfit, raiseAnnual] = optionRows(raise.heading)
    const [keepProfit, keepAnnual] = optionRows(keep.heading)
    expect(raiseProfit.querySelector('[data-letter-chip]')).toHaveTextContent('A')
    expect(keepProfit.querySelector('[data-letter-chip]')).toHaveTextContent('B')
    const originalBand = screen.getByTestId('range-band').getAttribute('style')
    expect(radio('saved')).toBeChecked()
    for (const step of ['saved', 'low', 'high'] as const) {
      fireEvent.click(radio(step))
      expectChart(raiseProfit, step === 'saved' ? raiseRow.chance! : raiseRow.driver![step])
      expectChart(raiseAnnual, step === 'saved' ? raiseSecond.chance! : raiseSecond.driver![step])
      expect(screen.getByTestId('range-band')).toHaveAttribute('style', originalBand)
      expect(screen.queryByTestId('range-tried')).toBeNull()
      for (const [row, value, kind] of [[keepProfit, keepFirst.value, 'other'], [keepAnnual, keepSecond.value, 'none']] as const) {
        expect(row).toHaveAttribute('data-stress-computed', kind)
        expect(row).not.toHaveAttribute('data-stress-chance')
        expect(row.querySelector('[data-chance-dots]')).toBeNull()
        expect(within(row).getByText(value)).toHaveClass('text-text-light')
      }
    }

    fireEvent.change(picker(), { target: { value: target.id } })
    expect(screen.getByText(target.figure!.text)).toBeVisible()
    expect(screen.queryByTestId('range-bar')).toBeNull()
    expectChart(keepProfit, keepFirst.driver!.high)
    expect(raiseProfit).toHaveAttribute('data-stress-computed', 'other')
    expect(raiseAnnual).toHaveAttribute('data-stress-computed', 'other')
    expect(raiseProfit.querySelector('[data-chance-dots]')).toBeNull()
  })

  it('uses Core’s words at rest, and puts the saved words in the fold for the conditional steps', async () => {
    draw()
    const [row] = optionRows(raise.heading)
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

    const words = new Set([
      ...Object.values(STRESS_STEPS), ...Object.values(STRESS_WORDS),
      cups.heading, target.heading, cups.figure!.text, raise.heading, keep.heading,
      raiseRow.aim, secondAim.aim, raiseRow.value, raiseSecond.value, keepFirst.value, keepSecond.value,
      raiseRow.title, raiseSecond.title, 'A', 'B',
    ])
    const walker = document.createTreeWalker(screen.getByTestId('tool-stress'), NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) expect(words.has(walker.currentNode.textContent!)).toBe(true)

    const [other, none] = optionRows(keep.heading)
    act(() => other.focus())
    expect((await screen.findByRole('tooltip')).textContent).toBe(STRESS_WORDS.other)
    act(() => none.focus())
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

    fireEvent.change(picker(), { target: { value: target.id } })
    expect(ringFrom).toHaveBeenLastCalledWith('tool-stress', [target.id, keep.id])
    fireEvent.click(optionRows(keep.heading)[0])
    expect(pressCard).toHaveBeenCalledWith(keep.id)
    unmount()
    expect(ringFrom).toHaveBeenLastCalledWith('tool-stress', [])
  })

  it('matches folded record IDs independently and keeps aims distinct even when their words match', () => {
    const firstRecord = 'folded_cups'
    const secondRecord = 'folded_target'
    const folded: View = {
      ...view,
      model: {
        ...view.model!,
        cards: view.model!.cards.map((card) => {
          if (card.id === cups.id) return {
            ...card,
            badge: { records: [firstRecord, secondRecord], text: '', title: '', label: '', open: false, proposed: false, change: '', words: '', face: '', icon: '' },
          }
          if (card.id === raise.id) return {
            ...card,
            rows: [
              { ...raiseRow, driver: { ...raiseRow.driver!, figure: firstRecord } },
              { ...raiseSecond, aim: raiseRow.aim, driver: { ...raiseSecond.driver!, figure: secondRecord } },
            ],
          }
          if (card.id === keep.id) return { ...card, rows: [] }
          return card
        }),
      },
    }
    draw(folded)
    expect(within(picker()).getAllByRole('option', { name: cups.heading })).toHaveLength(2)
    expect(screen.getAllByRole('heading', { name: raiseRow.aim })).toHaveLength(2)
    expect(screen.queryByText(cups.figure!.text)).toBeNull()
    expect(screen.queryByTestId('range-bar')).toBeNull()
    const [first, second] = optionRows(raise.heading)
    expectChart(first, raiseRow.chance!)
    expect(second).toHaveAttribute('data-stress-computed', 'other')
    fireEvent.change(picker(), { target: { value: secondRecord } })
    expect(first).toHaveAttribute('data-stress-computed', 'other')
    expectChart(second, raiseSecond.chance!)
    expect(ringFrom).toHaveBeenLastCalledWith('tool-stress', [cups.id, raise.id])
  })

  it('shows one line when no chance row has a driver, even when the option card does', () => {
    const model = { ...base.model!, cards: base.model!.cards.map((card) => card.id === raise.id
      ? { ...card, rows: [{ ...raiseRow, driver: null }] } : card) }
    draw({ ...base, model })
    expect(screen.getByTestId('tool-stress').textContent).toEqual(STRESS_WORDS.empty)
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByRole('radio')).toBeNull()
  })

  it('draws the tab only from the approved selector and uses the held line while a proposal is shown', () => {
    const proposal: NonNullable<View['proposal']> = {
      id: 1, base: null, heading: 'Proposed model', on: '', removed: null,
      problem: null, marks: [], changes: [], groups: null, from: null,
    }
    render(<StressTestTab />)
    const tab = screen.getByTestId('core-stress-tab')
    expect(tab).toHaveTextContent(STRESS_WORDS.empty)
    act(() => useViewStore.setState({ view: { ...view, proposal } }))
    expect(tab).toHaveTextContent(STRESS_WORDS.held)
    expect(within(tab).queryByRole('radio')).toBeNull()
    act(() => useViewStore.setState({ view }))
    expect(within(tab).getByRole('radiogroup')).toBeVisible()
    act(() => useViewStore.setState({ stale: true }))
    expect(within(tab).queryByRole('radiogroup')).toBeNull()
    expect(ringFrom).toHaveBeenLastCalledWith('tool-stress', [])
  })
})
