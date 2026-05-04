/**
 * callV5Turn — adapter-layer tests.
 *
 * v5-ui-exclusive-path brief (Phase 3): the adapter no longer gates on the
 * flag — the caller (useConversation) does that via `isV5Eligible` and the
 * `fall_through_v4` sentinel is gone. Tests cover endpoint resolution, HTTP
 * dispatch, parse_error surfacing, AbortError passthrough, and payload trace
 * capture (recordRequestPayload / recordResponsePayload).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { callV5Turn } from '../v5Adapter';
import type { OrchestratorTurnPayload } from '@talchain/schemas/boundary';

// ---------------------------------------------------------------------------
// Payload trace store mock — spy on recording calls without real Zustand
// ---------------------------------------------------------------------------
const mockRecordRequest = vi.fn()
const mockRecordResponse = vi.fn()

vi.mock('../../lib/payload-trace-store', () => ({
  recordRequestPayload: (...args: unknown[]) => mockRecordRequest(...args),
  recordResponsePayload: (...args: unknown[]) => mockRecordResponse(...args),
}))

const validPayload: OrchestratorTurnPayload = {
  kind: 'message',
  turn_id: '11111111-1111-4111-8111-111111111111',
  scenario_id: '22222222-2222-4222-8222-222222222222',
  message: 'hello',
  turn_class: 'frame',
  stage: 'frame',
  source: 'composer',
};

describe('callV5Turn', () => {
  beforeEach(() => {
    mockRecordRequest.mockReset()
    mockRecordResponse.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts to /bff/orchestrate/v2/turn by default and returns parsed response', async () => {
    const body = {
      response_version: 2,
      assistant_text: 'ok',
      blocks: [],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'frame',
    };
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const res = await callV5Turn(validPayload, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(res.kind).toBe('response');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain('/orchestrate/v2/turn');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual(validPayload);
  });

  it('returns parse_error on network failure', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    const res = await callV5Turn(validPayload, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(res.kind).toBe('parse_error');
    if (res.kind === 'parse_error') {
      expect(res.reason).toContain('network error');
    }
  });

  it('propagates AbortError (so caller can distinguish user cancel from network failure)', async () => {
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    const fetchImpl = vi.fn().mockRejectedValue(abortErr);
    await expect(
      callV5Turn(validPayload, { fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow('aborted');
  });

  it('posts a system_event payload correctly', async () => {
    const systemEventPayload: OrchestratorTurnPayload = {
      kind: 'system_event',
      turn_id: '11111111-1111-4111-8111-111111111111',
      scenario_id: '22222222-2222-4222-8222-222222222222',
      stage: 'frame',
      event: { kind: 'patch_accepted', patch_id: 'p1' },
    };
    const body = {
      response_version: 2,
      assistant_text: 'ok',
      blocks: [],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'frame',
    };
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await callV5Turn(systemEventPayload, { fetchImpl: fetchImpl as unknown as typeof fetch });
    const [, init] = fetchImpl.mock.calls[0];
    const sent = JSON.parse(init.body as string);
    expect(sent.kind).toBe('system_event');
    expect(sent.event.kind).toBe('patch_accepted');
  });
});

describe('callV5Turn — X-User-Id header', () => {
  beforeEach(() => {
    mockRecordRequest.mockReset()
    mockRecordResponse.mockReset()
  })

  it('passes X-User-Id when provided as header option', async () => {
    const body = {
      response_version: 2,
      assistant_text: 'ok',
      blocks: [],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'frame',
    };
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await callV5Turn(validPayload, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      headers: { 'X-User-Id': 'user-uuid-1234' },
    });
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers['X-User-Id']).toBe('user-uuid-1234');
  });

  it('omits X-User-Id in guest mode (empty headers)', async () => {
    const body = {
      response_version: 2,
      assistant_text: 'ok',
      blocks: [],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'frame',
    };
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await callV5Turn(validPayload, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      headers: {},
    });
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers['X-User-Id']).toBeUndefined();
  });
});

describe('callV5Turn — payload trace capture', () => {
  beforeEach(() => {
    mockRecordRequest.mockReset()
    mockRecordResponse.mockReset()
  })

  const successBody = {
    response_version: 2,
    assistant_text: 'ok',
    blocks: [],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'frame',
  }

  it('records request payload before fetch and response payload after', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(successBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'x-request-id': 'trace-abc' },
      }),
    )
    await callV5Turn(validPayload, { fetchImpl: fetchImpl as unknown as typeof fetch })

    expect(mockRecordRequest).toHaveBeenCalledOnce()
    const reqCall = mockRecordRequest.mock.calls[0][0]
    expect(reqCall.endpoint).toContain('/orchestrate/v2/turn')
    expect(reqCall.method).toBe('POST')
    expect(reqCall.body).toEqual(validPayload)
    expect(typeof reqCall.id).toBe('string')

    expect(mockRecordResponse).toHaveBeenCalledOnce()
    const resCall = mockRecordResponse.mock.calls[0][0]
    // Same correlation ID as the request
    expect(resCall.id).toBe(reqCall.id)
    expect(resCall.status).toBe(200)
    expect(typeof resCall.duration).toBe('number')
    // Response headers preserved (not empty object)
    expect(resCall.headers['content-type']).toContain('application/json')
    expect(resCall.headers['x-request-id']).toBe('trace-abc')
    // Body is the parsed OlumiResponse, not the raw JSON string
    expect(resCall.body).toMatchObject({ assistant_text: 'ok' })
  })

  it('records response with error on network failure', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'))
    await callV5Turn(validPayload, { fetchImpl: fetchImpl as unknown as typeof fetch })

    expect(mockRecordRequest).toHaveBeenCalledOnce()
    expect(mockRecordResponse).toHaveBeenCalledOnce()
    const resCall = mockRecordResponse.mock.calls[0][0]
    expect(resCall.status).toBe(0)
    expect(resCall.error).toContain('offline')
  })

  it('records AbortError before rethrowing', async () => {
    const abortErr = new Error('aborted')
    abortErr.name = 'AbortError'
    const fetchImpl = vi.fn().mockRejectedValue(abortErr)

    await expect(
      callV5Turn(validPayload, { fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow('aborted')

    expect(mockRecordResponse).toHaveBeenCalledOnce()
    const resCall = mockRecordResponse.mock.calls[0][0]
    expect(resCall.error).toBe('AbortError')
    // P0 fix (2026-05): AbortError now also classifies the source so
    // the diagnostic bundle distinguishes user-initiated cancel from
    // CORS preflight failure.
    expect(resCall.errorName).toBe('AbortError')
    expect(resCall.source).toBe('browser_timeout')
  })

  it('classifies "TypeError: Failed to fetch" as preflight_or_network (P0 fix 2026-05)', async () => {
    const networkErr = new TypeError('Failed to fetch')
    const fetchImpl = vi.fn().mockRejectedValue(networkErr)

    const result = await callV5Turn(validPayload, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result).toEqual({
      kind: 'parse_error',
      reason: 'network error: Failed to fetch',
    })
    expect(mockRecordResponse).toHaveBeenCalledOnce()
    const resCall = mockRecordResponse.mock.calls[0][0]
    expect(resCall.errorName).toBe('TypeError')
    expect(resCall.source).toBe('preflight_or_network')
    expect(resCall.error).toBe('Failed to fetch')
  })

  it('classifies Firefox-style "TypeError: NetworkError when attempting to fetch resource." as preflight_or_network', async () => {
    const networkErr = new TypeError('NetworkError when attempting to fetch resource.')
    const fetchImpl = vi.fn().mockRejectedValue(networkErr)

    await callV5Turn(validPayload, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const resCall = mockRecordResponse.mock.calls[0][0]
    expect(resCall.errorName).toBe('TypeError')
    expect(resCall.source).toBe('preflight_or_network')
  })

  it('captures Error.cause as a string and forwards the FULL value to the store (P1 fix 2026-05)', async () => {
    // P1 fix (2026-05): the adapter must NOT truncate before forwarding.
    // The store does redact-then-truncate so secret-shape regexes see
    // the complete pattern. This test pins the contract: the adapter
    // hands the store the raw cause; truncation is the store's job.
    const inner = new Error('underlying socket reset')
    const outer = new TypeError('Failed to fetch')
    ;(outer as Error & { cause?: unknown }).cause = inner
    const fetchImpl = vi.fn().mockRejectedValue(outer)

    await callV5Turn(validPayload, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const resCall = mockRecordResponse.mock.calls[0][0]
    expect(resCall.errorCause).toContain('underlying socket reset')
    // Adapter passes the cause untruncated. The store will redact then
    // truncate; the spy here observes the pre-store value.
    expect(resCall.errorCause).toBe('Error: underlying socket reset')
  })

  it('forwards a long cause WITHOUT truncating so the store can redact-then-truncate (P1 fix 2026-05)', async () => {
    // Construct a cause where a JWT-shaped secret begins NEAR the legacy
    // 200-char boundary. The adapter must not truncate before passing,
    // because a half-clipped JWT breaks the three-segment regex in the
    // store's redactor and the partial token would otherwise survive.
    const padding = 'x'.repeat(190)
    const jwtSecret =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.abcDEF123-_secretEnd'
    const inner = new Error(`${padding}${jwtSecret}`)
    const outer = new TypeError('Failed to fetch')
    ;(outer as Error & { cause?: unknown }).cause = inner
    const fetchImpl = vi.fn().mockRejectedValue(outer)

    await callV5Turn(validPayload, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const resCall = mockRecordResponse.mock.calls[0][0]
    // Adapter forwards the FULL cause (includes the complete JWT shape).
    // The cause body in the spy assertion must contain the whole JWT
    // string — proof that the adapter is no longer the truncator.
    expect(resCall.errorCause).toContain(jwtSecret)
    expect((resCall.errorCause as string).length).toBeGreaterThan(200)
  })

  it('does NOT classify a generic Error with a non-network message as preflight_or_network', async () => {
    const genericErr = new Error('something else broke')
    const fetchImpl = vi.fn().mockRejectedValue(genericErr)

    await callV5Turn(validPayload, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const resCall = mockRecordResponse.mock.calls[0][0]
    expect(resCall.source).toBe('unknown')
  })
})

describe('callV5Turn — endpoint resolution', () => {
  beforeEach(() => {
    delete (import.meta.env as Record<string, unknown>).VITE_V5_ENDPOINT;
    delete (import.meta.env as Record<string, unknown>).VITE_ORCHESTRATOR_BASE;
  });

  afterEach(() => {
    delete (import.meta.env as Record<string, unknown>).VITE_V5_ENDPOINT;
    delete (import.meta.env as Record<string, unknown>).VITE_ORCHESTRATOR_BASE;
  });

  it('prefers VITE_V5_ENDPOINT when set', async () => {
    (import.meta.env as Record<string, unknown>).VITE_V5_ENDPOINT = 'https://example.test/custom/v2';
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 500 }),
    );
    await callV5Turn(validPayload, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl.mock.calls[0][0]).toBe('https://example.test/custom/v2');
  });

  it('falls back to VITE_ORCHESTRATOR_BASE + /orchestrate/v2/turn', async () => {
    (import.meta.env as Record<string, unknown>).VITE_ORCHESTRATOR_BASE = 'https://cee.example';
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 500 }),
    );
    await callV5Turn(validPayload, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl.mock.calls[0][0]).toBe('https://cee.example/orchestrate/v2/turn');
  });

  it('defaults to /bff/orchestrate/v2/turn when no env overrides set', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 500 }),
    );
    await callV5Turn(validPayload, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl.mock.calls[0][0]).toBe('/bff/orchestrate/v2/turn');
  });
});
