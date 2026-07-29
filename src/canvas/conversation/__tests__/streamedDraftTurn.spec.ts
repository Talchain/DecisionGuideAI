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

import { useConversation, streamedDraftEligible } from '../useConversation'
import { useCanvasStore } from '../../store'
import { useDraftStore } from '../../stores/draftStore'
import { canRunAnalysis, DRAFT_VALUES_SETTLING_REFUSAL } from '../../utils/canRunAnalysis'
import { UNSETTLED_DRAFT_NOTICE } from '../../components/DraftLoadingAnimation'
import wireFixture from './fixtures/cee-draft-goal-constraints-wire.json'

// ---------------------------------------------------------------------------
// Network seam — the only thing mocked
// ---------------------------------------------------------------------------

const mockOpenStream = vi.fn()
const mockCallV5Turn = vi.fn()

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
  return canRunAnalysis({
    graphHealth: null,
    readiness: null,
    hasBlockers: false,
    nodeCount: useCanvasStore.getState().nodes.length,
    draftStreamPhase: useDraftStore.getState().draftStreamPhase,
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
    // The phase is terminal-unsettled, so the run gate stays shut …
    expect(useDraftStore.getState().draftStreamPhase).toBe('unsettled')
    expect(runGate().reason).toBe(DRAFT_VALUES_SETTLING_REFUSAL)
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
