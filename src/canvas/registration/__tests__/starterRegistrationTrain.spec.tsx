/**
 * THE STARTER REGISTRATION TRAIN — a bundled saved example must reach an
 * analysable model DETERMINISTICALLY, with no LLM re-draft.
 *
 * ── THE THREE SEAMS THIS PINS ──────────────────────────────────────────────
 * The deterministic whole-graph write seam (`register`) was already live on
 * both sides; the starter path simply never entered it. Three things were
 * missing, and each gets its own case here because each fails silently:
 *
 *  1. `applyStarter` never ARMED registration. It routes through
 *     `applyDraftResult`, which releases `importPendingServerRegistration`
 *     unconditionally — a release that is correct for a CEE draft (the server
 *     drafted it) and wrong for a starter (the server has never seen it).
 *  2. A fresh guest had NO `currentScenarioId`, so `useImportRegistration`
 *     bailed with "there is nowhere to register this graph" — true, and
 *     therefore the thing to fix rather than to log.
 *  3. `analysisHeldOn` had no registration conjunct. It reads the PERSISTENT
 *     `starterId` stamp, so it refused the run *after* a successful
 *     registration too — the stamp survives the round trip by design.
 *
 * ── WHY THE HOLD IS RELEASED BY THE SERVER'S ACK AND NOTHING ELSE ──────────
 * Design §2 F6: never enable an affordance whose write cannot reach the
 * server. `importPendingServerRegistration` is already the estate's derived,
 * structural, storage-backed answer to "has CEE acknowledged holding this
 * graph?" — armed at the replacement site, released ONLY by
 * `useImportRegistration` on a 200 carrying the registration envelope. So the
 * conjunct reuses it rather than adding a second boolean beside it, and every
 * failure mode (409, 503, transport, unreadable body, no scenario row) leaves
 * the hold ARMED and the product honest.
 *
 * ── THE DISCRIMINATING PAIR (trap 19) ──────────────────────────────────────
 * Cases 6 and 7 are a pair on purpose. 6 proves the hold RELEASES on the
 * acknowledgement; 7 proves the conjunct did not simply BECOME the flag — a
 * CEE-drafted graph with the flag armed is still not "held on a saved
 * example", because the provenance stamp is absent. Either alone would pass
 * for a wrong implementation.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

import {
  analysisHeldOn,
  analysisHeldNotice,
  ANALYSIS_HELD_NOTICE,
  type AnalysisHoldState,
} from '../../utils/analysisHeldOnInjectedModel'
import { useCanvasStore } from '../../store'
import {
  clearImportRegistrationMarkers,
  isGraphPendingImportRegistration,
  markGraphServerAcknowledged,
  __readImportRegistrationMarkers,
} from '../../store/importRegistrationMarker'
import { buildRegistrationGraph } from '../buildRegistrationGraph'
import {
  __resetPersistenceSessionForTests,
  setPersistenceSessionActive,
} from '../../../lib/persistenceSession'

/**
 * ⚠ THE HOLD'S RUN-PATH CONJUNCT IS FALSE BY DEFAULT UNDER TEST, AND THE FIRST
 *   VERSION OF THIS FILE DID NOT MOCK IT. Four cases passed — including the
 *   discriminating pair — for the wrong reason: `analysisHeldOn` was returning
 *   null because the canonical path was off, not because of anything this lane
 *   changed. A predicate with three conjuncts cannot be tested with two of them
 *   left to whatever the environment happens to be (trap 13b).
 */
const isV5CanonicalRunPathMock = vi.fn(() => true)
vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return { ...actual, isV5CanonicalRunPath: () => isV5CanonicalRunPathMock() }
})

// ── Hook-under-test dependencies ────────────────────────────────────────────
// Spread-mocked so every other export stays real (trap 12: a bare factory
// REPLACES the module and silently removes whatever it forgets).
const registerSpy = vi.fn()
vi.mock('../../../adapters/cee/registerScenarioGraph', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../adapters/cee/registerScenarioGraph')>()),
  registerScenarioGraph: (...args: unknown[]) => registerSpy(...args),
}))
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}))
vi.mock('../../../lib/supabase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/supabase')>()),
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))

import { useImportRegistration } from '../useImportRegistration'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function node(id: string, data: Record<string, unknown> = {}) {
  return { id, type: 'factor', position: { x: 0, y: 0 }, data: { label: id, kind: 'factor', ...data } }
}

