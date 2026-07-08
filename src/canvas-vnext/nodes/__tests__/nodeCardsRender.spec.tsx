// Stage-3 card render matrix — Decision/Factor/Risk/Outcome/Goal across
// pre/post/stale; stale markers undimmed (A7); axe smoke.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe, configureAxe } from 'vitest-axe'
import type { NodeProps } from '@xyflow/react'
import { buildGraphExperienceVM } from '../../vm/buildGraphExperienceVM'
import { VNextSelectionProvider } from '../../mode/contexts'
import type { GraphExperienceVM } from '../../vm/types'

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>()
  return { ...actual, Handle: () => null }
})

const useVMMock = vi.fn<[], GraphExperienceVM>()
vi.mock('../../vm/useGraphExperienceVM', () => ({
  useGraphExperienceVMContext: () => useVMMock(),
}))

import { DecisionNodeVNext } from '../DecisionNodeVNext'
import { FactorNodeVNext } from '../FactorNodeVNext'
import { RiskNodeVNext } from '../RiskNodeVNext'
import { OutcomeNodeVNext } from '../OutcomeNodeVNext'
import { GoalNodeVNext } from '../GoalNodeVNext'

configureAxe({ rules: { 'color-contrast': { enabled: false } } })

const nodes = [
  { id: 'g1', type: 'goal', data: { label: 'Grow revenue' } },
  { id: 'd1', type: 'decision', data: { label: 'How to grow?' } },
  { id: 'o1', type: 'option', data: { label: 'Option A' } },
  { id: 'o2', type: 'option', data: { label: 'Option B' } },
  { id: 'f1', type: 'factor', data: { label: 'Customer demand', observedState: { value: 1200, unit: 'visits/week' } } },
  { id: 'r1', type: 'risk', data: { label: 'Overstretch', probability: 0.4, impact: 'high' } },
  { id: 'out1', type: 'outcome', data: { label: 'Repeat customers' } },
]
const edges = [
  { id: 'e-r1-g1', source: 'r1', target: 'g1', data: { weight: 0.4, direction: 'negative' } },
  { id: 'e-out1-g1', source: 'out1', target: 'g1', data: { weight: 0.5, direction: 'positive' } },
]
const report = {
  option_probabilities: { o1: { win_probability: 0.62 }, o2: { win_probability: 0.38 } },
  robustness: { recommended_option_id: 'o1', fragile_edges: [{ edge_id: 'e-r1-g1', switch_probability: 0.45 }] },
}

function makeVM(displayState: 'ready_to_analyse' | 'complete' | 'results_stale', goalThreshold: number | null = null): GraphExperienceVM {
  const rpt = displayState === 'ready_to_analyse' ? null : report
  return buildGraphExperienceVM({
    provenance: 'live',
    nodes,
    edges,
    report: rpt,
    ceeAnalysisReady: null,
    displayState,
    goalThreshold,
    prefillChatAvailable: false,
    resultSignals: rpt
      ? {
          stateHeadline: 'Analysis complete',
          driverSignals: [{ nodeId: 'f1', influenceRank: 1, confidence: 0.8, canFlipResult: false }],
          evidenceGapSignals: [],
          hingeLabel: 'Customer demand',
        }
      : { stateHeadline: 'Ready to analyse', driverSignals: [], evidenceGapSignals: [], hingeLabel: null },
  })
}

function renderNode(Component: (props: NodeProps) => JSX.Element | null, id: string, type: string) {
  const props = { id, type, data: {} } as unknown as NodeProps
  return render(
    <VNextSelectionProvider>
      <Component {...(props as any)} />
    </VNextSelectionProvider>,
  )
}

beforeEach(() => {
  useVMMock.mockReturnValue(makeVM('complete'))
})

