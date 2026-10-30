/**
 * ⭐ B UI (SYS1 lever 2) — A LOST STREAM IS RECOVERED FROM THE SAVED MODEL, NOT BY RE-SENDING THE BRIEF.
 *
 * Served capacity 001307 (UI c5310483 / CEE c87608e4, 12 Oct, scenario 14b66c8e…, turn c7f8a31b…):
 *   - the browser took 299 bytes of the stream (DRAFTING + BRIEF_READ), then nothing, while CEE ran the brief to the end
 *     and saved the 13-node model;
 *   - after 30 s of silence the UI re-sent the whole brief as a buffered turn, a POST that never reached CEE;
 *   - then ONE 8 s recovery read gave up at 00:43:04Z (`draft_recovery.stream_loss_readback notRecovered`), and CEE
 *     answered that read 200 with the saved model at 00:43:08Z. The user was told delivery could not be confirmed.
 *
 * Contract: a stream lost to silence or a dropped socket reads the saved model first; a read that gets NO answer is
 * read once more (`STREAM_LOSS_READ`: 2 attempts, 1 s apart, the adapter's real 8 s deadline); a model that landed is
 * shown and nothing is re-sent. A confirmed non-send (nothing dispatched) is never read back and still offers the
 * resend.
 *
 * Harness: the network seams only. The stream's silence watchdog runs for real with a short budget; the recovery read
 * runs the REAL adapter (`fetchScenarioGraph`, its 8 s deadline and its re-read) and the real ingestion authority
 * (`hydrateCanvasFromServer`) over `fetch`. The saved model is the served read of this scenario at 00:43:08.296Z
 * (`live/runs/2026-10-12T001307Z/capacity/reads/01-02-range.json`, sha256 3b44b6c8…f765, its `body` re-serialised). That
 * read asked for the chat; the recovery read does not, so the keys CEE sends only on `include_conversation_turns`
 * (`assist.v1.scenario-graph.ts` at c87608e4: conversation_turns, changed_since_run, action_bar) are left out. The 299
 * bytes were not captured (the browser had no body to give); the two frames are written in the served frame shape.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useConversation, DRAFT_DELIVERY_RECOVERED_NOTICE } from '../useConversation'
import { NOT_DELIVERED_COPY } from '../transportFailure'
import { STREAM_LOSS_READ } from '../streamCloseReadback'
import { useCanvasStore } from '../../store'
import { useDraftStore } from '../../stores/draftStore'
import { scenarioGraphUrl } from '../../../adapters/cee/scenarioGraph'
import savedRead from './fixtures/capacity-001307-saved-read-20261012T004308Z.json'
import { ADDITIVE_EXTENSIONS_KEY } from '../../../v5/responseParser'

const mockOpenStream = vi.fn()
const mockCallV5Turn = vi.fn()

vi.mock('../../../v5/stopTurn', () => ({
  stopV5Turn: async () => ({ kind: 'not_saved' as const }),
  getV5StopEndpoint: () => 'https://cee.test/proxy/v5/turn/stop',
  STOP_ACK_BUDGET_MS: 5000,
}))
vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()),
  openV5TurnStream: (...args: unknown[]) => mockOpenStream(...args),
}))
vi.mock('../../../v5/v5Adapter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../v5/v5Adapter')>()),
  callV5Turn: (...args: unknown[]) => mockCallV5Turn(...args),
  getV5Endpoint: () => 'https://cee.test/proxy/v5/turn',
}))
vi.mock('../../../v5/eligibility', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../v5/eligibility')>()),
  isV5Eligible: () => ({ eligible: true }),
}))
// The real watchdog, with 200 ms of silence standing in for the served 30 s (three missed 10 s beats).
vi.mock('../../../v5/streamedDraftFrames', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/streamedDraftFrames')>()
  return { ...actual, streamStageFrames: (res: Response) => actual.streamStageFrames(res, { silenceTimeoutMs: 200 }) }
})
// The ~5 s wait before the read resolves at once; the predicate and `STREAM_LOSS_READ` stay real.
vi.mock('../streamCloseReadback', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../streamCloseReadback')>()),
  waitBeforeStreamCloseReadback: async () => {},
}))
vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('../../../services/scenarioService', () => ({ loadScenario: async () => null }))
// A1: the one recovery lookup goes out at once (served: 3 s after the notice), so its outcome is read in the same test; a
// row that acts during the delay lengthens it.
const replayTiming = vi.hoisted(() => ({ delayMs: 0 }))
vi.mock('../coreStillFinishing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../coreStillFinishing')>()),
  get STILL_FINISHING_REPLAY_DELAY_MS() { return replayTiming.delayMs },
}))

/** The served capacity scenario and its saved model, bound by identity. */
const SCENARIO = '14b66c8e-5016-4414-807e-27412c92107a'
const SAVED = savedRead as unknown as { scenario_id: string; graph: { nodes: { id: string; label: string }[] } }
const SAVED_NODE_IDS = SAVED.graph.nodes.map((n) => n.id).sort()
const BRIEF = 'We are comparing two staffing options, labelled exactly "Keep current staffing" and "Add one specialist". '
  + 'Use the exact goal label "Weekly support capacity". Goal: weekly support capacity of at least 100 tickets per week.'
