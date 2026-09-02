/**
 * ONE GESTURE, ONE TURN — asserted against the REAL QUEUE STATE after a REAL
 * `addNode`, not against a constructed array.
 *
 * ⭐⭐⭐ THIS FILE EXISTS BECAUSE ITS SIBLING COULD NOT SEE THE DEFECT IT WAS
 * WRITTEN TO PREVENT. `graphEditEvents.structuralAddSubtraction.spec.ts` imports
 * `removeStructuralAddClaims`, hands it hand-built diffs and hand-built claim
 * arrays, and proves the function is correct. It is. **What it never asked is
 * whether the function ever RECEIVES a populated array** — and it did not.
 *
 * A guard fed its own fixtures agrees with itself. The only assertion that can
 * see this class of defect is one that drives the real store action and reads
 * what the real subscriber actually emitted, which is what every test below
 * does.
 *
 * ── THE DEFECT, AND WHY IT IS AN INHERITANCE RATHER THAN A TYPO ─────────────
 *
 * `useGraphEditEvents` subscribes to the store. `store.addNode` originally wrote
 * the node in one `set()` and captured its durable intent in a LATER one. The
 * subscriber therefore fired on the FIRST `set()`, read `pendingStructuralAdds`
 * as EMPTY, accumulated the add and advanced its snapshot — so by the time the
 * queue was populated the diff had already been taken and the subtraction never
 * got a second chance. `structural_add` AND `direct_graph_edit` both went out
 * for one gesture, and the notification half is the `'ack_and_commit'` path
 * (turn row, NO graph write) the durable verb exists to replace.
 *
 * ⚠⚠ THE CAUSE IS WORTH MORE THAN THE FIX, AND IT IS A TRAP-21 SHAPE. The
 * DELETE twin captures BEFORE its mutation — its own comment says so in terms,
 * "Writes in its OWN `set()`, ahead of the removal's, so `useGraphEditEvents`
 * sees a populated queue when it diffs the removal". The ADD twin must capture
 * AFTER, because its subject does not exist until the node does. That inversion
 * is correct. **The subtraction was then inherited WITHOUT inverting with it** —
 * two mechanisms answering different questions under one shared helper, which is
 * exactly the shape that reads as consistency and is not.
 *
 * The resolution is that `addNode` now writes the node and its intent in ONE
 * `set()`, so "capture after the node exists" and "the queue is visible to the
 * subscriber's first observation" are both true at once. **The ordering
 * dependency is named at the store action and at the subtraction helper**, so
 * the next person to touch either finds it.
 *
 * ⚠ BLAST RADIUS TODAY IS BOUNDED BY FLAG POSTURE, NOT BY DESIGN.
 * `useGraphEditEvents` sits in `KNOWN_DARK_DRAINS` with no flag-on host, so the
 * second turn cannot currently reach the wire. That is a reason this was not a
 * live P0; it is NOT a reason to leave it, because the moment that flag moves it
 * ships the double-emit — the precise defect this lane rejected #1114 for.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Node } from '@xyflow/react'

import { useGraphEditEvents } from '../useGraphEditEvents'
import { useCanvasStore } from '../../store'

// `importOriginal`-spread rather than a hand-listed factory: a `vi.mock` factory
// REPLACES the module, so every flag not listed would silently vanish and throw
// at collection (CLAUDE.md trap 12).
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return { ...actual, isOrchestratorV2Enabled: () => true, isJourneyTabEnabled: () => false }
})

const HASH = 'f3d31f75957c5cb5'
const send = vi.fn().mockResolvedValue(undefined)

/**
 * ⚠ EVERY RENDERED SUBSCRIBER IS UNMOUNTED IN `afterEach`, AND THAT IS AN
 * INSTRUMENT REQUIREMENT RATHER THAN TIDINESS. `useGraphEditEvents` installs a
 * store subscription and a 1.5 s debounce. A hook left mounted by one test keeps
 * accumulating the NEXT test's mutations and flushes them into its own closure,
 * so the later test reads an EMPTY call list and "passes" a suppression claim it
 * never tested. That is exactly the vacuity this file exists to catch, and it
 * cost one debugging cycle here before being pinned.
 */
const mounted: Array<{ unmount: () => void }> = []
function mountSubscriber() {
  const h = renderHook(() => useGraphEditEvents(send))
  mounted.push(h)
  return h
}

function node(id: string): Node {
  return { id, type: 'factor', position: { x: 0, y: 0 }, data: { label: id } }
}

