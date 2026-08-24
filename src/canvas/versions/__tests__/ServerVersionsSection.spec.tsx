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
 *     version id (not the newest, not a constant) and with an immediately
 *     re-read working-graph identity as the CAS expectation.
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
const RESTORED_VERSION = 'dddddddd-4444-4444-8444-dddddddddddd'
const HASH_HEAD = 'b'.repeat(64)
const HASH_OLD = 'a'.repeat(64)
const IDENTITY_REGIME = {
  algorithm: 'sha256',
  projectionVersion: 'identity.v1',
  normaliserVersion: 'normaliser.v1',
  graphSchemaVersion: 'graph_v3',
}

const ANALYSIS_STATE = {
  run_state: { kind: 'complete_current', computed_at: '2026-08-24T10:00:00.000Z' },
  readiness: { status: 'ready', blockers: [] },
  leader_claim: { permitted: true },
  robustness: {},
  usable_for_prose: true,
  usable_for_chips: true,
  usable_for_followup: true,
  requires_rerun: false,
  blocked_unusable: false,
  contradictions: [],
} as const

function graphIdentity(value: string) {
  return { value, ...IDENTITY_REGIME }
}

const listModelVersions = vi.fn()
const saveModelVersion = vi.fn()
const restoreModelVersion = vi.fn()
const compareModelVersions = vi.fn()
vi.mock('../../../adapters/cee/modelVersions', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../adapters/cee/modelVersions')>()
  return {
    ...original,
    compareModelVersions: (...args: unknown[]) => compareModelVersions(...args),
    listModelVersions: (...args: unknown[]) => listModelVersions(...args),
    saveModelVersion: (...args: unknown[]) => saveModelVersion(...args),
    restoreModelVersion: (...args: unknown[]) => restoreModelVersion(...args),
  }
})

const fetchScenarioGraph = vi.fn()
vi.mock('../../../adapters/cee/scenarioGraph', () => ({
  fetchScenarioGraph: (...args: unknown[]) => fetchScenarioGraph(...args),
}))

const reconcileAppliedGraph = vi.fn()
vi.mock('../../utils/mergeAppliedGraph', () => ({
  reconcileAppliedGraph: (...args: unknown[]) => reconcileAppliedGraph(...args),
}))

const authState: { user: { id: string } | null } = { user: { id: USER } }
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: authState.user }),
}))

import { ServerVersionsSection } from '../ServerVersionsSection'
import { VERSION_HISTORY_REFRESH_EVENT } from '../modelVersionReceipt'
import { useCanvasStore } from '../../store'

function serverVersion(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: 'v2',
    id: VERSION_OLD,
    scenarioId: SCENARIO,
    versionNumber: 1,
    label: 'First cut',
    provenance: 'user_save',
    restoredFromVersionId: null,
    createdAt: '2026-08-17T10:00:00.000Z',
    graphIdentityHash: HASH_OLD,
    analysisAffectingHash: HASH_OLD,
    actor: { kind: 'unknown' },
    creation: { kind: 'initial', mutationId: null, sourceTurnId: null },
    lineage: { kind: 'known', parentVersionId: null, rootVersionId: VERSION_OLD },
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
    actor: { kind: 'system' },
    creation: {
      kind: 'committed_mutation',
      mutationId: null,
      sourceTurnId: 'turn-head',
    },
    lineage: { kind: 'known', parentVersionId: VERSION_OLD, rootVersionId: VERSION_OLD },
  }),
  serverVersion(),
]

const VERIFIED_LIST = {
  status: 'list',
  versions: [
    serverVersion({
      id: RESTORED_VERSION,
      versionNumber: 3,
      label: 'Restored state',
      graphIdentityHash: HASH_OLD,
      actor: { kind: 'system' },
      creation: {
        kind: 'restore',
        sourceVersionId: VERSION_OLD,
        mutationId: 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee',
        sourceTurnId: null,
      },
      lineage: {
        kind: 'known',
        parentVersionId: VERSION_HEAD,
        rootVersionId: VERSION_OLD,
      },
    }),
    ...TWO_VERSIONS,
  ],
  currentVersionId: RESTORED_VERSION,
  contractVersion: 'v2',
  nextCursor: null,
  requestId: 'req-verify',
}

