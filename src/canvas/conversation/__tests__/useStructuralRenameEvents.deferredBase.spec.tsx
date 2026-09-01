/**
 * The DRAIN half of `restored graph -> first typed rename -> canonical writer`.
 *
 * `store.restoredGraphRename.spec.ts` pins the capture: a rename made before any
 * turn is queued with a NULL base hash rather than dropped. That is only half a
 * chain. This file pins the other half — that the queue is HELD while no hash
 * exists, and that the first turn to stamp one puts the rename on the wire with
 * that hash.
 *
 * ⚠⚠ THE FAILURE MODE THIS GUARDS IS SILENT AND WOULD LOOK LIKE SUCCESS. Before
 * the `lastServerGraphHash` subscription, the effect keyed on `pending` alone.
 * A deferred intent therefore had nothing left to wake it: the gesture was long
 * over, so `pending` never changed again, and the intent sat in memory until the
 * tab closed. Every capture assertion would still pass, the queue would look
 * healthy, and no turn would ever be sent — the same shape as
 * `StructuralDeleteDrainHost`'s header records for the delete drain shipping
 * dark under a green suite.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { Node } from '@xyflow/react'

import { useCanvasStore } from '../../store'
import { useStructuralRenameEvents } from '../useStructuralRenameEvents'

vi.mock('../../../flags', async (importOriginal) => ({
  // ⚠ SPREAD THE ORIGINAL. A bare factory REPLACES the module, so every other
  // flag this hook's import graph reads would silently become undefined — the
  // estate's documented flags-mock defect.
  ...(await importOriginal<typeof import('../../../flags')>()),
  isOrchestratorV2Enabled: () => true,
}))

const NODE_ID = 'fac_price'
const SIBLING_ID = 'fac_sibling'
const PREVIOUS = 'Price'
const NEW = 'List price'
const TURN_HASH = 'cfded3af0aa14ebd'

function seedRestored() {
  useCanvasStore.setState({
    currentScenarioId: 's1',
    lastServerGraphHash: null,
    pendingStructuralRenames: [],
    _externalMutationActive: 0,
    lastAuthoritativeGraph: null,
    nodes: [
      // Same label on two nodes — only an id can bind, never a value predicate.
      { id: NODE_ID, type: 'factor', position: { x: 0, y: 0 }, data: { label: PREVIOUS, kind: 'factor' } },
      { id: SIBLING_ID, type: 'factor', position: { x: 9, y: 0 }, data: { label: PREVIOUS, kind: 'factor' } },
    ] as unknown as Node[],
    edges: [],
  } as never)
}

beforeEach(() => {
  seedRestored()
})

describe('a rename captured before any turn reaches the wire once a hash arrives', () => {
  it('HOLDS while no base hash exists — the queue is not drained, and nothing is sent', async () => {
    const sent = vi.fn().mockResolvedValue({})
    renderHook(() => useStructuralRenameEvents(sent))

    act(() => {
      useCanvasStore.getState().updateNodeLabel(NODE_ID, NEW)
    })

    await waitFor(() => {
      expect(useCanvasStore.getState().pendingStructuralRenames).toHaveLength(1)
    })
    // ⭐ THE LOAD-BEARING NEGATIVE: held, not discarded. A drain that emptied the
    // queue here would reproduce the P0 one layer down — label on the canvas,
    // nothing on the wire, and no record left that anything was owed.
    expect(sent).not.toHaveBeenCalled()
    expect(useCanvasStore.getState().pendingStructuralRenames[0]!.baseGraphHash).toBeNull()
  })

  it('SENDS as soon as a turn stamps a graph_hash, carrying that hash and this node id', async () => {
    const sent = vi.fn().mockResolvedValue({})
    renderHook(() => useStructuralRenameEvents(sent))

    act(() => {
      useCanvasStore.getState().updateNodeLabel(NODE_ID, NEW)
    })
    await waitFor(() => {
      expect(useCanvasStore.getState().pendingStructuralRenames).toHaveLength(1)
    })

    // `applyV5State` captures the top-level `graph_hash` off any turn response.
    act(() => {
      useCanvasStore.getState().setLastServerGraphHash(TURN_HASH)
    })

    await waitFor(() => {
      expect(sent).toHaveBeenCalledTimes(1)
    })
    const [event] = sent.mock.calls[0]!
    expect(event.type).toBe('structural_rename')
    // BOUND BY IDENTITY — this node's id, not a label the sibling also carries.
    expect(event.payload).toEqual({
      node_id: NODE_ID,
      label: NEW,
      expected_label: PREVIOUS,
      base_graph_hash: TURN_HASH,
    })
    await waitFor(() => {
      expect(useCanvasStore.getState().pendingStructuralRenames).toHaveLength(0)
    })
  })

  it('OPPOSITE TWIN — with a hash already in hand the send is immediate, no second trigger needed', async () => {
    useCanvasStore.setState({ lastServerGraphHash: TURN_HASH } as never)
    const sent = vi.fn().mockResolvedValue({})
    renderHook(() => useStructuralRenameEvents(sent))

    act(() => {
      useCanvasStore.getState().updateNodeLabel(NODE_ID, NEW)
    })

    await waitFor(() => {
      expect(sent).toHaveBeenCalledTimes(1)
    })
    expect(sent.mock.calls[0]![0].payload.base_graph_hash).toBe(TURN_HASH)
  })

  it('a hash arriving with an EMPTY queue sends nothing — the wake-up is not a trigger of its own', async () => {
    const sent = vi.fn().mockResolvedValue({})
    renderHook(() => useStructuralRenameEvents(sent))

    act(() => {
      useCanvasStore.getState().setLastServerGraphHash(TURN_HASH)
    })

    await new Promise((r) => setTimeout(r, 20))
    expect(sent).not.toHaveBeenCalled()
  })
})
