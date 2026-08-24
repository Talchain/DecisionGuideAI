/** Strict boundary tests for shared model history, atomic restore and DiffV1. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  compareModelVersions,
  listModelVersions,
  modelVersionsUrl,
  restoreModelVersion,
  saveModelVersion,
} from '../modelVersions'
import { modelVersionMutationReceiptFixture } from '../../../test/fixtures/modelVersionMutationReceipt'

const SCENARIO = 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c'
const USER = '0f8a1b2c-3d4e-4f50-9a6b-7c8d9e0f1a2b'
const VERSION_A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const VERSION_B = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'
const VERSION_C = 'cccccccc-3333-4333-8333-cccccccccccc'
const VERSION_D = 'dddddddd-4444-4444-8444-dddddddddddd'
const MUTATION = 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee'
const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)
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

function wireV1Summary(overrides: Record<string, unknown> = {}) {
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

function wireV2Summary(overrides: Record<string, unknown> = {}) {
  return {
    version_id: VERSION_A,
    scenario_id: SCENARIO,
    sequence: 4,
    created_at: '2026-08-17T10:00:00.000Z',
    label: 'Before pivot',
    actor: { kind: 'known', authored_by: 'assistant' },
    creation: {
      kind: 'committed_mutation',
      mutation_id: MUTATION,
      source_turn_id: 'turn-42',
    },
    lineage: { kind: 'known', parent_version_id: VERSION_B, root_version_id: VERSION_C },
    full_hash: HASH_A,
    analysis_affecting_hash: HASH_B,
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

function diffItem(path = '/nodes/factor-price/observed_state/value') {
  return {
    path,
    change_kind: 'changed',
    entity_kind: 'node',
    entity_id: 'factor-price',
    label: 'Price',
    before_display: '0.5',
    after_display: '0.8',
    summary: 'Price changed from 0.5 to 0.8.',
    why_it_matters: 'This changes an analysis input.',
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
      values_uncertainty: [diffItem()],
    },
    coverage: { known_undetectable: [], known_uninterpreted_paths: [] },
    request_id: 'req-diff',
    ...overrides,
  }
}

function restoreV2(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'model_version_restore.v2',
    scenario_id: SCENARIO,
    restored: true,
    receipt: {
      ...modelVersionMutationReceiptFixture,
      scenario_id: SCENARIO,
      mutation_id: MUTATION,
      version_id: VERSION_D,
      sequence: 5,
      full_hash: HASH_A,
      analysis_affecting_hash: HASH_B,
      hash_algorithm: 'sha256',
      identity_projection_version: 'identity.v1',
      identity_normaliser_version: 'normaliser.v1',
      graph_schema_version: 'graph.v3',
      creation: { kind: 'restore', source_version_id: VERSION_A },
      undo_version_id: VERSION_C,
      event_id: 'event-restore-1',
    },
    analysis_state: null,
    request_id: 'req-restore',
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
  it('keeps list, restore and compare on the same-origin CEE proxy', () => {
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
  it('strictly parses ListV2 identity, actor, creation, lineage and head', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, {
      schema: 'model_versions_list.v2',
      scenario_id: SCENARIO,
      versions: [wireV2Summary()],
      next_cursor: 'older-page',
      current_version_id: VERSION_A,
      request_id: 'req-list',
    }))
    const result = await listModelVersions(SCENARIO, { userId: USER, cursor: 'newer-page' })
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toEqual({
      user_id: USER,
      cursor: 'newer-page',
    })
    expect(result).toMatchObject({
      status: 'list',
      contractVersion: 'v2',
      currentVersionId: VERSION_A,
      nextCursor: 'older-page',
      requestId: 'req-list',
    })
    if (result.status !== 'list') throw new Error('unreachable')
    expect(result.versions[0]).toMatchObject({
      contractVersion: 'v2',
      id: VERSION_A,
      label: 'Before pivot',
      graphIdentityHash: HASH_A,
      analysisAffectingHash: HASH_B,
      actor: { kind: 'known', authoredBy: 'assistant' },
      creation: {
        kind: 'committed_mutation',
        mutationId: MUTATION,
        sourceTurnId: 'turn-42',
      },
      lineage: { kind: 'known', parentVersionId: VERSION_B, rootVersionId: VERSION_C },
    })
  })

  it('accepts explicit System and a paged head outside the current page', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, {
      schema: 'model_versions_list.v2',
      scenario_id: SCENARIO,
      versions: [wireV2Summary({ actor: { kind: 'system' } })],
      next_cursor: null,
      current_version_id: VERSION_D,
      request_id: null,
    }))
    const result = await listModelVersions(SCENARIO, { userId: USER })
    expect(result.status).toBe('list')
    if (result.status !== 'list') throw new Error('unreachable')
    expect(result.currentVersionId).toBe(VERSION_D)
    expect(result.versions[0].actor).toEqual({ kind: 'system' })
  })

  it('accepts null head only for empty terminal history and omits guest identity', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, {
      schema: 'model_versions_list.v2',
      scenario_id: SCENARIO,
      versions: [],
      next_cursor: null,
      current_version_id: null,
      request_id: null,
    }))
    expect((await listModelVersions(SCENARIO, { userId: 'guest' })).status).toBe('list')
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toEqual({})
  })

  it('keeps ListV1 explicit without inventing actor, creation detail or lineage', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, {
      schema: 'model_versions_list.v1',
      scenario_id: SCENARIO,
      versions: [wireV1Summary({ provenance: 'commit' })],
      current_version_id: VERSION_A,
      request_id: 'req-v1',
    }))
    const result = await listModelVersions(SCENARIO, { userId: USER })
    expect(result.status).toBe('list')
    if (result.status !== 'list') throw new Error('unreachable')
    expect(result.contractVersion).toBe('v1-compat')
    expect(result.versions[0]).toMatchObject({
      provenance: 'commit',
      actor: { kind: 'unknown' },
      creation: { kind: 'unknown', mutationId: null, sourceTurnId: null },
      lineage: { kind: 'unknown' },
    })
  })

  it.each([
    ['missing next cursor', (body: Record<string, unknown>) => { delete body.next_cursor }],
    ['missing current head', (body: Record<string, unknown>) => { delete body.current_version_id }],
    ['missing request id', (body: Record<string, unknown>) => { delete body.request_id }],
    ['empty request id', (body: Record<string, unknown>) => { body.request_id = '   ' }],
    ['null head with rows', (body: Record<string, unknown>) => { body.current_version_id = null }],
    ['null head with cursor', (body: Record<string, unknown>) => {
      body.versions = []
      body.current_version_id = null
      body.next_cursor = 'older'
    }],
    ['row scenario mismatch', (body: Record<string, unknown>) => {
      body.versions = [wireV2Summary({ scenario_id: VERSION_D })]
    }],
    ['uppercase hash', (body: Record<string, unknown>) => {
      body.versions = [wireV2Summary({ full_hash: HASH_A.toUpperCase() })]
    }],
    ['missing label', (body: Record<string, unknown>) => {
      const row = wireV2Summary()
      delete (row as Partial<typeof row>).label
      body.versions = [row]
    }],
    ['unknown actor field', (body: Record<string, unknown>) => {
      body.versions = [wireV2Summary({ actor: { kind: 'unknown', authored_by: 'owner' } })]
    }],
    ['missing source turn', (body: Record<string, unknown>) => {
      body.versions = [wireV2Summary({ creation: { kind: 'unknown', mutation_id: null } })]
    }],
    ['bad lineage', (body: Record<string, unknown>) => {
      body.versions = [wireV2Summary({ lineage: { kind: 'known', parent_version_id: null } })]
    }],
    ['not descending', (body: Record<string, unknown>) => {
      body.versions = [
        wireV2Summary({ version_id: VERSION_A, sequence: 3 }),
        wireV2Summary({ version_id: VERSION_B, sequence: 4 }),
      ]
    }],
    ['duplicate id', (body: Record<string, unknown>) => {
      body.versions = [wireV2Summary(), wireV2Summary({ sequence: 3 })]
    }],
  ])('fails closed on V2 %s', async (_name, mutate) => {
    const body: Record<string, unknown> = {
      schema: 'model_versions_list.v2',
      scenario_id: SCENARIO,
      versions: [wireV2Summary()],
      next_cursor: null,
      current_version_id: VERSION_A,
      request_id: 'req-list',
    }
    mutate(body)
    fetchSpy.mockResolvedValue(jsonResponse(200, body))
    expect((await listModelVersions(SCENARIO, { userId: USER })).status).toBe('unusable')
  })
})

describe('saveModelVersion', () => {
  it('sends identity and label but never graph bytes', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, {
      schema: 'model_version_save.v1',
      version: { version_id: VERSION_A, version_number: 4, deduped: false },
    }))
    expect((await saveModelVersion(SCENARIO, { userId: USER, label: 'Before pivot' })).status)
      .toBe('saved')
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toEqual({
      user_id: USER,
      label: 'Before pivot',
    })
  })
})

describe('restoreModelVersion', () => {
  const opts = {
    userId: USER,
    versionId: VERSION_A,
    mutationId: MUTATION,
    expectedGraphIdentityHash: HASH_A,
  }

  it('sends the atomic request and accepts only the matching RestoreV2 receipt', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, restoreV2()))
    const result = await restoreModelVersion(SCENARIO, opts)
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toEqual({
      user_id: USER,
      version_id: VERSION_A,
      mutation_id: MUTATION,
      expected_graph_identity_hash: HASH_A,
    })
    expect(result.status).toBe('restored')
    if (result.status !== 'restored') throw new Error('unreachable')
    expect(result).toMatchObject({
      receipt: {
        mutation_id: MUTATION,
        full_hash: HASH_A,
        identity_projection_version: 'identity.v1',
        undo_version_id: VERSION_C,
        analysis_affecting_hash: HASH_B,
        version_id: VERSION_D,
        sequence: 5,
      },
      analysisState: null,
    })
  })

  it('always sends the CAS key, including explicit null', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, restoreV2()))
    await restoreModelVersion(SCENARIO, { ...opts, expectedGraphIdentityHash: null })
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body).expected_graph_identity_hash).toBeNull()
  })

  it('strictly returns the required non-null analysis-state sibling unchanged', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, restoreV2({ analysis_state: ANALYSIS_STATE })),
    )
    const result = await restoreModelVersion(SCENARIO, opts)
    expect(result.status).toBe('restored')
    if (result.status !== 'restored') throw new Error('unreachable')
    expect(result.analysisState).toEqual(ANALYSIS_STATE)
  })

  it('distinguishes stale CAS and mutation reuse without auto-retry', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(409, { details: { code: 'VERSION_STALE' } }))
    expect((await restoreModelVersion(SCENARIO, opts)).status).toBe('conflict')
    fetchSpy.mockResolvedValueOnce(jsonResponse(409, { details: { code: 'MUTATION_ID_REUSED' } }))
    expect((await restoreModelVersion(SCENARIO, opts)).status).toBe('mutationIdReused')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['legacy schema', () => ({ ...restoreV2(), schema: 'model_version_restore.v1' })],
    ['mismatched mutation', () => {
      const body = restoreV2()
      body.receipt.mutation_id = VERSION_C
      return body
    }],
    ['mismatched target', () => {
      const body = restoreV2()
      body.receipt.creation = { kind: 'restore', source_version_id: VERSION_B }
      return body
    }],
    ['uppercase hash', () => {
      const body = restoreV2()
      body.receipt.full_hash = HASH_A.toUpperCase()
      return body
    }],
    ['missing graph arrays', () => {
      const body = restoreV2()
      body.receipt.graph = { nodes: [] } as unknown as typeof body.receipt.graph
      return body
    }],
    ['missing analysis-state key', () => {
      const { analysis_state: _analysisState, ...body } = restoreV2()
      return body
    }],
    ['invalid analysis state', () => restoreV2({ analysis_state: { run_state: { kind: 'fresh' } } })],
    ['legacy dedupe field', () => {
      const body = restoreV2()
      return { ...body, receipt: { ...body.receipt, deduped: false } }
    }],
  ])('fails closed on %s', async (_name, build) => {
    fetchSpy.mockResolvedValue(jsonResponse(200, build()))
    expect((await restoreModelVersion(SCENARIO, opts)).status).toBe('unusable')
  })
})

async function compareWith(body: unknown) {
  fetchSpy.mockResolvedValue(jsonResponse(200, body))
  return compareModelVersions(SCENARIO, {
    userId: USER,
    fromVersionId: VERSION_A,
    toVersionId: VERSION_B,
  })
}

describe('compareModelVersions', () => {
  it('POSTs only identities and parses deterministic changes', async () => {
    const result = await compareWith(wireDiff())
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toEqual({
      user_id: USER,
      from_version_id: VERSION_A,
      to_version_id: VERSION_B,
    })
    expect(result.status).toBe('compared')
  })

  it('accepts nullable correlation and equal hashes on different', async () => {
    const result = await compareWith(wireDiff({
      request_id: null,
      from_full_hash: HASH_A,
      to_full_hash: HASH_A,
    }))
    expect(result.status).toBe('compared')
    if (result.status !== 'compared') throw new Error('unreachable')
    expect(result.requestId).toBeNull()
  })

  it('accepts identical only with equal hashes, analysis equivalence and no items', async () => {
    expect((await compareWith(wireDiff({
      relation: 'identical',
      to_full_hash: HASH_A,
      analysis_equivalent: true,
      categories: emptyDiffCategories(),
    }))).status).toBe('compared')
  })

  it('requires uninterpreted coverage to exactly ledger Other model fields', async () => {
    const other = { ...diffItem('/future_field'), entity_kind: 'model', entity_id: null }
    expect((await compareWith(wireDiff({
      categories: { ...emptyDiffCategories(), other_model_fields: [other] },
      coverage: {
        known_undetectable: ['private discussion state'],
        known_uninterpreted_paths: ['/future_field'],
      },
    }))).status).toBe('compared')
  })

  it.each([
    ['uppercase hash', () => wireDiff({ from_full_hash: HASH_A.toUpperCase() })],
    ['empty pointer', () => wireDiff({
      categories: { ...emptyDiffCategories(), structure: [diffItem('')] },
    })],
    ['non-pointer path', () => wireDiff({
      categories: { ...emptyDiffCategories(), structure: [diffItem('nodes/0')] },
    })],
    ['bad escape', () => wireDiff({
      categories: { ...emptyDiffCategories(), structure: [diffItem('/nodes/~2bad')] },
    })],
    ['empty summary', () => wireDiff({
      categories: { ...emptyDiffCategories(), structure: [{ ...diffItem('/a'), summary: ' ' }] },
    })],
    ['empty why', () => wireDiff({
      categories: {
        ...emptyDiffCategories(),
        structure: [{ ...diffItem('/a'), why_it_matters: '' }],
      },
    })],
    ['unsorted category', () => wireDiff({
      categories: { ...emptyDiffCategories(), structure: [diffItem('/z'), diffItem('/a')] },
    })],
    ['duplicate category', () => wireDiff({
      categories: { ...emptyDiffCategories(), structure: [diffItem('/a'), diffItem('/a')] },
    })],
    ['cross-category duplicate', () => wireDiff({
      categories: {
        ...emptyDiffCategories(),
        structure: [diffItem('/a')],
        relationships: [diffItem('/a')],
      },
    })],
    ['uninterpreted ledger mismatch', () => wireDiff({
      categories: { ...emptyDiffCategories(), other_model_fields: [diffItem('/future')] },
    })],
    ['interpreted path in ledger', () => wireDiff({
      categories: {
        ...emptyDiffCategories(),
        structure: [diffItem('/same')],
        other_model_fields: [{ ...diffItem('/same'), entity_kind: 'model', entity_id: null }],
      },
      coverage: { known_undetectable: [], known_uninterpreted_paths: ['/same'] },
    })],
    ['unsorted coverage', () => wireDiff({
      coverage: { known_undetectable: ['z', 'a'], known_uninterpreted_paths: [] },
    })],
    ['empty coverage item', () => wireDiff({
      coverage: { known_undetectable: [''], known_uninterpreted_paths: [] },
    })],
    ['identical with items', () => wireDiff({
      relation: 'identical', to_full_hash: HASH_A, analysis_equivalent: true,
    })],
    ['identical unequal hashes', () => wireDiff({
      relation: 'identical', analysis_equivalent: true, categories: emptyDiffCategories(),
    })],
    ['identical analysis false', () => wireDiff({
      relation: 'identical', to_full_hash: HASH_A, categories: emptyDiffCategories(),
    })],
    ['different without disclosure', () => wireDiff({ categories: emptyDiffCategories() })],
    ['missing request id', () => {
      const body = wireDiff()
      delete (body as Partial<typeof body>).request_id
      return body
    }],
    ['empty request id', () => wireDiff({ request_id: '' })],
  ])('fails closed on %s', async (_name, build) => {
    expect((await compareWith(build())).status).toBe('unusable')
  })

  it('short-circuits a same-version request', async () => {
    expect((await compareModelVersions(SCENARIO, {
      fromVersionId: VERSION_A,
      toVersionId: VERSION_A,
    })).status).toBe('sameVersion')
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
