/**
 * A SCENARIO SWITCH MUST NOT LEAVE THE PREVIOUS SCENARIO'S ELEMENT-IDENTITY
 * RECORD IN PLACE.
 *
 * `lastAuthoritativeGraph` (store.ts:685) records "the elements CEE has
 * acknowledged for THIS scenario". `store.loadScenario` — the localStorage
 * switch leg — installed the new scenario's nodes and `currentScenarioId` and
 * never touched it, and it does not spread `DECISION_CONTEXT_CLEAR`. So after
 * A -> B the record still described A while the canvas showed B.
 *
 * ── WHY THAT IS DATA LOSS AND NOT AN UNTIDINESS ─────────────────────────────
 * The record's one MEMBERSHIP consumer is the applied-edit reconciler
 * (`mergeAppliedGraph.ts:477-484`): it removes a canvas node only when the node
 * is IN the record and ABSENT from the receipt. Membership AUTHORISES a
 * deletion. An over-broad record therefore authorises deleting a node of B's
 * that CEE never held — which is exactly the harm `DECISION_CONTEXT_CLEAR`'s
 * own comment names (store.ts:1656): "element identities are graph-specific. A
 * previous scenario's set would authorise deleting same-id nodes in the newly
 * loaded graph."
 *
 * And the collision is the NORMAL case, not a contrivance. Canvas node ids are
 * sequential integer strings (`createNodeId` -> `String(nextNodeId)`), and
 * `store.reseedIds` (store.ts:2487) sets `nextNodeId = max(maxLoadedId + 1, 5)`
 * from the LOADED graph alone. Two scenarios of different sizes reissue the
 * same ids by construction. The fixtures below let the REAL producers mint the
 * colliding id rather than asserting one I chose — and the collision is pinned
 * in-test as a precondition, so these tests cannot pass because the fixture
 * quietly stopped colliding (CLAUDE.md trap 13b).
 *
 * ── WHY THE FIX SEEDS RATHER THAN CLEARS ────────────────────────────────────
 * `null` and empty are NOT interchangeable here. `null` means "no evidence";
 * an empty record means "evidence that this scenario holds nothing". Three
 * consumers read EXISTENCE, not membership — `ownsServerGraph` (store.ts:1900,
 * 2002) and `graphAcceptedForCanvas`
 * (`useProvisionalAnalysisDelivery.ts:313`) — and they discriminate the two.
 * The sibling leg of this very gesture (`useScenario.loadScenario` ->
 * `hydrateGraphSlice`, store.ts:6675) records the loaded graph's FULL identity,
 * and so does the boot arbiter's other branch. Clearing to `null` here would
 * leave one branch of one gesture unable to reconcile a deletion until a second
 * receipt arrived, for no reason a user could see. So: proven full identity.
 *
 * The opposite-direction twin (third test) is what stops that being bought
 * cheaply — it fails if anyone "fixes" this by writing `null` or an empty
 * record.
 *
 * Every assertion binds by IDENTITY (named node ids), never by a count or a
 * predicate another node could satisfy.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../store'
import { createScenario, getScenario } from '../store/scenarios'
import { reconcileAppliedGraph } from '../utils/mergeAppliedGraph'
import { edgePairKey } from '../utils/graphIdentity'

const LS_KEYS = [
  'olumi-canvas-scenarios',
  'olumi-canvas-autosave',
  'olumi-canvas-current-scenario-id',
  'olumi-canvas-run-history',
]

function goalNode(id: string, label: string) {
  return {
    id,
    type: 'goal',
    position: { x: 0, y: 0 },
    data: { kind: 'goal', label },
  } as never
}

function factorNode(id: string, label: string) {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 100 },
    data: { kind: 'factor', label },
  } as never
}

function edge(id: string, source: string, target: string) {
  return {
    id,
    source,
    target,
    type: 'styled',
    data: { weight: 0.5, direction: 'positive' },
  } as never
}

/**
 * A: goal '1', factor '2', factor '5'.
 * B: goal '1', factor '2'  — deliberately SMALLER, so B's `reseedIds` floor
 *    (max(2+1, 5) = 5) makes the next node B mints take the id '5', which is
 *    the id A's record holds and B's server graph does not. `createScenario`
 *    deep-clones and does NOT reseed, so these ids reach localStorage verbatim.
 */
const A_ONLY_NODE_ID = '5'
const SHARED_GOAL_ID = '1'
const SHARED_FACTOR_ID = '2'

