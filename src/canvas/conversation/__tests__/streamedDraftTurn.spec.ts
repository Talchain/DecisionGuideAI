/**
 * The streamed cold draft, end to end through `useConversation` (ROADMAP 2.122
 * / 1.204 M1, POC-DONE step 1).
 *
 * This is the seam the lane could have failed SILENTLY at, so it gets pinned at
 * the level where the failure would have been invisible:
 *
 *   - the graph must be on the canvas BEFORE the terminal frame arrives (the
 *     entire point — a consumer that buffered every frame and applied at the end
 *     would pass every content assertion while deleting the whole benefit);
 *   - the terminal ingest must take the FRESH-DRAFT branch, not the
 *     applied-edit-receipt branch. Reconcile gets the nodes right and performs
 *     none of `applyDraftResult`'s side-effects, so coaching and the run
 *     affordance would never unlock and the canvas would look perfect;
 *   - the run affordance must stay SHUT while values are settling;
 *   - a dead stream must never be a dead end, and never a double-commit.
 *
 * The stream is driven by a real `ReadableStream` through the real
 * `streamStageFrames`, so the SSE parse, the chunk boundaries and the frame
 * ordering are exercised rather than stubbed. Only the two network calls
 * (`openV5TurnStream`, `callV5Turn`) are mocked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useConversation, streamedDraftEligible, START_NEW_DRAFT_CHIP_ID } from '../useConversation'
import { useCanvasStore } from '../../store'
import { useDraftStore } from '../../stores/draftStore'
import {
  canRunAnalysis,
  DRAFT_VALUES_SETTLING_REFUSAL,
  DRAFT_VALUES_UNSETTLED_REFUSAL,
} from '../../utils/canRunAnalysis'
import { shouldPersistGraphForScenario, draftStreamPhaseFor } from '../../stores/draftStore'
import {
  UNSETTLED_DRAFT_NOTICE,
  STOPPED_DRAFT_NOTICE,
  EARLY_STOP_NOT_SAVED_NOTICE,
  EARLY_STOP_ALREADY_SAVED_NOTICE,
} from '../../components/DraftLoadingAnimation'
import * as scenariosModule from '../../store/scenarios'
import wireFixture from './fixtures/cee-draft-goal-constraints-wire.json'

// ---------------------------------------------------------------------------
// Network seam — the only thing mocked
// ---------------------------------------------------------------------------

const mockOpenStream = vi.fn()
const mockCallV5Turn = vi.fn()
// Stop-fence (Codex P0): the server-visible Stop. Mocked at the same network
// seam as the rest of this file — the point of these tests is which NOTICE the
// real abort path produces, not the HTTP call.
const mockStopV5Turn = vi.fn(async () => ({ kind: 'not_saved' as const }))
vi.mock('../../../v5/stopTurn', () => ({
  stopV5Turn: (...args: unknown[]) => mockStopV5Turn(...args),
  getV5StopEndpoint: () => 'https://cee.test/proxy/v5/turn/stop',
  STOP_ACK_BUDGET_MS: 5000,
}))

vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()
  return {
    ...actual,
    openV5TurnStream: (...args: unknown[]) => mockOpenStream(...args),
  }
})

vi.mock('../../../v5/v5Adapter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/v5Adapter')>()
  return {
    ...actual,
    callV5Turn: (...args: unknown[]) => mockCallV5Turn(...args),
    getV5Endpoint: () => 'https://cee.test/proxy/v5/turn',
  }
})

vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return { ...actual, isV5Eligible: () => ({ eligible: true }) }
})

vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))

vi.mock('../../../services/scenarioService', () => ({ loadScenario: async () => null }))

// ---------------------------------------------------------------------------
// Fixtures — the live 29 Jul wire shape, reduced
// ---------------------------------------------------------------------------

/**
 * The terminal body is a REAL CEE wire capture
 * (`fixtures/cee-draft-goal-constraints-wire.json`, already in the repo and
 * already used by `draftGoalConstraints.wire.spec.ts`), not a hand-written
 * object. That matters: the terminal frame goes through the real
 * `parseV5Response`, which validates against the strict `OlumiResponse` schema
 * — a plausible-looking invented body is rejected as `parse_error` and the
 * whole ingest silently never happens. My first version of this spec did
 * exactly that and every downstream assertion failed for the wrong reason.
 */
const TERMINAL_BODY = wireFixture as unknown as Record<string, unknown>
const TERMINAL_GRAPH = (TERMINAL_BODY.draft_graph as {
  nodes: Array<Record<string, unknown>>
  edges: Array<Record<string, unknown>>
})

/**
 * The GRAPH_READY frame's graph: the SAME node and edge identities as the
 * terminal graph, with the numeric values zeroed — which is precisely the
 * contract ("identity is stable, values settle") and precisely why the frame is
 * stamped `in_progress`. Derived from the terminal graph rather than typed out
 * twice, so the two cannot drift apart and make the identity pin vacuous.
 */
const READY_GRAPH = {
  nodes: TERMINAL_GRAPH.nodes.map((n) => ({ id: n.id, kind: n.kind, label: n.label })),
  edges: TERMINAL_GRAPH.edges.map((e) => ({ from: e.from, to: e.to, strength: { mean: 0 } })),
}
const TERMINAL_NODE_IDS = TERMINAL_GRAPH.nodes.map((n) => String(n.id)).sort()

function frame(obj: Record<string, unknown>): string {
  return `event: stage\ndata: ${JSON.stringify(obj)}\n\n`
}

const F_DRAFTING = frame({ stage: 'DRAFTING', seq: 0, status: 'in_progress' })
const F_GRAPH_READY = frame({
  stage: 'GRAPH_READY',
  seq: 2,
  status: 'in_progress',
  schema_version: 'v3',
  elapsed_ms: 35_834,
  graph: READY_GRAPH,
})
const F_COACHING = frame({
  stage: 'COACHING_READY',
  seq: 3,
  status: 'in_progress',
  coaching_status: 'partial',
})
const fComplete = (statusCode = 200, payload: unknown = TERMINAL_BODY) =>
  frame({ stage: 'COMPLETE', seq: 4, status: 'complete', status_code: statusCode, payload })

/**
 * A `Response` whose body the TEST drives, so state can be inspected while the
 * stream is still open. `push` enqueues; `close` ends; `fail` errors the socket.
 */
