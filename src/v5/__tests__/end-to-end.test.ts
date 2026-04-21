/**
 * V5 end-to-end adapter → router test.
 *
 * v5-ui-exclusive-path brief (Phase 3): `fall_through_v4` removed. V5 is
 * the exclusive path when the flag is on, and eligibility gating happens at
 * the useConversation caller level. These tests drive the adapter directly
 * with v0.7.0 payloads and cover the three RenderTarget happy cases
 * (text_only / blocks / empty) plus typed-error envelopes.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { callV5Turn } from '../v5Adapter';
import { routeV5Response } from '../responseRouter';
import type { OlumiResponse, OrchestratorTurnPayload } from '@talchain/schemas/boundary';

const VALID_PAYLOAD: OrchestratorTurnPayload = {
  kind: 'message',
  turn_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  scenario_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  message: 'frame my decision',
  turn_class: 'frame',
  stage: 'frame',
  source: 'composer',
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

describe('V5 end-to-end: callV5Turn → routeV5Response', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('text_only response → renders assistant_text', async () => {
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

  it('empty envelope (no text, no blocks, no chips) → routes to empty', async () => {
    const empty: OlumiResponse = {
      response_version: 2,
      assistant_text: '',
      blocks: [],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'frame',
    };
    const fetchImpl = mockFetchReturning(empty);
    const result = await callV5Turn(VALID_PAYLOAD, { fetchImpl: fetchImpl as unknown as typeof fetch });

    const target = routeV5Response(result);
    expect(target.kind).toBe('empty');
  });

  it('typed error envelope → renders typed_error with error_code', async () => {
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

  it('non-retryable typed error (TURN_BUDGET_EXCEEDED)', async () => {
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

  it('ambiguous input → clarify envelope routes as text_only', async () => {
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
    }
  });

  it('LLM_UNAVAILABLE envelope routes as typed_error', async () => {
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

  it('system_event payload dispatches + parses response normally', async () => {
    const ack: OlumiResponse = {
      response_version: 2,
      assistant_text: 'Patch applied.',
      blocks: [],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'frame',
    };
    const fetchImpl = mockFetchReturning(ack);
    const systemEventPayload: OrchestratorTurnPayload = {
      kind: 'system_event',
      turn_id: VALID_PAYLOAD.turn_id,
      scenario_id: VALID_PAYLOAD.scenario_id,
      stage: 'frame',
      event: { kind: 'patch_accepted', patch_id: 'patch-1' },
    };
    const result = await callV5Turn(systemEventPayload, { fetchImpl: fetchImpl as unknown as typeof fetch });
    const target = routeV5Response(result);
    expect(target.kind).toBe('text_only');
  });
});
