/**
 * Seamlessness R2 — the apply choke points fire the applied-edit pulse.
 *
 * applyAutoApplyPatch / applyValidatedGraph must call pulseAppliedTargets
 * with the patch's target ids so the canvas visibly acknowledges AI edits
 * the moment they land (no "Reveal changes" click needed). The pulse util's
 * own behaviour (coalescing, fail-closed filtering, 2s clear) is covered by
 * appliedEditPulse.spec.ts — here we assert the WIRING only.
 *
 * Full-draft suppression: the initial brief response auto-applies a patch
 * that builds the whole graph. Pulsing every node of a fresh draft is noise,
 * not acknowledgement — suppressed using the SAME >=3-added-nodes threshold
 * the codebase already uses for the full_draft signal (useConversation).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { pulseMock } = vi.hoisted(() => ({ pulseMock: vi.fn() }))
vi.mock('../../../utils/appliedEditPulse', () => ({
  pulseAppliedTargets: pulseMock,
  __resetAppliedEditPulseForTests: vi.fn(),
  PULSE_COALESCE_MS: 100,
  PULSE_DURATION_MS: 2000,
}))

// Store mock (same shape as applyPatch.v3Fields.spec.ts)
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
      setPendingLayout: vi.fn(),
      setOutcomeNode: vi.fn(),
      currentScenarioId: null,
      pushHistory: vi.fn(),
      markAnalysisFreshnessDirty: vi.fn(),
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

import { applyAutoApplyPatch, applyValidatedGraph } from '../applyPatch'
import type { GraphPatchBlock } from '../../types'

const addNodeOp = (id: string) => ({
  op: 'add_node',
  target_id: id,
  data: { label: id, type: 'factor' },
})

const makeBlock = (operations: any[]): GraphPatchBlock =>
  ({
    block_type: 'graph_patch',
    auto_apply: true,
    operations,
  }) as unknown as GraphPatchBlock

beforeEach(() => {
  vi.clearAllMocks()
  storeNodes = [
    { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'A' } },
    { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } },
  ]
  storeEdges = []
})

describe('applyAutoApplyPatch → pulse wiring', () => {
  it('pulses the op targets for a small incremental patch', () => {
    applyAutoApplyPatch(makeBlock([addNodeOp('f2')]))
    expect(pulseMock).toHaveBeenCalledTimes(1)
    const arg = pulseMock.mock.calls[0][0]
    expect(arg.nodeIds).toEqual(['f2'])
  })

  it('pulses update_node targets too', () => {
    applyAutoApplyPatch(
      makeBlock([{ op: 'update_node', target_id: 'f1', data: { label: 'A2' } }]),
    )
    expect(pulseMock).toHaveBeenCalledTimes(1)
    expect(pulseMock.mock.calls[0][0].nodeIds).toEqual(['f1'])
  })

  it('includes edge targets under edgeIds', () => {
    applyAutoApplyPatch(
      makeBlock([
        {
          op: 'add_edge',
          target_id: 'e-new',
          data: { from: 'f1', to: 'g1', weight: 0.5 },
        },
      ]),
    )
    expect(pulseMock).toHaveBeenCalledTimes(1)
    expect(pulseMock.mock.calls[0][0].edgeIds).toEqual(['e-new'])
  })

  it('SUPPRESSES the pulse for a full draft (>=3 added nodes — the existing full_draft threshold)', () => {
    applyAutoApplyPatch(makeBlock([addNodeOp('d1'), addNodeOp('d2'), addNodeOp('d3')]))
    expect(pulseMock).not.toHaveBeenCalled()
  })

  it('still pulses at 2 added nodes (below the full-draft threshold)', () => {
    applyAutoApplyPatch(makeBlock([addNodeOp('d1'), addNodeOp('d2')]))
    expect(pulseMock).toHaveBeenCalledTimes(1)
  })
})

describe('applyValidatedGraph → pulse wiring', () => {
  const validated = {
    nodes: [{ id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: {} }],
    edges: [],
  }

  it('pulses the supplied applied-op targets', () => {
    applyValidatedGraph(validated, [
      { op: 'update_node', target_id: 'f1', data: { label: 'B' } } as any,
    ])
    expect(pulseMock).toHaveBeenCalledTimes(1)
    expect(pulseMock.mock.calls[0][0].nodeIds).toEqual(['f1'])
  })

  it('does not pulse when no ops are supplied (legacy callers unchanged)', () => {
    applyValidatedGraph(validated)
    expect(pulseMock).not.toHaveBeenCalled()
  })
})
