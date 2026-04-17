/**
 * V5 slice A1 — end-to-end adapter test.
 *
 * Drives the full flag-on path through callV5Turn → responseParser →
 * routeV5Response, asserting we can render happy-path text and typed errors.
 *
 * This replaces A0's "adapter is inert with flag off" smoke — which still
 * lives in src/canvas/conversation/__tests__/v4-regression-smoke.spec.ts —
 * with positive-path coverage of the A1 wire shape.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { callV5Turn } from '../v5Adapter';
import { routeV5Response } from '../responseRouter';
import type { OlumiResponse } from '@talchain/schemas/boundary';

const VALID_PAYLOAD = {
  turn_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  scenario_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  message: 'frame my decision',
  turn_class: 'frame' as const,
  stage: 'frame' as const,
};

function mockFetchReturning(body: OlumiResponse | Record<string, unknown>, status = 200) {
  return vi.fn<typeof fetch>().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response);
}

describe('V5 A1 end-to-end: callV5Turn → routeV5Response', () => {
  const originalFlag = import.meta.env.VITE_ENABLE_V5_ORCHESTRATOR;

  afterEach(() => {
    (import.meta.env as Record<string, unknown>).VITE_ENABLE_V5_ORCHESTRATOR = originalFlag;
    vi.restoreAllMocks();
  });

  it('flag=true + text_only response → renders assistant_text', async () => {
    (import.meta.env as Record<string, unknown>).VITE_ENABLE_V5_ORCHESTRATOR = 'true';
    const happy: OlumiResponse = {
      response_version: 2,
      assistant_text: 'Frame the decision.',
      blocks: [],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'frame',
    };
    const fetchImpl = mockFetchReturning(happy);
    const result = await callV5Turn(VALID_PAYLOAD, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl).toHaveBeenCalledOnce();

    const target = routeV5Response(result);
    expect(target.kind).toBe('text_only');
    if (target.kind === 'text_only') {
      expect(target.response.assistant_text).toBe('Frame the decision.');
      expect(target.response.blocks).toEqual([]);
    }
  });

  it('flag=true + typed error envelope → renders typed_error with error_code', async () => {
    (import.meta.env as Record<string, unknown>).VITE_ENABLE_V5_ORCHESTRATOR = 'true';
    const fail: OlumiResponse = {
      response_version: 2,
      assistant_text: 'An upstream service did not respond in time. Please retry.',
      blocks: [
        { type: 'error', error_code: 'UPSTREAM_TIMEOUT', severity: 'error' },
      ],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'frame',
    };
    const fetchImpl = mockFetchReturning(fail);
    const result = await callV5Turn(VALID_PAYLOAD, { fetchImpl: fetchImpl as unknown as typeof fetch });
    const target = routeV5Response(result);
    expect(target.kind).toBe('typed_error');
    if (target.kind === 'typed_error') {
      expect(target.code).toBe('UPSTREAM_TIMEOUT');
    }
  });

  it('flag=true + budget-exceeded envelope → renders typed_error with TURN_BUDGET_EXCEEDED', async () => {
    (import.meta.env as Record<string, unknown>).VITE_ENABLE_V5_ORCHESTRATOR = 'true';
    const fail: OlumiResponse = {
      response_version: 2,
      assistant_text: 'That took longer than we allow for a single turn. Please retry.',
      blocks: [
        { type: 'error', error_code: 'TURN_BUDGET_EXCEEDED', severity: 'error' },
      ],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'frame',
    };
    const fetchImpl = mockFetchReturning(fail);
    const result = await callV5Turn(VALID_PAYLOAD, { fetchImpl: fetchImpl as unknown as typeof fetch });
    const target = routeV5Response(result);
    expect(target.kind).toBe('typed_error');
    if (target.kind === 'typed_error') {
      expect(target.code).toBe('TURN_BUDGET_EXCEEDED');
    }
  });

  it('flag=false → fall_through_v4 without fetch (A0 invariant still holds)', async () => {
    (import.meta.env as Record<string, unknown>).VITE_ENABLE_V5_ORCHESTRATOR = 'false';
    const fetchImpl = vi.fn();
    const result = await callV5Turn(VALID_PAYLOAD, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result.kind).toBe('fall_through_v4');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  /**
   * A2: ambiguous user input gets a clarify envelope from CEE. The wire
   * shape is structurally identical to direct_answer — text-only, empty
   * blocks/actions/insights — so the router reports text_only, and the
   * existing assistant-text render path handles it. No new renderer is
   * needed (the clarify turn class is carried in CEE telemetry only, not
   * on the wire OlumiResponse).
   */
  it('flag=true + ambiguous input → clarify envelope renders as text_only', async () => {
    (import.meta.env as Record<string, unknown>).VITE_ENABLE_V5_ORCHESTRATOR = 'true';
    const clarify: OlumiResponse = {
      response_version: 2,
      assistant_text: 'What decision are you weighing right now?',
      blocks: [],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'frame',
    };
    const fetchImpl = mockFetchReturning(clarify);
    const result = await callV5Turn(
      { ...VALID_PAYLOAD, message: 'help me' },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(fetchImpl).toHaveBeenCalledOnce();

    const target = routeV5Response(result);
    expect(target.kind).toBe('text_only');
    if (target.kind === 'text_only') {
      expect(target.response.assistant_text).toBe('What decision are you weighing right now?');
      expect(target.response.blocks).toEqual([]);
    }
  });

  /**
   * A2: LLM_UNAVAILABLE envelope — CEE uses this wire code when the classifier
   * returns unparseable structured output (internal name LLM_SCHEMA_VIOLATION,
   * mapped to LLM_UNAVAILABLE per CEE types.ts). The UI treats it as any
   * other typed error; TypedErrorRenderer renders the declared user text.
   */
  it('flag=true + LLM_UNAVAILABLE envelope → renders typed_error with LLM_UNAVAILABLE', async () => {
    (import.meta.env as Record<string, unknown>).VITE_ENABLE_V5_ORCHESTRATOR = 'true';
    const fail: OlumiResponse = {
      response_version: 2,
      assistant_text: 'The model is temporarily unavailable. Please retry shortly.',
      blocks: [
        { type: 'error', error_code: 'LLM_UNAVAILABLE', severity: 'error' },
      ],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'frame',
    };
    const fetchImpl = mockFetchReturning(fail);
    const result = await callV5Turn(VALID_PAYLOAD, { fetchImpl: fetchImpl as unknown as typeof fetch });
    const target = routeV5Response(result);
    expect(target.kind).toBe('typed_error');
    if (target.kind === 'typed_error') {
      expect(target.code).toBe('LLM_UNAVAILABLE');
    }
  });
});
