import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMe } from '../../../../olumiCore/me'
import { setTeamFetch } from '../../../../olumiCore/team/api'
import { differencesKey, readDifferences, resetDifferences, useDifferences, type Difference, type Differences } from '../../../../olumiCore/team/differences'
import { resetTeamFlow } from '../../../../olumiCore/team/flow'
import { TeamTab } from '../../../../olumiCore/team/TeamTab'
import type { View } from '../../../client'
import { CompareViewsStage } from '../../views/CompareViewsStage'
import { useCompare } from '../../views/useCompare'
import { COMPARE_WORDS } from '../../views/WhereWeDiffer'
import { pressCard, ringFrom } from '../../../reasoning/tabRing'
import crossingResponse from '../../../fixtures/debate/differences.core.json'
import coreResponse from '../../../fixtures/debate/tm04-differences.core.json'
import revealedView from '../../../fixtures/debate/tm04-cara.view3.json'
import { useViewStore } from '../../../store'
import { DifferTool } from '../DifferTool'
import { useDifferSelection } from '../differSelection'

const view = revealedView as unknown as View
const core = coreResponse as Differences
const sid = view.id
const [figure, link, sameLinkOtherAim] = core.differences as readonly [Difference, Difference, Difference, ...Difference[]]
const factors = core.differences.filter((d) => d.kind === 'factor')

vi.mock('../../../reasoning/tabRing', () => ({ pressCard: vi.fn(), ringFrom: vi.fn() }))
const fetchTeam = vi.fn(async (resource: RequestInfo | URL) => {
  const url = String(resource)
  if (url.endsWith('/differences')) return Response.json(core)
  if (url.endsWith('/invites')) return Response.json({ invites: [] })
  return Response.json({ error: 'Not found' }, { status: 404 })
})

beforeEach(() => {
  setTeamFetch(fetchTeam)
  useViewStore.setState({ sid, view, status: 'ready', error: null, at: null })
  useMe.setState({ me: { id: view.you_id!, name: view.you }, status: 'ready' })
})

afterEach(async () => {
  await act(async () => cleanup())
  resetDifferences()
  resetTeamFlow()
  useDifferSelection.setState({ bySid: {} })
  useCompare.getState().hide()
  setTeamFetch(null)
  useViewStore.setState({ sid: null, view: null, status: 'none', at: null })
  useMe.setState({ me: null, status: 'none' })
  vi.clearAllMocks()
})

function load(given: View, differences = core.differences) {
  const key = differencesKey(sid, given)
  useDifferences.setState({ sid, key, read: key, data: { ...core, differences } })
}

const tool = () => screen.getByTestId('tool-differ')
const choose = (d: Difference) => within(tool()).getByRole('button', {
  name: [d.label, ...(d.goal_label ? [d.goal_label] : d.sides.map((side) => side.holder))].join(' '),
})
const ranges = () => within(tool()).queryByTestId('tool-differ-ranges')
const differenceReads = () => fetchTeam.mock.calls.filter(([url]) => String(url).endsWith('/differences')).length

function barEndpoints() {
  return [...ranges()!.querySelectorAll('[data-range-mark="span"]')].map((bar) => {
    const left = Number(bar.getAttribute('x'))
    return [left, left + Number(bar.getAttribute('width'))] as const
  })
}

function expectedPosition(low: number, high: number, value: number) {
  const margin = (high - low) * 0.08
  return ((value - (low - margin)) / (high - low + margin * 2)) * 100
}

function expectBarEndpoints(figures: Array<[number, number]>) {
  const endpoints = barEndpoints()
  expect(endpoints).toHaveLength(figures.length)
  const low = Math.min(...figures.map(([lo]) => lo))
  const high = Math.max(...figures.map(([, hi]) => hi))
  figures.forEach(([lo, hi], i) => {
    expect(endpoints[i]![0]).toBeCloseTo(expectedPosition(low, high, lo))
    expect(endpoints[i]![1]).toBeCloseTo(expectedPosition(low, high, hi))
  })
  return endpoints
}

