/**
 * Streaming lifecycle acceptance tests
 *
 * Verifies:
 * 1. Exactly one assistant message per turn (streaming path)
 * 2. Streaming path used instead of non-streaming when flag is on
 * 3. Terminal guarantee — stuck streaming message finalised on premature close
 * 4. Error event appends to existing content (non-provisional) or replaces (provisional)
 * 5. Thrown errors reuse pre-created streaming message (no duplicate)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import { getCrossSurfaceEvents, _clearTraces } from '../../../lib/debug-state'
import type { OrchestratorStreamEvent } from '../types'

// ---------------------------------------------------------------------------
// Mocks — minimal set matching conversation-flow.spec.ts + streaming additions
// ---------------------------------------------------------------------------

const mockCallTurn = vi.fn()
const mockStreamTurn = vi.fn()

vi.mock('../turnService', () => ({
  callOrchestratorTurn: (...args: unknown[]) => mockCallTurn(...args),
  streamOrchestratorTurn: (...args: unknown[]) => mockStreamTurn(...args),
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

vi.mock('../../../flags', () => ({
  isOrchestratorV2Enabled: () => true,
  isOrchestratorStreamingEnabled: () => true,
  diagnoseOrchestratorStreaming: () => ({ resolved: true, source: 'env', localStorageRaw: null, envRaw: '1' }),
}))

const mockTrackEvent = vi.fn()
vi.mock('../../../lib/posthog', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function* fakeStream(events: OrchestratorStreamEvent[]): AsyncGenerator<OrchestratorStreamEvent> {
  for (const e of events) yield e
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers()
  mockCallTurn.mockReset()
  mockStreamTurn.mockReset()
  mockTrackEvent.mockReset()
  _clearTraces()

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
// Tests
// ---------------------------------------------------------------------------

describe('streaming lifecycle', () => {
  it('produces exactly one assistant message after turn_complete', async () => {
    const events: OrchestratorStreamEvent[] = [
      { type: 'turn_start', seq: 1, turn_id: 't-1', routing: 'llm', stage: 'ideate' },
      { type: 'text_delta', seq: 2, delta: 'Hello ' },
      { type: 'text_delta', seq: 3, delta: 'world' },
      { type: 'turn_complete', seq: 4, envelope: {
        assistant_text: 'Hello world',
        blocks: [],
      } as any },
    ]

    mockStreamTurn.mockReturnValue(fakeStream(events))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('Hi')
    })

    const assistantMsgs = result.current.messages.filter(
      (m: any) => m.role === 'assistant' && !m.synthetic,
    )
    expect(assistantMsgs).toHaveLength(1)
    expect(assistantMsgs[0].content).toBe('Hello world')
  })

  it('does not call callOrchestratorTurn when streaming flag is on', async () => {
    const events: OrchestratorStreamEvent[] = [
      { type: 'turn_start', seq: 1, turn_id: 't-1', routing: 'llm', stage: 'ideate' },
      { type: 'turn_complete', seq: 2, envelope: {
        assistant_text: 'Done',
        blocks: [],
      } as any },
    ]

    mockStreamTurn.mockReturnValue(fakeStream(events))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('Test')
    })

    expect(mockCallTurn).not.toHaveBeenCalled()
    expect(mockStreamTurn).toHaveBeenCalledTimes(1)
  })

  it('finalises stuck streaming message when stream ends without terminal event', async () => {
    // Stream yields text_delta then ends — no turn_complete, no error
    const events: OrchestratorStreamEvent[] = [
      { type: 'turn_start', seq: 1, turn_id: 't-1', routing: 'llm', stage: 'ideate' },
      { type: 'text_delta', seq: 2, delta: 'Partial response' },
    ]

    mockStreamTurn.mockReturnValue(fakeStream(events))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('Hi')
    })

    // Must have exactly one assistant message, not stuck in streaming state
    const allAssistant = result.current.messages.filter((m: any) => m.role === 'assistant')
    expect(allAssistant).toHaveLength(1)
    expect(allAssistant[0].isStreaming).toBeFalsy()
    // Should have a retry chip
    expect(allAssistant[0].actionChips?.some((c: any) => c.id === 'retry')).toBe(true)
  })

  it('finalises with fallback text when stream ends empty (no deltas)', async () => {
    const events: OrchestratorStreamEvent[] = [
      { type: 'turn_start', seq: 1, turn_id: 't-1', routing: 'llm', stage: 'ideate' },
    ]

    mockStreamTurn.mockReturnValue(fakeStream(events))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('Hi')
    })

    const allAssistant = result.current.messages.filter((m: any) => m.role === 'assistant')
    expect(allAssistant).toHaveLength(1)
    expect(allAssistant[0].isStreaming).toBeFalsy()
    expect(allAssistant[0].synthetic).toBe(true)
    expect(allAssistant[0].content).toContain('unexpectedly')
  })

  it('error event appends to existing streamed text (non-provisional)', async () => {
    // text_delta streams some content, then error arrives
    const events: OrchestratorStreamEvent[] = [
      { type: 'turn_start', seq: 1, turn_id: 't-1', routing: 'llm', stage: 'ideate' },
      { type: 'text_delta', seq: 2, delta: 'Here is some analysis' },
      { type: 'error', seq: 3, error: { code: 'INTERNAL', message: 'Server failed' }, recoverable: true },
    ]

    mockStreamTurn.mockReturnValue(fakeStream(events))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('Analyse')
    })

    const allAssistant = result.current.messages.filter((m: any) => m.role === 'assistant')
    expect(allAssistant).toHaveLength(1)
    // Content should contain BOTH the streamed text and the error
    expect(allAssistant[0].content).toContain('Here is some analysis')
    expect(allAssistant[0].content).toContain('Server failed')
    // Not synthetic since it has real streamed content
    expect(allAssistant[0].synthetic).toBe(false)
  })

  it('error event replaces content when no text was streamed (provisional)', async () => {
    const events: OrchestratorStreamEvent[] = [
      { type: 'turn_start', seq: 1, turn_id: 't-1', routing: 'llm', stage: 'ideate' },
      { type: 'tool_start', seq: 2, tool_name: 'run_analysis', long_running: true },
      { type: 'error', seq: 3, error: { code: 'TIMEOUT', message: 'Tool timed out' }, recoverable: true },
    ]

    mockStreamTurn.mockReturnValue(fakeStream(events))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('Analyse')
    })

    const allAssistant = result.current.messages.filter((m: any) => m.role === 'assistant')
    expect(allAssistant).toHaveLength(1)
    expect(allAssistant[0].content).toBe('Tool timed out')
    expect(allAssistant[0].synthetic).toBe(true)
  })

  it('thrown error reuses pre-created streaming message (no duplicate)', async () => {
    // streamOrchestratorTurn throws mid-stream
    mockStreamTurn.mockImplementation(async function* () {
      yield { type: 'turn_start', seq: 1, turn_id: 't-1', routing: 'llm', stage: 'ideate' } as OrchestratorStreamEvent
      throw new Error('Connection lost')
    })

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('Hi')
    })

    // Should have exactly one assistant message (the pre-created one, repurposed for error)
    const allAssistant = result.current.messages.filter((m: any) => m.role === 'assistant')
    expect(allAssistant).toHaveLength(1)
    expect(allAssistant[0].isStreaming).toBeFalsy()
    expect(allAssistant[0].synthetic).toBe(true)
  })

  it('explicit_generate streaming request includes generate_model: true', async () => {
    const events: OrchestratorStreamEvent[] = [
      { type: 'turn_start', seq: 1, turn_id: 't-1', routing: 'llm', stage: 'ideate' },
      { type: 'turn_complete', seq: 2, envelope: {
        assistant_text: 'Model built.',
        blocks: [],
      } as any },
    ]

    mockStreamTurn.mockReturnValue(fakeStream(events))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('Build a decision model', {
        turnType: 'explicit_generate',
      })
    })

    expect(mockStreamTurn).toHaveBeenCalledTimes(1)
    const request = mockStreamTurn.mock.calls[0][0]
    expect(request).toHaveProperty('generate_model', true)
  })

  it('emits generate_model_no_draft telemetry when explicit_generate returns no graph_patch', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const events: OrchestratorStreamEvent[] = [
      { type: 'turn_start', seq: 1, turn_id: 't-1', routing: 'llm', stage: 'ideate' },
      { type: 'turn_complete', seq: 2, envelope: {
        assistant_text: 'Tell me more about your decision.',
        blocks: [],  // no graph_patch
      } as any },
    ]

    mockStreamTurn.mockReturnValue(fakeStream(events))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('Build a decision model', {
        turnType: 'explicit_generate',
      })
    })

    // console.warn emitted
    expect(warnSpy).toHaveBeenCalledWith(
      '[sendTurn] generate_model.no_draft_returned',
      expect.objectContaining({ requestId: expect.any(String) }),
    )

    // Cross-surface telemetry event recorded
    const events2 = getCrossSurfaceEvents()
    const noDraftEvent = events2.find(e => e.eventType === 'generate_model_no_draft')
    expect(noDraftEvent).toBeDefined()
    expect(noDraftEvent!.payloadSummary).toMatchObject({
      request_id: expect.any(String),
      path: 'streaming',
    })

    warnSpy.mockRestore()
  })

  it('does NOT emit no_draft telemetry when explicit_generate returns a graph_patch', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const events: OrchestratorStreamEvent[] = [
      { type: 'turn_start', seq: 1, turn_id: 't-1', routing: 'llm', stage: 'ideate' },
      { type: 'turn_complete', seq: 2, envelope: {
        assistant_text: 'Here is your model.',
        blocks: [{ block_type: 'graph_patch', operations: [] }],
      } as any },
    ]

    mockStreamTurn.mockReturnValue(fakeStream(events))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('Build a decision model', {
        turnType: 'explicit_generate',
      })
    })

    expect(warnSpy).not.toHaveBeenCalledWith(
      '[sendTurn] generate_model.no_draft_returned',
      expect.anything(),
    )

    const noDraftEvent = getCrossSurfaceEvents().find(e => e.eventType === 'generate_model_no_draft')
    expect(noDraftEvent).toBeUndefined()

    warnSpy.mockRestore()
  })
})