function seed(hash: string | null) {
  useCanvasStore.setState({
    currentScenarioId: 's1',
    nodes: [node('goal'), node('option_a')],
    edges: [],
    selection: { nodeIds: new Set<string>(), edgeIds: new Set<string>(), anchorPosition: null },
    lastServerGraphHash: hash,
    pendingStructuralAdds: [],
    pendingStructuralDeletes: [],
    structuralAddLifecycle: [],
    _externalMutationActive: 0,
    history: { past: [], future: [] },
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
  // Unmount BEFORE restoring real timers, so each test's subscription and its
  // pending debounce die with it rather than accumulating the next test's
  // mutations.
  while (mounted.length > 0) mounted.pop()!.unmount()
  vi.useRealTimers()
})

describe('a claimed add does not ALSO ride the debounced notification', () => {
  it('⭐⭐ an add carried by structural_add emits NO direct_graph_edit at all', () => {
    seed(HASH)
    mountSubscriber()
    act(() => {
      useCanvasStore.getState().addNode(undefined, 'factor', 'Supplier risk')
    })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    // ⚠ THE ASSERTION IS ON WHAT THE REAL SUBSCRIBER EMITTED. Before the
    // ordering fix this emitted one call carrying `operations: ['add']`, while
    // the delete twin under identical treatment emits none.
    expect(graphEditCalls()).toHaveLength(0)
  })

  it('POSITIVE CONTROL — the queue really is populated by that same gesture', () => {
    // ⚠ WITHOUT THIS, THE TEST ABOVE PASSES VACUOUSLY IF `addNode` EVER STOPS
    // CAPTURING AT ALL: no intent, no notification either, and a silent product.
    // An absence assertion is worthless until it has been shown it can see a
    // presence (CLAUDE.md trap 13).
    seed(HASH)
    mountSubscriber()
    act(() => {
      useCanvasStore.getState().addNode(undefined, 'factor', 'Supplier risk')
    })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    const queued = useCanvasStore.getState().pendingStructuralAdds
    expect(queued).toHaveLength(1)
    expect(queued[0]!.label).toBe('Supplier risk')
  })

  it('⭐ CONTRAST CONTROL — an UNCLAIMED add in the same window IS still reported', () => {
    // Proves the suppression is the CLAIM's doing and not the notification hook
    // having quietly stopped emitting. A gesture that added A while a producer
    // added B must still report B.
    seed(HASH)
    mountSubscriber()
    let claimedId = ''
    act(() => {
      useCanvasStore.getState().addNode(undefined, 'factor', 'Supplier risk')
      claimedId = useCanvasStore.getState().pendingStructuralAdds[0]!.nodeId
      // A producer-side add that no intent ever claimed.
      useCanvasStore.setState({
        nodes: [...useCanvasStore.getState().nodes, node('factor_from_server')],
      } as never)
    })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    const calls = graphEditCalls()
    expect(calls).toHaveLength(1)
    const payload = (calls[0]![0] as { payload: { changed_node_ids: string[]; operations: string[] } })
      .payload
    // ⚠ BOUND BY IDENTITY, and asserted as the WHOLE set rather than by
    // `toContain`. The payload carries node IDS, not labels — an earlier draft
    // of this line searched the serialised payload for the LABEL 'Supplier
    // risk', which no notification ever contains, so it passed without testing
    // anything. A vacuous assertion inside the file written to catch vacuity.
    expect(payload.changed_node_ids).toEqual(['factor_from_server'])
    expect(payload.changed_node_ids).not.toContain(claimedId)
    // …and the op set is RE-DERIVED, so no stale entry survives the subtraction.
    expect(payload.operations).toEqual(['add'])
  })

  it('⭐ TWIN — a USER add that stood down from capture is STILL reported in full', () => {
    // ⚠ THE STAND-DOWN HAS TO BE A USER GESTURE, AND GETTING THAT WRONG COST A
    // DEBUGGING CYCLE HERE. My first version used a PRODUCER write
    // (`_externalMutationActive > 0`) and asserted the notification still
    // fired — it does not, and correctly so: `useGraphEditEvents` suppresses the
    // whole diff on that flag at `useGraphEditEvents.ts:246`, long before any
    // claim subtraction. That path is governed by a DIFFERENT mechanism, so
    // asserting my subtraction's behaviour through it was measuring the wrong
    // thing (CLAUDE.md trap 21 again, one level down).
    //
    // A `constraint` add is the honest fixture: a real user gesture whose
    // capture stands down because CEE cannot PERSIST that kind, so no intent is
    // claimed and the pre-0.50.0 notification must still carry it. The fallback
    // is preserved, not replaced.
    seed(HASH)
    mountSubscriber()
    act(() => {
      useCanvasStore.getState().addNode(undefined, 'constraint', 'Budget cap')
    })
    // PRECONDITION PINNED IN-TEST (trap 13b): nothing was claimed, so a green
    // result below is the subtraction standing down and not the fixture failing
    // to produce an add at all.
    expect(useCanvasStore.getState().pendingStructuralAdds).toHaveLength(0)
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(graphEditCalls()).toHaveLength(1)
  })
})