describe('Where we differ in Team', () => {
  it('shares one read with the revealed step and hides on a historical View', async () => {
    const before = { ...view, collab: { ...view.collab, shared: [] } }
    useViewStore.setState({ view: before })
    render(<><TeamTab /><CompareViewsStage /></>)
    expect(screen.queryByTestId('tool-differ')).toBeNull()
    expect(differenceReads()).toBe(0)

    act(() => useViewStore.setState({ view }))
    const revealedTool = await screen.findByTestId('tool-differ')
    const team = screen.getByTestId('team-tab')
    expect(team.firstElementChild).toBe(revealedTool)
    expect(within(team).getByTestId('differ-after')).toBeVisible()
    const axis = '[data-form="CH-differ"]'
    expect(team.querySelectorAll(axis)).toHaveLength(1)
    expect(team.querySelector(axis)).toBe(ranges())
    expect(differenceReads()).toBe(1)
    fireEvent.click(within(team).getByTestId('differ-open-centre'))
    expect(screen.getByTestId('compare-stage').querySelectorAll(axis)).toHaveLength(1)
    expect(team.querySelectorAll(axis)).toHaveLength(1)

    act(() => useViewStore.setState({ at: 1 }))
    expect(screen.queryByTestId('tool-differ')).toBeNull()
  })

  it('keeps the last matching version and chosen aim when the shared read rejects', async () => {
    const current = { ...view, signature: view.signature + '2' }
    const matchKey = differencesKey(sid, current)
    const { rerender } = render(<DifferTool sid={sid} view={view} />)
    await screen.findByTestId('tool-differ')
    fireEvent.click(choose(sameLinkOtherAim))

    fetchTeam.mockRejectedValueOnce(new Error('connection lost'))
    rerender(<DifferTool sid={sid} view={current} />)
    await waitFor(() => expect(useDifferences.getState()).toMatchObject({
      key: matchKey, read: differencesKey(sid, view), error: expect.any(String),
    }))
    expect(choose(sameLinkOtherAim)).toHaveAttribute('aria-pressed', 'true')
  })

  it('waits for the response version to match the displayed View, even when the request key matches', async () => {
    const current = { ...view, version: { ...view.version!, n: view.version!.n + 1 } }
    const key = differencesKey(sid, current)
    render(<DifferTool sid={sid} view={current} />)

    await waitFor(() => expect(useDifferences.getState()).toMatchObject({ read: key, data: { version: core.version } }))
    expect(screen.queryByTestId('tool-differ')).toBeNull()

    fetchTeam.mockResolvedValueOnce(Response.json({ ...core, version: current.version.n }))
    await act(async () => readDifferences(sid, key))
    expect(ranges()).toBeVisible()
  })

  it('restores the choice only for the same scenario', () => {
    load(view)
    const { unmount } = render(<DifferTool sid={sid} view={view} />)
    fireEvent.click(choose(sameLinkOtherAim))
    unmount()

    const other = { ...view, id: sid + '2' }
    const key = differencesKey(other.id, other)
    useDifferences.setState({ sid: other.id, key, read: key, data: { ...core, scenario: other.id } })
    const { rerender } = render(<DifferTool sid={other.id} view={other} />)
    expect(choose(figure)).toHaveAttribute('aria-pressed', 'true')
    load(view)
    rerender(<DifferTool sid={sid} view={view} />)
    expect(choose(sameLinkOtherAim)).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows each figure on the same scale and redraws from the selected record', () => {
    const maya = view.collab.shared.find((entry) => entry.id === 21)!
    const mayaFigure = maya.figures[0]!
    const tom = figure.sides[1]!
    const tomFigure = view.collab.shared.find((entry) => entry.id === tom.view)!.figures[0]!
    const second = {
      ...figure, record: mayaFigure.quantity, label: mayaFigure.label, cards: undefined,
      sides: [{ ...figure.sides[0]!, view: maya.id, holder: maya.by, holder_id: maya.by_id, figure: mayaFigure.text }, tom],
    }
    const twoRecords = {
      ...view,
      collab: { ...view.collab, shared: view.collab.shared.map((entry) => entry.id === tom.view
        ? { ...entry, figures: [...entry.figures, { ...tomFigure, quantity: mayaFigure.quantity }] }
        : entry) },
    }
    load(twoRecords, [figure, second])
    render(<DifferTool sid={sid} view={twoRecords} />)

    expect(choose(figure)).toHaveAttribute('aria-pressed', 'true')
    expect(choose(second)).toHaveAttribute('aria-pressed', 'false')
    const tomBefore = expectBarEndpoints([[6, 12], [1, 3]])[1]!
    expect(within(ranges()!).getByText(figure.sides[0]!.figure)).toBeVisible()
    expect(within(ranges()!).getByText(figure.sides[1]!.figure)).toBeVisible()

    fireEvent.click(choose(second))
    expect(choose(second)).toHaveAttribute('aria-pressed', 'true')
    const tomAfter = expectBarEndpoints([[1, 2], [1, 3]])[1]!
    expect(tomAfter[1]).toBeGreaterThan(tomBefore[1])
    expect(within(ranges()!).getByText(maya.by)).toBeVisible()
    expect(within(ranges()!).getByText(mayaFigure.text)).toBeVisible()
    expect(within(ranges()!).queryByText(figure.sides[0]!.figure)).toBeNull()
    expect(ringFrom).toHaveBeenLastCalledWith('tool-differ', [second.record])
  })

  it('draws even a short span at its exact endpoints', () => {
    const short: View = {
      ...view,
      collab: { ...view.collab, shared: view.collab.shared.map((entry) => entry.id === figure.sides[0]!.view
        ? { ...entry, figures: entry.figures.map((f) => ({ ...f, low: 6, high: 6.01 })) }
        : entry) },
    }
    load(short, [figure])
    render(<DifferTool sid={sid} view={short} />)
    expectBarEndpoints([[6, 6.01], [1, 3]])
  })

  it('keeps both people’s words when units differ and puts Core’s crossing words in the fold', () => {
    const mixedUnits = {
      ...view,
      collab: { ...view.collab, shared: view.collab.shared.map((entry) => entry.id === figure.sides[1]!.view
        ? { ...entry, figures: entry.figures.map((f) => ({ ...f, unit: 'week' })) }
        : entry) },
    }
    const crossing = (crossingResponse as Differences).differences.flatMap((d) => d.settle).find((s) => s.kind === 'crossing')!
    const entry = { ...figure, settle: [...figure.settle, crossing] }
    load(mixedUnits, [entry])
    render(<DifferTool sid={sid} view={mixedUnits} />)
    expect(ranges()).toBeNull()
    expect(tool().querySelector('[data-range-mark], [data-difference-option]')).toBeNull()
    const rows = within(tool()).getByTestId('tool-differ-sides')
    for (const side of figure.sides) {
      expect(within(rows).getByText(side.holder)).toBeVisible()
      expect(within(rows).getByText(side.figure)).toBeVisible()
    }
    expect(within(rows).getAllByTestId('differ-person-mark')).toHaveLength(figure.sides.length)
    const summary = within(tool()).getByText('More on this difference')
    const fold = summary.closest('details')!
    expect(fold).not.toHaveAttribute('open')
    fireEvent.click(summary)
    expect(fold).toHaveAttribute('open')
    expect(within(fold).getByText(figure.status_text).textContent).toBe(figure.status_text)
    for (const side of figure.sides) expect(within(fold).getByText(side.title).textContent).toBe(side.title)
    expect(within(fold).getByText(crossing.text).textContent).toBe(crossing.text)
  })

  it('rings the chosen cards, clears the ring on close, and presses the described target only when asked', () => {
    load(view)
    const { unmount } = render(<DifferTool sid={sid} view={view} />)
    expect(ringFrom).toHaveBeenLastCalledWith('tool-differ', figure.cards)

    fireEvent.click(choose(link))
    expect(ringFrom).toHaveBeenLastCalledWith('tool-differ', link.cards)
    expect(ranges()).toBeNull()
    fireEvent.click(choose(sameLinkOtherAim))
    expect(choose(link)).toHaveAttribute('aria-pressed', 'false')
    expect(choose(sameLinkOtherAim)).toHaveAttribute('aria-pressed', 'true')
    expect(within(choose(link)).getByText(link.goal_label)).toBeVisible()
    for (const side of link.sides) expect(within(choose(link)).queryByText(side.holder)).toBeNull()

    for (const factor of factors) {
      const holders = factor.sides.map((side) => side.holder).join(' ')
      const selector = within(tool()).getByRole('button', { name: `${factor.label} ${holders}`, description: holders })
      for (const side of factor.sides) expect(within(selector).getByText(side.holder)).toBeVisible()
    }
    const intended = factors[1]!
    const holders = intended.sides.map((side) => side.holder).join(' ')
    fireEvent.click(within(tool()).getByRole('button', { name: `${intended.label} ${holders}`, description: holders }))
    const rows = within(tool()).getByTestId('tool-differ-sides')
    expect(within(rows).getByText(intended.sides[0]!.holder)).toBeVisible()
    expect(within(rows).queryByText(factors[0]!.sides[0]!.holder)).toBeNull()
    expect(ringFrom).toHaveBeenLastCalledWith('tool-differ', [])
    expect(within(rows).queryByRole('button')).toBeNull()
    expect(pressCard).not.toHaveBeenCalled()

    fireEvent.click(choose(figure))
    expect(ringFrom).toHaveBeenLastCalledWith('tool-differ', figure.cards)
    const rowPress = within(ranges()!).getByRole('button', { name: /Priya/, description: COMPARE_WORDS.toCanvas })
    fireEvent.click(rowPress)
    expect(pressCard).toHaveBeenCalledTimes(1)
    expect(pressCard).toHaveBeenCalledWith(figure.cards![0])

    unmount()
    expect(ringFrom).toHaveBeenLastCalledWith('tool-differ', [])
  })
})
