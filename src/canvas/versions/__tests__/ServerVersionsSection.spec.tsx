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
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

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
 * sessions: `getSessionIdentity()` performs a NETWORK REFRESH on an expired
 * token, so the gap is hundreds of milliseconds with `autoRefreshToken` and
 * multi-tab both on. Reading both fields from ONE session object closes that
 * by construction. `useAuth` remains the signed-in GATE only.
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
