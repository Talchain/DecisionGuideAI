/**
 * THE WRITE-BASE SEED'S GUARDS — each one pinned by a case that fails without it
 * (#1893 review, CHANGES_REQUIRED @ 8b5a6f1e: mutants N1–N5 survived the PR's
 * own spec; N1 survived every spec).
 *
 * `seedWriteBaseAfterRegistration` adopts CEE's `graph_hash` as the edit
 * protocol's compare-and-set base after an acknowledged registration. A wrong
 * base disarms that compare-and-set, so every condition under which it must NOT
 * adopt is pinned here:
 *   · R1 — only a CEE-ACKNOWLEDGED registration seeds (503/409/422, an ack with
 *     no identity, and a superseded ack do not), the value is CEE's verbatim,
 *     and a turn that stamps a base mid-read keeps it (N3, N4);
 *   · R3 — a seed from scenario A never lands on scenario B (N2);
 *   · R2 — a base gone stale is SENT stale for the server to refuse, never
 *     silently refreshed; a foreign write between ack and read means no base;
 *   · R4 — two queued renames of one node: the FIRST intent's rollback wins (N5);
 *   · N1 — the identity comparison binds `projectionVersion` as well as `value`;
 *   · B2 — the seed never throws and never rejects: it is fire-and-forget, so a
 *     throwing read must resolve `notRead`, not surface as an unhandled rejection.
 *
 * ⚠ Real hooks, adapters, store and starter; CEE is a stateful multi-scenario
 *   fake at `fetch`. The read adapter is passed through untouched except in the
 *   N1/B2 cases, which override it per case. Adopted from the Panel reviewer's
 *   probes on #1893.
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
// The read adapter is REAL unless a case installs an override (N1, B2).
const readOverride = vi.hoisted(() => ({ fn: null as null | ((...args: unknown[]) => unknown) }))
vi.mock('../../../adapters/cee/scenarioGraph', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../adapters/cee/scenarioGraph')>()
  return {
    ...actual,
    fetchScenarioGraph: (...args: Parameters<typeof actual.fetchScenarioGraph>) =>
      readOverride.fn ? readOverride.fn(...args) : actual.fetchScenarioGraph(...args),
  }
})

import { useCanvasStore } from '../../store'
import { clearImportRegistrationMarkers } from '../../store/importRegistrationMarker'
import { __resetPersistenceSessionForTests } from '../../../lib/persistenceSession'
import { useImportRegistration } from '../useImportRegistration'
import { useServerGraphHydration } from '../../hooks/useServerGraphHydration'
import { useStructuralRenameEvents } from '../../conversation/useStructuralRenameEvents'
import { useModelEditAuthority } from '../../hooks/useModelEditAuthority'
import { beginModelEditDelivery, editDeliveryHold } from '../editDeliveryHold'
import { seedWriteBaseAfterRegistration } from '../seedWriteBaseAfterRegistration'

const A = '5f0c2a8e-1b7d-4c3e-9a64-0d2b8e7f1c35'
const B = '7a1d3b9f-2c8e-4d4f-8b75-1e3c9f8a2d46'
const NODE_ID = 'fac_market_competition'
const OPTION_ID = 'opt_hybrid'
const FACTOR_ID = 'fac_adoption_friction'

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
    registered: [] as Array<{ tag: string; label: unknown; atLog: number }>,
    readGate: null as Deferred | null,
    /** Another tab's write lands in CEE just before the next read ARRIVES (between the ack and the seeding read). */
    foreignBeforeNextRead: false,
    /** The next read's transport resolves with NO Response — the shape of a fetch fake that does not answer it. */
    nextReadAnswersNothing: false,
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
      const url = String(input)
      if (cee.nextReadAnswersNothing && !url.endsWith('/register')) {
        cee.nextReadAnswersNothing = false
        cee.log.push('read:answered-nothing')
        return resolve(undefined as unknown as Response)
      }
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
      cee.registered.push({ tag, label: body.graph.nodes.find((n) => n.id === 'fac_market_competition')?.label, atLog: cee.log.length - 1 })
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
  readOverride.fn = null
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
const reads = (tag: string) => fake.cee.log.filter((l) => l.startsWith(`read:${tag}:`))

