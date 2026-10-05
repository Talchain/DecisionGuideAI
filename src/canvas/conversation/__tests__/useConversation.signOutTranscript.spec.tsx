/**
 * IDENTITY BOUNDARY: A's conversation must not survive the sign-out sweep for B.
 *
 * Measured on J1 (run 37329013928, ISO-1): after A signed out and B signed in, `olumi-canvas-transcript` still held
 * 15,101 bytes carrying A's brief. The key IS in `USER_SCOPED_STORAGE_KEYS`, so the sweep removed it, and the
 * mounted conversation wrote it straight back: `clearUserScopedState` runs `resetCanvas` (scenario -> null), and
 * `useConversation`'s persist effect, declared before the scenario-switch effect, re-saves the OLD owner's messages on
 * that commit (the race `useConversation.resetTranscript.spec.tsx` measured for a single-decision reset).
 *
 * This drives the real hook through the real sweep and reads `localStorage` after React has settled. The mocks are
 * copied from that sibling spec: they only stop the hook reaching a network path at mount.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import * as scenarios from '../../store/scenarios'
import { TRANSCRIPT_STORAGE_KEY, __resetTranscriptTombstonesForTests } from '../utils/transcriptStore'
import { clearUserScopedState } from '../../../lib/auth/userScopedState'


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

const SCENARIO_A = '77777777-8888-9999-aaaa-bbbbbbbbbbbb'
const SCENARIO_B = '11111111-2222-4333-8444-555555555555'
const A_BRIEF = "A's private brief: should we replace our CRM before the Q3 board?"

const transcriptFile = (): Record<string, { pageLoadId?: string; messages?: Array<{ content?: string }> }> => {
  const raw = localStorage.getItem(TRANSCRIPT_STORAGE_KEY)
  return raw ? (JSON.parse(raw) as Record<string, { pageLoadId?: string; messages?: Array<{ content?: string }> }>) : {}
}

/** A transcript left by an EARLIER page load: the shape the mount restore takes (see the sibling spec's preconditions). */
const writePreviousPageTranscript = (scenarioId: string, pageLoadId: string, firstUserLine: string): void => {
  const file = transcriptFile()
  file[scenarioId] = {
    savedAt: new Date().toISOString(),
    pageLoadId,
    dropped: 0,
    messages: [
      { id: `${scenarioId}-m1`, role: 'user', content: firstUserLine, ts: new Date().toISOString() },
      { id: `${scenarioId}-m2`, role: 'assistant', content: 'Here is a first read.', ts: new Date().toISOString() },
    ],
  } as never
  localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(file))
}

