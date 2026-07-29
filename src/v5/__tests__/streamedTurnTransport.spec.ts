/**
 * The streamed turn's transport: endpoint DERIVATION and request shape
 * (ROADMAP 2.122).
 *
 * The endpoint is the one thing here that could silently point at nothing, so
 * it is derived from the buffered endpoint rather than written as a second
 * literal (CLAUDE.md trap 12 — a hand-maintained mirror of a URL drifts and
 * the drift reads as a 404 nobody notices until a tester hits it).
 *
 * Derived at the deployed bytes (`m1l2-consumer.md` F0-1): staging bakes
 * `VITE_V5_ENDPOINT=https://cee-staging.onrender.com/proxy/v5/turn`, so the
 * suffix rule lands on `/proxy/v5/turn/stream` — the exact route
 * `cee2-live-latency.md` measured. The repo default `/bff/orchestrate/v2/turn`
 * lands on `/bff/orchestrate/v2/turn/stream`, which the Netlify edge function
 * rewrites to CEE's `/orchestrate/v2/turn/stream` service sibling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { getV5StreamEndpoint, openV5TurnStream, __streamInternals } from '../streamedTurnTransport'

const PAYLOAD = {
  kind: 'message',
  turn_id: '11111111-1111-4111-8111-111111111111',
  scenario_id: '22222222-2222-4222-8222-222222222222',
  stage: 'frame',
  turn_class: 'frame',
  message: 'Should we build or buy a billing system?',
  source: 'composer',
} as never

function sseResponse(): Response {
  return new Response('event: stage\ndata: {"stage":"DRAFTING","seq":0,"status":"in_progress"}\n\n', {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

describe('getV5StreamEndpoint — derived, not mirrored', () => {
  const original = { ...import.meta.env }

  afterEach(() => {
    Object.assign(import.meta.env, original)
  })

  it('is exactly the buffered endpoint plus /stream, for every resolution rung', () => {
    const cases = [
      ['https://cee-staging.onrender.com/proxy/v5/turn', 'https://cee-staging.onrender.com/proxy/v5/turn/stream'],
      ['/bff/orchestrate/v2/turn', '/bff/orchestrate/v2/turn/stream'],
    ] as const
    for (const [buffered, streamed] of cases) {
      expect(__streamInternals.streamEndpointFor(buffered)).toBe(streamed)
    }
  })

  it('tracks the buffered resolver rather than restating its ladder', () => {
    // The pin that makes this a derivation: whatever the buffered resolver
    // returns, the streamed endpoint is that string + '/stream'. If someone
    // re-implements the env ladder here, this goes red.
    ;(import.meta.env as Record<string, unknown>).VITE_V5_ENDPOINT = 'https://example.test/some/other/turn'
    expect(getV5StreamEndpoint()).toBe('https://example.test/some/other/turn/stream')
  })

  it('does not double a trailing slash', () => {
    expect(__streamInternals.streamEndpointFor('https://x.test/proxy/v5/turn/')).toBe(
      'https://x.test/proxy/v5/turn/stream',
    )
  })
})

describe('openV5TurnStream — the request a browser actually sends', () => {
  let fetchImpl: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchImpl = vi.fn<unknown[], unknown>(async () => sseResponse())
  })

  it('POSTs the identical payload with Accept: text/event-stream', async () => {
    await openV5TurnStream(PAYLOAD, { fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(getV5StreamEndpoint())
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Accept).toBe('text/event-stream')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body as string)).toEqual(PAYLOAD)
  })

  it('forwards the caller auth headers unchanged (same as the buffered turn)', async () => {
    await openV5TurnStream(PAYLOAD, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      headers: { 'X-User-Id': 'u1', Authorization: 'Bearer t' },
    })
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['X-User-Id']).toBe('u1')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer t')
  })

  it('passes the abort signal through so the 130 s turn timeout still bites', async () => {
    const controller = new AbortController()
    await openV5TurnStream(PAYLOAD, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      signal: controller.signal,
    })
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(init.signal).toBe(controller.signal)
  })

  it('abandons with `transport` when the fetch itself rejects', async () => {
    const failing = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(
      openV5TurnStream(PAYLOAD, { fetchImpl: failing as unknown as typeof fetch }),
    ).rejects.toMatchObject({ name: 'StreamAbandonedError', reason: 'transport' })
  })

  it('abandons with `aborted` — not `transport` — on a user/timeout abort', async () => {
    const aborting = vi.fn(async () => {
      const e = new Error('aborted')
      e.name = 'AbortError'
      throw e
    })
    await expect(
      openV5TurnStream(PAYLOAD, { fetchImpl: aborting as unknown as typeof fetch }),
    ).rejects.toMatchObject({ reason: 'aborted' })
  })
})

describe('terminalPayloadToResponse — byte-equivalent terminal ingest', () => {
  it('re-wraps the COMPLETE frame so the BUFFERED parser consumes it verbatim', async () => {
    // The whole point: there is no second parser to keep in step. The frame's
    // `payload` is the buffered body verbatim (#751), so wrapping it in a
    // Response and handing it to `parseV5Response` is the same ingest.
    const body = { response_version: 2, assistant_text: 'hi', blocks: [] }
    const res = __streamInternals.terminalPayloadToResponse(body, 200)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toEqual(body)
  })

  it('preserves a non-2xx status_code so the parser classifies the failure honestly', async () => {
    const res = __streamInternals.terminalPayloadToResponse({ error: 'INGRESS_CONTRACT_VIOLATION' }, 422)
    expect(res.status).toBe(422)
  })

  it('an absent payload becomes an honest empty body, never `undefined` JSON', async () => {
    const res = __streamInternals.terminalPayloadToResponse(undefined, 200)
    expect(await res.text()).toBe('null')
  })
})
