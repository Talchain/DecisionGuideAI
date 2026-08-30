/**
 * ServerVersionsSection — shared (server-side) versions in the versions panel.
 *
 * ⚠ SCOPE (CLAUDE.md trap #16): jsdom proves presence, text and call wiring —
 * never visibility on a deployed canvas. The deployed witness is separate.
 *
 * What is pinned here, and why each pin is load-bearing:
 *
 *  1. THE CONFIRM GATE. Restore overwrites the working model for EVERYONE with
 *     access to the scenario. The restore adapter must NOT be called on the
 *     row's "Restore" click — only on the explicit confirm. A mutant that
 *     wires the first click straight to the adapter must go RED here.
 *
 *  2. IDENTITY-BOUND RESTORE. The confirm calls the adapter with THAT row's
 *     version id (not the newest, not a constant) and with the CURRENT head's
 *     identity hash as the CAS expectation — binding by id, not by a value
 *     predicate another row could satisfy (trap 19).
 *
 *  3. THE APPLY IS THE RECEIPT-CLASS RECONCILE. A successful restore hands the
 *     response graph to `reconcileAppliedGraph` — the one apply path with
 *     authoritative deletion semantics — never a bespoke second merge.
 *
 *  4. UNDO IS REAL. After a restore, the offered undo calls the adapter with
 *     the server-named `undo_version_id` (the pre-restore snapshot).
 *
 *  5. GUESTS GET THE HONEST INVITATION, NOT AN ERROR — and no network call.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

const SCENARIO = 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c'
const USER = '0f8a1b2c-3d4e-4f50-9a6b-7c8d9e0f1a2b'
const VERSION_HEAD = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'
const VERSION_OLD = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const UNDO_VERSION = 'cccccccc-3333-4333-8333-cccccccccccc'
const HASH_HEAD = 'b'.repeat(64)
const HASH_OLD = 'a'.repeat(64)

const listModelVersions = vi.fn()
const saveModelVersion = vi.fn()
const restoreModelVersion = vi.fn()
vi.mock('../../../adapters/cee/modelVersions', () => ({
  listModelVersions: (...args: unknown[]) => listModelVersions(...args),
  saveModelVersion: (...args: unknown[]) => saveModelVersion(...args),
  restoreModelVersion: (...args: unknown[]) => restoreModelVersion(...args),
}))

const reconcileAppliedGraph = vi.fn()
vi.mock('../../utils/mergeAppliedGraph', () => ({
  reconcileAppliedGraph: (...args: unknown[]) => reconcileAppliedGraph(...args),
}))

const authState: { user: { id: string } | null } = { user: { id: USER } }
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: authState.user }),
}))

/**
 * The identity these handlers SEND comes from `getSessionIdentity`, not from
 * `useAuth` — deliberately, and this spec's file is where that matters most.
 *
 * These three handlers are user-initiated, have no AbortController and no
 * cancellation, and two of them are WRITES. Binding the body id from the render
 * closure and then awaiting a token read means the two can come from different
 * sessions — verified at the dependency's bytes (@supabase/gotrue-js 2.62.2,
 * `GoTrueClient.js:778-787`): `getSession()` performs a NETWORK REFRESH when
 * `expires_at <= now`, so the read is not free. The comparison is HARD, with no
 * margin on this path, so a token expiring moments from now is returned as-is.
 * Reading both fields from ONE session object closes the mismatch window by
 * construction. `useAuth` remains the signed-in GATE only.
 *
 * `importOriginal` spread, not a hand-listed factory: a factory REPLACES the
 * module and every other `lib/supabase` export would silently vanish.
 */
const sessionState: { userId: string | null; accessToken: string | null } = {
  userId: USER,
  accessToken: 'token-for-USER',
}
vi.mock('../../../lib/supabase', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSessionIdentity: async () => sessionState,
}))

import { ServerVersionsSection } from '../ServerVersionsSection'
import { useCanvasStore } from '../../store'

function serverVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: VERSION_OLD,
    versionNumber: 1,
    label: 'First cut',
    provenance: 'user_save',
    restoredFromVersionId: null,
    createdAt: '2026-08-17T10:00:00.000Z',
    graphIdentityHash: HASH_OLD,
    ...overrides,
  }
}

const TWO_VERSIONS = [
  serverVersion({
    id: VERSION_HEAD,
    versionNumber: 2,
    label: null,
    provenance: 'commit',
    graphIdentityHash: HASH_HEAD,
  }),
  serverVersion(),
]

