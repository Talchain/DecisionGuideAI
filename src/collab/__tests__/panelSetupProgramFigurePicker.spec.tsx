/**
 * S4 (30 Oct): on a MODEL PROGRAM scenario the owner picks the figure a panel answers by its label, never by typing a
 * quantity id. The figures offered are the program's own (`living_model.canonical.quantities`, fixture: a served staging
 * row) that a person can give directly: an estimated figure (never a worked-out one) on a unitless, % or per-period scale.
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import served from '../../pages/__tests__/fixtures/panel-quantities.json'

vi.mock('../../lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase')>()
  return { ...actual, getSessionIdentity: vi.fn() }
})
const svc = vi.hoisted(() => ({ loadScenario: vi.fn() }))
vi.mock('../../services/scenarioService', () => ({ loadScenario: svc.loadScenario }))
vi.mock('../../services/scenarioSharingService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/scenarioSharingService')>()
  return { ...actual, listScenarioMembers: vi.fn(async () => ({ ok: true, members: [] })) }
})

import { getSessionIdentity } from '../../lib/supabase'
import PanelSetupPage, { panelAnswerableQuantities } from '../../pages/PanelSetupPage'

const SCENARIO_ID = '2c6eaf55-0000-4000-8000-000000000000'
const MINT_URL = '/bff/collab/rounds'
const programRow = { id: SCENARIO_ID, graph: { nodes: [], edges: [], living_model: { model_program: 'v1', canonical: { quantities: served.quantities } } } }
let fetchMock: Mock

function renderPage(search = ''): void {
  render(
    <MemoryRouter initialEntries={[`/scenario/${SCENARIO_ID}/panel${search}`]}>
      <Routes><Route path="/scenario/:id/panel" element={<PanelSetupPage />} /></Routes>
    </MemoryRouter>,
  )
}
const picker = () => screen.getByTestId('panel-target-id') as HTMLSelectElement
const offered = () => Array.from(picker().options).filter(o => o.value !== '').map(o => o.textContent)

beforeEach(() => {
  cleanup()
  svc.loadScenario.mockReset()
  fetchMock = vi.fn(async (input: RequestInfo | URL) => String(input) === MINT_URL
    ? { ok: true, status: 200, json: async () => ({ round_id: 'r1', graph_version_ref: 'gv', participants: [] }) }
    : { ok: false, status: 404, json: async () => ({}) })
  vi.stubGlobal('fetch', fetchMock)
  vi.mocked(getSessionIdentity).mockResolvedValue({ userId: 'owner-1', accessToken: 'owner-token' })
  window.localStorage.clear()
})
afterEach(() => { vi.unstubAllGlobals() })

describe('S4: a program scenario offers its panel-answerable figures by label', () => {
  it('offers exactly the estimated %, unitless or per-period figures; never a worked-out one or a compound unit', () => {
    expect(panelAnswerableQuantities(programRow.graph)!.map(q => q.id)).toEqual(['monthly_churn', 'churn_warning'])
  })

  it('a bare per-period unit ("/month") is not a chance: only unitless, 1, %, 1/period or %/period', () => {
    const graph = { living_model: { model_program: 'v1', canonical: { quantities: [
      { id: 'a', label: 'A', unit: '/month', kind: 'fact' }, { id: 'b', label: 'B', unit: '1/month', kind: 'fact' },
      { id: 'c', label: 'C', unit: '%/week', kind: 'coefficient' }, { id: 'd', label: 'D', unit: null, kind: 'fact' },
      { id: 'e', label: 'E', unit: '1/month/%', kind: 'fact' }] } } }
    expect(panelAnswerableQuantities(graph)!.map(q => q.id)).toEqual(['b', 'c', 'd'])
  })

  it('a program with no such figure says so plainly', async () => {
    svc.loadScenario.mockResolvedValue({ id: SCENARIO_ID, graph: { living_model: { model_program: 'v1', canonical: { quantities: [] } } } })
    renderPage()
    await waitFor(() => expect(picker().tagName).toBe('SELECT'))
    expect(picker().options[0]!.textContent).toBe('No figure here can be answered as a chance yet.')
  })

  it('the picker lists them by label, and picking one mints target {kind: factor, id: quantity_id} with its label and unit', async () => {
    svc.loadScenario.mockResolvedValue(programRow)
    renderPage()
    await waitFor(() => expect(picker().tagName).toBe('SELECT'))
    expect(offered()).toEqual(['Monthly customer churn', 'Churn above which losses are a danger'])
    fireEvent.change(picker(), { target: { value: 'monthly_churn' } })
    fireEvent.change(screen.getByTestId('panel-name-a'), { target: { value: 'Ana' } })
    fireEvent.click(screen.getByTestId('panel-mint'))
    await waitFor(() => expect(fetchMock.mock.calls.some(c => String(c[0]) === MINT_URL)).toBe(true))
    const body = JSON.parse(String(fetchMock.mock.calls.find(c => String(c[0]) === MINT_URL)![1].body))
    const q = served.quantities.find(x => x.id === 'monthly_churn')!
    expect(body.targets).toEqual([expect.objectContaining({ target: { kind: 'factor', id: 'monthly_churn' }, label: q.label, unit: q.unit })])
  })

  it('a selected card that a panel can answer arrives preselected', async () => {
    svc.loadScenario.mockResolvedValue(programRow)
    renderPage('?factor=churn_warning')
    await waitFor(() => expect(picker().value).toBe('churn_warning'))
  })

  it('a selected card a panel cannot answer (a worked-out figure) is not offered: the picker starts empty', async () => {
    svc.loadScenario.mockResolvedValue(programRow)
    renderPage('?factor=monthly_churn_rate')
    await waitFor(() => expect(picker().tagName).toBe('SELECT'))
    expect(picker().value).toBe('')
    // The form holds no target either: the round cannot be opened on the worked-out figure.
    await waitFor(() => expect(screen.getByTestId('panel-mint')).toBeDisabled())
  })

  it('while the figures load: a loading line, no free-text field, and the round cannot be opened', async () => {
    svc.loadScenario.mockReturnValue(new Promise(() => undefined))
    renderPage('?factor=monthly_churn_rate')
    expect(screen.getByTestId('panel-target-id').tagName).toBe('P')
    expect(screen.getByTestId('panel-target-id').textContent).toBe('Loading the figures in your model…')
    fireEvent.change(screen.getByTestId('panel-name-a'), { target: { value: 'Ana' } })
    expect(screen.getByTestId('panel-mint')).toBeDisabled()
  })

  it('when the figures cannot be loaded: says so plainly, and the round cannot be opened', async () => {
    svc.loadScenario.mockRejectedValue(new Error('offline'))
    renderPage('?factor=monthly_churn')
    await waitFor(() => expect(screen.getByTestId('panel-target-id').textContent).toBe('The figures couldn’t be loaded. Try again in a moment.'))
    expect(screen.getByTestId('panel-mint')).toBeDisabled()
  })

  it('program A, then a legacy B in the same page (no remount): B gets the id field', async () => {
    svc.loadScenario.mockImplementation(async (id: string) => (id === SCENARIO_ID ? programRow : { id, graph: { nodes: [], edges: [] } }))
    function GoToB() { const go = useNavigate(); return <button data-testid="go-b" onClick={() => go('/scenario/legacy-b/panel')}>B</button> }
    render(
      <MemoryRouter initialEntries={[`/scenario/${SCENARIO_ID}/panel`]}>
        <GoToB /><Routes><Route path="/scenario/:id/panel" element={<PanelSetupPage />} /></Routes>
      </MemoryRouter>,
    )
    await waitFor(() => expect(picker().tagName).toBe('SELECT'))
    fireEvent.click(screen.getByTestId('go-b'))
    await waitFor(() => expect(screen.getByTestId('panel-target-id').tagName).toBe('INPUT'))
  })

  it('NEGATIVE: a scenario that is not a program keeps the id field', async () => {
    svc.loadScenario.mockResolvedValue({ id: SCENARIO_ID, graph: { nodes: [], edges: [] } })
    renderPage()
    await waitFor(() => expect(svc.loadScenario).toHaveBeenCalledWith(SCENARIO_ID))
    expect(screen.getByTestId('panel-target-id').tagName).toBe('INPUT')
  })
})
