/**
 * M2: Assistants API HTTP Client
 * All calls go through /bff/assist proxy; server adds auth headers
 */

import type { DraftRequest, DraftResponse, DraftStreamEvent, AssistError } from './types'

const getBffBase = (): string => {
  return import.meta.env.VITE_BFF_BASE || '/bff/assist'
}

/**
 * Generate correlation ID for request tracking (M2.6)
 */
function generateCorrelationId(): string {
  return crypto.randomUUID()
}

/**
 * POST /bff/assist/draft-graph (sync)
 */
export async function draftGraph(
  request: DraftRequest,
  options?: { signal?: AbortSignal; correlationId?: string }
): Promise<DraftResponse> {
  const base = getBffBase()
  const correlationId = options?.correlationId || generateCorrelationId()

  try {
    const response = await fetch(`${base}/draft-graph`, {
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
      throw {
        code: response.status === 400 ? 'BAD_INPUT' : 'SERVER_ERROR',
        message: errorBody.error || `HTTP ${response.status}`,
        details: errorBody,
      } as AssistError
    }

    return await response.json()
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw {
        code: 'TIMEOUT',
        message: 'Request aborted',
      } as AssistError
    }
    if ((err as any).code) {
      throw err // Already an AssistError
    }
    throw {
      code: 'NETWORK_ERROR',
      message: err instanceof Error ? err.message : String(err),
    } as AssistError
  }
}

/**
 * POST /bff/assist/draft-graph/stream (streaming)
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
    response = await fetch(`${base}/draft-graph/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify({
        path: '/draft-graph/stream',
        payload: request,
      }),
      signal: options?.signal,
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw {
        code: response.status === 400 ? 'BAD_INPUT' : 'SERVER_ERROR',
        message: errorBody.error || `HTTP ${response.status}`,
        details: errorBody,
      } as AssistError
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw {
        code: 'TIMEOUT',
        message: 'Request aborted',
      } as AssistError
    }
    if ((err as any).code) {
      throw err
    }
    throw {
      code: 'NETWORK_ERROR',
      message: err instanceof Error ? err.message : String(err),
    } as AssistError
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
