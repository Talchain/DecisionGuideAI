/**
 * Tests for applyAutoApplyPatch and sortPatchOperations
 *
 * Verifies:
 * - Bulk node insertion with correct field normalisation (kind→type, from/to→source/target)
 * - Operation sorting (add_node before add_edge, removes last)
 * - Null op.data guard — skipped without crash
 * - Layout triggered after add_node ops
 * - Layout NOT triggered for update-only patches
 * - Goal node auto-selected when exactly one exists
 * - Mixed operations (add + update + remove in single patch)
 * - Edge weight/direction normalisation matches applyDraftResult pattern
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sortPatchOperations, applyAutoApplyPatch } from '../utils/applyPatch'
import type { PatchOperation, GraphPatchBlock } from '../types'

// ---------------------------------------------------------------------------
// Mock canvas store
// ---------------------------------------------------------------------------

let storeState: {
  nodes: any[]
  edges: any[]
  currentScenarioId: string | null
  outcomeNodeId: string | null
  ceeAnalysisReady: any | null
  ceeAnalysisReadyNodeIds: string[] | null
}

const mocks = {
  applyLayout: vi.fn(() => Promise.resolve()),
  setPendingLayout: vi.fn(),
  setOutcomeNode: vi.fn(),
  pushHistory: vi.fn(),
  markAnalysisFreshnessDirty: vi.fn(),
}

vi.mock('../../store', () => ({
  useCanvasStore: {
    getState: () => ({
      ...storeState,
      applyLayout: mocks.applyLayout,
      setPendingLayout: mocks.setPendingLayout,
      setOutcomeNode: mocks.setOutcomeNode,
      pushHistory: mocks.pushHistory,
      markAnalysisFreshnessDirty: mocks.markAnalysisFreshnessDirty,
    }),
    setState: (update: any) => {
      if (update.nodes !== undefined) storeState.nodes = update.nodes
      if (update.edges !== undefined) storeState.edges = update.edges
      if (update.outcomeNodeId !== undefined) storeState.outcomeNodeId = update.outcomeNodeId
      if (update.ceeAnalysisReady !== undefined) storeState.ceeAnalysisReady = update.ceeAnalysisReady
      if (update.ceeAnalysisReadyNodeIds !== undefined) storeState.ceeAnalysisReadyNodeIds = update.ceeAnalysisReadyNodeIds
    },
  },
}))

vi.mock('../../store/scenarios', () => ({
  saveAutosave: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePatchBlock(operations: PatchOperation[], overrides?: Partial<GraphPatchBlock>): GraphPatchBlock {
  return {
    type: 'graph_patch',
    patch_id: 'test-patch',
    summary: 'Test patch',
    operations,
    target_graph_hash: 'hash-0',
    auto_apply: true,
    ...overrides,
  }
}

function op(type: PatchOperation['op'], target_id: string, data?: Record<string, unknown>): PatchOperation {
  return { op: type, target_id, data: data ?? {} }
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

beforeEach(() => {
  storeState = {
    nodes: [],
    edges: [],
    currentScenarioId: null,
    outcomeNodeId: null,
    ceeAnalysisReady: null,
    ceeAnalysisReadyNodeIds: null,
  }
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// sortPatchOperations
// ---------------------------------------------------------------------------

describe('sortPatchOperations', () => {
  it('orders add_node → add_edge → update_node → update_edge → remove_edge → remove_node', () => {
    const ops: PatchOperation[] = [
      op('remove_node', 'n1'),
      op('update_edge', 'e1'),
      op('add_edge', 'e2'),
      op('remove_edge', 'e3'),
      op('add_node', 'n2'),
      op('update_node', 'n3'),
    ]
    const sorted = sortPatchOperations(ops)
    expect(sorted.map((o) => o.op)).toEqual([
      'add_node',
      'add_edge',
      'update_node',
      'update_edge',
      'remove_edge',
      'remove_node',
    ])
  })

  it('preserves relative order within same op type', () => {
    const ops: PatchOperation[] = [
      op('add_node', 'n1'),
      op('add_node', 'n2'),
      op('add_node', 'n3'),
    ]
    const sorted = sortPatchOperations(ops)
    expect(sorted.map((o) => o.target_id)).toEqual(['n1', 'n2', 'n3'])
  })
})

// ---------------------------------------------------------------------------
// applyAutoApplyPatch — node insertion
// ---------------------------------------------------------------------------

describe('applyAutoApplyPatch — freshness dirty overlay (#3 auto-apply path)', () => {
  it('marks the freshness overlay dirty after an op-replay graph mutation', () => {
    const patch = makePatchBlock([
      op('add_node', 'factor-1', { kind: 'factor', label: 'Market size' }),
    ])
    applyAutoApplyPatch(patch)
    // Auto-apply / op-replay bypasses the edit chokepoints (bare setState), so the
    // overlay must be marked dirty here; applyAnalysisReadyPatch (run after accept)
    // clears it iff the patch supplies a fresh new verdict.
    expect(mocks.markAnalysisFreshnessDirty).toHaveBeenCalled()
  })

  it('does NOT dirty when the op batch is a no-op (all ops skipped → nothing mutated)', () => {
    // A fully-rejected / no-op batch must not create a spurious persistent 'unknown'.
    const patch = makePatchBlock([
      { op: 'add_node', target_id: '', data: { kind: 'factor', label: 'No ID' } }, // skipped (empty id)
    ])
    const result = applyAutoApplyPatch(patch)
    expect(result.addedNodeCount).toBe(0)
    expect(result.modifiedIds).toHaveLength(0)
    expect(mocks.markAnalysisFreshnessDirty).not.toHaveBeenCalled()
  })

  it('marks dirty on a modify-only batch that changes an ANALYTICAL field (no adds) — pins the OR-guard disjunct', () => {
    storeState.nodes = [
      { id: 'fac-1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price', kind: 'factor', observedState: { value: 100 } } },
    ]
    const patch = makePatchBlock([
      // observed_state is analysis-affecting (the V2 adapter forwards it to PLoT).
      op('update_node', 'fac-1', { observed_state: { value: 200 } }),
    ])
    const result = applyAutoApplyPatch(patch)
    expect(result.addedNodeCount).toBe(0)
    expect(result.modifiedIds.length).toBeGreaterThan(0)
    expect(mocks.markAnalysisFreshnessDirty).toHaveBeenCalled()
  })

  // P1: cosmetic-only edits are NOT analysis-affecting — a label/body rename must
  // not fabricate a persistent 'unknown'. The shared analyticalChange taxonomy
  // excludes label, so the patch path matches the store edit chokepoints exactly.
  it('does NOT dirty a label-only (cosmetic) update_node despite modifiedIds > 0', () => {
    storeState.nodes = [
      { id: 'fac-1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price', kind: 'factor' } },
    ]
    const patch = makePatchBlock([op('update_node', 'fac-1', { label: 'Unit price' })])
    const result = applyAutoApplyPatch(patch)
    expect(result.modifiedIds.length).toBeGreaterThan(0) // id was pushed...
    expect(mocks.markAnalysisFreshnessDirty).not.toHaveBeenCalled() // ...but only cosmetic
  })

  // P1: a re-normalised structured field that is a NEW object reference with
  // IDENTICAL content (e.g. CEE re-emitting the same observed_state, keys reordered)
  // is a shallow-reference difference, not a value change — semantic comparison must
  // treat it as a no-op so it does not over-dirty.
  it('does NOT dirty a same-content observed_state re-send (shallow-reference, not a value change)', () => {
    storeState.nodes = [
      { id: 'fac-1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price', kind: 'factor', observedState: { value: 100, unit: 'USD' } } },
    ]
    // New object literal, identical content, keys in a different order.
    const patch = makePatchBlock([op('update_node', 'fac-1', { observed_state: { unit: 'USD', value: 100 } })])
    const result = applyAutoApplyPatch(patch)
    expect(result.modifiedIds.length).toBeGreaterThan(0)
    expect(mocks.markAnalysisFreshnessDirty).not.toHaveBeenCalled()
  })

  // P1: dirty must reflect an ACTUAL graph delta, not the inflated modifiedIds
  // (every update/remove op pushes an id before confirming a real change).
  it('does NOT dirty a same-value update_node (no real delta despite modifiedIds > 0)', () => {
    storeState.nodes = [
      { id: 'fac-1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price', kind: 'factor' } },
    ]
    const patch = makePatchBlock([op('update_node', 'fac-1', { label: 'Price' })]) // same value
    const result = applyAutoApplyPatch(patch)
    expect(result.modifiedIds.length).toBeGreaterThan(0) // id was pushed...
    expect(mocks.markAnalysisFreshnessDirty).not.toHaveBeenCalled() // ...but nothing changed
  })

  it('does NOT dirty an update_node for an absent target', () => {
    storeState.nodes = []
    const patch = makePatchBlock([op('update_node', 'ghost', { label: 'X' })])
    const result = applyAutoApplyPatch(patch)
    expect(result.modifiedIds.length).toBeGreaterThan(0)
    expect(mocks.markAnalysisFreshnessDirty).not.toHaveBeenCalled()
  })

  it('does NOT dirty a remove_node for an absent target', () => {
    storeState.nodes = []
    const patch = makePatchBlock([{ op: 'remove_node', target_id: 'ghost', data: {} }])
    const result = applyAutoApplyPatch(patch)
    expect(result.modifiedIds.length).toBeGreaterThan(0)
    expect(mocks.markAnalysisFreshnessDirty).not.toHaveBeenCalled()
  })
})

describe('applyAutoApplyPatch — node insertion', () => {
  it('inserts nodes with correct IDs and types from kind field', () => {
    const patch = makePatchBlock([
      op('add_node', 'goal-1', { kind: 'goal', label: 'Maximise revenue' }),
      op('add_node', 'factor-1', { kind: 'factor', label: 'Market size' }),
      op('add_node', 'decision-1', { kind: 'decision', label: 'Enter market?' }),
    ])

    const result = applyAutoApplyPatch(patch)

    expect(result.addedNodeCount).toBe(3)
    expect(storeState.nodes).toHaveLength(3)
    expect(storeState.nodes[0]).toMatchObject({
      id: 'goal-1',
      type: 'goal',
      data: { label: 'Maximise revenue', kind: 'goal' },
    })
    expect(storeState.nodes[1]).toMatchObject({
      id: 'factor-1',
      type: 'factor',
      data: { label: 'Market size', kind: 'factor' },
    })
    expect(storeState.nodes[2]).toMatchObject({
      id: 'decision-1',
      type: 'decision',
      data: { label: 'Enter market?', kind: 'decision' },
    })
  })

  it('falls back to type field when kind is absent', () => {
    const patch = makePatchBlock([
      op('add_node', 'n1', { type: 'factor', label: 'Price' }),
    ])

    applyAutoApplyPatch(patch)

    expect(storeState.nodes[0]).toMatchObject({
      id: 'n1',
      type: 'factor',
      data: { kind: 'factor' },
    })
  })

  it('defaults to decision type when neither kind nor type present', () => {
    const patch = makePatchBlock([
      op('add_node', 'n1', { label: 'Unknown' }),
    ])

    applyAutoApplyPatch(patch)

    expect(storeState.nodes[0].type).toBe('decision')
  })

  it('maps observed_state to camelCase observedState', () => {
    const patch = makePatchBlock([
      op('add_node', 'n1', {
        kind: 'factor',
        label: 'Price',
        observed_state: { value: 100, unit: 'USD' },
      }),
    ])

    applyAutoApplyPatch(patch)

    expect(storeState.nodes[0].data.observedState).toEqual({ value: 100, unit: 'USD' })
    expect(storeState.nodes[0].data.observed_state).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// applyAutoApplyPatch — edge insertion
// ---------------------------------------------------------------------------

describe('applyAutoApplyPatch — edge insertion', () => {
  it('creates edges with from/to field names normalised to source/target', () => {
    const patch = makePatchBlock([
      op('add_node', 'n1', { kind: 'factor', label: 'A' }),
      op('add_node', 'n2', { kind: 'goal', label: 'B' }),
      op('add_edge', 'e1', { from: 'n1', to: 'n2', weight: 0.8 }),
    ])

    const result = applyAutoApplyPatch(patch)

    expect(result.addedEdgeCount).toBe(1)
    expect(storeState.edges[0]).toMatchObject({
      id: 'e1',
      source: 'n1',
      target: 'n2',
      type: 'styled',
    })
    expect(storeState.edges[0].data.weight).toBe(0.8)
  })

  it('also accepts source/target field names directly', () => {
    const patch = makePatchBlock([
      op('add_edge', 'e1', { source: 'n1', target: 'n2' }),
    ])

    applyAutoApplyPatch(patch)

    expect(storeState.edges[0].source).toBe('n1')
    expect(storeState.edges[0].target).toBe('n2')
  })

  it('normalises edge weight and direction', () => {
    const patch = makePatchBlock([
      op('add_edge', 'e1', { from: 'a', to: 'b', weight: -0.6, effect_direction: 'negative' }),
    ])

    applyAutoApplyPatch(patch)

    expect(storeState.edges[0].data.weight).toBe(0.6)
    expect(storeState.edges[0].data.direction).toBe('negative')
  })

  it('clamps weight to [0, 2]', () => {
    const patch = makePatchBlock([
      op('add_edge', 'e1', { from: 'a', to: 'b', weight: 5.0 }),
    ])

    applyAutoApplyPatch(patch)

    expect(storeState.edges[0].data.weight).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// Out-of-order operations (edge before node)
// ---------------------------------------------------------------------------

describe('applyAutoApplyPatch — operation ordering', () => {
  it('applies edges after nodes even when sent edge-first', () => {
    const patch = makePatchBlock([
      op('add_edge', 'e1', { from: 'n1', to: 'n2' }),
      op('add_node', 'n1', { kind: 'factor', label: 'A' }),
      op('add_node', 'n2', { kind: 'goal', label: 'B' }),
    ])

    const result = applyAutoApplyPatch(patch)

    expect(result.addedNodeCount).toBe(2)
    expect(result.addedEdgeCount).toBe(1)
    expect(storeState.nodes).toHaveLength(2)
    expect(storeState.edges).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Null/missing data guards
// ---------------------------------------------------------------------------

describe('applyAutoApplyPatch — guards', () => {
  it('skips add_node with null data without crashing', () => {
    const patch = makePatchBlock([
      op('add_node', 'n1', { kind: 'factor', label: 'Valid' }),
      { op: 'add_node', target_id: 'n2', data: null as any },
    ])

    const result = applyAutoApplyPatch(patch)

    expect(result.addedNodeCount).toBe(1)
    expect(storeState.nodes).toHaveLength(1)
    expect(storeState.nodes[0].id).toBe('n1')
  })

  it('skips ops with missing target_id', () => {
    const patch = makePatchBlock([
      { op: 'add_node', target_id: '', data: { kind: 'factor', label: 'No ID' } },
      op('add_node', 'n1', { kind: 'factor', label: 'Valid' }),
    ])

    const result = applyAutoApplyPatch(patch)

    // Empty string target_id is falsy, should be skipped
    expect(result.addedNodeCount).toBe(1)
  })

  it('allows remove_* ops without data', () => {
    storeState.nodes = [{ id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'X' } }]

    const patch = makePatchBlock([
      { op: 'remove_node', target_id: 'n1', data: {} },
    ])

    applyAutoApplyPatch(patch)

    expect(storeState.nodes).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Layout trigger
// ---------------------------------------------------------------------------

describe('applyAutoApplyPatch — layout', () => {
  it('flips setPendingLayout(true) after add_node operations', () => {
    // D2 of layout-stabilisation brief: auto-trigger paths defer layout
    // via the measurement-aware lifecycle. ReactFlowGraph runs applyLayout
    // once measurement completes; this layer only signals intent.
    const patch = makePatchBlock([
      op('add_node', 'n1', { kind: 'factor', label: 'A' }),
    ])

    applyAutoApplyPatch(patch)

    expect(mocks.setPendingLayout).toHaveBeenCalledWith(true)
    expect(mocks.applyLayout).not.toHaveBeenCalled()
  })

  it('does NOT signal pending layout for update-only patches', () => {
    storeState.nodes = [{ id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'X' } }]

    const patch = makePatchBlock([
      op('update_node', 'n1', { label: 'Updated' }),
    ])

    applyAutoApplyPatch(patch)

    expect(mocks.setPendingLayout).not.toHaveBeenCalled()
    expect(mocks.applyLayout).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Goal auto-select
// ---------------------------------------------------------------------------

describe('applyAutoApplyPatch — goal auto-select', () => {
  it('auto-selects goal node when exactly one exists', () => {
    const patch = makePatchBlock([
      op('add_node', 'g1', { kind: 'goal', label: 'Revenue' }),
      op('add_node', 'f1', { kind: 'factor', label: 'Price' }),
    ])

    applyAutoApplyPatch(patch)

    expect(mocks.setOutcomeNode).toHaveBeenCalledWith('g1')
  })

  it('does NOT auto-select when multiple goal nodes exist', () => {
    const patch = makePatchBlock([
      op('add_node', 'g1', { kind: 'goal', label: 'Revenue' }),
      op('add_node', 'g2', { kind: 'goal', label: 'Profit' }),
    ])

    applyAutoApplyPatch(patch)

    expect(mocks.setOutcomeNode).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Mixed operations (add + update + remove)
// ---------------------------------------------------------------------------

describe('applyAutoApplyPatch — mixed operations', () => {
  it('handles add + update + remove in a single patch', () => {
    // Pre-existing node
    storeState.nodes = [
      { id: 'existing-1', type: 'factor', position: { x: 10, y: 10 }, data: { label: 'Old' } },
    ]
    storeState.edges = [
      { id: 'old-edge', source: 'existing-1', target: 'x', type: 'styled', data: {} },
    ]

    const patch = makePatchBlock([
      op('add_node', 'new-1', { kind: 'goal', label: 'Revenue' }),
      op('update_node', 'existing-1', { label: 'Updated factor' }),
      op('remove_edge', 'old-edge'),
      op('add_edge', 'new-edge', { from: 'existing-1', to: 'new-1' }),
    ])

    const result = applyAutoApplyPatch(patch)

    // Should have 2 nodes (existing updated + new)
    expect(storeState.nodes).toHaveLength(2)
    expect(storeState.nodes.find((n: any) => n.id === 'existing-1')?.data.label).toBe('Updated factor')
    expect(storeState.nodes.find((n: any) => n.id === 'new-1')?.data.label).toBe('Revenue')

    // Old edge removed, new edge added
    expect(storeState.edges).toHaveLength(1)
    expect(storeState.edges[0].id).toBe('new-edge')
    expect(storeState.edges[0].source).toBe('existing-1')
    expect(storeState.edges[0].target).toBe('new-1')

    expect(result.addedNodeCount).toBe(1)
    expect(result.addedEdgeCount).toBe(1)
    expect(result.modifiedIds).toHaveLength(4)
  })
})

// ---------------------------------------------------------------------------
// Invalidation parity — outcomeNodeId cleanup
// ---------------------------------------------------------------------------

describe('applyAutoApplyPatch — outcomeNodeId cleanup', () => {
  it('clears outcomeNodeId when outcome node is removed', () => {
    storeState.nodes = [
      { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } },
      { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor' } },
    ]
    storeState.outcomeNodeId = 'g1'

    const patch = makePatchBlock([op('remove_node', 'g1')])
    applyAutoApplyPatch(patch)

    expect(storeState.outcomeNodeId).toBeNull()
    expect(storeState.nodes).toHaveLength(1)
    expect(storeState.nodes[0].id).toBe('f1')
  })

  it('does NOT clear outcomeNodeId when a different node is removed', () => {
    storeState.nodes = [
      { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } },
      { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor' } },
    ]
    storeState.outcomeNodeId = 'g1'

    const patch = makePatchBlock([op('remove_node', 'f1')])
    applyAutoApplyPatch(patch)

    expect(storeState.outcomeNodeId).toBe('g1')
  })
})

// ---------------------------------------------------------------------------
// Invalidation parity — ceeAnalysisReady
// ---------------------------------------------------------------------------

describe('applyAutoApplyPatch — ceeAnalysisReady invalidation', () => {
  const makeAnalysisReady = (goalId: string, optionIds: string[] = [], interventionTargets: string[] = []) => ({
    goal_node_id: goalId,
    options: optionIds.map(id => ({
      id,
      interventions: Object.fromEntries(interventionTargets.map(t => [t, {}])),
    })),
  })

  it('invalidates when a critical node (goal) is removed', () => {
    storeState.nodes = [
      { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: {} },
      { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: {} },
    ]
    storeState.ceeAnalysisReady = makeAnalysisReady('g1')
    storeState.ceeAnalysisReadyNodeIds = ['g1', 'f1']

    const patch = makePatchBlock([op('remove_node', 'g1')])
    applyAutoApplyPatch(patch)

    expect(storeState.ceeAnalysisReady).toBeNull()
    expect(storeState.ceeAnalysisReadyNodeIds).toBeNull()
  })

  it('invalidates when an intervention target node is removed', () => {
    storeState.nodes = [
      { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: {} },
      { id: 'opt1', type: 'decision', position: { x: 0, y: 0 }, data: {} },
      { id: 'target1', type: 'factor', position: { x: 0, y: 0 }, data: {} },
    ]
    storeState.ceeAnalysisReady = makeAnalysisReady('g1', ['opt1'], ['target1'])
    storeState.ceeAnalysisReadyNodeIds = ['g1', 'opt1', 'target1']

    const patch = makePatchBlock([op('remove_node', 'target1')])
    applyAutoApplyPatch(patch)

    expect(storeState.ceeAnalysisReady).toBeNull()
  })

  it('invalidates when an edge connecting critical nodes is removed', () => {
    storeState.nodes = [
      { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: {} },
      { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: {} },
    ]
    storeState.edges = [
      { id: 'e1', source: 'f1', target: 'g1', type: 'styled', data: {} },
    ]
    storeState.ceeAnalysisReady = makeAnalysisReady('g1')

    const patch = makePatchBlock([op('remove_edge', 'e1')])
    applyAutoApplyPatch(patch)

    expect(storeState.ceeAnalysisReady).toBeNull()
  })

  it('does NOT invalidate when a non-critical node is removed', () => {
    storeState.nodes = [
      { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: {} },
      { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: {} },
    ]
    storeState.ceeAnalysisReady = makeAnalysisReady('g1')
    storeState.ceeAnalysisReadyNodeIds = ['g1', 'f1']

    const patch = makePatchBlock([op('remove_node', 'f1')])
    applyAutoApplyPatch(patch)

    // f1 is not critical (not goal, option, or intervention target)
    expect(storeState.ceeAnalysisReady).not.toBeNull()
  })

  it('does NOT invalidate when an edge between non-critical nodes is removed', () => {
    storeState.nodes = [
      { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: {} },
      { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: {} },
      { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: {} },
    ]
    storeState.edges = [
      { id: 'e1', source: 'f1', target: 'f2', type: 'styled', data: {} },
    ]
    storeState.ceeAnalysisReady = makeAnalysisReady('g1')

    const patch = makePatchBlock([op('remove_edge', 'e1')])
    applyAutoApplyPatch(patch)

    expect(storeState.ceeAnalysisReady).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// update_edge — endpoint rewiring
// ---------------------------------------------------------------------------

describe('applyAutoApplyPatch — update_edge endpoint rewiring', () => {
  it('rewires edge source/target from CEE from/to fields', () => {
    storeState.edges = [
      { id: 'e1', source: 'old-src', target: 'old-tgt', type: 'styled', data: { weight: 0.5 } },
    ]

    const patch = makePatchBlock([
      op('update_edge', 'e1', { from: 'new-src', to: 'new-tgt', weight: 0.9 }),
    ])
    applyAutoApplyPatch(patch)

    expect(storeState.edges[0].source).toBe('new-src')
    expect(storeState.edges[0].target).toBe('new-tgt')
    expect(storeState.edges[0].data.weight).toBe(0.9)
    // Endpoint fields should NOT leak into edge.data
    expect(storeState.edges[0].data.from).toBeUndefined()
    expect(storeState.edges[0].data.to).toBeUndefined()
    expect(storeState.edges[0].data.source).toBeUndefined()
    expect(storeState.edges[0].data.target).toBeUndefined()
  })

  it('rewires edge using source/target field names', () => {
    storeState.edges = [
      { id: 'e1', source: 'old-src', target: 'old-tgt', type: 'styled', data: {} },
    ]

    const patch = makePatchBlock([
      op('update_edge', 'e1', { source: 'new-src', target: 'new-tgt' }),
    ])
    applyAutoApplyPatch(patch)

    expect(storeState.edges[0].source).toBe('new-src')
    expect(storeState.edges[0].target).toBe('new-tgt')
  })

  it('does NOT rewire when no endpoint fields are present', () => {
    storeState.edges = [
      { id: 'e1', source: 'src', target: 'tgt', type: 'styled', data: { weight: 0.5 } },
    ]

    const patch = makePatchBlock([
      op('update_edge', 'e1', { weight: 0.8 }),
    ])
    applyAutoApplyPatch(patch)

    expect(storeState.edges[0].source).toBe('src')
    expect(storeState.edges[0].target).toBe('tgt')
    expect(storeState.edges[0].data.weight).toBe(0.8)
  })
})

// ---------------------------------------------------------------------------
// add_edge — empty source/target guard
// ---------------------------------------------------------------------------

describe('applyAutoApplyPatch — add_edge empty endpoint guard', () => {
  it('skips add_edge when source is empty', () => {
    const patch = makePatchBlock([
      op('add_edge', 'e1', { from: '', to: 'n2' }),
    ])
    const result = applyAutoApplyPatch(patch)

    expect(result.addedEdgeCount).toBe(0)
    expect(storeState.edges).toHaveLength(0)
  })

  it('skips add_edge when target is empty', () => {
    const patch = makePatchBlock([
      op('add_edge', 'e1', { from: 'n1', to: '' }),
    ])
    const result = applyAutoApplyPatch(patch)

    expect(result.addedEdgeCount).toBe(0)
  })

  it('skips add_edge when both endpoints are missing', () => {
    const patch = makePatchBlock([
      op('add_edge', 'e1', { weight: 0.5 }),
    ])
    const result = applyAutoApplyPatch(patch)

    expect(result.addedEdgeCount).toBe(0)
  })
})
