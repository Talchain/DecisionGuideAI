import { describe, it, expect } from 'vitest';
import type { OlumiResponse } from '@talchain/schemas/boundary';

import { routeV5Response } from '../responseRouter';

function baseResponse(overrides?: Partial<OlumiResponse>): OlumiResponse {
  return {
    response_version: 2,
    assistant_text: 'hello',
    blocks: [],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'frame',
    ...overrides,
  };
}

describe('routeV5Response', () => {
  it('routes plain assistant_text → text_only', () => {
    const t = routeV5Response({ kind: 'response', response: baseResponse() });
    expect(t.kind).toBe('text_only');
  });

  it('routes error block → typed_error with block code', () => {
    const t = routeV5Response({
      kind: 'response',
      response: baseResponse({
        blocks: [{ type: 'error', error_code: 'FEATURE_NOT_ENABLED', severity: 'info' }],
      }),
    });
    expect(t.kind).toBe('typed_error');
    if (t.kind === 'typed_error') expect(t.code).toBe('FEATURE_NOT_ENABLED');
  });

  it('routes non-error block → blocks', () => {
    const t = routeV5Response({
      kind: 'response',
      response: baseResponse({
        blocks: [{ type: 'text', text: 'hi' }],
      }),
    });
    expect(t.kind).toBe('blocks');
  });

  it('routes BoundaryError → typed_error', () => {
    const t = routeV5Response({
      kind: 'boundary_error',
      error: {
        error: 'INGRESS_CONTRACT_VIOLATION',
        boundary: 'B1',
        direction: 'ingress',
        validator: 'OrchestratorTurnPayload',
        details: { issues: [] },
        request_id: 'r-1',
        retryable: false,
      },
    });
    expect(t.kind).toBe('typed_error');
    if (t.kind === 'typed_error') {
      expect(t.code).toBe('INGRESS_CONTRACT_VIOLATION');
      expect(t.requestId).toBe('r-1');
    }
  });

  it('routes parse_error → typed_error INTERNAL_ERROR', () => {
    const t = routeV5Response({ kind: 'parse_error', reason: 'x' });
    expect(t.kind).toBe('typed_error');
    if (t.kind === 'typed_error') expect(t.code).toBe('INTERNAL_ERROR');
  });

  it('routes fall_through_v4 → fall_through_v4', () => {
    const t = routeV5Response({ kind: 'fall_through_v4' });
    expect(t.kind).toBe('fall_through_v4');
  });
});
