import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { callV5Turn } from '../v5Adapter';

const validPayload = {
  turn_id: '11111111-1111-4111-8111-111111111111',
  scenario_id: '22222222-2222-4222-8222-222222222222',
  message: 'hello',
  turn_class: 'frame' as const,
  stage: 'frame' as const,
};

describe('callV5Turn', () => {
  const originalFlag = import.meta.env.VITE_ENABLE_V5_ORCHESTRATOR;

  afterEach(() => {
    (import.meta.env as Record<string, unknown>).VITE_ENABLE_V5_ORCHESTRATOR = originalFlag;
    vi.restoreAllMocks();
  });

  it('returns fall_through_v4 when flag is off', async () => {
    (import.meta.env as Record<string, unknown>).VITE_ENABLE_V5_ORCHESTRATOR = 'false';
    const fetchImpl = vi.fn();
    const res = await callV5Turn(validPayload, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(res.kind).toBe('fall_through_v4');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('posts to /bff/orchestrate/v2/turn when flag is on and returns parsed response', async () => {
    (import.meta.env as Record<string, unknown>).VITE_ENABLE_V5_ORCHESTRATOR = 'true';
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
    (import.meta.env as Record<string, unknown>).VITE_ENABLE_V5_ORCHESTRATOR = 'true';
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    const res = await callV5Turn(validPayload, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(res.kind).toBe('parse_error');
    if (res.kind === 'parse_error') {
      expect(res.reason).toContain('network error');
    }
  });
});

describe('callV5Turn — endpoint resolution', () => {
  beforeEach(() => {
    (import.meta.env as Record<string, unknown>).VITE_ENABLE_V5_ORCHESTRATOR = 'true';
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
});
