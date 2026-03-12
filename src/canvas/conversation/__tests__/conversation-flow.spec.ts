/**
 * Conversation flow smoke tests
 *
 * Exercises the full useConversation hook against mocked orchestrator responses.
 * No real API calls. Tests 8 scenarios covering normal flow, error states,
 * malformed data, timeout, retry, and chip interaction.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCallTurn = vi.fn()
vi.mock('../turnService', () => ({
  callOrchestratorTurn: (...args: unknown[]) => mockCallTurn(...args),
  OrchestratorError: class OrchestratorError extends Error {
    status: number
    body: unknown
    constructor(message: string, status: number, body: unknown) {
      super(message)
      this.name = 'OrchestratorError'
      this.status = status
      this.body = body
    }
  },
}))

const mockTrackEvent = vi.fn()
vi.mock('../../../lib/posthog', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}))

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers()
  mockCallTurn.mockReset()
  mockTrackEvent.mockReset()

  useCanvasStore.setState({
    currentScenarioId: 'test-scenario',
    nodes: [],
    edges: [],
    results: { status: 'idle' } as any,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  })
})

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// Scenario 1: Normal response — text + 2 valid chips
// ---------------------------------------------------------------------------

describe('Scenario 1: normal response', () => {
  it('renders text and two valid chips', async () => {
    mockCallTurn.mockResolvedValueOnce({
      assistant_text: 'Here is my analysis.',
      suggested_actions: [
        { id: 'c1', label: 'Option A', intent: 'primary', message: 'choose option a' },
        { id: 'c2', label: 'Option B', intent: 'secondary', message: 'choose option b' },
      ],
    })

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('analyse my decision')
    })

    const msgs = result.current.messages
    const assistant = msgs.find(m => m.role === 'assistant')
    expect(assistant).toBeDefined()
    expect(assistant!.content).toContain('Here is my analysis')
    expect(assistant!.actionChips).toHaveLength(2)
    expect(result.current.isThinking).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Scenario 2: Empty response — fallback injected + telemetry emitted
// ---------------------------------------------------------------------------

describe('Scenario 2: empty response', () => {
  it('injects fallback text and emits repair telemetry', async () => {
    mockCallTurn.mockResolvedValueOnce({
      assistant_text: '',
      blocks: [],
      suggested_actions: [],
    })

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('hello')
    })

    const msgs = result.current.messages
    const assistant = msgs.find(m => m.role === 'assistant')
    expect(assistant).toBeDefined()
    // validateResponse should have injected fallback
    expect(assistant!.content).toContain("couldn't generate a complete response")

    // Telemetry emitted for the repair
    expect(mockTrackEvent).toHaveBeenCalledWith(
      'ui.response.repaired',
      expect.objectContaining({ repairs: expect.any(Array) }),
    )
  })
})

// ---------------------------------------------------------------------------
// Scenario 3: Malformed chips — one valid, one missing message
// ---------------------------------------------------------------------------

describe('Scenario 3: malformed chips', () => {
  it('keeps valid chip, filters malformed, no crash', async () => {
    mockCallTurn.mockResolvedValueOnce({
      assistant_text: 'Some response.',
      suggested_actions: [
        { id: 'good', label: 'Good chip', intent: 'primary', message: 'send good' },
        { id: 'bad', label: 'Bad chip', intent: 'secondary' /* no message */ },
      ],
    })

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('test')
    })

    const msgs = result.current.messages
    const assistant = msgs.find(m => m.role === 'assistant')
    expect(assistant).toBeDefined()
    // Only the valid chip should survive validateResponse
    const chips = assistant!.actionChips ?? []
    expect(chips.every(c => !!c.message || c.intent === 'undo')).toBe(true)
    // Repair telemetry fired for the bad chip
    expect(mockTrackEvent).toHaveBeenCalledWith(
      'ui.response.repaired',
      expect.objectContaining({ repairs: expect.arrayContaining(['missing_chip_message']) }),
    )
  })
})

// ---------------------------------------------------------------------------
// Scenario 4: Tool suppression — text only, no blocks
// ---------------------------------------------------------------------------

