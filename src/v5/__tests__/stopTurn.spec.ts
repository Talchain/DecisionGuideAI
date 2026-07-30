/**
 * stopV5Turn — the wire half of the explicit Stop.
 *
 * Two things are pinned, and they fail for different reasons:
 *
 *  1. THE ENDPOINT IS DERIVED from `v5Adapter`'s resolver plus `/stop`, exactly
 *     as `streamedTurnTransport` derives `/stream`. A second copy of the env
 *     ladder here would be CLAUDE.md trap 12, and its failure mode is a 404 —
 *     which the classifier below turns into `unconfirmed`, i.e. the UI would
 *     show "we could not reach the server" on every stop and look like an
 *     outage. That is why the derivation is asserted, not assumed.
 *
 *  2. THE THREE OUTCOMES ARE DISTINGUISHED. A boolean would collapse
 *     `already_saved` and `unconfirmed` into the same silence, which is the
 *     state the whole stop-fence lane exists to remove. Each mapping is its own
 *     case, including the awkward one: a 2xx whose body does not confirm the
 *     tombstone is `unconfirmed`, not success — a 200 we cannot read is the same
 *     epistemic position as no answer.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { stopV5Turn, getV5StopEndpoint } from '../stopTurn'

const IDENTITY = {
  scenarioId: 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c',
  turnId: 'dcfc3b50-03b0-4b74-bc56-6dd0ce1531d7',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('getV5StopEndpoint — derived, not mirrored', () => {
  const originalEnv = { ...(import.meta.env as Record<string, unknown>) }

  afterEach(() => {
    Object.assign(import.meta.env as Record<string, unknown>, originalEnv)
    vi.unstubAllEnvs()
  })

  it('appends /stop to whatever the buffered turn resolves to (proxy rung)', () => {
    vi.stubEnv('VITE_V5_ENDPOINT', 'https://cee-staging.onrender.com/proxy/v5/turn')
    expect(getV5StopEndpoint()).toBe('https://cee-staging.onrender.com/proxy/v5/turn/stop')
  })

  it('works on the Netlify edge rung too — both siblings exist server-side', () => {
    vi.stubEnv('VITE_V5_ENDPOINT', '')
    vi.stubEnv('VITE_ORCHESTRATOR_BASE', '')
    expect(getV5StopEndpoint()).toBe('/bff/orchestrate/v2/turn/stop')
  })

  it('does not double the slash on a trailing-slash endpoint', () => {
    vi.stubEnv('VITE_V5_ENDPOINT', 'https://cee.test/proxy/v5/turn/')
    expect(getV5StopEndpoint()).toBe('https://cee.test/proxy/v5/turn/stop')
  })
})

describe('stopV5Turn — classifying the server’s answer', () => {
  let fetchImpl: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchImpl = vi.fn()
  })

  it('posts scenario_id and turn_id — the tombstone key', async () => {
    fetchImpl.mockResolvedValue(jsonResponse({ stopped: true, already_committed: false }))
    await stopV5Turn(IDENTITY, { fetchImpl: fetchImpl as unknown as typeof fetch })
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({
      scenario_id: IDENTITY.scenarioId,
      turn_id: IDENTITY.turnId,
    })
  })

  it('stopped + not committed → not_saved', async () => {
    fetchImpl.mockResolvedValue(jsonResponse({ stopped: true, already_committed: false }))
    const r = await stopV5Turn(IDENTITY, { fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(r.kind).toBe('not_saved')
  })

  it('stopped + ALREADY committed → already_saved', async () => {
    fetchImpl.mockResolvedValue(jsonResponse({ stopped: true, already_committed: true }))
    const r = await stopV5Turn(IDENTITY, { fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(r.kind).toBe('already_saved')
  })

  // ══ AMENDMENT A1 — THE `already_committed` SHAPE TABLE ═════════════════════
  //
  // The previous implementation was `already_committed === true ? already_saved :
  // not_saved`, so EVERY row below except the literals resolved to `not_saved` —
  // telling the user "it was cancelled before it was saved", a positive claim
  // about their data, on a signal that may mean the opposite. The two literals
  // are the only recognisable answers; everything else is "we cannot tell".
  //
  // Driven from a table rather than written out, so adding a shape cannot
  // silently skip the assertion, and `not_saved` / `already_saved` are asserted
  // to be UNREACHABLE from any unrecognised value (that is the whole finding).
  describe.each([
    ['literal true', true, 'already_saved'],
    ['literal false', false, 'not_saved'],
    ['absent (key omitted)', undefined, 'unconfirmed'],
    ['string "true"', 'true', 'unconfirmed'],
    ['string "false"', 'false', 'unconfirmed'],
    ['number 1', 1, 'unconfirmed'],
    ['number 0', 0, 'unconfirmed'],
    ['string "yes"', 'yes', 'unconfirmed'],
    ['null', null, 'unconfirmed'],
    ['empty string', '', 'unconfirmed'],
    ['an object', { committed: true }, 'unconfirmed'],
    ['an array', [true], 'unconfirmed'],
  ] as ReadonlyArray<readonly [string, unknown, string]>)(
    'already_committed = %s',
    (_label, value, expected) => {
      it(`resolves to ${expected}`, async () => {
        const body: Record<string, unknown> = { stopped: true }
        if (value !== undefined) body.already_committed = value
        fetchImpl.mockResolvedValue(jsonResponse(body))
        const r = await stopV5Turn(IDENTITY, { fetchImpl: fetchImpl as unknown as typeof fetch })
        expect(r.kind).toBe(expected)
        if (expected === 'unconfirmed') {
          // A positive claim about the user's canvas must be UNREACHABLE from an
          // unrecognised signal — in either direction.
          expect(r.kind).not.toBe('not_saved')
          expect(r.kind).not.toBe('already_saved')
          expect(r.reason).toBe('already_committed_unrecognised')
        }
      })
    },
  )

  it('a non-2xx is unconfirmed, never success', async () => {
    fetchImpl.mockResolvedValue(jsonResponse({ error: { code: 'TURN_STOP_NOT_RECORDED' } }, 502))
    const r = await stopV5Turn(IDENTITY, { fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(r).toEqual({ kind: 'unconfirmed', reason: 'http_502' })
  })

  it('a 2xx that does not confirm the tombstone is unconfirmed', async () => {
    fetchImpl.mockResolvedValue(jsonResponse({ stopped: false }))
    const r = await stopV5Turn(IDENTITY, { fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(r).toEqual({ kind: 'unconfirmed', reason: 'not_acknowledged' })
  })

  it('an unparseable body is unconfirmed', async () => {
    fetchImpl.mockResolvedValue(
      new Response('not json', { status: 200, headers: { 'content-type': 'application/json' } }),
    )
    const r = await stopV5Turn(IDENTITY, { fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(r).toEqual({ kind: 'unconfirmed', reason: 'unparseable_body' })
  })

  it('a transport failure is unconfirmed and NEVER throws', async () => {
    fetchImpl.mockRejectedValue(new TypeError('Failed to fetch'))
    const r = await stopV5Turn(IDENTITY, { fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(r).toEqual({ kind: 'unconfirmed', reason: 'transport' })
  })

  it('runs out of patience rather than delaying the notice indefinitely', async () => {
    // The user has already stopped; this budget only governs how long the
    // terminal notice waits. A notice that never arrives is the silence this
    // lane removed.
    fetchImpl.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
          })
        }),
    )
    const r = await stopV5Turn(IDENTITY, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 10,
    })
    expect(r).toEqual({ kind: 'unconfirmed', reason: 'timeout' })
  })
})
