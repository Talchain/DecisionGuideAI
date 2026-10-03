/**
 * ISL #207 (AIQ #72 5877139338, condition 2): a goal chance measured from a
 * goal level worked out from its inputs is never shown bare on the canvas.
 * `selectGoalProbability(...).goalFitBaseCaveat` (UI #2280) is the one
 * decision; the hook forwards it, and GoalNode renders the copy VISIBLY on the
 * resting card, not only in Detailed or a tooltip.
 *
 * Two strings (AIQ condition 1): typed `olumi` says "Olumi's estimate"; an
 * unattested author says the neutral line and never the word "Olumi's".
 * Every assertion binds by test id and exact copy.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, renderHook, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { useNodeDisplayMetadata } from '../useNodeDisplayMetadata'
import { GoalNode } from '../../nodes/GoalNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../useAnalysisTrust', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useAnalysisTrust: () => ({ semantic: 'current', orphaned: false, isRunning: false }),
}))
vi.mock('../../ui/inspector-v2/useAnalysisResults', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useHasAnyRealProbability: () => true,
}))

/** What UI #2280's V5 mapper stamps on the option entry (`goalLevelAuthor`). */
const record = (goalLevelAuthor?: 'olumi' | 'unattested') => ({
  goal_probability: 0.41,
  confidence: 0.5,
  ...(goalLevelAuthor ? { goalLevelAuthor } : {}),
})

const makeStoreState = (optionRecord: Record<string, unknown>) => ({
  results: {
    status: 'complete',
    report: {
      schema: 'report.v1' as const,
      meta: { seed: 1, elapsed_ms: 100 },
      result: { mean: 0.7, p10: 0.5, p50: 0.7, p90: 0.9, critique: '' },
      bands: { p10: 0.5, p50: 0.7, p90: 0.9 },
      robustness: { recommended_option_id: 'option-1', recommendation_stability: 0.8 },
      option_probabilities: { 'option-1': optionRecord },
    },
  },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  nodes: [],
  edges: [],
  ceeAnalysisReady: null,
  viewMode: 'expert',
})

let storeState = makeStoreState(record())
vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: unknown) => unknown) => selector(storeState)),
}))
import { useCanvasStore } from '../../store'
// Pinned as LITERALS (Codex on #2280): a re-worded constant must turn these rows RED.
const OLUMI_COPY = "Measured from Olumi's estimate of where your goal stands today, not a figure you gave."
const NEUTRAL_COPY = 'Measured from where your goal stands today as worked out from its inputs, not a figure you gave.'


const useStore = (optionRecord: Record<string, unknown>) => {
  storeState = makeStoreState(optionRecord)
  vi.mocked(useCanvasStore).mockImplementation((selector) => selector(storeState as never))
}

const goalNodeProps = {
  id: 'goal-1',
  type: 'goal',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

const renderGoalNode = () =>
  render(
    <ReactFlowProvider>
      <GoalNode
        {...goalNodeProps}
        data={{ label: 'Ability to focus on high-value tasks', type: 'goal', goal_threshold_raw: '100', goal_threshold_unit: '%' }}
      />
    </ReactFlowProvider>,
  )

beforeEach(() => {
  vi.clearAllMocks()
})

describe('the hook forwards the chooser\'s base-caveat, never re-derives it', () => {
  it.each([
    ['olumi', 'olumi_estimate'],
    ['unattested', 'from_inputs'],
    [undefined, null],
  ] as const)('goalLevelAuthor %s → %s', (author, expected) => {
    useStore(record(author))
    const { result } = renderHook(() => useNodeDisplayMetadata('goal-1', 'goal'))
    expect(result.current.achievementProbability).toBe(0.41)
    expect(result.current.achievementProbabilityBaseCaveat).toBe(expected)
  })
})

describe('GoalNode: the chance is never bare when its base was worked out', () => {
  it('typed Olumi author: the resting card shows the Olumi copy beside the chance', () => {
    useStore(record('olumi'))
    renderGoalNode()
    expect(screen.getByTestId('goal-achievement-metric-row')).toBeDefined()
    expect(screen.getByTestId('goal-fit-base-caveat-node').textContent).toBe(OLUMI_COPY)
  })

  it('author unknown (the carrier dropped it): the neutral copy, never "Olumi\'s"', () => {
    useStore(record('unattested'))
    renderGoalNode()
    const caveat = screen.getByTestId('goal-fit-base-caveat-node').textContent ?? ''
    expect(caveat).toBe(NEUTRAL_COPY)
    expect(caveat).not.toContain("Olumi's")
  })

  it('CONTROL: a goal level the user gave carries no base-caveat, and the chance still shows', () => {
    useStore(record())
    renderGoalNode()
    expect(screen.getByTestId('goal-achievement-metric-row')).toBeDefined()
    expect(screen.queryByTestId('goal-fit-base-caveat-node')).toBeNull()
  })
})
