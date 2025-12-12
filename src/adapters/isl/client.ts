import type {
  ISLValidationResponse,
  ISLConformalResponse,
  ISLComparisonResponse,
  ISLRunRequest,
  ISLRobustnessRequest,
  ISLRobustnessResponse,
  ISLConformalRequest,
  ContrastiveExplanationRequest,
  ContrastiveExplanationResponse,
  TransportabilityRequest,
  TransportabilityResponse,
} from './types'

const ISL_BASE_URL = (import.meta as any).env?.VITE_ISL_BFF_BASE || '/bff/isl'

/**
 * Generate correlation ID for request tracking
 * Mirrors pattern from Assistants client
 */
function generateCorrelationId(): string {
  return crypto.randomUUID()
}

export class ISLError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
    public correlationId?: string
  ) {
    super(message)
    this.name = 'ISLError'
  }
}

export class ISLClient {
  private baseURL: string
  private timeout: number

  constructor(config: { timeout?: number } = {}) {
    this.baseURL = ISL_BASE_URL
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
        throw new ISLError(
          error.message || `Request failed: ${response.status}`,
          response.status,
          error,
          correlationId
        )
      }

      return response.json()
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ISLError('Request timeout', 408, undefined, correlationId)
      }
      throw error
    }
  }

  /**
   * Validate graph and get suggestions
   */
  async validate(request: ISLRunRequest): Promise<ISLValidationResponse> {
    return this.fetch<ISLValidationResponse>('/validate', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  /**
   * Brief 30: Robustness analysis with correct ISL endpoint and schema
   * POST /api/v1/robustness/analyze
   */
  async robustnessAnalyze(request: ISLRobustnessRequest): Promise<ISLRobustnessResponse> {
    return this.fetch<ISLRobustnessResponse>('/api/v1/robustness/analyze', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  /**
   * Brief 30: Conformal predictions with correct ISL endpoint and schema
   * POST /api/v1/causal/counterfactual/conformal
   */
  async conformalPredict(request: ISLConformalRequest): Promise<ISLConformalResponse> {
    return this.fetch<ISLConformalResponse>('/api/v1/causal/counterfactual/conformal', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  /**
   * @deprecated Use conformalPredict() instead - kept for backward compatibility
   */
  async conformal(request: ISLRunRequest): Promise<ISLConformalResponse> {
    return this.fetch<ISLConformalResponse>('/conformal', {
      method: 'POST',
      body: JSON.stringify({ ...request, options: { ...request.options, enable_conformal: true } }),
    })
  }

  /**
   * Compare scenarios
   */
  async compare(request: ISLRunRequest): Promise<ISLComparisonResponse> {
    return this.fetch<ISLComparisonResponse>('/compare', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  /**
   * Phase 2: Goal Mode - Find path to achieve target outcome
   */
  async contrastiveExplanation(
    request: ContrastiveExplanationRequest
  ): Promise<ContrastiveExplanationResponse> {
    return this.fetch<ContrastiveExplanationResponse>('/explain/contrastive', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  /**
   * Phase 2: Transportability - Check if model transfers to different context
   */
  async checkTransportability(
    request: TransportabilityRequest
  ): Promise<TransportabilityResponse> {
    return this.fetch<TransportabilityResponse>('/transport', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }
}
