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
const rowsOf = (id: string) => within(aimBlock(id)).getAllByRole('button')
const dots = (row: HTMLElement) => row.querySelectorAll('[data-chance-dot]')
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
  useViewStore.setState({ sid: null, view: null, at: null })
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

  it('shows served chance and non-chance words, the available dots, provenance, and row hovers', () => {
    render(<CompareOptions model={model} />)
    const [shown, fixedMiss] = rowsOf(takings.aim_id)
    expect(within(shown!).getByText(takings.value).textContent).toBe(takings.value)
    expect(dots(shown!)).toHaveLength(10)
    expect(within(shown!).getByRole('img', { name: takings.likely!.title })).toHaveClass('text-text-header')
    expect(within(fixedMiss!).getByText(miss.value).textContent).toBe(miss.value)
    expect(dots(fixedMiss!)).toHaveLength(0)
    expect(within(fixedMiss!).getByRole('img', { name: miss.olumi!.title })).toHaveClass('text-info')
    expect(laneTipOf(shown!)).toBe(takings.title)
    expect(within(aimBlock(membersAim.id)).getByRole('heading')).toHaveTextContent(membersAim.heading)
    for (const row of rowsOf(membersAim.id)) {
      expect(within(row).getByText(members.text).textContent).toBe(members.text)
      expect(dots(row)).toHaveLength(0)
      expect(row.querySelector('.ok-face-mark-track')).toBeNull()
      expect(laneTipOf(row)).toBe(members.title)
    }
  })

  it('orders by the chart aims, joins the selected raw rows only, and marks an absent row without words', () => {
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
    const [limitRow, absent] = rowsOf(limit.aim_id)
    expect(within(limitRow!).getByText(limit.value).textContent).toBe(limit.value)
    expect(dots(limitRow!)).toHaveLength(0)
    expect(laneTipOf(limitRow!)).toBe(limit.title)
    expect(absent?.textContent).toBe(`B${weekend!.heading}`)
    expect(absent?.querySelector('.ok-face-mark.ok-face-mark-track')?.closest('[aria-hidden="true"]')).not.toBeNull()
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
    expect(within(aimBlock(membersAim.id)).queryByText(CHROME.more)).toBeNull()
    const summary = within(aimBlock(takings.aim_id)).getByText(CHROME.more)
    const details = summary.closest('details')!
    const outcome = within(details).getByText(takings.outcome!.text)
    expect(details.open).toBe(false)
    expect(outcome).not.toBeVisible()
    fireEvent.click(summary)
    expect(details.open).toBe(true)
    expect(outcome).toBeVisible()
    expect(laneTipOf(outcome)).toBe(takings.outcome!.title)
    expect(within(details).getByText(tail.text)).toBeVisible()
    expect(within(details).getByText(driver.heading)).toBeVisible()
    expect(within(details).getByText(miss.outcome!.text)).toBeVisible()
  })

  it('renders nothing outside the served strings, option letters, and exported chrome', () => {
    render(<CompareOptions model={model} />)
    const served = new Set<string>([
      ...Object.values(CHROME),
      ...optionLetters(model).values(),
      ...model.cards.map((card) => card.heading),
      ...optionCards(model).flatMap((card) => card.rows.flatMap((row) => {
        if (row.kind === 'none') return [row.text]
        if (row.kind === 'limit') return [row.aim, row.value, row.olumi?.glyph ?? '']
        return [row.aim, row.value, row.likely?.glyph ?? '', row.olumi?.glyph ?? '', row.outcome?.text ?? '', row.tail?.text ?? '']
      })),
    ])
    const walker = document.createTreeWalker(tool(), NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const words = node.textContent!.trim()
      if (words !== '') expect(served.has(words), words).toBe(true)
    }
    expect(tool()).toHaveAttribute('data-paired', 'false')
  })

  it('rings both card paths, updates the ring on a choice, and clears it on unmount', () => {
    const { unmount } = render(<CompareOptions model={model} />)
    const path = (id: string) => [...optionPathOf(model, id).cards]
    expect(ringFrom).toHaveBeenLastCalledWith('tool-compare-options', [...path(evening!.id), ...path(weekend!.id)])
    change(second(), carryOn!.id)
    expect(ringFrom).toHaveBeenLastCalledWith('tool-compare-options', [...path(evening!.id), ...path(carryOn!.id)])
    fireEvent.click(rowsOf(takings.aim_id)[1]!)
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
