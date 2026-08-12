/**
 * RUNTIME WITNESS — does `resetCanvas`'s transcript clear actually survive the
 * commit it happens on?
 *
 * ⚠ WHY THIS EXISTS AS A MOUNTED TEST. `resetCanvasClearsPersisted.spec.ts`
 * proves `clearTranscript` is CALLED and that the key is gone immediately after.
 * It mounts no component, so it is structurally incapable of seeing what happens
 * on the SAME React commit — and the review's derivation says something does:
 *
 *   `useConversation.ts:2712` (persist, deps `[messages, scenarioId]`) is
 *   declared BEFORE `:2721` (scenario switch). `resetCanvas` sets
 *   `currentScenarioId: null`, so on that commit the persist effect runs first,
 *   while `messagesOwnerRef.current` is still the OLD id and `messages` is still
 *   non-empty — and `saveTranscript(owner, messages)` writes back exactly what
 *   `clearTranscript` just deleted.
 *
 * A derivation is not a measurement, and the whole point of item 4c is that the
 * clear is real rather than nominal. So this drives the real hook and reads
 * `localStorage` after React has settled.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import * as scenarios from '../../store/scenarios'
import {
  TRANSCRIPT_STORAGE_KEY,
  saveTranscript,
  clearTranscript,
  releaseTranscriptTombstone,
  __resetTranscriptTombstonesForTests,
} from '../utils/transcriptStore'

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

const transcriptFile = (): Record<string, unknown> => {
  const raw = localStorage.getItem(TRANSCRIPT_STORAGE_KEY)
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
}

describe('resetCanvas — the transcript clear must survive its own commit', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    __resetTranscriptTombstonesForTests()
    useCanvasStore.setState({ nodes: [], edges: [] })
  })

  it('does not write the cleared transcript straight back on the reset commit', async () => {
    // ⚠ BOTH PRECONDITIONS ARE NON-OBVIOUS AND THE FIRST DRAFT OF THIS TEST GOT
    // THEM WRONG — it restored 0 messages and would have reported a clean pass
    // for a race it never set up. They are pinned below rather than assumed.
    //
    //  1. The hook reads `useCanvasStore(s => s.currentScenarioId)`, NOT
    //     `scenarios.getCurrentScenarioId()`. Setting only the module-level id
    //     leaves the hook with `scenarioId == null` and no restore at all.
    //  2. The mount restore fires only when `restored.fromPreviousSession` —
    //     i.e. the stored `pageLoadId` differs from this page load's. A
    //     transcript written by `saveTranscript` in-test carries the CURRENT id,
    //     so it is correctly ignored. The entry is therefore written directly,
    //     with a foreign `pageLoadId`, which is exactly the reload shape.
    scenarios.setCurrentScenarioId(SCENARIO)
    useCanvasStore.setState({ currentScenarioId: SCENARIO })
    localStorage.setItem(
      TRANSCRIPT_STORAGE_KEY,
      JSON.stringify({
        [SCENARIO]: {
          savedAt: new Date().toISOString(),
          pageLoadId: 'a-previous-page-load',
          dropped: 0,
          messages: [
            // `ts` is REQUIRED by `isStoredMessage`; without it every message is
            // filtered out, `loadTranscript` returns null for an empty list, and
            // the restore silently no-ops. That was the third distinct way this
            // fixture managed to set up nothing — all three caught by the
            // precondition assertion below, none of them by a failing expectation.
            { id: 'm1', role: 'user', content: 'Should we replace our CRM?', ts: new Date().toISOString() },
            { id: 'm2', role: 'assistant', content: 'Here is a first read.', ts: new Date().toISOString() },
          ],
        },
      }),
    )

    // Pin the precondition IN-TEST — without a transcript on disk and messages
    // in the hook, this measures nothing (trap 13b).
    expect(Object.keys(transcriptFile()), 'precondition: a transcript exists for this decision').toContain(SCENARIO)

    const { result } = renderHook(() => useConversation())
    await act(async () => { await Promise.resolve() })

    expect(
      result.current.messages.length,
      'precondition: the hook must have restored the transcript, or the persist effect it races has nothing to write',
    ).toBeGreaterThan(0)

    // Put the canvas in the state a reset is reached from, then reset for real.
    useCanvasStore.setState({
      nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Previous' } }] as never,
      edges: [],
    })
    await act(async () => {
      useCanvasStore.getState().resetCanvas()
      await Promise.resolve()
    })

    expect(
      Object.keys(transcriptFile()),
      'the transcript was deleted and then written straight back on the same commit: the persist effect is declared ' +
        'before the scenario-switch effect, so it runs first with the OLD owner and the OLD messages still in hand',
    ).not.toContain(SCENARIO)
  })

  it('CONTROL — a decision the user genuinely re-enters persists normally again', () => {
    // The discriminating twin. The tombstone's own failure mode is being
    // PERMANENT: a fix that simply refused to ever write again would satisfy the
    // case above while silently breaking every decision the user resets and then
    // re-opens from the scenario switcher.
    clearTranscript(SCENARIO)
    expect(
      saveTranscript(SCENARIO, [
        { id: 'x', role: 'user', content: 'written while forgotten' },
      ] as never),
      'precondition: a forgotten decision must refuse the write, or this control proves nothing',
    ).toBeNull()

    releaseTranscriptTombstone(SCENARIO) // what the scenario-switch effect does on re-entry

    saveTranscript(SCENARIO, [
      { id: 'y', role: 'user', content: 'written after genuine re-entry' },
    ] as never)
    expect(
      Object.keys(transcriptFile()),
      'the tombstone was permanent: re-opening a reset decision would never persist its conversation again',
    ).toContain(SCENARIO)
  })
})
