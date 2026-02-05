/**
 * Coaching Review Service (P1 Task 4)
 *
 * Fetches M2 coaching content from PLoT /v2/review endpoint.
 * M2 enhances M1 deterministic templates with LLM-generated content.
 *
 * Architecture:
 * - PLoT orchestrates M2 (not direct CEE calls)
 * - M1 renders immediately; M2 swaps in seamlessly when available
 * - All errors result in staying on M1 (no degraded states)
 */

import type { RichText, RichSegment } from '../components/results/HeroSection'
import { recordRequestPayload, recordResponsePayload } from '../lib/payload-trace-store'

// =============================================================================
// Request Types
// =============================================================================

export interface ReviewRequestAnalysisSummary {
  winner: {
    id: string
    label: string
    probability_of_goal?: number
    win_probability: number
    outcome_median: number
    outcome_p10?: number
    outcome_p90?: number
  }
  runner_up?: {
    id: string
    label: string
    probability_of_goal?: number
    win_probability: number
    outcome_median: number
  }
  option_count: number
  baseline_present: boolean
  top_drivers: Array<{
    id: string
    label: string
    direction: string
    importance_rank: number
  }>
  top_fragile_edge?: {
    from_id: string
    from_label: string
    to_id: string
    to_label: string
    alternative_winner_label: string
    switch_probability?: number
  }
  recommendation_stability: number
  n_samples: number
  goal_node_label: string
  goal_threshold_used?: number
}

export interface ReviewRequest {
  response_hash: string
  analysis_summary: ReviewRequestAnalysisSummary
  graph_context: {
    node_count: number
    edge_count: number
  }
  allowed_references: Array<{
    id: string
    label: string
    kind: string
  }>
}

// =============================================================================
// Response Types
// =============================================================================

export interface ReviewResponse {
  response_hash: string
  headline: string
  bullets: [RichText, RichText, RichText]
  coaching_paragraph: RichText
  bias_insights: string[]
}

// =============================================================================
// Validation (Task 5)
// =============================================================================

/**
 * Validate M2 response before rendering.
 * Returns null if validation fails, otherwise returns the validated response.
 */
export function validateReviewResponse(
  response: unknown,
  allowedIds: Set<string>
): ReviewResponse | null {
  if (!response || typeof response !== 'object') {
    console.warn('[CoachingReview] Invalid response: not an object')
    return null
  }

  const r = response as Record<string, unknown>

  // Check headline
  if (typeof r.headline !== 'string' || r.headline.length === 0 || r.headline.length > 100) {
    console.warn('[CoachingReview] Invalid headline: must be non-empty string under 100 chars')
    return null
  }

  // Check bullets
  if (!Array.isArray(r.bullets) || r.bullets.length !== 3) {
    console.warn('[CoachingReview] Invalid bullets: must be array of exactly 3')
    return null
  }

  // Validate each bullet
  for (let i = 0; i < 3; i++) {
    const bullet = r.bullets[i]
    if (!Array.isArray(bullet) || bullet.length === 0) {
      console.warn(`[CoachingReview] Invalid bullet ${i}: must be non-empty array`)
      return null
    }

    // Check word count (max 50 words, generous margin over 25-word prompt request)
    const wordCount = bullet
      .map((seg: RichSegment) => seg.type === 'text' ? seg.text : seg.label)
      .join(' ')
      .split(/\s+/)
      .length
    if (wordCount > 50) {
      console.warn(`[CoachingReview] Bullet ${i} exceeds 50 words: ${wordCount}`)
      return null
    }

    // Validate ref segments
    for (const segment of bullet as RichSegment[]) {
      if (segment.type === 'ref') {
        if (!allowedIds.has(segment.id)) {
          console.warn(`[CoachingReview] Invalid ref ID in bullet ${i}: ${segment.id}`)
          return null
        }
      }
    }
  }

  // Check coaching_paragraph
  if (!Array.isArray(r.coaching_paragraph)) {
    console.warn('[CoachingReview] Invalid coaching_paragraph: must be array')
    return null
  }

  // Validate ref segments in coaching paragraph
  for (const segment of r.coaching_paragraph as RichSegment[]) {
    if (segment.type === 'ref') {
      if (!allowedIds.has(segment.id)) {
        console.warn(`[CoachingReview] Invalid ref ID in coaching_paragraph: ${segment.id}`)
        return null
      }
    }
  }

  // Check bias_insights
  if (!Array.isArray(r.bias_insights)) {
    console.warn('[CoachingReview] Invalid bias_insights: must be array')
    return null
  }

  return {
    response_hash: r.response_hash as string,
    headline: r.headline as string,
    bullets: r.bullets as [RichText, RichText, RichText],
    coaching_paragraph: r.coaching_paragraph as RichText,
    bias_insights: r.bias_insights as string[],
  }
}

