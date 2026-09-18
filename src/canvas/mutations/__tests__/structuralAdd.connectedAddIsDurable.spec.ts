/**
 * ⭐⭐⭐ WHAT "ADD CONNECTED …" ACTUALLY SAVES — the node durably, the link
 * honestly.
 *
 * `store.addNodeWithEdge` wrote with a bare `set()` and captured NOTHING, so
 * every node created from the three "Add connected …" context-menu items and
 * from the inspector's "Add option" lived on the canvas and vanished on reload.
 * That was DELIBERATE while CEE held `structural_add_edge` at
 * `'reader_only_refusal'`: emitting `structural_add` alone would have saved the
 * node and silently dropped the link. **CEE #1443 shipped the writer on 13 Sep
 * 2026 and promoted the kind to `'mutating'` (`dispatch.ts:373`).** This file
 * pins what the gesture captures now.
 *
 * ⭐⭐ THE STORE IS REAL AND THE GESTURE IS REAL. Nothing here is hand-built:
 * the ids are minted by the store, the edge data is whatever
 * `addNodeWithEdge` writes, and every assertion reads back out of the store.
 * `structuralAdd.connectedAddExplicitUnknown.spec.tsx` records why that matters
 * — its `addNode` sibling MOCKS the store and a mutant seeding a value into the
 * real action left it GREEN at 9/9.
 *
 * ⚠⚠ TWO CLAIMS, NAMED APART, BECAUSE COLLAPSING THEM IS THE DEFECT
 * (CLAUDE.md trap 21):
 *   · the NODE is captured for the wire — durable;
 *   · the LINK is NOT, and the product SAYS SO. `USER_EDGE_DEFAULTS` carries
 *     `weight: 0.3` with no `weightSource` and no `directionSource`, so the
 *     provenance gate reads both as unstated and `captureStructuralAddEdge`
 *     stands down at `strength_not_stated`. Sending 0.3 would assert a strength
 *     the user never gave. The stand-down is RECORDED on the edge, which is what
 *     turns a silent half-save into a disclosed one: `EdgePanel` reads that
 *     receipt and offers the control that states a strength.
 *
 * ⚠ NOT A CLAIM ABOUT THE SERVER. "Captured" means the intent is queued for the
 * next turn with the base hash the user was looking at. Whether CEE commits it
 * is CEE's, and `StructuralAddReceipt` is where that question is answered.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../../store'
import { USER_EDGE_DEFAULTS } from '../../domain/edges'
import type { Node } from '@xyflow/react'

/** A CEE-stamped hash, so the capture is a SEND rather than a deferral. */
const SERVER_HASH = 'aag_v1:deadbeefcafe'

/**
 * ⚠ A TYPED CONSTANT, not `OUTCOME_TARGET.data?.label`. `Node['data']` is
 * `Record<string, unknown>`, so reading the label back out of it yields
 * `unknown` and cannot be handed to `toBe` under `strict`.
 */
const OUTCOME_LABEL = 'Supply continuity'

const OUTCOME_TARGET: Node = {
  id: '1',
  type: 'outcome',
  position: { x: 0, y: 0 },
  data: { label: OUTCOME_LABEL, kind: 'outcome' },
} as Node

/**
 * Put the store in the state the context-menu item runs against and perform the
 * REAL gesture. `stamped` chooses whether a turn has stamped a graph hash yet —
 * the difference between a captured intent and a deferred one.
 */
