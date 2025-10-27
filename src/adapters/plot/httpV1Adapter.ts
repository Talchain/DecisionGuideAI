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

// Re-export mockAdapter's local template functions
import { plot as mockAdapter } from './mockAdapter'

/**
 * Load template and extract graph
 */
async function loadTemplateGraph(templateId: string): Promise<any> {
  const template = await mockAdapter.template(templateId)
  return template.graph
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
  // Parse answer for numeric values (best effort)
  const answerMatch = result.answer.match(/(\d+\.?\d*)/g)
  const likely = answerMatch ? parseFloat(answerMatch[0]) : 0

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
      conservative: likely * 0.8, // Conservative estimate
      likely,
      optimistic: likely * 1.2, // Optimistic estimate
      units: 'count',
    },
    confidence: {
      level: mapConfidenceLevel(result.confidence),
      why: result.explanation,
    },
    drivers: result.drivers.map((d) => ({
      label: d.label || d.id || 'Unknown',
      polarity: (d.impact || 0) > 0 ? 'up' : (d.impact || 0) < 0 ? 'down' : 'neutral',
      strength: Math.abs(d.impact || 0) > 0.7 ? 'high' : Math.abs(d.impact || 0) > 0.3 ? 'medium' : 'low',
    })),
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
  // Sync run
  async run(input: RunRequest): Promise<ReportV1> {
    const graph = await loadTemplateGraph(input.template_id)

    try {
      const v1Request = mapGraphToV1Request(graph, input.seed)
      const nodeCount = graph.nodes.length
      const useSync = shouldUseSync(nodeCount)
      console.log(
        `🚀 [httpV1] POST /v1/run (${nodeCount} nodes, ` +
        `${useSync ? '✓ sync recommended' : '⚠️ stream recommended for >30 nodes'}) ` +
        `template=${input.template_id}, seed=${input.seed}`
      )
      const response = await v1http.runSync(v1Request)
      console.log(`✅ [httpV1] Live PLoT engine responded: ${response.execution_ms}ms`)
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

  // Templates (local only, passthrough to mock)
  async templates(): Promise<TemplateListV1> {
    return mockAdapter.templates()
  },

  async template(id: string): Promise<TemplateDetail> {
    return mockAdapter.template(id)
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

  // SSE streaming
  stream: {
    run(input: RunRequest, handlers: {
      onTick?: (data: { index: number }) => void
      onDone?: (data: { response_id: string; report: ReportV1 }) => void
      onError?: (error: ErrorV1) => void
    }): () => void {
      let runId: string | null = null
      let isComplete = false
      let v1Cancel: (() => void) | null = null

      // Load template and start stream
      loadTemplateGraph(input.template_id)
        .then((graph) => {
          if (isComplete) return // Already cancelled

          try {
            const v1Request = mapGraphToV1Request(graph, input.seed)
            const nodeCount = graph.nodes.length
            const useSync = shouldUseSync(nodeCount)
            console.log(
              `🌊 [httpV1] POST /v1/stream (${nodeCount} nodes, ` +
              `${useSync ? '⚠️ sync recommended for ≤30 nodes' : '✓ stream recommended'}) ` +
              `template=${input.template_id}, seed=${input.seed}`
            )

            const v1Handlers: V1StreamHandlers = {
              onStarted: (data) => {
                runId = data.run_id
              },
              onProgress: (data) => {
                // Map to tick for UI compat
                handlers.onTick?.({ index: Math.floor(data.percent / 20) })
              },
              onInterim: (data) => {
                // UI doesn't have onInterim, skip for now
              },
              onComplete: (data) => {
                isComplete = true
                console.log(`✅ [httpV1] Live PLoT stream completed: ${data.execution_ms}ms`)
                const report = mapV1ResultToReport(data.result, input.template_id, data.execution_ms)
                handlers.onDone?.({ response_id: report.meta.response_id, report })
              },
              onError: (error) => {
                isComplete = true
                handlers.onError?.(mapV1ErrorToUI(error))
              },
            }

            v1Cancel = v1runStream(v1Request, v1Handlers)
          } catch (err: any) {
            // Handle validation errors from mapper
            isComplete = true
            if (err.code === 'LIMIT_EXCEEDED' || err.code === 'BAD_INPUT') {
              handlers.onError?.({
                schema: 'error.v1',
                code: err.code,
                error: err.message,
                fields: err.field ? { field: err.field, max: err.max } : undefined,
              } as ErrorV1)
            } else {
              handlers.onError?.(mapV1ErrorToUI(err as V1Error))
            }
          }
        })
        .catch((err) => {
          isComplete = true
          handlers.onError?.(mapV1ErrorToUI(err as V1Error))
        })

      // Return cancel function
      return () => {
        isComplete = true
        if (runId) {
          v1http.cancel(runId)
        }
        if (v1Cancel) {
          v1Cancel()
        }
      }
    },
  },
}
