/**
 * Conversation history guards — unit tests
 *
 * Covers:
 * 1. Error fallback text → filtered by isNonConversationalContent
 * 2. Empty assistant_text → filtered
 * 3. System sentinel → filtered
 * 4. Valid assistant_text → NOT filtered
 * 5. buildHistory retroactive cleanup
 * 6. buildHistory excludes [system] sentinel user messages
 */

import { describe, it, expect } from 'vitest'
import { isNonConversationalContent, buildHistory, SYSTEM_MESSAGE_SENTINEL } from '../useConversation'
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

// ---------------------------------------------------------------------------
// § 1 — isNonConversationalContent
// ---------------------------------------------------------------------------

describe('isNonConversationalContent', () => {
  it('detects the FALLBACK_TEXT error message', () => {
    expect(isNonConversationalContent(
      "I received your message but couldn't generate a complete response. Try rephrasing.",
    )).toBe(true)
  })

  it('detects prefix match for error variants', () => {
    expect(isNonConversationalContent(
      "I received your message but couldn't process it right now.",
    )).toBe(true)
  })

  it('detects the normaliser default text', () => {
    expect(isNonConversationalContent(
      "I'm ready to help with your decision.",
    )).toBe(true)
  })

  it('detects empty string', () => {
    expect(isNonConversationalContent('')).toBe(true)
  })

  it('detects whitespace-only string', () => {
    expect(isNonConversationalContent('   ')).toBe(true)
  })

  it('detects system message sentinel', () => {
    expect(isNonConversationalContent(SYSTEM_MESSAGE_SENTINEL)).toBe(true)
  })

  it('does NOT filter valid assistant text', () => {
    expect(isNonConversationalContent(
      'The best approach depends on your constraints and time horizon.',
    )).toBe(false)
  })

  it('does NOT filter text containing the error phrase as a substring', () => {
    expect(isNonConversationalContent(
      'Let me explain. I received your message and here is my analysis.',
    )).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// § 2 — buildHistory retroactive cleanup
// ---------------------------------------------------------------------------

describe('buildHistory — retroactive guards', () => {
  it('excludes error fallback text from history', () => {
    const msgs = [
      makeMsg('user', 'Should I hire a developer?'),
      makeMsg('assistant', "I received your message but couldn't generate a complete response. Try rephrasing."),
      makeMsg('user', 'Try again please'),
      makeMsg('assistant', 'Here is my analysis of the hiring decision.'),
    ]
    const history = buildHistory(msgs, 5)
    expect(history).toHaveLength(3)
    expect(history.map(h => h.role)).toEqual(['user', 'user', 'assistant'])
    expect(history[2].content).toBe('Here is my analysis of the hiring decision.')
  })

  it('excludes normaliser default text from history', () => {
    const msgs = [
      makeMsg('user', 'Hello'),
      makeMsg('assistant', "I'm ready to help with your decision."),
    ]
    const history = buildHistory(msgs, 5)
    expect(history).toHaveLength(1)
    expect(history[0].role).toBe('user')
  })

  it('excludes [system] sentinel user messages from history', () => {
    const msgs = [
      makeMsg('user', 'Build a model for hiring'),
      makeMsg('assistant', 'Here is your decision model.'),
      makeMsg('user', SYSTEM_MESSAGE_SENTINEL),
      makeMsg('assistant', "I received your message but couldn't generate a complete response. Try rephrasing."),
    ]
    const history = buildHistory(msgs, 5)
    expect(history).toHaveLength(2)
    expect(history[0].content).toBe('Build a model for hiring')
    expect(history[1].content).toBe('Here is your decision model.')
  })

  it('preserves valid assistant text in history', () => {
    const msgs = [
      makeMsg('user', 'What factors should I consider?'),
      makeMsg('assistant', 'There are several key factors including cost, timeline, and skill availability.'),
    ]
    const history = buildHistory(msgs, 5)
    expect(history).toHaveLength(2)
    expect(history[1].content).toBe('There are several key factors including cost, timeline, and skill availability.')
  })

  it('handles consecutive assistant turns — filters error, keeps valid', () => {
    const msgs = [
      makeMsg('user', 'Generate model'),
      makeMsg('assistant', 'Your decision model has been created with 3 options.'),
      makeMsg('assistant', "I received your message but couldn't generate a complete response. Try rephrasing."),
    ]
    const history = buildHistory(msgs, 5)
    expect(history).toHaveLength(2)
    expect(history[1].content).toBe('Your decision model has been created with 3 options.')
  })

  it('excludes empty assistant content from history', () => {
    const msgs = [
      makeMsg('user', 'Test'),
      makeMsg('assistant', ''),
      makeMsg('assistant', '   '),
    ]
    const history = buildHistory(msgs, 5)
    expect(history).toHaveLength(1)
    expect(history[0].role).toBe('user')
  })
})
