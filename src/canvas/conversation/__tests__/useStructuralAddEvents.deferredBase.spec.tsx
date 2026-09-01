/**
 * `useStructuralAddEvents` — the drain, and the two properties that make the
 * capability real rather than merely present.
 *
 * ⭐⭐ 1. THE DEFERRAL WAKES. A node added on a restored graph is queued with a
 * NULL base hash. Keying the effect on `pending` alone would leave that intent
 * sitting there with nothing left to wake it — the gesture is long over, so
 * `pending` never changes again and the node is NEVER SENT. Subscribing to
 * `lastServerGraphHash` is what closes `restored graph -> first added node ->
 * canonical writer`, and this file is what proves the subscription exists.
 *
 * ⭐⭐ 2. THE EVERY-EXIT SETTLE. `useConversation` gates its whole optimistic
 * resolution on `!isAbort`, and its abort arm handles `factor_value_edit` ONLY.
 * Every V5 dispatch runs `abortRef.current?.abort()` before installing its own
 * controller — so adding a node and then asking Olumi anything cancels the add's
 * turn and NEITHER arm runs: no removal, no confirmation, no sentence, and
 * nothing in state to say an attempt was made.
 *
 * ⚠ THE FIX IS DERIVED, NOT MIRRORED. Copying `useConversation`'s branch list
 * here would be the hand-maintained mirror this estate pays for most often — it
 * would drift the moment a new exit is added. The drain instead asks the only
 * question that matters after its await returns: *did anybody settle this?* If
 * not, we sent it and never heard, and `unconfirmed` is the honest terminal
 * state. This file proves that fallback fires WITHOUT the drain knowing anything
 * about why.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import type { Node } from '@xyflow/react'

import { useCanvasStore } from '../../store'
import { useStructuralAddEvents } from '../useStructuralAddEvents'
import {
  STRUCTURAL_ADD_UNCONFIRMED_TOAST,
  type StructuralAddIntent,
} from '../../mutations/structuralAdd'

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return { ...actual, isOrchestratorV2Enabled: () => true }
})

const SCENARIO_ID = 's1'
const TURN_HASH = 'cfded3af0aa14ebd'
const NODE_ID = 'fac_new'

function intent(over: Partial<StructuralAddIntent> = {}): StructuralAddIntent {
  return {
    id: 'sa-1',
    nodeId: NODE_ID,
    nodeKind: 'factor',
    label: 'Supplier risk',
    baseGraphHash: null,
    ...over,
  }
}

function seed(over: Record<string, unknown> = {}) {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    lastServerGraphHash: null,
    pendingStructuralAdds: [],
    structuralAddLifecycle: [],
    nodes: [
      { id: NODE_ID, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Supplier risk', kind: 'factor' } },
    ] as unknown as Node[],
    edges: [],
    ...over,
  } as never)
}

function Host({ send }: { send: (e: unknown, o?: unknown) => Promise<unknown> }) {
  useStructuralAddEvents(send as never)
  return null
}

let toasts: Array<{ message?: string }>
let listener: (e: Event) => void

beforeEach(() => {
  seed()
  toasts = []
  listener = (e: Event) => toasts.push((e as CustomEvent).detail ?? {})
  window.addEventListener('topbar:show-toast', listener)
})
afterEach(() => {
  window.removeEventListener('topbar:show-toast', listener)
  vi.clearAllMocks()
})

describe('the deferred intent HOLDS, then WAKES on the next turn hash', () => {
  it('⭐⭐ with no base hash the queue is HELD — nothing sent, nothing dropped', async () => {
    const send = vi.fn(async () => undefined)
    seed({ pendingStructuralAdds: [intent()] })
    render(<Host send={send} />)

    await waitFor(() => {
      expect(send).not.toHaveBeenCalled()
    })
    // ⚠ HELD, NOT DISCARDED. Dropping here reproduces the P0 one layer down:
    // the node on the canvas and nothing on the wire.
    expect(useCanvasStore.getState().pendingStructuralAdds).toHaveLength(1)
  })

  it('⭐⭐ TWIN — a turn stamping a graph_hash WAKES the held queue and sends it', async () => {
    const send = vi.fn(async () => undefined)
    seed({ pendingStructuralAdds: [intent()] })
    const { rerender } = render(<Host send={send} />)
    await waitFor(() => expect(send).not.toHaveBeenCalled())

    // `applyV5State` captures the top-level `graph_hash` off any response.
    useCanvasStore.getState().setLastServerGraphHash(TURN_HASH)
    rerender(<Host send={send} />)

    await waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    const [event, opts] = send.mock.calls[0] as unknown as [
      { type: string; payload: Record<string, unknown> },
      { structuralAdd?: StructuralAddIntent },
    ]
    expect(event.type).toBe('structural_add')
    // The deferred intent is stamped with the REAL hash the turn supplied.
    expect(event.payload.base_graph_hash).toBe(TURN_HASH)
    expect(event.payload.node_id).toBe(NODE_ID)
    // ⚠ AND THE PAYLOAD CARRIES NO VALUE — the guarantee holds through the drain
    // as well as through the builder.
    expect(Object.keys(event.payload).sort()).toEqual([
      'base_graph_hash',
      'label',
      'node_id',
      'node_kind',
    ])
    // The intent rides along so `sendTurn` can resolve it against the receipt.
    expect(opts.structuralAdd?.id).toBe('sa-1')
  })

  it('an intent captured WITH a hash sends immediately, keeping its own assertion', async () => {
    const send = vi.fn(async () => undefined)
    seed({
      lastServerGraphHash: TURN_HASH,
      pendingStructuralAdds: [intent({ baseGraphHash: 'aaaa1111bbbb2222' })],
    })
    render(<Host send={send} />)
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    const [event] = send.mock.calls[0] as unknown as [{ payload: Record<string, unknown> }]
    // It asserts the graph the gesture was made against, not "now".
    expect(event.payload.base_graph_hash).toBe('aaaa1111bbbb2222')
  })
})

describe('the drain is SERIALISED and ATOMIC', () => {
  it('sends two queued gestures in order, one at a time, each recorded', async () => {
    const send = vi.fn(async () => undefined)
    seed({
      lastServerGraphHash: TURN_HASH,
      pendingStructuralAdds: [
        intent({ id: 'sa-1', nodeId: 'a', baseGraphHash: TURN_HASH }),
        intent({ id: 'sa-2', nodeId: 'b', baseGraphHash: TURN_HASH }),
      ],
    })
    render(<Host send={send} />)

    await waitFor(() => expect(send).toHaveBeenCalledTimes(2))
    const ids = (send.mock.calls as unknown as Array<[{ payload: { node_id: string } }]>).map(
      (c) => c[0].payload.node_id,
    )
    expect(ids).toEqual(['a', 'b'])
    // Every gesture has a record; none was lost between the queue and the wire.
    expect(useCanvasStore.getState().structuralAddLifecycle).toHaveLength(2)
    expect(useCanvasStore.getState().pendingStructuralAdds).toHaveLength(0)
  })
})

describe('⭐⭐ THE EVERY-EXIT SETTLE — the abort trap, closed without mirroring it', () => {
  it('a send that NOBODY resolves settles `unconfirmed` and tells the user', async () => {
    // The resolver never runs — exactly what an abort, a superseded turn, or any
    // future unhandled exit produces. The drain does not know or care WHY; it
    // asks only whether anybody answered.
    const send = vi.fn(async () => undefined)
    seed({
      lastServerGraphHash: TURN_HASH,
      pendingStructuralAdds: [intent({ baseGraphHash: TURN_HASH })],
    })
    render(<Host send={send} />)

    await waitFor(() => {
      expect(useCanvasStore.getState().structuralAddLifecycle[0]?.status).toBe('unconfirmed')
    })
    // ⚠ AND IT MUST NOT REMOVE THE NODE. The cancel was CLIENT-side; CEE may
    // well have taken the add, and destroying the user's work on that guess is
    // the data-loss direction of the same harm.
    expect(useCanvasStore.getState().nodes.some((n) => n.id === NODE_ID)).toBe(true)
    // A toast, not a chat message: the drain outlives the React instance that
    // started the send, so `addMessage` may belong to an unmounted tree.
    expect(toasts.map((t) => t.message)).toContain(STRUCTURAL_ADD_UNCONFIRMED_TOAST)
  })

  it('⭐ TWIN — a send the RESOLVER already settled is left alone, and says nothing', async () => {
    // The fallback is idempotent by reading the status BACK rather than by
    // having called the setter. A late arm rewriting a `committed` verdict as
    // `unconfirmed` would tell the user their saved node might not be saved — a
    // lie in the other direction.
    const send = vi.fn(async () => {
      const rec = useCanvasStore.getState().structuralAddLifecycle[0]
      if (rec) useCanvasStore.getState().settleStructuralAdd(rec.intent.id, 'committed')
      return undefined
    })
    seed({
      lastServerGraphHash: TURN_HASH,
      pendingStructuralAdds: [intent({ baseGraphHash: TURN_HASH })],
    })
    render(<Host send={send} />)

    await waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    await waitFor(() => {
      expect(useCanvasStore.getState().structuralAddLifecycle[0]?.status).toBe('committed')
    })
    expect(toasts.map((t) => t.message)).not.toContain(STRUCTURAL_ADD_UNCONFIRMED_TOAST)
  })

  it('a REJECTED send still settles — a failed transport is not a silent drop', async () => {
    const send = vi.fn(async () => {
      throw new Error('network down')
    })
    seed({
      lastServerGraphHash: TURN_HASH,
      pendingStructuralAdds: [intent({ baseGraphHash: TURN_HASH })],
    })
    render(<Host send={send} />)

    await waitFor(() => {
      expect(useCanvasStore.getState().structuralAddLifecycle[0]?.status).toBe('unconfirmed')
    })
  })
})
