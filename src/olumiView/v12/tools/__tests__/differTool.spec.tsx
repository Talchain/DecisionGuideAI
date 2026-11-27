import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasStore } from '../../../../canvas/store'
import { registerFocusHelpers } from '../../../../canvas/utils/focusHelpers'
import { useMe } from '../../../../olumiCore/me'
import { setTeamFetch } from '../../../../olumiCore/team/api'
import { differencesKey, readDifferences, resetDifferences, useDifferences, type Difference, type Differences } from '../../../../olumiCore/team/differences'
import { resetTeamFlow } from '../../../../olumiCore/team/flow'
import { TeamTab } from '../../../../olumiCore/team/TeamTab'
import type { View, ViewLink } from '../../../client'
import { CompareViewsStage } from '../../views/CompareViewsStage'
import { useCompare } from '../../views/useCompare'
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

const disposers: Array<() => void> = []
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
  for (const dispose of disposers.splice(0)) dispose()
  resetDifferences()
  resetTeamFlow()
  useDifferSelection.setState({ bySid: {} })
  useCompare.getState().hide()
  setTeamFetch(null)
  useViewStore.setState({ sid: null, view: null, status: 'none', at: null })
  useMe.setState({ me: null, status: 'none' })
  useCanvasStore.getState().clearSelection()
  vi.restoreAllMocks()
  fetchTeam.mockClear()
})

function load(given: View, differences = core.differences, read = differencesKey(sid, given)) {
  useDifferences.setState({ sid, key: differencesKey(sid, given), read, data: { ...core, differences } })
}

