/**
 * Golden fixture tests — real CEE orchestrator response
 *
 * These tests feed an actual CEE staging response through adaptCEEBlock
 * and applyAutoApplyPatch. If the CEE response shape changes, these tests
 * fail immediately — catching adapter regressions before they reach the browser.
 *
 * Fixture: fixtures/cee-orchestrator-response.json
 * Captured from: POST /orchestrate/v1/turn on cee-staging.onrender.com
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { adaptCEEBlock } from '../useConversation'
import { applyAutoApplyPatch } from '../utils/applyPatch'
import { useCanvasStore } from '../../store'
import type { GraphPatchBlock } from '../types'

const rawFixture = JSON.parse(
  readFileSync(resolve(__dirname, 'fixtures/cee-orchestrator-response.json'), 'utf-8'),
)

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    currentScenarioId: 'fixture-test',
    results: { status: 'idle' } as any,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    ceeAnalysisReady: null,
    ceeAnalysisReadyNodeIds: null,
    outcomeNodeId: null,
  })
})

// ---------------------------------------------------------------------------
// § 1 — adaptCEEBlock correctly parses real CEE graph_patch
// ---------------------------------------------------------------------------

describe('golden fixture — adaptCEEBlock', () => {
  const rawBlock = rawFixture.blocks[0]

  it('resolves block type to graph_patch', () => {
    const adapted = adaptCEEBlock(rawBlock)
    expect(adapted.type).toBe('graph_patch')
  })

  it('extracts non-empty operations array', () => {
    const adapted = adaptCEEBlock(rawBlock) as GraphPatchBlock
    expect(adapted.operations.length).toBeGreaterThan(0)
    expect(adapted.operations.length).toBe(22)
  })

  it('normalises operations from path/value to target_id/data', () => {
    const adapted = adaptCEEBlock(rawBlock) as GraphPatchBlock
    const firstOp = adapted.operations[0]
    // Must have target_id and data (not path and value)
    expect(firstOp.target_id).toBe('dec_pricing')
    expect(firstOp.data).toBeDefined()
    expect(firstOp.data.kind).toBe('decision')
    expect(firstOp.data.label).toBe('Pricing Strategy Decision')
    // Must NOT have path/value
    expect((firstOp as any).path).toBeUndefined()
    expect((firstOp as any).value).toBeUndefined()
  })

  it('node operations have id, kind, label in data', () => {
    const adapted = adaptCEEBlock(rawBlock) as GraphPatchBlock
    const nodeOps = adapted.operations.filter((op) => op.op === 'add_node')
    expect(nodeOps.length).toBe(10)
    for (const op of nodeOps) {
      expect(op.target_id).toBeTruthy()
      expect(op.data).toBeDefined()
      expect(typeof op.data.id).toBe('string')
      expect(typeof op.data.kind).toBe('string')
      expect(typeof op.data.label).toBe('string')
    }
  })

  it('edge operations have from, to in data', () => {
    const adapted = adaptCEEBlock(rawBlock) as GraphPatchBlock
    const edgeOps = adapted.operations.filter((op) => op.op === 'add_edge')
    expect(edgeOps.length).toBe(12)
    for (const op of edgeOps) {
      expect(op.target_id).toBeTruthy()
      expect(op.data).toBeDefined()
      expect(typeof op.data.from).toBe('string')
      expect(typeof op.data.to).toBe('string')
    }
  })

  it('sets auto_apply to true', () => {
    const adapted = adaptCEEBlock(rawBlock) as GraphPatchBlock
    expect(adapted.auto_apply).toBe(true)
  })

  it('carries block_id through', () => {
    const adapted = adaptCEEBlock(rawBlock) as GraphPatchBlock
    expect(adapted.block_id).toBe(rawBlock.block_id)
  })
})

// ---------------------------------------------------------------------------
// § 2 — applyAutoApplyPatch processes real adapted block
// ---------------------------------------------------------------------------

describe('golden fixture — applyAutoApplyPatch', () => {
  it('creates nodes and edges in the canvas store', () => {
    const adapted = adaptCEEBlock(rawFixture.blocks[0]) as GraphPatchBlock
    const result = applyAutoApplyPatch(adapted)

    expect(result.addedNodeCount).toBe(10)
    expect(result.addedEdgeCount).toBe(12)
    expect(result.modifiedIds.length).toBe(22)

    const store = useCanvasStore.getState()
    expect(store.nodes).toHaveLength(10)
    expect(store.edges).toHaveLength(12)
  })

  it('nodes have correct structure for React Flow', () => {
    const adapted = adaptCEEBlock(rawFixture.blocks[0]) as GraphPatchBlock
    applyAutoApplyPatch(adapted)

    const store = useCanvasStore.getState()
    const decisionNode = store.nodes.find((n) => n.id === 'dec_pricing')
    expect(decisionNode).toBeDefined()
    expect(decisionNode!.type).toBe('decision')
    expect((decisionNode!.data as any).label).toBe('Pricing Strategy Decision')
    expect((decisionNode!.data as any).kind).toBe('decision')
    // Must have position for React Flow
    expect(decisionNode!.position).toBeDefined()
    expect(typeof decisionNode!.position.x).toBe('number')
  })

  it('edges have correct source/target from CEE from/to', () => {
    const adapted = adaptCEEBlock(rawFixture.blocks[0]) as GraphPatchBlock
    applyAutoApplyPatch(adapted)

    const store = useCanvasStore.getState()
    // dec_pricing -> opt_keep_price edge
    const edge = store.edges.find(
      (e) => e.source === 'dec_pricing' && e.target === 'opt_keep_price',
    )
    expect(edge).toBeDefined()
    expect(edge!.type).toBe('styled')
    expect((edge!.data as any).direction).toBeDefined()
  })

  it('goal node is auto-selected as outcome node', () => {
    const adapted = adaptCEEBlock(rawFixture.blocks[0]) as GraphPatchBlock
    applyAutoApplyPatch(adapted)

    const store = useCanvasStore.getState()
    // Fixture has exactly one goal node: goal_maximise_revenue
    const goalNode = store.nodes.find((n) => n.type === 'goal')
    expect(goalNode).toBeDefined()
    expect(store.outcomeNodeId).toBe(goalNode!.id)
  })

  it('negative edges have correct direction', () => {
    const adapted = adaptCEEBlock(rawFixture.blocks[0]) as GraphPatchBlock
    applyAutoApplyPatch(adapted)

    const store = useCanvasStore.getState()
    // risk_churn -> goal_maximise_revenue is negative
    const negEdge = store.edges.find(
      (e) => e.source === 'risk_churn' && e.target === 'goal_maximise_revenue',
    )
    expect(negEdge).toBeDefined()
    expect((negEdge!.data as any).direction).toBe('negative')
  })
})

// ---------------------------------------------------------------------------
// § 3 — Envelope-level shape validation
// ---------------------------------------------------------------------------

describe('golden fixture — envelope shape', () => {
  it('assistant_text may be null (graph-only response)', () => {
    // This is the actual shape CEE sends — assistant_text is null
    expect(rawFixture.assistant_text).toBeNull()
  })

  it('stage_indicator is an object with stage field, not a plain string', () => {
    const si = rawFixture.stage_indicator as any
    expect(si).toBeDefined()
    expect(typeof si.stage).toBe('string')
    expect(['frame', 'ideate', 'evaluate']).toContain(si.stage)
  })

  it('blocks array uses block_type/data format, not flat type', () => {
    const block = rawFixture.blocks[0] as any
    expect(block.block_type).toBe('graph_patch')
    expect(block.data).toBeDefined()
    expect(typeof block.data).toBe('object')
    // The raw block does NOT have a flat 'type' field
    expect(block.type).toBeUndefined()
  })

  it('operations use path/value format, not target_id/data', () => {
    const ops = (rawFixture.blocks[0] as any).data.operations
    const firstOp = ops[0]
    // Raw CEE ops have path and value
    expect(firstOp.path).toBeDefined()
    expect(firstOp.value).toBeDefined()
    // Raw CEE ops do NOT have target_id or data
    expect(firstOp.target_id).toBeUndefined()
    expect(firstOp.data).toBeUndefined()
  })
})