beforeEach(() => {
  vi.clearAllMocks()
  authState.user = { id: USER }
  sessionState.userId = USER
  sessionState.accessToken = 'token-for-USER'
  useCanvasStore.setState({ currentScenarioId: SCENARIO } as never)
  listModelVersions.mockResolvedValue({
    status: 'list',
    versions: TWO_VERSIONS,
    currentVersionId: VERSION_HEAD,
    requestId: 'req-1',
  })
  reconcileAppliedGraph.mockReturnValue({
    addedNodeCount: 1,
    addedEdgeCount: 0,
    updatedNodeCount: 0,
    updatedEdgeCount: 0,
    removedNodeCount: 0,
    removedEdgeCount: 0,
  })
})

afterEach(() => {
  useCanvasStore.setState({ currentScenarioId: null } as never)
})

describe('ServerVersionsSection — list', () => {
  it('lists the scenario versions with the current one marked', async () => {
    render(<ServerVersionsSection />)

    await waitFor(() => {
      expect(screen.getAllByTestId('server-version-row')).toHaveLength(2)
    })
    expect(listModelVersions).toHaveBeenCalledWith(
      SCENARIO,
      expect.objectContaining({ userId: USER }),
    )
    const rows = screen.getAllByTestId('server-version-row')
    expect(rows[0]).toHaveTextContent('v2')
    expect(rows[0]).toHaveTextContent(/current/i)
    expect(rows[1]).toHaveTextContent('First cut')
  })

  it('renders nothing without a server-addressable (UUID) scenario', () => {
    useCanvasStore.setState({ currentScenarioId: 'local-draft-1' } as never)
    const { container } = render(<ServerVersionsSection />)
    expect(container).toBeEmptyDOMElement()
    expect(listModelVersions).not.toHaveBeenCalled()
  })
})

describe('ServerVersionsSection — guests (pin 5)', () => {
  it('invites sign-in and never calls the network', () => {
    authState.user = null
    sessionState.userId = null
    sessionState.accessToken = null
    render(<ServerVersionsSection />)

    expect(screen.getByTestId('server-versions-signin')).toBeInTheDocument()
    expect(screen.getByTestId('server-versions-signin')).toHaveTextContent(/sign in/i)
    expect(listModelVersions).not.toHaveBeenCalled()
    expect(restoreModelVersion).not.toHaveBeenCalled()
  })
})

