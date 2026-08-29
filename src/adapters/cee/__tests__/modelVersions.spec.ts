/**
 * modelVersions adapter — the UI's client for CEE's versions wiring slice.
 *
 * Server contract (olumi-assistants-service, assist.v1.scenario-versions.ts):
 *   POST /bff/cee/scenarios/{id}/versions          → model_versions_list.v2
 *   POST /bff/cee/scenarios/{id}/versions/save     → model_version_save.v1
 *   POST /bff/cee/scenarios/{id}/versions/restore  → model_version_restore.v2
 *
 * ⚠ WHY THE v1 EXPECTATIONS IN THIS FILE CHANGED (2026-08-27). CEE bumped LIST
 * and RESTORE to v2 in commit `4c29c5b5` (merged 26 Aug 14:52Z, an ancestor of
 * the deployed staging tip `3c3d3d53` / `/healthz` build `3c3d3d5`). This spec
 * previously pinned v1 acceptance as CORRECT; that expectation is now false
 * about the deployed server, so it is changed here deliberately rather than
 * left to fail. Every converted case keeps its ORIGINAL text in an adjacent
 * comment so the change is auditable and nothing is silently rewritten.
 * SAVE remains v1 on both sides and is untouched.
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

// ─────────────────────────────────────────────────────────────────────────────
// v2 CONTRACT — list + restore
//
// PROVENANCE OF EVERY FIXTURE FIELD BELOW: derived at the bytes from CEE
// staging `3c3d3d53b5202526e09f2c770c5bcc467d83856d` (== deployed /healthz
// build `3c3d3d5`), namely
//   src/routes/assist.v1.scenario-versions.ts
//     :115 MODEL_VERSIONS_LIST_SCHEMA   = "model_versions_list.v2"
//     :118 MODEL_VERSION_RESTORE_SCHEMA = "model_version_restore.v2"
//     :152-161 AtomicRestoreRouteResponseSchema (.strict())
//     :169-241 summaryV2() — the row→wire mapping
//   src/orchestrator-v5/model-management/history-v2.ts   (list + summary shapes)
//   src/orchestrator-v5/model-management/mutation-receipt.ts  (receipt shape)
// and cross-checked against CEE's OWN route test
//   src/routes/__tests__/assist.v1.scenario-versions.test.ts
//     :370 list schema · :795-822 restore, incl. the EXACT top-level key set
//          ["analysis_state","receipt","request_id","restored","scenario_id","schema"].
// These are the producer's bytes, not this lane's model of the producer.
// ─────────────────────────────────────────────────────────────────────────────

const ANALYSIS_HASH = 'd'.repeat(64)
const SNAPSHOT_VERSION = 'cccccccc-3333-4333-8333-cccccccccccc'
const RESTORED_VERSION = 'dddddddd-4444-4444-8444-dddddddddddd'
const MUTATION_ID = 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee'
/** Request-side id for the pre-C8-A cases below, which predate the field. */
const LEGACY_MUTATION_ID = '11111111-7777-4777-8777-111111111111'

/** A v2 summary exactly as CEE's `summaryV2()` emits it for its default row
 *  (actor_kind null + authored_by null ⇒ {kind:'unknown'}; creation_kind null
 *  with no source pointer ⇒ {kind:'unknown', …}; root_version_id null ⇒
 *  lineage {kind:'unknown'}). */
function wireSummaryV2(overrides: Record<string, unknown> = {}) {
  return {
    version_id: VERSION_A,
    scenario_id: SCENARIO,
    sequence: 4,
    label: 'Before pivot',
    created_at: '2026-08-17T10:00:00.000Z',
    actor: { kind: 'unknown' },
    creation: { kind: 'unknown', mutation_id: null, source_turn_id: null },
    lineage: { kind: 'unknown' },
    full_hash: HASH_A,
    analysis_affecting_hash: ANALYSIS_HASH,
    ...overrides,
  }
}

function listBodyV2(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'model_versions_list.v2',
    request_id: 'req-1',
    scenario_id: SCENARIO,
    current_version_id: VERSION_A,
    versions: [wireSummaryV2()],
    next_cursor: null,
    ...overrides,
  }
}

