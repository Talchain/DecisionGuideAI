/**
 * GoalPanel — Impact "Based on N simulations" honesty.
 *
 * The line previously hardcoded "Based on 1,000 simulations" regardless of the
 * real run. It now reads the REAL Monte Carlo sample count from the run's
 * meta.n_samples (via useAnalysisMetadata().scenarioCount — the same canonical
 * source AdvancedSection's "Simulation quality" row uses) and is OMITTED when
 * the run carries no count (V5 conversational path, meta stripped upstream) —
 * never a fabricated constant.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { GoalPanel } from '../panels/GoalPanel'
import { useCanvasStore } from '../../../store'
import { useAuth } from '../../../../contexts/AuthContext'

vi.mock('../../../../contexts/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../contexts/AuthContext')>()
  return { ...actual, useAuth: vi.fn() }
})

const REAL_AUTH = { authenticated: true, user: { id: 'u-123', email: 'real@user.io' } }
const GOAL_NODE = { id: 'goal1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Test Goal' } }

function setStore(report: Record<string, unknown>) {
  const state = useCanvasStore.getState()
  useCanvasStore.setState({
    ...state,
    nodes: [GOAL_NODE],
    edges: [],
    goalThreshold: null,
    goalConstraints: null,
    results: { status: 'complete', report },
  } as any)
}

function renderPanel() {
  return render(
    <GoalPanel nodeId="goal1" techMode={false} onClose={() => {}} onNavigate={() => {}} />
  )
}

describe('GoalPanel — Impact "Based on N simulations"', () => {
  beforeEach(() => {
    useCanvasStore.setState(useCanvasStore.getState(), true)
    vi.mocked(useAuth).mockReset()
    vi.mocked(useAuth).mockReturnValue(REAL_AUTH as unknown as ReturnType<typeof useAuth>)
  })

  it('renders the REAL sample count from meta.n_samples (not a fabricated 1,000)', () => {
    setStore({ probability_of_goal: 0.62, meta: { n_samples: 5000 } })
    const { getByText, queryByText } = renderPanel()
    expect(getByText('62% chance of success')).toBeTruthy()
    expect(getByText('Based on 5,000 simulations')).toBeTruthy()
    // The old fabricated constant must never appear.
    expect(queryByText('Based on 1,000 simulations')).toBeNull()
  })

  it('OMITS the simulations line when the run carries no sample count (V5 path)', () => {
    // meta stripped upstream → scenarioCount null → line hidden, never fabricated.
    setStore({ probability_of_goal: 0.62, meta: { seed: null } })
    const { getByText, queryByText } = renderPanel()
    // The probability itself still renders — only the count sentence is gated.
    expect(getByText('62% chance of success')).toBeTruthy()
    expect(queryByText(/Based on .* simulations/)).toBeNull()
  })
})
