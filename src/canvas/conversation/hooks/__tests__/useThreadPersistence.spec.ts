/**
 * Tests for useThreadPersistence -- thread entry construction and persistence.
 *
 * Mocks the thread service and feature flag. Verifies:
 * - User messages produce correct ThreadEntry shapes
 * - Assistant messages with blocks produce PersistedBlock[] with content_schema_version: 1
 * - Block actions produce in-place state update + block_action origin entry
 * - Debounce batches multiple entries into a single flush
 * - Duplicate entry_ids are not re-sent (idempotency)
 * - Flag off: no RPC calls made
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock feature flag
vi.mock('../../../../flags', () => ({
  isThreadPersistEnabled: vi.fn(() => true),
}))

// Mock thread service
const mockAppendThreadEntries = vi.fn()
const mockUpdateThreadBlockState = vi.fn()
const mockInsertConversationTurn = vi.fn().mockResolvedValue(null)
vi.mock('../../../../services/threadService', () => ({
  appendThreadEntries: (...args: unknown[]) => mockAppendThreadEntries(...args),
  updateThreadBlockState: (...args: unknown[]) => mockUpdateThreadBlockState(...args),
  insertConversationTurn: (...args: unknown[]) => mockInsertConversationTurn(...args),
}))

// Mock results store (used by normalised persistence path)
vi.mock('../../../stores/resultsStore', () => ({
  useResultsStore: {
    getState: () => ({ results: { lastSnapshotId: null } }),
  },
}))

// Mock getUserId
vi.mock('../../../../lib/supabase', () => ({
  getUserId: vi.fn(async () => 'user-abc-123'),
}))

import { useThreadPersistence } from '../useThreadPersistence'
import { isThreadPersistEnabled } from '../../../../flags'
import type { ConversationMessage } from '../../types'

function makeUserMessage(text: string, overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id: `msg-${crypto.randomUUID().slice(0, 8)}`,
    role: 'user',
    content: text,
    timestamp: new Date(),
    ...overrides,
  }
}

function makeAssistantMessage(
  text: string,
  overrides: Partial<ConversationMessage> = {},
): ConversationMessage {
  return {
    id: `msg-${crypto.randomUUID().slice(0, 8)}`,
    role: 'assistant',
    content: text,
    timestamp: new Date(),
    ...overrides,
  }
}

describe('useThreadPersistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.mocked(isThreadPersistEnabled).mockReturnValue(true)
    mockAppendThreadEntries.mockResolvedValue([{ entry_id: 'e1', seq: 1, timestamp: '2026-03-08T10:00:00Z' }])
    mockUpdateThreadBlockState.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates user ThreadEntry with correct shape', async () => {
    const userMsg = makeUserMessage('What is the ROI?')
    const { rerender } = renderHook(
      ({ msgs }) => useThreadPersistence('scenario-1', msgs),
      { initialProps: { msgs: [] as ConversationMessage[] } },
    )

    // Add user message
    rerender({ msgs: [userMsg] })

    // Resolve async (getUserId)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    // Flush debounce
    await act(async () => { await vi.advanceTimersByTimeAsync(2100) })

    expect(mockAppendThreadEntries).toHaveBeenCalledWith(
      'scenario-1',
      expect.arrayContaining([
        expect.objectContaining({
          entry_schema_version: 1,
          role: 'user',
          origin: 'conversation',
          entry_status: 'complete',
          user_message: 'What is the ROI?',
          actor_user_id: 'user-abc-123',
          redaction_state: 'full',
        }),
      ]),
    )
  })

  it('creates assistant ThreadEntry with blocks and content_schema_version', async () => {
    const assistantMsg = makeAssistantMessage('Here are the results', {
      blocks: [
        {
          type: 'graph_patch',
          patch_id: 'patch-1',
          summary: 'Added risk factor',
          operations: [{ op: 'add_node', target_id: 'n1', data: { label: 'Risk' } }],
          target_graph_hash: 'hash-1',
        },
      ],
      actionChips: [
        { id: 'chip-1', label: 'Run analysis', intent: 'primary' },
      ],
    })

    const { rerender } = renderHook(
      ({ msgs }) => useThreadPersistence('scenario-1', msgs),
      { initialProps: { msgs: [] as ConversationMessage[] } },
    )

    rerender({ msgs: [assistantMsg] })
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    await act(async () => { await vi.advanceTimersByTimeAsync(2100) })

    expect(mockAppendThreadEntries).toHaveBeenCalledWith(
      'scenario-1',
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          origin: 'conversation',
          entry_status: 'complete',
          assistant_text: 'Here are the results',
          blocks: expect.arrayContaining([
            expect.objectContaining({
              block_id: 'patch-1',
              block_type: 'graph_patch',
              content_schema_version: 1,
              state: 'proposed',
            }),
          ]),
          suggested_actions: expect.arrayContaining([
            expect.objectContaining({
              action_id: 'chip-1',
              label: 'Run analysis',
              taken: false,
            }),
          ]),
          redaction_state: 'full',
        }),
      ]),
    )
  })

  it('skips synthetic messages', async () => {
    const syntheticMsg = makeAssistantMessage('Welcome!', { synthetic: true })

    const { rerender } = renderHook(
      ({ msgs }) => useThreadPersistence('scenario-1', msgs),
      { initialProps: { msgs: [] as ConversationMessage[] } },
    )

    rerender({ msgs: [syntheticMsg] })
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    await act(async () => { await vi.advanceTimersByTimeAsync(2100) })

    expect(mockAppendThreadEntries).not.toHaveBeenCalled()
  })

  it('debounces multiple rapid messages into a single flush', async () => {
    const msg1 = makeUserMessage('First')
    const msg2 = makeAssistantMessage('Reply')

    const { rerender } = renderHook(
      ({ msgs }) => useThreadPersistence('scenario-1', msgs),
      { initialProps: { msgs: [] as ConversationMessage[] } },
    )

    rerender({ msgs: [msg1] })
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })

    rerender({ msgs: [msg1, msg2] })
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    await act(async () => { await vi.advanceTimersByTimeAsync(2100) })

    // Should be a single call with both entries
    expect(mockAppendThreadEntries).toHaveBeenCalledTimes(1)
    const entries = mockAppendThreadEntries.mock.calls[0][1]
    expect(entries).toHaveLength(2)
  })

  it('makes no RPC calls when feature flag is off', async () => {
    vi.mocked(isThreadPersistEnabled).mockReturnValue(false)

    const msg = makeUserMessage('Hello')
    const { rerender } = renderHook(
      ({ msgs }) => useThreadPersistence('scenario-1', msgs),
      { initialProps: { msgs: [] as ConversationMessage[] } },
    )

    rerender({ msgs: [msg] })
    await act(async () => { await vi.advanceTimersByTimeAsync(2100) })

    expect(mockAppendThreadEntries).not.toHaveBeenCalled()
  })

  it('makes no RPC calls when scenarioId is null', async () => {
    const msg = makeUserMessage('Hello')
    const { rerender } = renderHook(
      ({ msgs }) => useThreadPersistence(null, msgs),
      { initialProps: { msgs: [] as ConversationMessage[] } },
    )

    rerender({ msgs: [msg] })
    await act(async () => { await vi.advanceTimersByTimeAsync(2100) })

    expect(mockAppendThreadEntries).not.toHaveBeenCalled()
  })

  it('block action calls updateThreadBlockState and enqueues block_action entry', async () => {
    const assistantMsg = makeAssistantMessage('Suggestion', {
      blocks: [{
        type: 'graph_patch',
        patch_id: 'patch-1',
        summary: 'Add node',
        operations: [],
        target_graph_hash: 'h1',
      }],
    })

    const { result, rerender } = renderHook(
      ({ msgs }) => useThreadPersistence('scenario-1', msgs),
      { initialProps: { msgs: [] as ConversationMessage[] } },
    )

    // First add the assistant message so messageToEntryId is populated
    rerender({ msgs: [assistantMsg] })
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    // Call block action
    await act(async () => {
      await result.current.onBlockAction(
        assistantMsg.id,
        'patch-1',
        'accepted',
        'Accepted: "Add node"',
      )
    })

    // Verify updateThreadBlockState was called
    expect(mockUpdateThreadBlockState).toHaveBeenCalledWith(
      'scenario-1',
      expect.any(String), // entry ID mapped from message ID
      'patch-1',
      'accepted',
    )

    // Flush debounce to check block_action entry was enqueued
    await act(async () => { await vi.advanceTimersByTimeAsync(2100) })

    // Should have been called with entries including the block_action
    const calls = mockAppendThreadEntries.mock.calls
    const allEntries = calls.flatMap((c: unknown[]) => c[1] as Record<string, unknown>[])
    const blockActionEntry = allEntries.find(
      (e: Record<string, unknown>) => e.origin === 'block_action',
    )
    expect(blockActionEntry).toBeDefined()
    expect(blockActionEntry?.entry_status).toBe('complete')
    expect(blockActionEntry?.system_event_detail).toBe('Accepted: "Add node"')
  })

  it('onChipTaken includes actor_user_id in block_action entry', async () => {
    const assistantMsg = makeAssistantMessage('Here you go', {
      actionChips: [
        { id: 'chip-1', label: 'Run analysis', intent: 'primary' },
      ],
    })

    const { result, rerender } = renderHook(
      ({ msgs }) => useThreadPersistence('scenario-1', msgs),
      { initialProps: { msgs: [] as ConversationMessage[] } },
    )

    // Add assistant message so messageToEntryId is populated
    rerender({ msgs: [assistantMsg] })
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    // Call onChipTaken (async — resolves userId internally)
    await act(async () => {
      await result.current.onChipTaken(assistantMsg.id, 'chip-1')
    })

    // Flush debounce
    await act(async () => { await vi.advanceTimersByTimeAsync(2100) })

    const calls = mockAppendThreadEntries.mock.calls
    const allEntries = calls.flatMap((c: unknown[]) => c[1] as Record<string, unknown>[])
    const chipEntry = allEntries.find(
      (e: Record<string, unknown>) =>
        e.origin === 'block_action' &&
        typeof e.system_event_detail === 'string' &&
        (e.system_event_detail as string).includes('chip-1'),
    )
    expect(chipEntry).toBeDefined()
    expect(chipEntry?.actor_user_id).toBe('user-abc-123')
    expect(chipEntry?.role).toBe('user')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Normalised persistence (always-on, not gated by threadPersist flag)
  // ─────────────────────────────────────────────────────────────────────────

  it('fires insertConversationTurn for user messages regardless of threadPersist flag', async () => {
    vi.mocked(isThreadPersistEnabled).mockReturnValue(false)

    const msg = makeUserMessage('Hello', { clientTurnId: 'turn-1' })
    const { rerender } = renderHook(
      ({ msgs }) => useThreadPersistence('scenario-1', msgs),
      { initialProps: { msgs: [] as ConversationMessage[] } },
    )

    rerender({ msgs: [msg] })
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    // Legacy path should NOT be called
    expect(mockAppendThreadEntries).not.toHaveBeenCalled()
    // Normalised path should fire
    expect(mockInsertConversationTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        scenarioId: 'scenario-1',
        role: 'user',
        content: 'Hello',
        clientTurnId: 'turn-1',
      }),
    )
  })

  it('fires insertConversationTurn for assistant messages with blocks', async () => {
    const msg = makeAssistantMessage('Analysis complete', {
      clientTurnId: 'turn-2',
      blocks: [{
        type: 'commentary',
        text: 'Here is the analysis',
      }],
    })

    const { rerender } = renderHook(
      ({ msgs }) => useThreadPersistence('scenario-1', msgs),
      { initialProps: { msgs: [] as ConversationMessage[] } },
    )

    rerender({ msgs: [msg] })
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    expect(mockInsertConversationTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        scenarioId: 'scenario-1',
        role: 'assistant',
        content: 'Analysis complete',
        structuredBlocks: msg.blocks,
        clientTurnId: 'turn-2',
      }),
    )
  })

  it('does not fire insertConversationTurn for synthetic messages', async () => {
    const msg = makeUserMessage('Welcome', { synthetic: true })
    const { rerender } = renderHook(
      ({ msgs }) => useThreadPersistence('scenario-1', msgs),
      { initialProps: { msgs: [] as ConversationMessage[] } },
    )

    rerender({ msgs: [msg] })
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    expect(mockInsertConversationTurn).not.toHaveBeenCalled()
  })
})
