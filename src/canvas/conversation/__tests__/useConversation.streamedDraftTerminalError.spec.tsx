/**
 * F1 — DRAFT-STATE TRUTH: terminal failure AFTER GRAPH_READY must not destroy
 * the rendered model or claim nothing was drafted (PR1 / acceptance sentence 1).
 *
 * ── THE MEASURED DEFECT (deployed staging, 8 Aug 2026) ─────────────────────
 * `PHASE0-EVIDENCE-2026-07-28/olumi-poc-independent-review-2026-08-09.md`:
 * GRAPH_READY arrived at 96.981 s (21 nodes / 43 edges, committed server-side),
 * the terminal COMPLETE carried 504 UPSTREAM_TIMEOUT at 125.202 s — and the UI
 * REMOVED the rendered graph and told the user nothing was drafted, while a
 * grounded follow-up found the canonical model under the same scenario and
 * analysis then ran against it. The server commit was authoritative; the
 * client's discard asserted a falsehood.
 *
 * ── THE RECONCILIATION RULE THESE TESTS PIN ────────────────────────────────
 * The client cannot poll server state (no status route; guest RLS blocks
 * `scenarios` reads — see deliveryUnknown.ts's derivation), so the cheapest
 * authoritative check it holds is the terminal payload's own commit marker:
 *
 *   · the ONE class that PROVES no commit is `reason:
 *     "draft_graph_commit_failed"` (CEE route-v2.ts's `!dg.commitPerformed`
 *     envelope — fresh-journey-p0-diagnosis-2026-08-08.md §1.4, captured at
 *     the wire). For that class the preview is removed: the server said
 *     "Nothing was written", so removal states the truth.
 *   · every other ≥400 terminal after GRAPH_READY (the measured 504 class,
 *     proxy timeout bodies, unknown INTERNAL_ERRORs) leaves the commit
 *     UNKNOWABLE from this side — and measured-COMMON to have succeeded
 *     (CEE 2.709 first-write exemption; the 8 Aug case). The graph stays,
 *     the phase goes `unsettled` (run gate shut, never persisted by the UI),
 *     and ONE honest notice says exactly what is known.
 *
 * Harness = streamedDraftTurn.spec.ts's: a real ReadableStream through the
 * real streamStageFrames → consumeStreamedDraftTurn → parseV5Response →
 * routeV5Response, with only the network seams mocked.
 *
 * Mount-path note (trap 3b): these tests bind at useConversation, upstream of
 * both flag postures (the same `messages` array feeds ConversationPanel/
 * ChatThread under AI Panel v2 — deployed staging posture per netlify.toml
 * `VITE_FEATURE_AI_PANEL_V2 = "true"` — and DraftChat when it is off). The
 * DOM half renders ChatThread, the surface the deployed flags mount.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, render, screen, act, cleanup } from '@testing-library/react'

import { useConversation, START_NEW_DRAFT_CHIP_ID } from '../useConversation'
import { useCanvasStore } from '../../store'
import { useDraftStore, draftStreamPhaseFor, shouldPersistGraphForScenario } from '../../stores/draftStore'
import { canRunAnalysis } from '../../utils/canRunAnalysis'
import { assertsNonDelivery } from '../deliveryUnknown'
// Namespace import, deliberately: at the RED-first (pristine) run the new
// notice export does not exist yet, and a named import of a missing binding
// fails the whole file at COLLECT — which trap 2b says is invisible to every
// aggregate. The presence assertion below turns "export missing" into a
// named, countable RED instead.
import * as narration from '../../components/DraftLoadingAnimation'
import { ChatThread } from '../zones/ChatThread'
import type { ConversationMessage } from '../types'
import wireFixture from './fixtures/cee-draft-goal-constraints-wire.json'

// ---------------------------------------------------------------------------
// Network seams — the only things mocked (streamedDraftTurn.spec.ts's set)
// ---------------------------------------------------------------------------

const mockOpenStream = vi.fn()
const mockCallV5Turn = vi.fn()
const mockStopV5Turn = vi.fn((..._args: unknown[]) =>
  Promise.resolve({ kind: 'not_saved' as const }),
)

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
// Fixtures
// ---------------------------------------------------------------------------

const TERMINAL_BODY = wireFixture as unknown as Record<string, unknown>
const TERMINAL_GRAPH = TERMINAL_BODY.draft_graph as {
  nodes: Array<Record<string, unknown>>
  edges: Array<Record<string, unknown>>
}

/** Same identity derivation as streamedDraftTurn.spec.ts — the two shapes
 * cannot drift apart and make the identity pin vacuous. */
const READY_GRAPH = {
  nodes: TERMINAL_GRAPH.nodes.map((n) => ({ id: n.id, kind: n.kind, label: n.label })),
  edges: TERMINAL_GRAPH.edges.map((e) => ({ from: e.from, to: e.to, strength: { mean: 0 } })),
}
const TERMINAL_NODE_IDS = TERMINAL_GRAPH.nodes.map((n) => String(n.id)).sort()