describe('R1 — the seed comes ONLY from a CEE-acknowledged registration', { timeout: 30_000 }, () => {
  it.each([503, 409, 422])('register %s (no acknowledgement): no seeding read, no base', async (status) => {
    fake.cee.registerStatus = status
    await openFreshStarter()
    mount()
    await waitFor(() => expect(fake.cee.log).toContain('register:A'))
    await settle(150)
    expect(reads('A')).toEqual(['read:A:404'])
    expect(base()).toBeNull()
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(true)
  })

  it('an ack that names NO identity: no seeding read, no base', async () => {
    fake.cee.ackWithoutIdentity = true
    await openFreshStarter()
    mount()
    await waitFor(() => expect(fake.cee.log.some((l) => l.startsWith('registered:A'))).toBe(true))
    await waitFor(() => expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false))
    await settle(150)
    expect(reads('A')).toEqual(['read:A:404'])
    expect(base()).toBeNull()
  })

  it('a SUPERSEDED ack (the model changed while registration was in flight): no seeding read, no base', async () => {
    fake.cee.registerGate = deferred()
    await openFreshStarter()
    mount()
    await waitFor(() => expect(fake.cee.log).toContain('register:A'))
    // An analytical change (edge weight) while the registration is on the wire.
    act(() => {
      const s = useCanvasStore.getState()
      const e0 = s.edges[0]!
      useCanvasStore.setState({
        edges: [{ ...e0, data: { ...(e0.data as object), weight: 0.123 } }, ...s.edges.slice(1)],
      } as never)
    })
    act(() => fake.cee.registerGate!.resolve())
    await waitFor(() => expect(fake.cee.log.some((l) => l.startsWith('registered:A'))).toBe(true))
    await settle(150)
    expect(reads('A')).toEqual(['read:A:404'])
    expect(base()).toBeNull()
  })

  it('the seed is CEE\'s issued value VERBATIM (random per registration), never a client-derived hash', async () => {
    await openFreshStarter()
    mount()
    await waitFor(() => expect(base()).not.toBeNull(), { timeout: 10_000 })
    const issued = fake.cee.stored.get(A)!.hash
    expect(base()).toBe(issued)
    expect(reads('A')).toEqual(['read:A:404', 'read:A:200'])
  })

  it('a turn that stamps a base WHILE the seeding read is in flight keeps it (newer authority wins)', async () => {
    fake.cee.registerGate = deferred()
    await openFreshStarter()
    mount()
    await waitFor(() => expect(fake.cee.log).toContain('register:A'), { timeout: 10_000 })
    fake.cee.readGate = deferred()
    const rg = fake.cee.registerGate!
    fake.cee.registerGate = null
    act(() => rg.resolve())
    await waitFor(() => expect(reads('A')).toContain('read:A:200'), { timeout: 10_000 })
    expect(base()).toBeNull()
    act(() => useCanvasStore.getState().setLastServerGraphHash('7777777777777777'))
    act(() => fake.cee.readGate!.resolve())
    await settle(100)
    expect(base()).toBe('7777777777777777')
  })
})

