/**
 * HTTP v1 adapter - implements UI interface using PLoT v1 API
 * Maps between UI types (ReportV1, ErrorV1) and v1 types
 */

import type {
  ReportV1,
  ErrorV1,
  LimitsV1,
  LimitsFetch,
  TemplateDetail,
  TemplateListV1,
  ConfidenceLevel,
} from './types'
import type {
  V1RunRequest,
  V1Error,
} from './v1/types'
import * as v1http from './v1/http'
import { V1_LIMITS } from './v1/types'
import { graphToV1Request, type ReactFlowGraph } from './v1/mapper'
import { isRetryableErrorCode, isRetryableStatus } from './v1/constants'
import { getGraphCaps } from './v1/sdkHelpers'

// ⚠ NAMED, LITERAL env reads only. This was `(import.meta as any)?.env || {}` —
// a bare reference Vite cannot statically narrow, so it inlined the ENTIRE env
// object (every VITE_* the deploy defines, with values) into this chunk. The two
// named reads below are narrowed to exactly two literals. Pinned by
// `scripts/ci/assert-bundle-env-allowlist.mjs`.
const ENABLE_HTTPV1_DEBUG: boolean = (() => {
  try {
    return !!import.meta.env?.DEV && String(import.meta.env?.VITE_DEBUG_HTTPV1) === '1'
  } catch {
    return false
  }
})()

let loggedLimitsSuccess = false

/**
 * Load template graph from live v1 endpoint
 * Returns ReactFlow format (source/target) for compatibility with mapGraphToV1Request
 */
async function loadTemplateGraph(templateId: string): Promise<any> {
  const response = await v1http.templateGraph(templateId)
  // Backend may return graph directly OR wrapped in {graph: ...}
  const backendGraph = response.graph || response

  // Convert backend format (from/to) to ReactFlow format (source/target)
  // v1.2: preserve optional fields (kind, prior, utility, belief, provenance)
  return {
    nodes: (backendGraph.nodes || []).map((n: any) => ({
      id: n.id,
      data: {
        label: n.label,
        body: n.body,
        kind: n.kind, // v1.2
        prior: n.prior, // v1.2
        utility: n.utility, // v1.2
      }
    })),
    edges: (backendGraph.edges || []).map((e: any) => ({
      ...e,
      id: e.id || `${e.from}-${e.to}`,
      source: e.from,
      target: e.to,
      data: {
        confidence: e.confidence,
        weight: e.weight,
        belief: e.belief, // v1.2
        provenance: e.provenance, // v1.2
      }
    })),
    // v1.2: preserve meta (suggested_positions, version)
    version: backendGraph.version,
    meta: backendGraph.meta,
  }
}

/**
 * UI-SEM-017: Confidence level from numeric score (>=0.7 high, >=0.4 medium, else low).
 * Estimated — PLoT V1 provides numeric confidence; this maps to categorical tier.
 */
function mapConfidenceLevel(conf: number): ConfidenceLevel {
  if (conf >= 0.7) return 'high'
  if (conf >= 0.4) return 'medium'
  return 'low'
}

/**
 * Map v1 Error to UI ErrorV1
 *
 * Normalises backend V1Error into the richer error.v1 envelope used by the UI:
 * - Preserves engine requestId for support/debug
 * - Exposes retryability based on engine code + HTTP status
 * - Normalises validation fields and optional path information
 * - Adds human-friendly hints for common failure modes
 */