/**
 * The 8 Aug measured class: a CEE boundary envelope carrying UPSTREAM_TIMEOUT
 * on the terminal COMPLETE frame. Shape per the live BoundaryError wire
 * (useConversation.transcriptHonesty504.spec.ts's BOUNDARY_ERROR_BODY family);
 * the reason is CEE's typed timeout reason (`mapDraftGraphPipelineReason`).
 * NOT a commit-failure proof — the commit ordinarily stands for this class.
 */
const CEE_504_UPSTREAM_TIMEOUT = {
  error: 'UPSTREAM_TIMEOUT',
  boundary: 'B1',
  direction: 'egress',
  validator: 'draft_graph_pipeline',
  details: {
    retryable: true,
    reason: 'draft_graph_cee_timeout',
  },
}

/** The Netlify/Render proxy's own timeout body (dress rehearsal 2026-07-20,
 * wire/001-504) — the transport-class sibling. Also not a commit proof. */
const PROXY_504_BODY = {
  code: 'PROXY_UPSTREAM_TIMEOUT',
  message:
    'The model generation service did not respond within 125s. This can happen under heavy load. Please try again.',
  request_id: '6f30b61f-b596-45c2-ac3e-9f40db7513a9',
}

/**
 * The ONE class that proves the commit failed: CEE route-v2's
 * `!dg.commitPerformed` envelope (fresh-journey-p0-diagnosis §1.4, wire
 * capture: `{error: INTERNAL_ERROR, validator: turn_commit, reason:
 * draft_graph_commit_failed, retryable: true}`).
 */
const CEE_500_COMMIT_FAILED = {
  error: 'INTERNAL_ERROR',
  boundary: 'B1',
  direction: 'egress',
  validator: 'turn_commit',
  details: {
    retryable: true,
    reason: 'draft_graph_commit_failed',
  },
}

function frame(obj: Record<string, unknown>): string {
  return `event: stage\ndata: ${JSON.stringify(obj)}\n\n`
}

const F_DRAFTING = frame({ stage: 'DRAFTING', seq: 0, status: 'in_progress' })
const F_GRAPH_READY = frame({
  stage: 'GRAPH_READY',
  seq: 2,
  status: 'in_progress',
  schema_version: 'v3',
  elapsed_ms: 96_981,
  graph: READY_GRAPH,
})
const fCompleteError = (statusCode: number, payload: unknown) =>
  frame({ stage: 'COMPLETE', seq: 4, status: 'complete', status_code: statusCode, payload })

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
  }
}

const SCENARIO = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
const BRIEF =
  'How should we lift net revenue retention from 96% to 110% by March 2027 without breaking the £650k programme cap?'

interface HookHarness {
  messages: ConversationMessage[]
  lastSendFailure: unknown
}

/** Drive one streamed draft: DRAFTING → GRAPH_READY → COMPLETE(error). */
async function runDraftToTerminalError(
  statusCode: number,
  payload: unknown,
): Promise<HookHarness> {
  const stream = controllableStream()
  mockOpenStream.mockResolvedValue(stream.response)
  const { result } = renderHook(() => useConversation())
  let sent!: Promise<void>
  await act(async () => {
    sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
  })
  await stream.push(F_DRAFTING + F_GRAPH_READY)
  // Precondition pin (trap 13b): the preview must actually be standing before
  // the terminal error arrives, or every retention assertion below is vacuous.
  expect(useCanvasStore.getState().nodes.map((n) => n.id).sort()).toEqual(TERMINAL_NODE_IDS)
  await stream.push(fCompleteError(statusCode, payload))
  await stream.close()
  await act(async () => {
    await sent
  })
  return {
    messages: result.current.messages,
    lastSendFailure: (result.current as unknown as { lastSendFailure: unknown }).lastSendFailure,
  }
}

/** The kept-model notice, asserted to EXIST before it is used (see the
 * namespace-import note above). */
