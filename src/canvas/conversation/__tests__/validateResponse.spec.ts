/**
 * validateResponse unit tests
 *
 * Verifies the defensive last-line validator for orchestrator responses.
 * Uses vi.mock to intercept trackEvent calls without side effects.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateResponse, validateEnvelopeShape, validateStreamEventShape, stripRepairLogLines } from '../validateResponse'
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

  // -----------------------------------------------------------------------
  // prompt → message normalisation (Brief B, Task 1)
  // CEE serialises the chip dispatch text as `prompt`; the UI uses `message`.
  // -----------------------------------------------------------------------

  it('normalises chip with prompt field into message field', () => {
    const wireChip = { id: 'p1', label: 'Calibrate', prompt: 'Help me calibrate', intent: 'primary' } as unknown as ActionChip
    const envelope = makeEnvelope({
      assistant_text: 'Try this',
      suggested_actions: [wireChip],
    })

    const { cleaned, repairs } = validateResponse(envelope, 'req-prompt')

    expect(repairs).toHaveLength(0)
    expect(cleaned.suggested_actions).toHaveLength(1)
    expect(cleaned.suggested_actions![0].message).toBe('Help me calibrate')
    // prompt field should not leak through to ActionChip
    expect((cleaned.suggested_actions![0] as Record<string, unknown>).prompt).toBeUndefined()
    expect(mockTrackEvent).not.toHaveBeenCalled()
  })

  it('preserves message field when both prompt and message are present', () => {
    const wireChip = { id: 'both', label: 'Go', message: 'use message', prompt: 'use prompt', intent: 'primary' } as unknown as ActionChip
    const envelope = makeEnvelope({
      assistant_text: 'Try this',
      suggested_actions: [wireChip],
    })

    const { cleaned, repairs } = validateResponse(envelope, 'req-both')

    expect(repairs).toHaveLength(0)
    expect(cleaned.suggested_actions![0].message).toBe('use message')
  })

  it('handles mixed prompt and message chips in the same envelope', () => {
    const messageChip = makeChip({ id: 'c-msg', label: 'A', message: 'msg text' })
    const promptChip = { id: 'c-prompt', label: 'B', prompt: 'prompt text', intent: 'secondary' } as unknown as ActionChip
    const envelope = makeEnvelope({
      assistant_text: 'Options',
      suggested_actions: [messageChip, promptChip],
    })

    const { cleaned, repairs } = validateResponse(envelope, 'req-mixed-fields')

    expect(repairs).toHaveLength(0)
    expect(cleaned.suggested_actions).toHaveLength(2)
    expect(cleaned.suggested_actions![0].message).toBe('msg text')
    expect(cleaned.suggested_actions![1].message).toBe('prompt text')
  })

  it('still filters chip when neither prompt nor message is present', () => {
    const noDispatch = { id: 'x', label: 'Empty', intent: 'primary' } as unknown as ActionChip
    const envelope = makeEnvelope({
      assistant_text: 'Try',
      suggested_actions: [noDispatch],
    })

    const { cleaned, repairs } = validateResponse(envelope, 'req-no-dispatch')

    expect(repairs).toContain('missing_chip_message')
    expect(cleaned.suggested_actions).toBeUndefined()
  })

  it('normalises prompt with role field preserved', () => {
    const wireChip = { id: 'r1', label: 'Push back', prompt: 'Challenge the risk', intent: 'secondary', role: 'challenger' } as unknown as ActionChip
    const envelope = makeEnvelope({
      assistant_text: 'Here',
      suggested_actions: [wireChip],
    })

    const { cleaned } = validateResponse(envelope, 'req-role')

    expect(cleaned.suggested_actions![0].message).toBe('Challenge the risk')
    expect(cleaned.suggested_actions![0].role).toBe('challenger')
    expect(cleaned.suggested_actions![0].label).toBe('Push back')
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

  it('does NOT inject fallback when assistant_text is null but blocks contain graph_patch', () => {
    const graphPatchBlock = {
      type: 'graph_patch',
      operations: [{ op: 'add_node', data: { id: 'n1', kind: 'factor', label: 'Test' } }],
    } as unknown as ConversationBlock
    const envelope = makeEnvelope({ assistant_text: null, blocks: [graphPatchBlock] })

    const { cleaned, repairs } = validateResponse(envelope, 'req-graph-patch')

    expect(repairs).toHaveLength(0)
    expect(cleaned.assistant_text).toBe('')
    expect(cleaned.blocks).toHaveLength(1)
    expect(mockTrackEvent).not.toHaveBeenCalled()
  })

  it('does NOT inject fallback when CEE wire-format block_type is graph_patch (no type field)', () => {
    // CEE V2 sends { block_type: 'graph_patch', block_id, data: {...} } — no 'type' field.
    // validateResponse must recognise this as a renderable block even though
    // adaptCEEBlock() hasn't normalised it yet.
    const wireBlock = {
      block_type: 'graph_patch',
      block_id: 'patch-1',
      data: { operations: [], description: 'Draft model' },
    } as unknown as ConversationBlock
    const envelope = makeEnvelope({ assistant_text: null, blocks: [wireBlock] })

    const { cleaned, repairs } = validateResponse(envelope, 'req-wire-patch')

    expect(repairs).toHaveLength(0)
    expect(cleaned.assistant_text).toBe('')
    expect(cleaned.blocks).toHaveLength(1)
    expect(mockTrackEvent).not.toHaveBeenCalled()
  })

  it('does NOT inject fallback when graph_patch block fails cleanedBlocks filter but is still present', () => {
    // Edge case: a graph_patch block that somehow lacks both type identifiers
    // (would be filtered by cleanedBlocks) but another well-formed graph_patch
    // block IS present in the raw blocks.
    const malformedBlock = { operations: [] } as unknown as ConversationBlock
    const goodPatch = {
      block_type: 'graph_patch',
      block_id: 'patch-2',
      data: { operations: [{ op: 'add_node' }] },
    } as unknown as ConversationBlock
    const envelope = makeEnvelope({
      assistant_text: '',
      blocks: [malformedBlock, goodPatch],
    })

    const { cleaned, repairs } = validateResponse(envelope, 'req-mixed')

    // malformedBlock is filtered (missing_block_type), but fallback NOT injected
    // because raw blocks contain a graph_patch
    expect(repairs).toContain('missing_block_type')
    expect(repairs).not.toContain('empty_text')
    expect(repairs).not.toContain('nothing_renderable')
    expect(cleaned.assistant_text).toBe('')
  })
})

// ---------------------------------------------------------------------------
// stripRepairLogLines (Brief A, Task 3)
// ---------------------------------------------------------------------------

describe('stripRepairLogLines', () => {
  it('strips [DEFAULT_EXISTS_PROBABILITY] lines', () => {
    const input = '[DEFAULT_EXISTS_PROBABILITY] Missing value, using default\n[DEFAULT_EXISTS_PROBABILITY] Missing value, using default\nActual text.'
    expect(stripRepairLogLines(input)).toBe('Actual text.')
  })

  it('strips all known repair log patterns', () => {
    const input = '[STD_FLOOR] Applied floor\n[CLAMP_WEIGHT] Clamped\n[MISSING_FIELD] Added default\n[FALLBACK_VALUE] Used fallback\n[REPAIR:001] Fixed\nReal content.'
    expect(stripRepairLogLines(input)).toBe('Real content.')
  })

  it('returns empty string when all lines are repair logs', () => {
    const input = '[DEFAULT_EXISTS_PROBABILITY] Missing value, using default\n[DEFAULT_EXISTS_PROBABILITY] Missing value, using default'
    expect(stripRepairLogLines(input)).toBe('')
  })

  it('preserves normal text unchanged', () => {
    const input = 'Here is a normal response.\n\n- With bullets\n- And more'
    expect(stripRepairLogLines(input)).toBe(input)
  })

  it('preserves blank lines between real content', () => {
    const input = 'First paragraph.\n\nSecond paragraph.'
    expect(stripRepairLogLines(input)).toBe(input)
  })
})

describe('validateResponse — repair log stripping', () => {
  it('strips repair log lines from assistant_text', () => {
    const envelope = makeEnvelope({
      assistant_text: '[DEFAULT_EXISTS_PROBABILITY] Missing value, using default\n[DEFAULT_EXISTS_PROBABILITY] Missing value, using default',
      blocks: [{ type: 'graph_patch', block_type: 'graph_patch', operations: [] } as unknown as ConversationBlock],
    })

    const { cleaned, repairs } = validateResponse(envelope, 'req-repair')

    expect(repairs).toContain('repair_log_stripped')
    expect(cleaned.assistant_text).toBe('')
  })

  it('strips repair log lines but preserves real text', () => {
    const envelope = makeEnvelope({
      assistant_text: '[DEFAULT_EXISTS_PROBABILITY] Missing value, using default\nActual response text here.',
      blocks: [{ type: 'commentary', text: 'ok' } as unknown as ConversationBlock],
    })

    const { cleaned, repairs } = validateResponse(envelope, 'req-repair-partial')

    expect(repairs).toContain('repair_log_stripped')
    expect(cleaned.assistant_text).toBe('Actual response text here.')
  })
})

// ---------------------------------------------------------------------------
// validateEnvelopeShape (Brief 4, Task 1)
// ---------------------------------------------------------------------------

describe('validateEnvelopeShape', () => {
  it('passes through a valid envelope object unchanged', () => {
    const raw = { assistant_text: 'Hello', blocks: [{ type: 'commentary', text: 'ok' }] }
    const result = validateEnvelopeShape(raw)
    expect(result.assistant_text).toBe('Hello')
    expect(result.blocks).toHaveLength(1)
    expect(mockTrackEvent).not.toHaveBeenCalled()
  })

  it('returns fallback for null input', () => {
    const result = validateEnvelopeShape(null)
    expect(result.assistant_text).toContain('Something went wrong')
    expect(mockTrackEvent).toHaveBeenCalledWith('ui.envelope_shape_invalid', expect.objectContaining({ violation: 'not_object' }))
  })

  it('returns fallback for a bare string', () => {
    const result = validateEnvelopeShape('some html or error page')
    expect(result.assistant_text).toContain('Something went wrong')
    expect(mockTrackEvent).toHaveBeenCalledWith('ui.envelope_shape_invalid', expect.objectContaining({ violation: 'not_object', raw_type: 'string' }))
  })

  it('returns fallback for an array', () => {
    const result = validateEnvelopeShape([1, 2, 3])
    expect(result.assistant_text).toContain('Something went wrong')
    expect(mockTrackEvent).toHaveBeenCalledWith('ui.envelope_shape_invalid', expect.objectContaining({ raw_type: 'array' }))
  })

  it('returns fallback for a number', () => {
    const result = validateEnvelopeShape(42)
    expect(result.assistant_text).toContain('Something went wrong')
  })

  it('repairs assistant_text that is a number', () => {
    const result = validateEnvelopeShape({ assistant_text: 123 })
    expect(result.assistant_text).toBeNull()
    expect(mockTrackEvent).toHaveBeenCalledWith('ui.envelope_shape_invalid', expect.objectContaining({
      violations: expect.arrayContaining(['assistant_text_not_string_or_null']),
    }))
  })

  it('repairs blocks that is a string instead of array', () => {
    const result = validateEnvelopeShape({ assistant_text: 'ok', blocks: 'not-an-array' })
    expect(result.blocks).toBeUndefined()
    expect(mockTrackEvent).toHaveBeenCalledWith('ui.envelope_shape_invalid', expect.objectContaining({
      violations: expect.arrayContaining(['blocks_not_array']),
    }))
  })

  it('repairs suggested_actions that is an object instead of array', () => {
    const result = validateEnvelopeShape({ assistant_text: 'ok', suggested_actions: { bad: true } })
    expect(result.suggested_actions).toBeUndefined()
    expect(mockTrackEvent).toHaveBeenCalledWith('ui.envelope_shape_invalid', expect.objectContaining({
      violations: expect.arrayContaining(['suggested_actions_not_array']),
    }))
  })

  it('allows null assistant_text (valid per type)', () => {
    const result = validateEnvelopeShape({ assistant_text: null })
    expect(result.assistant_text).toBeNull()
    expect(mockTrackEvent).not.toHaveBeenCalled()
  })

  it('allows undefined blocks and suggested_actions (valid per type)', () => {
    const result = validateEnvelopeShape({ assistant_text: 'hi' })
    expect(result.blocks).toBeUndefined()
    expect(result.suggested_actions).toBeUndefined()
    expect(mockTrackEvent).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// validateStreamEventShape (Brief 4, Task 1)
// ---------------------------------------------------------------------------

describe('validateStreamEventShape', () => {
  it('passes through a valid event', () => {
    const parsed = { seq: 1, delta: 'Hello ' }
    const result = validateStreamEventShape(parsed, 'text_delta')
    expect(result).not.toBeNull()
    expect(result!.type).toBe('text_delta')
    expect(mockTrackEvent).not.toHaveBeenCalled()
  })

  it('returns null for event with missing type', () => {
    const parsed = { seq: 1, delta: 'Hello ' }
    const result = validateStreamEventShape(parsed, undefined)
    expect(result).toBeNull()
    expect(mockTrackEvent).toHaveBeenCalledWith('ui.stream_event_shape_invalid', expect.objectContaining({ violation: 'missing_type' }))
  })

  it('returns null for event with empty string type', () => {
    const parsed = { seq: 1 }
    const result = validateStreamEventShape(parsed, '')
    expect(result).toBeNull()
    expect(mockTrackEvent).toHaveBeenCalled()
  })

  it('validates nested envelope on turn_complete events', () => {
    const parsed = {
      seq: 5,
      envelope: { assistant_text: 'done', blocks: [{ type: 'commentary', text: 'ok' }] },
    }
    const result = validateStreamEventShape(parsed, 'turn_complete')
    expect(result).not.toBeNull()
    expect(result!.type).toBe('turn_complete')
    // envelope should pass through validated
    expect((result as any).envelope.assistant_text).toBe('done')
  })

  it('repairs malformed nested envelope on turn_complete', () => {
    const parsed = {
      seq: 5,
      envelope: 'not-an-object',
    }
    const result = validateStreamEventShape(parsed, 'turn_complete')
    expect(result).not.toBeNull()
    // The nested envelope should be replaced with fallback
    expect((result as any).envelope.assistant_text).toContain('Something went wrong')
    expect(mockTrackEvent).toHaveBeenCalled()
  })

  it('injects fallback envelope when turn_complete has no envelope field', () => {
    const parsed = { seq: 5 }
    const result = validateStreamEventShape(parsed, 'turn_complete')
    expect(result).not.toBeNull()
    expect((result as any).envelope.assistant_text).toContain('Something went wrong')
    expect(mockTrackEvent).toHaveBeenCalledWith('ui.stream_event_shape_invalid', expect.objectContaining({ violation: 'missing_envelope' }))
  })

  it('warns on unknown event type but passes through', () => {
    const parsed = { seq: 1, data: 'something' }
    const result = validateStreamEventShape(parsed, 'some_future_event')
    expect(result).not.toBeNull()
    expect(result!.type).toBe('some_future_event')
    expect(mockTrackEvent).toHaveBeenCalledWith('ui.stream_event_shape_invalid', expect.objectContaining({ violation: 'unknown_type', type: 'some_future_event' }))
  })
})