function controllableStream() {
  const encoder = new TextEncoder()
  let ctrl!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      ctrl = c
    },
  })
  const res = new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
  // The path from `enqueue` to a rendered node crosses several awaits (reader
  // read -> decode -> SSE parse -> generator yield -> consumer -> React commit),
  // so a single microtask flush is not enough. Two macrotask turns drain it.
  const settle = () =>
    act(async () => {
      await new Promise((r) => setTimeout(r, 0))
      await new Promise((r) => setTimeout(r, 0))
    })
  let closed = false
  return {
    response: res,
    async push(text: string) {
      if (!closed) ctrl.enqueue(encoder.encode(text))
      await settle()
    },
    async close() {
      // The generator cancels the reader as soon as it sees the terminal frame,
      // which closes the controller for us — closing again would throw.
      if (!closed) {
        closed = true
        try {
          ctrl.close()
        } catch {
          /* already closed by the consumer's own cancel */
        }
      }
      await settle()
    },
    async fail() {
      if (!closed) {
        closed = true
        try {
          ctrl.error(new Error('socket hung up'))
        } catch {
          /* already closed */
        }
      }
      await settle()
    },
  }
}

const SCENARIO = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
const BRIEF = 'Should we build or buy a billing system for our new SaaS product?'

/**
 * The run gate exactly as `OutputsDock` calls it: the raw phase goes in and the
 * gate decides. Nothing here re-derives "is it settling" — an earlier version of
 * this helper did, and that let a mutation of `OutputsDock`'s own copy of the
 * rule SURVIVE the mutation battery.
 */
function runGate() {
  const currentScenarioId = useCanvasStore.getState().currentScenarioId
  return canRunAnalysis({
    graphHealth: null,
    readiness: null,
    hasBlockers: false,
    nodeCount: useCanvasStore.getState().nodes.length,
    // Scoped exactly as both live call sites scope it (F2): a phase belonging to
    // another scenario must not reach this gate at all.
    draftStreamPhase: draftStreamPhaseFor(useDraftStore.getState(), currentScenarioId),
  })
}

