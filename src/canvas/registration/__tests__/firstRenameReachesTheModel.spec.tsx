/**
 * A FIRST RENAME ON A FRESHLY OPENED SAVED EXAMPLE MUST REACH THE EDIT PROTOCOL.
 *
 * ── THE DEFECT, MEASURED ON SERVED STAGING (UI `8151fba5`, 22 Sep 2026) ──────
 * Fresh guest, pricing starter. The boot read `POST …/graph` answered 404 (the
 * scenario did not exist in CEE yet), then `useImportRegistration` registered
 * the canvas (`…/graph/register` → 200). The registration ack carries only an
 * `identity.v1` token — never the analysis-affecting `graph_hash` the edit
 * protocol's compare-and-set needs — so `lastServerGraphHash` stayed null.
 * `useStructuralRenameEvents` HOLDS its queue while that field is empty, so the
 * user's first rename sat in `pendingStructuralRenames` and no
 * `structural_rename` turn was ever sent. The label reached CEE only through a
 * whole-graph re-registration: persisted, with no authorship.
 *
 * ── WHAT THIS PINS ────────────────────────────────────────────────────────
 * After an acknowledged registration, CEE's own `graph_hash` is read back and
 * adopted as the write base, so the queued rename flushes through the edit
 * protocol carrying THAT hash — and the read touches nothing but the hash.
 *
 * ⚠ THE HOOKS, THE ADAPTERS AND THE STORE ARE ALL REAL. The only fake is CEE
 *   itself, at `fetch`: a stateful server that 404s the read until a
 *   registration commits, then answers the read from what it stored. The
 *   rename sender is a double because its transport (`sendTurn`) is not under
 *   test here; the payload it is handed IS the wire payload.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

// The hold's run-path conjunct is OFF under test by default; staging runs it ON,
// and it is what makes a rename re-arm the registration (witnessed: the second
// `graph/register` carried the new label). Leave it live so that side channel
// is exercised rather than silently absent (trap 13b).
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
// The Model tab's option-target Save commits through `useModelEditAuthority`,
// which sends through the conversation. The conversation's transport is not
// under test; the event it is handed IS the wire payload. Read lazily, so the
// double is resolved at call time rather than at hoist time.
const optionSend = vi.hoisted(() => ({ fn: null as null | ((...args: unknown[]) => unknown) }))
vi.mock('../../conversation/ConversationContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../conversation/ConversationContext')>()),
  useOptionalConversationContext: () => ({
    sendSystemEvent: (...args: unknown[]) => optionSend.fn?.(...args),
  }),
}))

import { useCanvasStore } from '../../store'
import { __resetCeeHeldModelLatchForTest } from '../ceeHeldModel'
import { clearImportRegistrationMarkers } from '../../store/importRegistrationMarker'
import { __resetPersistenceSessionForTests } from '../../../lib/persistenceSession'
import { useImportRegistration } from '../useImportRegistration'
import { editDeliveryHold } from '../editDeliveryHold'
import { useServerGraphHydration } from '../../hooks/useServerGraphHydration'
import { useStructuralRenameEvents } from '../../conversation/useStructuralRenameEvents'
import { useModelEditAuthority } from '../../hooks/useModelEditAuthority'

const SCENARIO = '5f0c2a8e-1b7d-4c3e-9a64-0d2b8e7f1c35'
const REGISTER_URL = `/bff/cee/scenarios/${SCENARIO}/graph/register`
const READ_URL = `/bff/cee/scenarios/${SCENARIO}/graph`
/** CEE's analysis-affecting hash for the stored graph. Label is NOT in its projection. */
const READ_HASH = 'a1b2c3d4e5f60718'
const NODE_ID = 'fac_market_competition'
const NEW_LABEL = 'Market competition FIRST'
/** Written into the READ's copy of the graph only. If it ever reaches the canvas, the read replaced it. */
const SERVER_SENTINEL_LABEL = 'SERVER COPY — must never reach the canvas'