function performConnectedAdd(opts: { stamped: boolean }): { nodeId: string; edgeId: string } {
  useCanvasStore.setState({
    currentScenarioId: 'scenario-1',
    lastServerGraphHash: opts.stamped ? SERVER_HASH : null,
    lastAuthoritativeGraph: null,
    pendingStructuralAdds: [],
    pendingStructuralAddEdges: [],
    structuralAddLifecycle: [],
    _externalMutationActive: 0,
    nodes: [OUTCOME_TARGET] as unknown as Node[],
    edges: [],
    history: { past: [], future: [] },
    engineLimits: null,
    results: { status: 'idle', report: null },
    ceeAnalysisReady: null,
  } as never)

  // ⛔⛔ RESEED THE ID COUNTER, AND THE REASON IS A MEASURED FALSE RESULT RATHER
  // THAN TIDINESS (18 Sep 2026). `nextNodeId` initialises to 1 (`store.ts:3184`)
  // and `createNodeId` returns `String(nextNodeId)`, so on a store seeded by raw
  // `setState` the FIRST created node takes id `'1'` — which is
  // `OUTCOME_TARGET`'s id. Two nodes then share an id, and
  // `captureStructuralAdd`'s `nodesAfter.find(n => n.id === nodeId)` returns the
  // FIRST match: the pre-existing OUTCOME. The intent came back
  // `nodeKind: 'outcome'` and this file read like the capture was grabbing the
  // wrong node.
  //
  // ⭐ IT IS NOT. The capture is bound by identity exactly as its header claims;
  // the FIXTURE manufactured a duplicate id that the product prevents. Every
  // real graph-loading path reseeds — `importCanvas` (`store.ts:4535`), the
  // autosave load (`:8398`), `RecoveryBanner`, and `store/scenarios.ts` — and
  // `store.ts:5165-5172` records this exact hazard in its own words: "a reset
  // makes the NEXT graph reissue the same ids the previous one used."
  //
  // ⚠ SO THIS USES THE PRODUCT'S OWN MECHANISM rather than hardcoding a counter.
  // `reseedIds` derives `Math.max(maxNodeId + 1, 5)`, so a future fixture with
  // higher ids stays correct with no edit here.
  useCanvasStore.getState().reseedIds([OUTCOME_TARGET] as unknown as Node[], [])

  const preExistingNodeIds = new Set(useCanvasStore.getState().nodes.map((n) => n.id))
  const before = useCanvasStore.getState().edges.length
  // `getEdgeDirectionForKind('outcome')` returns `'to-target'`, which is what the
  // "Add connected factor" item passes for an outcome target.
  const nodeId = useCanvasStore.getState().addNodeWithEdge(
    { x: 150, y: 0 }, 'factor', OUTCOME_TARGET.id, 'to-target',
  )
  expect(typeof nodeId, 'the gesture must return the new node id').toBe('string')
  // ⭐⭐ PIN THE PRECONDITION IN-TEST (CLAUDE.md trap 13b). Every assertion in
  // this file distinguishes the CREATED node from the pre-existing one, and all
  // of them are worthless the moment the two share an id — which is precisely
  // what happened before the reseed above. This is the guard that makes that
  // failure LOUD and specific instead of surfacing as a baffling
  // `expected 'outcome' to be 'factor'` three assertions later.
  expect(
    preExistingNodeIds.has(nodeId as string),
    'fixture defect: the created node reused a pre-existing id, so every ' +
      'identity-bound assertion below would silently read the wrong node',
  ).toBe(false)
  const edges = useCanvasStore.getState().edges
  expect(edges.length, 'the gesture must have created exactly one edge').toBe(before + 1)
  return { nodeId: nodeId as string, edgeId: edges[edges.length - 1].id }
}

beforeEach(() => {
  useCanvasStore.setState({ pendingStructuralAdds: [], pendingStructuralAddEdges: [] } as never)
})

describe('the node half is durable', () => {
  /**
   * ⚠ BOUND BY NODE IDENTITY, never by "the queue is non-empty" or by a kind or
   * label predicate another node could satisfy (CLAUDE.md trap 19). The queue
   * holding SOME intent is not evidence that it holds THIS gesture's.
   */
  it('captures a structural_add intent for the node the gesture created', () => {
    const { nodeId } = performConnectedAdd({ stamped: true })
    const intent = useCanvasStore.getState().pendingStructuralAdds.find(i => i.nodeId === nodeId)
    expect(intent, 'no intent captured for the created node').toBeDefined()
    expect(intent?.nodeKind).toBe('factor')
    expect(intent?.label).toBe('New factor')
    // ⛔ THE HARM, PINNED DIRECTLY RATHER THAN INFERRED FROM THE KIND. A capture
    // that took the gesture's EXISTING endpoint instead of its new node would
    // persist something the user never asked for and lose the thing they did —
    // worse than the door staying shut. `nodeKind` alone is a value predicate the
    // wrong node can satisfy whenever both are the same kind (CLAUDE.md trap 19);
    // this names the object.
    expect(
      intent?.nodeId,
      'the intent must describe the CREATED node, never the endpoint it joined',
    ).not.toBe(OUTCOME_TARGET.id)
    expect(intent?.label).not.toBe(OUTCOME_LABEL)
  })

  /**
   * The intent asserts the graph the user was LOOKING AT. A capture that carried
   * some other hash would be a claim about a graph nobody saw.
   */
  it('carries the CEE-stamped hash of the graph the gesture was performed on', () => {
    const { nodeId } = performConnectedAdd({ stamped: true })
    const intent = useCanvasStore.getState().pendingStructuralAdds.find(i => i.nodeId === nodeId)
    expect(intent?.baseGraphHash).toBe(SERVER_HASH)
  })

  /**
   * ⭐ THE DEFERRAL ARM, and it is a DISCRIMINATING TWIN rather than a second
   * happy path. On a restored graph no turn has stamped a hash yet; a `null`
   * base is "not yet", never "dropped". If this arm ever stopped capturing, the
   * test above would still pass and the first add after a restore would be lost
   * in silence — exactly the class of loss this whole carrier exists to close.
   */
  it('still captures on a restored graph, with a null base — deferred, not dropped', () => {
    const { nodeId } = performConnectedAdd({ stamped: false })
    const intent = useCanvasStore.getState().pendingStructuralAdds.find(i => i.nodeId === nodeId)
    expect(intent, 'a deferred add must still be captured').toBeDefined()
    expect(intent?.baseGraphHash).toBeNull()
  })
})

