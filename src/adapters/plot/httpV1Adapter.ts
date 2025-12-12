/**
 * HTTP v1 adapter - implements UI interface using PLoT v1 API
 * Maps between UI types (ReportV1, ErrorV1) and v1 types
 */

import type {
  RunRequest,
  ReportV1,
  ErrorV1,
  LimitsV1,
  LimitsFetch,
  TemplateSummary,
  TemplateDetail,
  TemplateListV1,
  ConfidenceLevel,
  RunBundleRequest,
  RunBundleResponse,
} from './types'
import type {
  V1RunRequest,
  V1RunResult,
  V1Error,
  V1StreamHandlers,
  V1ValidateRequest,
  V1ValidateResponse,
} from './v1/types'
import * as v1http from './v1/http'
import type { V1RunBundleRequest } from './v1/types'
import { runStream as v1runStream } from './v1/sseClient'
import { V1_LIMITS } from './v1/types'
import { graphToV1Request, computeClientHash, toCanonicalRun, type ReactFlowGraph } from './v1/mapper'
import { shouldUseSync, isRetryableErrorCode, isRetryableStatus } from './v1/constants'
import { getDiagnosticsFromCompleteEvent, getGraphCaps } from './v1/sdkHelpers'

const ENABLE_HTTPV1_DEBUG: boolean = (() => {
  try {
    const env: any = (import.meta as any)?.env || {}
    return !!(env?.DEV) && String(env?.VITE_DEBUG_HTTPV1) === '1'
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
 * Map UI confidence (0-1) to ConfidenceLevel
 */
function mapConfidenceLevel(conf: number): ConfidenceLevel {
  if (conf >= 0.7) return 'high'
  if (conf >= 0.4) return 'medium'
  return 'low'
}

/**
 * P0.1: Normalize confidence.level to canonical DecisionReadiness
 *
 * This function is the single source of truth for deriving decision readiness
 * from the backend's confidence.level field. By centralizing this in the adapter,
 * we ensure all consumers receive a consistent, normalized model.
 *
 * @param level - Backend confidence level ('high', 'medium', 'low')
 * @returns Canonical DecisionReadiness object
 */
function mapConfidenceToDecisionReadiness(level: ConfidenceLevel): ReportV1['decision_readiness'] {
  const normalizedLevel = level.toLowerCase() as 'high' | 'medium' | 'low'

  return {
    ready: normalizedLevel === 'high',
    confidence: normalizedLevel,
    blockers: normalizedLevel === 'low'
      ? ['Low confidence analysis - add more factors or evidence']
      : [],
    warnings: normalizedLevel === 'medium'
      ? ['Medium confidence - consider reviewing key factors and assumptions']
      : [],
    passed: normalizedLevel === 'high'
      ? ['High confidence analysis - model is ready for decision-making']
      : normalizedLevel === 'medium'
        ? ['Model structure is valid']
        : [],
  }
}

/**
 * Map v1 RunResult to UI ReportV1
 */
function mapV1ResultToReport(
  response: any,
  templateId: string,
  executionMs: number
): ReportV1 {
  // Extract result for backward compatibility
  const result = response.result || response

  // v1.2: Normalize response to canonical format
  const canonicalRun = toCanonicalRun(response)

  // Prefer canonical responseHash, but fall back to legacy model_card.response_hash when present
  const responseHash = canonicalRun.responseHash || result.model_card?.response_hash

  // Deterministic hash guard - enforce response_hash presence
  if (!responseHash) {
    const errorMsg = 'Backend response missing response_hash - determinism cannot be guaranteed'

    if (import.meta.env.PROD) {
      // In production, this is a hard error - we need determinism
      throw new Error(`${errorMsg}. This is a critical error in production.`)
    } else {
      // In development, warn but allow continue
      console.warn(`⚠️  [httpV1Adapter] ${errorMsg}`)
      console.warn('   This is acceptable in dev, but must be fixed before production.')
    }
  }

  // Use v1.2 bands for results (with fallback to legacy summary)
  // Contract v1.1: results.most_likely.outcome (nested) or result.summary.likely (legacy)
  const conservative = canonicalRun.bands.p10
    ?? result.results?.conservative?.outcome
    ?? result.summary?.conservative ?? 0
  const likely = canonicalRun.bands.p50
    ?? result.results?.most_likely?.outcome
    ?? result.summary?.most_likely
    ?? result.summary?.likely ?? 0
  const optimistic = canonicalRun.bands.p90
    ?? result.results?.optimistic?.outcome
    ?? result.summary?.optimistic ?? 0
  const units = result.summary?.units || 'count'

  // Contract v1.1: explain_delta at top-level, fall back to nested for backward compat
  const explainDelta = response.explain_delta || result.explain_delta

  // Extract drivers from explain_delta.top_drivers (actual API structure)
  // API v1.1 sends: { node_id, node_label, contribution (0-100), sign ('+'/'-') }
  const drivers = (explainDelta?.top_drivers ?? []).map((d: any) => {
    // Handle both old (impact) and new (contribution + sign) formats
    let impact = d.impact ?? 0
    // Preserve raw contribution (0-100) for UI display
    const rawContribution = d.contribution ?? 0
    if (d.contribution !== undefined && d.sign !== undefined) {
      // Convert contribution (0-100) and sign to signed impact (-1 to 1)
      const normalizedContribution = Math.min(d.contribution, 100) / 100
      impact = d.sign === '-' ? -normalizedContribution : normalizedContribution
    }

    // Use node_label (API v1) or label (older format) for display
    const label = d.node_label || d.label || d.node_id || d.edge_id || 'Unknown'

    return {
      label,
      polarity: (impact > 0 ? 'up' : impact < 0 ? 'down' : 'neutral') as 'up' | 'down' | 'neutral',
      strength: (Math.abs(impact) > 0.7 ? 'high' : Math.abs(impact) > 0.3 ? 'medium' : 'low') as 'low' | 'medium' | 'high',
      // Contribution as 0-1 for percentage display (Quick Win #4)
      contribution: rawContribution / 100,
      // Use camelCase IDs to match DriverChips interface
      nodeId: d.node_id,
      edgeId: d.edge_id,
      // Pass through node_kind from API for client-side filtering (v1.1 contract)
      nodeKind: d.node_kind?.toLowerCase() || null,
    }
  })

  // Contract v1.1: confidence as structured object { level, score, reason, factors }
  // Backward compat: scalar number (0-1) converted via mapConfidenceLevel
  const rawConfidence = response.confidence || result.confidence
  const isStructuredConfidence = typeof rawConfidence === 'object' && rawConfidence !== null
  const confidenceScore = isStructuredConfidence
    ? (rawConfidence.score ?? 0.5)
    : (typeof rawConfidence === 'number' ? rawConfidence : 0.5)
  const confidenceLevel: ConfidenceLevel = isStructuredConfidence && rawConfidence.level
    ? (rawConfidence.level.toLowerCase() as ConfidenceLevel)
    : mapConfidenceLevel(confidenceScore)

  // Sanitize confidence reason to strip debug/technical info
  // Patterns that indicate backend debug text that shouldn't be shown to users
  const DEBUG_PATTERNS = [
    /model_based/i,
    /K=\d+/,
    /unique_graphs/,
    /_based\s*\(/,
    /samples?:/i,
    /\bK\s*=\s*\d+/,
    /graphs?\s*=\s*\d+/i,
  ]

  const sanitizeConfidenceReason = (reason: string): string => {
    if (!reason) return ''
    // Check if reason looks like debug info
    if (DEBUG_PATTERNS.some(pattern => pattern.test(reason))) {
      // Return empty - let UI show generic confidence guidance
      if (import.meta.env.DEV) {
        console.warn('[httpV1Adapter] Stripped debug text from confidence.why:', reason)
      }
      return ''
    }
    return reason
  }

  const rawReason = isStructuredConfidence
    ? (rawConfidence.reason || result.explanation || '')
    : (result.explanation || '')
  const confidenceReason = sanitizeConfidenceReason(rawReason) || 'Based on model analysis'

  return {
    schema: 'report.v1',
    meta: {
      seed: result.seed || 1337,
      response_id: responseHash || `http-v1-${Date.now()}`,
      elapsed_ms: executionMs,
    },
    model_card: {
      response_hash: responseHash || '',
      response_hash_algo: 'sha256',
      normalized: true,
      // Sprint N P0: Use top-level identifiability string from response
      identifiability_tag: response.identifiability || response.result?.identifiability,
    },
    results: {
      conservative,
      likely,
      optimistic,
      units,
    },
    confidence: {
      level: confidenceLevel,
      why: confidenceReason,
    },
    drivers,
    run: canonicalRun, // v1.2: attach canonical run for ResultsPanel

    // Sprint N P0: Trust Signal Fields (backend already returns these)
    graph_quality: response.graph_quality || response.result?.graph_quality,
    insights: response.insights || response.result?.insights,

    // P0.1: Canonical decision readiness (always populated from confidence.level)
    decision_readiness: mapConfidenceToDecisionReadiness(confidenceLevel),
  }
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
  // Run: uses sync endpoint only (stream not deployed yet)
  async run(input: RunRequest): Promise<ReportV1> {
    // Guard: Validate graph is provided for canvas runs
    const hasValidGraph = input.graph?.nodes && input.graph.nodes.length > 0

    if (!hasValidGraph && input.template_id === 'canvas-graph') {
      throw new Error(
        'EMPTY_CANVAS: Cannot run analysis on an empty canvas. ' +
        'Add at least one node to your decision graph before running analysis.'
      )
    }

    // Use provided graph (from canvas edits), or fetch template as fallback
    const graph = hasValidGraph
      ? input.graph!
      : await loadTemplateGraph(input.template_id)

    try {
      const v1Request = mapGraphToV1Request(graph, input.seed)

      // Forward idempotency key when provided so the Engine can engage CEE
      if (input.idempotencyKey) {
        v1Request.idempotencyKey = input.idempotencyKey
      }

      // Add outcome_node if provided
      if (input.outcome_node) {
        v1Request.outcome_node = input.outcome_node
      }

      // Add debug flag based on request flag or feature flag (VITE_FEATURE_COMPARE_DEBUG)
      let includeDebug = input.include_debug
      try {
        const env: any = (import.meta as any)?.env || {}
        if (includeDebug === undefined && String(env?.VITE_FEATURE_COMPARE_DEBUG) === '1') {
          includeDebug = true
        }
      } catch {
        // Ignore env access errors in non-Vite environments
      }
      if (includeDebug) {
        v1Request.include_debug = true
      }

      // Add CEE trigger fields if provided
      if (input.scenario_id) {
        v1Request.scenario_id = input.scenario_id
      }
      if (input.scenario_name) {
        v1Request.scenario_name = input.scenario_name
      }
      if (input.save !== undefined) {
        v1Request.save = input.save
      }

      const nodeCount = graph.nodes.length

      // Always use sync endpoint (stream not deployed yet - Oct 2025)
      if (import.meta.env.DEV) {
        console.log(
          `🚀 [httpV1] POST /v1/run (${nodeCount} nodes, using sync endpoint) ` +
          `template=${input.template_id}, seed=${input.seed}, outcome=${input.outcome_node || 'none'}, debug=${!!includeDebug}`
        )
      }
      const response = await v1http.runSync(v1Request)

      if (import.meta.env.DEV) {
        if (ENABLE_HTTPV1_DEBUG) {
          console.log('[httpV1] Full response:', JSON.stringify(response, null, 2))
        }
        console.log(`✅ [httpV1] Sync completed: ${response.execution_ms || 0}ms`)
      }

      const report = mapV1ResultToReport(response, input.template_id, response.execution_ms || 0)

      // Section 4: Wire debug headers through adapter
      // Extract __ceeDebugHeaders from response and attach to report (non-standard field)
      if ((response as any).__ceeDebugHeaders) {
        (report as any).__ceeDebugHeaders = (response as any).__ceeDebugHeaders
      }

      // Pass through backend debug slices when present (used by determinism tests and inspector tooling)
      if ((response.result && (response.result as any).debug) || (response as any).debug) {
        (report as any).debug = (response.result && (response.result as any).debug) || (response as any).debug
      }

      return report
    } catch (err: any) {
      // Handle validation errors from mapper
      if (err.code === 'LIMIT_EXCEEDED' || err.code === 'BAD_INPUT') {
        throw {
          schema: 'error.v1',
          code: err.code,
          error: err.message,
          fields: err.field ? { field: err.field, max: err.max } : undefined,
        } as ErrorV1
      }
      // Handle v1 HTTP errors
      throw mapV1ErrorToUI(err as V1Error)
    }
  },

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

  // Validate graph before running analysis
  async validate(graph: any): Promise<{
    valid: boolean
    errors: Array<{
      code: string
      message: string
      node_id?: string
      edge_id?: string
      severity: 'error' | 'warning'
      suggestion?: string
    }>
    violations?: Array<{
      code: string
      message: string
      node_id?: string
      edge_id?: string
      severity: 'error' | 'warning'
      suggestion?: string
    }>
  }> {
    try {
      // Cast to ReactFlowGraph for type safety
      const rfGraph: ReactFlowGraph = {
        nodes: graph.nodes || [],
        edges: graph.edges || [],
      }

      // Convert to V1 format (this will also run client-side validation)
      const v1Request = graphToV1Request(rfGraph, undefined)

      // Call v1 validate endpoint for server-side validation
      const response = await v1http.validate({ graph: v1Request.graph })

      if (import.meta.env.DEV) {
        if (ENABLE_HTTPV1_DEBUG) {
          console.log('[httpV1] Validation result:', JSON.stringify(response, null, 2))
        }
      }

      // v1.2: Pass through violations (non-blocking coaching warnings)
      return {
        valid: response.valid,
        errors: response.errors,
        violations: response.violations, // v1.2: coaching warnings
      }
    } catch (err: any) {
      // Handle client-side validation errors from mapper
      if (err.code === 'LIMIT_EXCEEDED' || err.code === 'BAD_INPUT') {
        return {
          valid: false,
          errors: [{
            code: err.code,
            message: err.message,
            severity: 'error' as const,
          }],
        }
      }
      // Handle v1 HTTP errors (network, timeout, etc.)
      throw mapV1ErrorToUI(err as V1Error)
    }
  },

  // Run bundle - compare multiple options and get ranking
  async runBundle(request: RunBundleRequest): Promise<RunBundleResponse> {
    try {
      // Convert UI graph format to V1 format
      const rfGraph: ReactFlowGraph = {
        nodes: request.base_graph.nodes.map(n => ({
          id: n.id,
          data: { label: n.label, ...n },
        })),
        edges: request.base_graph.edges.map(e => ({
          id: `${e.source}-${e.target}`,
          source: e.source,
          target: e.target,
          data: { ...e },
        })),
      }

      const v1Graph = graphToV1Request(rfGraph, undefined).graph

      const v1Request: V1RunBundleRequest = {
        base_graph: v1Graph,
        deltas: request.deltas,
        include_ranking: request.include_ranking,
        include_change_attribution: request.include_change_attribution,
        baseline_index: request.baseline_index,
        sort_by: request.sort_by,
      }

      if (import.meta.env.DEV) {
        console.log(
          `🚀 [httpV1] POST /v1/run_bundle (${request.deltas.length} options, ranking=${request.include_ranking})`
        )
      }

      const response = await v1http.runBundle(v1Request)

      if (import.meta.env.DEV) {
        console.log(`✅ [httpV1] Run bundle completed with ${response.results.length} results`)
      }

      // Map V1 response to UI types (direct mapping since structures match)
      return {
        results: response.results.map(r => ({
          label: r.label,
          rank: r.rank,
          success_probability: r.success_probability,
          summary: r.summary,
          sensitivity_by_node: r.sensitivity_by_node,
          delta_from_baseline: r.delta_from_baseline,
        })),
        ranking_summary: response.ranking_summary,
      }
    } catch (err: any) {
      // Handle validation errors from mapper
      if (err.code === 'LIMIT_EXCEEDED' || err.code === 'BAD_INPUT') {
        throw {
          schema: 'error.v1',
          code: err.code,
          error: err.message,
          fields: err.field ? { field: err.field, max: err.max } : undefined,
        } as ErrorV1
      }
      // Handle v1 HTTP errors
      throw mapV1ErrorToUI(err as V1Error)
    }
  },

  // SSE streaming with fallback to sync
  stream: {
    run(
      input: RunRequest,
      handlers: {
        onHello: (data: { response_id: string }) => void
        onTick: (data: { index: number }) => void
        onDone: (data: { response_id: string; report: ReportV1 }) => void
        onError: (error: ErrorV1) => void
      }
    ): () => void {
      let cancelFn: (() => void) | null = null
      let fallbackAborted = false

      // Map UI handlers to v1 SSE handlers
      const v1Handlers: V1StreamHandlers = {
        onStarted: (data) => {
          handlers.onHello({ response_id: data.run_id })
        },
        onProgress: (data) => {
          // Map progress percent (0-100) to tick index (0-5) for UI compatibility
          const tickIndex = Math.floor((data.percent / 100) * 5)
          handlers.onTick({ index: tickIndex })
        },
        onInterim: (_data) => {
          // Optional: could send interim findings to UI
          // For now, just continue showing progress
        },
        onComplete: (data) => {
          const executionMs = Date.now() - startTime
          const report = mapV1ResultToReport(data, input.template_id, executionMs)

          const diagnostics = getDiagnosticsFromCompleteEvent(data)
          const correlationIdHeader = data.correlation_id_header as string | undefined
          const degraded = typeof data.degraded === 'boolean' ? data.degraded : undefined

          // Pass through any CEE-related metadata from the COMPLETE event without
          // assuming a strict backend schema. The UI layer is responsible for
          // interpreting these payloads.
          const ceeReview = (data as any).ceeReview
          const ceeTrace = (data as any).ceeTrace
          const ceeError = (data as any).ceeError
          const ceeDebugHeaders = (data as any).__ceeDebugHeaders // Section 4: Debug headers

          handlers.onDone({
            response_id: report.model_card.response_hash || `http-v1-${Date.now()}`,
            report,
            diagnostics,
            correlationIdHeader,
            degraded,
            ceeReview,
            ceeTrace,
            ceeError,
            ceeDebugHeaders,
          } as any)
        },
        onError: (error) => {
          // If SSE fails with 404 or 5xx, fall back to sync (if not already aborted)
          const shouldFallback = ['NOT_FOUND', 'SERVER_ERROR', 'TIMEOUT'].includes(error.code as any)

          if (!fallbackAborted && shouldFallback) {
            if (import.meta.env.DEV) {
              console.warn(
                `[httpV1] Stream failed (${error.code}), falling back to sync endpoint`
              )
            }

            // Attempt sync fallback
            fallbackToSync(input, handlers).catch((syncErr) => {
              // If sync also fails, report original error
              handlers.onError(syncErr as ErrorV1)
            })
          } else {
            // Non-retryable error or already cancelled - pass through
            handlers.onError(mapV1ErrorToUI(error))
          }
        },
      }

      const startTime = Date.now()

      // Load graph and prepare request
      ;(async () => {
        try {
          const graph = input.graph || await loadTemplateGraph(input.template_id)
          const v1Request = mapGraphToV1Request(graph, input.seed)

          // Forward idempotency key when provided so the Engine can engage CEE
          if (input.idempotencyKey) {
            v1Request.idempotencyKey = input.idempotencyKey
          }

          // Add CEE trigger fields if provided
          if (input.scenario_id) {
            v1Request.scenario_id = input.scenario_id
          }
          if (input.scenario_name) {
            v1Request.scenario_name = input.scenario_name
          }
          if (input.save !== undefined) {
            v1Request.save = input.save
          }

          if (import.meta.env.DEV) {
            const nodeCount = graph.nodes.length
            console.log(
              `🚀 [httpV1] POST /v1/stream (${nodeCount} nodes) ` +
              `template=${input.template_id}, seed=${input.seed}`
            )
          }

          // Start SSE stream
          cancelFn = v1runStream(v1Request, v1Handlers)
        } catch (err: any) {
          // Handle setup errors (e.g., validation, graph loading)
          if (err.code === 'LIMIT_EXCEEDED' || err.code === 'BAD_INPUT') {
            handlers.onError({
              schema: 'error.v1',
              code: err.code,
              error: err.message,
              fields: err.field ? { field: err.field, max: err.max } : undefined,
            } as ErrorV1)
          } else {
            handlers.onError(mapV1ErrorToUI(err as V1Error))
          }
        }
      })()

      // Return cancel function
      return () => {
        fallbackAborted = true
        if (cancelFn) {
          cancelFn()
        }
      }
    },
  },
}

/**
 * Fallback to sync endpoint when SSE fails
 */
async function fallbackToSync(
  input: RunRequest,
  handlers: {
    onHello: (data: { response_id: string }) => void
    onTick: (data: { index: number }) => void
    onDone: (data: { response_id: string; report: ReportV1 }) => void
    onError: (error: ErrorV1) => void
  }
): Promise<void> {
  if (import.meta.env.DEV) {
    console.log(`🔄 [httpV1] Falling back to sync POST /v1/run`)
  }

  const graph = input.graph || await loadTemplateGraph(input.template_id)
  const v1Request = mapGraphToV1Request(graph, input.seed)

  // Show indeterminate progress during sync
  handlers.onHello({ response_id: `sync-${Date.now()}` })
  handlers.onTick({ index: 3 }) // ~60% progress

  const startTime = Date.now()
  const response = await v1http.runSync(v1Request)

  if (import.meta.env.DEV) {
    console.log(`✅ [httpV1] Sync fallback completed: ${response.execution_ms}ms`)
  }

  const report = mapV1ResultToReport(response, input.template_id, response.execution_ms)
  handlers.onDone({
    response_id: report.meta.response_id,
    report,
  })
}
