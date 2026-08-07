/**
 * LIVE-CHAIN transcript-honesty tests — dress-rehearsal trust item #3
 * (2026-07-20): turns lost to a 504 displayed in the transcript as if sent,
 * so the assistant later appeared to deny visible conversation; the only
 * error copy lived in the collapsed-by-default dock.
 *
 * These tests drive the ACTUAL rehearsal wire shapes (the Netlify proxy's
 * 504 `PROXY_UPSTREAM_TIMEOUT` JSON body, a thrown network TypeError)
 * through the LIVE V5 branch: stubbed global fetch → REAL `callV5Turn` →
 * REAL `parseV5Response` → REAL `routeV5Response` → useConversation's V5
 * typed_error branch, unmocked (same harness discipline as
 * useConversation.v5ErrorRecovery.spec.ts — #391).
 *
 * What they pin:
 *  1. a user message whose turn failed carries `deliveryState: 'failed'`
 *     (the transcript marker MessageBubble renders as "Not delivered");
 *  2. the failure copy for a transport-class failure (504 proxy timeout /
 *     network error — no CEE body on the wire) is transport-honest: it says
 *     the message did not go through and nothing was lost, and does NOT
 *     claim a server-side processing fault ("Something went wrong on our
 *     side") or invent a CEE recovery suggestion;
 *  3. a CEE-class failure (strict BoundaryError body) keeps #391's recovery
 *     rendering AND now also marks the user message failed;
 *  4. retry-success turns the failed user message back into a normal sent
 *     message (`deliveryState: 'sent'`), with no duplicate user bubble —
 *     the failed marker must not persist as history the assistant would
 *     then "deny".
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { assertsNonDelivery, assertsDeliveryUnknown } from '../deliveryUnknown'
import { useCanvasStore } from '../../store'

// ---------------------------------------------------------------------------
// Mocks — seams only; the V5 adapter/parser/router chain stays REAL.
// ---------------------------------------------------------------------------

const mockCallTurn = vi.fn()
vi.mock('../turnService', () => ({
  callOrchestratorTurn: (...args: unknown[]) => mockCallTurn(...args),
  streamOrchestratorTurn: (...args: unknown[]) => mockCallTurn(...args),
  OrchestratorError: class OrchestratorError extends Error {
    status: number
    body: unknown
    constructor(msg: string, status: number, body: unknown) {
      super(msg)
      this.name = 'OrchestratorError'
      this.status = status
      this.body = body
    }
  },
}))

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

vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return {
    ...actual,
    isV5Eligible: () => ({ eligible: true }),
    isV5CanonicalRunPath: () => false,
  }
})

// ---------------------------------------------------------------------------
// Wire fixtures — the rehearsal captures, verbatim shapes
// ---------------------------------------------------------------------------

/** The Netlify proxy's 504 body from wire/001-504 (dress rehearsal 2026-07-20). */
const PROXY_504_BODY = {
  code: 'PROXY_UPSTREAM_TIMEOUT',
  message:
    'The model generation service did not respond within 125s. This can happen under heavy load. Please try again.',
  request_id: '6f30b61f-b596-45c2-ac3e-9f40db7513a9',
}

/** A strict live-wire BoundaryError (CEE-class failure — reached CEE). */
const BOUNDARY_ERROR_BODY = {
  error: 'INTERNAL_ERROR',
  boundary: 'B1',
  direction: 'egress',
  validator: 'draft_graph_pipeline',
  details: {
    retryable: true,
    reason: 'draft_graph_cee_timeout',
  },
  request_id: 'req_live_2',
  retryable: true,
}

/** Minimal valid OlumiResponse for the retry-success leg. */
const SUCCESS_BODY = {
  response_version: 2,
  assistant_text: 'Here is your draft.',
  blocks: [],
  suggested_actions: [],
  insights: [],
  stage_indicator: 'frame',
}

function stubFetchWith(status: number, body: unknown) {
  const fetchStub = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response))
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

