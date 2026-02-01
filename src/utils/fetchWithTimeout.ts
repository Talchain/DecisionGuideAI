/**
 * Fetch wrapper with AbortController timeout
 * Prevents indefinite network hangs by aborting after specified duration
 */

/** Default timeout in milliseconds */
export const DEFAULT_FETCH_TIMEOUT_MS = 30000

/**
 * Custom error class for timeout scenarios
 * Allows callers to distinguish timeout from other fetch errors
 */
export class FetchTimeoutError extends Error {
  constructor(message: string, public timeoutMs: number) {
    super(message)
    this.name = 'FetchTimeoutError'
  }
}

/**
 * Fetch with automatic timeout via AbortController.
 * Merges caller-provided signal with timeout signal so both can abort the request.
 * @param url - URL to fetch
 * @param options - Standard RequestInit options (caller signal is preserved)
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns Promise<Response>
 * @throws FetchTimeoutError if request times out
 */
export function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()

  // Track whether abort was from timeout (not caller signal)
  let timedOut = false
  const id = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  // Merge caller signal: if caller aborts, abort our controller too (without setting timedOut)
  const callerSignal = options.signal
  if (callerSignal) {
    if (callerSignal.aborted) {
      // Already aborted - abort immediately (not a timeout)
      controller.abort()
    } else {
      callerSignal.addEventListener('abort', () => controller.abort(), { once: true })
    }
  }

  return fetch(url, { ...options, signal: controller.signal })
    .catch((err) => {
      // Convert AbortError to FetchTimeoutError only if it was our timeout
      if (err instanceof Error && err.name === 'AbortError' && timedOut) {
        throw new FetchTimeoutError(
          `Request timed out after ${timeoutMs}ms`,
          timeoutMs
        )
      }
      throw err
    })
    .finally(() => clearTimeout(id))
}
