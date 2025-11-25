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
   * Get real-time framing feedback
   * Endpoint: /assist/v1/framing/feedback
   */
  async framingFeedback(partialDescription: string): Promise<CEEFramingFeedback> {
    return this.fetch<CEEFramingFeedback>('/assist/v1/framing/feedback', {
      method: 'POST',
      body: JSON.stringify({ description: partialDescription }),
    })
  }

  /**
   * Analyze decision for biases and quality
   * Endpoint: /assist/v1/insights
   */
  async analyzeInsights(graph: {
    nodes: Array<{ id: string; label: string; type: string }>
    edges: Array<{ from: string; to: string }>
  }): Promise<CEEInsightsResponse> {
    return this.fetch<CEEInsightsResponse>('/assist/v1/insights', {
      method: 'POST',
      body: JSON.stringify({ graph }),
    })
  }
}
