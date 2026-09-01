/**
 * `structuralRename` — capture, receipt and revert, each pinned directly.
 *
 * ⭐ WHY THESE ARE UNIT-PINNED RATHER THAN LEFT TO THE ROUTE SUITE. The
 * integration spec (`useConversation.structuralRenameOutcome.spec.ts`) measured
 * something worth writing down: on a 200 that carries a committed graph, TWO
 * mechanisms fire in order — this module's revert, and then
 * `reconcileAppliedGraph` ingesting the server's own bytes. The second wins, and
 * it is right that it wins. But that means the revert's own behaviour is
 * INVISIBLE through that path: it could be deleted entirely and the integration
 * assertions would still pass, because the graph ingest would land on the same
 * label.
 *
 * The revert is nonetheless load-bearing — it is the ONLY correction on the 409
 * arm, where CEE appends nothing and no graph comes back — so pinning it here is
 * what stops a guard that a newer mechanism has hidden from rotting into a
 * tautology. That is the same reasoning CEE's own writer gives for unit-pinning
 * `findStaleRenamedLabel` and friends: a guard nothing exercises through the
 * integration path must be tested where it can actually be observed.
 *
 * ⭐ AND EVERY PREDICATE HERE HAS ITS OPPOSITE-DIRECTION TWIN. A capture that
 * stands down too readily silently drops the user's durability; one that fires
 * too readily sends a turn asserting a state nobody read. A revert that fires
 * too readily discards the user's typing; one that fires too rarely leaves the
 * product lying. Each pair is written, because a corpus testing one direction is
 * a guard watching one door.
 */
import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'

import {
  captureStructuralRename,
  buildStructuralRenameWirePayload,
  resolveStructuralRenameBase,
  readStructuralRenameReceipt,
  revertStructuralRename,
  isWireUsableLabel,
  isWireUsableNodeId,
  type StructuralRenameIntent,
} from '../structuralRename'

const NODE_ID = 'fac_price'
const SIBLING_ID = 'fac_sibling'
const PREVIOUS = 'Price'
const NEW = 'List price'
const HASH = 'cfded3af0aa14ebd'

/** Two nodes, ONE label — so no value predicate can bind, only an id can. */
function nodes(overrides?: Record<string, unknown>): Node[] {
  return [
    {
      id: NODE_ID,
      type: 'factor',
      position: { x: 0, y: 0 },
      data: { label: PREVIOUS, kind: 'factor', ...overrides },
    },
    {
      id: SIBLING_ID,
      type: 'factor',
      position: { x: 100, y: 0 },
      data: { label: PREVIOUS, kind: 'factor' },
    },
  ] as unknown as Node[]
}

function capture(input: Partial<Parameters<typeof captureStructuralRename>[0]> = {}) {
  return captureStructuralRename({
    nodesBefore: nodes(),
    nodeId: NODE_ID,
    label: NEW,
    baseGraphHash: HASH,
    externalMutationActive: false,
    // Both fixture nodes are ones CEE has acknowledged — the default every test
    // in this file already assumed, made explicit when `authoritativeNodeIds`
    // arrived. These cases are about labels, hashes and producer writes; a
    // fixture whose node the server had never seen would stand them all down on
    // `node_not_server_held` and prove nothing about what they were written for.
    authoritativeNodeIds: [NODE_ID, SIBLING_ID],
    makeId: () => 'sr-1',
    ...input,
  })
}

