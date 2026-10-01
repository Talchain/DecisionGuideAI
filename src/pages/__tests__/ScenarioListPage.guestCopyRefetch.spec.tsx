/**
 * ACCOUNTS B3 — "My decisions" refetches when a guest copy lands after the hub
 * has already mounted and fetched (the usual order: sign-in lands on `/` first).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// A STABLE identity: a fresh user object per render would change `fetchScenarios`
// and re-fetch on every render, which says nothing about the copy event.
const authState = vi.hoisted(() => ({ user: { id: 'u1', email: 'test@example.com' }, profile: null, authenticated: true }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => authState }))
vi.mock('../../hooks/useScenario', () => ({
  useScenario: () => ({ createScenario: vi.fn(), deleteScenario: vi.fn(), isPersistenceActive: true }),
}))
const mockListScenarios = vi.fn()
vi.mock('../../services/scenarioService', () => ({
  listScenarios: (...args: unknown[]) => mockListScenarios(...args),
  pinScenario: vi.fn(),
  archiveScenario: vi.fn(),
  duplicateScenario: vi.fn(),
}))
vi.mock('../../lib/posthog', () => ({ trackEvent: vi.fn() }))

import ScenarioListPage from '../ScenarioListPage'
import { GUEST_COPIED_EVENT } from '../../lib/guestCopyOnSignIn'

const COPY = '3b241101-e2bb-4255-8caf-4136c566a962'
const row = (id: string, title: string) => ({
  id, title, stage: 'frame' as const, analysis_status: 'none' as const,
  updated_at: new Date().toISOString(), created_at: new Date().toISOString(),
  is_pinned: false, is_archived: false, events: [] as unknown[],
})

let copied = false

beforeEach(() => {
  copied = false
  mockListScenarios.mockReset()
  mockListScenarios.mockImplementation(async () =>
    copied ? [row('s1', 'Existing decision'), row(COPY, 'Guest decision')] : [row('s1', 'Existing decision')],
  )
})

describe('ScenarioListPage — guest copy refetch', () => {
  it('the copied decision appears in the list once the copy is announced', async () => {
    render(<MemoryRouter><ScenarioListPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Existing decision')).toBeTruthy())
    const callsBefore = mockListScenarios.mock.calls.length
    copied = true // the server copy has landed; nothing re-fetches on its own
    await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
    expect(screen.queryByText('Guest decision')).toBeNull()
    expect(mockListScenarios.mock.calls.length).toBe(callsBefore)

    act(() => {
      window.dispatchEvent(new CustomEvent(GUEST_COPIED_EVENT, { detail: { sourceScenarioId: 'x', scenarioId: COPY, created: true } }))
    })

    await waitFor(() => expect(screen.getByText('Guest decision')).toBeTruthy())
    expect(mockListScenarios.mock.calls.length).toBe(callsBefore + 1)
    expect(mockListScenarios).toHaveBeenLastCalledWith('u1')
  })
})
