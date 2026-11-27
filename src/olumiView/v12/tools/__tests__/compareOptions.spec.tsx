import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CoreCompareTab } from '../../../../olumiCore/compare'
import { setTeamFetch } from '../../../../olumiCore/team/api'
import { laneTipOf } from '../../../__tests__/tipHelpers'
import type { View, ViewModel, ViewRow } from '../../../client'
import { optionCards } from '../../../layout'
import { pressCard, ringFrom } from '../../../reasoning/tabRing'
import { useViewStore } from '../../../store'
import { optionLetters } from '../../cards/letters'
import { optionPathOf } from '../../lenses/layers'
import { COMPARE_OPTIONS_CHROME as CHROME, CompareOptions } from '../CompareOptions'
import { useCompareSelection } from '../compareSelection'

vi.mock('../../../reasoning/tabRing', () => ({ ringFrom: vi.fn(), pressCard: vi.fn() }))

const studio = JSON.parse(readFileSync('src/olumiView/fixtures/cardface/studio.view3.json', 'utf8')) as View
const model = studio.model!
const [evening, weekend, carryOn] = optionCards(model)
const takings = evening!.rows.find((row) => row.kind === 'chance') as Extract<ViewRow, { kind: 'chance' }>
const miss = weekend!.rows.find((row) => row.kind === 'chance') as typeof takings
const members = evening!.rows.find((row) => row.kind === 'none') as Extract<ViewRow, { kind: 'none' }>
const membersAim = model.cards.find((card) => card.id === members.aim_id)!
const first = () => screen.getByRole('combobox', { name: CHROME.first })
const second = () => screen.getByRole('combobox', { name: CHROME.second })
const tool = () => screen.getByRole('region', { name: CHROME.title })
const aimBlock = (id: string) => tool().querySelector<HTMLElement>(`[data-compare-aim="${id}"]`)!
const rowsOf = (id: string) => [...aimBlock(id).querySelectorAll<HTMLElement>('[data-compare-row]')]
const rowButton = (row: HTMLElement) => within(row).getByRole('button')
const resultLine = (row: HTMLElement) => row.querySelector<HTMLElement>('[data-compare-result]')!
const dots = (row: HTMLElement) => row.querySelectorAll('[data-chance-dot]')
const filledDots = (row: HTMLElement) => row.querySelectorAll('[data-chance-dot="filled"]').length
const change = (select: HTMLElement, id: string) => fireEvent.change(select, { target: { value: id } })
const withRows = (rows: Partial<Record<string, ViewRow[]>>): ViewModel => ({
  ...model,
  cards: model.cards.map((card) => rows[card.id] === undefined ? card : { ...card, rows: rows[card.id]! }),
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  setTeamFetch(null)
  useCompareSelection.setState({ byScenario: new Map() })
  useViewStore.setState({ sid: null, view: null, at: null, stale: false, error: null })
})