const RESTORED_GRAPH_V2 = {
  nodes: [
    { id: 'n1', label: 'Take the job', kind: 'option' },
    { id: 'n2', label: 'Commute time', kind: 'factor' },
  ],
  edges: [
    {
      from: 'n1',
      to: 'n2',
      strength: { mean: 0.4, std: 0.1 },
      exists_probability: 0.9,
      effect_direction: 'positive',
    },
  ],
}

function restoreBodyV2(receiptOverrides: Record<string, unknown> = {}) {
  return {
    schema: 'model_version_restore.v2',
    scenario_id: SCENARIO,
    restored: true,
    receipt: {
      schema: 'model_version_mutation_receipt.v1',
      scenario_id: SCENARIO,
      mutation_id: MUTATION_ID,
      version_id: RESTORED_VERSION,
      sequence: 4,
      graph: RESTORED_GRAPH_V2,
      full_hash: HASH_A,
      hash_algorithm: 'sha256',
      identity_projection_version: 'identity.v1',
      identity_normaliser_version: 'normaliser.v1',
      graph_schema_version: 'graph.v1',
      analysis_affecting_hash: ANALYSIS_HASH,
      actor: { kind: 'known', authored_by: 'owner' },
      creation: { kind: 'restore', source_version_id: VERSION_A },
      source_turn_id: null,
      lineage: {
        kind: 'known',
        parent_version_id: SNAPSHOT_VERSION,
        root_version_id: SNAPSHOT_VERSION,
      },
      undo_version_id: SNAPSHOT_VERSION,
      event_id: `model_version_restored_mutation_${MUTATION_ID}`,
      ...receiptOverrides,
    },
    analysis_state: null,
    request_id: 'req-5',
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
  // CONVERTED v1 → v2. Original fixture was:
  //   { schema: 'model_versions_list.v1', scenario_id, versions: [wireSummary()],
  //     current_version_id: VERSION_A, request_id: 'req-1' }
  // and it asserted `provenance: 'user_save'`. v2 has no flat `provenance`
  // field — creation is a discriminated union — so the expectation below reads
  // `creation.kind` instead. See the file header for why.
  it('POSTs the user id in the body and parses the list envelope', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, listBodyV2()))

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
      // was `provenance: 'user_save'` under v1 — v2 spells creation as a union
      provenance: 'unknown',
      graphIdentityHash: HASH_A,
    })
    expect(result.currentVersionId).toBe(VERSION_A)
  })

  // CONVERTED v1 → v2 (label only; this case asserts the REQUEST, not the
  // response). Original fixture carried `schema: 'model_versions_list.v1'`.
  it('never sends the guest sentinel as a user id', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(
        200,
        listBodyV2({ versions: [], current_version_id: null, request_id: 'req-2' }),
      ),
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

  // CONVERTED v1 → v2. Original fixture was a v1 envelope carrying
  //   `wireSummary({ version_number: 'four' })`.
  // ⚠ LEFT AS v1 THIS CASE WOULD HAVE PASSED FOR THE WRONG REASON once the
  // adapter went v2-only: the v1 SCHEMA GUARD would return 'unusable' before
  // the row parser ever ran, so it would no longer test row validation at all.
  // Re-pointed at the v2 shape with a wrong-TYPE `sequence`, which complements
  // the missing-`sequence` case in the v2 block below.
  it('fails CLOSED on a malformed version row — never a silently shortened list', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(
        200,
        listBodyV2({
          versions: [wireSummaryV2({ sequence: 'four' })],
          current_version_id: null,
          request_id: 'req-3',
        }),
      ),
    )
    expect((await listModelVersions(SCENARIO, { userId: USER })).status).toBe('unusable')
  })

  // THE v2-ONLY DECISION, MADE VISIBLE. There is no live v1 producer (CEE
  // whole-repo sweep at `3c3d3d53`: zero v1 list/restore literals, no content
  // negotiation), so v1 is refused rather than accepted "just in case" — an
  // accepted-but-unproduced branch would be a compatibility path with no
  // deletion condition. If this REDs, a v1 producer has appeared and the
  // decision needs revisiting deliberately.
  it('refuses a v1 list envelope — v2-only, by decision', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, {
        schema: 'model_versions_list.v1',
        scenario_id: SCENARIO,
        versions: [],
        current_version_id: null,
        request_id: 'req-legacy',
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
  // CONVERTED v1 → v2. The original fixture was a FLAT v1 envelope:
  //   { schema: 'model_version_restore.v1', scenario_id, restored: true,
  //     deduped: false,
  //     version: { version_id: 'dddddddd-…', version_number: 5,
  //                graph_identity_hash: HASH_A, deduped: false, event_id: 'evt',
  //                restored_from_version_id: VERSION_A },
  //     undo_version_id: 'cccccccc-…', graph: restoredGraph,
  //     graph_identity_hash: { value: HASH_A, projection_version: 'identity.v1' },
  //     request_id: 'req-5' }
  // In v2 `graph`, `version` and `undo_version_id` all moved INSIDE `receipt`
  // and the ordinal is `sequence`, not `version_number`. This case still exists
  // for what it uniquely pins: the REQUEST body (chosen version id, expected
  // hash, and that a restore never sends a graph).
  it('sends the CHOSEN version id and expected hash; returns the restored graph and undo id', async () => {
    const restoredGraph = RESTORED_GRAPH_V2
    fetchSpy.mockResolvedValue(jsonResponse(200, restoreBodyV2()))

    const result = await restoreModelVersion(SCENARIO, {
      userId: USER,
      versionId: VERSION_A,
      mutationId: LEGACY_MUTATION_ID,
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
    expect(result.undoVersionId).toBe(SNAPSHOT_VERSION)
    // v2 carries NO replay signal on the wire (CEE logs `replayed` but the
    // .strict() response schema omits it), so this is false by construction.
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
      (await restoreModelVersion(SCENARIO, {
        userId: USER,
        versionId: VERSION_A,
        mutationId: LEGACY_MUTATION_ID,
        expectedGraphIdentityHash: HASH_A,
      })).status,
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
      (await restoreModelVersion(SCENARIO, {
        userId: USER,
        versionId: VERSION_A,
        mutationId: LEGACY_MUTATION_ID,
        expectedGraphIdentityHash: HASH_A,
      })).status,
    ).toBe('conflict')

    fetchSpy.mockResolvedValueOnce(
      jsonResponse(503, {
        schema: 'error.v1',
        code: 'INTERNAL',
        message: 'partial',
        details: { code: 'RESTORE_INCOMPLETE', version_recorded: true },
        // CONVERTED 2026-08-29, ORIGINAL PRESERVED per this file's convention:
        //     ).toBe('incomplete')
        // That producer no longer exists. Swept whole-repo at CEE staging
        // `f18d941b`: `RESTORE_INCOMPLETE` appears 3 times, ALL comments in
        // `tests/integration/c4-canonical-state-restore.contract.test.ts`, and
        // ZERO times in `src/` (contrast controls, same run: VERSION_STALE 2
        // files, MUTATION_ID_REUSED 2, VERSION_NOT_FOUND 1,
        // RESTORE_PAYLOAD_INVALID 1; fabricated marker 0). CEE's C8 atomic RPC
        // removed the partial-restore state, so a 503 that is not
        // VERSIONS_DISABLED is now plainly `unavailable`. The fixture is KEPT
        // (not deleted) so the arm stays covered if that code ever returns.
      }),
    )
    expect(
      (await restoreModelVersion(SCENARIO, {
        userId: USER,
        versionId: VERSION_A,
        mutationId: LEGACY_MUTATION_ID,
        expectedGraphIdentityHash: HASH_A,
      })).status,
    ).toBe('unavailable')
  })

  // CONVERTED v1 → v2, AND RE-AIMED. Original fixture was a v1 envelope with
  // `graph: null` at the TOP LEVEL, asserting 'unusable'. Left as-is it would
  // have passed for the wrong reason (the v1 schema guard, not the graph
  // check). Re-aimed at the stronger v2 property: a payload that carries a
  // perfectly good graph at the v1 TOP-LEVEL position but has no `receipt`
  // must still be refused — the adapter must never fall back to the old
  // location and apply a graph the v2 contract did not put there.
  it('a v2 restore with a top-level graph but NO receipt is unusable — never falls back to the v1 position', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, {
        schema: 'model_version_restore.v2',
        scenario_id: SCENARIO,
        restored: true,
        graph: RESTORED_GRAPH_V2,
        undo_version_id: SNAPSHOT_VERSION,
        version: { version_id: VERSION_A, version_number: 5 },
        analysis_state: null,
        request_id: 'req-6',
      }),
    )
    expect(
      (await restoreModelVersion(SCENARIO, {
        userId: USER,
        versionId: VERSION_A,
        mutationId: LEGACY_MUTATION_ID,
        expectedGraphIdentityHash: HASH_A,
      })).status,
    ).toBe('unusable')
  })

  // The v2-only decision, restore side. See the list twin above.
  it('refuses a v1 restore envelope — v2-only, by decision', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, {
        schema: 'model_version_restore.v1',
        scenario_id: SCENARIO,
        restored: true,
        deduped: false,
        version: { version_id: VERSION_A, version_number: 5 },
        undo_version_id: null,
        graph: RESTORED_GRAPH_V2,
        request_id: 'req-legacy',
      }),
    )
    expect(
      (await restoreModelVersion(SCENARIO, {
        userId: USER,
        versionId: VERSION_A,
        mutationId: LEGACY_MUTATION_ID,
        expectedGraphIdentityHash: HASH_A,
      })).status,
    ).toBe('unusable')
  })

  it('never auto-retries any failure', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(503, { schema: 'error.v1', code: 'INTERNAL', message: 'down' }),
    )
    await restoreModelVersion(SCENARIO, {
        userId: USER,
        versionId: VERSION_A,
        mutationId: LEGACY_MUTATION_ID,
        expectedGraphIdentityHash: HASH_A,
      })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})

