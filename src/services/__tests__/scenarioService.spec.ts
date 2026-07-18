/**
 * scenarioService unit tests — Brief C.1a
 *
 * Mocks the Supabase client and verifies:
 * - Correct RPC names and parameter keys (p_ prefix)
 * - Error propagation to ScenarioPersistenceError
 * - UUID guard on createScenario (rejects guest 'guest' user ID)
 * - Direct UPDATE for graph/framing/title (no RPC)
 * - listScenarios selects only list columns, orders by updated_at DESC
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ScenarioPersistenceError } from '../../types/scenario'

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------

const mockSingle = vi.fn()
const mockSelect = vi.fn(() => ({ single: mockSingle }))
const mockEq = vi.fn(() => ({ select: mockSelect, single: mockSingle }))
const mockOrder = vi.fn()
const mockInsert = vi.fn(() => ({ select: mockSelect }))
const mockUpdate = vi.fn(() => ({ eq: mockEq }))
const mockDelete = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({
  insert: mockInsert,
  select: vi.fn(() => ({ eq: mockEq, order: mockOrder })),
  update: mockUpdate,
  delete: mockDelete,
}))
const mockRpc = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}))

// Import after mock is set up
import * as service from '../scenarioService'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'
const VALID_EVENT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

function resetMocks() {
  vi.clearAllMocks()
  // Default: no error
  mockSingle.mockResolvedValue({ data: null, error: null })
  mockEq.mockReturnValue({ select: mockSelect, single: mockSingle })
  mockSelect.mockReturnValue({ single: mockSingle, eq: mockEq })
  mockOrder.mockResolvedValue({ data: [], error: null })
  mockRpc.mockResolvedValue({ data: null, error: null })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('scenarioService', () => {
  beforeEach(resetMocks)

  // -----------------------------------------------------------------------
  // UUID guard
  // -----------------------------------------------------------------------

  describe('createScenario — UUID guard', () => {
    it('rejects non-UUID user ID with INVALID_USER_ID code', async () => {
      await expect(
        service.createScenario('guest', VALID_EVENT_ID, 'Test'),
      ).rejects.toThrow(ScenarioPersistenceError)

      try {
        await service.createScenario('guest', VALID_EVENT_ID, 'Test')
      } catch (err) {
        expect(err).toBeInstanceOf(ScenarioPersistenceError)
        expect((err as ScenarioPersistenceError).code).toBe('INVALID_USER_ID')
      }
    })

    it('rejects empty string', async () => {
      await expect(
        service.createScenario('', VALID_EVENT_ID),
      ).rejects.toThrow(ScenarioPersistenceError)
    })

    it('accepts a valid UUID', async () => {
      const row = { id: 'new-id', user_id: VALID_UUID }
      mockSingle.mockResolvedValue({ data: row, error: null })
      mockRpc.mockResolvedValue({ data: {}, error: null })

      const result = await service.createScenario(VALID_UUID, VALID_EVENT_ID, 'My scenario')
      expect(result.id).toBe('new-id')
    })
  })

  // -----------------------------------------------------------------------
  // createScenario
  // -----------------------------------------------------------------------

  describe('createScenario', () => {
    it('inserts into scenarios then calls append_scenario_event RPC', async () => {
      const row = { id: 'new-id', user_id: VALID_UUID }
      mockSingle.mockResolvedValue({ data: row, error: null })
      mockRpc.mockResolvedValue({ data: {}, error: null })

      await service.createScenario(VALID_UUID, VALID_EVENT_ID, 'Title')

      // Verify INSERT call
      expect(mockFrom).toHaveBeenCalledWith('scenarios')

      // Verify append_scenario_event RPC call
      expect(mockRpc).toHaveBeenCalledWith('append_scenario_event', {
        p_scenario_id: 'new-id',
        p_event_id: VALID_EVENT_ID,
        p_event_type: 'scenario_created',
        p_details: {},
        p_hashes: null,
        p_turn_id: null,
      })
    })

    it('throws on INSERT error', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'RLS violation', code: '42501' },
      })

      await expect(
        service.createScenario(VALID_UUID, VALID_EVENT_ID),
      ).rejects.toThrow(ScenarioPersistenceError)
    })
  })

  // -----------------------------------------------------------------------
  // listScenarios
  // -----------------------------------------------------------------------

  describe('listScenarios', () => {
    it('selects only list columns and orders by updated_at DESC', async () => {
      const items = [
        { id: '1', title: 'A', stage: 'frame', analysis_status: 'none', updated_at: '2026-01-01' },
      ]

      // Rebuild mock chain for listScenarios: from().select().eq().order().order()
      const order2Fn = vi.fn().mockResolvedValue({ data: items, error: null })
      const order1Fn = vi.fn().mockReturnValue({ order: order2Fn })
      const eqFn = vi.fn().mockReturnValue({ order: order1Fn })
      const selectFn = vi.fn().mockReturnValue({ eq: eqFn })
      mockFrom.mockReturnValue({
        select: selectFn,
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
      })

      const result = await service.listScenarios(VALID_UUID)

      expect(selectFn).toHaveBeenCalledWith('id, title, stage, analysis_status, updated_at, created_at, events, is_pinned, is_archived')
      expect(eqFn).toHaveBeenCalledWith('user_id', VALID_UUID)
      expect(order1Fn).toHaveBeenCalledWith('is_pinned', { ascending: false })
      expect(order2Fn).toHaveBeenCalledWith('updated_at', { ascending: false })
      expect(result).toEqual(items)
    })

    it('rejects non-UUID userId', async () => {
      await expect(service.listScenarios('guest')).rejects.toThrow(
        ScenarioPersistenceError,
      )
    })
  })

  // -----------------------------------------------------------------------
  // loadScenario
  // -----------------------------------------------------------------------

  describe('loadScenario', () => {
    it('returns null when not found (PGRST116)', async () => {
      const singleFn = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'no rows' },
      })
      const eqFn = vi.fn().mockReturnValue({ single: singleFn })
      const selectFn = vi.fn().mockReturnValue({ eq: eqFn })
      mockFrom.mockReturnValue({ select: selectFn, insert: mockInsert, update: mockUpdate, delete: mockDelete })

      const result = await service.loadScenario('nonexistent-id')
      expect(result).toBeNull()
    })

    it('throws on other errors', async () => {
      const singleFn = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST000', message: 'connection error' },
      })
      const eqFn = vi.fn().mockReturnValue({ single: singleFn })
      const selectFn = vi.fn().mockReturnValue({ eq: eqFn })
      mockFrom.mockReturnValue({ select: selectFn, insert: mockInsert, update: mockUpdate, delete: mockDelete })

      await expect(service.loadScenario('some-id')).rejects.toThrow(
        ScenarioPersistenceError,
      )
    })
  })

  // -----------------------------------------------------------------------
  // saveGraphViaGatedPath (apply_patch_and_log RPC — the ONE gated graph write)
  //
  // Trust-spine board #2: the former `saveGraph` raw-UPDATE bypass is gone.
  // Every scenarios.graph write is now the gated RPC that records an event + a
  // derived graph hash. These tests pin: (a) the RPC is called (never a raw
  // UPDATE), (b) event_type is 'graph_saved', (c) the graph_hash is present and
  // derived from the graph being written, (d) the old export no longer exists.
  // -----------------------------------------------------------------------

  describe('saveGraphViaGatedPath', () => {
    const GRAPH = {
      nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'A' } }],
      edges: [{ id: 'e1', source: 'n1', target: 'n1', data: { weight: 0.5 } }],
    } as unknown as Parameters<typeof service.saveGraphViaGatedPath>[1]

    it('calls apply_patch_and_log with a graph_saved event and a derived graph_hash', async () => {
      mockRpc.mockResolvedValue({ data: {}, error: null })

      await service.saveGraphViaGatedPath('scenario-1', GRAPH, VALID_EVENT_ID)

      expect(mockRpc).toHaveBeenCalledTimes(1)
      const [rpcName, params] = mockRpc.mock.calls[0] as [string, Record<string, unknown>]
      expect(rpcName).toBe('apply_patch_and_log')
      expect(params.p_scenario_id).toBe('scenario-1')
      expect(params.p_graph).toBe(GRAPH)
      expect(params.p_event_id).toBe(VALID_EVENT_ID)
      expect(params.p_event_type).toBe('graph_saved')
      expect(params.p_turn_id).toBeNull()
      // Hash is recorded and non-empty (records WHAT graph state was persisted)
      const hashes = params.p_hashes as { graph_hash?: string }
      expect(typeof hashes.graph_hash).toBe('string')
      expect(hashes.graph_hash.length).toBeGreaterThan(0)
    })

    it('records a hash derived from the graph being written (changes with the graph)', async () => {
      mockRpc.mockResolvedValue({ data: {}, error: null })

      await service.saveGraphViaGatedPath('scenario-1', GRAPH, VALID_EVENT_ID)
      const hashA = (mockRpc.mock.calls[0][1] as { p_hashes: { graph_hash: string } }).p_hashes.graph_hash

      mockRpc.mockClear()
      const GRAPH2 = {
        nodes: [
          ...(GRAPH as { nodes: unknown[] }).nodes,
          { id: 'n2', type: 'option', position: { x: 1, y: 1 }, data: { label: 'B' } },
        ],
        edges: (GRAPH as { edges: unknown[] }).edges,
      } as unknown as Parameters<typeof service.saveGraphViaGatedPath>[1]
      await service.saveGraphViaGatedPath('scenario-1', GRAPH2, VALID_EVENT_ID)
      const hashB = (mockRpc.mock.calls[0][1] as { p_hashes: { graph_hash: string } }).p_hashes.graph_hash

      expect(hashB).not.toBe(hashA)
    })

    it('does NOT perform a raw scenarios UPDATE (no bypass writer)', async () => {
      const updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
      mockFrom.mockReturnValue({ update: updateFn, select: vi.fn(), insert: mockInsert, delete: mockDelete })
      mockRpc.mockResolvedValue({ data: {}, error: null })

      await service.saveGraphViaGatedPath('scenario-1', GRAPH, VALID_EVENT_ID)

      expect(updateFn).not.toHaveBeenCalled()
    })

    it('throws ScenarioPersistenceError on RPC failure', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'DB error' } })

      await expect(
        service.saveGraphViaGatedPath('scenario-1', GRAPH, VALID_EVENT_ID),
      ).rejects.toMatchObject({ code: 'SAVE_GRAPH_FAILED' })
    })

    it('the raw-write bypass export `saveGraph` no longer exists', () => {
      expect((service as Record<string, unknown>).saveGraph).toBeUndefined()
    })
  })

  // -----------------------------------------------------------------------
  // Source guard — no raw scenarios.graph writer may be re-introduced
  //
  // Fail-loud on drift (rule: derive/enforce from the source of truth, never
  // trust a hand-maintained memory that a bypass "won't come back"). If a
  // future edit adds `.update({ graph ... })` on the scenarios table, this
  // trips immediately rather than silently reopening the trust-spine hole.
  // -----------------------------------------------------------------------

  describe('source guard: no raw graph writer', () => {
    // Resolve from the repo root (vitest cwd) — robust across transforms.
    const source = readFileSync(
      resolve(process.cwd(), 'src/services/scenarioService.ts'),
      'utf8',
    )

    it('contains no raw `.update({ graph ... })` on the scenarios table', () => {
      // Matches update payloads whose first key is `graph` (the bypass shape).
      expect(/\.update\(\s*\{\s*graph\b/.test(source)).toBe(false)
    })

    it('writes scenarios.graph only through the apply_patch_and_log RPC', () => {
      expect(source.includes("supabase.rpc('apply_patch_and_log'")).toBe(true)
    })
  })

  describe('saveFraming', () => {
    it('calls UPDATE with framing payload', async () => {
      const eqFn = vi.fn().mockResolvedValue({ error: null })
      const updateFn = vi.fn().mockReturnValue({ eq: eqFn })
      mockFrom.mockReturnValue({ update: updateFn, select: vi.fn(), insert: mockInsert, delete: mockDelete })

      const framing = { goal: 'Increase revenue' }
      await service.saveFraming('scenario-1', framing)

      expect(updateFn).toHaveBeenCalledWith({ framing })
    })
  })

  describe('saveTitle', () => {
    it('calls UPDATE with title string', async () => {
      const eqFn = vi.fn().mockResolvedValue({ error: null })
      const updateFn = vi.fn().mockReturnValue({ eq: eqFn })
      mockFrom.mockReturnValue({ update: updateFn, select: vi.fn(), insert: mockInsert, delete: mockDelete })

      await service.saveTitle('scenario-1', 'New title')
      expect(updateFn).toHaveBeenCalledWith({ title: 'New title' })
    })
  })

  // -----------------------------------------------------------------------
  // setAnalysisRunning (C.1b Task 6)
  // -----------------------------------------------------------------------

  describe('setAnalysisRunning', () => {
    it('calls UPDATE with analysis_status: running', async () => {
      const eqFn = vi.fn().mockResolvedValue({ error: null })
      const updateFn = vi.fn().mockReturnValue({ eq: eqFn })
      mockFrom.mockReturnValue({ update: updateFn, select: vi.fn(), insert: mockInsert, delete: mockDelete })

      await service.setAnalysisRunning('scenario-1')

      expect(mockFrom).toHaveBeenCalledWith('scenarios')
      expect(updateFn).toHaveBeenCalledWith({ analysis_status: 'running', analysis_error: null })
      expect(eqFn).toHaveBeenCalledWith('id', 'scenario-1')
    })

    it('throws ScenarioPersistenceError on failure', async () => {
      const eqFn = vi.fn().mockResolvedValue({ error: { message: 'DB error' } })
      const updateFn = vi.fn().mockReturnValue({ eq: eqFn })
      mockFrom.mockReturnValue({ update: updateFn, select: vi.fn(), insert: mockInsert, delete: mockDelete })

      try {
        await service.setAnalysisRunning('scenario-1')
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ScenarioPersistenceError)
        expect((err as ScenarioPersistenceError).code).toBe('SET_RUNNING_FAILED')
      }
    })
  })

  // -----------------------------------------------------------------------
  // resetAnalysisStatus (§7 interrupted analysis recovery)
  // -----------------------------------------------------------------------

  describe('resetAnalysisStatus', () => {
    it('calls UPDATE with analysis_status: none', async () => {
      const eqFn = vi.fn().mockResolvedValue({ error: null })
      const updateFn = vi.fn().mockReturnValue({ eq: eqFn })
      mockFrom.mockReturnValue({ update: updateFn, select: vi.fn(), insert: mockInsert, delete: mockDelete })

      await service.resetAnalysisStatus('scenario-1')

      expect(mockFrom).toHaveBeenCalledWith('scenarios')
      expect(updateFn).toHaveBeenCalledWith({ analysis_status: 'none', analysis_error: null })
      expect(eqFn).toHaveBeenCalledWith('id', 'scenario-1')
    })

    it('does not call any RPC', async () => {
      const eqFn = vi.fn().mockResolvedValue({ error: null })
      const updateFn = vi.fn().mockReturnValue({ eq: eqFn })
      mockFrom.mockReturnValue({ update: updateFn, select: vi.fn(), insert: mockInsert, delete: mockDelete })

      await service.resetAnalysisStatus('scenario-1')
      expect(mockRpc).not.toHaveBeenCalled()
    })
  })

  // -----------------------------------------------------------------------
  // storeAnalysis — RPC param verification
  // -----------------------------------------------------------------------

  describe('storeAnalysis', () => {
    it('calls store_analysis_and_log with correct p_ params', async () => {
      mockRpc.mockResolvedValue({ data: {}, error: null })

      await service.storeAnalysis(
        'scenario-1',
        { status: 'success' },
        'hash-abc',
        42,
        'resp-hash-xyz',
        VALID_EVENT_ID,
        { winner: 'Option A', probability: 0.85 },
        'turn-1',
      )

      expect(mockRpc).toHaveBeenCalledWith('store_analysis_and_log', {
        p_scenario_id: 'scenario-1',
        p_analysis: { status: 'success' },
        p_graph_hash: 'hash-abc',
        p_seed_used: 42, // Must be number, not string
        p_response_hash: 'resp-hash-xyz',
        p_event_id: VALID_EVENT_ID,
        p_details: { winner: 'Option A', probability: 0.85 },
        p_turn_id: 'turn-1',
      })
    })

    it('defaults details to {} and turnId to null', async () => {
      mockRpc.mockResolvedValue({ data: {}, error: null })

      await service.storeAnalysis(
        'scenario-1', {}, 'h', 1, 'r', VALID_EVENT_ID,
      )

      expect(mockRpc).toHaveBeenCalledWith('store_analysis_and_log', expect.objectContaining({
        p_details: {},
        p_turn_id: null,
      }))
    })
  })

  // -----------------------------------------------------------------------
  // storeAnalysisFailure
  // -----------------------------------------------------------------------

  describe('storeAnalysisFailure', () => {
    it('calls store_analysis_failure with p_error JSONB', async () => {
      mockRpc.mockResolvedValue({ data: {}, error: null })

      await service.storeAnalysisFailure(
        'scenario-1',
        { code: 'TIMEOUT', message: 'Analysis timed out' },
        VALID_EVENT_ID,
      )

      expect(mockRpc).toHaveBeenCalledWith('store_analysis_failure', {
        p_scenario_id: 'scenario-1',
        p_error: { code: 'TIMEOUT', message: 'Analysis timed out' },
        p_event_id: VALID_EVENT_ID,
        p_turn_id: null,
      })
    })
  })

  // -----------------------------------------------------------------------
  // storeBrief
  // -----------------------------------------------------------------------

  describe('storeBrief', () => {
    it('calls store_brief_and_log RPC', async () => {
      mockRpc.mockResolvedValue({ data: {}, error: null })

      await service.storeBrief('scenario-1', { id: 'brief-1' }, VALID_EVENT_ID)

      expect(mockRpc).toHaveBeenCalledWith('store_brief_and_log', {
        p_scenario_id: 'scenario-1',
        p_brief: { id: 'brief-1' },
        p_event_id: VALID_EVENT_ID,
        p_turn_id: null,
      })
    })
  })

  // -----------------------------------------------------------------------
  // setStage
  // -----------------------------------------------------------------------

  describe('setStage', () => {
    it('calls set_stage_and_log RPC with p_new_stage', async () => {
      mockRpc.mockResolvedValue({ data: {}, error: null })

      await service.setStage('scenario-1', 'evaluate', VALID_EVENT_ID)

      expect(mockRpc).toHaveBeenCalledWith('set_stage_and_log', {
        p_scenario_id: 'scenario-1',
        p_new_stage: 'evaluate',
        p_event_id: VALID_EVENT_ID,
        p_turn_id: null,
      })
    })
  })

  // -----------------------------------------------------------------------
  // applyPatchAndLog
  // -----------------------------------------------------------------------

  describe('applyPatchAndLog', () => {
    it('calls apply_patch_and_log with correct event type', async () => {
      mockRpc.mockResolvedValue({ data: {}, error: null })

      await service.applyPatchAndLog(
        'scenario-1',
        { nodes: [], edges: [] },
        VALID_EVENT_ID,
        'patch_accepted',
        { operation: 'add_node', target_id: 'n1', summary: 'Added factor' },
      )

      expect(mockRpc).toHaveBeenCalledWith('apply_patch_and_log', {
        p_scenario_id: 'scenario-1',
        p_graph: { nodes: [], edges: [] },
        p_event_id: VALID_EVENT_ID,
        p_event_type: 'patch_accepted',
        p_details: { operation: 'add_node', target_id: 'n1', summary: 'Added factor' },
        p_hashes: null,
        p_turn_id: null,
      })
    })
  })

  // -----------------------------------------------------------------------
  // appendEvent
  // -----------------------------------------------------------------------

  describe('appendEvent', () => {
    it('calls append_scenario_event RPC', async () => {
      mockRpc.mockResolvedValue({ data: {}, error: null })

      await service.appendEvent(
        'scenario-1', VALID_EVENT_ID, 'confidence_pre', { score: 4 },
      )

      expect(mockRpc).toHaveBeenCalledWith('append_scenario_event', {
        p_scenario_id: 'scenario-1',
        p_event_id: VALID_EVENT_ID,
        p_event_type: 'confidence_pre',
        p_details: { score: 4 },
        p_hashes: null,
        p_turn_id: null,
      })
    })
  })

  // -----------------------------------------------------------------------
  // deleteScenario
  // -----------------------------------------------------------------------

  describe('deleteScenario', () => {
    it('calls DELETE on scenarios table', async () => {
      const eqFn = vi.fn().mockResolvedValue({ error: null })
      const deleteFn = vi.fn().mockReturnValue({ eq: eqFn })
      mockFrom.mockReturnValue({ delete: deleteFn, select: vi.fn(), insert: mockInsert, update: mockUpdate })

      await service.deleteScenario('scenario-1')

      expect(mockFrom).toHaveBeenCalledWith('scenarios')
      expect(eqFn).toHaveBeenCalledWith('id', 'scenario-1')
    })
  })

  // -----------------------------------------------------------------------
  // createSharedBrief
  // -----------------------------------------------------------------------

  describe('createSharedBrief', () => {
    it('calls create_shared_brief with only p_scenario_id', async () => {
      mockRpc.mockResolvedValue({ data: { id: 'sb-1', slug: 'abc123hex' }, error: null })

      const result = await service.createSharedBrief('scenario-1')

      expect(mockRpc).toHaveBeenCalledWith('create_shared_brief', {
        p_scenario_id: 'scenario-1',
      })
      expect(result).toEqual({ id: 'sb-1', slug: 'abc123hex' })
    })
  })

  // -----------------------------------------------------------------------
  // getSharedBriefBySlug
  // -----------------------------------------------------------------------

  describe('getSharedBriefBySlug', () => {
    it('calls get_shared_brief_by_slug with p_slug', async () => {
      const briefData = {
        brief: { title: 'Test' },
        graph_hash: 'h',
        seed_used: 42,
        response_hash: 'r',
        created_at: '2026-01-01',
        expires_at: null,
      }
      mockRpc.mockResolvedValue({ data: briefData, error: null })

      const result = await service.getSharedBriefBySlug('abc123hex')

      expect(mockRpc).toHaveBeenCalledWith('get_shared_brief_by_slug', {
        p_slug: 'abc123hex',
      })
      expect(result).toEqual(briefData)
    })

    it('returns null when RPC returns null data', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null })

      const result = await service.getSharedBriefBySlug('nonexistent')
      expect(result).toBeNull()
    })
  })

  // -----------------------------------------------------------------------
  // Error propagation
  // -----------------------------------------------------------------------

  describe('error propagation', () => {
    it('wraps Supabase errors in ScenarioPersistenceError', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'connection timeout', code: 'PGRST000' },
      })

      try {
        await service.storeAnalysis('s1', {}, 'h', 1, 'r', 'e1')
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ScenarioPersistenceError)
        expect((err as ScenarioPersistenceError).code).toBe('STORE_ANALYSIS_FAILED')
        expect((err as ScenarioPersistenceError).cause).toBeDefined()
      }
    })
  })
})
