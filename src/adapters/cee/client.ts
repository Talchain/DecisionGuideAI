import type {
  CEEDraftResponse,
  CEEInsightsResponse,
  CEEFramingFeedback,
} from './types'

const CEE_BASE_URL = (import.meta as any).env?.VITE_CEE_BFF_BASE || '/bff/cee'

export class CEEError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
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
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new CEEError(
          error.message || `Request failed: ${response.status}`,
          response.status,
          error
        )
      }

      return response.json()
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new CEEError('Request timeout', 408)
      }
      throw error
    }
  }

  /**
   * Generate draft model from description
   */
  async draftModel(description: string): Promise<CEEDraftResponse> {
    return this.fetch<CEEDraftResponse>('/draft', {
      method: 'POST',
      body: JSON.stringify({ description }),
    })
  }

  /**
   * Get real-time framing feedback
   */
  async framingFeedback(partialDescription: string): Promise<CEEFramingFeedback> {
    return this.fetch<CEEFramingFeedback>('/framing/feedback', {
      method: 'POST',
      body: JSON.stringify({ description: partialDescription }),
    })
  }

  /**
   * Analyze decision for biases and quality
   */
  async analyzeInsights(graph: {
    nodes: Array<{ id: string; label: string; type: string }>
    edges: Array<{ from: string; to: string }>
  }): Promise<CEEInsightsResponse> {
    return this.fetch<CEEInsightsResponse>('/insights', {
      method: 'POST',
      body: JSON.stringify({ graph }),
    })
  }
}
