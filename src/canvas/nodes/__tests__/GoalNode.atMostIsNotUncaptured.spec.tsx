/**
 * "AT MOST 400" IS NOT "TARGET NOT CAPTURED" (DL 0df0e1 ruling; red team #87 6003539060). CEE stores a `<=` target only
 * as the goal's own limit row (never `goal_threshold_raw`), so the node holds none and the card said "Target not
 * captured" over the target the user had just set. SUPPRESS-ONLY: when the goal's own non-deadline limit row is its
 * target (CEE's `goalOwnLimitRow`), the chip is not shown and that row's pill states it at rest. Harness:
 * `GoalNode.limitPillsOnTheTargetRow.spec.tsx`. Row: the Confirm turn's served shape (`wire/bpw1-edit.resp.txt`).
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
      <GoalNode {...(baseProps as any)} id={GOAL_ID} type="goal" data={{ type: 'goal', label: 'Reach £20k MRR', ...data } as any} />
    </ReactFlowProvider>,
  )
}

const row = () => screen.getByTestId('goal-node-resting-state')
const pill = (constraintId: string) => screen.queryByTestId(`goal-limit-pill-${GOAL_ID}-${constraintId}`)
const allPills = () => screen.queryAllByTestId(new RegExp(`^goal-limit-pill-${GOAL_ID}-`))

/** The goal's own "at most 400" row, as the Confirm turn served it (re-keyed to this harness's goal). */
const OWN_ROW = {
  constraint_id: 'gc-111d4aa6-6f70-4de4-a1af-4a8cdb35723a', node_id: GOAL_ID, operator: '<=', value: 400,
  label: 'monthly cancellations', unit: 'cancellations/month', provenance: 'explicit', value_frame: 'level',
}
const chip = () => screen.queryByTestId('goal-node-no-target-chip')

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useNodeDisplayMetadata).mockReturnValue({ ...META } as never)
})
afterEach(() => cleanup())

describe('the goal card does not say "Target not captured" over a stated "at most 400"', () => {
  it('PRECONDITION (the defect\'s other half): no target and no limit → the chip, unchanged', () => {
    mockStore({ goalConstraints: [] })
    renderGoal({})
    expect(chip()).not.toBeNull()
    expect(allPills()).toEqual([])
  })
  it('⭐ the goal\'s own "at most 400" row → no chip, and its pill states the target on the resting row', () => {
    mockStore({ goalConstraints: [OWN_ROW] })
    renderGoal({})
    expect(chip()).toBeNull()
    const p = pill(OWN_ROW.constraint_id)
    expect(p, 'the own row\'s pill renders at rest').not.toBeNull()
    expect(p!.textContent).toContain('400')
    expect(row().contains(p!)).toBe(true)
    expect(screen.queryByTestId('goal-target-route')).toBeNull() // no target line: nothing printed twice
  })
  it('after a Run with the graph slice cleared: the run\'s rows say it', () => {
    mockStore({ goalConstraints: null, results: { status: 'complete', report: { goal_constraints: [OWN_ROW] } } })
    renderGoal({})
    expect(chip()).toBeNull()
  })
  it('CONTROL — a DEADLINE row on the goal ("within 6 months") is not the target: the chip stays', () => {
    mockStore({ goalConstraints: [{ ...OWN_ROW, deadline_metadata: { as_stated: 'within 6 months' } }] })
    renderGoal({})
    expect(chip()).not.toBeNull()
  })
  it('CONTROL — another node\'s limit only: the chip stays (unchanged)', () => {
    mockStore({ goalConstraints: [CHURN_LIMIT] })
    renderGoal({})
    expect(chip()).not.toBeNull()
  })
})