function mapV1ErrorToUI(error: V1Error): ErrorV1 {
  // Extract HTTP status from details when present
  const status = typeof (error.details as any)?.status === 'number'
    ? (error.details as any).status as number
    : undefined

  // P2.3: Append request ID to error message if present for quick copy-paste
  const errorMessage = error.requestId
    ? `${error.message} (Request ID: ${error.requestId})`
    : error.message

  // P2.3: Add actionable hints for specific error types
  let hint: string | undefined
  if (error.code === 'GATEWAY_TIMEOUT') {
    hint = 'Try Quick mode for faster analysis.'
  } else if (error.code === 'TIMEOUT') {
    hint = 'The analysis took too long. Try a smaller graph or Quick mode.'
  } else if (error.code === 'RATE_LIMITED') {
    const seconds = error.retry_after && error.retry_after > 0
      ? Math.ceil(error.retry_after)
      : undefined
    hint = seconds
      ? `Please wait about ${seconds} second${seconds === 1 ? '' : 's'} before retrying.`
      : 'You have exceeded the rate limit. Please wait a short while before trying again.'
  }

  // Determine retryability from engine code + HTTP status. TIMEOUT and
  // GATEWAY_TIMEOUT are safe to retry manually even if we do not auto-retry.
  const retryableByCode = isRetryableErrorCode(error.code)
    || error.code === 'TIMEOUT'
    || error.code === 'GATEWAY_TIMEOUT'
  const retryableByStatus = typeof status === 'number' ? isRetryableStatus(status) : false
  const retryable = retryableByCode || retryableByStatus

  // Normalise validation fields for UI consumers (ErrorBanner, etc.)
  const rawField = error.field
  const normalizedField = rawField === 'nodes' || rawField === 'graph.nodes'
    ? 'graph.nodes'
    : rawField === 'edges' || rawField === 'graph.edges'
      ? 'graph.edges'
      : rawField

  const details = error.details as any
  const path: string[] | undefined = Array.isArray(details?.path)
    ? details.path.map((p: unknown) => String(p))
    : undefined

  const fields = (normalizedField || typeof error.max === 'number' || (path && path.length))
    ? {
        field: normalizedField,
        max: error.max,
        path,
      }
    : undefined

  return {
    schema: 'error.v1',
    code: error.code as any, // Type compatible with UI union
    error: errorMessage,
    message: error.message,
    hint,
    retryable,
    source: 'plot',
    request_id: error.requestId,
    fields,
    retry_after: error.retry_after,
  }
}

/**
 * Map template graph to V1 request with validation and deterministic hash
 */
/**
 * Extract the goal threshold from a goal node, tolerating every field name
 * used across the app's history.
 *
 * GoalPanel/GoalThresholdEditor persist the user's target under
 * `data.goal_threshold` (+ `goal_threshold_raw`) — the old value/
 * baseline_value/target chain never read them, so a target set in the
 * inspector silently vanished from this request and reruns could not change
 * goal probabilities.
 *
 * Exported for wire-shape tests.
 */
export function extractGoalThreshold(goalNode: any): number | undefined {
  const candidates = [
    goalNode?.data?.goal_threshold,
    goalNode?.data?.goal_threshold_raw,
    goalNode?.data?.value,
    goalNode?.data?.baseline_value,
    goalNode?.data?.target,
    goalNode?.value,
    goalNode?.baseline_value,
    goalNode?.target,
  ]
  for (const candidate of candidates) {
    if (candidate == null) continue
    const parsed = typeof candidate === 'string'
      ? (candidate.trim() === '' ? undefined : Number(candidate))
      : candidate
    if (typeof parsed !== 'number' || isNaN(parsed)) continue // keep trying later aliases
    // UI-SEM-058 discipline: the goal editors store thresholds in USER UNITS
    // (raw-first) while PLoT's `goal_threshold` wire contract is normalised
    // 0-1, and this adapter has no scale cap to convert with. Anything that
    // cannot be proven normalised is OMITTED rather than sent at the wrong
    // scale. NOTE the engine does NOT treat omission as "no goal analysis":
    // PLoT V1's detectGoalThreshold falls back to node.threshold →
    // baseline_value → 100 and still computes option_probabilities — omission
    // defers to that server-side default rather than corrupting it with a
    // raw client value.
    //
    // Deliberately FIRST-parseable-wins (then the normalised gate): the
    // aliases name the same quantity at different ages, so if the freshest
    // parseable alias is out of range we omit rather than fall through to an
    // older alias whose agreement would be coincidence, not confirmation.
    return parsed >= 0 && parsed <= 1 ? parsed : undefined
  }
  return undefined
}

function mapGraphToV1Request(graph: any, seed?: number): V1RunRequest {
  // Cast to ReactFlowGraph for type safety
  const rfGraph: ReactFlowGraph = {
    nodes: graph.nodes || [],
    edges: graph.edges || [],
  }

  // Use real mapper with validation (throws ValidationError if limits exceeded)
  const v1Request = graphToV1Request(rfGraph, seed)

  // NOTE: clientHash not yet supported by backend (returns 400 "Unknown field")
  // Will be enabled when backend adds idempotency support
  // const clientHash = computeClientHash(rfGraph, seed)

  return v1Request
}

/**
 * HTTP v1 Adapter
 */
