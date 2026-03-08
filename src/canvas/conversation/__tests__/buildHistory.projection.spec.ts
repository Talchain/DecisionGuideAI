/**
 * Tests for buildHistory LLM projection rules (Track 3).
 *
 * Verifies that hydrated messages are correctly filtered before
 * being sent to the orchestrator.
 */

import { describe, it, expect } from 'vitest'
import { buildHistory } from '../useConversation'
import type { ConversationMessage } from '../types'

function makeMsg(
  role: 'user' | 'assistant',
  content: string,
  overrides: Partial<ConversationMessage> = {},
): ConversationMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: new Date(),
    ...overrides,
  }
}

describe('buildHistory — Track 3 projection rules', () => {
  it('includes normal (non-hydrated) messages', () => {
    const msgs = [
      makeMsg('user', 'Hello'),
      makeMsg('assistant', 'Hi there'),
    ]

    const result = buildHistory(msgs, 5)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ role: 'user', content: 'Hello' })
  })

  it('excludes synthetic messages', () => {
    const msgs = [
      makeMsg('user', 'Hello'),
      makeMsg('assistant', '', { synthetic: true, sessionDivider: 'Session resumed' }),
      makeMsg('assistant', 'Response'),
    ]

    const result = buildHistory(msgs, 5)
    expect(result).toHaveLength(2)
    expect(result.map(p => p.content)).toEqual(['Hello', 'Response'])
  })

  it('includes hydrated conversation-origin, complete, full entries', () => {
    const msgs = [
      makeMsg('user', 'Hydrated question', {
        _threadMeta: { entryId: 'e1', origin: 'conversation', entryStatus: 'complete', redactionState: 'full' },
      }),
      makeMsg('assistant', 'Hydrated answer', {
        _threadMeta: { entryId: 'e2', origin: 'conversation', entryStatus: 'complete', redactionState: 'full' },
      }),
    ]

    const result = buildHistory(msgs, 5)
    expect(result).toHaveLength(2)
    expect(result[0].content).toBe('Hydrated question')
  })

  it('excludes hydrated block_action entries', () => {
    const msgs = [
      makeMsg('user', 'Normal message'),
      makeMsg('user', 'Block action audit', {
        _threadMeta: { entryId: 'e1', origin: 'block_action', entryStatus: 'complete', redactionState: 'full' },
      }),
    ]

    const result = buildHistory(msgs, 5)
    expect(result).toHaveLength(1)
    expect(result[0].content).toBe('Normal message')
  })

  it('excludes hydrated system_event entries', () => {
    const msgs = [
      makeMsg('assistant', 'System event', {
        _threadMeta: { entryId: 'e1', origin: 'system_event', entryStatus: 'complete', redactionState: 'full' },
      }),
    ]

    const result = buildHistory(msgs, 5)
    expect(result).toHaveLength(0)
  })

  it('excludes hydrated partial entries', () => {
    const msgs = [
      makeMsg('assistant', 'Partial response', {
        _threadMeta: { entryId: 'e1', origin: 'conversation', entryStatus: 'partial', redactionState: 'full' },
      }),
    ]

    const result = buildHistory(msgs, 5)
    expect(result).toHaveLength(0)
  })

  it('excludes hydrated failed entries', () => {
    const msgs = [
      makeMsg('assistant', 'Failed response', {
        _threadMeta: { entryId: 'e1', origin: 'conversation', entryStatus: 'failed', redactionState: 'full' },
      }),
    ]

    const result = buildHistory(msgs, 5)
    expect(result).toHaveLength(0)
  })

  it('excludes hydrated redacted entries', () => {
    const msgs = [
      makeMsg('user', 'Message content not stored', {
        _threadMeta: { entryId: 'e1', origin: 'conversation', entryStatus: 'complete', redactionState: 'redacted' },
      }),
    ]

    const result = buildHistory(msgs, 5)
    expect(result).toHaveLength(0)
  })

  it('mixed thread: only conversation+complete+full pass through', () => {
    const msgs = [
      makeMsg('user', 'Q1', {
        _threadMeta: { entryId: 'e1', origin: 'conversation', entryStatus: 'complete', redactionState: 'full' },
      }),
      makeMsg('assistant', 'A1', {
        _threadMeta: { entryId: 'e2', origin: 'conversation', entryStatus: 'complete', redactionState: 'full' },
      }),
      makeMsg('user', 'Block action', {
        _threadMeta: { entryId: 'e3', origin: 'block_action', entryStatus: 'complete', redactionState: 'full' },
      }),
      makeMsg('assistant', '', {
        synthetic: true, sessionDivider: 'Session resumed',
      }),
      makeMsg('assistant', 'Partial', {
        _threadMeta: { entryId: 'e4', origin: 'conversation', entryStatus: 'partial', redactionState: 'full' },
      }),
      makeMsg('user', 'Redacted', {
        _threadMeta: { entryId: 'e5', origin: 'conversation', entryStatus: 'complete', redactionState: 'redacted' },
      }),
      // New session messages (no _threadMeta)
      makeMsg('user', 'Q2'),
      makeMsg('assistant', 'A2'),
    ]

    const result = buildHistory(msgs, 5)
    expect(result).toHaveLength(4)
    expect(result.map(p => p.content)).toEqual(['Q1', 'A1', 'Q2', 'A2'])
  })

  it('caps at maxPairs * 2 entries and keeps the last ones', () => {
    const msgs: ConversationMessage[] = []
    for (let i = 0; i < 20; i++) {
      msgs.push(makeMsg(i % 2 === 0 ? 'user' : 'assistant', `Message ${i}`))
    }

    const result = buildHistory(msgs, 5)
    expect(result).toHaveLength(10) // 5 pairs * 2
    // Slice keeps the LAST 10 entries (messages 10-19)
    expect(result[0].content).toBe('Message 10')
    expect(result[9].content).toBe('Message 19')
  })

  it('returns empty for empty input', () => {
    expect(buildHistory([], 5)).toHaveLength(0)
  })
})
