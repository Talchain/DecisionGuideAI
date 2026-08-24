import { afterEach, describe, expect, it, vi } from 'vitest'
import { modelVersionMutationReceiptFixture } from '../../../test/fixtures/modelVersionMutationReceipt'
import {
  VERSION_HISTORY_REFRESH_EVENT,
  consumeModelVersionMutationReceipt,
  modelVersionReceiptPresentation,
  readModelVersionMutationReceipt,
  signalVersionHistoryRefresh,
  verifyModelVersionMutationReceipt,
} from '../modelVersionReceipt'

const RECEIPT = modelVersionMutationReceiptFixture

function history(overrides: Record<string, unknown> = {}) {
  return {
    status: 'list',
    contractVersion: 'v2',
    currentVersionId: RECEIPT.version_id,
    nextCursor: null,
    requestId: 'req-list',
    versions: [
      {
        contractVersion: 'v2',
        id: RECEIPT.version_id,
        scenarioId: RECEIPT.scenario_id,
        versionNumber: RECEIPT.sequence,
        label: null,
        provenance: null,
        restoredFromVersionId: null,
        createdAt: '2026-08-24T10:00:00.000Z',
        graphIdentityHash: RECEIPT.full_hash,
        analysisAffectingHash: RECEIPT.analysis_affecting_hash,
        actor: { kind: 'unknown' },
        creation: { kind: 'unknown', mutationId: null, sourceTurnId: null },
        lineage: { kind: 'unknown' },
      },
    ],
    ...overrides,
  }
}

