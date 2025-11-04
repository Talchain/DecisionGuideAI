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
import * as v1http from './v1/http'
import { runStream as v1runStream } from './v1/sseClient'
import { V1_LIMITS } from './v1/types'
import { graphToV1Request, computeClientHash, type ReactFlowGraph } from './v1/mapper'
import { shouldUseSync } from './v1/constants'

/**
 * Load template graph from live v1 endpoint
 */
async function loadTemplateGraph(templateId: string): Promise<any> {
  const response = await v1http.templateGraph(templateId)
  return response.graph
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
  // Use structured summary if available, otherwise fall back to parsing answer
  let conservative: number, likely: number, optimistic: number, units: string

  if (result.summary) {
    conservative = result.summary.conservative
    likely = result.summary.likely
    optimistic = result.summary.optimistic
    units = result.summary.units || 'units'
  } else {
    // Fallback: parse answer for numeric values (best effort)
    const answerMatch = result.answer.match(/(\d+\.?\d*)/g)
    likely = answerMatch ? parseFloat(answerMatch[0]) : 0
    conservative = likely * 0.8
    optimistic = likely * 1.2
    units = 'units'
  }

  // Extract drivers from explain_delta.top_drivers (actual API structure)
  const drivers = (result.explain_delta?.top_drivers ?? []).map((d) => ({
    label: d.label || d.node_id || d.edge_id || 'Unknown',
    polarity: (d.impact || 0) > 0 ? 'up' : (d.impact || 0) < 0 ? 'down' : 'neutral',
    strength: Math.abs(d.impact || 0) > 0.7 ? 'high' : Math.abs(d.impact || 0) > 0.3 ? 'medium' : 'low',
    // Preserve IDs for canvas highlighting
    node_id: d.node_id,
    edge_id: d.edge_id,
  }))

  return {
    schema: 'report.v1',
    meta: {
      seed: result.seed || 1337,
      response_id: result.response_hash || `http-v1-${Date.now()}`,
      elapsed_ms: executionMs,
    },
    model_card: {
      response_hash: result.response_hash || '',
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
 * Map v1 Error to UI ErrorV1
 */
function mapV1ErrorToUI(error: V1Error): ErrorV1 {
  return {
    schema: 'error.v1',
    code: error.code as any, // Type compatible
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
      const v1Request = mapGraphToV1Request(graph, input.seed)
      const nodeCount = graph.nodes.length

      // Always use sync endpoint (stream not deployed yet - Oct 2025)
      if (import.meta.env.DEV) {
        console.log(
          `🚀 [httpV1] POST /v1/run (${nodeCount} nodes, using sync endpoint) ` +
          `template=${input.template_id}, seed=${input.seed}`
        )
      }
      const response = await v1http.runSync(v1Request)
      if (import.meta.env.DEV) {
        console.log(`✅ [httpV1] Sync completed: ${response.execution_ms}ms`)
      }
      return mapV1ResultToReport(response.result, input.template_id, response.execution_ms)
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

      // Find template metadata from list (v1 API returns bare array)
      const metadata = listResponse.find(t => t.id === id)

      if (!metadata) {
        throw {
          code: 'BAD_INPUT',
          message: `Template not found: ${id}`,
        } as V1Error
      }

      return {
        id: metadata.id,
        name: metadata.label, // label → name
        version: '1.0', // API doesn't provide version
        description: metadata.summary, // summary → description
        default_seed: graphResponse.default_seed,
        graph: graphResponse.graph,
      }
    } catch (err: any) {
      throw mapV1ErrorToUI(err as V1Error)
    }
  },

  // Limits
  async limits(): Promise<LimitsV1> {
    return {
      nodes: { max: V1_LIMITS.MAX_NODES },
      edges: { max: V1_LIMITS.MAX_EDGES },
    }
  },

  // Health (optional, specific to httpV1)
  async health() {
    return v1http.health()
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
          const report = mapV1ResultToReport(data.result, input.template_id, executionMs)
          handlers.onDone({
            response_id: data.result.response_hash || `http-v1-${Date.now()}`,
            report,
          })
        },
        onError: (error) => {
          // If SSE fails with 404 or 5xx, fall back to sync (if not already aborted)
          if (
            !fallbackAborted &&
            (error.code === 'NOT_FOUND' || error.code === 'SERVER_ERROR' || error.code === 'TIMEOUT')
          ) {
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

  const report = mapV1ResultToReport(response.result, input.template_id, response.execution_ms)
  handlers.onDone({
    response_id: report.meta.response_id,
    report,
  })
}