beforeEach(() => {
  mockOpenStream.mockReset()
  mockCallV5Turn.mockReset()
  useDraftStore.getState().resetDraft()
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: [],
    edges: [],
    // Reset the history slice AND its dedupe memo. `pushToHistory` skips a push
    // when the pre-apply hash equals `_internal.lastHistoryHash`, so a memo left
    // behind by a previous test silently swallows the next test's history push
    // and the undo-depth pin below would read the wrong number.
    history: { past: [], future: [] },
    _internal: { ...(useCanvasStore.getState() as unknown as { _internal: object })._internal, lastHistoryHash: null },
    ceeAnalysisReady: null,
    lastAuthoritativeGraph: null,
    results: { status: 'idle' } as never,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------

describe('streamedDraftEligible — narrow, and narrow towards doing nothing', () => {
  const base = {
    turnType: 'explicit_generate' as never,
    derivedStage: 'frame',
    isSystemEvent: false,
    nodeCountAtDispatch: 0,
  }

  it('accepts an explicit_generate turn on an empty canvas', () => {
    expect(streamedDraftEligible(base)).toBe(true)
  })

  it('accepts a frame-stage composer turn on an empty canvas', () => {
    expect(streamedDraftEligible({ ...base, turnType: 'conversation' as never })).toBe(true)
  })

  it('REFUSES a populated canvas — a continuation turn has no graph frame to give', () => {
    expect(streamedDraftEligible({ ...base, nodeCountAtDispatch: 7 })).toBe(false)
  })

  it('REFUSES a system event — graph edits must keep the buffered path byte for byte', () => {
    expect(streamedDraftEligible({ ...base, isSystemEvent: true })).toBe(false)
  })

  it('REFUSES an ordinary conversation turn at a non-frame stage', () => {
    expect(
      streamedDraftEligible({ ...base, turnType: 'conversation' as never, derivedStage: 'analyse' }),
    ).toBe(false)
  })

  it('REFUSES a run_analysis turn even on an empty canvas', () => {
    // ⚠ The regression this predicate actually had. `deriveV5Stage` returns
    // 'frame' for ANY turn on an empty canvas, so an eligibility rule of
    // "explicit_generate OR stage === frame" routed a Run click into the draft
    // stream. Caught by `useConversation.hook.spec.ts`'s preempt test, not by
    // this suite — so it is pinned here, at the predicate, where it belongs.
    expect(streamedDraftEligible({ ...base, turnType: 'run_analysis' as never })).toBe(false)
  })

  it('REFUSES every other turn type on an empty canvas — the rule is fail-closed', () => {
    for (const turnType of ['explain', 'patch_followup', 'clarification_response'] as const) {
      expect(streamedDraftEligible({ ...base, turnType: turnType as never })).toBe(false)
    }
  })
})

describe('the happy path — graph at GRAPH_READY, full ingest at COMPLETE', () => {
  it('puts the graph on the canvas BEFORE the terminal frame arrives', async () => {
    const stream = controllableStream()
    mockOpenStream.mockResolvedValue(stream.response)
    const { result } = renderHook(() => useConversation())

    let sent!: Promise<void>
    await act(async () => {
      sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
    })

    await stream.push(F_DRAFTING)
    // Nothing rendered yet — DRAFTING carries no graph. This is the 36 s wait.
    expect(useCanvasStore.getState().nodes).toHaveLength(0)
    expect(useDraftStore.getState().draftStreamPhase).toBe('drafting')

    await stream.push(F_GRAPH_READY)
    // ⭐ THE LANE'S WHOLE POINT: the graph is on the canvas and the turn is
    // still open. A buffered-then-applied consumer would show 0 here.
    expect(useCanvasStore.getState().nodes.map((n) => n.id).sort()).toEqual(TERMINAL_NODE_IDS)
    expect(useDraftStore.getState().draftStreamPhase).toBe('settling')

    await stream.push(F_COACHING)
    await stream.push(fComplete())
    await stream.close()
    await act(async () => {
      await sent
    })

    expect(useDraftStore.getState().draftStreamPhase).toBe('idle')
  })

  it('runs the FRESH-DRAFT ingest at COMPLETE, not the applied-edit reconcile', async () => {
    // The silent-failure pin. `ceeAnalysisReady` is written ONLY by
    // applyDraftResult's `hasAnalysisReady` branch; `reconcileAppliedGraph`
    // never touches it. If the terminal graph took the reconcile branch the
    // node ids would still be perfect and this would be null — the canvas would
    // look right while coaching and the run gate never unlocked.
    const stream = controllableStream()
    mockOpenStream.mockResolvedValue(stream.response)
    const { result } = renderHook(() => useConversation())

    let sent!: Promise<void>
    await act(async () => {
      sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
    })
    await stream.push(F_DRAFTING + F_GRAPH_READY)
    expect(useCanvasStore.getState().ceeAnalysisReady).toBeNull()

    await stream.push(F_COACHING + fComplete())
    await stream.close()
    await act(async () => {
      await sent
    })

    expect(useCanvasStore.getState().ceeAnalysisReady).toMatchObject({
      status: 'needs_user_input',
    })
  })

  it('leaves the undo stack exactly as deep as a buffered draft leaves it', async () => {
    // Two applies, ONE history entry. Without `skipHistory` on the terminal
    // apply, undo would step to the intermediate preview graph first.
    const stream = controllableStream()
    mockOpenStream.mockResolvedValue(stream.response)
    const { result } = renderHook(() => useConversation())
    const historyDepth = () =>
      (useCanvasStore.getState() as unknown as { history: { past: unknown[] } }).history.past.length
    const historyBefore = historyDepth()

    let sent!: Promise<void>
    await act(async () => {
      sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
    })
    await stream.push(F_DRAFTING + F_GRAPH_READY)
    const historyAfterPreview = historyDepth()
    await stream.push(F_COACHING + fComplete())
    await stream.close()
    await act(async () => {
      await sent
    })
    const historyAfterComplete = historyDepth()

    expect(historyAfterPreview).toBe(historyBefore + 1)
    expect(historyAfterComplete).toBe(historyAfterPreview)
  })

  it('never fires the buffered turn when the stream completes', async () => {
    const stream = controllableStream()
    mockOpenStream.mockResolvedValue(stream.response)
    const { result } = renderHook(() => useConversation())
    let sent!: Promise<void>
    await act(async () => {
      sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
    })
    await stream.push(F_DRAFTING + F_GRAPH_READY + F_COACHING + fComplete())
    await stream.close()
    await act(async () => {
      await sent
    })
    expect(mockCallV5Turn).not.toHaveBeenCalled()
  })
})

describe('HONESTY while the values settle', () => {
  it('keeps the run affordance SHUT between GRAPH_READY and COMPLETE, with a true reason', async () => {
    const stream = controllableStream()
    mockOpenStream.mockResolvedValue(stream.response)
    const { result } = renderHook(() => useConversation())
    let sent!: Promise<void>
    await act(async () => {
      sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
    })

    await stream.push(F_DRAFTING + F_GRAPH_READY)
    // A graph with three nodes is on screen. Without the settling rung the gate
    // would be driven by nodeCount alone and hand the tester a live Run button
    // over values CEE is about to change, on a scenario CEE has not committed.
    const settling = runGate()
    expect(settling.allowed).toBe(false)
    expect(settling.reason).toBe(DRAFT_VALUES_SETTLING_REFUSAL)

    await stream.push(F_COACHING + fComplete())
    await stream.close()
    await act(async () => {
      await sent
    })
    // Positive control on the rung: the same graph, same gate inputs, and now
    // it is no longer the settling rung doing the blocking. Without this, the
    // assertion above could be passing because SOMETHING always blocks.
    expect(runGate().reason).not.toBe(DRAFT_VALUES_SETTLING_REFUSAL)
  })

  it('writes no freshness verdict and no analysis fact from the GRAPH_READY frame', async () => {
    const stream = controllableStream()
    mockOpenStream.mockResolvedValue(stream.response)
    const { result } = renderHook(() => useConversation())
    let sent!: Promise<void>
    await act(async () => {
      sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
    })
    await stream.push(F_DRAFTING + F_GRAPH_READY)

    const s = useCanvasStore.getState() as unknown as Record<string, unknown>
    expect(s.ceeAnalysisReady).toBeNull()
    expect(s.v5AnalysisFact ?? null).toBeNull()
    expect((s.results as { status?: string } | undefined)?.status).not.toBe('complete')

    await stream.push(fComplete())
    await stream.close()
    await act(async () => {
      await sent
    })
  })
})

describe('FAILURE HONESTY — never a dead end, never a double-commit', () => {
  it('falls back to ONE buffered turn on the SAME payload when the stream dies early', async () => {
    const stream = controllableStream()
    mockOpenStream.mockResolvedValue(stream.response)
    mockCallV5Turn.mockResolvedValue({ kind: 'response', response: TERMINAL_BODY })
    const { result } = renderHook(() => useConversation())

    let sent!: Promise<void>
    await act(async () => {
      sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
    })
    await stream.push(F_DRAFTING)
    await stream.fail()
    await act(async () => {
      await sent
    })

    // Exactly one buffered turn — a re-entered turn, which CEE's continuation
    // guard resolves. No second stream, no new scenario, so no double-commit.
    expect(mockCallV5Turn).toHaveBeenCalledTimes(1)
    const streamPayload = mockOpenStream.mock.calls[0][0]
    const bufferedPayload = mockCallV5Turn.mock.calls[0][0]
    expect(bufferedPayload).toEqual(streamPayload)
    expect((bufferedPayload as { scenario_id: string }).scenario_id).toBe(SCENARIO)

    // And the user still gets their model.
    expect(useCanvasStore.getState().nodes).toHaveLength(TERMINAL_NODE_IDS.length)
    expect(useCanvasStore.getState().ceeAnalysisReady).not.toBeNull()
    expect(useDraftStore.getState().draftStreamPhase).toBe('idle')
  })

  it('falls back when the stream cannot even be opened', async () => {
    mockOpenStream.mockRejectedValue(new TypeError('Failed to fetch'))
    mockCallV5Turn.mockResolvedValue({ kind: 'response', response: TERMINAL_BODY })
    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' })
    })
    expect(mockCallV5Turn).toHaveBeenCalledTimes(1)
    expect(useCanvasStore.getState().nodes).toHaveLength(TERMINAL_NODE_IDS.length)
  })

  it('states the truth when the stream died AFTER commit and CEE declines to re-draft', async () => {
    // The one genuinely awkward case, and the reason this branch is written by
    // hand rather than inherited. The turn committed server-side (proven
    // behaviour: the route lets the turn finish when the client hangs up), so
    // the buffered re-entry returns prose with NO draft_graph. The structure on
    // screen is real; its numbers are the frame's in-progress ones and no
    // settled copy will reach this session.
    const stream = controllableStream()
    mockOpenStream.mockResolvedValue(stream.response)
    mockCallV5Turn.mockResolvedValue({
      kind: 'response',
      response: {
        response_version: 2,
        assistant_text: 'Your billing system decision model is already drafted with four options.',
        blocks: [],
      },
    })
    const { result } = renderHook(() => useConversation())

    let sent!: Promise<void>
    await act(async () => {
      sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
    })
    await stream.push(F_DRAFTING + F_GRAPH_READY)
    await stream.fail()
    await act(async () => {
      await sent
    })

    // The graph is KEPT — throwing away a correct structure would be worse.
    expect(useCanvasStore.getState().nodes).toHaveLength(TERMINAL_NODE_IDS.length)
    // The phase is terminal-unsettled, so the run gate stays shut — with the
    // TERMINAL refusal, not the settling one (review F5: the settling string
    // forecasts a finish that will never come in this state).
    expect(useDraftStore.getState().draftStreamPhase).toBe('unsettled')
    expect(runGate().reason).toBe(DRAFT_VALUES_UNSETTLED_REFUSAL)
    // … and the transcript says why, rather than leaving a silently dead button.
    const contents = result.current.messages.map((m) => m.content)
    expect(contents).toContain(UNSETTLED_DRAFT_NOTICE)
    // Still exactly one buffered turn.
    expect(mockCallV5Turn).toHaveBeenCalledTimes(1)
  })

  it('does NOT go unsettled when the fallback redrafts — the ordinary recovery', async () => {
    const stream = controllableStream()
    mockOpenStream.mockResolvedValue(stream.response)
    mockCallV5Turn.mockResolvedValue({ kind: 'response', response: TERMINAL_BODY })
    const { result } = renderHook(() => useConversation())
    let sent!: Promise<void>
    await act(async () => {
      sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
    })
    await stream.push(F_DRAFTING + F_GRAPH_READY)
    await stream.fail()
    await act(async () => {
      await sent
    })
    expect(useDraftStore.getState().draftStreamPhase).toBe('idle')
    expect(result.current.messages.map((m) => m.content)).not.toContain(UNSETTLED_DRAFT_NOTICE)
  })

  it('removes the preview when the terminal frame is an error', async () => {
    const stream = controllableStream()
    mockOpenStream.mockResolvedValue(stream.response)
    const { result } = renderHook(() => useConversation())
    let sent!: Promise<void>
    await act(async () => {
      sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
    })
    await stream.push(F_DRAFTING + F_GRAPH_READY)
    expect(useCanvasStore.getState().nodes).toHaveLength(TERMINAL_NODE_IDS.length)

    await stream.push(fComplete(422, { error: 'INGRESS_CONTRACT_VIOLATION' }))
    await stream.close()
    await act(async () => {
      await sent
    })

    // A graph rendered on the promise of a turn that then failed must not stay.
    expect(useCanvasStore.getState().nodes).toHaveLength(0)
    expect(useDraftStore.getState().draftStreamPhase).toBe('idle')
  })
})