describe('ServerVersionsSection — restore (pins 1–4)', () => {
  function restoredResponse() {
    return {
      status: 'restored',
      graph: { nodes: [{ id: 'n1', label: 'Take the job', kind: 'option' }], edges: [] },
      deduped: false,
      version: { versionId: 'dddddddd-4444-4444-8444-dddddddddddd', versionNumber: 3, deduped: false },
      undoVersionId: UNDO_VERSION,
      requestId: 'req-2',
    }
  }

  it('PIN 1 — the first click arms a confirm; the adapter is NOT called until confirmed', async () => {
    restoreModelVersion.mockResolvedValue(restoredResponse())
    render(<ServerVersionsSection />)
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))

    fireEvent.click(screen.getByRole('button', { name: /restore version 1/i }))
    expect(restoreModelVersion).not.toHaveBeenCalled()
    expect(screen.getByTestId('server-restore-confirm')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /confirm restore/i }))
    await waitFor(() => expect(restoreModelVersion).toHaveBeenCalledTimes(1))
  })

  it('cancel disarms without any call', async () => {
    render(<ServerVersionsSection />)
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))

    fireEvent.click(screen.getByRole('button', { name: /restore version 1/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(restoreModelVersion).not.toHaveBeenCalled()
    expect(screen.queryByTestId('server-restore-confirm')).not.toBeInTheDocument()
  })

  it('PIN 2 — confirms with THAT row\'s id and the CURRENT head hash as the CAS expectation', async () => {
    restoreModelVersion.mockResolvedValue(restoredResponse())
    render(<ServerVersionsSection />)
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))

    fireEvent.click(screen.getByRole('button', { name: /restore version 1/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm restore/i }))

    await waitFor(() => expect(restoreModelVersion).toHaveBeenCalledTimes(1))
    expect(restoreModelVersion).toHaveBeenCalledWith(
      SCENARIO,
      expect.objectContaining({
        userId: USER,
        versionId: VERSION_OLD,
        expectedGraphIdentityHash: HASH_HEAD,
      }),
    )
  })

  it('PIN 3 — applies the restored graph through reconcileAppliedGraph, identity-bound to the response bytes', async () => {
    const response = restoredResponse()
    restoreModelVersion.mockResolvedValue(response)
    render(<ServerVersionsSection />)
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))

    fireEvent.click(screen.getByRole('button', { name: /restore version 1/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm restore/i }))

    await waitFor(() => expect(reconcileAppliedGraph).toHaveBeenCalledTimes(1))
    const arg = reconcileAppliedGraph.mock.calls[0][0] as { graph: { nodes: { id: string }[] } }
    expect(arg.graph.nodes.map((n) => n.id)).toEqual(['n1'])
  })

  it('PIN 4 — the undo affordance restores the server-named pre-restore snapshot', async () => {
    restoreModelVersion.mockResolvedValue(restoredResponse())
    render(<ServerVersionsSection />)
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))

    fireEvent.click(screen.getByRole('button', { name: /restore version 1/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm restore/i }))
    await waitFor(() => expect(screen.getByTestId('server-restore-undo')).toBeInTheDocument())

    restoreModelVersion.mockClear()
    restoreModelVersion.mockResolvedValue({ ...restoredResponse(), undoVersionId: null })
    fireEvent.click(screen.getByTestId('server-restore-undo'))

    await waitFor(() => expect(restoreModelVersion).toHaveBeenCalledTimes(1))
    expect(restoreModelVersion.mock.calls[0][1]).toMatchObject({ versionId: UNDO_VERSION })
  })

  it('a conflict answers with honest copy and a refreshed list, not a silent nothing', async () => {
    restoreModelVersion.mockResolvedValue({ status: 'conflict' })
    render(<ServerVersionsSection />)
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))
    listModelVersions.mockClear()

    fireEvent.click(screen.getByRole('button', { name: /restore version 1/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm restore/i }))

    await waitFor(() =>
      expect(screen.getByTestId('server-versions-message')).toHaveTextContent(/changed/i),
    )
    expect(listModelVersions).toHaveBeenCalledTimes(1)
    expect(reconcileAppliedGraph).not.toHaveBeenCalled()
  })
})

describe('ServerVersionsSection — save', () => {
  it('saves a named version and refreshes the list', async () => {
    saveModelVersion.mockResolvedValue({
      status: 'saved',
      version: { versionId: VERSION_HEAD, versionNumber: 3, deduped: false },
    })
    render(<ServerVersionsSection />)
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))
    listModelVersions.mockClear()

    fireEvent.change(screen.getByLabelText(/shared version name/i), {
      target: { value: 'Before pivot' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save shared version/i }))

    await waitFor(() => expect(saveModelVersion).toHaveBeenCalledTimes(1))
    expect(saveModelVersion.mock.calls[0][1]).toMatchObject({
      userId: USER,
      label: 'Before pivot',
    })
    await waitFor(() => expect(listModelVersions).toHaveBeenCalledTimes(1))
  })

  it('an unchanged model saves as a no-op and says so (deduped)', async () => {
    saveModelVersion.mockResolvedValue({
      status: 'saved',
      version: { versionId: VERSION_HEAD, versionNumber: 2, deduped: true },
    })
    render(<ServerVersionsSection />)
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))

    fireEvent.click(screen.getByRole('button', { name: /save shared version/i }))
    await waitFor(() =>
      expect(screen.getByTestId('server-versions-message')).toHaveTextContent(/already/i),
    )
  })
})

