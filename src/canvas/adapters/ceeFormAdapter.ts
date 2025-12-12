/**
 * CEE Form Response Adapter
 *
 * Brief 12.4: Transform CEE API response to UI EdgeFormRecommendation format
 *
 * CEE returns form suggestions with different field naming that needs mapping
 * to our TypeScript interfaces. This adapter handles:
 * - Field name normalization
 * - Confidence level mapping (numeric → categorical)
 * - Default value fallbacks
 * - Provenance tagging
 */

import type { EdgeFunctionType, FormConfidence } from '../domain/edges'
import type { EdgeFormRecommendation } from '../components/FunctionalForm/types'

// =============================================================================
// Rate Limiting Configuration
// =============================================================================

/** Maximum concurrent requests to CEE */
const MAX_CONCURRENT_REQUESTS = 3

/** Delay between batches in milliseconds */
const BATCH_DELAY_MS = 100

/** Maximum edges per batch request */
const MAX_EDGES_PER_BATCH = 10

// =============================================================================
// CEE Raw Response Types (as returned by the API)
// =============================================================================

interface CEEFormSuggestion {
  edge_id: string
  source_label?: string
  source_name?: string
  target_label?: string
  target_name?: string
  current_form?: string
  current_function?: string
  recommended_form?: string
  suggested_form?: string
  suggested_function?: string
  confidence?: number | string
  confidence_level?: string
  rationale?: string
  explanation?: string
  reason?: string
}

export interface CEEFormRecommendationResponse {
  recommendations?: CEEFormSuggestion[]
  suggestions?: CEEFormSuggestion[]
  forms?: CEEFormSuggestion[]
}

// =============================================================================
// Form Type Validation
// =============================================================================

const VALID_FORM_TYPES: EdgeFunctionType[] = [
  'linear',
  'diminishing_returns',
  'threshold',
  's_curve',
  'noisy_or',
  'logistic',
]

/**
 * Validate and normalize form type string to EdgeFunctionType
 */
export function normalizeFormType(raw?: string): EdgeFunctionType {
  if (!raw) return 'linear'

  const normalized = raw.toLowerCase().replace(/[-\s]/g, '_')

  // Handle common aliases
  const aliases: Record<string, EdgeFunctionType> = {
    log: 'diminishing_returns',
    logarithmic: 'diminishing_returns',
    diminishing: 'diminishing_returns',
    step: 'threshold',
    binary: 'threshold',
    sigmoid: 's_curve',
    logistic: 'logistic',
    s_curve: 's_curve',
    scurve: 's_curve',
    noisy_or: 'noisy_or',
    noisyor: 'noisy_or',
    or: 'noisy_or',
    linear: 'linear',
    proportional: 'linear',
  }

  if (aliases[normalized]) return aliases[normalized]
  if (VALID_FORM_TYPES.includes(normalized as EdgeFunctionType)) {
    return normalized as EdgeFunctionType
  }

  return 'linear'
}

// =============================================================================
// Confidence Mapping
// =============================================================================

/**
 * Map CEE confidence (numeric or string) to UI FormConfidence
 *
 * CEE may return:
 * - Numeric: 0.0-1.0 where >0.7 = high, 0.4-0.7 = medium, <0.4 = low
 * - String: 'high', 'medium', 'low' directly
 */
export function mapConfidenceLevel(
  confidence?: number | string
): FormConfidence {
  if (confidence === undefined || confidence === null) return 'low'

  // Handle string confidence
  if (typeof confidence === 'string') {
    const lower = confidence.toLowerCase()
    if (lower === 'high' || lower === 'confident') return 'high'
    if (lower === 'medium' || lower === 'moderate') return 'medium'
    return 'low'
  }

  // Handle numeric confidence (0-1 scale)
  if (typeof confidence === 'number') {
    if (confidence >= 0.7) return 'high'
    if (confidence >= 0.4) return 'medium'
    return 'low'
  }

  return 'low'
}

// =============================================================================
// Adapter Functions
// =============================================================================

