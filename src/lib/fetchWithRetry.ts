/**
 * Generic retry wrapper with exponential backoff and jitter.
 *
 * Wraps an async operation (typically a fetch call) and retries on transient failures.
 * Respects AbortController signals — if the signal is already aborted or aborts during
 * backoff, the retry loop exits immediately without further attempts.
 */

export interface RetryConfig {
  /** Maximum number of retries (default: 2, so 3 total attempts) */
  maxRetries: number
  /** Base delay in ms for exponential backoff (default: 1000) */
  baseDelayMs: number
  /** Random jitter fraction ±this value (default: 0.25) */
  jitterFraction: number
  /** HTTP status codes that trigger a retry (default: [502, 503, 504, 429]) */
  retryableStatuses: number[]
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 2,
  baseDelayMs: 1000,
  jitterFraction: 0.25,
  retryableStatuses: [502, 503, 504, 429],
}

/** Status codes that should never be retried */
const NON_RETRYABLE_STATUSES = new Set([400, 401, 403, 404, 422])

/**
 * Execute an async function with retry and exponential backoff.
 *
 * @param fn - Async function to execute. Receives the attempt number (0-based).
 * @param signal - Optional AbortSignal. If aborted, retries stop immediately.
 * @param config - Partial retry configuration (merged with defaults).
 * @returns The result of `fn` on the first successful attempt.
 * @throws The last error after all retry attempts are exhausted, or immediately
 *         for non-retryable errors (4xx client errors, abort signals).
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  signal?: AbortSignal | null,
  config?: Partial<RetryConfig>,
): Promise<T> {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const totalAttempts = cfg.maxRetries + 1
  let lastError: unknown

  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    // Bail immediately if signal is already aborted
    if (signal?.aborted) {
      throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError')
    }

    try {
      return await fn(attempt)
    } catch (err) {
      lastError = err

      // Never retry abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        throw err
      }

      // Never retry non-retryable HTTP statuses
      if (isNonRetryable(err)) {
        throw err
      }

      // Only retry if the error is retryable
      if (!isRetryable(err, cfg.retryableStatuses)) {
        throw err
      }

      // Don't sleep after the last attempt
      if (attempt < totalAttempts - 1) {
        const delayMs = calculateDelay(attempt, cfg)
        await abortableDelay(delayMs, signal)
      }
    }
  }

  throw lastError
}

/** Check if an error has a non-retryable HTTP status */
function isNonRetryable(err: unknown): boolean {
  const status = extractStatus(err)
  return status !== undefined && NON_RETRYABLE_STATUSES.has(status)
}

/** Check if an error is retryable (network error or retryable HTTP status) */
function isRetryable(err: unknown, retryableStatuses: number[]): boolean {
  // Network errors (TypeError from fetch) are always retryable
  if (err instanceof TypeError) return true

  const status = extractStatus(err)
  if (status !== undefined) {
    return retryableStatuses.includes(status)
  }

  return false
}

/** Extract HTTP status from an error object (CEEError, ISLError, etc.) */
function extractStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'status' in err) {
    const s = (err as { status: unknown }).status
    if (typeof s === 'number') return s
  }
  return undefined
}

/** Calculate backoff delay: base * 2^attempt ± jitter */
function calculateDelay(attempt: number, cfg: RetryConfig): number {
  const exponential = cfg.baseDelayMs * Math.pow(2, attempt)
  const jitter = exponential * cfg.jitterFraction * (Math.random() * 2 - 1)
  return Math.max(0, Math.floor(exponential + jitter))
}

/** Sleep that resolves early if the signal is aborted */
function abortableDelay(ms: number, signal?: AbortSignal | null): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(
      signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'),
    )
  }

  return new Promise<void>((resolve, reject) => {
    let settled = false

    const cleanup = () => {
      settled = true
      signal?.removeEventListener('abort', onAbort)
    }

    const onAbort = () => {
      if (settled) return
      clearTimeout(timer)
      cleanup()
      reject(signal?.reason ?? new DOMException('The operation was aborted.', 'AbortError'))
    }

    const timer = setTimeout(() => {
      if (settled) return
      cleanup()
      resolve()
    }, ms)

    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
