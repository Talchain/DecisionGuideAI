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
  compareModelVersions,
  listModelVersions,
  restoreModelVersion,
  saveModelVersion,
  modelVersionsUrl,
} from '../modelVersions'

const SCENARIO = 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c'
const USER = '0f8a1b2c-3d4e-4f50-9a6b-7c8d9e0f1a2b'
const VERSION_A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const HASH_A = 'a'.repeat(64)
const VERSION_B = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'
const HASH_B = 'b'.repeat(64)

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

function emptyDiffCategories() {
  return {
    structure: [],
    relationships: [],
    values_uncertainty: [],
    evidence_provenance: [],
    goals_constraints_options: [],
    assumptions_claims: [],
    presentation: [],
    other_model_fields: [],
  }
}

function wireDiff(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'model_version_diff.v1',
    scenario_id: SCENARIO,
    from_version_id: VERSION_A,
    to_version_id: VERSION_B,
    relation: 'different',
    from_full_hash: HASH_A,
    to_full_hash: HASH_B,
    analysis_equivalent: false,
    categories: {
      ...emptyDiffCategories(),
      values_uncertainty: [
        {
          path: 'nodes.factor-price.observed_state.value',
          change_kind: 'changed',
          entity_kind: 'node',
          entity_id: 'factor-price',
          label: 'Price',
          before_display: '0.5',
          after_display: '0.8',
          summary: 'Price changed from 0.5 to 0.8.',
          why_it_matters: 'This changes an analysis input.',
        },
      ],
    },
    coverage: { known_undetectable: [], known_uninterpreted_paths: [] },
    request_id: 'req-diff',
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
    expect(modelVersionsUrl(SCENARIO, 'compare')).toBe(
      `/bff/cee/scenarios/${SCENARIO}/versions/compare`,
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

describe('compareModelVersions', () => {
  it('POSTs only version identities and parses the fixed ModelVersionDiffV1 categories', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, wireDiff()))

    const result = await compareModelVersions(SCENARIO, {
      userId: USER,
      fromVersionId: VERSION_A,
      toVersionId: VERSION_B,
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe(`/bff/cee/scenarios/${SCENARIO}/versions/compare`)
    expect(JSON.parse(init.body)).toEqual({
      user_id: USER,
      from_version_id: VERSION_A,
      to_version_id: VERSION_B,
    })
    expect(result.status).toBe('compared')
    if (result.status !== 'compared') throw new Error('unreachable')
    expect(result.diff.categories.values_uncertainty[0]).toMatchObject({
      entityId: 'factor-price',
      changeKind: 'changed',
      beforeDisplay: '0.5',
      afterDisplay: '0.8',
    })
    expect(result.requestId).toBe('req-diff')
  })

  it('short-circuits a same-version request without touching the network', async () => {
    const result = await compareModelVersions(SCENARIO, {
      userId: USER,
      fromVersionId: VERSION_A,
      toVersionId: VERSION_A,
    })

    expect(result.status).toBe('sameVersion')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('fails closed on a wrong schema, mismatched identity or incomplete category coverage', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, wireDiff({ schema: 'other.v1' })))
    expect(
      (
        await compareModelVersions(SCENARIO, {
          userId: USER,
          fromVersionId: VERSION_A,
          toVersionId: VERSION_B,
        })
      ).status,
    ).toBe('unusable')

    fetchSpy.mockResolvedValueOnce(jsonResponse(200, wireDiff({ to_version_id: VERSION_A })))
    expect(
      (
        await compareModelVersions(SCENARIO, {
          userId: USER,
          fromVersionId: VERSION_A,
          toVersionId: VERSION_B,
        })
      ).status,
    ).toBe('unusable')

    const categories = emptyDiffCategories()
    delete (categories as Partial<typeof categories>).evidence_provenance
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, wireDiff({ categories })))
    expect(
      (
        await compareModelVersions(SCENARIO, {
          userId: USER,
          fromVersionId: VERSION_A,
          toVersionId: VERSION_B,
        })
      ).status,
    ).toBe('unusable')
  })

  it('does not accept an uncontracted actor field and therefore cannot infer a person', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, wireDiff({ attribution: { actor_type: 'human', actor_user_id: USER } })),
    )

    const result = await compareModelVersions(SCENARIO, {
      userId: USER,
      fromVersionId: VERSION_A,
      toVersionId: VERSION_B,
    })

    expect(result.status).toBe('unusable')
  })

  it('maps a missing version without retrying', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(404, {
        schema: 'error.v1',
        code: 'NOT_FOUND',
        message: 'gone',
        details: { code: 'VERSION_NOT_FOUND' },
      }),
    )

    const result = await compareModelVersions(SCENARIO, {
      userId: USER,
      fromVersionId: VERSION_A,
      toVersionId: VERSION_B,
    })

    expect(result.status).toBe('versionNotFound')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