function comparedDiff() {
  return {
    schema: 'model_version_diff.v1' as const,
    scenarioId: SCENARIO,
    fromVersionId: VERSION_OLD,
    toVersionId: VERSION_HEAD,
    relation: 'different' as const,
    fromFullHash: HASH_OLD,
    toFullHash: HASH_HEAD,
    analysisEquivalent: false,
    categories: {
      structure: [],
      relationships: [],
      values_uncertainty: [
        {
          path: '/nodes/factor-price/value',
          changeKind: 'changed' as const,
          entityKind: 'node' as const,
          entityId: 'factor-price',
          label: 'Price',
          beforeDisplay: '0.5',
          afterDisplay: '0.8',
          summary: 'Price changed from 0.5 to 0.8.',
          whyItMatters: 'This changes an analysis input.',
        },
      ],
      evidence_provenance: [],
      goals_constraints_options: [],
      assumptions_claims: [],
      presentation: [],
      other_model_fields: [],
    },
    coverage: { knownUndetectable: [], knownUninterpretedPaths: [] },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  authState.user = { id: USER }
  useCanvasStore.setState({ currentScenarioId: SCENARIO } as never)
  useCanvasStore.getState().setAnalysisStateV1(null)
  listModelVersions.mockResolvedValue({
    status: 'list',
    versions: TWO_VERSIONS,
    currentVersionId: VERSION_HEAD,
    contractVersion: 'v2',
    nextCursor: null,
    requestId: 'req-1',
  })
  fetchScenarioGraph.mockResolvedValue({
    status: 'graph',
    graph: { nodes: [], edges: [] },
    identity: graphIdentity(HASH_HEAD),
    requestId: 'req-graph',
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
  useCanvasStore.getState().setAnalysisStateV1(null)
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
    expect(rows[0]).toHaveTextContent('Actor: System')
    expect(rows[1]).toHaveTextContent('Actor: Unknown')
    expect(rows[0]).toHaveTextContent('Creation: committed model change')
    expect(rows[1]).toHaveTextContent('Lineage: root version')
  })

  it('uses legacy provenance only as creation metadata and never infers System', async () => {
    listModelVersions.mockResolvedValue({
      status: 'list',
      versions: [
        serverVersion({
          contractVersion: 'v1-compat',
          provenance: 'commit',
          actor: { kind: 'unknown' },
          creation: { kind: 'unknown', mutationId: null, sourceTurnId: null },
          lineage: { kind: 'unknown' },
        }),
      ],
      currentVersionId: VERSION_OLD,
      contractVersion: 'v1-compat',
      nextCursor: null,
      requestId: 'req-v1',
    })
    render(<ServerVersionsSection />)
    await waitFor(() => expect(screen.getByTestId('server-version-row')).toBeInTheDocument())
    expect(screen.getByTestId('server-versions-legacy-contract')).toHaveTextContent(
      /actor and lineage are unknown/i,
    )
    expect(screen.getByTestId('server-version-row')).toHaveTextContent('Actor: Unknown')
    expect(screen.getByTestId('server-version-row')).toHaveTextContent(
      'Creation: saved on model change (legacy metadata)',
    )
    expect(screen.getByTestId('server-version-row')).not.toHaveTextContent('Actor: System')
  })

  it('renders nothing without a server-addressable (UUID) scenario', () => {
    useCanvasStore.setState({ currentScenarioId: 'local-draft-1' } as never)
    const { container } = render(<ServerVersionsSection />)
    expect(container).toBeEmptyDOMElement()
    expect(listModelVersions).not.toHaveBeenCalled()
  })

  it('refreshes this scenario when a verified ordinary mutation is signalled', async () => {
    render(<ServerVersionsSection />)
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))
    listModelVersions.mockClear()

    window.dispatchEvent(
      new CustomEvent(VERSION_HISTORY_REFRESH_EVENT, {
        detail: { scenarioId: SCENARIO, versionId: RESTORED_VERSION },
      }),
    )

    await waitFor(() => expect(listModelVersions).toHaveBeenCalledTimes(1))
  })
})