function makeScenarioA() {
  return createScenario({
    name: 'Scenario A',
    nodes: [
      goalNode(SHARED_GOAL_ID, 'A revenue'),
      factorNode(SHARED_FACTOR_ID, 'A spend'),
      factorNode(A_ONLY_NODE_ID, 'A headcount'),
    ],
    edges: [edge('e1', SHARED_FACTOR_ID, SHARED_GOAL_ID), edge('e2', A_ONLY_NODE_ID, SHARED_GOAL_ID)],
  })
}

function makeScenarioB() {
  return createScenario({
    name: 'Scenario B',
    nodes: [goalNode(SHARED_GOAL_ID, 'B revenue'), factorNode(SHARED_FACTOR_ID, 'B spend')],
    edges: [edge('e1', SHARED_FACTOR_ID, SHARED_GOAL_ID)],
  })
}

beforeEach(() => {
  for (const k of LS_KEYS) localStorage.removeItem(k)
  useCanvasStore.getState().reset()
  // ⚠ `reset()` does NOT clear this field (store.ts:3970 applies no
  // DECISION_CONTEXT_CLEAR and does not list it), so leaving it to the reset
  // would let one test's record leak into the next and make the switch tests
  // pass for the wrong reason.
  useCanvasStore.getState().setLastAuthoritativeGraph(null)
})

describe('store.loadScenario — the element-identity record is per-scenario', () => {
  it('records the LOADED scenario A, by identity, on the first load', () => {
    const a = makeScenarioA()

    expect(useCanvasStore.getState().loadScenario(a.id)).toBe(true)
    expect(useCanvasStore.getState().currentScenarioId).toBe(a.id)

    const record = useCanvasStore.getState().lastAuthoritativeGraph
    expect(record).not.toBeNull()
    expect(record?.nodeIds).toEqual([SHARED_GOAL_ID, SHARED_FACTOR_ID, A_ONLY_NODE_ID])
    expect(record?.edgePairs).toEqual([
      edgePairKey(SHARED_FACTOR_ID, SHARED_GOAL_ID),
      edgePairKey(A_ONLY_NODE_ID, SHARED_GOAL_ID),
    ])
  })

  it("replaces A's record with B's on a switch — A's own node id is gone", () => {
    const a = makeScenarioA()
    const b = makeScenarioB()

    expect(useCanvasStore.getState().loadScenario(a.id)).toBe(true)
    // Precondition, pinned in-test: A's record really does hold the id that B
    // will later mint locally. Without this the switch assertion below could
    // pass because the fixture stopped overlapping.
    expect(useCanvasStore.getState().lastAuthoritativeGraph?.nodeIds).toContain(A_ONLY_NODE_ID)

    expect(useCanvasStore.getState().loadScenario(b.id)).toBe(true)
    expect(useCanvasStore.getState().currentScenarioId).toBe(b.id)

    const record = useCanvasStore.getState().lastAuthoritativeGraph
    expect(record).not.toBeNull()
    expect(record?.nodeIds).toEqual([SHARED_GOAL_ID, SHARED_FACTOR_ID])
    expect(record?.nodeIds).not.toContain(A_ONLY_NODE_ID)
    expect(record?.edgePairs).toEqual([edgePairKey(SHARED_FACTOR_ID, SHARED_GOAL_ID)])
    expect(record?.edgePairs).not.toContain(edgePairKey(A_ONLY_NODE_ID, SHARED_GOAL_ID))
  })

  it('records an EMPTY scenario as an empty record, never as null', () => {
    // The two are not interchangeable: `null` says "no evidence", an empty
    // record says "evidence that this scenario holds nothing", and the
    // existence consumers (store.ts:1900, 2002;
    // useProvisionalAnalysisDelivery.ts:313) read the difference. This mirrors
    // `hydrateGraphSlice` (store.ts:6675), whose `if (loaded.nodes ||
    // loaded.edges)` guard is satisfied by an empty array.
    const empty = createScenario({ name: 'Empty', nodes: [], edges: [] })

    expect(useCanvasStore.getState().loadScenario(empty.id)).toBe(true)

    const record = useCanvasStore.getState().lastAuthoritativeGraph
    expect(record).not.toBeNull()
    expect(record).toEqual({ nodeIds: [], edgePairs: [] })
  })
})