// =============================================================================
// Fetch Service (Task 4)
// =============================================================================

/** Configuration for the coaching review service */
export interface CoachingReviewConfig {
  /** Base URL for PLoT API */
  baseUrl: string
  /** Timeout in milliseconds (default: 10000) */
  timeout?: number
}

/** Result of fetching coaching review */
export interface FetchCoachingReviewResult {
  success: boolean
  data?: ReviewResponse
  error?: string
}

/**
 * Fetch coaching review from PLoT /v2/review endpoint.
 *
 * Task 6: Error handling
 * - Timeout: 10 seconds
 * - All errors result in returning null (stay on M1)
 * - No retries - one attempt per analysis run
 */
export async function fetchCoachingReview(
  request: ReviewRequest,
  config: CoachingReviewConfig,
  abortSignal?: AbortSignal
): Promise<FetchCoachingReviewResult> {
  const timeout = config.timeout ?? 10000
  const endpoint = `${config.baseUrl}/v2/review`
  const traceId = `m2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const startTime = Date.now()

  // Record request payload for debug panel
  recordRequestPayload({
    id: traceId,
    endpoint,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: request,
  })

  // Create abort controller for timeout
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), timeout)

  // Combine with external abort signal if provided
  const combinedSignal = abortSignal
    ? (() => {
        const combined = new AbortController()
        abortSignal.addEventListener('abort', () => combined.abort())
        timeoutController.signal.addEventListener('abort', () => combined.abort())
        return combined.signal
      })()
    : timeoutController.signal

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: combinedSignal,
    })

    clearTimeout(timeoutId)
    const duration = Date.now() - startTime

    if (!response.ok) {
      console.warn(`[CoachingReview] HTTP error: ${response.status} ${response.statusText}`)
      recordResponsePayload({
        id: traceId,
        status: response.status,
        headers: {},
        body: { error: response.statusText },
        duration,
        error: `HTTP ${response.status}`,
      })
      return { success: false, error: `HTTP ${response.status}` }
    }

    const data = await response.json()

    // Build allowed IDs set from request
    const allowedIds = new Set(request.allowed_references.map(r => r.id))

    // Validate response
    const validated = validateReviewResponse(data, allowedIds)
    if (!validated) {
      recordResponsePayload({
        id: traceId,
        status: response.status,
        headers: {},
        body: data,
        duration,
        error: 'Validation failed',
      })
      return { success: false, error: 'Validation failed' }
    }

    // Record successful response
    recordResponsePayload({
      id: traceId,
      status: response.status,
      headers: {},
      body: data,
      duration,
    })

    return { success: true, data: validated }
  } catch (err) {
    clearTimeout(timeoutId)
    const duration = Date.now() - startTime

    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        // Check if it was timeout vs external cancellation
        if (abortSignal?.aborted) {
          console.log('[CoachingReview] Request cancelled')
          recordResponsePayload({
            id: traceId,
            status: 0,
            headers: {},
            body: null,
            duration,
            error: 'Cancelled',
          })
          return { success: false, error: 'Cancelled' }
        }
        console.warn('[CoachingReview] Request timed out')
        recordResponsePayload({
          id: traceId,
          status: 0,
          headers: {},
          body: null,
          duration,
          error: 'Timeout',
        })
        return { success: false, error: 'Timeout' }
      }
      console.warn('[CoachingReview] Network error:', err.message)
      recordResponsePayload({
        id: traceId,
        status: 0,
        headers: {},
        body: null,
        duration,
        error: err.message,
      })
      return { success: false, error: err.message }
    }

    console.warn('[CoachingReview] Unknown error:', err)
    recordResponsePayload({
      id: traceId,
      status: 0,
      headers: {},
      body: null,
      duration,
      error: 'Unknown error',
    })
    return { success: false, error: 'Unknown error' }
  }
}

// =============================================================================
// Cache (Task 5)
// =============================================================================

/** Simple in-memory cache for M2 content, keyed by response_hash */
const m2Cache = new Map<string, ReviewResponse>()

/**
 * Get cached M2 content for a response hash.
 */
export function getCachedReview(responseHash: string): ReviewResponse | undefined {
  return m2Cache.get(responseHash)
}

/**
 * Cache M2 content for a response hash.
 */
export function setCachedReview(responseHash: string, review: ReviewResponse): void {
  m2Cache.set(responseHash, review)
}

/**
 * Clear the M2 cache (useful for testing).
 */
export function clearReviewCache(): void {
  m2Cache.clear()
}