describe('R3 — a seed from scenario A is never used for scenario B', { timeout: 30_000 }, () => {
  it('switch A→B while A\'s seeding read is in flight: A\'s hash never lands; B is seeded only with B\'s own hash', async () => {
    fake.cee.registerGate = deferred()
    await openFreshStarter(A)
    mount()
    await waitFor(() => expect(fake.cee.log).toContain('register:A'), { timeout: 10_000 })
    fake.cee.readGate = deferred()
    const rg = fake.cee.registerGate!
    fake.cee.registerGate = null
    act(() => rg.resolve())
    await waitFor(() => expect(reads('A')).toContain('read:A:200'), { timeout: 10_000 })
    expect(base()).toBeNull()
    const aHash = fake.cee.stored.get(A)!.hash
    // Production switch path: useScenario → hydrateGraphSlice({ currentScenarioId }).
    const st = useCanvasStore.getState()
    act(() => {
      useCanvasStore.getState().hydrateGraphSlice({ nodes: st.nodes, edges: st.edges, currentScenarioId: B, goalConstraints: null })
    })
    expect(useCanvasStore.getState().currentScenarioId).toBe(B)
    expect(base()).toBeNull()
    const gate = fake.cee.readGate!
    fake.cee.readGate = null
    act(() => gate.resolve())
    await settle(100)
    expect(base()).not.toBe(aHash)
    // B registers on its own and is seeded with B's hash only.
    await waitFor(() => expect(fake.cee.stored.get(B)).toBeDefined(), { timeout: 10_000 })
    await waitFor(() => expect(base()).not.toBeNull(), { timeout: 10_000 })
    expect(base()).toBe(fake.cee.stored.get(B)!.hash)
    expect(base()).not.toBe(aHash)
  })

  it('switch A→B while A\'s REGISTRATION is in flight: A\'s ack seeds nothing (cancelled)', async () => {
    fake.cee.registerGate = deferred()
    await openFreshStarter(A)
    mount()
    await waitFor(() => expect(fake.cee.log).toContain('register:A'))
    const st = useCanvasStore.getState()
    act(() => {
      useCanvasStore.getState().hydrateGraphSlice({ nodes: st.nodes, edges: st.edges, currentScenarioId: B, goalConstraints: null })
    })
    const gate = fake.cee.registerGate!
    act(() => gate.resolve())
    await settle(200)
    expect(reads('A')).toEqual(['read:A:404'])
    const aHash = fake.cee.stored.get(A)?.hash
    if (aHash) expect(base()).not.toBe(aHash)
  })
})

describe('R2 — CAS: a base that has gone stale is SENT stale (for the server to refuse), never silently refreshed', { timeout: 30_000 }, () => {
  it('CEE advances (another tab) after the seed: the first option edit carries the SEEDED base, and no re-read absorbs the foreign write', async () => {
    await openFreshStarter()
    const sendEvent = vi.fn().mockResolvedValue('sent')
    optionSend.fn = sendEvent
    mount()
    const authority = renderHook(() => useModelEditAuthority(OPTION_ID)).result
    await waitFor(() => expect(base()).not.toBeNull(), { timeout: 10_000 })
    const seeded = base()!
    // Another tab's write lands in CEE: new identity, new analysis hash.
    const prev = fake.cee.stored.get(A)!
    fake.cee.stored.set(A, { ...prev, identity: 'idv1-other-tab', hash: 'ffffffffffff0bad' })
    const readsBefore = reads('A').length
    let outcome: unknown
    act(() => { outcome = authority.current.proposeOptionIntervention(FACTOR_ID, 0.25) })
    expect(outcome).toBe('dispatched')
    expect((sendEvent.mock.calls[0]![0] as { payload: { base_graph_hash: string } }).payload.base_graph_hash).toBe(seeded)
    expect(seeded).not.toBe('ffffffffffff0bad')
    await settle(100)
    expect(reads('A').length).toBe(readsBefore)
  })

  it('CEE advances BETWEEN the ack and the seeding read: no base, the first option edit fails closed (needs_fresh_base)', async () => {
    await openFreshStarter()
    const sendEvent = vi.fn().mockResolvedValue('sent')
    optionSend.fn = sendEvent
    mount()
    fake.cee.registerGate = deferred()
    const authority = renderHook(() => useModelEditAuthority(OPTION_ID)).result
    await waitFor(() => expect(fake.cee.log).toContain('register:A'))
    fake.cee.foreignBeforeNextRead = true
    act(() => fake.cee.registerGate!.resolve())
    await waitFor(() => expect(fake.cee.log).toContain('foreign-write'), { timeout: 10_000 })
    await settle(100)
    expect(reads('A')).toEqual(['read:A:404', 'read:A:200'])
    expect(base()).toBeNull()
    let outcome: unknown
    act(() => { outcome = authority.current.proposeOptionIntervention(FACTOR_ID, 0.25) })
    expect(outcome).toBe('needs_fresh_base')
    expect(sendEvent).not.toHaveBeenCalled()
  })
})

