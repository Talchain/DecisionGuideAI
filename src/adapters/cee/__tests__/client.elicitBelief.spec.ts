/**
 * `CEEClient.elicitBelief` — THE CONTRACT PIN (ROADMAP 2.364).
 *
 * WHY THESE ASSERTIONS ARE THE SHAPE THEY ARE. CEE's `CEEElicitBeliefInput` is
 * `.strict()` (`olumi-assistants-service/src/schemas/cee.ts`, read at `staging`
 * 2026-08-03), so ONE unrecognised key 400s the whole call — a failure the user
 * sees and the developer does not, because nothing in this repo typechecks
 * against CEE's Zod. So the body is asserted by its EXACT KEY SET, not by
 * `objectContaining`: `objectContaining` passes with an extra key, which is
 * precisely the defect that would ship.
 *
 * The path is asserted absolutely for the same reason: `/bff/cee/elicit-belief`
 * is rewritten to `/assist/v1/elicit-belief` by the `cee-proxy` edge function
 * that also injects the auth key. A path that misses that binding gets the SPA
 * catch-all — HTTP 200, `text/html` — which is the 2.317 defect: a green
 * response that is not an answer.
 *
 * RED-first at pristine `0c4e2cc3`: `CEEClient` has no `elicitBelief` method,
 * so every case here fails at the call.
 *
 * Observability/gate/retry are mocked exactly as the sibling client specs do
 * (crypto.subtle is unavailable in jsdom).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CEEClient, CEEError } from '../client'

vi.mock('../../../lib/observability-headers', () => ({
  withObservabilityHeaders: vi.fn(
    async (_url: string, _method: string, _body: unknown, headers: Record<string, string>) => ({
      headers,
      startTime: Date.now(),
    }),
  ),
  recordBffResponse: vi.fn(),
  recordBffError: vi.fn(),
  recordBffResponsePayload: vi.fn(),
}))

vi.mock('../../../lib/gate-state', () => ({
  useGateStore: { getState: () => ({ setGate: vi.fn() }) },
}))

vi.mock('../../../lib/fetchWithRetry', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}))

/** The witnessed live response for "pretty likely" (2026-08-03, staging BFF). */
const WITNESSED_OK = {
  suggested_value: 0.7,
  confidence: 'high',
  reasoning:
    'Interpreted "pretty likely" as approximately 70% probability based on common usage.',
  needs_clarification: false,
  provenance: 'cee',
  trace: { request_id: 'l43' },
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchSpy = vi.fn().mockResolvedValue(jsonResponse(WITNESSED_OK))
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function firstCall(): { url: string; init: RequestInit } {
  const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
  return { url, init }
}

function bodyOfFirstCall(): Record<string, unknown> {
  return JSON.parse(String(firstCall().init.body)) as Record<string, unknown>
}

const INPUT = {
  node_id: 'fac_churn_risk',
  node_label: 'Churn risk',
  user_expression: 'pretty likely',
  target_type: 'prior' as const,
}

describe('CEEClient.elicitBelief — request contract', () => {
  it('POSTs to the /bff/cee seam the edge function binds (/elicit-belief)', async () => {
    await new CEEClient().elicitBelief(INPUT)

    const { url, init } = firstCall()
    // Absolute, not a substring: '/bff/cee/elicit-belief' is the ONLY path the
    // cee-proxy edge function rewrites to /assist/v1/elicit-belief.
    expect(url).toBe('/bff/cee/elicit-belief')
    expect(init.method).toBe('POST')
  })

  it("sends EXACTLY CEE's .strict() key set — no extras, none missing", async () => {
    await new CEEClient().elicitBelief(INPUT)

    const body = bodyOfFirstCall()
    // Sorted key-set equality. An extra key fails here; `objectContaining`
    // would not, and an extra key is a 400 from a .strict() server.
    expect(Object.keys(body).sort()).toEqual(
      ['node_id', 'node_label', 'target_type', 'user_expression'].sort(),
    )
    expect(body.node_id).toBe('fac_churn_risk')
    expect(body.node_label).toBe('Churn risk')
    expect(body.user_expression).toBe('pretty likely')
    expect(body.target_type).toBe('prior')
  })

  it('includes context_id ONLY when the caller supplies one', async () => {
    await new CEEClient().elicitBelief({ ...INPUT, context_id: 'ctx_1' })

    const body = bodyOfFirstCall()
    expect(Object.keys(body).sort()).toEqual(
      ['context_id', 'node_id', 'node_label', 'target_type', 'user_expression'].sort(),
    )
    expect(body.context_id).toBe('ctx_1')
  })
})

describe('CEEClient.elicitBelief — response handling', () => {
  it('returns the witnessed live shape, reading the value from suggested_value', async () => {
    const result = await new CEEClient().elicitBelief(INPUT)

    // Bound to the FIELD, not to the number: the response carries exactly one
    // 0.7 today, so a renderer reading `trace.whatever` would still pass a
    // bare `toBe(0.7)`. This asserts provenance of the number as well.
    expect(result.suggested_value).toBe(WITNESSED_OK.suggested_value)
    expect(result.confidence).toBe('high')
    expect(result.needs_clarification).toBe(false)
    expect(result.provenance).toBe('cee')
  })

  it('carries the clarification branch through intact (question + option chips)', async () => {
    const clarify = {
      suggested_value: 0.75,
      confidence: 'low',
      reasoning: '"good" is ambiguous.',
      needs_clarification: true,
      clarifying_question: 'When you say "good" for Churn risk, how likely do you mean?',
      options: [
        { label: 'Very likely', value: 0.9 },
        { label: 'Quite likely', value: 0.75 },
        { label: 'More likely than not', value: 0.6 },
      ],
      provenance: 'cee',
    }
    fetchSpy.mockResolvedValue(jsonResponse(clarify))

    const result = await new CEEClient().elicitBelief({ ...INPUT, user_expression: 'good' })

    expect(result.needs_clarification).toBe(true)
    expect(result.clarifying_question).toBe(clarify.clarifying_question)
    expect(result.options?.map(o => o.value)).toEqual([0.9, 0.75, 0.6])
  })

  it('REFUSES a suggested_value above 1 — the number must never reach a commit', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ ...WITNESSED_OK, suggested_value: 70 }))

    await expect(new CEEClient().elicitBelief(INPUT)).rejects.toBeInstanceOf(CEEError)
  })

  it('REFUSES a suggested_value below 0', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ ...WITNESSED_OK, suggested_value: -0.1 }))

    await expect(new CEEClient().elicitBelief(INPUT)).rejects.toBeInstanceOf(CEEError)
  })

  it('REFUSES a missing/non-numeric suggested_value', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ ...WITNESSED_OK, suggested_value: '0.7' }))

    await expect(new CEEClient().elicitBelief(INPUT)).rejects.toBeInstanceOf(CEEError)
  })

  it('ACCEPTS the boundaries 0 and 1 (the refusal is out-of-range, not near-range)', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ ...WITNESSED_OK, suggested_value: 0 }))
    await expect(new CEEClient().elicitBelief(INPUT)).resolves.toMatchObject({
      suggested_value: 0,
    })

    fetchSpy.mockResolvedValue(jsonResponse({ ...WITNESSED_OK, suggested_value: 1 }))
    await expect(new CEEClient().elicitBelief(INPUT)).resolves.toMatchObject({
      suggested_value: 1,
    })
  })

  it('surfaces an HTTP failure as a CEEError rather than a fabricated number', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ message: 'rate limited' }, 429))

    await expect(new CEEClient().elicitBelief(INPUT)).rejects.toBeInstanceOf(CEEError)
  })
})
