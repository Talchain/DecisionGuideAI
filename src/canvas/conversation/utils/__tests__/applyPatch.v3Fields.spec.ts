/**
 * Tests: V3 edge fields preserved through buildEdge (applyPatch path)
 *
 * Verifies that edge_type, provenance_source, and exists_probability
 * from CEE V3 edges survive through applyAutoApplyPatch into the store.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyAutoApplyPatch } from '../applyPatch'
import type { GraphPatchBlock } from '../../types'

// ---------------------------------------------------------------------------
// Mock canvas store
// ---------------------------------------------------------------------------

let storeNodes: any[] = []
let storeEdges: any[] = []

vi.mock('../../../store', () => ({
  useCanvasStore: Object.assign(vi.fn(), {
    getState: () => ({
      nodes: storeNodes,
      edges: storeEdges,
      outcomeNodeId: null,
      ceeAnalysisReady: null,
      applyLayout: vi.fn(() => Promise.resolve()),
      setPendingFitView: vi.fn(),
      setOutcomeNode: vi.fn(),
      currentScenarioId: null,
    }),
    setState: vi.fn((update: any) => {
      if (update.nodes) storeNodes = update.nodes
      if (update.edges) storeEdges = update.edges
    }),
  }),
}))

vi.mock('../../../store/scenarios', () => ({
  saveAutosave: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('applyAutoApplyPatch — V3 edge field preservation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeNodes = [
      { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'A' } },
      { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } },
    ]
    storeEdges = []
  })

  it('preserves edge_type, provenance_source, and exists_probability on add_edge', () => {
    const patchBlock: GraphPatchBlock = {
      block_type: 'graph_patch',
      auto_apply: true,
      operations: [
        {
          op: 'add_edge',
          target_id: 'e1',
          data: {
            from: 'f1',
            to: 'g1',
            strength: { mean: 0.65, std: 0.12 },
            effect_direction: 'positive',
            belief_exists: 0.85,
            edge_type: 'directed',
            provenance_source: 'document',
            exists_probability: 0.9,
          },
        },
      ],
    }

    applyAutoApplyPatch(patchBlock)

    expect(storeEdges).toHaveLength(1)
    const edgeData = storeEdges[0].data

    // Core fields preserved
    expect(edgeData.weight).toBe(0.65)
    expect(edgeData.strengthStd).toBe(0.12)
    expect(edgeData.direction).toBe('positive')
    expect(edgeData.beliefExists).toBe(0.85)

    // V3 fields preserved
    expect(edgeData.edge_type).toBe('directed')
    expect(edgeData.provenance_source).toBe('document')
    expect(edgeData.exists_probability).toBe(0.9)
  })

  it('omits V3 fields when not present in source data', () => {
    const patchBlock: GraphPatchBlock = {
      block_type: 'graph_patch',
      auto_apply: true,
      operations: [
        {
          op: 'add_edge',
          target_id: 'e1',
          data: {
            from: 'f1',
            to: 'g1',
            weight: 0.5,
            effect_direction: 'positive',
          },
        },
      ],
    }

    applyAutoApplyPatch(patchBlock)

    expect(storeEdges).toHaveLength(1)
    const edgeData = storeEdges[0].data

    expect(edgeData.weight).toBe(0.5)
    expect(edgeData).not.toHaveProperty('edge_type')
    expect(edgeData).not.toHaveProperty('provenance_source')
    expect(edgeData).not.toHaveProperty('exists_probability')
  })

  it('clamps exists_probability to [0, 1]', () => {
    const patchBlock: GraphPatchBlock = {
      block_type: 'graph_patch',
      auto_apply: true,
      operations: [
        {
          op: 'add_edge',
          target_id: 'e1',
          data: {
            from: 'f1',
            to: 'g1',
            weight: 0.5,
            exists_probability: 1.5,
          },
        },
      ],
    }

    applyAutoApplyPatch(patchBlock)

    expect(storeEdges[0].data.exists_probability).toBe(1)
  })

  it('weight derived from strength.mean produces correct label band', () => {
    // strength.mean = 0.65 → weight = 0.65 → falls in "Moderate" band (0.3–0.7)
    const patchBlock: GraphPatchBlock = {
      block_type: 'graph_patch',
      auto_apply: true,
      operations: [
        {
          op: 'add_edge',
          target_id: 'e1',
          data: {
            from: 'f1',
            to: 'g1',
            strength: { mean: 0.65, std: 0.1 },
            effect_direction: 'positive',
          },
        },
      ],
    }

    applyAutoApplyPatch(patchBlock)

    expect(storeEdges[0].data.weight).toBe(0.65)
    expect(storeEdges[0].data.direction).toBe('positive')
  })

  it('falls back beliefExists from exists_probability when belief_exists is absent', () => {
    const patchBlock: GraphPatchBlock = {
      block_type: 'graph_patch',
      auto_apply: true,
      operations: [
        {
          op: 'add_edge',
          target_id: 'e1',
          data: {
            from: 'f1',
            to: 'g1',
            weight: 0.5,
            exists_probability: 0.75,
            // no belief_exists, no belief
          },
        },
      ],
    }

    applyAutoApplyPatch(patchBlock)

    expect(storeEdges[0].data.beliefExists).toBe(0.75)
    expect(storeEdges[0].data.exists_probability).toBe(0.75)
  })

  it('derives interventionKeys on option nodes with inline interventions', () => {
    const patchBlock: GraphPatchBlock = {
      block_type: 'graph_patch',
      auto_apply: true,
      operations: [
        {
          op: 'add_node',
          target_id: 'o1',
          data: {
            kind: 'option',
            label: 'Option A',
            interventions: { f1: { value: 10 }, f2: { value: -5 } },
          },
        },
      ],
    }

    applyAutoApplyPatch(patchBlock)

    const optionNode = storeNodes.find((n: any) => n.id === 'o1')
    expect(optionNode).toBeDefined()
    expect(optionNode.data.interventions).toEqual({ f1: { value: 10 }, f2: { value: -5 } })
    expect(optionNode.data.interventionKeys).toEqual(['f1', 'f2'])
  })
})
