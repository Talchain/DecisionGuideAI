/**
 * A QUEUED GOAL RENAME IS ROLLED BACK WHOLE — LABEL AND PROVENANCE — BEFORE A
 * REGISTRATION MAY CARRY THE NODE (#1893 review B1, CHANGES_REQUIRED @ 8b5a6f1e).
 *
 * ── THE DEFECT ──────────────────────────────────────────────────────────────
 * A rename made while no write base exists is queued, and the registration that
 * leaves in that window carries the node ROLLED BACK (`withQueuedRenamesRolledBack`)
 * so the unsent label never rides the side channel. At `8b5a6f1e` the rollback
 * restored only `data.label`. But `updateNodeLabel` on a GOAL also stamps
 * `provenance: 'user_set'` (`provenanceAfterHumanAuthoredLabel`), which
 * `buildRegistrationGraph` passes through and the analytical digest hashes. So:
 *   · G1 — a goal rename queued before the first registration: that registration
 *     carried the AI's old goal label under `provenance: 'user_set'` — a false
 *     human-authorship claim CEE stores verbatim (wire-witnessed by the reviewer).
 *   · G2 — a goal rename made while the registration was in flight: the rolled-back
 *     live canvas differed from the snapshot by provenance, so the ack read as
 *     superseded, nothing was seeded, and the rename was stranded.
 *   · G3 — a goal rename made while the seeding read was in flight: a second
 *     whole-graph registration left before the rename, again old label + `user_set`.
 * The identical three on a FACTOR (whose rename writes no provenance) are the
 * contrast: GREEN before and after the fix, so the probe is not blind.
 *
 * ── WHAT THIS PINS ──────────────────────────────────────────────────────────
 * The rollback restores the FIRST queued intent's own `restore` record — the
 * label, plus the provenance put back or deleted per `provenanceWasPresent` —
 * the same two-field restore a refused rename uses (`nodeDataWithRenameRestored`).
 *
 * ⚠ Real hooks, adapters, store and starter. CEE is a stateful multi-scenario
 *   fake at `fetch`. Adopted from the Panel reviewer's probe on #1893.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

vi.mock('../../../v5/eligibility', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../v5/eligibility')>()),
  isV5CanonicalRunPath: () => true,
}))
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isOrchestratorV2Enabled: () => true,
}))
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}))
vi.mock('../../../lib/supabase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/supabase')>()),
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
const optionSend = vi.hoisted(() => ({ fn: null as null | ((...args: unknown[]) => unknown) }))
vi.mock('../../conversation/ConversationContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../conversation/ConversationContext')>()),
  useOptionalConversationContext: () => ({
    sendSystemEvent: (...args: unknown[]) => optionSend.fn?.(...args),
  }),
}))

import { useCanvasStore } from '../../store'
import { clearImportRegistrationMarkers } from '../../store/importRegistrationMarker'
import { __resetPersistenceSessionForTests } from '../../../lib/persistenceSession'
import { useImportRegistration } from '../useImportRegistration'
import { useServerGraphHydration } from '../../hooks/useServerGraphHydration'
import { useStructuralRenameEvents } from '../../conversation/useStructuralRenameEvents'
import { beginModelEditDelivery, editDeliveryHold } from '../editDeliveryHold'

const A = '5f0c2a8e-1b7d-4c3e-9a64-0d2b8e7f1c35'

interface Deferred { promise: Promise<void>; resolve: () => void }
function deferred(): Deferred {
  let resolve!: () => void
  const promise = new Promise<void>((r) => { resolve = r })
  return { promise, resolve }
}

type Stored = { graph: { nodes: Array<Record<string, unknown>>; edges: unknown[] }; identity: string; hash: string }

function makeFakeCee() {
  const cee = {
    stored: new Map<string, Stored>(),
    n: 0,
    log: [] as string[],
    registerStatus: 200 as number,
    ackWithoutIdentity: false,
    registerGate: null as Deferred | null,
    registered: [] as Array<{ tag: string; label: unknown; atLog: number; goal?: unknown }>,
    registeredBodies: [] as Array<{ nodes: Array<Record<string, unknown>> }>,
    readGate: null as Deferred | null,
    /** Another tab's write lands in CEE just before the next read ARRIVES (between the ack and the seeding read). */
    foreignBeforeNextRead: false,
    /** The analysis hash CEE issues for registration n in scenario s — random-looking, never derivable client-side. */
    hashFor: (s: string, n: number) => `${s === A ? 'a' : 'b'}${String(n).padStart(3, '0')}f00dcafe0${Math.floor(Math.random() * 1e5).toString(16).padStart(5, '0')}`.slice(0, 16),
  }
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  const fetchFake = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
    new Promise<Response>((resolve, reject) => {
      const signal = init?.signal
      const abort = () => reject(new DOMException('The operation was aborted.', 'AbortError'))
      if (signal?.aborted) return abort()
      signal?.addEventListener('abort', abort, { once: true })
      answer(input, init).then(resolve, reject)
    })
  const answer = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input)
    const m = /^\/bff\/cee\/scenarios\/([0-9a-f-]{36})\/graph(\/register)?$/.exec(url)
    if (!m) { cee.log.push(`unexpected:${url}`); return json(500, {}) }
    const sid = m[1]!
    const tag = sid === A ? 'A' : 'B'
    if (m[2]) {
      cee.log.push(`register:${tag}`)
      const body = JSON.parse(String(init?.body)) as { graph: Stored['graph'] }
      const g = body.graph.nodes.find((n) => n.id === 'goal_pricing_transition')
      cee.registeredBodies.push(body.graph)
      cee.registered.push({ tag, label: body.graph.nodes.find((n) => n.id === 'fac_market_competition')?.label, atLog: cee.log.length - 1, goal: g ? { label: g.label, provenance: g.provenance } : undefined })
      if (cee.registerGate) await cee.registerGate.promise
      if (cee.registerStatus !== 200) return json(cee.registerStatus, { schema: 'error.v1', code: 'X', message: 'x' })
      cee.n += 1
      const identity = `idv1-${tag}-${cee.n}`
      const hash = cee.hashFor(sid, cee.n)
      cee.stored.set(sid, { graph: body.graph, identity, hash })
      cee.log.push(`registered:${tag}:${hash}`)
      return json(200, {
        schema: 'scenario_graph_registration.v1',
        scenario_id: sid,
        registered: true,
        ...(cee.ackWithoutIdentity ? {} : { graph_identity_hash: { kind: 'graph_identity_hash', value: identity, projection_version: 'identity.v1' } }),
        node_count: body.graph.nodes.length,
        edge_count: body.graph.edges.length,
        request_id: `req-register-${cee.n}`,
      })
    }
    if (cee.foreignBeforeNextRead && cee.stored.get(sid)) {
      cee.foreignBeforeNextRead = false
      const prev = cee.stored.get(sid)!
      cee.stored.set(sid, { ...prev, identity: 'idv1-other-tab', hash: 'ffffffffffff0bad' })
      cee.log.push('foreign-write')
    }
    const snap = cee.stored.get(sid)
    cee.log.push(snap ? `read:${tag}:200` : `read:${tag}:404`)
    const gate = cee.readGate
    if (gate) await gate.promise
    if (!snap) return json(404, { schema: 'error.v1', code: 'NOT_FOUND', message: 'not found' })
    return json(200, {
      schema: 'scenario_graph.v1', scenario_id: sid, graph: snap.graph, graph_present: true, brief_text: null,
      graph_identity_hash: { kind: 'graph_identity_hash', value: snap.identity, projection_version: 'identity.v1' },
      graph_hash: snap.hash, layout_present: false, not_modelled: null, analysis_state: null, analysis_result: null,
      request_id: 'req-read',
    })
  }
  return { cee, fetchFake }
}

