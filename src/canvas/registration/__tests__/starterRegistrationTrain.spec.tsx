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
} from '../../utils/analysisHeldOnInjectedModel'
import { useCanvasStore } from '../../store'
import {
  clearImportRegistrationMarkers,
  isGraphPendingImportRegistration,
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
describe('seam 3 — analysisHeldOn carries the registration conjunct', () => {
  it('HOLDS a starter the server has not acknowledged', () => {
    const held = analysisHeldOn({ nodes: STARTER_NODES, importPendingServerRegistration: true })
    expect(held).toBe('starter')
    expect(analysisHeldNotice({ nodes: STARTER_NODES, importPendingServerRegistration: true })).toBe(
      ANALYSIS_HELD_NOTICE.starter,
    )
  })

  it('RELEASES once CEE has acknowledged holding the graph', () => {
    // ⭐ THE CAPABILITY. The stamp is still on every node — it survives
    // persistence by design — so nothing about the graph changed. What changed
    // is that the server now holds it, which is the only thing the hold was
    // ever about.
    const held = analysisHeldOn({ nodes: STARTER_NODES, importPendingServerRegistration: false })
    expect(held).toBeNull()
    expect(analysisHeldNotice({ nodes: STARTER_NODES, importPendingServerRegistration: false })).toBeNull()
  })

  it('DISCRIMINATES: an armed hold on a CEE-drafted graph is still not held', () => {
    // The pair-mate of the case above. Without this, an implementation that
    // simply returned the flag would pass — and would then claim a live CEE
    // draft was "a saved example".
    expect(analysisHeldOn({ nodes: DRAFTED_NODES, importPendingServerRegistration: true })).toBeNull()
  })

  it('is still scoped to the V5 canonical run path', () => {
    // A V2-direct run SENDS the canvas graph, so nothing is held there — the
    // conjunct this lane added must not have swallowed the one already here.
    isV5CanonicalRunPathMock.mockReturnValue(false)
    expect(analysisHeldOn({ nodes: STARTER_NODES, importPendingServerRegistration: true })).toBeNull()
    // CONTROL, same run: the identical input DOES hold on the canonical path,
    // so the null above is the run path's doing and not a dead fixture.
    isV5CanonicalRunPathMock.mockReturnValue(true)
    expect(analysisHeldOn({ nodes: STARTER_NODES, importPendingServerRegistration: true })).toBe('starter')
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
