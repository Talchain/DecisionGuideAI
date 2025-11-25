import type {
  CEEDraftResponse,
  CEEInsightsResponse,
  CEEFramingFeedback,
} from './types'

const CEE_BASE_URL = (import.meta as any).env?.VITE_CEE_BFF_BASE || '/bff/cee'

/**
 * Generate correlation ID for request tracking
 * Mirrors pattern from Assistants client
 */
function generateCorrelationId(): string {
  return crypto.randomUUID()
}

export class CEEError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
    public correlationId?: string
  ) {
    super(message)
    this.name = 'CEEError'
  }
}

export class CEEClient {
  private baseURL: string
  private timeout: number

  constructor(config: { timeout?: number } = {}) {
    this.baseURL = CEE_BASE_URL
    this.timeout = config.timeout ?? 30000
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    const correlationId = generateCorrelationId()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId,
          ...options.headers,
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))

        const baseMessage =
          response.status === 404
            ? 'Draft My Model is not available in this environment.'
            : error.message || `Request failed: ${response.status}`

        throw new CEEError(
          baseMessage,
          response.status,
          error,
          correlationId
        )
      }

      return response.json()
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new CEEError('Request timeout', 408, undefined, correlationId)
      }
      throw error
    }
  }

  /**
   * Generate draft model from description
   * Calls CEE /assist/v1/draft-graph endpoint
   */
  async draftModel(description: string): Promise<CEEDraftResponse> {
    return this.fetch<CEEDraftResponse>('/assist/v1/draft-graph', {
      method: 'POST',
      body: JSON.stringify({ brief: description }),
    })
  }

  /**
   * Check for cognitive biases in a decision graph
   * Endpoint: POST /assist/v1/bias-check
   *
   * @param graph - The decision graph with nodes and edges
   * @param archetype - Optional archetype for context
   */
  async biasCheck(
    graph: {
      nodes: Array<{ id: string; label: string; type: string }>
      edges: Array<{ from: string; to: string }>
    },
    archetype?: string
  ): Promise<CEEInsightsResponse> {
    return this.fetch<CEEInsightsResponse>('/assist/v1/bias-check', {
      method: 'POST',
      body: JSON.stringify({ graph, archetype }),
    })
  }

  /**
   * Get sensitivity analysis coaching for a decision
   * Endpoint: POST /assist/v1/sensitivity-coach
   *
   * @param graph - The decision graph with nodes and edges
   * @param inference - The inference/analysis context
   */
  async sensitivityCoach(
    graph: {
      nodes: Array<{ id: string; label: string; type: string }>
      edges: Array<{ from: string; to: string }>
    },
    inference: Record<string, unknown>
  ): Promise<CEEInsightsResponse> {
    return this.fetch<CEEInsightsResponse>('/assist/v1/sensitivity-coach', {
      method: 'POST',
      body: JSON.stringify({ graph, inference }),
    })
  }

  /**
   * @deprecated Use biasCheck() instead. This method signature is incompatible with CEE API.
   * CEE's bias-check endpoint requires a graph, not a text description.
   * Keeping for backward compatibility - returns degraded response.
   */
  async framingFeedback(_partialDescription: string): Promise<CEEFramingFeedback> {
    // CEE doesn't have a text-based framing feedback endpoint
    // Return a degraded response instead of calling a non-existent endpoint
    console.warn('[CEE] framingFeedback() is deprecated. CEE requires a graph for bias-check.')
    return {
      status: 'good',
      message: 'Real-time feedback is temporarily unavailable.',
      suggestions: [],
    }
  }

  /**
   * @deprecated Use biasCheck() or sensitivityCoach() instead.
   * Keeping for backward compatibility with useCEEInsights hook.
   */
  async analyzeInsights(graph: {
    nodes: Array<{ id: string; label: string; type: string }>
    edges: Array<{ from: string; to: string }>
  }): Promise<CEEInsightsResponse> {
    // Delegate to biasCheck which is the correct endpoint
    return this.biasCheck(graph)
  }
}
