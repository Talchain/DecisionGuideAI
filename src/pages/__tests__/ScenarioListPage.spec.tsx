/**
 * ScenarioListPage tests — C.1b Task 4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

let mockAuthValue = { user: null as { id: string } | null, authenticated: false }
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthValue,
}))

const mockCreateScenario = vi.fn()
const mockDeleteScenario = vi.fn()
vi.mock('../../hooks/useScenario', () => ({
  useScenario: () => ({
    createScenario: mockCreateScenario,
    deleteScenario: mockDeleteScenario,
    isPersistenceActive: mockAuthValue.authenticated && mockAuthValue.user?.id !== 'guest',
  }),
}))

const mockListScenarios = vi.fn()
vi.mock('../../services/scenarioService', () => ({
  listScenarios: (...args: unknown[]) => mockListScenarios(...args),
}))

import ScenarioListPage from '../ScenarioListPage'

const USER_ID = '550e8400-e29b-41d4-a716-446655440000'

function renderPage() {
  return render(
    <MemoryRouter>
      <ScenarioListPage />
    </MemoryRouter>,
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScenarioListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthValue = { user: { id: USER_ID }, authenticated: true }
  })

  it('renders loading skeleton on mount', () => {
    mockListScenarios.mockReturnValue(new Promise(() => {})) // never resolves
    renderPage()
    expect(screen.getByTestId('scenario-list-skeleton')).toBeTruthy()
  })

  it('renders scenario rows after fetch', async () => {
    mockListScenarios.mockResolvedValue([
      {
        id: 's1',
        title: 'Pricing strategy',
        stage: 'evaluate',
        analysis_status: 'ready',
        updated_at: new Date().toISOString(),
        events: [],
      },
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Pricing strategy')).toBeTruthy()
    })

    expect(screen.getByText('Evaluate')).toBeTruthy()
  })

  it('shows empty state when no scenarios', async () => {
    mockListScenarios.mockResolvedValue([])
    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('first-run')).toBeTruthy()
    })

    expect(screen.getByText('Welcome to Olumi')).toBeTruthy()
  })

  it('navigates to /scenario/:id on row click', async () => {
    mockListScenarios.mockResolvedValue([
      {
        id: 's1',
        title: 'Test',
        stage: 'frame',
        analysis_status: 'none',
        updated_at: new Date().toISOString(),
        events: [],
      },
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Test')).toBeTruthy()
    })

    fireEvent.click(screen.getByTestId('scenario-card'))
    expect(mockNavigate).toHaveBeenCalledWith('/scenario/s1')
  })

  it('creates new scenario on button click', async () => {
    mockListScenarios.mockResolvedValue([])
    mockCreateScenario.mockResolvedValue('new-id')

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('first-run')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Start a new decision'))

    await waitFor(() => {
      expect(mockCreateScenario).toHaveBeenCalled()
    })
  })

  it('shows error state with retry button', async () => {
    mockListScenarios.mockRejectedValue(new Error('Network fail'))
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Network fail')).toBeTruthy()
    })

    expect(screen.getByText('Retry')).toBeTruthy()
  })

  it('shows "Untitled decision" for null titles', async () => {
    mockListScenarios.mockResolvedValue([
      {
        id: 's1',
        title: null,
        stage: 'frame',
        analysis_status: 'none',
        updated_at: new Date().toISOString(),
        events: [],
      },
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Untitled decision')).toBeTruthy()
    })
  })

  it('renders last-activity subtitle for analysis_run event', async () => {
    mockListScenarios.mockResolvedValue([
      {
        id: 's1',
        title: 'Test',
        stage: 'evaluate',
        analysis_status: 'ready',
        updated_at: new Date().toISOString(),
        events: [
          {
            event_id: 'e1',
            seq: 1,
            event_type: 'analysis_run',
            timestamp: new Date().toISOString(),
            details: { winner: 'Option A', probability: 0.73 },
          },
        ],
      },
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Analysis run — Option A led at 73%/)).toBeTruthy()
    })
  })

  it('shows sign-in message for guest users', () => {
    mockAuthValue = { user: { id: 'guest' }, authenticated: true }
    renderPage()
    expect(screen.getByText('Sign in')).toBeTruthy()
  })
})
