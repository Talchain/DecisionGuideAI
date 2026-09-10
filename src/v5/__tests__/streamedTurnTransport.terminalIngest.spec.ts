/**
 * The streamed cold draft must SETTLE the turn in the trace store.
 *
 * `openV5TurnStream` records the SSE OPEN and, by design, nothing else. So a
 * streamed cold draft that succeeded left `payloads.cee_response` in the debug
 * bundle resolving to the OPEN MARKER, and every top-level key CEE returned
 * was absent from the export — including `_prompt_capture`, the verbatim
 * served system prompt, which CEE returns ONLY on a cold draft. That is the
 * one turn shape `streamedDraftEligible` sends down this route.
 *
 * The assertions here bind BY IDENTITY (the recorded id, the endpoint the
 * ledger classifies on, the sidecar key) rather than by "something was
 * recorded".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const traceSpies = vi.hoisted(() => ({
  recordRequestPayload: vi.fn(),
  recordResponsePayload: vi.fn(),
  recordDataShapeAnomaly: vi.fn(),
}))
vi.mock('../../lib/payload-trace-store', () => traceSpies)

import { ADDITIVE_EXTENSIONS_KEY } from '../responseParser'
import {
  recordStreamedTerminalIngest,
  STREAM_TERMINAL_INGEST_HEADER,
  STREAM_TERMINAL_INGEST_KIND,
} from '../streamedTurnTransport'
import { __internals as adapterInternals } from '../v5Adapter'
import { isV5TurnEndpoint } from '../../lib/v5TraceMatching'
import { redactPayload, DEBUG_BUNDLE_REDACTION_OPTIONS } from '../../utils/payloadRedaction'

const MEASURED_PROMPT_CHARS = 61_199

function parsedResponseWithPromptCapture() {
  const response: Record<string, unknown> = {
    response_version: '5.0',
    assistant_text: 'Here is a first draft.',
    blocks: [],
  }
  Object.defineProperty(response, ADDITIVE_EXTENSIONS_KEY, {
    value: Object.freeze({
      _prompt_capture: [
        {
          system_prompt: 'S'.repeat(MEASURED_PROMPT_CHARS),
          system_prompt_chars: MEASURED_PROMPT_CHARS,
          prompt_version: 'v21',
          resolved_model: 'claude-sonnet-4-5',
        },
      ],
    }),
    enumerable: false,
    configurable: false,
    writable: false,
  })
  return { kind: 'response' as const, response: response as never }
}

const PAYLOAD = { turn_type: 'explicit_generate', user_text: 'draft me a model' } as never

function ingest(parsed = parsedResponseWithPromptCapture()) {
  recordStreamedTerminalIngest({
    payload: PAYLOAD,
    parsed: parsed as never,
    statusCode: 200,
    durationMs: 61_000,
    headers: { 'x-request-id': 'req-abc' },
  })
  const req = traceSpies.recordRequestPayload.mock.calls[0]?.[0]
  const res = traceSpies.recordResponsePayload.mock.calls[0]?.[0]
  return { req, res }
}

describe('recordStreamedTerminalIngest', () => {
  beforeEach(() => {
    traceSpies.recordRequestPayload.mockClear()
    traceSpies.recordResponsePayload.mockClear()
  })

  it('settles the turn: exactly one request and one response, bound by the SAME id', () => {
    const { req, res } = ingest()
    expect(traceSpies.recordRequestPayload).toHaveBeenCalledTimes(1)
    expect(traceSpies.recordResponsePayload).toHaveBeenCalledTimes(1)
    expect(typeof req.id).toBe('string')
    expect(req.id.length).toBeGreaterThan(0)
    // Identity binding: a response recorded under any other id is dropped by
    // the store's `p.id !== params.id` guard and settles nothing.
    expect(res.id).toBe(req.id)
  })

  it('carries the parsed response body — NOT the stream-open marker', () => {
    const { res } = ingest()
    expect(res.body).toMatchObject({ assistant_text: 'Here is a first draft.' })
    expect((res.body as Record<string, unknown>).__trace_record_kind__).toBeUndefined()
  })

  it('promotes the additive sidecar so _prompt_capture survives Object.keys redaction', () => {
    const { res } = ingest()
    // The parser attaches the sidecar NON-ENUMERABLE; the redactor walks
    // Object.keys. Without promotion the key is gone before the bundle.
    expect(Object.keys(res.body as object)).toContain(ADDITIVE_EXTENSIONS_KEY)
    const sidecar = (res.body as Record<string, unknown>)[ADDITIVE_EXTENSIONS_KEY] as any
    expect(sidecar._prompt_capture[0].system_prompt.length).toBe(MEASURED_PROMPT_CHARS)
    expect(sidecar._prompt_capture[0].prompt_version).toBe('v21')
  })

  it('files the record under the BUFFERED endpoint, which is what the ledger classifies as a turn', () => {
    const { req } = ingest()
    const buffered = adapterInternals.resolveEndpoint()
    expect(req.endpoint).toBe(buffered)
    // The discriminating property: a `/turn/stream` endpoint is scored
    // `transport_leg` by `deriveOutcome` BEFORE assistant_text is read, so a
    // record filed there leaves `turn_record_count` at zero.
    expect(req.endpoint).not.toMatch(/\/turn\/stream\/?$/)
    expect(isV5TurnEndpoint({ service: 'CEE', endpoint: req.endpoint })).toBe(true)
  })

  it('discloses the real transport on the response headers rather than hiding it', () => {
    const { res } = ingest()
    expect(res.headers[STREAM_TERMINAL_INGEST_HEADER]).toBe(STREAM_TERMINAL_INGEST_KIND)
  })

  it('records the turn payload VERBATIM so request-body selectors still see the turn', () => {
    const { req } = ingest()
    expect(req.body).toBe(PAYLOAD)
    expect(req.method).toBe('POST')
  })

  it('carries the real status and duration', () => {
    const { res } = ingest()
    expect(res.status).toBe(200)
    expect(res.duration).toBe(61_000)
  })

  /**
   * ⭐ THE COMPOSITION TEST — the one that answers the actual question.
   *
   * Three separate things stood between CEE's `_prompt_capture` and the
   * browser: the redactor's 1000-char default, its 8000-char shared ceiling,
   * and this recorder not existing. Each has its own test, and three green
   * unit tests with a bundle that still clips is a failure. The trace store
   * redacts AT RECORD TIME (`payload-trace-store.ts` aliases
   * `DEBUG_BUNDLE_REDACTION_OPTIONS`), so this pipes the recorder's real
   * output through the redactor's real options — the exact seam — and checks
   * the byte count that started all this.
   */
  it('⭐ COMPOSED: the recorded body survives the store\'s own redaction pass with the 61,199-char prompt INTACT', () => {
    const { res } = ingest()
    // Not a re-implementation: the same constant the store passes.
    const stored = redactPayload(res.body, DEBUG_BUNDLE_REDACTION_OPTIONS) as any
    // The sidecar promotion must survive the Object.keys walk...
    expect(Object.keys(stored)).toContain(ADDITIVE_EXTENSIONS_KEY)
    // ...and the prompt inside it must arrive whole.
    const captured = stored[ADDITIVE_EXTENSIONS_KEY]._prompt_capture[0].system_prompt as string
    expect(captured.length).toBe(MEASURED_PROMPT_CHARS)
    expect(captured).not.toContain('truncated_by')
    // The shape-only detection surface rides along.
    expect(stored[ADDITIVE_EXTENSIONS_KEY]._prompt_capture[0].system_prompt_chars).toBe(
      MEASURED_PROMPT_CHARS,
    )
  })

  it('records a non-response parse result without inventing a body', () => {
    const { res } = ingest({ kind: 'parse_error', reason: 'bad shape' } as never)
    expect(res.body).toMatchObject({ kind: 'parse_error', reason: 'bad shape' })
  })
})
