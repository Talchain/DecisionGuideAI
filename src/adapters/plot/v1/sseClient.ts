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

const getProxyBase = (): string => {
  return import.meta.env.VITE_PLOT_PROXY_BASE || '/api/plot'
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

  const url = `${base}/v1/stream`

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

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (!isClosed) {
        const { done, value } = await reader.read()
        
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              handleEvent(data, handlers, throttledProgress)
            } catch (err) {
              console.warn('[plot/v1] Failed to parse SSE event:', err)
            }
          }
        }
      }
    })
    .catch((err) => {
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
    controller.abort()
  }
}

/**
 * Handle incoming SSE event
 */
function handleEvent(
  event: any,
  handlers: V1StreamHandlers,
  throttledProgress: (data: V1ProgressData) => void
) {
  const type = event.type || event.event

  switch (type) {
    case 'RUN_STARTED':
      handlers.onStarted(event.data as V1RunStartedData)
      break

    case 'PROGRESS':
      throttledProgress(event.data as V1ProgressData)
      break

    case 'INTERIM_FINDINGS':
      handlers.onInterim(event.data as V1InterimFindingsData)
      break

    case 'HEARTBEAT':
      // No-op, just keeps connection alive
      break

    case 'COMPLETE':
      handlers.onComplete(event.data as V1CompleteData)
      break

    case 'ERROR':
      handlers.onError(mapEventError(event.data))
      break

    default:
      console.warn('[plot/v1] Unknown SSE event type:', type)
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