describe('R4 — two queued renames of one node before the first registration', { timeout: 30_000 }, () => {
  it('the registration carries the label BEFORE either rename (first intent\'s expected label), and both go out on the protocol in order', async () => {
    await openFreshStarter()
    const original = (useCanvasStore.getState().nodes.find((n) => n.id === NODE_ID)!.data as { label: string }).label
    act(() => { useCanvasStore.getState().updateNodeLabel(NODE_ID, 'First rename') })
    act(() => { useCanvasStore.getState().updateNodeLabel(NODE_ID, 'Second rename') })
    // PRECONDITION: two intents, queued in order, neither with a base.
    const queued = useCanvasStore.getState().pendingStructuralRenames
    expect(queued.map((r) => [r.nodeId, r.label, r.baseGraphHash])).toEqual([
      [NODE_ID, 'First rename', null],
      [NODE_ID, 'Second rename', null],
    ])
    // Production-faithful: sendSystemEvent marks the edit on the wire synchronously and releases in finally.
    const sent = vi.fn().mockImplementation(async (ev: { type: string; payload: unknown }) => {
      const release = beginModelEditDelivery(ev.type)
      try {
        fake.cee.log.push(`send:${JSON.stringify(ev.payload)}`)
        await new Promise((r) => setTimeout(r, 10))
        // As sendTurn does on an APPLIED receipt: settle the in-flight record before returning.
        const rec = useCanvasStore.getState().structuralRenameLifecycle.find((r) => r.status === 'in_flight')
        if (rec) useCanvasStore.getState().settleStructuralRename(rec.intent.id, 'committed')
        return {}
      } finally {
        release()
      }
    })
    fake.cee.registerGate = deferred()
    mount(sent)
    await waitFor(() => expect(fake.cee.log).toContain('register:A'), { timeout: 10_000 })
    act(() => fake.cee.registerGate!.resolve())
    await waitFor(() => expect(fake.cee.stored.get(A)).toBeDefined())
    await waitFor(() => expect(sent).toHaveBeenCalled(), { timeout: 10_000 })
    await settle(300)
    expect(fake.cee.registered[0]!.label).toBe(original)
    await waitFor(() => expect(sent).toHaveBeenCalledTimes(2), { timeout: 10_000 })
    const seeded = fake.cee.log.find((l) => l.startsWith('registered:A:'))!.split(':')[2]
    expect(base()).toBe(seeded)
    const first = sent.mock.calls[0]![0] as { payload: { label: string; expected_label: string; base_graph_hash: string } }
    const second = sent.mock.calls[1]![0] as { payload: { label: string; expected_label: string; base_graph_hash: string } }
    expect(first.payload).toMatchObject({ label: 'First rename', expected_label: original, base_graph_hash: seeded })
    expect(second.payload).toMatchObject({ label: 'Second rename', expected_label: 'First rename', base_graph_hash: seeded })
    // No registration BEFORE the first protocol send carries a new label (the side channel stays shut).
    const firstSendAt = fake.cee.log.findIndex((l) => l.startsWith('send:'))
    for (const r of fake.cee.registered.filter((x) => x.atLog < firstSendAt)) expect(r.label).toBe(original)
  })
})

const ACK_IDENTITY = { value: 'idv1-A-1', projectionVersion: 'identity.v1' } as const
const READ_HASH = 'aag_from_the_read'
/** A 200 read naming `identity` — only the fields the seed reads carry meaning. */
function readNaming(identity: { value: string; projectionVersion: string }) {
  return async () => ({
    status: 'graph', graph: { nodes: [], edges: [] }, briefText: null, notModelled: null,
    identity, graphHash: READ_HASH, layoutPresent: false, analysisState: null, analysisResult: null,
    requestId: 'req-read',
  })
}
const onScenarioWithNoBase = () =>
  useCanvasStore.setState({ currentScenarioId: A, lastServerGraphHash: null } as never)