const tool = () => screen.getByTestId('tool-differ')
const choose = (d: Difference) => within(tool()).getByRole('button', {
  name: [d.label, ...(d.goal_label ? [d.goal_label] : d.sides.map((side) => side.holder))].join(' '),
})
const ranges = () => within(tool()).queryByTestId('tool-differ-ranges')
const selectedNodes = () => [...useCanvasStore.getState().selection.nodeIds]

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
  it('leads Team once views are revealed, and hides on a historical View', async () => {
    const before = { ...view, collab: { ...view.collab, shared: [] } }
    useViewStore.setState({ view: before })
    render(<><TeamTab /><CompareViewsStage /></>)
    expect(screen.queryByTestId('tool-differ')).toBeNull()
    expect(fetchTeam.mock.calls.some(([url]) => String(url).endsWith('/differences'))).toBe(false)

    act(() => useViewStore.setState({ view }))
    const revealedTool = await screen.findByTestId('tool-differ')
    const team = screen.getByTestId('team-tab')
    expect(team.firstElementChild).toBe(revealedTool)
    expect(within(team).getByTestId('differ-after')).toBeVisible()
    const axis = '[data-form="CH-differ"]'
    expect(team.querySelectorAll(axis)).toHaveLength(1)
    expect(team.querySelector(axis)).toBe(ranges())
    fireEvent.click(within(team).getByTestId('differ-open-centre'))
    expect(screen.getByTestId('compare-stage').querySelectorAll(axis)).toHaveLength(1)
    expect(team.querySelectorAll(axis)).toHaveLength(1)

    act(() => useViewStore.setState({ at: 1 }))
    expect(screen.queryByTestId('tool-differ')).toBeNull()
  })

  it('hides the previous read when the new read rejects and restores the chosen aim when the read recovers', async () => {
    const current = { ...view, signature: view.signature + '2' }
    const matchKey = differencesKey(sid, current)
    load(view)
    const { rerender } = render(<DifferTool sid={sid} view={view} />)
    fireEvent.click(choose(sameLinkOtherAim))

    fetchTeam.mockRejectedValueOnce(new Error('connection lost'))
    rerender(<DifferTool sid={sid} view={current} />)
    expect(screen.queryByTestId('tool-differ')).toBeNull()
    await waitFor(() => expect(useDifferences.getState()).toMatchObject({
      key: matchKey, read: differencesKey(sid, view), error: expect.any(String),
    }))
    expect(screen.queryByTestId('tool-differ')).toBeNull()

    await act(async () => readDifferences(sid, matchKey))
    expect(choose(sameLinkOtherAim)).toHaveAttribute('aria-pressed', 'true')

    act(() => load(current, [figure, link]))
    expect(choose(figure)).toHaveAttribute('aria-pressed', 'true')
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
    expect(selectedNodes()).toEqual([second.record])
  })

  it('centres a short span and clips its padding at the next larger value', () => {
    const withRanges = (nextLow: number): View => ({
      ...view,
      collab: { ...view.collab, shared: view.collab.shared.map((entry) => {
        const index = figure.sides.findIndex((side) => side.view === entry.id)
        if (index < 0) return entry
        return { ...entry, figures: entry.figures.map((f) => f.quantity !== figure.record ? f : {
          ...f, low: index === 0 ? 6 : nextLow, high: index === 0 ? 6.01 : 12,
        }) }
      }) },
    })
    const centreable = withRanges(7)
    load(centreable, [figure])
    const { rerender } = render(<DifferTool sid={sid} view={centreable} />)
    const midpoint = expectedPosition(6, 12, 6.005)
    expect(barEndpoints()[0]![0]).toBeCloseTo(midpoint - 0.8)
    expect(barEndpoints()[0]![1]).toBeCloseTo(midpoint + 0.8)

    rerender(<DifferTool sid={sid} view={withRanges(6.02)} />)
    const [short, larger] = barEndpoints()
    expect(short![0]).toBeCloseTo(midpoint - 0.8)
    expect(short![1]).toBeCloseTo(expectedPosition(6, 12, 6.02))
    expect(short![1]).toBeLessThanOrEqual(larger![0])
    expect(short![0]).toBeGreaterThanOrEqual(0)
    expect(larger![1]).toBeLessThanOrEqual(100)
  })

  it('uses the typed sign of the exact link part and leaves unresolved links neutral', () => {
    const negative = core.differences.find((d) => d.kind === 'link' && d.record !== link.record)!
    const unresolved = { ...link, record: factors[0]!.record, goal: '', goal_label: '' }
    const signedView: View = {
      ...view,
      model: {
        ...view.model!,
        links: view.model!.links.map((edge): ViewLink => {
          if (!edge.remove || edge.remove.record !== 'first_cash_timing') return edge
          return { ...edge, causal: {
            sign: edge.remove.part === 'time_to_contract' ? 'increases' : 'decreases',
            of: 'more_of_from', target: edge.to, disputed: false, author: null, text: edge.title,
            strength: { state: 'unsized', figure: null, low: null, likely: null, high: null, unit: null, per: null, share: null, relative_to: null },
          } }
        }),
      },
    }
    load(signedView, [link, negative, unresolved])
    render(<DifferTool sid={sid} view={signedView} />)
    const icon = (d: Difference) => choose(d).querySelector('svg')?.parentElement
    expect(icon(link)).toHaveClass('text-[color:var(--edge-positive)]')
    expect(icon(negative)).toHaveClass('text-[color:var(--edge-negative)]')
    expect(icon(unresolved)).toHaveClass('text-[color:var(--edge-neutral)]')
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

  it('keeps the same record’s aims separate and points the canvas at the chosen cards', () => {
    load(view)
    const cards = [...figure.cards!, ...link.cards!]
    const select = vi.spyOn(useCanvasStore.getState(), 'selectNodes')
    const centre = vi.fn()
    const unregister = registerFocusHelpers(centre, vi.fn())
    disposers.push(unregister)
    const { container, unmount } = render(<>
      {cards.map((id) => <div key={id} className="react-flow__node" data-id={id} />)}
      <DifferTool sid={sid} view={view} />
    </>)
    const lit = () => [...container.querySelectorAll('.react-flow__node.v10-lit')].map((node) => node.getAttribute('data-id'))

    expect(lit()).toEqual(figure.cards)
    expect(select).toHaveBeenCalledWith(figure.cards)
    expect(centre).not.toHaveBeenCalled()
    expect(selectedNodes()).toEqual(figure.cards)

    fireEvent.click(choose(link))
    expect(lit()).toEqual(link.cards)
    expect(selectedNodes()).toEqual([])
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
    expect(lit()).toEqual([])
    expect(within(within(tool()).getByTestId('tool-differ-sides')).queryByRole('button')).toBeNull()

    fireEvent.click(choose(figure))
    const rowPress = within(ranges()!).getByRole('button', { name: /Priya/ })
    fireEvent.click(rowPress)
    expect(centre).toHaveBeenCalledTimes(1)
    expect(centre).toHaveBeenCalledWith(figure.cards![0])
    expect(selectedNodes()).toEqual(figure.cards)
    fireEvent.click(choose(link))
    fireEvent.click(choose(figure))
    expect(selectedNodes()).toEqual(figure.cards)
    unmount()
    expect(lit()).toEqual([])
    expect(selectedNodes()).toEqual([])
  })

  it('leaves a person’s later canvas selection in place when Team closes', () => {
    load(view)
    const { unmount } = render(<DifferTool sid={sid} view={view} />)
    const personSelected = [link.cards![0]!]
    act(() => useCanvasStore.getState().selectNodes(personSelected))
    unmount()
    expect(selectedNodes()).toEqual(personSelected)
  })
})