let fake: ReturnType<typeof makeFakeCee>

beforeEach(() => {
  clearImportRegistrationMarkers()
  __resetPersistenceSessionForTests()
  fake = makeFakeCee()
  vi.stubGlobal('fetch', vi.fn(fake.fetchFake))
})
afterEach(async () => {
  while (mounted.length) mounted.pop()!()
  // ⚠ ISOLATION. A rename drain OUTLIVES its hook by design
  // (`useStructuralRenameEvents`: "this code outlives the React instance"), so a
  // case that ends mid-send would let its drain take the NEXT case's queued
  // rename (measured: a failing GOAL case then stranded the factor contrast).
  // Empty the queue and wait for the on-the-wire mark to clear, so every drain
  // has exited before the next case begins.
  useCanvasStore.setState({ pendingStructuralRenames: [] } as never)
  await waitFor(() => expect(editDeliveryHold({ nodes: [] })).toBeNull(), { timeout: 8000 })
  await settle(20)
  vi.unstubAllGlobals()
  __resetPersistenceSessionForTests()
  optionSend.fn = null
})

async function openFreshStarter(sid = A) {
  const { applyStarter } = await import('../../starters/loadStarter')
  await applyStarter('pricing-model')
  useCanvasStore.setState({
    currentScenarioId: sid, lastServerGraphHash: null, serverGraphIdentity: null,
    pendingStructuralRenames: [], structuralRenameLifecycle: [], _externalMutationActive: 0,
  } as never)
}
const mounted: Array<() => void> = []
function mount(sent = vi.fn().mockResolvedValue({})) {
  const h = renderHook(() => {
    useServerGraphHydration(null)
    useImportRegistration()
    useStructuralRenameEvents(sent as never)
  })
  mounted.push(h.unmount)
  return h
}
const settle = (ms = 80) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
const base = () => useCanvasStore.getState().lastServerGraphHash


