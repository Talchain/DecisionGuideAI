import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { withRetry } from '../fetchWithRetry'

// Minimal error with status property (matches CEEError / ISLError shape)
class HttpError extends Error {
  constructor(message: string, public status: number) {
    super(message)
    this.name = 'HttpError'
  }
}

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('succeeds on first attempt — no retry', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(0)
  })

  it('retries on 503 then succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new HttpError('Service Unavailable', 503))
      .mockResolvedValueOnce('recovered')

    const promise = withRetry(fn)
    // Advance past the backoff delay
    await vi.advanceTimersByTimeAsync(2000)
    const result = await promise

    expect(result).toBe('recovered')
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenNthCalledWith(1, 0)
    expect(fn).toHaveBeenNthCalledWith(2, 1)
  })

  it('exhausts retries on repeated 503 and throws final error', async () => {
    const fn = vi.fn().mockRejectedValue(new HttpError('Service Unavailable', 503))

    let caught: unknown
    const promise = withRetry(fn).catch((e) => { caught = e })
    // Advance past all backoff delays (attempt 0→1: ~1s, attempt 1→2: ~2s)
    await vi.advanceTimersByTimeAsync(5000)

    await promise
    expect(caught).toBeInstanceOf(HttpError)
    expect((caught as HttpError).message).toBe('Service Unavailable')
    expect(fn).toHaveBeenCalledTimes(3) // 1 initial + 2 retries
  })

  it('does not retry on 400 — returns error immediately', async () => {
    const fn = vi.fn().mockRejectedValue(new HttpError('Bad Request', 400))

    await expect(withRetry(fn)).rejects.toThrow('Bad Request')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('does not retry on 401', async () => {
    const fn = vi.fn().mockRejectedValue(new HttpError('Unauthorized', 401))
    await expect(withRetry(fn)).rejects.toThrow('Unauthorized')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('does not retry on 404', async () => {
    const fn = vi.fn().mockRejectedValue(new HttpError('Not Found', 404))
    await expect(withRetry(fn)).rejects.toThrow('Not Found')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('does not retry on 422', async () => {
    const fn = vi.fn().mockRejectedValue(new HttpError('Unprocessable', 422))
    await expect(withRetry(fn)).rejects.toThrow('Unprocessable')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries network errors (TypeError from fetch)', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce('recovered')

    const promise = withRetry(fn)
    await vi.advanceTimersByTimeAsync(2000)
    const result = await promise

    expect(result).toBe('recovered')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('does not retry when AbortController is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    const fn = vi.fn().mockResolvedValue('ok')
    await expect(withRetry(fn, controller.signal)).rejects.toThrow()
    expect(fn).toHaveBeenCalledTimes(0)
  })

  it('cancels retry when signal aborts during backoff', async () => {
    const controller = new AbortController()
    const fn = vi.fn().mockRejectedValue(new HttpError('Service Unavailable', 503))

    // Catch the promise immediately to prevent unhandled rejection
    let caught: unknown
    const promise = withRetry(fn, controller.signal).catch((e) => { caught = e })

    // First attempt fails, enters backoff
    await vi.advanceTimersByTimeAsync(100)
    expect(fn).toHaveBeenCalledTimes(1)

    // Abort during backoff
    controller.abort()
    await vi.advanceTimersByTimeAsync(100)

    await promise
    expect(caught).toBeDefined()
    // Should not have retried after abort
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on 429 (rate limit)', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new HttpError('Too Many Requests', 429))
      .mockResolvedValueOnce('ok')

    const promise = withRetry(fn)
    await vi.advanceTimersByTimeAsync(2000)
    const result = await promise

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('respects custom config', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new HttpError('Bad Gateway', 502))
      .mockResolvedValueOnce('ok')

    const promise = withRetry(fn, null, { maxRetries: 1, baseDelayMs: 500 })
    await vi.advanceTimersByTimeAsync(1000)
    const result = await promise

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('does not retry AbortError from fetch', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError')
    const fn = vi.fn().mockRejectedValue(abortError)

    await expect(withRetry(fn)).rejects.toThrow('The operation was aborted.')
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
