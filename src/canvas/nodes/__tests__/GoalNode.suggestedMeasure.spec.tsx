/**
 * ⭐ OLUMI'S SUGGESTED MEASURE ON THE GOAL CARD (CEE #3585, buddy AMEND; DL 21 Oct). When the saved living model's aim for
 * THIS goal carries `target.source === 'olumi'`, the card says its quantity and unit as "Olumi's suggested measure", even
 * with every figure null, and creates no numeric threshold: no "Target:" line, and the target-not-captured chip and its
 * edit path are exactly as before. Harness: `GoalNode.atMostIsNotUncaptured.spec.tsx`. SYNTHETIC living model.
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
const saved = vi.hoisted(() => ({ graph: null as unknown }))
vi.mock('../shared/savedGraph', () => ({
  useSavedGraph: () => saved.graph,
  // The program reader (`savedModelProgram.ts`) reads the same saved graph.
  useSavedGraphRead: () => (saved.graph == null ? { status: 'none' } : { status: 'read', graph: saved.graph }),
}))

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


const measure = () => screen.queryByTestId(`goal-suggested-measure-${GOAL_ID}`)
const chip = () => screen.queryByTestId('goal-node-no-target-chip')
const aim = (target: Record<string, unknown> | null, id = GOAL_ID) => ({ id, text: 'Grow the bakery', status: 'current', source: 'user', target })
const TARGET = { quantity: 'weekly profit', comparator: '>=', value: null, low: null, high: null, unit: '£', by_when: null,
  baseline: 'today', current: null, current_source: null, current_unit: null, change_kind: null }
const withAims = (...aims: unknown[]) => ({ nodes: [], edges: [], living_model: { aims, links: [], options: [], factors: [], risks: [] } })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useNodeDisplayMetadata).mockReturnValue({ ...META } as never)
  saved.graph = null
  mockStore({ goalConstraints: [] })
})
afterEach(() => cleanup())

describe("the goal card says Olumi's suggested measure as Olumi's, and never as a target", () => {
  it("⭐ RED: an aim whose target Olumi suggested, every figure null → \"Olumi's suggested measure: weekly profit (£)\"; no target line; the chip as before", () => {
    saved.graph = withAims(aim({ ...TARGET, source: 'olumi' }))
    renderGoal({})
    expect(measure()?.textContent?.trim()).toBe('Olumi\u2019s suggested measure: weekly profit (£)')
    expect(screen.queryByTestId('goal-target-route')).toBeNull()
    expect(screen.queryByTestId('goal-target-line')).toBeNull()
    expect(chip(), 'the no-target chip and its edit path are unchanged').not.toBeNull()
  })
  it('CONTROL: the same measure the PERSON stated (source not olumi) is not called Olumi\'s', () => {
    saved.graph = withAims(aim({ ...TARGET, source: null }))
    renderGoal({})
    expect(measure()).toBeNull()
  })
  it("CONTROL: Olumi's measure on ANOTHER aim (not this goal) is not shown on this card", () => {
    saved.graph = withAims(aim(null), aim({ ...TARGET, source: 'olumi' }, 'aim_other'))
    renderGoal({})
    expect(measure()).toBeNull()
  })
  it('a unit that only repeats the quantity is said once', () => {
    saved.graph = withAims(aim({ ...TARGET, quantity: 'units', unit: 'units', source: 'olumi' }))
    renderGoal({})
    expect(measure()?.textContent?.trim()).toBe('Olumi\u2019s suggested measure: units')
  })
  it('a goal with a target the card states shows the target, never the suggestion beside it', () => {
    saved.graph = withAims(aim({ ...TARGET, source: 'olumi' }))
    renderGoal({ goal_threshold_raw: 2000, goal_threshold_unit: '£', goal_threshold: 0.8, threshold_source: 'user' })
    expect(measure()).toBeNull()
  })
})
