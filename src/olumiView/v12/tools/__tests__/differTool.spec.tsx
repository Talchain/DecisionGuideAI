import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasStore } from '../../../../canvas/store'
import { useMe } from '../../../../olumiCore/me'
import { setTeamFetch } from '../../../../olumiCore/team/api'
import { differencesKey, resetDifferences, useDifferences, type Difference, type Differences } from '../../../../olumiCore/team/differences'
import { resetTeamFlow } from '../../../../olumiCore/team/flow'
import { TeamTab } from '../../../../olumiCore/team/TeamTab'
import type { View } from '../../../client'
import crossingResponse from '../../../fixtures/debate/differences.core.json'
import coreResponse from '../../../fixtures/debate/tm04-differences.core.json'
import revealedView from '../../../fixtures/debate/tm04-cara.view3.json'
import { useViewStore } from '../../../store'
import { DifferTool } from '../DifferTool'

const view = revealedView as unknown as View
const core = coreResponse as Differences
const sid = view.id
const [figure, link, sameLinkOtherAim] = core.differences as readonly [Difference, Difference, Difference, ...Difference[]]
const factor = core.differences.find((d) => d.kind === 'factor')!

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
const choose = (d: Difference) => within(tool()).getByRole('button', { name: [d.label, d.goal_label].filter(Boolean).join(' ') })
const ranges = () => within(tool()).queryByTestId('tool-differ-ranges')
const selectedNodes = () => [...useCanvasStore.getState().selection.nodeIds]

describe('Where we differ in Team', () => {
  it('leads Team once views are revealed, and hides on a historical View', async () => {
    const before = { ...view, collab: { ...view.collab, shared: [] } }
    useViewStore.setState({ view: before })
    render(<TeamTab />)
    expect(screen.queryByTestId('tool-differ')).toBeNull()
    expect(fetchTeam.mock.calls.some(([url]) => String(url).endsWith('/differences'))).toBe(false)

    act(() => useViewStore.setState({ view }))
    const revealedTool = await screen.findByTestId('tool-differ')
    expect(screen.getByTestId('team-tab').firstElementChild).toBe(revealedTool)

    act(() => useViewStore.setState({ at: 1 }))
    expect(screen.queryByTestId('tool-differ')).toBeNull()
  })

  it('hides an older response after the View changes, including after a failed read', () => {
    const current = { ...view, signature: view.signature + '2' }
    load(current, core.differences, differencesKey(sid, view))
    render(<DifferTool sid={sid} view={current} />)
    expect(screen.queryByTestId('tool-differ')).toBeNull()
    act(() => load(current, []))
    expect(screen.queryByTestId('tool-differ')).toBeNull()
    act(() => load(current))
    expect(tool()).toBeInTheDocument()
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
    const marks = () => [...ranges()!.querySelectorAll('svg[data-range-lo]')].map((row) => [
      row.getAttribute('data-range-lo'), row.getAttribute('data-range-hi'),
    ])
    expect(marks()).toEqual([['6', '12'], ['1', '3']])
    const starts = [...ranges()!.querySelectorAll('[data-range-mark]')].map((mark) => Number(mark.getAttribute('x')))
    expect(starts[0]).toBeGreaterThan(starts[1]!)
    expect(within(ranges()!).getByText(figure.sides[0]!.figure)).toBeVisible()
    expect(within(ranges()!).getByText(figure.sides[1]!.figure)).toBeVisible()

    fireEvent.click(choose(second))
    expect(choose(second)).toHaveAttribute('aria-pressed', 'true')
    expect(marks()).toEqual([['1', '2'], ['1', '3']])
    expect(within(ranges()!).getByText(maya.by)).toBeVisible()
    expect(within(ranges()!).getByText(mayaFigure.text)).toBeVisible()
    expect(within(ranges()!).queryByText(figure.sides[0]!.figure)).toBeNull()
    expect(selectedNodes()).toEqual([second.record])
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
    const { container, unmount } = render(<>
      {cards.map((id) => <div key={id} className="react-flow__node" data-id={id} />)}
      <DifferTool sid={sid} view={view} />
    </>)
    const lit = () => [...container.querySelectorAll('.react-flow__node.v10-lit')].map((node) => node.getAttribute('data-id'))

    expect(lit()).toEqual(figure.cards)
    expect(select).toHaveBeenCalledWith(figure.cards)
    expect(selectedNodes()).toEqual(figure.cards)

    fireEvent.click(choose(link))
    expect(lit()).toEqual(link.cards)
    expect(selectedNodes()).toEqual([])
    expect(ranges()).toBeNull()
    fireEvent.click(choose(sameLinkOtherAim))
    expect(choose(link)).toHaveAttribute('aria-pressed', 'false')
    expect(choose(sameLinkOtherAim)).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(within(tool()).getAllByRole('button', { name: factor.label })[0]!)
    expect(lit()).toEqual([])
    expect(within(within(tool()).getByTestId('tool-differ-sides')).queryByRole('button')).toBeNull()

    fireEvent.click(choose(figure))
    const rowPress = within(ranges()!).getByRole('button', { name: /Priya/ })
    fireEvent.click(rowPress)
    expect(selectedNodes()).toEqual([])
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