describe('ServerVersionsSection — guests (pin 5)', () => {
  it('invites sign-in and never calls the network', () => {
    authState.user = null
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
      receipt: {
        schema: 'model_version_mutation_receipt.v1',
        scenario_id: SCENARIO,
        mutation_id: 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee',
        version_id: RESTORED_VERSION,
        sequence: 3,
        graph: {
          nodes: [{ id: 'n1', label: 'Take the job', kind: 'option' }],
          edges: [],
        },
        full_hash: HASH_OLD,
        hash_algorithm: IDENTITY_REGIME.algorithm,
        identity_projection_version: IDENTITY_REGIME.projectionVersion,
        identity_normaliser_version: IDENTITY_REGIME.normaliserVersion,
        graph_schema_version: IDENTITY_REGIME.graphSchemaVersion,
        analysis_affecting_hash: HASH_OLD,
        actor: { kind: 'system' },
        creation: { kind: 'restore', source_version_id: VERSION_OLD },
        source_turn_id: null,
        lineage: { kind: 'unknown' },
        undo_version_id: UNDO_VERSION,
        event_id: 'restore-event-1',
      },
      analysisState: null,
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

  it('moves focus to Confirm when armed and returns it to the same Restore button on Cancel', async () => {
    render(<ServerVersionsSection />)
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))

    const restore = screen.getByRole('button', { name: /restore version 1/i })
    fireEvent.click(restore)
    const confirm = screen.getByRole('button', { name: /confirm restore/i })
    await waitFor(() => expect(confirm).toHaveFocus())

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /restore version 1/i })).toHaveFocus(),
    )
    expect(restoreModelVersion).not.toHaveBeenCalled()
  })

  it("PIN 2 — confirms with THAT row's id and the live scenario-graph hash as CAS", async () => {
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
        mutationId: expect.any(String),
        expectedGraphIdentityHash: HASH_HEAD,
      }),
    )
    expect(fetchScenarioGraph.mock.invocationCallOrder[0]).toBeLessThan(
      restoreModelVersion.mock.invocationCallOrder[0],
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
    const arg = reconcileAppliedGraph.mock.calls[0][0] as {
      graph: { nodes: { id: string }[] }
    }
    expect(arg.graph.nodes.map((n) => n.id)).toEqual(['n1'])
  })

  it('claims restore completion only after list-head and scenario-graph identity re-reads agree', async () => {
    restoreModelVersion.mockResolvedValue(restoredResponse())
    fetchScenarioGraph
      .mockResolvedValueOnce({
        status: 'graph',
        graph: { nodes: [], edges: [] },
        identity: graphIdentity(HASH_HEAD),
      })
      .mockResolvedValueOnce({
        status: 'graph',
        graph: { nodes: [], edges: [] },
        identity: graphIdentity(HASH_OLD),
      })
    render(<ServerVersionsSection />)
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))
    listModelVersions.mockResolvedValueOnce(VERIFIED_LIST)

    fireEvent.click(screen.getByRole('button', { name: /restore version 1/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm restore/i }))

    await waitFor(() =>
      expect(screen.getByTestId('server-versions-message')).toHaveTextContent(
        /restored and verified/i,
      ),
    )
    expect(fetchScenarioGraph).toHaveBeenCalledWith(
      SCENARIO,
      expect.objectContaining({ userId: USER }),
    )
  })

  it('keeps success unknown when the post-restore head does not match the receipt', async () => {
    restoreModelVersion.mockResolvedValue(restoredResponse())
    render(<ServerVersionsSection />)
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))

    fireEvent.click(screen.getByRole('button', { name: /restore version 1/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm restore/i }))

    await waitFor(() =>
      expect(screen.getByTestId('server-versions-message')).toHaveTextContent(
        /could not both be verified/i,
      ),
    )
    expect(screen.getByTestId('server-versions-message')).not.toHaveTextContent(
      /restored and verified/i,
    )
  })

  it('adopts a non-null restore analysis verdict and retains the current verdict on null', async () => {
    useCanvasStore.getState().setAnalysisStateV1(ANALYSIS_STATE as never)
    restoreModelVersion.mockResolvedValue(restoredResponse())
    render(<ServerVersionsSection />)
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))

    fireEvent.click(screen.getByRole('button', { name: /restore version 1/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm restore/i }))
    await waitFor(() => expect(reconcileAppliedGraph).toHaveBeenCalledTimes(1))
    expect(useCanvasStore.getState().analysisStateV1).toEqual(ANALYSIS_STATE)

    const replacement = {
      ...ANALYSIS_STATE,
      run_state: { kind: 'stale', stale_since: '2026-08-24T10:05:00.000Z' },
      requires_rerun: true,
    } as const
    const withVerdict = restoredResponse()
    withVerdict.analysisState = replacement as never
    restoreModelVersion.mockResolvedValue(withVerdict)
    reconcileAppliedGraph.mockClear()

    fireEvent.click(screen.getByRole('button', { name: /restore version 1/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm restore/i }))
    await waitFor(() => expect(reconcileAppliedGraph).toHaveBeenCalledTimes(1))
    expect(useCanvasStore.getState().analysisStateV1).toEqual(replacement)
  })

  it('refuses before creating a mutation when the live scenario identity is unavailable', async () => {
    fetchScenarioGraph.mockResolvedValue({ status: 'unavailable' })
    render(<ServerVersionsSection />)
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))

    fireEvent.click(screen.getByRole('button', { name: /restore version 1/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm restore/i }))

    await waitFor(() =>
      expect(screen.getByTestId('server-versions-message')).toHaveTextContent(
        /restore was not started/i,
      ),
    )
    expect(restoreModelVersion).not.toHaveBeenCalled()
  })

  it('ignores an in-flight preflight completion after unmount', async () => {
    let resolveGraph: ((value: unknown) => void) | undefined
    fetchScenarioGraph.mockReturnValue(
      new Promise((resolve) => {
        resolveGraph = resolve
      }),
    )
    const view = render(<ServerVersionsSection />)
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))

    fireEvent.click(screen.getByRole('button', { name: /restore version 1/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm restore/i }))
    view.unmount()
    resolveGraph?.({ status: 'graph', graph: { nodes: [], edges: [] }, identity: graphIdentity(HASH_HEAD) })

    await Promise.resolve()
    expect(restoreModelVersion).not.toHaveBeenCalled()
  })

  it('shows an off-page head without marking the first row current', async () => {
    listModelVersions.mockResolvedValue({
      status: 'list',
      versions: TWO_VERSIONS,
      currentVersionId: RESTORED_VERSION,
      contractVersion: 'v2',
      nextCursor: 'older',
      requestId: 'req-page',
    })
    restoreModelVersion.mockResolvedValue({ status: 'conflict' })
    render(<ServerVersionsSection />)
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))

    fireEvent.click(screen.getByRole('button', { name: /restore version 1/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm restore/i }))
    await waitFor(() => expect(restoreModelVersion).toHaveBeenCalledTimes(1))
    expect(restoreModelVersion.mock.calls[0][1]).toMatchObject({
      versionId: VERSION_OLD,
      expectedGraphIdentityHash: HASH_HEAD,
    })
    expect(screen.getByTestId('server-versions-more-pages')).toBeInTheDocument()
    expect(screen.getAllByTestId('server-version-row')[0]).not.toHaveTextContent(/current/i)
  })

  it('PIN 4 — the undo affordance restores the server-named pre-restore snapshot', async () => {
    restoreModelVersion.mockResolvedValue(restoredResponse())
    render(<ServerVersionsSection />)
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))

    fireEvent.click(screen.getByRole('button', { name: /restore version 1/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm restore/i }))
    await waitFor(() => expect(screen.getByTestId('server-restore-undo')).toBeInTheDocument())

    restoreModelVersion.mockClear()
    const restored = restoredResponse()
    const noUndo = {
      ...restored,
      receipt: { ...restored.receipt, undo_version_id: null },
    }
    restoreModelVersion.mockResolvedValue(noUndo)
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

