/**
 * Tests for useConversation pure helper functions:
 * - buildHistory (last N turn-pairs, synthetic filtering)
 * - enforceChipBudget (coaching priority, suggested-action sub-cap)
 */

import { describe, it, expect } from 'vitest'
import { buildHistory, enforceChipBudget, inferLoadingHint } from '../useConversation'
import { MAX_CHIPS_PER_TURN, MAX_SUGGESTED_ACTIONS } from '../types'
import type { ConversationMessage, ActionChip } from '../types'

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function msg(
  role: 'user' | 'assistant',
  content: string,
  opts?: Partial<ConversationMessage>,
): ConversationMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: new Date(),
    ...opts,
  }
}

function chip(id: string, intent: ActionChip['intent'] = 'primary'): ActionChip {
  return { id, label: id, intent }
}

// ---------------------------------------------------------------------------
// buildHistory
// ---------------------------------------------------------------------------

describe('buildHistory', () => {
  it('returns empty array for no messages', () => {
    expect(buildHistory([], 5)).toEqual([])
  })

  it('extracts role+content pairs (strips extra fields)', () => {
    const msgs = [
      msg('user', 'Hello'),
      msg('assistant', 'Hi there'),
    ]
    const history = buildHistory(msgs, 5)
    expect(history).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ])
  })

  it('filters out synthetic messages', () => {
    const msgs = [
      msg('user', 'Hello'),
      msg('assistant', 'Error occurred', { synthetic: true }),
      msg('user', 'Try again'),
      msg('assistant', 'OK'),
    ]
    const history = buildHistory(msgs, 5)
    expect(history).toHaveLength(3) // synthetic filtered
    expect(history.map((h) => h.content)).toEqual(['Hello', 'Try again', 'OK'])
  })

  it('keeps last N*2 entries for maxPairs=5 (10 entries)', () => {
    // Build 7 turn-pairs (14 messages)
    const msgs: ConversationMessage[] = []
    for (let i = 0; i < 7; i++) {
      msgs.push(msg('user', `U${i}`))
      msgs.push(msg('assistant', `A${i}`))
    }

    const history = buildHistory(msgs, 5)
    expect(history).toHaveLength(10) // 5 pairs * 2
    expect(history[0]).toEqual({ role: 'user', content: 'U2' }) // first retained pair
    expect(history[9]).toEqual({ role: 'assistant', content: 'A6' }) // last pair
  })

  it('returns all entries when fewer than maxPairs', () => {
    const msgs = [msg('user', 'One'), msg('assistant', 'Two')]
    const history = buildHistory(msgs, 5)
    expect(history).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// enforceChipBudget
// ---------------------------------------------------------------------------

describe('enforceChipBudget', () => {
  it('returns empty array when both inputs are empty', () => {
    expect(enforceChipBudget([], [])).toEqual([])
  })

  it('caps suggested actions at MAX_SUGGESTED_ACTIONS when no coaching chips', () => {
    const actions = [chip('a1'), chip('a2'), chip('a3'), chip('a4')]
    const result = enforceChipBudget([], actions)
    expect(result).toHaveLength(MAX_SUGGESTED_ACTIONS)
    expect(result.map((c) => c.id)).toEqual(['a1', 'a2'])
  })

  it('coaching chips take all slots, leaving no room for actions', () => {
    const coaching = [chip('c1'), chip('c2'), chip('c3'), chip('c4')]
    const actions = [chip('a1'), chip('a2')]
    const result = enforceChipBudget(coaching, actions)
    expect(result).toHaveLength(MAX_CHIPS_PER_TURN) // 4
    expect(result.every((c) => c.id.startsWith('c'))).toBe(true)
  })

  it('coaching fills first, suggested actions fill remaining up to sub-cap', () => {
    const coaching = [chip('c1'), chip('c2')]
    const actions = [chip('a1'), chip('a2'), chip('a3')]
    const result = enforceChipBudget(coaching, actions)
    // 2 coaching + min(2 remaining slots, MAX_SUGGESTED_ACTIONS=2) = 4
    expect(result).toHaveLength(4)
    expect(result.map((c) => c.id)).toEqual(['c1', 'c2', 'a1', 'a2'])
  })

  it('respects total budget when coaching takes 3 of 4 slots', () => {
    const coaching = [chip('c1'), chip('c2'), chip('c3')]
    const actions = [chip('a1'), chip('a2')]
    const result = enforceChipBudget(coaching, actions)
    // 3 coaching + min(1 remaining, 2 sub-cap) = 4
    expect(result).toHaveLength(4)
    expect(result.map((c) => c.id)).toEqual(['c1', 'c2', 'c3', 'a1'])
  })

  it('suggested actions sub-cap constrains even with remaining total budget', () => {
    const coaching = [chip('c1')]
    const actions = [chip('a1'), chip('a2'), chip('a3')]
    const result = enforceChipBudget(coaching, actions)
    // 1 coaching + min(3 remaining, 2 sub-cap) = 3
    expect(result).toHaveLength(3)
    expect(result.map((c) => c.id)).toEqual(['c1', 'a1', 'a2'])
  })
})

// ---------------------------------------------------------------------------
// inferLoadingHint
// ---------------------------------------------------------------------------

describe('inferLoadingHint', () => {
  it('returns "Building…" for explicit_generate turn type', () => {
    expect(inferLoadingHint('some generic text', 0, 'explicit_generate')).toBe('Building your decision model\u2026')
  })

  it('returns "Building…" when message contains "build"', () => {
    expect(inferLoadingHint('build a model for me', 5)).toBe('Building your decision model\u2026')
  })

  it('returns "Thinking…" for generic message with no graph and no turnType', () => {
    expect(inferLoadingHint('what budget should I use', 0)).toBe('Thinking\u2026')
  })

  it('returns "Analysing…" for analysis keywords', () => {
    expect(inferLoadingHint('analyse my options', 3)).toBe('Analysing your options\u2026')
  })

  it('returns "Researching…" for research keywords', () => {
    expect(inferLoadingHint('find evidence on this', 3)).toBe('Researching evidence\u2026')
  })

  it('returns "Thinking…" as default fallback', () => {
    expect(inferLoadingHint('hello there', 5)).toBe('Thinking\u2026')
  })
})
