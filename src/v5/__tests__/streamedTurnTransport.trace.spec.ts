/**
 * The streamed turn's trace entry SETTLES — the phantom failure, closed.
 *
 * ⭐ WHAT THIS FIXES, measured on a real session. `openV5TurnStream` recorded
 * the REQUEST side under a fresh `crypto.randomUUID()` that nothing else holds
 * and recorded no response on any path. `payload-trace-store` initialises
 * `completed: false` at request-record time and only `recordResponsePayload`
 * flips it, so every streamed turn left a `completed: false, status: null`
 * entry FOREVER — regardless of what the turn did.
 *
 * `isV5TurnEndpoint` admits `…/turn/stream` (its boundary is `(?:\/|$)`), so
 * that permanently-unsettled entry appeared in `recent_conversation_turns`
 * looking exactly like a turn that never finished. In the 2026-09-03 bundle
 * that entry is the session's COLD DRAFT, which succeeded: its 24-edge graph is
 * in the same bundle and an analysis ran on it nine minutes later. The ledger
 * manufactured a failure rather than hiding one, and only a cold draft can
 * produce it (`streamedDraftEligible` requires `nodeCountAtDispatch === 0`),
 * which is why exactly one of the session's 19 records looked like that.
 *
 * The pairs below matter: settling the entry must not make it CLAIM anything
 * about the turn. This record observes the SSE open and nothing else.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const traceSpies = vi.hoisted(() => ({
  recordRequestPayload: vi.fn(),
  recordResponsePayload: vi.fn(),
}))

vi.mock('../../lib/payload-trace-store', () => traceSpies)

import { openV5TurnStream, STREAM_OPEN_TRACE_BODY } from '../streamedTurnTransport'
import { StreamAbandonedError } from '../streamedDraftFrames'

const PAYLOAD = {
  kind: 'message',
  turn_id: '11111111-1111-4111-8111-111111111111',
  scenario_id: '22222222-2222-4222-8222-222222222222',
  stage: 'frame',
  turn_class: 'frame',
  message: 'Should we hire a sales team or stay founder-led?',
  source: 'composer',
} as never

function sseResponse(status = 200): Response {
  return new Response('event: stage\ndata: {"stage":"DRAFTING","seq":0,"status":"in_progress"}\n\n', {
    status,
    headers: { 'content-type': 'text/event-stream' },
  })
}

beforeEach(() => {
  traceSpies.recordRequestPayload.mockClear()
  traceSpies.recordResponsePayload.mockClear()
})

/** The one id the request side minted — the entry any response must settle. */
function recordedTraceId(): string {
  expect(traceSpies.recordRequestPayload).toHaveBeenCalledTimes(1)
  return traceSpies.recordRequestPayload.mock.calls[0][0].id as string
}

describe('a successful stream open settles its own trace entry', () => {
  it('records a response for the SAME id the request minted', () => {
    // Binding by IDENTITY, not by "a response was recorded": an entry settled
    // under a different id leaves the original unsettled forever, which is the
    // exact defect.
    return openV5TurnStream(PAYLOAD, { fetchImpl: (async () => sseResponse()) as never }).then(() => {
      const id = recordedTraceId()
      expect(traceSpies.recordResponsePayload).toHaveBeenCalledTimes(1)
      expect(traceSpies.recordResponsePayload.mock.calls[0][0].id).toBe(id)
    })
  })

  it('carries the real HTTP status of the open, not a placeholder', async () => {
    await openV5TurnStream(PAYLOAD, { fetchImpl: (async () => sseResponse(200)) as never })
    expect(traceSpies.recordResponsePayload.mock.calls[0][0].status).toBe(200)
  })

  it('does not read the SSE body — the caller still gets an unconsumed stream', async () => {
    const res = await openV5TurnStream(PAYLOAD, {
      fetchImpl: (async () => sseResponse()) as never,
    })
    expect(res.bodyUsed).toBe(false)
    await expect(res.text()).resolves.toContain('DRAFTING')
  })

  it('the recorded body names what the record IS, and claims no turn outcome', async () => {
    await openV5TurnStream(PAYLOAD, { fetchImpl: (async () => sseResponse()) as never })
    const body = traceSpies.recordResponsePayload.mock.calls[0][0].body
    expect(body).toBe(STREAM_OPEN_TRACE_BODY)
    // The ledger reads `assistant_text` off a response body. A stream-open
    // record must not carry one — a value there would be a claim about a turn
    // this record never observed.
    expect((body as Record<string, unknown>).assistant_text).toBeUndefined()
    expect(STREAM_OPEN_TRACE_BODY.__trace_record_kind__).toBe('stream_open')
  })
})

