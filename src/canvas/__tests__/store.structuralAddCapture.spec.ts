/**
 * `store.addNode` — the ONE chokepoint every add gesture crosses, and the
 * deferral disclosure that goes with it.
 *
 * ⭐⭐ WHY THE CAPTURE LIVES IN THE STORE ACTION AND NOT AT A CALL SITE. The pane
 * context menu, all six Command Palette "Add …" commands, the pre-analysis
 * `AddRow` and the hero goal field all reach `addNode`. Capturing at any ONE of
 * them would leave the others silent — which is precisely the defect
 * `StructuralDeleteDrainHost`'s header records as having shipped dark under a
 * fully green suite. This file asserts the capture happens at the chokepoint,
 * so a new call site inherits it for free.
 *
 * ⭐ AND THE DEFERRAL IS THE HALF THAT WAS BEATEN OUT OF THE FIRST DESIGN. On a
 * restored graph `lastServerGraphHash` is null: a reload builds a fresh store,
 * and a scenario switch nulls it through `DECISION_CONTEXT_CLEAR`. Refusing
 * there would mean the FIRST node a user adds after opening a saved decision is
 * silently never written — the exact harm this event exists to end, re-created
 * one layer down. The gesture is HELD, stamped by the next turn, and the user is
 * told plainly where it stands in the meantime.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Node } from '@xyflow/react'

import { useCanvasStore } from '../store'
import {
  STRUCTURAL_ADD_DEFERRED_NOTICE,
  buildStructuralAddWirePayload,
  resolveStructuralAddBase,
} from '../mutations/structuralAdd'

/** The hash a later turn stamps — never present at restore. */
const TURN_HASH = 'cfded3af0aa14ebd'
const BASE_HASH = 'f3d31f75957c5cb5'

/**
 * A scenario RESTORED from Supabase: it owns a server graph
 * (`currentScenarioId`) and has seen no CEE turn, so `lastServerGraphHash` is
 * null. This is the exact state a reload lands in.
 */
function seed(overrides: Record<string, unknown> = {}) {
  useCanvasStore.setState({
    currentScenarioId: 's1',
    lastServerGraphHash: null,
    pendingStructuralAdds: [],
    structuralAddLifecycle: [],
    _externalMutationActive: 0,
    lastAuthoritativeGraph: null,
    nodes: [] as unknown as Node[],
    edges: [],
    history: { past: [], future: [] },
    ...overrides,
  } as never)
}

let toasts: Array<{ message?: string; level?: string }>
let toastListener: (e: Event) => void

