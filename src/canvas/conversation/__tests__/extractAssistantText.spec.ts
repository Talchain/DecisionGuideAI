/**
 * extractAssistantText — unit tests
 *
 * Covers:
 * 1. V2 envelope JSON → extracts text field
 * 2. Legacy plain text → stored unchanged
 * 3. Malformed response with no text field → stored as original
 * 4. JSON with empty text field → stored as original
 * 5. Non-JSON content starting with { → stored as-is
 * 6. Integration: buildHistory uses clean text, not JSON
 */

import { describe, it, expect, vi } from 'vitest'
import { extractAssistantText, buildHistory } from '../useConversation'
import type { ConversationMessage } from '../types'

// ---------------------------------------------------------------------------
// § 1 — JSON envelope extraction (V2 + legacy shapes)
// ---------------------------------------------------------------------------

describe('extractAssistantText — V2 envelope extraction', () => {
  it('extracts assistant_text from a full V2 envelope', () => {
    const json = JSON.stringify({
      assistant_text: 'The best approach depends on your constraints.',
      response_version: 2,
      turn_id: 'turn-abc',
      blocks: [{ type: 'commentary', text: 'detail' }],
      insights: [{ type: 'bias_detected', description: 'Narrow framing' }],
    })
    expect(extractAssistantText(json)).toBe('The best approach depends on your constraints.')
  })

  it('prefers assistant_text over text when both present', () => {
    const json = JSON.stringify({
      assistant_text: 'V2 text',
      text: 'Legacy text',
    })
    expect(extractAssistantText(json)).toBe('V2 text')
  })

  it('extracts text from legacy JSON envelope (no assistant_text)', () => {
    const json = JSON.stringify({
      text: 'Here are four decision-making techniques.',
      insights: [{ type: 'bias_detected', description: 'Narrow framing' }],
      recommended_actions: ['explore'],
    })
    expect(extractAssistantText(json)).toBe('Here are four decision-making techniques.')
  })

  it('extracts text from minimal JSON with only text field', () => {
    const json = JSON.stringify({ text: 'Simple response.' })
    expect(extractAssistantText(json)).toBe('Simple response.')
  })

  it('handles whitespace around the JSON', () => {
    const json = `  ${JSON.stringify({ text: 'Padded response.' })}  `
    expect(extractAssistantText(json)).toBe('Padded response.')
  })
})

// ---------------------------------------------------------------------------
// § 2 — Legacy plain text → unchanged
// ---------------------------------------------------------------------------

describe('extractAssistantText — plain text passthrough', () => {
  it('returns plain text unchanged', () => {
    expect(extractAssistantText('Hello, how can I help?')).toBe('Hello, how can I help?')
  })

  it('returns multi-paragraph text unchanged', () => {
    const text = 'First paragraph.\n\nSecond paragraph.'
    expect(extractAssistantText(text)).toBe(text)
  })

  it('returns empty string for empty input', () => {
    expect(extractAssistantText('')).toBe('')
  })

  it('returns empty string for null-ish input', () => {
    expect(extractAssistantText(undefined as unknown as string)).toBe('')
    expect(extractAssistantText(null as unknown as string)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// § 3 — Malformed response → stored as original
// ---------------------------------------------------------------------------

describe('extractAssistantText — malformed responses', () => {
  it('returns original when JSON has no text field', () => {
    const json = JSON.stringify({ response: 'Hello', insights: [] })
    expect(extractAssistantText(json)).toBe(json)
  })

  it('returns original when text field is not a string', () => {
    const json = JSON.stringify({ text: 42 })
    expect(extractAssistantText(json)).toBe(json)
  })

  it('returns original when text field is empty string', () => {
    const json = JSON.stringify({ text: '' })
    expect(extractAssistantText(json)).toBe(json)
  })

  it('returns original when text field is whitespace only', () => {
    const json = JSON.stringify({ text: '   ' })
    expect(extractAssistantText(json)).toBe(json)
  })

  it('returns original for invalid JSON starting with {', () => {
    const malformed = '{ broken json "text"'
    expect(extractAssistantText(malformed)).toBe(malformed)
  })

  it('does not crash on deeply nested JSON', () => {
    const nested = JSON.stringify({ text: 'OK', nested: { deep: { deeper: true } } })
    expect(extractAssistantText(nested)).toBe('OK')
  })
})

// ---------------------------------------------------------------------------
// § 4 — Non-JSON content starting with {
// ---------------------------------------------------------------------------

describe('extractAssistantText — edge cases', () => {
  it('returns content starting with { but not containing "text"', () => {
    const content = '{This is not JSON, just starts with a brace.}'
    expect(extractAssistantText(content)).toBe(content)
  })

  it('logs warning for JSON without extractable text field', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const json = JSON.stringify({ response: 'Hello' })
    extractAssistantText(json)
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('no extractable text'),
      expect.any(Object),
    )
    spy.mockRestore()
  })

  it('warns for unknown JSON shapes without mutating content', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const json = JSON.stringify({ random_field: 'value', blocks: [] })
    const result = extractAssistantText(json)
    expect(result).toBe(json) // original returned, not fallback text
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// § 5 — Integration: buildHistory uses clean text
// ---------------------------------------------------------------------------

describe('extractAssistantText + buildHistory integration', () => {
  it('conversation_history contains plain text after extraction', () => {
    // Simulate: user sends message, assistant responds with JSON-wrapped text
    const extractedText = extractAssistantText(
      JSON.stringify({ text: 'The best approach is to compare options.', insights: [] }),
    )

    const msgs: ConversationMessage[] = [
      { id: '1', role: 'user', content: 'Should I hire a developer?', timestamp: new Date() },
      { id: '2', role: 'assistant', content: extractedText, timestamp: new Date() },
    ]

    const history = buildHistory(msgs, 5)
    expect(history).toHaveLength(2)
    expect(history[1].content).toBe('The best approach is to compare options.')
    // Must NOT contain JSON structure
    expect(history[1].content).not.toContain('{')
    expect(history[1].content).not.toContain('"text"')
  })
})
