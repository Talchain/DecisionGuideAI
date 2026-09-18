/**
 * Shared SNAPSHOT service tests.
 *
 * Why this exists, measured at the deployed database on 18 Sep 2026
 * (evidence: output/accelerate-20260918/SHARE-GATING-ITEM-SETTLED.md):
 *
 *   `create_shared_brief` — the RPC this product has always called — gates on
 *   `scenarios.brief` and `scenarios.analysis_provenance`. Both columns are
 *   populated in exactly 1 of 14,141 rows, and that one row is a synthetic
 *   fixture. The live columns are `brief_text` (12,919 rows) and
 *   `graph_identity_hash` (12,518). So the authenticated OWNER of a real
 *   decision is refused with P0001 "No brief to share - generate a brief
 *   first", and `CanvasMVP.handleShare` catches it and shows
 *   "Please try again shortly" — which can never come true.
 *
 *   `create_shared_snapshot` is the correct mechanism. It was built, reviewed
 *   (its source carries size caps against anonymous content hosting, typed
 *   error codes, and an ownership check with no existence oracle), granted to
 *   `authenticated`, and then never called by anything. It carries the GRAPH,
 *   which is what makes a shared link worth opening.
 *
 * These tests bind to the RPC name and the parameter keys by identity, because
 * a share that posts the right values under the wrong key names is exactly the
 * failure that produced an empty canvas on a second person's screen before.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ScenarioPersistenceError } from '../../types/scenario'

const mockRpc = vi.fn()
const mockSingle = vi.fn()
const mockEq = vi.fn((_column: string, _value: unknown) => ({ single: mockSingle }))
const mockSelect = vi.fn((_columns: string) => ({ eq: mockEq }))
const mockFrom = vi.fn((_table: string) => ({ select: mockSelect }))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
    rpc: (fn: string, params: unknown) => mockRpc(fn, params),
  },
}))

const SAVED_ROW = {
  graph: { nodes: [{ id: 'n1', type: 'goal', label: 'Win the quarter' }], edges: [] },
  brief_text: 'We need to decide whether to open a second site.',
  graph_identity_hash: '1b30f286be0a',
}

describe('createSharedSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSingle.mockResolvedValue({ data: SAVED_ROW, error: null })
    mockRpc.mockResolvedValue({ data: { id: 'snap-1', slug: 'abc123' }, error: null })
  })

  it('snapshots the row the SERVER holds, not client state, and sends it under the p_ keys', async () => {
    const { createSharedSnapshot } = await import('../scenarioService')

    const result = await createSharedSnapshot('scenario-1')

    // It reads the saved row first — the share must carry what was persisted.
    expect(mockFrom).toHaveBeenCalledWith('scenarios')
    expect(mockEq).toHaveBeenCalledWith('id', 'scenario-1')

    expect(mockRpc).toHaveBeenCalledWith('create_shared_snapshot', {
      p_scenario_id: 'scenario-1',
      p_graph: SAVED_ROW.graph,
      p_analysis: null,
      p_brief_text: SAVED_ROW.brief_text,
      p_graph_hash: SAVED_ROW.graph_identity_hash,
      p_seed: null,
      p_expires_at: null,
    })
    expect(result).toEqual({ id: 'snap-1', slug: 'abc123' })
  })

  it('refuses BEFORE the round-trip when the saved row carries no graph', async () => {
    // A snapshot with no graph is precisely the empty-canvas defect this
    // change exists to end. The database also rejects it (22023), but failing
    // here means the sender is told something true rather than something
    // generic.
    mockSingle.mockResolvedValue({
      data: { ...SAVED_ROW, graph: null },
      error: null,
    })
    const { createSharedSnapshot } = await import('../scenarioService')

    await expect(createSharedSnapshot('scenario-1')).rejects.toThrow(
      ScenarioPersistenceError,
    )
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('propagates an RPC failure as ScenarioPersistenceError', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'scenario not found or not owned by caller' },
    })
    const { createSharedSnapshot } = await import('../scenarioService')

    await expect(createSharedSnapshot('scenario-1')).rejects.toThrow(
      ScenarioPersistenceError,
    )
  })

  it('propagates a failure to read the saved row', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const { createSharedSnapshot } = await import('../scenarioService')

    await expect(createSharedSnapshot('scenario-1')).rejects.toThrow(
      ScenarioPersistenceError,
    )
    expect(mockRpc).not.toHaveBeenCalled()
  })
})

describe('getSharedSnapshotBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads by slug through the anon-granted RPC', async () => {
    mockRpc.mockResolvedValue({
      data: { graph: SAVED_ROW.graph, brief_text: 'x', graph_hash: 'h', analysis: null, seed: null, created_at: 'now', expires_at: null },
      error: null,
    })
    const { getSharedSnapshotBySlug } = await import('../scenarioService')

    const row = await getSharedSnapshotBySlug('abc123')

    expect(mockRpc).toHaveBeenCalledWith('get_shared_snapshot_by_slug', {
      p_slug: 'abc123',
    })
    expect(row?.graph).toEqual(SAVED_ROW.graph)
  })

  it('returns null for an unknown or expired slug rather than throwing', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })
    const { getSharedSnapshotBySlug } = await import('../scenarioService')

    await expect(getSharedSnapshotBySlug('nope')).resolves.toBeNull()
  })
})
