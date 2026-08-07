/**
 * RESIDUAL COMPARATIVE SURFACES — the scenario list subtitle
 * (ROADMAP 1.239, residual 4). DELETE, not gate.
 *
 * `formatLastActivity` printed "Analysis run — {winner} led at N%" gated on
 * `details.winner` alone: no reference to the verdict, and no way to make one.
 * At list-render time this page holds `ScenarioEvent[]` and nothing else —
 * no results report, therefore no `DecisionVerdict`, therefore no
 * entitlement to consult. There is no gate to write here, only a claim to
 * stop making.
 *
 * WHY THIS TEST EXISTS SEPARATELY FROM THE PROBE. The render probe's 0-count
 * for this surface is VACUOUS and must not be read as clean: its session was
 * anonymous, so /#/scenarios rendered nothing but "Sign in to save and manage
 * your decisions." (90 characters). An absence measured on a page that never
 * rendered a row proves nothing (trap 13). This suite supplies the presence
 * the probe could not: a real row, carrying a real `details.winner`, rendered
 * by the real component.
 *
 * It does NOT close the live gap. Whether any persisted row in the staging
 * database carries a `winner` is still unverified — that needs an
 * authenticated-session probe, dispatched separately. What is now pinned is
 * that the UI would not render a leader claim from such a row if one existed.
 *
 * See `src/canvas/journey/__tests__/residualComparative.analysisRunEvent.spec.ts`
 * for the derived writer manifest showing `details.winner` has no writer in
 * this build at all.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

let mockAuthValue = { user: null as { id: string } | null, authenticated: false }
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => mockAuthValue }))

vi.mock('../../hooks/useScenario', () => ({
  useScenario: () => ({
    createScenario: vi.fn(),
    deleteScenario: vi.fn(),
    isPersistenceActive: true,
  }),
}))

const mockListScenarios = vi.fn()
vi.mock('../../services/scenarioService', () => ({
  listScenarios: (...args: unknown[]) => mockListScenarios(...args),
}))

import ScenarioListPage from '../ScenarioListPage'

const USER_ID = '550e8400-e29b-41d4-a716-446655440000'

function scenarioWith(details: Record<string, unknown>) {
  return [
    {
      id: 's1',
      title: 'Which laptops for the team?',
      stage: 'evaluate',
      analysis_status: 'ready',
      updated_at: new Date().toISOString(),
      events: [
        {
          event_id: 'e1',
          seq: 1,
          event_type: 'analysis_run',
          timestamp: new Date().toISOString(),
          details,
        },
      ],
    },
  ]
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ScenarioListPage />
    </MemoryRouter>,
  )
}

describe('ScenarioListPage — no leader designation on the activity subtitle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthValue = { user: { id: USER_ID }, authenticated: true }
  })

  it('a row carrying details.winner designates nothing', async () => {
    mockListScenarios.mockResolvedValue(
      scenarioWith({ winner: 'Standardise on MacBook Pro', probability: 0.73 }),
    )
    const { container } = renderPage()

    await waitFor(() => {
      expect(screen.getByText('Which laptops for the team?')).toBeTruthy()
    })

    const text = container.textContent ?? ''
    expect(text).not.toMatch(/led at/i)
    expect(text).not.toMatch(/Standardise on MacBook Pro/)
    expect(text).not.toMatch(/73%/)
  })

  it('the row still reports that an analysis ran — absence is not the same as silence', async () => {
    // Over-suppression control AND trap-13 positive control in one: the card
    // must still tell the user this decision has been analysed, and if the
    // page rendered nothing the assertions above would pass vacuously.
    mockListScenarios.mockResolvedValue(
      scenarioWith({ winner: 'Standardise on MacBook Pro', probability: 0.73 }),
    )
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Analysis run')).toBeTruthy()
    })
  })

  it('the subtitles that are not comparative are untouched', async () => {
    // Over-suppression control for the sibling branches of the same switch.
    mockListScenarios.mockResolvedValue([
      {
        id: 's2',
        title: 'Warehouse siting',
        stage: 'ideate',
        analysis_status: 'none',
        updated_at: new Date().toISOString(),
        events: [
          {
            event_id: 'e2',
            seq: 1,
            event_type: 'graph_drafted',
            timestamp: new Date().toISOString(),
            details: { node_count: 6 },
          },
        ],
      },
    ])
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Model drafted with 6 factors')).toBeTruthy()
    })
  })
})
