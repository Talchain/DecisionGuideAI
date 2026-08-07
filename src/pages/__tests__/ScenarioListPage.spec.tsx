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

    // Role-based query: stable against copy changes. The dedicated copy
    // assertion at line 97 (`'Welcome to Olumi'`) is the single intentional
    // copy-coupling in this spec.
    fireEvent.click(
      screen.getByRole('button', { name: /start a new decision/i }),
    )

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

    // ROADMAP 1.239: the fixture keeps its `winner` / `probability` on purpose
    // — that is what makes this a proof the subtitle ignores them — but the
    // subtitle no longer designates a leader. See
    // residualComparative.scenarioList.spec.tsx for the full reasoning.
    await waitFor(() => {
      expect(screen.getByText('Analysis run')).toBeTruthy()
    })
  })

  // -------------------------------------------------------------------------
  // Trust-spine board #2 regression guard.
  //
  // The gated autosave appends a `graph_saved` marker after EVERY graph write,
  // so it is almost always the TRAILING event. Reading events[length-1] blindly
  // collapses every card to the generic "Updated X ago" and silently loses the
  // meaningful label. These pin that system markers are skipped.
  // -------------------------------------------------------------------------

  it('keeps the drafted label when a graph_saved marker trails graph_drafted', async () => {
    const now = new Date().toISOString()
    mockListScenarios.mockResolvedValue([
      {
        id: 's1',
        title: 'Test',
        stage: 'ideate',
        analysis_status: 'none',
        updated_at: now,
        events: [
          {
            event_id: 'e1',
            seq: 1,
            event_type: 'graph_drafted',
            timestamp: now,
            details: { node_count: 6, edge_count: 8 },
          },
          // Autosave marker lands last — must NOT mask the drafted label.
          {
            event_id: 'e2',
            seq: 2,
            event_type: 'graph_saved',
            timestamp: now,
            details: {},
            hashes: { graph_hash: 'abc123' },
          },
        ],
      },
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Model drafted with 6 factors/)).toBeTruthy()
    })
    expect(screen.queryByText(/^Updated /)).toBeNull()
  })

  it('keeps the patch_accepted label behind several trailing graph_saved markers', async () => {
    const now = new Date().toISOString()
    mockListScenarios.mockResolvedValue([
      {
        id: 's1',
        title: 'Test',
        stage: 'ideate',
        analysis_status: 'none',
        updated_at: now,
        events: [
          {
            event_id: 'e1',
            seq: 1,
            event_type: 'patch_accepted',
            timestamp: now,
            details: { summary: 'Added regulatory risk' },
          },
          { event_id: 'e2', seq: 2, event_type: 'graph_saved', timestamp: now, details: {} },
          { event_id: 'e3', seq: 3, event_type: 'graph_saved', timestamp: now, details: {} },
        ],
      },
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Model updated — Added regulatory risk/)).toBeTruthy()
    })
  })

  it('falls back to the relative-time label when ONLY markers exist', async () => {
    const now = new Date().toISOString()
    mockListScenarios.mockResolvedValue([
      {
        id: 's1',
        title: 'Test',
        stage: 'frame',
        analysis_status: 'none',
        updated_at: now,
        events: [
          { event_id: 'e1', seq: 1, event_type: 'graph_saved', timestamp: now, details: {} },
        ],
      },
    ])

    renderPage()

    // No meaningful event to describe — the generic label is correct here,
    // and it must not crash on an all-markers event list.
    await waitFor(() => {
      expect(screen.getByText(/Updated /)).toBeTruthy()
    })
  })

  it('shows sign-in message for guest users', () => {
    mockAuthValue = { user: { id: 'guest' }, authenticated: true }
    renderPage()
    expect(screen.getByText('Sign in')).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // Front-door guest path. A fresh guest landing at root must have a way INTO
  // the product: guest mode is the POC's primary flow and #/canvas works fully
  // as guest, but this branch used to render only a Sign in button — a dead
  // end. The CTA is the secondary affordance (sign-in stays primary) and its
  // copy must not promise persistence a guest doesn't get.
  // -------------------------------------------------------------------------

  it('offers guests a path into the canvas with an accessible name', () => {
    mockAuthValue = { user: { id: 'guest' }, authenticated: true }
    renderPage()

    const guestCta = screen.getByRole('button', { name: /continue without an account/i })
    expect(guestCta).toBeTruthy()

    fireEvent.click(guestCta)
    expect(mockNavigate).toHaveBeenCalledWith('/canvas')
  })

  it('keeps Sign in as the primary affordance alongside the guest path', () => {
    mockAuthValue = { user: { id: 'guest' }, authenticated: true }
    renderPage()

    const signIn = screen.getByRole('button', { name: /^sign in$/i })
    expect(signIn.className).toContain('bg-primary')

    const guestCta = screen.getByRole('button', { name: /continue without an account/i })
    expect(guestCta.className).not.toContain('bg-primary')

    fireEvent.click(signIn)
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })
})