describe('Scenario 4: tool suppression', () => {
  it('renders text without error when tools are blocked server-side', async () => {
    mockCallTurn.mockResolvedValueOnce({
      assistant_text: 'I can explain that.',
      // no blocks, no chips — tool was suppressed
    })

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('explain the model')
    })

    const msgs = result.current.messages
    const assistant = msgs.find(m => m.role === 'assistant')
    expect(assistant).toBeDefined()
    expect(assistant!.content).toContain('I can explain that')
    expect(assistant!.blocks).toBeUndefined()
    // No repair telemetry for a clean response
    expect(mockTrackEvent).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Scenario 5: Timeout — thinking → delayed warning → timeout message
// ---------------------------------------------------------------------------

describe('Scenario 5: timeout progression', () => {
  it('shows thinking, delayed warning at 30s, error message at 60s', async () => {
    mockCallTurn.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      result.current.sendMessage('a long request')
    })

    // Immediately after send: thinking state
    expect(result.current.isThinking).toBe(true)
    expect(result.current.longRunningHint).toBeNull()

    // At 30s: "Still working…"
    act(() => { vi.advanceTimersByTime(30_000) })
    expect(result.current.longRunningHint).toBe('Still working\u2026')

    // At 60s: timeout error bubble
    act(() => { vi.advanceTimersByTime(30_000) })
    expect(result.current.isThinking).toBe(false)
    const last = result.current.messages[result.current.messages.length - 1]
    expect(last.synthetic).toBe(true)
    expect(last.content).toMatch(/taking longer than expected/)
  })
})

// ---------------------------------------------------------------------------
// Scenario 6: Retry — error turn retried, no duplicate bubble
// ---------------------------------------------------------------------------

describe('Scenario 6: retry flow', () => {
  it('replaces error bubble on retry, does not add duplicate user bubble', async () => {
    // First call fails
    mockCallTurn.mockRejectedValueOnce(new Error('Network error'))
    // Second call (retry) succeeds
    mockCallTurn.mockResolvedValueOnce({
      assistant_text: 'Retry succeeded.',
    })

    const { result } = renderHook(() => useConversation())

    // Initial send — fails
    await act(async () => {
      await result.current.sendMessage('my question')
    })

    const userBubblesAfterError = result.current.messages.filter(m => m.role === 'user').length
    expect(userBubblesAfterError).toBe(1)

    // Retry
    await act(async () => {
      await result.current.retryLast()
    })

    // No new user bubble added on retry
    const userBubblesAfterRetry = result.current.messages.filter(m => m.role === 'user').length
    expect(userBubblesAfterRetry).toBe(1)

    // Error bubble replaced by success message
    const last = result.current.messages[result.current.messages.length - 1]
    expect(last.role).toBe('assistant')
    expect(last.content).toContain('Retry succeeded')
    expect(last.synthetic).toBeFalsy()
  })
})

// ---------------------------------------------------------------------------
// Scenario 7: Chip click — label shown in thread, message sent to orchestrator
// ---------------------------------------------------------------------------

describe('Scenario 7: chip click — label vs message', () => {
  it('shows chip.label in conversation bubble, sends chip.message to orchestrator', async () => {
    // First: assistant message with a chip
    mockCallTurn.mockResolvedValueOnce({
      assistant_text: 'What would you like?',
      suggested_actions: [
        { id: 'chip-1', label: 'Tell me more', intent: 'primary', message: 'please elaborate in detail' },
      ],
    })
    // Second: chip response
    mockCallTurn.mockResolvedValueOnce({
      assistant_text: 'Here is more detail.',
    })

    const { result } = renderHook(() => useConversation())

    // Get initial response
    await act(async () => {
      await result.current.sendMessage('hello')
    })

    // Find the chip in the state
    const lastAssistant = [...result.current.messages].reverse().find(m => m.role === 'assistant')
    const chip = lastAssistant?.actionChips?.[0]
    expect(chip).toBeDefined()
    expect(chip!.label).toBe('Tell me more')

    // Click the chip
    await act(async () => {
      await result.current.sendChip(chip!)
    })

    // User bubble shows chip.label
    const userMessages = result.current.messages.filter(m => m.role === 'user')
    const chipBubble = userMessages[userMessages.length - 1]
    expect(chipBubble.content).toBe('Tell me more')

    // Orchestrator was called with chip.message (the actual wire message)
    const lastCallArgs = mockCallTurn.mock.calls[mockCallTurn.mock.calls.length - 1]
    const request = lastCallArgs[0]
    expect(request.message).toBe('please elaborate in detail')
  })
})

