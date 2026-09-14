/**
 * THE MODEL LIST SURVIVES A NEW BROWSER.
 *
 * `ScenarioSwitcher` — mounted in BOTH the toolbar and the top bar — listed from
 * `store/scenarios.loadScenarios()`, which is `localStorage.getItem(STORAGE_KEY)`
 * and returns `[]` when absent. **Zero Supabase.** So a SIGNED-IN user on a
 * second machine, or one whose browser storage was cleared, opened this dropdown
 * and read "No saved scenarios yet" while their models sat intact on the server.
 *
 * Paul hit exactly that on 11 Sep 2026: *"No graph is being displayed at all."*
 *
 * The server-backed list already existed (`scenarioService.listScenarios`, behind
 * `#/scenarios`); nothing on the canvas pointed at it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockListScenarios = vi.fn()
let authState: { user: { id: string } | null; authenticated: boolean } = {
  user: { id: 'user-real' }, authenticated: true,
}

vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../../store/scenarios', () => ({
  loadScenarios: vi.fn(() => []),
  getScenario: vi.fn(),
  createScenario: vi.fn(),
  updateScenario: vi.fn(),
  deleteScenario: vi.fn(),
  importScenarioFromFile: vi.fn(),
}))
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => authState }))
vi.mock('../../../services/scenarioService', () => ({ listScenarios: (...a: unknown[]) => mockListScenarios(...a) }))

import { ScenarioSwitcher } from '../ScenarioSwitcher'
import { ToastProvider } from '../../ToastContext'
import { useCanvasStore } from '../../store'
import * as scenarios from '../../store/scenarios'

function row(id: string, title: string, updated: string, extra: Record<string, unknown> = {}) {
  return { id, title, updated_at: updated, created_at: updated, is_archived: false, ...extra }
}

function open() {
  render(<ToastProvider><ScenarioSwitcher /></ToastProvider>)
  // Same trigger the existing ScenarioSwitcher spec uses — the collapsed
  // dropdown button — rather than a positional guess.
  fireEvent.click(screen.getByRole('button', { expanded: false }))
}

beforeEach(() => {
  vi.clearAllMocks()
  authState = { user: { id: 'user-real' }, authenticated: true }
  mockListScenarios.mockResolvedValue([])
  ;(scenarios.loadScenarios as ReturnType<typeof vi.fn>).mockReturnValue([])
  ;(useCanvasStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((sel: (s: unknown) => unknown) =>
    sel({
      currentScenarioId: null, isDirty: false, saveStatus: 'saved',
      saveCurrentScenario: vi.fn(), loadScenario: vi.fn(), duplicateCurrentScenario: vi.fn(),
      renameCurrentScenario: vi.fn(), deleteScenario: vi.fn(), nodes: [], edges: [],
    }),
  )
})

describe('ScenarioSwitcher — the list survives a new browser', () => {
  it('a signed-in user with EMPTY local storage sees their server models — the defect', async () => {
    mockListScenarios.mockResolvedValue([row('srv-1', 'Cut Support Response Times', '2026-09-11T08:00:00Z')])
    open()
    // PRECONDITION: local really is empty, so a pass cannot come from localStorage.
    expect((scenarios.loadScenarios as ReturnType<typeof vi.fn>)()).toEqual([])
    await waitFor(() => expect(screen.getByText('Cut Support Response Times')).toBeDefined())
  })

  it('⛔ a GUEST never reaches the server', async () => {
    authState = { user: { id: 'guest' }, authenticated: true }
    open()
    await waitFor(() => expect(mockListScenarios).not.toHaveBeenCalled())
  })

  it('⛔ FAILS SOFT — a rejected list leaves the local list exactly as it was', async () => {
    ;(scenarios.loadScenarios as ReturnType<typeof vi.fn>).mockReturnValue([
      { id: 'loc-1', name: 'Local model', createdAt: 1, updatedAt: 2 },
    ])
    mockListScenarios.mockRejectedValue(new Error('network down'))
    open()
    // The local row must still be there — never an empty dropdown, never a throw.
    await waitFor(() => expect(screen.getByText('Local model')).toBeDefined())
  })

  it('⛔ LOCAL WINS on an id collision — the local record carries the graph', async () => {
    ;(scenarios.loadScenarios as ReturnType<typeof vi.fn>).mockReturnValue([
      { id: 'dup', name: 'The local name', createdAt: 1, updatedAt: 2 },
    ])
    mockListScenarios.mockResolvedValue([row('dup', 'The server name', '2026-09-11T08:00:00Z')])
    open()
    await waitFor(() => expect(screen.getByText('The local name')).toBeDefined())
    // Preferring the server copy would replace a loadable record with a lighter one.
    expect(screen.queryByText('The server name')).toBeNull()
  })

  it('excludes archived rows', async () => {
    mockListScenarios.mockResolvedValue([
      row('a', 'Live model', '2026-09-11T08:00:00Z'),
      row('b', 'Archived model', '2026-09-11T08:00:00Z', { is_archived: true }),
    ])
    open()
    await waitFor(() => expect(screen.getByText('Live model')).toBeDefined())
    // CONTROL: the live one IS rendered, so the absence below is meaningful.
    expect(screen.queryByText('Archived model')).toBeNull()
  })
})