function graph(identity = RECEIPT.full_hash) {
  return {
    status: 'graph',
    graph: RECEIPT.graph,
    briefText: null,
    notModelled: null,
    identity: {
      value: identity,
      algorithm: RECEIPT.hash_algorithm,
      projectionVersion: RECEIPT.identity_projection_version,
      normaliserVersion: RECEIPT.identity_normaliser_version,
      graphSchemaVersion: RECEIPT.graph_schema_version,
    },
    layoutPresent: false,
    requestId: 'req-graph',
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('model-version mutation receipt consumption', () => {
  it('uses the shared strict schema and refuses omitted or undeclared nested fields', () => {
    expect(readModelVersionMutationReceipt(RECEIPT)).toEqual(RECEIPT)
    const { event_id: _eventId, ...withoutEvent } = RECEIPT
    expect(readModelVersionMutationReceipt(withoutEvent)).toBeNull()
    expect(readModelVersionMutationReceipt({ ...RECEIPT, freshness: 'fresh' })).toBeNull()
  })

  it('verifies only when ListV2 head, version hash and scenario graph identity all agree', async () => {
    const list = vi.fn().mockResolvedValue(history())
    const readGraph = vi.fn().mockResolvedValue(graph())
    await expect(
      verifyModelVersionMutationReceipt(RECEIPT, {
        userId: 'user-1',
        dependencies: { list, readGraph } as never,
      }),
    ).resolves.toBe(true)
    expect(list).toHaveBeenCalledWith(RECEIPT.scenario_id, { userId: 'user-1' })
    expect(readGraph).toHaveBeenCalledWith(RECEIPT.scenario_id, { userId: 'user-1' })
  })

  it('runs one canonical reconcile and signals history only after both authority reads verify', async () => {
    const reconcile = vi.fn()
    const signal = vi.fn()
    const result = await consumeModelVersionMutationReceipt(RECEIPT, {
      dependencies: {
        reconcile,
        signal,
        list: vi.fn().mockResolvedValue(history()),
        readGraph: vi.fn().mockResolvedValue(graph()),
      } as never,
    })
    expect(result.status).toBe('verified')
    expect(reconcile).toHaveBeenCalledTimes(1)
    expect(reconcile).toHaveBeenCalledWith(RECEIPT)
    expect(signal).toHaveBeenCalledWith(RECEIPT)
  })

  it('reconciles authority but suppresses refresh when post-write verification is unknown', async () => {
    const reconcile = vi.fn()
    const signal = vi.fn()
    const result = await consumeModelVersionMutationReceipt(RECEIPT, {
      dependencies: {
        reconcile,
        signal,
        list: vi.fn().mockResolvedValue(history({ currentVersionId: RECEIPT.mutation_id })),
        readGraph: vi.fn().mockResolvedValue(graph()),
      } as never,
    })
    expect(result.status).toBe('unverified')
    expect(reconcile).toHaveBeenCalledTimes(1)
    expect(signal).not.toHaveBeenCalled()
  })

  it('refuses a receipt for a different dispatch scenario before reconcile or authority reads', async () => {
    const reconcile = vi.fn()
    const signal = vi.fn()
    const list = vi.fn()
    const readGraph = vi.fn()
    const result = await consumeModelVersionMutationReceipt(RECEIPT, {
      expectedScenarioId: '11111111-2222-4333-8444-555555555555',
      dependencies: { reconcile, signal, list, readGraph } as never,
    })
    expect(result.status).toBe('invalid')
    expect(reconcile).not.toHaveBeenCalled()
    expect(list).not.toHaveBeenCalled()
    expect(readGraph).not.toHaveBeenCalled()
    expect(signal).not.toHaveBeenCalled()
  })

  it.each([
    ['legacy list', history({ contractVersion: 'v1-compat' }), graph()],
    ['wrong head', history({ currentVersionId: RECEIPT.mutation_id }), graph()],
    [
      'wrong version hash',
      history({
        versions: [
          { ...history().versions[0], graphIdentityHash: 'f'.repeat(64) },
        ],
      }),
      graph(),
    ],
    ['wrong graph hash', history(), graph('f'.repeat(64))],
    [
      'wrong graph algorithm',
      history(),
      {
        ...graph(),
        identity: { ...graph().identity, algorithm: 'sha512' },
      },
    ],
    [
      'wrong projection version',
      history(),
      {
        ...graph(),
        identity: { ...graph().identity, projectionVersion: 'identity.v2' },
      },
    ],
    [
      'wrong normaliser version',
      history(),
      {
        ...graph(),
        identity: { ...graph().identity, normaliserVersion: 'normaliser.v2' },
      },
    ],
    [
      'wrong graph schema version',
      history(),
      {
        ...graph(),
        identity: { ...graph().identity, graphSchemaVersion: 'graph_v4' },
      },
    ],
    ['unreadable graph', history(), { status: 'unavailable' }],
  ])('keeps verification unknown for %s', async (_name, listResult, graphResult) => {
    await expect(
      verifyModelVersionMutationReceipt(RECEIPT, {
        dependencies: {
          list: vi.fn().mockResolvedValue(listResult),
          readGraph: vi.fn().mockResolvedValue(graphResult),
        } as never,
      }),
    ).resolves.toBe(false)
  })

  it('signals the mounted history surface only after a caller verifies the receipt', () => {
    const listener = vi.fn()
    window.addEventListener(VERSION_HISTORY_REFRESH_EVENT, listener)
    signalVersionHistoryRefresh(RECEIPT)
    window.removeEventListener(VERSION_HISTORY_REFRESH_EVENT, listener)
    expect(listener).toHaveBeenCalledTimes(1)
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      scenarioId: RECEIPT.scenario_id,
      versionId: RECEIPT.version_id,
    })
  })

  it('preserves existing producer success when verified and substitutes honest copy when unknown', () => {
    expect(modelVersionReceiptPresentation(true, 'I changed the model.')).toEqual({
      content: 'I changed the model.',
      suppressAppliedGraphPatch: false,
    })
    expect(modelVersionReceiptPresentation(false, 'I changed the model.')).toMatchObject({
      content: expect.stringMatching(/could not verify/i),
      suppressAppliedGraphPatch: true,
    })
    expect(modelVersionReceiptPresentation(true, '')).toMatchObject({
      content: expect.stringMatching(/shared model was updated/i),
      suppressAppliedGraphPatch: false,
    })
    expect(modelVersionReceiptPresentation(true, '', true)).toEqual({
      content: '',
      suppressAppliedGraphPatch: false,
    })
  })
})