export const httpV1Adapter = {
  // Templates (live v1 endpoints)
  async templates(): Promise<TemplateListV1> {
    try {
      const response = await v1http.templates()

      // v1 API returns bare array, not wrapped object
      if (!Array.isArray(response)) {
        if (import.meta.env.DEV) {
          console.error('[httpV1] Invalid templates response:', response)
        }
        throw {
          code: 'SERVER_ERROR',
          message: 'Invalid templates response from server',
        } as V1Error
      }

      // Map v1 API fields to UI format
      return {
        schema: 'template-list.v1',
        items: response.map(t => ({
          id: t.id,
          name: t.label, // label → name
          description: t.summary, // summary → description
          version: '1.0', // API doesn't provide version, use default
        })),
      }
    } catch (err: any) {
      throw mapV1ErrorToUI(err as V1Error)
    }
  },

  async template(id: string): Promise<TemplateDetail> {
    try {
      // Fetch graph and list in parallel (not sequential)
      const [graphResponse, listResponse] = await Promise.all([
        v1http.templateGraph(id),
        v1http.templates(),
      ])

      if (ENABLE_HTTPV1_DEBUG) {
        console.log('[httpV1Adapter] template() graphResponse:', JSON.stringify(graphResponse, null, 2))
      }

      // Find template metadata from list (v1 API returns bare array)
      const metadata = listResponse.find(t => t.id === id)

      if (!metadata) {
        throw {
          code: 'BAD_INPUT',
          message: `Template not found: ${id}`,
        } as V1Error
      }

      // Backend may return graph directly OR wrapped in {graph: ...}
      // Handle both cases for API compatibility
      const graph = graphResponse.graph || graphResponse

      const result = {
        id: metadata.id,
        name: metadata.label, // label → name
        version: '1.0', // API doesn't provide version
        description: metadata.summary, // summary → description
        default_seed: graphResponse.default_seed || 1337, // May not be in response
        graph,
      }

      if (ENABLE_HTTPV1_DEBUG) {
        console.log('[httpV1Adapter] template() returning:', JSON.stringify(result, null, 2))
      }

      return result
    } catch (err: any) {
      throw mapV1ErrorToUI(err as V1Error)
    }
  },

  // Limits (fetch from live endpoint for v1.2 engine_p95_ms_budget)
  // Returns structured payload to expose fallback vs outage
  async limits(): Promise<LimitsFetch> {
    const fetchedAt = Date.now()

    try {
      const response = await v1http.limits()

      if (import.meta.env.DEV && !loggedLimitsSuccess) {
        console.log('[httpV1] /v1/limits succeeded (live)')
        loggedLimitsSuccess = true
      }

      // Map backend format (limits.v1) to UI format using central helper
      const caps = getGraphCaps(response)
      const mappedData: LimitsV1 = {
        nodes: { max: caps.maxNodes },
        edges: { max: caps.maxEdges },
      }

      // Include max_body_kb if present (v1.2: 96 KB prod limit)
      if (caps.maxBodyKb !== undefined) {
        mappedData.body_kb = { max: caps.maxBodyKb }
      }

      // Include engine_p95_ms_budget if present (v1.2 feature)
      if ('engine_p95_ms_budget' in response) {
        mappedData.engine_p95_ms_budget = response.engine_p95_ms_budget
      }

      return {
        ok: true,
        source: 'live',
        data: mappedData,
        fetchedAt,
      }
    } catch (err) {
      // Handle V1Error objects (have code/message) and Error instances
      const error = err instanceof Error
        ? err
        : (err as V1Error).message
          ? new Error((err as V1Error).message)
          : new Error(String(err))

      // DEV: may return fallback with clear reason
      if (import.meta.env.DEV) {
        console.warn('[httpV1] /v1/limits failed, using fallback constants:', error.message)

        return {
          ok: true,
          source: 'fallback',
          data: {
            nodes: { max: V1_LIMITS.MAX_NODES },
            edges: { max: V1_LIMITS.MAX_EDGES },
          },
          fetchedAt,
          reason: `Live endpoint failed: ${error.message}`,
        }
      }

      // PROD: return error, no silent fallback masking
      console.error('[httpV1] /v1/limits failed in production:', error)

      return {
        ok: false,
        error,
        fetchedAt,
      }
    }
  },

  // Health (optional, specific to httpV1)
  async health() {
    return v1http.health()
  },



}
