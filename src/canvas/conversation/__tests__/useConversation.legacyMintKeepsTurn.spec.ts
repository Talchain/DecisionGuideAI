/**
 * A LEGACY SCENARIO ID IS RE-MINTED MID-TURN; THE TURN MUST NOT BE WIPED BY IT (S-F, Paul 7 Oct:
 * "you can still look at your dialogue while it's loading. It shouldn't go blank").
 *
 * `sendTurn` replaces a legacy non-UUID `currentScenarioId` with a fresh UUID (guest sessions) AFTER the
 * user's bubble is on screen and the turn is pending. The scenario-switch effect read that id change as the
 * user opening another decision: it cleared `isThinking` and replaced the transcript, so the dialogue
 * blanked while the request was still in flight. A null → id mint was already treated as adoption; a
 * legacy → UUID mint started by the same turn is the same event and is now adopted the same way.
 *
 * Contrast row: a REAL switch away from a legacy id (the user opens another decision) still resets.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

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

const mockCallV5Turn = vi.fn()
vi.mock('../../../v5/v5Adapter', () => ({
  callV5Turn: (...args: unknown[]) => mockCallV5Turn(...args),
  getV5Endpoint: () => 'https://cee.test/orchestrate/v2/turn',
}))

vi.mock('../../../v5/stopTurn', () => ({
  stopV5Turn: vi.fn(),
  getV5StopEndpoint: () => 'https://cee.test/proxy/v5/turn/stop',
  STOP_ACK_BUDGET_MS: 5000,
}))

vi.mock('../../../lib/posthog', () => ({ trackEvent: vi.fn() }))

vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))

vi.mock('../../../services/scenarioService', () => ({
  loadScenario: vi.fn(async () => null),
}))

// The streamed sibling is stubbed unreachable so the send takes one
// deterministic path; the refusal under test happens before either transport.
vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()),
  openV5TurnStream: async () => {
    throw new TypeError('Failed to fetch')
  },
}))

vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isOrchestratorStreamingEnabled: () => true,
  isOrchestratorV2Enabled: () => true,
}))

import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import {
  setPersistenceSessionActive,
  __resetPersistenceSessionForTests,
} from '../../../lib/persistenceSession'


const LEGACY_ID = 'scenario-1709827200000-abc'
const OTHER_ID = '11111111-2222-4333-8444-555555555555'
const ok = (text: string) => ({
  kind: 'response' as const,
  response: { response_version: 2, assistant_text: text, blocks: [], suggested_actions: [], insights: [], stage_indicator: 'frame' },
})
const CURRENT_KEY = 'olumi-canvas-current-scenario-id'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.removeItem(CURRENT_KEY)
  useCanvasStore.getState().reset()
  __resetPersistenceSessionForTests()
  setPersistenceSessionActive(false)
})

afterEach(() => {
  __resetPersistenceSessionForTests()
})

describe('a mid-turn legacy → UUID re-mint keeps the dialogue and the pending state', () => {
  it('the user\'s message stays on screen and the turn stays pending until the reply lands', async () => {
    useCanvasStore.setState({ currentScenarioId: LEGACY_ID as any })
    let resolveTurn: (v: unknown) => void = () => {}
    mockCallV5Turn.mockImplementation(() => new Promise((r) => { resolveTurn = r }))

    const { result } = renderHook(() => useConversation())
    let sending: Promise<unknown> = Promise.resolve()
    await act(async () => {
      sending = result.current.sendMessage('should we hire a tech lead?')
      await new Promise((r) => setTimeout(r, 0))
    })

    // Precondition: the re-mint happened (otherwise this row proves nothing).
    const minted = useCanvasStore.getState().currentScenarioId
    expect(minted).not.toBe(LEGACY_ID)
    expect(mockCallV5Turn).toHaveBeenCalledTimes(1)

    expect(result.current.isThinking, 'the re-mint cleared the pending state mid-turn').toBe(true)
    expect(
      result.current.messages.some((m) => m.role === 'user' && m.content === 'should we hire a tech lead?'),
      'the re-mint blanked the dialogue mid-turn',
    ).toBe(true)

    await act(async () => {
      resolveTurn(ok('Here is a first read.'))
      await sending
    })
    expect(result.current.isThinking).toBe(false)
  })

  it('control: a REAL switch to another decision still resets the conversation (UUID start, no mint)', async () => {
    useCanvasStore.setState({ currentScenarioId: '22222222-3333-4444-8555-666666666666' })
    mockCallV5Turn.mockResolvedValue(ok('ok'))
    const { result } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage('hello') })
    expect(result.current.messages.some((m) => m.content === 'hello')).toBe(true)

    await act(async () => {
      useCanvasStore.setState({ currentScenarioId: OTHER_ID })
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current.messages.some((m) => m.content === 'hello')).toBe(false)
  })

  it('after the adopted re-mint, a later REAL switch away still resets (adoption is one-shot, bound to the minted id)', async () => {
    useCanvasStore.setState({ currentScenarioId: LEGACY_ID as any })
    mockCallV5Turn.mockResolvedValue(ok('ok'))
    const { result } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage('hello') })
    expect(result.current.messages.some((m) => m.content === 'hello'), 'precondition: the adopted mint kept the turn').toBe(true)

    await act(async () => {
      useCanvasStore.setState({ currentScenarioId: OTHER_ID })
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current.messages.some((m) => m.content === 'hello')).toBe(false)
  })
})