describe('a failed stream open settles with the SAME three-way cause split the buffered adapter writes', () => {
  it('an abort is browser_timeout', async () => {
    const aborting = async () => {
      const e = new Error('aborted')
      e.name = 'AbortError'
      throw e
    }
    await expect(openV5TurnStream(PAYLOAD, { fetchImpl: aborting as never })).rejects.toBeInstanceOf(
      StreamAbandonedError,
    )
    const call = traceSpies.recordResponsePayload.mock.calls[0][0]
    expect(call.id).toBe(recordedTraceId())
    expect(call.status).toBe(0)
    expect(call.source).toBe('browser_timeout')
    expect(call.errorName).toBe('AbortError')
  })

  it('a fetch throw is preflight_or_network — the pair', async () => {
    // Not the same failure and not the same advice. An abort means the turn may
    // well have committed; this means nothing left the client.
    const failing = async () => {
      throw new TypeError('Failed to fetch')
    }
    await expect(openV5TurnStream(PAYLOAD, { fetchImpl: failing as never })).rejects.toBeInstanceOf(
      StreamAbandonedError,
    )
    const call = traceSpies.recordResponsePayload.mock.calls[0][0]
    expect(call.source).toBe('preflight_or_network')
    expect(call.errorName).toBe('TypeError')
    expect(call.error).toBe('Failed to fetch')
  })

  it('anything else is unknown, rather than being guessed into one of the two', async () => {
    const odd = async () => {
      throw new RangeError('something else entirely')
    }
    await expect(openV5TurnStream(PAYLOAD, { fetchImpl: odd as never })).rejects.toBeInstanceOf(
      StreamAbandonedError,
    )
    expect(traceSpies.recordResponsePayload.mock.calls[0][0].source).toBe('unknown')
  })

  it('the abort still throws the ABORTED kind, and the throw still reaches the caller', async () => {
    // Settling the trace must not swallow the control flow the caller branches
    // on: `runStreamedDraftTurn` distinguishes an abort (leave the phase alone)
    // from a transport failure (fall back to the buffered turn).
    const aborting = async () => {
      const e = new Error('aborted')
      e.name = 'AbortError'
      throw e
    }
    await expect(openV5TurnStream(PAYLOAD, { fetchImpl: aborting as never })).rejects.toMatchObject({
      reason: 'aborted',
    })
    const failing = async () => {
      throw new TypeError('Failed to fetch')
    }
    await expect(openV5TurnStream(PAYLOAD, { fetchImpl: failing as never })).rejects.toMatchObject({
      reason: 'transport',
    })
  })
})

describe('every path settles exactly once', () => {
  it('leaves no request entry unsettled — success and both failure kinds', async () => {
    const paths: Array<() => Promise<unknown>> = [
      async () => openV5TurnStream(PAYLOAD, { fetchImpl: (async () => sseResponse()) as never }),
      async () => {
        const e = new Error('aborted')
        e.name = 'AbortError'
        return openV5TurnStream(PAYLOAD, {
          fetchImpl: (async () => {
            throw e
          }) as never,
        })
      },
      async () =>
        openV5TurnStream(PAYLOAD, {
          fetchImpl: (async () => {
            throw new TypeError('Failed to fetch')
          }) as never,
        }),
    ]
    for (const run of paths) {
      traceSpies.recordRequestPayload.mockClear()
      traceSpies.recordResponsePayload.mockClear()
      await run().catch(() => undefined)
      expect(traceSpies.recordRequestPayload).toHaveBeenCalledTimes(1)
      expect(traceSpies.recordResponsePayload).toHaveBeenCalledTimes(1)
      expect(traceSpies.recordResponsePayload.mock.calls[0][0].id).toBe(
        traceSpies.recordRequestPayload.mock.calls[0][0].id,
      )
    }
  })
})
