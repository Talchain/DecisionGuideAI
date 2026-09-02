import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  deleteAction,
  addConnectedFactorAction,
  markAsAssumption,
  traceToGoal,
  askAI,
  copyAction,
  duplicateAction,
  insertFactorBetweenAction,
} from '../actions'
import type { NodeTarget, EdgeTarget, MultiTarget, PaneTarget } from '../types'
import type { Node, Edge } from '@xyflow/react'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import type { EdgeData } from '../../domain/edges'
import { DEFAULT_EDGE_DATA } from '../../domain/edges'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockStore = {
  nodes: [
    { id: 'f1', type: 'factor', position: { x: 100, y: 100 }, data: { label: 'Revenue', kind: 'factor', observedState: { value: 50 } } },
    { id: 'g1', type: 'goal', position: { x: 300, y: 100 }, data: { label: 'Profit', kind: 'goal' } },
    { id: 'd1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Strategy', kind: 'decision' } },
  ] as Node[],
  edges: [
    { id: 'e1', source: 'f1', target: 'g1', type: 'styled', data: { ...DEFAULT_EDGE_DATA } },
  ] as Edge<EdgeData>[],
  selection: { nodeIds: new Set(['f1']), edgeIds: new Set<string>(), anchorPosition: null },
  clipboard: null,
  highlightedEdges: new Set<string>(),
  deleteEdge: vi.fn(),
  deleteNodeById: vi.fn(),
  deleteSelected: vi.fn(),
  addNode: vi.fn(),
  addNodeWithEdge: vi.fn(() => 'new-1'),
  updateNode: vi.fn(),
  updateEdgeData: vi.fn(),
  selectNodeWithoutHistory: vi.fn(),
  selectNodes: vi.fn(),
  setShowDraftChat: vi.fn(),
  copySelected: vi.fn(),
  duplicateSelected: vi.fn(),
  pasteClipboard: vi.fn(),
  createNodeId: vi.fn(() => 'new-1'),
  createEdgeId: vi.fn(() => 'enew-1'),
  setShowInspectorPanel: vi.fn(),
  pushHistory: vi.fn(),
}

vi.mock('../../store', () => ({
  useCanvasStore: {
    getState: () => mockStore,
    setState: vi.fn(),
  },
}))

vi.mock('../../stores/guidanceStore', () => ({
  useGuidanceStore: {
    getState: () => ({ _sendMessage: vi.fn() }),
  },
}))

vi.mock('../../mutations/commitValidatedMutation', () => ({
  commitValidatedMutation: vi.fn(async (_ops: any, localApply: () => void) => {
    localApply()
    return { success: true }
  }),
}))

vi.mock('../../stores/confirmDialogStore', () => ({
  useConfirmDialogStore: {
    getState: () => ({ show: vi.fn() }),
  },
}))

vi.mock('../../validation/graphGuardrails', () => ({
  assessNodeDeletion: vi.fn(() => ({ disconnectsOptions: [], orphansNodes: [], removesLastGoal: false, removesLastDecision: false })),
  assessEdgeDeletion: vi.fn(() => ({ disconnectsOptions: [], orphansNodes: [], removesLastGoal: false, removesLastDecision: false })),
  isSignificantImpact: vi.fn(() => false),
  buildDeletionMessage: vi.fn(() => ({ title: '', message: '', blocked: false })),
  wouldExceedLimits: vi.fn(() => false),
  wouldCreateCycle: vi.fn(() => false),
  limitExceededMessage: vi.fn(() => ''),
}))

const showToast = vi.fn()

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

describe('deleteAction', () => {
  it('deletes an edge target', async () => {
    const target: EdgeTarget = {
      kind: 'edge',
      edgeId: 'e1',
      edge: mockStore.edges[0],
      isStructural: false,
      screenPos: { x: 0, y: 0 },
    }
    await deleteAction(target, showToast)
    expect(mockStore.deleteEdge).toHaveBeenCalledWith('e1')
  })

  it('deletes a node target', async () => {
    const target: NodeTarget = {
      kind: 'node',
      nodeId: 'f1',
      nodeType: 'factor',
      node: mockStore.nodes[0],
      screenPos: { x: 0, y: 0 },
    }
    await deleteAction(target, showToast)
    expect(mockStore.deleteNodeById).toHaveBeenCalledWith('f1')
  })

  it('deletes multi-selection', async () => {
    const target: MultiTarget = {
      kind: 'multi',
      nodeIds: ['f1', 'g1'],
      edgeIds: ['e1'],
      screenPos: { x: 0, y: 0 },
    }
    await deleteAction(target, showToast)
    expect(mockStore.deleteSelected).toHaveBeenCalled()
  })
})

