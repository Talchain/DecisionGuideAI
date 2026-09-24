/**
 * ⭐ ONE ANALYSIS CARD PER RUN — an unrelated turn that re-sends the same fresh
 * result does not re-surface it in the transcript (RC #63 5803875794;
 * emergency directive 5803995225, Canvas: "Do not repeat analysis cards after
 * unrelated chat turns").
 *
 * Driven through the REAL send chain (useConversation → V5 adapter → parser →
 * mapV5Blocks → addMessage) with only `fetch` stubbed, using the harness of
 * `useConversation.v5ErrorRecovery.spec.ts`. CEE's lifecycle branch re-emits
 * the prior `analysis_result` byte-for-byte on a fresh non-run turn.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'

// ---------------------------------------------------------------------------
// Mocks — seams only; the V5 adapter/parser/router chain stays REAL.
// ---------------------------------------------------------------------------

// V4 transport must never be touched by these tests.
const mockCallTurn = vi.fn()
vi.mock('../turnService', () => ({
  callOrchestratorTurn: (...args: unknown[]) => mockCallTurn(...args),
  streamOrchestratorTurn: (...args: unknown[]) => mockCallTurn(...args),
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
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))

vi.mock('../../../services/scenarioService', () => ({
  loadScenario: async () => null,
  storeAnalysis: async () => undefined,
}))

vi.mock('../../../lib/posthog', () => ({
  trackEvent: () => undefined,
}))

// Eligibility ON so sendMessage enters the V5 exclusive branch regardless of
// the developer's env (same pattern as useConversation.hook.spec.ts).
vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return {
    ...actual,
    isV5Eligible: () => ({ eligible: true }),
    isV5CanonicalRunPath: () => false,
  }
})

// ---------------------------------------------------------------------------
// Wire fixtures + fetch stub
// ---------------------------------------------------------------------------


const ANALYSIS = {
  type: 'analysis_result',
  summary: 'Hybrid pricing leads on MRR in this model.',
  leading_option_id: 'opt_hybrid',
  win_probabilities: { opt_hybrid: 0.81, opt_seats: 0.17, opt_usage: 0.02 },
}
const DIFFERENT = { ...ANALYSIS, summary: 'A new run.', win_probabilities: { opt_hybrid: 0.6, opt_seats: 0.3, opt_usage: 0.1 } }

const response = (text: string, blocks: unknown[]) => ({
  response_version: 2, assistant_text: text, blocks, suggested_actions: [], insights: [], stage_indicator: 'analyse',
})

function stubFetchSequence(bodies: unknown[]) {
  let i = 0
  const fetchStub = vi.fn(async () => {
    const body = bodies[Math.min(i++, bodies.length - 1)]
    return {
      ok: true, status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response
  })
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

const analysisCards = (messages: Array<{ role: string; blocks?: Array<{ type: string }> }>) =>
  messages.filter(m => m.role === 'assistant').map(m => (m.blocks ?? []).filter(b => b.type === 'v5_analysis_result').length)

beforeEach(() => {
  useCanvasStore.setState({
    currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
    // A non-empty canvas: these are ordinary (buffered) turns, not a first draft.
    nodes: [{ id: 'opt_hybrid', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Hybrid' } }],
    edges: [],
    results: { status: 'idle' } as never,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('the transcript shows one analysis card per run', () => {
  it('a run, then an ideation turn re-sending the SAME result: the second turn shows NO card (its text still shows)', async () => {
    stubFetchSequence([
      response('Analysis complete.', [ANALYSIS]),
      response('Here is an idea: grandfather existing customers.', [ANALYSIS]),
    ])
    const { result } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage('Run the analysis', { turnType: 'run_analysis' }) })
    await act(async () => { await result.current.sendMessage('What else could we try?') })
    const assistant = result.current.messages.filter(m => m.role === 'assistant')
    expect(assistant).toHaveLength(2)
    expect(analysisCards(result.current.messages as never)).toEqual([1, 0])
    expect(assistant[1].content).toContain('grandfather')
  })

  it('CONTRAST — an explicit RUN that returns the same numbers still shows its card', async () => {
    stubFetchSequence([response('Analysis complete.', [ANALYSIS]), response('Analysis complete again.', [ANALYSIS])])
    const { result } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage('Run the analysis', { turnType: 'run_analysis' }) })
    await act(async () => { await result.current.sendMessage('Run it again', { turnType: 'run_analysis' }) })
    expect(analysisCards(result.current.messages as never)).toEqual([1, 1])
  })

  it('CONTRAST — a non-run turn carrying a DIFFERENT result shows it (new information)', async () => {
    stubFetchSequence([response('Analysis complete.', [ANALYSIS]), response('Updated.', [DIFFERENT])])
    const { result } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage('Run the analysis', { turnType: 'run_analysis' }) })
    await act(async () => { await result.current.sendMessage('And now?') })
    expect(analysisCards(result.current.messages as never)).toEqual([1, 1])
  })
})