describe('decision card', () => {
  it('post-analysis: state line + lead + hinge', () => {
    renderNode(DecisionNodeVNext as any, 'd1', 'decision')
    expect(screen.getByTestId('vnext-decision-state')).toHaveTextContent('Analysis complete')
    expect(screen.getByTestId('vnext-decision-lead')).toHaveTextContent('Option A leads in 62% of scenarios')
    expect(screen.getByTestId('vnext-decision-sensitive')).toHaveTextContent('Sensitive to Customer demand')
  })

  it('pre-analysis: state line only', () => {
    useVMMock.mockReturnValue(makeVM('ready_to_analyse'))
    renderNode(DecisionNodeVNext as any, 'd1', 'decision')
    expect(screen.getByTestId('vnext-decision-state')).toHaveTextContent('Ready to analyse')
    expect(screen.queryByTestId('vnext-decision-lead')).toBeNull()
  })

  it('stale: result lines dim, marker undimmed, state line NOT dimmed', () => {
    useVMMock.mockReturnValue(makeVM('results_stale'))
    renderNode(DecisionNodeVNext as any, 'd1', 'decision')
    expect(screen.getByTestId('vnext-decision-lead').parentElement).toHaveClass('opacity-60')
    const marker = screen.getByTestId('vnext-decision-stale-marker')
    expect(marker).toHaveTextContent('From a previous run')
    expect(marker.parentElement).not.toHaveClass('opacity-60')
    expect(screen.getByTestId('vnext-decision-state').parentElement).not.toHaveClass('opacity-60')
  })
})

describe('factor card', () => {
  it('shows observed value (model input) and the single flag pill', () => {
    renderNode(FactorNodeVNext as any, 'f1', 'factor')
    expect(screen.getByTestId('vnext-factor-value')).toHaveTextContent('1200 visits/week')
    expect(screen.getAllByTestId('vnext-factor-flag')).toHaveLength(1)
    expect(screen.getByTestId('vnext-factor-flag')).toHaveTextContent('Top driver')
  })

  it('stale: flag dims + marker; value stays undimmed', () => {
    useVMMock.mockReturnValue(makeVM('results_stale'))
    renderNode(FactorNodeVNext as any, 'f1', 'factor')
    expect(screen.getByTestId('vnext-factor-flag').parentElement).toHaveClass('opacity-60')
    expect(screen.getByTestId('vnext-factor-stale-marker')).toBeInTheDocument()
    expect(screen.getByTestId('vnext-factor-value').parentElement).not.toHaveClass('opacity-60')
  })
})

describe('risk card', () => {
  it('model line + fragile note', () => {
    renderNode(RiskNodeVNext as any, 'r1', 'risk')
    expect(screen.getByTestId('vnext-risk-model')).toHaveTextContent('40% likely · high impact')
    expect(screen.getByTestId('vnext-risk-fragile')).toHaveTextContent('Part of a fragile link')
  })

  it('pre-analysis: no fragile note', () => {
    useVMMock.mockReturnValue(makeVM('ready_to_analyse'))
    renderNode(RiskNodeVNext as any, 'r1', 'risk')
    expect(screen.queryByTestId('vnext-risk-fragile')).toBeNull()
    expect(screen.getByTestId('vnext-risk-model')).toBeInTheDocument()
  })
})

describe('outcome card', () => {
  it('helps line from the model edge; never a forecast', () => {
    renderNode(OutcomeNodeVNext as any, 'out1', 'outcome')
    expect(screen.getByTestId('vnext-outcome-effect')).toHaveTextContent('Helps the goal')
    expect(screen.getByTestId('vnext-outcome-out1').textContent).not.toMatch(/%/)
  })
})

describe('goal card', () => {
  it('no user target ⇒ hint', () => {
    renderNode(GoalNodeVNext as any, 'g1', 'goal')
    expect(screen.getByTestId('vnext-goal-hint')).toHaveTextContent('Set a target to compare goal fit')
    expect(screen.queryByTestId('vnext-goal-target')).toBeNull()
  })

  it('user target renders raw', () => {
    useVMMock.mockReturnValue(makeVM('complete', 50000))
    renderNode(GoalNodeVNext as any, 'g1', 'goal')
    expect(screen.getByTestId('vnext-goal-target')).toHaveTextContent('Success target: 50000')
    expect(screen.queryByTestId('vnext-goal-hint')).toBeNull()
  })
})

describe('accessibility', () => {
  it('no axe violations across the five cards (post-analysis)', async () => {
    const cards: Array<[any, string, string]> = [
      [DecisionNodeVNext, 'd1', 'decision'],
      [FactorNodeVNext, 'f1', 'factor'],
      [RiskNodeVNext, 'r1', 'risk'],
      [OutcomeNodeVNext, 'out1', 'outcome'],
      [GoalNodeVNext, 'g1', 'goal'],
    ]
    for (const [Component, id, type] of cards) {
      const { container, unmount } = renderNode(Component, id, type)
      expect((await axe(container)).violations).toEqual([])
      unmount()
    }
  })
})