describe('Compare options', () => {
  it('shows two distinct options in canvas order and swaps the sides when a choice is already on the other side', () => {
    render(<CompareOptions model={model} />)
    const labels = optionCards(model).map((card) => `${optionLetters(model).get(card.id)} ${card.heading}`)
    for (const select of [first(), second()]) {
      expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual(labels)
    }
    expect(first()).toHaveValue(evening!.id)
    expect(second()).toHaveValue(weekend!.id)
    expect(rowsOf(takings.aim_id)[0]).toHaveTextContent(evening!.heading)
    expect(rowsOf(takings.aim_id)[1]).toHaveTextContent(weekend!.heading)

    change(first(), carryOn!.id)
    expect(rowsOf(takings.aim_id)[0]).toHaveTextContent(carryOn!.heading)
    change(second(), evening!.id)
    expect(rowsOf(takings.aim_id)[1]).toHaveTextContent(evening!.heading)

    change(first(), evening!.id)
    expect(first()).toHaveValue(evening!.id)
    expect(second()).toHaveValue(carryOn!.id)
    change(second(), evening!.id)
    expect(first()).toHaveValue(carryOn!.id)
    expect(second()).toHaveValue(evening!.id)
  })

  it('returns to the default pair when a chosen option goes away and stays there if the option returns', () => {
    const { rerender } = render(<CompareOptions model={model} />)
    change(first(), carryOn!.id)
    rerender(<CompareOptions model={{ ...model, cards: model.cards.filter((card) => card.id !== carryOn!.id) }} />)
    expect(first()).toHaveValue(evening!.id)
    expect(second()).toHaveValue(weekend!.id)
    rerender(<CompareOptions model={model} />)
    expect(first()).toHaveValue(evening!.id)
  })

  it('shows served chance words and provenance and keeps the none explanation behind the gap mark', () => {
    render(<CompareOptions model={model} />)
    const [shown, fixedMiss] = rowsOf(takings.aim_id)
    expect(within(shown!).getByText(takings.value).textContent).toBe(takings.value)
    expect(dots(shown!)).toHaveLength(10)
    const likely = within(shown!).getByRole('img', { name: takings.likely!.title })
    expect(likely).toHaveClass('text-text-header')
    expect(laneTipOf(likely, 'focus')).toBe(takings.likely!.title)
    expect(within(fixedMiss!).getByText(miss.value).textContent).toBe(miss.value)
    expect(dots(fixedMiss!)).toHaveLength(0)
    const olumi = within(fixedMiss!).getByRole('img', { name: miss.olumi!.title })
    expect(olumi).toHaveClass('text-info')
    expect(laneTipOf(olumi)).toBe(miss.olumi!.title)
    expect(laneTipOf(resultLine(shown!))).toBe(takings.title)
    expect(laneTipOf(rowButton(shown!))).toBeNull()
    expect(within(aimBlock(membersAim.id)).getByRole('heading')).toHaveTextContent(membersAim.heading)
    for (const row of rowsOf(membersAim.id)) {
      expect(row).not.toHaveTextContent(members.text)
      expect(row).not.toHaveTextContent(members.title)
      expect(dots(row)).toHaveLength(0)
      const track = row.querySelector<HTMLElement>('.ok-face-mark.ok-face-mark-track')!
      expect(track).toBeInTheDocument()
      expect(laneTipOf(resultLine(row))).toBe(members.text)
      expect(laneTipOf(rowButton(row))).toBeNull()
    }
    const summary = within(aimBlock(membersAim.id)).getByText(CHROME.more)
    const explanation = within(summary.closest('details')!).getAllByText(members.title)[0]!
    expect(explanation).not.toBeVisible()
    fireEvent.click(summary)
    expect(explanation).toBeVisible()
  })

  it('fills the dots from each option’s own shown chance, even after swapping the sides', () => {
    // Studio serves a fixed miss for Weekend. A typed variant gives the second option a different shown chance.
    const weekendChance = { ...miss, chance: 0.42, fixed: false, state: 'shown' as const, value: 'about 42% chance' }
    render(<CompareOptions model={withRows({ [weekend!.id]: [weekendChance] })} />)
    const expected = [takings, weekendChance].map((row) => Math.round(row.chance! * 10))
    expect(expected[0]).not.toBe(expected[1])
    expect(rowsOf(takings.aim_id).map((row) => dots(row).length)).toEqual([10, 10])
    expect(rowsOf(takings.aim_id).map(filledDots)).toEqual(expected)
    change(first(), weekend!.id)
    expect(rowsOf(takings.aim_id).map(filledDots)).toEqual([...expected].reverse())
  })

  it('orders by the chart aims, joins the selected raw rows only, and leaves an absent row without a track', () => {
    const unselectedOnly = { ...takings, aim_id: 'unselected' }
    const limit: ViewRow = { kind: 'limit', aim_id: 'limit', aim: 'Keep costs in range', value: 'Within the limit', title: 'Limit details', olumi: null, estimate: null }
    const unresolved = { ...members, aim_id: 'unresolved' }
    const tested = withRows({
      [evening!.id]: [members, limit, takings, unresolved],
      [weekend!.id]: [miss],
      [carryOn!.id]: [unselectedOnly],
    })
    render(<CompareOptions model={tested} />)
    expect([...tool().querySelectorAll('[data-compare-aim]')].map((block) => block.getAttribute('data-compare-aim')))
      .toEqual([takings.aim_id, membersAim.id, limit.aim_id, unresolved.aim_id])
    const [limitRow] = rowsOf(limit.aim_id)
    const absent = aimBlock(limit.aim_id).querySelector<HTMLElement>('[data-compare-row="absent"]')!
    expect(absent).toBeInTheDocument()
    expect(within(limitRow!).getByText(limit.value).textContent).toBe(limit.value)
    expect(dots(limitRow!)).toHaveLength(0)
    expect(laneTipOf(resultLine(limitRow!))).toBe(limit.title)
    expect(absent.textContent).toBe(`B${weekend!.heading}`)
    expect(absent.querySelector('.ok-face-mark-track, .ok-face-mark-chance, [data-chance-dots]')).toBeNull()
    expect(laneTipOf(rowButton(absent))).toBeNull()
    expect(within(aimBlock(limit.aim_id)).queryByText(CHROME.more)).toBeNull()
    expect(within(aimBlock(unresolved.aim_id)).queryByRole('heading')).toBeNull()
    change(second(), carryOn!.id)
    expect(aimBlock(unselectedOnly.aim_id)).toBeInTheDocument()
  })

  it.each([
    { row: { ...takings, state: 'withheld' as const }, headline: evening!.headline },
    { row: { ...takings, state: 'not_computable' as const }, headline: evening!.headline },
    { row: takings, headline: { ...weekend!.headline!, state: 'none' as const } },
    { row: { ...miss, fixed: false }, headline: weekend!.headline },
  ])('keeps the served words and omits dots when the row or its same-aim headline rules them out', ({ row, headline }) => {
    const changed = withRows({ [evening!.id]: [row] })
    render(<CompareOptions model={{ ...changed, cards: changed.cards.map((card) => card.id === evening!.id ? { ...card, headline } : card) }} />)
    const [result] = rowsOf(row.aim_id)
    expect(within(result!).getByText(row.value)).toBeInTheDocument()
    expect(dots(result!)).toHaveLength(0)
    expect(result?.querySelector('.ok-face-mark-track')).toBeNull()
  })

  it('keeps the outcome, tail and row driver one press away for their own aim and option', () => {
    const driver = model.cards.find((card) => card.id === 'class_fee')!
    const tail = { text: 'Worst tenth: £2,560/month', mean: 2560, unit: 'GBP/month', share: 0.1 }
    const tested = withRows({ [evening!.id]: [members, { ...takings, tail, driver: { figure: driver.id, low: 0.5, high: 0.9 } }] })
    render(<CompareOptions model={tested} />)
    const group = screen.getByRole('group', { name: takings.aim })
    const summary = within(group).getByText(CHROME.more)
    expect(summary).toHaveAccessibleDescription(takings.aim)
    const details = summary.closest('details')!
    const outcome = within(details).getByText(takings.outcome!.text)
    expect(details.open).toBe(false)
    expect(outcome).not.toBeVisible()
    fireEvent.click(summary)
    expect(details.open).toBe(true)
    expect(outcome).toBeVisible()
    expect(laneTipOf(outcome)).toBe(takings.outcome!.title)
    expect(within(details).getByText(tail.text)).toBeVisible()
    const figure = within(details).getByText(driver.heading)
    expect(figure).toBeVisible()
    expect(figure.previousElementSibling?.querySelector('svg.lucide-waypoints')).toBeInTheDocument()
    expect(within(details).getByText(miss.outcome!.text)).toBeVisible()
  })

  it('renders exactly the served strings, option letters, and exported chrome after changing both sides and opening all folds', () => {
    render(<CompareOptions model={model} />)
    change(first(), carryOn!.id)
    change(second(), evening!.id)
    expect(first()).toHaveValue(carryOn!.id)
    expect(second()).toHaveValue(evening!.id)
    for (const summary of within(tool()).getAllByText(CHROME.more)) {
      fireEvent.click(summary)
      expect(summary.closest('details')?.open).toBe(true)
    }

    const carryChance = carryOn!.rows.find((row) => row.kind === 'chance')!
    const carryGap = carryOn!.rows.find((row) => row.kind === 'none')!
    const picks = optionCards(model).map((card) => `${optionLetters(model).get(card.id)} ${card.heading}`).join('')
    const chanceRows = [`C${carryOn!.heading}${carryChance.value}`, `A${evening!.heading}${takings.likely!.glyph} ${takings.value}`]
    const gapRows = [`C${carryOn!.heading}`, `A${evening!.heading}`]
    expect(rowsOf(takings.aim_id).map((row) => row.textContent)).toEqual(chanceRows)
    expect(rowsOf(membersAim.id).map((row) => row.textContent)).toEqual(gapRows)
    const chanceFold = `${CHROME.more}C${carryChance.outcome!.text}A${takings.outcome!.text}`
    const gapFold = `${CHROME.more}C${carryGap.title}A${members.title}`
    expect(tool().textContent).toBe([
      picks, picks, takings.aim, ...chanceRows, chanceFold, membersAim.heading, ...gapRows, gapFold,
    ].join(''))
    expect(tool()).toHaveAttribute('data-paired', 'false')
  })

  it('rings both card paths, updates the ring on a choice, and clears it on unmount', () => {
    const { unmount } = render(<CompareOptions model={model} />)
    const path = (id: string) => [...optionPathOf(model, id).cards]
    expect(ringFrom).toHaveBeenLastCalledWith('tool-compare-options', [...path(evening!.id), ...path(weekend!.id)])
    change(second(), carryOn!.id)
    expect(ringFrom).toHaveBeenLastCalledWith('tool-compare-options', [...path(evening!.id), ...path(carryOn!.id)])
    fireEvent.click(rowButton(rowsOf(takings.aim_id)[1]!))
    expect(pressCard).toHaveBeenCalledWith(carryOn!.id)
    unmount()
    expect(ringFrom).toHaveBeenLastCalledWith('tool-compare-options', [])
  })

  it('renders nothing with one option', () => {
    const { container } = render(<CompareOptions model={{ ...model, cards: model.cards.filter((card) => card.family !== 'option' || card.id === evening!.id) }} />)
    expect(container).toBeEmptyDOMElement()
    expect(ringFrom).not.toHaveBeenCalled()
  })
})

