import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
import { DIFFER_TOOL_WORDS, DifferTool } from '../DifferTool'
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
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unexpected network request')))
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
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

function load(given: View, differences = core.differences) {
  const key = differencesKey(sid, given)
  useDifferences.setState({ sid, key, read: key, data: { ...core, differences } })
}

const tool = () => screen.getByTestId('tool-differ')
const picker = () => within(tool()).getByRole('button', { name: new RegExp(`^${DIFFER_TOOL_WORDS.all} `) })
const choices = () => within(document.getElementById(picker().getAttribute('aria-controls')!)!)
const choice = (d: Difference) => choices().getByRole('button', {
  name: [d.label, ...(d.goal_label ? [d.goal_label] : d.sides.map((side) => side.holder))].join(' '),
})
function choose(d: Difference) {
  fireEvent.click(picker())
  fireEvent.click(choice(d))
}
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
  it('shows one difference above the axis until the count control opens all seven choices', async () => {
    load(view)
    const user = userEvent.setup()
    render(<DifferTool sid={sid} view={view} />)

    const control = picker()
    expect(control).toHaveAccessibleName(`${DIFFER_TOOL_WORDS.all} (7)`)
    expect(control).toHaveAttribute('aria-expanded', 'false')
    expect(choices().queryByRole('list')).toBeNull()
    expect(within(tool()).queryByText(link.label)).toBeNull()

    const axis = ranges()!
    const selectedRow = axis.previousElementSibling as HTMLElement
    expect(within(selectedRow).getByText(figure.label)).toBeVisible()
    expect(within(selectedRow).getByText(figure.goal_label)).toBeVisible()
    expect(axis).toBeVisible()

    await user.tab()
    expect(control).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(control).toHaveAttribute('aria-expanded', 'true')
    expect(choices().getAllByRole('listitem')).toHaveLength(7)
    expect(choice(figure)).toHaveAttribute('aria-pressed', 'true')
    expect(axis.previousElementSibling).toBe(selectedRow)

    await user.tab()
    await user.tab()
    expect(choice(link)).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(control).toHaveAttribute('aria-expanded', 'false')
    expect(control).toHaveFocus()
    expect(choices().queryByRole('list')).toBeNull()
    const nextAxis = within(tool()).getByTestId('tool-differ-sides')
    expect(nextAxis.previousElementSibling).toBe(selectedRow)
    expect(within(selectedRow).getByText(link.label)).toBeVisible()
    expect(within(selectedRow).getByText(link.goal_label)).toBeVisible()
  })

  it('shares one read with the revealed step and hides on a historical View', async () => {
    const before = { ...view, collab: { ...view.collab, shared: [] } }
    useViewStore.setState({ view: before })
    render(<><TeamTab /><CompareViewsStage /></>)
    expect(screen.queryByTestId('tool-differ')).toBeNull()
    expect(differenceReads()).toBe(0)

    act(() => useViewStore.setState({ view }))
    const revealedTool = await screen.findByTestId('tool-differ')
    const team = screen.getByTestId('team-tab')
    // Team opens on the people view (Paul, 27 Nov): the heading and members first, then the differences tool, before the steps.
    expect(team.firstElementChild).toContainElement(screen.getByTestId('team-views-heading'))
    expect(revealedTool.compareDocumentPosition(screen.getByTestId('team-views-heading')) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    expect(revealedTool.compareDocumentPosition(within(team).getByTestId('differ-after')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
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

  it('hides the tool and clears its ring on a same-version refresh with a stale response', async () => {
    const current = { ...view, signature: view.signature + '2' }
    const matchKey = differencesKey(sid, current)
    const { rerender } = render(<DifferTool sid={sid} view={view} />)
    await screen.findByTestId('tool-differ')
    expect(ringFrom).toHaveBeenLastCalledWith('tool-differ', figure.cards)
    vi.mocked(ringFrom).mockClear()

    fetchTeam.mockRejectedValueOnce(new Error('connection lost'))
    rerender(<DifferTool sid={sid} view={current} />)
    expect(screen.queryByTestId('tool-differ')).toBeNull()
    await waitFor(() => expect(useDifferences.getState()).toMatchObject({
      key: matchKey, read: differencesKey(sid, view), error: expect.any(String),
    }))
    expect(screen.queryByTestId('tool-differ')).toBeNull()
    expect(vi.mocked(ringFrom).mock.calls).toEqual([['tool-differ', []]])
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
    choose(sameLinkOtherAim)
    unmount()

    const other = { ...view, id: sid + '2' }
    const key = differencesKey(other.id, other)
    useDifferences.setState({ sid: other.id, key, read: key, data: { ...core, scenario: other.id } })
    const { rerender } = render(<DifferTool sid={other.id} view={other} />)
    expect(within(tool()).getByText(figure.label)).toBeVisible()
    load(view)
    rerender(<DifferTool sid={sid} view={view} />)
    expect(within(tool()).getByText(sameLinkOtherAim.label)).toBeVisible()
    expect(within(tool()).getByText(sameLinkOtherAim.goal_label)).toBeVisible()
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

    expect(picker()).toHaveAccessibleName(`${DIFFER_TOOL_WORDS.all} (2)`)
    const tomBefore = expectBarEndpoints([[6, 12], [1, 3]])[1]!
    expect(within(ranges()!).getByText(figure.sides[0]!.figure)).toBeVisible()
    expect(within(ranges()!).getByText(figure.sides[1]!.figure)).toBeVisible()

    choose(second)
    expect(within(tool()).getByText(second.label)).toBeVisible()
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

    choose(link)
    expect(ringFrom).toHaveBeenLastCalledWith('tool-differ', link.cards)
    expect(ranges()).toBeNull()
    choose(sameLinkOtherAim)
    fireEvent.click(picker())
    expect(choice(link)).toHaveAttribute('aria-pressed', 'false')
    expect(choice(sameLinkOtherAim)).toHaveAttribute('aria-pressed', 'true')
    expect(within(choice(link)).getByText(link.goal_label)).toBeVisible()
    for (const side of link.sides) expect(within(choice(link)).queryByText(side.holder)).toBeNull()

    for (const factor of factors) {
      const holders = factor.sides.map((side) => side.holder).join(' ')
      const selector = choices().getByRole('button', { name: `${factor.label} ${holders}`, description: holders })
      for (const side of factor.sides) expect(within(selector).getByText(side.holder)).toBeVisible()
    }
    const intended = factors[1]!
    const holders = intended.sides.map((side) => side.holder).join(' ')
    fireEvent.click(choices().getByRole('button', { name: `${intended.label} ${holders}`, description: holders }))
    const rows = within(tool()).getByTestId('tool-differ-sides')
    const selectedRow = rows.previousElementSibling as HTMLElement
    expect(within(selectedRow).getByText(intended.label)).toBeVisible()
    for (const side of intended.sides) expect(within(selectedRow).getByText(side.holder)).toBeVisible()
    expect(within(rows).getByText(intended.sides[0]!.holder)).toBeVisible()
    expect(within(rows).queryByText(factors[0]!.sides[0]!.holder)).toBeNull()
    expect(ringFrom).toHaveBeenLastCalledWith('tool-differ', [])
    expect(within(rows).queryByRole('button')).toBeNull()
    expect(pressCard).not.toHaveBeenCalled()

    choose(figure)
    expect(ringFrom).toHaveBeenLastCalledWith('tool-differ', figure.cards)
    const rowPress = within(ranges()!).getByRole('button', { name: /Priya/, description: COMPARE_WORDS.toCanvas })
    fireEvent.click(rowPress)
    expect(pressCard).toHaveBeenCalledTimes(1)
    expect(pressCard).toHaveBeenCalledWith(figure.cards![0])

    unmount()
    expect(ringFrom).toHaveBeenLastCalledWith('tool-differ', [])
  })
})