function keptModelNotice(): string {
  const notice = (narration as Record<string, unknown>).DRAFT_FAILED_MODEL_KEPT_NOTICE
  expect(typeof notice, 'DRAFT_FAILED_MODEL_KEPT_NOTICE must be exported by DraftLoadingAnimation').toBe('string')
  return notice as string
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
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
    lastAuthoritativeGraph: null,
    results: { status: 'idle' } as never,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// The measured 504 class — model KEPT, honest disclosure
// ---------------------------------------------------------------------------

describe.each([
  ['CEE UPSTREAM_TIMEOUT envelope (the 8 Aug measured class)', 504, CEE_504_UPSTREAM_TIMEOUT],
  ['proxy PROXY_UPSTREAM_TIMEOUT body (transport-class sibling)', 504, PROXY_504_BODY],
])('terminal %s after GRAPH_READY', (_label, statusCode, payload) => {
  it('keeps the rendered model on the canvas — the server commit is not the client’s to destroy', async () => {
    await runDraftToTerminalError(statusCode, payload)
    // Identity-bound retention: the exact preview node set, not "some nodes".
    expect(useCanvasStore.getState().nodes.map((n) => n.id).sort()).toEqual(TERMINAL_NODE_IDS)
  })

  it('marks the draft unsettled: run gate shut, graph never persisted by the UI', async () => {
    await runDraftToTerminalError(statusCode, payload)
    expect(draftStreamPhaseFor(useDraftStore.getState(), SCENARIO)).toBe('unsettled')
    // The gate consumes the phase (same call shape as OutputsDock).
    const gate = canRunAnalysis({
      graphHealth: null,
      readiness: null,
      hasBlockers: false,
      nodeCount: useCanvasStore.getState().nodes.length,
      draftStreamPhase: draftStreamPhaseFor(useDraftStore.getState(), SCENARIO),
    })
    expect(gate.allowed).toBe(false)
    // And the unsettled preview must never reach `scenarios.graph` from here.
    expect(shouldPersistGraphForScenario(SCENARIO)).toBe(false)
  })

  it('renders EXACTLY ONE synthetic notice — the honest one, with the affordance that works', async () => {
    const { messages } = await runDraftToTerminalError(statusCode, payload)
    const synthetic = messages.filter((m) => m.role === 'assistant' && m.synthetic === true)
    // One message owns this state. A second bubble (the generic failure copy)
    // would either contradict the notice or duplicate it.
    expect(synthetic).toHaveLength(1)
    expect(synthetic[0].content).toBe(keptModelNotice())
    // The affordance that genuinely works (F3: retryLast provably cannot).
    expect(synthetic[0].actionChips?.map((c) => c.id)).toEqual([START_NEW_DRAFT_CHIP_ID])
  })

  it('claims non-delivery NOWHERE — no message may assert the draft did not happen', async () => {
    const { messages } = await runDraftToTerminalError(statusCode, payload)
    for (const m of messages) {
      expect(assertsNonDelivery(m.content ?? ''), `message asserts non-delivery: "${m.content}"`).toBe(false)
    }
  })

  it('the user bubble reads as DELIVERED — GRAPH_READY is proof the server processed it', async () => {
    const { messages } = await runDraftToTerminalError(statusCode, payload)
    const userBubbles = messages.filter((m) => m.role === 'user')
    expect(userBubbles).toHaveLength(1)
    expect(userBubbles[0].deliveryState ?? 'sent').toBe('sent')
  })

  it('raises no send-failure banner — the send demonstrably succeeded', async () => {
    const { lastSendFailure } = await runDraftToTerminalError(statusCode, payload)
    expect(lastSendFailure).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// The PROVEN commit failure — removal states the truth
// ---------------------------------------------------------------------------

describe('terminal 500 whose payload PROVES the commit failed (draft_graph_commit_failed)', () => {
  it('removes the preview — the server said "Nothing was written", and keeping it would be the phantom model', async () => {
    await runDraftToTerminalError(500, CEE_500_COMMIT_FAILED)
    expect(useCanvasStore.getState().nodes).toHaveLength(0)
    expect(useDraftStore.getState().draftStreamPhase).toBe('idle')
  })

  it('reports the failure plainly with a retry affordance, and does NOT show the kept-model notice', async () => {
    const { messages } = await runDraftToTerminalError(500, CEE_500_COMMIT_FAILED)
    const synthetic = messages.filter((m) => m.role === 'assistant' && m.synthetic === true)
    expect(synthetic).toHaveLength(1)
    // Discriminating pair with the kept-model cases: the SAME harness, only the
    // payload's reason differs, and the behaviour must differ in BOTH directions
    // (trap 19's mutant-pair rule, applied at the fixture level).
    expect(synthetic[0].content).not.toBe(keptModelNotice())
    // Wire retryable: true → the retry affordance is honest here (a re-send on a
    // scenario with NO committed graph is a fresh draft, not a duplicate).
    expect(synthetic[0].actionChips?.some((c) => c.id === 'retry')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// DOM half — the honest state as the deployed panel renders it (ChatThread)
// ---------------------------------------------------------------------------

describe('the kept-model notice reaches the DOM of the mounted thread', () => {
  it('renders the notice text and the start-new-draft chip in ChatThread', async () => {
    const { messages } = await runDraftToTerminalError(504, CEE_504_UPSTREAM_TIMEOUT)
    render(
      <ChatThread
        messages={messages}
        isThinking={false}
        longRunningHint={null}
        nodeCount={TERMINAL_NODE_IDS.length}
        patchBlockStates={new Map()}
        patchRejections={new Map()}
        onChipClick={async () => {}}
        onPatchAccept={() => {}}
        onPatchDismiss={() => {}}
        onFeedback={() => {}}
        onRetry={() => {}}
      />,
    )
    // jsdom proves presence, not layout (trap 3) — asserted as presence only.
    // The notice copy is deliberately free of em dashes and bullets, so
    // safeRichText's house-style substitutions leave it byte-stable and the
    // bubble's textContent carries it whole.
    const assistantBubbles = screen.getAllByTestId('message-assistant')
    const withNotice = assistantBubbles.filter((el) =>
      (el.textContent ?? '').includes(keptModelNotice()),
    )
    expect(withNotice).toHaveLength(1)
    // The affordance, on the surface the deployed flags mount.
    expect(screen.getByTestId(`suggested-chip-${START_NEW_DRAFT_CHIP_ID}`)).toBeTruthy()
  })
})
