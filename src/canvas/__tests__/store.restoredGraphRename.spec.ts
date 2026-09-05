/**
 * THE FIRST FAILING LINK: `restored graph -> first typed rename -> canonical writer`.
 *
 * ⭐⭐ WHY THIS SPEC EXISTS. `store.structuralRenameCapture.spec.ts` pinned the
 * opposite of this file — "with NO server hash the rename is LOCAL-ONLY: no
 * intent, and the label applies anyway" — and that pin was pinning the DEFECT.
 * The combination it blessed is the worst one available: the carrier exists, the
 * capture bails out on a restored graph, and the canvas shows the new name
 * regardless. A local-only write that LOOKS committed and then vanishes on the
 * next reload is exactly the harm `structural_rename` was added to end.
 *
 * ⚠ AND THE FIX IS NOT TO BLOCK THE RENAME. UI #1025 REVERTED #1024 for shipping a
 * control that HID the loss; blocking would be its mirror — a regression of a
 * capability the product has had since before 0.50.0, bought for tidiness. The
 * rename applies, it is DEFERRED rather than dropped, the very next turn stamps
 * a real `base_graph_hash` onto it, and the user is told plainly where it stands
 * in the meantime.
 *
 * ⚠ WHY DEFERRAL AND NOT A SEEDED HASH — re-derived here rather than inherited,
 * because it is the load-bearing constraint:
 *   · `lastServerGraphHash` is null after a restore because nothing CLEARS it —
 *     a reload builds a fresh store whose initial value is null, and a scenario
 *     SWITCH nulls it through `DECISION_CONTEXT_CLEAR`. That clearing is
 *     load-bearing (store.ts:1585-1589): carrying decision A's hash into
 *     decision B would assert a graph this canvas is no longer showing. It must
 *     not change, so the fix belongs in the CAPTURE.
 *   · Hydration cannot seed it. The scenario-graph read returns
 *     `graph_identity_hash` (an envelope, `projection_version: 'identity.v1'`)
 *     and no `graph_hash` at all.
 *   · The UI cannot COMPUTE it. `boundary/graph-hash-contract` publishes a field
 *     VOCABULARY and says in terms that it "does NOT implement a hashing
 *     function" — CEE owns the projection, ordering, encoding and digest. The
 *     two local `generateGraphHash` twins are different algorithms; sending
 *     either would be a fabricated assertion.
 * So the only real `base_graph_hash` in existence arrives on a turn response,
 * via `applyV5State`. Deferring until it does is the one honest way to complete
 * the chain.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Node } from '@xyflow/react'

import { useCanvasStore } from '../store'
import {
  buildStructuralRenameWirePayload,
  resolveStructuralRenameBase,
} from '../mutations/structuralRename'

const NODE_ID = 'fac_price'
const SIBLING_ID = 'fac_sibling'
const PREVIOUS = 'Price'
const NEW = 'List price'
/** The hash a later turn stamps — never present at restore. */
const TURN_HASH = 'cfded3af0aa14ebd'

/**
 * A scenario RESTORED from Supabase: it owns a server graph (`currentScenarioId`)
 * and has seen no CEE turn, so `lastServerGraphHash` is null. This is the exact
 * state a reload lands in, and the state the old spec called "local-only".
 */
function seedRestored(overrides: Record<string, unknown> = {}) {
  useCanvasStore.setState({
    currentScenarioId: 's1',
    lastServerGraphHash: null,
    pendingStructuralRenames: [],
    _externalMutationActive: 0,
    lastAuthoritativeGraph: null,
    nodes: [
      // Same label on two nodes — no value predicate can bind, only an id can.
      { id: NODE_ID, type: 'factor', position: { x: 0, y: 0 }, data: { label: PREVIOUS, kind: 'factor' } },
      { id: SIBLING_ID, type: 'factor', position: { x: 9, y: 0 }, data: { label: PREVIOUS, kind: 'factor' } },
    ] as unknown as Node[],
    edges: [],
    ...overrides,
  } as never)
}

/** Captures what the canvas's canonical toast bridge was asked to say. */
let toasts: Array<{ message?: string; level?: string }>
let toastListener: (e: Event) => void

beforeEach(() => {
  seedRestored()
  toasts = []
  toastListener = (e: Event) => {
    toasts.push((e as CustomEvent).detail ?? {})
  }
  window.addEventListener('topbar:show-toast', toastListener)
})

afterEach(() => {
  window.removeEventListener('topbar:show-toast', toastListener)
  vi.restoreAllMocks()
})

const labelOf = (id: string) =>
  (useCanvasStore.getState().nodes.find((n) => n.id === id)?.data as { label?: string } | undefined)
    ?.label

