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
import { PLOT_ENDPOINTS } from '../endpoints'
import { streamMetrics, errorMetrics } from '../../observability/metrics'

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
        streamMetrics.timeout()
      }
    }, TIMEOUTS.STREAM_HEARTBEAT_MS)
  }

  const url = PLOT_ENDPOINTS.stream()

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify(request),
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
              handleEvent(eventType, data, handlers, throttledProgress, resetHeartbeat)
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
        // Track network error
        errorMetrics.networkError()
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
 */
function handleEvent(
  eventType: string,
  data: any,
  handlers: V1StreamHandlers,
  throttledProgress: (data: V1ProgressData) => void,
  resetHeartbeat: () => void
) {
  // Reset heartbeat on any event
  resetHeartbeat()

  switch (eventType) {
    case 'started':
      handlers.onStarted(data as V1RunStartedData)
      // Track stream started
      streamMetrics.started(data.response_id)
      break

    case 'progress':
      // Cap progress at 90% until COMPLETE event to avoid premature 100%
      const cappedData = {
        ...data,
        percent: Math.min(data.percent, 90),
      }
      throttledProgress(cappedData as V1ProgressData)
      // Track milestone progress (25%, 50%, 75% only to avoid spam)
      streamMetrics.progress(cappedData.percent)
      break

    case 'interim':
      handlers.onInterim(data as V1InterimFindingsData)
      // Track interim findings
      const findingsCount = data.findings?.length || 0
      streamMetrics.interim(findingsCount)
      break

    case 'heartbeat':
      // No-op, just resets heartbeat timer (already done above)
      break

    case 'complete':
      // Send final 100% progress before completion
      throttledProgress({ percent: 100 })
      handlers.onComplete(data as V1CompleteData)
      // Track stream completed (timing handled by useResultsRun)
      streamMetrics.completed(data.response_id, 0) // Duration tracked at hook level
      break

    case 'error':
      handlers.onError(mapEventError(data))
      // Track error via errorMetrics
      const mappedError = mapEventError(data)
      if (mappedError.code === 'RATE_LIMITED') {
        errorMetrics.rateLimited(mappedError.retry_after)
      } else if (mappedError.code === 'BAD_INPUT') {
        errorMetrics.validationError(mappedError.field)
      } else {
        errorMetrics.serverError(mappedError.code)
      }
      break

    default:
      console.warn('[plot/v1] Unknown SSE event type:', eventType)
  }
}

/**
 * Map HTTP error response to V1Error
 */
async function mapStreamError(response: Response): Promise<V1Error> {
  let body: any
  try {
    body = await response.json()
  } catch {
    body = {}
  }

  if (response.status === 429) {
    return {
      code: 'RATE_LIMITED',
      message: body.error || 'Too many requests',
      retry_after: body.retry_after,
    }
  }

  if (response.status === 400) {
    return {
      code: 'BAD_INPUT',
      message: body.error || 'Invalid input',
      field: body.fields?.field,
      max: body.fields?.max,
    }
  }

  return {
    code: 'SERVER_ERROR',
    message: body.error || `HTTP ${response.status}`,
  }
}

/**
 * Map SSE error event to V1Error
 */
function mapEventError(data: any): V1Error {
  return {
    code: data.code || 'SERVER_ERROR',
    message: data.message || 'Unknown error',
    field: data.field,
    max: data.max,
    retry_after: data.retry_after,
    details: data.details,
  }
}