interface Deferred {
  promise: Promise<void>
  resolve: () => void
}
function deferred(): Deferred {
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

/** A stateful fake of CEE's two scenario-graph routes. */
function makeFakeCee() {
  const cee = {
    stored: null as null | { graph: { nodes: Array<Record<string, unknown>>; edges: unknown[] }; identity: string },
    registrations: 0,
    log: [] as string[],
    /** Every graph a registration carried, in arrival order. */
    registeredGraphs: [] as Array<{ nodes: Array<Record<string, unknown>>; edges: unknown[] }>,
    registerGate: deferred(),
    readGate: null as Deferred | null,
    /** When set, the read names a DIFFERENT stored graph than the ack did. */
    readIdentityOverride: null as string | null,
  }
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  // ⚠ HONOURS `init.signal` EXACTLY AS A BROWSER DOES. A first cut ignored it,
  //   and a mutant that handed the seeding read an already-doomed signal
  //   SURVIVED — the fake answered a request the browser would have aborted.
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
    if (url === REGISTER_URL) {
      cee.log.push('register')
      const body = JSON.parse(String(init?.body)) as { graph: { nodes: Array<Record<string, unknown>>; edges: unknown[] } }
      cee.registeredGraphs.push(body.graph)
      await cee.registerGate.promise
      cee.registrations += 1
      const identity = `idv1-registration-${cee.registrations}`
      cee.stored = { graph: body.graph, identity }
      return json(200, {
        schema: 'scenario_graph_registration.v1',
        scenario_id: SCENARIO,
        registered: true,
        graph_identity_hash: { kind: 'graph_identity_hash', value: identity, projection_version: 'identity.v1' },
        node_count: body.graph.nodes.length,
        edge_count: body.graph.edges.length,
        request_id: `req-register-${cee.registrations}`,
      })
    }
    if (url === READ_URL) {
      // The server answers from its state WHEN THE REQUEST ARRIVES.
      const snapshot = cee.stored
      cee.log.push(snapshot ? 'read:200' : 'read:404')
      const gate = cee.readGate
      if (gate) await gate.promise
      if (!snapshot) return json(404, { schema: 'error.v1', code: 'NOT_FOUND', message: 'not found' })
      const graph = {
        ...snapshot.graph,
        nodes: snapshot.graph.nodes.map((n) => (n.id === NODE_ID ? { ...n, label: SERVER_SENTINEL_LABEL } : n)),
      }
      return json(200, {
        schema: 'scenario_graph.v1',
        scenario_id: SCENARIO,
        graph,
        graph_present: true,
        brief_text: null,
        graph_identity_hash: {
          kind: 'graph_identity_hash',
          value: cee.readIdentityOverride ?? snapshot.identity,
          projection_version: 'identity.v1',
        },
        graph_hash: READ_HASH,
        layout_present: false,
        not_modelled: null,
        analysis_state: null,
        analysis_result: null,
        request_id: 'req-read',
      })
    }
    cee.log.push(`unexpected:${url}`)
    return json(500, {})
  }
  return { cee, fetchFake }
}

/** The label of NODE_ID currently on the canvas. */
function canvasLabelOf(id: string): unknown {
  return (useCanvasStore.getState().nodes.find((n) => n.id === id)?.data as { label?: unknown } | undefined)?.label
}

async function openFreshStarter() {
  const { applyStarter } = await import('../../starters/loadStarter')
  await applyStarter('pricing-model')
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    lastServerGraphHash: null,
    serverGraphIdentity: null,
    pendingStructuralRenames: [],
    structuralRenameLifecycle: [],
    _externalMutationActive: 0,
  } as never)
}

function mountCanvasHooks(sent: ReturnType<typeof vi.fn>) {
  return renderHook(() => {
    useServerGraphHydration(null)
    useImportRegistration()
    useStructuralRenameEvents(sent as never)
  })
}

let fake: ReturnType<typeof makeFakeCee>

beforeEach(() => {
  clearImportRegistrationMarkers()
  // OW-1: the one-writer latch is page-life state keyed by scenario; each case is a fresh page.
  __resetCeeHeldModelLatchForTest()
  __resetPersistenceSessionForTests()
  fake = makeFakeCee()
  vi.stubGlobal('fetch', vi.fn(fake.fetchFake))
})

