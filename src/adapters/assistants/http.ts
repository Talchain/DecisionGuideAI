/**
 * M2: Assistants API HTTP Client
 * All calls go through /bff/assist proxy; server adds auth headers
 */

import type { DraftRequest, DraftResponse, DraftStreamEvent, AssistError } from './types'
import {
  withObservabilityHeaders,
  recordBffResponse,
  recordBffError,
} from '@/lib/observability-headers'

const getBffBase = (): string => {
  return import.meta.env.VITE_BFF_BASE || '/bff/assist'
}

const nowIso = () => new Date().toISOString()

function makeHttpAssistError(status: number, body: any, correlationId: string): AssistError {
  let code: AssistError['code']
  let message: string

  if (status === 400) {
    code = 'BAD_INPUT'
    message = body?.error || "We couldn't process that request. Please check your description and try again."
  } else if (status === 404) {
    code = 'SERVER_ERROR'
    message = 'Drafting is currently unavailable. Please try again later.'
  } else if (status >= 500 && status < 600) {
    code = 'SERVER_ERROR'
    message = "We couldn't reach the service. Please try again in a moment."
  } else {
    code = 'SERVER_ERROR'
    message = body?.error || 'Draft failed. Please try again.'
  }

  return {
    code,
    message,
    details: {
      ...body,
      status,
      correlationId,
      timestamp: nowIso(),
    },
  }
}

function makeTimeoutError(): AssistError {
  return {
    code: 'TIMEOUT',
    message: 'Request timed out. Please try again.',
    details: {
      timestamp: nowIso(),
    },
  }
}

function makeNetworkError(err: unknown): AssistError {
  return {
    code: 'NETWORK_ERROR',
    message: 'Connection lost. Check your internet and try again.',
    details: {
      rawError: err instanceof Error ? err.message : String(err),
      timestamp: nowIso(),
    },
  }
}

/**
 * Generate correlation ID for request tracking (M2.6)
 */
function generateCorrelationId(): string {
  return crypto.randomUUID()
}

/**
 * POST /bff/engine/v1/draft-flows (sync)
 */
export async function draftGraph(
  request: DraftRequest,
  options?: { signal?: AbortSignal; correlationId?: string }
): Promise<DraftResponse> {
  const base = getBffBase()
  const correlationId = options?.correlationId || generateCorrelationId()
  const endpoint = `${base}/v1/draft-flows`

  // Build request body
  const requestBody = {
    path: '/draft-graph',
    payload: request,
  }

  // Add observability headers (async for SHA-256 hashing)
  let startTime = Date.now()
  let requestId = correlationId

  try {
    const { headers, requestId: obsRequestId, startTime: obsStartTime } = await withObservabilityHeaders(
      endpoint,
      'POST',
      requestBody,
      {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
      },
      correlationId
    )
    startTime = obsStartTime
    requestId = obsRequestId

    let response: Response | null = null
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: options?.signal,
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      recordBffResponse(requestId, endpoint, response, startTime, `HTTP ${response.status}`)
      throw makeHttpAssistError(response.status, errorBody, correlationId)
    }

    // Record successful response
    recordBffResponse(requestId, endpoint, response, startTime)
    return await response.json()
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      recordBffError(requestId, endpoint, startTime, err)
      console.error('[DRAFT_GRAPH_FAILED]', { reason: 'timeout', correlationId })
      throw makeTimeoutError()
    }
    if ((err as any).code) {
      // Already an AssistError - response already recorded above
      console.error('[DRAFT_GRAPH_FAILED]', { reason: (err as any).code, correlationId })
      throw err
    }
    recordBffError(requestId, endpoint, startTime, err)
    console.error('[DRAFT_GRAPH_FAILED]', { reason: 'network', correlationId, error: err })
    throw makeNetworkError(err)
  }
}

/**
 * POST /bff/engine/v1/draft-flows (streaming)
 * Returns async generator of events
 */
export async function* draftGraphStream(
  request: DraftRequest,
  options?: { signal?: AbortSignal; correlationId?: string }
): AsyncGenerator<DraftStreamEvent> {
  const base = getBffBase()
  const correlationId = options?.correlationId || generateCorrelationId()
  const endpoint = `${base}/v1/draft-flows`

  // Build request body
  const requestBody = {
    path: '/draft-graph/stream',
    payload: request,
    stream: true,
  }

  // Add observability headers (async for SHA-256 hashing)
  let startTime = Date.now()
  let requestId = correlationId

  const { headers, requestId: obsRequestId, startTime: obsStartTime } = await withObservabilityHeaders(
    endpoint,
    'POST',
    requestBody,
    {
      'Content-Type': 'application/json',
      'x-correlation-id': correlationId,
      'Accept': 'text/event-stream',
    },
    correlationId
  )
  startTime = obsStartTime
  requestId = obsRequestId

  let response: Response

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: options?.signal,
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      recordBffResponse(requestId, endpoint, response, startTime, `HTTP ${response.status}`)
      throw makeHttpAssistError(response.status, errorBody, correlationId)
    }

    // Record initial response (stream started)
    recordBffResponse(requestId, endpoint, response, startTime)
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      recordBffError(requestId, endpoint, startTime, err)
      console.error('[DRAFT_GRAPH_FAILED]', { reason: 'timeout', correlationId, streaming: true })
      throw makeTimeoutError()
    }
    if ((err as any).code) {
      // Already an AssistError - response already recorded above
      console.error('[DRAFT_GRAPH_FAILED]', { reason: (err as any).code, correlationId, streaming: true })
      throw err
    }
    recordBffError(requestId, endpoint, startTime, err)
    console.error('[DRAFT_GRAPH_FAILED]', { reason: 'network', correlationId, streaming: true, error: err })
    throw makeNetworkError(err)
  }

  // Parse SSE stream
  const reader = response.body?.getReader()
  if (!reader) {
    throw {
      code: 'NETWORK_ERROR',
      message: 'No response body',
    } as AssistError
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim() || line.startsWith(':')) continue // Skip empty or comments

        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          try {
            const event: DraftStreamEvent = JSON.parse(data)
            yield event

            // Stop on complete or error
            if (event.type === 'complete' || event.type === 'error') {
              return
            }
          } catch {
            // Ignore malformed events
            console.warn('[assistants] Malformed SSE event:', data)
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
