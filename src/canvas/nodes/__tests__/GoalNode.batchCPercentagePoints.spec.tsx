/**
 * Recovery Batch C (C CEE round 1, item 1): a `change_abs` goal target in `%` is a change in PERCENTAGE POINTS when the
 * goal's value is a LEVEL (`quantity_frame: 'level'`: capacity at 75% + 10 points = 85%, not 82.5%). When the value is
 * itself a change in % of today (`quantity_frame: 'change'`, Paul's hiring productivity), it stays "10% from today",
 * as CEE says it ("at least 10% higher than today"). `change_rel` is a fraction of today in every case.
 *
 * One rule, every surface that says the target: the goal card, the Success row, the bound (inspector/editor) and a
 * target row. With NO `quantity_frame` the size is not said anywhere (C CEE 6e3bce10: no default, the chance withheld),
 * exactly as an unread frame. CONTROLS: hiring ('change'), change_rel, and a plain LIMIT (CEE's limit sentence unchanged).
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
import { formatGoalChangeBound, formatGoalTarget } from '../../../components/results/utils/formatGoalTarget'
import { resolveGoalTarget } from '../../domain/goalTarget'
import { goalConstraintText } from '../../utils/goalConstraintText'
import { computeSuccessState } from '../../components/pre-analysis-v3/selectors/computeSuccessState'

const baseProps = {
  selected: false, dragging: false, zIndex: 0, isConnectable: false,
  positionAbsoluteX: 0, positionAbsoluteY: 0, deletable: true, selectable: true, draggable: true,
}
const META = {
  sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
  achievementProbability: null as number | null, goalFitAvailable: false, stabilityPercentage: null,
  winRate: null, isResultsMode: false, predictedOutcome: null, valueOfInformation: null, voiRank: null,
}
/** C CEE `hiringGraph`: productivity is a change in % of today. */
const HIRING = { label: 'Productivity', quantity_frame: 'change', goal_threshold_frame: 'change_abs', goal_threshold_raw: 10, goal_threshold_unit: '%', goal_direction: '>=', threshold_source: 'brief_extraction' }
/** CHECK-C-cee-r1 item 1's case: capacity is a LEVEL in % (75% today). */
const CAPACITY = { ...HIRING, label: 'Capacity', quantity_frame: 'level' }
const goalNode = (data: Record<string, unknown>) => ({ id: 'goal', type: 'goal', position: { x: 0, y: 0 }, data }) as never

function card(data: Record<string, unknown>): string {
  vi.mocked(useCanvasStore).mockImplementation((selector: any) => selector({
    hoveredOptionId: null, nodes: [], edges: [], ceeAnalysisReady: null, results: { status: 'idle', report: null },
    highlightedNodes: new Set(), dimmedNodeIds: new Set(), lens: { _dimmedNodeIds: new Set() }, goalThreshold: null,
    goalConstraints: null, setHoveredOption: vi.fn(), viewMode: 'standard',
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' }, analysisFreshnessDirty: false,
  } as never))
  render(<ReactFlowProvider><GoalNode {...(baseProps as any)} id="goal" type="goal" data={{ type: 'goal', ...data } as any} /></ReactFlowProvider>)
  return screen.getByTestId('goal-node-resting-state').textContent ?? ''
}
const bound = (data: typeof HIRING) => {
  const t = resolveGoalTarget(data)!
  return formatGoalChangeBound(Number(t.raw), t.unit, t.frame, data.goal_direction, t.quantityFrame)
}
const targetRow = (quantity_frame?: string) => goalConstraintText(
  { constraint_id: 'target:capacity', node_id: 'capacity', operator: '>=', value: 10, unit: '%', value_frame: 'change_abs', role: 'goal_target' } as never,
  [{ id: 'capacity', data: { label: 'Capacity', ...(quantity_frame ? { quantity_frame } : {}) } }],
)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useNodeDisplayMetadata).mockReturnValue({ ...META } as never)
})
afterEach(() => cleanup())

describe('a % change_abs target is said in percentage points only on a LEVEL quantity', () => {
  it('capacity (level): card, Success row, bound and target row all say "10 percentage points"', () => {
    expect(card(CAPACITY)).toContain('Target: up 10 percentage points from today')
    expect(computeSuccessState(goalNode(CAPACITY), null, null, null).displayText).toBe('up 10 percentage points from today')
    expect(bound(CAPACITY)).toBe('up at least 10 percentage points from today')
    expect(targetRow('level')).toBe('Target: Capacity at least 10 percentage points above today')
  })

  it('CONTROL hiring (change): every surface keeps "10% from today", as CEE says it', () => {
    expect(card(HIRING)).toContain('Target: up 10% from today')
    expect(computeSuccessState(goalNode(HIRING), null, null, null).displayText).toBe('up 10% from today')
    expect(bound(HIRING)).toBe('up at least 10% from today')
    expect(targetRow('change')).toBe('Target: Capacity at least 10% above today')
  })

  it('no quantity_frame: no size is said on any surface ("10%" and "10 points" are both guesses), as for an unread frame', () => {
    const { quantity_frame: _q, ...noFrame } = CAPACITY
    expect(card(noFrame)).not.toMatch(/10%|percentage point/)
    expect(computeSuccessState(goalNode(noFrame), null, null, null)).toMatchObject({ isSet: false, displayText: null })
    expect(resolveGoalTarget(noFrame)).toBeNull()
    expect(targetRow()).toBe('Target not captured')
    // The formatters themselves never guess either (defence in depth behind the resolver).
    expect(formatGoalTarget(10, '%', 'change_abs')).toBeNull()
    expect(formatGoalChangeBound(10, '%', 'change_abs', '>=')).toBeNull()
  })

  it('CONTROLS: change_rel is a fraction of today whatever the quantity; a plain LIMIT keeps CEE\'s limit sentence; 1 point', () => {
    const rel = { ...CAPACITY, goal_threshold_frame: 'change_rel', goal_threshold_raw: 0.1 }
    expect(computeSuccessState(goalNode(rel), null, null, null).displayText).toBe('up 10% from today')
    const limitRow = { constraint_id: 'limit:capacity', node_id: 'capacity', operator: '>=', value: 10, unit: '%', value_frame: 'change_abs' }
    expect(goalConstraintText(limitRow as never, [{ id: 'capacity', data: { label: 'Capacity', quantity_frame: 'level' } }]))
      .toBe('Capacity at least 10% above today')
    expect(computeSuccessState(goalNode({ ...CAPACITY, goal_threshold_raw: 1 }), null, null, null).displayText).toBe('up 1 percentage point from today')
  })
})