// ---------------------------------------------------------------------------
// Scenario 8: Valid text + malformed chips + malformed blocks → clean message
// ---------------------------------------------------------------------------

describe('Scenario 8: valid text + malformed chips + malformed blocks', () => {
  it('user sees clean message with valid text, malformed items silently filtered', async () => {
    mockCallTurn.mockResolvedValueOnce({
      assistant_text: 'Here is a clean response.',
      suggested_actions: [
        { id: 'ok', label: 'Good', intent: 'primary', message: 'ok action' },
        { id: 'bad', label: 'Bad' /* no message */ },
      ],
      blocks: [
        { type: 'commentary', text: 'Valid block' },
        { text: 'Block without type' } /* no type field */,
      ],
    })

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('send me data')
    })

    const msgs = result.current.messages
    const assistant = msgs.find(m => m.role === 'assistant')
    expect(assistant).toBeDefined()

    // Text visible to user
    expect(assistant!.content).toContain('clean response')

    // Valid chip survives
    const chips = assistant!.actionChips ?? []
    expect(chips.some(c => c.id === 'ok')).toBe(true)
    // Bad chip filtered
    expect(chips.every(c => c.message !== undefined || c.intent === 'undo')).toBe(true)

    // Valid block survives
    const blocks = assistant!.blocks ?? []
    expect(blocks.every(b => typeof (b as Record<string, unknown>).type === 'string')).toBe(true)

    // Repair telemetry for the two bad items
    expect(mockTrackEvent).toHaveBeenCalledWith(
      'ui.response.repaired',
      expect.objectContaining({ repairs: expect.any(Array) }),
    )
  })
})

// ---------------------------------------------------------------------------
// Scenario 9: chip message leakage stripping
// ---------------------------------------------------------------------------

describe('Scenario 9: chip message text stripped from assistant_text', () => {
  it('strips chip message text (not just label) from trailing list lines in assistant_text', async () => {
    // CEE echoes the chip's raw message text as a list item in assistant_text — must be stripped
    mockCallTurn.mockResolvedValueOnce({
      assistant_text: 'Here are your options:\n- What other approaches could you take?',
      suggested_actions: [
        {
          id: 'chip-alt',
          label: 'What other approaches could you take?',
          intent: 'primary',
          message: 'what other approaches could you take?',
        },
      ],
    })
    mockCallTurn.mockResolvedValueOnce({ assistant_text: 'Here is more.' })

    const { result } = renderHook(() => useConversation())

    await act(async () => { await result.current.sendMessage('hello') })

    const assistant = [...result.current.messages].reverse().find(m => m.role === 'assistant')
    // The echoed chip label line should be stripped from assistant text
    expect(assistant!.content).not.toMatch(/what other approaches could you take\?/i)
    expect(assistant!.content.trim()).toBe('Here are your options:')
  })

  it('chip click dispatches as a user turn (not assistant message)', async () => {
    mockCallTurn.mockResolvedValueOnce({
      assistant_text: 'What would you like?',
      suggested_actions: [
        { id: 'chip-1', label: 'What other approaches could you take?', intent: 'primary', message: 'Please suggest alternative approaches in detail' },
      ],
    })
    mockCallTurn.mockResolvedValueOnce({ assistant_text: 'Here are alternatives.' })

    const { result } = renderHook(() => useConversation())

    await act(async () => { await result.current.sendMessage('hello') })

    const lastAssistant = [...result.current.messages].reverse().find(m => m.role === 'assistant')
    const chip = lastAssistant?.actionChips?.[0]
    expect(chip).toBeDefined()

    await act(async () => { await result.current.sendChip(chip!) })

    // User bubble shows the chip LABEL (not the message)
    const userMessages = result.current.messages.filter(m => m.role === 'user')
    const chipBubble = userMessages[userMessages.length - 1]
    expect(chipBubble.role).toBe('user')
    expect(chipBubble.content).toBe('What other approaches could you take?')

    // Orchestrator was called with chip.message (the actual wire message)
    const lastCallArgs = mockCallTurn.mock.calls[mockCallTurn.mock.calls.length - 1]
    expect(lastCallArgs[0].message).toBe('Please suggest alternative approaches in detail')
  })
})