/**
 * Adapt single CEE form suggestion to UI format
 */
function adaptFormSuggestion(raw: CEEFormSuggestion): EdgeFormRecommendation {
  // Extract source/target labels
  const sourceLabel = raw.source_label || raw.source_name || 'Source'
  const targetLabel = raw.target_label || raw.target_name || 'Target'

  // Extract current form
  const currentForm = normalizeFormType(
    raw.current_form || raw.current_function
  )

  // Extract recommended form
  const recommendedForm = normalizeFormType(
    raw.recommended_form || raw.suggested_form || raw.suggested_function
  )

  // Extract confidence
  const formConfidence = raw.confidence_level
    ? mapConfidenceLevel(raw.confidence_level)
    : mapConfidenceLevel(raw.confidence)

  // Extract rationale
  const rationale =
    raw.rationale ||
    raw.explanation ||
    raw.reason ||
    'Based on node context and domain patterns'

  return {
    edge_id: raw.edge_id,
    source_label: sourceLabel,
    target_label: targetLabel,
    current_form: currentForm,
    recommended_form: recommendedForm,
    form_confidence: formConfidence,
    rationale,
    auto_applied: false,
    provenance: 'cee',
  }
}

/**
 * Main adapter: Transform CEE response to UI EdgeFormRecommendation array
 */
export function adaptCEEFormResponse(
  raw: CEEFormRecommendationResponse
): EdgeFormRecommendation[] {
  const suggestions = raw.recommendations || raw.suggestions || raw.forms || []

  return suggestions.map(adaptFormSuggestion)
}

/**
 * Filter recommendations that differ from current form
 * (Only show recommendations where form would change)
 */
export function filterChangedForms(
  recommendations: EdgeFormRecommendation[]
): EdgeFormRecommendation[] {
  return recommendations.filter(
    (rec) => rec.recommended_form !== rec.current_form
  )
}

/**
 * Partition recommendations by confidence level
 */
export function partitionByConfidence(
  recommendations: EdgeFormRecommendation[]
): {
  high: EdgeFormRecommendation[]
  medium: EdgeFormRecommendation[]
  low: EdgeFormRecommendation[]
} {
  return {
    high: recommendations.filter((r) => r.form_confidence === 'high'),
    medium: recommendations.filter((r) => r.form_confidence === 'medium'),
    low: recommendations.filter((r) => r.form_confidence === 'low'),
  }
}

/**
 * Generate fallback recommendations when CEE is unavailable
 * Uses heuristic rules based on node types and labels
 */
export function generateFallbackFormRecommendation(
  edgeId: string,
  sourceLabel: string,
  targetLabel: string,
  sourceType: string,
  targetType: string,
  currentForm: EdgeFunctionType
): EdgeFormRecommendation | null {
  const { form, confidence, rationale } = inferFormFromContext(
    sourceLabel,
    targetLabel,
    sourceType,
    targetType
  )

  // Only return recommendation if it differs from current
  if (form === currentForm) return null

  return {
    edge_id: edgeId,
    source_label: sourceLabel,
    target_label: targetLabel,
    current_form: currentForm,
    recommended_form: form,
    form_confidence: confidence,
    rationale,
    auto_applied: false,
    provenance: 'cee',
  }
}

/**
 * Infer form type from node context (fallback heuristics)
 */
