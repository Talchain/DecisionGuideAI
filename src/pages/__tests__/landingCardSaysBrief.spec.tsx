/**
 * THE LANDING CARD NAMED SOMETHING THE USER MAY NEVER HAVE HAD.
 *
 * `ScenarioListPage` is mounted at the ROOT ROUTE (`AppPoC.tsx:949-950`, `/` and
 * `/scenarios`), so this card is the first thing a returning user reads. Its
 * `brief_generated` arm said **"Decision brief generated"**.
 *
 * The event kind is `brief_generated`. The word "Decision" is added HERE, by
 * this surface, to an artefact whose own name does not carry it.
 *
 * ⚠ AND SINCE CEE #1110 (`aa134eac`, live on deployed CEE `c24bfe37`) IT IS
 * SOMETIMES FALSE — which is what makes this a truthfulness fix rather than a
 * vocabulary one. #1110 made the runtime accept OPEN STRATEGIC CHALLENGES: a
 * statement of a problem, no decision verb, no trailing `?`, drafts a model.
 * A user who brought one has NO DECISION, so a card announcing their "Decision
 * brief" names something they never had. Before #1110 every scenario was a
 * decision and the string was merely inconsistent; it is now capable of being
 * wrong, and it was not yesterday.
 *
 * Its own siblings already agree — this switch's `graph_drafted` and
 * `patch_accepted` arms say "Model …", and `renderTimeline`'s neighbouring
 * `brief_shared` says plain "Brief shared": the same artefact, two lines apart,
 * without the word.
 *
 * ⚠ SCOPE, and it is deliberately narrow. One user-facing string on one mounted
 * page. NOT the internal `decision_brief` carrier (the producer's name for its
 * own payload, which must keep it). NOT `renderTimeline.ts:162`'s identical
 * line, which serves the Journey surface — derived DARK at this tip
 * (`VITE_FEATURE_JOURNEY_TAB` absent from the build config; contrast: 41 other
 * `VITE_` keys present), so changing it would be invisible work.
 *
 * Driven through the RENDERED PAGE rather than the module-private function, so
 * what is asserted is what a user reads.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

const mockAuthValue = { user: { id: '550e8400-e29b-41d4-a716-446655440000' }, authenticated: true }
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

function withEvent(eventType: string, details: Record<string, unknown> = {}) {
  mockListScenarios.mockResolvedValue([
    {
      id: 's1',
      title: 'Test',
      stage: 'evaluate',
      analysis_status: 'ready',
      updated_at: new Date().toISOString(),
      events: [
        { event_id: 'e1', seq: 1, event_type: eventType, timestamp: new Date().toISOString(), details },
      ],
    },
  ])
  render(
    <MemoryRouter>
      <ScenarioListPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockListScenarios.mockReset()
})

describe('the landing card names the artefact, not a decision the user may not have', () => {
  it('⭐ a generated brief is a BRIEF — never a "decision brief"', async () => {
    withEvent('brief_generated')
    await waitFor(() => {
      expect(screen.getByText('Brief generated')).toBeTruthy()
    })
    expect(screen.queryByText('Decision brief generated')).toBeNull()
  })

  it('PRECONDITION — the assertion is reading the brief_generated ARM, not a fallback', async () => {
    // `formatLastActivity` has six arms and two of them are generic ("Updated
    // X ago"). A card that fell through to one of those would satisfy a
    // `not.toBeNull()` on the old string while proving nothing about this arm.
    // The exact-text match above can only come from the arm under test, and
    // this pins that the generic fallback is NOT what rendered.
    withEvent('brief_generated')
    await waitFor(() => expect(screen.getByText('Brief generated')).toBeTruthy())
    expect(screen.queryByText(/^Updated /)).toBeNull()
  })

  it('DISCRIMINATING — a DIFFERENT arm is untouched, so this was not a blanket rewrite', async () => {
    // Without this, deleting the word "Decision" everywhere — or collapsing the
    // switch to one string — would satisfy the cases above.
    withEvent('graph_drafted', { node_count: 12 })
    await waitFor(() => {
      expect(screen.getByText(/^Model drafted with 12 /)).toBeTruthy()
    })
  })

  it('DISCRIMINATING — the analysis arm still makes no leader claim', async () => {
    // A prior lane DELETED a `winner`-based claim from this arm. The fixture
    // keeps `winner` on purpose: it proves the subtitle ignores it.
    withEvent('analysis_run', { winner: 'Option A', probability: 0.73 })
    await waitFor(() => expect(screen.getByText('Analysis run')).toBeTruthy())
    expect(screen.queryByText(/Option A/)).toBeNull()
  })
})