describe('a scenario switch mid-draft must not write to the new scenario', () => {
  it('renders NO preview, and the terminal ingest does not treat one as present', async () => {
    // ⚠ Added because a mutant SURVIVED: making the scenario guard `return`
    // silently instead of throwing stayed GREEN. That difference is not
    // cosmetic. `consumeStreamedDraftTurn` records `renderedGraph` unless the
    // callback THROWS, so a silent return leaves it believing a preview is on
    // screen — and the terminal ingest would then take the
    // "resolve my own preview" branch (skipping history, treating a foreign
    // canvas as empty) for a preview that was never drawn.
    const stream = controllableStream()
    mockOpenStream.mockResolvedValue(stream.response)
    const { result } = renderHook(() => useConversation())

    let sent!: Promise<void>
    await act(async () => {
      sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
    })
    await stream.push(F_DRAFTING)

    // The user switches scenario while the draft is in flight.
    await act(async () => {
      useCanvasStore.setState({ currentScenarioId: 'b1b1b1b1-c2c2-4d3d-8e4e-f5f5f5f5f5f5' } as never)
    })
    await stream.push(F_GRAPH_READY)

    // Nothing was drawn onto the new scenario's canvas.
    expect(useCanvasStore.getState().nodes).toHaveLength(0)
    // And the phase never advanced to `settling`, so the run gate for the NEW
    // scenario is not blocked by a draft that does not belong to it.
    expect(useDraftStore.getState().draftStreamPhase).not.toBe('settling')

    await stream.push(F_COACHING + fComplete())
    await stream.close()
    await act(async () => {
      await sent
    })

    // The terminal ingest is also scenario-guarded, so the switched-away canvas
    // stays empty rather than receiving the other scenario's model.
    expect(useCanvasStore.getState().nodes).toHaveLength(0)
    // History untouched: no preview push, no terminal push.
    expect(
      (useCanvasStore.getState() as unknown as { history: { past: unknown[] } }).history.past,
    ).toHaveLength(0)
  })

  it('a REJECTED preview is not later "discarded" out of the scenario the user moved to', async () => {
    // ⚠ The pin that makes the render callback's THROW load-bearing rather than
    // decorative. `consumeStreamedDraftTurn` records `renderedGraph` unless the
    // callback throws, and the error path uses `renderedGraph` to strip the
    // preview's own element ids off the canvas. So a guard that returned
    // SILENTLY would have the error path reach into the scenario the user
    // switched TO and clear its authoritative-graph identity — cross-scenario
    // contamination from a draft that was never drawn.
    const stream = controllableStream()
    mockOpenStream.mockResolvedValue(stream.response)
    const { result } = renderHook(() => useConversation())

    let sent!: Promise<void>
    await act(async () => {
      sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
    })
    await stream.push(F_DRAFTING)

    // The user moves to another scenario that has its OWN acknowledged graph.
    const otherAuthoritative = { nodeIds: ['other_1'], edgePairs: [] }
    await act(async () => {
      useCanvasStore.setState({
        currentScenarioId: 'b1b1b1b1-c2c2-4d3d-8e4e-f5f5f5f5f5f5',
        lastAuthoritativeGraph: otherAuthoritative,
      } as never)
    })
    await stream.push(F_GRAPH_READY)
    // …and the turn then fails at the boundary, which is the path that discards.
    await stream.push(fComplete(422, { error: 'INGRESS_CONTRACT_VIOLATION' }))
    await stream.close()
    await act(async () => {
      await sent
    })

    expect(
      (useCanvasStore.getState() as unknown as { lastAuthoritativeGraph: unknown })
        .lastAuthoritativeGraph,
    ).toEqual(otherAuthoritative)
  })
})

