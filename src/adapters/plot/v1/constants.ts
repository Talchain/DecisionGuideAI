/**
 * PLoT v1 HTTP adapter constants
 */

// Limits
export const LIMITS = {
  MAX_SYNC_NODES: 30, // Threshold for sync vs stream (≤30 → sync, >30 → stream)
} as const

// Timeouts
export const TIMEOUTS = {
  SYNC_REQUEST_MS: 30_000, // 30 seconds for sync runs
  STREAM_HEARTBEAT_MS: 20_000, // 20 seconds for stream heartbeat
  HEALTH_CHECK_MS: 5_000, // 5 seconds for health checks
} as const

// Retry configuration
export const RETRY = {
  MAX_ATTEMPTS: 3, // Maximum retry attempts
  BASE_DELAY_MS: 1000, // Base delay (1 second)
  MAX_DELAY_MS: 10_000, // Max delay (10 seconds)
  JITTER_FACTOR: 0.2, // ±20% jitter
} as const

// Retryable error conditions
export const RETRYABLE_ERRORS = {
  // HTTP status codes
  STATUS_CODES: [500, 502, 503, 504, 429] as const, // AUDIT FIX 3: Added 429 for rate limit retry

  // Error codes (TIMEOUT excluded - not transient, requires manual retry)
  // SERVER_ERROR = 5xx responses, NETWORK_ERROR = fetch failures
  // RATE_LIMITED = 429 responses (AUDIT FIX 3: now retryable with respect to retry_after)
  ERROR_CODES: ['SERVER_ERROR', 'NETWORK_ERROR', 'RATE_LIMITED'] as const,
} as const

/**
 * Calculate exponential backoff delay with jitter
 * Formula: delay = min(BASE * 2^attempt, MAX) ± (JITTER * delay)
 */
export function calculateBackoffMs(attempt: number): number {
  const exponential = RETRY.BASE_DELAY_MS * Math.pow(2, attempt)
  const capped = Math.min(exponential, RETRY.MAX_DELAY_MS)

  // Add random jitter: ±20%
  const jitter = capped * RETRY.JITTER_FACTOR * (Math.random() * 2 - 1)

  return Math.floor(capped + jitter)
}

/**
 * AUDIT FIX 3: Calculate retry delay respecting server's retry_after header
 * For rate-limited requests (429), use server-specified delay instead of exponential backoff
 */
export function calculateRateLimitDelayMs(retryAfter: number | undefined): number {
  if (!retryAfter) {
    // No retry_after provided, use default backoff
    return calculateBackoffMs(0)
  }

  // Convert seconds to milliseconds and cap at MAX_DELAY_MS
  const delayMs = retryAfter * 1000
  return Math.min(delayMs, RETRY.MAX_DELAY_MS)
}

/**
 * Check if an HTTP status code is retryable
 */
export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_ERRORS.STATUS_CODES.includes(status as any)
}

/**
 * Check if an error code is retryable
 */
export function isRetryableErrorCode(code: string): boolean {
  return RETRYABLE_ERRORS.ERROR_CODES.includes(code as any)
}

/**
 * Determine if a graph should use sync or stream endpoint
 * Small graphs (≤30 nodes) use sync, large graphs use stream
 */
export function shouldUseSync(nodeCount: number): boolean {
  return nodeCount <= LIMITS.MAX_SYNC_NODES
}
