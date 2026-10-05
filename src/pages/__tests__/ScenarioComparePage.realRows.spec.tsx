/**
 * The compare page against REAL saved rows and REAL server reads.
 *
 * The fixture is a read-only capture from staging (4 Oct 2026), ids redacted. Two earlier fixes to this page were
 * written against invented shapes and failed on served staging; these tests bind to what is actually stored:
 *   - `title: null` and `framing: null` on every CEE-drafted row; the name lives on the graph's goal node;
 *   - flat nodes (`{ id, ref, kind, label }`) and edges WITHOUT an id (`{ from, to, strength }`);
 *   - a read that answers only when the user's access token is sent (404 "No readable graph" otherwise).
 *
 * `fetchScenarioGraph` is NOT mocked: the stubbed `fetch` behaves like the served route, so the header the page
 * sends and the body the adapter parses are both the real ones.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { ScenarioRow } from '../../types/scenario'
import fixture from './fixtures/realSavedScenarios.json'

const TOKEN = 'user-access-token'
const USER_ID = fixture.staleRow.user_id
const { loadScenario, listScenarios, getSessionIdentity } = vi.hoisted(() => ({ loadScenario: vi.fn(), listScenarios: vi.fn(), getSessionIdentity: vi.fn() }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: '00000000-0000-4000-8000-0000000000aa' } }) }))
vi.mock('../../services/scenarioService', () => ({ loadScenario, listScenarios }))
vi.mock('../../lib/supabase', () => ({ getSessionIdentity }))
import ScenarioComparePage from '../ScenarioComparePage'

const stale = fixture.staleRow as unknown as ScenarioRow
const current = fixture.currentRow as unknown as ScenarioRow
const reads: Record<string, unknown> = { [stale.id]: fixture.staleRead, [current.id]: fixture.currentWithheldRead }
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** The served route: it resolves an owner from the Bearer token and answers 404 without one. */
const servedFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  const id = /\/bff\/cee\/scenarios\/([^/]+)\/graph$/.exec(url)?.[1]
  const auth = new Headers(init?.headers).get('Authorization')
  if (!id || init?.method !== 'POST' || auth !== `Bearer ${TOKEN}` || !reads[id]) {
    return json(404, { schema: 'error.v1', code: 'NOT_FOUND', message: 'No readable graph for that scenario.' })
  }
  return json(200, reads[id])
})

function renderPage() {
  return render(<MemoryRouter initialEntries={[`/compare/${stale.id}`]}><Routes><Route path="/compare/:id" element={<ScenarioComparePage />} /></Routes></MemoryRouter>)
}
async function chooseOther() {
  fireEvent.change(await screen.findByLabelText('Scenario to compare'), { target: { value: current.id } })
  await waitFor(() => expect(screen.getAllByTestId('comparison-side')).toHaveLength(2))
  return screen.getAllByTestId('comparison-side')
}

describe('ScenarioComparePage on real saved rows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadScenario.mockImplementation(async (id: string) => (id === stale.id ? stale : current))
    listScenarios.mockResolvedValue([stale, current])
    getSessionIdentity.mockResolvedValue({ userId: USER_ID, accessToken: TOKEN })
    vi.stubGlobal('fetch', servedFetch)
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('the fixture is the real shape: no title, no framing, edges without ids', () => {
    expect(stale.title).toBeNull()
    expect(stale.framing).toBeNull()
    const edges = (stale.graph as { edges: Array<Record<string, unknown>> }).edges
    expect(edges.length).toBeGreaterThan(1)
    expect(edges.every(edge => !('id' in edge) && typeof edge.from === 'string' && typeof edge.to === 'string')).toBe(true)
  })

  it('names the picker entry and both columns as the canvas does, never "Untitled scenario"', async () => {
    renderPage()
    const select = await screen.findByLabelText('Scenario to compare')
    expect(within(select).getByRole('option', { name: 'monthly recurring revenue' })).toHaveValue(current.id)
    const sides = await chooseOther()
    sides.forEach(side => expect(within(side).getByRole('heading', { level: 2 })).toHaveTextContent('monthly recurring revenue'))
    expect(screen.queryByText('Untitled scenario')).not.toBeInTheDocument()
  })

  it('sends the user access token with each read, as the canvas does, and shows what the server affirmed', async () => {
    renderPage()
    const [left, right] = await chooseOther()
    await waitFor(() => expect(servedFetch).toHaveBeenCalledTimes(2))
    for (const [input, init] of servedFetch.mock.calls) {
      expect(String(input)).toMatch(/^\/bff\/cee\/scenarios\/[^/]+\/graph$/)
      expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${TOKEN}`)
    }
    // Left: the server says its last Run is out of date (`complete_stale`, no result block).
    await waitFor(() => expect(within(left).getByTestId('comparison-result')).toHaveTextContent('The model has changed since it was last analysed'))
    // Right: a current Run whose leader claim the producer withheld (`leading_option_id: null`).
    const rightResult = within(right).getByTestId('comparison-result')
    expect(rightResult).toHaveTextContent('The analysis ran on the current model and does not single out a leading option.')
    expect(rightResult).toHaveTextContent('Raise prices 10%')
    expect(rightResult).toHaveTextContent('Launch £49 starter tier')
    expect(screen.queryByText("Couldn't load this scenario's result")).not.toBeInTheDocument()
    expect(screen.queryByText(/No current result/)).not.toBeInTheDocument()
  })

  it('says the result could not be loaded only when the read does not answer (no token → 404)', async () => {
    getSessionIdentity.mockResolvedValue({ userId: USER_ID, accessToken: null })
    renderPage()
    await chooseOther()
    await waitFor(() => expect(screen.getAllByText("Couldn't load this scenario's result")).toHaveLength(2))
  })

  it('tells stored links apart by their endpoints (stored links carry no id)', async () => {
    renderPage()
    await chooseOther()
    type Edge = { from: string; to: string }
    const key = (edge: Edge) => `${edge.from}>${edge.to}`
    const leftEdges = (stale.graph as { edges: Edge[] }).edges
    const rightEdges = (current.graph as { edges: Edge[] }).edges
    const shared = leftEdges.filter(edge => rightEdges.some(other => key(other) === key(edge))).length
    expect(shared).toBeGreaterThan(0)
    const group = screen.getByRole('heading', { level: 3, name: 'Links' }).parentElement as HTMLElement
    const lines = [...group.querySelectorAll('p')].map(line => line.textContent ?? '')
    // Every link only one side has is listed once, as removed or added. Keyed on a missing `id`, every left link
    // collided with one right link and was reported as "changed".
    expect(lines.filter(line => line.includes('Removed:'))).toHaveLength(leftEdges.length - shared)
    expect(lines.filter(line => line.includes('Added:'))).toHaveLength(rightEdges.length - shared)
    expect(lines.filter(line => / changed/.test(line)).length).toBeLessThanOrEqual(shared)
  })

  it('shows no raw science figures by default', async () => {
    renderPage()
    const sides = await chooseOther()
    await waitFor(() => expect(servedFetch).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(within(sides[1]).getByTestId('comparison-result')).toHaveTextContent('does not single out'))
    sides.forEach(side => expect(within(side).getByTestId('comparison-result').textContent).not.toMatch(/\d\.\d|\d+\s?%\s?(chance|probab|of runs)/))
  })
})
