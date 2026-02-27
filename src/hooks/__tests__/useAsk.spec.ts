/**
 * useAsk / askEndpoint tests — P1-3 timeout + abort handling
 *
 * Tests the exported askEndpoint function directly (no React hook rendering).
 * Covers: normal success, timeout → TIMEOUT error, abort → CANCELLED error,
 * network error, and HTTP error responses.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { askEndpoint, AskApiError, AskPreflightError } from '../useAsk'
import { FetchTimeoutError } from '../../utils/fetchWithTimeout'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock graphTransform — pure function, return minimal valid graph
vi.mock('../../lib/graphTransform', () => ({
  prepareGraphSnapshot: vi.fn(() => ({
    nodes: [{ id: 'n1', label: 'Node 1', kind: 'option' }],
    edges: [{ source: 'n1', target: 'n2', label: 'Edge' }],
  })),
}))

// Mock askPreflight — allow by default
const mockCheckAskPreflight = vi.fn(() => ({ allowed: true }))
vi.mock('../../lib/askPreflight', () => ({
  checkAskPreflight: (...args: unknown[]) => mockCheckAskPreflight(...args),
}))

// Mock requestId generation
vi.mock('../../types/requestId', () => ({
  generateRequestId: () => 'test-request-id-001',
  extractServerRequestId: (data: any) => data?.request_id ?? null,
}))

// Mock fetchWithTimeout
const mockFetchWithTimeout = vi.fn()
vi.mock('../../utils/fetchWithTimeout', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../utils/fetchWithTimeout')>()
  return {
    ...orig,
    fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: () => Promise.resolve(body),
  } as unknown as Response
}

const defaultArgs = {
  message: 'What should I focus on?',
  nodes: [] as any[],
  edges: [] as any[],
  scenarioId: 'scenario-1',
  framing: { title: 'Test decision with enough chars' },
  selection: { nodeIds: new Set<string>(), edgeIds: new Set<string>() },
} as const

function callAskEndpoint(signal?: AbortSignal) {
  return askEndpoint(
    defaultArgs.message,
    defaultArgs.nodes,
    defaultArgs.edges,
    defaultArgs.scenarioId,
    defaultArgs.framing,
    defaultArgs.selection,
    undefined, // baseUrl
    signal,
  )
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckAskPreflight.mockReturnValue({ allowed: true })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('askEndpoint', () => {
  it('returns normalised response on success', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(
      makeJsonResponse({
        request_id: 'server-req-1',
        message: 'Focus on option A.',
        model_actions: [],
        highlights: [],
      }),
    )

    const result = await callAskEndpoint()

    expect(result.text).toBe('Focus on option A.')
    expect(result.serverRequestId).toBe('server-req-1')
    expect(result.clientRequestId).toBe('test-request-id-001')
    expect(result.model_actions).toEqual([])
    expect(result.highlights).toEqual([])
  })

  it('passes signal to fetchWithTimeout', async () => {
    const controller = new AbortController()
    mockFetchWithTimeout.mockResolvedValueOnce(
      makeJsonResponse({ request_id: 'x', message: 'ok' }),
    )

    await callAskEndpoint(controller.signal)

    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String), // endpoint
      expect.objectContaining({ signal: controller.signal }),
      45_000, // ASK_TIMEOUT_MS
    )
  })

  it('maps FetchTimeoutError → AskApiError with code TIMEOUT', async () => {
    mockFetchWithTimeout.mockRejectedValueOnce(
      new FetchTimeoutError('Request timed out after 45000ms', 45_000),
    )

    await expect(callAskEndpoint()).rejects.toThrow(AskApiError)

    try {
      await callAskEndpoint()
    } catch (e) {
      // Reset mock for second call
    }

    // Re-mock and re-test for assertion on code
    mockFetchWithTimeout.mockRejectedValueOnce(
      new FetchTimeoutError('Request timed out after 45000ms', 45_000),
    )

    try {
      await callAskEndpoint()
    } catch (e) {
      expect(e).toBeInstanceOf(AskApiError)
      const apiErr = e as AskApiError
      expect(apiErr.code).toBe('TIMEOUT')
      expect(apiErr.retryable).toBe(true)
      expect(apiErr.message).toContain('45s')
    }
  })

  it('maps AbortError → AskApiError with code CANCELLED', async () => {
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'
    mockFetchWithTimeout.mockRejectedValueOnce(abortError)

    try {
      await callAskEndpoint()
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AskApiError)
      const apiErr = e as AskApiError
      expect(apiErr.code).toBe('CANCELLED')
      expect(apiErr.retryable).toBe(false)
    }
  })

  it('maps generic network error → AskApiError with code NETWORK_ERROR', async () => {
    mockFetchWithTimeout.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    try {
      await callAskEndpoint()
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AskApiError)
      const apiErr = e as AskApiError
      expect(apiErr.code).toBe('NETWORK_ERROR')
      expect(apiErr.retryable).toBe(true)
    }
  })

  it('throws AskApiError for HTTP error responses', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(
      makeJsonResponse(
        { code: 'RATE_LIMITED', message: 'Too many requests', retryable: true },
        429,
      ),
    )

    try {
      await callAskEndpoint()
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AskApiError)
      const apiErr = e as AskApiError
      expect(apiErr.code).toBe('RATE_LIMITED')
      expect(apiErr.retryable).toBe(true)
    }
  })

  it('throws AskApiError for invalid JSON response', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    } as unknown as Response)

    try {
      await callAskEndpoint()
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AskApiError)
      const apiErr = e as AskApiError
      expect(apiErr.code).toBe('PARSE_ERROR')
    }
  })

  it('throws AskPreflightError when preflight fails', async () => {
    mockCheckAskPreflight.mockReturnValueOnce({
      allowed: false,
      reason: 'Graph has no nodes',
    })

    try {
      await callAskEndpoint()
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AskPreflightError)
      expect((e as AskPreflightError).message).toBe('Graph has no nodes')
    }
  })

  it('sends correct payload shape to BFF', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(
      makeJsonResponse({ request_id: 'x', message: 'ok' }),
    )

    await callAskEndpoint()

    const [_url, opts] = mockFetchWithTimeout.mock.calls[0]
    const payload = JSON.parse(opts.body as string)

    expect(payload.request_id).toBe('test-request-id-001')
    expect(payload.scenario_id).toBe('scenario-1')
    expect(payload.graph_schema_version).toBe('2.2')
    expect(payload.message).toBe('What should I focus on?')
    expect(payload.graph_snapshot).toBeDefined()
    expect(payload.market_context).toEqual({
      id: 'default',
      version: '1.0',
      hash: 'unknown',
    })
  })
})