beforeEach(() => {
  useCanvasStore.setState({
    currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
    nodes: [],
    edges: [],
    results: { status: 'idle' } as never,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('transcript honesty on 504 — failed sends look failed (LIVE V5 chain)', () => {
  it('504 proxy timeout: the user message is marked deliveryState unconfirmed', async () => {
    stubFetchWith(504, PROXY_504_BODY)
    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('Should we expand our coffee subscription into Germany or the UAE?')
    })

    const userMsg = result.current.messages.find((m) => m.role === 'user')
    expect(userMsg).toBeDefined()
    // The transcript marker: a turn that did not come back must not look
    // identical to a delivered one.
    //
    // ⚠ ROADMAP 2.665 — CORRECTED AT SOURCE, NOT BASELINED. This asserted
    // 'failed', and 'failed' renders "Not delivered" — a claim this client
    // cannot support for a PROXY timeout. The 504 body means the request
    // REACHED CEE and the proxy stopped waiting; CEE runs that turn to
    // completion and commits it (live-witnessed 2026-08-07: client gave up at
    // 60.0s, server returned 200 at 123.1s with rows written). 'unconfirmed'
    // is the honest state, and it is still visibly not-delivered-looking — see
    // deliveryUnknownHonesty.spec.tsx for the marker and the discriminating
    // pair that keeps a real network throw saying 'failed'.
    expect(userMsg?.deliveryState).toBe('unconfirmed')
  })

  it('504 proxy timeout: failure copy is transport-honest — no false server-fault claim, no invented recovery, retry offered', async () => {
    stubFetchWith(504, PROXY_504_BODY)
    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('coffee subscription brief')
    })

    const last = result.current.messages[result.current.messages.length - 1]
    expect(last.role).toBe('assistant')
    // ⚠ ROADMAP 2.665 — CORRECTED AT SOURCE. This used to require the copy to
    // say the message "didn't go through", and to offer a Retry. Both were
    // wrong for a PROXY 504 specifically: the request reached CEE, which
    // completes and commits the turn regardless, so non-delivery was never
    // verified — and the Retry asked a second time, because CEE keys its commit
    // on its own per-request id rather than on payload.turn_id.
    expect(assertsNonDelivery(last.content)).toBe(false)
    expect(assertsDeliveryUnknown(last.content)).toBe(true)
    expect(last.content).toContain('Nothing you typed was lost')
    // NOT the generic server-fault claim (that is the CEE-class copy).
    expect(last.content).not.toContain('Something went wrong on our side')
    // The proxy's machine code must never render.
    expect(last.content).not.toContain('PROXY_UPSTREAM_TIMEOUT')
    // No retry affordance while delivery is unverified.
    expect(last.actionChips ?? []).toEqual([])
    expect((result.current.lastSendFailure?.inputText ?? null)).toBe('coffee subscription brief')
  })

  it('504 proxy timeout: structured lastSendFailure fires with transport class (point-of-failure surfaces consume this)', async () => {
    stubFetchWith(504, PROXY_504_BODY)
    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('the brief text')
    })

    expect(result.current.lastSendFailure).toEqual(
      expect.objectContaining({
        kind: 'transport',
        // 2.665: copy-agrees-with-affordance — no retry is offered on an
        // unverified delivery, so none is advertised.
        retryable: false,
        inputText: 'the brief text',
      }),
    )
  })

  it('network failure (fetch throws): user message marked failed, transport-honest copy', async () => {
    const fetchStub = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    vi.stubGlobal('fetch', fetchStub)

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('offline brief')
    })

    const userMsg = result.current.messages.find((m) => m.role === 'user')
    expect(userMsg?.deliveryState).toBe('failed')
    const last = result.current.messages[result.current.messages.length - 1]
    expect(last.role).toBe('assistant')
    expect(last.content).toMatch(/didn’t reach|didn't reach|didn’t go through|didn't go through/)
    expect(last.content).not.toContain('Something went wrong on our side')
    expect(result.current.lastSendFailure?.kind).toBe('transport')
  })

  it('CEE-class BoundaryError: #391 copy preserved AND the user message is now marked failed', async () => {
    stubFetchWith(500, BOUNDARY_ERROR_BODY)
    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('draft my decision')
    })

    const userMsg = result.current.messages.find((m) => m.role === 'user')
    expect(userMsg?.deliveryState).toBe('failed')
    const last = result.current.messages[result.current.messages.length - 1]
    // CEE-class keeps the canonical taxonomy copy (server fault IS the truth here).
    expect(last.content).toContain('Something went wrong on our side. Please retry.')
    // And the class is server, not transport.
    expect(result.current.lastSendFailure?.kind).toBe('server')
  })

  it('retry-success: the original failed user message becomes a normal sent message, no duplicate user bubble, no lingering failed marker', async () => {
    // Leg 1: 504.
    stubFetchWith(504, PROXY_504_BODY)
    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('retry me')
    })
    const failedUser = result.current.messages.find((m) => m.role === 'user')
    // 2.665: a proxy 504 leaves delivery UNVERIFIED, not verified-failed.
    expect(failedUser?.deliveryState).toBe('unconfirmed')

    // Leg 2: retry succeeds.
    stubFetchWith(200, SUCCESS_BODY)
    await act(async () => {
      await result.current.retryLast()
    })

    const userMsgs = result.current.messages.filter((m) => m.role === 'user')
    expect(userMsgs).toHaveLength(1)
    expect(userMsgs[0].id).toBe(failedUser?.id)
    expect(userMsgs[0].deliveryState).toBe('sent')
    // The failure notice state clears on the fresh dispatch.
    expect(result.current.lastSendFailure).toBeNull()
    // And the assistant reply landed.
    const last = result.current.messages[result.current.messages.length - 1]
    expect(last.role).toBe('assistant')
    expect(last.content).toContain('Here is your draft.')
  })

  it('delivered turn: user message ends as sent, never failed, and no failure notice fires', async () => {
    stubFetchWith(200, SUCCESS_BODY)
    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('happy path')
    })

    const userMsg = result.current.messages.find((m) => m.role === 'user')
    expect(userMsg?.deliveryState).toBe('sent')
    expect(result.current.lastSendFailure).toBeNull()
  })
})
