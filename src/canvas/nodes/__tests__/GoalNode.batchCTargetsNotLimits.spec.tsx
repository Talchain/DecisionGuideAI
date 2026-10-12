/**
 * Recovery Batch C (UI) item 4: a `goal_constraints` row with `role: 'goal_target'` is one of the goal's TARGETS (C CEE
 * `GOAL_TARGET_ROLE`, schemas 0.83.0), never a limit. Paul's marketing brief: "at least 20 new customers AND a conversion
 * rate above 15%" (rows copied from C CEE's `batch-c-goal-chance-licence.test.ts` `marketingGraph`).
 *
 *   · the goal card states the second target as "Target: Conversion rate above 15%": the comparator the user STATED,
 *     never the held `>=` ("≥ 15%"), and never as a limit pill;
 *   · the row that restates the card's own target ("at least 20 customers") is not said twice;
 *   · Results' stated limits and every list that formats a row say a target as a target;
 *   · CONTROLS in the same renders: a real limit (spend at most £100,000) is still a limit pill and a stated limit.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((s: (x: { layoutNodeWidth: number | null }) => unknown) =>
    s({ layoutNodeWidth: null })) as unknown as (...a: never[]) => unknown),
}))
vi.mock('../../ui/inspector-v2/useAnalysisResults', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../ui/inspector-v2/useAnalysisResults')>()),
  useHasAnyRealProbability: vi.fn(() => false),
}))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({ useNodeDisplayMetadata: vi.fn() }))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'
import { GoalNode } from '../GoalNode'
import { goalConstraintText } from '../../utils/goalConstraintText'
import { selectStatedLimits } from '../../../components/results/decision-overview/statedLimits'
import { MARKETING_TARGET_ROWS } from '../../../components/results/__tests__/helpers/batchCGoalChance'

const baseProps = {
  selected: false, dragging: false, zIndex: 0, isConnectable: false,
  positionAbsoluteX: 0, positionAbsoluteY: 0, deletable: true, selectable: true, draggable: true,
}
const META = {
  sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
  achievementProbability: null as number | null, goalFitAvailable: false, stabilityPercentage: null,
  winRate: null, isResultsMode: false, predictedOutcome: null, valueOfInformation: null, voiRank: null,
}
const GOAL_ID = 'new_customers'
const NODES = [
  { id: 'conversion_rate', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Conversion rate', type: 'factor' } },
  { id: 'annual_spend', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Annual spend', type: 'factor' } },
]
/** CONTROL: a real limit the user set, beside the targets (C CEE ruling 16's `limit:spend`). */
const SPEND_LIMIT = { constraint_id: 'limit:spend', node_id: 'annual_spend', operator: '<=', value: 100000, unit: 'GBP', value_frame: 'level', provenance: 'explicit' }
const ROWS = [...MARKETING_TARGET_ROWS, SPEND_LIMIT]

function mockStore(viewMode: 'standard' | 'expert') {
  vi.mocked(useCanvasStore).mockImplementation((selector: any) => selector({
    hoveredOptionId: null, nodes: NODES, edges: [], ceeAnalysisReady: null, results: { status: 'idle', report: null },
    highlightedNodes: new Set(), dimmedNodeIds: new Set(), lens: { _dimmedNodeIds: new Set() }, goalThreshold: null,
    goalConstraints: ROWS, setHoveredOption: vi.fn(), viewMode,
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' }, analysisFreshnessDirty: false,
  } as never))
}
const renderGoal = () => render(
  <ReactFlowProvider>
    <GoalNode {...(baseProps as any)} id={GOAL_ID} type="goal"
      data={{ type: 'goal', label: 'New customers', goal_threshold_raw: 20, goal_threshold_unit: 'customers', goal_threshold_frame: 'level', goal_direction: '>=' } as any} />
  </ReactFlowProvider>,
)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useNodeDisplayMetadata).mockReturnValue({ ...META } as never)
})
afterEach(() => cleanup())

describe('Batch C item 4: the goal\'s other targets are said as targets, never as limits', () => {
  it('goal card at rest: "Target: Conversion rate above 15%"; no limit pill for either target row; CONTROL spend is a limit pill', () => {
    mockStore('standard')
    renderGoal()
    expect(screen.getByTestId(`goal-target-pill-${GOAL_ID}-target:conversion_rate`)).toHaveTextContent('Target: Conversion rate above 15%')
    // The card already prints its own target (20 customers): that row is not said again as a target or a limit.
    expect(screen.queryByTestId(`goal-target-pill-${GOAL_ID}-target:new_customers`)).toBeNull()
    expect(screen.queryByTestId(`goal-limit-pill-${GOAL_ID}-target:new_customers`)).toBeNull()
    expect(screen.queryByTestId(`goal-limit-pill-${GOAL_ID}-target:conversion_rate`)).toBeNull()
    expect(screen.getByTestId(`goal-limit-pill-${GOAL_ID}-limit:spend`)).toHaveTextContent('Annual spend ≤£100,000')
    expect(document.body.textContent).not.toMatch(/Conversion rate ≥/)
  })

  it('goal card, Detailed: the target badge says the target; the constraint badges list only the limit', () => {
    mockStore('expert')
    renderGoal()
    expect(screen.getAllByTestId('goal-target-badge').map(b => b.textContent)).toEqual(['Target: Conversion rate above 15%'])
    const limits = screen.queryAllByTestId('goal-constraint-badge').map(b => b.textContent ?? '')
    expect(limits.some(t => t.includes('Annual spend'))).toBe(true)
    expect(limits.some(t => /Conversion rate|New customers|customers/.test(t))).toBe(false)
  })

  it('Results\' stated limits (decision overview, decision brief) leave the targets out; CONTROL keeps the spend limit', () => {
    // Before: "≥ 20" and "≥ 15%" were listed as limits (and "above" said as "≥").
    expect(selectStatedLimits(ROWS as never)).toEqual([{ id: 'limit:spend', text: '≤ £100,000' }])
  })

  it('every list that formats a row (Model tab, inspector) says a target as a target, with the stated comparator', () => {
    const [newCustomers, conversion] = MARKETING_TARGET_ROWS
    expect(goalConstraintText(conversion as never, NODES)).toBe('Target: Conversion rate above 15%')
    expect(goalConstraintText(conversion as never, NODES, { omitLabel: true })).toBe('target above 15%')
    expect(goalConstraintText(newCustomers as never, [{ id: 'new_customers', data: { label: 'New customers' } }])).toBe('Target: New customers at least 20 customers')
    // CONTROL: the same row WITHOUT the role is a limit, said as before (held `>=` → "≥").
    const { role: _r, ...asLimit } = conversion
    expect(goalConstraintText(asLimit as never, NODES)).toBe('Conversion rate ≥ 15%')
    expect(goalConstraintText(SPEND_LIMIT as never, NODES)).toBe('Annual spend ≤ £100,000')
  })
})
