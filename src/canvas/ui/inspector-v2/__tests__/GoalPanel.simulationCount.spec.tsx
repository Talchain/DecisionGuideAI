import { CHANCE_NOT_SHOWN_YET } from '@/canvas/runView/runView'
import { installCanonicalFixtureState } from '@/components/results/analysis-hero/__tests__/helpers/canonicalTestCells'
import { licensedTestReport } from '../../../runView/__tests__/helpers/licensedTestReport'
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
    nodes: [GOAL_NODE, ...['opt_a', 's1_control_option'].map(id => ({ id, type: 'option', position: { x: 0, y: 0 }, data: { label: id, kind: 'option' } }))],
    edges: [],
    goalThreshold: null,
    goalConstraints: null,
    results: { status: 'complete', report: licensedTestReport(report) },
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

  // ROADMAP 2.296 item 5: these fixtures previously fabricated a ROOT-LEVEL
  // `probability_of_goal` — a shape no producer emits, which is exactly how
  // the panel's dark whole-report read stayed green (the named lesson from
  // `GoalPanel.possessiveGate.spec.tsx`). The probability now lives where the
  // mappers put it — `option_probabilities[recommended_option_id]` — while
  // `meta.n_samples` genuinely IS a root field (the V4 responseMapper emits
  // it there; the V5 mapper strips it, which is the omission case below).
  function reportWithGoal(meta: Record<string, unknown>) {
    return {
      option_probabilities: { opt_a: { probability_of_goal: 0.62, confidence: 0.5 } },
      robustness: { recommended_option_id: 'opt_a', display_verdict: 'fragile' },
      meta,
    }
  }

  it('view-bearing control: the server figure keeps the real simulation count and its omission gate', () => {
    for (const meta of [{ n_samples: 5000 }, { seed: null }]) {
      setStore(reportWithGoal(meta))
      useCanvasStore.setState(installCanonicalFixtureState(useCanvasStore.getState()))
      const { getByText, queryByText, unmount } = renderPanel()
      expect(getByText(/62% chance of meeting your goal/)).toBeTruthy()
      if ('n_samples' in meta) expect(getByText('Based on 5,000 simulations')).toBeTruthy()
      else expect(queryByText(/Based on .* simulations/)).toBeNull()
      expect(queryByText('Based on 1,000 simulations')).toBeNull()
      unmount()
    }
  })

  it('renders the REAL sample count from meta.n_samples (not a fabricated 1,000)', () => {
    setStore(reportWithGoal({ n_samples: 5000 }))
    const { getByText, queryByText } = renderPanel()
    const face = getByText(CHANCE_NOT_SHOWN_YET)
    expect(face.textContent).toBe(CHANCE_NOT_SHOWN_YET)
    expect(face.textContent).not.toMatch(/\d+%/)
    expect(face.textContent).not.toContain('Why?')
    expect(getByText('Based on 5,000 simulations')).toBeTruthy()
    // The old fabricated constant must never appear.
    expect(queryByText('Based on 1,000 simulations')).toBeNull()
  })

  it('OMITS the simulations line when the run carries no sample count (V5 path)', () => {
    // meta stripped upstream → scenarioCount null → line hidden, never fabricated.
    setStore(reportWithGoal({ seed: null }))
    const { getByText, queryByText } = renderPanel()
    // The probability itself still renders — only the count sentence is gated.
    const face = getByText(CHANCE_NOT_SHOWN_YET)
    expect(face.textContent).toBe(CHANCE_NOT_SHOWN_YET)
    expect(face.textContent).not.toMatch(/\d+%/)
    expect(face.textContent).not.toContain('Why?')
    expect(queryByText(/Based on .* simulations/)).toBeNull()
  })
})