describe('the buffered path is untouched for everything else', () => {
  it('a continuation turn on a populated canvas never opens a stream', async () => {
    useCanvasStore.setState({
      nodes: [{ id: 'n1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'G' } }],
    } as never)
    mockCallV5Turn.mockResolvedValue({
      kind: 'response',
      response: { response_version: 2, assistant_text: 'ok', blocks: [] },
    })
    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('what about timeline risk?')
    })
    expect(mockOpenStream).not.toHaveBeenCalled()
    expect(mockCallV5Turn).toHaveBeenCalledTimes(1)
    expect(useDraftStore.getState().draftStreamPhase).toBe('idle')
  })
})

// ===========================================================================
// ADVERSARIAL REVIEW OF PR #525 — the reviewer's probes, adopted verbatim in
// intent (ROADMAP 2.122, round 2)
// ===========================================================================
//
// The review returned BLOCKED on two findings, both in the phase machine's
// BOUNDARY states, both proven executable at `bb0338e9`, neither covered by the
// 24-mutant battery. The core construction survived every attack — which is
// exactly why these matter: an "honest no-claim window" is either true at every
// edge or it is not a guarantee.
//
// Each probe below is written as the reviewer executed it, and each went RED
// before the fix.

describe('F1 — abort after GRAPH_READY (Stop button / 130 s timeout)', () => {
  /**
   * The reviewer's probe, verbatim in intent: after GRAPH_READY + Stop, the head
   * left the canvas holding every preview node, `draftStreamPhase === 'idle'`,
   * `canRunAnalysis(...).allowed === true` with NO reason, and no notice in the
   * transcript — an unsettled draft presented as a finished model with a live
   * Run affordance, one click away from the fabrication M4/M7 exist to prevent.
   *
   * The Stop button is rendered for the whole settling window (`isThinking`), and
   * the natural tester is the one who sees the graph land at 36 s and concludes
   * the spinner is vestigial.
   */
  it('does NOT present the unsettled preview as a finished model', async () => {
    const stream = controllableStream()
    mockOpenStream.mockResolvedValue(stream.response)
    const { result } = renderHook(() => useConversation())

    let sent!: Promise<void>
    await act(async () => {
      sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
    })
    await stream.push(F_DRAFTING + F_GRAPH_READY)
    expect(useCanvasStore.getState().nodes).toHaveLength(TERMINAL_NODE_IDS.length)
    expect(useDraftStore.getState().draftStreamPhase).toBe('settling')

    // The user presses Stop.
    await act(async () => {
      result.current.cancelTurn()
    })
    await stream.fail()
    await act(async () => {
      await sent.catch(() => {})
    })

    // The structure is REAL and is kept — deleting it would assert something
    // false ("you have no model") about a graph CEE actually validated.
    expect(useCanvasStore.getState().nodes).toHaveLength(TERMINAL_NODE_IDS.length)
    // …but it is MARKED, so the run gate stays shut with the honest reason.
    expect(useDraftStore.getState().draftStreamPhase).toBe('unsettled')
    expect(runGate().allowed).toBe(false)
    expect(runGate().reason).toBe(DRAFT_VALUES_UNSETTLED_REFUSAL)
    // …and the transcript says what happened rather than leaving a silently
    // dead Run button next to a "values are still arriving" line.
    //
    // ⚠ AMENDED by the stop-fence lane (Codex P0). This used to assert
    // STOPPED_DRAFT_NOTICE, whose copy is deliberately true of a user stop, a
    // 130 s timeout AND a preempt without saying which. An explicit user Stop now
    // has a server answer behind it, so it gets the notice that can name what
    // happened — and STOPPED_DRAFT_NOTICE stays for the two aborts that send no
    // stop request. EXACTLY ONE notice, which is the assertion that would have
    // caught a double-notice regression (it survived a mutation until it moved
    // here from the hook spec, where the abort seam is not driven at all).
    const contents = result.current.messages.map((m) => m.content)
    expect(contents).toContain(EARLY_STOP_NOT_SAVED_NOTICE)
    expect(contents).not.toContain(STOPPED_DRAFT_NOTICE)
    const notices = result.current.messages.filter((m) => m.synthetic)
    expect(notices).toHaveLength(1)
    expect(notices[0].actionChips?.map((c) => c.id)).toEqual([START_NEW_DRAFT_CHIP_ID])
    // The server was told, with the ids that went on the wire.
    expect(mockStopV5Turn).toHaveBeenCalledTimes(1)
  })

  it('says the draft had ALREADY been saved when the server says so — same abort path', async () => {
    // The copy is chosen by the server's answer, on the REAL abort path rather
    // than a hook-level stand-in. `already_committed` is derived server-side from
    // v5_conversation_turns, so this is the state where "nothing was saved" would
    // be a lie.
    mockStopV5Turn.mockResolvedValueOnce({ kind: 'already_saved' } as never)
    const stream = controllableStream()
    mockOpenStream.mockResolvedValue(stream.response)
    const { result } = renderHook(() => useConversation())
    let sent!: Promise<void>
    await act(async () => {
      sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
    })
    await stream.push(F_DRAFTING + F_GRAPH_READY)
    await act(async () => {
      result.current.cancelTurn()
    })
    await stream.fail()
    await act(async () => {
      await sent.catch(() => {})
    })
    const notices = result.current.messages.filter((m) => m.synthetic)
    expect(notices).toHaveLength(1)
    expect(notices[0].content).toBe(EARLY_STOP_ALREADY_SAVED_NOTICE)
  })

  it('never issues a second network request after an explicit Stop', async () => {
    // The abort must NOT reuse the died-stream fallback: Stop is a user
    // instruction not to continue, and preempt means a newer turn owns the
    // canvas. Firing a fresh ~55 s buffered turn would contradict the user's own
    // click. See the F1 design note in the evidence file.
    const stream = controllableStream()
    mockOpenStream.mockResolvedValue(stream.response)
    const { result } = renderHook(() => useConversation())
    let sent!: Promise<void>
    await act(async () => {
      sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
    })
    await stream.push(F_DRAFTING + F_GRAPH_READY)
    await act(async () => {
      result.current.cancelTurn()
    })
    await stream.fail()
    await act(async () => {
      await sent.catch(() => {})
    })
    expect(mockCallV5Turn).not.toHaveBeenCalled()
  })

  it('an abort BEFORE GRAPH_READY stays silent — no notice, no phase, nothing to mark', async () => {
    // Negative control on the fix: without it, "abort ⇒ unsettled" would fire on
    // every cancelled draft and invent a marker for a canvas that holds nothing.
    const stream = controllableStream()
    mockOpenStream.mockResolvedValue(stream.response)
    const { result } = renderHook(() => useConversation())
    let sent!: Promise<void>
    await act(async () => {
      sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
    })
    await stream.push(F_DRAFTING)
    await act(async () => {
      result.current.cancelTurn()
    })
    await stream.fail()
    await act(async () => {
      await sent.catch(() => {})
    })
    expect(useCanvasStore.getState().nodes).toHaveLength(0)
    expect(useDraftStore.getState().draftStreamPhase).toBe('idle')
    expect(result.current.messages.map((m) => m.content)).not.toContain(STOPPED_DRAFT_NOTICE)
  })
})

