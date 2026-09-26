/**
 * ServerVersionsSection — AN OPEN PANEL MUST NOT SHOW A PRE-TURN VERSION NUMBER.
 * British English: visualisation, colour, initialise.
 *
 * ── THE DEFECT THIS PINS ────────────────────────────────────────────────────
 * `ServerVersionsSection` is the ONLY JSX in the estate that renders a shared
 * model version ordinal (`v{version.versionNumber}`). Before this spec its only
 * fetch triggers were:
 *   · the mount effect, keyed on `[addressable, signedIn, refresh]`, where
 *     `refresh` is a `useCallback` over `[addressable, signedIn, scenarioId,
 *     userId]` — no turn id, no graph hash, no mutation id, no analysis state;
 *   · the manual "Try again" button;
 *   · its own post-save / post-restore handlers.
 *
 * So OPENING the panel after a turn shows the current number (the subtree
 * unmounts when the panel closes — `WhatChangedPanel.tsx:115 if (!isOpen)
 * return null`), but a panel LEFT OPEN across a turn had no code path at all
 * that could correct it. CEE appends a `committed_mutation` version on the
 * turn's write; the open panel kept rendering the pre-turn ordinal, silently,
 * for as long as the user left it open.
 *
 * ── WHY `lastServerGraphHash` IS THE SIGNAL, AND NOT `nodes`/`edges` ─────────
 * `store.lastServerGraphHash` is CEE's own `aag_v1` analysis-affecting graph
 * hash, held VERBATIM. Three properties make it the right trigger and they are
 * the reason this spec asserts all three:
 *   1. IT IS WIRE-WRITTEN. Its one non-test setter is `setLastServerGraphHash`,
 *      and its three non-test callers are `applyV5State` (the top-level
 *      `graph_hash` on every turn response), `serverGraphHydration`'s
 *      `adoptServerWriteBase`, and `seedWriteBaseAfterRegistration`. A local
 *      canvas gesture cannot move it.
 *   2. IT IS COALESCED AT THE SETTER. `setLastServerGraphHash` early-returns on
 *      a value equal to the one held, so a re-stamp of the same hash is not a
 *      store write and cannot produce a second fetch.
 *   3. `nodes`/`edges` WOULD BE A FETCH STORM. A drag replaces both arrays on
 *      every frame; keying the refetch off array identity would put a network
 *      read behind every pointer move. Pinned as a negative control below.
 *
 * ⚠ SCOPE (CLAUDE.md trap #16): jsdom proves the call wiring and nothing about
 * visibility on a deployed canvas. No browser witness is claimed here.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, cleanup, act } from '@testing-library/react'

const SCENARIO = 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c'
const USER = '0f8a1b2c-3d4e-4f50-9a6b-7c8d9e0f1a2b'
const VERSION_HEAD = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'
const VERSION_NEXT = 'dddddddd-4444-4444-8444-dddddddddddd'

/** CEE's `aag_v1` shape — 16 hex, not the 64-hex `identity.v1` token. */
const HASH_BEFORE_TURN = '0123456789abcdef'
const HASH_AFTER_TURN = 'fedcba9876543210'

const listModelVersions = vi.fn()
const saveModelVersion = vi.fn()
const restoreModelVersion = vi.fn()
vi.mock('../../../adapters/cee/modelVersions', () => ({
  listModelVersions: (...args: unknown[]) => listModelVersions(...args),
  saveModelVersion: (...args: unknown[]) => saveModelVersion(...args),
  restoreModelVersion: (...args: unknown[]) => restoreModelVersion(...args),
}))

const authState: { user: { id: string } | null } = { user: { id: USER } }
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: authState.user }),
}))

/**
 * `importOriginal` spread, not a hand-listed factory: a factory REPLACES the
 * module and every other `lib/supabase` export would silently vanish.
 */
vi.mock('../../../lib/supabase', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSessionIdentity: async () => ({ userId: USER, accessToken: 'token-for-USER' }),
}))

import { ServerVersionsSection } from '../ServerVersionsSection'
import { useCanvasStore } from '../../store'

function serverVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: VERSION_HEAD,
    versionNumber: 2,
    label: null,
    provenance: 'committed_mutation',
    restoredFromVersionId: null,
    createdAt: '2026-09-24T10:00:00.000Z',
    graphIdentityHash: 'b'.repeat(64),
    ...overrides,
  }
}

/** What the list read returns BEFORE the turn — head is v2. */
const BEFORE_TURN = [serverVersion()]

/**
 * What it returns AFTER the turn — CEE has appended v3 as a
 * `committed_mutation`. The ordinal is the thing the user sees, so the
 * assertion below binds on the RENDERED ordinal, not merely on a call count.
 */
const AFTER_TURN = [
  serverVersion({ id: VERSION_NEXT, versionNumber: 3, graphIdentityHash: 'c'.repeat(64) }),
  serverVersion(),
]