beforeEach(() => {
  seed()
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

const queue = () => useCanvasStore.getState().pendingStructuralAdds
const nodes = () => useCanvasStore.getState().nodes

describe('addNode — the chokepoint capture', () => {
  it('⭐ an add on a graph WITH a server hash queues a resolved-ready intent', () => {
    seed({ lastServerGraphHash: BASE_HASH })
    useCanvasStore.getState().addNode(undefined, 'factor', 'Supplier risk')

    expect(queue()).toHaveLength(1)
    const intent = queue()[0]!
    // BOUND BY IDENTITY to the node that was actually created.
    expect(intent.nodeId).toBe(nodes()[0]!.id)
    expect(intent.label).toBe('Supplier risk')
    expect(intent.nodeKind).toBe('factor')
    expect(intent.baseGraphHash).toBe(BASE_HASH)
    // No disclosure is owed: the model will hold it on this turn.
    expect(toasts).toHaveLength(0)
  })

  it('⭐⭐ THE DEFERRAL — an add on a RESTORED graph is QUEUED, not dropped', () => {
    useCanvasStore.getState().addNode(undefined, 'factor', 'Supplier risk')

    // The node is on the canvas...
    expect(nodes()).toHaveLength(1)
    // ...AND the gesture is held for the wire, with no fabricated hash.
    expect(queue()).toHaveLength(1)
    expect(queue()[0]!.baseGraphHash).toBeNull()
  })

  it('⭐⭐ THE DISCLOSURE — the deferred add tells the user exactly where it stands', () => {
    useCanvasStore.getState().addNode(undefined, 'factor', 'Supplier risk')

    expect(toasts).toHaveLength(1)
    expect(toasts[0]!.message).toBe(STRUCTURAL_ADD_DEFERRED_NOTICE)
    expect(toasts[0]!.level).toBe('warning')

    // ⭐ THE COPY MUST CARRY ALL FOUR CLAIMS. Asserted as content rather than by
    // string equality alone, so a later reword that DROPS one of them fails
    // here — the string check above would happily accept a shorter, vaguer
    // sentence. What happened, what has NOT, when it will, what is lost.
    const copy = toasts[0]!.message ?? ''
    expect(copy).toMatch(/added to the canvas/i) // what happened
    expect(copy).toMatch(/isn't saved to the model yet/i) // what has not
    expect(copy).toMatch(/next message/i) // when it will
    expect(copy).toMatch(/reload/i) // what is lost if they reload first
  })

  it('TWIN — a SCRATCH graph gets no disclosure, because it has no model to fall behind', () => {
    // No scenario and no authoritative graph: there is nothing to be out of
    // sync with, and a warning would be noise.
    seed({ currentScenarioId: null, lastAuthoritativeGraph: null })
    useCanvasStore.getState().addNode(undefined, 'factor', 'Scratch factor')
    expect(toasts).toHaveLength(0)
  })

  it('once a turn stamps a graph_hash the deferred intent resolves against THAT hash', () => {
    useCanvasStore.getState().addNode(undefined, 'factor', 'Supplier risk')
    const intent = queue()[0]!

    // `applyV5State` captures the top-level `graph_hash` off any turn response.
    useCanvasStore.getState().setLastServerGraphHash(TURN_HASH)
    const resolved = resolveStructuralAddBase(
      intent,
      useCanvasStore.getState().lastServerGraphHash,
    )
    expect(resolved).not.toBeNull()
    expect(buildStructuralAddWirePayload(resolved!)).toEqual({
      node_id: intent.nodeId,
      node_kind: 'factor',
      label: 'Supplier risk',
      base_graph_hash: TURN_HASH,
    })
  })

  it('a PRODUCER write records nothing — CEE’s own graph coming back is not a user add', () => {
    seed({ lastServerGraphHash: BASE_HASH, _externalMutationActive: 1 })
    useCanvasStore.getState().addNode(undefined, 'factor', 'From the server')
    // The node still applies locally...
    expect(nodes()).toHaveLength(1)
    // ...but nothing is echoed back to the server as a user gesture.
    expect(queue()).toHaveLength(0)
  })

  it('⭐ names the node at CREATION — one gesture, one turn, and no scan', () => {
    // The two callers that used to `addNode()` → scan → `updateNodeLabel()` put
    // TWO turns on the wire for one gesture, and the scan bound by a VALUE
    // PREDICATE (trap 19). The label argument removes both.
    seed({ lastServerGraphHash: BASE_HASH })
    useCanvasStore.getState().addNode(undefined, 'option', 'Wait and see')

    expect((nodes()[0]!.data as { label?: string }).label).toBe('Wait and see')
    // ONE add intent...
    expect(queue()).toHaveLength(1)
    // ...and NO rename intent, because no rename happened.
    expect(useCanvasStore.getState().pendingStructuralRenames).toHaveLength(0)
  })

  it('TWIN — with no label supplied the pre-existing default still applies', () => {
    // The argument is OPTIONAL; a caller that does not name the node must keep
    // working exactly as before.
    seed({ lastServerGraphHash: BASE_HASH })
    useCanvasStore.getState().addNode(undefined, 'decision')
    expect((nodes()[0]!.data as { label?: string }).label).toMatch(/^Node /)
  })

  it('⭐⭐ THE CREATED NODE CARRIES NO VALUE — asserted at the store, not just at the wire', () => {
    seed({ lastServerGraphHash: BASE_HASH })
    useCanvasStore.getState().addNode(undefined, 'factor', 'Supplier risk')
    // The key SET, not spot checks: a spot check passes while a third key rides
    // along. This is the line that goes red if anyone ever "helpfully" seeds a
    // value here.
    expect(Object.keys(nodes()[0]!.data as object)).toEqual(['label'])
  })
})

describe('the lifecycle record — atomic, one at a time, terminal verdicts', () => {
  it('beginStructuralAddSend moves ONE intent from the queue into the lifecycle in one step', () => {
    seed({ lastServerGraphHash: BASE_HASH })
    useCanvasStore.getState().addNode(undefined, 'factor', 'A')
    useCanvasStore.getState().addNode(undefined, 'factor', 'B')
    expect(queue()).toHaveLength(2)

    const first = useCanvasStore.getState().beginStructuralAddSend()
    expect(first?.status).toBe('in_flight')
    // ⭐ THE GESTURE IS ALWAYS IN EXACTLY ONE PLACE. Taking the whole batch left
    // everything after the first in NEITHER the queue nor any record, so an
    // abort in that window destroyed the only evidence the attempt existed.
    expect(queue()).toHaveLength(1)
    expect(useCanvasStore.getState().structuralAddLifecycle).toHaveLength(1)
  })

  it('settleStructuralAdd is IDEMPOTENT — a terminal verdict is never downgraded', () => {
    seed({ lastServerGraphHash: BASE_HASH })
    useCanvasStore.getState().addNode(undefined, 'factor', 'A')
    const rec = useCanvasStore.getState().beginStructuralAddSend()!

    useCanvasStore.getState().settleStructuralAdd(rec.intent.id, 'committed')
    // The drain's every-exit fallback arrives late and must NOT rewrite this —
    // telling the user their saved node might not be saved is a lie in the
    // other direction.
    useCanvasStore.getState().settleStructuralAdd(rec.intent.id, 'unconfirmed')

    expect(useCanvasStore.getState().structuralAddLifecycle[0]!.status).toBe('committed')
  })

  it('⭐ applyStructuralAddRevert removes the node WITHOUT recording a delete', () => {
    seed({ lastServerGraphHash: BASE_HASH })
    useCanvasStore.getState().addNode(undefined, 'factor', 'A')
    const id = nodes()[0]!.id
    useCanvasStore.setState({ pendingStructuralDeletes: [] } as never)

    useCanvasStore.getState().applyStructuralAddRevert({ nodeId: id })

    expect(nodes()).toHaveLength(0)
    // ⚠ THE POINT OF A DEDICATED ACTION. `deleteNodeById` would record a
    // `structural_delete`, telling the server to remove a node it never held —
    // a second, false write chasing a refused first one.
    expect(useCanvasStore.getState().pendingStructuralDeletes).toHaveLength(0)
    // And the counter it raised is balanced again, so ordinary edits still emit.
    expect(useCanvasStore.getState()._externalMutationActive).toBe(0)
  })
})