describe('N1 — the seed binds the identity by projectionVersion as well as value', { timeout: 30_000 }, () => {
  it('a read naming the SAME value under a DIFFERENT projectionVersion adopts nothing', async () => {
    onScenarioWithNoBase()
    readOverride.fn = readNaming({ value: ACK_IDENTITY.value, projectionVersion: 'identity.v2' })
    // ⭐ Values from different projections are not comparable, so equal bytes
    //    prove nothing about the graph — no base may be adopted from them.
    await expect(seedWriteBaseAfterRegistration(A, ACK_IDENTITY)).resolves.toBe('identityMismatch')
    expect(base()).toBeNull()
  })

  it('CONTROL: the same read under the SAME projectionVersion seeds its graph_hash', async () => {
    onScenarioWithNoBase()
    readOverride.fn = readNaming({ value: ACK_IDENTITY.value, projectionVersion: ACK_IDENTITY.projectionVersion })
    await expect(seedWriteBaseAfterRegistration(A, ACK_IDENTITY)).resolves.toBe('seeded')
    expect(base()).toBe(READ_HASH)
  })
})

describe('B2 — the seed never throws and never rejects (it is fired and forgotten)', { timeout: 30_000 }, () => {
  const throwsSynchronously = () => {
    throw new TypeError("Cannot read properties of undefined (reading 'status')")
  }
  const rejects = async () => {
    throw new TypeError("Cannot read properties of undefined (reading 'status')")
  }
  /** Collects every unhandled rejection raised while `body` runs and settles. */
  async function unhandledRejectionsDuring(body: () => void | Promise<void>): Promise<unknown[]> {
    const seen: unknown[] = []
    const onUnhandled = (reason: unknown) => { seen.push(reason) }
    process.on('unhandledRejection', onUnhandled)
    try {
      await body()
      await new Promise((r) => setTimeout(r, 50))
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
    return seen
  }

  it.each([
    ['synchronously', throwsSynchronously],
    ['asynchronously', rejects],
  ])('a read that throws %s resolves `notRead` and adopts nothing', async (_how, thrower) => {
    onScenarioWithNoBase()
    readOverride.fn = thrower
    await expect(seedWriteBaseAfterRegistration(A, ACK_IDENTITY)).resolves.toBe('notRead')
    expect(base()).toBeNull()
  })

  it.each([
    ['synchronously', throwsSynchronously],
    ['asynchronously', rejects],
  ])('fired and forgotten, a read that throws %s raises NO unhandled rejection', async (_how, thrower) => {
    onScenarioWithNoBase()
    readOverride.fn = thrower
    const unhandled = await unhandledRejectionsDuring(() => {
      void seedWriteBaseAfterRegistration(A, ACK_IDENTITY)
    })
    expect(unhandled).toEqual([])
    expect(base()).toBeNull()
  })

  it('THROUGH THE REAL REGISTRATION: a seeding read whose transport answers nothing raises no unhandled rejection and adopts nothing', async () => {
    fake.cee.registerGate = deferred()
    await openFreshStarter()
    mount()
    await waitFor(() => expect(fake.cee.log).toContain('register:A'), { timeout: 10_000 })
    const unhandled = await unhandledRejectionsDuring(async () => {
      fake.cee.nextReadAnswersNothing = true
      const gate = fake.cee.registerGate!
      fake.cee.registerGate = null
      act(() => gate.resolve())
      await waitFor(() => expect(fake.cee.log).toContain('read:answered-nothing'), { timeout: 10_000 })
      await settle(100)
    })
    // PRECONDITION: the registration WAS acknowledged, so the seed really ran.
    expect(fake.cee.log.some((l) => l.startsWith('registered:A:'))).toBe(true)
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false)
    // ⭐ THE CLAIM.
    expect(unhandled).toEqual([])
    expect(base()).toBeNull()
  })
})
