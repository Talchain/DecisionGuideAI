/**
 * The rename gesture reaches the wire — from the store action a user's keystroke
 * lands on, to the exact payload CEE receives.
 *
 * ⭐⭐ WHY THIS SPEC EXISTS AT ALL: A WRITE THAT IS NOT READ BACK IS THE DEFECT
 * THIS WHOLE LANE CLOSES. Before 0.50.0 a canvas rename applied locally, went to
 * CEE as a `direct_graph_edit` NOTIFICATION ('ack_and_commit' — a turn row and
 * NO graph write), and vanished on the next reload. Every UI test still passed,
 * because nothing asserted what reached the wire. So the assertions below are
 * about the PAYLOAD and the QUEUE, not about the canvas: the canvas was never
 * the thing that was wrong.
 *
 * ⚠ AND THE CAPTURE POINT IS THE CLAIM. `store.updateNodeLabel` is the one
 * chokepoint every rename gesture crosses — the inspector title, the canvas
 * double-click (`requestNodeRename`), the pre-analysis hero, and
 * `YourDecisionSection`. Capturing at any single call site would have left the
 * others silent, which is precisely how `StructuralDeleteDrainHost`'s header
 * records its own capability shipping dark under a green suite.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { Node } from '@xyflow/react'

import { useCanvasStore } from '../store'
import {
  buildStructuralRenameWirePayload,
  resolveStructuralRenameBase,
} from '../mutations/structuralRename'

const NODE_ID = 'fac_price'
const SIBLING_ID = 'fac_sibling'
const GOAL_ID = 'goal_revenue'
const PREVIOUS = 'Price'
const NEW = 'List price'
const HASH = 'cfded3af0aa14ebd'

function seed(hash: string | null = HASH) {
  useCanvasStore.setState({
    currentScenarioId: 's1',
    lastServerGraphHash: hash,
    pendingStructuralRenames: [],
    _externalMutationActive: 0,
    nodes: [
      // Same label on two nodes — no value predicate can bind, only an id can.
      { id: NODE_ID, type: 'factor', position: { x: 0, y: 0 }, data: { label: PREVIOUS, kind: 'factor' } },
      { id: SIBLING_ID, type: 'factor', position: { x: 9, y: 0 }, data: { label: PREVIOUS, kind: 'factor' } },
      {
        id: GOAL_ID,
        type: 'goal',
        position: { x: 0, y: 9 },
        data: { label: 'Grow revenue', kind: 'goal', provenance: 'from_brief' },
      },
    ] as unknown as Node[],
    edges: [],
  } as never)
}

// ⚠ `beforeEach(() => seed())`, NEVER `beforeEach(seed)`. Vitest passes its
// context object as the first argument, which would land in `hash` — a truthy
// non-string that no capture can read as a base, so every gesture would be
// captured DEFERRED and every payload assertion would fail on a null base. The
// suite then reports a working feature as broken, and it took a probe rather
// than inspection to see it. (Trap 13's shape, reached through arity.)
//
// ⚠ The failure mode used to be a stand-down on `no_server_graph_hash`; that
// reason no longer exists (a missing base is now a deferral, not a refusal), so
// the symptom moved. The arity hazard did not — hence the corrected wording
// rather than a deleted warning.
beforeEach(() => seed())

describe('a rename gesture becomes exactly one wire intent', () => {
  it('queues an intent whose expected_label is the PRE-rename label, not the one just written', () => {
    useCanvasStore.getState().updateNodeLabel(NODE_ID, NEW)
    const queued = useCanvasStore.getState().pendingStructuralRenames
    expect(queued).toHaveLength(1)

    // ⭐ THE ORDERING CLAIM. Reading `expected_label` after the local write would
    // assert the label we just wrote — which can never match the server, turning
    // the concurrency gate into a tautology that fires on every rename.
    expect(queued[0]!.expectedLabel).toBe(PREVIOUS)
    expect(queued[0]!.label).toBe(NEW)
    expect(queued[0]!.nodeId).toBe(NODE_ID)
  })

  it('the wire payload is exactly the four contract fields', () => {
    useCanvasStore.getState().updateNodeLabel(NODE_ID, NEW)
    const intent = useCanvasStore.getState().pendingStructuralRenames[0]!
    // Routed through the resolver deliberately: since a deferred intent carries a
    // null base, the wire builder accepts only a RESOLVED intent, and this is the
    // one path to one. The compiler refuses the shortcut, which is the point.
    const resolved = resolveStructuralRenameBase(intent, HASH)!
    expect(buildStructuralRenameWirePayload(resolved)).toEqual({
      node_id: NODE_ID,
      label: NEW,
      expected_label: PREVIOUS,
      base_graph_hash: HASH,
    })
  })

  it('`takePendingStructuralRenames` is one ATOMIC read-and-clear — a re-drain cannot re-send', () => {
    useCanvasStore.getState().updateNodeLabel(NODE_ID, NEW)
    expect(useCanvasStore.getState().takePendingStructuralRenames()).toHaveLength(1)
    expect(useCanvasStore.getState().takePendingStructuralRenames()).toHaveLength(0)
    expect(useCanvasStore.getState().pendingStructuralRenames).toHaveLength(0)
  })

  it('the LOCAL rename still applies — bound by id, so the same-labelled sibling is untouched', () => {
    useCanvasStore.getState().updateNodeLabel(NODE_ID, NEW)
    const nodes = useCanvasStore.getState().nodes
    const labelOf = (id: string) =>
      (nodes.find((n) => n.id === id)?.data as { label?: string } | undefined)?.label
    expect(labelOf(NODE_ID)).toBe(NEW)
    expect(labelOf(SIBLING_ID)).toBe(PREVIOUS)
  })
})

describe('the provenance stamp is honoured, not re-decided', () => {
  it('a GOAL rename clears the "from your brief" claim — the user has now authored the label', () => {
    useCanvasStore.getState().updateNodeLabel(GOAL_ID, 'Double revenue by Q4')
    const goal = useCanvasStore.getState().nodes.find((n) => n.id === GOAL_ID)
    expect((goal?.data as { provenance?: unknown } | undefined)?.provenance).toBe('user_set')
  })

  it('OPPOSITE TWIN — a FACTOR rename leaves `provenance` alone, because there it answers who owns the VALUE', () => {
    useCanvasStore.setState({
      nodes: [
        {
          id: NODE_ID,
          type: 'factor',
          position: { x: 0, y: 0 },
          data: { label: PREVIOUS, kind: 'factor', provenance: 'ai_inferred' },
        },
      ] as unknown as Node[],
    } as never)
    useCanvasStore.getState().updateNodeLabel(NODE_ID, NEW)
    const node = useCanvasStore.getState().nodes.find((n) => n.id === NODE_ID)
    // Stamping `user_set` here would credit the user with a number Olumi
    // estimated — the exact conflation `goalLabelProvenance.ts` exists to stop.
    expect((node?.data as { provenance?: unknown } | undefined)?.provenance).toBe('ai_inferred')
  })

  it('the intent carries the PREVIOUS provenance, so a refusal can put the pill back', () => {
    useCanvasStore.getState().updateNodeLabel(GOAL_ID, 'Double revenue by Q4')
    const intent = useCanvasStore.getState().pendingStructuralRenames[0]!
    expect(intent.restore.provenanceWasPresent).toBe(true)
    expect(intent.restore.provenance).toBe('from_brief')
  })
})

describe('what must NOT reach the wire', () => {
  it('a PRODUCER write (hydration / patch apply) queues nothing — CEE\'s own rename is not a user gesture', () => {
    useCanvasStore.setState({ _externalMutationActive: 1 } as never)
    useCanvasStore.getState().updateNodeLabel(NODE_ID, NEW)

    expect(useCanvasStore.getState().pendingStructuralRenames).toHaveLength(0)
    // TWIN, and the point of the pair: the LOCAL write still happens. A producer
    // write that failed to apply would be a far worse defect than a missing
    // turn — the canvas would stop reflecting the server.
    const node = useCanvasStore.getState().nodes.find((n) => n.id === NODE_ID)
    expect((node?.data as { label?: string } | undefined)?.label).toBe(NEW)
  })

  /**
   * ⚠⚠ REWRITTEN DELIBERATELY — THE OLD ASSERTION HERE WAS PINNING THE DEFECT,
   * and it is worth recording exactly how, because the test read as careful.
   *
   * It asserted `pendingStructuralRenames` was EMPTY and the label applied
   * anyway, and defended that as "the deliberate asymmetry with the delete
   * twin". Half of that reasoning is still right and is kept: an unsent rename
   * is a local display name, which is what the product did for its whole history
   * before 0.50.0, so BLOCKING it would be a regression bought for tidiness.
   *
   * ⭐ But the test answered only ONE of the two questions in front of it, and
   * silently gave the other the wrong answer:
   *   Q1 "should a rename be blocked when it cannot be committed?"  — No. Kept.
   *   Q2 "may the product SHOW a rename as saved when it knows it is not?" — No,
   *      and nothing asked it. The combination the old test blessed is the worst
   *      one available: the carrier exists, the capture bails, and the canvas
   *      shows the name regardless.
   *
   * Both are now answered: the gesture is DEFERRED rather than dropped (the next
   * turn stamps a real base hash and sends it), and the user is told where it
   * stands meanwhile. The full journey lives in `store.restoredGraphRename.spec.ts`.
   */
  it('with NO server hash the rename is DEFERRED, not dropped — and never carries a fabricated hash', () => {
    seed(null)
    useCanvasStore.getState().updateNodeLabel(NODE_ID, NEW)

    const queued = useCanvasStore.getState().pendingStructuralRenames
    expect(queued).toHaveLength(1)
    expect(queued[0]!.nodeId).toBe(NODE_ID)
    // The half of the old assertion that was always correct: nothing invented.
    expect(queued[0]!.baseGraphHash).toBeNull()

    // ⚠ AND IT IS STILL NOT BLOCKED, which remains the deliberate asymmetry with
    // the delete twin. An unsent DELETE makes the product contradict itself on
    // the next re-run (the option comes back), so that lane refuses the local
    // removal. A rename applies and tells the truth about its durability.
    const node = useCanvasStore.getState().nodes.find((n) => n.id === NODE_ID)
    expect((node?.data as { label?: string } | undefined)?.label).toBe(NEW)
  })

  it('a no-op rename queues nothing — the contract refuses `label === expected_label`', () => {
    useCanvasStore.getState().updateNodeLabel(NODE_ID, PREVIOUS)
    expect(useCanvasStore.getState().pendingStructuralRenames).toHaveLength(0)
  })
})
