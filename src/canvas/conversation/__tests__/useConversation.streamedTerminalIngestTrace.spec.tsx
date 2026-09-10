/**
 * THE END-STATE TEST: a streamed cold draft puts `_prompt_capture` into the
 * trace-store entry the debug bundle reads as `payloads.cee_response`.
 *
 * ── Why this file exists alongside the transport unit spec ────────────────
 * `streamedTurnTransport.terminalIngest.spec.ts` proves the RECORDER is
 * correct. It proves nothing about whether anything CALLS it — a test bound
 * to a helper rather than to the path is this estate's trap 3b/16, and it is
 * how a fix ships dark under a green suite. This spec drives the DEPLOYED
 * streamed path end to end (real SSE parse → real consumeStreamedDraftTurn →
 * real terminalPayloadToResponse → real parseV5Response) with only the
 * network seam mocked, and asserts on what the trace store actually received.
 *
 * ── The premise it pins ──────────────────────────────────────────────────
 * `_prompt_capture` is returned ONLY on a cold draft. `streamedDraftEligible`
 * is exactly the cold-draft predicate (zero nodes + explicit_generate, or
 * conversation-at-frame). So the one turn carrying the prompt is the one turn
 * that takes the streamed route. The first test pins that premise directly:
 * if the streamed route ever stops being the zero-node first draft, this file
 * must be re-pointed rather than quietly passing.
 *
 * Harness pattern is `useConversation.streamedDraft500Recovery.spec.tsx`'s.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'

import { useConversation, streamedDraftEligible } from '../useConversation'
import { useCanvasStore } from '../../store'
import { useDraftStore } from '../../stores/draftStore'
import { ADDITIVE_EXTENSIONS_KEY } from '../../../v5/responseParser'
import wireFixture from './fixtures/cee-draft-goal-constraints-wire.json'

const traceSpies = vi.hoisted(() => ({
  recordRequestPayload: vi.fn(),
  recordResponsePayload: vi.fn(),
  recordDataShapeAnomaly: vi.fn(),
}))
vi.mock('../../../lib/payload-trace-store', () => traceSpies)

const mockOpenStream = vi.fn()
const mockCallV5Turn = vi.fn()

vi.mock('../../../v5/stopTurn', () => ({
  stopV5Turn: () => Promise.resolve({ kind: 'not_saved' as const }),
  getV5StopEndpoint: () => 'https://cee.test/proxy/v5/turn/stop',
  STOP_ACK_BUDGET_MS: 5000,
}))

// `importOriginal` spread: `recordStreamedTerminalIngest` stays REAL, so this
// spec exercises the production recorder, not a stub of it.
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

// ---------------------------------------------------------------------------

/** The byte count measured at the CEE wire on 2026-09-10. */
const MEASURED_PROMPT_CHARS = 61_199
const SYSTEM_PROMPT = 'S'.repeat(MEASURED_PROMPT_CHARS)

/**
 * A REAL captured cold-draft terminal body, plus the `_prompt_capture` key CEE
 * now returns on that turn.
 *
 * ⚠ The base MUST be the captured wire fixture, not a shape typed here. A
 * hand-built body fails `OlumiResponseSchema` — measured: `parse_error, "body
 * did not match OlumiResponse schema"` — and `parseV5Response` then returns a
 * `parse_error` with NO additive sidecar at all. Every assertion below would
 * fail for the wrong reason, and worse, a version of this spec that only
 * checked "something was recorded" would have PASSED on that parse_error while
 * proving nothing about the prompt. A fixture you wrote yourself is not
 * evidence about the wire (trap 16-inverse).
 */
const TERMINAL_PAYLOAD = {
  ...(wireFixture as unknown as Record<string, unknown>),
  _prompt_capture: [
    {
      system_prompt: SYSTEM_PROMPT,
      system_prompt_chars: MEASURED_PROMPT_CHARS,
      system_prompt_sha256: 'f'.repeat(64),
      prompt_version: 'v21',
      prompt_hash: 'a'.repeat(40),
      resolved_model: 'claude-sonnet-4-5',
      resolution_source: 'registry',
      provider: 'anthropic',
      instance_id: 'srv-abc123',
      user_content_chars: 412,
      user_content_sha256: 'b'.repeat(64),
    },
  ],
}

function frame(obj: Record<string, unknown>): string {
  return `event: stage\ndata: ${JSON.stringify(obj)}\n\n`
}
const F_DRAFTING = frame({ stage: 'DRAFTING', seq: 0, status: 'in_progress' })
const fComplete = (payload: unknown) =>
  frame({ stage: 'COMPLETE', seq: 1, status: 'complete', status_code: 200, payload })

function controllableStream() {
  const encoder = new TextEncoder()
  let ctrl!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({ start(c) { ctrl = c } })
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
        try { ctrl.close() } catch { /* consumer already cancelled */ }
      }
      await settle()
    },
  }
}

const SCENARIO = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
const BRIEF = 'Should we replace our current CRM with HubSpot next quarter?'

async function runStreamedColdDraft(payload: unknown): Promise<void> {
  const stream = controllableStream()
  mockOpenStream.mockResolvedValue(stream.response)
  const { result } = renderHook(() => useConversation())
  let sent!: Promise<void>
  await act(async () => {
    sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
  })
  await stream.push(F_DRAFTING + fComplete(payload))
  await stream.close()
  await act(async () => { await sent })
}

/**
 * Identity binding (trap 19): the terminal-ingest record is THE one carrying a
 * parsed response body. The stream-open record's body is the marker object, so
 * a predicate that could match either would prove nothing.
 */
