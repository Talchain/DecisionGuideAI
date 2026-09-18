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

/**
 * ⭐ THE `brief` SHAPE IS DERIVED FROM THE PRODUCER, measured at the deployed
 * database on 18 Sep 2026 over every row CEE has written (39 rows at the time
 * of measurement, all written that day, 01:48Z-12:37Z). All 18 keys are
 * present on all 39: analysis_summary, brief_id, created_at,
 * defaulted_assumptions, graph_hash, headline, headline_banded,
 * key_assumptions, lineage, options, robustness, robustness_caveat, seed,
 * top_drivers, version, warning_codes, warnings, what_would_change.
 *
 * Only the recipient-facing subset is asserted below; the service's job is to
 * carry the WHOLE object to the snapshot, and the PAGE decides what is shown.
 */
const SAVED_BRIEF = {
  version: '1',
  headline: 'Lease in Leeds produced the best outcome in 82% of runs of this model.',
  options: [
    { rank: 1, label: 'Lease in Leeds', option_id: 'b54e5dac', win_probability: 0.823475 },
    { rank: 2, label: 'Stay put', option_id: '9c25f4ff', win_probability: 0.176525 },
  ],
  robustness: 'moderate',
  brief_id: 'brief-internal-9f2',
  lineage: { run_id: 'run-internal-441' },
}

const SAVED_ROW = {
  graph: { nodes: [{ id: 'n1', type: 'goal', label: 'Win the quarter' }], edges: [] },
  brief: SAVED_BRIEF,
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
      p_analysis: SAVED_BRIEF,
      p_brief_text: SAVED_ROW.brief_text,
      p_graph_hash: SAVED_ROW.graph_identity_hash,
      p_seed: null,
      p_expires_at: null,
    })
    expect(result).toEqual({ id: 'snap-1', slug: 'abc123' })
  })

  it('reads `brief` from the SERVER row, so the analysis is the persisted one', async () => {
    // Sourced exactly like `p_graph`: off the saved row, never client state.
    // A share assembled from whatever the sender's tab happened to hold would
    // let the link disagree with the decision that was actually saved.
    const { createSharedSnapshot } = await import('../scenarioService')
    await createSharedSnapshot('scenario-1')

    expect(mockSelect).toHaveBeenCalledWith(
      'graph, brief, brief_text, graph_identity_hash',
    )
  })

  it('carries the analysis brief under p_analysis rather than dropping it', async () => {
    const { createSharedSnapshot } = await import('../scenarioService')
    await createSharedSnapshot('scenario-1')

    const params = mockRpc.mock.calls[0][1] as Record<string, unknown>
    expect(params.p_analysis).toEqual(SAVED_BRIEF)
  })

  it('sends null when the scenario has no brief yet — most scenarios', async () => {
    // Measured 18 Sep 2026: 39 of 14,252 rows carry `brief`. The link must
    // still mint for the other 14,213, carrying the model alone.
    mockSingle.mockResolvedValue({ data: { ...SAVED_ROW, brief: null }, error: null })
    const { createSharedSnapshot } = await import('../scenarioService')

    await expect(createSharedSnapshot('scenario-1')).resolves.toEqual({
      id: 'snap-1',
      slug: 'abc123',
    })
    const params = mockRpc.mock.calls[0][1] as Record<string, unknown>
    expect(params.p_analysis).toBeNull()
  })

  it('sends null rather than a non-object brief, which the RPC would reject', async () => {
    // `create_shared_snapshot` raises 22023 unless p_analysis is a JSON object
    // or NULL (migration 20260710160000, jsonb_typeof check). An array or a
    // string would fail the whole share, losing the model as well as the
    // analysis — so a shape we do not recognise degrades to "no analysis".
    for (const bad of [['a'], 'text', 42, true] as unknown[]) {
      vi.clearAllMocks()
      mockSingle.mockResolvedValue({ data: { ...SAVED_ROW, brief: bad }, error: null })
      mockRpc.mockResolvedValue({ data: { id: 'snap-1', slug: 'abc123' }, error: null })
      const { createSharedSnapshot } = await import('../scenarioService')

      await createSharedSnapshot('scenario-1')
      const params = mockRpc.mock.calls[0][1] as Record<string, unknown>
      expect(params.p_analysis).toBeNull()
    }
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
