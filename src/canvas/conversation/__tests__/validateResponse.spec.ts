/**
 * validateResponse unit tests
 *
 * Verifies the defensive last-line validator for orchestrator responses.
 * Uses vi.mock to intercept trackEvent calls without side effects.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateResponse } from '../validateResponse'
import type { OrchestratorResponseEnvelopeV2, ActionChip, ConversationBlock } from '../types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockTrackEvent = vi.fn()
vi.mock('../../../lib/posthog', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}))

beforeEach(() => {
  mockTrackEvent.mockReset()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEnvelope(overrides: Partial<OrchestratorResponseEnvelopeV2> = {}): OrchestratorResponseEnvelopeV2 {
  return {
    assistant_text: null,
    ...overrides,
  }
}

function makeChip(overrides: Partial<ActionChip> = {}): ActionChip {
  return {
    id: 'chip-1',
    label: 'Do it',
    intent: 'primary',
    message: 'please do it',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateResponse', () => {
  it('leaves a valid response unchanged and emits no telemetry', () => {
    const envelope = makeEnvelope({
      assistant_text: 'Hello there',
      suggested_actions: [makeChip()],
      blocks: [{ type: 'commentary', text: 'Nice' } as unknown as ConversationBlock],
    })

    const { cleaned, repairs } = validateResponse(envelope, 'req-1')

    expect(repairs).toHaveLength(0)
    expect(cleaned.assistant_text).toBe('Hello there')
    expect(cleaned.suggested_actions).toHaveLength(1)
    expect(cleaned.blocks).toHaveLength(1)
    expect(mockTrackEvent).not.toHaveBeenCalled()
  })

  it('injects fallback text when response is entirely empty and emits telemetry', () => {
    const envelope = makeEnvelope({ assistant_text: null })

    const { cleaned, repairs } = validateResponse(envelope, 'req-2')

    expect(repairs).toContain('nothing_renderable')
    expect(cleaned.assistant_text).toBeTruthy()
    expect(cleaned.assistant_text).toContain("couldn't generate a complete response")
    expect(mockTrackEvent).toHaveBeenCalledOnce()
    expect(mockTrackEvent).toHaveBeenCalledWith('ui.response.repaired', {
      request_id: 'req-2',
      repairs: expect.arrayContaining(['nothing_renderable']),
    })
  })

  it('injects fallback when assistant_text is whitespace-only and no blocks', () => {
    const envelope = makeEnvelope({ assistant_text: '   ' })

    const { cleaned, repairs } = validateResponse(envelope, 'req-3')

    expect(repairs.some(r => r === 'empty_text' || r === 'nothing_renderable')).toBe(true)
    expect(cleaned.assistant_text).toContain("couldn't generate a complete response")
    expect(mockTrackEvent).toHaveBeenCalledOnce()
  })

  it('emits empty_text (not nothing_renderable) when text empty but valid chips present', () => {
    const envelope = makeEnvelope({
      assistant_text: '',
      suggested_actions: [makeChip()],
    })

    const { cleaned, repairs } = validateResponse(envelope, 'req-4')

    expect(repairs).toContain('empty_text')
    expect(repairs).not.toContain('nothing_renderable')
    expect(cleaned.assistant_text).toContain("couldn't generate a complete response")
    expect(mockTrackEvent).toHaveBeenCalledOnce()
  })

  it('filters chip missing message and emits telemetry', () => {
    const goodChip = makeChip({ id: 'good', label: 'OK', message: 'ok' })
    const badChip = makeChip({ id: 'bad', label: 'Bad', message: undefined })

    const envelope = makeEnvelope({
      assistant_text: 'Here are some actions',
      suggested_actions: [goodChip, badChip],
    })

    const { cleaned, repairs } = validateResponse(envelope, 'req-5')

    expect(repairs).toContain('missing_chip_message')
    expect(cleaned.suggested_actions).toHaveLength(1)
    expect(cleaned.suggested_actions![0].id).toBe('good')
    expect(mockTrackEvent).toHaveBeenCalledOnce()
    expect(mockTrackEvent).toHaveBeenCalledWith('ui.response.repaired', {
      request_id: 'req-5',
      repairs: ['missing_chip_message'],
    })
  })

  it('filters chip missing label and emits telemetry', () => {
    const badChip = { id: 'x', intent: 'primary', message: 'msg' } as unknown as ActionChip
    const envelope = makeEnvelope({
      assistant_text: 'Text',
      suggested_actions: [badChip],
    })

    const { cleaned, repairs } = validateResponse(envelope, 'req-6')

    expect(repairs).toContain('missing_chip_label')
    expect(cleaned.suggested_actions).toBeUndefined()
    expect(mockTrackEvent).toHaveBeenCalledOnce()
  })

  it('filters block missing type and emits telemetry', () => {
    const goodBlock = { type: 'commentary', text: 'ok' } as unknown as ConversationBlock
    const badBlock = { text: 'no type here' } as unknown as ConversationBlock

    const envelope = makeEnvelope({
      assistant_text: 'Some text',
      blocks: [goodBlock, badBlock],
    })

    const { cleaned, repairs } = validateResponse(envelope, 'req-7')

    expect(repairs).toContain('missing_block_type')
    expect(cleaned.blocks).toHaveLength(1)
    expect((cleaned.blocks![0] as Record<string, unknown>).type).toBe('commentary')
    expect(mockTrackEvent).toHaveBeenCalledOnce()
    expect(mockTrackEvent).toHaveBeenCalledWith('ui.response.repaired', {
      request_id: 'req-7',
      repairs: ['missing_block_type'],
    })
  })

  it('emits a single event for multiple repairs in one envelope', () => {
    const badChip = makeChip({ message: undefined })
    const badBlock = { text: 'no type' } as unknown as ConversationBlock

    const envelope = makeEnvelope({
      assistant_text: '',
      suggested_actions: [badChip],
      blocks: [badBlock],
    })

    const { repairs } = validateResponse(envelope, 'req-8')

    // multiple repair types, single trackEvent call
    expect(repairs.length).toBeGreaterThan(1)
    expect(mockTrackEvent).toHaveBeenCalledOnce()
    expect(mockTrackEvent.mock.calls[0][1].repairs).toHaveLength(repairs.length)
  })

  it('does not mutate the original envelope', () => {
    const badChip = makeChip({ message: undefined })
    const envelope = makeEnvelope({
      assistant_text: '',
      suggested_actions: [badChip],
    })
    const originalActions = envelope.suggested_actions

    validateResponse(envelope, 'req-9')

    expect(envelope.suggested_actions).toBe(originalActions)
    expect(envelope.assistant_text).toBe('')
  })
})
