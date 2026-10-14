/**
 * UNDO SHOWS WHAT THE RESTORED MODEL NOW IMPLIES — THE CHAT LINE. RED-first.
 *
 * CEE analyses a committed restore and returns its Run turn's reply (`analysis_turn`, CEE #3044); the Undo command
 * offers its words, scenario-keyed (`restoredRunReplyStore`, pinned in `undoCommand.spec.ts`). This pins the other
 * half: the conversation shows them as ONE assistant line, VERBATIM, for the current decision — after the transcript
 * restore, never twice, never on another decision.
 *
 * Harness copied from `useConversation.reloadDifference.spec.tsx`: the mocks exist only to stop the hook reaching a
 * network path at mount.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import * as scenarios from '../../store/scenarios'
import {
  TRANSCRIPT_STORAGE_KEY,
  __resetTranscriptTombstonesForTests,
} from '../utils/transcriptStore'
import { useRestoredRunReplyStore } from '../../stores/restoredRunReplyStore'

vi.mock('../turnService', () => ({
  callOrchestratorTurn: vi.fn(),
  streamOrchestratorTurn: vi.fn(),
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
vi.mock('../../../v5/v5Adapter', () => ({
  callV5Turn: vi.fn(),
  getV5Endpoint: () => 'https://cee.test/orchestrate/v2/turn',
}))
vi.mock('../../../v5/stopTurn', () => ({
  stopV5Turn: vi.fn(() => Promise.resolve({ kind: 'not_saved' })),
  getV5StopEndpoint: () => 'https://cee.test/proxy/v5/turn/stop',
  STOP_ACK_BUDGET_MS: 5000,
}))
vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return { ...actual, isV5Eligible: () => ({ eligible: false }), isV5CanonicalRunPath: () => false }
})
vi.mock('../../../lib/posthog', () => ({ trackEvent: vi.fn() }))
vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()
  return {
    ...actual,
    openV5TurnStream: async () => {
      throw new TypeError('Failed to fetch')
    },
  }
})
vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('../../../services/scenarioService', () => ({ loadScenario: async () => null }))

const SCENARIO = '5a1e7ab0-0d04-4dd4-89db-bb6470a98fc5'
const OTHER_SCENARIO = '0b0b0b0b-1111-4222-8333-444444444444'
/** CEE's reply, with the spacing and line break it came with: shown byte for byte. */
const REPLY = 'The restored model was analysed.\nOption A now reaches the goal in 62% of runs (±8).'

function replyLines(messages: ReadonlyArray<{ id: string; content?: string; synthetic?: boolean; role?: string }>) {
  return messages.filter((m) => m.role === 'assistant' && m.id.startsWith('restored-run-'))
}

function enterScenario(id: string): void {
  scenarios.setCurrentScenarioId(id)
  useCanvasStore.setState({ currentScenarioId: id, nodes: [], edges: [] } as never)
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  __resetTranscriptTombstonesForTests()
  useRestoredRunReplyStore.getState().clear()
  enterScenario(SCENARIO)
})

describe('the restored model’s Run reply in the chat', () => {
  it('a reply offered for the CURRENT decision appears as exactly ONE assistant line, verbatim', async () => {
    const { result, rerender } = renderHook(() => useConversation())
    await act(async () => { await Promise.resolve() })

    await act(async () => {
      useRestoredRunReplyStore.getState().offer(SCENARIO, REPLY)
      await Promise.resolve()
    })
    rerender()
    await act(async () => { await Promise.resolve() })

    const lines = replyLines(result.current.messages)
    expect(lines).toHaveLength(1)
    expect(lines[0].content).toBe(REPLY)
    expect(lines[0].id).toBe(`restored-run-${useRestoredRunReplyStore.getState().id}`)
    // Synthetic ON PURPOSE: CEE already holds this turn in its durable rows, so it is never sent back as history.
    expect(lines[0].synthetic).toBe(true)
    expect(useRestoredRunReplyStore.getState().delivered).toBe(true)
  })

  it('never twice — not on re-render, not on a remount of the conversation host', async () => {
    const first = renderHook(() => useConversation())
    await act(async () => {
      useRestoredRunReplyStore.getState().offer(SCENARIO, REPLY)
      await Promise.resolve()
    })
    expect(replyLines(first.result.current.messages)).toHaveLength(1)
    first.rerender()
    expect(replyLines(first.result.current.messages)).toHaveLength(1)
    first.unmount()

    const second = renderHook(() => useConversation())
    await act(async () => { await Promise.resolve() })
    expect(replyLines(second.result.current.messages)).toHaveLength(0)
  })

  it('a SECOND Undo’s reply is a new line (a new id starts undelivered)', async () => {
    const { result } = renderHook(() => useConversation())
    await act(async () => {
      useRestoredRunReplyStore.getState().offer(SCENARIO, REPLY)
      await Promise.resolve()
    })
    await act(async () => {
      useRestoredRunReplyStore.getState().offer(SCENARIO, 'The model was analysed again.')
      await Promise.resolve()
    })
    expect(replyLines(result.current.messages).map((m) => m.content)).toEqual([REPLY, 'The model was analysed again.'])
  })

  it('CONTROL: a reply for ANOTHER decision never appears here', async () => {
    const { result } = renderHook(() => useConversation())
    await act(async () => {
      useRestoredRunReplyStore.getState().offer(OTHER_SCENARIO, REPLY)
      await Promise.resolve()
    })
    expect(replyLines(result.current.messages)).toHaveLength(0)
    expect(result.current.messages.some((m) => m.content === REPLY)).toBe(false)
  })

  it('ORDERING: a reply already offered at mount lands AFTER the restored transcript, once', async () => {
    localStorage.setItem(
      TRANSCRIPT_STORAGE_KEY,
      JSON.stringify({
        [SCENARIO]: {
          savedAt: new Date().toISOString(),
          pageLoadId: 'a-previous-page-load',
          dropped: 0,
          messages: [
            { id: 'm1', role: 'user', content: 'Should we raise prices?', ts: new Date().toISOString() },
            { id: 'm2', role: 'assistant', content: 'Here is a first read.', ts: new Date().toISOString() },
          ],
        },
      }),
    )
    useRestoredRunReplyStore.getState().offer(SCENARIO, REPLY)

    const { result } = renderHook(() => useConversation())
    await act(async () => { await Promise.resolve() })

    const ids = result.current.messages.map((m) => m.id)
    expect(ids, 'the restored transcript must not be skipped because the reply got there first').toContain('m1')
    expect(ids).toContain('m2')
    expect(replyLines(result.current.messages)).toHaveLength(1)
    const messages = result.current.messages
    expect(messages[messages.length - 1].content).toBe(REPLY)
  })
})