describe('addConnectedFactorAction', () => {
  it('creates factor connected to a goal (cause direction)', async () => {
    const target: NodeTarget = {
      kind: 'node',
      nodeId: 'g1',
      nodeType: 'goal',
      node: mockStore.nodes[1],
      screenPos: { x: 0, y: 0 },
    }
    await addConnectedFactorAction(target, showToast)
    expect(mockStore.addNodeWithEdge).toHaveBeenCalledWith(
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
      'factor',
      'g1',
      'to-target',
    )
  })

  it('creates factor connected to a decision (effect direction)', async () => {
    const target: NodeTarget = {
      kind: 'node',
      nodeId: 'd1',
      nodeType: 'decision',
      node: mockStore.nodes[2],
      screenPos: { x: 0, y: 0 },
    }
    await addConnectedFactorAction(target, showToast)
    expect(mockStore.addNodeWithEdge).toHaveBeenCalledWith(
      expect.any(Object),
      'factor',
      'd1',
      'from-target',
    )
  })

  it('⭐⭐ the declared `add_node` op seeds NO category — the SECOND writer, not a duplicate', async () => {
    // ⚠ WHY THIS GUARD EXISTS SEPARATELY FROM THE STORE'S. These ops are not
    // decoration: `commitValidatedMutation` sends them to PLoT's
    // `validatePatch` and, when it returns a validated graph, `setState`s THAT
    // graph INSTEAD of calling `localApply()`. So a `category: 'external'` left
    // here would re-seed the node on the validated branch even though
    // `store.addNodeWithEdge` no longer seeds one — the explicit-unknown
    // guarantee would hold on whichever branch happened to run. Two writers,
    // one property; both need pinning.
    //
    // The store-side twin, driven against the REAL action and a REAL
    // `FactorNode` mount, is
    // `mutations/__tests__/structuralAdd.connectedAddExplicitUnknown.spec.tsx`.
    const { commitValidatedMutation } = await import('../../mutations/commitValidatedMutation')
    ;(commitValidatedMutation as any).mockClear()

    const target: NodeTarget = {
      kind: 'node',
      nodeId: 'g1',
      nodeType: 'goal',
      node: mockStore.nodes[1],
      screenPos: { x: 0, y: 0 },
    }
    await addConnectedFactorAction(target, showToast)

    const ops = (commitValidatedMutation as any).mock.calls[0]?.[0] as Array<{
      op: string
      data?: Record<string, unknown>
    }>
    // PRECONDITION PINNED IN-TEST (CLAUDE.md trap 13b): assert the op we mean to
    // inspect is actually there, so a passing result cannot be the action
    // silently emitting nothing.
    const addNodeOp = ops?.find((o) => o.op === 'add_node')
    expect(addNodeOp, 'the action must declare an add_node op').toBeTruthy()
    // ⭐ BOUND AS A KEY SET, WHICH IS BOTH DIRECTIONS IN ONE ASSERTION. A
    // one-sided "does not have `category`" would be satisfied just as happily
    // by `data: {}` or a missing `data` — i.e. by destroying the op — and by
    // any third key riding in. The exact set can be satisfied by nothing but
    // the truth.
    expect(Object.keys(addNodeOp!.data ?? {}).sort()).toEqual(['kind', 'label'])
    expect(addNodeOp!.data).toEqual({ kind: 'factor', label: 'New factor' })
  })
})

