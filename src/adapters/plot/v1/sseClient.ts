/**
 * PLoT v1 SSE client with throttling
 * POST /v1/stream via EventSource polyfill
 */

import type {
  V1RunRequest,
  V1StreamHandlers,
  V1RunStartedData,
  V1ProgressData,
  V1InterimFindingsData,
  V1CompleteData,
  V1Error,
} from './types'
import { TIMEOUTS } from './constants'

const getProxyBase = (): string => {
  return import.meta.env.VITE_PLOT_PROXY_BASE || '/bff/engine'
}

/**
 * Throttle function calls using requestAnimationFrame
 */
function throttle<T extends (...args: any[]) => void>(fn: T, delay = 100): T {
  let lastCall = 0
  let timeoutId: number | null = null

  return ((...args: any[]) => {
    const now = Date.now()
    const timeSince = now - lastCall

    if (timeSince >= delay) {
      lastCall = now
      fn(...args)
    } else {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => {
        lastCall = Date.now()
        fn(...args)
      }, delay - timeSince)
    }
  }) as T
}

/**
 * Stream a run via SSE
 * Returns cancel function
 */
export function runStream(
  request: V1RunRequest,
  handlers: V1StreamHandlers
): () => void {
  const base = getProxyBase()

  // Throttle progress updates to avoid UI stutter
  const throttledProgress = throttle(handlers.onProgress, 100)

  // EventSource doesn't support POST, so we need to use fetch with streaming
  const controller = new AbortController()
  let isClosed = false
  let heartbeatTimeout: ReturnType<typeof setTimeout> | null = null

  // Reset heartbeat timer on any activity
  const resetHeartbeat = () => {
    if (heartbeatTimeout) clearTimeout(heartbeatTimeout)
    heartbeatTimeout = setTimeout(() => {
      if (!isClosed) {
        isClosed = true
        controller.abort()
        handlers.onError({
          code: 'TIMEOUT',
          message: `Stream timeout: no heartbeat received for ${TIMEOUTS.STREAM_HEARTBEAT_MS / 1000}s`,
        })
      }
    }, TIMEOUTS.STREAM_HEARTBEAT_MS)
  }

  const url = `${base}/v1/stream`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
  }

  // Extract idempotency key for header-only usage; do not send it in JSON body
  const { idempotencyKey, ...requestForBody } = request as any

  // Forward idempotency key when provided so the Engine can engage CEE
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey
  }

  fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestForBody),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const error = await mapStreamError(response)
        handlers.onError(error)
        return
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      // Start heartbeat monitoring
      resetHeartbeat()

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let eventType = ''

      // Tests may provide a minimal mocked Response without headers. In real
      // fetch responses, headers is always present, but we defensively guard
      // here to avoid throwing in unit tests.
      const rawHeaders: any = (response as any).headers
      const safeGetHeader = (name: string): string | null => {
        if (!rawHeaders || typeof rawHeaders.get !== 'function') return null
        try {
          return rawHeaders.get(name)
        } catch {
          return null
        }
      }

      const correlationIdHeader = safeGetHeader('X-Correlation-Id') ?? undefined
      const degradedHeader = safeGetHeader('X-Olumi-Degraded')
      const degradedFlag = degradedHeader === '1' || degradedHeader === 'true'

      while (!isClosed) {
        const { done, value } = await reader.read()

        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              handleEvent(
                eventType,
                data,
                handlers,
                throttledProgress,
                resetHeartbeat,
                correlationIdHeader,
                degradedFlag
              )
              eventType = '' // Reset for next event
            } catch (err) {
              console.warn('[plot/v1] Failed to parse SSE event:', err)
            }
          }
        }
      }

      // Clean up heartbeat timer
      if (heartbeatTimeout) clearTimeout(heartbeatTimeout)
    })
    .catch((err) => {
      if (heartbeatTimeout) clearTimeout(heartbeatTimeout)
      if (!isClosed) {
        if (err.name === 'AbortError') {
          // Cancelled - don't call onError
          return
        }
        handlers.onError({
          code: 'NETWORK_ERROR',
          message: err.message || String(err),
        })
      }
    })

  // Return cancel function
  return () => {
    isClosed = true
    if (heartbeatTimeout) clearTimeout(heartbeatTimeout)
    controller.abort()
  }
}

/**
 * Handle incoming SSE event with progress capping
 * v1.2: Added support for new event names (RUN_STARTED, COMPLETE, ERROR, CANCELLED)
 */