beforeEach(() => {
  vi.clearAllMocks()
  authState.user = { id: USER }
  useCanvasStore.setState({ currentScenarioId: SCENARIO, lastServerGraphHash: null } as never)
  listModelVersions.mockResolvedValue({
    status: 'list',
    versions: BEFORE_TURN,
    currentVersionId: VERSION_HEAD,
    requestId: 'req-1',
  })
})

afterEach(() => {
  cleanup()
  useCanvasStore.setState({ currentScenarioId: null, lastServerGraphHash: null } as never)
})

/**
 * Stamp a new server graph hash the way the wire does — through the store's OWN
 * action, the single non-test setter, never a raw `setState` on the field. A
 * `setState` would bypass the setter's coalescing and the test would then be
 * about a write the product cannot perform.
 */
async function ceeStampsGraphHash(hash: string) {
  await act(async () => {
    useCanvasStore.getState().setLastServerGraphHash(hash)
  })
}

describe('ServerVersionsSection — an OPEN panel refreshes across a turn', () => {
  it('refetches, and renders the NEW ordinal, when CEE stamps a new graph hash', async () => {
    await ceeStampsGraphHash(HASH_BEFORE_TURN)
    render(<ServerVersionsSection />)

    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(1))
    expect(screen.getAllByTestId('server-version-row')[0]).toHaveTextContent('v2')
    expect(listModelVersions).toHaveBeenCalledTimes(1)

    // A turn lands. `applyV5State` captures the response's top-level
    // `graph_hash` and stamps it here; CEE has appended v3 server-side.
    listModelVersions.mockResolvedValue({
      status: 'list',
      versions: AFTER_TURN,
      currentVersionId: VERSION_NEXT,
      requestId: 'req-2',
    })
    await ceeStampsGraphHash(HASH_AFTER_TURN)

    await waitFor(() => expect(listModelVersions).toHaveBeenCalledTimes(2))
    // Bound on the ordinal the user reads, not on the call count alone.
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))
    expect(screen.getAllByTestId('server-version-row')[0]).toHaveTextContent('v3')
  })

  it('keeps the list readable while it refetches — no loading flash', async () => {
    await ceeStampsGraphHash(HASH_BEFORE_TURN)
    render(<ServerVersionsSection />)
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(1))

    // Hold the second read open, so the window between the trigger and the
    // response is observable rather than collapsed by an already-resolved mock.
    let release: (() => void) | null = null
    listModelVersions.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () =>
            resolve({
              status: 'list',
              versions: AFTER_TURN,
              currentVersionId: VERSION_NEXT,
              requestId: 'req-2',
            })
        }),
    )
    await ceeStampsGraphHash(HASH_AFTER_TURN)

    expect(listModelVersions).toHaveBeenCalledTimes(2)
    // The pre-turn rows are stale by one turn, but they are readable and the
    // refetch is in flight. Blanking them to "Loading shared versions…" on
    // every turn would make the panel unusable during a conversation.
    expect(screen.getAllByTestId('server-version-row')).toHaveLength(1)
    expect(screen.queryByText(/loading shared versions/i)).not.toBeInTheDocument()

    await act(async () => {
      release?.()
    })
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))
  })

  // ── NEGATIVE CONTROLS ─────────────────────────────────────────────────────
  // Both are the failure modes a careless version of this fix produces, and
  // both must stay silent. Without them "it refetches" is satisfied by a
  // component that refetches on everything.

  it('does NOT refetch when only nodes/edges are replaced — a drag is not a turn', async () => {
    await ceeStampsGraphHash(HASH_BEFORE_TURN)
    render(<ServerVersionsSection />)
    await waitFor(() => expect(listModelVersions).toHaveBeenCalledTimes(1))

    // Three frames of a pointer drag: React Flow hands the store fresh arrays
    // every time, with the same analysis-affecting content.
    for (let frame = 0; frame < 3; frame += 1) {
      await act(async () => {
        useCanvasStore.setState({
          nodes: [{ id: 'n1', type: 'factor', position: { x: frame, y: 0 }, data: {} }],
          edges: [],
        } as never)
      })
    }

    expect(listModelVersions).toHaveBeenCalledTimes(1)
  })

  it('does NOT refetch when the same graph hash is re-stamped', async () => {
    await ceeStampsGraphHash(HASH_BEFORE_TURN)
    render(<ServerVersionsSection />)
    await waitFor(() => expect(listModelVersions).toHaveBeenCalledTimes(1))

    // Two turns that changed nothing analysis-affecting: CEE re-stamps the same
    // hash, and CEE appends no version either, so a refetch would be pure noise.
    await ceeStampsGraphHash(HASH_BEFORE_TURN)
    await ceeStampsGraphHash(HASH_BEFORE_TURN)

    expect(listModelVersions).toHaveBeenCalledTimes(1)
  })

  it('never reads the network for a guest, whatever the wire stamps', async () => {
    authState.user = null
    await ceeStampsGraphHash(HASH_BEFORE_TURN)
    render(<ServerVersionsSection />)
    expect(screen.getByTestId('server-versions-signin')).toBeInTheDocument()

    await ceeStampsGraphHash(HASH_AFTER_TURN)

    expect(listModelVersions).not.toHaveBeenCalled()
  })
})