describe('sign-out sweep: the previous account\'s conversation stays gone', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    __resetTranscriptTombstonesForTests()
    useCanvasStore.setState({ nodes: [], edges: [], currentScenarioId: null })
  })

  // `resetCanvas` tombstones the transcript of an UNSAVED decision itself, so the race needs a SAVED one: a local
  // record, or a server graph (F1, `store.leavingDecisionIsSaved`). The server-graph shape is every signed-in V5
  // decision, and J1 ISO-1's. The unsaved row covers the third path through `resetCanvas`; it held before this fix.
  it.each([
    ['a server graph (signed-in V5, J1 ISO-1)', () => useCanvasStore.setState({ lastServerGraphHash: 'v5:a-server-graph' })],
    ['a local saved record', () => { scenarios.createScenario({ id: SCENARIO_A, name: "A's decision", nodes: [], edges: [] }) }],
    ['no saved record (resetCanvas tombstones it itself)', () => {}],
  ] as const)("does not write A's transcript back after clearUserScopedState: decision saved as %s", async (_label, makeSaved) => {
    scenarios.setCurrentScenarioId(SCENARIO_A)
    useCanvasStore.setState({ currentScenarioId: SCENARIO_A })
    writePreviousPageTranscript(SCENARIO_A, 'a-previous-page-load', A_BRIEF)

    const { result } = renderHook(() => useConversation())
    await act(async () => { await Promise.resolve() })
    // Precondition: A's words are in the hook, or the persist effect has nothing to race with.
    expect(result.current.messages.map(m => m.content), 'precondition: A\'s transcript was restored').toContain(A_BRIEF)
    makeSaved()

    await act(async () => {
      clearUserScopedState()
      await Promise.resolve()
    })

    expect(
      localStorage.getItem(TRANSCRIPT_STORAGE_KEY) ?? '',
      "A's brief is on disk after the sweep: the persist effect re-saved the old owner's messages for the next account",
    ).not.toContain(A_BRIEF)
  })

  // Codex #2523 r1: the file is not the whole fence. A conversation still mounted may have no entry on disk, because
  // `saveTranscript` removes the key when even one message does not fit, and the sweep then frees the quota.
  it("does not write A's conversation back when it is on screen but not on disk at the sweep", async () => {
    scenarios.setCurrentScenarioId(SCENARIO_A)
    useCanvasStore.setState({ currentScenarioId: SCENARIO_A })
    writePreviousPageTranscript(SCENARIO_A, 'a-previous-page-load', A_BRIEF)
    const { result } = renderHook(() => useConversation())
    await act(async () => { await Promise.resolve() })
    expect(result.current.messages.map(m => m.content), 'precondition: A\'s transcript was restored').toContain(A_BRIEF)
    useCanvasStore.setState({ lastServerGraphHash: 'v5:a-server-graph' })
    localStorage.removeItem(TRANSCRIPT_STORAGE_KEY)
    expect(localStorage.getItem(TRANSCRIPT_STORAGE_KEY), 'precondition: A\'s words are on screen only').toBeNull()

    await act(async () => {
      clearUserScopedState()
      await Promise.resolve()
    })

    expect(
      localStorage.getItem(TRANSCRIPT_STORAGE_KEY) ?? '',
      "A's brief is on disk after the sweep: a live owner with no entry on disk was not fenced",
    ).not.toContain(A_BRIEF)
  })

  it("CONTROL: B's own conversation, opened after the sweep in the same page, is restored and saved again", async () => {
    scenarios.setCurrentScenarioId(SCENARIO_A)
    useCanvasStore.setState({ currentScenarioId: SCENARIO_A })
    writePreviousPageTranscript(SCENARIO_A, 'a-previous-page-load', A_BRIEF)
    const { result } = renderHook(() => useConversation())
    await act(async () => { await Promise.resolve() })
    expect(result.current.messages.map(m => m.content), 'precondition: A\'s transcript was restored').toContain(A_BRIEF)
    await act(async () => {
      clearUserScopedState()
      await Promise.resolve()
    })

    // B signs in and opens B's own decision, whose transcript an earlier page load of B's left on disk.
    writePreviousPageTranscript(SCENARIO_B, 'b-previous-page-load', "B's own question")
    await act(async () => {
      scenarios.setCurrentScenarioId(SCENARIO_B)
      useCanvasStore.setState({ currentScenarioId: SCENARIO_B })
      await Promise.resolve()
    })
    expect(result.current.messages.map(m => m.content), 'B\'s own transcript was not restored after the sweep').toContain("B's own question")
    expect(result.current.messages.map(m => m.content), 'A\'s words are in B\'s conversation').not.toContain(A_BRIEF)

    // B's conversation is written again by THIS page load: the save path is live for B (the tombstone is not a
    // blanket stop on every write after a sweep).
    expect(transcriptFile()[SCENARIO_B]?.pageLoadId, 'B\'s conversation was never re-saved after the sweep')
      .not.toBe('b-previous-page-load')
    expect(transcriptFile()[SCENARIO_B]?.messages?.map(m => m.content)).toContain("B's own question")
    expect(Object.keys(transcriptFile()), 'A\'s decision is back on disk').not.toContain(SCENARIO_A)
  })
})