describe('insertFactorBetweenAction — the explicit unknown on the edge-split path', () => {
  /**
   * ⚠⚠ WHY THIS PATH GETS ITS OWN BLOCK, AND WHY IT NEEDS **TWO** ASSERTIONS.
   *
   * `insertFactorBetweenAction` installs its node by a bare
   * `useCanvasStore.setState` rather than through a store add action, so it
   * carries its OWN copy of the seed — and `commitValidatedMutation` chooses
   * between that local branch and PLoT's validated graph AT RUNTIME, on whether
   * `plot.validatePatch` exists. Two writers, one property, and neither guards
   * the other: pinning one would leave the guarantee decided by a capability
   * probe.
   *
   * ⭐ AND IT ARRIVES WORSE THAN THE CONNECTED-ADD PATH. Splitting an edge puts
   * the new factor in the SOURCE position of the second new edge, so
   * `outcomesAffected` is 1 the instant it appears — the precondition
   * `FactorNode`'s "Uncertainty here affects {N} outcome{s}." needs is satisfied
   * by construction here, with no direction caveat at all.
   */
  it('⭐⭐ neither writer seeds a category — the declared OP and the local setState agree', async () => {
    const { commitValidatedMutation } = await import('../../mutations/commitValidatedMutation')
    ;(commitValidatedMutation as any).mockClear()
    ;(useCanvasStore.setState as any).mockClear()

    await insertFactorBetweenAction('e1', showToast)

    // ── WRITER 1: the ops sent to PLoT's validatePatch ──────────────────────
    const ops = (commitValidatedMutation as any).mock.calls[0]?.[0] as Array<{
      op: string
      data?: Record<string, unknown>
    }>
    const addNodeOp = ops?.find((o) => o.op === 'add_node')
    // PRECONDITION PINNED IN-TEST: the op must exist, or "carries no category"
    // is satisfied by the action having done nothing at all.
    expect(addNodeOp, 'the action must declare an add_node op').toBeTruthy()
    expect(addNodeOp!.data).toEqual({ kind: 'factor', label: 'New factor' })

    // ── WRITER 2: the local setState updater, INVOKED, not merely inspected ──
    const updater = (useCanvasStore.setState as any).mock.calls.at(-1)?.[0]
    expect(typeof updater, 'the local branch must install via a setState updater').toBe('function')
    const next = updater({ nodes: [], edges: [], selection: null })
    // Bound by IDENTITY — the id the action minted — never "the last node" or
    // "the factor", either of which another node could satisfy.
    const created = (next.nodes as Array<{ id: string; data: Record<string, unknown> }>).find(
      (n) => n.id === 'new-1',
    )
    expect(created, 'the local branch must create the node it minted an id for').toBeTruthy()
    expect(created!.data).toEqual({ label: 'New factor', kind: 'factor' })
  })

  it('⭐ the new factor really does land in the SOURCE position — the precondition, pinned', async () => {
    // Without this, the assertions above could be true of a topology in which
    // the fabricated sentence could never have rendered anyway, and the block
    // would be guarding a harm it cannot reach (CLAUDE.md trap 13b).
    //
    // ⚠ PERFORMS ITS OWN GESTURE rather than reading the previous test's mock
    // calls: `beforeEach` runs `vi.clearAllMocks()`, so a `.mock.calls` read
    // borrowed from a sibling test sees an EMPTY array here. A test that
    // depends on another test's leftovers is a test whose result depends on
    // file order.
    ;(useCanvasStore.setState as any).mockClear()
    await insertFactorBetweenAction('e1', showToast)

    const updater = (useCanvasStore.setState as any).mock.calls.at(-1)?.[0]
    expect(typeof updater, 'the local branch must install via a setState updater').toBe('function')
    const next = updater({ nodes: [], edges: [], selection: null })
    const outbound = (next.edges as Array<{ source: string }>).filter((e) => e.source === 'new-1')
    expect(outbound.length).toBeGreaterThan(0)
  })
})

describe('markAsAssumption', () => {
  it('toggles flag ON for a node', () => {
    markAsAssumption('f1', 'node', showToast)
    expect(mockStore.updateNode).toHaveBeenCalledWith('f1', {
      data: expect.objectContaining({ flagged_as_assumption: true }),
    })
    expect(showToast).toHaveBeenCalledWith('Marked as assumption', 'info')
  })

  it('toggles flag OFF when already flagged', () => {
    // Temporarily set the flag
    const original = mockStore.nodes[0].data
    mockStore.nodes[0] = {
      ...mockStore.nodes[0],
      data: { ...original, flagged_as_assumption: true },
    }
    markAsAssumption('f1', 'node', showToast)
    expect(mockStore.updateNode).toHaveBeenCalledWith('f1', {
      data: expect.objectContaining({ flagged_as_assumption: false }),
    })
    expect(showToast).toHaveBeenCalledWith('Assumption flag removed', 'info')
    // Restore
    mockStore.nodes[0] = { ...mockStore.nodes[0], data: original }
  })

  it('toggles flag for an edge', () => {
    markAsAssumption('e1', 'edge', showToast)
    expect(mockStore.updateEdgeData).toHaveBeenCalledWith('e1', { flagged_as_assumption: true })
  })
})

describe('traceToGoal', () => {
  it('selects the node to trigger path highlight', () => {
    traceToGoal('f1', showToast)
    expect(mockStore.selectNodeWithoutHistory).toHaveBeenCalledWith('f1')
  })
})

