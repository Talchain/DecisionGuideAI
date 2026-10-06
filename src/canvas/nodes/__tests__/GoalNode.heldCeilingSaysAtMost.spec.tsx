/**
 * SD-1 (domain 2, github-07; DL 0df0e1 6 Oct; a8 census): a goal HOLDING a ceiling says "at most" on its card, at rest.
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

const baseProps = {
  selected: false, dragging: false, zIndex: 0, isConnectable: false,
  positionAbsoluteX: 0, positionAbsoluteY: 0, deletable: true, selectable: true, draggable: true,
}

const META = {
  sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
  achievementProbability: null as number | null, goalFitAvailable: false, stabilityPercentage: null,
  winRate: null, isResultsMode: false, predictedOutcome: null, valueOfInformation: null, voiRank: null,
}

const GOAL_ID = 'goal-1'
const CHURN = { id: 'fac_churn', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Monthly churn', type: 'factor' } }
const NRR = { id: 'out_nrr', type: 'outcome', position: { x: 0, y: 0 }, data: { label: 'Net revenue retention', type: 'outcome' } }
/** The reader's own limit, stated in the brief: "keep monthly churn under 7%". */
const CHURN_LIMIT = { id: 'c_churn', node_id: 'fac_churn', operator: '<=', value: 7, unit: '%', provenance: 'explicit' }

function mockStore(over: Record<string, unknown> = {}) {
  vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
    selector({
      hoveredOptionId: null,
      nodes: [CHURN, NRR],
      edges: [],
      ceeAnalysisReady: null,
      results: { status: 'idle', report: null },
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      lens: { _dimmedNodeIds: new Set() },
      goalThreshold: null,
      goalConstraints: [CHURN_LIMIT],
      setHoveredOption: vi.fn(),
      viewMode: 'standard',
      analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
      analysisFreshnessDirty: false,
      ...over,
    } as never),
  )
}


function renderGoal(data: Record<string, unknown>) {
  return render(
    <ReactFlowProvider>
      <GoalNode {...(baseProps as any)} id={GOAL_ID} type="goal" data={{ type: 'goal', label: 'Monthly cancellations', ...data } as any} />
    </ReactFlowProvider>,
  )
}

const row = () => screen.getByTestId('goal-node-resting-state')
const pill = (constraintId: string) => screen.queryByTestId(`goal-limit-pill-${GOAL_ID}-${constraintId}`)
const allPills = () => screen.queryAllByTestId(new RegExp(`^goal-limit-pill-${GOAL_ID}-`))
const UNIT = 'cancellations/month'
/** The goal's own "at most 400" row as the Confirm turn served it (re-keyed to this harness's goal). */
const OWN_ROW = {
  constraint_id: 'gc-111d4aa6-6f70-4de4-a1af-4a8cdb35723a', node_id: GOAL_ID, operator: '<=', value: 400,
  label: 'monthly cancellations', unit: UNIT, provenance: 'explicit', value_frame: 'level',
}
/** CEE's brief-stated ceiling stamp (RT-10 #2585): the figure, its unit and the side it is on. */
const STAMPED_CEILING = { goal_threshold_raw: 400, goal_threshold_unit: UNIT, goal_direction: '<=', threshold_source: 'brief_extraction' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useNodeDisplayMetadata).mockReturnValue({ ...META } as never)
})
afterEach(() => cleanup())

/**
 * SD-1 (DL 0df0e1 6 Oct): the goal card says the side its target is on, from the node's own `goal_direction`, and the
 * goal's own "≤ 400" row is that target restated — not a second limit pill beside it. Harness:
 * `GoalNode.atMostIsNotUncaptured.spec.tsx`.
 */
describe('the goal card says "at most" for a goal that holds a ceiling', () => {
  it('⭐ stamped ceiling: the resting row says "at most 400", and its own ≤ row is not a duplicate pill', () => {
    mockStore({ goalConstraints: [OWN_ROW] })
    renderGoal(STAMPED_CEILING)
    expect(row().textContent).toMatch(/at most 400/)
    expect(pill(OWN_ROW.constraint_id)).toBeNull()
  })
  it('CONTRAST: a held floor at the same figure says no bound, and a ≤ 400 row beside it is a real limit pill', () => {
    mockStore({ goalConstraints: [OWN_ROW] })
    renderGoal({ ...STAMPED_CEILING, goal_direction: '>=' })
    expect(row().textContent).not.toMatch(/at most|at least/)
    expect(row().textContent).toMatch(/400/)
    expect(pill(OWN_ROW.constraint_id)).not.toBeNull()
  })
  it('CONTRAST: another node\'s limit is still a pill on a ceiling goal', () => {
    mockStore({ goalConstraints: [OWN_ROW, CHURN_LIMIT] })
    renderGoal(STAMPED_CEILING)
    expect(allPills().map((p) => p.getAttribute('data-testid'))).toEqual([`goal-limit-pill-${GOAL_ID}-c_churn`])
  })
})