describe('ServerVersionsSection — deterministic shared comparison', () => {
  it('compares the selected persisted ids and renders the typed server diff', async () => {
    compareModelVersions.mockResolvedValue({
      status: 'compared',
      diff: comparedDiff(),
      requestId: 'req-diff',
    })
    render(<ServerVersionsSection />)
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))

    fireEvent.click(screen.getByRole('button', { name: /^compare shared versions$/i }))

    await waitFor(() => expect(compareModelVersions).toHaveBeenCalledTimes(1))
    expect(compareModelVersions).toHaveBeenCalledWith(
      SCENARIO,
      expect.objectContaining({
        userId: USER,
        fromVersionId: VERSION_OLD,
        toVersionId: VERSION_HEAD,
      }),
    )
    expect(screen.getByText('Price changed from 0.5 to 0.8.')).toBeInTheDocument()
    expect(screen.getByTestId('server-diff-attribution')).toHaveTextContent(
      /actor: unknown.*does not include actor metadata/i,
    )
  })

  it('does not substitute the browser-local checkpoint diff when the server comparison is unavailable', async () => {
    compareModelVersions.mockResolvedValue({ status: 'unavailable' })
    render(<ServerVersionsSection />)
    await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))

    fireEvent.click(screen.getByRole('button', { name: /^compare shared versions$/i }))

    await waitFor(() =>
      expect(screen.getByTestId('server-version-compare-message')).toHaveTextContent(
        /no local checkpoint was substituted/i,
      ),
    )
    expect(screen.queryByTestId('server-version-diff')).not.toBeInTheDocument()
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