describe('v2 fixture preconditions — the fixtures are genuinely v2-shaped', () => {
  // WITHOUT THIS, a fixture that was secretly v1-shaped would make every test
  // below pass for the wrong reason (CLAUDE.md: pin the precondition in-test).
  it('the list fixture carries the v2 label and the v2-only field names', () => {
    const body = listBodyV2()
    expect(body.schema).toBe('model_versions_list.v2')
    expect(body).toHaveProperty('next_cursor')
    const row = body.versions[0] as Record<string, unknown>
    // v2 field names present …
    expect(typeof row.version_id).toBe('string')
    expect(typeof row.sequence).toBe('number')
    expect(typeof row.full_hash).toBe('string')
    expect(row.creation).toBeTypeOf('object')
    expect(row.lineage).toBeTypeOf('object')
    expect(row.actor).toBeTypeOf('object')
    // … and the v1 names GONE, so a v1 parser cannot accidentally succeed.
    expect(row).not.toHaveProperty('id')
    expect(row).not.toHaveProperty('version_number')
    expect(row).not.toHaveProperty('graph_identity_hash')
    expect(row).not.toHaveProperty('provenance')
    expect(row).not.toHaveProperty('restored_from_version_id')
  })

  it('the restore fixture nests graph/version/undo INSIDE receipt and nowhere else', () => {
    const body = restoreBodyV2()
    expect(body.schema).toBe('model_version_restore.v2')
    expect(body.receipt).toBeTypeOf('object')
    expect(body.receipt.graph).toBeTypeOf('object')
    expect(typeof body.receipt.version_id).toBe('string')
    expect(typeof body.receipt.sequence).toBe('number')
    expect(body.receipt.undo_version_id).toBe(SNAPSHOT_VERSION)
    // The v1 TOP-LEVEL carriers must be absent — this is the whole bump.
    expect(body).not.toHaveProperty('graph')
    expect(body).not.toHaveProperty('version')
    expect(body).not.toHaveProperty('undo_version_id')
    expect(body).not.toHaveProperty('deduped')
    // CEE pins this exact top-level key set in its own route test.
    expect(Object.keys(body).sort()).toEqual([
      'analysis_state',
      'receipt',
      'request_id',
      'restored',
      'scenario_id',
      'schema',
    ])
  })
})