function inferFormFromContext(
  sourceLabel: string,
  targetLabel: string,
  sourceType: string,
  targetType: string
): { form: EdgeFunctionType; confidence: FormConfidence; rationale: string } {
  const sourceLower = sourceLabel.toLowerCase()
  const targetLower = targetLabel.toLowerCase()

  // Risk factors → outcomes: noisy_or
  if (
    sourceType === 'risk' &&
    (targetType === 'outcome' ||
      /\b(outcome|result|success|failure)\b/.test(targetLower))
  ) {
    return {
      form: 'noisy_or',
      confidence: 'medium',
      rationale: 'Risk factors typically combine independently to affect outcomes',
    }
  }

  // Investment/resource → outcome: diminishing_returns
  if (/\b(budget|investment|spend|cost|resource|marketing)\b/.test(sourceLower)) {
    return {
      form: 'diminishing_returns',
      confidence: 'medium',
      rationale: 'Resource investments typically show diminishing marginal returns',
    }
  }

  // Adoption/growth patterns: s_curve
  if (/\b(adoption|penetration|diffusion|growth|market.?share)\b/.test(targetLower)) {
    return {
      form: 's_curve',
      confidence: 'medium',
      rationale: 'Market adoption typically follows an S-curve pattern',
    }
  }

  // Compliance/regulatory: threshold
  if (
    /\b(compliance|regulatory|approval|certification|threshold)\b/.test(
      sourceLower + targetLower
    )
  ) {
    return {
      form: 'threshold',
      confidence: 'medium',
      rationale: 'Compliance requirements exhibit pass/fail threshold behaviour',
    }
  }

  // Default to linear with low confidence
  return {
    form: 'linear',
    confidence: 'low',
    rationale: 'Linear relationship assumed when context is unclear',
  }
}

// =============================================================================
// Multi-Edge Batch Processing with Rate Limiting
// =============================================================================

/**
 * Split edges into batches for rate-limited processing
 */
export function batchEdges<T>(edges: T[], batchSize = MAX_EDGES_PER_BATCH): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < edges.length; i += batchSize) {
    batches.push(edges.slice(i, i + batchSize))
  }
  return batches
}

/**
 * Delay utility for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Process batches with concurrency limit
 * @param batches Array of batch data
 * @param processor Function to process each batch
 * @param maxConcurrent Maximum concurrent batch processors
 * @param delayMs Delay between starting new batches
 */
export async function processBatchesWithRateLimit<T, R>(
  batches: T[][],
  processor: (batch: T[]) => Promise<R>,
  maxConcurrent = MAX_CONCURRENT_REQUESTS,
  delayMs = BATCH_DELAY_MS
): Promise<R[]> {
  const results: R[] = []
  const inFlight: Promise<void>[] = []

  for (let i = 0; i < batches.length; i++) {
    // Wait if at concurrency limit
    if (inFlight.length >= maxConcurrent) {
      await Promise.race(inFlight)
    }

    // Process batch
    const batchPromise = (async () => {
      if (i > 0) await delay(delayMs)
      const result = await processor(batches[i])
      results.push(result)
    })()

    // Track in-flight and clean up on completion
    const trackedPromise = batchPromise.then(() => {
      const idx = inFlight.indexOf(trackedPromise)
      if (idx > -1) inFlight.splice(idx, 1)
    })
    inFlight.push(trackedPromise)
  }

  // Wait for all remaining batches
  await Promise.all(inFlight)
  return results
}

/**
 * Fetch form recommendations with rate limiting for large edge sets
 *
 * Brief 12.6: Handle multi-edge form recommendations with rate limiting
 *
 * @param edges Array of edge contexts
 * @param fetchFn Function to fetch recommendations for a batch
 * @returns Combined recommendations from all batches
 */
export async function fetchFormRecommendationsWithRateLimit(
  edges: CEEFormSuggestion[],
  fetchFn: (batch: CEEFormSuggestion[]) => Promise<EdgeFormRecommendation[]>
): Promise<EdgeFormRecommendation[]> {
  if (edges.length === 0) return []

  // Small sets don't need batching
  if (edges.length <= MAX_EDGES_PER_BATCH) {
    return fetchFn(edges)
  }

  // Batch and process with rate limiting
  const batches = batchEdges(edges)
  const batchResults = await processBatchesWithRateLimit(batches, fetchFn)

  // Flatten results
  return batchResults.flat()
}

/** Export configuration for testing */
export const RATE_LIMIT_CONFIG = {
  MAX_CONCURRENT_REQUESTS,
  BATCH_DELAY_MS,
  MAX_EDGES_PER_BATCH,
}
