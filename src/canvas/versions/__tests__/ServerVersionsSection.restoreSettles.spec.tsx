/**
 * A RESTORE THROUGH THE MOUNTED PANEL IS THE WHOLE MODEL, AND IT SETTLES.
 *
 * Two defects, both reachable from Version history today and both on the path
 * canvas Undo will take (Undo IS a restore — assist.v1.scenario-versions.ts):
 *
 *  1. The overlay kept a value the restored version lacks, so the canvas showed
 *     a value the saved model does not hold.
 *  2. Nothing adopted the restored model's write base, so the next edit was
 *     sent on the pre-restore base and refused as stale.
 *
 * Drives the REAL panel, reconcile and store (network and session mocked), and
 * binds to the mounted surface via the section's own disclosure line.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

const SCENARIO = 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c'
const USER = '0f8a1b2c-3d4e-4f50-9a6b-7c8d9e0f1a2b'
const VERSION_HEAD = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'
const VERSION_OLD = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const UNDO_VERSION = 'cccccccc-3333-4333-8333-cccccccccccc'

const FACTOR = 'fac_churn'
const OPTION = 'opt_raise'
const CHURN_SET = { value: 0.037, raw_value: 3.7, unit: '%', source: 'user_override' }

const listModelVersions = vi.fn()
const saveModelVersion = vi.fn()
const restoreModelVersion = vi.fn()
vi.mock('../../../adapters/cee/modelVersions', () => ({
  listModelVersions: (...args: unknown[]) => listModelVersions(...args),
  saveModelVersion: (...args: unknown[]) => saveModelVersion(...args),
  restoreModelVersion: (...args: unknown[]) => restoreModelVersion(...args),
}))

const hydrateCanvasFromServer = vi.fn()
vi.mock('../../hydrate/serverGraphHydration', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  hydrateCanvasFromServer: (...args: unknown[]) => hydrateCanvasFromServer(...args),
}))

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: USER } }),
}))

vi.mock('../../../lib/supabase', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSessionIdentity: async () => ({ userId: USER, accessToken: 'token-for-USER' }),
}))

import { ServerVersionsSection, SERVER_VERSIONS_DISCLOSURE } from '../ServerVersionsSection'
import { useCanvasStore } from '../../store'
import { mapDraftNodeToCanvas } from '../../utils/applyDraftResult'

const TWO_VERSIONS = [
  {
    id: VERSION_HEAD,
    versionNumber: 2,
    label: null,
    provenance: 'commit',
    restoredFromVersionId: null,
    createdAt: '2026-09-30T13:30:00.000Z',
    graphIdentityHash: 'b'.repeat(64),
  },
  {
    id: VERSION_OLD,
    versionNumber: 1,
    label: 'Before the churn figure',
    provenance: 'user_save',
    restoredFromVersionId: null,
    createdAt: '2026-09-30T13:20:00.000Z',
    graphIdentityHash: 'a'.repeat(64),
  },
]

function wireFactor(extra: Record<string, unknown> = {}) {
  return { id: FACTOR, kind: 'factor', label: 'Churn', ...extra }
}
function wireOption() {
  return { id: OPTION, kind: 'option', label: 'Raise to £60' }
}

function seedCanvas(nodes: unknown[]) {
  const mapped = nodes.map((n) => mapDraftNodeToCanvas(n))
  useCanvasStore.setState({
    nodes: mapped,
    edges: [],
    lastAuthoritativeGraph: { nodeIds: mapped.map((n: { id: string }) => n.id), edgePairs: [] },
  } as never)
}

function restored(nodes: unknown[]) {
  return {
    status: 'restored',
    graph: { nodes, edges: [] },
    deduped: false,
    version: { versionId: 'dddddddd-4444-4444-8444-dddddddddddd', versionNumber: 3, deduped: false },
    undoVersionId: UNDO_VERSION,
    requestId: 'req-2',
  }
}

async function restoreVersionOne() {
  render(<ServerVersionsSection />)
  await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))
  expect(screen.getByTestId('server-versions-disclosure')).toHaveTextContent(SERVER_VERSIONS_DISCLOSURE)
  fireEvent.click(screen.getByRole('button', { name: /restore version 1/i }))
  fireEvent.click(screen.getByRole('button', { name: /confirm restore/i }))
}

function factorData(): Record<string, unknown> {
  const n = useCanvasStore.getState().nodes.find((x) => x.id === FACTOR) as { data: Record<string, unknown> }
  return n.data
}

beforeEach(() => {
  vi.clearAllMocks()
  hydrateCanvasFromServer.mockResolvedValue('merged')
  useCanvasStore.setState({ currentScenarioId: SCENARIO, nodes: [], edges: [], lastAuthoritativeGraph: null } as never)
  useCanvasStore.getState().setCeeAnalysisReady(null)
  listModelVersions.mockResolvedValue({
    status: 'list',
    versions: TWO_VERSIONS,
    currentVersionId: VERSION_HEAD,
    requestId: 'req-1',
  })
})

afterEach(() => {
  cleanup()
  useCanvasStore.setState({ currentScenarioId: null, nodes: [], edges: [] } as never)
})

describe('Version-history restore — the restored version is the whole model', () => {
  it('clears a value the restored version does not hold (the saved model has none)', async () => {
    seedCanvas([wireFactor({ observed_state: CHURN_SET }), wireOption()])
    expect(factorData().observedState).toEqual(CHURN_SET)
    restoreModelVersion.mockResolvedValue(restored([wireFactor(), wireOption()]))

    await restoreVersionOne()
    await waitFor(() => expect(restoreModelVersion).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByTestId('server-versions-message')).toBeInTheDocument())

    expect(factorData().observedState).toBeUndefined()
  })
})

describe('Version-history restore — it settles through the cold-open read', () => {
  it('re-reads the restored scenario once, with the session identity, after a restore', async () => {
    seedCanvas([wireFactor({ observed_state: CHURN_SET }), wireOption()])
    restoreModelVersion.mockResolvedValue(restored([wireFactor(), wireOption()]))

    await restoreVersionOne()
    await waitFor(() => expect(hydrateCanvasFromServer).toHaveBeenCalledTimes(1))

    expect(hydrateCanvasFromServer).toHaveBeenCalledWith(SCENARIO, {
      userId: USER,
      accessToken: 'token-for-USER',
    })
  })

  it('does not re-read when the restore was refused as stale (nothing changed)', async () => {
    seedCanvas([wireFactor({ observed_state: CHURN_SET }), wireOption()])
    restoreModelVersion.mockResolvedValue({ status: 'conflict', requestId: 'req-2' })

    await restoreVersionOne()
    await waitFor(() => expect(restoreModelVersion).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByTestId('server-versions-message')).toBeInTheDocument())

    expect(hydrateCanvasFromServer).not.toHaveBeenCalled()
    expect(factorData().observedState).toEqual(CHURN_SET)
  })
})
