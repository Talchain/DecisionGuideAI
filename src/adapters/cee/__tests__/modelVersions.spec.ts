/**
 * modelVersions adapter — the UI's client for CEE's versions wiring slice.
 *
 * Server contract (olumi-assistants-service, assist.v1.scenario-versions.ts):
 *   POST /bff/cee/scenarios/{id}/versions          → model_versions_list.v1
 *   POST /bff/cee/scenarios/{id}/versions/save     → model_version_save.v1
 *   POST /bff/cee/scenarios/{id}/versions/restore  → model_version_restore.v1
 *
 * What is pinned here:
 *  - the SAME transport rules as scenarioGraph.ts: literal same-origin
 *    `/bff/cee` base, POST, identity in the BODY, guest sentinel never sent;
 *  - typed outcomes for every refusal the server can answer (VERSION_STALE,
 *    SIGN_IN_REQUIRED, VERSIONS_DISABLED, RESTORE_INCOMPLETE, NOTHING_TO_SAVE,
 *    VERSION_NOT_FOUND) — a caller must never have to parse HTTP by hand;
 *  - identity-bound request bodies: restore carries the CHOSEN version_id;
 *  - writes are NEVER auto-retried (a restore is idempotent-converging
 *    server-side, but retrying is the USER's call, not the transport's).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  listModelVersions,
  restoreModelVersion,
  saveModelVersion,
  modelVersionsUrl,
} from '../modelVersions'

const SCENARIO = 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c'
const USER = '0f8a1b2c-3d4e-4f50-9a6b-7c8d9e0f1a2b'
const VERSION_A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const HASH_A = 'a'.repeat(64)

function wireSummary(overrides: Record<string, unknown> = {}) {
  return {
    id: VERSION_A,
    scenario_id: SCENARIO,
    owner_user_id: USER,
    version_number: 4,
    graph_identity_hash: HASH_A,
    hash_algorithm: 'sha256',
    identity_projection_version: 'identity.v1',
    identity_normaliser_version: 'normaliser.v1',
    graph_schema_version: 'graph.v1',
    label: 'Before pivot',
    provenance: 'user_save',
    restored_from_version_id: null,
    created_at: '2026-08-17T10:00:00.000Z',
    ...overrides,
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('modelVersionsUrl', () => {
  it('builds the same-origin /bff/cee URLs the edge function owns', () => {
    expect(modelVersionsUrl(SCENARIO)).toBe(`/bff/cee/scenarios/${SCENARIO}/versions`)
    expect(modelVersionsUrl(SCENARIO, 'restore')).toBe(
      `/bff/cee/scenarios/${SCENARIO}/versions/restore`,
    )
  })
})

describe('listModelVersions', () => {
  it('POSTs the user id in the body and parses the list envelope', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, {
        schema: 'model_versions_list.v1',
        scenario_id: SCENARIO,
        versions: [wireSummary()],
        current_version_id: VERSION_A,
        request_id: 'req-1',
      }),
    )

    const result = await listModelVersions(SCENARIO, { userId: USER })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe(`/bff/cee/scenarios/${SCENARIO}/versions`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body).user_id).toBe(USER)

    expect(result.status).toBe('list')
    if (result.status !== 'list') throw new Error('unreachable')
    expect(result.versions).toHaveLength(1)
    expect(result.versions[0]).toMatchObject({
      id: VERSION_A,
      versionNumber: 4,
      label: 'Before pivot',
      provenance: 'user_save',
      graphIdentityHash: HASH_A,
    })
    expect(result.currentVersionId).toBe(VERSION_A)
  })

  it('never sends the guest sentinel as a user id', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, {
        schema: 'model_versions_list.v1',
        scenario_id: SCENARIO,
        versions: [],
        current_version_id: null,
        request_id: 'req-2',
      }),
    )

    await listModelVersions(SCENARIO, { userId: 'guest' })
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect('user_id' in body).toBe(false)
  })

  it('maps 404 to notReadable and 503 VERSIONS_DISABLED to disabled', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(404, { schema: 'error.v1', code: 'NOT_FOUND', message: 'no' }),
    )
    expect((await listModelVersions(SCENARIO, { userId: USER })).status).toBe('notReadable')

    fetchSpy.mockResolvedValueOnce(
      jsonResponse(503, {
        schema: 'error.v1',
        code: 'INTERNAL',
        message: 'off',
        details: { code: 'VERSIONS_DISABLED' },
      }),
    )
    expect((await listModelVersions(SCENARIO, { userId: USER })).status).toBe('disabled')
  })

  it('refuses a wrong schema discriminator rather than guessing at the shape', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, { schema: 'something_else.v9', versions: [] }),
    )
    expect((await listModelVersions(SCENARIO, { userId: USER })).status).toBe('unusable')
  })

  it('fails CLOSED on a malformed version row — never a silently shortened list', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, {
        schema: 'model_versions_list.v1',
        scenario_id: SCENARIO,
        versions: [wireSummary({ version_number: 'four' })],
        current_version_id: null,
        request_id: 'req-3',
      }),
    )
    expect((await listModelVersions(SCENARIO, { userId: USER })).status).toBe('unusable')
  })
})

describe('saveModelVersion', () => {
  it('sends the label and returns the saved outcome', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, {
        schema: 'model_version_save.v1',
        scenario_id: SCENARIO,
        version: {
          version_id: VERSION_A,
          version_number: 4,
          graph_identity_hash: HASH_A,
          deduped: false,
          event_id: 'evt',
        },
        request_id: 'req-4',
      }),
    )

    const result = await saveModelVersion(SCENARIO, { userId: USER, label: 'Before pivot' })

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe(`/bff/cee/scenarios/${SCENARIO}/versions/save`)
    const body = JSON.parse(init.body)
    expect(body.label).toBe('Before pivot')
    expect(body.user_id).toBe(USER)
    // The adapter NEVER sends a graph: the server versions ITS graph.
    expect('graph' in body).toBe(false)

    expect(result.status).toBe('saved')
    if (result.status !== 'saved') throw new Error('unreachable')
    expect(result.version.versionId).toBe(VERSION_A)
    expect(result.version.deduped).toBe(false)
  })

  it('maps SIGN_IN_REQUIRED, VERSION_STALE and NOTHING_TO_SAVE to typed outcomes', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(401, {
        schema: 'error.v1',
        code: 'UNAUTHENTICATED',
        message: 'sign in',
        details: { code: 'SIGN_IN_REQUIRED' },
      }),
    )
    expect((await saveModelVersion(SCENARIO, {})).status).toBe('signInRequired')

    fetchSpy.mockResolvedValueOnce(
      jsonResponse(409, {
        schema: 'error.v1',
        code: 'BAD_INPUT',
        message: 'stale',
        details: { code: 'VERSION_STALE' },
      }),
    )
    expect((await saveModelVersion(SCENARIO, { userId: USER })).status).toBe('conflict')

    fetchSpy.mockResolvedValueOnce(
      jsonResponse(422, {
        schema: 'error.v1',
        code: 'BAD_INPUT',
        message: 'empty',
        details: { code: 'NOTHING_TO_SAVE' },
      }),
    )
    expect((await saveModelVersion(SCENARIO, { userId: USER })).status).toBe('nothingToSave')
  })

  it("does NOT auto-retry a 503 — a write retry is the user's call", async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(503, { schema: 'error.v1', code: 'INTERNAL', message: 'down' }),
    )
    const result = await saveModelVersion(SCENARIO, { userId: USER })
    expect(result.status).toBe('unavailable')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})

describe('restoreModelVersion', () => {
  it('sends the CHOSEN version id and expected hash; returns the restored graph and undo id', async () => {
    const restoredGraph = {
      nodes: [{ id: 'n1', label: 'Take the job', kind: 'option' }],
      edges: [],
    }
    fetchSpy.mockResolvedValue(
      jsonResponse(200, {
        schema: 'model_version_restore.v1',
        scenario_id: SCENARIO,
        restored: true,
        deduped: false,
        version: {
          version_id: 'dddddddd-4444-4444-8444-dddddddddddd',
          version_number: 5,
          graph_identity_hash: HASH_A,
          deduped: false,
          event_id: 'evt',
          restored_from_version_id: VERSION_A,
        },
        undo_version_id: 'cccccccc-3333-4333-8333-cccccccccccc',
        graph: restoredGraph,
        graph_identity_hash: { value: HASH_A, projection_version: 'identity.v1' },
        request_id: 'req-5',
      }),
    )

    const result = await restoreModelVersion(SCENARIO, {
      userId: USER,
      versionId: VERSION_A,
      expectedGraphIdentityHash: HASH_A,
    })

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe(`/bff/cee/scenarios/${SCENARIO}/versions/restore`)
    const body = JSON.parse(init.body)
    expect(body.version_id).toBe(VERSION_A)
    expect(body.expected_graph_identity_hash).toBe(HASH_A)
    // Restore NEVER sends a graph — the server copies the stored version's.
    expect('graph' in body).toBe(false)

    expect(result.status).toBe('restored')
    if (result.status !== 'restored') throw new Error('unreachable')
    expect(result.graph).toEqual(restoredGraph)
    expect(result.undoVersionId).toBe('cccccccc-3333-4333-8333-cccccccccccc')
    expect(result.deduped).toBe(false)
  })

  it('maps VERSION_NOT_FOUND, VERSION_STALE and RESTORE_INCOMPLETE to typed outcomes', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(404, {
        schema: 'error.v1',
        code: 'NOT_FOUND',
        message: 'gone',
        details: { code: 'VERSION_NOT_FOUND' },
      }),
    )
    expect(
      (await restoreModelVersion(SCENARIO, { userId: USER, versionId: VERSION_A })).status,
    ).toBe('versionNotFound')

    fetchSpy.mockResolvedValueOnce(
      jsonResponse(409, {
        schema: 'error.v1',
        code: 'BAD_INPUT',
        message: 'stale',
        details: { code: 'VERSION_STALE' },
      }),
    )
    expect(
      (await restoreModelVersion(SCENARIO, { userId: USER, versionId: VERSION_A })).status,
    ).toBe('conflict')

    fetchSpy.mockResolvedValueOnce(
      jsonResponse(503, {
        schema: 'error.v1',
        code: 'INTERNAL',
        message: 'partial',
        details: { code: 'RESTORE_INCOMPLETE', version_recorded: true },
      }),
    )
    expect(
      (await restoreModelVersion(SCENARIO, { userId: USER, versionId: VERSION_A })).status,
    ).toBe('incomplete')
  })

  it('a restore answer with restored:true but NO graph object is unusable — never applied blind', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, {
        schema: 'model_version_restore.v1',
        scenario_id: SCENARIO,
        restored: true,
        deduped: false,
        version: {
          version_id: VERSION_A,
          version_number: 5,
          graph_identity_hash: HASH_A,
          deduped: false,
          event_id: null,
        },
        undo_version_id: null,
        graph: null,
        graph_identity_hash: null,
        request_id: 'req-6',
      }),
    )
    expect(
      (await restoreModelVersion(SCENARIO, { userId: USER, versionId: VERSION_A })).status,
    ).toBe('unusable')
  })

  it('never auto-retries any failure', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(503, { schema: 'error.v1', code: 'INTERNAL', message: 'down' }),
    )
    await restoreModelVersion(SCENARIO, { userId: USER, versionId: VERSION_A })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
