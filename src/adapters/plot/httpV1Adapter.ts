/**
 * HTTP v1 adapter - implements UI interface using PLoT v1 API
 * Maps between UI types (ReportV1, ErrorV1) and v1 types
 */

import type {
  RunRequest,
  ReportV1,
  ErrorV1,
  LimitsV1,
  TemplateSummary,
  TemplateDetail,
  TemplateListV1,
  ConfidenceLevel,
} from './types'
import type {
  V1RunRequest,
  V1RunResult,
  V1Error,
  V1StreamHandlers,
} from './v1/types'
import type { ApiGraph, UiGraph, RunResponse } from '../types/plot'
import * as v1http from './v1/http'
import { runStream as v1runStream } from './v1/sseClient'
import { V1_LIMITS } from './v1/types'
import { toApiGraph, isApiGraph, graphToV1Request, computeClientHash, type ReactFlowGraph } from './v1/mapper'
import { toUiReport } from './v1/reportNormalizer'
import { normalizeTemplateGraph, normalizeTemplateListItem } from './v1/templateNormalizer'
import { shouldUseSync } from './v1/constants'
import { limitsManager } from './v1/limitsManager'

/**
 * Load template graph from live v1 endpoint
 */
async function loadTemplateGraph(templateId: string): Promise<{ nodes: unknown[]; edges: unknown[] }> {
  const response = await v1http.templateGraph(templateId)
  // Normalize response (handles both flat and nested formats)
  const normalized = normalizeTemplateGraph(response)
  return {
    nodes: normalized.nodes,
    edges: normalized.edges,
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
 * Map v1 RunResult to UI ReportV1
 */
function mapV1ResultToReport(
  result: V1RunResult,
  templateId: string,
  executionMs: number
): ReportV1 {
  // Backend MUST provide structured summary
  // We no longer parse freeform answer text to avoid silent failures
  if (!result.summary) {
    if (import.meta.env.DEV) {
      console.error('[httpV1] Backend returned no structured summary - cannot parse results')
    }
    throw {
      code: 'SERVER_ERROR',
      message: 'Backend returned no structured summary (result.summary missing)',
    }
  }

  const conservative = result.summary.conservative
  const likely = result.summary.likely
  const optimistic = result.summary.optimistic
  const units = result.summary.units || 'units'

  // Extract drivers from explain_delta.top_drivers (actual API structure)
  const drivers = (result.explain_delta?.top_drivers ?? []).map((d) => ({
    label: d.label || d.node_id || d.edge_id || 'Unknown',
    polarity: (d.impact || 0) > 0 ? 'up' : (d.impact || 0) < 0 ? 'down' : 'neutral',
    strength: Math.abs(d.impact || 0) > 0.7 ? 'high' : Math.abs(d.impact || 0) > 0.3 ? 'medium' : 'low',
    // Preserve metadata for canvas highlighting
    kind: d.kind, // 'node' or 'edge'
    node_id: d.node_id,
    edge_id: d.edge_id,
  }))

  // Validate determinism: backend MUST provide response_hash
  // Support both new location (result.response_hash) and legacy location (model_card.response_hash)
  // Prefer result.response_hash when both present
  const strictDeterminism = String(import.meta.env?.VITE_STRICT_DETERMINISM ?? '1') === '1'
  const legacyHash = (result as any).model_card?.response_hash
  const actualHash = result.response_hash || legacyHash

  if (!actualHash) {
    const errorMsg = 'Backend returned no response_hash (determinism requirement violated)'

    if (strictDeterminism && import.meta.env.MODE !== 'development') {
      // Production: hard fail
      console.error(`[httpV1] ${errorMsg}`)
      throw {
        code: 'SERVER_ERROR',
        message: errorMsg,
      }
    } else {
      // Development: warn and continue with fallback
      console.warn(`[httpV1] ${errorMsg} - continuing in DEV with fallback ID`)
      // Generate a temporary hash from the summary for local testing
      result.response_hash = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    }
  } else {
    // Use the hash we found (prefer result.response_hash)
    result.response_hash = actualHash
  }

  return {
    schema: 'report.v1',
    meta: {
      seed: result.seed || 1337,
      response_id: result.response_hash,
      elapsed_ms: executionMs,
    },
    model_card: {
      response_hash: result.response_hash,
      response_hash_algo: 'sha256',
      normalized: true,
    },
    results: {
      conservative,
      likely,
      optimistic,
      units,
    },
    confidence: {
      level: mapConfidenceLevel(result.confidence),
      why: result.explanation,
    },
    drivers,
  }
}

/**
 * Map v1 Error code to UI ErrorV1 code
 */
function mapErrorCode(code: V1ErrorCode): ErrorV1['code'] {
  // Map v1 error codes to UI error codes
  // TIMEOUT and NETWORK_ERROR are transport-level errors that should appear as SERVER_ERROR to UI
  switch (code) {
    case 'BAD_INPUT':
    case 'LIMIT_EXCEEDED':
    case 'RATE_LIMITED':
      return code
    case 'SERVER_ERROR':
    case 'TIMEOUT':
    case 'NETWORK_ERROR':
      return 'SERVER_ERROR'
    default:
      return 'SERVER_ERROR'
  }
}

/**
 * Map v1 Error to UI ErrorV1
 */
function mapV1ErrorToUI(error: V1Error): ErrorV1 {
  return {
    schema: 'error.v1',
    code: mapErrorCode(error.code),
    error: error.message,
    hint: undefined,
    fields: error.field
      ? {
          field: error.field,
          max: error.max,
        }
      : undefined,
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

  // Add deterministic client hash for idempotency
  const clientHash = computeClientHash(rfGraph, seed)

  return {
    ...v1Request,
    clientHash,
  }
}

/**
 * HTTP v1 Adapter
 */
export const httpV1Adapter = {
  // Run: uses sync endpoint only (stream not deployed yet)
  async run(input: RunRequest): Promise<ReportV1> {
    // Use provided graph (from canvas edits), or fetch template as fallback
    const graph = input.graph || await loadTemplateGraph(input.template_id)

    try {
      // Check if graph is already in API shape (from /v1/templates/{id}/graph)
      // If not, convert UI shape to API shape
      const apiGraph: ApiGraph = isApiGraph(graph)
        ? graph
        : toApiGraph(graph as UiGraph)

      // Build request with API shape + optional knobs
      const requestBody: V1RunRequest = {
        graph: apiGraph,
        seed: input.seed,
      }

      // Add optional knobs if provided
      if (input.k_samples !== undefined) requestBody.k_samples = input.k_samples
      if (input.treatment_node) requestBody.treatment_node = input.treatment_node
      if (input.outcome_node) requestBody.outcome_node = input.outcome_node
      if (input.baseline_value !== undefined) requestBody.baseline_value = input.baseline_value
      if (input.inference_mode) requestBody.inference_mode = input.inference_mode

      // Add include_debug if Compare or Inspector debug features are enabled
      // Debug slices DO NOT affect response_hash (server-side exclusion)
      const compareDebugEnabled = import.meta.env.VITE_FEATURE_COMPARE_DEBUG === '1'
      const inspectorDebugEnabled = import.meta.env.VITE_FEATURE_INSPECTOR_DEBUG === '1'
      if (compareDebugEnabled || inspectorDebugEnabled) {
        requestBody.include_debug = true
        if (import.meta.env.DEV) {
          console.log('[httpV1] include_debug=true (Compare:', compareDebugEnabled, ', Inspector:', inspectorDebugEnabled, ')')
        }
      }

      const nodeCount = apiGraph.nodes.length

      // PREFLIGHT: Validate request before execution
      try {
        const validation = await v1http.validate(requestBody)

        if (!validation.valid) {
          // Build user-friendly error message from violations
          const violationMessages = validation.violations
            .map(v => `${v.field}: ${v.message}`)
            .join('; ')

          throw {
            schema: 'error.v1',
            code: 'BAD_INPUT',
            error: `Validation failed: ${violationMessages}`,
            fields: validation.violations.length > 0 ? {
              field: validation.violations[0].field,
            } : undefined,
          } as ErrorV1
        }

        if (import.meta.env.DEV) {
          console.log('[httpV1] Preflight validation passed')
        }
      } catch (err: any) {
        // If validation endpoint fails, log warning but continue (graceful degradation)
        // This prevents validation service outage from blocking all runs
        if (err.schema === 'error.v1') {
          throw err // Re-throw validation errors
        }
        if (import.meta.env.DEV) {
          console.warn('[httpV1] Preflight validation failed, continuing anyway:', err)
        }
      }

      // Always use sync endpoint (stream not deployed yet - Oct 2025)
      if (import.meta.env.DEV) {
        console.log(
          `🚀 [httpV1] POST /v1/run (${nodeCount} nodes, using sync endpoint) ` +
          `template=${input.template_id}, seed=${input.seed}`
        )
      }

      const response = await v1http.runSync(requestBody)

      if (import.meta.env.DEV) {
        console.log(`✅ [httpV1] Sync completed: ${response.execution_ms}ms`)
      }

      // Normalize response envelope
      const normalized = toUiReport(response.result as RunResponse)

      // Map confidence 0-1 to ConfidenceLevel
      let confidenceLevel: ConfidenceLevel = 'medium'
      if (normalized.confidence !== undefined) {
        if (normalized.confidence >= 0.7) confidenceLevel = 'high'
        else if (normalized.confidence < 0.4) confidenceLevel = 'low'
      }

      // Map to ReportV1 format expected by UI
      //
      // DETERMINISM ENFORCEMENT:
      // - Backend MUST return response_hash for deterministic runs
      // - We fail fast if hash is missing to catch backend drift
      if (!normalized.hash) {
        if (import.meta.env.DEV) {
          console.error('[httpV1] Backend returned no response_hash - determinism broken!')
        }
        throw {
          schema: 'error.v1',
          code: 'SERVER_ERROR',
          error: 'Backend returned no response_hash (determinism requirement violated)',
        } as ErrorV1
      }

      // Build report with debug slices if present
      const report: ReportV1 = {
        schema: 'report.v1',
        meta: {
          seed: normalized.seed || input.seed || 1337,
          response_id: normalized.hash,
          elapsed_ms: response.execution_ms || 0,
        },
        model_card: {
          response_hash: normalized.hash,
          response_hash_algo: 'sha256',
          normalized: true,
        },
        results: {
          conservative: normalized.conservative || 0,
          likely: normalized.mostLikely || 0,
          optimistic: normalized.optimistic || 0,
          units: normalized.units || 'units',
        },
        confidence: {
          level: confidenceLevel,
          why: normalized.explanation || '',
        },
        drivers: normalized.drivers,
      }

      // Pass through debug slices if present (Phase 2+)
      // Debug slices DO NOT affect response_hash
      if ((response.result as any).debug) {
        report.debug = (response.result as any).debug
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

      // Map v1 API fields to UI format using normalizer
      return {
        schema: 'template-list.v1',
        items: response.map(normalizeTemplateListItem),
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

      // Find template metadata from list (v1 API returns bare array)
      const metadata = listResponse.find(t => t.id === id)

      if (!metadata) {
        throw {
          code: 'BAD_INPUT',
          message: `Template not found: ${id}`,
        } as V1Error
      }

      // Normalize graph response (handles both flat and nested formats)
      const normalized = normalizeTemplateGraph(graphResponse)

      // Normalize metadata using normalizeTemplateListItem for consistent field mapping
      const normalizedMetadata = normalizeTemplateListItem(metadata)

      return {
        id: normalizedMetadata.id,
        name: normalizedMetadata.name,
        version: normalizedMetadata.version,
        description: normalizedMetadata.description,
        default_seed: normalized.default_seed,
        graph: {
          nodes: normalized.nodes,
          edges: normalized.edges,
          meta: normalized.meta, // Include suggested_positions for F2: use backend-provided positions
        },
      }
    } catch (err: any) {
      throw mapV1ErrorToUI(err as V1Error)
    }
  },

  // Limits - Use singleton (hydrated at boot, with fallback)
  async limits(): Promise<LimitsV1> {
    // Get limits from singleton (synchronous)
    // Singleton is hydrated at boot and has graceful fallback to V1_LIMITS
    const limits = limitsManager.getLimits()

    return {
      nodes: { max: limits.nodes.max },
      edges: { max: limits.edges.max },
    }
  },

  // Validate - Check if graph meets backend constraints before running
  async validate(input: RunRequest): Promise<{ valid: true } | { valid: false; violations: Array<{ field: string; message: string }> }> {
    const graph = input.graph || await loadTemplateGraph(input.template_id)

    // Check if graph is already in API shape (from /v1/templates/{id}/graph)
    // If not, convert UI shape to API shape
    const apiGraph: ApiGraph = isApiGraph(graph)
      ? graph
      : toApiGraph(graph as UiGraph)

    // Build request with API shape
    const requestBody: V1RunRequest = {
      graph: apiGraph,
      seed: input.seed,
    }

    // Add optional knobs if provided
    if (input.k_samples !== undefined) requestBody.k_samples = input.k_samples
    if (input.treatment_node) requestBody.treatment_node = input.treatment_node
    if (input.outcome_node) requestBody.outcome_node = input.outcome_node
    if (input.baseline_value !== undefined) requestBody.baseline_value = input.baseline_value

    return v1http.validate(requestBody)
  },

  // Health (optional, specific to httpV1)
  async health() {
    return v1http.health()
  },

  // SSE streaming: Feature flag gated (VITE_FEATURE_PLOT_STREAM=1)
  ...(import.meta.env.VITE_FEATURE_PLOT_STREAM === '1' ? {
    stream: {
      /**
       * Run analysis via SSE streaming
       * Maps v1 SSE events to UI event structure
       * Returns cancel function
       */
      run(
        input: RunRequest,
        handlers: {
          onHello?: (data: { response_id: string }) => void
          onTick?: (data: { index: number }) => void
          onInterim?: (data: { findings: string[] }) => void
          onDone: (data: { response_id: string; report: ReportV1 }) => void
          onError: (error: ErrorV1) => void
        }
      ): () => void {
        // Map UI request to v1 format
        const seed = input.seed ?? 1337

        // Build v1 request (will throw if validation fails)
        let v1Request: V1RunRequest
        try {
          const graph = input.graph // Must be provided for streaming
          if (!graph) {
            throw {
              code: 'BAD_INPUT',
              message: 'Graph required for streaming runs',
            } as V1Error
          }

          const apiGraph: ApiGraph = isApiGraph(graph)
            ? graph
            : toApiGraph(graph as UiGraph)

          v1Request = {
            graph: apiGraph,
            seed,
          }

          // Add optional knobs
          if (input.k_samples !== undefined) v1Request.k_samples = input.k_samples
          if (input.treatment_node) v1Request.treatment_node = input.treatment_node
          if (input.outcome_node) v1Request.outcome_node = input.outcome_node
          if (input.baseline_value !== undefined) v1Request.baseline_value = input.baseline_value
        } catch (err: any) {
          // Synchronously call onError for setup failures
          handlers.onError(mapV1ErrorToUI(err as V1Error))
          return () => {} // Return no-op cancel
        }

        if (import.meta.env.DEV) {
          console.log(`🌊 [httpV1] Streaming run started (seed=${seed})`)
        }

        // Track run ID from started event
        let runId: string | undefined

        // Map v1 SSE events to UI events
        const cancelFn = v1runStream(v1Request, {
          onStarted: (data) => {
            runId = data.run_id
            if (handlers.onHello) {
              handlers.onHello({ response_id: data.run_id })
            }
            if (import.meta.env.DEV) {
              console.log(`[httpV1] Stream started: ${runId}`)
            }
          },

          onProgress: (data) => {
            // Map progress percent (0-100) to tick index (0-5) for UI compatibility
            // Progress capped at 90% in sseClient until COMPLETE
            const tickIndex = Math.floor((data.percent / 100) * 5)
            if (handlers.onTick) {
              handlers.onTick({ index: tickIndex })
            }
          },

          onInterim: (data) => {
            // Forward interim findings to UI if handler provided
            if (handlers.onInterim) {
              handlers.onInterim({ findings: data.findings })
            }
            if (import.meta.env.DEV) {
              console.log('[httpV1] Interim findings:', data.findings)
            }
          },

          onComplete: (data) => {
            if (import.meta.env.DEV) {
              console.log(`✅ [httpV1] Stream completed: ${data.execution_ms}ms`)
            }

            // Normalize response envelope
            const normalized = toUiReport(data.result as RunResponse)

            // Map confidence 0-1 to ConfidenceLevel
            let confidenceLevel: ConfidenceLevel = 'medium'
            if (normalized.confidence !== undefined) {
              if (normalized.confidence >= 0.7) confidenceLevel = 'high'
              else if (normalized.confidence < 0.4) confidenceLevel = 'low'
            }

            // Validate determinism
            if (!normalized.hash) {
              handlers.onError({
                schema: 'error.v1',
                code: 'SERVER_ERROR',
                error: 'Backend returned no response_hash (determinism requirement violated)',
              })
              return
            }

            const report: ReportV1 = {
              schema: 'report.v1',
              meta: {
                seed: normalized.seed || seed,
                response_id: normalized.hash,
                elapsed_ms: data.execution_ms || 0,
              },
              model_card: {
                response_hash: normalized.hash,
                response_hash_algo: 'sha256',
                normalized: true,
              },
              results: {
                conservative: normalized.conservative || 0,
                likely: normalized.mostLikely || 0,
                optimistic: normalized.optimistic || 0,
                units: normalized.units || 'units',
              },
              confidence: {
                level: confidenceLevel,
                why: normalized.explanation || '',
              },
              drivers: normalized.drivers,
            }

            handlers.onDone({
              response_id: normalized.hash,
              report,
            })
          },

          onError: (error) => {
            if (import.meta.env.DEV) {
              console.error('[httpV1] Stream error:', error)
            }
            handlers.onError(mapV1ErrorToUI(error))
          },
        })

        // Return cancel function that also calls backend cancel endpoint
        return () => {
          cancelFn() // Cancel SSE stream
          if (runId) {
            v1http.cancel(runId).catch((err) => {
              if (import.meta.env.DEV) {
                console.warn('[httpV1] Backend cancel failed:', err)
              }
            })
          }
        }
      },
    },
  } : {}),
}