describe('listModelVersions — v2', () => {
  it('parses a real model_versions_list.v2 envelope into ServerModelVersion rows', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, listBodyV2()))

    const result = await listModelVersions(SCENARIO, { userId: USER })

    expect(result.status).toBe('list')
    if (result.status !== 'list') throw new Error('unreachable')
    expect(result.versions).toHaveLength(1)
    // Bound BY IDENTITY (version_id), never by a value predicate another row
    // could satisfy.
    expect(result.versions[0].id).toBe(VERSION_A)
    expect(result.versions[0].versionNumber).toBe(4) // ← from `sequence`
    expect(result.versions[0].label).toBe('Before pivot')
    expect(result.versions[0].graphIdentityHash).toBe(HASH_A) // ← from `full_hash`
    expect(result.versions[0].createdAt).toBe('2026-08-17T10:00:00.000Z')
    expect(result.currentVersionId).toBe(VERSION_A)
    expect(result.requestId).toBe('req-1')
  })

  it('carries the v2 creation vocabulary through as provenance and source id', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(
        200,
        listBodyV2({
          versions: [
            wireSummaryV2({
              creation: {
                kind: 'restore',
                source_version_id: SNAPSHOT_VERSION,
                mutation_id: MUTATION_ID,
                source_turn_id: null,
              },
            }),
          ],
        }),
      ),
    )

    const result = await listModelVersions(SCENARIO, { userId: USER })
    if (result.status !== 'list') throw new Error('unreachable')
    expect(result.versions[0].provenance).toBe('restore')
    expect(result.versions[0].restoredFromVersionId).toBe(SNAPSHOT_VERSION)
  })

  it('fails CLOSED on a v2 row missing sequence — never a silently shortened list', async () => {
    const bad = wireSummaryV2()
    delete (bad as Record<string, unknown>).sequence
    fetchSpy.mockResolvedValue(jsonResponse(200, listBodyV2({ versions: [bad] })))
    expect((await listModelVersions(SCENARIO, { userId: USER })).status).toBe('unusable')
  })
})

