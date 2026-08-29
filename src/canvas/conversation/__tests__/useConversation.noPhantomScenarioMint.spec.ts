/**
 * A SIGNED-IN USER MUST NOT SILENTLY ACQUIRE A DECISION THEY DID NOT CREATE.
 *
 * `sendTurn` lazily allocates a scenario UUID whenever the store holds none (or
 * a legacy non-UUID). For a GUEST that is correct and load-bearing: their work
 * is local, there is no decision list to open from, and the id is what ties
 * their turns together across a refresh.
 *
 * For a PERSISTED (signed-in) session it manufactures a decision. Any route to
 * `currentScenarioId === null` — deleting the active scenario is one — makes
 * the next Send mint a fresh UUID, and CEE's own rule ("scenario absent and no
 * admitted turn → CREATE") then legitimately creates that row. The user ends up
 * with a phantom second decision, and the decision they were working in is not
 * the one they are now talking to. Nothing in the product tells them.
 *
 * A signed-in user always has a real route to a real scenario (the Decisions
 * page), so refusing costs them nothing while inventing one costs them their
 * place.
 *
 * ── BINDING ─────────────────────────────────────────────────────────────────
 * The guest twin is the discriminating half: it asserts the mint STILL HAPPENS
 * for the session it is correct for. A guard that simply never minted would
 * pass every refusal test here and break the guest path entirely.
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

import { useConversation, NO_SCENARIO_OPEN_NOTICE } from '../useConversation'
import { useCanvasStore } from '../../store'
import {
  setPersistenceSessionActive,
  __resetPersistenceSessionForTests,
} from '../../../lib/persistenceSession'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CURRENT_KEY = 'olumi-canvas-current-scenario-id'

/** No decision open — the state every route to the phantom mint passes through. */
function noScenarioOpen(isPersistenceActive: boolean) {
  localStorage.removeItem(CURRENT_KEY)
  useCanvasStore.setState({ currentScenarioId: null })
  setPersistenceSessionActive(isPersistenceActive)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCallTurn.mockResolvedValue({ assistant_text: 'ok', blocks: [] })
  mockCallV5Turn.mockResolvedValue({ assistant_text: 'ok', blocks: [] })
  localStorage.removeItem(CURRENT_KEY)
  useCanvasStore.getState().reset()
  // Module state outlives the component tree — reset it or a persisted case
  // leaks into every later test in this file.
  __resetPersistenceSessionForTests()
})

afterEach(() => {
  __resetPersistenceSessionForTests()
})

describe('persisted session: a send with no decision open does not invent one', () => {
  it('does not mint a scenario id', async () => {
    noScenarioOpen(true)
    // Precondition — genuinely no id, so the assertion below cannot pass
    // against a state that was never the mint's trigger.
    expect(useCanvasStore.getState().currentScenarioId).toBeNull()

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('what should we do about pricing?')
    })

    // Bound EXACTLY: still null, not merely "not a new UUID".
    expect(useCanvasStore.getState().currentScenarioId).toBeNull()
    expect(localStorage.getItem(CURRENT_KEY)).toBeNull()
  })

  it('tells the user what to do instead of failing silently', async () => {
    noScenarioOpen(true)

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('what should we do about pricing?')
    })

    // Asserts the SHIPPED constant, not a restatement of the copy.
    const notice = result.current.messages.find(m => m.content === NO_SCENARIO_OPEN_NOTICE)
    expect(notice).toBeDefined()
    expect(notice?.role).toBe('assistant')
  })

  it('does not dispatch the turn at all', async () => {
    // The substantive claim: the send did not go. Asserted on the TRANSPORTS,
    // because that is what discriminates — an earlier version of this test
    // checked the user bubble's deliveryState, which reads 'failed' whether the
    // guard fired or the mocked transport merely failed downstream. It passed
    // under the "guard removed" mutant, i.e. it was agreeing with itself
    // (CLAUDE.md trap 13b) and was evidence about nothing.
    noScenarioOpen(true)

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('what should we do about pricing?')
    })

    expect(mockCallV5Turn).not.toHaveBeenCalled()
    expect(mockStreamTurn).not.toHaveBeenCalled()
    expect(mockCallTurn).not.toHaveBeenCalled()

    // And the user's own bubble does not sit in the transcript looking
    // delivered. Secondary to the assertions above, never a substitute.
    const userBubble = result.current.messages.find(m => m.role === 'user')
    expect(userBubble?.deliveryState).toBe('failed')
  })
})

describe('guest session: the lazy mint still works', () => {
  it('mints a UUID and keeps it, exactly as before', async () => {
    // The discriminating twin. A guard that never minted would pass every test
    // above while breaking the session the mint exists for.
    noScenarioOpen(false)

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('what should we do about pricing?')
    })

    const minted = useCanvasStore.getState().currentScenarioId
    expect(minted).not.toBeNull()
    expect(UUID_RE.test(minted!)).toBe(true)
    // Persisted for the next turn / a refresh, as the guest path requires.
    expect(localStorage.getItem(CURRENT_KEY)).toBe(minted)
  })

  it('does not show the persisted-session notice', async () => {
    noScenarioOpen(false)

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('what should we do about pricing?')
    })

    expect(
      result.current.messages.some(m => m.content === NO_SCENARIO_OPEN_NOTICE),
    ).toBe(false)
  })
})

describe('persisted session WITH a decision open is untouched', () => {
  it('keeps the open decision’s id and sends normally', async () => {
    // The guard fires only on the mint path. A session that HAS a scenario must
    // be unaffected — bound by that scenario's own id.
    const OPEN_ID = 'cccccccc-3333-4333-8333-cccccccccccc'
    useCanvasStore.setState({ currentScenarioId: OPEN_ID })
    setPersistenceSessionActive(true)

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('what should we do about pricing?')
    })

    expect(useCanvasStore.getState().currentScenarioId).toBe(OPEN_ID)
    expect(
      result.current.messages.some(m => m.content === NO_SCENARIO_OPEN_NOTICE),
    ).toBe(false)
  })
})
