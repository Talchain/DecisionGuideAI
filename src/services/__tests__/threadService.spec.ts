/**
 * Unit tests for threadService -- Supabase thread persistence helpers.
 *
 * Mocks Supabase client and feature flag. Verifies:
 * - appendThreadEntries returns entries on success, null on failure
 * - updateThreadBlockState completes silently on success, logs on failure
 * - Both return immediately when feature flag is off
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the feature flag
vi.mock('../../flags', () => ({
  isThreadPersistEnabled: vi.fn(() => true),
}))

// Mock the Supabase client
const mockRpc = vi.fn()
vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}))

import { appendThreadEntries, updateThreadBlockState, createSnapshot, insertConversationTurn } from '../threadService'
import { isThreadPersistEnabled } from '../../flags'
import type { ThreadEntryInput } from '../../canvas/journey/threadTypes'

function makeEntryInput(overrides: Partial<ThreadEntryInput> = {}): ThreadEntryInput {
  return {
    entry_id: 'entry-1',
    entry_schema_version: 1,
    role: 'user',
    origin: 'conversation',
    entry_status: 'complete',
    user_message: 'Hello',
    redaction_state: 'full',
    ...overrides,
  }
}

describe('threadService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isThreadPersistEnabled).mockReturnValue(true)
  })

  describe('appendThreadEntries', () => {
    it('returns entries with seq/timestamp when RPC succeeds', async () => {
      const serverEntries = [
        { entry_id: 'entry-1', seq: 1, timestamp: '2026-03-08T10:00:00Z' },
      ]
      mockRpc.mockResolvedValue({ data: serverEntries, error: null })

      const result = await appendThreadEntries('scenario-1', [makeEntryInput()])

      expect(result).toEqual(serverEntries)
      expect(mockRpc).toHaveBeenCalledWith('append_thread_entries', {
        p_scenario_id: 'scenario-1',
        p_entries: [makeEntryInput()],
      })
    })

    it('returns null on RPC failure (no throw)', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'DB error' } })
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await appendThreadEntries('scenario-1', [makeEntryInput()])

      expect(result).toBeNull()
      expect(warnSpy).toHaveBeenCalledWith(
        '[ThreadService] append_thread_entries failed:',
        'DB error',
      )
      warnSpy.mockRestore()
    })

    it('returns null on exception (no throw)', async () => {
      mockRpc.mockRejectedValue(new Error('Network error'))
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await appendThreadEntries('scenario-1', [makeEntryInput()])

      expect(result).toBeNull()
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('returns null immediately when feature flag is off', async () => {
      vi.mocked(isThreadPersistEnabled).mockReturnValue(false)

      const result = await appendThreadEntries('scenario-1', [makeEntryInput()])

      expect(result).toBeNull()
      expect(mockRpc).not.toHaveBeenCalled()
    })

    it('returns null for empty entries array', async () => {
      const result = await appendThreadEntries('scenario-1', [])

      expect(result).toBeNull()
      expect(mockRpc).not.toHaveBeenCalled()
    })

    it('returns null for empty scenarioId', async () => {
      const result = await appendThreadEntries('', [makeEntryInput()])

      expect(result).toBeNull()
      expect(mockRpc).not.toHaveBeenCalled()
    })
  })

  describe('updateThreadBlockState', () => {
    it('completes silently on success', async () => {
      mockRpc.mockResolvedValue({ error: null })

      await expect(
        updateThreadBlockState('scenario-1', 'entry-1', 'block-1', 'accepted'),
      ).resolves.toBeUndefined()

      expect(mockRpc).toHaveBeenCalledWith('update_thread_block_state', {
        p_scenario_id: 'scenario-1',
        p_entry_id: 'entry-1',
        p_block_id: 'block-1',
        p_new_state: 'accepted',
      })
    })

    it('logs and does not throw on RPC failure', async () => {
      mockRpc.mockResolvedValue({ error: { message: 'Not found' } })
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await expect(
        updateThreadBlockState('scenario-1', 'entry-1', 'block-1', 'accepted'),
      ).resolves.toBeUndefined()

      expect(warnSpy).toHaveBeenCalledWith(
        '[ThreadService] update_thread_block_state failed:',
        'Not found',
      )
      warnSpy.mockRestore()
    })

    it('logs and does not throw on exception', async () => {
      mockRpc.mockRejectedValue(new Error('Timeout'))
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await expect(
        updateThreadBlockState('scenario-1', 'entry-1', 'block-1', 'dismissed'),
      ).resolves.toBeUndefined()

      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('returns immediately when feature flag is off', async () => {
      vi.mocked(isThreadPersistEnabled).mockReturnValue(false)

      await updateThreadBlockState('scenario-1', 'entry-1', 'block-1', 'accepted')

      expect(mockRpc).not.toHaveBeenCalled()
    })

    it('returns immediately for empty parameters', async () => {
      await updateThreadBlockState('scenario-1', '', 'block-1', 'accepted')
      await updateThreadBlockState('scenario-1', 'entry-1', '', 'accepted')
      await updateThreadBlockState('', 'entry-1', 'block-1', 'accepted')

      expect(mockRpc).not.toHaveBeenCalled()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // BIL Phase 1: Normalised persistence (always-on, not flag-gated)
  // ─────────────────────────────────────────────────────────────────────────

  describe('createSnapshot', () => {
    it('calls create_snapshot RPC with correct params and returns snapshot ID', async () => {
      mockRpc.mockResolvedValue({ data: 'snap-uuid-1', error: null })

      const result = await createSnapshot({
        scenarioId: 'scenario-1',
        graph: { nodes: [], edges: [] },
        graphHash: 'hash-abc',
        analysis: { status: 'computed' },
        seed: 42,
        qualityMode: 'deep',
      })

      expect(result).toBe('snap-uuid-1')
      expect(mockRpc).toHaveBeenCalledWith('create_snapshot', {
        p_scenario_id: 'scenario-1',
        p_graph: { nodes: [], edges: [] },
        p_graph_hash: 'hash-abc',
        p_analysis: { status: 'computed' },
        p_brief_text: null,
        p_brief_hash: null,
        p_seed: 42,
        p_quality_mode: 'deep',
      })
    })

    it('returns null on RPC error (no throw)', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'ownership check failed' } })
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await createSnapshot({
        scenarioId: 'scenario-1',
        graph: { nodes: [] },
        graphHash: 'hash',
      })

      expect(result).toBeNull()
      expect(warnSpy).toHaveBeenCalledWith(
        '[ThreadService] create_snapshot failed:',
        'ownership check failed',
      )
      warnSpy.mockRestore()
    })

    it('returns null on exception (no throw)', async () => {
      mockRpc.mockRejectedValue(new Error('Network'))
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await createSnapshot({
        scenarioId: 'scenario-1',
        graph: {},
        graphHash: 'hash',
      })

      expect(result).toBeNull()
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('returns null for empty scenarioId', async () => {
      const result = await createSnapshot({
        scenarioId: '',
        graph: {},
        graphHash: 'hash',
      })

      expect(result).toBeNull()
      expect(mockRpc).not.toHaveBeenCalled()
    })

    it('is not gated by threadPersist flag', async () => {
      vi.mocked(isThreadPersistEnabled).mockReturnValue(false)
      mockRpc.mockResolvedValue({ data: 'snap-uuid-2', error: null })

      const result = await createSnapshot({
        scenarioId: 'scenario-1',
        graph: {},
        graphHash: 'hash',
      })

      expect(result).toBe('snap-uuid-2')
      expect(mockRpc).toHaveBeenCalled()
    })
  })

  describe('insertConversationTurn', () => {
    it('calls insert_conversation_turn RPC with correct params and returns turn ID', async () => {
      mockRpc.mockResolvedValue({ data: 'turn-uuid-1', error: null })

      const result = await insertConversationTurn({
        scenarioId: 'scenario-1',
        role: 'user',
        content: 'Hello',
        clientTurnId: 'client-1',
        snapshotId: 'snap-1',
      })

      expect(result).toBe('turn-uuid-1')
      expect(mockRpc).toHaveBeenCalledWith('insert_conversation_turn', {
        p_scenario_id: 'scenario-1',
        p_role: 'user',
        p_content: 'Hello',
        p_structured_blocks: null,
        p_snapshot_id: 'snap-1',
        p_analysis_snapshot_id: null,
        p_client_turn_id: 'client-1',
      })
    })

    it('returns null on idempotent duplicate (no throw)', async () => {
      // ON CONFLICT DO NOTHING → RETURNING yields null
      mockRpc.mockResolvedValue({ data: null, error: null })

      const result = await insertConversationTurn({
        scenarioId: 'scenario-1',
        role: 'user',
        content: 'Hello',
        clientTurnId: 'client-1',
      })

      expect(result).toBeNull()
    })

    it('returns null on RPC error (no throw)', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'forbidden' } })
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await insertConversationTurn({
        scenarioId: 'scenario-1',
        role: 'assistant',
        content: 'Response',
      })

      expect(result).toBeNull()
      expect(warnSpy).toHaveBeenCalledWith(
        '[ThreadService] insert_conversation_turn failed:',
        'forbidden',
      )
      warnSpy.mockRestore()
    })

    it('returns null for empty scenarioId', async () => {
      const result = await insertConversationTurn({
        scenarioId: '',
        role: 'user',
      })

      expect(result).toBeNull()
      expect(mockRpc).not.toHaveBeenCalled()
    })

    it('is not gated by threadPersist flag', async () => {
      vi.mocked(isThreadPersistEnabled).mockReturnValue(false)
      mockRpc.mockResolvedValue({ data: 'turn-uuid-3', error: null })

      const result = await insertConversationTurn({
        scenarioId: 'scenario-1',
        role: 'assistant',
        content: 'Hi',
      })

      expect(result).toBe('turn-uuid-3')
      expect(mockRpc).toHaveBeenCalled()
    })

    it('passes structured blocks for assistant turns', async () => {
      mockRpc.mockResolvedValue({ data: 'turn-uuid-4', error: null })

      const blocks = [
        { type: 'commentary' as const, text: 'Analysis complete' },
      ]

      await insertConversationTurn({
        scenarioId: 'scenario-1',
        role: 'assistant',
        content: 'Done',
        structuredBlocks: blocks,
        analysisSnapshotId: 'snap-analysis-1',
      })

      expect(mockRpc).toHaveBeenCalledWith('insert_conversation_turn', expect.objectContaining({
        p_structured_blocks: blocks,
        p_analysis_snapshot_id: 'snap-analysis-1',
      }))
    })
  })
})