afterEach(() => {
  vi.unstubAllGlobals()
  __resetPersistenceSessionForTests()
  optionSend.fn = null
})

/** Boot: the read 404s (scenario not in CEE yet), THEN the registration is acknowledged. */
async function bootReadIs404ThenRegistrationAcks(): Promise<unknown[]> {
  await waitFor(() => {
    expect(fake.cee.log).toContain('read:404')
    expect(fake.cee.log).toContain('register')
  })
  // Preconditions PINNED (trap 13b): the fresh-scenario state the defect needs.
  expect(useCanvasStore.getState().lastServerGraphHash).toBeNull()
  expect(useCanvasStore.getState().importPendingServerRegistration).toBe(true)
  const nodesBeforeAck = useCanvasStore.getState().nodes
  act(() => fake.cee.registerGate.resolve())
  await waitFor(() => {
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false)
  })
  return nodesBeforeAck as unknown[]
}

describe('a first rename on a freshly registered scenario reaches the edit protocol', () => {
  it('WITNESSED ORDER — read 404, register ack, then rename: the rename is SENT with the READ\'s graph_hash', async () => {
    await openFreshStarter()
    const previousLabel = canvasLabelOf(NODE_ID)
    expect(typeof previousLabel).toBe('string')
    const sent = vi.fn().mockResolvedValue({})
    mountCanvasHooks(sent)

    await bootReadIs404ThenRegistrationAcks()

    act(() => {
      useCanvasStore.getState().updateNodeLabel(NODE_ID, NEW_LABEL)
    })

    await waitFor(() => {
      expect(sent).toHaveBeenCalledTimes(1)
    }, { timeout: 3000 })
    const [event] = sent.mock.calls[0]!
    expect(event.type).toBe('structural_rename')
    // BOUND BY IDENTITY: this node's id, the label the user was looking at, and
    // the base CEE itself issued on the read — never a locally computed hash.
    expect(event.payload).toEqual({
      node_id: NODE_ID,
      label: NEW_LABEL,
      expected_label: previousLabel,
      base_graph_hash: READ_HASH,
    })
    expect(useCanvasStore.getState().lastServerGraphHash).toBe(READ_HASH)
    // The read touched the HASH only: the user's label stands, the server copy never landed.
    expect(canvasLabelOf(NODE_ID)).toBe(NEW_LABEL)
    expect(useCanvasStore.getState().nodes.some((n) => (n.data as { label?: unknown }).label === SERVER_SENTINEL_LABEL)).toBe(false)
    expect(fake.cee.log.filter((l) => l.startsWith('unexpected:'))).toEqual([])
  })

  it('QUEUED RENAME — made while the seeding read is in flight, it is held, then flushes carrying the read\'s graph_hash', async () => {
    await openFreshStarter()
    const previousLabel = canvasLabelOf(NODE_ID)
    const sent = vi.fn().mockResolvedValue({})
    // Hold the NEXT read (the one after the registration commits) at the server.
    fake.cee.readGate = null
    mountCanvasHooks(sent)
    await waitFor(() => {
      expect(fake.cee.log).toContain('read:404')
      expect(fake.cee.log).toContain('register')
    })
    const heldRead = deferred()
    fake.cee.readGate = heldRead
    const nodesBeforeAck = useCanvasStore.getState().nodes
    act(() => fake.cee.registerGate.resolve())
    await waitFor(() => {
      expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false)
    })
    // The canvas was NOT replaced by anything the acknowledgement did.
    expect(useCanvasStore.getState().nodes).toBe(nodesBeforeAck)

    act(() => {
      useCanvasStore.getState().updateNodeLabel(NODE_ID, NEW_LABEL)
    })
    await waitFor(() => {
      expect(useCanvasStore.getState().pendingStructuralRenames).toHaveLength(1)
    })
    expect(useCanvasStore.getState().pendingStructuralRenames[0]!.baseGraphHash).toBeNull()
    expect(sent).not.toHaveBeenCalled()

    // A read reached the server after the registration committed…
    await waitFor(() => {
      expect(fake.cee.log).toContain('read:200')
    }, { timeout: 3000 })
    act(() => heldRead.resolve())

    // …and its graph_hash is what wakes the held queue.
    await waitFor(() => {
      expect(sent).toHaveBeenCalledTimes(1)
    }, { timeout: 3000 })
    const [event] = sent.mock.calls[0]!
    expect(event.type).toBe('structural_rename')
    expect(event.payload).toEqual({
      node_id: NODE_ID,
      label: NEW_LABEL,
      expected_label: previousLabel,
      base_graph_hash: READ_HASH,
    })
    expect(useCanvasStore.getState().lastServerGraphHash).toBe(READ_HASH)
    expect(useCanvasStore.getState().pendingStructuralRenames).toHaveLength(0)
    // Hash only: the read's graph never reached the canvas, and no hydration token was recorded.
    expect(canvasLabelOf(NODE_ID)).toBe(NEW_LABEL)
    expect(useCanvasStore.getState().nodes.some((n) => (n.data as { label?: unknown }).label === SERVER_SENTINEL_LABEL)).toBe(false)
    expect(useCanvasStore.getState().serverGraphIdentity).toBeNull()
  })

  it('REFUSES a read that names a DIFFERENT stored graph than the ack did — no base, nothing sent', async () => {
    await openFreshStarter()
    const sent = vi.fn().mockResolvedValue({})
    fake.cee.readIdentityOverride = 'idv1-someone-elses-write'
    mountCanvasHooks(sent)

    const nodesBeforeAck = await bootReadIs404ThenRegistrationAcks()
    await waitFor(() => {
      expect(fake.cee.log).toContain('read:200')
    }, { timeout: 3000 })
    // Let the read settle, then prove it adopted nothing.
    await new Promise((r) => setTimeout(r, 50))
    expect(useCanvasStore.getState().lastServerGraphHash).toBeNull()
    expect(useCanvasStore.getState().nodes).toBe(nodesBeforeAck)
    expect(sent).not.toHaveBeenCalled()
  })

  it('a base ALREADY held is kept, and no read is spent', async () => {
    await openFreshStarter()
    const TURN_HASH = 'fedcba9876543210'
    useCanvasStore.setState({ lastServerGraphHash: TURN_HASH } as never)
    const sent = vi.fn().mockResolvedValue({})
    mountCanvasHooks(sent)

    await waitFor(() => {
      expect(fake.cee.log).toContain('read:404')
      expect(fake.cee.log).toContain('register')
    })
    act(() => fake.cee.registerGate.resolve())
    await waitFor(() => {
      expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false)
    })
    await new Promise((r) => setTimeout(r, 50))
    expect(fake.cee.log.filter((l) => l.startsWith('read:'))).toEqual(['read:404'])
    expect(useCanvasStore.getState().lastServerGraphHash).toBe(TURN_HASH)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// RENAME-BEFORE-ACK — the deadlock between #1892's hold and this PR's seed.
//
// A rename queued while NO write base exists waits for a base. #1892 holds a
// whole-graph registration while ANY structural edit is queued. On a scenario
// CEE has not acknowledged yet, only that registration's ack can seed the base
// (this PR). So: rename waits for the base → the base waits for the ack → the
// ack waits for the registration → the registration waits for the rename.
// Reached whenever the rename is queued before the registration attempt runs
// (a first attempt that failed and is waiting to retry, or a gesture before
// the hooks mount). The fix must not reopen the side channel: the registration
// carries the model CEE is about to hold — the rename rolled back to its
// `expected_label` — and the rename then travels the edit protocol.
// ═══════════════════════════════════════════════════════════════════════════
describe('a rename queued BEFORE the first registration neither blocks it nor rides it', () => {
  it('registers the PRE-rename model, seeds the base from the read, then SENDS the rename through the protocol', async () => {
    await openFreshStarter()
    const previousLabel = canvasLabelOf(NODE_ID)
    expect(typeof previousLabel).toBe('string')
    // The gesture lands first: no base anywhere, so it queues deferred.
    act(() => {
      useCanvasStore.getState().updateNodeLabel(NODE_ID, NEW_LABEL)
    })
    expect(useCanvasStore.getState().pendingStructuralRenames).toHaveLength(1)
    expect(useCanvasStore.getState().pendingStructuralRenames[0]!.baseGraphHash).toBeNull()

    const sent = vi.fn().mockImplementation(async () => {
      fake.cee.log.push('send:structural_rename')
      return {}
    })
    mountCanvasHooks(sent)

    // The registration is NOT held forever by a rename that is waiting for it…
    await waitFor(() => {
      expect(fake.cee.log).toContain('register')
    }, { timeout: 3000 })
    act(() => fake.cee.registerGate.resolve())
    await waitFor(() => {
      expect(fake.cee.stored).not.toBeNull()
    })
    // …and it carried the model CEE is about to hold, NOT the unsent new label:
    // the side channel stays shut. Bound to the FIRST registration by order.
    const first = fake.cee.registeredGraphs[0]!.nodes.find((n) => n.id === NODE_ID)
    expect(first?.label).toBe(previousLabel)

    // The ack seeds the base, and the queued rename goes out on the protocol.
    await waitFor(() => {
      expect(sent).toHaveBeenCalledTimes(1)
    }, { timeout: 3000 })
    const event = sent.mock.calls[0]![0] as { type: string; payload: unknown }
    expect(event.type).toBe('structural_rename')
    expect(event.payload).toEqual({
      node_id: NODE_ID,
      label: NEW_LABEL,
      expected_label: previousLabel,
      base_graph_hash: READ_HASH,
    })
    // The user's name stands on the canvas throughout.
    expect(canvasLabelOf(NODE_ID)).toBe(NEW_LABEL)
    // No registration carried the new name BEFORE the rename went out on the
    // protocol. (After it, this spec's sender double sets no on-the-wire mark,
    // so a later registration is a harness artefact, not the product.)
    const sendAt = fake.cee.log.indexOf('send:structural_rename')
    const registersBeforeSend = fake.cee.log.slice(0, sendAt).filter((l) => l === 'register').length
    expect(sendAt).toBeGreaterThan(-1)
    for (const g of fake.cee.registeredGraphs.slice(0, registersBeforeSend)) {
      expect(g.nodes.find((n) => n.id === NODE_ID)?.label).toBe(previousLabel)
    }
  })

  // CONTROLS on the rule itself (pure): only a rename that CANNOT be sent — no
  // base on the intent and none in the store — stops holding registration.
  // (A hook-level control is not possible here: this spec's rename sender is a
  // double, so the dispatcher's on-the-wire mark that #1892 relies on for an
  // in-flight rename is never set. `oneWriterRegistration.spec` covers that.)
  it('CONTROL: a queued rename still HOLDS registration whenever a base exists (store or intent)', () => {
    const queued = [{ nodeId: NODE_ID, baseGraphHash: null }]
    expect(editDeliveryHold({ nodes: [], pendingStructuralRenames: queued, lastServerGraphHash: 'fedcba9876543210' } as never))
      .toBe('structural_edit_queued')
    expect(editDeliveryHold({ nodes: [], pendingStructuralRenames: [{ nodeId: NODE_ID, baseGraphHash: 'aa' }], lastServerGraphHash: null } as never))
      .toBe('structural_edit_queued')
  })

  it('the rule: a base-less rename with no base in the store does not hold registration', () => {
    expect(editDeliveryHold({ nodes: [], pendingStructuralRenames: [{ nodeId: NODE_ID, baseGraphHash: null }], lastServerGraphHash: null } as never))
      .toBeNull()
  })

  it('CONTROL: other queued structural edits still hold regardless of base', () => {
    expect(editDeliveryHold({ nodes: [], pendingStructuralDeletes: [{}], lastServerGraphHash: null } as never))
      .toBe('structural_edit_queued')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// THE FIRST OPTION-TARGET EDIT — witnessed on served UI `4c6ec07b`, 23 Sep 2026
// (`output/canvas-completion-20260923/WITNESS-1895-4c6ec07b.md`, step 1a-attempt-1).
//
// Fresh guest, pricing starter: the boot read 404'd, the registration was
// acknowledged, `lastServerGraphHash` stayed null. The user opened the Model
// tab and saved Hybrid → Bottom-Up Adoption Friction 0.4 → 0.25. The row said
// "Not sent yet — I need to re-sync with the saved model first", and NOTHING was
// sent. Unlike a rename, an option edit has no queue to wait in: without a base
// it is refused on the spot (`needs_fresh_base`), so the only cure is a base
// that already exists when the user presses Save.
//
// Driven through `useModelEditAuthority.proposeOptionIntervention` — the exact
// call the Model tab's Save makes — on the real starter, real store and real
// registration/hydration hooks. The Model tab component itself is not mounted.
// ═══════════════════════════════════════════════════════════════════════════
describe('the first option-target edit on a freshly registered example is SENT, not refused for want of a base', () => {
  const OPTION_ID = 'opt_hybrid'
  const FACTOR_ID = 'fac_adoption_friction'

  function interventionOf(optionId: string, factorId: string): unknown {
    const data = useCanvasStore.getState().nodes.find((n) => n.id === optionId)?.data as
      | { interventions?: Record<string, unknown> }
      | undefined
    return data?.interventions?.[factorId]
  }

  it('WITNESSED ORDER — read 404, register ack, then Save 0.25: dispatched with the READ\'s graph_hash, store untouched', async () => {
    await openFreshStarter()
    const before = interventionOf(OPTION_ID, FACTOR_ID)
    expect(before).toBeDefined()
    const sendEvent = vi.fn().mockResolvedValue('sent')
    optionSend.fn = sendEvent
    mountCanvasHooks(vi.fn().mockResolvedValue({}))
    const authority = renderHook(() => useModelEditAuthority(OPTION_ID)).result

    await bootReadIs404ThenRegistrationAcks()
    // The user now opens the Model tab and navigates to the row — seconds on
    // the served build. Nothing CEE is asked for is held back in this window.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })

    const settlements: string[] = []
    let outcome: unknown
    act(() => {
      outcome = authority.current.proposeOptionIntervention(FACTOR_ID, 0.25, {
        onSendSettled: (s) => settlements.push(s),
      })
    })

    // NOT refused client-side for want of a base — the witnessed symptom.
    expect(outcome).toBe('dispatched')
    expect(sendEvent).toHaveBeenCalledTimes(1)
    // BOUND BY IDENTITY: this option, this factor, the typed number, and the
    // base CEE itself issued on the read — never a locally computed hash.
    expect(sendEvent.mock.calls[0]![0]).toEqual({
      type: 'option_intervention_edit',
      payload: {
        option_id: OPTION_ID,
        factor_id: FACTOR_ID,
        value: 0.25,
        base_graph_hash: READ_HASH,
      },
    })
    expect(useCanvasStore.getState().lastServerGraphHash).toBe(READ_HASH)
    // The authority writes nothing optimistic; the applied response owns that.
    expect(interventionOf(OPTION_ID, FACTOR_ID)).toEqual(before)
    // The seed read touched the hash only.
    expect(useCanvasStore.getState().nodes.some((n) => (n.data as { label?: unknown }).label === SERVER_SENTINEL_LABEL)).toBe(false)
    expect(useCanvasStore.getState().serverGraphIdentity).toBeNull()
    expect(fake.cee.log.filter((l) => l.startsWith('unexpected:'))).toEqual([])
  })

  it('CONTROL — with no acknowledged registration there is still no base, and the edit is still refused (fail closed)', async () => {
    await openFreshStarter()
    const sendEvent = vi.fn().mockResolvedValue('sent')
    optionSend.fn = sendEvent
    mountCanvasHooks(vi.fn().mockResolvedValue({}))
    const authority = renderHook(() => useModelEditAuthority(OPTION_ID)).result

    // The registration reaches CEE but is never answered.
    await waitFor(() => {
      expect(fake.cee.log).toContain('read:404')
      expect(fake.cee.log).toContain('register')
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })

    let outcome: unknown
    act(() => {
      outcome = authority.current.proposeOptionIntervention(FACTOR_ID, 0.25)
    })
    expect(outcome).toBe('needs_fresh_base')
    expect(sendEvent).not.toHaveBeenCalled()
    expect(useCanvasStore.getState().lastServerGraphHash).toBeNull()
  })
})
