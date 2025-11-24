/**
 * M2: Assistants API HTTP Client
 * All calls go through /bff/assist proxy; server adds auth headers
 */

import type { DraftRequest, DraftResponse, DraftStreamEvent, AssistError } from './types'

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

  try {
    const response = await fetch(`${base}/v1/draft-flows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify({
        path: '/draft-graph',
        payload: request,
      }),
      signal: options?.signal,
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw makeHttpAssistError(response.status, errorBody, correlationId)
    }

    return await response.json()
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw makeTimeoutError()
    }
    if ((err as any).code) {
      throw err // Already an AssistError
    }
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

  let response: Response

  try {
    response = await fetch(`${base}/v1/draft-flows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        path: '/draft-graph/stream',
        payload: request,
        stream: true,
      }),
      signal: options?.signal,
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw makeHttpAssistError(response.status, errorBody, correlationId)
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw makeTimeoutError()
    }
    if ((err as any).code) {
      throw err
    }
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