describe('restored graph -> first typed rename -> canonical writer', () => {
  it('the first rename after a restore QUEUES a durable intent — deferred, never dropped', () => {
    useCanvasStore.getState().updateNodeLabel(NODE_ID, NEW)

    const queued = useCanvasStore.getState().pendingStructuralRenames
    expect(queued).toHaveLength(1)
    // BOUND BY IDENTITY — this node's id, not a label another node also carries.
    expect(queued[0]!.nodeId).toBe(NODE_ID)
    // The concurrency assertion is still the PRE-rename label.
    expect(queued[0]!.expectedLabel).toBe(PREVIOUS)
    expect(queued[0]!.label).toBe(NEW)
    // No fabricated hash: the intent knows it does not have one yet.
    expect(queued[0]!.baseGraphHash).toBeNull()
  })

  it('once a turn stamps a graph_hash the intent resolves, carrying THAT hash and the ORIGINAL expected_label', () => {
    useCanvasStore.getState().updateNodeLabel(NODE_ID, NEW)
    const intent = useCanvasStore.getState().pendingStructuralRenames[0]!

    // `applyV5State` captures the top-level `graph_hash` off any turn response.
    useCanvasStore.getState().setLastServerGraphHash(TURN_HASH)

    const resolved = resolveStructuralRenameBase(
      intent,
      useCanvasStore.getState().lastServerGraphHash,
    )
    expect(resolved).not.toBeNull()
    expect(buildStructuralRenameWirePayload(resolved!)).toEqual({
      node_id: NODE_ID,
      label: NEW,
      expected_label: PREVIOUS,
      base_graph_hash: TURN_HASH,
    })
  })

  it('IDENTITY — the resolved payload names the renamed node, never its same-labelled sibling', () => {
    useCanvasStore.getState().updateNodeLabel(NODE_ID, NEW)
    useCanvasStore.getState().setLastServerGraphHash(TURN_HASH)
    const resolved = resolveStructuralRenameBase(
      useCanvasStore.getState().pendingStructuralRenames[0]!,
      TURN_HASH,
    )
    expect(resolved!.nodeId).toBe(NODE_ID)
    expect(resolved!.nodeId).not.toBe(SIBLING_ID)
  })

  it('an intent with no hash yet has NO wire payload — nothing approximate reaches CEE', () => {
    useCanvasStore.getState().updateNodeLabel(NODE_ID, NEW)
    const intent = useCanvasStore.getState().pendingStructuralRenames[0]!
    // The store still holds no hash, so the intent cannot be resolved.
    expect(resolveStructuralRenameBase(intent, useCanvasStore.getState().lastServerGraphHash))
      .toBeNull()
  })
})

describe('the user is told where the rename stands — no silent local-only apply', () => {
  it('a deferred rename on a server-backed scenario says so, and names what completes it', () => {
    useCanvasStore.getState().updateNodeLabel(NODE_ID, NEW)

    expect(toasts).toHaveLength(1)
    const message = toasts[0]!.message ?? ''
    // The two facts a user needs: it is NOT saved yet, and a reload loses it.
    expect(message).toMatch(/not .*saved|isn't saved|not yet saved/i)
    expect(message).toMatch(/reload/i)
  })

  it('TWIN — a genuinely local scratch graph gets NO notice: there is no saved model to fall behind', () => {
    seedRestored({ currentScenarioId: null, lastAuthoritativeGraph: null })
    useCanvasStore.getState().updateNodeLabel(NODE_ID, NEW)

    expect(toasts).toHaveLength(0)
    expect(labelOf(NODE_ID)).toBe(NEW)
  })

  it('OPPOSITE TWIN — with a hash already in hand there is nothing to disclose, so no notice fires', () => {
    seedRestored({ lastServerGraphHash: TURN_HASH })
    useCanvasStore.getState().updateNodeLabel(NODE_ID, NEW)

    expect(useCanvasStore.getState().pendingStructuralRenames).toHaveLength(1)
    expect(useCanvasStore.getState().pendingStructuralRenames[0]!.baseGraphHash).toBe(TURN_HASH)
    expect(toasts).toHaveLength(0)
  })
})

describe('the deferral must not regress what already worked', () => {
  it('the LOCAL rename still applies, bound by id — the pre-0.50.0 capability is intact', () => {
    useCanvasStore.getState().updateNodeLabel(NODE_ID, NEW)
    expect(labelOf(NODE_ID)).toBe(NEW)
    expect(labelOf(SIBLING_ID)).toBe(PREVIOUS)
  })

  it('a PRODUCER write still queues nothing and still says nothing — hash or no hash', () => {
    useCanvasStore.setState({ _externalMutationActive: 1 } as never)
    useCanvasStore.getState().updateNodeLabel(NODE_ID, NEW)

    expect(useCanvasStore.getState().pendingStructuralRenames).toHaveLength(0)
    expect(toasts).toHaveLength(0)
    // The producer's write still lands — a canvas that stopped reflecting the
    // server would be a far worse defect than a missing turn.
    expect(labelOf(NODE_ID)).toBe(NEW)
  })

  it('a no-op rename still queues nothing and still says nothing', () => {
    useCanvasStore.getState().updateNodeLabel(NODE_ID, PREVIOUS)
    expect(useCanvasStore.getState().pendingStructuralRenames).toHaveLength(0)
    expect(toasts).toHaveLength(0)
  })
})