function intent(over: Partial<StructuralRenameIntent> = {}): StructuralRenameIntent {
  return {
    id: 'sr-1',
    nodeId: NODE_ID,
    label: NEW,
    expectedLabel: PREVIOUS,
    baseGraphHash: HASH,
    restore: { label: PREVIOUS, provenanceWasPresent: false },
    ...over,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPTURE
// ═══════════════════════════════════════════════════════════════════════════

describe('captureStructuralRename', () => {
  it('captures expected_label from the PRE-rename node, bound by id', () => {
    const r = capture()
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.intent.nodeId).toBe(NODE_ID)
    expect(r.intent.expectedLabel).toBe(PREVIOUS)
    expect(r.intent.label).toBe(NEW)
    expect(r.intent.baseGraphHash).toBe(HASH)
  })

  it('records whether `provenance` was PRESENT — "absent" and "undefined" are different bytes', () => {
    const withProv = capture({ nodesBefore: nodes({ provenance: 'from_brief' }) })
    expect(withProv.ok).toBe(true)
    if (withProv.ok) {
      expect(withProv.intent.restore.provenanceWasPresent).toBe(true)
      expect(withProv.intent.restore.provenance).toBe('from_brief')
    }

    // TWIN: the key genuinely absent, which a `provenance: undefined` cannot
    // express and which the revert must reproduce exactly.
    const without = capture()
    expect(without.ok).toBe(true)
    if (without.ok) expect(without.intent.restore.provenanceWasPresent).toBe(false)
  })

  /**
   * ⚠⚠ THIS TEST WAS DELIBERATELY INVERTED, AND THE OLD ASSERTION WAS PINNING A
   * DEFECT. It read "STANDS DOWN with no server hash — never fabricates one" and
   * expected `reason: 'no_server_graph_hash'`. The "never fabricates one" half
   * was right and is kept below. The "stands down" half was the P0: the capture
   * dropped the gesture while `store.updateNodeLabel` applied the visible label
   * anyway, so the first rename after a restore looked saved and vanished on the
   * next reload. A missing base hash is NOT the end of the gesture — it is a
   * deferral until a turn stamps one. See `store.restoredGraphRename.spec.ts`.
   */
  it('DEFERS with no server hash — captured, flagged, and still never fabricating one', () => {
    const r = capture({ baseGraphHash: null })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.deferred).toBe(true)
      // The half of the old assertion that was always correct: no invented hash.
      expect(r.intent.baseGraphHash).toBeNull()
      expect(r.intent.expectedLabel).toBe(PREVIOUS)
    }
  })
  it('TWIN: a present hash captures and is NOT deferred', () => {
    const r = capture({ baseGraphHash: 'abc123' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.deferred).toBe(false)
      expect(r.intent.baseGraphHash).toBe('abc123')
    }
  })

  it('a deferred intent has NO wire payload until a hash resolves it', () => {
    const r = capture({ baseGraphHash: null })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(resolveStructuralRenameBase(r.intent, null)).toBeNull()

    const resolved = resolveStructuralRenameBase(r.intent, 'later0123456789a')
    expect(resolved).not.toBeNull()
    expect(buildStructuralRenameWirePayload(resolved!).base_graph_hash).toBe('later0123456789a')
  })

  it('TWIN: resolution never OVERWRITES a hash the gesture already captured', () => {
    const r = capture({ baseGraphHash: 'atgesture000000a' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // The gesture-time hash asserts the graph the user was looking at, which is
    // strictly better evidence than "whatever is current now".
    const resolved = resolveStructuralRenameBase(r.intent, 'much0newer00000b')
    expect(resolved!.baseGraphHash).toBe('atgesture000000a')
  })

  it('STANDS DOWN on a producer write — a server rename echoed back is not a user gesture', () => {
    const r = capture({ externalMutationActive: true })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('external_mutation')
  })
  it('TWIN: a user gesture captures', () => {
    expect(capture({ externalMutationActive: false }).ok).toBe(true)
  })

  it('STANDS DOWN on a no-op — the contract refuses `label === expected_label`', () => {
    const r = capture({ label: PREVIOUS })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('no_change')
  })
  it('TWIN: a one-character difference captures', () => {
    expect(capture({ label: `${PREVIOUS}s` }).ok).toBe(true)
  })

  it('STANDS DOWN when the node is not on the canvas', () => {
    const r = capture({ nodeId: 'fac_missing' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('node_not_found')
  })

  it('STANDS DOWN when the PREVIOUS label is unusable on the wire (empty), rather than sending a 422', () => {
    const r = capture({ nodesBefore: nodes({ label: '' }) })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('unusable_for_wire')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// WIRE PAYLOAD
// ═══════════════════════════════════════════════════════════════════════════

describe('buildStructuralRenameWirePayload', () => {
  it('maps to the CONTRACT field names, in one place', () => {
    // Through the resolver: the builder accepts only a RESOLVED intent, so a
    // deferred one cannot reach the wire by forgetting to check a flag.
    expect(buildStructuralRenameWirePayload(resolveStructuralRenameBase(intent(), HASH)!)).toEqual({
      node_id: NODE_ID,
      label: NEW,
      expected_label: PREVIOUS,
      base_graph_hash: HASH,
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// BOUND PREDICATES — both directions, because narrowing here refuses live nodes
// ═══════════════════════════════════════════════════════════════════════════

describe('wire-usability predicates', () => {
  it('rejects blank, padded and composite ids', () => {
    expect(isWireUsableNodeId('')).toBe(false)
    expect(isWireUsableNodeId(' fac_a ')).toBe(false)
    expect(isWireUsableNodeId('a→b')).toBe(false)
    expect(isWireUsableNodeId('a->b')).toBe(false)
  })
  it('TWIN: accepts the open-string ids CEE actually persists — uppercase, dashes, UUIDs', () => {
    expect(isWireUsableNodeId('Opt_Wait')).toBe(true)
    expect(isWireUsableNodeId('9f0c1c8e-2f4b-4a9d-9d7e-1c2b3a4d5e6f')).toBe(true)
  })
  it('rejects labels outside the contract bound (0 and 201)', () => {
    expect(isWireUsableLabel('')).toBe(false)
    expect(isWireUsableLabel('x'.repeat(201))).toBe(false)
  })
  it('TWIN: accepts both inclusive endpoints (1 and 200)', () => {
    expect(isWireUsableLabel('x')).toBe(true)
    expect(isWireUsableLabel('x'.repeat(200))).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// RECEIPT — three states, never two
// ═══════════════════════════════════════════════════════════════════════════

describe('readStructuralRenameReceipt', () => {
  const graph = (label: string) => ({
    draft_graph: {
      nodes: [
        { id: NODE_ID, label },
        // The sibling carries OUR label throughout, so a reader that matched by
        // label rather than by id would read `proven` on every case below.
        { id: SIBLING_ID, label: NEW },
      ],
      edges: [],
    },
  })

  it('PROVEN when the committed bytes hold this id at this label', () => {
    expect(readStructuralRenameReceipt(intent(), graph(NEW))).toBe('proven')
  })
  it('REFUTED when the committed bytes hold this id at a DIFFERENT label', () => {
    expect(readStructuralRenameReceipt(intent(), graph('Someone else’s name'))).toBe('refuted')
  })
  it('REFUTED even when a SIBLING carries our label — bound by id, not by value', () => {
    expect(readStructuralRenameReceipt(intent(), graph(PREVIOUS))).toBe('refuted')
  })
  it('UNPROVEN with no draft_graph — silence is not a verdict', () => {
    expect(readStructuralRenameReceipt(intent(), {})).toBe('unproven')
  })
  it('UNPROVEN when the node is ABSENT — that is a concurrent DELETE, a different event', () => {
    expect(
      readStructuralRenameReceipt(intent(), { draft_graph: { nodes: [], edges: [] } }),
    ).toBe('unproven')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// REVERT — pinned here because the integration path hides it (see the header)
// ═══════════════════════════════════════════════════════════════════════════

describe('revertStructuralRename', () => {
  function store(nodeList: Node[], scenarioId: string | null = 's1') {
    const calls: unknown[] = []
    return {
      calls,
      store: {
        nodes: nodeList,
        currentScenarioId: scenarioId,
        applyStructuralRenameRevert: (r: unknown) => calls.push(r),
      },
    }
  }
  /** The canvas AFTER the optimistic rename — both nodes on the NEW label. */
  const postRename = () =>
    [
      { id: NODE_ID, data: { label: NEW, provenance: 'user_set' } },
      { id: SIBLING_ID, data: { label: NEW } },
    ] as unknown as Node[]

  it('RESTORES the previous label when the node still holds the label we sent', () => {
    const h = store(postRename())
    expect(revertStructuralRename(intent(), h.store, 's1')).toBe('restored')
    expect(h.calls).toEqual([
      { nodeId: NODE_ID, label: PREVIOUS, provenanceWasPresent: false },
    ])
  })

  it('RESTORES THE PROVENANCE TOO when one was captured — a refused rename must not leave a goal claiming the user authored its label', () => {
    const h = store(postRename())
    const i = intent({ restore: { label: PREVIOUS, provenance: 'from_brief', provenanceWasPresent: true } })
    expect(revertStructuralRename(i, h.store, 's1')).toBe('restored')
    expect(h.calls).toEqual([
      { nodeId: NODE_ID, label: PREVIOUS, provenance: 'from_brief', provenanceWasPresent: true },
    ])
  })

  it('STANDS DOWN when the scenario has moved on — restoring would write into a decision this gesture never described', () => {
    const h = store(postRename())
    expect(revertStructuralRename(intent(), h.store, 'a-different-scenario')).toBe('stood_down')
    expect(h.calls).toHaveLength(0)
  })

  it('STANDS DOWN when the user has renamed AGAIN — newer truth is not overwritten', () => {
    const h = store([{ id: NODE_ID, data: { label: 'A third name' } }] as unknown as Node[])
    expect(revertStructuralRename(intent(), h.store, 's1')).toBe('stood_down')
    expect(h.calls).toHaveLength(0)
  })

  it('reports ALREADY_PREVIOUS rather than writing when the node is already back', () => {
    const h = store([{ id: NODE_ID, data: { label: PREVIOUS } }] as unknown as Node[])
    expect(revertStructuralRename(intent(), h.store, 's1')).toBe('already_previous')
    expect(h.calls).toHaveLength(0)
  })

  it('STANDS DOWN when the node is gone — a concurrent delete is not ours to undo', () => {
    const h = store([{ id: SIBLING_ID, data: { label: NEW } }] as unknown as Node[])
    expect(revertStructuralRename(intent(), h.store, 's1')).toBe('stood_down')
    expect(h.calls).toHaveLength(0)
  })
})
