import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchWithTimeout, FetchTimeoutError, DEFAULT_FETCH_TIMEOUT_MS } from '../fetchWithTimeout'

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should complete fetch before timeout', async () => {
    const mockResponse = new Response('ok', { status: 200 })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse)

    const responsePromise = fetchWithTimeout('https://example.com', {}, 5000)

    // Advance time but not past timeout
    await vi.advanceTimersByTimeAsync(100)

    const response = await responsePromise
    expect(response.status).toBe(200)
    expect(fetchSpy).toHaveBeenCalledWith('https://example.com', expect.objectContaining({
      signal: expect.any(AbortSignal),
    }))
  })

  it('should abort after specified timeout and throw FetchTimeoutError', async () => {
    // Mock fetch that never resolves until aborted
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => {
      return new Promise((_resolve, reject) => {
        const signal = options?.signal as AbortSignal
        signal?.addEventListener('abort', () => {
          const abortError = new Error('Aborted')
          abortError.name = 'AbortError'
          reject(abortError)
        })
      })
    })

    // Attach catch handler immediately to prevent unhandled rejection warning
    let caughtError: unknown
    const responsePromise = fetchWithTimeout('https://example.com', {}, 5000)
      .catch((err) => { caughtError = err })

    // Advance past timeout
    vi.advanceTimersByTime(5001)
    await vi.runAllTimersAsync()
    await responsePromise

    expect(caughtError).toBeInstanceOf(FetchTimeoutError)
    expect((caughtError as FetchTimeoutError).message).toBe('Request timed out after 5000ms')
  })

  it('should include timeoutMs in FetchTimeoutError', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => {
      return new Promise((_resolve, reject) => {
        const signal = options?.signal as AbortSignal
        signal?.addEventListener('abort', () => {
          const abortError = new Error('Aborted')
          abortError.name = 'AbortError'
          reject(abortError)
        })
      })
    })

    let caughtError: unknown
    const responsePromise = fetchWithTimeout('https://example.com', {}, 3000)
      .catch((err) => { caughtError = err })

    vi.advanceTimersByTime(3001)
    await vi.runAllTimersAsync()
    await responsePromise

    expect(caughtError).toBeInstanceOf(FetchTimeoutError)
    expect((caughtError as FetchTimeoutError).timeoutMs).toBe(3000)
  })

  it('should use default timeout when not specified', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => {
      return new Promise((_resolve, reject) => {
        const signal = options?.signal as AbortSignal
        signal?.addEventListener('abort', () => {
          const abortError = new Error('Aborted')
          abortError.name = 'AbortError'
          reject(abortError)
        })
      })
    })

    let caughtError: unknown
    const responsePromise = fetchWithTimeout('https://example.com')
      .catch((err) => { caughtError = err })

    vi.advanceTimersByTime(DEFAULT_FETCH_TIMEOUT_MS + 1)
    await vi.runAllTimersAsync()
    await responsePromise

    expect(caughtError).toBeInstanceOf(FetchTimeoutError)
    expect((caughtError as FetchTimeoutError).timeoutMs).toBe(DEFAULT_FETCH_TIMEOUT_MS)
  })

  it('should propagate non-abort fetch errors unchanged', async () => {
    const networkError = new Error('Network failure')
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(networkError)

    let caughtError: unknown
    await fetchWithTimeout('https://example.com', {}, 5000)
      .catch((err) => { caughtError = err })

    expect(caughtError).toBeInstanceOf(Error)
    expect((caughtError as Error).message).toBe('Network failure')
    expect(caughtError).not.toBeInstanceOf(FetchTimeoutError)
  })

  it('should pass through request options to fetch', async () => {
    const mockResponse = new Response('ok', { status: 200 })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse)

    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
    }

    const responsePromise = fetchWithTimeout('https://example.com', options, 5000)
    await vi.advanceTimersByTimeAsync(100)
    await responsePromise

    expect(fetchSpy).toHaveBeenCalledWith('https://example.com', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
      signal: expect.any(AbortSignal),
    }))
  })

  it('should clear timeout after successful fetch', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    const mockResponse = new Response('ok', { status: 200 })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse)

    const responsePromise = fetchWithTimeout('https://example.com', {}, 5000)
    await vi.advanceTimersByTimeAsync(100)
    await responsePromise

    expect(clearTimeoutSpy).toHaveBeenCalled()
  })

  describe('signal merging', () => {
    it('should abort when caller signal is aborted (not FetchTimeoutError)', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => {
        return new Promise((_resolve, reject) => {
          const signal = options?.signal as AbortSignal
          signal?.addEventListener('abort', () => {
            const abortError = new Error('Aborted')
            abortError.name = 'AbortError'
            reject(abortError)
          })
        })
      })

      const callerController = new AbortController()
      let caughtError: unknown
      const responsePromise = fetchWithTimeout(
        'https://example.com',
        { signal: callerController.signal },
        10000 // Long timeout - should not trigger
      ).catch((err) => { caughtError = err })

      // Caller aborts before timeout
      callerController.abort()
      await vi.runAllTimersAsync()
      await responsePromise

      // Should be regular AbortError, NOT FetchTimeoutError
      expect(caughtError).toBeInstanceOf(Error)
      expect((caughtError as Error).name).toBe('AbortError')
      expect(caughtError).not.toBeInstanceOf(FetchTimeoutError)
    })

    it('should abort immediately when caller signal already aborted', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => {
        return new Promise((_resolve, reject) => {
          const signal = options?.signal as AbortSignal
          if (signal?.aborted) {
            const abortError = new Error('Aborted')
            abortError.name = 'AbortError'
            reject(abortError)
            return
          }
          signal?.addEventListener('abort', () => {
            const abortError = new Error('Aborted')
            abortError.name = 'AbortError'
            reject(abortError)
          })
        })
      })

      const callerController = new AbortController()
      callerController.abort() // Abort BEFORE calling fetchWithTimeout

      let caughtError: unknown
      await fetchWithTimeout(
        'https://example.com',
        { signal: callerController.signal },
        10000
      ).catch((err) => { caughtError = err })

      expect(caughtError).toBeInstanceOf(Error)
      expect((caughtError as Error).name).toBe('AbortError')
      expect(caughtError).not.toBeInstanceOf(FetchTimeoutError)
    })

    it('should throw FetchTimeoutError when timeout occurs with caller signal present', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => {
        return new Promise((_resolve, reject) => {
          const signal = options?.signal as AbortSignal
          signal?.addEventListener('abort', () => {
            const abortError = new Error('Aborted')
            abortError.name = 'AbortError'
            reject(abortError)
          })
        })
      })

      const callerController = new AbortController() // NOT aborted
      let caughtError: unknown
      const responsePromise = fetchWithTimeout(
        'https://example.com',
        { signal: callerController.signal },
        5000
      ).catch((err) => { caughtError = err })

      // Timeout triggers (not caller abort)
      vi.advanceTimersByTime(5001)
      await vi.runAllTimersAsync()
      await responsePromise

      // Should be FetchTimeoutError since timeout caused the abort
      expect(caughtError).toBeInstanceOf(FetchTimeoutError)
      expect((caughtError as FetchTimeoutError).timeoutMs).toBe(5000)
    })
  })
})