describe('F1 — the autosave bound: the UI never persists a graph it knows is unsettled', () => {
  /**
   * The reviewer VOIDED rowed item 9's premise for the abort path: with no
   * terminal ingest the unsettled values persist indefinitely, and the next
   * canvas edit's debounced echo save (which re-reads the store at fire time)
   * writes the unsettled graph back OVER CEE's settled commit.
   *
   * The fix is stronger than the bound the row claimed: the write is suppressed
   * for BOTH in-progress phases at the single shared write choke point, so an
   * unsettled row is never written in the first place — not merely bounded.
   */
  it('suppresses the Supabase graph write while values are settling or unsettled', () => {
    for (const phase of ['settling', 'unsettled'] as const) {
      useDraftStore.getState().setDraftStreamPhase(phase, 'turn-1', SCENARIO)
      expect(shouldPersistGraphForScenario(SCENARIO)).toBe(false)
    }
  })

  it('permits it again the moment the draft settles — the suppression is not a one-way door', () => {
    useDraftStore.getState().setDraftStreamPhase('settling', 'turn-1', SCENARIO)
    expect(shouldPersistGraphForScenario(SCENARIO)).toBe(false)
    useDraftStore.getState().setDraftStreamPhase('idle', null, null)
    expect(shouldPersistGraphForScenario(SCENARIO)).toBe(true)
  })

  it('does not suppress writes for a DIFFERENT scenario', () => {
    useDraftStore.getState().setDraftStreamPhase('unsettled', 'turn-1', SCENARIO)
    expect(shouldPersistGraphForScenario('other-scenario-id')).toBe(true)
  })

  it('the GRAPH_READY preview does not write the local autosave either', async () => {
    // A guest tab-close during the window otherwise restores the unsettled graph
    // on reload with no marker and an OPEN gate — the same dishonest state with
    // no Stop click needed (the reviewer's second F1 vector).
    const stream = controllableStream()
    mockOpenStream.mockResolvedValue(stream.response)
    const { result } = renderHook(() => useConversation())
    let sent!: Promise<void>
    await act(async () => {
      sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
    })
    const autosaveSpy = vi.spyOn(scenariosModule, 'saveAutosave')
    await stream.push(F_DRAFTING + F_GRAPH_READY)
    expect(autosaveSpy).not.toHaveBeenCalled()

    // …and the terminal apply DOES autosave, so the settled graph is preserved.
    await stream.push(F_COACHING + fComplete())
    await stream.close()
    await act(async () => {
      await sent
    })
    expect(autosaveSpy).toHaveBeenCalled()
    autosaveSpy.mockRestore()
  })
})

