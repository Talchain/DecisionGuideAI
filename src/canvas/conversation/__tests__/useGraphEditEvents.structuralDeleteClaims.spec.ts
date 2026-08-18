/**
 * ONE GESTURE, ONE TURN.
 *
 * A canvas delete is now carried by `structural_delete`. Without the claim
 * subtraction the debounced notification would describe the SAME gesture a
 * second time as a `direct_graph_edit` with `operations: ['remove']` — two
 * authorities for one user action, and the notification half is the
 * 'ack_and_commit' path (turn row, NO graph write) that the durable verb exists
 * to replace.
 *
 * Opposite-direction twin throughout: what is claimed must vanish from the
 * notification, and what is NOT claimed must still be reported.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'

import {
  removeStructuralDeleteClaims,
  useGraphEditEvents,
  type DiffAccumulator,
} from '../useGraphEditEvents'
import { useCanvasStore } from '../../store'
import type { EdgeData } from '../../domain/edges'

vi.mock('../../../flags', () => ({
  isOrchestratorV2Enabled: () => true,
  isJourneyTabEnabled: () => false,
}))

const HASH = 'f3d31f75957c5cb5'
const send = vi.fn().mockResolvedValue(undefined)

function node(id: string): Node {
  return { id, type: 'factor', position: { x: 0, y: 0 }, data: { label: id } }
}
function edge(id: string, source: string, target: string): Edge<EdgeData> {
  return { id, source, target, data: {} as EdgeData }
}

function seed(hash: string | null) {
  useCanvasStore.setState({
    currentScenarioId: 's1',
    nodes: [node('goal'), node('option_a'), node('option_b')],
    edges: [edge('e-0', 'option_a', 'goal')],
    selection: { nodeIds: new Set<string>(), edgeIds: new Set<string>(), anchorPosition: null },
    lastServerGraphHash: hash,
    pendingStructuralDeletes: [],
    _externalMutationActive: 0,
  } as never)
}

/** The `direct_graph_edit` calls the notification hook made, if any. */
function graphEditCalls() {
  return send.mock.calls.filter((c) => (c[0] as { type?: string })?.type === 'direct_graph_edit')
}