describe("store.loadScenario — the reconciler after a switch (the harm, at the live consumer)", () => {
  /**
   * Drives the REAL producers end to end: A receives a genuine applied-edit
   * receipt (which is what makes its record non-null in production — writer
   * `mergeAppliedGraph.ts:606`), the user switches to B, and the store mints a
   * new node id for B through `createNodeId`/`reseedIds`. A fixture I wrote
   * myself would only encode my model of the id space (CLAUDE.md trap
   * 16-inverse); here both the record and the colliding id are the product's
   * own.
   *
   * ⚠ A's record is deliberately NOT sourced from `loadScenario`'s own seed.
   * If it were, this reproduction would be a statement about the fix rather
   * than about the defect, and it would go red under a mutant that broke the
   * seed for A alone — which must leave these assertions green.
   */
  function switchToBAndAddLocalNode(): { bId: string; localNodeId: string } {
    const a = makeScenarioA()
    const b = makeScenarioB()

    const aPersistedNodeIds = (getScenario(a.id)?.graph.nodes ?? []).map((n) => n.id)

    useCanvasStore.getState().loadScenario(a.id)
    // A receipt for A's own graph. This is how A's record legitimately becomes
    // non-null: CEE acknowledged exactly these elements, for THIS scenario.
    reconcileAppliedGraph({
      nodes: [
        { id: SHARED_GOAL_ID, kind: 'goal', label: 'A revenue' },
        { id: SHARED_FACTOR_ID, kind: 'factor', label: 'A spend' },
        { id: A_ONLY_NODE_ID, kind: 'factor', label: 'A headcount' },
      ],
      edges: [{ id: 'e1', from: SHARED_FACTOR_ID, to: SHARED_GOAL_ID, weight: 0.5 }],
    } as never)
    expect(useCanvasStore.getState().lastAuthoritativeGraph?.nodeIds).toEqual(aPersistedNodeIds)

    useCanvasStore.getState().loadScenario(b.id)
    const before = new Set(useCanvasStore.getState().nodes.map((n) => n.id))
    expect(useCanvasStore.getState().addNode(undefined, 'factor')).toBeNull()
    const localNodeId = useCanvasStore
      .getState()
      .nodes.map((n) => n.id)
      .find((id) => !before.has(id)) as string

    // ── PRECONDITIONS, pinned in-test ──────────────────────────────────────
    // 1. A node really was minted.
    expect(localNodeId).toBeTruthy()
    // 2. It is a node B's SERVER GRAPH never held — the class the reconciler
    //    must never remove.
    expect(before.has(localNodeId)).toBe(false)
    // 3. THE COLLISION IS REAL: the id the product just minted for B is one of
    //    the ids scenario A's persisted graph holds — so a record left over
    //    from A genuinely acknowledges it. Without this the survival assertion
    //    below would be vacuous: it would pass on any record at all.
    expect(aPersistedNodeIds).toContain(localNodeId)

    return { bId: b.id, localNodeId }
  }

  it("does NOT delete a node B minted locally, though A's record acknowledged that id", () => {
    const { localNodeId } = switchToBAndAddLocalNode()

    // An applied-edit receipt for B, built from B's persisted graph — so it
    // legitimately omits the node created moments ago.
    const result = reconcileAppliedGraph({
      nodes: [
        { id: SHARED_GOAL_ID, kind: 'goal', label: 'B revenue' },
        { id: SHARED_FACTOR_ID, kind: 'factor', label: 'B spend' },
      ],
      edges: [{ id: 'e1', from: SHARED_FACTOR_ID, to: SHARED_GOAL_ID, weight: 0.5 }],
    } as never)

    expect(result.removedNodeCount).toBe(0)
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).toContain(localNodeId)
  })

  it("STILL deletes a node B's OWN record acknowledged and this receipt omits", () => {
    // The opposite-direction twin. It fails if the switch is "fixed" by writing
    // `null` or an empty record: both would leave the reconciler unable to
    // remove anything, trading a silent deletion for a silent resurrection.
    const { localNodeId } = switchToBAndAddLocalNode()

    const result = reconcileAppliedGraph({
      nodes: [{ id: SHARED_GOAL_ID, kind: 'goal', label: 'B revenue' }],
      edges: [],
    } as never)

    const idsAfter = useCanvasStore.getState().nodes.map((n) => n.id)
    expect(idsAfter).not.toContain(SHARED_FACTOR_ID)
    // …and the local node, which B's record never acknowledged, is untouched by
    // the same call. One receipt, two opposite outcomes, bound by identity.
    expect(idsAfter).toContain(localNodeId)
    expect(idsAfter).toContain(SHARED_GOAL_ID)
    expect(result.removedNodeCount).toBe(1)
  })
})