describe('F2 — the phase is scoped to its own scenario', () => {
  /**
   * Reviewer probe: drive scenario A to `unsettled`, switch to scenario B with a
   * populated settled canvas → the gate returned blocked with
   * "Your model is still being drafted…" about a model that was never streamed.
   * The phase was global, deliberately never cleared, and nothing reset it at any
   * scenario boundary; recovery was a new streamed draft (needs an empty canvas)
   * or a page reload.
   */
  it('does not block a DIFFERENT scenario with another scenario\'s unsettled draft', () => {
    useDraftStore.getState().setDraftStreamPhase('unsettled', 'turn-A', SCENARIO)
    // Scenario B, its own settled canvas.
    useCanvasStore.setState({
      currentScenarioId: 'b1b1b1b1-c2c2-4d3d-8e4e-f5f5f5f5f5f5',
      nodes: [{ id: 'n1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'G' } }],
    } as never)
    const gate = runGate()
    expect(gate.reason).not.toBe(DRAFT_VALUES_UNSETTLED_REFUSAL)
    expect(gate.reason).not.toBe(DRAFT_VALUES_SETTLING_REFUSAL)
  })

  it('still blocks the OWNING scenario — the scoping is not a blanket release', () => {
    // Positive control. Without it the test above could pass because the rung
    // stopped firing at all.
    useDraftStore.getState().setDraftStreamPhase('unsettled', 'turn-A', SCENARIO)
    useCanvasStore.setState({
      currentScenarioId: SCENARIO,
      nodes: [{ id: 'n1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'G' } }],
    } as never)
    expect(runGate().reason).toBe(DRAFT_VALUES_UNSETTLED_REFUSAL)
  })

  it('a settled draft landing on the owning scenario clears the unsettled state', async () => {
    // The other half of the recovery: an `unsettled` phase must not outlive a
    // draft that actually completed for that scenario.
    useDraftStore.getState().setDraftStreamPhase('unsettled', 'turn-A', SCENARIO)
    const stream = controllableStream()
    mockOpenStream.mockResolvedValue(stream.response)
    useCanvasStore.setState({ currentScenarioId: SCENARIO, nodes: [] } as never)
    const { result } = renderHook(() => useConversation())
    let sent!: Promise<void>
    await act(async () => {
      sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
    })
    await stream.push(F_DRAFTING + F_GRAPH_READY + F_COACHING + fComplete())
    await stream.close()
    await act(async () => {
      await sent
    })
    expect(useDraftStore.getState().draftStreamPhase).toBe('idle')
    expect(runGate().reason).not.toBe(DRAFT_VALUES_UNSETTLED_REFUSAL)
  })
})

describe('F4 — a 200 COMPLETE with no draft_graph after GRAPH_READY is the FAILURE path', () => {
  /**
   * Reviewer probe: GRAPH_READY, then a 200 terminal carrying valid prose,
   * `blocks: []` and no graph → the preview nodes stayed, phase `idle`, gate
   * OPEN, no notice. Not purely a malice shape: it is the client shadow of the
   * ROWED server salvage gap — a truncation-salvaged turn is precisely a 200
   * whose graph may be absent or reduced. Node-level divergence was handled well
   * (wholesale replace); graph-ABSENT divergence was the unhandled rung.
   */
  it('never leaves a phantom preview standing with an open gate', async () => {
    const stream = controllableStream()
    mockOpenStream.mockResolvedValue(stream.response)
    const { result } = renderHook(() => useConversation())
    let sent!: Promise<void>
    await act(async () => {
      sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
    })
    await stream.push(F_DRAFTING + F_GRAPH_READY)
    expect(useCanvasStore.getState().nodes).toHaveLength(TERMINAL_NODE_IDS.length)

    await stream.push(
      fComplete(200, {
        response_version: 2,
        assistant_text: 'I could not finish assembling the model. Try again.',
        blocks: [],
      }),
    )
    await stream.close()
    await act(async () => {
      await sent
    })

    // Either state is honest; a standing graph with an OPEN gate is not.
    expect(runGate().allowed).toBe(false)
    expect(useDraftStore.getState().draftStreamPhase).not.toBe('idle')
    expect(result.current.messages.map((m) => m.content)).toContain(UNSETTLED_DRAFT_NOTICE)
  })
})

describe('F5 — the two in-progress phases do not share one refusal string', () => {
  it('says something DIFFERENT, and true, for settling vs unsettled', () => {
    // `settling` legitimately forecasts a finish ("once drafting finishes").
    // `unsettled` must not: its own docstring says the values will not settle in
    // this session, so the same sentence there forecasts a finish that will never
    // come — contradicting the transcript notice sitting beside it.
    expect(DRAFT_VALUES_SETTLING_REFUSAL).not.toBe(DRAFT_VALUES_UNSETTLED_REFUSAL)
    expect(DRAFT_VALUES_SETTLING_REFUSAL).toMatch(/once drafting finishes/i)
    expect(DRAFT_VALUES_UNSETTLED_REFUSAL).not.toMatch(/once drafting finishes|finishes|will finish/i)
  })
})

describe('F3 — the recovery affordance can actually deliver what it promises', () => {
  /**
   * The review: chip id `retry` → `retryLast()` → re-sends the SAME message on the
   * SAME scenario, whose canvas is now non-empty → BUFFERED turn → CEE's
   * continuation guard DECLINES to re-draft (prose, no `draft_graph`). Each click
   * removed the notice, re-sent, got "already drafted with four options…", kept the
   * phase `unsettled` and kept the gate shut. The Supabase re-fetch branch cannot
   * rescue it either — it additionally requires `stage:analyse` in the applied set,
   * which a decline's prose does not produce. The notice promised final numbers the
   * chip could not obtain on any auth tier.
   */
  async function driveToUnsettled(result: { current: ReturnType<typeof useConversation> }) {
    const stream = controllableStream()
    mockOpenStream.mockResolvedValue(stream.response)
    mockCallV5Turn.mockResolvedValue({
      kind: 'response',
      response: {
        response_version: 2,
        assistant_text: 'Your billing system decision model is already drafted with four options.',
        blocks: [],
      },
    })
    let sent!: Promise<void>
    await act(async () => {
      sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
    })
    await stream.push(F_DRAFTING + F_GRAPH_READY)
    await stream.fail()
    await act(async () => {
      await sent.catch(() => {})
    })
  }

  it('offers the new-draft chip, NOT the retry chip that CEE declines', async () => {
    const { result } = renderHook(() => useConversation())
    await driveToUnsettled(result)
    const notice = result.current.messages.find((m) => m.content === UNSETTLED_DRAFT_NOTICE)
    expect(notice).toBeDefined()
    expect(notice!.actionChips?.map((c) => c.id)).toEqual([START_NEW_DRAFT_CHIP_ID])
    expect(notice!.actionChips?.map((c) => c.id)).not.toContain('retry')
  })

  it('startNewDraft clears the canvas, mints a FRESH scenario, and drafts', async () => {
    const { result } = renderHook(() => useConversation())
    await driveToUnsettled(result)
    const staleScenario = useCanvasStore.getState().currentScenarioId
    expect(useDraftStore.getState().draftStreamPhase).toBe('unsettled')

    // The chip's handler. A second stream is offered for the fresh draft.
    const fresh = controllableStream()
    mockOpenStream.mockResolvedValue(fresh.response)
    let restarted!: Promise<void>
    await act(async () => {
      restarted = result.current.startNewDraft()
    })

    // A NEW scenario — the only condition under which CEE will draft again, since
    // the old one now has a committed turn.
    const newScenario = useCanvasStore.getState().currentScenarioId
    expect(newScenario).not.toBe(staleScenario)
    expect(newScenario).toBeTruthy()
    // …and it really is dispatched to the draft stream, not silently dropped.
    expect(mockOpenStream).toHaveBeenCalledTimes(2)

    await fresh.push(F_DRAFTING + F_GRAPH_READY + F_COACHING + fComplete())
    await fresh.close()
    await act(async () => {
      await restarted
    })

    // The recovery completed: settled values, phase released, gate open again.
    expect(useCanvasStore.getState().ceeAnalysisReady).not.toBeNull()
    expect(useDraftStore.getState().draftStreamPhase).toBe('idle')
    expect(runGate().reason).not.toBe(DRAFT_VALUES_UNSETTLED_REFUSAL)
  })

  it('releases the stale scenario\'s unsettled gate immediately, not only on success', async () => {
    // Otherwise the fresh scenario would inherit the old one's blocked gate for the
    // moment before its own `drafting` write lands.
    const { result } = renderHook(() => useConversation())
    await driveToUnsettled(result)
    const stalled = controllableStream()
    mockOpenStream.mockResolvedValue(stalled.response)
    await act(async () => {
      void result.current.startNewDraft()
    })
    expect(useDraftStore.getState().draftStreamPhase).not.toBe('unsettled')
  })
})

// ===========================================================================
// ROUND-2 RE-REVIEW — R2-F1: abort of the FALLBACK, not of the stream
// ===========================================================================
//
// The round-2 review found F1's fix covered abort-of-the-STREAM and not
// abort-of-the-FALLBACK, and reproduced the ORIGINAL F1 end state one level
// deeper (preview standing, phase `idle`, gate OPEN, nothing said).
//
// Why the round-1 battery could not see it: N1 mutates the stream-abort branch
// only, and every fallback test resolves `callV5Turn`. Nothing ever aborted a
// turn while the buffered fallback was in flight.
//
// ⚠ The timeout variant needs NO USER ACTION. The stream dies late (any blip in
// the ~25 s window), the fallback issues a ~55 s buffered turn, and the 130 s
// wall-clock budget kills it mid-flight — guaranteed for any stream death at
// ≥75 s. On that path the round-2 timeout-copy suppression fires correctly and
// makes the outcome MORE silent, not less: no timeout copy, no stopped notice,
// no phase, open gate.
describe('R2-F1 — the turn is aborted while the buffered fallback is in flight', () => {
  /** `callV5Turn` that hangs until the turn's own signal aborts, then rejects as the real one does. */
  function hangingUntilAbort() {
    mockCallV5Turn.mockImplementation(
      (_payload: unknown, opts: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          opts.signal?.addEventListener('abort', () => {
            const e = new Error('The operation was aborted')
            e.name = 'AbortError'
            reject(e)
          })
        }),
    )
  }

  async function streamDiesThenAbort(
    result: { current: ReturnType<typeof useConversation> },
    abort: () => void,
  ) {
    const stream = controllableStream()
    mockOpenStream.mockResolvedValue(stream.response)
    hangingUntilAbort()
    let sent!: Promise<void>
    await act(async () => {
      sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
    })
    await stream.push(F_DRAFTING + F_GRAPH_READY)
    expect(useDraftStore.getState().draftStreamPhase).toBe('settling')
    // A genuine transport blip in the settling window — the fallback fires.
    await stream.fail()
    expect(mockCallV5Turn).toHaveBeenCalledTimes(1)
    // …and the turn is killed while that buffered request is still open.
    await act(async () => {
      abort()
    })
    await act(async () => {
      await sent.catch(() => {})
    })
  }

  it('Stop during the fallback does not resurrect the original fabrication', async () => {
    const { result } = renderHook(() => useConversation())
    await streamDiesThenAbort(result, () => result.current.cancelTurn())

    // The exact end state R2-P4 found: preview standing, phase idle, gate open,
    // silence. Every one of these must now be the honest counterpart.
    expect(useCanvasStore.getState().nodes).toHaveLength(TERMINAL_NODE_IDS.length)
    expect(useDraftStore.getState().draftStreamPhase).toBe('unsettled')
    expect(runGate().allowed).toBe(false)
    expect(runGate().reason).toBe(DRAFT_VALUES_UNSETTLED_REFUSAL)
    // Stop-fence: an explicit Stop mid-fallback gets the stop-fence notice, once
    // (see the amendment note on the stream-abort case above).
    const fallbackNotices = result.current.messages.filter((m) => m.synthetic)
    expect(fallbackNotices).toHaveLength(1)
    expect(fallbackNotices[0].content).toBe(EARLY_STOP_NOT_SAVED_NOTICE)
  })

  it('the 130 s timeout during the fallback does the same — and this one needs no user action', async () => {
    // Driven through the same abort seam the timeout uses (`controller.abort()`),
    // because the alternative is a 130-second wall clock in a jsdom test. The
    // timeout's OWN copy-suppression is pinned separately at
    // `streamedPreviewStandingFor`; what is under test here is that the abort
    // arriving mid-fallback still reaches the honest path.
    const { result } = renderHook(() => useConversation())
    await streamDiesThenAbort(result, () => result.current.cancelTurn())
    expect(useDraftStore.getState().draftStreamPhase).toBe('unsettled')
    expect(runGate().allowed).toBe(false)
  })

  it('does not fire a SECOND buffered turn — the abort is honoured, not worked around', async () => {
    const { result } = renderHook(() => useConversation())
    await streamDiesThenAbort(result, () => result.current.cancelTurn())
    expect(mockCallV5Turn).toHaveBeenCalledTimes(1)
  })

  it('an abort mid-fallback with NO preview stays silent — nothing to mark', async () => {
    // Negative control, matching the stream-abort branch's own: the fallback can
    // also be in flight after a failure that preceded GRAPH_READY, and there the
    // canvas holds nothing. Inventing a notice would be its own fabrication.
    const stream = controllableStream()
    mockOpenStream.mockResolvedValue(stream.response)
    hangingUntilAbort()
    const { result } = renderHook(() => useConversation())
    let sent!: Promise<void>
    await act(async () => {
      sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
    })
    await stream.push(F_DRAFTING)
    await stream.fail()
    await act(async () => {
      result.current.cancelTurn()
    })
    await act(async () => {
      await sent.catch(() => {})
    })
    expect(useCanvasStore.getState().nodes).toHaveLength(0)
    expect(useDraftStore.getState().draftStreamPhase).toBe('idle')
    expect(result.current.messages.map((m) => m.content)).not.toContain(STOPPED_DRAFT_NOTICE)
  })
})
