/**
 * ScenarioListPage hub tests — pin, archive, duplicate, filter tabs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'test@example.com' },
    profile: { display_name: 'Tester' },
    authenticated: true,
  }),
}))

vi.mock('../../hooks/useScenario', () => ({
  useScenario: () => ({
    createScenario: vi.fn().mockResolvedValue('new-id'),
    deleteScenario: vi.fn(),
    isPersistenceActive: true,
  }),
}))

const mockListScenarios = vi.fn()
const mockPinScenario = vi.fn().mockResolvedValue(undefined)
const mockArchiveScenario = vi.fn().mockResolvedValue(undefined)
const mockDuplicateScenario = vi.fn().mockResolvedValue('dup-id')
vi.mock('../../services/scenarioService', () => ({
  listScenarios: (...args: unknown[]) => mockListScenarios(...args),
  pinScenario: (...args: unknown[]) => mockPinScenario(...args),
  archiveScenario: (...args: unknown[]) => mockArchiveScenario(...args),
  duplicateScenario: (...args: unknown[]) => mockDuplicateScenario(...args),
}))

vi.mock('../../lib/posthog', () => ({
  trackEvent: vi.fn(),
}))

import ScenarioListPage from '../ScenarioListPage'

const SCENARIOS = [
  {
    id: 's1',
    title: 'First Decision',
    stage: 'frame' as const,
    analysis_status: 'none' as const,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    is_pinned: true,
    is_archived: false,
    events: [] as any[],
  },
  {
    id: 's2',
    title: 'Second Decision',
    stage: 'evaluate' as const,
    analysis_status: 'ready' as const,
    updated_at: new Date(Date.now() - 86400000).toISOString(),
    created_at: new Date(Date.now() - 86400000).toISOString(),
    is_pinned: false,
    is_archived: false,
    events: [] as any[],
  },
  {
    id: 's3',
    title: 'Archived Decision',
    stage: 'decide' as const,
    analysis_status: 'ready' as const,
    updated_at: new Date(Date.now() - 172800000).toISOString(),
    created_at: new Date(Date.now() - 172800000).toISOString(),
    is_pinned: false,
    is_archived: true,
    events: [] as any[],
  },
]

function renderPage() {
  return render(
    <MemoryRouter>
      <ScenarioListPage />
    </MemoryRouter>,
  )
}

describe('ScenarioListPage hub features', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListScenarios.mockResolvedValue(SCENARIOS)
  })

  it('renders filter tabs', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('Archived')).toBeInTheDocument()
      expect(screen.getByText('All')).toBeInTheDocument()
    })
  })

  it('shows active scenarios by default (excludes archived)', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('First Decision')).toBeInTheDocument()
      expect(screen.getByText('Second Decision')).toBeInTheDocument()
    })
    expect(screen.queryByText('Archived Decision')).not.toBeInTheDocument()
  })

  it('shows archived scenarios when Archived tab clicked', async () => {
    renderPage()
    await waitFor(() => screen.getByText('First Decision'))
    fireEvent.click(screen.getByText('Archived'))
    expect(screen.getByText('Archived Decision')).toBeInTheDocument()
    expect(screen.queryByText('First Decision')).not.toBeInTheDocument()
  })

  it('shows all scenarios when All tab clicked', async () => {
    renderPage()
    await waitFor(() => screen.getByText('First Decision'))
    fireEvent.click(screen.getByText('All'))
    expect(screen.getByText('First Decision')).toBeInTheDocument()
    expect(screen.getByText('Archived Decision')).toBeInTheDocument()
  })

  it('shows welcome state when no scenarios', async () => {
    mockListScenarios.mockResolvedValue([])
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/welcome to olumi/i)).toBeInTheDocument()
    })
  })
})