function terminalIngestRecord() {
  const calls = traceSpies.recordResponsePayload.mock.calls.map((c) => c[0])
  const ingest = calls.filter(
    (c) => (c.body as Record<string, unknown>)?.__trace_record_kind__ === undefined,
  )
  expect(ingest).toHaveLength(1)
  return ingest[0]
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  mockOpenStream.mockReset()
  mockCallV5Turn.mockReset()
  traceSpies.recordRequestPayload.mockReset()
  traceSpies.recordResponsePayload.mockReset()
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

describe('premise pin — the streamed route IS the cold draft that carries _prompt_capture', () => {
  it('takes the streamed route on a zero-node explicit_generate, and NOT on a populated canvas', () => {
    expect(
      streamedDraftEligible({
        turnType: 'explicit_generate',
        derivedStage: 'frame',
        isSystemEvent: false,
        nodeCountAtDispatch: 0,
      }),
    ).toBe(true)
    // The discriminating half: same turn, non-empty canvas → buffered route.
    expect(
      streamedDraftEligible({
        turnType: 'explicit_generate',
        derivedStage: 'frame',
        isSystemEvent: false,
        nodeCountAtDispatch: 7,
      }),
    ).toBe(false)
  })
})

describe('a streamed cold draft settles the turn in the payload trace store', () => {
  it('records a settled response for the TERMINAL FRAME at all', async () => {
    await runStreamedColdDraft(TERMINAL_PAYLOAD)
    // ⚠ `openV5TurnStream` is mocked in this harness, so the stream-OPEN
    // record is not written here — its own settle-exactly-once behaviour is
    // pinned by `streamedTurnTransport.trace.spec.ts`. What this harness can
    // see, and what did not exist before this change, is a response record
    // for the terminal frame. Pre-fix: ZERO.
    expect(traceSpies.recordResponsePayload).toHaveBeenCalledTimes(1)
    const record = terminalIngestRecord()
    // Bound by identity to the parsed turn, not to "a record exists": the
    // body must be the parsed OlumiResponse, never the open marker.
    expect(record.body).toMatchObject({
      assistant_text: (wireFixture as unknown as Record<string, unknown>).assistant_text,
    })
  })

  it('binds the terminal record by IDENTITY to its own request record', async () => {
    await runStreamedColdDraft(TERMINAL_PAYLOAD)
    const ingest = terminalIngestRecord()
    const reqIds = traceSpies.recordRequestPayload.mock.calls.map((c) => c[0].id)
    // The store drops a response whose id matches no request.
    expect(reqIds).toContain(ingest.id)
    // And it must NOT reuse the stream-open record's id: overwriting that
    // record would make it claim a turn outcome it never observed.
    // ...and it must be its OWN id. `recordStreamedTerminalIngest` mints a
    // fresh one rather than reusing the stream-open record's, because
    // overwriting that record would make it claim a turn outcome it never
    // observed — the invariant `streamedTurnTransport.trace.spec.ts` pins by
    // reference.
    expect(traceSpies.recordRequestPayload).toHaveBeenCalledTimes(1)
    expect(reqIds[0]).toBe(ingest.id)
  })

  it('⭐ THE END STATE: the recorded body carries the COMPLETE 61,199-char system prompt', async () => {
    await runStreamedColdDraft(TERMINAL_PAYLOAD)
    const body = terminalIngestRecord().body as Record<string, unknown>
    // ⚠ ENUMERABLE, not merely present. Property ACCESS reads a
    // non-enumerable property perfectly well, so `body[KEY] !== undefined`
    // passes even when the promotion is gone — while the redactor, which
    // walks `Object.keys`, silently drops the whole sidecar and the bundle
    // loses `_prompt_capture`. Measured: dropping the promotion left this
    // test green until this assertion was added.
    expect(Object.keys(body)).toContain(ADDITIVE_EXTENSIONS_KEY)
    const sidecar = body[ADDITIVE_EXTENSIONS_KEY] as any
    expect(sidecar).toBeDefined()
    const captured = sidecar._prompt_capture[0].system_prompt as string
    // Exact length, not presence: a presence assertion passes on a clip.
    expect(captured.length).toBe(MEASURED_PROMPT_CHARS)
    expect(captured).toBe(SYSTEM_PROMPT)
  })

  it('carries the provenance and the shape-only detection surface alongside it', async () => {
    await runStreamedColdDraft(TERMINAL_PAYLOAD)
    const body = terminalIngestRecord().body as Record<string, unknown>
    const cap = (body[ADDITIVE_EXTENSIONS_KEY] as any)._prompt_capture[0]
    expect(cap.prompt_version).toBe('v21')
    expect(cap.prompt_hash).toBe('a'.repeat(40))
    expect(cap.resolved_model).toBe('claude-sonnet-4-5')
    expect(cap.resolution_source).toBe('registry')
    expect(cap.provider).toBe('anthropic')
    expect(cap.instance_id).toBe('srv-abc123')
    expect(cap.system_prompt_sha256).toBe('f'.repeat(64))
    expect(cap.system_prompt_chars).toBe(MEASURED_PROMPT_CHARS)
    expect(cap.user_content_chars).toBe(412)
    expect(cap.user_content_sha256).toBe('b'.repeat(64))
  })

  it('files the terminal record where the ledger reads a TURN, not a transport leg', async () => {
    await runStreamedColdDraft(TERMINAL_PAYLOAD)
    const ingest = terminalIngestRecord()
    const req = traceSpies.recordRequestPayload.mock.calls
      .map((c) => c[0])
      .find((c) => c.id === ingest.id)
    // `deriveOutcome` short-circuits ANY `/turn/<sub>` endpoint to
    // `transport_leg` before it reads assistant_text, so a record filed on the
    // stream sibling leaves `turn_record_count` at zero for an answered turn.
    expect(req.endpoint).not.toMatch(/\/turn\/stream\/?$/)
    expect(ingest.status).toBe(200)
  })
})