describe('ServerVersionsSection — honest degraded states', () => {
  it('says when versioning is disabled on the service', async () => {
    listModelVersions.mockResolvedValue({ status: 'disabled' })
    render(<ServerVersionsSection />)
    await waitFor(() =>
      expect(screen.getByTestId('server-versions-unavailable')).toHaveTextContent(
        /not available/i,
      ),
    )
  })

  it('offers a retry when the read failed, never an empty claim', async () => {
    listModelVersions.mockResolvedValueOnce({ status: 'unavailable' })
    render(<ServerVersionsSection />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument(),
    )
    expect(screen.queryByTestId('server-version-row')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PIN 6 — THE MUTATION ID IS FRESH PER GESTURE, AND THAT IS A SAFETY PROPERTY.
//
// CEE's restore RPC resolves replay BEFORE the CAS, and says so in its own
// header (supabase/migrations/20260824200000_c8_atomic_model_version_restore
// .sql:311-314): "A successful original call may legitimately be retried after
// later graph changes; it returns the original operation receipt and performs
// no writes."
//
// So an id REUSED for a genuinely-new restore of the SAME version — the user
// restores v1, edits, then restores v1 again — returns HTTP 200,
// `restored: true`, and a real-looking receipt WHILE THE SERVER'S WORKING
// GRAPH IS NOT REVERTED. The wire cannot tell: `replayed` is computed and only
// LOGGED, and the response schema is `.strict()` without it. That is a
// fabricated success, strictly worse than the honest 422 this PR removes.
//
// A per-versionId memoisation is therefore NOT a harmless optimisation, and
// this is the pin that forbids it. The two gestures below share a TARGET, so
// only genuine per-gesture freshness passes.
// ─────────────────────────────────────────────────────────────────────────────

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('ServerVersionsSection — restore identity (pin 6)', () => {
  function restoredResponse() {
    return {
      status: 'restored',
      graph: { nodes: [{ id: 'n1', label: 'Take the job', kind: 'option' }], edges: [] },
      deduped: false,
      version: { versionId: 'dddddddd-4444-4444-8444-dddddddddddd', versionNumber: 3, deduped: false },
      undoVersionId: UNDO_VERSION,
      requestId: 'req-2',
    }
  }

  async function restoreVersionOnce() {
    fireEvent.click(screen.getByRole('button', { name: /restore version 1/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm restore/i }))
  }

  it('PIN 6 — two restores of the SAME version carry DIFFERENT, UUID-shaped mutation ids', async () => {
    restoreModelVersion.mockResolvedValue(restoredResponse())
    render(<ServerVersionsSection />)
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))

    await restoreVersionOnce()
    await waitFor(() => expect(restoreModelVersion).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))
    await restoreVersionOnce()
    await waitFor(() => expect(restoreModelVersion).toHaveBeenCalledTimes(2))

    const first = restoreModelVersion.mock.calls[0][1] as { mutationId: string; versionId: string }
    const second = restoreModelVersion.mock.calls[1][1] as { mutationId: string; versionId: string }

    // Precondition, pinned IN-TEST: both gestures really did target the SAME
    // version. Without this the "ids differ" assertion could pass merely
    // because the two calls were different restores (trap 13b).
    expect(first.versionId).toBe(VERSION_OLD)
    expect(second.versionId).toBe(VERSION_OLD)

    expect(first.mutationId).toMatch(UUID_V4_RE)
    expect(second.mutationId).toMatch(UUID_V4_RE)
    expect(second.mutationId).not.toBe(first.mutationId)
  })

  it('sends the CAS expectation as an explicit key, never omitted', async () => {
    restoreModelVersion.mockResolvedValue(restoredResponse())
    render(<ServerVersionsSection />)
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))

    await restoreVersionOnce()
    await waitFor(() => expect(restoreModelVersion).toHaveBeenCalledTimes(1))

    const opts = restoreModelVersion.mock.calls[0][1] as Record<string, unknown>
    expect(Object.prototype.hasOwnProperty.call(opts, 'expectedGraphIdentityHash')).toBe(true)
    expect(opts.expectedGraphIdentityHash).toBe(HASH_HEAD)
  })

  it('refuses to restore when it does not know the current state — and never guesses null', async () => {
    // `null` is NOT an opt-out: CEE's CAS is `IS DISTINCT FROM`
    // (…restore_atomic_v1.sql:360-367, "NULL is a meaningful expected absence
    // … without a bypass"), so null ASSERTS the model is currently empty. With
    // no head we have not observed that, and asserting it yields 409
    // VERSION_STALE — rendering "the model changed" over a model that did not.
    restoreModelVersion.mockResolvedValue(restoredResponse())
    render(<ServerVersionsSection />)
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))

    // Drive to the only reachable no-head state: an undo is offered while the
    // refreshed list came back empty.
    listModelVersions.mockResolvedValue({
      status: 'list',
      versions: [],
      currentVersionId: null,
      requestId: 'req-empty',
    })
    await restoreVersionOnce()
    await waitFor(() => expect(screen.getByTestId('server-restore-undo')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByTestId('server-versions-empty')).toBeInTheDocument())

    restoreModelVersion.mockClear()
    fireEvent.click(screen.getByTestId('server-restore-undo'))

    await waitFor(() =>
      expect(screen.getByTestId('server-versions-message')).toHaveTextContent(/nothing was changed/i),
    )
    // The whole point: no request is sent on a state we cannot assert.
    expect(restoreModelVersion).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PIN 7 — A REFUSAL THAT A RETRY CANNOT FIX MUST NOT INVITE ONE.
//
// This is the defect that made the whole surface dishonest: a DETERMINISTIC,
// PERMANENT 422 rendered as "The version could not be restored right now.
// Nothing was changed." — literally true, and read by every user as "try
// again". A mutant that puts a retry invitation back on any of these arms
// must go RED here.
// ─────────────────────────────────────────────────────────────────────────────

describe('ServerVersionsSection — terminal refusals say so (pin 7)', () => {
  async function refuseWith(result: Record<string, unknown>) {
    // Several cases below drive TWO arms in one test (a twin pair, or a loop
    // over the arms that share an answer). Without this, the second render
    // stacks a second section into the same document and every `getBy*`
    // throws on multiple matches — which reads as a failure of the arm rather
    // than of the harness.
    cleanup()
    restoreModelVersion.mockResolvedValue(result)
    render(<ServerVersionsSection />)
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))
    fireEvent.click(screen.getByRole('button', { name: /restore version 1/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm restore/i }))
    await waitFor(() => expect(screen.getByTestId('server-versions-message')).toBeInTheDocument())
    return screen.getByTestId('server-versions-message').textContent ?? ''
  }

  it('a version that cannot be restored is named as permanent, not as "right now"', async () => {
    const text = await refuseWith({ status: 'versionNotRestorable' })
    expect(text).toMatch(/nothing was changed/i)
    expect(text).toMatch(/will not help/i)
    expect(text).not.toMatch(/try again|right now/i)
  })

  it("a payload the server rejected is named as Olumi's fault, and does not invite a retry", async () => {
    const text = await refuseWith({ status: 'payloadRejected' })
    expect(text).toMatch(/nothing was changed/i)
    expect(text).toMatch(/will not help/i)
    expect(text).not.toMatch(/try again|right now/i)
  })

  it('a reused restore identity never renders as "the model changed"', async () => {
    const text = await refuseWith({ status: 'mutationIdReused' })
    expect(text).toMatch(/nothing was changed/i)
    expect(text).not.toMatch(/model changed since you looked/i)
    expect(text).not.toMatch(/try again/i)
  })

  it('never tells a SIGNED-IN user that restoring requires sign-in', async () => {
    // The section only renders at all when `signedIn` is true, so this copy
    // was false on every occasion it could ever be shown. MV001's condition is
    // `scenarios.user_id IS NULL` — a property of the SCENARIO, not the caller.
    const text = await refuseWith({ status: 'signInRequired', cause: 'scenarioUnowned' })
    expect(text).not.toMatch(/requires sign-in/i)
    expect(text).toMatch(/nothing was changed/i)
    expect(text).toMatch(/fault in olumi/i)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // THE OPPOSITE-DIRECTION TWIN. The test above watches ONE door: that we never
  // say "requires sign-in" to a signed-in user. A guard that answered "a fault
  // in Olumi, not something a retry can fix" for EVERY sign-in refusal passes it
  // — and is wrong on the arm where signing in is the whole remedy.
  //
  // The `sessionLapsed` arm is reachable only when a token was PRESENTED, i.e.
  // only when a session existed, so a split on the CLIENT's own `userId` sends
  // 100% of this arm to the Olumi-fault copy. Both directions, or neither.
  // ───────────────────────────────────────────────────────────────────────────
  it('TWIN — a lapsed session says SIGN IN AGAIN, and never blames Olumi', async () => {
    const text = await refuseWith({ status: 'signInRequired', cause: 'sessionLapsed' })
    expect(text).toMatch(/sign in again/i)
    expect(text).not.toMatch(/fault in olumi/i)
  })

  it('TWIN — an unverifiable sign-in does NOT send the user round the loop', async () => {
    // CEE's JWKS is unusable; a fresh token fails to verify exactly as the old
    // one did. "Sign in again" here is a false instruction, not a rough edge.
    const text = await refuseWith({ status: 'signInRequired', cause: 'signInUnverifiable' })
    expect(text).toMatch(/fault in olumi/i)
    expect(text).not.toMatch(/sign in again/i)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // "NOTHING WAS CHANGED" IS A CLAIM ABOUT THE SERVER, AND ON TWO ARMS WE
  // CANNOT MAKE IT.
  //
  // CEE commits graph + undo + version + head + event in ONE RPC
  // (`assist.v1.scenario-versions.ts:1181-1195`), and THEN egress-validates:
  //   :1243-1253  const outcome = AtomicRestoreRouteResponseSchema.safeParse(…)
  //               if (!outcome.success) return unavailable(…)   ← 503, POST-COMMIT
  // which this client maps to `unavailable` (`modelVersions.ts:341-342`). A
  // transport timeout (`unusable`) is the same shape: the server may have
  // committed and the answer never arrived. The v2 receipt is `.strict()` with
  // no replay signal, so the client genuinely cannot recover the outcome —
  // which is precisely why it must not assert one.
  //
  // Second-order harm this closes: read as transient, the user retries with a
  // FRESH mutation id, the server cannot see a replay, and a second restore
  // buries their pre-restore snapshot one version deeper.
  // ───────────────────────────────────────────────────────────────────────────
  it('an unknown outcome is reported as unknown, never as "nothing was changed"', async () => {
    for (const status of ['unavailable', 'unusable']) {
      listModelVersions.mockClear()
      const text = await refuseWith({ status })
      expect(text, status).not.toMatch(/nothing was changed/i)
      expect(text, status).toMatch(/could not confirm/i)
      // …and the user is shown the true state rather than left with the claim.
      await waitFor(() => expect(listModelVersions.mock.calls.length).toBeGreaterThan(1))
    }
  })

  it('TWIN — arms that are provably pre-commit DO still say nothing was changed', async () => {
    // 404 and 401/403/429 are refused in the route's pre-flight, before the
    // RPC (`identity → UUID → EXISTENCE → ownership → body → operation`), so
    // withholding the claim there would be its own dishonesty — vagueness
    // about a state we do know. Without this twin, "never claim anything" would
    // pass the test above and lose real information.
    for (const result of [{ status: 'notReadable' }, { status: 'refused', httpStatus: 403 }]) {
      const text = await refuseWith(result)
      expect(text, result.status).toMatch(/nothing was changed/i)
    }
  })
})

describe('ServerVersionsSection — the confirm names the blast radius', () => {
  it('says who else is affected and what happens to existing analyses', async () => {
    render(<ServerVersionsSection />)
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))
    fireEvent.click(screen.getByRole('button', { name: /restore version 1/i }))

    const confirm = screen.getByTestId('server-restore-confirm')
    expect(confirm).toHaveTextContent(/everyone who can open this scenario/i)
    expect(confirm).toHaveTextContent(/analys/i)
    // The undo promise must stay, and it is TRUE: the RPC snapshots the
    // working graph as a `pre_restore` version before replacing it
    // (…restore_atomic_v1.sql:389-410).
    expect(confirm).toHaveTextContent(/so you can undo/i)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // NOTHING RECOMPUTES. A restore INVALIDATES.
  //
  // Derived at the producer, not inferred from the symptom:
  //   · …c8_atomic_model_version_restore.sql:460-472 stamps
  //     `analysis_invalidated_at := now()` in the one working-state UPDATE, and
  //     its column comment (:175-176) reads "DB-stamped chronology guard:
  //     analysis facts at/before the latest restore are stale even when hashes
  //     match again."
  //   · `scenario-graph-analysis-read.ts:139-192` READS prior facts and derives
  //     FRESHNESS. It runs no analysis.
  //   · this client never reads `analysis_state` at all (the only occurrence in
  //     `modelVersions.ts` is a comment listing CEE's key set), and this section
  //     starts no analysis run.
  // A consent dialog for a destructive shared write must describe what happens,
  // not a happier thing that does not.
  // ───────────────────────────────────────────────────────────────────────────
  it('does NOT promise a recompute that nothing performs', async () => {
    render(<ServerVersionsSection />)
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))
    fireEvent.click(screen.getByRole('button', { name: /restore version 1/i }))

    const text = screen.getByTestId('server-restore-confirm').textContent ?? ''
    expect(text).not.toMatch(/recompute|recomputed|recalculat|re-?run automatically/i)
    // …and says the true thing in its place, so this is not satisfied by
    // deleting the sentence and telling the user nothing.
    expect(text).toMatch(/out of date|no longer apply/i)
    expect(text).toMatch(/again/i)
  })
})