/** Starter graph — `applyStarter` stamps EVERY node. */
const STARTER_NODES = [node('n1', { starterId: 'pricing-model' }), node('n2', { starterId: 'pricing-model' })]
/** CEE-drafted graph: no client-injection stamp anywhere. THE CONTRAST CONTROL. */
const DRAFTED_NODES = [node('n1'), node('n2')]

beforeEach(() => {
  vi.clearAllMocks()
  isV5CanonicalRunPathMock.mockReturnValue(true)
  clearImportRegistrationMarkers()
  __resetPersistenceSessionForTests()
  useCanvasStore.setState({
    nodes: [] as never,
    edges: [] as never,
    currentScenarioId: null,
    importPendingServerRegistration: false,
  })
})

afterEach(() => {
  __resetPersistenceSessionForTests()
})

// ═══════════════════════════════════════════════════════════════════════════
// SEAM 1 — applyStarter ARMS registration
// ═══════════════════════════════════════════════════════════════════════════
describe('seam 1 — applyStarter arms server registration', () => {
  it('leaves the registration hold ARMED after a starter is applied', async () => {
    const { applyStarter } = await import('../../starters/loadStarter')

    const result = await applyStarter('pricing-model')
    // Precondition PINNED in-test (trap 13b): the starter really did land.
    expect(result.nodeCount).toBe(15)

    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(true)
  })

  it('records the STRUCTURAL marker, so a reload re-derives the hold', async () => {
    const { applyStarter } = await import('../../starters/loadStarter')
    await applyStarter('pricing-model')

    const { nodes, edges } = useCanvasStore.getState()
    // Bound by the graph's own identity, not by "a marker exists" — a marker
    // for some OTHER graph would satisfy the weaker claim.
    expect(isGraphPendingImportRegistration(nodes, edges)).toBe(true)
    expect(__readImportRegistrationMarkers().length).toBe(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SEAM 2 — a fresh guest gets an addressable scenario row
// ═══════════════════════════════════════════════════════════════════════════
describe('seam 2 — the scenario row a registration needs', () => {
  it('mints a scenario id for a GUEST holding an unregistered graph', async () => {
    registerSpy.mockResolvedValue({ status: 'unavailable' })
    useCanvasStore.setState({
      nodes: STARTER_NODES as never,
      edges: [] as never,
      currentScenarioId: null,
      importPendingServerRegistration: true,
    })

    renderHook(() => useImportRegistration())

    await waitFor(() => {
      expect(useCanvasStore.getState().currentScenarioId).toMatch(UUID)
    })
  })

  it('REFUSES to mint for a signed-in session, and does not register', async () => {
    // Same ruling as `useConversation`'s mint guard: inventing a scenario for a
    // persisted user manufactures a decision they never asked for. Refusing
    // leaves the hold armed, which is the honest posture.
    setPersistenceSessionActive(true)
    registerSpy.mockResolvedValue({ status: 'registered', identity: null, nodeCount: 2, edgeCount: 0, requestId: null })
    useCanvasStore.setState({
      nodes: STARTER_NODES as never,
      edges: [] as never,
      currentScenarioId: null,
      importPendingServerRegistration: true,
    })

    renderHook(() => useImportRegistration())

    await new Promise((r) => setTimeout(r, 20))
    expect(useCanvasStore.getState().currentScenarioId).toBeNull()
    expect(registerSpy).not.toHaveBeenCalled()
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(true)
  })

  it('registers against the minted id and releases the hold on the ACK', async () => {
    registerSpy.mockResolvedValue({
      status: 'registered',
      identity: { value: 'abc', projectionVersion: 'identity.v1' },
      nodeCount: 2,
      edgeCount: 0,
      requestId: 'req_1',
    })
    useCanvasStore.setState({
      nodes: STARTER_NODES as never,
      edges: [] as never,
      currentScenarioId: null,
      importPendingServerRegistration: true,
    })

    renderHook(() => useImportRegistration())

    await waitFor(() => {
      expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false)
    })
    // The registration went to the id that was minted, not to some other row.
    const mintedId = useCanvasStore.getState().currentScenarioId
    expect(mintedId).toMatch(UUID)
    expect(registerSpy).toHaveBeenCalledWith(mintedId, expect.anything(), expect.anything())
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SEAM 3 — the registration conjunct in analysisHeldOn
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Complete hold state for a graph with no recorded acknowledgement.
 *
 * ⚠ THE FIRST VERSION OF THIS HELPER DEFEATED THE CHECK IT WAS WRITTEN TO
 *   SATISFY, and the receipt that shipped it said otherwise. It was
 *   `heldState(nodes: unknown)` returning the fixture `as never`, and I
 *   described that as "neither a cast" with the omission "unconstructible".
 *   Both were false: `as never` assigns to any parameter, so the required-state
 *   check that had just exposed five incomplete callers could no longer see
 *   this one. Proven by compiler-only control — with the cast, deleting `edges`
 *   and `currentScenarioId` still yields ZERO diagnostics; with the explicit
 *   types below and no cast, it is TS2739.
 *
 *   Annotating the parameter and the return type is what makes the claim true:
 *   the helper is now held to `AnalysisHoldState` like every production caller,
 *   so an incomplete fixture here fails to compile exactly as it should.
 */
function heldState(nodes: AnalysisHoldState['nodes']): AnalysisHoldState {
  return {
    nodes,
    edges: [],
    currentScenarioId: '66666666-6666-4666-8666-666666666666',
    importPendingServerRegistration: true,
  }
}

describe('seam 3 — analysisHeldOn carries the registration conjunct', () => {
  it('HOLDS a starter the server has not acknowledged', () => {
    const held = analysisHeldOn(heldState(STARTER_NODES))
    expect(held).toBe('starter')
    expect(analysisHeldNotice(heldState(STARTER_NODES))).toBe(
      ANALYSIS_HELD_NOTICE.starter,
    )
  })

  it('RELEASES once CEE has acknowledged holding the graph', () => {
    // ⭐ THE CAPABILITY. The stamp is still on every node — it survives
    // persistence by design — so nothing about the graph changed. What changed
    // is that the server now holds it, which is the only thing the hold was
    // ever about.
    //
    // ⚠ RELEASE IS DRIVEN BY THE ACKNOWLEDGEMENT RECORD, NOT BY THE ABSENCE OF
    //   THE PENDING FLAG. An earlier cut asserted release by passing
    //   `importPendingServerRegistration: false`, which is exactly the lost-
    //   storage state — so it asserted the fail-OPEN behaviour as if it were
    //   the capability. Recording the acknowledgement is what a real 200 does.
    markGraphServerAcknowledged('44444444-4444-4444-8444-444444444444', STARTER_NODES as never, [] as never)
    const state = {
      nodes: STARTER_NODES,
      edges: [],
      currentScenarioId: '44444444-4444-4444-8444-444444444444',
      importPendingServerRegistration: false,
    }
    expect(analysisHeldOn(state as never)).toBeNull()
    expect(analysisHeldNotice(state as never)).toBeNull()
    clearImportRegistrationMarkers()
  })

  it('DISCRIMINATES: an armed hold on a CEE-drafted graph is still not held', () => {
    // The pair-mate of the case above. Without this, an implementation that
    // simply returned the flag would pass — and would then claim a live CEE
    // draft was "a saved example".
    expect(analysisHeldOn(heldState(DRAFTED_NODES))).toBeNull()
  })

  it('is still scoped to the V5 canonical run path', () => {
    // A V2-direct run SENDS the canvas graph, so nothing is held there — the
    // conjunct this lane added must not have swallowed the one already here.
    isV5CanonicalRunPathMock.mockReturnValue(false)
    expect(analysisHeldOn(heldState(STARTER_NODES))).toBeNull()
    // CONTROL, same run: the identical input DOES hold on the canonical path,
    // so the null above is the run path's doing and not a dead fixture.
    isV5CanonicalRunPathMock.mockReturnValue(true)
    expect(analysisHeldOn(heldState(STARTER_NODES))).toBe('starter')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// THE HOLD SURVIVES EVERY NON-ACKNOWLEDGEMENT — incl. the CAS 409
// ═══════════════════════════════════════════════════════════════════════════
describe('nothing short of an acknowledgement releases the hold', () => {
  // A 409 means CEE's compare-and-swap refused and NOTHING was written. It is
  // never retried (re-sending is the silent clobber the CAS just refused) and
  // it must never read as a success. Measured on the deployed edge 8 Sep 2026:
  // registering into a scenario that ALREADY holds a graph returns 200 and
  // REPLACES it, so a 409 is a genuine concurrent-write race, not the
  // occupied-scenario case.
  it.each([
    ['conflict', { status: 'conflict' }],
    ['unavailable', { status: 'unavailable' }],
    ['notRegistrable', { status: 'notRegistrable' }],
    ['rejected', { status: 'rejected', code: 'GRAPH_EMPTY', message: 'no', nodeIds: [] }],
    ['refused', { status: 'refused', httpStatus: 401 }],
  ])('a %s answer leaves the hold ARMED and analysis held', async (_name, answer) => {
    registerSpy.mockResolvedValue(answer)
    useCanvasStore.setState({
      nodes: STARTER_NODES as never,
      edges: [] as never,
      currentScenarioId: '11111111-2222-4333-8444-555555555555',
      importPendingServerRegistration: true,
    })

    renderHook(() => useImportRegistration())

    await waitFor(() => expect(registerSpy).toHaveBeenCalledTimes(1))
    await new Promise((r) => setTimeout(r, 20))

    const state = useCanvasStore.getState()
    expect(state.importPendingServerRegistration).toBe(true)
    expect(analysisHeldOn(state)).toBe('starter')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// FIDELITY — the projection sent to CEE must describe the model on screen
// ═══════════════════════════════════════════════════════════════════════════
describe('fidelity of the registered projection', () => {
  it('carries every node, edge and FACTOR of the real starter, with values and units', async () => {
    const { applyStarter } = await import('../../starters/loadStarter')
    await applyStarter('vendor-selection')

    const { nodes, edges } = useCanvasStore.getState()
    const projected = buildRegistrationGraph(nodes, edges)
    expect(projected.ok).toBe(true)
    if (!projected.ok) return

    expect(projected.graph.nodes.length).toBe(19)
    expect(projected.graph.edges.length).toBe(39)
    expect(projected.graph.nodes.filter((n) => n.kind === 'factor').length).toBe(8)

    // Bound BY IDENTITY (exact node id), never by a value predicate another
    // node could satisfy (trap 19).
    const factor = projected.graph.nodes.find((n) => n.id === 'fac_annual_cost')
    expect(factor).toBeDefined()
    expect(factor?.label).toBe('Annual Platform Cost')
    expect(factor?.display_value).toBe('£60k')
    const observed = factor?.observed_state as Record<string, unknown>
    expect(observed.value).toBe(0.5)
    expect(observed.unit).toBe('£')
    expect(observed.raw_value).toBe(60000)
    expect(observed.cap).toBe(120000)

    const edge = projected.graph.edges.find((e) => e.from === 'dec_cdp' && e.to === 'opt_rudderstack')
    expect(edge).toBeDefined()
    expect((edge?.strength as Record<string, unknown>).mean).toBe(1)
    expect(edge?.exists_probability).toBe(1)
    expect(edge?.effect_direction).toBe('positive')
  })
})

/**
 * ⭐ THE HOLD FAILS CLOSED — released ONLY on positive acknowledgement.
 *
 * THE GAP THIS REPLACES. A first cut released the hold whenever
 * `importPendingServerRegistration` was false. Both markers live in
 * localStorage, and `importRegistrationMarker`'s own header discloses that on
 * private browsing, disabled storage, a corrupt record, quota exhaustion or
 * eviction past MAX_IDENTITIES the write is silently dropped. "No pending
 * marker" was therefore being read as "registered", so a lost record LIFTED the
 * hold on a graph CEE had never seen — the pre-mitigation P0, reached through
 * the mitigation itself.
 *
 * THE FIX IS A POLARITY INVERSION, not a new guard. "Not pending" and
 * "acknowledged" are two different questions; collapsing them into one boolean
 * is what let the release mean something it could not support. The hold now
 * reads a separate ACKNOWLEDGEMENT record, so the two absences fail in opposite
 * and correct directions: no acknowledgement ⇒ still held. The worst case is
 * re-holding a graph that WAS registered — a redundant registration, never a
 * false affirmation.
 */
describe('the hold fails CLOSED: released only on positive acknowledgement', () => {
  // Real starter nodes carry a kind; `buildRegistrationGraph` refuses a node it
  // cannot type, and the identity is now derived from that projection — so a
  // kind-less fixture would be unprojectable and held forever, testing nothing.
  const NODES = [
    { id: 'n1', type: 'factor', data: { kind: 'factor', label: 'N1', starterId: 'build-vs-buy' } },
  ] as any
  const EDGES = [] as any
  const SC = '33333333-3333-4333-8333-333333333333'
  const st = (nodes: unknown = NODES, edges: unknown = EDGES, scenarioId: string | null = SC) =>
    ({ nodes, edges, currentScenarioId: scenarioId, importPendingServerRegistration: false }) as never

  beforeEach(() => {
    clearImportRegistrationMarkers()
    useCanvasStore.setState({ nodes: NODES, edges: EDGES } as any)
  })
  afterEach(() => clearImportRegistrationMarkers())

  it('holds a starter with no acknowledgement on record', () => {
    expect(analysisHeldOn(st())).toBe('starter')
  })

  it('⭐ STILL holds when the pending marker is absent — the defect this closes', () => {
    // Exactly the lost-storage state: nothing pending, nothing acknowledged.
    // Under the old predicate this released. It must now hold.
    expect(isGraphPendingImportRegistration(NODES, EDGES)).toBe(false)
    expect(analysisHeldOn(st())).toBe('starter')
  })

  it('releases ONLY once the server acknowledgement is recorded', () => {
    markGraphServerAcknowledged(SC, NODES, EDGES)
    expect(analysisHeldOn(st())).toBeNull()
  })

  it('re-holds if the acknowledgement record is lost — failing in the safe direction', () => {
    markGraphServerAcknowledged(SC, NODES, EDGES)
    expect(analysisHeldOn(st())).toBeNull()
    clearImportRegistrationMarkers() // storage cleared / evicted / private mode
    expect(analysisHeldOn(st())).toBe('starter')
  })

  it('acknowledgement is keyed to THIS graph, not to any graph', () => {
    markGraphServerAcknowledged(SC, NODES, EDGES)
    const other = [
      { id: 'other', type: 'factor', data: { kind: 'factor', label: 'O', starterId: 'market-entry' } },
    ] as any
    expect(analysisHeldOn(st(other))).toBe('starter')
  })

  it('the stamp survives release, so provenance and analysability stay distinct', () => {
    markGraphServerAcknowledged(SC, NODES, EDGES)
    expect(analysisHeldOn(st())).toBeNull()
    expect((NODES[0] as any).data.starterId).toBe('build-vs-buy')
  })
})

/**
 * REPLACEMENT FOR THE REVIEWER'S F3, WHICH ASSERTS A SHAPE THIS REPAIR REMOVED.
 *
 * F3 passed `{ nodes, importPendingServerRegistration }` — the literal pre-fix
 * production input at `OutputsDock:1284` / `PreAnalysisPanel:2489` — and
 * required it to release. The finding was correct: that shape computed an
 * empty-edge key and could not match a real acknowledgement.
 *
 * The repair removes the shape rather than teaching the predicate to tolerate
 * it. Both consumers now pass the complete current state, and `edges` /
 * `currentScenarioId` are REQUIRED, so the omission is a compile error rather
 * than a silent wrong answer. Making F3 pass as written would need
 * `analysisHeldOn` to read the store internally — which this module bans by
 * name, because a selector bound to `nodes` would then never re-run when the
 * acknowledgement lands and the claim would go stale exactly as the banner's did.
 *
 * So the obligation F3 encodes is discharged here against the shape production
 * actually uses, with its opposite-direction twin.
 */
describe('an edge-bearing acknowledgement releases the REAL Run-consumer shape', () => {
  const SCENARIO = '11111111-1111-4111-8111-111111111111'
  const NODES = [
    { id: 'a', type: 'factor', data: { kind: 'factor', label: 'A', starterId: 'build-vs-buy', value: 1 } },
    { id: 'b', type: 'goal', data: { kind: 'goal', label: 'B', starterId: 'build-vs-buy' } },
  ] as any
  const EDGES = [{ source: 'a', target: 'b', data: { weight: 0.2, direction: 'positive' } }] as any

  beforeEach(() => clearImportRegistrationMarkers())
  afterEach(() => clearImportRegistrationMarkers())

  /** The exact object both consumers now build. */
  const consumerInput = (scenarioId: string | null, nodes: unknown, edges: unknown) => ({
    nodes,
    edges,
    currentScenarioId: scenarioId,
    importPendingServerRegistration: false,
  })

  it('releases once the edge-bearing graph is acknowledged for THIS scenario', () => {
    markGraphServerAcknowledged(SCENARIO, NODES, EDGES)
    expect(analysisHeldOn(consumerInput(SCENARIO, NODES, EDGES) as never)).toBeNull()
  })

  it('TWIN — an unacknowledged counterpart stays held through the same shape', () => {
    expect(analysisHeldOn(consumerInput(SCENARIO, NODES, EDGES) as never)).toBe('starter')
  })

  it('TWIN — the same graph under a DIFFERENT scenario stays held', () => {
    markGraphServerAcknowledged(SCENARIO, NODES, EDGES)
    const other = '22222222-2222-4222-8222-222222222222'
    expect(analysisHeldOn(consumerInput(other, NODES, EDGES) as never)).toBe('starter')
  })

  it('TWIN — same topology, different edge WEIGHT stays held', () => {
    markGraphServerAcknowledged(SCENARIO, NODES, EDGES)
    const changed = [
      { source: 'a', target: 'b', data: { weight: 0.9, direction: 'positive' } },
    ] as any
    expect(analysisHeldOn(consumerInput(SCENARIO, NODES, changed) as never)).toBe('starter')
  })
})

/**
 * THE IDENTITY IS THE PAYLOAD — pinned against the two fields that refuted the
 * previous key, and against the class of failure they represent.
 *
 * Two hand-maintained keys were both wrong the same way. The second forgot edge
 * `strengthStd` (wire `strength.std`) and node `observedState` (wire
 * `observed_state`), so a receipt for A released a B that differed only in
 * those. Adding two fields would have left the next projection change wrong
 * again, so the identity is now derived from `buildRegistrationGraph` itself.
 *
 * These cases would all pass under a key that merely added those two fields.
 * The one that would NOT is `edge_type` below: it is in the projection, was in
 * no hand-written list, and is therefore the discriminator that this is derived
 * rather than enumerated.
 */
describe('acknowledgement identity is derived from the registration projection', () => {
  const SC = '55555555-5555-4555-8555-555555555555'
  const N = (extra: Record<string, unknown> = {}) =>
    [
      { id: 'a', type: 'factor', data: { kind: 'factor', label: 'A', starterId: 's', ...extra } },
      { id: 'b', type: 'goal', data: { kind: 'goal', label: 'B', starterId: 's' } },
    ] as any
  const E = (extra: Record<string, unknown> = {}) =>
    [{ source: 'a', target: 'b', data: { weight: 0.4, direction: 'positive', ...extra } }] as any
  const st = (nodes: unknown, edges: unknown, scenarioId: string | null = SC) =>
    ({ nodes, edges, currentScenarioId: scenarioId, importPendingServerRegistration: false }) as never

  beforeEach(() => clearImportRegistrationMarkers())
  afterEach(() => clearImportRegistrationMarkers())

  it('a changed edge strengthStd (wire strength.std) is NOT the acknowledged model', () => {
    markGraphServerAcknowledged(SC, N(), E({ strengthStd: 0.1 }))
    expect(analysisHeldOn(st(N(), E({ strengthStd: 0.1 })))).toBeNull()
    expect(analysisHeldOn(st(N(), E({ strengthStd: 0.8 })))).toBe('starter')
  })

  it('a changed node observedState (wire observed_state) is NOT the acknowledged model', () => {
    markGraphServerAcknowledged(SC, N({ observedState: { value: 0.1 } }), E())
    expect(analysisHeldOn(st(N({ observedState: { value: 0.1 } }), E()))).toBeNull()
    expect(analysisHeldOn(st(N({ observedState: { value: 0.8 } }), E()))).toBe('starter')
  })

  it('⭐ DISCRIMINATOR — edge_type is in the projection and in no hand-written list', () => {
    markGraphServerAcknowledged(SC, N(), E({ edge_type: 'directed' }))
    expect(analysisHeldOn(st(N(), E({ edge_type: 'directed' })))).toBeNull()
    expect(analysisHeldOn(st(N(), E({ edge_type: 'undirected' })))).toBe('starter')
  })

  it('layout and ordering remain equivalent — a re-layout still matches', () => {
    markGraphServerAcknowledged(SC, N(), E())
    const reordered = [...N()].reverse()
    const moved = reordered.map((n: any) => ({ ...n, position: { x: 999, y: 999 } }))
    expect(analysisHeldOn(st(moved, E()))).toBeNull()
  })

  it('a graph the projection REFUSES has no identity, so it is never acknowledged', () => {
    // No resolvable kind: `buildRegistrationGraph` returns unresolvable_node_kind.
    const untypeable = [{ id: 'x', data: { starterId: 's' } }] as any
    markGraphServerAcknowledged(SC, untypeable, [] as any)
    expect(analysisHeldOn(st(untypeable, [] as any))).toBe('starter')
  })
})
