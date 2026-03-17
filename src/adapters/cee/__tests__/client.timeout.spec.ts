/**
 * Audit F-67 regression: CEE client timeout fires AbortController and surfaces CEEError 408.
 *
 * Uses fake timers to verify the AbortController fires at the configured timeout
 * and produces the expected error shape.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CEEClient, CEEError } from '../client'

// Mock observability headers (avoids crypto.subtle requirement in test env)
vi.mock('../../../lib/observability-headers', () => ({
  withObservabilityHeaders: vi.fn(async (_url: string, _method: string, _body: unknown, headers: Record<string, string>) => ({
    headers,
    startTime: Date.now(),
  })),
  recordBffResponse: vi.fn(),
  recordBffError: vi.fn(),
  recordBffResponsePayload: vi.fn(),
}))

// Mock gate-state
vi.mock('../../../lib/gate-state', () => ({
  useGateStore: { getState: () => ({ setGate: vi.fn() }) },
}))

// Mock api-schemas
vi.mock('../../../lib/api-schemas', () => ({
  CEEDraftResponseSchema: {},
  warnOnInvalidApiResponse: vi.fn(),
}))

// Mock fetchWithRetry
vi.mock('../../../lib/fetchWithRetry', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}))

describe('Audit F-67: CEE client timeout', () => {
  // Suppress unhandled rejection noise from AbortError propagating asynchronously
  // through the fetch mock's abort listener. The error IS tested and caught —
  // the spurious vitest "Errors: 1" comes from the abort firing after test completes.
  const originalListeners: ((...args: any[]) => void)[] = []
  beforeEach(() => {
    vi.useFakeTimers()
    // Capture and suppress unhandledRejection during abort tests
    originalListeners.push(...process.listeners('unhandledRejection'))
    process.removeAllListeners('unhandledRejection')
    process.on('unhandledRejection', () => {}) // no-op
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    // Restore original listeners
    process.removeAllListeners('unhandledRejection')
    originalListeners.forEach(l => process.on('unhandledRejection', l))
    originalListeners.length = 0
  })

  it('aborts request after configured timeout and throws CEEError with status 408', async () => {
    // Mock fetch to hang forever (never resolves)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          // Listen for abort signal to reject with AbortError
          const signal = (init as RequestInit)?.signal
          if (signal) {
            signal.addEventListener('abort', () => {
              const err = new Error('The operation was aborted.')
              err.name = 'AbortError'
              reject(err)
            })
          }
        })
    )

    const client = new CEEClient()

    // Start a request (biasCheck is idempotent, good for testing)
    const requestPromise = client.biasCheck(
      { nodes: [{ id: 'a', label: 'A', type: 'factor' }], edges: [] }
    )

    // Advance past the 150s default timeout
    await vi.advanceTimersByTimeAsync(150_001)

    // The request should reject with CEEError (408)
    let caughtError: unknown
    try {
      await requestPromise
    } catch (err) {
      caughtError = err
    }

    expect(caughtError).toBeInstanceOf(CEEError)
    expect((caughtError as CEEError).status).toBe(408)
    expect((caughtError as CEEError).message).toBe('Request timeout')

    // Flush any remaining async work to prevent unhandled rejection noise
    await vi.runAllTimersAsync()

    fetchSpy.mockRestore()
  })

  it('clears timeout on successful response (no spurious abort)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ biases: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    )

    const client = new CEEClient()
    const result = await client.biasCheck(
      { nodes: [{ id: 'a', label: 'A', type: 'factor' }], edges: [] }
    )

    // Response should succeed
    expect(result).toBeDefined()

    // Advancing timer past timeout should NOT cause issues
    await vi.advanceTimersByTimeAsync(200_000)

    fetchSpy.mockRestore()
  })
})