const GOAL = 'goal_pricing_transition'
const FACTOR = 'fac_market_competition'
const RENAMED = 'Renamed by the user'
const dataOf = (id: string) => useCanvasStore.getState().nodes.find((n) => n.id === id)!.data as { label: string; provenance?: unknown }
/** CEE's issued hash for the FIRST registration — a later re-registration stores a new one. */
const firstIssuedHash = () => fake.cee.log.find((l) => l.startsWith('registered:A:'))!.split(':')[2]
const labelAndProvenance = (graph: { nodes: Array<Record<string, unknown>> }, id: string) => {
  const n = graph.nodes.find((x) => x.id === id)! as { label: unknown; provenance?: unknown }
  return { label: n.label, provenance: n.provenance }
}

/** Production-faithful sender: on-the-wire mark set synchronously, the applied receipt settles `committed`, then release. */
function faithfulSender() {
  return vi.fn().mockImplementation(async (ev: { type: string; payload: unknown }) => {
    const release = beginModelEditDelivery(ev.type)
    try {
      fake.cee.log.push(`send:${ev.type}`)
      await new Promise((r) => setTimeout(r, 10))
      const rec = useCanvasStore.getState().structuralRenameLifecycle.find((r) => r.status === 'in_flight')
      if (rec) useCanvasStore.getState().settleStructuralRename(rec.intent.id, 'committed')
      return {}
    } finally {
      release()
    }
  })
}

