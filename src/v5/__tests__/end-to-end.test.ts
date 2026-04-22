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
import { extractReason, resolveGuidance } from '../failureTypeRetryability';
import { FAILURE_USER_TEXT } from '@talchain/schemas/boundary';
import type { OlumiResponse, OrchestratorTurnPayload, BoundaryError } from '@talchain/schemas/boundary';

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
  return vi.fn().mockResolvedValue({
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

  it('scenario_id is forwarded identically across two sequential turns in a session', async () => {
    // Covers the session lifecycle bug: a new UUID must NOT be allocated per-turn.
    // Both calls share a scenario_id; turn_ids differ (each turn is a new client ID).
    // This tests at the adapter dispatch level rather than the payload builder alone.
    const textResponse: OlumiResponse = {
      response_version: 2,
      assistant_text: 'Got it.',
      blocks: [],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'frame',
    };
    const SCENARIO = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const firstPayload: OrchestratorTurnPayload = {
      ...VALID_PAYLOAD,
      turn_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      scenario_id: SCENARIO,
      message: 'I need to decide between two candidates.',
    };
    const secondPayload: OrchestratorTurnPayload = {
      ...VALID_PAYLOAD,
      turn_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      scenario_id: SCENARIO,
      message: 'What factors matter most?',
    };

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => textResponse,
      text: async () => JSON.stringify(textResponse),
    } as Response);

    await callV5Turn(firstPayload, { fetchImpl: fetchImpl as unknown as typeof fetch });
    await callV5Turn(secondPayload, { fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(fetchImpl.mock.calls[0][1].body as string);
    const secondBody = JSON.parse(fetchImpl.mock.calls[1][1].body as string);

    // Different turns
    expect(firstBody.turn_id).not.toBe(secondBody.turn_id);
    // Same scenario
    expect(firstBody.scenario_id).toBe(SCENARIO);
    expect(secondBody.scenario_id).toBe(SCENARIO);
  });
});

describe('V5 typed error — layered content assembly', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('boundary_error with details.reason produces canonical + reason + guidance layers', async () => {
    // Mirrors the three-layer join in useConversation's typed_error branch:
    //   FAILURE_USER_TEXT[code] + extractReason(boundaryError) + resolveGuidance(code)
    // A refactor that drops any layer or substitutes a generic string would fail this test.
    const boundaryErr: BoundaryError = {
      error: 'INGRESS_CONTRACT_VIOLATION',
      boundary: 'B1',
      direction: 'ingress',
      validator: 'OrchestratorTurnPayload',
      details: { reason: 'turn_id must be a UUID v4' },
      request_id: 'req_abc',
      retryable: false,
    };

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => boundaryErr,
      text: async () => JSON.stringify(boundaryErr),
    } as Response);

    const result = await callV5Turn(VALID_PAYLOAD, { fetchImpl: fetchImpl as unknown as typeof fetch });
    const target = routeV5Response(result);

    expect(target.kind).toBe('typed_error');
    if (target.kind !== 'typed_error') return;

    // Reproduce the exact join useConversation performs
    const canonicalText = FAILURE_USER_TEXT[target.code];
    const reason = extractReason(target.boundaryError);
    const guidance = resolveGuidance(target.code);
    const content = [canonicalText, reason, guidance].filter((s) => s.length > 0).join('\n\n');

    // Canonical layer — never generic
    expect(canonicalText).toBe('We could not process that request. Please try again.');
    // Server reason layer — specific, not empty
    expect(reason).toBe('turn_id must be a UUID v4');
    // Guidance layer — non-retryable code gets actionable text
    expect(guidance).toMatch(/rephrase/i);
    // Joined content contains all three layers in order
    expect(content).toContain(canonicalText);
    expect(content).toContain('turn_id must be a UUID v4');
    expect(content).toContain(guidance);
  });

  it('error block in response body (non-2xx path absent) produces typed_error with specific code', async () => {
    // Covers the in-band error block path (2xx response containing an error block).
    // Ensures the code is never collapsed to INTERNAL_ERROR generically.
    const responseWithErrorBlock: OlumiResponse = {
      response_version: 2,
      assistant_text: 'That took longer than we allow for a single turn. Please retry.',
      blocks: [{ type: 'error', error_code: 'TURN_BUDGET_EXCEEDED', severity: 'error' }],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'frame',
    };
    const fetchImpl = mockFetchReturning(responseWithErrorBlock);
    const result = await callV5Turn(VALID_PAYLOAD, { fetchImpl: fetchImpl as unknown as typeof fetch });
    const target = routeV5Response(result);

    expect(target.kind).toBe('typed_error');
    if (target.kind !== 'typed_error') return;

    expect(target.code).toBe('TURN_BUDGET_EXCEEDED');
    // Canonical text for this code is specific, not the generic INTERNAL_ERROR text
    expect(FAILURE_USER_TEXT[target.code]).toMatch(/turn/i);
    expect(FAILURE_USER_TEXT[target.code]).not.toBe(FAILURE_USER_TEXT['INTERNAL_ERROR']);
  });
});