function handleEvent(
  eventType: string,
  data: any,
  handlers: V1StreamHandlers,
  throttledProgress: (data: V1ProgressData) => void,
  resetHeartbeat: () => void,
  correlationIdHeader?: string,
  degradedFlag?: boolean
) {
  // Reset heartbeat on any event
  resetHeartbeat()

  switch (eventType) {
    case 'started':
    case 'RUN_STARTED': // v1.2: new event name (alias)
      handlers.onStarted(data as V1RunStartedData)
      break

    case 'progress':
      // Cap progress at 90% until COMPLETE event to avoid premature 100%
      const cappedData = {
        ...data,
        percent: Math.min(data.percent, 90),
      }
      throttledProgress(cappedData as V1ProgressData)
      break

    case 'interim':
      handlers.onInterim(data as V1InterimFindingsData)
      break

    case 'heartbeat':
      // No-op, just resets heartbeat timer (already done above)
      break

    case 'complete':
    case 'COMPLETE': // v1.2: new event name (alias)
      // Send final 100% progress before completion
      throttledProgress({ percent: 100 })
      handlers.onComplete({
        ...(data as V1CompleteData),
        correlation_id_header: correlationIdHeader,
        degraded: degradedFlag ?? (data as any)?.degraded ?? false,
      })
      break

    case 'error':
    case 'ERROR': // v1.2: new event name (alias)
      handlers.onError(mapEventError(data))
      break

    case 'CANCELLED': // v1.2: explicit cancellation event
      // Treat cancellation as error with specific code
      handlers.onError({
        code: 'CANCELLED' as any,
        message: data?.message || 'Run was cancelled',
        details: data,
      })
      break

    default:
      console.warn('[plot/v1] Unknown SSE event type:', eventType)
  }
}

/**
 * Map HTTP error response from /v1/stream to V1Error.
 *
 * Mirrors the main HTTP client's behaviour so callers see consistent
 * codes, retry semantics, and details regardless of whether the
 * failure happened before or after the SSE stream was established.
 */
async function mapStreamError(response: Response): Promise<V1Error> {
  let body: any
  try {
    body = await response.json()
  } catch {
    body = {}
  }

  // Some unit tests provide a plain object instead of a real Response.
  // Guard header access to avoid throwing when headers is missing.
  const rawHeaders: any = (response as any).headers
  const safeGetHeader = (name: string): string | null => {
    if (!rawHeaders || typeof rawHeaders.get !== 'function') return null
    try {
      return rawHeaders.get(name)
    } catch {
      return null
    }
  }

  // Rate limited (429) – honour Retry-After semantics and X-RateLimit-Reason
  if (response.status === 429) {
    const retryAfterHeader = safeGetHeader('Retry-After')
    const retryAfterBody =
      typeof body.retry_after_s === 'number'
        ? body.retry_after_s
        : typeof body.retry_after_seconds === 'number'
          ? body.retry_after_seconds
          : typeof body.retry_after === 'number'
            ? body.retry_after
            : undefined
    const retryAfter =
      typeof retryAfterBody === 'number'
        ? retryAfterBody
        : retryAfterHeader
          ? Number.parseInt(retryAfterHeader, 10)
          : undefined
    const reason = safeGetHeader('X-RateLimit-Reason') || body.reason || 'Rate limit exceeded'

    return {
      code: 'RATE_LIMITED',
      message: body.error || 'Too many requests',
      retry_after: retryAfter,
      details: { ...body, status: response.status, reason, retry_after: retryAfter },
    }
  }

  // Bad input (400) – propagate validation fields/max and attach status
  if (response.status === 400) {
    if (body.reason === 'graph_too_large' && body.limits) {
      const limits = body.limits
      return {
        code: 'LIMIT_EXCEEDED',
        message: `Graph exceeds backend runtime limits: ${limits.nodes || '?'} nodes max, ${limits.edges || '?'} edges max`,
        field: 'nodes',
        max: limits.nodes,
        details: { ...body, status: response.status },
      }
    }

    return {
      code: 'BAD_INPUT',
      message: body.error || body.reason || 'Invalid input',
      field: body.fields?.field,
      max: body.fields?.max,
      details: { ...body, status: response.status },
    }
  }

  // Payload too large / explicit LIMIT_EXCEEDED
  if (response.status === 413 || body.code === 'LIMIT_EXCEEDED') {
    return {
      code: 'LIMIT_EXCEEDED',
      message: body.error || 'Request exceeds limits',
      field: body.fields?.field,
      max: body.fields?.max,
      details: { ...body, status: response.status },
    }
  }

  // Gateway timeout (504) – proxy timeout, analysis took too long
  if (response.status === 504) {
    return {
      code: 'GATEWAY_TIMEOUT',
      message: 'Analysis timed out via gateway (proxy timeout). Try a smaller graph or "quick" mode.',
      details: { ...body, status: response.status },
    }
  }

  // Generic server error
  return {
    code: 'SERVER_ERROR',
    message: body.error || `HTTP ${response.status}`,
    details: { ...body, status: response.status },
  }
}

/**
 * Map SSE error event to V1Error
 */
function mapEventError(data: any): V1Error {
  const details = data.details ?? data
  return {
    code: data.code || 'SERVER_ERROR',
    message: data.message || 'Unknown error',
    field: data.field,
    max: data.max,
    retry_after: data.retry_after,
    details,
    requestId: data.request_id || data.requestId || details?.request_id || details?.requestId,
  }
}
