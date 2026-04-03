/**
 * Tests for applyDraftResult utility
 *
 * Covers:
 * - Node mapping from CEE adapter output to React Flow format
 * - Edge mapping with weight priority and direction inference
 * - Store updates (nodes/edges, goal selection, analysis_ready)
 * - Empty graph handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyDraftResult, backfillInterventionsOntoOptionNodes, backfillGoalThresholdOntoGoalNode } from '../applyDraftResult'

// Mock canvas store
const mockPushHistory = vi.fn()
const mockApplyLayout = vi.fn(() => Promise.resolve())
const mockSetPendingFitView = vi.fn()
const mockSetOutcomeNode = vi.fn()
const mockSetCeeAnalysisReady = vi.fn()
const mockSetCeePipelineTrace = vi.fn()
const mockSetCeeQuality = vi.fn()
const mockSetGoalConstraints = vi.fn()

let storeNodes: any[] = []
let storeEdges: any[] = []

vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    // Selector function (used as hook)
    vi.fn(),
    {
      getState: () => ({
        nodes: storeNodes,
        edges: storeEdges,
        pushHistory: mockPushHistory,
        applyLayout: mockApplyLayout,
        setPendingFitView: mockSetPendingFitView,
        setOutcomeNode: mockSetOutcomeNode,
        setCeeAnalysisReady: mockSetCeeAnalysisReady,
        setCeePipelineTrace: mockSetCeePipelineTrace,
        setCeeQuality: mockSetCeeQuality,
        setGoalConstraints: mockSetGoalConstraints,
        currentScenarioId: null,
      }),
      setState: vi.fn((update: any) => {
        if (update.nodes) storeNodes = update.nodes
        if (update.edges) storeEdges = update.edges
      }),
    }
  ),
}))

// Mock saveAutosave
vi.mock('../../store/scenarios', () => ({
  saveAutosave: vi.fn(),
}))

// Mock CEE type guards
vi.mock('../../../adapters/cee/types', () => ({
  hasAnalysisReady: (data: any) =>
    data?.analysis_ready?.options &&
    typeof data?.analysis_ready?.goal_node_id === 'string',
  isCEEv3Response: (data: any) =>
    data?.analysis_ready != null &&
    (Array.isArray(data?.nodes) || Array.isArray(data?.graph?.nodes)) &&
    (Array.isArray(data?.edges) || Array.isArray(data?.graph?.edges)),
}))

describe('applyDraftResult', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeNodes = []
    storeEdges = []
  })

  it('maps CEE nodes to React Flow format', () => {
    const draftData = {
      nodes: [
        { id: 'g1', kind: 'goal', label: 'Revenue', observed_state: { value: 100 } },
        { id: 'f1', kind: 'factor', label: 'Price', category: 'controllable' },
      ],
      edges: [],
    } as any

    const result = applyDraftResult(draftData)

    expect(result.nodeCount).toBe(2)
    expect(mockPushHistory).toHaveBeenCalled()

    // Check nodes were mapped correctly
    expect(storeNodes).toHaveLength(2)
    expect(storeNodes[0].type).toBe('goal')
    expect(storeNodes[0].data.label).toBe('Revenue')
    expect(storeNodes[0].data.kind).toBe('goal')
    expect(storeNodes[0].data.observedState).toEqual({ value: 100 })
    expect(storeNodes[0].position).toEqual({ x: 0, y: 0 })

    // category is passed through via ...rest
    expect(storeNodes[1].data.category).toBe('controllable')
  })

  it('maps CEE edges with weight priority: strength.mean > strength_mean > weight', () => {
    const draftData = {
      nodes: [
        { id: 'f1', kind: 'factor', label: 'A' },
        { id: 'f2', kind: 'factor', label: 'B' },
        { id: 'f3', kind: 'factor', label: 'C' },
        { id: 'g1', kind: 'goal', label: 'Goal' },
      ],
      edges: [
        { from: 'f1', to: 'g1', strength: { mean: 0.8, std: 0.1 }, effect_direction: 'positive' },
        { from: 'f2', to: 'g1', strength_mean: 0.6, effect_direction: 'negative' },
        { from: 'f3', to: 'g1', weight: 0.4 },
      ],
    } as any

    applyDraftResult(draftData)

    expect(storeEdges).toHaveLength(3)
    expect(storeEdges[0].data.weight).toBe(0.8)
    expect(storeEdges[0].data.strengthStd).toBe(0.1)
    expect(storeEdges[0].data.direction).toBe('positive')

    expect(storeEdges[1].data.weight).toBe(0.6)
    expect(storeEdges[1].data.direction).toBe('negative')

    expect(storeEdges[2].data.weight).toBe(0.4)
    expect(storeEdges[2].data.direction).toBe('positive') // inferred from positive weight
  })

  it('auto-selects goal node when exactly one exists', () => {
    const draftData = {
      nodes: [
        { id: 'g1', kind: 'goal', label: 'Revenue' },
        { id: 'f1', kind: 'factor', label: 'Price' },
      ],
      edges: [],
    } as any

    applyDraftResult(draftData)
    expect(mockSetOutcomeNode).toHaveBeenCalledWith('g1')
  })

  it('does not auto-select goal when multiple goals exist', () => {
    const draftData = {
      nodes: [
        { id: 'g1', kind: 'goal', label: 'Revenue' },
        { id: 'g2', kind: 'goal', label: 'Profit' },
      ],
      edges: [],
    } as any

    applyDraftResult(draftData)
    expect(mockSetOutcomeNode).not.toHaveBeenCalled()
  })

  it('stores analysis_ready when present', () => {
    const draftData = {
      nodes: [{ id: 'g1', kind: 'goal', label: 'Revenue' }],
      edges: [],
      analysis_ready: {
        options: [{ id: 'o1', status: 'ready', interventions: { f1: { value: 10 } } }],
        goal_node_id: 'g1',
        status: 'ready',
      },
    } as any

    applyDraftResult(draftData)
    expect(mockSetCeeAnalysisReady).toHaveBeenCalledWith(draftData.analysis_ready)
  })

  it('returns zero counts for empty graph', () => {
    const draftData = { nodes: [], edges: [] } as any

    const result = applyDraftResult(draftData)
    expect(result.nodeCount).toBe(0)
    expect(result.edgeCount).toBe(0)
    expect(mockPushHistory).not.toHaveBeenCalled()
  })

  it('infers negative direction from negative weight', () => {
    const draftData = {
      nodes: [
        { id: 'f1', kind: 'factor', label: 'A' },
        { id: 'g1', kind: 'goal', label: 'Goal' },
      ],
      edges: [
        { from: 'f1', to: 'g1', weight: -0.7 },
      ],
    } as any

    applyDraftResult(draftData)
    expect(storeEdges[0].data.direction).toBe('negative')
    expect(storeEdges[0].data.weight).toBe(0.7) // absolute value
  })

  it('preserves V3 edge_type, provenance_source, and exists_probability', () => {
    const draftData = {
      nodes: [
        { id: 'f1', kind: 'factor', label: 'A' },
        { id: 'g1', kind: 'goal', label: 'Goal' },
      ],
      edges: [
        {
          from: 'f1',
          to: 'g1',
          strength: { mean: 0.65, std: 0.12 },
          effect_direction: 'positive',
          belief_exists: 0.85,
          edge_type: 'directed',
          provenance_source: 'document',
          exists_probability: 0.9,
        },
      ],
    } as any

    applyDraftResult(draftData)

    expect(storeEdges).toHaveLength(1)
    const edgeData = storeEdges[0].data

    // Core fields
    expect(edgeData.weight).toBe(0.65)
    expect(edgeData.strengthStd).toBe(0.12)
    expect(edgeData.direction).toBe('positive')
    expect(edgeData.beliefExists).toBe(0.85)

    // V3 fields
    expect(edgeData.edge_type).toBe('directed')
    expect(edgeData.provenance_source).toBe('document')
    expect(edgeData.exists_probability).toBe(0.9)
  })

  it('falls back beliefExists from exists_probability when belief_exists is absent', () => {
    const draftData = {
      nodes: [
        { id: 'f1', kind: 'factor', label: 'A' },
        { id: 'g1', kind: 'goal', label: 'Goal' },
      ],
      edges: [
        {
          from: 'f1',
          to: 'g1',
          weight: 0.5,
          exists_probability: 0.75,
          // no belief_exists, no belief
        },
      ],
    } as any

    applyDraftResult(draftData)

    expect(storeEdges[0].data.beliefExists).toBe(0.75)
  })

  it('derives interventionKeys on option nodes with inline interventions', () => {
    const draftData = {
      nodes: [
        { id: 'o1', kind: 'option', label: 'Option A', interventions: { f1: { value: 10 } } },
        { id: 'g1', kind: 'goal', label: 'Goal' },
      ],
      edges: [],
    } as any

    applyDraftResult(draftData)

    const optionNode = storeNodes.find((n: any) => n.id === 'o1')
    expect(optionNode.data.interventions).toEqual({ f1: { value: 10 } })
    expect(optionNode.data.interventionKeys).toEqual(['f1'])
  })

  it('omits V3 fields when not present in CEE response', () => {
    const draftData = {
      nodes: [
        { id: 'f1', kind: 'factor', label: 'A' },
        { id: 'g1', kind: 'goal', label: 'Goal' },
      ],
      edges: [
        { from: 'f1', to: 'g1', weight: 0.5, effect_direction: 'positive' },
      ],
    } as any

    applyDraftResult(draftData)

    expect(storeEdges[0].data).not.toHaveProperty('edge_type')
    expect(storeEdges[0].data).not.toHaveProperty('provenance_source')
    expect(storeEdges[0].data).not.toHaveProperty('exists_probability')
  })

  it('backfills interventions onto option nodes from analysis_ready', () => {
    const interventions = { f1: { value: 10, source: 'cee_hypothesis' } }
    const draftData = {
      nodes: [
        { id: 'g1', kind: 'goal', label: 'Revenue' },
        { id: 'o1', kind: 'option', label: 'Option A' },
        { id: 'f1', kind: 'factor', label: 'Price' },
      ],
      edges: [],
      analysis_ready: {
        options: [{ id: 'o1', status: 'ready', interventions }],
        goal_node_id: 'g1',
        status: 'ready',
      },
    } as any

    applyDraftResult(draftData)

    expect(mockSetCeeAnalysisReady).toHaveBeenCalled()

    // Option node should have interventions backfilled
    const optionNode = storeNodes.find((n: any) => n.id === 'o1')
    expect(optionNode).toBeDefined()
    expect(optionNode.data.interventions).toEqual(interventions)
    expect(optionNode.data.interventionKeys).toEqual(['f1'])
  })

  // Regression: backfill must match all option identifiers (data.kind or data.type),
  // consistent with extractOptionsFromNodes. The original n.type guard was wrong.
  it('backfills interventions onto option nodes identified by data.kind="option"', () => {
    const interventions = { f1: { value: 0.8, source: 'cee_hypothesis' } }

    // type='default' with data.kind='option' — common for nodes going through non-CEE paths
    storeNodes = [
      { id: 'g1', type: 'goal', data: { kind: 'goal', label: 'Revenue' }, position: { x: 0, y: 0 } },
      { id: 'o1', type: 'default', data: { kind: 'option', label: 'Option A' }, position: { x: 100, y: 0 } },
      { id: 'f1', type: 'default', data: { kind: 'factor', label: 'Price' }, position: { x: 200, y: 0 } },
    ]

    backfillInterventionsOntoOptionNodes({
      options: [{ id: 'o1', interventions }],
    })

    const optionNode = storeNodes.find((n: any) => n.id === 'o1')
    expect(optionNode).toBeDefined()
    expect(optionNode.data.interventions).toEqual(interventions)
    expect(optionNode.data.interventionKeys).toEqual(['f1'])
  })

  it('backfills interventions onto option nodes identified by legacy data.type="option"', () => {
    const interventions = { f1: { value: 0.5, source: 'cee_hypothesis' } }

    // Legacy CEE response path: data.type set instead of data.kind
    storeNodes = [
      { id: 'g1', type: 'goal', data: { kind: 'goal', label: 'Revenue' }, position: { x: 0, y: 0 } },
      { id: 'o1', type: 'default', data: { type: 'option', label: 'Option A' }, position: { x: 100, y: 0 } },
      { id: 'f1', type: 'default', data: { kind: 'factor', label: 'Price' }, position: { x: 200, y: 0 } },
    ]

    backfillInterventionsOntoOptionNodes({
      options: [{ id: 'o1', interventions }],
    })

    const optionNode = storeNodes.find((n: any) => n.id === 'o1')
    expect(optionNode).toBeDefined()
    expect(optionNode.data.interventions).toEqual(interventions)
    expect(optionNode.data.interventionKeys).toEqual(['f1'])
  })

  it('clamps weight to [0, 2] range', () => {
    const draftData = {
      nodes: [
        { id: 'f1', kind: 'factor', label: 'A' },
        { id: 'g1', kind: 'goal', label: 'Goal' },
      ],
      edges: [
        { from: 'f1', to: 'g1', weight: 5.0 },
      ],
    } as any

    applyDraftResult(draftData)
    expect(storeEdges[0].data.weight).toBe(2)
  })

  it('handles graph.nodes path (nested response)', () => {
    const draftData = {
      graph: {
        nodes: [{ id: 'f1', kind: 'factor', label: 'A' }],
        edges: [],
      },
    } as any

    const result = applyDraftResult(draftData)
    expect(result.nodeCount).toBe(1)
  })

  it('replaces existing nodes/edges instead of appending', () => {
    // Pre-populate store with existing data
    storeNodes = [
      { id: 'old1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Old' } },
    ]
    storeEdges = [
      { id: 'old-e1', source: 'old1', target: 'old2', data: {} },
    ]

    const draftData = {
      nodes: [
        { id: 'new1', kind: 'goal', label: 'New Goal' },
      ],
      edges: [],
    } as any

    applyDraftResult(draftData)

    // Should contain only new nodes, not old + new
    expect(storeNodes).toHaveLength(1)
    expect(storeNodes[0].id).toBe('new1')
    expect(storeEdges).toHaveLength(0)
  })

  it('backfills is_baseline from analysis_ready onto option nodes', () => {
    const draftData = {
      nodes: [
        { id: 'g1', kind: 'goal', label: 'Revenue' },
        { id: 'o1', kind: 'option', label: 'Status Quo' },
        { id: 'o2', kind: 'option', label: 'New Price' },
        { id: 'f1', kind: 'factor', label: 'Price' },
      ],
      edges: [],
      analysis_ready: {
        options: [
          { id: 'o1', status: 'ready', interventions: {}, is_baseline: true },
          { id: 'o2', status: 'ready', interventions: { f1: { value: 10 } }, is_baseline: false },
        ],
        goal_node_id: 'g1',
        status: 'ready',
      },
    } as any

    applyDraftResult(draftData)

    const baselineNode = storeNodes.find((n: any) => n.id === 'o1')
    const nonBaselineNode = storeNodes.find((n: any) => n.id === 'o2')
    expect(baselineNode.data.is_baseline).toBe(true)
    // Non-baseline with is_baseline: false should be explicitly false
    expect(nonBaselineNode.data.is_baseline).toBe(false)
  })

  it('backfills goal_threshold_raw/unit/cap from analysis_ready onto goal node', () => {
    const draftData = {
      nodes: [
        { id: 'g1', kind: 'goal', label: 'Revenue' },
        { id: 'f1', kind: 'factor', label: 'Price' },
      ],
      edges: [],
      analysis_ready: {
        options: [{ id: 'o1', status: 'ready', interventions: { f1: { value: 10 } } }],
        goal_node_id: 'g1',
        status: 'ready',
        goal_threshold_raw: 20000,
        goal_threshold_unit: '£',
        goal_threshold_cap: 50000,
      },
    } as any

    applyDraftResult(draftData)

    const goalNode = storeNodes.find((n: any) => n.id === 'g1')
    expect(goalNode.data.goal_threshold_raw).toBe(20000)
    expect(goalNode.data.goal_threshold_unit).toBe('£')
    expect(goalNode.data.goal_threshold_cap).toBe(50000)
  })

  it('stores goal_constraints from V3 response root', () => {
    const constraints = [
      { id: 'c1', label: 'Churn ≤ 5%', operator: '<=', value: 0.05 },
    ]
    const draftData = {
      nodes: [
        { id: 'g1', kind: 'goal', label: 'Revenue' },
        { id: 'f1', kind: 'factor', label: 'Price' },
      ],
      edges: [
        { from: 'f1', to: 'g1', weight: 0.5 },
      ],
      analysis_ready: {
        options: [{ id: 'o1', status: 'ready', interventions: { f1: { value: 10 } } }],
        goal_node_id: 'g1',
        status: 'ready',
      },
      goal_constraints: constraints,
    } as any

    applyDraftResult(draftData)

    expect(mockSetGoalConstraints).toHaveBeenCalledWith(constraints)
  })

  it('clears stale goal_constraints when V3 response has none (no-constraint draft after constrained draft)', () => {
    const draftData = {
      nodes: [
        { id: 'g1', kind: 'goal', label: 'Revenue' },
        { id: 'f1', kind: 'factor', label: 'Price' },
      ],
      edges: [
        { from: 'f1', to: 'g1', weight: 0.5 },
      ],
      analysis_ready: {
        options: [{ id: 'o1', status: 'ready', interventions: { f1: { value: 10 } } }],
        goal_node_id: 'g1',
        status: 'ready',
      },
      // No goal_constraints field — simulates a hiring brief after a pricing brief
    } as any

    applyDraftResult(draftData)

    expect(mockSetGoalConstraints).toHaveBeenCalledWith(null)
  })

  it('clears stale is_baseline when baseline option changes', () => {
    // Pre-populate: o1 was previously the baseline
    storeNodes = [
      { id: 'g1', type: 'goal', data: { kind: 'goal', label: 'Revenue' }, position: { x: 0, y: 0 } },
      { id: 'o1', type: 'option', data: { kind: 'option', label: 'Old Baseline', is_baseline: true }, position: { x: 0, y: 0 } },
      { id: 'o2', type: 'option', data: { kind: 'option', label: 'New Baseline' }, position: { x: 0, y: 0 } },
    ]

    // Now analysis_ready says o2 is baseline, o1 is not
    backfillInterventionsOntoOptionNodes({
      options: [
        { id: 'o1', is_baseline: false },
        { id: 'o2', is_baseline: true },
      ],
    })

    const o1 = storeNodes.find((n: any) => n.id === 'o1')
    const o2 = storeNodes.find((n: any) => n.id === 'o2')
    expect(o1.data.is_baseline).toBe(false) // cleared
    expect(o2.data.is_baseline).toBe(true)
  })

  it('preserves V3 factor fields via ...rest spread (display_value, intercept, encoding_map)', () => {
    const draftData = {
      nodes: [
        {
          id: 'f1',
          kind: 'factor',
          label: 'Price',
          display_value: '£49',
          intercept: 0.3,
          encoding_map: { low: 0, high: 1 },
          observed_state: { value: 0.5, unit: '£' },
        },
        { id: 'g1', kind: 'goal', label: 'Revenue' },
      ],
      edges: [],
    } as any

    applyDraftResult(draftData)

    const factorNode = storeNodes.find((n: any) => n.id === 'f1')
    expect(factorNode.data.display_value).toBe('£49')
    expect(factorNode.data.intercept).toBe(0.3)
    expect(factorNode.data.encoding_map).toEqual({ low: 0, high: 1 })
  })
})

describe('backfillGoalThresholdOntoGoalNode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeNodes = []
    storeEdges = []
  })

  it('writes goal_threshold_raw/unit/cap onto the goal node', () => {
    storeNodes = [
      { id: 'g1', type: 'goal', data: { kind: 'goal', label: 'Revenue' }, position: { x: 0, y: 0 } },
      { id: 'f1', type: 'factor', data: { kind: 'factor', label: 'Price' }, position: { x: 100, y: 0 } },
    ]

    backfillGoalThresholdOntoGoalNode({
      goal_node_id: 'g1',
      goal_threshold_raw: 20000,
      goal_threshold_unit: '£',
      goal_threshold_cap: 50000,
    })

    const goalNode = storeNodes.find((n: any) => n.id === 'g1')
    expect(goalNode.data.goal_threshold_raw).toBe(20000)
    expect(goalNode.data.goal_threshold_unit).toBe('£')
    expect(goalNode.data.goal_threshold_cap).toBe(50000)
  })

  it('is idempotent — no store write when values match', async () => {
    storeNodes = [
      { id: 'g1', type: 'goal', data: { kind: 'goal', label: 'Revenue', goal_threshold_raw: 20000, goal_threshold_unit: '£', goal_threshold_cap: 50000 }, position: { x: 0, y: 0 } },
    ]

    const { useCanvasStore } = await import('../../store')
    ;(useCanvasStore.setState as any).mockClear()

    backfillGoalThresholdOntoGoalNode({
      goal_node_id: 'g1',
      goal_threshold_raw: 20000,
      goal_threshold_unit: '£',
      goal_threshold_cap: 50000,
    })

    expect(useCanvasStore.setState).not.toHaveBeenCalled()
  })

  it('no-ops when goal_node_id is missing', async () => {
    const { useCanvasStore } = await import('../../store')
    ;(useCanvasStore.setState as any).mockClear()

    backfillGoalThresholdOntoGoalNode({ goal_threshold_raw: 100 })

    expect(useCanvasStore.setState).not.toHaveBeenCalled()
  })

  it('no-ops when threshold fields are absent from analysisReady', async () => {
    storeNodes = [
      { id: 'g1', type: 'goal', data: { kind: 'goal', label: 'Revenue' }, position: { x: 0, y: 0 } },
    ]

    const { useCanvasStore } = await import('../../store')
    ;(useCanvasStore.setState as any).mockClear()

    // No goal_threshold_* fields present at all — should not touch node
    backfillGoalThresholdOntoGoalNode({
      goal_node_id: 'g1',
    })

    expect(useCanvasStore.setState).not.toHaveBeenCalled()
  })

  it('clears stale threshold values when analysisReady explicitly sends null', async () => {
    storeNodes = [
      { id: 'g1', type: 'goal', data: { kind: 'goal', label: 'Revenue', goal_threshold_raw: 20000, goal_threshold_unit: '£', goal_threshold_cap: 50000 }, position: { x: 0, y: 0 } },
    ]

    backfillGoalThresholdOntoGoalNode({
      goal_node_id: 'g1',
      goal_threshold_raw: null,
      goal_threshold_unit: null,
      goal_threshold_cap: null,
    })

    const goalNode = storeNodes.find((n: any) => n.id === 'g1')
    expect(goalNode.data.goal_threshold_raw).toBeNull()
    expect(goalNode.data.goal_threshold_unit).toBeNull()
    expect(goalNode.data.goal_threshold_cap).toBeNull()
  })
})