const frame = (obj: Record<string, unknown>): string => `event: stage\ndata: ${JSON.stringify(obj)}\n\n`
/** What the browser received before the silence: DRAFTING + BRIEF_READ (served: 299 bytes). */
const FIRST_BYTES = frame({ stage: 'DRAFTING', seq: 0, status: 'in_progress' })
  + frame({ stage: 'BRIEF_READ', seq: 1, status: 'in_progress', goal: 'Weekly support capacity',
    options: ['Keep current staffing', 'Add one specialist'], elapsed_ms: 2400 })

/** A stream that delivers its first bytes and then goes silent: never closed, never failed. */
function silentAfterFirstBytes(): Response {
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode(FIRST_BYTES))
    },
  })
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

type GraphRead = { at: number; outcome: 'aborted_by_deadline' | 'answered'; abortedAfterMs?: number }

/**
 * `fetch` for the scenario-graph read: the FIRST read never answers (it ends only when the adapter's own deadline
 * aborts it, as on the served HTTP/2 connection that failed); every later read answers 200 with the saved model.
 */
function stubGraphReads() {
  const reads: GraphRead[] = []
  const other: string[] = []
  vi.stubGlobal('fetch', vi.fn((url: string, init: { signal?: AbortSignal }) => {
    if (url !== scenarioGraphUrl(SCENARIO)) {
      other.push(url)
      return Promise.resolve(new Response('{}', { status: 404 }))
    }
    const at = Date.now()
    if (reads.length === 0) {
      return new Promise<Response>((_resolve, reject) => {
        const read: GraphRead = { at, outcome: 'aborted_by_deadline' }
        reads.push(read)
        init.signal?.addEventListener('abort', () => {
          read.abortedAfterMs = Date.now() - at
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      })
    }
    reads.push({ at, outcome: 'answered' })
    return Promise.resolve(new Response(JSON.stringify(savedRead), { status: 200, headers: { 'content-type': 'application/json' } }))
  }))
  return { reads, other }
}

/** The payload of the Nth buffered call, and the streamed turn's own id. */
const lookupOf = (n: number) => mockCallV5Turn.mock.calls[n]?.[0] as Record<string, unknown> | undefined
const turnIdOfStream = () => (mockOpenStream.mock.calls[0]?.[0] as { turn_id?: string } | undefined)?.turn_id
/** Lets the recovery lookup (delay 0 here) go out and settle. */
async function settleLookup() {
  await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
}
/** CEE's replay of the recorded turn (core-turn `replayed()`): its recorded reply on the given saved revision. */
const replayOf = (revision: string | null, durability = 'replayed') => ({ kind: 'response' as const, response: {
  response_version: 2, assistant_text: 'Recorded reply: check the specialist range first.', blocks: [], suggested_actions: [], insights: [], stage_indicator: 'frame',
  [ADDITIVE_EXTENSIONS_KEY]: { _core_turn: { durability, model: { revision }, cards: [], notes: [], receipts: [] } },
} })

async function sendBrief() {
  const hook = renderHook(() => useConversation())
  await act(async () => {
    await hook.result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' })
  })
  return hook.result
}

beforeEach(() => {
  mockOpenStream.mockReset()
  mockCallV5Turn.mockReset()
  useDraftStore.getState().resetDraft()
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: [],
    edges: [],
    history: { past: [], future: [] },
    _internal: {
      ...(useCanvasStore.getState() as unknown as { _internal: object })._internal,
      lastHistoryHash: null,
    },
    ceeAnalysisReady: null,
    analysisStateV1: null,
    analysisFreshness: null,
    hasCompletedFirstRun: false,
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    results: { status: 'idle' } as never,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('capacity 001307: the stream goes silent after its first bytes while CEE saves the model', () => {
  it('RED: the 8 s read times out once, the re-read finds the saved 13-node model, it is shown, and nothing is re-sent', async () => {
    expect(SAVED.scenario_id).toBe(SCENARIO)
    expect(SAVED_NODE_IDS).toHaveLength(13)
    const net = stubGraphReads()
    mockOpenStream.mockResolvedValue(silentAfterFirstBytes())
    // Served: the buffered re-send never reached CEE and ended in a network error.
    mockCallV5Turn.mockResolvedValue({ kind: 'parse_error', reason: 'network error: net::ERR_TIMED_OUT' })

    const result = await sendBrief()

    // No buffered re-send of the brief (and, off the core lane, no A1 lookup: only core records a reply to replay).
    await settleLookup()
    expect(mockCallV5Turn, 'no buffered re-send of the brief').toHaveBeenCalledTimes(0)
    // The first read was ended by the adapter's own 8 s deadline; the second, 1 s later, was answered.
    expect(net.reads.map((r) => r.outcome)).toEqual(['aborted_by_deadline', 'answered'])
    expect(net.reads[0]!.abortedAfterMs!).toBeGreaterThanOrEqual(7_900)
    expect(net.reads[1]!.at - net.reads[0]!.at).toBeGreaterThanOrEqual(8_900)
    // The saved model is what the user sees: this scenario, its 13 nodes by id.
    expect(useCanvasStore.getState().currentScenarioId).toBe(SCENARIO)
    expect(useCanvasStore.getState().nodes.map((n) => n.id).sort()).toEqual(SAVED_NODE_IDS)
    const contents = result.current.messages.map((m) => m.content)
    expect(contents).toContain(DRAFT_DELIVERY_RECOVERED_NOTICE)
    expect(contents.some((c) => /couldn.t confirm|cannot confirm/i.test(String(c))), 'no false "cannot confirm"').toBe(false)
    expect(useDraftStore.getState().draftStreamPhase).toBe('idle')
    expect(result.current.messages.find((m) => m.role === 'user')?.deliveryState).toBe('sent')
  }, 30_000)
})

describe('A1 (PL 23:51Z): after the read-back, ONE replay_only lookup brings back that turn\'s recorded reply, or nothing', () => {
  // The core lane, as staging serves it (resolveAiComparisonMode: a staging host is core-route).
  beforeEach(() => { window.history.replaceState(null, '', '/#/canvas?ai=core-route') })
  afterEach(() => { window.history.replaceState(null, '', '/') })
  it('the replay of that turn on the revision read back is adopted: its reply shows and the recovered notice goes', async () => {
    stubGraphReads()
    mockOpenStream.mockResolvedValue(silentAfterFirstBytes())
    mockCallV5Turn.mockImplementation(async () => replayOf(useCanvasStore.getState().lastServerGraphHash ?? null))
    const result = await sendBrief()
    await settleLookup()
    expect(mockCallV5Turn).toHaveBeenCalledTimes(1)
    expect(lookupOf(0)).toMatchObject({ replay_only: true, turn_id: turnIdOfStream() })
    const contents = result.current.messages.map((m) => m.content)
    expect(contents).toContain('Recorded reply: check the specialist range first.')
    expect(contents).not.toContain(DRAFT_DELIVERY_RECOVERED_NOTICE)
    expect(result.current.messages.filter((m) => m.role === 'user')).toHaveLength(1)
  }, 30_000)

  it.each([
    ['a scenario switch', () => useCanvasStore.setState({ currentScenarioId: 'another-scenario' } as never)],
    ['an edit to the saved model (a new revision)', () => useCanvasStore.setState({ lastServerGraphHash: 'a-newer-revision' } as never)],
  ])('independent read r1: %s during the delay sends no lookup at all, and the recorded reply never lands', async (_name, happen) => {
    stubGraphReads()
    mockOpenStream.mockResolvedValue(silentAfterFirstBytes())
    mockCallV5Turn.mockImplementation(async () => replayOf(useCanvasStore.getState().lastServerGraphHash ?? null))
    replayTiming.delayMs = 300
    try {
      const result = await sendBrief()
      act(() => { happen() })
      await act(async () => { await new Promise((r) => setTimeout(r, 600)) })
      expect(mockCallV5Turn, 'no lookup after something happened').toHaveBeenCalledTimes(0)
      expect(result.current.messages.map((m) => m.content)).not.toContain('Recorded reply: check the specialist range first.')
    } finally {
      replayTiming.delayMs = 0
    }
  }, 30_000)

  it('independent read r1: a message after the notice (a newer turn) means no lookup; the old reply is never adopted', async () => {
    stubGraphReads()
    mockOpenStream.mockResolvedValue(silentAfterFirstBytes())
    // Any buffered call answers with the old turn's recorded reply, so adopting it anywhere would show.
    mockCallV5Turn.mockImplementation(async () => replayOf(useCanvasStore.getState().lastServerGraphHash ?? null))
    replayTiming.delayMs = 300
    try {
      const result = await sendBrief()
      const briefTurn = turnIdOfStream()
      mockOpenStream.mockResolvedValue(silentAfterFirstBytes())
      await act(async () => { await result.current.sendMessage('A newer question') })
      await act(async () => { await new Promise((r) => setTimeout(r, 600)) })
      const lookups = mockCallV5Turn.mock.calls.map((c) => c[0] as Record<string, unknown>).filter((b) => b.replay_only === true)
      expect(lookups.map((b) => b.turn_id), 'no lookup for the brief once a newer turn follows its notice').not.toContain(briefTurn)
      expect(result.current.messages.filter((m) => m.role === 'user').map((m) => m.content)).toContain('A newer question')
    } finally {
      replayTiming.delayMs = 0
    }
  }, 30_000)

  it.each([
    ['a replay of another revision', replayOf('another-revision')],
    ['a replay that names no revision', replayOf(null)],
    ['a reply that is not a replay', replayOf('same', 'recorded')],
    ['a typed miss (404 REPLAY_NOT_RECORDED)', { kind: 'parse_error', reason: 'http_404', http_status: 404, raw: { error: { code: 'REPLAY_NOT_RECORDED' } } }],
  ])('CONTRAST: %s is not adopted; the recovered notice stays and nothing else is said', async (_name, reply) => {
    stubGraphReads()
    mockOpenStream.mockResolvedValue(silentAfterFirstBytes())
    // 'same' stands for the revision read back, so only the durability differs in that row.
    mockCallV5Turn.mockImplementation(async () => (JSON.stringify(reply).includes('"same"')
      ? replayOf(useCanvasStore.getState().lastServerGraphHash ?? null, 'recorded') : reply))
    const result = await sendBrief()
    await settleLookup()
    expect(mockCallV5Turn).toHaveBeenCalledTimes(1)
    expect(lookupOf(0)).toMatchObject({ replay_only: true })
    const contents = result.current.messages.map((m) => m.content)
    expect(contents).toContain(DRAFT_DELIVERY_RECOVERED_NOTICE)
    expect(contents).not.toContain('Recorded reply: check the specialist range first.')
    expect(result.current.messages).toHaveLength(2)
  }, 30_000)
})

describe('the stream-loss read policy', () => {
  it('two attempts, 1 s apart, each under the adapter\'s 8 s deadline (≤ 17 s of reading)', () => {
    expect(STREAM_LOSS_READ).toEqual({ attempts: 2, backoffMs: 1_000 })
  })
})

describe('a confirmed non-send is never read back and still offers the resend', () => {
  it('CONTROL: nothing was dispatched (offline before the stream and the fallback) → no read, "not sent" with Try again', async () => {
    const net = stubGraphReads()
    mockOpenStream.mockRejectedValue(new TypeError('offline before dispatch'))
    mockCallV5Turn.mockResolvedValue({ kind: 'parse_error', reason: 'offline before dispatch', requestNotStarted: true })

    const result = await sendBrief()

    expect(net.reads, 'nothing was sent, so there is no saved model to look for').toHaveLength(0)
    expect(mockCallV5Turn).toHaveBeenCalledTimes(1)
    const last = result.current.messages.at(-1)!
    expect(last.content).toBe(NOT_DELIVERED_COPY)
    expect(last.actionChips?.map((c) => c.id)).toContain('retry')
    expect(result.current.messages.find((m) => m.role === 'user')?.deliveryState).toBe('failed')
    expect(result.current.lastSendFailure).toMatchObject({ kind: 'not_sent', retryable: true })
  })
})
