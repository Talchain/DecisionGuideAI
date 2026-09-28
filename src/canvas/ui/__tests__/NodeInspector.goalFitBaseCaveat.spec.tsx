/**
 * ISL #207 (AIQ #72 5877139338): the legacy inspector's "Goal probability"
 * readout carries the base-caveat beside it, in the chooser's two strings.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { NodeInspector } from '../NodeInspector'
import { useCanvasStore } from '../../store'

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({ useNodeDisplayMetadata: vi.fn() }))
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'
// Pinned as LITERALS (Codex on #2280): a re-worded constant must turn these rows RED.
const OLUMI_COPY = "Measured from Olumi's estimate of where your goal stands today, not a figure you gave."
const NEUTRAL_COPY = 'Measured from where your goal stands today as worked out from its inputs, not a figure you gave.'


const metadata = (baseCaveat: 'olumi_estimate' | 'from_inputs' | null) =>
  ({
    sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
    achievementProbability: 0.41, achievementProbabilityIsModelledBasis: false,
    achievementProbabilityBaseCaveat: baseCaveat,
    stabilityPercentage: null, winRate: null, isResultsMode: true,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  }) as never

describe('NodeInspector — goal-fit base-caveat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCanvasStore.setState({
      nodes: [{ id: 'goal-1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Revenue Target' } }],
      edges: [], goalThreshold: 0.5, goalConstraints: [], confirmedNodeIds: new Set(),
      outcomeNodeId: undefined, touchedNodeIds: new Set(), results: { status: 'complete', report: null },
    } as never)
  })
  afterEach(() => cleanup())

  it.each([
    ['olumi_estimate', OLUMI_COPY],
    ['from_inputs', NEUTRAL_COPY],
  ] as const)('%s → its copy beside the readout', (caveat, copy) => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue(metadata(caveat))
    render(<NodeInspector nodeId="goal-1" onClose={() => {}} />)
    expect(screen.getByText('Goal probability')).toBeDefined()
    expect(screen.getByTestId('goal-fit-base-caveat-inspector').textContent).toBe(copy)
  })

  it('CONTROL: no base-caveat → none rendered, the readout still shows', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue(metadata(null))
    render(<NodeInspector nodeId="goal-1" onClose={() => {}} />)
    expect(screen.getByText('Goal probability')).toBeDefined()
    expect(screen.queryByTestId('goal-fit-base-caveat-inspector')).toBeNull()
  })
})
