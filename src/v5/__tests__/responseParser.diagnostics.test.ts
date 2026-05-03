/**
 * responseParser diagnostic tests — verifies source classification, raw body
 * preservation, and diagnostic header capture for non-JSON failure modes.
 *
 * These tests cover the enhancements added by the v5-non-edge-proxy-routing
 * brief to improve debugging when responses come from Netlify Edge, the
 * browser proxy, or unknown sources instead of CEE.
 */
import { describe, it, expect } from 'vitest'
import { parseV5Response } from '../responseParser'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function textResponse(
  status: number,
  body: string,
  headers?: Record<string, string>,
): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/plain', ...headers },
  })
}

function jsonResponse(status: number, body: unknown, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

// ---------------------------------------------------------------------------
// Source classification
// ---------------------------------------------------------------------------

describe('parseV5Response — source classification', () => {
  it('classifies "the edge function timed out" as netlify', async () => {
    const res = textResponse(500, 'the edge function timed out', {
      server: 'Netlify',
    })
    const r = await parseV5Response(res)
    expect(r.kind).toBe('parse_error')
    if (r.kind === 'parse_error') {
      expect(r.source).toBe('netlify')
      expect(r.http_status).toBe(500)
    }
  })

  it('classifies response with Server: Netlify header as netlify', async () => {
    const res = textResponse(502, 'Bad Gateway', {
      server: 'Netlify',
    })
    const r = await parseV5Response(res)
    expect(r.kind).toBe('parse_error')
    if (r.kind === 'parse_error') {
      expect(r.source).toBe('netlify')
    }
  })

  it('classifies response with x-olumi-service: cee as cee', async () => {
    const body = { message: 'internal error', details: 'something broke' }
    const res = jsonResponse(500, body, {
      'x-olumi-service': 'cee',
      'x-olumi-service-build': 'v1.17.0',
    })
    const r = await parseV5Response(res)
    expect(r.kind).toBe('parse_error')
    if (r.kind === 'parse_error') {
      expect(r.source).toBe('cee')
    }
  })

  it('classifies response with x-olumi-service: isl as plot', async () => {
    const body = { message: 'ISL analysis failed' }
    const res = jsonResponse(500, body, {
      'x-olumi-service': 'isl',
    })
    const r = await parseV5Response(res)
    expect(r.kind).toBe('parse_error')
    if (r.kind === 'parse_error') {
      expect(r.source).toBe('plot')
    }
  })

  it('classifies response with x-olumi-service: plot as plot', async () => {
    const body = { message: 'PLoT service error' }
    const res = jsonResponse(500, body, {
      'x-olumi-service': 'plot',
    })
    const r = await parseV5Response(res)
    expect(r.kind).toBe('parse_error')
    if (r.kind === 'parse_error') {
      expect(r.source).toBe('plot')
    }
  })

  it('classifies proxy structured error as proxy', async () => {
    const body = {
      error: {
        code: 'PROXY_UPSTREAM_TIMEOUT',
        message: 'CEE did not respond within 120s',
        source: 'proxy',
        upstream_duration_ms: 120_042,
        request_id: 'req-abc',
      },
    }
    const res = jsonResponse(504, body, {
      'x-proxy-source': 'cee-browser-proxy',
    })
    const r = await parseV5Response(res)
    expect(r.kind).toBe('parse_error')
    if (r.kind === 'parse_error') {
      expect(r.source).toBe('proxy')
    }
  })

  it('classifies unknown text as unknown', async () => {
    const res = textResponse(500, 'Something went wrong on the server side')
    const r = await parseV5Response(res)
    expect(r.kind).toBe('parse_error')
    if (r.kind === 'parse_error') {
      expect(r.source).toBe('unknown')
    }
  })
})

// ---------------------------------------------------------------------------
// Raw body preservation
// ---------------------------------------------------------------------------

describe('parseV5Response — raw body preservation', () => {
  it('preserves raw body text on non-JSON response', async () => {
    const body = 'the edge function timed out'
    const res = textResponse(500, body)
    const r = await parseV5Response(res)
    expect(r.kind).toBe('parse_error')
    if (r.kind === 'parse_error') {
      expect(r.raw).toBe(body)
    }
  })

  it('truncates very long raw body', async () => {
    const body = 'x'.repeat(2000)
    const res = textResponse(500, body)
    const r = await parseV5Response(res)
    expect(r.kind).toBe('parse_error')
    if (r.kind === 'parse_error') {
      const raw = r.raw as string
      expect(raw.length).toBeLessThan(600)
      expect(raw).toContain('[truncated')
    }
  })
})

// ---------------------------------------------------------------------------
// Diagnostic headers
// ---------------------------------------------------------------------------

describe('parseV5Response — diagnostic headers', () => {
  it('captures diagnostic headers on non-JSON error', async () => {
    const res = textResponse(500, 'the edge function timed out', {
      server: 'Netlify',
      'x-request-id': 'req-12345',
    })
    const r = await parseV5Response(res)
    expect(r.kind).toBe('parse_error')
    if (r.kind === 'parse_error') {
      expect(r.diagnosticHeaders).toBeDefined()
      expect(r.diagnosticHeaders?.server).toBe('Netlify')
      expect(r.diagnosticHeaders?.['x-request-id']).toBe('req-12345')
    }
  })

  it('captures proxy-specific diagnostic headers', async () => {
    const body = { error: { code: 'PROXY_UPSTREAM_TIMEOUT', source: 'proxy' } }
    const res = jsonResponse(504, body, {
      'x-proxy-source': 'cee-browser-proxy',
      'x-proxy-duration-ms': '120042',
      'x-request-id': 'req-proxy-abc',
    })
    const r = await parseV5Response(res)
    expect(r.kind).toBe('parse_error')
    if (r.kind === 'parse_error') {
      expect(r.diagnosticHeaders?.['x-proxy-source']).toBe('cee-browser-proxy')
      expect(r.diagnosticHeaders?.['x-proxy-duration-ms']).toBe('120042')
    }
  })

  it('does NOT add diagnosticHeaders on successful JSON parse', async () => {
    const body = {
      response_version: 2,
      assistant_text: 'hello',
      blocks: [],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'frame',
    }
    const res = jsonResponse(200, body)
    const r = await parseV5Response(res)
    expect(r.kind).toBe('response')
    // Success path should not have diagnosticHeaders
    expect((r as any).diagnosticHeaders).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Backward compatibility
// ---------------------------------------------------------------------------

describe('parseV5Response — backward compatibility', () => {
  it('still parses valid OlumiResponse with res.text() approach', async () => {
    const body = {
      response_version: 2,
      assistant_text: 'Model generated.',
      blocks: [],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'frame',
    }
    const res = jsonResponse(200, body)
    const r = await parseV5Response(res)
    expect(r.kind).toBe('response')
    if (r.kind === 'response') {
      expect(r.response.assistant_text).toBe('Model generated.')
    }
  })

  it('still parses BoundaryError on non-2xx', async () => {
    const body = {
      error: 'INGRESS_CONTRACT_VIOLATION',
      boundary: 'B1',
      direction: 'ingress',
      validator: 'OrchestratorTurnPayload',
      details: {},
      request_id: 'req-1',
      retryable: false,
    }
    const res = jsonResponse(422, body)
    const r = await parseV5Response(res)
    expect(r.kind).toBe('boundary_error')
  })
})
