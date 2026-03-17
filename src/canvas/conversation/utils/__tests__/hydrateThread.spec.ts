/**
 * Tests for hydrateThread -- thread-to-message mapper (Track 3).
 *
 * Verifies:
 * - User/assistant/system entries produce correct ConversationMessage shapes
 * - Block state reconstruction (proposed, accepted, dismissed, rejected)
 * - Stale block detection via graph hash comparison
 * - Session boundary entries render as dividers
 * - block_action and hash_only entries are skipped
 * - Redacted entries render structural summaries
 * - Partial/failed entries render status indicators
 * - Empty thread returns empty result
 */

import { describe, it, expect } from 'vitest'
import { hydrateMessagesFromThread, formatSessionBoundary } from '../hydrateThread'
import type { ThreadEntry } from '../../../journey/threadTypes'

function makeEntry(overrides: Partial<ThreadEntry> = {}): ThreadEntry {
  return {
    entry_id: `entry-${crypto.randomUUID().slice(0, 8)}`,
    entry_schema_version: 1,
    seq: 1,
    timestamp: '2026-03-08T14:00:00Z',
    role: 'user',
    origin: 'conversation',
    entry_status: 'complete',
    user_message: 'Hello',
    redaction_state: 'full',
    ...overrides,
  }
}

describe('hydrateMessagesFromThread', () => {
  it('maps user entry to user ConversationMessage', () => {
    const entry = makeEntry({ role: 'user', user_message: 'What is the ROI?' })
    const { messages } = hydrateMessagesFromThread([entry], undefined)

    expect(messages).toHaveLength(1)
    expect(messages[0].role).toBe('user')
    expect(messages[0].content).toBe('What is the ROI?')
    expect(messages[0]._threadMeta?.entryId).toBe(entry.entry_id)
    expect(messages[0]._threadMeta?.origin).toBe('conversation')
  })

  it('maps assistant entry with blocks to assistant ConversationMessage', () => {
    const entry = makeEntry({
      role: 'assistant',
      origin: 'conversation',
      assistant_text: 'Here are suggestions',
      blocks: [
        {
          block_id: 'patch-1',
          block_type: 'graph_patch',
          content_schema_version: 1,
          content: {
            patch_id: 'patch-1',
            summary: 'Add risk factor',
            operations: [],
            target_graph_hash: 'hash-a',
          },
          state: 'accepted',
        },
        {
          block_id: 'comment-1',
          block_type: 'commentary',
          content_schema_version: 1,
          content: { text: 'Consider this carefully' },
          state: 'proposed',
        },
      ],
    })
    delete (entry as Partial<ThreadEntry>).user_message

    const { messages, blockStates } = hydrateMessagesFromThread([entry], undefined)

    expect(messages).toHaveLength(1)
    expect(messages[0].role).toBe('assistant')
    expect(messages[0].content).toBe('Here are suggestions')
    expect(messages[0].blocks).toHaveLength(2)
    expect(messages[0].blocks?.[0].type).toBe('graph_patch')
    expect(messages[0].blocks?.[1].type).toBe('commentary')

    // Block state for graph_patch
    const stateKey = `${messages[0].id}:patch-1`
    expect(blockStates.get(stateKey)).toBe('accepted')
  })

  it('detects stale proposed blocks via graph hash mismatch', () => {
    const entry = makeEntry({
      role: 'assistant',
      origin: 'conversation',
      assistant_text: 'Suggestion',
      blocks: [{
        block_id: 'patch-1',
        block_type: 'graph_patch',
        content_schema_version: 1,
        content: {
          patch_id: 'patch-1',
          summary: 'Add node',
          operations: [],
          target_graph_hash: 'old-hash',
        },
        state: 'proposed',
      }],
    })
    delete (entry as Partial<ThreadEntry>).user_message

    const { blockStates, messages } = hydrateMessagesFromThread([entry], 'new-hash')

    const stateKey = `${messages[0].id}:patch-1`
    expect(blockStates.get(stateKey)).toBe('dismissed')
  })

  it('keeps proposed blocks active when graph hash matches', () => {
    const entry = makeEntry({
      role: 'assistant',
      origin: 'conversation',
      assistant_text: 'Suggestion',
      blocks: [{
        block_id: 'patch-1',
        block_type: 'graph_patch',
        content_schema_version: 1,
        content: {
          patch_id: 'patch-1',
          summary: 'Add node',
          operations: [],
          target_graph_hash: 'current-hash',
        },
        state: 'proposed',
      }],
    })
    delete (entry as Partial<ThreadEntry>).user_message

    const { blockStates, messages } = hydrateMessagesFromThread([entry], 'current-hash')

    const stateKey = `${messages[0].id}:patch-1`
    expect(blockStates.get(stateKey)).toBe('proposed')
  })

  it('keeps proposed blocks active when graph hash is unavailable', () => {
    const entry = makeEntry({
      role: 'assistant',
      origin: 'conversation',
      assistant_text: 'Suggestion',
      blocks: [{
        block_id: 'patch-1',
        block_type: 'graph_patch',
        content_schema_version: 1,
        content: {
          patch_id: 'patch-1',
          summary: 'Add node',
          operations: [],
          target_graph_hash: 'some-hash',
        },
        state: 'proposed',
      }],
    })
    delete (entry as Partial<ThreadEntry>).user_message

    const { blockStates, messages } = hydrateMessagesFromThread([entry], undefined)

    const stateKey = `${messages[0].id}:patch-1`
    expect(blockStates.get(stateKey)).toBe('proposed')
  })

  it('renders session boundary as divider', () => {
    const entry = makeEntry({
      role: 'system',
      origin: 'session_boundary',
      system_event_type: 'session_resumed',
      system_event_detail: 'Session resumed - 7 Mar, 14:22',
    })
    delete (entry as Partial<ThreadEntry>).user_message

    const { messages } = hydrateMessagesFromThread([entry], undefined)

    expect(messages).toHaveLength(1)
    expect(messages[0].sessionDivider).toBe('Session resumed - 7 Mar, 14:22')
    expect(messages[0].synthetic).toBe(true)
  })

  it('renders system events as visual markers', () => {
    const entry = makeEntry({
      role: 'system',
      origin: 'system_event',
      system_event_type: 'analysis_triggered',
      system_event_detail: 'Analysis complete - Option A at 72% (robust)',
    })
    delete (entry as Partial<ThreadEntry>).user_message

    const { messages } = hydrateMessagesFromThread([entry], undefined)

    expect(messages).toHaveLength(1)
    expect(messages[0].sessionDivider).toBe('Analysis complete - Option A at 72% (robust)')
    expect(messages[0].synthetic).toBe(true)
  })

  it('skips block_action entries', () => {
    const entry = makeEntry({
      origin: 'block_action',
      system_event_detail: 'Accepted: "Add node"',
    })

    const { messages } = hydrateMessagesFromThread([entry], undefined)
    expect(messages).toHaveLength(0)
  })

  it('skips hash_only entries', () => {
    const entry = makeEntry({ redaction_state: 'hash_only' })

    const { messages } = hydrateMessagesFromThread([entry], undefined)
    expect(messages).toHaveLength(0)
  })

  it('renders redacted user message with placeholder', () => {
    const entry = makeEntry({
      role: 'user',
      redaction_state: 'redacted',
      user_message: undefined,
    })

    const { messages } = hydrateMessagesFromThread([entry], undefined)

    expect(messages).toHaveLength(1)
    expect(messages[0].content).toBe('Message content not stored')
    expect(messages[0]._threadMeta?.redactionState).toBe('redacted')
  })

  it('renders redacted assistant message with block count', () => {
    const entry = makeEntry({
      role: 'assistant',
      origin: 'conversation',
      redaction_state: 'redacted',
      assistant_text: undefined,
      blocks: [
        { block_id: 'b1', block_type: 'graph_patch', content_schema_version: 1, content: {}, state: 'accepted' },
        { block_id: 'b2', block_type: 'fact', content_schema_version: 1, content: {}, state: 'proposed' },
      ],
    })
    delete (entry as Partial<ThreadEntry>).user_message

    const { messages } = hydrateMessagesFromThread([entry], undefined)

    expect(messages).toHaveLength(1)
    expect(messages[0].content).toBe('AI responded with 2 suggestions')
  })

  it('renders partial entry with status indicator', () => {
    const entry = makeEntry({
      role: 'assistant',
      origin: 'conversation',
      entry_status: 'partial',
      assistant_text: 'Partial response...',
    })
    delete (entry as Partial<ThreadEntry>).user_message

    const { messages } = hydrateMessagesFromThread([entry], undefined)

    expect(messages).toHaveLength(1)
    expect(messages[0].content).toBe('Partial response...')
    expect(messages[0]._threadMeta?.entryStatus).toBe('partial')
  })

  it('renders failed entry with status indicator', () => {
    const entry = makeEntry({
      role: 'assistant',
      origin: 'conversation',
      entry_status: 'failed',
      assistant_text: undefined,
    })
    delete (entry as Partial<ThreadEntry>).user_message

    const { messages } = hydrateMessagesFromThread([entry], undefined)

    expect(messages).toHaveLength(1)
    expect(messages[0].content).toBe('Response failed')
    expect(messages[0]._threadMeta?.entryStatus).toBe('failed')
  })

  it('returns empty result for empty thread', () => {
    const { messages, blockStates } = hydrateMessagesFromThread([], undefined)
    expect(messages).toHaveLength(0)
    expect(blockStates.size).toBe(0)
  })

  it('sorts entries by seq', () => {
    const entry1 = makeEntry({ seq: 3, user_message: 'Third' })
    const entry2 = makeEntry({ seq: 1, user_message: 'First' })
    const entry3 = makeEntry({ seq: 2, user_message: 'Second' })

    const { messages } = hydrateMessagesFromThread([entry1, entry2, entry3], undefined)

    expect(messages).toHaveLength(3)
    expect(messages[0].content).toBe('First')
    expect(messages[1].content).toBe('Second')
    expect(messages[2].content).toBe('Third')
  })

  it('handles unknown block type as commentary fallback', () => {
    const entry = makeEntry({
      role: 'assistant',
      origin: 'conversation',
      assistant_text: 'Here',
      blocks: [{
        block_id: 'x1',
        block_type: 'scenario' as any,
        content_schema_version: 1,
        content: { summary: 'Custom scenario block' },
        state: 'proposed',
      }],
    })
    delete (entry as Partial<ThreadEntry>).user_message

    const { messages } = hydrateMessagesFromThread([entry], undefined)

    expect(messages[0].blocks).toHaveLength(1)
    expect(messages[0].blocks?.[0].type).toBe('commentary')
    expect((messages[0].blocks?.[0] as any).text).toBe('[scenario] Custom scenario block')
  })

  it('detects stale via graph_hash_at_proposal fallback when target_graph_hash is absent', () => {
    const entry = makeEntry({
      role: 'assistant',
      origin: 'conversation',
      assistant_text: 'Suggestion',
      blocks: [{
        block_id: 'patch-1',
        block_type: 'graph_patch',
        content_schema_version: 1,
        content: {
          patch_id: 'patch-1',
          summary: 'Add node',
          operations: [],
          // No target_graph_hash — isBlockStale should fall back to graph_hash_at_proposal
          graph_hash_at_proposal: 'old-hash',
        },
        state: 'proposed',
      }],
    })
    delete (entry as Partial<ThreadEntry>).user_message

    const { blockStates, messages } = hydrateMessagesFromThread([entry], 'new-hash')

    const stateKey = `${messages[0].id}:patch-1`
    expect(blockStates.get(stateKey)).toBe('dismissed')
  })

  it('renders redacted assistant with zero blocks as generic placeholder', () => {
    const entry = makeEntry({
      role: 'assistant',
      origin: 'conversation',
      redaction_state: 'redacted',
      assistant_text: undefined,
      blocks: undefined,
    })
    delete (entry as Partial<ThreadEntry>).user_message

    const { messages } = hydrateMessagesFromThread([entry], undefined)

    expect(messages).toHaveLength(1)
    expect(messages[0].content).toBe('AI response content not stored')
  })
})

describe('formatSessionBoundary', () => {
  it('formats date as "Session resumed - D Mon, HH:MM"', () => {
    const date = new Date('2026-03-07T14:22:00Z')
    const result = formatSessionBoundary(date)
    // Time zone dependent — just check structure
    expect(result).toMatch(/^Session resumed - \d+ \w+, \d{2}:\d{2}$/)
  })
})