describe('restoreModelVersion — v2', () => {
  it('reads graph, version and undo id from the nested receipt', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, restoreBodyV2()))

    const result = await restoreModelVersion(SCENARIO, {
      userId: USER,
      versionId: VERSION_A,
      mutationId: LEGACY_MUTATION_ID,
      expectedGraphIdentityHash: HASH_A,
    })

    expect(result.status).toBe('restored')
    if (result.status !== 'restored') throw new Error('unreachable')
    expect(result.graph).toEqual(RESTORED_GRAPH_V2)
    expect(result.version.versionId).toBe(RESTORED_VERSION)
    expect(result.version.versionNumber).toBe(4) // ← from `receipt.sequence`
    expect(result.undoVersionId).toBe(SNAPSHOT_VERSION)
    expect(result.requestId).toBe('req-5')
  })

  it('a v2 restore whose receipt carries NO graph is unusable — never applied blind', async () => {
    const body = restoreBodyV2()
    ;(body.receipt as Record<string, unknown>).graph = null
    fetchSpy.mockResolvedValue(jsonResponse(200, body))
    expect(
      (await restoreModelVersion(SCENARIO, {
        userId: USER,
        versionId: VERSION_A,
        mutationId: LEGACY_MUTATION_ID,
        expectedGraphIdentityHash: HASH_A,
      })).status,
    ).toBe('unusable')
  })

  it('a v2 restore with NO receipt at all is unusable', async () => {
    const body = restoreBodyV2() as Record<string, unknown>
    delete body.receipt
    fetchSpy.mockResolvedValue(jsonResponse(200, body))
    expect(
      (await restoreModelVersion(SCENARIO, {
        userId: USER,
        versionId: VERSION_A,
        mutationId: LEGACY_MUTATION_ID,
        expectedGraphIdentityHash: HASH_A,
      })).status,
    ).toBe('unusable')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// THE C8-A CONTRACT SKEW — restore has been 100% non-functional since 26 Aug.
//
// CEE commit `4c29c5b5` ("C8-A integration", 26 Aug) made two changes to
// `RestoreBodySchema` that this adapter was never updated for. Derived at the
// bytes, CEE staging `f18d941b`, `src/routes/assist.v1.scenario-versions.ts`
// :224-229:
//     version_id:                   z.string().uuid()
//     mutation_id:                  z.string().uuid()      ← ADDED, REQUIRED
//     label:                        z.string().min(1).max(200).optional()
//     expected_graph_identity_hash: Sha256Hex.nullable()   ← was .optional()
//
// `.nullable()` is a REQUIRED KEY WITH A NULLABLE VALUE, not an optional one.
// The route hands the key through unconditionally (:934-941,
// `expected_graph_identity_hash: body.expected_graph_identity_hash`), so an
// OMITTED key arrives as `undefined` and `.nullable()` rejects it — 422
// `RESTORE_PAYLOAD_INVALID`. That is the whole defect.
//
// ⚠ THE REQUEST MUTATION ID IS DELIBERATELY *NOT* `MUTATION_ID`. That constant
// is the RECEIPT's id in the response fixture above. Asserting the request
// carries a DISTINCT constant is what makes these tests bind to the outgoing
// bytes rather than passing on a value the fixture already supplies — the
// "guard agreeing with itself" shape (CLAUDE.md trap 13b/19).
// ─────────────────────────────────────────────────────────────────────────────

const REQUEST_MUTATION_ID = 'ffffffff-6666-4666-8666-ffffffffffff'

describe('restoreModelVersion — the C8-A required fields reach the wire', () => {
  it('sends mutation_id as the caller minted it, bound to the OUTGOING body', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, restoreBodyV2()))

    await restoreModelVersion(SCENARIO, {
      userId: USER,
      versionId: VERSION_A,
      mutationId: REQUEST_MUTATION_ID,
      expectedGraphIdentityHash: HASH_A,
    })

    const [, init] = fetchSpy.mock.calls[0]
    const sent = JSON.parse(init.body)
    // Identity-bound: the REQUEST's id, never the receipt fixture's.
    expect(sent.mutation_id).toBe(REQUEST_MUTATION_ID)
    expect(sent.mutation_id).not.toBe(MUTATION_ID)
  })

  it('sends expected_graph_identity_hash as a REQUIRED key, present even when null', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, restoreBodyV2()))

    await restoreModelVersion(SCENARIO, {
      userId: USER,
      versionId: VERSION_A,
      mutationId: REQUEST_MUTATION_ID,
      expectedGraphIdentityHash: null,
    })

    const [, init] = fetchSpy.mock.calls[0]
    const sent = JSON.parse(init.body)
    // The KEY must exist. `.nullable()` rejects `undefined`, and an omitted
    // JSON key IS `undefined` at the server — this is the 422 being fixed.
    expect(Object.prototype.hasOwnProperty.call(sent, 'expected_graph_identity_hash')).toBe(true)
    expect(sent.expected_graph_identity_hash).toBeNull()
  })
})

