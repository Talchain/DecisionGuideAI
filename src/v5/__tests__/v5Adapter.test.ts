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