beforeEach(() => {
  vi.useFakeTimers()
  send.mockClear()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('claimed removals do not ALSO ride the debounced notification', () => {
  it('a delete carried by structural_delete emits NO direct_graph_edit at all', () => {
    seed(HASH)
    renderHook(() => useGraphEditEvents(send))
    act(() => {
      useCanvasStore.getState().deleteNodeById('option_b')
    })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(graphEditCalls()).toHaveLength(0)
  })

  it('an UNCLAIMED change in the same window is still reported (twin: not suppressed)', () => {
    seed(HASH)
    renderHook(() => useGraphEditEvents(send))
    act(() => {
      useCanvasStore.getState().deleteNodeById('option_b')
      // A separate, producer-side add that the delete intent never claimed.
      useCanvasStore.setState({
        nodes: [...useCanvasStore.getState().nodes, node('factor_new')],
      } as never)
    })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    const calls = graphEditCalls()
    expect(calls).toHaveLength(1)
    const payload = calls[0][0].payload as {
      changed_node_ids: string[]
      operations: string[]
    }
    // Bound by identity: the claimed id is gone, the unclaimed one remains.
    expect(payload.changed_node_ids).toEqual(['factor_new'])
    expect(payload.changed_node_ids).not.toContain('option_b')
    // …and the op set is RE-DERIVED, so no stale 'remove' survives.
    expect(payload.operations).toEqual(['add'])
  })

  it('WITHOUT a base hash nothing is claimed, so the notification still carries the removal', () => {
    // The KNOWN GAP path: today's behaviour is preserved exactly, not replaced.
    seed(null)
    renderHook(() => useGraphEditEvents(send))
    act(() => {
      useCanvasStore.getState().deleteNodeById('option_b')
    })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    const calls = graphEditCalls()
    expect(calls).toHaveLength(1)
    const payload = calls[0][0].payload as {
      changed_node_ids: string[]
      operations: string[]
    }
    expect(payload.changed_node_ids).toEqual(['option_b'])
    expect(payload.operations).toEqual(['remove'])
  })
})

// ---------------------------------------------------------------------------
// removeStructuralDeleteClaims — driven directly, because the hook path cannot
// reach one of its branches.
//
// ⚠ THIS SECTION EXISTS BECAUSE A MUTANT SURVIVED. Deleting the `operations`
// re-derivation left the whole battery green: the store applies a removal and
// any sibling change in SEPARATE `set()` calls, so the hook's subscribe callback
// never sees one diff carrying a claimed removal AND an unclaimed change — the
// only shape in which a stale 'remove' is observable. A branch the caller cannot
// currently reach is still a branch the next caller will, and a guard nothing
// can red is not a guard. Driving the function directly is what closes it.
// ---------------------------------------------------------------------------

function diff(over: Partial<DiffAccumulator> = {}): DiffAccumulator {
  return {
    changedNodeIds: new Set(),
    changedEdgeIds: new Set(),
    operations: new Set(),
    nodeOps: new Map(),
    edgeOps: new Map(),
    fieldsChanged: new Map(),
    ...over,
  }
}

describe('removeStructuralDeleteClaims — the op set is RE-DERIVED, not left stale', () => {
  it('drops the claimed removal AND the now-unsupported "remove" op kind', () => {
    const d = diff({
      changedNodeIds: new Set(['option_b', 'factor_new']),
      operations: new Set<'add' | 'update' | 'remove'>(['remove', 'add']),
      nodeOps: new Map<string, 'add' | 'update' | 'remove'>([
        ['option_b', 'remove'],
        ['factor_new', 'add'],
      ]),
    })
    removeStructuralDeleteClaims(d, [{ claimedNodeIds: ['option_b'], claimedEdgeIds: [] }])

    expect([...d.changedNodeIds]).toEqual(['factor_new'])
    // The whole point: 'remove' must NOT survive, or the notification tells CEE
    // a removal happened that it no longer names.
    expect([...d.operations].sort()).toEqual(['add'])
  })

  it('KEEPS "remove" when an UNCLAIMED removal is still in the diff (twin)', () => {
    const d = diff({
      changedNodeIds: new Set(['option_b', 'option_c']),
      operations: new Set<'add' | 'update' | 'remove'>(['remove']),
      nodeOps: new Map<string, 'add' | 'update' | 'remove'>([
        ['option_b', 'remove'],
        ['option_c', 'remove'],
      ]),
    })
    removeStructuralDeleteClaims(d, [{ claimedNodeIds: ['option_b'], claimedEdgeIds: [] }])
    expect([...d.changedNodeIds]).toEqual(['option_c'])
    expect([...d.operations]).toEqual(['remove'])
  })

  it('never drops a claimed id whose op is NOT a removal — a re-add is a genuine add', () => {
    const d = diff({
      changedNodeIds: new Set(['option_b']),
      operations: new Set<'add' | 'update' | 'remove'>(['add']),
      nodeOps: new Map<string, 'add' | 'update' | 'remove'>([['option_b', 'add']]),
    })
    removeStructuralDeleteClaims(d, [{ claimedNodeIds: ['option_b'], claimedEdgeIds: [] }])
    expect([...d.changedNodeIds]).toEqual(['option_b'])
    expect([...d.operations]).toEqual(['add'])
  })

  it('drops a claimed EDGE removal by its canvas id, leaving unclaimed edges alone', () => {
    const d = diff({
      changedEdgeIds: new Set(['e-1', 'e-9']),
      operations: new Set<'add' | 'update' | 'remove'>(['remove']),
      edgeOps: new Map<string, 'add' | 'update' | 'remove'>([
        ['e-1', 'remove'],
        ['e-9', 'remove'],
      ]),
    })
    removeStructuralDeleteClaims(d, [{ claimedNodeIds: [], claimedEdgeIds: ['e-1'] }])
    expect([...d.changedEdgeIds]).toEqual(['e-9'])
  })

  it('an EMPTY pending list leaves the diff byte-identical — no claim, no subtraction', () => {
    const d = diff({
      changedNodeIds: new Set(['option_b']),
      operations: new Set<'add' | 'update' | 'remove'>(['remove']),
      nodeOps: new Map<string, 'add' | 'update' | 'remove'>([['option_b', 'remove']]),
    })
    removeStructuralDeleteClaims(d, [])
    expect([...d.changedNodeIds]).toEqual(['option_b'])
    expect([...d.operations]).toEqual(['remove'])
  })
})
