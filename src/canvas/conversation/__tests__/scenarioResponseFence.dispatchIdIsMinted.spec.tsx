/**
 * The diverging row is UNREACHABLE — demonstrated by execution, not asserted.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE OBLIGATION THIS FILE DISCHARGES
 * ═══════════════════════════════════════════════════════════════════════════
 * `responseBelongsToDispatchingScenario` diverges from the expression it
 * replaces on exactly one row: BOTH ids null (and its `undefined` twin), where
 * the old `live === dispatch` said MATCH and this says REFUSE.
 * `scenarioResponseFence.spec.ts` pins that row exactly.
 *
 * The argument that the row cannot be reached from the five call sites is that
 * `scenarioIdAtDispatch` is never null there — `useConversation`'s sendTurn
 * lazily MINTS a UUID and writes it to the store, and only THEN captures the
 * dispatch id from the same synchronous block.
 *
 * ⭐ THAT ARGUMENT IS EXACTLY THE KIND THIS ESTATE HAS BEEN WRONG ABOUT IN BOTH
 * DIRECTIONS — an equivalent mutant must be DEMONSTRATED, never asserted. So it
 * is not left as reasoning about code. The turn below is driven for real from a
 * canvas whose `currentScenarioId` is NULL, and the id that actually goes on
 * the wire is inspected.
 *
 * If the mint ever stops guaranteeing this, the divergence becomes reachable and
 * this test reds — which is the alarm the prose could never be.
 *
 * Only the two network calls are mocked; the payload is read from the real
 * `openV5TurnStream` call arguments, so what is asserted is the id the client
 * genuinely dispatched.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import { useDraftStore } from '../../stores/draftStore'
import { responseBelongsToDispatchingScenario } from '../scenarioResponseFence'
import wireFixture from './fixtures/cee-draft-goal-constraints-wire.json'

const mockOpenStream = vi.fn()
const mockCallV5Turn = vi.fn()

vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()
  return { ...actual, openV5TurnStream: (...args: unknown[]) => mockOpenStream(...args) }
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

const TERMINAL_BODY = wireFixture as unknown as Record<string, unknown>
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function frame(obj: Record<string, unknown>): string {
  return `event: stage\ndata: ${JSON.stringify(obj)}\n\n`
}

/** A complete stream, pre-enqueued — this test cares about the REQUEST, not timing. */
function completedStream(): Response {
  const text =
    frame({ stage: 'DRAFTING', seq: 0, status: 'in_progress' }) +
    frame({
      stage: 'COMPLETE',
      seq: 4,
      status: 'complete',
      status_code: 200,
      payload: TERMINAL_BODY,
    })
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode(text))
      c.close()
    },
  })
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

/** The scenario id the client actually put on the wire. */
function dispatchedScenarioId(): unknown {
  expect(mockOpenStream).toHaveBeenCalled()
  const payload = mockOpenStream.mock.calls[0][0] as Record<string, unknown>
  return (payload.scenario_id ?? (payload.scenario as Record<string, unknown>)?.id) as unknown
}

beforeEach(() => {
  mockOpenStream.mockReset()
  mockCallV5Turn.mockReset()
  useDraftStore.getState().resetDraft()
  useCanvasStore.setState({
    // ⭐ THE PRECONDITION UNDER TEST: the canvas claims NO decision at all.
    currentScenarioId: null,
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
  vi.restoreAllMocks()
})

describe('the lazy mint guarantees a non-null dispatch id', () => {
  it('dispatches a real UUID even when the canvas started with NO scenario', async () => {
    // PRECONDITION, asserted rather than assumed — the whole demonstration
    // depends on this actually being null when the turn starts.
    expect(useCanvasStore.getState().currentScenarioId).toBeNull()

    mockOpenStream.mockResolvedValue(completedStream())
    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await (result.current.sendMessage('Should we build or buy a billing system?', {
        turnType: 'explicit_generate',
      }) as Promise<void>)
    })

    const dispatched = dispatchedScenarioId()
    expect(dispatched).not.toBeNull()
    expect(dispatched).not.toBeUndefined()
    expect(String(dispatched)).toMatch(UUID_RE)
  })

  /**
   * ⭐ THE CONSEQUENCE THAT MAKES THE DIVERGENCE UNREACHABLE. With a non-null
   * dispatch id, the `null vs null` row cannot arise at any of the five sites,
   * whatever the live id does — so the one place this predicate differs from
   * the expression it replaced is not reachable from them.
   */
  it('so the diverging row cannot arise at a call site, for ANY live value', () => {
    const dispatchedLikeAMintedId = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
    for (const live of [null, undefined, '', 'A', dispatchedLikeAMintedId]) {
      // With a non-null dispatch id the predicate is plain equality — i.e.
      // byte-identical to the original expression on every reachable row.
      expect(responseBelongsToDispatchingScenario(live, dispatchedLikeAMintedId)).toBe(
        live === dispatchedLikeAMintedId,
      )
    }
  })

  /** The store keeps the minted id, so later sites compare against the same value. */
  it('writes the minted id back to the store, which is what the later sites read', async () => {
    mockOpenStream.mockResolvedValue(completedStream())
    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await (result.current.sendMessage('Should we build or buy a billing system?', {
        turnType: 'explicit_generate',
      }) as Promise<void>)
    })

    expect(String(useCanvasStore.getState().currentScenarioId)).toMatch(UUID_RE)
    expect(useCanvasStore.getState().currentScenarioId).toBe(dispatchedScenarioId())
  })
})