describe('restoreModelVersion — deterministic refusals are not reported as transient', () => {
  /** Every arm here is PERMANENT until something other than a retry changes. */
  async function refuse(status: number, code: string) {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(status, { schema: 'error.v1', code: 'BAD_INPUT', message: 'no', details: { code } }),
    )
    return (
      await restoreModelVersion(SCENARIO, {
        userId: USER,
        versionId: VERSION_A,
        mutationId: REQUEST_MUTATION_ID,
        expectedGraphIdentityHash: HASH_A,
      })
    ).status
  }

  it('separates MUTATION_ID_REUSED from the CAS conflict — both are 409', async () => {
    // CEE emits TWO different 409s on this route: VERSION_STALE (:475-486,
    // recoverable by refreshing) and MUTATION_ID_REUSED (:1213-1222, a client
    // fault that a retry with the same id repeats forever). Collapsing them
    // renders "The model changed since you looked" over a model that did not.
    expect(await refuse(409, 'MUTATION_ID_REUSED')).toBe('mutationIdReused')
    expect(await refuse(409, 'VERSION_STALE')).toBe('conflict')
  })

  it('names a version that cannot be restored at all, rather than "right now"', async () => {
    // 422 VERSION_GRAPH_INCOMPATIBLE (empty_graph) and 422
    // GRAPH_INVARIANT_VIOLATION are properties of the STORED VERSION. No
    // number of retries changes either.
    expect(await refuse(422, 'VERSION_GRAPH_INCOMPATIBLE')).toBe('versionNotRestorable')
    expect(await refuse(422, 'GRAPH_INVARIANT_VIOLATION')).toBe('versionNotRestorable')
  })

  it('names a rejected payload as a fault in this app, not a transient server state', async () => {
    // This is the 422 the C8-A skew produced. If it ever returns it is OUR
    // bug, and "try again" would be a lie.
    expect(await refuse(422, 'RESTORE_PAYLOAD_INVALID')).toBe('payloadRejected')
  })
})