describe('the link half stands down, and says so', () => {
  /**
   * ⛔ THE REFUSAL IS THE POINT. `USER_EDGE_DEFAULTS.weight` is 0.3 with no
   * provenance; queueing it would put a strength the user never stated on the
   * wire, CEE would persist it as theirs and PLoT would analyse it.
   *
   * ⚠ BOUND BY EDGE IDENTITY. Asserting the queue is empty would also pass if
   * the capture had never been reached at all, which is the pre-change state.
   */
  it('queues NO add-edge intent for a link nobody has given a strength', () => {
    const { edgeId } = performConnectedAdd({ stamped: true })
    const queued = useCanvasStore.getState().pendingStructuralAddEdges.find(i => i.edgeId === edgeId)
    expect(queued, 'a strength nobody stated must not reach the wire').toBeUndefined()
  })

  /**
   * ⭐⭐ AND THE STAND-DOWN IS RECORDED, which is what separates this from the
   * behaviour it replaces. Before, the link was simply unsaved and nothing
   * downstream could tell that from "never a candidate". The receipt is what
   * `EdgePanel` reads to offer "How strong is this effect?".
   */
  it('records the stand-down on the created edge, so the panel can offer the control', () => {
    const { edgeId } = performConnectedAdd({ stamped: true })
    const edge = useCanvasStore.getState().edges.find(e => e.id === edgeId)
    expect(edge, 'the created edge must still be on the canvas').toBeDefined()
    expect((edge?.data as { structuralAddStandDown?: string } | undefined)?.structuralAddStandDown)
      .toBe('strength_not_stated')
  })

  /**
   * ⚠ PINS THE PRECONDITION IN-TEST (CLAUDE.md trap 13b). The two assertions
   * above are evidence about a PROVENANCE refusal only while the edge really was
   * built from an unstamped default. If a future change seeded `weightSource`
   * into `USER_EDGE_DEFAULTS`, they would both flip and this case says why.
   */
  it('stood down because the defaults state nothing, not because the path is dead', () => {
    expect('weightSource' in USER_EDGE_DEFAULTS, 'defaults must not stamp a weight').toBe(false)
    expect('directionSource' in USER_EDGE_DEFAULTS, 'defaults must not stamp a direction').toBe(false)
    const { edgeId } = performConnectedAdd({ stamped: true })
    const edge = useCanvasStore.getState().edges.find(e => e.id === edgeId)
    expect((edge?.data as { weight?: number } | undefined)?.weight).toBe(USER_EDGE_DEFAULTS.weight)
  })

  /**
   * ⭐⭐⭐ THE DISCRIMINATING TWIN, and the file is worthless without it. Every
   * assertion above is an ABSENCE claim, and an absence claim from an instrument
   * that has never demonstrated a PRESENCE proves nothing (CLAUDE.md trap 13).
   *
   * SAME gesture, SAME store, SAME edge — with a strength STATED the way
   * `EdgePanel.handleStateStrengthForSave` states it. The intent must now be
   * queued and the receipt must be GONE. If this stops firing, "queues no
   * intent" above has stopped discriminating and reduces to "the capture never
   * runs", which is precisely the defect being fixed.
   */
  it('POSITIVE CONTROL: stating a strength queues the link and clears the receipt', () => {
    const { edgeId } = performConnectedAdd({ stamped: true })
    useCanvasStore.getState().updateEdgeData(edgeId, {
      weight: 0.7,
      weightSource: 'user',
      direction: 'positive',
      directionSource: 'user',
    } as never)

    const queued = useCanvasStore.getState().pendingStructuralAddEdges.find(i => i.edgeId === edgeId)
    expect(queued, 'a stated strength must reach the queue').toBeDefined()
    expect(queued?.magnitude).toBeCloseTo(0.7, 6)
    expect(queued?.direction).toBe('positive')
    expect(queued?.baseGraphHash).toBe(SERVER_HASH)

    const edge = useCanvasStore.getState().edges.find(e => e.id === edgeId)
    expect(
      (edge?.data as { structuralAddStandDown?: string } | undefined)?.structuralAddStandDown,
      'the receipt must be cleared once the link is sendable',
    ).toBeUndefined()
  })

  /**
   * ⛔ THE DOUBLE-SEND GUARD, asserted rather than assumed. A second strength
   * write finds no receipt and must NOT re-queue: "repeat confirmation cannot
   * duplicate it" is the acceptance condition `retryStructuralAddEdgeCapture`
   * was written against, and nothing else in the suite pins it for this path.
   */
  it('a second strength write does not queue the same link twice', () => {
    const { edgeId } = performConnectedAdd({ stamped: true })
    const state = () => useCanvasStore.getState()
    const stateStrength = (v: number) => state().updateEdgeData(edgeId, {
      weight: v, weightSource: 'user', direction: 'positive', directionSource: 'user',
    } as never)
    stateStrength(0.7)
    stateStrength(0.9)
    const forThisEdge = state().pendingStructuralAddEdges.filter(i => i.edgeId === edgeId)
    expect(forThisEdge.length, 'exactly one intent per link').toBe(1)
  })
})
