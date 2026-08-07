/**
 * NodeInspector — goal-fit modelled-basis caveat (ROADMAP 1.6b tail — goal-fit
 * caveat residuals). Same gate/wording as GoalNode/OptionCards/OutcomeNode:
 * rendered adjacent to the inspector-panel achievement-probability readout,
 * gated on the already-computed achievementProbabilityIsModelledBasis flag.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { NodeInspector } from '../NodeInspector'
import { useCanvasStore } from '../../store'

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    achievementProbabilityIsModelledBasis: false,
    stabilityPercentage: null,
    winRate: null,
    isResultsMode: false,
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
  })),
}))

import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

describe('NodeInspector — goal-fit basis caveat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCanvasStore.setState({
      nodes: [
        { id: 'goal-1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Revenue Target' } },
      ],
      edges: [],
      goalThreshold: 0.5,
      goalConstraints: [],
      confirmedNodeIds: new Set(),
      outcomeNodeId: undefined,
      touchedNodeIds: new Set(),
      results: { status: 'complete', report: null },
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the modelled-basis caveat adjacent to the goal probability readout when flagged', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: 0.73,
      achievementProbabilityIsModelledBasis: true,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    } as any)

    render(<NodeInspector nodeId="goal-1" onClose={() => {}} />)

    expect(screen.getByText('Goal probability')).toBeDefined()
    expect(screen.getByTestId('goal-fit-basis-caveat-inspector')).toHaveTextContent(
      "Modelled from the target's projected outcome distribution, not a directly-set starting value.",
    )
  })

  it('renders no caveat when the flag is absent (honest default)', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: 0.73,
      achievementProbabilityIsModelledBasis: false,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    } as any)

    render(<NodeInspector nodeId="goal-1" onClose={() => {}} />)

    expect(screen.getByText('Goal probability')).toBeDefined()
    expect(screen.queryByTestId('goal-fit-basis-caveat-inspector')).toBeNull()
  })
})
