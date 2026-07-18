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
import { withObservabilityHeaders, recordBffResponse, recordBffError } from '../../lib/observability-headers'
import { useGateStore } from '../../lib/gate-state'
import { withRetry } from '../../lib/fetchWithRetry'

/**
 * ISL routing chain (architecturally acceptable — BFF proxy, not direct):
 *   Browser → /bff/isl/* → Netlify edge function (isl-proxy.ts)
 *     → injects Authorization: Bearer ${ISL_API_KEY}
 *     → proxies to https://isl-staging.onrender.com/*
 *
 * The API key is stored in Netlify environment variables and never exposed
 * to client code. CORS is validated against an explicit origin allow-list.
 * See: netlify.toml [[edge_functions]] path="/bff/isl/*"
 *      netlify/edge-functions/isl-proxy.ts
 */
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

  /** All ISL endpoints are idempotent — retry with exponential backoff on transient failures */
  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    return withRetry(() => this.fetchOnce<T>(endpoint, options))
  }

  private async fetchOnce<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    const correlationId = generateCorrelationId()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    // Parse body for observability (if present) - guard against non-JSON bodies
    let bodyData: unknown = {}
    if (options.body && typeof options.body === 'string') {
      try {
        bodyData = JSON.parse(options.body)
      } catch {
        // Non-JSON body - use empty object for hash
        bodyData = {}
      }
    }

    // Add observability headers (async for SHA-256 hashing)
    let startTime = Date.now()

    try {
      const { headers, startTime: obsStartTime } = await withObservabilityHeaders(
        url,
        options.method || 'GET',
        bodyData,
        {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId,
          ...(options.headers as Record<string, string>),
        },
        correlationId
      )
      startTime = obsStartTime
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers,
      })

      // NOTE: the abort timer is deliberately NOT cleared here. `fetch` resolves
      // as soon as the HEADERS arrive, so clearing it at this point left both
      // `response.json()` reads below unprotected: a headers-then-body stall
      // (the Netlify-edge hang class this project has hit before) left this
      // promise pending forever, so callers never reached their catch/finally.
      // The timer is cleared in the `finally` instead, once the body read has
      // completed or thrown. Mirrors the runV2 fix in #367.
      recordBffResponse(correlationId, url, response, startTime)

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new ISLError(
          error.message || `Request failed: ${response.status}`,
          response.status,
          error,
          correlationId
        )
      }

      // `await`, not a bare `return` of the promise: without it the try block
      // exits before the body has been read, so the body read would escape both
      // the catch (no AbortError → ISLError mapping, no recordBffError) and the
      // finally's timer (cleared while the read was still in flight).
      return await response.json()
    } catch (error) {
      // Record error for observability
      recordBffError(correlationId, url, startTime, error)

      if (error instanceof Error && error.name === 'AbortError') {
        throw new ISLError('Request timeout', 408, undefined, correlationId)
      }
      throw error
    } finally {
      // Cleared here, and only here — after the body read has settled on every
      // path (success, HTTP error, abort). An abort raised mid-body rejects the
      // body read with an AbortError, which the catch above maps to the same
      // ISLError('Request timeout', 408) a headers-phase timeout already
      // produced — no new error shape.
      clearTimeout(timeoutId)
    }
  }

  /**
   * Validate graph and get suggestions
   */
  async validate(request: ISLRunRequest): Promise<ISLValidationResponse> {
    const result = await this.fetch<ISLValidationResponse>('/validate', {
      method: 'POST',
      body: JSON.stringify(request),
    })

    // Update validation gate on successful response
    useGateStore.getState().setGate('validation', 'pass', { message: 'Graph validated' })

    return result
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