describe('askAI', () => {
  it('selects node and opens conversation panel', () => {
    const target: NodeTarget = {
      kind: 'node',
      nodeId: 'f1',
      nodeType: 'factor',
      node: mockStore.nodes[0],
      screenPos: { x: 0, y: 0 },
    }
    askAI(target, 'explain_element')
    expect(mockStore.selectNodeWithoutHistory).toHaveBeenCalledWith('f1')
    expect(mockStore.setShowDraftChat).toHaveBeenCalledWith(true)
  })

  it('preserves both nodeIds and edgeIds for multi-select target', () => {
    const target: MultiTarget = {
      kind: 'multi',
      nodeIds: ['f1', 'g1'],
      edgeIds: ['e1'],
      screenPos: { x: 0, y: 0 },
    }
    askAI(target, 'explain_subgraph')
    // setState is called with an updater function — invoke it to get the result
    const setStateCalls = (useCanvasStore.setState as any).mock.calls
    const updaterCall = setStateCalls.find((c: any) => typeof c[0] === 'function')
    expect(updaterCall).toBeDefined()
    const result = updaterCall[0]({ nodes: mockStore.nodes })
    expect([...result.selection.nodeIds]).toEqual(['f1', 'g1'])
    expect([...result.selection.edgeIds]).toEqual(['e1'])
    // Verify node.selected flags are also set
    const selectedIds = result.nodes.filter((n: any) => n.selected).map((n: any) => n.id)
    expect(selectedIds).toEqual(['f1', 'g1'])
  })

  it('shows warning toast when _sendMessage is unavailable after polling budget', () => {
    vi.useFakeTimers({ shouldAdvanceTime: false, toFake: ['setTimeout', 'clearTimeout'] })
    try {
      // Override guidance store mock to return null _sendMessage
      const origGetState = useGuidanceStore.getState
      ;(useGuidanceStore as any).getState = () => ({ _sendMessage: null })

      // Stub requestAnimationFrame to call callback synchronously
      const origRaf = globalThis.requestAnimationFrame
      globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => { cb(0); return 0 }

      const target: NodeTarget = {
        kind: 'node',
        nodeId: 'f1',
        nodeType: 'factor',
        node: mockStore.nodes[0],
        screenPos: { x: 0, y: 0 },
      }
      askAI(target, 'explain_element', showToast)

      // Exhaust all 20 polling attempts (50ms × 20 = 1000ms)
      vi.advanceTimersByTime(1100)

      expect(showToast).toHaveBeenCalledWith(
        'Could not send message — try typing your question directly.',
        'warning',
      )

      // Restore
      globalThis.requestAnimationFrame = origRaf
      ;(useGuidanceStore as any).getState = origGetState
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('clipboard operations', () => {
  it('copyAction calls copySelected', () => {
    copyAction()
    expect(mockStore.copySelected).toHaveBeenCalled()
  })

  it('duplicateAction calls duplicateSelected', async () => {
    await duplicateAction(showToast)
    expect(mockStore.duplicateSelected).toHaveBeenCalled()
  })
})

describe('paste/duplicate include edge ops in patch', () => {
  it('pasteAction includes add_edge ops for clipboard edges', async () => {
    const { commitValidatedMutation } = await import('../../mutations/commitValidatedMutation')
    // Set clipboard with both nodes and edges
    mockStore.clipboard = {
      nodes: [mockStore.nodes[0], mockStore.nodes[1]],
      edges: [mockStore.edges[0]],
    } as any
    const { pasteAction } = await import('../actions')
    await pasteAction({ x: 0, y: 0 }, showToast)
    const calls = (commitValidatedMutation as any).mock.calls
    const lastOps = calls[calls.length - 1][0]
    const opTypes = lastOps.map((o: any) => o.op)
    expect(opTypes).toContain('add_node')
    expect(opTypes).toContain('add_edge')
    // Cleanup
    mockStore.clipboard = null
  })

  it('duplicateAction includes add_edge ops for internal edges', async () => {
    const { commitValidatedMutation } = await import('../../mutations/commitValidatedMutation')
    // Both endpoints in selection → edge should be included
    mockStore.selection = { nodeIds: new Set(['f1', 'g1']), edgeIds: new Set<string>(), anchorPosition: null }
    await duplicateAction(showToast)
    const calls = (commitValidatedMutation as any).mock.calls
    const lastOps = calls[calls.length - 1][0]
    const opTypes = lastOps.map((o: any) => o.op)
    expect(opTypes).toContain('add_node')
    expect(opTypes).toContain('add_edge')
    // Restore
    mockStore.selection = { nodeIds: new Set(['f1']), edgeIds: new Set<string>(), anchorPosition: null }
  })
})

describe('deleteAction node patch includes connected edges', () => {
  it('builds compound patch with edge removals + node removal', async () => {
    const { commitValidatedMutation } = await import('../../mutations/commitValidatedMutation')
    const target: NodeTarget = {
      kind: 'node',
      nodeId: 'f1',
      nodeType: 'factor',
      node: mockStore.nodes[0],
      screenPos: { x: 0, y: 0 },
    }
    await deleteAction(target, showToast)
    // commitValidatedMutation should have been called with edge + node ops
    const calls = (commitValidatedMutation as any).mock.calls
    const lastOps = calls[calls.length - 1][0]
    const opTypes = lastOps.map((o: any) => o.op)
    expect(opTypes).toContain('remove_edge')
    expect(opTypes).toContain('remove_node')
  })
})