// Each case drives the real registration, seed and drain through a stateful
// fake; the default 5 s budget measures machine load, not behaviour.
describe('B1 — a queued rename is rolled back whole before a registration carries it', { timeout: 30_000 }, () => {
  describe.each([
    // A goal rename stamps `provenance: 'user_set'` — the case B1 is about.
    ['GOAL', GOAL, true],
    // CONTRAST: a factor rename writes no provenance, so it was never affected.
    ['CONTRAST factor', FACTOR, false],
  ] as const)('%s renamed in the base-less window', (_kind, NODE, renameStampsProvenance) => {
    it('G1 rename queued BEFORE the first registration: that registration carries the node as CEE is about to hold it — label AND provenance pre-rename', async () => {
      await openFreshStarter()
      const before = { ...dataOf(NODE) }
      act(() => { useCanvasStore.getState().updateNodeLabel(NODE, RENAMED) })
      // PRECONDITION: the rename is on the canvas and queued, and on a goal it
      // really did stamp the human-authorship provenance the rollback must undo.
      expect(dataOf(NODE).label).toBe(RENAMED)
      expect(useCanvasStore.getState().pendingStructuralRenames.map((r) => r.nodeId)).toEqual([NODE])
      if (renameStampsProvenance) {
        expect(before.provenance).not.toBe('user_set')
        expect(dataOf(NODE).provenance).toBe('user_set')
      } else {
        expect(dataOf(NODE).provenance).toEqual(before.provenance)
      }
      const sent = faithfulSender()
      mount(sent)
      await waitFor(() => expect(sent).toHaveBeenCalled(), { timeout: 10_000 })
      await settle(200)
      // ⭐ THE CLAIM, bound to the exact node in the exact first registration body.
      expect(labelAndProvenance(fake.cee.registeredBodies[0]!, NODE)).toEqual({
        label: before.label,
        provenance: before.provenance,
      })
      // The canvas itself is untouched by the rollback — it is a snapshot view only.
      expect(dataOf(NODE).label).toBe(RENAMED)
    })

    it('G2 rename made while the REGISTRATION is in flight: the ack is still current, the base is seeded and the rename is SENT', async () => {
      fake.cee.registerGate = deferred()
      await openFreshStarter()
      const sent = faithfulSender()
      mount(sent)
      await waitFor(() => expect(fake.cee.log).toContain('register:A'), { timeout: 10_000 })
      act(() => { useCanvasStore.getState().updateNodeLabel(NODE, RENAMED) })
      expect(useCanvasStore.getState().pendingStructuralRenames).toHaveLength(1)
      const gate = fake.cee.registerGate!
      fake.cee.registerGate = null
      act(() => gate.resolve())
      await settle(400)
      // ⭐ Seeded with CEE's own hash for the registered graph, and the rename left
      //    on the edit protocol carrying it — not stranded as a superseded ack.
      expect(base()).toBe(firstIssuedHash())
      expect(sent).toHaveBeenCalledTimes(1)
      expect((sent.mock.calls[0]![0] as { payload: unknown }).payload).toMatchObject({
        node_id: NODE,
        label: RENAMED,
        base_graph_hash: firstIssuedHash(),
      })
    })

    it('G3 rename made while the SEEDING READ is in flight: no registration leaves before the seed, and none carries a provenance the user did not author', async () => {
      fake.cee.registerGate = deferred()
      await openFreshStarter()
      const before = { ...dataOf(NODE) }
      const sent = faithfulSender()
      mount(sent)
      await waitFor(() => expect(fake.cee.log).toContain('register:A'), { timeout: 10_000 })
      const heldRead = deferred()
      fake.cee.readGate = heldRead
      const gate = fake.cee.registerGate!
      fake.cee.registerGate = null
      act(() => gate.resolve())
      await waitFor(() => expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false))
      await waitFor(() => expect(fake.cee.log).toContain('read:A:200'), { timeout: 10_000 })
      expect(base()).toBeNull()
      act(() => { useCanvasStore.getState().updateNodeLabel(NODE, RENAMED) })
      await settle(400)
      const during = fake.cee.registeredBodies.map((g) => labelAndProvenance(g, NODE))
      fake.cee.readGate = null
      act(() => heldRead.resolve())
      await settle(400)
      // ⭐ Only the original registration, carrying the node as it was.
      expect(during).toEqual([{ label: before.label, provenance: before.provenance }])
      // And the rename then travels the protocol on the seeded base.
      expect(base()).toBe(firstIssuedHash())
      expect(sent).toHaveBeenCalledTimes(1)
    })
  })
})