describe('Compare tab integration', () => {
  function stubReads() {
    const reads = vi.fn(async (url: Parameters<typeof fetch>[0]) => {
      const path = String(url)
      if (path === '/api/me') return Response.json({ scenarios: [] })
      if (path.endsWith('/whatifs')) return Response.json({ whatifs: [] })
      if (path.endsWith('/versions')) return Response.json({ versions: [] })
      if (path.includes('/compare?')) return Response.json({ versions: [], changes: [], results: [] })
      throw new Error(`Unexpected request: ${path}`)
    })
    setTeamFetch(reads)
    vi.stubGlobal('fetch', reads)
  }

  it.each([null, 1, 2])('puts the options ahead of the legacy section with approved version %s', async (n) => {
    stubReads()
    useViewStore.setState({ sid: studio.id, view: { ...studio, version: n === null ? null : { ...studio.version!, n } }, at: null })
    render(<CoreCompareTab />)
    const legacy = screen.getByRole('heading', { name: CHROME.versions })
    expect(tool().compareDocumentPosition(legacy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await screen.findByTestId(n === null ? 'core-compare-none' : n === 1 ? 'core-compare-one' : 'core-compare-out')
  })

  it('shows the option comparison when the first model is held for approval', () => {
    stubReads()
    const held = JSON.parse(readFileSync('src/olumiView/fixtures/break-even/break-even-pending.view3.json', 'utf8')) as View
    useViewStore.setState({ sid: held.id, view: held, at: null })
    render(<CoreCompareTab />)
    const legacy = screen.getByTestId('core-compare-none')
    expect(tool().compareDocumentPosition(legacy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(first()).toHaveValue(optionCards(held.model!)[0]!.id)
  })

  it('restores both choices when the same scenario refreshes and the options are still present', () => {
    stubReads()
    const view = { ...studio, version: null }
    useViewStore.setState({ sid: studio.id, view, at: null })
    render(<CoreCompareTab />)
    change(first(), carryOn!.id)
    change(second(), evening!.id)

    act(() => useViewStore.setState({ stale: true }))
    expect(screen.queryByTestId('tool-compare-options')).not.toBeInTheDocument()
    act(() => useViewStore.setState({ stale: false, view: { ...view, model: { ...model } } }))

    expect(first()).toHaveValue(carryOn!.id)
    expect(second()).toHaveValue(evening!.id)
    expect(rowsOf(takings.aim_id)[0]).toHaveTextContent(carryOn!.heading)
    expect(rowsOf(takings.aim_id)[1]).toHaveTextContent(evening!.heading)
  })

  it.each([
    { stale: true, error: null },
    { stale: false, error: 'Refresh failed' },
  ])('removes the tool and clears its rings if the model becomes stale or the refresh fails', async (unavailable) => {
    stubReads()
    useViewStore.setState({ sid: studio.id, view: { ...studio, version: null }, at: null, ...unavailable })
    render(<CoreCompareTab />)
    expect(screen.queryByTestId('tool-compare-options')).not.toBeInTheDocument()
    expect(ringFrom).not.toHaveBeenCalled()

    act(() => useViewStore.setState({ stale: false, error: null }))
    expect(tool()).toBeVisible()
    expect(ringFrom).toHaveBeenLastCalledWith('tool-compare-options', expect.arrayContaining([evening!.id, weekend!.id]))

    act(() => useViewStore.setState(unavailable))
    expect(screen.queryByTestId('tool-compare-options')).not.toBeInTheDocument()
    expect(ringFrom).toHaveBeenLastCalledWith('tool-compare-options', [])
  })

  it('shows options while the versions are still loading and starts with the default pair on another scenario', async () => {
    stubReads()
    useViewStore.setState({ sid: studio.id, view: studio, at: 1 })
    render(<CoreCompareTab />)
    expect(screen.getByTestId('core-compare-loading')).toHaveTextContent('Reading the versions…')
    expect(first()).toHaveValue(evening!.id)
    change(first(), carryOn!.id)
    expect(first()).toHaveValue(carryOn!.id)
    await screen.findByTestId('core-compare-none')

    const next = 's_000000000003'
    act(() => useViewStore.setState({ sid: next, view: { ...studio, id: next, version: null }, at: null }))
    expect(first()).toHaveValue(evening!.id)
    expect(second()).toHaveValue(weekend!.id)
  })
})
