/**
 * ⭐ THE CHAT SURVIVES A RELOAD — the panel's half (AIQ rows 5907300125; MG contract 5907618888).
 *
 * The cold read resolves AFTER the mount restore, so the stored chat arrives as an OFFER (`serverConversationTurnsStore`).
 * The panel takes it only when it is EMPTY, for the scenario ON SCREEN, and when this browser holds NO transcript of its
 * own (the local thread — chips and all — is the first choice). Mock preamble copied from
 * `useConversation.resetTranscript.spec.tsx` (it stops the hook reaching a network path at mount).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import * as scenarios from '../../store/scenarios'
import { TRANSCRIPT_STORAGE_KEY, __resetTranscriptTombstonesForTests } from '../utils/transcriptStore'
import { useServerConversationTurnsStore } from '../../stores/serverConversationTurnsStore'
import {
  readServerConversationTurns,
  RESTORED_HISTORY_DIVIDER,
  RESTORED_STALE_FIGURES_NOTE,
} from '../serverConversationTurns'

// This spec never sends a turn — it drives mount-restore and `resetCanvas` only.
// The mocks below exist solely to stop the hook reaching a network path at mount;
// the two spies are declared here rather than inherited from the sibling spec the
// preamble was adapted from (which is how `mockCallTurn` arrived undeclared).
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

// Mock V5 adapter so callV5Turn never resolves (mirrors mockCallTurn's hang pattern).
// Without this, VITE_ENABLE_V5_ORCHESTRATOR=true causes the V5 path to make
// a real fetch(/bff/orchestrate/v2/turn) which fails fast, sets isThinking=false
// in the finally block, and breaks timeout-progression tests.
const mockCallV5Turn = vi.fn()

vi.mock('../../../v5/v5Adapter', () => ({
  callV5Turn: (...args: unknown[]) => mockCallV5Turn(...args),
  // getV5Endpoint is called unconditionally in bindRequestToInteraction on
  // every V5 send path (useConversation.ts ~L2967); an incomplete mock
  // leaves it undefined and throws "getV5Endpoint is not a function" —
  // same pattern fixed in the sibling useConversation.reasoning.spec.ts
  // (5bc479cf).
  getV5Endpoint: () => 'https://cee.test/orchestrate/v2/turn',
}))

// Stop-fence (Codex P0): the server-visible explicit Stop. Mocked here so the
// notice-copy assertions below drive off the OUTCOME rather than a live fetch —
// which is the whole point of the three-state answer.
type StopFenceResult = {
  kind: 'not_saved' | 'already_saved' | 'unconfirmed'
  reason?: string
}
const mockStopV5Turn = vi.fn(
  (..._args: unknown[]): Promise<StopFenceResult> => Promise.resolve({ kind: 'not_saved' }),
)
vi.mock('../../../v5/stopTurn', () => ({
  stopV5Turn: (...args: unknown[]) => mockStopV5Turn(...args),
  getV5StopEndpoint: () => 'https://cee.test/proxy/v5/turn/stop',
  STOP_ACK_BUDGET_MS: 5000,
}))

// Mock V5 eligibility so the V5-specific describe blocks below (which
// exercise the V5 sendTurn branch) don't silently depend on the developer's
// untracked .env.local setting VITE_ENABLE_V5_ORCHESTRATOR=true — on a clean
// checkout isV5Eligible() resolves to false, sendMessage never enters the V5
// branch, and mockCallV5Turn/mockLoadScenario are never invoked (same root
// cause diagnosed + fixed for useConversation.reasoning.spec.ts in 5bc479cf).
// Defaults to false (V4 path) so the many V4-oriented blocks above are
// unaffected; the V5-only blocks below flip it on for their scope.
const mockIsV5Eligible = vi.fn<[{ flag: string | undefined }], { eligible: boolean; reason?: string }>()

vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  const flags = await import('../../../flags')
  return {
    ...actual,
    isV5Eligible: (...args: unknown[]) => mockIsV5Eligible(...(args as [{ flag: string | undefined }])),
    isV5CanonicalRunPath: () =>
      flags.isV5CanonicalAnalysisEnabled() &&
      mockIsV5Eligible({ flag: import.meta.env.VITE_ENABLE_V5_ORCHESTRATOR }).eligible,
  }
})

// 1.16i: telemetry sink for the run-click swallow guard.
const mockTrackEvent = vi.fn()
vi.mock('../../../lib/posthog', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}))

// Mock Supabase getUserId: vi.fn() so tests can reconfigure per-scenario.
// Default: null (no auth session in test environment).
const mockGetUserId = vi.fn<[], Promise<string | null>>()

// Login 3.4: token knob for the getSessionIdentity bridge — tests that
// exercise the Bearer path set .value; everything else runs token-less.
const mockAccessToken = { value: null as string | null }

// ROADMAP 2.122 — `sendMessage` on an EMPTY canvas is now dispatched to the
// STREAMED turn sibling first (`<endpoint>/stream`, CEE #751), with a
// transparent fallback to the buffered turn on any stream failure.
//
// This spec's subject is the BUFFERED chain, so the streamed sibling is stubbed
// unreachable — which is not an artificial construction: it is exactly the state
// of a deployment where the streamed route is absent or refusing, and the
// fallback it triggers is the behaviour under test elsewhere
// (`streamedDraftTurn.spec.ts`). With the sibling unreachable the buffered path
// runs exactly once, which is what this spec's request-count pins measure.
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
  getUserId: (...args: unknown[]) => mockGetUserId(...args as []),
  // Login 3.4: useConversation resolves identity via getSessionIdentity
  // (userId + access token in one getSession call). Backed by the same
  // mock so each test's userId intent carries over.
  getSessionIdentity: async () => ({
    userId: (await mockGetUserId()) ?? null,
    accessToken: mockAccessToken.value,
  }),
}))

// Mock scenarioService loadScenario: vi.fn() so tests can return graph data.
// Default: null (no DB in test environment).
const mockLoadScenario = vi.fn<[string], Promise<unknown>>()

vi.mock('../../../services/scenarioService', () => ({
  loadScenario: (...args: unknown[]) => mockLoadScenario(...args as [string]),
}))

// Pin both flags ON:
//   - isOrchestratorStreamingEnabled: the buildRequest payload block asserts
//     against mockStreamTurn (streaming path). Without this, the flag

const SCENARIO = '77777777-8888-9999-aaaa-bbbbbbbbbbbb'
const OTHER = '66666666-8888-9999-aaaa-bbbbbbbbbbbb'

const TURNS = readServerConversationTurns([
  { turn_id: 't1', created_at: '2026-09-30T05:40:00Z', user_message: 'Should we raise the price?', assistant_message: 'I have drafted the model on the canvas.' },
  { turn_id: 't2', created_at: '2026-09-30T05:42:00Z', user_message: 'How often does £57 reach the target?', assistant_message: 'The £57 option reaches the target in about 24.7% of model runs.' },
])!

function offer(scenarioId: string, runNotCurrent = false) {
  useServerConversationTurnsStore.getState().offerServerConversationTurns({
    scenarioId, turns: TURNS, run: { runNotCurrent, currentRunComputedAt: '2026-09-30T05:41:00Z' },
  })
}

describe('the chat survives a reload in a browser that never saw it', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    __resetTranscriptTombstonesForTests()
    useServerConversationTurnsStore.setState({ offer: null })
    scenarios.setCurrentScenarioId(SCENARIO)
    useCanvasStore.setState({ nodes: [], edges: [], currentScenarioId: SCENARIO })
  })

  it('RED: an empty panel with no local transcript takes the stored chat — one divider, the turns in order, text only; the offer is spent', async () => {
    const { result } = renderHook(() => useConversation())
    await act(async () => { await Promise.resolve() })
    expect(result.current.messages.length, 'precondition: the panel is empty').toBe(0)
    await act(async () => { offer(SCENARIO); await Promise.resolve() })
    const m = result.current.messages
    expect(m[0].sessionDivider).toBe(RESTORED_HISTORY_DIVIDER)
    expect(m.slice(1).map((x) => [x.role, x.content])).toEqual([
      ['user', 'Should we raise the price?'],
      ['assistant', 'I have drafted the model on the canvas.'],
      ['user', 'How often does £57 reach the target?'],
      ['assistant', 'The £57 option reaches the target in about 24.7% of model runs.'],
    ])
    expect(m.every((x) => x.actionChips === undefined && x.blocks === undefined)).toBe(true)
    expect(useServerConversationTurnsStore.getState().offer).toBeNull()
  })

  it('the read says the Run is not current → the figure reply carries AIQ’s stale line', async () => {
    const { result } = renderHook(() => useConversation())
    await act(async () => { offer(SCENARIO, true); await Promise.resolve() })
    const figureReply = result.current.messages.find((x) => x.id === 'restored-assistant-t2')
    expect(figureReply?.content).toContain(RESTORED_STALE_FIGURES_NOTE)
  })

  it('CONTROL: a local transcript from an earlier page load wins — the stored chat is not added over it', async () => {
    localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify({
      [SCENARIO]: { savedAt: new Date().toISOString(), pageLoadId: 'a-previous-page-load', dropped: 0,
        messages: [{ id: 'm1', role: 'user', content: 'The thread this browser saw', ts: new Date().toISOString() }] },
    }))
    const { result } = renderHook(() => useConversation())
    await act(async () => { await Promise.resolve() })
    await act(async () => { offer(SCENARIO); await Promise.resolve() })
    expect(result.current.messages.some((x) => x.content === 'The thread this browser saw')).toBe(true)
    expect(result.current.messages.some((x) => x.sessionDivider === RESTORED_HISTORY_DIVIDER)).toBe(false)
  })

  it('CONTROL: an offer for another scenario is not taken, and stays unspent', async () => {
    const { result } = renderHook(() => useConversation())
    await act(async () => { offer(OTHER); await Promise.resolve() })
    expect(result.current.messages.length).toBe(0)
    expect(useServerConversationTurnsStore.getState().offer?.scenarioId).toBe(OTHER)
  })
})
