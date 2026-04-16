import { describe, it, expect } from 'vitest';

import { parseV5Response } from '../responseParser';

// Build a minimal Response-like object. Tests run in jsdom, which provides
// the global Response constructor; use it so Response.ok / .status /
// .json() behave as the adapter expects.
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('parseV5Response', () => {
  it('parses a valid OlumiResponse (200)', async () => {
    const body = {
      response_version: 2,
      assistant_text: 'hello',
      blocks: [],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'frame',
    };
    const res = await parseV5Response(jsonResponse(200, body));
    expect(res.kind).toBe('response');
    if (res.kind === 'response') {
      expect(res.response.assistant_text).toBe('hello');
    }
  });

  it('parses a BoundaryError (422)', async () => {
    const body = {
      error: 'INGRESS_CONTRACT_VIOLATION',
      boundary: 'B1',
      direction: 'ingress',
      validator: 'OrchestratorTurnPayload',
      details: { issues: [{ path: 'scenario_id', message: 'required', code: 'invalid_type' }] },
      request_id: 'req-1',
      retryable: false,
    };
    const res = await parseV5Response(jsonResponse(422, body));
    expect(res.kind).toBe('boundary_error');
    if (res.kind === 'boundary_error') {
      expect(res.error.error).toBe('INGRESS_CONTRACT_VIOLATION');
      expect(res.error.boundary).toBe('B1');
    }
  });

  it('returns parse_error on 200 with wrong shape', async () => {
    const res = await parseV5Response(jsonResponse(200, { not: 'a valid olumi response' }));
    expect(res.kind).toBe('parse_error');
  });

  it('returns parse_error on non-ok status with non-BoundaryError body', async () => {
    const res = await parseV5Response(jsonResponse(500, { message: 'boom' }));
    expect(res.kind).toBe('parse_error');
    if (res.kind === 'parse_error') {
      expect(res.http_status).toBe(500);
    }
  });

  it('returns parse_error on non-JSON body', async () => {
    const res = new Response('<html>not json</html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
    const result = await parseV5Response(res);
    expect(result.kind).toBe('parse_error');
  });
});
